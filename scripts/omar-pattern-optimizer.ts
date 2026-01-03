#!/usr/bin/env npx tsx
/**
 * OMAR PATTERN DETECTION OPTIMIZER - 1000+ Iterations
 *
 * Focuses specifically on optimizing chart pattern detection for OMAR algorithm:
 * - Pattern recognition sensitivity and thresholds
 * - Pattern detection windows (10-30 days)
 * - Pattern strength thresholds
 * - Pattern weight in composite signal (0.05-0.25)
 * - Peak/trough detection parameters
 * - Individual pattern effectiveness (double bottom/top, triangles, flags, H&S)
 * - Pattern confirmation requirements
 * - Lookback windows for pattern formation
 *
 * Uses genetic algorithm with:
 * - Population-based search
 * - Elite preservation
 * - Crossover and mutation
 * - Multi-objective fitness (Sharpe, Win Rate, Return, Calmar)
 */

// ============= IMPORTS FROM SHARED MODULES =============
import {
  fetchAlpacaBars,
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateATR,
  calculateMACD,
  tournamentSelect as sharedTournamentSelect,
  normalizeWeights as sharedNormalizeWeights,
  type AlpacaBar,
} from "./shared/index.js";

// ============= CONFIGURATION =============

// Optimizer settings
const TOTAL_ITERATIONS = 1000;
const POPULATION_SIZE = 50;
const ELITE_COUNT = 5;
const MUTATION_RATE = 0.2;
const CROSSOVER_RATE = 0.7;
const TOURNAMENT_SIZE = 5;

// Pattern-specific parameter ranges
const PATTERN_PARAM_RANGES: Record<
  string,
  { min: number; max: number; step: number; integer?: boolean }
> = {
  // Pattern detection windows
  patternLookbackWindow: { min: 10, max: 30, step: 1, integer: true },
  patternMinDistance: { min: 3, max: 10, step: 1, integer: true },
  patternMaxDistance: { min: 20, max: 60, step: 5, integer: true },

  // Peak/trough detection
  peakTroughWindow: { min: 2, max: 8, step: 1, integer: true },
  peakTroughSensitivity: { min: 0.5, max: 2.0, step: 0.1 },

  // Pattern similarity thresholds
  doubleTopBottomTolerance: { min: 0.01, max: 0.05, step: 0.005 },
  triangleFlatnessTolerance: { min: 0.01, max: 0.04, step: 0.005 },
  headShouldersSymmetryTolerance: { min: 0.02, max: 0.08, step: 0.01 },

  // Pattern strength thresholds
  minPatternConfidence: { min: 0.3, max: 0.8, step: 0.05 },
  patternBreakoutConfirmation: { min: 0.01, max: 0.05, step: 0.005 },

  // Pattern weights in signal
  patternWeight: { min: 0.05, max: 0.25, step: 0.01 },

  // Individual pattern weights
  doubleBottomWeight: { min: 0.5, max: 1.5, step: 0.1 },
  doubleTopWeight: { min: 0.5, max: 1.5, step: 0.1 },
  headShouldersWeight: { min: 0.5, max: 1.5, step: 0.1 },
  invHeadShouldersWeight: { min: 0.5, max: 1.5, step: 0.1 },
  ascendingTriangleWeight: { min: 0.4, max: 1.2, step: 0.1 },
  descendingTriangleWeight: { min: 0.4, max: 1.2, step: 0.1 },
  bullFlagWeight: { min: 0.3, max: 1.0, step: 0.1 },
  bearFlagWeight: { min: 0.3, max: 1.0, step: 0.1 },

  // Flag pattern specific
  flagPoleMinGain: { min: 0.05, max: 0.15, step: 0.01 },
  flagPoleLength: { min: 10, max: 30, step: 2, integer: true },
  flagConsolidationLength: { min: 5, max: 15, step: 1, integer: true },
  flagPullbackMin: { min: 0.01, max: 0.05, step: 0.005 },
  flagPullbackMax: { min: 0.05, max: 0.12, step: 0.01 },

  // Triangle specific
  triangleMinTouches: { min: 2, max: 5, step: 1, integer: true },
  triangleFormationPeriod: { min: 15, max: 40, step: 5, integer: true },

  // Base parameters (fixed for pattern focus)
  maxPositionPct: { min: 0.04, max: 0.06, step: 0.01 },
  maxPositions: { min: 15, max: 25, step: 5, integer: true },
  atrMultStop: { min: 1.2, max: 2.0, step: 0.2 },
  atrMultTarget: { min: 3.0, max: 5.0, step: 0.5 },
  buyThreshold: { min: 0.1, max: 0.18, step: 0.02 },
  confidenceMin: { min: 0.25, max: 0.35, step: 0.05 },

  // Other factor weights (normalized with pattern weight)
  technicalWeight: { min: 0.15, max: 0.25, step: 0.01 },
  momentumWeight: { min: 0.15, max: 0.25, step: 0.01 },
  volatilityWeight: { min: 0.05, max: 0.12, step: 0.01 },
  volumeWeight: { min: 0.08, max: 0.15, step: 0.01 },
  sentimentWeight: { min: 0.08, max: 0.15, step: 0.01 },
  breadthWeight: { min: 0.05, max: 0.12, step: 0.01 },
  correlationWeight: { min: 0.05, max: 0.12, step: 0.01 },
};

// Symbol universe - diversified set
const SYMBOLS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "TSLA",
  "AMD",
  "INTC",
  "CRM",
  "NFLX",
  "ADBE",
  "ORCL",
  "JPM",
  "BAC",
  "V",
  "MA",
  "GS",
  "MS",
  "UNH",
  "JNJ",
  "PFE",
  "ABBV",
  "LLY",
  "WMT",
  "COST",
  "HD",
  "NKE",
  "MCD",
  "SPY",
  "QQQ",
  "IWM",
  "XLF",
  "XLK",
  "XLE",
  "XLV",
];

interface PatternGenome {
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

  // Pattern-specific metrics
  patternTradeCount: number;
  patternWinRate: number;
  avgPatternStrength: number;
  patternTypeStats: Record<
    string,
    { count: number; winRate: number; avgReturn: number }
  >;
}

