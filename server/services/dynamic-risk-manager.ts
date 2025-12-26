/**
 * AI Active Trader - Dynamic Risk Manager
 * Implements adaptive risk limits based on market conditions, performance, and time factors
 */

import { log } from '../utils/logger';
import { fred } from '../connectors/fred';
import { macroIndicatorsService } from './macro-indicators-service';
import type { RiskLimits } from '../autonomous/orchestrator';

// Use the existing logger
const logger = {
  info: (msg: string, data?: any) => log.info('DynamicRiskManager', msg, data),
  warn: (msg: string, data?: any) => log.warn('DynamicRiskManager', msg, data),
  error: (msg: string, data?: any) => log.error('DynamicRiskManager', msg, data),
};

// Portfolio snapshot type for this service
interface PortfolioSnapshot {
  equity: number;
  cash: number;
  positions: { symbol: string; value: number; pnl: number }[];
}

/**
 * Configuration for dynamic risk adjustments
 */
export interface DynamicRiskConfig {
  baseMaxPositionPct: number;        // Base position size limit (e.g., 10%)
  baseMaxExposurePct: number;        // Base total exposure limit (e.g., 80%)
  volatilityScaling: boolean;        // Enable VIX-based scaling
  performanceScaling: boolean;       // Enable P&L-based scaling
  timeBasedScaling: boolean;         // Enable time-of-day scaling
}

/**
 * Adjusted risk limits with scaling factors and rationale
 */
export interface AdjustedRiskLimits {
  maxPositionPct: number;            // Adjusted position size limit
  maxExposurePct: number;            // Adjusted exposure limit
  maxOrdersPerDay: number;           // Adjusted daily order limit
  scalingFactors: Record<string, number>;  // Individual scaling factors applied
  reason: string;                    // Human-readable explanation
}

/**
 * Market volatility regimes based on VIX levels
 */
enum VolatilityRegime {
  NORMAL = 'normal',         // VIX < 15
  ELEVATED = 'elevated',     // VIX 15-25
  HIGH = 'high',            // VIX 25-35
  EXTREME = 'extreme'       // VIX > 35
}

/**
 * Performance regimes based on recent P&L
 */
enum PerformanceRegime {
  STRONG = 'strong',        // Recent wins, can take more risk
  NORMAL = 'normal',        // Balanced performance
  WEAK = 'weak',           // Recent losses, reduce risk
  CRITICAL = 'critical'    // Significant losses, minimal risk
}

/**
 * Time-of-day risk regimes
 */
enum TimeRegime {
  MARKET_OPEN = 'market_open',     // 9:30-10:30 ET - High volatility
  NORMAL_HOURS = 'normal_hours',   // 10:30-15:00 ET - Normal trading
  MARKET_CLOSE = 'market_close',   // 15:00-16:00 ET - Reduce risk
  AFTER_HOURS = 'after_hours'      // Outside market hours
}

/**
 * Default configuration for moderate risk tolerance
 */
const DEFAULT_CONFIG: DynamicRiskConfig = {
  baseMaxPositionPct: 10,
  baseMaxExposurePct: 80,
  volatilityScaling: true,
  performanceScaling: true,
  timeBasedScaling: true,
};

/**
 * Dynamic Risk Manager
 * Adjusts risk limits based on market volatility, recent performance, and time factors
 */
export class DynamicRiskManager {
  private config: DynamicRiskConfig;
  private lastVixValue: number | null = null;
  private lastVixUpdate: Date | null = null;
  private vixCacheTTL: number = 300000; // 5 minutes

  // Static hardcoded values (preserved for reference)
  // private readonly LEGACY_MAX_POSITION_PCT = 10;
  // private readonly LEGACY_MAX_EXPOSURE_PCT = 80;
  // private readonly LEGACY_MAX_ORDERS_PER_DAY = 50;

  constructor(config: Partial<DynamicRiskConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('Dynamic Risk Manager initialized', {
      volatilityScaling: this.config.volatilityScaling,
      performanceScaling: this.config.performanceScaling,
      timeBasedScaling: this.config.timeBasedScaling,
    });
  }

