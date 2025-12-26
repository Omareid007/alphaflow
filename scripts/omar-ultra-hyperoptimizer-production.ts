#!/usr/bin/env npx tsx
/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║     OMAR ULTRA HYPEROPTIMIZER - PRODUCTION EDITION                            ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║  SMART TRACKING | COMPREHENSIVE LOGGING | FULL FUNCTIONAL OUTPUT              ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

import * as fs from 'fs';

// ============================================================================
// CONFIGURATION - PRODUCTION OPTIMIZED
// ============================================================================

const ALPACA_KEY = process.env.ALPACA_API_KEY || '';
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY || '';
const ALPACA_DATA_URL = 'https://data.alpaca.markets';

const LOG_FILE = '/home/runner/workspace/hyperoptimizer_log.txt';
const RESULTS_FILE = '/home/runner/workspace/hyperoptimizer_results.json';
const CHECKPOINT_FILE = '/home/runner/workspace/hyperoptimizer_checkpoint.json';

// Production settings - optimized for quality results in reasonable time
const CONFIG = {
  TOTAL_ITERATIONS: 15000,      // Production run
  BATCH_SIZE: 50,               // Parallel batch size
  PARALLEL_WORKERS: 10,         // Concurrent evaluations

  POPULATION_SIZE: 200,         // Population per generation
  ELITE_COUNT: 20,              // Top performers preserved
  MUTATION_RATE_INITIAL: 0.15,
  CROSSOVER_RATE: 0.7,
  TOURNAMENT_SIZE: 5,

  NUM_ISLANDS: 5,               // Independent populations
  MIGRATION_INTERVAL: 20,       // Migration frequency
  MIGRATION_COUNT: 3,

  CONVERGENCE_THRESHOLD: 0.0005,
  MAX_STAGNANT_GENERATIONS: 50,
  DIVERSITY_INJECTION_THRESHOLD: 0.05,

  CHECKPOINT_INTERVAL: 500,     // Save progress frequently
  PROGRESS_REPORT_INTERVAL: 10, // Report every 10 generations

  YEARS_OF_DATA: 5,             // 5 years historical data
};

// ============================================================================
// SMART LOGGING SYSTEM
// ============================================================================

class SmartLogger {
  private logBuffer: string[] = [];
  private startTime: Date;
  private phaseStartTime: Date;
  private currentPhase: string = 'Initialization';

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
    if (this.currentPhase !== 'Initialization') {
      this.log(`✓ Phase "${this.currentPhase}" completed in ${elapsed}`);
    }
    this.currentPhase = phase;
    this.phaseStartTime = new Date();
    this.log(`\n▶ STARTING PHASE: ${phase}`);
    this.log('─'.repeat(70));
  }

  log(message: string, toConsole: boolean = true): void {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logLine = `[${timestamp}] ${message}`;
    this.logBuffer.push(logLine);

    if (toConsole) {
      console.log(message);
    }

    // Flush to file periodically
    if (this.logBuffer.length >= 10) {
      this.flush();
    }
  }

  logProgress(generation: number, totalGens: number, metrics: Record<string, any>): void {
    const pct = ((generation / totalGens) * 100).toFixed(1);
    const bar = this.progressBar(generation, totalGens, 30);
    const elapsed = this.getElapsed(this.startTime);
    const rate = metrics.evalRate?.toFixed(1) || '0';

    const line = `Gen ${generation.toString().padStart(4)}/${totalGens} ${bar} ${pct}% | ` +
                 `Best: ${metrics.bestFitness?.toFixed(2) || 'N/A'} | ` +
                 `Avg: ${metrics.avgFitness?.toFixed(2) || 'N/A'} | ` +
                 `Rate: ${rate}/s | ${elapsed}`;

    this.log(line);
  }

  logBest(genome: any, result: any): void {
    this.log('\n' + '═'.repeat(70));
    this.log('🏆 NEW GLOBAL BEST CONFIGURATION FOUND');
    this.log('═'.repeat(70));
    this.log(`   Fitness Score:    ${genome.fitness.toFixed(4)}`);
    this.log(`   Sharpe Ratio:     ${result.sharpe.toFixed(4)}`);
    this.log(`   Sortino Ratio:    ${result.sortino.toFixed(4)}`);
    this.log(`   Calmar Ratio:     ${result.calmar.toFixed(4)}`);
    this.log(`   Total Return:     ${(result.totalReturn * 100).toFixed(2)}%`);
    this.log(`   Max Drawdown:     ${(result.maxDrawdown * 100).toFixed(2)}%`);
    this.log(`   Win Rate:         ${(result.winRate * 100).toFixed(1)}%`);
    this.log(`   Profit Factor:    ${result.profitFactor.toFixed(2)}`);
    this.log(`   Total Trades:     ${result.trades}`);
    this.log(`   Generation:       ${genome.generation}`);
    this.log(`   Island:           ${genome.island}`);
    this.log('═'.repeat(70) + '\n');
  }

  logInsight(insight: any): void {
    this.log(`   💡 Insight: ${insight.pattern} (correlation: ${insight.correlation.toFixed(3)})`);
  }

  private progressBar(current: number, total: number, width: number): string {
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
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
      fs.appendFileSync(LOG_FILE, this.logBuffer.join('\n') + '\n');
      this.logBuffer = [];
    }
  }

  getLogPath(): string {
    return LOG_FILE;
  }
}

const logger = new SmartLogger();

// ============================================================================
// MARKET UNIVERSE - PRODUCTION SYMBOLS
// ============================================================================

const MARKET_UNIVERSE = {
  PRECIOUS_METALS: ['GLD', 'SLV', 'IAU', 'PPLT'],
  METAL_MINERS: ['NEM', 'GOLD', 'FCX', 'AEM', 'WPM'],
  ENERGY: ['XLE', 'XOM', 'CVX', 'COP', 'USO'],
  SECTORS: ['XLF', 'XLK', 'XLV', 'XLI', 'XLP', 'XLY', 'XLB', 'XLU'],
  LARGE_CAP: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'UNH'],
  INDICES: ['SPY', 'QQQ', 'IWM', 'DIA'],
  BONDS: ['TLT', 'LQD', 'HYG'],
  INTERNATIONAL: ['EFA', 'EEM', 'VEU'],
};