interface ChartPattern {
  type: string;
  confidence: number;
  direction: "bullish" | "bearish";
  strength: number;
  startIdx: number;
  endIdx: number;
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
  patterns: ChartPattern[];
  patternScore: number;
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

  // Pattern analytics
  patternTradeCount: number;
  patternWinRate: number;
  avgPatternStrength: number;
  patternTypeStats: Record<
    string,
    { count: number; winRate: number; avgReturn: number }
  >;
}

// ============= GENETIC OPERATORS =============

function generateRandomGenome(generation: number): PatternGenome {
  const genes: Record<string, number> = {};

  for (const [param, range] of Object.entries(PATTERN_PARAM_RANGES)) {
    if (range.integer) {
      genes[param] =
        Math.floor(Math.random() * ((range.max - range.min) / range.step + 1)) *
          range.step +
        range.min;
    } else {
      const steps = Math.round((range.max - range.min) / range.step);
      genes[param] =
        Math.round(Math.random() * steps * range.step * 100) / 100 + range.min;
    }
  }

  normalizeWeights(genes);

  return {
    id: `gen${generation}-${Math.random().toString(36).substr(2, 9)}`,
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
    patternTradeCount: 0,
    patternWinRate: 0,
    avgPatternStrength: 0,
    patternTypeStats: {},
  };
}

// Pattern-specific weight keys (includes breadthWeight and correlationWeight)
const PATTERN_WEIGHT_KEYS = [
  "technicalWeight",
  "momentumWeight",
  "volatilityWeight",
  "volumeWeight",
  "sentimentWeight",
  "patternWeight",
  "breadthWeight",
  "correlationWeight",
];

function normalizeWeights(genes: Record<string, number>): void {
  sharedNormalizeWeights(genes, PATTERN_WEIGHT_KEYS);
}

function crossover(
  parent1: PatternGenome,
  parent2: PatternGenome,
  generation: number
): PatternGenome {
  const childGenes: Record<string, number> = {};

  for (const param of Object.keys(PATTERN_PARAM_RANGES)) {
    const rand = Math.random();
    if (rand < 0.45) {
      childGenes[param] = parent1.genes[param];
    } else if (rand < 0.9) {
      childGenes[param] = parent2.genes[param];
    } else {
      // Blend
      const alpha = Math.random();
      childGenes[param] =
        alpha * parent1.genes[param] + (1 - alpha) * parent2.genes[param];
      const range = PATTERN_PARAM_RANGES[param];
      childGenes[param] =
        Math.round(childGenes[param] / range.step) * range.step;
      childGenes[param] = Math.max(
        range.min,
        Math.min(range.max, childGenes[param])
      );
      if (range.integer) childGenes[param] = Math.round(childGenes[param]);
    }
  }

  normalizeWeights(childGenes);

  return {
    id: `gen${generation}-${Math.random().toString(36).substr(2, 9)}`,
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
    patternTradeCount: 0,
    patternWinRate: 0,
    avgPatternStrength: 0,
    patternTypeStats: {},
  };
}

function mutate(genome: PatternGenome, mutationRate: number): PatternGenome {
  const mutatedGenes = { ...genome.genes };

  for (const [param, range] of Object.entries(PATTERN_PARAM_RANGES)) {
    if (Math.random() < mutationRate) {
      const sigma = (range.max - range.min) * 0.15;
      let newVal = mutatedGenes[param] + (Math.random() - 0.5) * 2 * sigma;
      newVal = Math.max(range.min, Math.min(range.max, newVal));
      newVal = Math.round(newVal / range.step) * range.step;
      if (range.integer) newVal = Math.round(newVal);
      mutatedGenes[param] = newVal;
    }
  }

  normalizeWeights(mutatedGenes);
  return { ...genome, genes: mutatedGenes, fitness: 0 };
}

// Pattern-specific tournament selection (uses shared algorithm with PatternGenome type)
function tournamentSelect(
  population: PatternGenome[],
  tournamentSize: number
): PatternGenome {
  // PatternGenome is compatible with Genome interface for fitness-based selection
  return sharedTournamentSelect(
    population as any,
    tournamentSize
  ) as unknown as PatternGenome;
}

// ============= INDICATOR HELPERS =============
// Wrapper to convert nullable arrays to NaN-filled arrays for compatibility

function toNaNArray(arr: (number | null)[]): number[] {
  return arr.map((v) => v ?? NaN);
}

function getLastValue(arr: (number | null)[]): number {
  const val = arr[arr.length - 1];
  return val ?? NaN;
}

// ============= ADVANCED PATTERN DETECTION =============

function findPeaksAndTroughs(
  prices: number[],
  windowSize: number,
  sensitivity: number
): { peaks: number[]; troughs: number[] } {
  const peaks: number[] = [];
  const troughs: number[] = [];

  for (let i = windowSize; i < prices.length - windowSize; i++) {
    const window = prices.slice(i - windowSize, i + windowSize + 1);
    const center = prices[i];
    const maxInWindow = Math.max(...window);
    const minInWindow = Math.min(...window);

    // Adjustable sensitivity
    const range = maxInWindow - minInWindow;
    const threshold = range * (1 - sensitivity / 2);

    if (center >= maxInWindow - threshold * 0.05) peaks.push(i);
    if (center <= minInWindow + threshold * 0.05) troughs.push(i);
  }

  return { peaks, troughs };
}

