/**
 * AI Active Trader - Cycle Manager
 * Manages trading cycle lifecycle and state
 */

import { EventBusClient } from '../shared/events';
import { TradingCycle, CycleStatus, CycleConfig, CycleType } from './types';

export interface CycleManagerConfig {
  defaultSymbols: string[];
  defaultIntervalMs: number;
}

const DEFAULT_CONFIG: CycleManagerConfig = {
  defaultSymbols: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'NVDA'],
  defaultIntervalMs: 60000,
};

function generateCycleId(): string {
  return `cycle_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export class CycleManager {
  private currentCycle: TradingCycle | null = null;
  private cycleHistory: TradingCycle[] = [];
  private config: CycleManagerConfig;
  private eventBus: EventBusClient | null = null;
  private logger: { info: Function; warn: Function; error: Function };
  private maxHistorySize = 100;

  constructor(
    config: Partial<CycleManagerConfig> = {},
    logger?: { info: Function; warn: Function; error: Function }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger || console;
  }

  setEventBus(eventBus: EventBusClient): void {
    this.eventBus = eventBus;
  }

  async startCycle(
    symbols: string[] = this.config.defaultSymbols,
    cycleType: CycleType = 'analysis'
  ): Promise<TradingCycle> {
    if (this.currentCycle && this.currentCycle.status === 'running') {
      throw new Error(`Cycle ${this.currentCycle.cycleId} is already running`);
    }

    const cycle: TradingCycle = {
      cycleId: generateCycleId(),
      status: 'running',
      startedAt: new Date(),
      symbols,
      decisionsCount: 0,
      tradesCount: 0,
      cycleType,
    };

    this.currentCycle = cycle;
    this.logger.info('Trading cycle started', { cycleId: cycle.cycleId, symbols, cycleType });

    if (this.eventBus) {
      await this.eventBus.publish('orchestrator.cycle.started', {
        cycleId: cycle.cycleId,
        cycleType,
        symbols,
        startedAt: cycle.startedAt.toISOString(),
      });
    }

    return cycle;
  }

  async stopCycle(): Promise<TradingCycle | null> {
    if (!this.currentCycle || this.currentCycle.status !== 'running') {
      this.logger.warn('No running cycle to stop');
      return null;
    }

    const cycle = this.currentCycle;
    cycle.status = 'completed';
    cycle.completedAt = new Date();

    const duration = cycle.completedAt.getTime() - cycle.startedAt.getTime();

    this.archiveCycle(cycle);
    this.currentCycle = null;

    this.logger.info('Trading cycle stopped', {
      cycleId: cycle.cycleId,
      duration,
      decisionsCount: cycle.decisionsCount,
      tradesCount: cycle.tradesCount,
    });

    if (this.eventBus) {
      await this.eventBus.publish('orchestrator.cycle.completed', {
        cycleId: cycle.cycleId,
        cycleType: cycle.cycleType,
        duration,
        decisionsCount: cycle.decisionsCount,
        tradesCount: cycle.tradesCount,
        completedAt: cycle.completedAt.toISOString(),
      });
    }

    return cycle;
  }

  pauseCycle(): TradingCycle | null {
    if (!this.currentCycle || this.currentCycle.status !== 'running') {
      this.logger.warn('No running cycle to pause');
      return null;
    }

    this.currentCycle.status = 'paused';
    this.logger.info('Trading cycle paused', { cycleId: this.currentCycle.cycleId });
    return this.currentCycle;
  }

  resumeCycle(): TradingCycle | null {
    if (!this.currentCycle || this.currentCycle.status !== 'paused') {
      this.logger.warn('No paused cycle to resume');
      return null;
    }

    this.currentCycle.status = 'running';
    this.logger.info('Trading cycle resumed', { cycleId: this.currentCycle.cycleId });
    return this.currentCycle;
  }

  getCycleStatus(): {
    isRunning: boolean;
    cycle: TradingCycle | null;
    uptime: number | null;
  } {
    const isRunning = this.currentCycle?.status === 'running';
    const uptime = this.currentCycle
      ? Date.now() - this.currentCycle.startedAt.getTime()
      : null;

    return {
      isRunning,
      cycle: this.currentCycle,
      uptime,
    };
  }

  incrementDecisions(): void {
    if (this.currentCycle && this.currentCycle.status === 'running') {
      this.currentCycle.decisionsCount++;
    }
  }

  incrementTrades(): void {
    if (this.currentCycle && this.currentCycle.status === 'running') {
      this.currentCycle.tradesCount++;
    }
  }

  getCycleHistory(): TradingCycle[] {
    return [...this.cycleHistory];
  }

  private archiveCycle(cycle: TradingCycle): void {
    this.cycleHistory.unshift(cycle);
    if (this.cycleHistory.length > this.maxHistorySize) {
      this.cycleHistory.pop();
    }
  }
}

export function createCycleManager(
  config?: Partial<CycleManagerConfig>,
  logger?: { info: Function; warn: Function; error: Function }
): CycleManager {
  return new CycleManager(config, logger);
}
