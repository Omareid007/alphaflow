#!/usr/bin/env npx tsx
/**
 * OMAR MEAN REVERSION OPTIMIZER - 1000+ Iterations
 *
 * Focuses on mean reversion strategies with:
 * - RSI oversold levels (20-40)
 * - Bollinger Band parameters (period 15-25, stdDev 1.5-2.5)
 * - Higher correlation/volatility weights
 * - Wider stops for mean reversion (ATR mult 2.0-3.0)
 * - Moderate profit targets (ATR mult 2-4)
 */

// ============= CONFIGURATION =============
const ALPACA_KEY = process.env.ALPACA_API_KEY || "";
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY || "";
const ALPACA_DATA_URL = "https://data.alpaca.markets";

// Optimizer settings
const TOTAL_ITERATIONS = 1200;
const BATCH_SIZE = 20;

// MEAN REVERSION SPECIFIC PARAMETER RANGES
const MR_PARAM_RANGES: Record<
  string,
  { min: number; max: number; step: number; integer?: boolean }
> = {
  // Core mean reversion parameters
  rsiPeriod: { min: 10, max: 18, step: 1, integer: true },
  rsiOversold: { min: 20, max: 40, step: 1, integer: true },
  rsiOverbought: { min: 60, max: 80, step: 1, integer: true },
  bbPeriod: { min: 15, max: 25, step: 1, integer: true },
  bbStdDev: { min: 1.5, max: 2.5, step: 0.1 },

  // Risk parameters - WIDER STOPS for mean reversion
  atrMultStop: { min: 2.0, max: 3.0, step: 0.1 },
  atrMultTarget: { min: 2.0, max: 4.0, step: 0.25 },
  atrPeriod: { min: 10, max: 20, step: 2, integer: true },

  // Entry thresholds - LOWER for oversold
  buyThreshold: { min: 0.08, max: 0.2, step: 0.01 },
  confidenceMin: { min: 0.2, max: 0.4, step: 0.02 },

  // Position sizing
  maxPositionPct: { min: 0.03, max: 0.1, step: 0.01 },
  maxPositions: { min: 8, max: 25, step: 1, integer: true },
  maxPortfolioExposure: { min: 0.5, max: 0.85, step: 0.05 },
  maxDailyLoss: { min: 0.03, max: 0.08, step: 0.01 },

  // Factor weights - HIGHER correlation/volatility for mean reversion
  technicalWeight: { min: 0.15, max: 0.3, step: 0.01 },
  volatilityWeight: { min: 0.1, max: 0.25, step: 0.01 }, // HIGHER
  correlationWeight: { min: 0.1, max: 0.25, step: 0.01 }, // HIGHER
  momentumWeight: { min: 0.05, max: 0.15, step: 0.01 }, // LOWER
  volumeWeight: { min: 0.08, max: 0.18, step: 0.01 },
  sentimentWeight: { min: 0.05, max: 0.15, step: 0.01 },
  patternWeight: { min: 0.05, max: 0.15, step: 0.01 },
  breadthWeight: { min: 0.05, max: 0.15, step: 0.01 },

  // Lookback periods
  volatilityLookback: { min: 15, max: 30, step: 5, integer: true },
  correlationLookback: { min: 20, max: 60, step: 5, integer: true },
};

// Symbol universe - focus on liquid stocks
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
  "NOW",
  "JPM",
  "BAC",
  "GS",
  "V",
  "MA",
  "PYPL",
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
  "DIS",
  "CAT",
  "DE",
  "BA",
  "UPS",
  "XOM",
  "CVX",
  "COP",
  "SPY",
  "QQQ",
  "IWM",
  "XLF",
  "XLK",
];

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface MRConfig {
  id: number;
  params: Record<string, number>;
  sharpe: number;
  sortino: number;
  calmar: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  trades: number;
  avgHolding: number;
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
  entryRSI: number;
  entryBBPosition: number;
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
  avgHoldingDays: number;
}