function detectAdvancedPatterns(
  closes: number[],
  highs: number[],
  lows: number[],
  genes: Record<string, number>
): ChartPattern[] {
  const patterns: ChartPattern[] = [];
  const len = closes.length;

  const lookbackWindow = genes.patternLookbackWindow || 20;
  if (len < lookbackWindow) return patterns;

  const { peaks, troughs } = findPeaksAndTroughs(
    closes,
    genes.peakTroughWindow || 3,
    genes.peakTroughSensitivity || 1.0
  );

  const minDist = genes.patternMinDistance || 5;
  const maxDist = genes.patternMaxDistance || 40;

  // ===== DOUBLE BOTTOM =====
  if (troughs.length >= 2) {
    const recentTroughs = troughs.filter((t) => t >= len - lookbackWindow);
    for (let i = 0; i < recentTroughs.length - 1; i++) {
      for (let j = i + 1; j < recentTroughs.length; j++) {
        const t1 = recentTroughs[i];
        const t2 = recentTroughs[j];
        const distance = t2 - t1;

        if (distance >= minDist && distance <= maxDist) {
          const price1 = lows[t1];
          const price2 = lows[t2];
          const priceDiff = Math.abs(price1 - price2) / price1;

          if (priceDiff < (genes.doubleTopBottomTolerance || 0.02)) {
            const currentPrice = closes[len - 1];
            const breakout =
              currentPrice >
              Math.max(price1, price2) *
                (1 + (genes.patternBreakoutConfirmation || 0.02));
            const confidence = breakout ? 0.75 : 0.55;
            const strength =
              (1 - priceDiff / (genes.doubleTopBottomTolerance || 0.02)) *
              (genes.doubleBottomWeight || 1.0);

            if (confidence >= (genes.minPatternConfidence || 0.4)) {
              patterns.push({
                type: "double_bottom",
                confidence,
                direction: "bullish",
                strength,
                startIdx: t1,
                endIdx: len - 1,
              });
            }
          }
        }
      }
    }
  }

  // ===== DOUBLE TOP =====
  if (peaks.length >= 2) {
    const recentPeaks = peaks.filter((p) => p >= len - lookbackWindow);
    for (let i = 0; i < recentPeaks.length - 1; i++) {
      for (let j = i + 1; j < recentPeaks.length; j++) {
        const p1 = recentPeaks[i];
        const p2 = recentPeaks[j];
        const distance = p2 - p1;

        if (distance >= minDist && distance <= maxDist) {
          const price1 = highs[p1];
          const price2 = highs[p2];
          const priceDiff = Math.abs(price1 - price2) / price1;

          if (priceDiff < (genes.doubleTopBottomTolerance || 0.02)) {
            const currentPrice = closes[len - 1];
            const breakdown =
              currentPrice <
              Math.min(price1, price2) *
                (1 - (genes.patternBreakoutConfirmation || 0.02));
            const confidence = breakdown ? 0.75 : 0.55;
            const strength =
              (1 - priceDiff / (genes.doubleTopBottomTolerance || 0.02)) *
              (genes.doubleTopWeight || 1.0);

            if (confidence >= (genes.minPatternConfidence || 0.4)) {
              patterns.push({
                type: "double_top",
                confidence,
                direction: "bearish",
                strength: -strength,
                startIdx: p1,
                endIdx: len - 1,
              });
            }
          }
        }
      }
    }
  }

  // ===== HEAD AND SHOULDERS =====
  if (peaks.length >= 3) {
    const recentPeaks = peaks
      .filter((p) => p >= len - lookbackWindow)
      .slice(-5);
    if (recentPeaks.length >= 3) {
      for (let i = 0; i <= recentPeaks.length - 3; i++) {
        const left = highs[recentPeaks[i]];
        const head = highs[recentPeaks[i + 1]];
        const right = highs[recentPeaks[i + 2]];

        const shoulderSymmetry = Math.abs(left - right) / left;
        const headHigher = head > left && head > right;

        if (
          headHigher &&
          shoulderSymmetry < (genes.headShouldersSymmetryTolerance || 0.05)
        ) {
          const confidence = 0.7 * (genes.headShouldersWeight || 1.0);
          const strength = -(
            1 -
            shoulderSymmetry / (genes.headShouldersSymmetryTolerance || 0.05)
          );

          if (confidence >= (genes.minPatternConfidence || 0.4)) {
            patterns.push({
              type: "head_shoulders",
              confidence,
              direction: "bearish",
              strength: strength * (genes.headShouldersWeight || 1.0),
              startIdx: recentPeaks[i],
              endIdx: len - 1,
            });
          }
        }
      }
    }
  }

  // ===== INVERSE HEAD AND SHOULDERS =====
  if (troughs.length >= 3) {
    const recentTroughs = troughs
      .filter((t) => t >= len - lookbackWindow)
      .slice(-5);
    if (recentTroughs.length >= 3) {
      for (let i = 0; i <= recentTroughs.length - 3; i++) {
        const left = lows[recentTroughs[i]];
        const head = lows[recentTroughs[i + 1]];
        const right = lows[recentTroughs[i + 2]];

        const shoulderSymmetry = Math.abs(left - right) / left;
        const headLower = head < left && head < right;

        if (
          headLower &&
          shoulderSymmetry < (genes.headShouldersSymmetryTolerance || 0.05)
        ) {
          const confidence = 0.7 * (genes.invHeadShouldersWeight || 1.0);
          const strength =
            1 -
            shoulderSymmetry / (genes.headShouldersSymmetryTolerance || 0.05);

          if (confidence >= (genes.minPatternConfidence || 0.4)) {
            patterns.push({
              type: "inv_head_shoulders",
              confidence,
              direction: "bullish",
              strength: strength * (genes.invHeadShouldersWeight || 1.0),
              startIdx: recentTroughs[i],
              endIdx: len - 1,
            });
          }
        }
      }
    }
  }

  // ===== ASCENDING TRIANGLE =====
  const trianglePeriod = genes.triangleFormationPeriod || 25;
  if (
    peaks.length >= (genes.triangleMinTouches || 3) &&
    troughs.length >= (genes.triangleMinTouches || 3) &&
    len >= trianglePeriod
  ) {
    const recentPeaks = peaks
      .filter((p) => p >= len - trianglePeriod)
      .slice(-(genes.triangleMinTouches || 3));
    const recentTroughs = troughs
      .filter((t) => t >= len - trianglePeriod)
      .slice(-(genes.triangleMinTouches || 3));

    if (
      recentPeaks.length >= (genes.triangleMinTouches || 3) &&
      recentTroughs.length >= (genes.triangleMinTouches || 3)
    ) {
      const peakPrices = recentPeaks.map((p) => highs[p]);
      const troughPrices = recentTroughs.map((t) => lows[t]);

      const flatTop =
        Math.abs(Math.max(...peakPrices) - Math.min(...peakPrices)) /
        Math.max(...peakPrices);
      const risingBottom =
        troughPrices[troughPrices.length - 1] > troughPrices[0] * 1.01;

      if (
        flatTop < (genes.triangleFlatnessTolerance || 0.025) &&
        risingBottom
      ) {
        const confidence = 0.6 * (genes.ascendingTriangleWeight || 1.0);
        const strength =
          (1 - flatTop / (genes.triangleFlatnessTolerance || 0.025)) * 0.8;

        if (confidence >= (genes.minPatternConfidence || 0.4)) {
          patterns.push({
            type: "ascending_triangle",
            confidence,
            direction: "bullish",
            strength: strength * (genes.ascendingTriangleWeight || 1.0),
            startIdx: Math.min(...recentPeaks, ...recentTroughs),
            endIdx: len - 1,
          });
        }
      }
    }
  }

  // ===== DESCENDING TRIANGLE =====
  if (
    peaks.length >= (genes.triangleMinTouches || 3) &&
    troughs.length >= (genes.triangleMinTouches || 3) &&
    len >= trianglePeriod
  ) {
    const recentPeaks = peaks
      .filter((p) => p >= len - trianglePeriod)
      .slice(-(genes.triangleMinTouches || 3));
    const recentTroughs = troughs
      .filter((t) => t >= len - trianglePeriod)
      .slice(-(genes.triangleMinTouches || 3));

    if (
      recentPeaks.length >= (genes.triangleMinTouches || 3) &&
      recentTroughs.length >= (genes.triangleMinTouches || 3)
    ) {
      const peakPrices = recentPeaks.map((p) => highs[p]);
      const troughPrices = recentTroughs.map((t) => lows[t]);

      const flatBottom =
        Math.abs(Math.max(...troughPrices) - Math.min(...troughPrices)) /
        Math.max(...troughPrices);
      const fallingTop =
        peakPrices[peakPrices.length - 1] < peakPrices[0] * 0.99;

      if (
        flatBottom < (genes.triangleFlatnessTolerance || 0.025) &&
        fallingTop
      ) {
        const confidence = 0.6 * (genes.descendingTriangleWeight || 1.0);
        const strength =
          -(1 - flatBottom / (genes.triangleFlatnessTolerance || 0.025)) * 0.8;

        if (confidence >= (genes.minPatternConfidence || 0.4)) {
          patterns.push({
            type: "descending_triangle",
            confidence,
            direction: "bearish",
            strength: strength * (genes.descendingTriangleWeight || 1.0),
            startIdx: Math.min(...recentPeaks, ...recentTroughs),
            endIdx: len - 1,
          });
        }
      }
    }
  }

  // ===== BULL FLAG =====
  const flagPoleLen = genes.flagPoleLength || 15;
  const flagConsLen = genes.flagConsolidationLength || 8;
  if (len >= flagPoleLen + flagConsLen) {
    const poleStart = len - flagPoleLen - flagConsLen;
    const poleEnd = len - flagConsLen;
    const flagEnd = len - 1;

    const poleGain = (closes[poleEnd] - closes[poleStart]) / closes[poleStart];
    const flagPullback = (closes[poleEnd] - closes[flagEnd]) / closes[poleEnd];

    const minGain = genes.flagPoleMinGain || 0.08;
    const minPullback = genes.flagPullbackMin || 0.02;
    const maxPullback = genes.flagPullbackMax || 0.08;

    if (
      poleGain > minGain &&
      flagPullback > minPullback &&
      flagPullback < maxPullback
    ) {
      const confidence = 0.55 * (genes.bullFlagWeight || 0.7);
      const strength = poleGain * 0.5;

      if (confidence >= (genes.minPatternConfidence || 0.4)) {
        patterns.push({
          type: "bull_flag",
          confidence,
          direction: "bullish",
          strength: strength * (genes.bullFlagWeight || 0.7),
          startIdx: poleStart,
          endIdx: len - 1,
        });
      }
    }
  }

  // ===== BEAR FLAG =====
  if (len >= flagPoleLen + flagConsLen) {
    const poleStart = len - flagPoleLen - flagConsLen;
    const poleEnd = len - flagConsLen;
    const flagEnd = len - 1;

    const poleLoss = (closes[poleStart] - closes[poleEnd]) / closes[poleStart];
    const flagRebound = (closes[flagEnd] - closes[poleEnd]) / closes[poleEnd];

    const minLoss = genes.flagPoleMinGain || 0.08;
    const minRebound = genes.flagPullbackMin || 0.02;
    const maxRebound = genes.flagPullbackMax || 0.08;

    if (
      poleLoss > minLoss &&
      flagRebound > minRebound &&
      flagRebound < maxRebound
    ) {
      const confidence = 0.55 * (genes.bearFlagWeight || 0.7);
      const strength = -poleLoss * 0.5;

      if (confidence >= (genes.minPatternConfidence || 0.4)) {
        patterns.push({
          type: "bear_flag",
          confidence,
          direction: "bearish",
          strength: strength * (genes.bearFlagWeight || 0.7),
          startIdx: poleStart,
          endIdx: len - 1,
        });
      }
    }
  }

  return patterns;
}

