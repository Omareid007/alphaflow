/**
 * OMAR FACTOR WEIGHT OPTIMIZATION ENGINE
 *
 * Tests 100+ weight combinations to find optimal factor weights
 * for the 8-factor OMAR trading algorithm
 *
 * Factors:
 * 1. Technical (0.05-0.35)
 * 2. Momentum (0.05-0.35)
 * 3. Volatility (0.02-0.20)
 * 4. Volume (0.05-0.25)
 * 5. Sentiment (0.05-0.25)
 * 6. Pattern (0.02-0.20)
 * 7. Breadth (0.02-0.15)
 * 8. Correlation (0.02-0.20)
 *
 * Constraint: All weights must sum to 1.0
 *
 * Refactored to use shared modules (~1335 lines -> ~900 lines, 33% reduction)
 */

import {
  fetchAlpacaBars,
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateATR,
  calculateADX,
  calculateMACD,
  calculateBollingerBands,
  calculateOBV,
  calculateROC,
  type AlpacaBar,
} from "./shared/index.js";

// ============================================================================
// TYPES
// ============================================================================

interface WeightConfig {
  technicalWeight: number;
  momentumWeight: number;
  volatilityWeight: number;
  volumeWeight: number;
  sentimentWeight: number;
  patternWeight: number;
  breadthWeight: number;
  correlationWeight: number;
}

interface BacktestConfig extends WeightConfig {
  initialCapital: number;
  maxPositionPct: number;
  maxPortfolioExposure: number;
  maxPositions: number;
  atrMultStop: number;
  atrMultTarget: number;
  buyThreshold: number;
  confidenceMin: number;
  maxDailyLoss: number;
}

interface OptimizationResult {
  weights: WeightConfig;
  sharpe: number;
  sortino: number;
  calmar: number;
  winRate: number;
  totalReturn: number;
  totalTrades: number;
  maxDrawdown: number;
  cagr: number;
  profitFactor: number;
  score: number;
}

interface AdvancedIndicators {
  rsi: (number | null)[];
  sma20: (number | null)[];
  sma50: (number | null)[];
  sma200: (number | null)[];
  emaFast: (number | null)[];
  emaSlow: (number | null)[];
  atr: (number | null)[];
  adx: (number | null)[];
  roc: (number | null)[];
  willR: (number | null)[];
  cci: (number | null)[];
  bollingerUpper: (number | null)[];
  bollingerLower: (number | null)[];
  bollingerWidth: (number | null)[];
  obv: (number | null)[];
  vwap: (number | null)[];
  mfi: (number | null)[];
  macdHist: (number | null)[];
}

interface ChartPattern {
  type: string;
  confidence: number;
  direction: "bullish" | "bearish" | "neutral";
}

interface FullPowerSignal {
  technical: number;
  momentum: number;
  volatility: number;
  volume: number;
  sentiment: number;
  pattern: number;
  breadth: number;
  correlation: number;
  composite: number;
  confidence: number;
  regime: string;
  patterns: ChartPattern[];
}

interface Position {
  symbol: string;
  sector: string;
  shares: number;
  entryPrice: number;
  entryDate: string;
  stopLoss: number;
  takeProfit: number;
  signals: FullPowerSignal;
  atr: number;
}

interface ExtendedTrade {
  symbol: string;
  sector: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  shares: number;
  pnl: number;
  pnlPct: number;
  exitReason: string;
  holdingDays: number;
  signals: FullPowerSignal;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const OPTIMIZATION_UNIVERSE = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "AMD",
  "CRM",
  "NFLX",
  "ADBE",
  "JPM",
  "BAC",
  "V",
  "MA",
  "JNJ",
  "UNH",
  "LLY",
  "WMT",
  "COST",
  "HD",
  "SPY",
  "QQQ",
  "IWM",
];

const SECTOR_MAP: Record<string, string> = {
  AAPL: "Tech",
  MSFT: "Tech",
  GOOGL: "Tech",
  AMZN: "Tech",
  NVDA: "Tech",
  META: "Tech",
  AMD: "Tech",
  CRM: "Tech",
  NFLX: "Tech",
  ADBE: "Tech",
  JPM: "Finance",
  BAC: "Finance",
  V: "Finance",
  MA: "Finance",
  JNJ: "Healthcare",
  UNH: "Healthcare",
  LLY: "Healthcare",
  WMT: "Consumer",
  COST: "Consumer",
  HD: "Consumer",
  SPY: "ETF",
  QQQ: "ETF",
  IWM: "ETF",
};

