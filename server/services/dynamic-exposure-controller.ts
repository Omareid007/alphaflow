/**
 * Dynamic Exposure Controller
 *
 * Implements adaptive portfolio exposure management:
 * - Dynamic max exposure (scales with confidence)
 * - Dynamic position sizing (confidence + volatility based)
 * - Take-profit cycling (profit -> cash -> re-enter)
 * - Portfolio heat management
 * - Correlation-aware position limits
 */

import { log } from "../utils/logger";
import { alpaca } from "../connectors/alpaca";
import { tradingConfig } from "../config/trading-config";
import { storage } from "../storage";
import type { AlpacaPosition, AlpacaAccount } from "../connectors/alpaca";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ExposureConfig {
  // Base limits (defaults)
  baseMaxExposurePct: number; // Base max total exposure (default: 80%)
  absoluteMaxExposurePct: number; // Absolute max (can scale to 100%+)
  baseMaxPositionPct: number; // Base max single position (default: 10%)
  absoluteMaxPositionPct: number; // Absolute max per position (default: 25%)

  // Scaling enables
  volatilityScaling: boolean;
  confidenceScaling: boolean;
  correlationScaling: boolean;

  // Take profit cycling
  takeProfitThresholdPct: number; // Take profit at X%
  trailingStopPct: number; // Trailing stop percentage
  scaleOutThresholds: number[]; // Scale-out profit levels [2%, 4%, 6%]

  // Reinvestment
  enableAutoReinvest: boolean;
  reinvestCooldownMs: number; // Wait before reinvesting
}

export interface PositionSizeRecommendation {
  symbol: string;
  recommendedSize: number; // Dollar amount
  recommendedQty: number; // Share quantity
  sizeAsPctPortfolio: number; // Size as % of portfolio
  sizeAsPctMaxAllowed: number; // Size as % of max allowed
  reasoning: Record<string, unknown>;
  constraintsApplied: string[];
}

export interface TakeProfitCandidate {
  symbol: string;
  currentQty: number;
  takeQty: number;
  unrealizedPct: number;
  thresholdHit: number;
  action: "scale_out" | "full_exit";
  reason: string;
}

export interface ReinvestOpportunity {
  symbol: string;
  amount: number;
  queuedAt: Date;
  originalOrderId?: string;
}

export interface PortfolioHeat {
  totalExposure: number;
  totalExposurePct: number;
  positionCount: number;
  largestPositionPct: number;
  sectorConcentration: Record<string, number>;
  correlationRisk: number;
  overallHeat: "low" | "moderate" | "high" | "critical";
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: ExposureConfig = {
  baseMaxExposurePct: 80,
  absoluteMaxExposurePct: 100,
  baseMaxPositionPct: 10,
  absoluteMaxPositionPct: 25,
  volatilityScaling: true,
  confidenceScaling: true,
  correlationScaling: true,
  takeProfitThresholdPct: 2,
  trailingStopPct: 1,
  scaleOutThresholds: [2, 4, 6],
  enableAutoReinvest: true,
  reinvestCooldownMs: 300000, // 5 minutes
};

// Sector mapping for correlation
const SECTOR_MAP: Record<string, string> = {
  // Technology
  AAPL: "tech",
  MSFT: "tech",
  GOOGL: "tech",
  GOOG: "tech",
  META: "tech",
  NVDA: "tech",
  AMD: "tech",
  INTC: "tech",
  AVGO: "tech",
  CRM: "tech",
  ADBE: "tech",
  ORCL: "tech",
  CSCO: "tech",
  IBM: "tech",
  QCOM: "tech",

  // Finance
  JPM: "finance",
  BAC: "finance",
  GS: "finance",
  MS: "finance",
  WFC: "finance",
  C: "finance",
  V: "finance",
  MA: "finance",
  AXP: "finance",
  BLK: "finance",

  // Healthcare
  JNJ: "healthcare",
  UNH: "healthcare",
  PFE: "healthcare",
  ABBV: "healthcare",
  MRK: "healthcare",
  LLY: "healthcare",
  TMO: "healthcare",
  ABT: "healthcare",

  // Energy
  XOM: "energy",
  CVX: "energy",
  COP: "energy",
  SLB: "energy",
  EOG: "energy",

  // Consumer
  AMZN: "consumer",
  TSLA: "consumer",
  WMT: "consumer",
  HD: "consumer",
  MCD: "consumer",
  NKE: "consumer",
  SBUX: "consumer",
  TGT: "consumer",

  // Industrial
  CAT: "industrial",
  BA: "industrial",
  HON: "industrial",
  UPS: "industrial",
  GE: "industrial",
  MMM: "industrial",
  LMT: "industrial",
  RTX: "industrial",

  // ETFs
  SPY: "broad",
  QQQ: "tech",
  IWM: "small",
  DIA: "broad",
  VTI: "broad",

  // Crypto
  "BTC/USD": "crypto",
  "ETH/USD": "crypto",
  "SOL/USD": "crypto",
};

// ============================================================================
// DYNAMIC EXPOSURE CONTROLLER
// ============================================================================

export class DynamicExposureController {
  private config: ExposureConfig;