// ============= SIGNAL GENERATION =============

function generateSignal(
  bars: AlpacaBar[],
  genes: Record<string, number>
): {
  score: number;
  confidence: number;
  patterns: ChartPattern[];
  patternScore: number;
} {
  if (bars.length < 50)
    return { score: 0, confidence: 0, patterns: [], patternScore: 0 };

  const closes = bars.map((b) => b.c);
  const highs = bars.map((b) => b.h);
  const lows = bars.map((b) => b.l);
  const volumes = bars.map((b) => b.v);

  // Basic technical factors (using shared indicators with null handling)
  const rsi = calculateRSI(closes, 14);
  const currentRSI = getLastValue(rsi);
  const macd = calculateMACD(closes);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);

  let technical = 0;
  if (!isNaN(currentRSI)) {
    if (currentRSI < 30) technical += 0.5;
    else if (currentRSI > 70) technical -= 0.5;
    else technical += (50 - currentRSI) / 100;
  }

  const macdHist = getLastValue(macd.histogram);
  if (!isNaN(macdHist)) {
    if (macdHist > 0) technical += 0.3;
    else technical -= 0.3;
  }
  technical = Math.max(-1, Math.min(1, technical));

  // Momentum
  const momentum5 =
    (closes[closes.length - 1] - closes[closes.length - 6]) /
    closes[closes.length - 6];
  const momentum = Math.max(-1, Math.min(1, momentum5 * 10));

  // Volatility
  const returns = closes
    .slice(-20)
    .map((c, i, arr) => (i > 0 ? (c - arr[i - 1]) / arr[i - 1] : 0));
  const volatility =
    Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length) *
    Math.sqrt(252);
  const volScore = Math.max(-1, Math.min(1, 0.5 - volatility));

  // Volume
  const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const volRatio = volumes[volumes.length - 1] / avgVol;
  const volumeScore = Math.max(-1, Math.min(1, (volRatio - 1) * 0.5));

  // Sentiment (trend)
  const current = closes[closes.length - 1];
  const sma20Last = getLastValue(sma20);
  const sma50Last = getLastValue(sma50);
  const sentiment =
    (!isNaN(sma20Last) && current > sma20Last ? 0.4 : -0.4) +
    (!isNaN(sma50Last) && current > sma50Last ? 0.4 : -0.4);

  // PATTERN DETECTION (KEY FOCUS)
  const patterns = detectAdvancedPatterns(closes, highs, lows, genes);
  let patternScore = 0;
  for (const p of patterns) {
    patternScore += p.strength * p.confidence;
  }
  patternScore = Math.max(-1, Math.min(1, patternScore));

  // Breadth
  const breadth = !isNaN(sma20Last) && current > sma20Last ? 0.5 : -0.5;

  // Correlation (mean reversion)
  const correlation = -sentiment * 0.3;

  // Weighted composite
  const score =
    technical * (genes.technicalWeight || 0.2) +
    momentum * (genes.momentumWeight || 0.2) +
    volScore * (genes.volatilityWeight || 0.08) +
    volumeScore * (genes.volumeWeight || 0.12) +
    sentiment * (genes.sentimentWeight || 0.12) +
    patternScore * (genes.patternWeight || 0.1) +
    breadth * (genes.breadthWeight || 0.08) +
    correlation * (genes.correlationWeight || 0.1);

  const factors = [
    technical,
    momentum,
    volScore,
    volumeScore,
    sentiment,
    patternScore,
    breadth,
    correlation,
  ];
  const posCount = factors.filter((f) => f > 0.2).length;
  const negCount = factors.filter((f) => f < -0.2).length;
  const agreement = Math.max(posCount, negCount) / factors.length;
  const confidence = agreement * Math.abs(score);

  return { score, confidence, patterns, patternScore };
}

