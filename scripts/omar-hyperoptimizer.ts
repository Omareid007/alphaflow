#!/usr/bin/env npx tsx
/**
 * OMAR HYPEROPTIMIZER - 100,000+ Iteration Self-Improving Algorithm
 *
 * Features:
 * - Genetic Algorithm optimization with crossover and mutation
 * - Parallel batch processing
 * - Self-evaluation judge system
 * - Continuous learning and adaptation
 * - Elite preservation and diversity maintenance
 * - Multi-objective optimization (Sharpe, Sortino, Calmar, Win Rate)
 * - Adaptive mutation rates based on convergence
 * - Island model for population diversity
 * - Pattern mining for successful configurations
 */

// ============= CONFIGURATION =============
const ALPACA_KEY = process.env.ALPACA_API_KEY || '';
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY || '';
const ALPACA_DATA_URL = 'https://data.alpaca.markets';

// Hyperoptimizer settings
const TOTAL_ITERATIONS = 100000;
const POPULATION_SIZE = 100;
const ELITE_COUNT = 10;
const MUTATION_RATE_INITIAL = 0.15;
const CROSSOVER_RATE = 0.7;
const TOURNAMENT_SIZE = 5;
const NUM_ISLANDS = 5;
const MIGRATION_INTERVAL = 50;
const MIGRATION_COUNT = 3;
const BATCH_SIZE = 20;
const CONVERGENCE_THRESHOLD = 0.001;

// Parameter ranges for genetic optimization
const PARAM_RANGES: Record<string, { min: number; max: number; step: number; integer?: boolean; boolean?: boolean }> = {
  maxPositionPct: { min: 0.02, max: 0.15, step: 0.01 },
  maxPortfolioExposure: { min: 0.4, max: 0.95, step: 0.05 },
  maxPositions: { min: 5, max: 40, step: 1, integer: true },
  atrMultStop: { min: 0.5, max: 3.0, step: 0.1 },
  atrMultTarget: { min: 1.5, max: 8.0, step: 0.25 },
  maxDailyLoss: { min: 0.02, max: 0.10, step: 0.01 },
  buyThreshold: { min: 0.05, max: 0.30, step: 0.01 },
  confidenceMin: { min: 0.15, max: 0.50, step: 0.01 },
  technicalWeight: { min: 0.05, max: 0.35, step: 0.01 },
  momentumWeight: { min: 0.05, max: 0.35, step: 0.01 },
  volatilityWeight: { min: 0.02, max: 0.20, step: 0.01 },
  volumeWeight: { min: 0.05, max: 0.25, step: 0.01 },
  sentimentWeight: { min: 0.05, max: 0.25, step: 0.01 },
  patternWeight: { min: 0.02, max: 0.20, step: 0.01 },
  breadthWeight: { min: 0.02, max: 0.15, step: 0.01 },
  correlationWeight: { min: 0.02, max: 0.20, step: 0.01 },
  rsiPeriod: { min: 7, max: 21, step: 1, integer: true },
  rsiOversold: { min: 20, max: 40, step: 1, integer: true },
  rsiOverbought: { min: 60, max: 80, step: 1, integer: true },
  macdFast: { min: 8, max: 16, step: 1, integer: true },
  macdSlow: { min: 20, max: 32, step: 1, integer: true },
  macdSignal: { min: 6, max: 12, step: 1, integer: true },
  bbPeriod: { min: 15, max: 25, step: 1, integer: true },
  bbStdDev: { min: 1.5, max: 3.0, step: 0.1 },
  atrPeriod: { min: 10, max: 20, step: 1, integer: true },
  regimeFilter: { min: 0, max: 1, step: 1, integer: true, boolean: true },
  regimeLookback: { min: 10, max: 50, step: 5, integer: true },
  useRiskParity: { min: 0, max: 1, step: 1, integer: true, boolean: true },
  sectorRotation: { min: 0, max: 1, step: 1, integer: true, boolean: true },
  momentumLookback: { min: 5, max: 30, step: 1, integer: true },
  volatilityLookback: { min: 10, max: 30, step: 1, integer: true },
  correlationLookback: { min: 15, max: 60, step: 5, integer: true },
};

// Symbol universe
const SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'AMD', 'INTC', 'CRM', 'ORCL', 'ADBE', 'NOW', 'PLTR',
  'JPM', 'BAC', 'GS', 'MS', 'V', 'MA', 'AXP',
  'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK', 'LLY', 'TMO',
  'WMT', 'COST', 'HD', 'NKE', 'MCD', 'SBUX', 'DIS',
  'CAT', 'DE', 'BA', 'HON', 'UPS', 'RTX', 'GE',
  'XOM', 'CVX', 'COP', 'SLB', 'OXY',
  'SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLK', 'XLE',
];

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
}

interface TradeResult {
  symbol: string;
  entry: number;
  exit: number;
  pnl: number;
  pnlPct: number;
  holdingDays: number;
  entryDate: string;
  exitDate: string;
  confidence: number;
}