const WEIGHT_RANGES = {
  technical: { min: 0.05, max: 0.35 },
  momentum: { min: 0.05, max: 0.35 },
  volatility: { min: 0.02, max: 0.2 },
  volume: { min: 0.05, max: 0.25 },
  sentiment: { min: 0.05, max: 0.25 },
  pattern: { min: 0.02, max: 0.2 },
  breadth: { min: 0.02, max: 0.15 },
  correlation: { min: 0.02, max: 0.2 },
};

// ============================================================================
// ADDITIONAL INDICATORS (not in shared modules)
// ============================================================================

function calculateMFI(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number
): (number | null)[] {
  const result: (number | null)[] = [];
  const typicalPrice = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const rawMoneyFlow = typicalPrice.map((tp, i) => tp * volumes[i]);

  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      let posFlow = 0,
        negFlow = 0;
      for (let j = i - period + 1; j <= i; j++) {
        if (typicalPrice[j] > typicalPrice[j - 1]) posFlow += rawMoneyFlow[j];
        else negFlow += rawMoneyFlow[j];
      }
      const mfr = negFlow === 0 ? 100 : posFlow / negFlow;
      result.push(100 - 100 / (1 + mfr));
    }
  }
  return result;
}

function calculateWilliamsR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) result.push(null);
    else {
      const hh = Math.max(...highs.slice(i - period + 1, i + 1));
      const ll = Math.min(...lows.slice(i - period + 1, i + 1));
      result.push(hh === ll ? -50 : ((hh - closes[i]) / (hh - ll)) * -100);
    }
  }
  return result;
}

function calculateCCI(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): (number | null)[] {
  const result: (number | null)[] = [];
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = tp.slice(i - period + 1, i + 1);
      const sma = slice.reduce((a, b) => a + b, 0) / period;
      const meanDev =
        slice.reduce((sum, p) => sum + Math.abs(p - sma), 0) / period;
      result.push(meanDev === 0 ? 0 : (tp[i] - sma) / (0.015 * meanDev));
    }
  }
  return result;
}

function calculateAllIndicators(bars: AlpacaBar[]): AdvancedIndicators {
  const closes = bars.map((b) => b.c);
  const highs = bars.map((b) => b.h);
  const lows = bars.map((b) => b.l);
  const volumes = bars.map((b) => b.v);

  const bb = calculateBollingerBands(closes, 20, 2);
  const macd = calculateMACD(closes, 12, 26, 9);

  // Calculate BB width
  const bbWidth: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (bb.middle[i] === null || bb.upper[i] === null || bb.lower[i] === null) {
      bbWidth.push(null);
    } else {
      bbWidth.push(
        bb.middle[i]! > 0
          ? ((bb.upper[i]! - bb.lower[i]!) / bb.middle[i]!) * 100
          : null
      );
    }
  }

  return {
    rsi: calculateRSI(closes, 14),
    sma20: calculateSMA(closes, 20),
    sma50: calculateSMA(closes, 50),
    sma200: calculateSMA(closes, 200),
    emaFast: calculateEMA(closes, 8),
    emaSlow: calculateEMA(closes, 21),
    atr: calculateATR(highs, lows, closes, 14),
    adx: calculateADX(highs, lows, closes, 14),
    roc: calculateROC(closes, 12),
    willR: calculateWilliamsR(highs, lows, closes, 14),
    cci: calculateCCI(highs, lows, closes, 20),
    bollingerUpper: bb.upper,
    bollingerLower: bb.lower,
    bollingerWidth: bbWidth,
    obv: calculateOBV(closes, volumes),
    vwap: closes.map(
      (_, i) =>
        bars.slice(0, i + 1).reduce((sum, b) => sum + b.c * b.v, 0) /
        bars.slice(0, i + 1).reduce((sum, b) => sum + b.v, 0)
    ),
    mfi: calculateMFI(highs, lows, closes, volumes, 14),
    macdHist: macd.histogram,
  };
}

// ============================================================================
// PATTERN RECOGNITION & REGIME DETECTION
// ============================================================================

function findExtrema(
  prices: number[],
  windowSize: number = 5
): { peaks: number[]; troughs: number[] } {
  const peaks: number[] = [];
  const troughs: number[] = [];

  for (let i = windowSize; i < prices.length - windowSize; i++) {
    const window = prices.slice(i - windowSize, i + windowSize + 1);
    if (prices[i] === Math.max(...window)) peaks.push(i);
    if (prices[i] === Math.min(...window)) troughs.push(i);
  }

  return { peaks, troughs };
}