const ALL_SYMBOLS = Object.values(MARKET_UNIVERSE).flat();

// ============================================================================
// PARAMETER RANGES
// ============================================================================

const PARAM_RANGES: Record<string, { min: number; max: number; step: number; integer?: boolean }> = {
  maxPositionPct: { min: 0.02, max: 0.15, step: 0.01 },
  maxPortfolioExposure: { min: 0.4, max: 0.95, step: 0.05 },
  maxPositions: { min: 5, max: 30, step: 1, integer: true },
  atrMultStop: { min: 0.5, max: 3.0, step: 0.1 },
  atrMultTarget: { min: 1.5, max: 6.0, step: 0.25 },
  maxDailyLoss: { min: 0.02, max: 0.08, step: 0.01 },
  buyThreshold: { min: 0.05, max: 0.25, step: 0.01 },
  confidenceMin: { min: 0.15, max: 0.45, step: 0.02 },
  technicalWeight: { min: 0.05, max: 0.35, step: 0.02 },
  momentumWeight: { min: 0.05, max: 0.35, step: 0.02 },
  volatilityWeight: { min: 0.02, max: 0.20, step: 0.02 },
  volumeWeight: { min: 0.05, max: 0.25, step: 0.02 },
  sentimentWeight: { min: 0.05, max: 0.25, step: 0.02 },
  patternWeight: { min: 0.02, max: 0.20, step: 0.02 },
  breadthWeight: { min: 0.02, max: 0.15, step: 0.02 },
  correlationWeight: { min: 0.02, max: 0.20, step: 0.02 },
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
// DATA STRUCTURES
// ============================================================================

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface Genome {
  id: string;
  genes: Record<string, number>;
  fitness: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  trades: number;
  generation: number;
  island: number;
  parentIds: string[];
  mutations: string[];
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

interface LearningInsight {
  pattern: string;
  correlation: number;
  sampleSize: number;
  avgImprovement: number;
  confidence: number;
  timestamp: Date;
}

interface OptimizationState {
  generation: number;
  totalEvaluations: number;
  globalBest: Genome | null;
  globalBestResult: BacktestResult | null;
  islands: Genome[][];
  startTime: Date;
  lastCheckpoint: Date;
}

// ============================================================================
// CONTINUOUS LEARNING ENGINE
// ============================================================================

class ContinuousLearningEngine {
  private insights: LearningInsight[] = [];
  private parameterCorrelations: Map<string, number> = new Map();
  private regimePatterns: Map<string, Genome[]> = new Map();
  private convergenceHistory: number[] = [];
  private bestByRegime: Map<string, Genome> = new Map();

  analyzePopulation(population: Genome[]): LearningInsight[] {
    const newInsights: LearningInsight[] = [];
    const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
    const top10Pct = sorted.slice(0, Math.ceil(sorted.length * 0.1));
    const bottom10Pct = sorted.slice(-Math.ceil(sorted.length * 0.1));

    for (const param of Object.keys(PARAM_RANGES)) {
      const topAvg = top10Pct.reduce((sum, g) => sum + (g.genes[param] || 0), 0) / top10Pct.length;
      const bottomAvg = bottom10Pct.reduce((sum, g) => sum + (g.genes[param] || 0), 0) / bottom10Pct.length;
      const allAvg = population.reduce((sum, g) => sum + (g.genes[param] || 0), 0) / population.length;

      const diff = allAvg !== 0 ? (topAvg - bottomAvg) / allAvg : 0;
      this.parameterCorrelations.set(param, diff);

      if (Math.abs(diff) > 0.15) {
        newInsights.push({
          pattern: `${param} ${diff > 0 ? 'higher' : 'lower'} in top performers`,
          correlation: diff,
          sampleSize: top10Pct.length,
          avgImprovement: top10Pct[0].fitness - (bottom10Pct[bottom10Pct.length - 1]?.fitness || 0),
          confidence: Math.min(1, Math.abs(diff) * top10Pct.length / 20),
          timestamp: new Date(),
        });
      }
    }

    for (const genome of top10Pct) {
      const regime = genome.regime || 'unknown';
      if (!this.regimePatterns.has(regime)) {
        this.regimePatterns.set(regime, []);
      }
      this.regimePatterns.get(regime)!.push(genome);

      const currentBest = this.bestByRegime.get(regime);
      if (!currentBest || genome.fitness > currentBest.fitness) {
        this.bestByRegime.set(regime, genome);
      }
    }

    this.insights.push(...newInsights);
    return newInsights;
  }

  getAdaptiveMutationRate(generation: number, avgFitness: number): number {
    this.convergenceHistory.push(avgFitness);
    if (this.convergenceHistory.length < 10) return CONFIG.MUTATION_RATE_INITIAL;

    const recent = this.convergenceHistory.slice(-10);
    const improvement = (recent[9] - recent[0]) / Math.abs(recent[0] || 1);

    if (Math.abs(improvement) < CONFIG.CONVERGENCE_THRESHOLD) {
      return Math.min(CONFIG.MUTATION_RATE_INITIAL * 2.5, 0.4);
    }
    if (improvement > 0.05) {
      return Math.max(CONFIG.MUTATION_RATE_INITIAL * 0.6, 0.06);
    }
    return CONFIG.MUTATION_RATE_INITIAL;
  }

  suggestGuidedMutation(genome: Genome): Record<string, number> {
    const suggestions: Record<string, number> = {};
    for (const [param, correlation] of this.parameterCorrelations) {
      if (Math.abs(correlation) > 0.2) {
        const range = PARAM_RANGES[param];
        if (!range) continue;
        const direction = correlation > 0 ? 1 : -1;
        const currentVal = genome.genes[param] || range.min;
        const nudge = direction * range.step * 2;
        suggestions[param] = Math.max(range.min, Math.min(range.max, currentVal + nudge));
      }
    }
    return suggestions;
  }

  getInsights(): LearningInsight[] { return this.insights.slice(-50); }
  getBestByRegime(): Map<string, Genome> { return this.bestByRegime; }

  isConverged(): boolean {
    if (this.convergenceHistory.length < 30) return false;
    const recent = this.convergenceHistory.slice(-30);
    const variance = recent.reduce((sum, val) => {
      const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
      return sum + Math.pow(val - mean, 2);
    }, 0) / recent.length;
    return variance < CONFIG.CONVERGENCE_THRESHOLD;
  }
}

// ============================================================================
// JUDGE SYSTEM
// ============================================================================

class JudgeSystem {
  private evaluationHistory: { fitness: number; verdict: string; timestamp: Date }[] = [];

  evaluate(genome: Genome, result: BacktestResult): {
    verdict: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'SUSPICIOUS';
    confidence: number;
    warnings: string[];
    suggestions: string[];
    score: number;
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 0;

    score += Math.min(result.sharpe, 3) * 20;
    score += Math.min(result.sortino, 4) * 10;
    score += Math.min(result.calmar, 3) * 15;
    score += result.winRate * 20;
    score += Math.min(result.totalReturn * 2, 40);
    score += (1 - result.maxDrawdown) * 30;
    score += Math.min(result.trades / 500, 1) * 10;
    score += Math.min(result.profitFactor, 3) * 15;

    if (result.maxDrawdown > 0.25) {
      score -= (result.maxDrawdown - 0.25) * 100;
      warnings.push(`High drawdown: ${(result.maxDrawdown * 100).toFixed(1)}%`);
      suggestions.push(`Reduce maxPositionPct or increase atrMultStop`);
    }

    if (result.trades < 30) {
      score -= (30 - result.trades) * 2;
      warnings.push(`Low trade count: ${result.trades}`);
      suggestions.push(`Lower buyThreshold or confidenceMin`);
    }

    if (result.winRate < 0.35) {
      score -= (0.35 - result.winRate) * 50;
      warnings.push(`Low win rate: ${(result.winRate * 100).toFixed(1)}%`);
    }

    if (result.sharpe > 4) {
      score -= 30;
      warnings.push('OVERFITTING WARNING: Sharpe > 4 is suspicious');
    }

    if (result.winRate > 0.85 && result.trades > 50) {
      score -= 20;
      warnings.push('OVERFITTING WARNING: Win rate > 85% with many trades');
    }

    let verdict: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'SUSPICIOUS';
    if (score > 180 && warnings.filter(w => w.includes('OVERFITTING')).length === 0) {
      verdict = 'EXCELLENT';
    } else if (score > 140) {
      verdict = warnings.filter(w => w.includes('OVERFITTING')).length > 0 ? 'SUSPICIOUS' : 'GOOD';
    } else if (score > 90) {
      verdict = 'ACCEPTABLE';
    } else {
      verdict = 'POOR';
    }

    const confidence = Math.min(1, Math.max(0, score / 220));
    this.evaluationHistory.push({ fitness: score, verdict, timestamp: new Date() });

    return { verdict, confidence, warnings, suggestions, score };
  }
}

// ============================================================================
// TECHNICAL INDICATORS
// ============================================================================

function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    result[i] = i >= period - 1 ? sum / period : NaN;
  }
  return result;
}