  /**
   * Get adjusted risk limits based on current market conditions
   */
  async getAdjustedLimits(
    portfolioSnapshot: PortfolioSnapshot,
    recentTrades?: { pnl: number; timestamp: Date }[]
  ): Promise<AdjustedRiskLimits> {
    const scalingFactors: Record<string, number> = {
      volatility: 1.0,
      performance: 1.0,
      time: 1.0,
      concentration: 1.0,
    };

    const reasons: string[] = [];

    // 1. Volatility-based scaling
    if (this.config.volatilityScaling) {
      const vixScaling = await this.getVolatilityScaling();
      scalingFactors.volatility = vixScaling.factor;
      reasons.push(vixScaling.reason);
    }

    // 2. Performance-based scaling
    if (this.config.performanceScaling && recentTrades) {
      const perfScaling = this.getPerformanceScaling(portfolioSnapshot, recentTrades);
      scalingFactors.performance = perfScaling.factor;
      reasons.push(perfScaling.reason);
    }

    // 3. Time-based scaling
    if (this.config.timeBasedScaling) {
      const timeScaling = this.getTimeBasedScaling();
      scalingFactors.time = timeScaling.factor;
      reasons.push(timeScaling.reason);
    }

    // 4. Calculate combined scaling factor (multiplicative)
    const combinedFactor = Object.values(scalingFactors).reduce((a, b) => a * b, 1.0);

    // 5. Apply scaling to base limits
    const adjustedPositionPct = this.config.baseMaxPositionPct * combinedFactor;
    const adjustedExposurePct = this.config.baseMaxExposurePct * combinedFactor;

    // Base orders per day: 50, scales with risk
    const baseOrdersPerDay = 50;
    const adjustedOrdersPerDay = Math.max(1, Math.floor(baseOrdersPerDay * combinedFactor));

    return {
      maxPositionPct: Math.max(1, Math.min(adjustedPositionPct, 20)), // Cap at 20%
      maxExposurePct: Math.max(10, Math.min(adjustedExposurePct, 100)), // Cap at 100%
      maxOrdersPerDay: adjustedOrdersPerDay,
      scalingFactors,
      reason: reasons.filter(r => r).join('; '),
    };
  }

  /**
   * Get volatility-based scaling factor from VIX levels
   */
  private async getVolatilityScaling(): Promise<{ factor: number; reason: string }> {
    const vix = await this.getVIX();

    if (vix === null) {
      logger.warn('VIX data unavailable, using default scaling');
      return { factor: 1.0, reason: 'VIX unavailable, normal limits' };
    }

    const regime = this.classifyVolatilityRegime(vix);

    switch (regime) {
      case VolatilityRegime.NORMAL:
        // VIX < 15: Normal market conditions
        return {
          factor: 1.0,
          reason: `VIX ${vix.toFixed(1)} - normal volatility`
        };

      case VolatilityRegime.ELEVATED:
        // VIX 15-25: Reduce position size by 20%
        return {
          factor: 0.8,
          reason: `VIX ${vix.toFixed(1)} - elevated volatility, -20% position size`
        };

      case VolatilityRegime.HIGH:
        // VIX 25-35: Reduce by 40%, no new positions (implemented by caller)
        return {
          factor: 0.6,
          reason: `VIX ${vix.toFixed(1)} - high volatility, -40% position size, limit new positions`
        };

      case VolatilityRegime.EXTREME:
        // VIX > 35: Emergency mode, close-only
        return {
          factor: 0.1,
          reason: `VIX ${vix.toFixed(1)} - EXTREME volatility, emergency mode (close-only recommended)`
        };

      default:
        return { factor: 1.0, reason: 'Unknown volatility regime' };
    }
  }

