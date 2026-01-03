#!/usr/bin/env npx tsx
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║     OMAR ULTRA HYPEROPTIMIZER - PRODUCTION EDITION                            ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║  SMART TRACKING | COMPREHENSIVE LOGGING | FULL FUNCTIONAL OUTPUT              ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Refactored to use shared modules (1431 lines -> ~700 lines, 51% reduction)
 */

import * as fs from "fs";
import {
  fetchAlpacaBars,
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateATR,
  calculateMACD,
  calculateBollingerBands,
  tournamentSelect,
  normalizeWeights,
  type AlpacaBar,
  type Genome,
  type LearningInsight,
  type ParamRange,
} from "./shared/index.js";

// ============================================================================
// CONFIGURATION - PRODUCTION OPTIMIZED
// ============================================================================

const LOG_FILE = "/home/runner/workspace/hyperoptimizer_log.txt";
const RESULTS_FILE = "/home/runner/workspace/hyperoptimizer_results.json";
const CHECKPOINT_FILE = "/home/runner/workspace/hyperoptimizer_checkpoint.json";

const CONFIG = {
  TOTAL_ITERATIONS: 15000,
  BATCH_SIZE: 50,
  PARALLEL_WORKERS: 10,
  POPULATION_SIZE: 200,
  ELITE_COUNT: 20,
  MUTATION_RATE_INITIAL: 0.15,
  CROSSOVER_RATE: 0.7,
  TOURNAMENT_SIZE: 5,
  NUM_ISLANDS: 5,
  MIGRATION_INTERVAL: 20,
  MIGRATION_COUNT: 3,
  CONVERGENCE_THRESHOLD: 0.0005,
  MAX_STAGNANT_GENERATIONS: 50,
  DIVERSITY_INJECTION_THRESHOLD: 0.05,
  CHECKPOINT_INTERVAL: 500,
  PROGRESS_REPORT_INTERVAL: 10,
  YEARS_OF_DATA: 5,
};

// ============================================================================
// SMART LOGGING SYSTEM (Production-specific)
// ============================================================================

class SmartLogger {
  private logBuffer: string[] = [];
  private startTime: Date;
  private phaseStartTime: Date;
  private currentPhase: string = "Initialization";

  constructor() {
    this.startTime = new Date();
    this.phaseStartTime = new Date();
    this.initLogFile();
  }

  private initLogFile(): void {
    const header = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    OMAR ULTRA HYPEROPTIMIZER - PRODUCTION LOG                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Started: ${this.startTime.toISOString().padEnd(66)}║
╚══════════════════════════════════════════════════════════════════════════════╝

`;
    fs.writeFileSync(LOG_FILE, header);
  }

  setPhase(phase: string): void {
    const elapsed = this.getElapsed(this.phaseStartTime);
    if (this.currentPhase !== "Initialization") {
      this.log(`✓ Phase "${this.currentPhase}" completed in ${elapsed}`);
    }
    this.currentPhase = phase;
    this.phaseStartTime = new Date();
    this.log(`\n▶ STARTING PHASE: ${phase}`);
    this.log("─".repeat(70));
  }

  log(message: string, toConsole: boolean = true): void {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    const logLine = `[${timestamp}] ${message}`;
    this.logBuffer.push(logLine);
    if (toConsole) console.log(message);
    if (this.logBuffer.length >= 10) this.flush();
  }

  logProgress(
    generation: number,
    totalGens: number,
    metrics: Record<string, number>
  ): void {
    const pct = ((generation / totalGens) * 100).toFixed(1);
    const bar = this.progressBar(generation, totalGens, 30);
    const elapsed = this.getElapsed(this.startTime);
    this.log(
      `Gen ${generation.toString().padStart(4)}/${totalGens} ${bar} ${pct}% | Best: ${metrics.bestFitness?.toFixed(2) || "N/A"} | Avg: ${metrics.avgFitness?.toFixed(2) || "N/A"} | Rate: ${metrics.evalRate?.toFixed(1) || "0"}/s | ${elapsed}`
    );
  }

  logBest(genome: ProductionGenome, result: BacktestResult): void {
    this.log("\n" + "═".repeat(70));
    this.log("🏆 NEW GLOBAL BEST CONFIGURATION FOUND");
    this.log("═".repeat(70));
    this.log(
      `   Fitness: ${genome.fitness.toFixed(4)} | Sharpe: ${result.sharpe.toFixed(4)} | Return: ${(result.totalReturn * 100).toFixed(2)}%`
    );
    this.log(
      `   MaxDD: ${(result.maxDrawdown * 100).toFixed(2)}% | WinRate: ${(result.winRate * 100).toFixed(1)}% | Trades: ${result.trades}`
    );
    this.log("═".repeat(70) + "\n");
  }

  logInsight(insight: LearningInsight): void {
    this.log(
      `   💡 ${insight.pattern} (correlation: ${insight.correlation.toFixed(3)})`
    );
  }

  private progressBar(current: number, total: number, width: number): string {
    const filled = Math.round((current / total) * width);
    return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
  }

  private getElapsed(from: Date): string {
    const ms = Date.now() - from.getTime();
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ${secs % 60}s`;
  }

  flush(): void {
    if (this.logBuffer.length > 0) {
      fs.appendFileSync(LOG_FILE, this.logBuffer.join("\n") + "\n");
      this.logBuffer = [];
    }
  }
}

const logger = new SmartLogger();