  // State tracking
  private currentPositions: Map<string, AlpacaPosition> = new Map();
  private positionPnl: Map<string, number> = new Map();
  private volatilityRegime: number = 1.0; // 1.0 = normal, >1 = high vol
  private marketRegime: "normal" | "trending" | "choppy" = "normal";

  // Performance tracking for adaptive sizing
  private recentTrades: Array<{
    symbol: string;
    pnl: number;
    timestamp: Date;
  }> = [];
  private winRate: number = 0.5;
  private avgWinLossRatio: number = 1.0;

  // Take profit tracking
  private takeProfitHistory: Array<{
    symbol: string;
    qty: number;
    timestamp: Date;
    orderId?: string;
  }> = [];

  // Reinvestment queue
  private reinvestQueue: ReinvestOpportunity[] = [];

  constructor(config: Partial<ExposureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info("DynamicExposureController", "Initialized", {
      baseMaxExposure: `${this.config.baseMaxExposurePct}%`,
      absoluteMaxExposure: `${this.config.absoluteMaxExposurePct}%`,
      baseMaxPosition: `${this.config.baseMaxPositionPct}%`,
    });
  }

  // ==================== PORTFOLIO ANALYSIS ====================

  async getAccountStatus(): Promise<{
    portfolioValue: number;
    buyingPower: number;
    cash: number;
    currentExposure: number;
    positionCount: number;
    positions: Map<string, AlpacaPosition>;
    dayTradeCount: number;
    patternDayTrader: boolean;
  }> {
    try {
      const account = await alpaca.getAccount();
      const positions = await alpaca.getPositions();

      const portfolioValue = parseFloat(account.portfolio_value);
      const buyingPower = parseFloat(account.buying_power);
      const cash = parseFloat(account.cash);

      // Calculate current exposure
      let totalPositionValue = 0;
      this.currentPositions.clear();

      for (const pos of positions) {
        const marketValue = Math.abs(parseFloat(pos.market_value));
        totalPositionValue += marketValue;
        this.currentPositions.set(pos.symbol, pos);

        // Track P&L
        this.positionPnl.set(pos.symbol, parseFloat(pos.unrealized_pl));
      }

      const currentExposure =
        portfolioValue > 0 ? totalPositionValue / portfolioValue : 0;

      return {
        portfolioValue,
        buyingPower,
        cash,
        currentExposure,
        positionCount: positions.length,
        positions: this.currentPositions,
        dayTradeCount: account.daytrade_count || 0,
        patternDayTrader: account.pattern_day_trader,
      };
    } catch (error) {
      log.error(
        "DynamicExposureController",
        `Failed to get account status: ${error}`
      );
      throw error;
    }
  }

  // ==================== DYNAMIC EXPOSURE CALCULATION ====================

