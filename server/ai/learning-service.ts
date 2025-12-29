import { db } from "../db";
import { aiDecisionFeatures, aiTradeOutcomes, aiCalibrationLog, aiDecisions, trades } from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { log } from "../utils/logger";
import { calculatePnL, percentChange } from "../utils/money";

export interface FeatureVector {
  volatility?: number;
  trendStrength?: number;
  signalAgreement?: number;
  sentimentScore?: number;
  peRatio?: number;
  pbRatio?: number;
  rsi?: number;
  macdSignal?: string;
  volumeRatio?: number;
  priceChangePercent?: number;
  marketCondition?: string;
  dataQuality?: number;
  activeSources?: number;
}

export interface TradeOutcomeInput {
  decisionId: string;
  tradeId?: string;
  symbol: string;
  action: string;
  predictionConfidence?: number;
  entryPrice?: number;
  exitPrice?: number;
  quantity?: number;
  realizedPnl?: number;
  realizedPnlPercent?: number;
  holdingTimeMs?: number;
  isWin?: boolean;
  slippagePercent?: number;
  targetPriceHit?: boolean;
  stopLossHit?: boolean;
  maxDrawdown?: number;
  maxGain?: number;
  marketSessionAtEntry?: string;
  marketSessionAtExit?: string;
  strategyId?: string;
  exitReason?: string;
}

export async function recordDecisionFeatures(
  decisionId: string,
  symbol: string,
  features: FeatureVector
): Promise<void> {
  try {
    const featureVectorJson = JSON.stringify(features);
    
    await db.insert(aiDecisionFeatures).values({
      decisionId,
      symbol,
      volatility: features.volatility?.toString(),
      trendStrength: features.trendStrength?.toString(),
      signalAgreement: features.signalAgreement?.toString(),
      sentimentScore: features.sentimentScore?.toString(),
      peRatio: features.peRatio?.toString(),
      pbRatio: features.pbRatio?.toString(),
      rsi: features.rsi?.toString(),
      macdSignal: features.macdSignal,
      volumeRatio: features.volumeRatio?.toString(),
      priceChangePercent: features.priceChangePercent?.toString(),
      marketCondition: features.marketCondition,
      dataQuality: features.dataQuality?.toString(),
      activeSources: features.activeSources,
      featureVector: featureVectorJson,
    });
    
    log.debug("AILearning", `Recorded features for decision ${decisionId}`);
  } catch (error) {
    log.error("AILearning", `Failed to record features: ${error}`);
  }
}

export async function recordTradeOutcome(input: TradeOutcomeInput): Promise<void> {
  try {
    await db.insert(aiTradeOutcomes).values({
      decisionId: input.decisionId,
      tradeId: input.tradeId,
      symbol: input.symbol,
      action: input.action,
      predictionConfidence: input.predictionConfidence?.toString(),
      entryPrice: input.entryPrice?.toString(),
      exitPrice: input.exitPrice?.toString(),
      quantity: input.quantity?.toString(),
      realizedPnl: input.realizedPnl?.toString(),
      realizedPnlPercent: input.realizedPnlPercent?.toString(),
      holdingTimeMs: input.holdingTimeMs,
      isWin: input.isWin,
      slippagePercent: input.slippagePercent?.toString(),
      targetPriceHit: input.targetPriceHit,
      stopLossHit: input.stopLossHit,
      maxDrawdown: input.maxDrawdown?.toString(),
      maxGain: input.maxGain?.toString(),
      marketSessionAtEntry: input.marketSessionAtEntry,
      marketSessionAtExit: input.marketSessionAtExit,
      strategyId: input.strategyId,
      exitReason: input.exitReason,
      closedAt: input.exitPrice ? new Date() : null,
    });
    
    log.debug("AILearning", `Recorded outcome for decision ${input.decisionId}`);
  } catch (error) {
    log.error("AILearning", `Failed to record outcome: ${error}`);
  }
}

export async function updateTradeOutcomeOnClose(
  decisionId: string,
  exitPrice: number,
  exitReason: string,
  marketSession?: string
): Promise<void> {
  try {
    const existingOutcome = await db.select()
      .from(aiTradeOutcomes)
      .where(eq(aiTradeOutcomes.decisionId, decisionId))
      .limit(1);
    
    if (existingOutcome.length === 0) {
      log.warn("AILearning", `No outcome record found for decision ${decisionId}`);
      return;
    }
    
    const outcome = existingOutcome[0];
    const entryPrice = parseFloat(outcome.entryPrice || "0");
    const quantity = parseFloat(outcome.quantity || "0");

    const realizedPnl = calculatePnL(entryPrice, exitPrice, quantity, "long").toNumber();
    const realizedPnlPercent = entryPrice > 0 ? percentChange(exitPrice, entryPrice).toNumber() : 0;
    const isWin = realizedPnl > 0;
    const holdingTimeMs = outcome.createdAt ? Date.now() - outcome.createdAt.getTime() : 0;
    
    await db.update(aiTradeOutcomes)
      .set({
        exitPrice: exitPrice.toString(),
        realizedPnl: realizedPnl.toString(),
        realizedPnlPercent: realizedPnlPercent.toString(),
        isWin,
        holdingTimeMs,
        exitReason,
        marketSessionAtExit: marketSession,
        closedAt: new Date(),
      })
      .where(eq(aiTradeOutcomes.decisionId, decisionId));
    
    log.info("AILearning", `Updated outcome for ${decisionId}: PnL=$${realizedPnl.toFixed(2)} (${isWin ? "WIN" : "LOSS"})`);
  } catch (error) {
    log.error("AILearning", `Failed to update outcome: ${error}`);
  }
}