// ============================================================================
// MARKET UNIVERSE & PARAMETER RANGES
// ============================================================================

const MARKET_UNIVERSE = {
  PRECIOUS_METALS: ["GLD", "SLV", "IAU", "PPLT"],
  METAL_MINERS: ["NEM", "GOLD", "FCX", "AEM", "WPM"],
  ENERGY: ["XLE", "XOM", "CVX", "COP", "USO"],
  SECTORS: ["XLF", "XLK", "XLV", "XLI", "XLP", "XLY", "XLB", "XLU"],
  LARGE_CAP: [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "NVDA",
    "META",
    "TSLA",
    "JPM",
    "V",
    "UNH",
  ],
  INDICES: ["SPY", "QQQ", "IWM", "DIA"],
  BONDS: ["TLT", "LQD", "HYG"],
  INTERNATIONAL: ["EFA", "EEM", "VEU"],
};

const ALL_SYMBOLS = Object.values(MARKET_UNIVERSE).flat();

const PARAM_RANGES: Record<string, ParamRange> = {
  maxPositionPct: { min: 0.02, max: 0.15, step: 0.01 },
  maxPortfolioExposure: { min: 0.4, max: 0.95, step: 0.05 },
  maxPositions: { min: 5, max: 30, step: 1, integer: true },
  atrMultStop: { min: 0.5, max: 3.0, step: 0.1 },
  atrMultTarget: { min: 1.5, max: 6.0, step: 0.25 },
  buyThreshold: { min: 0.05, max: 0.25, step: 0.01 },
  confidenceMin: { min: 0.15, max: 0.45, step: 0.02 },
  technicalWeight: { min: 0.05, max: 0.35, step: 0.02 },
  momentumWeight: { min: 0.05, max: 0.35, step: 0.02 },
  volatilityWeight: { min: 0.02, max: 0.2, step: 0.02 },
  volumeWeight: { min: 0.05, max: 0.25, step: 0.02 },
  sentimentWeight: { min: 0.05, max: 0.25, step: 0.02 },
  patternWeight: { min: 0.02, max: 0.2, step: 0.02 },
  breadthWeight: { min: 0.02, max: 0.15, step: 0.02 },
  correlationWeight: { min: 0.02, max: 0.2, step: 0.02 },
  rsiPeriod: { min: 7, max: 21, step: 1, integer: true },
  rsiOversold: { min: 20, max: 40, step: 2, integer: true },
  rsiOverbought: { min: 60, max: 80, step: 2, integer: true },
  macdFast: { min: 8, max: 16, step: 1, integer: true },
  macdSlow: { min: 20, max: 32, step: 2, integer: true },
  macdSignal: { min: 6, max: 12, step: 1, integer: true },
  bbPeriod: { min: 15, max: 25, step: 1, integer: true },
  bbStdDev: { min: 1.5, max: 2.5, step: 0.1 },
  atrPeriod: { min: 10, max: 20, step: 1, integer: true },
  smaShort: { min: 5, max: 15, step: 1, integer: true },
  smaMedium: { min: 20, max: 50, step: 5, integer: true },
  regimeLookback: { min: 20, max: 60, step: 5, integer: true },
  momentumShort: { min: 3, max: 10, step: 1, integer: true },
  momentumMedium: { min: 15, max: 30, step: 5, integer: true },
};

// ============================================================================
// EXTENDED TYPES
// ============================================================================

interface ProductionGenome extends Genome {
  regime: string;
  evaluationTime: number;
}

interface BacktestResult {
  totalReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  trades: number;
  avgHoldingDays: number;
  equity: number[];
  dailyReturns: number[];
  regimePerformance: Record<string, { return: number; sharpe: number }>;
}

interface OptimizationState {
  generation: number;
  totalEvaluations: number;
  globalBest: ProductionGenome | null;
  globalBestResult: BacktestResult | null;
  islands: ProductionGenome[][];
  startTime: Date;
}

// ============================================================================
// CONTINUOUS LEARNING ENGINE
// ============================================================================

class ContinuousLearningEngine {
  private insights: LearningInsight[] = [];
  private parameterCorrelations: Map<string, number> = new Map();
  private convergenceHistory: number[] = [];
  private bestByRegime: Map<string, ProductionGenome> = new Map();

  analyzePopulation(population: ProductionGenome[]): LearningInsight[] {
    const newInsights: LearningInsight[] = [];
    const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
    const top10Pct = sorted.slice(0, Math.ceil(sorted.length * 0.1));
    const bottom10Pct = sorted.slice(-Math.ceil(sorted.length * 0.1));

    for (const param of Object.keys(PARAM_RANGES)) {
      const topAvg =
        top10Pct.reduce((sum, g) => sum + (g.genes[param] || 0), 0) /
        top10Pct.length;
      const bottomAvg =
        bottom10Pct.reduce((sum, g) => sum + (g.genes[param] || 0), 0) /
        bottom10Pct.length;
      const allAvg =
        population.reduce((sum, g) => sum + (g.genes[param] || 0), 0) /
        population.length;
      const diff = allAvg !== 0 ? (topAvg - bottomAvg) / allAvg : 0;
      this.parameterCorrelations.set(param, diff);

      if (Math.abs(diff) > 0.15) {
        newInsights.push({
          pattern: `${param} ${diff > 0 ? "higher" : "lower"} in top performers`,
          correlation: diff,
          sampleSize: top10Pct.length,
          avgImprovement:
            top10Pct[0].fitness -
            (bottom10Pct[bottom10Pct.length - 1]?.fitness || 0),
          confidence: Math.min(1, (Math.abs(diff) * top10Pct.length) / 20),
          timestamp: new Date(),
        });
      }
    }

    for (const genome of top10Pct) {
      const regime = genome.regime || "unknown";
      const currentBest = this.bestByRegime.get(regime);
      if (!currentBest || genome.fitness > currentBest.fitness)
        this.bestByRegime.set(regime, genome);
    }

    this.insights.push(...newInsights);
    return newInsights;
  }