  calculateDynamicMaxExposure(
    signalConfidence: number = 0.5,
    marketConditions?: { vix?: number; marketTrend?: string }
  ): number {
    let maxExposure = this.config.baseMaxExposurePct / 100;

    // Adjust for volatility regime
    if (this.config.volatilityScaling) {
      if (this.volatilityRegime < 0.8) {
        // Low volatility: Can increase exposure
        maxExposure = Math.min(
          maxExposure * 1.2,
          this.config.absoluteMaxExposurePct / 100
        );
      } else if (this.volatilityRegime > 1.5) {
        // High volatility: Reduce exposure
        maxExposure *= 0.7;
      }
    }

    // Adjust for signal confidence
    if (this.config.confidenceScaling && signalConfidence > 0.8) {
      const confidenceBoost = (signalConfidence - 0.8) / 0.2; // 0 to 1
      const exposureBoost =
        confidenceBoost *
        (this.config.absoluteMaxExposurePct / 100 -
          this.config.baseMaxExposurePct / 100);
      maxExposure = Math.min(
        maxExposure + exposureBoost,
        this.config.absoluteMaxExposurePct / 100
      );
    }

    // Adjust for recent performance
    if (this.winRate > 0.6 && this.avgWinLossRatio > 1.5) {
      maxExposure = Math.min(
        maxExposure * 1.1,
        this.config.absoluteMaxExposurePct / 100
      );
    } else if (this.winRate < 0.4) {
      maxExposure *= 0.8;
    }

    // VIX override if provided
    if (marketConditions?.vix) {
      const vix = marketConditions.vix;
      if (vix > 35) {
        maxExposure *= 0.5; // Extreme volatility: half exposure
      } else if (vix > 25) {
        maxExposure *= 0.7;
      } else if (vix < 15) {
        maxExposure = Math.min(
          maxExposure * 1.1,
          this.config.absoluteMaxExposurePct / 100
        );
      }
    }

    log.debug(
      "DynamicExposureController",
      `Dynamic max exposure: ${(maxExposure * 100).toFixed(1)}%`,
      {
        volatilityRegime: this.volatilityRegime,
        signalConfidence,
        winRate: this.winRate,
      }
    );

    return maxExposure;
  }

  // ==================== DYNAMIC POSITION SIZING ====================

  calculateDynamicPositionSize(
    symbol: string,
    currentPrice: number,
    signalConfidence: number,
    portfolioValue: number,
    currentExposure: number,
    decisionType: "enter" | "scale_in" = "enter"
  ): PositionSizeRecommendation {
    const constraintsApplied: string[] = [];
    const reasoning: Record<string, unknown> = {};

    // Start with base max position percentage
    let maxPositionPct = this.config.baseMaxPositionPct / 100;

    // Confidence-based scaling
    if (this.config.confidenceScaling) {
      if (signalConfidence > 0.8) {
        const confidenceMultiplier = 1 + (signalConfidence - 0.8) / 0.2; // 1.0 to 2.0
        maxPositionPct = Math.min(
          maxPositionPct * confidenceMultiplier,
          this.config.absoluteMaxPositionPct / 100
        );
        constraintsApplied.push(
          `confidence_boost_${confidenceMultiplier.toFixed(2)}x`
        );
      } else {
        maxPositionPct = maxPositionPct * (signalConfidence / 0.8);
        constraintsApplied.push(
          `confidence_reduction_${signalConfidence.toFixed(2)}`
        );
      }
    }

    // Volatility adjustment
    if (this.config.volatilityScaling && this.volatilityRegime > 1.2) {
      maxPositionPct /= this.volatilityRegime;
      constraintsApplied.push(
        `volatility_reduction_${this.volatilityRegime.toFixed(2)}`
      );
    }

    // Correlation penalty - reduce if correlated positions exist
    if (this.config.correlationScaling) {
      const correlationPenalty = this.calculateCorrelationPenalty(symbol);
      if (correlationPenalty > 0) {
        maxPositionPct *= 1 - correlationPenalty;
        constraintsApplied.push(
          `correlation_penalty_${correlationPenalty.toFixed(2)}`
        );
      }
      reasoning.correlationPenalty = correlationPenalty;
    }

    // Calculate available exposure
    const maxExposure = this.calculateDynamicMaxExposure(signalConfidence);
    const availableExposure = Math.max(0, maxExposure - currentExposure);

    // Final position size
    let positionPct = Math.min(maxPositionPct, availableExposure);
    let positionValue = portfolioValue * positionPct;
    let qty = Math.floor(positionValue / currentPrice);

    // Scale-in uses smaller size
    if (decisionType === "scale_in") {
      qty = Math.floor(qty * 0.5);
      positionValue = qty * currentPrice;
      positionPct = positionValue / portfolioValue;
      constraintsApplied.push("scale_in_reduction_50%");
    }

    // Minimum position check
    if (qty < 1) {
      positionPct = 0;
      positionValue = 0;
      qty = 0;
      constraintsApplied.push("below_minimum_size");
    }

    reasoning.signalConfidence = signalConfidence;
    reasoning.volatilityRegime = this.volatilityRegime;
    reasoning.currentExposure = currentExposure;
    reasoning.maxExposure = maxExposure;
    reasoning.availableExposure = availableExposure;
    reasoning.maxPositionPct = maxPositionPct;

    return {
      symbol,
      recommendedSize: positionValue,
      recommendedQty: qty,
      sizeAsPctPortfolio: positionPct,
      sizeAsPctMaxAllowed:
        positionPct / (this.config.absoluteMaxPositionPct / 100),
      reasoning,
      constraintsApplied,
    };
  }