function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length);
  const mult = 2 / (period + 1);
  result[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    result[i] = (data[i] - result[i - 1]) * mult + result[i - 1];
  }
  return result;
}

function calculateRSI(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return result;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  const tr: number[] = new Array(closes.length);

  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < closes.length; i++) {
    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }

  let atr = 0;
  for (let i = 0; i < period && i < tr.length; i++) atr += tr[i];
  atr /= period;
  if (period - 1 < result.length) result[period - 1] = atr;

  for (let i = period; i < closes.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    result[i] = atr;
  }
  return result;
}

function calculateMACD(closes: number[], fast: number, slow: number, signal: number) {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  const macd = emaFast.map((f, i) => f - emaSlow[i]);
  const signalLine = calculateEMA(macd.slice(slow - 1), signal);
  const histogram = macd.slice(slow - 1).map((m, i) => m - (signalLine[i] || 0));
  return { macd, signalLine, histogram };
}

function calculateBollingerBands(closes: number[], period: number, stdDev: number) {
  const middle = calculateSMA(closes, period);
  const upper: number[] = new Array(closes.length);
  const lower: number[] = new Array(closes.length);

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    upper[i] = mean + stdDev * std;
    lower[i] = mean - stdDev * std;
  }
  return { upper, middle, lower };
}

// ============================================================================
// REGIME DETECTION
// ============================================================================

function detectMarketRegime(closes: number[], lookback: number = 50): string {
  if (closes.length < lookback + 50) return 'unknown';

  const recent = closes.slice(-lookback);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);

  const current = closes[closes.length - 1];
  const sma20Current = sma20[sma20.length - 1];
  const sma50Current = sma50[sma50.length - 1];

  const returns: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    returns.push((recent[i] - recent[i - 1]) / recent[i - 1]);
  }
  const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) * Math.sqrt(252);
  const momentum = (current - closes[closes.length - lookback]) / closes[closes.length - lookback];

  if (momentum > 0.1 && current > sma20Current && sma20Current > sma50Current) {
    return volatility > 0.25 ? 'volatile_bull' : 'strong_bull';
  }
  if (momentum < -0.1 && current < sma20Current && sma20Current < sma50Current) {
    return volatility > 0.25 ? 'volatile_bear' : 'strong_bear';
  }
  if (volatility > 0.30) return 'high_volatility';
  if (Math.abs(momentum) < 0.03) return 'ranging';
  return momentum > 0 ? 'mild_bull' : 'mild_bear';
}

// ============================================================================
// GENETIC OPERATORS
// ============================================================================

function generateRandomGenome(generation: number, island: number): Genome {
  const genes: Record<string, number> = {};

  for (const [param, range] of Object.entries(PARAM_RANGES)) {
    const steps = Math.floor((range.max - range.min) / range.step);
    const randomStep = Math.floor(Math.random() * (steps + 1));
    let value = range.min + randomStep * range.step;
    if (range.integer) value = Math.round(value);
    genes[param] = value;
  }

  normalizeWeights(genes);

  return {
    id: `g${generation}-i${island}-${Math.random().toString(36).substr(2, 8)}`,
    genes,
    fitness: 0, sharpe: 0, sortino: 0, calmar: 0, winRate: 0,
    totalReturn: 0, maxDrawdown: 0, trades: 0,
    generation, island, parentIds: [], mutations: [],
    regime: 'unknown', evaluationTime: 0,
  };
}