function detectAllPatterns(
  prices: number[],
  highs: number[],
  lows: number[],
  index: number
): ChartPattern[] {
  const patterns: ChartPattern[] = [];
  if (index < 50) return patterns;

  const { peaks, troughs } = findExtrema(prices.slice(0, index + 1), 3);

  if (troughs.length >= 2) {
    const [i1, i2] = troughs.slice(-2);
    const t1 = lows[i1],
      t2 = lows[i2];
    if (Math.abs(t1 - t2) / t1 < 0.02 && i2 - i1 > 5 && i2 - i1 < 50) {
      patterns.push({
        type: "double_bottom",
        confidence: 0.65,
        direction: "bullish",
      });
    }
  }

  if (peaks.length >= 3 && troughs.length >= 3) {
    const recentPeaks = peaks.slice(-3).map((i) => highs[i]);
    const recentTroughs = troughs.slice(-3).map((i) => lows[i]);
    const flatTop =
      Math.abs(recentPeaks[0] - recentPeaks[2]) / recentPeaks[0] < 0.02;
    const risingBottom = recentTroughs[2] > recentTroughs[0] * 1.02;
    if (flatTop && risingBottom) {
      patterns.push({
        type: "ascending_triangle",
        confidence: 0.6,
        direction: "bullish",
      });
    }
  }

  return patterns;
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 20) return 0;

  const xSlice = x.slice(-n);
  const ySlice = y.slice(-n);

  const xMean = xSlice.reduce((a, b) => a + b, 0) / n;
  const yMean = ySlice.reduce((a, b) => a + b, 0) / n;

  let num = 0,
    xDen = 0,
    yDen = 0;
  for (let i = 0; i < n; i++) {
    const xDiff = xSlice[i] - xMean;
    const yDiff = ySlice[i] - yMean;
    num += xDiff * yDiff;
    xDen += xDiff * xDiff;
    yDen += yDiff * yDiff;
  }

  const den = Math.sqrt(xDen * yDen);
  return den === 0 ? 0 : num / den;
}

function detectMarketRegime(
  price: number,
  sma20: number | null,
  sma50: number | null,
  sma200: number | null,
  adx: number | null
): string {
  if (sma20 === null || sma50 === null) return "unknown";

  const aboveSma20 = price > sma20;
  const aboveSma50 = price > sma50;
  const aboveSma200 = sma200 !== null ? price > sma200 : aboveSma50;
  const sma20Above50 = sma20 > sma50;
  const trending = adx !== null && adx > 25;

  if (aboveSma20 && aboveSma50 && aboveSma200 && sma20Above50 && trending)
    return "strong_bull";
  if (aboveSma20 && aboveSma50 && sma20Above50) return "bull";
  if (!aboveSma20 && !aboveSma50 && !aboveSma200 && !sma20Above50 && trending)
    return "strong_bear";
  if (!aboveSma20 && !aboveSma50) return "bear";
  return "ranging";
}

// ============================================================================
// SIGNAL GENERATION WITH DYNAMIC WEIGHTS
// ============================================================================