  private calculateCorrelationPenalty(symbol: string): number {
    const symbolSector = SECTOR_MAP[symbol] || "other";
    let sameSectorExposure = 0;

    for (const [posSymbol, pos] of this.currentPositions) {
      if (SECTOR_MAP[posSymbol] === symbolSector) {
        sameSectorExposure += Math.abs(parseFloat(pos.market_value));
      }
    }

    // Penalty increases with same-sector exposure
    // $50k same-sector -> 0.25 penalty (25% reduction in position size)
    // Cap at 50% penalty
    return Math.min(0.5, sameSectorExposure / 200000);
  }

  // ==================== TAKE PROFIT MANAGEMENT ====================

  checkTakeProfitConditions(): TakeProfitCandidate[] {
    const candidates: TakeProfitCandidate[] = [];

    for (const [symbol, pos] of this.currentPositions) {
      const unrealizedPct = parseFloat(pos.unrealized_plpc) * 100;
      const qty = parseInt(pos.qty);

      // Check against scale-out thresholds
      for (let i = 0; i < this.config.scaleOutThresholds.length; i++) {
        const threshold = this.config.scaleOutThresholds[i];

        if (unrealizedPct >= threshold) {
          // Determine how much to take
          let takePct: number;
          if (i === 0) {
            takePct = 0.33; // Take 1/3 at first threshold
          } else if (i === 1) {
            takePct = 0.5; // Take 1/2 of remaining at second
          } else {
            takePct = 0.75; // Take most at third
          }

          const takeQty = Math.max(1, Math.floor(qty * takePct));

          // Only add if we haven't recently taken profit at this level
          const recentTake = this.takeProfitHistory.find(
            (t) =>
              t.symbol === symbol &&
              Date.now() - t.timestamp.getTime() < 3600000
          );

          if (!recentTake) {
            candidates.push({
              symbol,
              currentQty: qty,
              takeQty,
              unrealizedPct,
              thresholdHit: threshold,
              action: takeQty >= qty * 0.9 ? "full_exit" : "scale_out",
              reason: `Hit ${threshold}% profit threshold`,
            });
          }

          break; // Only one threshold per position
        }
      }
    }

    return candidates;
  }

