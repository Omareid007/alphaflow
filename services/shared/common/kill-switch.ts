/**
 * AI Active Trader - Kill Switch / Emergency Trading Halt
 * Provides system-wide emergency trading halt capabilities with configurable triggers.
 * Based on exchange circuit breaker and risk management best practices.
 */

export enum KillSwitchReason {
  MANUAL = 'MANUAL',
  DAILY_LOSS_LIMIT = 'DAILY_LOSS_LIMIT',
  CONSECUTIVE_LOSSES = 'CONSECUTIVE_LOSSES',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  MARKET_VOLATILITY = 'MARKET_VOLATILITY',
  API_FAILURE = 'API_FAILURE',
  POSITION_LIMIT = 'POSITION_LIMIT',
  BROKER_DISCONNECT = 'BROKER_DISCONNECT',
  RECONCILIATION_MISMATCH = 'RECONCILIATION_MISMATCH',
}

export interface KillSwitchConfig {
  dailyLossLimitPercent: number;
  consecutiveLossesLimit: number;
  maxVolatilityThreshold: number;
  apiFailureThreshold: number;
  autoResumeAfterMs: number | null;
  onTrigger?: (reason: KillSwitchReason, details: Record<string, unknown>) => void;
  onResume?: () => void;
}

interface KillSwitchState {
  isTriggered: boolean;
  reason: KillSwitchReason | null;
  triggeredAt: Date | null;
  triggeredBy: string | null;
  details: Record<string, unknown>;
  resumeAt: Date | null;
}

const DEFAULT_CONFIG: KillSwitchConfig = {
  dailyLossLimitPercent: 5,
  consecutiveLossesLimit: 10,
  maxVolatilityThreshold: 3.0,
  apiFailureThreshold: 5,
  autoResumeAfterMs: null,
};

export class KillSwitch {
  private static instance: KillSwitch;
  private config: KillSwitchConfig;
  private state: KillSwitchState = {
    isTriggered: false,
    reason: null,
    triggeredAt: null,
    triggeredBy: null,
    details: {},
    resumeAt: null,
  };
  private history: Array<{ action: 'trigger' | 'resume'; timestamp: Date; reason?: KillSwitchReason; by?: string }> = [];
  private consecutiveLosses = 0;
  private apiFailures: Map<string, number> = new Map();
  private resumeTimeout: ReturnType<typeof setTimeout> | null = null;

  private constructor(config: Partial<KillSwitchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<KillSwitchConfig>): KillSwitch {
    if (!KillSwitch.instance) {
      KillSwitch.instance = new KillSwitch(config);
    } else if (config) {
      KillSwitch.instance.updateConfig(config);
    }
    return KillSwitch.instance;
  }

  static resetInstance(): void {
    if (KillSwitch.instance?.resumeTimeout) {
      clearTimeout(KillSwitch.instance.resumeTimeout);
    }
    KillSwitch.instance = undefined as any;
  }

  updateConfig(config: Partial<KillSwitchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  trigger(reason: KillSwitchReason, details: Record<string, unknown> = {}, triggeredBy = 'system'): void {
    if (this.state.isTriggered) {
      return;
    }

    this.state = {
      isTriggered: true,
      reason,
      triggeredAt: new Date(),
      triggeredBy,
      details,
      resumeAt: this.config.autoResumeAfterMs
        ? new Date(Date.now() + this.config.autoResumeAfterMs)
        : null,
    };

    this.history.push({
      action: 'trigger',
      timestamp: new Date(),
      reason,
      by: triggeredBy,
    });

    this.config.onTrigger?.(reason, details);

    if (this.config.autoResumeAfterMs) {
      this.resumeTimeout = setTimeout(() => {
        this.resume('auto-resume');
      }, this.config.autoResumeAfterMs);
    }
  }

  resume(resumedBy = 'manual'): void {
    if (!this.state.isTriggered) {
      return;
    }

    if (this.resumeTimeout) {
      clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }

    this.history.push({
      action: 'resume',
      timestamp: new Date(),
      by: resumedBy,
    });

    this.state = {
      isTriggered: false,
      reason: null,
      triggeredAt: null,
      triggeredBy: null,
      details: {},
      resumeAt: null,
    };

    this.consecutiveLosses = 0;
    this.apiFailures.clear();

    this.config.onResume?.();
  }

  isActive(): boolean {
    return this.state.isTriggered;
  }

  getState(): Readonly<KillSwitchState> {
    return { ...this.state };
  }

  getHistory(): ReadonlyArray<{ action: 'trigger' | 'resume'; timestamp: Date; reason?: KillSwitchReason; by?: string }> {
    return [...this.history];
  }

  recordTradeLoss(lossPercent: number): void {
    if (this.state.isTriggered) return;

    this.consecutiveLosses++;

    if (this.consecutiveLosses >= this.config.consecutiveLossesLimit) {
      this.trigger(KillSwitchReason.CONSECUTIVE_LOSSES, {
        consecutiveLosses: this.consecutiveLosses,
        limit: this.config.consecutiveLossesLimit,
      });
    }
  }

  recordTradeWin(): void {
    this.consecutiveLosses = 0;
  }

  checkDailyLoss(dailyLossPercent: number): void {
    if (this.state.isTriggered) return;

    if (Math.abs(dailyLossPercent) >= this.config.dailyLossLimitPercent) {
      this.trigger(KillSwitchReason.DAILY_LOSS_LIMIT, {
        dailyLossPercent,
        limit: this.config.dailyLossLimitPercent,
      });
    }
  }

  checkVolatility(volatility: number, symbol: string): void {
    if (this.state.isTriggered) return;

    if (volatility >= this.config.maxVolatilityThreshold) {
      this.trigger(KillSwitchReason.MARKET_VOLATILITY, {
        symbol,
        volatility,
        threshold: this.config.maxVolatilityThreshold,
      });
    }
  }

  recordApiFailure(apiName: string): void {
    if (this.state.isTriggered) return;

    const failures = (this.apiFailures.get(apiName) || 0) + 1;
    this.apiFailures.set(apiName, failures);

    if (failures >= this.config.apiFailureThreshold) {
      this.trigger(KillSwitchReason.API_FAILURE, {
        apiName,
        failures,
        threshold: this.config.apiFailureThreshold,
      });
    }
  }

  recordApiSuccess(apiName: string): void {
    this.apiFailures.delete(apiName);
  }

  canTrade(): { allowed: boolean; reason?: string } {
    if (!this.state.isTriggered) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `Trading halted: ${this.state.reason} triggered at ${this.state.triggeredAt?.toISOString()}`,
    };
  }
}

export function createKillSwitch(config?: Partial<KillSwitchConfig>): KillSwitch {
  return KillSwitch.getInstance(config);
}