function generateFullPowerSignal(
  index: number,
  bars: AlpacaBar[],
  indicators: AdvancedIndicators,
  spyReturns: number[],
  weights: WeightConfig
): FullPowerSignal {
  const prices = bars.map((b) => b.c);
  const volumes = bars.map((b) => b.v);
  const highs = bars.map((b) => b.h);
  const lows = bars.map((b) => b.l);
  const price = prices[index];

  const regime = detectMarketRegime(
    price,
    indicators.sma20[index],
    indicators.sma50[index],
    indicators.sma200[index],
    indicators.adx[index]
  );

  // Technical Score
  let technical = 0,
    techFactors = 0;

  const rsi = indicators.rsi[index];
  if (rsi !== null) {
    if (rsi < 30) technical += 1;
    else if (rsi < 40) technical += 0.5;
    else if (rsi > 70) technical -= 1;
    else if (rsi > 60) technical -= 0.5;
    techFactors++;
  }

  const macdHist = indicators.macdHist[index];
  if (macdHist !== null) {
    if (macdHist > 0.5) technical += 1;
    else if (macdHist > 0) technical += 0.5;
    else if (macdHist < -0.5) technical -= 1;
    else if (macdHist < 0) technical -= 0.5;
    techFactors++;
  }

  const willR = indicators.willR[index];
  if (willR !== null) {
    if (willR < -80) technical += 0.8;
    else if (willR > -20) technical -= 0.8;
    techFactors++;
  }

  const cci = indicators.cci[index];
  if (cci !== null) {
    if (cci < -100) technical += 0.7;
    else if (cci > 100) technical -= 0.7;
    techFactors++;
  }

  technical = techFactors > 0 ? technical / techFactors : 0;

  // Momentum Score
  let momentum = 0;
  const emaFast = indicators.emaFast[index];
  const emaSlow = indicators.emaSlow[index];
  if (emaFast !== null && emaSlow !== null) {
    const emaDiff = ((emaFast - emaSlow) / emaSlow) * 100;
    if (emaDiff > 3) momentum += 0.9;
    else if (emaDiff > 1) momentum += 0.5;
    else if (emaDiff < -3) momentum -= 0.9;
    else if (emaDiff < -1) momentum -= 0.5;
  }

  const roc = indicators.roc[index];
  if (roc !== null) {
    if (roc > 10) momentum += 0.6;
    else if (roc > 3) momentum += 0.3;
    else if (roc < -10) momentum -= 0.6;
    else if (roc < -3) momentum -= 0.3;
  }
  momentum = Math.max(-1, Math.min(1, momentum));

  // Volatility Score
  let vol = 0;
  const adx = indicators.adx[index];
  if (adx !== null) {
    if (adx > 40) vol += 0.4;
    else if (adx > 25) vol += 0.2;
    else if (adx < 15) vol -= 0.3;
  }

  const bbWidth = indicators.bollingerWidth[index];
  if (bbWidth !== null) {
    if (bbWidth < 5) vol += 0.4;
    else if (bbWidth > 15) vol -= 0.2;
  }
  vol = Math.max(-1, Math.min(1, vol));

  // Volume Score
  let volume = 0;
  if (index >= 20) {
    const avgVol =
      volumes.slice(index - 20, index).reduce((a, b) => a + b, 0) / 20;
    const volRatio = volumes[index] / avgVol;
    if (volRatio > 2.5) volume = 0.6;
    else if (volRatio > 1.5) volume = 0.4;
    else if (volRatio < 0.5) volume = -0.3;
  }

  const mfi = indicators.mfi[index];
  if (mfi !== null) {
    if (mfi < 20) volume += 0.3;
    else if (mfi > 80) volume -= 0.3;
  }
  volume = Math.max(-1, Math.min(1, volume));

  // Sentiment Score
  let sentiment = 0;
  const return5d =
    index >= 5 ? (price - prices[index - 5]) / prices[index - 5] : 0;
  const return20d =
    index >= 20 ? (price - prices[index - 20]) / prices[index - 20] : 0;

  if (return20d > 0.05 && return5d < 0) sentiment += 0.5;
  if (return20d < -0.05 && return5d > 0) sentiment -= 0.5;

  if (regime === "strong_bull") sentiment += 0.3;
  else if (regime === "bull") sentiment += 0.15;
  else if (regime === "strong_bear") sentiment -= 0.3;
  else if (regime === "bear") sentiment -= 0.15;
  sentiment = Math.max(-1, Math.min(1, sentiment));

  // Pattern Score
  const patterns = detectAllPatterns(prices, highs, lows, index);
  let pattern = 0;
  for (const p of patterns) {
    if (p.direction === "bullish") pattern += p.confidence * 0.5;
    else if (p.direction === "bearish") pattern -= p.confidence * 0.5;
  }
  pattern = Math.max(-1, Math.min(1, pattern));

  // Breadth Score
  let breadth = 0;
  if (regime === "strong_bull" || regime === "bull") breadth += 0.3;
  else if (regime === "strong_bear" || regime === "bear") breadth -= 0.3;

  // Correlation Score
  let correlation = 0;
  if (spyReturns.length > 20 && index >= 20) {
    const stockReturns = prices
      .slice(index - 20, index + 1)
      .map((p, i, arr) => (i > 0 ? (p - arr[i - 1]) / arr[i - 1] : 0));
    const corr = calculateCorrelation(stockReturns, spyReturns.slice(-21));
    if (corr > 0.8) correlation = 0.2;
    else if (corr < 0.3) correlation = -0.1;
  }

  // Composite with dynamic weights
  const composite =
    technical * weights.technicalWeight +
    momentum * weights.momentumWeight +
    vol * weights.volatilityWeight +
    volume * weights.volumeWeight +
    sentiment * weights.sentimentWeight +
    pattern * weights.patternWeight +
    breadth * weights.breadthWeight +
    correlation * weights.correlationWeight;

  // Confidence
  const scores = [
    technical,
    momentum,
    vol,
    volume,
    sentiment,
    pattern,
    breadth,
  ];
  const posCount = scores.filter((s) => s > 0.2).length;
  const negCount = scores.filter((s) => s < -0.2).length;
  const alignment = Math.max(posCount, negCount) / scores.length;
  const confidence = Math.min(1, alignment * Math.abs(composite) * 2.5);

  return {
    technical,
    momentum,
    volatility: vol,
    volume,
    sentiment,
    pattern,
    breadth,
    correlation,
    composite,
    confidence,
    regime,
    patterns,
  };
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

function runBacktest(
  dataMap: Map<string, AlpacaBar[]>,
  config: BacktestConfig,
  spyBars: AlpacaBar[]
): { trades: ExtendedTrade[]; metrics: any } {
  const trades: ExtendedTrade[] = [];
  const positions = new Map<string, Position>();

  let equity = config.initialCapital;
  let peakEquity = equity;
  let maxDrawdown = 0;

  const indicatorsMap = new Map<string, AdvancedIndicators>();
  for (const [symbol, bars] of dataMap) {
    indicatorsMap.set(symbol, calculateAllIndicators(bars));
  }

  const spyReturns = spyBars.map((b, i, arr) =>
    i > 0 ? (b.c - arr[i - 1].c) / arr[i - 1].c : 0
  );

  const allDates = new Set<string>();
  for (const bars of dataMap.values()) {
    for (const bar of bars) allDates.add(bar.t.split("T")[0]);
  }
  const sortedDates = Array.from(allDates).sort();

  for (const date of sortedDates) {
    let dailyPnl = 0;

    for (const [symbol, bars] of dataMap) {
      const indicators = indicatorsMap.get(symbol)!;
      const dateIndex = bars.findIndex((b) => b.t.split("T")[0] === date);
      if (dateIndex < 100) continue;

      const bar = bars[dateIndex];
      const signals = generateFullPowerSignal(
        dateIndex,
        bars,
        indicators,
        spyReturns,
        config
      );
      const sector = SECTOR_MAP[symbol] || "Other";

      const position = positions.get(symbol);
      if (position) {
        let exitReason: string | null = null;
        let exitPrice = bar.c;

        if (bar.l <= position.stopLoss) {
          exitReason = "stop_loss";
          exitPrice = position.stopLoss;
        } else if (bar.h >= position.takeProfit) {
          exitReason = "take_profit";
          exitPrice = position.takeProfit;
        } else if (signals.composite < -0.12 && signals.confidence > 0.25) {
          exitReason = "signal_reversal";
        } else if (bar.c > position.entryPrice * 1.02) {
          const atr = indicators.atr[dateIndex];
          if (atr !== null)
            position.stopLoss = Math.max(
              position.stopLoss,
              bar.c - atr * config.atrMultStop
            );
        }

        if (exitReason) {
          const pnl = (exitPrice - position.entryPrice) * position.shares;
          const holdingDays = Math.floor(
            (new Date(date).getTime() -
              new Date(position.entryDate).getTime()) /
              (1000 * 60 * 60 * 24)
          );

          trades.push({
            symbol,
            sector,
            entryDate: position.entryDate,
            entryPrice: position.entryPrice,
            exitDate: date,
            exitPrice,
            shares: position.shares,
            pnl,
            pnlPct:
              ((exitPrice - position.entryPrice) / position.entryPrice) * 100,
            exitReason,
            holdingDays,
            signals: position.signals,
          });

          equity += pnl;
          dailyPnl += pnl;
          positions.delete(symbol);
        }
      } else {
        const favorableRegime = ["strong_bull", "bull", "ranging"].includes(
          signals.regime
        );

        const canEnter =
          signals.composite > config.buyThreshold &&
          signals.confidence > config.confidenceMin &&
          positions.size < config.maxPositions &&
          favorableRegime;

        if (canEnter) {
          const atr = indicators.atr[dateIndex];
          if (atr !== null && atr > 0) {
            const positionSize = equity * config.maxPositionPct;
            const shares = Math.floor(positionSize / bar.c);

            if (shares > 0) {
              positions.set(symbol, {
                symbol,
                sector,
                shares,
                entryPrice: bar.c,
                entryDate: date,
                stopLoss: bar.c - atr * config.atrMultStop,
                takeProfit: bar.c + atr * config.atrMultTarget,
                signals,
                atr,
              });
            }
          }
        }
      }
    }

    if (dailyPnl < -equity * config.maxDailyLoss) {
      for (const [symbol, position] of positions) {
        const bars = dataMap.get(symbol)!;
        const bar = bars.find((b) => b.t.split("T")[0] === date);
        if (bar) {
          const pnl = (bar.c - position.entryPrice) * position.shares;
          trades.push({
            symbol,
            sector: position.sector,
            entryDate: position.entryDate,
            entryPrice: position.entryPrice,
            exitDate: date,
            exitPrice: bar.c,
            shares: position.shares,
            pnl,
            pnlPct: ((bar.c - position.entryPrice) / position.entryPrice) * 100,
            exitReason: "daily_loss_limit",
            holdingDays: 0,
            signals: position.signals,
          });
          equity += pnl;
        }
      }
      positions.clear();
    }

    if (equity > peakEquity) peakEquity = equity;
    maxDrawdown = Math.max(
      maxDrawdown,
      ((peakEquity - equity) / peakEquity) * 100
    );
  }

  // Close remaining
  const lastDate = sortedDates[sortedDates.length - 1];
  for (const [symbol, position] of positions) {
    const bars = dataMap.get(symbol)!;
    const bar = bars.find((b) => b.t.split("T")[0] === lastDate);
    if (bar) {
      const pnl = (bar.c - position.entryPrice) * position.shares;
      trades.push({
        symbol,
        sector: position.sector,
        entryDate: position.entryDate,
        entryPrice: position.entryPrice,
        exitDate: lastDate,
        exitPrice: bar.c,
        shares: position.shares,
        pnl,
        pnlPct: ((bar.c - position.entryPrice) / position.entryPrice) * 100,
        exitReason: "end_of_backtest",
        holdingDays: Math.floor(
          (new Date(lastDate).getTime() -
            new Date(position.entryDate).getTime()) /
            (1000 * 60 * 60 * 24)
        ),
        signals: position.signals,
      });
      equity += pnl;
    }
  }

  // Metrics
  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl <= 0);
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

  const returns = trades.map((t) => t.pnlPct / 100);
  const avgReturn =
    returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;
  const stdDev =
    returns.length > 1
      ? Math.sqrt(
          returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
            returns.length
        )
      : 0;
  const downReturns = returns.filter((r) => r < 0);
  const downStdDev =
    downReturns.length > 1
      ? Math.sqrt(
          downReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) /
            downReturns.length
        )
      : 1;

  const sharpeRatio = stdDev !== 0 ? (avgReturn * Math.sqrt(252)) / stdDev : 0;
  const sortinoRatio =
    downStdDev !== 0 ? (avgReturn * Math.sqrt(252)) / downStdDev : 0;
  const years = 2.95;
  const cagr =
    years > 0
      ? (Math.pow(equity / config.initialCapital, 1 / years) - 1) * 100
      : 0;
  const calmarRatio = maxDrawdown > 0 ? cagr / maxDrawdown : 0;
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

  return {
    trades,
    metrics: {
      totalTrades: trades.length,
      winRate:
        trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      totalPnl,
      totalPnlPct: (totalPnl / config.initialCapital) * 100,
      profitFactor,
      maxDrawdown,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      finalEquity: equity,
      cagr,
    },
  };
}