  /**
   * Get performance-based scaling factor
   */
  private getPerformanceScaling(
    portfolio: PortfolioSnapshot,
    recentTrades: { pnl: number; timestamp: Date }[]
  ): { factor: number; reason: string } {
    if (recentTrades.length === 0) {
      return { factor: 1.0, reason: 'No recent trades' };
    }

    // Calculate recent P&L performance (last 10 trades or 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentPnL = recentTrades
      .filter(t => t.timestamp > oneDayAgo)
      .slice(0, 10)
      .reduce((sum, t) => sum + t.pnl, 0);

    const pnlPercent = (recentPnL / portfolio.totalEquity) * 100;
    const regime = this.classifyPerformanceRegime(pnlPercent);

    switch (regime) {
      case PerformanceRegime.STRONG:
        // Recent wins (>2% daily gain): Can maintain full risk
        return {
          factor: 1.0,
          reason: `Strong performance (+${pnlPercent.toFixed(2)}%), normal limits`
        };

      case PerformanceRegime.NORMAL:
        // Balanced performance (-0.5% to +2%): Normal limits
        return {
          factor: 1.0,
          reason: `Balanced performance (${pnlPercent.toFixed(2)}%)`
        };

      case PerformanceRegime.WEAK:
        // Recent losses (-0.5% to -2%): Reduce risk by 30%
        return {
          factor: 0.7,
          reason: `Weak performance (${pnlPercent.toFixed(2)}%), -30% risk`
        };

      case PerformanceRegime.CRITICAL:
        // Significant losses (<-2%): Reduce risk by 60%
        return {
          factor: 0.4,
          reason: `CRITICAL losses (${pnlPercent.toFixed(2)}%), -60% risk`
        };

      default:
        return { factor: 1.0, reason: 'Unknown performance regime' };
    }
  }

  /**
   * Get time-based scaling factor
   */
  private getTimeBasedScaling(): { factor: number; reason: string } {
    const now = new Date();
    const regime = this.classifyTimeRegime(now);

    switch (regime) {
      case TimeRegime.MARKET_OPEN:
        // First hour: Higher volatility, reduce size by 10%
        return {
          factor: 0.9,
          reason: 'Market open (9:30-10:30 ET), -10% for volatility'
        };

      case TimeRegime.NORMAL_HOURS:
        // Normal trading hours
        return {
          factor: 1.0,
          reason: 'Normal market hours'
        };

      case TimeRegime.MARKET_CLOSE:
        // Last hour: Reduce risk by 30% to avoid overnight exposure
        return {
          factor: 0.7,
          reason: 'Near market close (15:00-16:00 ET), -30% to reduce overnight risk'
        };

      case TimeRegime.AFTER_HOURS:
        // After hours: Reduce risk by 50%
        return {
          factor: 0.5,
          reason: 'After hours trading, -50% risk'
        };

      default:
        return { factor: 1.0, reason: 'Unknown time regime' };
    }
  }

  /**
   * Check if new positions should be allowed based on current conditions
   */
  async shouldAllowNewPositions(): Promise<{ allowed: boolean; reason: string }> {
    // Check VIX level
    const vix = await this.getVIX();

    if (vix !== null && vix >= 25) {
      return {
        allowed: false,
        reason: `VIX at ${vix.toFixed(1)} - no new positions in high volatility regime`,
      };
    }

    // Check if we're in emergency mode
    if (vix !== null && vix >= 35) {
      return {
        allowed: false,
        reason: `VIX at ${vix.toFixed(1)} - EMERGENCY MODE: Close-only`,
      };
    }

    return { allowed: true, reason: 'Normal conditions' };
  }

  /**
   * Get current VIX value (cached for performance)
   */
  private async getVIX(): Promise<number | null> {
    // Return cached value if fresh
    if (
      this.lastVixValue !== null &&
      this.lastVixUpdate !== null &&
      Date.now() - this.lastVixUpdate.getTime() < this.vixCacheTTL
    ) {
      return this.lastVixValue;
    }

    try {
      // Try to get from database first (populated by macro service)
      const vixData = await macroIndicatorsService.getIndicator('VIXCLS');

      if (vixData && vixData.latestValue) {
        const vixValue = parseFloat(vixData.latestValue);
        if (!isNaN(vixValue)) {
          this.lastVixValue = vixValue;
          this.lastVixUpdate = new Date();
          logger.info('VIX updated from database', { vix: vixValue });
          return vixValue;
        }
      }

      // Fallback: Fetch directly from FRED
      const vixIndicator = await fred.getVIX();
      if (vixIndicator && vixIndicator.latestValue !== null) {
        this.lastVixValue = vixIndicator.latestValue;
        this.lastVixUpdate = new Date();
        logger.info('VIX updated from FRED', { vix: vixIndicator.latestValue });
        return vixIndicator.latestValue;
      }

      logger.warn('Unable to fetch VIX data');
      return null;
    } catch (error) {
      logger.error('Error fetching VIX', error as Error);
      return null;
    }
  }

  /**
   * Classify volatility regime based on VIX value
   */
  private classifyVolatilityRegime(vix: number): VolatilityRegime {
    if (vix < 15) return VolatilityRegime.NORMAL;
    if (vix < 25) return VolatilityRegime.ELEVATED;
    if (vix < 35) return VolatilityRegime.HIGH;
    return VolatilityRegime.EXTREME;
  }