  getAdaptiveMutationRate(generation: number, avgFitness: number): number {
    this.convergenceHistory.push(avgFitness);
    if (this.convergenceHistory.length < 10)
      return CONFIG.MUTATION_RATE_INITIAL;
    const recent = this.convergenceHistory.slice(-10);
    const improvement = (recent[9] - recent[0]) / Math.abs(recent[0] || 1);
    if (Math.abs(improvement) < CONFIG.CONVERGENCE_THRESHOLD)
      return Math.min(CONFIG.MUTATION_RATE_INITIAL * 2.5, 0.4);
    if (improvement > 0.05)
      return Math.max(CONFIG.MUTATION_RATE_INITIAL * 0.6, 0.06);
    return CONFIG.MUTATION_RATE_INITIAL;
  }

  suggestGuidedMutation(genome: ProductionGenome): Record<string, number> {
    const suggestions: Record<string, number> = {};
    for (const [param, correlation] of this.parameterCorrelations) {
      if (Math.abs(correlation) > 0.2 && PARAM_RANGES[param]) {
        const range = PARAM_RANGES[param];
        const direction = correlation > 0 ? 1 : -1;
        suggestions[param] = Math.max(
          range.min,
          Math.min(
            range.max,
            (genome.genes[param] || range.min) + direction * range.step * 2
          )
        );
      }
    }
    return suggestions;
  }

  getInsights(): LearningInsight[] {
    return this.insights.slice(-50);
  }
  getBestByRegime(): Map<string, ProductionGenome> {
    return this.bestByRegime;
  }

  isConverged(): boolean {
    if (this.convergenceHistory.length < 30) return false;
    const recent = this.convergenceHistory.slice(-30);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance =
      recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      recent.length;
    return variance < CONFIG.CONVERGENCE_THRESHOLD;
  }
}

// ============================================================================
// JUDGE SYSTEM
// ============================================================================

class JudgeSystem {
  evaluate(
    genome: ProductionGenome,
    result: BacktestResult
  ): { verdict: string; warnings: string[]; score: number } {
    const warnings: string[] = [];
    let score =
      Math.min(result.sharpe, 3) * 20 +
      Math.min(result.sortino, 4) * 10 +
      Math.min(result.calmar, 3) * 15 +
      result.winRate * 20 +
      Math.min(result.totalReturn * 2, 40) +
      (1 - result.maxDrawdown) * 30 +
      Math.min(result.trades / 500, 1) * 10 +
      Math.min(result.profitFactor, 3) * 15;

    if (result.maxDrawdown > 0.25) {
      score -= (result.maxDrawdown - 0.25) * 100;
      warnings.push(`High drawdown: ${(result.maxDrawdown * 100).toFixed(1)}%`);
    }
    if (result.trades < 30) {
      score -= (30 - result.trades) * 2;
      warnings.push(`Low trades: ${result.trades}`);
    }
    if (result.sharpe > 4) {
      score -= 30;
      warnings.push("OVERFITTING: Sharpe > 4");
    }
    if (result.winRate > 0.85 && result.trades > 50) {
      score -= 20;
      warnings.push("OVERFITTING: Win rate > 85%");
    }

    const verdict = warnings.some((w) => w.includes("OVERFITTING"))
      ? "SUSPICIOUS"
      : score > 180
        ? "EXCELLENT"
        : score > 140
          ? "GOOD"
          : score > 90
            ? "ACCEPTABLE"
            : "POOR";
    return { verdict, warnings, score };
  }
}

// ============================================================================
// REGIME DETECTION & SIGNAL GENERATION
// ============================================================================

function detectMarketRegime(closes: number[], lookback: number = 50): string {
  if (closes.length < lookback + 50) return "unknown";
  const recent = closes.slice(-lookback);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const current = closes[closes.length - 1];
  const returns = [];
  for (let i = 1; i < recent.length; i++)
    returns.push((recent[i] - recent[i - 1]) / recent[i - 1]);
  const volatility =
    Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) *
    Math.sqrt(252);
  const momentum =
    (current - closes[closes.length - lookback]) /
    closes[closes.length - lookback];

  if (
    momentum > 0.1 &&
    current > sma20[sma20.length - 1] &&
    sma20[sma20.length - 1] > sma50[sma50.length - 1]
  )
    return volatility > 0.25 ? "volatile_bull" : "strong_bull";
  if (
    momentum < -0.1 &&
    current < sma20[sma20.length - 1] &&
    sma20[sma20.length - 1] < sma50[sma50.length - 1]
  )
    return volatility > 0.25 ? "volatile_bear" : "strong_bear";
  if (volatility > 0.3) return "high_volatility";
  if (Math.abs(momentum) < 0.03) return "ranging";
  return momentum > 0 ? "mild_bull" : "mild_bear";
}