function normalizeWeights(genes: Record<string, number>): void {
  const weightKeys = [
    'technicalWeight', 'momentumWeight', 'volatilityWeight', 'volumeWeight',
    'sentimentWeight', 'patternWeight', 'breadthWeight', 'correlationWeight',
  ];
  const total = weightKeys.reduce((sum, key) => sum + (genes[key] || 0), 0);
  if (total > 0) {
    for (const key of weightKeys) {
      genes[key] = Math.round((genes[key] / total) * 100) / 100;
    }
  }
}

function crossover(parent1: Genome, parent2: Genome, generation: number, island: number): Genome {
  const childGenes: Record<string, number> = {};

  for (const param of Object.keys(PARAM_RANGES)) {
    const rand = Math.random();
    if (rand < 0.35) {
      childGenes[param] = parent1.genes[param];
    } else if (rand < 0.70) {
      childGenes[param] = parent2.genes[param];
    } else {
      const alpha = Math.random();
      let value = alpha * parent1.genes[param] + (1 - alpha) * parent2.genes[param];
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
    fitness: 0, sharpe: 0, sortino: 0, calmar: 0, winRate: 0,
    totalReturn: 0, maxDrawdown: 0, trades: 0,
    generation, island, parentIds: [parent1.id, parent2.id], mutations: [],
    regime: 'unknown', evaluationTime: 0,
  };
}

function mutate(genome: Genome, mutationRate: number, learningEngine?: ContinuousLearningEngine): Genome {
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
        const sigma = (range.max - range.min) * 0.2;
        newVal = mutatedGenes[param] + (Math.random() - 0.5) * 2 * sigma;
        newVal = Math.max(range.min, Math.min(range.max, newVal));
        newVal = Math.round(newVal / range.step) * range.step;
        if (range.integer) newVal = Math.round(newVal);
        if (newVal !== mutatedGenes[param]) {
          mutations.push(`${param}`);
        }
      }
      mutatedGenes[param] = newVal;
    }
  }

  normalizeWeights(mutatedGenes);
  return { ...genome, genes: mutatedGenes, mutations, fitness: 0, id: `${genome.id}-m` };
}

function tournamentSelect(population: Genome[], tournamentSize: number): Genome {
  let best: Genome | null = null;
  for (let i = 0; i < tournamentSize; i++) {
    const candidate = population[Math.floor(Math.random() * population.length)];
    if (!best || candidate.fitness > best.fitness) best = candidate;
  }
  return best!;
}

// ============================================================================
// SIGNAL GENERATION
// ============================================================================

