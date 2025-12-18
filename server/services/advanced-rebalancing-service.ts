/**
 * Advanced Rebalancing Service
 * 
 * Implements advanced trading features:
 * - Partial take-profit levels (scale out at different profit levels)
 * - Trailing stop automation (move to breakeven at X% profit)
 * - Market regime adaptation (adjust position sizes based on market conditions)
 * - Kelly criterion position sizing
 */

import { db } from "../db";
import { macroIndicators } from "@shared/schema";
import { log } from "../utils/logger";
import { PositionWithRules } from "../autonomous/orchestrator";

export type MarketRegime = "bullish" | "bearish" | "sideways" | "volatile" | "unknown";

export interface PartialTakeProfitLevel {
  profitPercent: number;
  closePercent: number;
  executed: boolean;
  executedAt?: Date;
}

export interface TrailingStopConfig {
  enabled: boolean;
  trailPercent: number;
  breakEvenTriggerPercent: number;
  activationProfitPercent: number;
  highWaterMark: number;
}

export interface PositionProfitRules {
  symbol: string;
  entryPrice: number;
  partialTakeProfits: PartialTakeProfitLevel[];
  trailingStop: TrailingStopConfig;
  maxHoldingPeriodHours: number;
  createdAt: Date;
}

export interface MarketRegimeConfig {
  bullishMultiplier: number;
  bearishMultiplier: number;
  sidewaysStrategy: "reduce" | "range-trade" | "wait";
  volatileMultiplier: number;
}

export interface KellyPositionSize {
  symbol: string;
  rawKellyPercent: number;
  adjustedKellyPercent: number;
  suggestedPositionSize: number;
  confidence: number;
  expectedReturn: number;
  riskRatio: number;
}

const DEFAULT_PARTIAL_TAKE_PROFITS: PartialTakeProfitLevel[] = [
  { profitPercent: 10, closePercent: 25, executed: false },
  { profitPercent: 20, closePercent: 25, executed: false },
  { profitPercent: 35, closePercent: 25, executed: false },
  { profitPercent: 50, closePercent: 25, executed: false },
];

const DEFAULT_TRAILING_STOP: TrailingStopConfig = {
  enabled: true,
  trailPercent: 5,
  breakEvenTriggerPercent: 8,
  activationProfitPercent: 5,
  highWaterMark: 0,
};

const DEFAULT_MARKET_REGIME_CONFIG: MarketRegimeConfig = {
  bullishMultiplier: 1.25,
  bearishMultiplier: 0.5,
  sidewaysStrategy: "reduce",
  volatileMultiplier: 0.6,
};

const positionProfitRules = new Map<string, PositionProfitRules>();

class AdvancedRebalancingService {
  private marketRegimeConfig: MarketRegimeConfig = DEFAULT_MARKET_REGIME_CONFIG;
  private lastRegimeAnalysis: { regime: MarketRegime; analyzedAt: Date } | null = null;
  private kellyFraction: number = 0.25;

  registerPosition(
    symbol: string,
    entryPrice: number,
    customRules?: Partial<PositionProfitRules>
  ): PositionProfitRules {
    const rules: PositionProfitRules = {
      symbol,
      entryPrice,
      partialTakeProfits: customRules?.partialTakeProfits || 
        JSON.parse(JSON.stringify(DEFAULT_PARTIAL_TAKE_PROFITS)),
      trailingStop: customRules?.trailingStop || 
        { ...DEFAULT_TRAILING_STOP, highWaterMark: entryPrice },
      maxHoldingPeriodHours: customRules?.maxHoldingPeriodHours || 168,
      createdAt: new Date(),
    };

    positionProfitRules.set(symbol, rules);
    log.info("AdvancedRebalancing", `Registered profit rules for ${symbol}`, {
      entryPrice,
      takeProfitLevels: rules.partialTakeProfits.length,
    });

    return rules;
  }

  getPositionRules(symbol: string): PositionProfitRules | undefined {
    return positionProfitRules.get(symbol);
  }

  removePositionRules(symbol: string): void {
    positionProfitRules.delete(symbol);
  }

  checkPartialTakeProfits(
    position: PositionWithRules
  ): { shouldClose: boolean; closePercent: number; reason: string } | null {
    const rules = positionProfitRules.get(position.symbol);
    if (!rules) return null;

    const currentProfitPercent = position.unrealizedPnlPercent;

    for (const level of rules.partialTakeProfits) {
      if (!level.executed && currentProfitPercent >= level.profitPercent) {
        level.executed = true;
        level.executedAt = new Date();
        
        log.info("AdvancedRebalancing", `Partial take-profit triggered for ${position.symbol}`, {
          profitLevel: level.profitPercent,
          closePercent: level.closePercent,
          currentProfit: currentProfitPercent.toFixed(2),
        });

        return {
          shouldClose: true,
          closePercent: level.closePercent,
          reason: `Partial take-profit at ${level.profitPercent}% gain`,
        };
      }
    }

    return null;
  }