interface BacktestResult {
  totalReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  winRate: number;
  trades: TradeResult[];
  equity: number[];
  dailyReturns: number[];
}

interface LearningInsight {
  pattern: string;
  correlation: number;
  sampleSize: number;
  avgImprovement: number;
}

// ============= ALPACA DATA FETCHER =============

async function fetchAlpacaBars(symbol: string, start: string, end: string): Promise<AlpacaBar[]> {
  const allBars: AlpacaBar[] = [];
  let pageToken: string | null = null;

  do {
    let url = `${ALPACA_DATA_URL}/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=10000&feed=iex`;
    if (pageToken) url += `&page_token=${pageToken}`;

    const response = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': ALPACA_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.bars && Array.isArray(data.bars)) {
      allBars.push(...data.bars);
    }
    pageToken = data.next_page_token || null;
  } while (pageToken);

  return allBars;
}

// ============= GENETIC OPERATORS =============

function generateRandomGenome(generation: number, island: number): Genome {
  const genes: Record<string, number> = {};

  for (const [param, range] of Object.entries(PARAM_RANGES)) {
    if (range.integer) {
      genes[param] = Math.floor(Math.random() * ((range.max - range.min) / range.step + 1)) * range.step + range.min;
    } else {
      const steps = Math.round((range.max - range.min) / range.step);
      genes[param] = Math.round((Math.random() * steps) * range.step * 100) / 100 + range.min;
    }
  }

  normalizeWeights(genes);

  return {
    id: `gen${generation}-isl${island}-${Math.random().toString(36).substr(2, 9)}`,
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
  };
}

function normalizeWeights(genes: Record<string, number>): void {
  const weightKeys = ['technicalWeight', 'momentumWeight', 'volatilityWeight', 'volumeWeight',
                      'sentimentWeight', 'patternWeight', 'breadthWeight', 'correlationWeight'];
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
    if (rand < 0.4) {
      childGenes[param] = parent1.genes[param];
    } else if (rand < 0.8) {
      childGenes[param] = parent2.genes[param];
    } else {
      const alpha = Math.random();
      childGenes[param] = alpha * parent1.genes[param] + (1 - alpha) * parent2.genes[param];
      const range = PARAM_RANGES[param];
      childGenes[param] = Math.round(childGenes[param] / range.step) * range.step;
      childGenes[param] = Math.max(range.min, Math.min(range.max, childGenes[param]));
      if (range.integer) {
        childGenes[param] = Math.round(childGenes[param]);
      }
    }
  }

  normalizeWeights(childGenes);

  return {
    id: `gen${generation}-isl${island}-${Math.random().toString(36).substr(2, 9)}`,
    genes: childGenes,
    fitness: 0, sharpe: 0, sortino: 0, calmar: 0, winRate: 0, totalReturn: 0, maxDrawdown: 0, trades: 0,
    generation, island,
    parentIds: [parent1.id, parent2.id],
    mutations: [],
  };
}

function mutate(genome: Genome, mutationRate: number, adaptiveFactor: number = 1.0): Genome {
  const mutatedGenes = { ...genome.genes };
  const mutations: string[] = [];

  for (const [param, range] of Object.entries(PARAM_RANGES)) {
    if (Math.random() < mutationRate * adaptiveFactor) {
      const currentVal = mutatedGenes[param];
      const sigma = (range.max - range.min) * 0.1 * adaptiveFactor;
      let newVal = currentVal + (Math.random() - 0.5) * 2 * sigma;
      newVal = Math.max(range.min, Math.min(range.max, newVal));
      newVal = Math.round(newVal / range.step) * range.step;
      if (range.integer) newVal = Math.round(newVal);

      if (newVal !== currentVal) {
        mutatedGenes[param] = newVal;
        mutations.push(`${param}: ${currentVal.toFixed(3)} -> ${newVal.toFixed(3)}`);
      }
    }
  }

  normalizeWeights(mutatedGenes);
  return { ...genome, genes: mutatedGenes, mutations, fitness: 0 };
}

function tournamentSelect(population: Genome[], tournamentSize: number): Genome {
  let best: Genome | null = null;
  for (let i = 0; i < tournamentSize; i++) {
    const candidate = population[Math.floor(Math.random() * population.length)];
    if (!best || candidate.fitness > best.fitness) best = candidate;
  }
  return best!;
}

// ============= TECHNICAL INDICATORS =============

function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) result.push(NaN);
    else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  for (let i = 0; i < data.length; i++) {
    if (i === 0) result.push(data[0]);
    else result.push((data[i] - result[i - 1]) * multiplier + result[i - 1]);
  }
  return result;
}

function calculateRSI(closes: number[], period: number): number[] {
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  const avgGain = calculateEMA(gains, period);
  const avgLoss = calculateEMA(losses, period);

  const rsi: number[] = [NaN];
  for (let i = 0; i < avgGain.length; i++) {
    if (avgLoss[i] === 0) rsi.push(100);
    else rsi.push(100 - (100 / (1 + avgGain[i] / avgLoss[i])));
  }
  return rsi;
}

