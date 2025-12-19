/**
 * AI Active Trader - Risk Manager
 * Pre-trade risk checks and portfolio risk management
 * Enhanced with dynamic risk adjustments based on market conditions
 */

import { createLogger } from '../shared/common';
import { OrderRequest, RiskLimits, RiskCheckResult, PortfolioSnapshot } from './types';
import { PositionManager } from './position-manager';
import { dynamicRiskManager, DynamicRiskManager } from '../../server/services/dynamic-risk-manager';

const logger = createLogger('risk-manager', 'info');

// Legacy hardcoded values (preserved for reference)
// const STATIC_MAX_POSITION_SIZE_PERCENT = 10;
// const STATIC_MAX_TOTAL_EXPOSURE_PERCENT = 80;
// const STATIC_MAX_POSITIONS_COUNT = 20;
// const STATIC_DAILY_LOSS_LIMIT_PERCENT = 5;

const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionSizePercent: 10,
  maxTotalExposurePercent: 80,
  maxPositionsCount: 20,
  dailyLossLimitPercent: 5,
};

export class RiskManager {
  private riskLimits: RiskLimits;
  private positionManager: PositionManager | null = null;
  private portfolioSnapshot: PortfolioSnapshot = {
    totalEquity: 100000,
    cashBalance: 100000,
    positionsValue: 0,
    dailyPnl: 0,
  };
  private useDynamicLimits: boolean = false;
  private dynamicRiskManager: DynamicRiskManager;

  constructor(limits?: Partial<RiskLimits>, useDynamic: boolean = false) {
    this.riskLimits = { ...DEFAULT_RISK_LIMITS, ...limits };
    this.useDynamicLimits = useDynamic;
    this.dynamicRiskManager = dynamicRiskManager;

    if (useDynamic) {
      logger.info('Risk Manager initialized with DYNAMIC risk adjustments enabled');
    } else {
      logger.info('Risk Manager initialized with static limits');
    }
  }

  setPositionManager(positionManager: PositionManager): void {
    this.positionManager = positionManager;
  }

  updatePortfolioSnapshot(snapshot: Partial<PortfolioSnapshot>): void {
    this.portfolioSnapshot = { ...this.portfolioSnapshot, ...snapshot };
  }

  /**
   * Get effective risk limits (dynamic or static based on configuration)
   */
  async getEffectiveRiskLimits(recentTrades?: { pnl: number; timestamp: Date }[]): Promise<RiskLimits> {
    if (!this.useDynamicLimits) {
      return { ...this.riskLimits };
    }

    try {
      const adjusted = await this.dynamicRiskManager.getAdjustedLimits(
        this.portfolioSnapshot,
        recentTrades
      );

      logger.info('Dynamic risk limits applied', {
        original: this.riskLimits,
        adjusted: {
          maxPositionPct: adjusted.maxPositionPct,
          maxExposurePct: adjusted.maxExposurePct,
        },
        reason: adjusted.reason,
        scalingFactors: adjusted.scalingFactors,
      });

      return this.dynamicRiskManager.toLegacyRiskLimits(adjusted);
    } catch (error) {
      logger.error('Failed to get dynamic limits, falling back to static', error as Error);
      return { ...this.riskLimits };
    }
  }

  /**
   * Check pre-trade risk with optional dynamic adjustments
   */
  async checkPreTradeRisk(
    request: OrderRequest,
    limits?: Partial<RiskLimits>,
    recentTrades?: { pnl: number; timestamp: Date }[]
  ): Promise<RiskCheckResult> {
    // Get effective limits (dynamic or static)
    let effectiveLimits: RiskLimits;
    if (this.useDynamicLimits) {
      effectiveLimits = await this.getEffectiveRiskLimits(recentTrades);
    } else {
      effectiveLimits = { ...this.riskLimits };
    }

    // Apply any override limits
    if (limits) {
      effectiveLimits = { ...effectiveLimits, ...limits };
    }

    // Check if new positions are allowed (VIX-based emergency mode)
    if (this.useDynamicLimits && request.side === 'buy') {
      const newPositionsCheck = await this.dynamicRiskManager.shouldAllowNewPositions();
      if (!newPositionsCheck.allowed) {
        logger.warn('New positions blocked by dynamic risk manager', {
          reason: newPositionsCheck.reason,
        });
        return {
          allowed: false,
          reason: newPositionsCheck.reason,
        };
      }
    }

    const estimatedPrice = request.limitPrice || this.getEstimatedPrice(request.symbol);
    const orderValue = request.quantity * estimatedPrice;

    const positionSizeCheck = this.checkPositionSize(orderValue, effectiveLimits);
    if (!positionSizeCheck.allowed) {
      logger.warn('Position size check failed', {
        symbol: request.symbol,
        orderValue,
        reason: positionSizeCheck.reason,
      });
      return positionSizeCheck;
    }

    const exposureCheck = this.checkTotalExposure(orderValue, effectiveLimits);
    if (!exposureCheck.allowed) {
      logger.warn('Exposure check failed', {
        symbol: request.symbol,
        reason: exposureCheck.reason,
      });
      return exposureCheck;
    }

    const positionCountCheck = this.checkPositionCount(request.symbol, effectiveLimits);
    if (!positionCountCheck.allowed) {
      logger.warn('Position count check failed', {
        symbol: request.symbol,
        reason: positionCountCheck.reason,
      });
      return positionCountCheck;
    }

    const dailyLossCheck = this.checkDailyLossLimit(effectiveLimits);
    if (!dailyLossCheck.allowed) {
      logger.warn('Daily loss check failed', { reason: dailyLossCheck.reason });
      return dailyLossCheck;
    }

    const cashCheck = this.checkCashAvailable(orderValue, request.side);
    if (!cashCheck.allowed) {
      logger.warn('Cash check failed', {
        orderValue,
        cashBalance: this.portfolioSnapshot.cashBalance,
        reason: cashCheck.reason,
      });
      return cashCheck;
    }

    logger.info('Risk check passed', {
      symbol: request.symbol,
      side: request.side,
      quantity: request.quantity,
    });

    return { allowed: true };
  }