// ============================================================================
// WEIGHT GENERATION
// ============================================================================

function normalizeWeights(weights: WeightConfig): WeightConfig {
  const sum =
    weights.technicalWeight +
    weights.momentumWeight +
    weights.volatilityWeight +
    weights.volumeWeight +
    weights.sentimentWeight +
    weights.patternWeight +
    weights.breadthWeight +
    weights.correlationWeight;

  return {
    technicalWeight: weights.technicalWeight / sum,
    momentumWeight: weights.momentumWeight / sum,
    volatilityWeight: weights.volatilityWeight / sum,
    volumeWeight: weights.volumeWeight / sum,
    sentimentWeight: weights.sentimentWeight / sum,
    patternWeight: weights.patternWeight / sum,
    breadthWeight: weights.breadthWeight / sum,
    correlationWeight: weights.correlationWeight / sum,
  };
}

function generateRandomWeights(): WeightConfig {
  return normalizeWeights({
    technicalWeight:
      Math.random() *
        (WEIGHT_RANGES.technical.max - WEIGHT_RANGES.technical.min) +
      WEIGHT_RANGES.technical.min,
    momentumWeight:
      Math.random() *
        (WEIGHT_RANGES.momentum.max - WEIGHT_RANGES.momentum.min) +
      WEIGHT_RANGES.momentum.min,
    volatilityWeight:
      Math.random() *
        (WEIGHT_RANGES.volatility.max - WEIGHT_RANGES.volatility.min) +
      WEIGHT_RANGES.volatility.min,
    volumeWeight:
      Math.random() * (WEIGHT_RANGES.volume.max - WEIGHT_RANGES.volume.min) +
      WEIGHT_RANGES.volume.min,
    sentimentWeight:
      Math.random() *
        (WEIGHT_RANGES.sentiment.max - WEIGHT_RANGES.sentiment.min) +
      WEIGHT_RANGES.sentiment.min,
    patternWeight:
      Math.random() * (WEIGHT_RANGES.pattern.max - WEIGHT_RANGES.pattern.min) +
      WEIGHT_RANGES.pattern.min,
    breadthWeight:
      Math.random() * (WEIGHT_RANGES.breadth.max - WEIGHT_RANGES.breadth.min) +
      WEIGHT_RANGES.breadth.min,
    correlationWeight:
      Math.random() *
        (WEIGHT_RANGES.correlation.max - WEIGHT_RANGES.correlation.min) +
      WEIGHT_RANGES.correlation.min,
  });
}