function generateSignal(bars: AlpacaBar[], genes: Record<string, number>, idx: number): { score: number; confidence: number } {
  if (idx < 60) return { score: 0, confidence: 0 };

  const closes = bars.slice(0, idx + 1).map(b => b.c);
  const highs = bars.slice(0, idx + 1).map(b => b.h);
  const lows = bars.slice(0, idx + 1).map(b => b.l);
  const volumes = bars.slice(0, idx + 1).map(b => b.v);

  const factors: Record<string, number> = {};

  // RSI
  const rsi = calculateRSI(closes, genes.rsiPeriod || 14);
  const currentRSI = rsi[rsi.length - 1];
  if (!isNaN(currentRSI)) {
    if (currentRSI < (genes.rsiOversold || 30)) factors.technical = 0.8;
    else if (currentRSI > (genes.rsiOverbought || 70)) factors.technical = -0.8;
    else factors.technical = (50 - currentRSI) / 50;
  } else {
    factors.technical = 0;
  }

  // MACD
  const macd = calculateMACD(closes, genes.macdFast || 12, genes.macdSlow || 26, genes.macdSignal || 9);
  if (macd.histogram.length > 1) {
    const histCurrent = macd.histogram[macd.histogram.length - 1];
    const histPrev = macd.histogram[macd.histogram.length - 2];
    factors.technical += histCurrent > histPrev ? 0.3 : -0.3;
  }
  factors.technical = Math.max(-1, Math.min(1, factors.technical));

  // Momentum
  const momShort = genes.momentumShort || 5;
  const momMed = genes.momentumMedium || 20;
  if (closes.length > momMed) {
    const momShortVal = (closes[closes.length - 1] - closes[closes.length - momShort - 1]) / closes[closes.length - momShort - 1];
    const momMedVal = (closes[closes.length - 1] - closes[closes.length - momMed - 1]) / closes[closes.length - momMed - 1];
    factors.momentum = Math.max(-1, Math.min(1, momShortVal * 10 + momMedVal * 5));
  } else {
    factors.momentum = 0;
  }

  // Volatility
  const atr = calculateATR(highs, lows, closes, genes.atrPeriod || 14);
  const currentATR = atr[atr.length - 1];
  if (!isNaN(currentATR)) {
    const atrPct = currentATR / closes[closes.length - 1];
    factors.volatility = Math.max(-1, Math.min(1, 0.5 - atrPct * 20));
  } else {
    factors.volatility = 0;
  }

  // Volume
  const volLookback = 20;
  if (volumes.length > volLookback) {
    const avgVol = volumes.slice(-volLookback - 1, -1).reduce((a, b) => a + b, 0) / volLookback;
    const volRatio = volumes[volumes.length - 1] / avgVol;
    factors.volume = Math.max(-1, Math.min(1, (volRatio - 1) * 0.5));
  } else {
    factors.volume = 0;
  }

  // Sentiment
  const recentReturn = closes.length > 5 ? (closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6] : 0;
  factors.sentiment = Math.max(-1, Math.min(1, recentReturn * 10));

  // Pattern
  const bb = calculateBollingerBands(closes, genes.bbPeriod || 20, genes.bbStdDev || 2);
  const current = closes[closes.length - 1];
  const bbUpper = bb.upper[bb.upper.length - 1];
  const bbLower = bb.lower[bb.lower.length - 1];
  if (bbUpper && bbLower) {
    if (current < bbLower) factors.pattern = 0.6;
    else if (current > bbUpper) factors.pattern = -0.6;
    else factors.pattern = 0;
  } else {
    factors.pattern = 0;
  }

  // Breadth
  const smaShort = calculateSMA(closes, genes.smaShort || 10);
  const smaMed = calculateSMA(closes, genes.smaMedium || 50);
  const shortMA = smaShort[smaShort.length - 1];
  const medMA = smaMed[smaMed.length - 1];
  if (!isNaN(shortMA) && !isNaN(medMA)) {
    factors.breadth = (current > shortMA ? 0.5 : -0.5) + (current > medMA ? 0.5 : -0.5);
    factors.breadth = Math.max(-1, Math.min(1, factors.breadth));
  } else {
    factors.breadth = 0;
  }

  // Correlation
  if (bb.middle && !isNaN(bb.middle[bb.middle.length - 1])) {
    const deviation = (current - bb.middle[bb.middle.length - 1]) / ((bbUpper - bb.middle[bb.middle.length - 1]) || 1);
    factors.correlation = Math.max(-1, Math.min(1, -deviation * 0.5));
  } else {
    factors.correlation = 0;
  }

  // Weighted score
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
  const positiveFactors = factorValues.filter(f => f > 0.2).length;
  const negativeFactors = factorValues.filter(f => f < -0.2).length;
  const agreement = Math.max(positiveFactors, negativeFactors) / factorValues.length;
  const confidence = agreement * Math.abs(score);

  return { score, confidence };
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

function runBacktest(genome: Genome, barsMap: Map<string, AlpacaBar[]>, symbols: string[], startIdx: number, endIdx: number): BacktestResult {
  const genes = genome.genes;
  const initialCapital = 100000;
  let capital = initialCapital;
  let peakCapital = capital;

  const equity: number[] = [capital];
  const dailyReturns: number[] = [];
  const trades: { pnl: number; holdingDays: number }[] = [];
  const positions: Map<string, { entry: number; shares: number; entryIdx: number; stopLoss: number; takeProfit: number }> = new Map();
  const regimeReturns: Record<string, number[]> = {};

  const refBars = barsMap.get('SPY') || barsMap.values().next().value;
  if (!refBars || refBars.length < endIdx) {
    return createEmptyResult();
  }

  for (let idx = startIdx; idx < Math.min(endIdx, refBars.length); idx++) {
    const refCloses = refBars.slice(0, idx + 1).map(b => b.c);
    const regime = detectMarketRegime(refCloses, genes.regimeLookback || 50);
    if (!regimeReturns[regime]) regimeReturns[regime] = [];

    // Check exits
    for (const [symbol, pos] of positions) {
      const symbolBars = barsMap.get(symbol);
      if (!symbolBars || idx >= symbolBars.length) continue;

      const bar = symbolBars[idx];
      let exitPrice: number | null = null;

      if (bar.l <= pos.stopLoss) exitPrice = pos.stopLoss;
      else if (bar.h >= pos.takeProfit) exitPrice = pos.takeProfit;

      if (exitPrice) {
        const pnl = (exitPrice - pos.entry) * pos.shares;
        capital += pos.shares * exitPrice;
        trades.push({ pnl, holdingDays: idx - pos.entryIdx });
        positions.delete(symbol);
      }
    }

    // Check entries
    if (positions.size < (genes.maxPositions || 20)) {
      const candidates: { symbol: string; score: number; price: number; atr: number }[] = [];

      for (const symbol of symbols) {
        if (positions.has(symbol)) continue;

        const symbolBars = barsMap.get(symbol);
        if (!symbolBars || idx >= symbolBars.length || idx < 60) continue;

        const signal = generateSignal(symbolBars, genes, idx);

        if (signal.score >= (genes.buyThreshold || 0.12) && signal.confidence >= (genes.confidenceMin || 0.28)) {
          const closes = symbolBars.slice(0, idx + 1).map(b => b.c);
          const highs = symbolBars.slice(0, idx + 1).map(b => b.h);
          const lows = symbolBars.slice(0, idx + 1).map(b => b.l);
          const atr = calculateATR(highs, lows, closes, genes.atrPeriod || 14);
          const currentATR = atr[atr.length - 1];

          if (!isNaN(currentATR)) {
            candidates.push({ symbol, score: signal.score, price: symbolBars[idx].c, atr: currentATR });
          }
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      for (const candidate of candidates.slice(0, (genes.maxPositions || 20) - positions.size)) {
        const maxPositionSize = capital * (genes.maxPositionPct || 0.05);
        const shares = Math.floor(maxPositionSize / candidate.price);

        if (shares > 0 && shares * candidate.price <= capital) {
          const stopLoss = candidate.price - candidate.atr * (genes.atrMultStop || 1.5);
          const takeProfit = candidate.price + candidate.atr * (genes.atrMultTarget || 4);
          positions.set(candidate.symbol, { entry: candidate.price, shares, entryIdx: idx, stopLoss, takeProfit });
          capital -= shares * candidate.price;
        }
      }
    }

    // Update equity
    let currentEquity = capital;
    for (const [symbol, pos] of positions) {
      const symbolBars = barsMap.get(symbol);
      if (symbolBars && idx < symbolBars.length) {
        currentEquity += pos.shares * symbolBars[idx].c;
      }
    }

    equity.push(currentEquity);
    peakCapital = Math.max(peakCapital, currentEquity);

    if (equity.length > 1) {
      const dailyReturn = (currentEquity - equity[equity.length - 2]) / equity[equity.length - 2];
      dailyReturns.push(dailyReturn);
      regimeReturns[regime]?.push(dailyReturn);
    }
  }

  // Close remaining positions
  for (const [symbol, pos] of positions) {
    const symbolBars = barsMap.get(symbol);
    if (symbolBars && symbolBars.length > 0) {
      const lastPrice = symbolBars[Math.min(endIdx - 1, symbolBars.length - 1)].c;
      const pnl = (lastPrice - pos.entry) * pos.shares;
      trades.push({ pnl, holdingDays: endIdx - pos.entryIdx });
    }
  }

  // Calculate metrics
  const finalEquity = equity[equity.length - 1];
  const totalReturn = (finalEquity - initialCapital) / initialCapital;

  let maxDrawdown = 0;
  let peak = equity[0];
  for (const val of equity) {
    if (val > peak) peak = val;
    const dd = (peak - val) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const stdReturn = dailyReturns.length > 1
    ? Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length)
    : 1;

  const sharpe = stdReturn > 0 ? (avgReturn * 252) / (stdReturn * Math.sqrt(252)) : 0;
  const negReturns = dailyReturns.filter(r => r < 0);
  const downStd = negReturns.length > 0
    ? Math.sqrt(negReturns.reduce((sum, r) => sum + r * r, 0) / negReturns.length)
    : 1;
  const sortino = downStd > 0 ? (avgReturn * 252) / (downStd * Math.sqrt(252)) : 0;

  const years = dailyReturns.length / 252;
  const cagr = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
  const calmar = maxDrawdown > 0 ? cagr / maxDrawdown : 0;

  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const avgHoldingDays = trades.length > 0 ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length : 0;

  const regimePerformance: Record<string, { return: number; sharpe: number }> = {};
  for (const [regime, returns] of Object.entries(regimeReturns)) {
    if (returns.length > 0) {
      const regimeAvg = returns.reduce((a, b) => a + b, 0) / returns.length;
      const regimeStd = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - regimeAvg, 2), 0) / returns.length);
      regimePerformance[regime] = {
        return: returns.reduce((a, b) => a + b, 0),
        sharpe: regimeStd > 0 ? (regimeAvg * 252) / (regimeStd * Math.sqrt(252)) : 0,
      };
    }
  }

  return { totalReturn, sharpe, sortino, calmar, maxDrawdown, winRate, profitFactor, trades: trades.length, avgHoldingDays, equity, dailyReturns, regimePerformance };
}