  private checkPositionSize(orderValue: number, limits: RiskLimits): RiskCheckResult {
    const maxPositionValue = (this.portfolioSnapshot.totalEquity * limits.maxPositionSizePercent) / 100;

    if (orderValue > maxPositionValue) {
      return {
        allowed: false,
        reason: `Order value (${orderValue.toFixed(2)}) exceeds max position size (${maxPositionValue.toFixed(2)}, ${limits.maxPositionSizePercent}% of equity)`,
      };
    }

    return { allowed: true };
  }

  private checkTotalExposure(orderValue: number, limits: RiskLimits): RiskCheckResult {
    const currentExposure = this.positionManager?.getTotalExposure() || 0;
    const newExposure = currentExposure + orderValue;
    const maxExposure = (this.portfolioSnapshot.totalEquity * limits.maxTotalExposurePercent) / 100;

    if (newExposure > maxExposure) {
      return {
        allowed: false,
        reason: `Total exposure (${newExposure.toFixed(2)}) would exceed max allowed (${maxExposure.toFixed(2)}, ${limits.maxTotalExposurePercent}% of equity)`,
      };
    }

    return { allowed: true };
  }

  private checkPositionCount(symbol: string, limits: RiskLimits): RiskCheckResult {
    if (!this.positionManager) {
      return { allowed: true };
    }

    const existingPositions = this.positionManager.getPositionsBySymbol(symbol);
    if (existingPositions.length > 0) {
      return { allowed: true };
    }

    const currentCount = this.positionManager.getPositionCount();
    if (currentCount >= limits.maxPositionsCount) {
      return {
        allowed: false,
        reason: `Already at max positions (${currentCount}/${limits.maxPositionsCount})`,
      };
    }

    return { allowed: true };
  }

  private checkDailyLossLimit(limits: RiskLimits): RiskCheckResult {
    const maxDailyLoss = (this.portfolioSnapshot.totalEquity * limits.dailyLossLimitPercent) / 100;
    const currentLoss = -this.portfolioSnapshot.dailyPnl;

    if (currentLoss > maxDailyLoss) {
      return {
        allowed: false,
        reason: `Daily loss limit reached (${currentLoss.toFixed(2)} / ${maxDailyLoss.toFixed(2)}, ${limits.dailyLossLimitPercent}% of equity)`,
      };
    }

    return { allowed: true };
  }

  private checkCashAvailable(orderValue: number, side: 'buy' | 'sell'): RiskCheckResult {
    if (side === 'sell') {
      return { allowed: true };
    }

    if (orderValue > this.portfolioSnapshot.cashBalance) {
      return {
        allowed: false,
        reason: `Insufficient cash (need ${orderValue.toFixed(2)}, have ${this.portfolioSnapshot.cashBalance.toFixed(2)})`,
      };
    }

    return { allowed: true };
  }

  private getEstimatedPrice(symbol: string): number {
    const basePrices: Record<string, number> = {
      AAPL: 185.0,
      GOOGL: 140.0,
      MSFT: 375.0,
      AMZN: 155.0,
      TSLA: 250.0,
      SPY: 475.0,
      QQQ: 400.0,
      BTC: 45000.0,
      ETH: 2500.0,
    };

    return basePrices[symbol.toUpperCase()] || 100.0;
  }

  getRiskLimits(): RiskLimits {
    return { ...this.riskLimits };
  }

  getPortfolioSnapshot(): PortfolioSnapshot {
    return { ...this.portfolioSnapshot };
  }

  updateRiskLimits(limits: Partial<RiskLimits>): void {
    this.riskLimits = { ...this.riskLimits, ...limits };
    logger.info('Risk limits updated', { limits: this.riskLimits });
  }

  /**
   * Enable or disable dynamic risk adjustments
   */
  setDynamicLimits(enabled: boolean): void {
    this.useDynamicLimits = enabled;
    logger.info(`Dynamic risk limits ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Check if dynamic limits are enabled
   */
  isDynamicLimitsEnabled(): boolean {
    return this.useDynamicLimits;
  }

  /**
   * Get the dynamic risk manager instance for advanced operations
   */
  getDynamicRiskManager(): DynamicRiskManager {
    return this.dynamicRiskManager;
  }

  /**
   * Get dynamic risk diagnostics (VIX, regimes, etc.)
   */
  async getDynamicRiskDiagnostics() {
    return this.dynamicRiskManager.getDiagnostics();
  }
}