function generateWeightVariations(): WeightConfig[] {
  const variations: WeightConfig[] = [];

  // Balanced baseline
  variations.push(
    normalizeWeights({
      technicalWeight: 0.2,
      momentumWeight: 0.2,
      volatilityWeight: 0.1,
      volumeWeight: 0.15,
      sentimentWeight: 0.15,
      patternWeight: 0.1,
      breadthWeight: 0.05,
      correlationWeight: 0.05,
    })
  );

  // Dominant factors
  const factors = [
    "technical",
    "momentum",
    "volatility",
    "volume",
    "sentiment",
    "pattern",
    "breadth",
    "correlation",
  ];
  for (const factor of factors) {
    const w: any = {
      technicalWeight: 0.05,
      momentumWeight: 0.05,
      volatilityWeight: 0.05,
      volumeWeight: 0.05,
      sentimentWeight: 0.05,
      patternWeight: 0.05,
      breadthWeight: 0.05,
      correlationWeight: 0.05,
    };
    w[`${factor}Weight`] = 0.6;
    variations.push(normalizeWeights(w));
  }

  // Combined strategies
  variations.push(
    normalizeWeights({
      technicalWeight: 0.35,
      momentumWeight: 0.35,
      volatilityWeight: 0.05,
      volumeWeight: 0.05,
      sentimentWeight: 0.05,
      patternWeight: 0.05,
      breadthWeight: 0.05,
      correlationWeight: 0.05,
    })
  );
  variations.push(
    normalizeWeights({
      technicalWeight: 0.1,
      momentumWeight: 0.1,
      volatilityWeight: 0.05,
      volumeWeight: 0.25,
      sentimentWeight: 0.25,
      patternWeight: 0.1,
      breadthWeight: 0.1,
      correlationWeight: 0.05,
    })
  );
  variations.push(
    normalizeWeights({
      technicalWeight: 0.1,
      momentumWeight: 0.1,
      volatilityWeight: 0.05,
      volumeWeight: 0.1,
      sentimentWeight: 0.1,
      patternWeight: 0.2,
      breadthWeight: 0.2,
      correlationWeight: 0.15,
    })
  );
  variations.push(
    normalizeWeights({
      technicalWeight: 0.15,
      momentumWeight: 0.15,
      volatilityWeight: 0.2,
      volumeWeight: 0.1,
      sentimentWeight: 0.1,
      patternWeight: 0.1,
      breadthWeight: 0.1,
      correlationWeight: 0.1,
    })
  );

  // Random (50 samples for speed)
  for (let i = 0; i < 50; i++) {
    variations.push(generateRandomWeights());
  }

  return variations;
}