// ============= ALPACA DATA FETCHER =============

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
  for (let i = 1; i < closes.length; i++)
    changes.push(closes[i] - closes[i - 1]);
  const gains = changes.map((c) => (c > 0 ? c : 0));
  const losses = changes.map((c) => (c < 0 ? -c : 0));
  const avgGain = calculateEMA(gains, period);
  const avgLoss = calculateEMA(losses, period);

  const rsi: number[] = [NaN];
  for (let i = 0; i < avgGain.length; i++) {
    if (avgLoss[i] === 0) rsi.push(100);
    else rsi.push(100 - 100 / (1 + avgGain[i] / avgLoss[i]));
  }
  return rsi;
}

function calculateBollingerBands(
  closes: number[],
  period: number,
  stdDev: number
): { upper: number[]; middle: number[]; lower: number[]; width: number[] } {
  const middle = calculateSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  const width: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      width.push(NaN);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const variance =
        slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
      width.push(mean > 0 ? ((upper[i] - lower[i]) / mean) * 100 : 0);
    }
  }
  return { upper, middle, lower, width };
}

function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): number[] {
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(hl, hc, lc));
  }
  return calculateEMA(tr, period);
}

function calculateStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): { k: number[]; d: number[] } {
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
  const d = calculateSMA(
    k.filter((v) => !isNaN(v)),
    3
  );
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

// ============= MEAN REVERSION SIGNAL GENERATION =============

function generateMeanReversionSignal(
  bars: AlpacaBar[],
  params: Record<string, number>
): {
  score: number;
  confidence: number;
  rsi: number;
  bbPosition: number;
  factors: Record<string, number>;
} {
  if (bars.length < 50)
    return { score: 0, confidence: 0, rsi: NaN, bbPosition: NaN, factors: {} };

  const closes = bars.map((b) => b.c);
  const highs = bars.map((b) => b.h);
  const lows = bars.map((b) => b.l);
  const volumes = bars.map((b) => b.v);

  const factors: Record<string, number> = {};

  // RSI - MEAN REVERSION FOCUSED
  const rsi = calculateRSI(closes, params.rsiPeriod || 14);
  const currentRSI = rsi[rsi.length - 1];
  const rsiOversold = params.rsiOversold || 30;
  const rsiOverbought = params.rsiOverbought || 70;

  let technicalScore = 0;
  // Strong mean reversion signal when oversold
  if (currentRSI < rsiOversold) {
    technicalScore = 0.8 + ((rsiOversold - currentRSI) / rsiOversold) * 0.2; // 0.8 to 1.0
  } else if (currentRSI < rsiOversold + 5) {
    technicalScore = 0.4; // Near oversold
  } else if (currentRSI > rsiOverbought) {
    technicalScore =
      -0.8 - ((currentRSI - rsiOverbought) / (100 - rsiOverbought)) * 0.2;
  } else if (currentRSI > rsiOverbought - 5) {
    technicalScore = -0.4;
  } else {
    // Neutral zone - slight mean reversion bias
    technicalScore = ((50 - currentRSI) / 50) * 0.3;
  }

  // Bollinger Bands - MEAN REVERSION FOCUSED
  const bb = calculateBollingerBands(
    closes,
    params.bbPeriod || 20,
    params.bbStdDev || 2
  );
  const currentClose = closes[closes.length - 1];
  const bbLower = bb.lower[bb.lower.length - 1];
  const bbUpper = bb.upper[bb.upper.length - 1];
  const bbMiddle = bb.middle[bb.middle.length - 1];

  // BB position: -1 = at lower band, 0 = at middle, 1 = at upper band
  const bbPosition =
    bbUpper - bbLower > 0
      ? (currentClose - bbMiddle) / (bbUpper - bbMiddle || 1)
      : 0;

  if (currentClose < bbLower) {
    // Below lower band - strong buy signal
    technicalScore += 0.6;
  } else if (currentClose < bbLower * 1.02) {
    // Near lower band
    technicalScore += 0.4;
  } else if (currentClose > bbUpper) {
    // Above upper band - strong sell signal
    technicalScore -= 0.6;
  } else if (currentClose > bbUpper * 0.98) {
    // Near upper band
    technicalScore -= 0.4;
  }

  factors.technical = Math.max(-1, Math.min(1, technicalScore));

  // Stochastic for additional confirmation
  const stoch = calculateStochastic(highs, lows, closes, 14);
  const stochK = stoch.k[stoch.k.length - 1];
  if (stochK < 20) technicalScore += 0.2;
  else if (stochK > 80) technicalScore -= 0.2;

  // Volatility - MEAN REVERSION THRIVES ON VOLATILITY
  const volLookback = params.volatilityLookback || 20;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++)
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const recentReturns = returns.slice(-volLookback);
  const volatility =
    Math.sqrt(
      recentReturns.reduce((sum, r) => sum + r * r, 0) / recentReturns.length
    ) * Math.sqrt(252);

  // Higher volatility is GOOD for mean reversion (more extremes to trade)
  // But not too high (instability)
  let volScore = 0;
  if (volatility > 0.2 && volatility < 0.6)
    volScore = 0.5; // Sweet spot
  else if (volatility > 0.15 && volatility < 0.7) volScore = 0.3;
  else if (volatility > 0.7)
    volScore = -0.3; // Too volatile
  else volScore = 0.1; // Low vol - harder to find extremes

  factors.volatility = volScore;

  // Correlation with mean - how far from average
  const corrLookback = params.correlationLookback || 30;
  const sma = calculateSMA(closes.slice(-corrLookback - 1), corrLookback);
  const currentSMA = sma[sma.length - 1];
  const deviation =
    currentSMA > 0 ? (currentClose - currentSMA) / currentSMA : 0;

  // Mean reversion: buy when below average, sell when above
  let corrScore = 0;
  if (deviation < -0.05)
    corrScore = 0.6; // 5%+ below mean - strong buy
  else if (deviation < -0.03)
    corrScore = 0.4; // 3-5% below
  else if (deviation < -0.01)
    corrScore = 0.2; // 1-3% below
  else if (deviation > 0.05)
    corrScore = -0.6; // 5%+ above mean
  else if (deviation > 0.03) corrScore = -0.4;
  else if (deviation > 0.01) corrScore = -0.2;

  factors.correlation = corrScore;

  // Momentum - CONTRARIAN for mean reversion
  const momentum5 =
    (closes[closes.length - 1] - closes[closes.length - 6]) /
    closes[closes.length - 6];
  const momentum10 =
    closes.length >= 11
      ? (closes[closes.length - 1] - closes[closes.length - 11]) /
        closes[closes.length - 11]
      : 0;

  // Negative momentum + oversold = good mean reversion setup
  let momScore = 0;
  if (momentum5 < -0.05 && currentRSI < rsiOversold + 10)
    momScore = 0.5; // Strong pullback in oversold
  else if (momentum5 < -0.03) momScore = 0.3;
  else if (momentum5 > 0.05 && currentRSI > rsiOverbought - 10) momScore = -0.5;
  else if (momentum5 > 0.03) momScore = -0.3;

  factors.momentum = momScore;

  // Volume - confirm the move
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = currentVolume / avgVolume;
  const obv = calculateOBV(closes, volumes);
  const obvTrend =
    obv.length > 5 ? obv[obv.length - 1] - obv[obv.length - 6] : 0;

  let volumeScore = 0;
  if (volumeRatio > 1.5 && momentum5 < 0)
    volumeScore = 0.3; // High volume selloff
  else if (volumeRatio > 1.2) volumeScore = 0.2;
  else if (volumeRatio < 0.7) volumeScore = -0.2; // Low conviction

  factors.volume = volumeScore;

  // Sentiment proxy - contrarian
  const trendUp = momentum10 > 0.05;
  const trendDown = momentum10 < -0.05;
  factors.sentiment =
    trendDown && currentRSI < rsiOversold + 10
      ? 0.3
      : trendUp && currentRSI > rsiOverbought - 10
        ? -0.3
        : 0;

  // Pattern recognition - simple
  const sma20 = calculateSMA(closes, 20);
  const current = closes[closes.length - 1];
  const sma20Current = sma20[sma20.length - 1];
  factors.pattern =
    current < sma20Current * 0.97
      ? 0.2
      : current > sma20Current * 1.03
        ? -0.2
        : 0;

  // Breadth
  const sma10 = calculateSMA(closes, 10);
  const sma50 = closes.length >= 50 ? calculateSMA(closes, 50) : sma20;
  factors.breadth =
    (current < sma10[sma10.length - 1] ? 0.33 : -0.33) +
    (current < sma20Current ? 0.33 : -0.33) +
    (current < sma50[sma50.length - 1] ? 0.34 : -0.34);

  // Weighted score - MEAN REVERSION WEIGHTS
  const score =
    factors.technical * (params.technicalWeight || 0.25) +
    factors.volatility * (params.volatilityWeight || 0.18) +
    factors.correlation * (params.correlationWeight || 0.18) +
    factors.momentum * (params.momentumWeight || 0.1) +
    factors.volume * (params.volumeWeight || 0.12) +
    factors.sentiment * (params.sentimentWeight || 0.08) +
    factors.pattern * (params.patternWeight || 0.05) +
    factors.breadth * (params.breadthWeight || 0.04);

  // Confidence - alignment of factors
  const factorValues = Object.values(factors);
  const positiveFactors = factorValues.filter((f) => f > 0.1).length;
  const negativeFactors = factorValues.filter((f) => f < -0.1).length;
  const agreement =
    Math.max(positiveFactors, negativeFactors) / factorValues.length;
  const confidence = agreement * Math.abs(score);

  return { score, confidence, rsi: currentRSI, bbPosition, factors };
}