function calculateMACD(closes: number[], fast: number, slow: number, signal: number): { macd: number[], signal: number[], histogram: number[] } {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = calculateEMA(macdLine, signal);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

function calculateBollingerBands(closes: number[], period: number, stdDev: number): { upper: number[], middle: number[], lower: number[] } {
  const middle = calculateSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(NaN); lower.push(NaN); }
    else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }
  return { upper, middle, lower };
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(hl, hc, lc));
  }
  return calculateEMA(tr, period);
}

function calculateStochastic(highs: number[], lows: number[], closes: number[], period: number): { k: number[], d: number[] } {
  const k: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) k.push(NaN);
    else {
      const highSlice = highs.slice(i - period + 1, i + 1);
      const lowSlice = lows.slice(i - period + 1, i + 1);
      const highest = Math.max(...highSlice);
      const lowest = Math.min(...lowSlice);
      const range = highest - lowest;
      k.push(range === 0 ? 50 : ((closes[i] - lowest) / range) * 100);
    }
  }
  const d = calculateSMA(k.filter(v => !isNaN(v)), 3);
  return { k, d };
}

function calculateOBV(closes: number[], volumes: number[]): number[] {
  const obv: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv.push(obv[i - 1] + volumes[i]);
    else if (closes[i] < closes[i - 1]) obv.push(obv[i - 1] - volumes[i]);
    else obv.push(obv[i - 1]);
  }
  return obv;
}

// ============= PATTERN DETECTION =============

function detectPatterns(closes: number[], highs: number[], lows: number[]): { pattern: string, strength: number }[] {
  const patterns: { pattern: string, strength: number }[] = [];
  const len = closes.length;
  if (len < 20) return patterns;

  const peaks: number[] = [];
  const troughs: number[] = [];

  for (let i = 5; i < len - 5; i++) {
    const window = closes.slice(i - 5, i + 6);
    const mid = window[5];
    if (mid === Math.max(...window)) peaks.push(i);
    if (mid === Math.min(...window)) troughs.push(i);
  }

  if (troughs.length >= 2) {
    const last2 = troughs.slice(-2);
    const t1 = closes[last2[0]], t2 = closes[last2[1]];
    if (Math.abs(t1 - t2) / t1 < 0.03 && closes[len - 1] > t2 * 1.02) {
      patterns.push({ pattern: 'double_bottom', strength: 0.8 });
    }
  }

  if (peaks.length >= 2) {
    const last2 = peaks.slice(-2);
    const p1 = closes[last2[0]], p2 = closes[last2[1]];
    if (Math.abs(p1 - p2) / p1 < 0.03 && closes[len - 1] < p2 * 0.98) {
      patterns.push({ pattern: 'double_top', strength: -0.8 });
    }
  }

  const recent20 = closes.slice(-20);
  const first5 = recent20.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  const last5 = recent20.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const mid10 = recent20.slice(5, 15).reduce((a, b) => a + b, 0) / 10;

  if (first5 < mid10 && mid10 > last5 && last5 > first5) {
    patterns.push({ pattern: 'bull_flag', strength: 0.6 });
  }
  if (first5 > mid10 && mid10 < last5 && last5 < first5) {
    patterns.push({ pattern: 'bear_flag', strength: -0.6 });
  }

  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  if (closes[len - 1] > sma20 * 1.05) patterns.push({ pattern: 'momentum_breakout', strength: 0.5 });
  else if (closes[len - 1] < sma20 * 0.95) patterns.push({ pattern: 'momentum_breakdown', strength: -0.5 });

  return patterns;
}

// ============= SIGNAL GENERATION =============