  updateTrailingStop(
    position: PositionWithRules
  ): { newStopLoss: number; reason: string } | null {
    const rules = positionProfitRules.get(position.symbol);
    if (!rules || !rules.trailingStop.enabled) return null;

    const config = rules.trailingStop;
    const currentProfitPercent = position.unrealizedPnlPercent;

    if (currentProfitPercent < config.activationProfitPercent) {
      return null;
    }

    if (position.currentPrice > config.highWaterMark) {
      config.highWaterMark = position.currentPrice;
    }

    let newStopLoss: number;
    let reason: string;

    if (currentProfitPercent >= config.breakEvenTriggerPercent) {
      const breakEvenStop = rules.entryPrice * 1.005;
      const trailingStop = config.highWaterMark * (1 - config.trailPercent / 100);
      
      newStopLoss = Math.max(breakEvenStop, trailingStop);
      reason = currentProfitPercent >= config.breakEvenTriggerPercent * 1.5
        ? `Trailing stop at ${config.trailPercent}% below high water mark ($${config.highWaterMark.toFixed(2)})`
        : `Moved stop to breakeven + 0.5%`;
    } else {
      newStopLoss = config.highWaterMark * (1 - config.trailPercent / 100);
      reason = `Initial trailing stop at ${config.trailPercent}% below current price`;
    }

    if (!position.stopLossPrice || newStopLoss > position.stopLossPrice) {
      log.info("AdvancedRebalancing", `Trailing stop update for ${position.symbol}`, {
        oldStop: position.stopLossPrice?.toFixed(2),
        newStop: newStopLoss.toFixed(2),
        reason,
      });

      return { newStopLoss, reason };
    }

    return null;
  }

  async detectMarketRegime(): Promise<MarketRegime> {
    try {
      const indicators = await db.select().from(macroIndicators);
      
      if (indicators.length === 0) {
        return "unknown";
      }

      const vix = indicators.find(i => i.indicatorId === "VIXCLS");
      const yieldSpread = indicators.find(i => i.indicatorId === "T10Y2Y");
      const fedFundsRate = indicators.find(i => i.indicatorId === "FEDFUNDS");
      const unemployment = indicators.find(i => i.indicatorId === "UNRATE");

      const vixValue = vix?.latestValue ? parseFloat(vix.latestValue) : 20;
      const spreadValue = yieldSpread?.latestValue ? parseFloat(yieldSpread.latestValue) : 0;
      const unemploymentChange = unemployment?.changePercent ? parseFloat(unemployment.changePercent) : 0;

      let regime: MarketRegime;

      if (vixValue > 30) {
        regime = "volatile";
      } else if (spreadValue < 0) {
        regime = "bearish";
      } else if (vixValue < 15 && spreadValue > 0.5 && unemploymentChange <= 0) {
        regime = "bullish";
      } else {
        regime = "sideways";
      }

      this.lastRegimeAnalysis = { regime, analyzedAt: new Date() };
      
      log.info("AdvancedRebalancing", `Market regime detected: ${regime}`, {
        vix: vixValue,
        yieldSpread: spreadValue,
        unemploymentChange,
      });

      return regime;
    } catch (error) {
      log.error("AdvancedRebalancing", "Failed to detect market regime", { error: String(error) });
      return "unknown";
    }
  }

  getRegimeAdjustedPositionSize(
    basePositionSizePercent: number,
    regime?: MarketRegime
  ): number {
    const currentRegime = regime || this.lastRegimeAnalysis?.regime || "unknown";

    let multiplier: number;

    switch (currentRegime) {
      case "bullish":
        multiplier = this.marketRegimeConfig.bullishMultiplier;
        break;
      case "bearish":
        multiplier = this.marketRegimeConfig.bearishMultiplier;
        break;
      case "volatile":
        multiplier = this.marketRegimeConfig.volatileMultiplier;
        break;
      case "sideways":
        multiplier = this.marketRegimeConfig.sidewaysStrategy === "reduce" ? 0.75 : 1.0;
        break;
      default:
        multiplier = 1.0;
    }

    const adjustedSize = basePositionSizePercent * multiplier;
    
    log.debug("AdvancedRebalancing", `Regime-adjusted position size`, {
      regime: currentRegime,
      base: basePositionSizePercent,
      multiplier,
      adjusted: adjustedSize,
    });

    return adjustedSize;
  }