  async executeTakeProfitCycle(
    symbol: string,
    qtyToSell: number,
    reinvest: boolean = true
  ): Promise<{
    qtySold: number;
    orderId?: string;
    proceeds?: number;
    queuedForReinvest: boolean;
    error?: string;
  }> {
    try {
      // Get current position for entry price
      const position = this.currentPositions.get(symbol);
      if (!position) {
        return {
          qtySold: 0,
          queuedForReinvest: false,
          error: "Position not found",
        };
      }

      const currentPrice = parseFloat(position.current_price);

      // Submit sell order
      const order = await alpaca.createOrder({
        symbol,
        qty: qtyToSell.toString(),
        side: "sell",
        type: "market",
        time_in_force: "day",
      });

      const estimatedProceeds = qtyToSell * currentPrice;

      // Record take profit
      this.takeProfitHistory.push({
        symbol,
        qty: qtyToSell,
        timestamp: new Date(),
        orderId: order.id,
      });

      // Keep last 100 entries
      if (this.takeProfitHistory.length > 100) {
        this.takeProfitHistory = this.takeProfitHistory.slice(-100);
      }

      // Queue for reinvestment if enabled
      let queuedForReinvest = false;
      if (reinvest && this.config.enableAutoReinvest) {
        this.reinvestQueue.push({
          symbol,
          amount: estimatedProceeds,
          queuedAt: new Date(),
          originalOrderId: order.id,
        });
        queuedForReinvest = true;

        log.info(
          "DynamicExposureController",
          `Queued $${estimatedProceeds.toFixed(2)} for reinvestment from ${symbol}`
        );
      }

      log.info(
        "DynamicExposureController",
        `Take profit executed: ${symbol} x${qtyToSell}`,
        {
          orderId: order.id,
          estimatedProceeds,
          reinvest: queuedForReinvest,
        }
      );

      return {
        qtySold: qtyToSell,
        orderId: order.id,
        proceeds: estimatedProceeds,
        queuedForReinvest,
      };
    } catch (error) {
      log.error(
        "DynamicExposureController",
        `Take profit error for ${symbol}: ${error}`
      );
      return { qtySold: 0, queuedForReinvest: false, error: String(error) };
    }
  }

  // ==================== REINVESTMENT ====================

  getReinvestOpportunities(): ReinvestOpportunity[] {
    const now = Date.now();
    return this.reinvestQueue.filter(
      (item) => now - item.queuedAt.getTime() >= this.config.reinvestCooldownMs
    );
  }

  consumeReinvestOpportunity(item: ReinvestOpportunity): boolean {
    const index = this.reinvestQueue.indexOf(item);
    if (index !== -1) {
      this.reinvestQueue.splice(index, 1);
      return true;
    }
    return false;
  }

  // ==================== PORTFOLIO HEAT ====================

  async calculatePortfolioHeat(): Promise<PortfolioHeat> {
    const status = await this.getAccountStatus();

    // Sector concentration
    const sectorExposure: Record<string, number> = {};
    let largestPositionPct = 0;

    for (const [symbol, pos] of status.positions) {
      const sector = SECTOR_MAP[symbol] || "other";
      const positionPct =
        Math.abs(parseFloat(pos.market_value)) / status.portfolioValue;

      sectorExposure[sector] = (sectorExposure[sector] || 0) + positionPct;

      if (positionPct > largestPositionPct) {
        largestPositionPct = positionPct;
      }
    }

    // Correlation risk (simplified: more concentrated = higher risk)
    const maxSectorConcentration = Math.max(
      ...Object.values(sectorExposure),
      0
    );
    const correlationRisk = maxSectorConcentration; // 0 to 1

    // Overall heat assessment
    let overallHeat: PortfolioHeat["overallHeat"];

    if (
      status.currentExposure > 0.9 ||
      maxSectorConcentration > 0.4 ||
      largestPositionPct > 0.2
    ) {
      overallHeat = "critical";
    } else if (
      status.currentExposure > 0.75 ||
      maxSectorConcentration > 0.3 ||
      largestPositionPct > 0.15
    ) {
      overallHeat = "high";
    } else if (status.currentExposure > 0.5 || maxSectorConcentration > 0.2) {
      overallHeat = "moderate";
    } else {
      overallHeat = "low";
    }

    return {
      totalExposure: status.currentExposure * status.portfolioValue,
      totalExposurePct: status.currentExposure * 100,
      positionCount: status.positionCount,
      largestPositionPct: largestPositionPct * 100,
      sectorConcentration: Object.fromEntries(
        Object.entries(sectorExposure).map(([k, v]) => [k, v * 100])
      ),
      correlationRisk,
      overallHeat,
    };
  }