function generateSignal(bars: AlpacaBar[], genes: Record<string, number>): { score: number, confidence: number, factors: Record<string, number> } {
  if (bars.length < 50) return { score: 0, confidence: 0, factors: {} };

  const closes = bars.map(b => b.c);
  const highs = bars.map(b => b.h);
  const lows = bars.map(b => b.l);
  const volumes = bars.map(b => b.v);

  const factors: Record<string, number> = {};

  // Technical
  const rsi = calculateRSI(closes, genes.rsiPeriod || 14);
  const currentRSI = rsi[rsi.length - 1];
  const macd = calculateMACD(closes, genes.macdFast || 12, genes.macdSlow || 26, genes.macdSignal || 9);
  const bb = calculateBollingerBands(closes, genes.bbPeriod || 20, genes.bbStdDev || 2);
  const stoch = calculateStochastic(highs, lows, closes, 14);

  let technicalScore = 0;
  if (currentRSI < (genes.rsiOversold || 30)) technicalScore += 0.3;
  else if (currentRSI > (genes.rsiOverbought || 70)) technicalScore -= 0.3;
  else technicalScore += (50 - currentRSI) / 100;

  const macdCurrent = macd.histogram[macd.histogram.length - 1];
  const macdPrev = macd.histogram[macd.histogram.length - 2];
  if (macdCurrent > 0 && macdCurrent > macdPrev) technicalScore += 0.25;
  else if (macdCurrent < 0 && macdCurrent < macdPrev) technicalScore -= 0.25;

  const currentClose = closes[closes.length - 1];
  const bbLower = bb.lower[bb.lower.length - 1];
  const bbUpper = bb.upper[bb.upper.length - 1];
  const bbMiddle = bb.middle[bb.middle.length - 1];
  if (currentClose < bbLower) technicalScore += 0.2;
  else if (currentClose > bbUpper) technicalScore -= 0.2;

  const stochK = stoch.k[stoch.k.length - 1];
  if (stochK < 20) technicalScore += 0.15;
  else if (stochK > 80) technicalScore -= 0.15;

  factors.technical = Math.max(-1, Math.min(1, technicalScore));

  // Momentum
  const momLookback = genes.momentumLookback || 10;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const recentReturns = returns.slice(-momLookback);
  const avgReturn = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
  const momentum5 = (closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6];
  const momentum20 = closes.length >= 21 ? (closes[closes.length - 1] - closes[closes.length - 21]) / closes[closes.length - 21] : 0;
  factors.momentum = Math.max(-1, Math.min(1, (avgReturn * 50 + momentum5 * 5 + momentum20 * 2) / 3));

  // Volatility
  const volLookback = genes.volatilityLookback || 20;
  const recentVolReturns = returns.slice(-volLookback);
  const volatility = Math.sqrt(recentVolReturns.reduce((sum, r) => sum + r * r, 0) / recentVolReturns.length) * Math.sqrt(252);
  factors.volatility = Math.max(-1, Math.min(1, 0.5 - volatility));

  // Volume
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = currentVolume / avgVolume;
  const obv = calculateOBV(closes, volumes);
  const obvTrend = obv[obv.length - 1] - obv[obv.length - 6];
  factors.volume = Math.max(-1, Math.min(1, (volumeRatio - 1) * 0.5 + (obvTrend > 0 ? 0.2 : -0.2)));

  // Sentiment proxy
  const gapUp = closes.length > 1 && closes[closes.length - 1] > closes[closes.length - 2] * 1.01;
  const gapDown = closes.length > 1 && closes[closes.length - 1] < closes[closes.length - 2] * 0.99;
  const trendUp = momentum20 > 0.05;
  const trendDown = momentum20 < -0.05;
  factors.sentiment = Math.max(-1, Math.min(1, (gapUp ? 0.3 : gapDown ? -0.3 : 0) + (trendUp ? 0.3 : trendDown ? -0.3 : 0) + (volumeRatio > 1.5 && momentum5 > 0 ? 0.2 : volumeRatio > 1.5 && momentum5 < 0 ? -0.2 : 0)));

  // Pattern
  const patterns = detectPatterns(closes, highs, lows);
  factors.pattern = patterns.length > 0 ? Math.max(-1, Math.min(1, patterns.reduce((sum, p) => sum + p.strength, 0))) : 0;

  // Breadth
  const sma10 = calculateSMA(closes, 10);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = closes.length >= 50 ? calculateSMA(closes, 50) : sma20;
  const current = closes[closes.length - 1];
  factors.breadth = (current > sma10[sma10.length - 1] ? 0.33 : -0.33) + (current > sma20[sma20.length - 1] ? 0.33 : -0.33) + (current > sma50[sma50.length - 1] ? 0.34 : -0.34);

  // Correlation
  const deviation = (current - bbMiddle) / (bbUpper - bbMiddle || 1);
  factors.correlation = Math.max(-1, Math.min(1, -deviation * 0.5));

  // Weighted score
  const score = factors.technical * (genes.technicalWeight || 0.2) +
    factors.momentum * (genes.momentumWeight || 0.2) +
    factors.volatility * (genes.volatilityWeight || 0.08) +
    factors.volume * (genes.volumeWeight || 0.12) +
    factors.sentiment * (genes.sentimentWeight || 0.12) +
    factors.pattern * (genes.patternWeight || 0.1) +
    factors.breadth * (genes.breadthWeight || 0.08) +
    factors.correlation * (genes.correlationWeight || 0.1);

  const factorValues = Object.values(factors);
  const positiveFactors = factorValues.filter(f => f > 0).length;
  const negativeFactors = factorValues.filter(f => f < 0).length;
  const agreement = Math.max(positiveFactors, negativeFactors) / factorValues.length;
  const confidence = agreement * Math.abs(score);

  return { score, confidence, factors };
}

// ============= BACKTEST ENGINE =============