// ============= BACKTEST ENGINE =============

async function runBacktest(
  genome: PatternGenome,
  bars: Map<string, AlpacaBar[]>,
  startDate: Date,
  endDate: Date
): Promise<BacktestResult> {
  const genes = genome.genes;
  const initialCapital = 100000;
  let capital = initialCapital;
  const trades: TradeResult[] = [];
  const equity: number[] = [capital];
  const dailyReturns: number[] = [];
  const positions: Map<
    string,
    {
      entry: number;
      shares: number;
      entryDate: string;
      stopLoss: number;
      takeProfit: number;
      patterns: ChartPattern[];
      patternScore: number;
    }
  > = new Map();

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
      const currentBar = symbolBars.find((b) => b.t === currentDate);
      if (!currentBar) continue;

      const high = currentBar.h;
      const low = currentBar.l;
      let exitPrice: number | null = null;

      if (low <= pos.stopLoss) exitPrice = pos.stopLoss;
      else if (high >= pos.takeProfit) exitPrice = pos.takeProfit;

      if (exitPrice) {
        const pnl = (exitPrice - pos.entry) * pos.shares;
        const pnlPct = (exitPrice - pos.entry) / pos.entry;
        capital += pos.shares * exitPrice;
        trades.push({
          symbol,
          entry: pos.entry,
          exit: exitPrice,
          pnl,
          pnlPct,
          holdingDays: dayIdx - tradingDays.indexOf(pos.entryDate),
          entryDate: pos.entryDate,
          exitDate: currentDate,
          patterns: pos.patterns,
          patternScore: pos.patternScore,
        });
        positions.delete(symbol);
      }
    }

    // Check entries
    if (positions.size < (genes.maxPositions || 20)) {
      const candidates: {
        symbol: string;
        score: number;
        confidence: number;
        price: number;
        atr: number;
        patterns: ChartPattern[];
        patternScore: number;
      }[] = [];

      for (const [symbol, symbolBars] of bars) {
        if (positions.has(symbol)) continue;
        const barsToDate = symbolBars
          .filter((b) => b.t <= currentDate)
          .slice(-60);
        if (barsToDate.length < 50) continue;

        const signal = generateSignal(barsToDate, genes);
        if (
          signal.score >= (genes.buyThreshold || 0.12) &&
          signal.confidence >= (genes.confidenceMin || 0.28)
        ) {
          const currentBar = barsToDate[barsToDate.length - 1];
          const closes = barsToDate.map((b) => b.c);
          const highs = barsToDate.map((b) => b.h);
          const lows = barsToDate.map((b) => b.l);
          const atr = calculateATR(highs, lows, closes, 14);
          const atrValue = getLastValue(atr);
          if (!isNaN(atrValue)) {
            candidates.push({
              symbol,
              score: signal.score,
              confidence: signal.confidence,
              price: currentBar.c,
              atr: atrValue,
              patterns: signal.patterns,
              patternScore: signal.patternScore,
            });
          }
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      for (const candidate of candidates.slice(
        0,
        (genes.maxPositions || 20) - positions.size
      )) {
        const maxPositionSize = capital * (genes.maxPositionPct || 0.05);
        const shares = Math.floor(maxPositionSize / candidate.price);

        if (shares > 0 && shares * candidate.price <= capital) {
          const stopLoss =
            candidate.price - candidate.atr * (genes.atrMultStop || 1.5);
          const takeProfit =
            candidate.price + candidate.atr * (genes.atrMultTarget || 4);
          positions.set(candidate.symbol, {
            entry: candidate.price,
            shares,
            entryDate: currentDate,
            stopLoss,
            takeProfit,
            patterns: candidate.patterns,
            patternScore: candidate.patternScore,
          });
          capital -= shares * candidate.price;
        }
      }
    }

    // Update equity
    let currentEquity = capital;
    for (const [symbol, pos] of positions) {
      const symbolBars = bars.get(symbol);
      if (symbolBars) {
        const currentBar = symbolBars.find((b) => b.t === currentDate);
        if (currentBar) currentEquity += pos.shares * currentBar.c;
      }
    }
    equity.push(currentEquity);
    if (equity.length > 1)
      dailyReturns.push(
        (currentEquity - equity[equity.length - 2]) / equity[equity.length - 2]
      );
  }

  // Close remaining positions
  for (const [symbol, pos] of positions) {
    const symbolBars = bars.get(symbol);
    if (symbolBars && symbolBars.length > 0) {
      const lastBar = symbolBars[symbolBars.length - 1];
      const exitPrice = lastBar.c;
      trades.push({
        symbol,
        entry: pos.entry,
        exit: exitPrice,
        pnl: (exitPrice - pos.entry) * pos.shares,
        pnlPct: (exitPrice - pos.entry) / pos.entry,
        holdingDays: tradingDays.length - tradingDays.indexOf(pos.entryDate),
        entryDate: pos.entryDate,
        exitDate: tradingDays[tradingDays.length - 1],
        patterns: pos.patterns,
        patternScore: pos.patternScore,
      });
    }
  }

  // Calculate metrics
  const totalReturn =
    (equity[equity.length - 1] - initialCapital) / initialCapital;
  const maxDrawdown = equity.reduce((maxDD, val, i) => {
    const peak = Math.max(...equity.slice(0, i + 1));
    return Math.max(maxDD, (peak - val) / peak);
  }, 0);

  const avgReturn =
    dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const stdReturn = Math.sqrt(
    dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
      (dailyReturns.length || 1)
  );
  const sharpe =
    stdReturn > 0 ? (avgReturn * 252) / (stdReturn * Math.sqrt(252)) : 0;
  const negativeReturns = dailyReturns.filter((r) => r < 0);
  const downstdReturn = Math.sqrt(
    negativeReturns.reduce((sum, r) => sum + r * r, 0) /
      (negativeReturns.length || 1)
  );
  const sortino =
    downstdReturn > 0
      ? (avgReturn * 252) / (downstdReturn * Math.sqrt(252))
      : 0;
  const years = tradingDays.length / 252;
  const cagr = Math.pow(1 + totalReturn, 1 / years) - 1;
  const calmar = maxDrawdown > 0 ? cagr / maxDrawdown : 0;
  const winRate =
    trades.length > 0
      ? trades.filter((t) => t.pnl > 0).length / trades.length
      : 0;

  // Pattern analytics
  const patternTrades = trades.filter((t) => t.patterns.length > 0);
  const patternWinRate =
    patternTrades.length > 0
      ? patternTrades.filter((t) => t.pnl > 0).length / patternTrades.length
      : 0;
  const avgPatternStrength =
    patternTrades.length > 0
      ? patternTrades.reduce((sum, t) => sum + Math.abs(t.patternScore), 0) /
        patternTrades.length
      : 0;

  const patternTypeStats: Record<
    string,
    { count: number; winRate: number; avgReturn: number }
  > = {};
  for (const trade of patternTrades) {
    for (const pattern of trade.patterns) {
      if (!patternTypeStats[pattern.type]) {
        patternTypeStats[pattern.type] = { count: 0, winRate: 0, avgReturn: 0 };
      }
      patternTypeStats[pattern.type].count++;
    }
  }

  for (const pType of Object.keys(patternTypeStats)) {
    const pTrades = patternTrades.filter((t) =>
      t.patterns.some((p) => p.type === pType)
    );
    const pWins = pTrades.filter((t) => t.pnl > 0).length;
    patternTypeStats[pType].winRate = pWins / pTrades.length;
    patternTypeStats[pType].avgReturn =
      pTrades.reduce((sum, t) => sum + t.pnlPct, 0) / pTrades.length;
  }

  return {
    totalReturn,
    sharpe,
    sortino,
    calmar,
    maxDrawdown,
    winRate,
    trades,
    equity,
    dailyReturns,
    patternTradeCount: patternTrades.length,
    patternWinRate,
    avgPatternStrength,
    patternTypeStats,
  };
}