export async function runCalibrationAnalysis(windowDays: number = 30): Promise<void> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - windowDays);
    
    const outcomes = await db.select()
      .from(aiTradeOutcomes)
      .where(and(
        gte(aiTradeOutcomes.createdAt, startDate),
        sql`${aiTradeOutcomes.isWin} IS NOT NULL`
      ));
    
    if (outcomes.length === 0) {
      log.info("AILearning", "No closed trades in window for calibration");
      return;
    }
    
    const wins = outcomes.filter(o => o.isWin === true);
    const losses = outcomes.filter(o => o.isWin === false);
    
    const avgConfidenceWins = wins.length > 0 
      ? wins.reduce((sum, o) => sum + parseFloat(o.predictionConfidence || "0"), 0) / wins.length 
      : 0;
    const avgConfidenceLosses = losses.length > 0 
      ? losses.reduce((sum, o) => sum + parseFloat(o.predictionConfidence || "0"), 0) / losses.length 
      : 0;
    
    const avgHoldingTimeWins = wins.length > 0 
      ? Math.round(wins.reduce((sum, o) => sum + (o.holdingTimeMs || 0), 0) / wins.length)
      : 0;
    const avgHoldingTimeLosses = losses.length > 0 
      ? Math.round(losses.reduce((sum, o) => sum + (o.holdingTimeMs || 0), 0) / losses.length)
      : 0;
    
    const symbolWins: Record<string, number> = {};
    const symbolLosses: Record<string, number> = {};
    
    for (const o of outcomes) {
      if (o.isWin) {
        symbolWins[o.symbol] = (symbolWins[o.symbol] || 0) + 1;
      } else {
        symbolLosses[o.symbol] = (symbolLosses[o.symbol] || 0) + 1;
      }
    }
    
    const topWinningSymbols = Object.entries(symbolWins)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s, c]) => `${s}:${c}`)
      .join(",");
    
    const topLosingSymbols = Object.entries(symbolLosses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s, c]) => `${s}:${c}`)
      .join(",");
    
    const adjustments: string[] = [];
    
    if (avgConfidenceLosses > 0.6) {
      adjustments.push("High confidence losses detected - consider raising confidence threshold");
    }
    if (avgHoldingTimeLosses < avgHoldingTimeWins / 2) {
      adjustments.push("Losses happen quickly - consider tighter stop losses");
    }
    if (losses.length > wins.length * 2) {
      adjustments.push("Low win rate - consider more conservative position sizing");
    }
    
    await db.insert(aiCalibrationLog).values({
      calibrationType: "periodic",
      dataWindowDays: windowDays,
      totalDecisions: outcomes.length,
      winCount: wins.length,
      lossCount: losses.length,
      avgConfidenceOnWins: avgConfidenceWins.toString(),
      avgConfidenceOnLosses: avgConfidenceLosses.toString(),
      avgHoldingTimeWins,
      avgHoldingTimeLosses,
      topWinningSymbols,
      topLosingSymbols,
      recommendedAdjustments: adjustments.join("; "),
      modelVersion: "v1.0",
    });
    
    log.info("AILearning", `Calibration complete: ${wins.length} wins, ${losses.length} losses, win rate ${((wins.length / outcomes.length) * 100).toFixed(1)}%`);
  } catch (error) {
    log.error("AILearning", `Calibration analysis failed: ${error}`);
  }
}

export async function getLatestCalibration(): Promise<{
  winRate: number;
  avgConfidenceThreshold: number;
  topSymbols: string[];
  adjustments: string[];
} | null> {
  try {
    const latest = await db.select()
      .from(aiCalibrationLog)
      .orderBy(desc(aiCalibrationLog.createdAt))
      .limit(1);
    
    if (latest.length === 0) return null;
    
    const cal = latest[0];
    const totalDecisions = cal.totalDecisions || 0;
    const winCount = cal.winCount || 0;
    
    return {
      winRate: totalDecisions > 0 ? (winCount / totalDecisions) * 100 : 0,
      avgConfidenceThreshold: parseFloat(cal.avgConfidenceOnWins || "0.5"),
      topSymbols: (cal.topWinningSymbols || "").split(",").filter(Boolean),
      adjustments: (cal.recommendedAdjustments || "").split(";").filter(Boolean),
    };
  } catch (error) {
    log.error("AILearning", `Failed to get calibration: ${error}`);
    return null;
  }
}