async function runBacktest(genome: Genome, bars: Map<string, AlpacaBar[]>, startDate: Date, endDate: Date): Promise<BacktestResult> {
  const genes = genome.genes;
  const initialCapital = 100000;
  let capital = initialCapital;
  let maxCapital = capital;
  const trades: TradeResult[] = [];
  const equity: number[] = [capital];
  const dailyReturns: number[] = [];
  const positions: Map<string, { entry: number, shares: number, entryDate: string, stopLoss: number, takeProfit: number, confidence: number }> = new Map();

  // Get trading days from first symbol
  const tradingDays: string[] = [];
  const firstBars = bars.values().next().value;
  if (firstBars) {
    for (const bar of firstBars) {
      const date = new Date(bar.t);
      if (date >= startDate && date <= endDate) tradingDays.push(bar.t);
    }
  }

  for (let dayIdx = 50; dayIdx < tradingDays.length; dayIdx++) {
    const currentDate = tradingDays[dayIdx];

    // Check exits
    for (const [symbol, pos] of positions) {
      const symbolBars = bars.get(symbol);
      if (!symbolBars) continue;
      const currentBar = symbolBars.find(b => b.t === currentDate);
      if (!currentBar) continue;

      const currentPrice = currentBar.c;
      const high = currentBar.h;
      const low = currentBar.l;
      let exitPrice: number | null = null;

      if (low <= pos.stopLoss) exitPrice = pos.stopLoss;
      else if (high >= pos.takeProfit) exitPrice = pos.takeProfit;

      if (exitPrice) {
        const pnl = (exitPrice - pos.entry) * pos.shares;
        const pnlPct = (exitPrice - pos.entry) / pos.entry;
        capital += pos.shares * exitPrice;
        trades.push({ symbol, entry: pos.entry, exit: exitPrice, pnl, pnlPct, holdingDays: dayIdx - tradingDays.indexOf(pos.entryDate), entryDate: pos.entryDate, exitDate: currentDate, confidence: pos.confidence });
        positions.delete(symbol);
      }
    }

    // Check entries
    if (positions.size < (genes.maxPositions || 20)) {
      const candidates: { symbol: string, score: number, confidence: number, price: number, atr: number }[] = [];

      for (const [symbol, symbolBars] of bars) {
        if (positions.has(symbol)) continue;
        const barsToDate = symbolBars.filter(b => b.t <= currentDate).slice(-60);
        if (barsToDate.length < 50) continue;

        const signal = generateSignal(barsToDate, genes);
        if (signal.score >= (genes.buyThreshold || 0.12) && signal.confidence >= (genes.confidenceMin || 0.28)) {
          const currentBar = barsToDate[barsToDate.length - 1];
          const closes = barsToDate.map(b => b.c);
          const highs = barsToDate.map(b => b.h);
          const lows = barsToDate.map(b => b.l);
          const atr = calculateATR(highs, lows, closes, genes.atrPeriod || 14);
          candidates.push({ symbol, score: signal.score, confidence: signal.confidence, price: currentBar.c, atr: atr[atr.length - 1] });
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      for (const candidate of candidates.slice(0, (genes.maxPositions || 20) - positions.size)) {
        const maxPositionSize = capital * (genes.maxPositionPct || 0.05);
        const shares = Math.floor(maxPositionSize / candidate.price);

        if (shares > 0 && shares * candidate.price <= capital) {
          const stopLoss = candidate.price - candidate.atr * (genes.atrMultStop || 1.5);
          const takeProfit = candidate.price + candidate.atr * (genes.atrMultTarget || 4);
          positions.set(candidate.symbol, { entry: candidate.price, shares, entryDate: currentDate, stopLoss, takeProfit, confidence: candidate.confidence });
          capital -= shares * candidate.price;
        }
      }
    }

    // Update equity
    let currentEquity = capital;
    for (const [symbol, pos] of positions) {
      const symbolBars = bars.get(symbol);
      if (symbolBars) {
        const currentBar = symbolBars.find(b => b.t === currentDate);
        if (currentBar) currentEquity += pos.shares * currentBar.c;
      }
    }
    equity.push(currentEquity);
    maxCapital = Math.max(maxCapital, currentEquity);
    if (equity.length > 1) dailyReturns.push((currentEquity - equity[equity.length - 2]) / equity[equity.length - 2]);
  }

  // Close remaining positions
  for (const [symbol, pos] of positions) {
    const symbolBars = bars.get(symbol);
    if (symbolBars && symbolBars.length > 0) {
      const lastBar = symbolBars[symbolBars.length - 1];
      const exitPrice = lastBar.c;
      trades.push({ symbol, entry: pos.entry, exit: exitPrice, pnl: (exitPrice - pos.entry) * pos.shares, pnlPct: (exitPrice - pos.entry) / pos.entry, holdingDays: tradingDays.length - tradingDays.indexOf(pos.entryDate), entryDate: pos.entryDate, exitDate: tradingDays[tradingDays.length - 1], confidence: pos.confidence });
    }
  }

  // Calculate metrics
  const totalReturn = (equity[equity.length - 1] - initialCapital) / initialCapital;
  const maxDrawdown = equity.reduce((maxDD, val, i) => {
    const peak = Math.max(...equity.slice(0, i + 1));
    return Math.max(maxDD, (peak - val) / peak);
  }, 0);

  const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const stdReturn = Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (dailyReturns.length || 1));
  const sharpe = stdReturn > 0 ? (avgReturn * 252) / (stdReturn * Math.sqrt(252)) : 0;
  const negativeReturns = dailyReturns.filter(r => r < 0);
  const downstdReturn = Math.sqrt(negativeReturns.reduce((sum, r) => sum + r * r, 0) / (negativeReturns.length || 1));
  const sortino = downstdReturn > 0 ? (avgReturn * 252) / (downstdReturn * Math.sqrt(252)) : 0;
  const years = tradingDays.length / 252;
  const cagr = Math.pow(1 + totalReturn, 1 / years) - 1;
  const calmar = maxDrawdown > 0 ? cagr / maxDrawdown : 0;
  const winRate = trades.length > 0 ? trades.filter(t => t.pnl > 0).length / trades.length : 0;

  return { totalReturn, sharpe, sortino, calmar, maxDrawdown, winRate, trades, equity, dailyReturns };
}

function calculateFitness(result: BacktestResult): number {
  const { sharpe, sortino, calmar, winRate, totalReturn, maxDrawdown, trades } = result;
  if (trades.length < 50) return -1000 + trades.length;
  if (maxDrawdown > 0.3) return -500 * maxDrawdown;

  return sharpe * 30 + sortino * 20 + calmar * 25 + winRate * 15 + totalReturn * 20 + (1 - maxDrawdown) * 10 + Math.min(trades.length / 500, 1) * 5;
}

// ============= LEARNING ENGINE =============

class LearningEngine {
  private bestGenomes: Genome[] = [];
  private convergenceHistory: number[] = [];
  private insights: LearningInsight[] = [];

  analyzePopulation(population: Genome[]): void {
    const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
    this.bestGenomes = sorted.slice(0, 20);

    for (const param of Object.keys(PARAM_RANGES)) {
      const topValues = this.bestGenomes.map(g => g.genes[param]);
      const avgTopValue = topValues.reduce((a, b) => a + b, 0) / topValues.length;
      const allValues = population.map(g => g.genes[param]);
      const avgAllValue = allValues.reduce((a, b) => a + b, 0) / allValues.length;

      if (Math.abs(avgTopValue - avgAllValue) > 0.1 * avgAllValue) {
        this.insights.push({ pattern: `${param} elite bias`, correlation: (avgTopValue - avgAllValue) / avgAllValue, sampleSize: this.bestGenomes.length, avgImprovement: sorted[0].fitness - sorted[sorted.length - 1].fitness });
      }
    }
  }

  getAdaptiveMutationRate(generation: number, avgFitness: number): number {
    this.convergenceHistory.push(avgFitness);
    if (this.convergenceHistory.length < 10) return MUTATION_RATE_INITIAL;

    const recent = this.convergenceHistory.slice(-10);
    const improvement = (recent[9] - recent[0]) / Math.abs(recent[0] || 1);
    if (improvement < CONVERGENCE_THRESHOLD) return Math.min(MUTATION_RATE_INITIAL * 2, 0.4);
    else if (improvement > 0.1) return Math.max(MUTATION_RATE_INITIAL * 0.5, 0.05);
    return MUTATION_RATE_INITIAL;
  }

  getInsights(): LearningInsight[] { return this.insights.slice(-50); }
  getBestGenomes(): Genome[] { return this.bestGenomes; }
}

// ============= JUDGE SYSTEM =============

class JudgeSystem {
  evaluate(genome: Genome, result: BacktestResult): { verdict: string, suggestions: string[] } {
    const suggestions: string[] = [];
    let verdict = 'NEUTRAL';

    if (result.sharpe > 2 && result.calmar > 2 && result.maxDrawdown < 0.1) verdict = 'EXCELLENT';
    else if (result.sharpe > 1.5 && result.calmar > 1.5 && result.maxDrawdown < 0.15) verdict = 'GOOD';
    else if (result.sharpe < 0.5 || result.maxDrawdown > 0.25) {
      verdict = 'POOR';
      if (result.maxDrawdown > 0.2) suggestions.push(`Reduce maxPositionPct from ${genome.genes.maxPositionPct?.toFixed(2)}`);
      if (result.winRate < 0.4) suggestions.push(`Increase confidenceMin from ${genome.genes.confidenceMin?.toFixed(2)}`);
    }

    if (result.sharpe > 4) { suggestions.push('WARNING: High Sharpe may indicate overfitting'); verdict = 'SUSPICIOUS'; }
    return { verdict, suggestions };
  }
}

// ============= MAIN =============

async function loadHistoricalData(): Promise<Map<string, AlpacaBar[]>> {
  const bars = new Map<string, AlpacaBar[]>();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 3);

  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];

  console.log(`\nLoading historical data for ${SYMBOLS.length} symbols...`);
  console.log(`Period: ${start} to ${end}`);

  let loaded = 0;
  for (const symbol of SYMBOLS) {
    try {
      const symbolBars = await fetchAlpacaBars(symbol, start, end);
      if (symbolBars.length > 100) {
        bars.set(symbol, symbolBars);
        loaded++;
      }
      // Rate limit
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      // Skip errors
    }
    process.stdout.write(`\r  Loaded ${loaded}/${SYMBOLS.length} symbols`);
  }

  console.log(`\n  Successfully loaded ${bars.size} symbols`);
  return bars;
}