function createEmptyResult(): BacktestResult {
  return { totalReturn: -1, sharpe: -10, sortino: -10, calmar: -10, maxDrawdown: 1, winRate: 0, profitFactor: 0, trades: 0, avgHoldingDays: 0, equity: [], dailyReturns: [], regimePerformance: {} };
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

async function fetchAlpacaBars(symbol: string, start: string, end: string): Promise<AlpacaBar[]> {
  const allBars: AlpacaBar[] = [];
  let pageToken: string | null = null;

  do {
    let url = `${ALPACA_DATA_URL}/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=10000&feed=iex`;
    if (pageToken) url += `&page_token=${pageToken}`;

    try {
      const response = await fetch(url, {
        headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET },
      });

      if (!response.ok) return allBars;

      const data = await response.json();
      if (data.bars && Array.isArray(data.bars)) {
        allBars.push(...data.bars);
      }
      pageToken = data.next_page_token || null;
    } catch {
      break;
    }
  } while (pageToken);

  return allBars;
}

async function loadMarketData(symbols: string[], yearsBack: number = 5): Promise<Map<string, AlpacaBar[]>> {
  const bars = new Map<string, AlpacaBar[]>();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - yearsBack);

  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];

  logger.log(`Loading ${symbols.length} symbols (${start} to ${end})...`);

  let loaded = 0;
  let failed = 0;
  const batchSize = 5;

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);

    await Promise.all(batch.map(async (symbol) => {
      try {
        const symbolBars = await fetchAlpacaBars(symbol, start, end);
        if (symbolBars.length > 100) {
          bars.set(symbol, symbolBars);
          loaded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }));

    logger.log(`  Progress: ${loaded}/${symbols.length} loaded, ${failed} failed`, false);
    await new Promise(r => setTimeout(r, 200));
  }

  logger.log(`Successfully loaded ${bars.size} symbols with ${bars.get('SPY')?.length || 0} trading days`);
  return bars;
}

// ============================================================================
// CHECKPOINT MANAGEMENT
// ============================================================================