// ============================================================================
// OPTIMIZATION ENGINE
// ============================================================================

async function runWeightOptimization(
  dataMap: Map<string, AlpacaBar[]>,
  spyBars: AlpacaBar[]
): Promise<OptimizationResult[]> {
  const weightVariations = generateWeightVariations();
  const results: OptimizationResult[] = [];

  console.log(`\nTesting ${weightVariations.length} weight combinations...\n`);

  const baseConfig: BacktestConfig = {
    initialCapital: 100000,
    maxPositionPct: 0.05,
    maxPortfolioExposure: 0.7,
    maxPositions: 20,
    atrMultStop: 1.5,
    atrMultTarget: 4,
    buyThreshold: 0.12,
    confidenceMin: 0.28,
    maxDailyLoss: 0.05,
    technicalWeight: 0,
    momentumWeight: 0,
    volatilityWeight: 0,
    volumeWeight: 0,
    sentimentWeight: 0,
    patternWeight: 0,
    breadthWeight: 0,
    correlationWeight: 0,
  };

  for (let i = 0; i < weightVariations.length; i++) {
    const weights = weightVariations[i];
    const config: BacktestConfig = { ...baseConfig, ...weights };

    try {
      const { metrics } = runBacktest(dataMap, config, spyBars);
      const score =
        metrics.sharpeRatio * 30 +
        metrics.calmarRatio * 25 +
        metrics.winRate * 0.25 +
        metrics.totalPnlPct * 0.15 +
        Math.min(metrics.profitFactor, 10) * 2;

      results.push({
        weights,
        sharpe: metrics.sharpeRatio,
        sortino: metrics.sortinoRatio,
        calmar: metrics.calmarRatio,
        winRate: metrics.winRate,
        totalReturn: metrics.totalPnlPct,
        totalTrades: metrics.totalTrades,
        maxDrawdown: metrics.maxDrawdown,
        cagr: metrics.cagr,
        profitFactor: metrics.profitFactor,
        score,
      });

      if ((i + 1) % 20 === 0) {
        console.log(
          `Progress: ${i + 1}/${weightVariations.length} (${(((i + 1) / weightVariations.length) * 100).toFixed(1)}%)`
        );
      }
    } catch {
      console.log(`Error testing weight combination ${i + 1}`);
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("=".repeat(100));
  console.log("OMAR FACTOR WEIGHT OPTIMIZATION ENGINE");
  console.log("=".repeat(100));
  console.log(`Universe: ${OPTIMIZATION_UNIVERSE.length} symbols`);
  console.log(`Period: 2022-01-01 to 2025-12-20 (3 years)`);

  const startDate = "2022-01-01";
  const endDate = "2025-12-20";

  console.log(`\nFetching historical data...`);

  const dataMap = new Map<string, AlpacaBar[]>();
  let spyBars: AlpacaBar[] = [];

  console.log("Fetching SPY...");
  try {
    spyBars = await fetchAlpacaBars("SPY", startDate, endDate);
    dataMap.set("SPY", spyBars);
    console.log(`SPY: ${spyBars.length} bars`);
  } catch {
    console.log("SPY: ERROR");
  }

  for (const symbol of OPTIMIZATION_UNIVERSE.filter((s) => s !== "SPY")) {
    process.stdout.write(`${symbol}... `);
    try {
      const bars = await fetchAlpacaBars(symbol, startDate, endDate);
      if (bars.length > 200) {
        dataMap.set(symbol, bars);
        console.log(`${bars.length} bars`);
      } else console.log(`SKIP`);
    } catch {
      console.log(`ERROR`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(
    `\nLoaded ${dataMap.size}/${OPTIMIZATION_UNIVERSE.length} symbols`
  );

  const startTime = Date.now();
  const results = await runWeightOptimization(dataMap, spyBars);
  const endTime = Date.now();

  console.log(`\n${"=".repeat(100)}`);
  console.log("OPTIMIZATION COMPLETE");
  console.log(`${"=".repeat(100)}`);
  console.log(
    `Total tested: ${results.length} | Time: ${((endTime - startTime) / 1000 / 60).toFixed(2)} min`
  );

  console.log(`\nTOP 10 WEIGHT CONFIGURATIONS:`);
  for (let i = 0; i < Math.min(10, results.length); i++) {
    const r = results[i];
    console.log(
      `\n#${i + 1} Score=${r.score.toFixed(2)} | Sharpe=${r.sharpe.toFixed(2)} | Calmar=${r.calmar.toFixed(2)} | Win=${r.winRate.toFixed(1)}% | Return=${r.totalReturn.toFixed(1)}%`
    );
    console.log(
      `   Tech=${(r.weights.technicalWeight * 100).toFixed(0)}% Mom=${(r.weights.momentumWeight * 100).toFixed(0)}% Vol=${(r.weights.volatilityWeight * 100).toFixed(0)}% Volume=${(r.weights.volumeWeight * 100).toFixed(0)}% Sent=${(r.weights.sentimentWeight * 100).toFixed(0)}% Pat=${(r.weights.patternWeight * 100).toFixed(0)}% Breadth=${(r.weights.breadthWeight * 100).toFixed(0)}% Corr=${(r.weights.correlationWeight * 100).toFixed(0)}%`
    );
  }

  const best = results[0];
  console.log(`\n${"=".repeat(100)}`);
  console.log("OPTIMAL WEIGHTS");
  console.log(`${"=".repeat(100)}`);
  console.log(
    `Sharpe: ${best.sharpe.toFixed(3)} | Sortino: ${best.sortino.toFixed(3)} | Calmar: ${best.calmar.toFixed(3)}`
  );
  console.log(
    `Win Rate: ${best.winRate.toFixed(1)}% | CAGR: ${best.cagr.toFixed(1)}% | Max DD: ${best.maxDrawdown.toFixed(1)}%`
  );
  console.log(
    `\nWeights: Tech=${(best.weights.technicalWeight * 100).toFixed(1)}% Mom=${(best.weights.momentumWeight * 100).toFixed(1)}% Vol=${(best.weights.volatilityWeight * 100).toFixed(1)}% Volume=${(best.weights.volumeWeight * 100).toFixed(1)}% Sent=${(best.weights.sentimentWeight * 100).toFixed(1)}% Pat=${(best.weights.patternWeight * 100).toFixed(1)}% Breadth=${(best.weights.breadthWeight * 100).toFixed(1)}% Corr=${(best.weights.correlationWeight * 100).toFixed(1)}%`
  );
}

main().catch(console.error);