function generateSignal(
  bars: AlpacaBar[],
  genes: Record<string, number>,
  idx: number
): { score: number; confidence: number } {
  if (idx < 60) return { score: 0, confidence: 0 };
  const closes = bars.slice(0, idx + 1).map((b) => b.c);
  const highs = bars.slice(0, idx + 1).map((b) => b.h);
  const lows = bars.slice(0, idx + 1).map((b) => b.l);
  const volumes = bars.slice(0, idx + 1).map((b) => b.v);
  const factors: Record<string, number> = {};

  const rsi = calculateRSI(closes, genes.rsiPeriod || 14);
  const currentRSI = rsi[rsi.length - 1];
  factors.technical = !isNaN(currentRSI)
    ? currentRSI < (genes.rsiOversold || 30)
      ? 0.8
      : currentRSI > (genes.rsiOverbought || 70)
        ? -0.8
        : (50 - currentRSI) / 50
    : 0;

  const macd = calculateMACD(
    closes,
    genes.macdFast || 12,
    genes.macdSlow || 26,
    genes.macdSignal || 9
  );
  if (macd.histogram.length > 1)
    factors.technical +=
      macd.histogram[macd.histogram.length - 1] >
      macd.histogram[macd.histogram.length - 2]
        ? 0.3
        : -0.3;
  factors.technical = Math.max(-1, Math.min(1, factors.technical));

  const momShort = genes.momentumShort || 5,
    momMed = genes.momentumMedium || 20;
  factors.momentum =
    closes.length > momMed
      ? Math.max(
          -1,
          Math.min(
            1,
            ((closes[closes.length - 1] -
              closes[closes.length - momShort - 1]) /
              closes[closes.length - momShort - 1]) *
              10 +
              ((closes[closes.length - 1] -
                closes[closes.length - momMed - 1]) /
                closes[closes.length - momMed - 1]) *
                5
          )
        )
      : 0;

  const atr = calculateATR(highs, lows, closes, genes.atrPeriod || 14);
  factors.volatility = !isNaN(atr[atr.length - 1])
    ? Math.max(
        -1,
        Math.min(
          1,
          0.5 - (atr[atr.length - 1] / closes[closes.length - 1]) * 20
        )
      )
    : 0;

  factors.volume =
    volumes.length > 20
      ? Math.max(
          -1,
          Math.min(
            1,
            (volumes[volumes.length - 1] /
              (volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20) -
              1) *
              0.5
          )
        )
      : 0;
  factors.sentiment = Math.max(
    -1,
    Math.min(
      1,
      (closes.length > 5
        ? (closes[closes.length - 1] - closes[closes.length - 6]) /
          closes[closes.length - 6]
        : 0) * 10
    )
  );

  const bb = calculateBollingerBands(
    closes,
    genes.bbPeriod || 20,
    genes.bbStdDev || 2
  );
  const current = closes[closes.length - 1];
  factors.pattern =
    bb.upper[bb.upper.length - 1] && bb.lower[bb.lower.length - 1]
      ? current < bb.lower[bb.lower.length - 1]
        ? 0.6
        : current > bb.upper[bb.upper.length - 1]
          ? -0.6
          : 0
      : 0;

  const smaShort = calculateSMA(closes, genes.smaShort || 10);
  const smaMed = calculateSMA(closes, genes.smaMedium || 50);
  factors.breadth =
    !isNaN(smaShort[smaShort.length - 1]) && !isNaN(smaMed[smaMed.length - 1])
      ? Math.max(
          -1,
          Math.min(
            1,
            (current > smaShort[smaShort.length - 1] ? 0.5 : -0.5) +
              (current > smaMed[smaMed.length - 1] ? 0.5 : -0.5)
          )
        )
      : 0;
  factors.correlation =
    bb.middle && !isNaN(bb.middle[bb.middle.length - 1])
      ? Math.max(
          -1,
          Math.min(
            1,
            -(
              (current - bb.middle[bb.middle.length - 1]) /
              (bb.upper[bb.upper.length - 1] -
                bb.middle[bb.middle.length - 1] || 1)
            ) * 0.5
          )
        )
      : 0;

  const score =
    factors.technical * (genes.technicalWeight || 0.2) +
    factors.momentum * (genes.momentumWeight || 0.2) +
    factors.volatility * (genes.volatilityWeight || 0.1) +
    factors.volume * (genes.volumeWeight || 0.1) +
    factors.sentiment * (genes.sentimentWeight || 0.1) +
    factors.pattern * (genes.patternWeight || 0.1) +
    factors.breadth * (genes.breadthWeight || 0.1) +
    factors.correlation * (genes.correlationWeight || 0.1);
  const factorValues = Object.values(factors);
  const confidence =
    (Math.max(
      factorValues.filter((f) => f > 0.2).length,
      factorValues.filter((f) => f < -0.2).length
    ) /
      factorValues.length) *
    Math.abs(score);
  return { score, confidence };
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

function runBacktest(
  genome: ProductionGenome,
  barsMap: Map<string, AlpacaBar[]>,
  symbols: string[],
  startIdx: number,
  endIdx: number
): BacktestResult {
  const genes = genome.genes;
  const initialCapital = 100000;
  let capital = initialCapital;
  const equity: number[] = [capital];
  const dailyReturns: number[] = [];
  const trades: { pnl: number; holdingDays: number }[] = [];
  const positions: Map<
    string,
    {
      entry: number;
      shares: number;
      entryIdx: number;
      stopLoss: number;
      takeProfit: number;
    }
  > = new Map();
  const regimeReturns: Record<string, number[]> = {};

  const refBars = barsMap.get("SPY") || barsMap.values().next().value;
  if (!refBars || refBars.length < endIdx) return createEmptyResult();

  for (let idx = startIdx; idx < Math.min(endIdx, refBars.length); idx++) {
    const regime = detectMarketRegime(
      refBars.slice(0, idx + 1).map((b) => b.c),
      genes.regimeLookback || 50
    );
    if (!regimeReturns[regime]) regimeReturns[regime] = [];

    for (const [symbol, pos] of positions) {
      const symbolBars = barsMap.get(symbol);
      if (!symbolBars || idx >= symbolBars.length) continue;
      const bar = symbolBars[idx];
      let exitPrice: number | null = null;
      if (bar.l <= pos.stopLoss) exitPrice = pos.stopLoss;
      else if (bar.h >= pos.takeProfit) exitPrice = pos.takeProfit;
      if (exitPrice) {
        trades.push({
          pnl: (exitPrice - pos.entry) * pos.shares,
          holdingDays: idx - pos.entryIdx,
        });
        capital += pos.shares * exitPrice;
        positions.delete(symbol);
      }
    }

    if (positions.size < (genes.maxPositions || 20)) {
      const candidates: {
        symbol: string;
        score: number;
        price: number;
        atr: number;
      }[] = [];
      for (const symbol of symbols) {
        if (positions.has(symbol)) continue;
        const symbolBars = barsMap.get(symbol);
        if (!symbolBars || idx >= symbolBars.length || idx < 60) continue;
        const signal = generateSignal(symbolBars, genes, idx);
        if (
          signal.score >= (genes.buyThreshold || 0.12) &&
          signal.confidence >= (genes.confidenceMin || 0.28)
        ) {
          const closes = symbolBars.slice(0, idx + 1).map((b) => b.c);
          const atr = calculateATR(
            symbolBars.slice(0, idx + 1).map((b) => b.h),
            symbolBars.slice(0, idx + 1).map((b) => b.l),
            closes,
            genes.atrPeriod || 14
          );
          if (!isNaN(atr[atr.length - 1]))
            candidates.push({
              symbol,
              score: signal.score,
              price: symbolBars[idx].c,
              atr: atr[atr.length - 1],
            });
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      for (const c of candidates.slice(
        0,
        (genes.maxPositions || 20) - positions.size
      )) {
        const shares = Math.floor(
          (capital * (genes.maxPositionPct || 0.05)) / c.price
        );
        if (shares > 0 && shares * c.price <= capital) {
          positions.set(c.symbol, {
            entry: c.price,
            shares,
            entryIdx: idx,
            stopLoss: c.price - c.atr * (genes.atrMultStop || 1.5),
            takeProfit: c.price + c.atr * (genes.atrMultTarget || 4),
          });
          capital -= shares * c.price;
        }
      }
    }

    let currentEquity = capital;
    for (const [symbol, pos] of positions) {
      const symbolBars = barsMap.get(symbol);
      if (symbolBars && idx < symbolBars.length)
        currentEquity += pos.shares * symbolBars[idx].c;
    }
    equity.push(currentEquity);
    if (equity.length > 1) {
      const dailyReturn =
        (currentEquity - equity[equity.length - 2]) / equity[equity.length - 2];
      dailyReturns.push(dailyReturn);
      regimeReturns[regime]?.push(dailyReturn);
    }
  }

  for (const [symbol, pos] of positions) {
    const symbolBars = barsMap.get(symbol);
    if (symbolBars?.length)
      trades.push({
        pnl:
          (symbolBars[Math.min(endIdx - 1, symbolBars.length - 1)].c -
            pos.entry) *
          pos.shares,
        holdingDays: endIdx - pos.entryIdx,
      });
  }

  return calculateMetrics(
    equity,
    dailyReturns,
    trades,
    regimeReturns,
    initialCapital
  );
}

function calculateMetrics(
  equity: number[],
  dailyReturns: number[],
  trades: { pnl: number; holdingDays: number }[],
  regimeReturns: Record<string, number[]>,
  initialCapital: number
): BacktestResult {
  const finalEquity = equity[equity.length - 1];
  const totalReturn = (finalEquity - initialCapital) / initialCapital;
  let maxDrawdown = 0,
    peak = equity[0];
  for (const val of equity) {
    if (val > peak) peak = val;
    maxDrawdown = Math.max(maxDrawdown, (peak - val) / peak);
  }

  const avgReturn =
    dailyReturns.length > 0
      ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
      : 0;
  const stdReturn =
    dailyReturns.length > 1
      ? Math.sqrt(
          dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
            dailyReturns.length
        )
      : 1;
  const sharpe =
    stdReturn > 0 ? (avgReturn * 252) / (stdReturn * Math.sqrt(252)) : 0;
  const negReturns = dailyReturns.filter((r) => r < 0);
  const sortino =
    negReturns.length > 0
      ? (avgReturn * 252) /
        (Math.sqrt(
          negReturns.reduce((sum, r) => sum + r * r, 0) / negReturns.length
        ) *
          Math.sqrt(252))
      : 0;
  const years = dailyReturns.length / 252;
  const calmar =
    maxDrawdown > 0
      ? (years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0) / maxDrawdown
      : 0;

  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const avgHoldingDays =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length
      : 0;

  const regimePerformance: Record<string, { return: number; sharpe: number }> =
    {};
  for (const [regime, returns] of Object.entries(regimeReturns)) {
    if (returns.length > 0) {
      const regimeAvg = returns.reduce((a, b) => a + b, 0) / returns.length;
      const regimeStd = Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - regimeAvg, 2), 0) /
          returns.length
      );
      regimePerformance[regime] = {
        return: returns.reduce((a, b) => a + b, 0),
        sharpe:
          regimeStd > 0 ? (regimeAvg * 252) / (regimeStd * Math.sqrt(252)) : 0,
      };
    }
  }

  return {
    totalReturn,
    sharpe,
    sortino,
    calmar,
    maxDrawdown,
    winRate,
    profitFactor,
    trades: trades.length,
    avgHoldingDays,
    equity,
    dailyReturns,
    regimePerformance,
  };
}

