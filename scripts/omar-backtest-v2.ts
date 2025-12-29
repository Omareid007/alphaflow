#!/usr/bin/env npx tsx
/**
 * Omar Algorithmic Trading Backtest Framework v2
 *
 * Refactored to use shared modules for reduced code duplication.
 * Original: ~780 lines -> Refactored: ~150 lines (80% reduction)
 */

import {
  fetchHistoricalData,
  runBacktest,
  calculateScore,
  SYMBOL_LISTS,
  type BacktestConfig,
  type BacktestResult,
  type Trade,
  DEFAULT_CONFIG
} from "./shared/index.js";

// ============================================================================
// PARAMETER SETS FOR OPTIMIZATION
// ============================================================================

const parameterSets: Partial<BacktestConfig>[] = [
  // Iteration 1: Conservative baseline
  {
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
    smaPeriod: 20,
    emaPeriodFast: 12,
    emaPeriodSlow: 26,
    atrPeriod: 14,
    atrMultiplierStop: 2.0,
    atrMultiplierTarget: 3.0,
    buyThreshold: 0.3,
    sellThreshold: 0.3,
    confidenceMinimum: 0.5,
    maxPositionPct: 0.05,
    stopLossPct: 0.03,
    takeProfitPct: 0.06
  },
  // Iteration 2: Aggressive momentum
  {
    rsiPeriod: 10,
    rsiOversold: 25,
    rsiOverbought: 75,
    smaPeriod: 10,
    emaPeriodFast: 8,
    emaPeriodSlow: 21,
    atrPeriod: 10,
    atrMultiplierStop: 1.5,
    atrMultiplierTarget: 4.0,
    buyThreshold: 0.2,
    sellThreshold: 0.2,
    confidenceMinimum: 0.45,
    maxPositionPct: 0.08,
    stopLossPct: 0.04,
    takeProfitPct: 0.08
  },
  // Iteration 3: Tight stops
  {
    rsiPeriod: 14,
    rsiOversold: 35,
    rsiOverbought: 65,
    smaPeriod: 20,
    emaPeriodFast: 12,
    emaPeriodSlow: 26,
    atrPeriod: 14,
    atrMultiplierStop: 1.2,
    atrMultiplierTarget: 2.5,
    buyThreshold: 0.25,
    sellThreshold: 0.25,
    confidenceMinimum: 0.55,
    maxPositionPct: 0.06,
    stopLossPct: 0.02,
    takeProfitPct: 0.05
  },
  // Iteration 4: Wide targets
  {
    rsiPeriod: 21,
    rsiOversold: 30,
    rsiOverbought: 70,
    smaPeriod: 50,
    emaPeriodFast: 12,
    emaPeriodSlow: 26,
    atrPeriod: 20,
    atrMultiplierStop: 2.5,
    atrMultiplierTarget: 5.0,
    buyThreshold: 0.35,
    sellThreshold: 0.35,
    confidenceMinimum: 0.6,
    maxPositionPct: 0.05,
    stopLossPct: 0.05,
    takeProfitPct: 0.1
  },
  // Iteration 5: High confidence only
  {
    rsiPeriod: 14,
    rsiOversold: 28,
    rsiOverbought: 72,
    smaPeriod: 20,
    emaPeriodFast: 9,
    emaPeriodSlow: 21,
    atrPeriod: 14,
    atrMultiplierStop: 2.0,
    atrMultiplierTarget: 3.5,
    buyThreshold: 0.4,
    sellThreshold: 0.4,
    confidenceMinimum: 0.65,
    maxPositionPct: 0.07,
    stopLossPct: 0.03,
    takeProfitPct: 0.07
  },
  // Iteration 6: Balanced optimized
  {
    rsiPeriod: 12,
    rsiOversold: 32,
    rsiOverbought: 68,
    smaPeriod: 15,
    emaPeriodFast: 10,
    emaPeriodSlow: 24,
    atrPeriod: 12,
    atrMultiplierStop: 1.8,
    atrMultiplierTarget: 3.2,
    buyThreshold: 0.28,
    sellThreshold: 0.28,
    confidenceMinimum: 0.52,
    maxPositionPct: 0.065,
    stopLossPct: 0.028,
    takeProfitPct: 0.065
  }
];

// ============================================================================
// MAIN
// ============================================================================

interface Result {
  iteration: number;
  config: BacktestConfig;
  metrics: BacktestResult["metrics"];
  score: number;
  sampleTrades: Trade[];
}