function saveCheckpoint(state: OptimizationState): void {
  const checkpoint = {
    generation: state.generation,
    totalEvaluations: state.totalEvaluations,
    globalBest: state.globalBest,
    globalBestResult: state.globalBestResult,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
  logger.log(`💾 Checkpoint saved at generation ${state.generation}`, false);
}

function saveResults(state: OptimizationState, learningEngine: ContinuousLearningEngine): void {
  const results = {
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
  };
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  logger.log(`📊 Results saved to ${RESULTS_FILE}`);
}

// ============================================================================
// MAIN HYPEROPTIMIZER
// ============================================================================

async function runUltraHyperoptimizer() {
  logger.setPhase('Initialization');

  console.log('\n' + '╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(15) + 'OMAR ULTRA HYPEROPTIMIZER - PRODUCTION' + ' '.repeat(24) + '║');
  console.log('╚' + '═'.repeat(78) + '╝\n');

  logger.log(`Configuration:`);
  logger.log(`  ├─ Target Iterations: ${CONFIG.TOTAL_ITERATIONS.toLocaleString()}`);
  logger.log(`  ├─ Population Size: ${CONFIG.POPULATION_SIZE}`);
  logger.log(`  ├─ Islands: ${CONFIG.NUM_ISLANDS}`);
  logger.log(`  ├─ Batch Size: ${CONFIG.BATCH_SIZE}`);
  logger.log(`  ├─ Market Universe: ${ALL_SYMBOLS.length} symbols`);
  logger.log(`  └─ Historical Data: ${CONFIG.YEARS_OF_DATA} years`);

  logger.setPhase('Data Loading');
  const bars = await loadMarketData(ALL_SYMBOLS, CONFIG.YEARS_OF_DATA);

  if (bars.size < 10) {
    logger.log('❌ Insufficient data loaded. Aborting.');
    return;
  }

  const tradingSymbols = Array.from(bars.keys());
  const refBars = bars.get('SPY') || bars.values().next().value;
  const startIdx = 60;
  const endIdx = refBars.length;

  logger.log(`Trading symbols: ${tradingSymbols.length}`);
  logger.log(`Trading days: ${endIdx - startIdx}`);

  logger.setPhase('Population Initialization');
  const learningEngine = new ContinuousLearningEngine();
  const judgeSystem = new JudgeSystem();

  const islands: Genome[][] = [];
  for (let i = 0; i < CONFIG.NUM_ISLANDS; i++) {
    const population: Genome[] = [];
    for (let j = 0; j < CONFIG.POPULATION_SIZE / CONFIG.NUM_ISLANDS; j++) {
      population.push(generateRandomGenome(0, i));
    }
    islands.push(population);
  }

  const state: OptimizationState = {
    generation: 0,
    totalEvaluations: 0,
    globalBest: null,
    globalBestResult: null,
    islands,
    startTime: new Date(),
    lastCheckpoint: new Date(),
  };

  const iterationsPerGeneration = CONFIG.POPULATION_SIZE;
  const maxGenerations = Math.ceil(CONFIG.TOTAL_ITERATIONS / iterationsPerGeneration);

  logger.log(`Initialized ${CONFIG.NUM_ISLANDS} islands with ${CONFIG.POPULATION_SIZE / CONFIG.NUM_ISLANDS} genomes each`);
  logger.log(`Target: ${maxGenerations} generations`);

  logger.setPhase('Evolution');
  logger.log('Starting genetic optimization...\n');

  for (let generation = 0; generation < maxGenerations; generation++) {
    state.generation = generation;
    const genStartTime = Date.now();

    // Process each island
    for (let islandIdx = 0; islandIdx < CONFIG.NUM_ISLANDS; islandIdx++) {
      const island = islands[islandIdx];

      // Evaluate in batches
      for (let batchStart = 0; batchStart < island.length; batchStart += CONFIG.BATCH_SIZE) {
        const batch = island.slice(batchStart, Math.min(batchStart + CONFIG.BATCH_SIZE, island.length));

        await Promise.all(batch.map(async (genome) => {
          if (genome.fitness === 0) {
            const evalStart = Date.now();
            try {
              const result = runBacktest(genome, bars, tradingSymbols, startIdx, endIdx);
              const fitness = calculateFitness(result);

              genome.fitness = fitness;
              genome.sharpe = result.sharpe;
              genome.sortino = result.sortino;
              genome.calmar = result.calmar;
              genome.winRate = result.winRate;
              genome.totalReturn = result.totalReturn;
              genome.maxDrawdown = result.maxDrawdown;
              genome.trades = result.trades;
              genome.evaluationTime = Date.now() - evalStart;
              genome.regime = detectMarketRegime(
                (bars.get('SPY') || []).slice(0, endIdx).map(b => b.c),
                genome.genes.regimeLookback || 50
              );

              state.totalEvaluations++;

              // Check for new global best
              if (!state.globalBest || fitness > state.globalBest.fitness) {
                const evaluation = judgeSystem.evaluate(genome, result);

                if (evaluation.verdict !== 'SUSPICIOUS') {
                  state.globalBest = { ...genome };
                  state.globalBestResult = result;
                  logger.logBest(genome, result);

                  if (evaluation.warnings.length > 0) {
                    for (const warning of evaluation.warnings) {
                      logger.log(`   ⚠️ ${warning}`);
                    }
                  }
                }
              }
            } catch {
              genome.fitness = -10000;
            }
          }
        }));
      }

      // Sort and create next generation
      island.sort((a, b) => b.fitness - a.fitness);

      const newPopulation: Genome[] = [];
      const eliteCount = Math.ceil(CONFIG.ELITE_COUNT / CONFIG.NUM_ISLANDS);
      for (let i = 0; i < eliteCount && i < island.length; i++) {
        newPopulation.push({ ...island[i], generation: generation + 1 });
      }

      const avgFitness = island.reduce((sum, g) => sum + g.fitness, 0) / island.length;
      const mutationRate = learningEngine.getAdaptiveMutationRate(generation, avgFitness);

      while (newPopulation.length < island.length) {
        if (Math.random() < CONFIG.CROSSOVER_RATE) {
          const parent1 = tournamentSelect(island, CONFIG.TOURNAMENT_SIZE);
          const parent2 = tournamentSelect(island, CONFIG.TOURNAMENT_SIZE);
          let child = crossover(parent1, parent2, generation + 1, islandIdx);

          if (Math.random() < mutationRate) {
            child = mutate(child, mutationRate, learningEngine);
          }
          newPopulation.push(child);
        } else {
          const parent = tournamentSelect(island, CONFIG.TOURNAMENT_SIZE);
          const mutant = mutate(parent, mutationRate * 1.5, learningEngine);
          mutant.generation = generation + 1;
          newPopulation.push(mutant);
        }
      }

      islands[islandIdx] = newPopulation;
    }

    // Migration
    if (generation > 0 && generation % CONFIG.MIGRATION_INTERVAL === 0) {
      logger.log(`\n🔄 Island migration at generation ${generation}`);
      for (let i = 0; i < CONFIG.NUM_ISLANDS; i++) {
        const sourceIsland = islands[i];
        const targetIsland = islands[(i + 1) % CONFIG.NUM_ISLANDS];

        for (let j = 0; j < CONFIG.MIGRATION_COUNT && j < sourceIsland.length; j++) {
          const migrant = { ...sourceIsland[j], island: (i + 1) % CONFIG.NUM_ISLANDS, fitness: 0 };
          targetIsland.push(migrant);
        }

        targetIsland.sort((a, b) => b.fitness - a.fitness);
        targetIsland.splice(-CONFIG.MIGRATION_COUNT);
      }
    }

    // Learning analysis
    const allGenomes = islands.flat();
    const insights = learningEngine.analyzePopulation(allGenomes);

    // Calculate stats
    const allFitness = allGenomes.map(g => g.fitness);
    const avgFitness = allFitness.reduce((a, b) => a + b, 0) / allFitness.length;
    const bestFitness = Math.max(...allFitness);
    const uniqueGenes = new Set(allGenomes.map(g => JSON.stringify(g.genes)));
    const diversity = uniqueGenes.size / allGenomes.length;

    const genTime = (Date.now() - genStartTime) / 1000;
    const totalTime = (Date.now() - state.startTime.getTime()) / 1000;
    const evalRate = state.totalEvaluations / totalTime;

    // Progress report
    if (generation % CONFIG.PROGRESS_REPORT_INTERVAL === 0 || generation === maxGenerations - 1) {
      logger.logProgress(generation + 1, maxGenerations, {
        bestFitness,
        avgFitness,
        evalRate,
        diversity: diversity * 100,
      });

      if (insights.length > 0) {
        for (const insight of insights.slice(-3)) {
          logger.logInsight(insight);
        }
      }
    }

    // Checkpoint
    if (generation > 0 && generation % CONFIG.CHECKPOINT_INTERVAL === 0) {
      saveCheckpoint(state);
    }

    // Diversity injection
    if (diversity < CONFIG.DIVERSITY_INJECTION_THRESHOLD && generation > 20) {
      logger.log(`\n⚠️ Low diversity (${(diversity * 100).toFixed(1)}%). Injecting new genomes...`);
      for (let i = 0; i < CONFIG.NUM_ISLANDS; i++) {
        for (let j = 0; j < 5; j++) {
          islands[i].push(generateRandomGenome(generation, i));
        }
        islands[i].sort((a, b) => b.fitness - a.fitness);
        islands[i].splice(-5);
      }
    }

    // Early convergence check
    if (learningEngine.isConverged() && generation > 100) {
      logger.log(`\n✅ Optimization converged at generation ${generation}`);
      break;
    }
  }

  // ============================================================================
  // FINAL REPORT
  // ============================================================================

  logger.setPhase('Final Report');

  const totalRuntime = (Date.now() - state.startTime.getTime()) / 1000;

  console.log('\n' + '═'.repeat(80));
  console.log('  HYPEROPTIMIZATION COMPLETE');
  console.log('═'.repeat(80));

  logger.log(`\n📊 STATISTICS:`);
  logger.log(`  ├─ Total Evaluations: ${state.totalEvaluations.toLocaleString()}`);
  logger.log(`  ├─ Total Runtime: ${Math.round(totalRuntime)}s (${(totalRuntime / 60).toFixed(1)} min)`);
  logger.log(`  ├─ Evaluation Rate: ${(state.totalEvaluations / totalRuntime).toFixed(1)}/sec`);
  logger.log(`  └─ Generations Completed: ${state.generation + 1}`);

  if (state.globalBest && state.globalBestResult) {
    logger.log(`\n🏆 GLOBAL BEST CONFIGURATION:`);
    logger.log(`  ${'─'.repeat(60)}`);
    logger.log(`  Fitness Score:      ${state.globalBest.fitness.toFixed(4)}`);
    logger.log(`  Sharpe Ratio:       ${state.globalBestResult.sharpe.toFixed(4)}`);
    logger.log(`  Sortino Ratio:      ${state.globalBestResult.sortino.toFixed(4)}`);
    logger.log(`  Calmar Ratio:       ${state.globalBestResult.calmar.toFixed(4)}`);
    logger.log(`  Total Return:       ${(state.globalBestResult.totalReturn * 100).toFixed(2)}%`);
    logger.log(`  Max Drawdown:       ${(state.globalBestResult.maxDrawdown * 100).toFixed(2)}%`);
    logger.log(`  Win Rate:           ${(state.globalBestResult.winRate * 100).toFixed(1)}%`);
    logger.log(`  Profit Factor:      ${state.globalBestResult.profitFactor.toFixed(2)}`);
    logger.log(`  Total Trades:       ${state.globalBestResult.trades}`);
    logger.log(`  Avg Holding Days:   ${state.globalBestResult.avgHoldingDays.toFixed(1)}`);

    logger.log(`\n📋 OPTIMAL PARAMETERS:`);
    const g = state.globalBest.genes;
    logger.log(`  ┌─ Position Management:`);
    logger.log(`  │  maxPositionPct: ${g.maxPositionPct?.toFixed(3)} | maxPositions: ${g.maxPositions}`);
    logger.log(`  ├─ Risk Management:`);
    logger.log(`  │  atrMultStop: ${g.atrMultStop?.toFixed(2)} | atrMultTarget: ${g.atrMultTarget?.toFixed(2)}`);
    logger.log(`  ├─ Entry/Exit:`);
    logger.log(`  │  buyThreshold: ${g.buyThreshold?.toFixed(3)} | confidenceMin: ${g.confidenceMin?.toFixed(3)}`);
    logger.log(`  ├─ Signal Weights:`);
    logger.log(`  │  technical: ${g.technicalWeight?.toFixed(2)} | momentum: ${g.momentumWeight?.toFixed(2)}`);
    logger.log(`  │  volatility: ${g.volatilityWeight?.toFixed(2)} | volume: ${g.volumeWeight?.toFixed(2)}`);
    logger.log(`  │  sentiment: ${g.sentimentWeight?.toFixed(2)} | pattern: ${g.patternWeight?.toFixed(2)}`);
    logger.log(`  ├─ Indicators:`);
    logger.log(`  │  RSI: period=${g.rsiPeriod}, oversold=${g.rsiOversold}, overbought=${g.rsiOverbought}`);
    logger.log(`  │  MACD: fast=${g.macdFast}, slow=${g.macdSlow}, signal=${g.macdSignal}`);
    logger.log(`  │  BB: period=${g.bbPeriod}, stdDev=${g.bbStdDev?.toFixed(1)}`);
    logger.log(`  └─ Momentum: short=${g.momentumShort} | medium=${g.momentumMedium}`);

    // Regime performance
    if (Object.keys(state.globalBestResult.regimePerformance).length > 0) {
      logger.log(`\n📈 REGIME PERFORMANCE:`);
      for (const [regime, perf] of Object.entries(state.globalBestResult.regimePerformance)) {
        logger.log(`  │ ${regime.padEnd(15)}: Return ${(perf.return * 100).toFixed(1)}%, Sharpe ${perf.sharpe.toFixed(2)}`);
      }
    }

    // Learning insights
    const insights = learningEngine.getInsights();
    if (insights.length > 0) {
      logger.log(`\n🧠 TOP LEARNING INSIGHTS:`);
      for (const insight of insights.slice(-10)) {
        logger.log(`  │ ${insight.pattern}: correlation ${insight.correlation.toFixed(3)}`);
      }
    }
  }

  // Save final results
  saveResults(state, learningEngine);
  saveCheckpoint(state);
  logger.flush();

  console.log('\n' + '═'.repeat(80));
  console.log('  ✅ OPTIMIZATION SESSION COMPLETE');
  console.log('═'.repeat(80));
  console.log(`\n  📁 Log file: ${LOG_FILE}`);
  console.log(`  📁 Results file: ${RESULTS_FILE}`);
  console.log(`  📁 Checkpoint file: ${CHECKPOINT_FILE}\n`);

  return { globalBest: state.globalBest, globalBestResult: state.globalBestResult, totalEvaluations: state.totalEvaluations };
}

// Run the hyperoptimizer
runUltraHyperoptimizer().catch(err => {
  logger.log(`❌ Error: ${err.message}`);
  logger.flush();
  console.error(err);
});