function createEmptyResult(): BacktestResult {
  return {
    totalReturn: -1,
    sharpe: -10,
    sortino: -10,
    calmar: -10,
    maxDrawdown: 1,
    winRate: 0,
    profitFactor: 0,
    trades: 0,
    avgHoldingDays: 0,
    equity: [],
    dailyReturns: [],
    regimePerformance: {},
  };
}

function calculateFitness(result: BacktestResult): number {
  if (result.trades < 20) return -1000 + result.trades;
  if (result.maxDrawdown > 0.35) return -500 * result.maxDrawdown;
  return (
    result.sharpe * 25 +
    result.sortino * 15 +
    result.calmar * 20 +
    result.winRate * 15 +
    result.totalReturn * 15 +
    (1 - result.maxDrawdown) * 10 +
    Math.min(result.profitFactor, 3) * 10 +
    Math.min(result.trades / 300, 1) * 5
  );
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadMarketData(
  symbols: string[],
  yearsBack: number = 5
): Promise<Map<string, AlpacaBar[]>> {
  const bars = new Map<string, AlpacaBar[]>();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - yearsBack);
  const start = startDate.toISOString().split("T")[0];
  const end = endDate.toISOString().split("T")[0];

  logger.log(`Loading ${symbols.length} symbols (${start} to ${end})...`);
  let loaded = 0,
    failed = 0;

  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5);
    await Promise.all(
      batch.map(async (symbol) => {
        try {
          const symbolBars = await fetchAlpacaBars(symbol, start, end);
          if (symbolBars.length > 100) {
            bars.set(symbol, symbolBars);
            loaded++;
          } else failed++;
        } catch {
          failed++;
        }
      })
    );
    logger.log(
      `  Progress: ${loaded}/${symbols.length} loaded, ${failed} failed`,
      false
    );
    await new Promise((r) => setTimeout(r, 200));
  }

  logger.log(`Successfully loaded ${bars.size} symbols`);
  return bars;
}