async function runHyperoptimizer() {
  console.log('═'.repeat(80));
  console.log('  OMAR HYPEROPTIMIZER - 100,000 ITERATION SELF-IMPROVING ALGORITHM');
  console.log('═'.repeat(80));
  console.log(`\n  Configuration:`);
  console.log(`  - Total Iterations: ${TOTAL_ITERATIONS.toLocaleString()}`);
  console.log(`  - Population Size: ${POPULATION_SIZE}`);
  console.log(`  - Islands: ${NUM_ISLANDS}`);

  const bars = await loadHistoricalData();
  if (bars.size < 10) { console.error('Insufficient data. Aborting.'); return; }

  const startDate = new Date(); startDate.setFullYear(startDate.getFullYear() - 3);
  const endDate = new Date();

  const learningEngine = new LearningEngine();
  const judgeSystem = new JudgeSystem();

  const islands: Genome[][] = [];
  for (let i = 0; i < NUM_ISLANDS; i++) {
    const population: Genome[] = [];
    for (let j = 0; j < POPULATION_SIZE / NUM_ISLANDS; j++) population.push(generateRandomGenome(0, i));
    islands.push(population);
  }

  let globalBest: Genome | null = null;
  let globalBestResult: BacktestResult | null = null;
  let totalEvaluations = 0;

  const iterationsPerGeneration = POPULATION_SIZE;
  const totalGenerations = Math.ceil(TOTAL_ITERATIONS / iterationsPerGeneration);

  console.log('\n' + '─'.repeat(80));
  console.log('  STARTING EVOLUTION');
  console.log('─'.repeat(80));

  for (let generation = 0; generation < totalGenerations; generation++) {
    const genStartTime = Date.now();

    for (let islandIdx = 0; islandIdx < NUM_ISLANDS; islandIdx++) {
      const island = islands[islandIdx];

      for (let batchStart = 0; batchStart < island.length; batchStart += BATCH_SIZE) {
        const batch = island.slice(batchStart, batchStart + BATCH_SIZE);

        await Promise.all(batch.map(async (genome) => {
          if (genome.fitness === 0) {
            try {
              const result = await runBacktest(genome, bars, startDate, endDate);
              const fitness = calculateFitness(result);

              genome.fitness = fitness;
              genome.sharpe = result.sharpe;
              genome.sortino = result.sortino;
              genome.calmar = result.calmar;
              genome.winRate = result.winRate;
              genome.totalReturn = result.totalReturn;
              genome.maxDrawdown = result.maxDrawdown;
              genome.trades = result.trades.length;
              totalEvaluations++;

              const { verdict, suggestions } = judgeSystem.evaluate(genome, result);

              if (!globalBest || fitness > globalBest.fitness) {
                globalBest = { ...genome };
                globalBestResult = result;
                console.log(`\n  🏆 NEW GLOBAL BEST (Gen ${generation}, Island ${islandIdx})`);
                console.log(`     Fitness: ${fitness.toFixed(2)} | Sharpe: ${result.sharpe.toFixed(2)} | Sortino: ${result.sortino.toFixed(2)}`);
                console.log(`     Return: ${(result.totalReturn * 100).toFixed(1)}% | MaxDD: ${(result.maxDrawdown * 100).toFixed(1)}% | Trades: ${result.trades.length}`);
                console.log(`     Verdict: ${verdict}`);
              }
            } catch (err) { genome.fitness = -10000; }
          }
        }));
      }

      island.sort((a, b) => b.fitness - a.fitness);

      const newPopulation: Genome[] = [];
      for (let i = 0; i < ELITE_COUNT / NUM_ISLANDS; i++) newPopulation.push({ ...island[i], generation: generation + 1 });

      const avgFitness = island.reduce((sum, g) => sum + g.fitness, 0) / island.length;
      const mutationRate = learningEngine.getAdaptiveMutationRate(generation, avgFitness);

      while (newPopulation.length < island.length) {
        if (Math.random() < CROSSOVER_RATE) {
          const parent1 = tournamentSelect(island, TOURNAMENT_SIZE);
          const parent2 = tournamentSelect(island, TOURNAMENT_SIZE);
          let child = crossover(parent1, parent2, generation + 1, islandIdx);
          if (Math.random() < mutationRate) child = mutate(child, mutationRate);
          newPopulation.push(child);
        } else {
          const parent = tournamentSelect(island, TOURNAMENT_SIZE);
          const mutant = mutate(parent, mutationRate, 1.5);
          mutant.generation = generation + 1;
          newPopulation.push(mutant);
        }
      }
      islands[islandIdx] = newPopulation;
    }

    if (generation > 0 && generation % MIGRATION_INTERVAL === 0) {
      for (let i = 0; i < NUM_ISLANDS; i++) {
        const sourceIsland = islands[i];
        const targetIsland = islands[(i + 1) % NUM_ISLANDS];
        for (let j = 0; j < MIGRATION_COUNT; j++) {
          targetIsland.push({ ...sourceIsland[j], island: (i + 1) % NUM_ISLANDS, fitness: 0 });
        }
        targetIsland.sort((a, b) => b.fitness - a.fitness);
        targetIsland.splice(-MIGRATION_COUNT);
      }
    }

    const allGenomes = islands.flat();
    learningEngine.analyzePopulation(allGenomes);

    const allFitness = allGenomes.map(g => g.fitness);
    const avgFitness = allFitness.reduce((a, b) => a + b, 0) / allFitness.length;
    const bestFitness = Math.max(...allFitness);
    const uniqueGenes = new Set(allGenomes.map(g => JSON.stringify(g.genes)));
    const diversity = uniqueGenes.size / allGenomes.length;

    const genTime = (Date.now() - genStartTime) / 1000;
    const progress = ((generation + 1) / totalGenerations * 100).toFixed(1);
    const eta = genTime * (totalGenerations - generation - 1);

    if (generation % 10 === 0 || generation === totalGenerations - 1) {
      console.log(`\n  Generation ${generation + 1}/${totalGenerations} (${progress}%) | ETA: ${Math.round(eta)}s`);
      console.log(`  ├─ Evaluations: ${totalEvaluations.toLocaleString()}`);
      console.log(`  ├─ Avg Fitness: ${avgFitness.toFixed(2)} | Best: ${bestFitness.toFixed(2)}`);
      console.log(`  ├─ Diversity: ${(diversity * 100).toFixed(1)}%`);
      console.log(`  └─ Global Best: ${globalBest?.fitness.toFixed(2) || 'N/A'}`);
    }

    if (generation > 100 && diversity < 0.05) {
      console.log('\n  ⚠️ Population converged. Injecting diversity...');
      for (let i = 0; i < NUM_ISLANDS; i++) {
        for (let j = 0; j < 5; j++) islands[i].push(generateRandomGenome(generation, i));
        islands[i].sort((a, b) => b.fitness - a.fitness);
        islands[i].splice(-5);
      }
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('  HYPEROPTIMIZATION COMPLETE');
  console.log('═'.repeat(80));

  console.log(`\n  Total Evaluations: ${totalEvaluations.toLocaleString()}`);

  if (globalBest && globalBestResult) {
    console.log(`\n  🏆 GLOBAL BEST CONFIGURATION:`);
    console.log(`  ${'─'.repeat(40)}`);
    console.log(`  Fitness Score: ${globalBest.fitness.toFixed(2)}`);
    console.log(`  Sharpe Ratio: ${globalBestResult.sharpe.toFixed(3)}`);
    console.log(`  Sortino Ratio: ${globalBestResult.sortino.toFixed(3)}`);
    console.log(`  Calmar Ratio: ${globalBestResult.calmar.toFixed(3)}`);
    console.log(`  Total Return: ${(globalBestResult.totalReturn * 100).toFixed(2)}%`);
    console.log(`  Max Drawdown: ${(globalBestResult.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`  Win Rate: ${(globalBestResult.winRate * 100).toFixed(1)}%`);
    console.log(`  Total Trades: ${globalBestResult.trades.length}`);

    console.log(`\n  OPTIMAL PARAMETERS:`);
    const params = globalBest.genes;
    console.log(`  Position: maxPositionPct=${params.maxPositionPct?.toFixed(3)}, maxPositions=${params.maxPositions}`);
    console.log(`  Risk: atrMultStop=${params.atrMultStop?.toFixed(2)}, atrMultTarget=${params.atrMultTarget?.toFixed(2)}`);
    console.log(`  Entry: buyThreshold=${params.buyThreshold?.toFixed(3)}, confidenceMin=${params.confidenceMin?.toFixed(3)}`);
    console.log(`  Weights: tech=${params.technicalWeight?.toFixed(2)}, mom=${params.momentumWeight?.toFixed(2)}, vol=${params.volatilityWeight?.toFixed(2)}, sent=${params.sentimentWeight?.toFixed(2)}`);

    const insights = learningEngine.getInsights();
    if (insights.length > 0) {
      console.log(`\n  LEARNING INSIGHTS:`);
      for (const insight of insights.slice(-5)) console.log(`  - ${insight.pattern}: ${insight.correlation.toFixed(3)}`);
    }

    return { globalBest, globalBestResult, totalEvaluations };
  }
  return null;
}

runHyperoptimizer().catch(console.error);