async function main() {
  console.log("=".repeat(80));
  console.log("OMAR ALGORITHMIC TRADING BACKTEST v2 (Using Shared Modules)");
  console.log("=".repeat(80));

  const symbols = SYMBOL_LISTS.default;
  const endDate = "2025-12-20";
  const startDate = "2024-01-01";

  console.log(`\nFetching historical data from ${startDate} to ${endDate}...`);
  const dataMap = await fetchHistoricalData(symbols, startDate, endDate);

  if (dataMap.size === 0) {
    console.error("No data fetched. Check API keys.");
    return;
  }

  const results: Result[] = [];

  for (let i = 0; i < parameterSets.length; i++) {
    const params = parameterSets[i];
    const config: BacktestConfig = {
      symbols,
      startDate,
      endDate,
      initialCapital: DEFAULT_CONFIG.initialCapital!,
      maxPositionPct: params.maxPositionPct ?? DEFAULT_CONFIG.maxPositionPct!,
      stopLossPct: params.stopLossPct ?? DEFAULT_CONFIG.stopLossPct!,
      takeProfitPct: params.takeProfitPct ?? DEFAULT_CONFIG.takeProfitPct!,
      rsiPeriod: params.rsiPeriod ?? DEFAULT_CONFIG.rsiPeriod!,
      rsiOversold: params.rsiOversold ?? DEFAULT_CONFIG.rsiOversold!,
      rsiOverbought: params.rsiOverbought ?? DEFAULT_CONFIG.rsiOverbought!,
      smaPeriod: params.smaPeriod ?? DEFAULT_CONFIG.smaPeriod!,
      emaPeriodFast: params.emaPeriodFast ?? DEFAULT_CONFIG.emaPeriodFast!,
      emaPeriodSlow: params.emaPeriodSlow ?? DEFAULT_CONFIG.emaPeriodSlow!,
      atrPeriod: params.atrPeriod ?? DEFAULT_CONFIG.atrPeriod!,
      atrMultiplierStop: params.atrMultiplierStop ?? DEFAULT_CONFIG.atrMultiplierStop!,
      atrMultiplierTarget: params.atrMultiplierTarget ?? DEFAULT_CONFIG.atrMultiplierTarget!,
      buyThreshold: params.buyThreshold ?? DEFAULT_CONFIG.buyThreshold!,
      sellThreshold: params.sellThreshold ?? DEFAULT_CONFIG.sellThreshold!,
      confidenceMinimum: params.confidenceMinimum ?? DEFAULT_CONFIG.confidenceMinimum!
    };

    console.log(`\n${"=".repeat(60)}`);
    console.log(`ITERATION ${i + 1}`);
    console.log(`${"=".repeat(60)}`);

    const result = runBacktest(dataMap, config);
    const score = calculateScore(result.metrics);

    results.push({
      iteration: i + 1,
      config,
      metrics: result.metrics,
      score,
      sampleTrades: result.sampleTrades
    });

    console.log(`Trades: ${result.metrics.totalTrades} | Win Rate: ${result.metrics.winRate.toFixed(1)}%`);
    console.log(`P&L: $${result.metrics.totalPnl.toFixed(0)} (${result.metrics.totalPnlPct.toFixed(1)}%)`);
    console.log(`Profit Factor: ${result.metrics.profitFactor.toFixed(2)} | Sharpe: ${result.metrics.sharpeRatio.toFixed(2)}`);
    console.log(`Max DD: ${result.metrics.maxDrawdown.toFixed(1)}% | CAGR: ${result.metrics.cagr.toFixed(1)}%`);
    console.log(`Score: ${score.toFixed(2)}`);
  }

  results.sort((a, b) => b.score - a.score);
  const best = results[0];

  console.log(`\n${"=".repeat(80)}`);
  console.log("OPTIMIZATION COMPLETE - BEST RESULT");
  console.log(`${"=".repeat(80)}`);
  console.log(`Iteration: ${best.iteration}`);
  console.log(`Score: ${best.score.toFixed(2)}`);
  console.log(`\nMetrics:`);
  console.log(JSON.stringify(best.metrics, null, 2));
  console.log(`\nConfig:`);
  console.log(JSON.stringify(best.config, null, 2));

  console.log(`\nSample Trades:`);
  best.sampleTrades.slice(0, 5).forEach((t, i) => {
    console.log(
      `  ${i + 1}. ${t.symbol}: ${t.entryDate} @ $${t.entryPrice.toFixed(2)} -> ${t.exitDate} @ $${t.exitPrice?.toFixed(2)} | P&L: $${t.pnl?.toFixed(2)} (${t.exitReason})`
    );
  });

  console.log("\n=== ALL RESULTS ===");
  results.forEach((r) => {
    console.log(
      `Iter ${r.iteration}: Score=${r.score.toFixed(2)}, WinRate=${r.metrics.winRate.toFixed(1)}%, PF=${r.metrics.profitFactor.toFixed(2)}, Sharpe=${r.metrics.sharpeRatio.toFixed(2)}`
    );
  });
}

main().catch(console.error);
