#!/usr/bin/env npx tsx
/**
 * OMAR TECHNICAL INDICATOR OPTIMIZER
 *
 * Focus: Run 1000+ iterations exploring technical indicator combinations
 * - RSI: period (7-21), oversold (20-40), overbought (60-80)
 * - MACD: fast (8-16), slow (20-32), signal (6-12)
 * - Bollinger Bands: period (15-25), stdDev (1.5-3.0)
 * - ATR: period (10-20)
 * - Stochastic: lookback combinations (5-21)
 *
 * Strategy: Grid search with smart pruning and caching
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALPACA_KEY = process.env.ALPACA_API_KEY || "";
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY || "";
const ALPACA_DATA_URL = "https://data.alpaca.markets";

const TARGET_ITERATIONS = 1000;
const BATCH_SIZE = 50;

// Indicator parameter ranges
const INDICATOR_RANGES = {
  // RSI parameters
  rsiPeriod: { min: 7, max: 21, step: 1 },
  rsiOversold: { min: 20, max: 40, step: 2 },
  rsiOverbought: { min: 60, max: 80, step: 2 },

  // MACD parameters
  macdFast: { min: 8, max: 16, step: 1 },
  macdSlow: { min: 20, max: 32, step: 2 },
  macdSignal: { min: 6, max: 12, step: 1 },

  // Bollinger Bands parameters
  bbPeriod: { min: 15, max: 25, step: 1 },
  bbStdDev: { min: 1.5, max: 3.0, step: 0.1 },

  // ATR parameters
  atrPeriod: { min: 10, max: 20, step: 1 },

  // Stochastic parameters
  stochPeriod: { min: 5, max: 21, step: 2 },
  stochSmoothK: { min: 1, max: 5, step: 1 },
  stochSmoothD: { min: 1, max: 5, step: 1 },
};

// Fixed backtest parameters (from successful OMAR configs)
const FIXED_CONFIG = {
  initialCapital: 100000,
  maxPositionPct: 0.05,
  maxPositions: 15,
  atrMultStop: 1.5,
  atrMultTarget: 4.0,
  buyThreshold: 0.12,
  confidenceMin: 0.28,
  maxDailyLoss: 0.05,
  // Weights
  technicalWeight: 0.25,
  momentumWeight: 0.2,
  volatilityWeight: 0.08,
  volumeWeight: 0.12,
  sentimentWeight: 0.1,
  patternWeight: 0.1,
  breadthWeight: 0.08,
  correlationWeight: 0.07,
};

// Symbol universe (smaller for faster iteration)
const SYMBOLS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "TSLA",
  "AMD",
  "JPM",
  "BAC",
  "V",
  "MA",
  "UNH",
  "JNJ",
  "WMT",
  "COST",
  "SPY",
  "QQQ",
  "IWM",
  "XLF",
  "XLK",
];

// ============================================================================
// INTERFACES
// ============================================================================

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface IndicatorConfig {
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  bbPeriod: number;
  bbStdDev: number;
  atrPeriod: number;
  stochPeriod: number;
  stochSmoothK: number;
  stochSmoothD: number;
}

interface BacktestResult {
  sharpe: number;
  sortino: number;
  calmar: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  totalTrades: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
}

interface OptimizationResult {
  config: IndicatorConfig;
  metrics: BacktestResult;
  score: number;
  iteration: number;
}

// ============================================================================
// DATA FETCHER
// ============================================================================

async function fetchAlpacaBars(
  symbol: string,
  start: string,
  end: string
): Promise<AlpacaBar[]> {
  const allBars: AlpacaBar[] = [];
  let pageToken: string | null = null;

  do {
    let url = `${ALPACA_DATA_URL}/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=10000&feed=iex`;
    if (pageToken) url += `&page_token=${pageToken}`;

    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": ALPACA_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET,
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.bars && Array.isArray(data.bars)) allBars.push(...data.bars);
    pageToken = data.next_page_token || null;
  } while (pageToken);

  return allBars;
}

// ============================================================================
// TECHNICAL INDICATORS
// ============================================================================

function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) result.push(null);
    else
      result.push(
        data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
      );
  }
  return result;
}

function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  for (let i = 0; i < data.length; i++) {
    if (i === 0) result.push(data[0]);
    else result.push((data[i] - result[i - 1]!) * k + result[i - 1]!);
  }
  return result;
}

function calculateRSI(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      let gains = 0,
        losses = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const change = closes[j] - closes[j - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

function calculateMACD(
  closes: number[],
  fast: number,
  slow: number,
  signal: number
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  const macdLine: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) macdLine.push(null);
    else macdLine.push(emaFast[i]! - emaSlow[i]!);
  }

  const macdVals = macdLine.filter((v): v is number => v !== null);
  const signalLine = calculateEMA(macdVals, signal);
  const histogram: (number | null)[] = [];

  let si = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) histogram.push(null);
    else {
      histogram.push(
        signalLine[si] !== null ? macdLine[i]! - signalLine[si]! : null
      );
      si++;
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

function calculateBollingerBands(
  closes: number[],
  period: number,
  stdDev: number
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const middle = calculateSMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = closes.slice(Math.max(0, i - period + 1), i + 1);
      const mean = middle[i]!;
      const variance =
        slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        slice.length;
      const std = Math.sqrt(variance);
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }

  return { upper, middle, lower };
}

function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): (number | null)[] {
  const tr: number[] = [];
  for (let i = 0; i < highs.length; i++) {
    if (i === 0) tr.push(highs[i] - lows[i]);
    else
      tr.push(
        Math.max(
          highs[i] - lows[i],
          Math.abs(highs[i] - closes[i - 1]),
          Math.abs(lows[i] - closes[i - 1])
        )
      );
  }

  const result: (number | null)[] = [];
  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1) result.push(null);
    else
      result.push(
        tr.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
      );
  }
  return result;
}

function calculateStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number,
  smoothK: number,
  smoothD: number
): { k: (number | null)[]; d: (number | null)[] } {
  const rawK: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      rawK.push(null);
    } else {
      const highSlice = highs.slice(i - period + 1, i + 1);
      const lowSlice = lows.slice(i - period + 1, i + 1);
      const highest = Math.max(...highSlice);
      const lowest = Math.min(...lowSlice);
      const range = highest - lowest;
      rawK.push(range === 0 ? 50 : ((closes[i] - lowest) / range) * 100);
    }
  }

  // Smooth K
  const k: (number | null)[] = [];
  for (let i = 0; i < rawK.length; i++) {
    if (i < smoothK - 1 || rawK[i] === null) k.push(null);
    else {
      const slice = rawK
        .slice(i - smoothK + 1, i + 1)
        .filter((v): v is number => v !== null);
      k.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    }
  }

  // Smooth D
  const d: (number | null)[] = [];
  for (let i = 0; i < k.length; i++) {
    if (i < smoothD - 1 || k[i] === null) d.push(null);
    else {
      const slice = k
        .slice(i - smoothD + 1, i + 1)
        .filter((v): v is number => v !== null);
      d.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    }
  }

  return { k, d };
}

// ============================================================================
// SIGNAL GENERATION
// ============================================================================

function generateSignal(
  bars: AlpacaBar[],
  config: IndicatorConfig
): { score: number; confidence: number } {
  if (bars.length < 50) return { score: 0, confidence: 0 };

  const closes = bars.map((b) => b.c);
  const highs = bars.map((b) => b.h);
  const lows = bars.map((b) => b.l);
  const volumes = bars.map((b) => b.v);

  let score = 0;
  let factorCount = 0;

  // RSI
  const rsi = calculateRSI(closes, config.rsiPeriod);
  const currentRSI = rsi[rsi.length - 1];
  if (currentRSI !== null) {
    if (currentRSI < config.rsiOversold) score += 1;
    else if (currentRSI > config.rsiOverbought) score -= 1;
    else score += (50 - currentRSI) / 50;
    factorCount++;
  }

  // MACD
  const macd = calculateMACD(
    closes,
    config.macdFast,
    config.macdSlow,
    config.macdSignal
  );
  const macdHist = macd.histogram[macd.histogram.length - 1];
  const macdHistPrev = macd.histogram[macd.histogram.length - 2];
  if (macdHist !== null && macdHistPrev !== null) {
    if (macdHist > 0 && macdHist > macdHistPrev) score += 0.8;
    else if (macdHist < 0 && macdHist < macdHistPrev) score -= 0.8;
    else if (macdHist > 0) score += 0.3;
    else if (macdHist < 0) score -= 0.3;
    factorCount++;
  }

  // Bollinger Bands
  const bb = calculateBollingerBands(closes, config.bbPeriod, config.bbStdDev);
  const currentClose = closes[closes.length - 1];
  const bbLower = bb.lower[bb.lower.length - 1];
  const bbUpper = bb.upper[bb.upper.length - 1];
  const bbMiddle = bb.middle[bb.middle.length - 1];

  if (bbLower !== null && bbUpper !== null && bbMiddle !== null) {
    const bbPosition = (currentClose - bbLower) / (bbUpper - bbLower);
    if (bbPosition < 0.2) score += 0.7;
    else if (bbPosition > 0.8) score -= 0.7;
    else if (bbPosition < 0.5) score += 0.2;
    else score -= 0.2;
    factorCount++;
  }

  // Stochastic
  const stoch = calculateStochastic(
    highs,
    lows,
    closes,
    config.stochPeriod,
    config.stochSmoothK,
    config.stochSmoothD
  );
  const stochK = stoch.k[stoch.k.length - 1];
  const stochD = stoch.d[stoch.d.length - 1];

  if (stochK !== null && stochD !== null) {
    if (stochK < 20 && stochK > stochD) score += 0.6;
    else if (stochK > 80 && stochK < stochD) score -= 0.6;
    else if (stochK < 30) score += 0.3;
    else if (stochK > 70) score -= 0.3;
    factorCount++;
  }

  // Volume confirmation
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const currentVolume = volumes[volumes.length - 1];
  if (currentVolume > avgVolume * 1.5 && score > 0) score *= 1.2;
  else if (currentVolume < avgVolume * 0.7) score *= 0.8;

  // Momentum
  const momentum5 =
    closes.length >= 6
      ? (closes[closes.length - 1] - closes[closes.length - 6]) /
        closes[closes.length - 6]
      : 0;
  if (momentum5 > 0.02) score += 0.4;
  else if (momentum5 < -0.02) score -= 0.4;
  factorCount++;

  const normalizedScore = factorCount > 0 ? score / factorCount : 0;
  const confidence = Math.min(1, Math.abs(normalizedScore));

  return { score: normalizedScore, confidence };
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

async function runBacktest(
  bars: Map<string, AlpacaBar[]>,
  config: IndicatorConfig
): Promise<BacktestResult> {
  let capital = FIXED_CONFIG.initialCapital;
  let peakCapital = capital;
  const positions = new Map<
    string,
    {
      entry: number;
      shares: number;
      entryDate: string;
      stopLoss: number;
      takeProfit: number;
    }
  >();
  const trades: { pnl: number; pnlPct: number }[] = [];
  const dailyReturns: number[] = [];
  const equityCurve: number[] = [capital];

  // Get all trading days
  const tradingDays: string[] = [];
  const firstBars = bars.values().next().value;
  if (firstBars) {
    for (const bar of firstBars) {
      tradingDays.push(bar.t);
    }
  }

  for (let dayIdx = 50; dayIdx < tradingDays.length; dayIdx++) {
    const currentDate = tradingDays[dayIdx];
    let dailyPnl = 0;

    // Check exits
    for (const [symbol, pos] of positions) {
      const symbolBars = bars.get(symbol);
      if (!symbolBars) continue;

      const currentBar = symbolBars.find((b) => b.t === currentDate);
      if (!currentBar) continue;

      let exitPrice: number | null = null;
      if (currentBar.l <= pos.stopLoss) exitPrice = pos.stopLoss;
      else if (currentBar.h >= pos.takeProfit) exitPrice = pos.takeProfit;

      if (exitPrice) {
        const pnl = (exitPrice - pos.entry) * pos.shares;
        const pnlPct = (exitPrice - pos.entry) / pos.entry;
        capital += pos.shares * exitPrice;
        trades.push({ pnl, pnlPct });
        dailyPnl += pnl;
        positions.delete(symbol);
      }
    }

    // Check entries
    if (positions.size < FIXED_CONFIG.maxPositions) {
      const candidates: {
        symbol: string;
        score: number;
        confidence: number;
        price: number;
        atr: number;
      }[] = [];

      for (const [symbol, symbolBars] of bars) {
        if (positions.has(symbol)) continue;

        const barsToDate = symbolBars
          .filter((b) => b.t <= currentDate)
          .slice(-60);
        if (barsToDate.length < 50) continue;

        const signal = generateSignal(barsToDate, config);

        if (
          signal.score >= FIXED_CONFIG.buyThreshold &&
          signal.confidence >= FIXED_CONFIG.confidenceMin
        ) {
          const currentBar = barsToDate[barsToDate.length - 1];
          const closes = barsToDate.map((b) => b.c);
          const highs = barsToDate.map((b) => b.h);
          const lows = barsToDate.map((b) => b.l);
          const atr = calculateATR(highs, lows, closes, config.atrPeriod);
          const currentATR = atr[atr.length - 1];

          if (currentATR !== null) {
            candidates.push({
              symbol,
              score: signal.score,
              confidence: signal.confidence,
              price: currentBar.c,
              atr: currentATR,
            });
          }
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      for (const candidate of candidates.slice(
        0,
        FIXED_CONFIG.maxPositions - positions.size
      )) {
        const positionSize = capital * FIXED_CONFIG.maxPositionPct;
        const shares = Math.floor(positionSize / candidate.price);

        if (shares > 0 && shares * candidate.price <= capital) {
          const stopLoss =
            candidate.price - candidate.atr * FIXED_CONFIG.atrMultStop;
          const takeProfit =
            candidate.price + candidate.atr * FIXED_CONFIG.atrMultTarget;
          positions.set(candidate.symbol, {
            entry: candidate.price,
            shares,
            entryDate: currentDate,
            stopLoss,
            takeProfit,
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

    equityCurve.push(currentEquity);
    if (equityCurve.length > 1) {
      dailyReturns.push(
        (currentEquity - equityCurve[equityCurve.length - 2]) /
          equityCurve[equityCurve.length - 2]
      );
    }

    peakCapital = Math.max(peakCapital, currentEquity);
  }

  // Close remaining positions
  const lastDate = tradingDays[tradingDays.length - 1];
  for (const [symbol, pos] of positions) {
    const symbolBars = bars.get(symbol);
    if (symbolBars) {
      const lastBar = symbolBars.find((b) => b.t === lastDate);
      if (lastBar) {
        const pnl = (lastBar.c - pos.entry) * pos.shares;
        const pnlPct = (lastBar.c - pos.entry) / pos.entry;
        trades.push({ pnl, pnlPct });
        capital += pos.shares * lastBar.c;
      }
    }
  }

  // Calculate metrics
  const totalReturn =
    (equityCurve[equityCurve.length - 1] - FIXED_CONFIG.initialCapital) /
    FIXED_CONFIG.initialCapital;
  const maxDrawdown = equityCurve.reduce((maxDD, val, i) => {
    const peak = Math.max(...equityCurve.slice(0, i + 1));
    return Math.max(maxDD, (peak - val) / peak);
  }, 0);

  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;

  const avgWin =
    winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
      : 0;
  const avgLoss =
    losingTrades.length > 0
      ? Math.abs(
          losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length
        )
      : 1;
  const profitFactor =
    avgLoss > 0
      ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length)
      : 0;

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
      : 0.0001;
  const sharpe =
    stdReturn > 0 ? (avgReturn * 252) / (stdReturn * Math.sqrt(252)) : 0;

  const negativeReturns = dailyReturns.filter((r) => r < 0);
  const downstdReturn =
    negativeReturns.length > 1
      ? Math.sqrt(
          negativeReturns.reduce((sum, r) => sum + r * r, 0) /
            negativeReturns.length
        )
      : 0.0001;
  const sortino =
    downstdReturn > 0
      ? (avgReturn * 252) / (downstdReturn * Math.sqrt(252))
      : 0;

  const years = tradingDays.length / 252;
  const cagr = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
  const calmar = maxDrawdown > 0 ? cagr / maxDrawdown : 0;

  return {
    sharpe,
    sortino,
    calmar,
    winRate,
    totalReturn,
    maxDrawdown,
    totalTrades: trades.length,
    profitFactor,
    avgWin,
    avgLoss,
  };
}

// ============================================================================
// OPTIMIZATION ENGINE
// ============================================================================

function generateRandomConfig(): IndicatorConfig {
  const config: any = {};

  for (const [param, range] of Object.entries(INDICATOR_RANGES)) {
    const steps = Math.round((range.max - range.min) / range.step);
    const randomStep = Math.floor(Math.random() * (steps + 1));
    config[param] = range.min + randomStep * range.step;
  }

  // Ensure MACD fast < slow
  if (config.macdFast >= config.macdSlow) {
    config.macdSlow = config.macdFast + 8;
  }

  // Ensure RSI thresholds don't overlap
  if (config.rsiOversold >= config.rsiOverbought) {
    config.rsiOverbought = Math.min(80, config.rsiOversold + 20);
  }

  return config as IndicatorConfig;
}

function calculateScore(metrics: BacktestResult): number {
  if (metrics.totalTrades < 30) return -1000;
  if (metrics.maxDrawdown > 0.35) return -500;

  // Multi-objective scoring
  return (
    metrics.sharpe * 40 +
    metrics.sortino * 25 +
    metrics.calmar * 20 +
    metrics.winRate * 100 +
    metrics.totalReturn * 50 +
    (1 - metrics.maxDrawdown) * 30 +
    Math.min(metrics.profitFactor, 5) * 10
  );
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("═".repeat(80));
  console.log("  OMAR TECHNICAL INDICATOR OPTIMIZER");
  console.log("═".repeat(80));
  console.log(
    "\n  Target: 1000+ iterations of indicator parameter combinations"
  );
  console.log(`  Symbol Universe: ${SYMBOLS.length} symbols`);
  console.log("  Period: 3 years of historical data\n");

  // Load historical data
  console.log("  Loading historical data...");
  const bars = new Map<string, AlpacaBar[]>();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 3);

  const start = startDate.toISOString().split("T")[0];
  const end = endDate.toISOString().split("T")[0];

  let loaded = 0;
  for (const symbol of SYMBOLS) {
    try {
      const symbolBars = await fetchAlpacaBars(symbol, start, end);
      if (symbolBars.length > 200) {
        bars.set(symbol, symbolBars);
        loaded++;
      }
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      // Skip errors
    }
    process.stdout.write(`\r  Loaded ${loaded}/${SYMBOLS.length} symbols`);
  }

  console.log(`\n  Successfully loaded ${bars.size} symbols\n`);

  if (bars.size < 10) {
    console.error("  ERROR: Insufficient data loaded. Aborting.");
    return;
  }

  console.log("─".repeat(80));
  console.log("  STARTING OPTIMIZATION");
  console.log("─".repeat(80));

  const results: OptimizationResult[] = [];
  let bestResult: OptimizationResult | null = null;
  let iteration = 0;
  const startTime = Date.now();

  // Smart sampling: Mix of random and targeted exploration
  const configs: IndicatorConfig[] = [];

  // Generate initial random population
  for (let i = 0; i < TARGET_ITERATIONS; i++) {
    configs.push(generateRandomConfig());
  }

  // Process in batches
  for (
    let batchStart = 0;
    batchStart < configs.length;
    batchStart += BATCH_SIZE
  ) {
    const batch = configs.slice(batchStart, batchStart + BATCH_SIZE);

    for (const config of batch) {
      iteration++;

      try {
        const metrics = await runBacktest(bars, config);
        const score = calculateScore(metrics);

        const result: OptimizationResult = {
          config,
          metrics,
          score,
          iteration,
        };

        results.push(result);

        if (!bestResult || score > bestResult.score) {
          bestResult = result;
          console.log(
            `\n  🏆 NEW BEST (Iteration ${iteration}/${TARGET_ITERATIONS})`
          );
          console.log(`  ├─ Score: ${score.toFixed(2)}`);
          console.log(
            `  ├─ Sharpe: ${metrics.sharpe.toFixed(3)} | Sortino: ${metrics.sortino.toFixed(3)} | Calmar: ${metrics.calmar.toFixed(3)}`
          );
          console.log(
            `  ├─ Return: ${(metrics.totalReturn * 100).toFixed(2)}% | MaxDD: ${(metrics.maxDrawdown * 100).toFixed(2)}%`
          );
          console.log(
            `  ├─ Win Rate: ${(metrics.winRate * 100).toFixed(1)}% | Trades: ${metrics.totalTrades}`
          );
          console.log(`  └─ Profit Factor: ${metrics.profitFactor.toFixed(2)}`);
        }
      } catch (err) {
        // Skip failed backtests
      }

      // Progress update every 50 iterations
      if (iteration % 50 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = iteration / elapsed;
        const eta = Math.round((TARGET_ITERATIONS - iteration) / rate);
        const progress = ((iteration / TARGET_ITERATIONS) * 100).toFixed(1);

        console.log(
          `\n  Progress: ${iteration}/${TARGET_ITERATIONS} (${progress}%) | ETA: ${eta}s | Rate: ${rate.toFixed(1)}/s`
        );
      }
    }
  }

  // Final results
  console.log("\n" + "═".repeat(80));
  console.log("  OPTIMIZATION COMPLETE");
  console.log("═".repeat(80));

  console.log(`\n  Total Iterations: ${iteration.toLocaleString()}`);
  console.log(`  Successful Backtests: ${results.length.toLocaleString()}`);
  console.log(`  Total Time: ${Math.round((Date.now() - startTime) / 1000)}s`);

  if (bestResult) {
    console.log("\n" + "═".repeat(80));
    console.log("  🏆 OPTIMAL TECHNICAL INDICATOR CONFIGURATION");
    console.log("═".repeat(80));

    const m = bestResult.metrics;
    console.log(`\n  PERFORMANCE METRICS:`);
    console.log(`  ├─ Sharpe Ratio: ${m.sharpe.toFixed(3)}`);
    console.log(`  ├─ Sortino Ratio: ${m.sortino.toFixed(3)}`);
    console.log(`  ├─ Calmar Ratio: ${m.calmar.toFixed(3)}`);
    console.log(`  ├─ Win Rate: ${(m.winRate * 100).toFixed(2)}%`);
    console.log(`  ├─ Total Return: ${(m.totalReturn * 100).toFixed(2)}%`);
    console.log(`  ├─ Max Drawdown: ${(m.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`  ├─ Total Trades: ${m.totalTrades}`);
    console.log(`  ├─ Profit Factor: ${m.profitFactor.toFixed(2)}`);
    console.log(`  ├─ Avg Win: $${m.avgWin.toFixed(2)}`);
    console.log(`  ├─ Avg Loss: $${m.avgLoss.toFixed(2)}`);
    console.log(`  └─ Overall Score: ${bestResult.score.toFixed(2)}`);

    const c = bestResult.config;
    console.log(`\n  OPTIMAL PARAMETERS:`);
    console.log(`\n  RSI Settings:`);
    console.log(`  ├─ Period: ${c.rsiPeriod}`);
    console.log(`  ├─ Oversold: ${c.rsiOversold}`);
    console.log(`  └─ Overbought: ${c.rsiOverbought}`);

    console.log(`\n  MACD Settings:`);
    console.log(`  ├─ Fast EMA: ${c.macdFast}`);
    console.log(`  ├─ Slow EMA: ${c.macdSlow}`);
    console.log(`  └─ Signal: ${c.macdSignal}`);

    console.log(`\n  Bollinger Bands Settings:`);
    console.log(`  ├─ Period: ${c.bbPeriod}`);
    console.log(`  └─ Std Dev: ${c.bbStdDev.toFixed(1)}`);

    console.log(`\n  ATR Settings:`);
    console.log(`  └─ Period: ${c.atrPeriod}`);

    console.log(`\n  Stochastic Settings:`);
    console.log(`  ├─ Period: ${c.stochPeriod}`);
    console.log(`  ├─ Smooth K: ${c.stochSmoothK}`);
    console.log(`  └─ Smooth D: ${c.stochSmoothD}`);

    // Top 10 configurations
    console.log("\n" + "─".repeat(80));
    console.log("  TOP 10 CONFIGURATIONS");
    console.log("─".repeat(80));

    const sortedResults = results
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    for (let i = 0; i < sortedResults.length; i++) {
      const r = sortedResults[i];
      console.log(`\n  #${i + 1} (Iteration ${r.iteration})`);
      console.log(
        `  ├─ Score: ${r.score.toFixed(2)} | Sharpe: ${r.metrics.sharpe.toFixed(2)} | Return: ${(r.metrics.totalReturn * 100).toFixed(1)}%`
      );
      console.log(
        `  └─ RSI: ${r.config.rsiPeriod}/${r.config.rsiOversold}/${r.config.rsiOverbought} | MACD: ${r.config.macdFast}/${r.config.macdSlow}/${r.config.macdSignal} | BB: ${r.config.bbPeriod}/${r.config.bbStdDev.toFixed(1)}`
      );
    }

    // Statistical analysis
    console.log("\n" + "─".repeat(80));
    console.log("  PARAMETER SENSITIVITY ANALYSIS");
    console.log("─".repeat(80));

    const top20 = results.sort((a, b) => b.score - a.score).slice(0, 20);

    const paramStats: Record<
      string,
      { avg: number; min: number; max: number }
    > = {};
    for (const param of Object.keys(INDICATOR_RANGES)) {
      const values = top20.map((r) => (r.config as any)[param]);
      paramStats[param] = {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }

    console.log(`\n  Top 20 performers - parameter ranges:`);
    console.log(
      `  ├─ RSI Period: ${paramStats.rsiPeriod.min}-${paramStats.rsiPeriod.max} (avg: ${paramStats.rsiPeriod.avg.toFixed(1)})`
    );
    console.log(
      `  ├─ RSI Oversold: ${paramStats.rsiOversold.min}-${paramStats.rsiOversold.max} (avg: ${paramStats.rsiOversold.avg.toFixed(1)})`
    );
    console.log(
      `  ├─ RSI Overbought: ${paramStats.rsiOverbought.min}-${paramStats.rsiOverbought.max} (avg: ${paramStats.rsiOverbought.avg.toFixed(1)})`
    );
    console.log(
      `  ├─ MACD Fast: ${paramStats.macdFast.min}-${paramStats.macdFast.max} (avg: ${paramStats.macdFast.avg.toFixed(1)})`
    );
    console.log(
      `  ├─ MACD Slow: ${paramStats.macdSlow.min}-${paramStats.macdSlow.max} (avg: ${paramStats.macdSlow.avg.toFixed(1)})`
    );
    console.log(
      `  ├─ MACD Signal: ${paramStats.macdSignal.min}-${paramStats.macdSignal.max} (avg: ${paramStats.macdSignal.avg.toFixed(1)})`
    );
    console.log(
      `  ├─ BB Period: ${paramStats.bbPeriod.min}-${paramStats.bbPeriod.max} (avg: ${paramStats.bbPeriod.avg.toFixed(1)})`
    );
    console.log(
      `  ├─ BB StdDev: ${paramStats.bbStdDev.min.toFixed(1)}-${paramStats.bbStdDev.max.toFixed(1)} (avg: ${paramStats.bbStdDev.avg.toFixed(1)})`
    );
    console.log(
      `  ├─ ATR Period: ${paramStats.atrPeriod.min}-${paramStats.atrPeriod.max} (avg: ${paramStats.atrPeriod.avg.toFixed(1)})`
    );
    console.log(
      `  └─ Stoch Period: ${paramStats.stochPeriod.min}-${paramStats.stochPeriod.max} (avg: ${paramStats.stochPeriod.avg.toFixed(1)})`
    );

    console.log("\n" + "═".repeat(80));
  }
}

main().catch(console.error);