// ============= BACKTEST ENGINE =============

async function runMeanReversionBacktest(
  params: Record<string, number>,
  bars: Map<string, AlpacaBar[]>,
  startDate: Date,
  endDate: Date
): Promise<BacktestResult> {
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
      entryRSI: number;
      entryBBPosition: number;
    }
  > = new Map();

  // Get trading days
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

      const currentPrice = currentBar.c;
      const high = currentBar.h;
      const low = currentBar.l;
      let exitPrice: number | null = null;
      let exitReason = "";

      if (low <= pos.stopLoss) {
        exitPrice = pos.stopLoss;
        exitReason = "stop";
      } else if (high >= pos.takeProfit) {
        exitPrice = pos.takeProfit;
        exitReason = "target";
      }

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
          entryRSI: pos.entryRSI,
          entryBBPosition: pos.entryBBPosition,
        });
        positions.delete(symbol);
      }
    }

    // Check entries
    if (positions.size < (params.maxPositions || 15)) {
      const candidates: {
        symbol: string;
        score: number;
        confidence: number;
        price: number;
        atr: number;
        rsi: number;
        bbPosition: number;
      }[] = [];

      for (const [symbol, symbolBars] of bars) {
        if (positions.has(symbol)) continue;
        const barsToDate = symbolBars
          .filter((b) => b.t <= currentDate)
          .slice(-60);
        if (barsToDate.length < 50) continue;

        const signal = generateMeanReversionSignal(barsToDate, params);
        if (
          signal.score >= (params.buyThreshold || 0.12) &&
          signal.confidence >= (params.confidenceMin || 0.28)
        ) {
          const currentBar = barsToDate[barsToDate.length - 1];
          const closes = barsToDate.map((b) => b.c);
          const highs = barsToDate.map((b) => b.h);
          const lows = barsToDate.map((b) => b.l);
          const atr = calculateATR(highs, lows, closes, params.atrPeriod || 14);
          candidates.push({
            symbol,
            score: signal.score,
            confidence: signal.confidence,
            price: currentBar.c,
            atr: atr[atr.length - 1],
            rsi: signal.rsi,
            bbPosition: signal.bbPosition,
          });
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      for (const candidate of candidates.slice(
        0,
        (params.maxPositions || 15) - positions.size
      )) {
        const maxPositionSize = capital * (params.maxPositionPct || 0.05);
        const shares = Math.floor(maxPositionSize / candidate.price);

        if (shares > 0 && shares * candidate.price <= capital) {
          const stopLoss =
            candidate.price - candidate.atr * (params.atrMultStop || 2.5);
          const takeProfit =
            candidate.price + candidate.atr * (params.atrMultTarget || 3);
          positions.set(candidate.symbol, {
            entry: candidate.price,
            shares,
            entryDate: currentDate,
            stopLoss,
            takeProfit,
            entryRSI: candidate.rsi,
            entryBBPosition: candidate.bbPosition,
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
        entryRSI: pos.entryRSI,
        entryBBPosition: pos.entryBBPosition,
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
  const avgHoldingDays =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length
      : 0;

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
    avgHoldingDays,
  };
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
      // Skip errors
    }
    process.stdout.write(`\r  Loaded ${loaded}/${SYMBOLS.length} symbols`);
  }

  console.log(`\n  Successfully loaded ${bars.size} symbols`);
  return bars;
}

function generateRandomConfig(id: number): Record<string, number> {
  const params: Record<string, number> = {};

  for (const [param, range] of Object.entries(MR_PARAM_RANGES)) {
    if (range.integer) {
      params[param] =
        Math.floor(Math.random() * ((range.max - range.min) / range.step + 1)) *
          range.step +
        range.min;
    } else {
      const steps = Math.round((range.max - range.min) / range.step);
      params[param] =
        Math.round(Math.random() * steps * range.step * 100) / 100 + range.min;
    }
  }

  // Normalize weights to sum to ~1.0
  const weightKeys = [
    "technicalWeight",
    "volatilityWeight",
    "correlationWeight",
    "momentumWeight",
    "volumeWeight",
    "sentimentWeight",
    "patternWeight",
    "breadthWeight",
  ];
  const total = weightKeys.reduce((sum, key) => sum + (params[key] || 0), 0);
  if (total > 0) {
    for (const key of weightKeys) {
      params[key] = Math.round((params[key] / total) * 100) / 100;
    }
  }

  return params;
}

async function runMeanReversionOptimizer() {
  console.log("═".repeat(80));
  console.log("  OMAR MEAN REVERSION OPTIMIZER - 1000+ ITERATIONS");
  console.log("═".repeat(80));
  console.log("\n  Strategy Focus:");
  console.log("  - RSI oversold entries (20-40)");
  console.log("  - Bollinger Band extremes (15-25 period, 1.5-2.5 stdDev)");
  console.log("  - Higher volatility/correlation weights for mean reversion");
  console.log("  - Wider stops (ATR 2.0-3.0x) for breathing room");
  console.log("  - Moderate targets (ATR 2-4x) for realistic exits");

  const bars = await loadHistoricalData();
  if (bars.size < 10) {
    console.error("Insufficient data. Aborting.");
    return;
  }

  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);
  const endDate = new Date();

  const allConfigs: MRConfig[] = [];
  let bestConfig: MRConfig | null = null;

  console.log("\n" + "─".repeat(80));
  console.log("  STARTING OPTIMIZATION");
  console.log("─".repeat(80));

  const startTime = Date.now();

  for (
    let iteration = 0;
    iteration < TOTAL_ITERATIONS;
    iteration += BATCH_SIZE
  ) {
    const batchConfigs: Record<string, number>[] = [];

    for (let i = 0; i < BATCH_SIZE && iteration + i < TOTAL_ITERATIONS; i++) {
      batchConfigs.push(generateRandomConfig(iteration + i));
    }

    // Run batch in parallel
    const results = await Promise.all(
      batchConfigs.map(async (params, idx) => {
        try {
          const result = await runMeanReversionBacktest(
            params,
            bars,
            startDate,
            endDate
          );

          const config: MRConfig = {
            id: iteration + idx,
            params,
            sharpe: result.sharpe,
            sortino: result.sortino,
            calmar: result.calmar,
            winRate: result.winRate,
            totalReturn: result.totalReturn,
            maxDrawdown: result.maxDrawdown,
            trades: result.trades.length,
            avgHolding: result.avgHoldingDays,
          };

          return config;
        } catch (err) {
          return null;
        }
      })
    );

    for (const config of results) {
      if (!config) continue;

      // Filter valid configs
      if (config.trades >= 30 && config.maxDrawdown < 0.4) {
        allConfigs.push(config);

        // Track best by composite score
        const compositeScore =
          config.sharpe * 0.3 +
          config.sortino * 0.25 +
          config.calmar * 0.25 +
          config.winRate * 0.15 +
          config.totalReturn * 0.05;
        const bestScore = bestConfig
          ? bestConfig.sharpe * 0.3 +
            bestConfig.sortino * 0.25 +
            bestConfig.calmar * 0.25 +
            bestConfig.winRate * 0.15 +
            bestConfig.totalReturn * 0.05
          : -Infinity;

        if (compositeScore > bestScore) {
          bestConfig = config;
          console.log(
            `\n  🎯 NEW BEST (Iteration ${config.id}/${TOTAL_ITERATIONS})`
          );
          console.log(
            `     Sharpe: ${config.sharpe.toFixed(3)} | Sortino: ${config.sortino.toFixed(3)} | Calmar: ${config.calmar.toFixed(3)}`
          );
          console.log(
            `     Return: ${(config.totalReturn * 100).toFixed(1)}% | Win Rate: ${(config.winRate * 100).toFixed(1)}% | MaxDD: ${(config.maxDrawdown * 100).toFixed(1)}%`
          );
          console.log(
            `     Trades: ${config.trades} | Avg Hold: ${config.avgHolding.toFixed(1)} days`
          );
        }
      }
    }

    // Progress update
    const progress = (
      ((iteration + BATCH_SIZE) / TOTAL_ITERATIONS) *
      100
    ).toFixed(1);
    const elapsed = (Date.now() - startTime) / 1000;
    const eta =
      elapsed / ((iteration + BATCH_SIZE) / TOTAL_ITERATIONS) - elapsed;

    if (
      (iteration + BATCH_SIZE) % 100 === 0 ||
      iteration + BATCH_SIZE >= TOTAL_ITERATIONS
    ) {
      console.log(
        `\n  Progress: ${Math.min(iteration + BATCH_SIZE, TOTAL_ITERATIONS)}/${TOTAL_ITERATIONS} (${progress}%) | ETA: ${Math.round(eta)}s | Valid configs: ${allConfigs.length}`
      );
    } else {
      process.stdout.write(
        `\r  Progress: ${Math.min(iteration + BATCH_SIZE, TOTAL_ITERATIONS)}/${TOTAL_ITERATIONS} (${progress}%)`
      );
    }
  }

  console.log("\n\n" + "═".repeat(80));
  console.log("  OPTIMIZATION COMPLETE");
  console.log("═".repeat(80));

  console.log(`\n  Total iterations: ${TOTAL_ITERATIONS}`);
  console.log(`  Valid configurations: ${allConfigs.length}`);
  console.log(
    `  Time elapsed: ${((Date.now() - startTime) / 1000).toFixed(1)}s`
  );

  if (bestConfig) {
    console.log("\n" + "─".repeat(80));
    console.log("  🏆 BEST MEAN REVERSION CONFIGURATION");
    console.log("─".repeat(80));

    console.log(`\n  PERFORMANCE METRICS:`);
    console.log(`  ├─ Sharpe Ratio:    ${bestConfig.sharpe.toFixed(3)}`);
    console.log(`  ├─ Sortino Ratio:   ${bestConfig.sortino.toFixed(3)}`);
    console.log(`  ├─ Calmar Ratio:    ${bestConfig.calmar.toFixed(3)}`);
    console.log(
      `  ├─ Win Rate:        ${(bestConfig.winRate * 100).toFixed(1)}%`
    );
    console.log(
      `  ├─ Total Return:    ${(bestConfig.totalReturn * 100).toFixed(1)}%`
    );
    console.log(
      `  ├─ Max Drawdown:    ${(bestConfig.maxDrawdown * 100).toFixed(1)}%`
    );
    console.log(`  ├─ Total Trades:    ${bestConfig.trades}`);
    console.log(
      `  └─ Avg Holding:     ${bestConfig.avgHolding.toFixed(1)} days`
    );

    const p = bestConfig.params;
    console.log(`\n  MEAN REVERSION PARAMETERS:`);
    console.log(
      `  ├─ RSI Settings:     period=${p.rsiPeriod}, oversold=${p.rsiOversold}, overbought=${p.rsiOverbought}`
    );
    console.log(
      `  ├─ Bollinger Bands:  period=${p.bbPeriod}, stdDev=${p.bbStdDev?.toFixed(1)}`
    );
    console.log(
      `  ├─ ATR Settings:     period=${p.atrPeriod}, stop=${p.atrMultStop?.toFixed(1)}x, target=${p.atrMultTarget?.toFixed(1)}x`
    );
    console.log(
      `  ├─ Entry Thresholds: buyThreshold=${p.buyThreshold?.toFixed(3)}, confidenceMin=${p.confidenceMin?.toFixed(3)}`
    );
    console.log(
      `  ├─ Position Sizing:  maxPositionPct=${(p.maxPositionPct! * 100).toFixed(1)}%, maxPositions=${p.maxPositions}`
    );
    console.log(
      `  └─ Risk Limits:      maxPortfolioExposure=${(p.maxPortfolioExposure! * 100).toFixed(0)}%, maxDailyLoss=${(p.maxDailyLoss! * 100).toFixed(1)}%`
    );

    console.log(`\n  FACTOR WEIGHTS (optimized for mean reversion):`);
    console.log(
      `  ├─ Technical:     ${(p.technicalWeight! * 100).toFixed(1)}%`
    );
    console.log(
      `  ├─ Volatility:    ${(p.volatilityWeight! * 100).toFixed(1)}% ⬆️  (higher for MR)`
    );
    console.log(
      `  ├─ Correlation:   ${(p.correlationWeight! * 100).toFixed(1)}% ⬆️  (higher for MR)`
    );
    console.log(
      `  ├─ Momentum:      ${(p.momentumWeight! * 100).toFixed(1)}% ⬇️  (lower for MR)`
    );
    console.log(`  ├─ Volume:        ${(p.volumeWeight! * 100).toFixed(1)}%`);
    console.log(
      `  ├─ Sentiment:     ${(p.sentimentWeight! * 100).toFixed(1)}%`
    );
    console.log(`  ├─ Pattern:       ${(p.patternWeight! * 100).toFixed(1)}%`);
    console.log(`  └─ Breadth:       ${(p.breadthWeight! * 100).toFixed(1)}%`);

    console.log(`\n  LOOKBACK PERIODS:`);
    console.log(`  ├─ Volatility:    ${p.volatilityLookback} days`);
    console.log(`  └─ Correlation:   ${p.correlationLookback} days`);

    // Top 10 configs
    console.log(`\n  TOP 10 CONFIGURATIONS BY SHARPE RATIO:`);
    const top10 = allConfigs.sort((a, b) => b.sharpe - a.sharpe).slice(0, 10);
    for (let i = 0; i < top10.length; i++) {
      const c = top10[i];
      console.log(
        `  ${i + 1}.  Sharpe: ${c.sharpe.toFixed(3)} | Sortino: ${c.sortino.toFixed(3)} | Calmar: ${c.calmar.toFixed(3)} | Win: ${(c.winRate * 100).toFixed(1)}% | Return: ${(c.totalReturn * 100).toFixed(1)}%`
      );
    }
  } else {
    console.log("\n  ❌ No valid configuration found.");
  }

  console.log("\n" + "═".repeat(80));
}

runMeanReversionOptimizer().catch(console.error);