function calculateFitness(result: BacktestResult): number {
  const {
    sharpe,
    sortino,
    calmar,
    winRate,
    totalReturn,
    maxDrawdown,
    trades,
    patternWinRate,
  } = result;

  if (trades.length < 30) return -1000 + trades.length * 10;
  if (maxDrawdown > 0.35) return -500 * maxDrawdown;

  // Emphasize pattern performance
  const patternBonus = patternWinRate > winRate ? 10 : 0;

  return (
    sharpe * 25 +
    sortino * 20 +
    calmar * 25 +
    winRate * 100 +
    totalReturn * 80 +
    (1 - maxDrawdown) * 15 +
    Math.min(trades.length / 400, 1) * 5 +
    patternBonus
  );
}

// ============= MAIN =============

async function loadHistoricalData(): Promise<Map<string, AlpacaBar[]>> {
  const bars = new Map<string, AlpacaBar[]>();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);

  const start = startDate.toISOString().split("T")[0];
  const end = endDate.toISOString().split("T")[0];

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
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      // Skip
    }
    process.stdout.write(`\r  Loaded ${loaded}/${SYMBOLS.length} symbols`);
  }

  console.log(`\n  Successfully loaded ${bars.size} symbols`);
  return bars;
}

async function runPatternOptimizer() {
  console.log("═".repeat(80));
  console.log("  OMAR PATTERN DETECTION OPTIMIZER - 1000+ ITERATIONS");
  console.log("═".repeat(80));
  console.log(`\n  Focus Areas:`);
  console.log(`  - Pattern recognition sensitivity and thresholds`);
  console.log(`  - Pattern detection windows (10-30 days)`);
  console.log(`  - Pattern strength thresholds and weights`);
  console.log(`  - Individual pattern effectiveness analysis`);
  console.log(`  - Peak/trough detection parameters`);
  console.log(`\n  Configuration:`);
  console.log(`  - Total Iterations: ${TOTAL_ITERATIONS.toLocaleString()}`);
  console.log(`  - Population Size: ${POPULATION_SIZE}`);
  console.log(
    `  - Pattern Parameters: ${Object.keys(PATTERN_PARAM_RANGES).filter((k) => k.includes("pattern") || k.includes("Peak") || k.includes("double") || k.includes("triangle") || k.includes("flag") || k.includes("head")).length}`
  );

  const bars = await loadHistoricalData();
  if (bars.size < 10) {
    console.error("Insufficient data. Aborting.");
    return;
  }

  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);
  const endDate = new Date();

  // Initialize population
  let population: PatternGenome[] = [];
  for (let i = 0; i < POPULATION_SIZE; i++) {
    population.push(generateRandomGenome(0));
  }

  let globalBest: PatternGenome | null = null;
  let globalBestResult: BacktestResult | null = null;
  let totalEvaluations = 0;

  const totalGenerations = Math.ceil(TOTAL_ITERATIONS / POPULATION_SIZE);

  console.log("\n" + "─".repeat(80));
  console.log("  STARTING PATTERN OPTIMIZATION");
  console.log("─".repeat(80));

  for (let generation = 0; generation < totalGenerations; generation++) {
    const genStartTime = Date.now();

    // Evaluate population
    for (const genome of population) {
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
          genome.patternTradeCount = result.patternTradeCount;
          genome.patternWinRate = result.patternWinRate;
          genome.avgPatternStrength = result.avgPatternStrength;
          genome.patternTypeStats = result.patternTypeStats;
          totalEvaluations++;

          if (!globalBest || fitness > globalBest.fitness) {
            globalBest = { ...genome };
            globalBestResult = result;
            console.log(`\n  🎯 NEW BEST (Gen ${generation})`);
            console.log(
              `     Fitness: ${fitness.toFixed(2)} | Sharpe: ${result.sharpe.toFixed(2)} | Sortino: ${result.sortino.toFixed(2)} | Calmar: ${result.calmar.toFixed(2)}`
            );
            console.log(
              `     Return: ${(result.totalReturn * 100).toFixed(1)}% | MaxDD: ${(result.maxDrawdown * 100).toFixed(1)}% | Win Rate: ${(result.winRate * 100).toFixed(1)}%`
            );
            console.log(
              `     Trades: ${result.trades.length} | Pattern Trades: ${result.patternTradeCount} (${(result.patternWinRate * 100).toFixed(1)}% WR)`
            );
            console.log(
              `     Pattern Weight: ${genome.genes.patternWeight?.toFixed(3)} | Avg Strength: ${result.avgPatternStrength.toFixed(3)}`
            );
          }
        } catch (err) {
          genome.fitness = -10000;
        }
      }
    }

    // Sort by fitness
    population.sort((a, b) => b.fitness - a.fitness);

    // Create new generation
    const newPopulation: PatternGenome[] = [];

    // Elitism
    for (let i = 0; i < ELITE_COUNT; i++) {
      newPopulation.push({ ...population[i], generation: generation + 1 });
    }

    // Crossover and mutation
    while (newPopulation.length < POPULATION_SIZE) {
      if (Math.random() < CROSSOVER_RATE) {
        const parent1 = tournamentSelect(population, TOURNAMENT_SIZE);
        const parent2 = tournamentSelect(population, TOURNAMENT_SIZE);
        let child = crossover(parent1, parent2, generation + 1);
        if (Math.random() < MUTATION_RATE) child = mutate(child, MUTATION_RATE);
        newPopulation.push(child);
      } else {
        const parent = tournamentSelect(population, TOURNAMENT_SIZE);
        const mutant = mutate(parent, MUTATION_RATE);
        mutant.generation = generation + 1;
        newPopulation.push(mutant);
      }
    }

    population = newPopulation;

    const avgFitness =
      population.reduce((sum, g) => sum + g.fitness, 0) / population.length;
    const bestFitness = population[0].fitness;
    const genTime = (Date.now() - genStartTime) / 1000;
    const progress = (((generation + 1) / totalGenerations) * 100).toFixed(1);
    const eta = genTime * (totalGenerations - generation - 1);

    if (generation % 5 === 0 || generation === totalGenerations - 1) {
      console.log(
        `\n  Gen ${generation + 1}/${totalGenerations} (${progress}%) | ETA: ${Math.round(eta)}s`
      );
      console.log(`  ├─ Evaluations: ${totalEvaluations.toLocaleString()}`);
      console.log(
        `  ├─ Avg Fitness: ${avgFitness.toFixed(2)} | Best: ${bestFitness.toFixed(2)}`
      );
      console.log(
        `  └─ Global Best: ${globalBest?.fitness.toFixed(2) || "N/A"}`
      );
    }
  }

  console.log("\n" + "═".repeat(80));
  console.log("  PATTERN OPTIMIZATION COMPLETE");
  console.log("═".repeat(80));

  if (globalBest && globalBestResult) {
    console.log(`\n  🏆 BEST PATTERN DETECTION CONFIGURATION:`);
    console.log(`  ${"─".repeat(40)}`);
    console.log(`  Fitness Score: ${globalBest.fitness.toFixed(2)}`);
    console.log(`  Sharpe Ratio: ${globalBestResult.sharpe.toFixed(3)}`);
    console.log(`  Sortino Ratio: ${globalBestResult.sortino.toFixed(3)}`);
    console.log(`  Calmar Ratio: ${globalBestResult.calmar.toFixed(3)}`);
    console.log(
      `  Total Return: ${(globalBestResult.totalReturn * 100).toFixed(2)}%`
    );
    console.log(
      `  Max Drawdown: ${(globalBestResult.maxDrawdown * 100).toFixed(2)}%`
    );
    console.log(`  Win Rate: ${(globalBestResult.winRate * 100).toFixed(1)}%`);
    console.log(`  Total Trades: ${globalBestResult.trades.length}`);

    console.log(`\n  PATTERN PERFORMANCE:`);
    console.log(
      `  Pattern Trades: ${globalBestResult.patternTradeCount} (${((globalBestResult.patternTradeCount / globalBestResult.trades.length) * 100).toFixed(1)}% of total)`
    );
    console.log(
      `  Pattern Win Rate: ${(globalBestResult.patternWinRate * 100).toFixed(1)}%`
    );
    console.log(
      `  Avg Pattern Strength: ${globalBestResult.avgPatternStrength.toFixed(3)}`
    );

    console.log(`\n  PATTERN TYPE BREAKDOWN:`);
    const sortedPatterns = Object.entries(
      globalBestResult.patternTypeStats
    ).sort((a, b) => b[1].count - a[1].count);
    for (const [pType, stats] of sortedPatterns) {
      console.log(
        `  ${pType.padEnd(22)}: ${String(stats.count).padStart(3)} trades | WR: ${(stats.winRate * 100).toFixed(1).padStart(5)}% | Avg Return: ${(stats.avgReturn * 100).toFixed(2).padStart(6)}%`
      );
    }

    console.log(`\n  OPTIMAL PATTERN PARAMETERS:`);
    const p = globalBest.genes;
    console.log(`  Detection Windows:`);
    console.log(`    - Pattern Lookback: ${p.patternLookbackWindow} days`);
    console.log(`    - Peak/Trough Window: ${p.peakTroughWindow}`);
    console.log(
      `    - Peak/Trough Sensitivity: ${p.peakTroughSensitivity?.toFixed(2)}`
    );
    console.log(
      `    - Min/Max Distance: ${p.patternMinDistance}-${p.patternMaxDistance} days`
    );

    console.log(`\n  Pattern Thresholds:`);
    console.log(
      `    - Double Top/Bottom Tolerance: ${p.doubleTopBottomTolerance?.toFixed(3)}`
    );
    console.log(
      `    - Triangle Flatness Tolerance: ${p.triangleFlatnessTolerance?.toFixed(3)}`
    );
    console.log(
      `    - H&S Symmetry Tolerance: ${p.headShouldersSymmetryTolerance?.toFixed(3)}`
    );
    console.log(
      `    - Min Pattern Confidence: ${p.minPatternConfidence?.toFixed(2)}`
    );
    console.log(
      `    - Breakout Confirmation: ${p.patternBreakoutConfirmation?.toFixed(3)}`
    );

    console.log(`\n  Pattern Weights:`);
    console.log(`    - Overall Pattern Weight: ${p.patternWeight?.toFixed(3)}`);
    console.log(`    - Double Bottom: ${p.doubleBottomWeight?.toFixed(2)}`);
    console.log(`    - Double Top: ${p.doubleTopWeight?.toFixed(2)}`);
    console.log(`    - Head & Shoulders: ${p.headShouldersWeight?.toFixed(2)}`);
    console.log(`    - Inv H&S: ${p.invHeadShouldersWeight?.toFixed(2)}`);
    console.log(
      `    - Ascending Triangle: ${p.ascendingTriangleWeight?.toFixed(2)}`
    );
    console.log(
      `    - Descending Triangle: ${p.descendingTriangleWeight?.toFixed(2)}`
    );
    console.log(`    - Bull Flag: ${p.bullFlagWeight?.toFixed(2)}`);
    console.log(`    - Bear Flag: ${p.bearFlagWeight?.toFixed(2)}`);

    console.log(`\n  Flag Pattern Config:`);
    console.log(`    - Pole Min Gain: ${p.flagPoleMinGain?.toFixed(3)}`);
    console.log(`    - Pole Length: ${p.flagPoleLength} days`);
    console.log(
      `    - Consolidation Length: ${p.flagConsolidationLength} days`
    );
    console.log(
      `    - Pullback Range: ${p.flagPullbackMin?.toFixed(3)}-${p.flagPullbackMax?.toFixed(3)}`
    );

    console.log(`\n  Triangle Config:`);
    console.log(`    - Min Touches: ${p.triangleMinTouches}`);
    console.log(`    - Formation Period: ${p.triangleFormationPeriod} days`);

    console.log(`\n  Other Factor Weights:`);
    console.log(`    - Technical: ${p.technicalWeight?.toFixed(3)}`);
    console.log(`    - Momentum: ${p.momentumWeight?.toFixed(3)}`);
    console.log(`    - Volatility: ${p.volatilityWeight?.toFixed(3)}`);
    console.log(`    - Volume: ${p.volumeWeight?.toFixed(3)}`);
    console.log(`    - Sentiment: ${p.sentimentWeight?.toFixed(3)}`);
    console.log(`    - Breadth: ${p.breadthWeight?.toFixed(3)}`);
    console.log(`    - Correlation: ${p.correlationWeight?.toFixed(3)}`);

    console.log(`\n  Risk Parameters:`);
    console.log(`    - Max Position: ${(p.maxPositionPct! * 100).toFixed(1)}%`);
    console.log(`    - Max Positions: ${p.maxPositions}`);
    console.log(`    - ATR Stop: ${p.atrMultStop?.toFixed(2)}x`);
    console.log(`    - ATR Target: ${p.atrMultTarget?.toFixed(2)}x`);
    console.log(`    - Buy Threshold: ${p.buyThreshold?.toFixed(3)}`);
    console.log(`    - Confidence Min: ${p.confidenceMin?.toFixed(3)}`);

    console.log(`\n  Total Evaluations: ${totalEvaluations.toLocaleString()}`);
  }

  console.log("\n" + "═".repeat(80));
}

runPatternOptimizer().catch(console.error);