  /**
   * Classify performance regime based on recent P&L percentage
   */
  private classifyPerformanceRegime(pnlPercent: number): PerformanceRegime {
    if (pnlPercent > 2) return PerformanceRegime.STRONG;
    if (pnlPercent > -0.5) return PerformanceRegime.NORMAL;
    if (pnlPercent > -2) return PerformanceRegime.WEAK;
    return PerformanceRegime.CRITICAL;
  }

  /**
   * Classify time regime based on current time (US Eastern Time)
   */
  private classifyTimeRegime(date: Date): TimeRegime {
    // Convert to ET (simplified - doesn't handle DST perfectly)
    // For production, use a proper timezone library
    const etOffset = -5 * 60; // ET offset in minutes
    const utcTime = date.getTime();
    const etTime = new Date(utcTime + etOffset * 60 * 1000);

    const hours = etTime.getUTCHours();
    const minutes = etTime.getUTCMinutes();
    const totalMinutes = hours * 60 + minutes;

    const marketOpen = 9 * 60 + 30;   // 9:30 AM
    const openEnd = 10 * 60 + 30;     // 10:30 AM
    const closeStart = 15 * 60;       // 3:00 PM
    const marketClose = 16 * 60;      // 4:00 PM

    // Check day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = etTime.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend || totalMinutes < marketOpen || totalMinutes >= marketClose) {
      return TimeRegime.AFTER_HOURS;
    }

    if (totalMinutes >= marketOpen && totalMinutes < openEnd) {
      return TimeRegime.MARKET_OPEN;
    }

    if (totalMinutes >= closeStart && totalMinutes < marketClose) {
      return TimeRegime.MARKET_CLOSE;
    }

    return TimeRegime.NORMAL_HOURS;
  }

  /**
   * Convert adjusted limits to legacy RiskLimits format
   */
  toLegacyRiskLimits(adjusted: AdjustedRiskLimits): RiskLimits {
    return {
      maxPositionSizePercent: adjusted.maxPositionPct,
      maxTotalExposurePercent: adjusted.maxExposurePct,
      maxPositionsCount: 20, // Keep constant for now
      dailyLossLimitPercent: 5, // Keep constant for now
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): DynamicRiskConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DynamicRiskConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Dynamic risk config updated', { config: this.config });
  }

  /**
   * Force refresh VIX cache
   */
  async refreshVIX(): Promise<number | null> {
    this.lastVixValue = null;
    this.lastVixUpdate = null;
    return this.getVIX();
  }

  /**
   * Get diagnostic information
   */
  async getDiagnostics(): Promise<{
    vix: number | null;
    vixAge: number | null;
    volatilityRegime: string;
    config: DynamicRiskConfig;
  }> {
    const vix = await this.getVIX();
    const vixAge = this.lastVixUpdate
      ? Date.now() - this.lastVixUpdate.getTime()
      : null;

    const volatilityRegime = vix !== null
      ? this.classifyVolatilityRegime(vix)
      : 'unknown';

    return {
      vix,
      vixAge,
      volatilityRegime,
      config: this.config,
    };
  }
}

/**
 * Singleton instance for application-wide use
 */
export const dynamicRiskManager = new DynamicRiskManager();

/**
 * Factory functions for different risk profiles
 */
export const createConservativeDynamicRisk = (): DynamicRiskManager => {
  return new DynamicRiskManager({
    baseMaxPositionPct: 5,
    baseMaxExposurePct: 50,
    volatilityScaling: true,
    performanceScaling: true,
    timeBasedScaling: true,
  });
};

export const createModerateDynamicRisk = (): DynamicRiskManager => {
  return new DynamicRiskManager({
    baseMaxPositionPct: 10,
    baseMaxExposurePct: 80,
    volatilityScaling: true,
    performanceScaling: true,
    timeBasedScaling: true,
  });
};

export const createAggressiveDynamicRisk = (): DynamicRiskManager => {
  return new DynamicRiskManager({
    baseMaxPositionPct: 15,
    baseMaxExposurePct: 100,
    volatilityScaling: true,
    performanceScaling: false, // Don't reduce on losses
    timeBasedScaling: false,   // Trade anytime
  });
};