  // ==================== PERFORMANCE TRACKING ====================

  recordTradeResult(symbol: string, pnl: number): void {
    this.recentTrades.push({ symbol, pnl, timestamp: new Date() });

    // Keep last 100 trades
    if (this.recentTrades.length > 100) {
      this.recentTrades = this.recentTrades.slice(-100);
    }

    // Update metrics
    const wins = this.recentTrades.filter((t) => t.pnl > 0);
    const losses = this.recentTrades.filter((t) => t.pnl < 0);

    if (this.recentTrades.length > 0) {
      this.winRate = wins.length / this.recentTrades.length;
    }

    if (wins.length > 0 && losses.length > 0) {
      const avgWin = wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length;
      const avgLoss = Math.abs(
        losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length
      );
      this.avgWinLossRatio = avgLoss > 0 ? avgWin / avgLoss : 1.0;
    }
  }

  updateVolatilityRegime(vixValue: number): void {
    // Normalize VIX to regime (VIX 20 = 1.0)
    this.volatilityRegime = vixValue / 20;
  }

  setMarketRegime(regime: "normal" | "trending" | "choppy"): void {
    this.marketRegime = regime;
  }

  // ==================== STATUS & METRICS ====================

  getStatus(): {
    config: ExposureConfig;
    volatilityRegime: number;
    marketRegime: string;
    winRate: number;
    avgWinLossRatio: number;
    recentTradeCount: number;
    takeProfitHistoryCount: number;
    reinvestQueueSize: number;
  } {
    return {
      config: this.config,
      volatilityRegime: this.volatilityRegime,
      marketRegime: this.marketRegime,
      winRate: this.winRate,
      avgWinLossRatio: this.avgWinLossRatio,
      recentTradeCount: this.recentTrades.length,
      takeProfitHistoryCount: this.takeProfitHistory.length,
      reinvestQueueSize: this.reinvestQueue.length,
    };
  }

  getPortfolioHeat(): PortfolioHeat {
    // Track unique symbols from recent trades
    const symbolSet = new Set<string>();
    const sectorCounts: Record<string, number> = {};

    for (const trade of this.recentTrades) {
      symbolSet.add(trade.symbol);
      const sector = SECTOR_MAP[trade.symbol] || "unknown";
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    }

    const positionCount = symbolSet.size;

    // Calculate sector concentration as percentage of positions
    const sectorConcentration: Record<string, number> = {};
    for (const [sector, count] of Object.entries(sectorCounts)) {
      sectorConcentration[sector] =
        (count / Math.max(this.recentTrades.length, 1)) * 100;
    }

    // Calculate correlation risk (higher if concentrated in few sectors)
    const sectorCount = Object.keys(sectorConcentration).length;
    const maxSectorConcentration = Math.max(
      ...Object.values(sectorConcentration),
      0
    );
    const correlationRisk =
      sectorCount > 0
        ? Math.min(
            1,
            (maxSectorConcentration / 100) * (1 / Math.max(sectorCount, 1))
          )
        : 0;

    // Estimate exposure levels based on config (actual exposure requires account data)
    const estimatedExposurePct =
      (positionCount / 10) * this.config.baseMaxPositionPct;
    const largestPositionPct =
      positionCount > 0 ? this.config.baseMaxPositionPct : 0;

    // Determine overall heat level
    let overallHeat: "low" | "moderate" | "high" | "critical" = "low";
    if (estimatedExposurePct >= 90 || correlationRisk >= 0.8) {
      overallHeat = "critical";
    } else if (estimatedExposurePct >= 70 || correlationRisk >= 0.6) {
      overallHeat = "high";
    } else if (estimatedExposurePct >= 50 || correlationRisk >= 0.4) {
      overallHeat = "moderate";
    }

    return {
      totalExposure: 0, // Requires account data to calculate
      totalExposurePct: estimatedExposurePct,
      positionCount,
      largestPositionPct,
      sectorConcentration,
      correlationRisk,
      overallHeat,
    };
  }
}

// Export singleton instance
export const dynamicExposureController = new DynamicExposureController();