  calculateKellyPositionSize(params: {
    confidence: number;
    targetProfit: number;
    stopLoss: number;
    entryPrice: number;
    portfolioValue: number;
    maxPositionSizePercent: number;
  }): KellyPositionSize {
    const { confidence, targetProfit, stopLoss, entryPrice, portfolioValue, maxPositionSizePercent } = params;

    const winRate = confidence / 100;
    const lossRate = 1 - winRate;
    
    const avgWin = targetProfit - entryPrice;
    const avgLoss = entryPrice - stopLoss;
    
    if (avgLoss <= 0 || avgWin <= 0) {
      return {
        symbol: "",
        rawKellyPercent: 0,
        adjustedKellyPercent: 0,
        suggestedPositionSize: 0,
        confidence,
        expectedReturn: 0,
        riskRatio: 0,
      };
    }

    const winLossRatio = avgWin / avgLoss;

    const rawKelly = (winLossRatio * winRate - lossRate) / winLossRatio;
    
    const adjustedKelly = Math.max(0, rawKelly * this.kellyFraction);
    
    const cappedKelly = Math.min(adjustedKelly * 100, maxPositionSizePercent);
    
    const suggestedSize = (cappedKelly / 100) * portfolioValue;

    const expectedReturn = (winRate * avgWin) - (lossRate * avgLoss);

    log.debug("AdvancedRebalancing", `Kelly position size calculated`, {
      winRate: winRate.toFixed(3),
      winLossRatio: winLossRatio.toFixed(2),
      rawKelly: (rawKelly * 100).toFixed(2) + "%",
      adjustedKelly: (adjustedKelly * 100).toFixed(2) + "%",
      cappedKelly: cappedKelly.toFixed(2) + "%",
      suggestedSize: suggestedSize.toFixed(2),
    });

    return {
      symbol: "",
      rawKellyPercent: rawKelly * 100,
      adjustedKellyPercent: adjustedKelly * 100,
      suggestedPositionSize: suggestedSize,
      confidence,
      expectedReturn,
      riskRatio: winLossRatio,
    };
  }

  setKellyFraction(fraction: number): void {
    if (fraction < 0.1 || fraction > 1.0) {
      throw new Error("Kelly fraction must be between 0.1 and 1.0");
    }
    this.kellyFraction = fraction;
    log.info("AdvancedRebalancing", `Kelly fraction set to ${fraction}`);
  }

  setMarketRegimeConfig(config: Partial<MarketRegimeConfig>): void {
    this.marketRegimeConfig = { ...this.marketRegimeConfig, ...config };
    log.info("AdvancedRebalancing", "Market regime config updated", {
      bullishMultiplier: this.marketRegimeConfig.bullishMultiplier,
      bearishMultiplier: this.marketRegimeConfig.bearishMultiplier,
      sidewaysStrategy: this.marketRegimeConfig.sidewaysStrategy,
      volatileMultiplier: this.marketRegimeConfig.volatileMultiplier,
    });
  }

  getMarketRegimeConfig(): MarketRegimeConfig {
    return { ...this.marketRegimeConfig };
  }

  getLastRegimeAnalysis(): { regime: MarketRegime; analyzedAt: Date } | null {
    return this.lastRegimeAnalysis;
  }

  checkHoldingPeriod(position: PositionWithRules): {
    exceeded: boolean;
    holdingHours: number;
    maxHours: number;
  } | null {
    const rules = positionProfitRules.get(position.symbol);
    if (!rules) return null;

    const holdingMs = Date.now() - position.openedAt.getTime();
    const holdingHours = holdingMs / (1000 * 60 * 60);

    return {
      exceeded: holdingHours > rules.maxHoldingPeriodHours,
      holdingHours,
      maxHours: rules.maxHoldingPeriodHours,
    };
  }

  getAllPositionRules(): Map<string, PositionProfitRules> {
    return new Map(positionProfitRules);
  }

  getStatus(): {
    registeredPositions: number;
    lastRegime: MarketRegime | null;
    lastRegimeAnalyzedAt: Date | null;
    kellyFraction: number;
    regimeConfig: MarketRegimeConfig;
  } {
    return {
      registeredPositions: positionProfitRules.size,
      lastRegime: this.lastRegimeAnalysis?.regime || null,
      lastRegimeAnalyzedAt: this.lastRegimeAnalysis?.analyzedAt || null,
      kellyFraction: this.kellyFraction,
      regimeConfig: this.marketRegimeConfig,
    };
  }
}

export const advancedRebalancingService = new AdvancedRebalancingService();