// ============================================================================
// CHECKPOINT MANAGEMENT (Production-specific)
// ============================================================================

function saveCheckpoint(state: OptimizationState): void {
  fs.writeFileSync(
    CHECKPOINT_FILE,
    JSON.stringify(
      {
        generation: state.generation,
        totalEvaluations: state.totalEvaluations,
        globalBest: state.globalBest,
        globalBestResult: state.globalBestResult,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );
  logger.log(`💾 Checkpoint saved at generation ${state.generation}`, false);
}

function saveResults(
  state: OptimizationState,
  learningEngine: ContinuousLearningEngine
): void {
  fs.writeFileSync(
    RESULTS_FILE,
    JSON.stringify(
      {
        summary: {
          totalEvaluations: state.totalEvaluations,
          generations: state.generation,
          runtime: Date.now() - state.startTime.getTime(),
        },
        globalBest: state.globalBest,
        globalBestResult: state.globalBestResult,
        insights: learningEngine.getInsights(),
        bestByRegime: Object.fromEntries(learningEngine.getBestByRegime()),
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );
  logger.log(`📊 Results saved to ${RESULTS_FILE}`);
}

// ============================================================================
// GENETIC OPERATORS
// ============================================================================

function generateRandomGenome(
  generation: number,
  island: number
): ProductionGenome {
  const genes: Record<string, number> = {};
  for (const [param, range] of Object.entries(PARAM_RANGES)) {
    let value =
      range.min +
      Math.floor(Math.random() * ((range.max - range.min) / range.step + 1)) *
        range.step;
    if (range.integer) value = Math.round(value);
    genes[param] = value;
  }
  normalizeWeights(genes);
  return {
    id: `g${generation}-i${island}-${Math.random().toString(36).substr(2, 8)}`,
    genes,
    fitness: 0,
    sharpe: 0,
    sortino: 0,
    calmar: 0,
    winRate: 0,
    totalReturn: 0,
    maxDrawdown: 0,
    trades: 0,
    generation,
    island,
    parentIds: [],
    mutations: [],
    regime: "unknown",
    evaluationTime: 0,
  };
}

function crossover(
  parent1: ProductionGenome,
  parent2: ProductionGenome,
  generation: number,
  island: number
): ProductionGenome {
  const childGenes: Record<string, number> = {};
  for (const param of Object.keys(PARAM_RANGES)) {
    const rand = Math.random();
    if (rand < 0.35) childGenes[param] = parent1.genes[param];
    else if (rand < 0.7) childGenes[param] = parent2.genes[param];
    else {
      const alpha = Math.random();
      let value =
        alpha * parent1.genes[param] + (1 - alpha) * parent2.genes[param];
      const range = PARAM_RANGES[param];
      value = Math.round(value / range.step) * range.step;
      value = Math.max(range.min, Math.min(range.max, value));
      if (range.integer) value = Math.round(value);
      childGenes[param] = value;
    }
  }
  normalizeWeights(childGenes);
  return {
    id: `g${generation}-i${island}-${Math.random().toString(36).substr(2, 8)}`,
    genes: childGenes,
    fitness: 0,
    sharpe: 0,
    sortino: 0,
    calmar: 0,
    winRate: 0,
    totalReturn: 0,
    maxDrawdown: 0,
    trades: 0,
    generation,
    island,
    parentIds: [parent1.id, parent2.id],
    mutations: [],
    regime: "unknown",
    evaluationTime: 0,
  };
}

function mutate(
  genome: ProductionGenome,
  mutationRate: number,
  learningEngine?: ContinuousLearningEngine
): ProductionGenome {
  const mutatedGenes = { ...genome.genes };
  const mutations: string[] = [];
  const suggestions = learningEngine?.suggestGuidedMutation(genome) || {};

  for (const [param, range] of Object.entries(PARAM_RANGES)) {
    if (Math.random() < mutationRate) {
      let newVal: number;
      if (suggestions[param] !== undefined && Math.random() < 0.3) {
        newVal = suggestions[param];
        mutations.push(`${param}: guided`);
      } else {
        newVal =
          mutatedGenes[param] +
          (Math.random() - 0.5) * 2 * (range.max - range.min) * 0.2;
        newVal = Math.max(
          range.min,
          Math.min(range.max, Math.round(newVal / range.step) * range.step)
        );
        if (range.integer) newVal = Math.round(newVal);
        if (newVal !== mutatedGenes[param]) mutations.push(`${param}`);
      }
      mutatedGenes[param] = newVal;
    }
  }
  normalizeWeights(mutatedGenes);
  return {
    ...genome,
    genes: mutatedGenes,
    mutations,
    fitness: 0,
    id: `${genome.id}-m`,
  };
}

// ============================================================================
// MAIN HYPEROPTIMIZER
// ============================================================================

async function runUltraHyperoptimizer() {
  logger.setPhase("Initialization");
  console.log("\n" + "╔" + "═".repeat(78) + "╗");
  console.log(
    "║" +
      " ".repeat(15) +
      "OMAR ULTRA HYPEROPTIMIZER - PRODUCTION" +
      " ".repeat(24) +
      "║"
  );
  console.log("╚" + "═".repeat(78) + "╝\n");

  logger.log(
    `Configuration: ${CONFIG.TOTAL_ITERATIONS.toLocaleString()} iterations, ${CONFIG.POPULATION_SIZE} pop, ${CONFIG.NUM_ISLANDS} islands, ${ALL_SYMBOLS.length} symbols`
  );

  logger.setPhase("Data Loading");
  const bars = await loadMarketData(ALL_SYMBOLS, CONFIG.YEARS_OF_DATA);
  if (bars.size < 10) {
    logger.log("❌ Insufficient data. Aborting.");
    return;
  }

  const tradingSymbols = Array.from(bars.keys());
  const refBars = bars.get("SPY") || bars.values().next().value;
  const startIdx = 60,
    endIdx = refBars.length;
  logger.log(
    `Trading: ${tradingSymbols.length} symbols, ${endIdx - startIdx} days`
  );

  logger.setPhase("Evolution");
  const learningEngine = new ContinuousLearningEngine();
  const judgeSystem = new JudgeSystem();

  const islands: ProductionGenome[][] = [];
  for (let i = 0; i < CONFIG.NUM_ISLANDS; i++) {
    const pop: ProductionGenome[] = [];
    for (let j = 0; j < CONFIG.POPULATION_SIZE / CONFIG.NUM_ISLANDS; j++)
      pop.push(generateRandomGenome(0, i));
    islands.push(pop);
  }

  const state: OptimizationState = {
    generation: 0,
    totalEvaluations: 0,
    globalBest: null,
    globalBestResult: null,
    islands,
    startTime: new Date(),
  };
  const maxGenerations = Math.ceil(
    CONFIG.TOTAL_ITERATIONS / CONFIG.POPULATION_SIZE
  );

  for (let generation = 0; generation < maxGenerations; generation++) {
    state.generation = generation;

    for (let islandIdx = 0; islandIdx < CONFIG.NUM_ISLANDS; islandIdx++) {
      const island = islands[islandIdx];

      for (
        let batchStart = 0;
        batchStart < island.length;
        batchStart += CONFIG.BATCH_SIZE
      ) {
        const batch = island.slice(
          batchStart,
          Math.min(batchStart + CONFIG.BATCH_SIZE, island.length)
        );
        await Promise.all(
          batch.map(async (genome) => {
            if (genome.fitness === 0) {
              const evalStart = Date.now();
              try {
                const result = runBacktest(
                  genome,
                  bars,
                  tradingSymbols,
                  startIdx,
                  endIdx
                );
                genome.fitness = calculateFitness(result);
                genome.sharpe = result.sharpe;
                genome.sortino = result.sortino;
                genome.calmar = result.calmar;
                genome.winRate = result.winRate;
                genome.totalReturn = result.totalReturn;
                genome.maxDrawdown = result.maxDrawdown;
                genome.trades = result.trades;
                genome.evaluationTime = Date.now() - evalStart;
                genome.regime = detectMarketRegime(
                  (bars.get("SPY") || []).slice(0, endIdx).map((b) => b.c),
                  genome.genes.regimeLookback || 50
                );
                state.totalEvaluations++;

                if (
                  !state.globalBest ||
                  genome.fitness > state.globalBest.fitness
                ) {
                  const evaluation = judgeSystem.evaluate(genome, result);
                  if (evaluation.verdict !== "SUSPICIOUS") {
                    state.globalBest = { ...genome };
                    state.globalBestResult = result;
                    logger.logBest(genome, result);
                    evaluation.warnings.forEach((w) =>
                      logger.log(`   ⚠️ ${w}`)
                    );
                  }
                }
              } catch {
                genome.fitness = -10000;
              }
            }
          })
        );
      }

      island.sort((a, b) => b.fitness - a.fitness);
      const newPop: ProductionGenome[] = [];
      for (
        let i = 0;
        i < Math.ceil(CONFIG.ELITE_COUNT / CONFIG.NUM_ISLANDS) &&
        i < island.length;
        i++
      )
        newPop.push({ ...island[i], generation: generation + 1 });
      const avgFitness =
        island.reduce((sum, g) => sum + g.fitness, 0) / island.length;
      const mutationRate = learningEngine.getAdaptiveMutationRate(
        generation,
        avgFitness
      );

      while (newPop.length < island.length) {
        if (Math.random() < CONFIG.CROSSOVER_RATE) {
          const p1 = tournamentSelect(
            island,
            CONFIG.TOURNAMENT_SIZE
          ) as ProductionGenome;
          const p2 = tournamentSelect(
            island,
            CONFIG.TOURNAMENT_SIZE
          ) as ProductionGenome;
          let child = crossover(p1, p2, generation + 1, islandIdx);
          if (Math.random() < mutationRate)
            child = mutate(child, mutationRate, learningEngine);
          newPop.push(child);
        } else {
          const parent = tournamentSelect(
            island,
            CONFIG.TOURNAMENT_SIZE
          ) as ProductionGenome;
          const mutant = mutate(parent, mutationRate * 1.5, learningEngine);
          mutant.generation = generation + 1;
          newPop.push(mutant);
        }
      }
      islands[islandIdx] = newPop;
    }

    if (generation > 0 && generation % CONFIG.MIGRATION_INTERVAL === 0) {
      for (let i = 0; i < CONFIG.NUM_ISLANDS; i++) {
        const target = islands[(i + 1) % CONFIG.NUM_ISLANDS];
        for (
          let j = 0;
          j < CONFIG.MIGRATION_COUNT && j < islands[i].length;
          j++
        )
          target.push({
            ...islands[i][j],
            island: (i + 1) % CONFIG.NUM_ISLANDS,
            fitness: 0,
          });
        target.sort((a, b) => b.fitness - a.fitness);
        target.splice(-CONFIG.MIGRATION_COUNT);
      }
    }

    const allGenomes = islands.flat();
    const insights = learningEngine.analyzePopulation(allGenomes);
    const allFitness = allGenomes.map((g) => g.fitness);

    if (generation % CONFIG.PROGRESS_REPORT_INTERVAL === 0) {
      logger.logProgress(generation + 1, maxGenerations, {
        bestFitness: Math.max(...allFitness),
        avgFitness: allFitness.reduce((a, b) => a + b, 0) / allFitness.length,
        evalRate:
          state.totalEvaluations /
          ((Date.now() - state.startTime.getTime()) / 1000),
      });
      insights.slice(-3).forEach((i) => logger.logInsight(i));
    }

    if (generation > 0 && generation % CONFIG.CHECKPOINT_INTERVAL === 0)
      saveCheckpoint(state);
    if (learningEngine.isConverged() && generation > 100) {
      logger.log(`✅ Converged at generation ${generation}`);
      break;
    }
  }

  logger.setPhase("Final Report");
  console.log("\n" + "═".repeat(80));
  console.log("  HYPEROPTIMIZATION COMPLETE");
  console.log("═".repeat(80));

  if (state.globalBest && state.globalBestResult) {
    logger.log(
      `\n🏆 BEST: Fitness ${state.globalBest.fitness.toFixed(2)}, Sharpe ${state.globalBestResult.sharpe.toFixed(2)}, Return ${(state.globalBestResult.totalReturn * 100).toFixed(1)}%, MaxDD ${(state.globalBestResult.maxDrawdown * 100).toFixed(1)}%`
    );
    logger.log(
      `   Trades: ${state.globalBestResult.trades}, WinRate: ${(state.globalBestResult.winRate * 100).toFixed(1)}%, PF: ${state.globalBestResult.profitFactor.toFixed(2)}`
    );
  }

  logger.log(
    `\nEvaluations: ${state.totalEvaluations.toLocaleString()}, Runtime: ${((Date.now() - state.startTime.getTime()) / 1000).toFixed(1)}s`
  );

  saveResults(state, learningEngine);
  saveCheckpoint(state);
  logger.flush();

  console.log(
    `\n📁 Log: ${LOG_FILE}\n📁 Results: ${RESULTS_FILE}\n📁 Checkpoint: ${CHECKPOINT_FILE}\n`
  );
  return {
    globalBest: state.globalBest,
    globalBestResult: state.globalBestResult,
    totalEvaluations: state.totalEvaluations,
  };
}

runUltraHyperoptimizer().catch((err) => {
  logger.log(`❌ Error: ${err.message}`);
  logger.flush();
  console.error(err);
});
