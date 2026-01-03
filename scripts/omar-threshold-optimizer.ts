#!/usr/bin/env npx tsx
/**
 * OMAR THRESHOLD OPTIMIZER - Entry & Exit Threshold Exploration
 *
 * Focuses on optimizing the critical entry and exit parameters:
 * 1. Buy threshold (0.05-0.30) - minimum signal score to enter
 * 2. Confidence minimum (0.15-0.50) - minimum confidence to enter
 * 3. ATR stop multiplier (0.5-3.0) - how tight stops are
 * 4. ATR target multiplier (1.5-8.0) - profit targets
 *
 * Explores 1000+ parameter combinations to find optimal thresholds
 */

// ============= CONFIGURATION =============
const ALPACA_KEY = process.env.ALPACA_API_KEY || "";
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY || "";
const ALPACA_DATA_URL = "https://data.alpaca.markets";

// Threshold optimization ranges
const BUY_THRESHOLD_MIN = 0.05;
const BUY_THRESHOLD_MAX = 0.3;
const BUY_THRESHOLD_STEP = 0.02;

const CONFIDENCE_MIN = 0.15;
const CONFIDENCE_MAX = 0.5;
const CONFIDENCE_STEP = 0.03;

const ATR_STOP_MIN = 0.5;
const ATR_STOP_MAX = 3.0;
const ATR_STOP_STEP = 0.25;

const ATR_TARGET_MIN = 1.5;
const ATR_TARGET_MAX = 8.0;
const ATR_TARGET_STEP = 0.5;

// Symbol universe
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
  "ORCL",
  "ADBE",
  "NOW",
  "PLTR",
  "JPM",
  "BAC",
  "GS",
  "MS",
  "V",
  "MA",
  "AXP",
  "UNH",
  "JNJ",
  "PFE",
  "ABBV",
  "MRK",
  "LLY",
  "TMO",
  "WMT",
  "COST",
  "HD",
  "NKE",
  "MCD",
  "SBUX",
  "DIS",
  "SPY",
  "QQQ",
  "IWM",
  "XLF",
  "XLK",
  "XLE",
];

// Fixed parameters (based on previous optimization runs)
const FIXED_PARAMS = {
  maxPositionPct: 0.05,
  maxPortfolioExposure: 0.75,
  maxPositions: 20,
  maxDailyLoss: 0.05,
  technicalWeight: 0.2,
  momentumWeight: 0.2,
  volatilityWeight: 0.08,
  volumeWeight: 0.12,
  sentimentWeight: 0.12,
  patternWeight: 0.1,
  breadthWeight: 0.08,
  correlationWeight: 0.1,
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  bbPeriod: 20,
  bbStdDev: 2.0,
  atrPeriod: 14,
  momentumLookback: 10,
  volatilityLookback: 20,
  correlationLookback: 30,
};

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface ThresholdConfig {
  buyThreshold: number;
  confidenceMin: number;
  atrMultStop: number;
  atrMultTarget: number;
}

interface BacktestResult {
  config: ThresholdConfig;
  totalReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  winRate: number;
  trades: TradeResult[];
  riskRewardRatio: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
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
  hitStop: boolean;
  hitTarget: boolean;
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

function calculateMACD(
  closes: number[],
  fast: number,
  slow: number,
  signal: number
): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = calculateEMA(macdLine, signal);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

function calculateBollingerBands(
  closes: number[],
  period: number,
  stdDev: number
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const variance =
        slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
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

function calculateOBV(closes: number[], volumes: number[]): number[] {
  const obv: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv.push(obv[i - 1] + volumes[i]);
    else if (closes[i] < closes[i - 1]) obv.push(obv[i - 1] - volumes[i]);
    else obv.push(obv[i - 1]);
  }
  return obv;
}

// ============= SIGNAL GENERATION =============

function generateSignal(
  bars: AlpacaBar[],
  params: typeof FIXED_PARAMS
): { score: number; confidence: number } {
  if (bars.length < 50) return { score: 0, confidence: 0 };

  const closes = bars.map((b) => b.c);
  const highs = bars.map((b) => b.h);
  const lows = bars.map((b) => b.l);
  const volumes = bars.map((b) => b.v);

  const factors: Record<string, number> = {};

  // Technical
  const rsi = calculateRSI(closes, params.rsiPeriod);
  const currentRSI = rsi[rsi.length - 1];
  const macd = calculateMACD(
    closes,
    params.macdFast,
    params.macdSlow,
    params.macdSignal
  );
  const bb = calculateBollingerBands(closes, params.bbPeriod, params.bbStdDev);

  let technicalScore = 0;
  if (currentRSI < params.rsiOversold) technicalScore += 0.3;
  else if (currentRSI > params.rsiOverbought) technicalScore -= 0.3;
  else technicalScore += (50 - currentRSI) / 100;

  const macdCurrent = macd.histogram[macd.histogram.length - 1];
  const macdPrev = macd.histogram[macd.histogram.length - 2];
  if (macdCurrent > 0 && macdCurrent > macdPrev) technicalScore += 0.25;
  else if (macdCurrent < 0 && macdCurrent < macdPrev) technicalScore -= 0.25;

  const currentClose = closes[closes.length - 1];
  const bbLower = bb.lower[bb.lower.length - 1];
  const bbUpper = bb.upper[bb.upper.length - 1];
  if (currentClose < bbLower) technicalScore += 0.2;
  else if (currentClose > bbUpper) technicalScore -= 0.2;

  factors.technical = Math.max(-1, Math.min(1, technicalScore));

  // Momentum
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++)
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const recentReturns = returns.slice(-params.momentumLookback);
  const avgReturn =
    recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
  const momentum5 =
    (closes[closes.length - 1] - closes[closes.length - 6]) /
    closes[closes.length - 6];
  const momentum20 =
    closes.length >= 21
      ? (closes[closes.length - 1] - closes[closes.length - 21]) /
        closes[closes.length - 21]
      : 0;
  factors.momentum = Math.max(
    -1,
    Math.min(1, (avgReturn * 50 + momentum5 * 5 + momentum20 * 2) / 3)
  );

  // Volatility
  const recentVolReturns = returns.slice(-params.volatilityLookback);
  const volatility =
    Math.sqrt(
      recentVolReturns.reduce((sum, r) => sum + r * r, 0) /
        recentVolReturns.length
    ) * Math.sqrt(252);
  factors.volatility = Math.max(-1, Math.min(1, 0.5 - volatility));

  // Volume
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = currentVolume / avgVolume;
  const obv = calculateOBV(closes, volumes);
  const obvTrend = obv[obv.length - 1] - obv[obv.length - 6];
  factors.volume = Math.max(
    -1,
    Math.min(1, (volumeRatio - 1) * 0.5 + (obvTrend > 0 ? 0.2 : -0.2))
  );

  // Sentiment proxy
  const trendUp = momentum20 > 0.05;
  const trendDown = momentum20 < -0.05;
  factors.sentiment = Math.max(
    -1,
    Math.min(
      1,
      (trendUp ? 0.3 : trendDown ? -0.3 : 0) +
        (volumeRatio > 1.5 && momentum5 > 0
          ? 0.2
          : volumeRatio > 1.5 && momentum5 < 0
            ? -0.2
            : 0)
    )
  );

  // Pattern (simplified)
  factors.pattern = momentum5 > 0.02 ? 0.3 : momentum5 < -0.02 ? -0.3 : 0;

  // Breadth
  const sma10 = calculateSMA(closes, 10);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = closes.length >= 50 ? calculateSMA(closes, 50) : sma20;
  const current = closes[closes.length - 1];
  factors.breadth =
    (current > sma10[sma10.length - 1] ? 0.33 : -0.33) +
    (current > sma20[sma20.length - 1] ? 0.33 : -0.33) +
    (current > sma50[sma50.length - 1] ? 0.34 : -0.34);

  // Correlation
  const bbMiddle = bb.middle[bb.middle.length - 1];
  const deviation = (current - bbMiddle) / (bbUpper - bbMiddle || 1);
  factors.correlation = Math.max(-1, Math.min(1, -deviation * 0.5));

  // Weighted score
  const score =
    factors.technical * params.technicalWeight +
    factors.momentum * params.momentumWeight +
    factors.volatility * params.volatilityWeight +
    factors.volume * params.volumeWeight +
    factors.sentiment * params.sentimentWeight +
    factors.pattern * params.patternWeight +
    factors.breadth * params.breadthWeight +
    factors.correlation * params.correlationWeight;

  const factorValues = Object.values(factors);
  const positiveFactors = factorValues.filter((f) => f > 0).length;
  const negativeFactors = factorValues.filter((f) => f < 0).length;
  const agreement =
    Math.max(positiveFactors, negativeFactors) / factorValues.length;
  const confidence = agreement * Math.abs(score);

  return { score, confidence };
}

// ============= BACKTEST ENGINE =============

async function runBacktest(
  config: ThresholdConfig,
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
      confidence: number;
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

      const high = currentBar.h;
      const low = currentBar.l;
      let exitPrice: number | null = null;
      let hitStop = false;
      let hitTarget = false;

      if (low <= pos.stopLoss) {
        exitPrice = pos.stopLoss;
        hitStop = true;
      } else if (high >= pos.takeProfit) {
        exitPrice = pos.takeProfit;
        hitTarget = true;
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
          confidence: pos.confidence,
          hitStop,
          hitTarget,
        });
        positions.delete(symbol);
      }
    }

    // Check entries
    if (positions.size < FIXED_PARAMS.maxPositions) {
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

        const signal = generateSignal(barsToDate, FIXED_PARAMS);
        if (
          signal.score >= config.buyThreshold &&
          signal.confidence >= config.confidenceMin
        ) {
          const currentBar = barsToDate[barsToDate.length - 1];
          const closes = barsToDate.map((b) => b.c);
          const highs = barsToDate.map((b) => b.h);
          const lows = barsToDate.map((b) => b.l);
          const atr = calculateATR(highs, lows, closes, FIXED_PARAMS.atrPeriod);
          candidates.push({
            symbol,
            score: signal.score,
            confidence: signal.confidence,
            price: currentBar.c,
            atr: atr[atr.length - 1],
          });
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      for (const candidate of candidates.slice(
        0,
        FIXED_PARAMS.maxPositions - positions.size
      )) {
        const maxPositionSize = capital * FIXED_PARAMS.maxPositionPct;
        const shares = Math.floor(maxPositionSize / candidate.price);

        if (shares > 0 && shares * candidate.price <= capital) {
          const stopLoss = candidate.price - candidate.atr * config.atrMultStop;
          const takeProfit =
            candidate.price + candidate.atr * config.atrMultTarget;
          positions.set(candidate.symbol, {
            entry: candidate.price,
            shares,
            entryDate: currentDate,
            stopLoss,
            takeProfit,
            confidence: candidate.confidence,
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
        confidence: pos.confidence,
        hitStop: false,
        hitTarget: false,
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

  // Calculate win/loss metrics
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const avgWin =
    wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
  const avgLoss =
    losses.length > 0
      ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length)
      : 0;
  const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor =
    totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  return {
    config,
    totalReturn,
    sharpe,
    sortino,
    calmar,
    maxDrawdown,
    winRate,
    trades,
    riskRewardRatio: config.atrMultTarget / config.atrMultStop,
    avgWin,
    avgLoss,
    profitFactor,
  };
}

// ============= MAIN OPTIMIZER =============

async function loadHistoricalData(): Promise<Map<string, AlpacaBar[]>> {
  const bars = new Map<string, AlpacaBar[]>();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2); // 2 years of data

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
      await new Promise((r) => setTimeout(r, 100)); // Rate limit
    } catch (err) {
      // Skip errors
    }
    process.stdout.write(`\r  Loaded ${loaded}/${SYMBOLS.length} symbols`);
  }

  console.log(`\n  Successfully loaded ${bars.size} symbols`);
  return bars;
}

async function runThresholdOptimizer() {
  console.log("═".repeat(80));
  console.log(
    "  OMAR THRESHOLD OPTIMIZER - Entry & Exit Threshold Exploration"
  );
  console.log("═".repeat(80));

  // Calculate total iterations
  const buyThresholdSteps =
    Math.round((BUY_THRESHOLD_MAX - BUY_THRESHOLD_MIN) / BUY_THRESHOLD_STEP) +
    1;
  const confidenceSteps =
    Math.round((CONFIDENCE_MAX - CONFIDENCE_MIN) / CONFIDENCE_STEP) + 1;
  const atrStopSteps =
    Math.round((ATR_STOP_MAX - ATR_STOP_MIN) / ATR_STOP_STEP) + 1;
  const atrTargetSteps =
    Math.round((ATR_TARGET_MAX - ATR_TARGET_MIN) / ATR_TARGET_STEP) + 1;
  const totalIterations =
    buyThresholdSteps * confidenceSteps * atrStopSteps * atrTargetSteps;

  console.log(`\n  Configuration:`);
  console.log(
    `  - Buy Threshold: ${BUY_THRESHOLD_MIN} to ${BUY_THRESHOLD_MAX} (step ${BUY_THRESHOLD_STEP}) = ${buyThresholdSteps} values`
  );
  console.log(
    `  - Confidence Min: ${CONFIDENCE_MIN} to ${CONFIDENCE_MAX} (step ${CONFIDENCE_STEP}) = ${confidenceSteps} values`
  );
  console.log(
    `  - ATR Stop: ${ATR_STOP_MIN} to ${ATR_STOP_MAX} (step ${ATR_STOP_STEP}) = ${atrStopSteps} values`
  );
  console.log(
    `  - ATR Target: ${ATR_TARGET_MIN} to ${ATR_TARGET_MAX} (step ${ATR_TARGET_STEP}) = ${atrTargetSteps} values`
  );
  console.log(`  - Total Iterations: ${totalIterations.toLocaleString()}`);

  const bars = await loadHistoricalData();
  if (bars.size < 10) {
    console.error("Insufficient data. Aborting.");
    return;
  }

  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);
  const endDate = new Date();

  const results: BacktestResult[] = [];
  let iteration = 0;
  const startTime = Date.now();

  console.log("\n" + "─".repeat(80));
  console.log("  STARTING THRESHOLD OPTIMIZATION");
  console.log("─".repeat(80));

  // Generate all threshold combinations
  for (
    let buyThreshold = BUY_THRESHOLD_MIN;
    buyThreshold <= BUY_THRESHOLD_MAX;
    buyThreshold += BUY_THRESHOLD_STEP
  ) {
    for (
      let confidenceMin = CONFIDENCE_MIN;
      confidenceMin <= CONFIDENCE_MAX;
      confidenceMin += CONFIDENCE_STEP
    ) {
      for (
        let atrMultStop = ATR_STOP_MIN;
        atrMultStop <= ATR_STOP_MAX;
        atrMultStop += ATR_STOP_STEP
      ) {
        for (
          let atrMultTarget = ATR_TARGET_MIN;
          atrMultTarget <= ATR_TARGET_MAX;
          atrMultTarget += ATR_TARGET_STEP
        ) {
          iteration++;

          const config: ThresholdConfig = {
            buyThreshold: Math.round(buyThreshold * 100) / 100,
            confidenceMin: Math.round(confidenceMin * 100) / 100,
            atrMultStop: Math.round(atrMultStop * 100) / 100,
            atrMultTarget: Math.round(atrMultTarget * 100) / 100,
          };

          try {
            const result = await runBacktest(config, bars, startDate, endDate);
            results.push(result);

            // Progress update every 50 iterations
            if (iteration % 50 === 0) {
              const elapsed = (Date.now() - startTime) / 1000;
              const rate = iteration / elapsed;
              const eta = (totalIterations - iteration) / rate;
              const progress = ((iteration / totalIterations) * 100).toFixed(1);

              console.log(
                `\n  Iteration ${iteration}/${totalIterations} (${progress}%)`
              );
              console.log(
                `  ├─ Current: buyThresh=${config.buyThreshold.toFixed(2)}, conf=${config.confidenceMin.toFixed(2)}, stop=${config.atrMultStop.toFixed(2)}x, target=${config.atrMultTarget.toFixed(2)}x`
              );
              console.log(
                `  ├─ Result: Return=${(result.totalReturn * 100).toFixed(1)}%, Sharpe=${result.sharpe.toFixed(2)}, Trades=${result.trades.length}`
              );
              console.log(
                `  ├─ Rate: ${rate.toFixed(1)} iter/s | ETA: ${Math.round(eta)}s`
              );

              // Show current best
              if (results.length > 0) {
                const best = results.reduce((a, b) =>
                  a.sharpe > b.sharpe ? a : b
                );
                console.log(
                  `  └─ Best so far: Sharpe=${best.sharpe.toFixed(2)}, Return=${(best.totalReturn * 100).toFixed(1)}%, WinRate=${(best.winRate * 100).toFixed(1)}%`
                );
              }
            }
          } catch (err) {
            // Skip failed backtests
          }
        }
      }
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;

  console.log("\n" + "═".repeat(80));
  console.log("  OPTIMIZATION COMPLETE");
  console.log("═".repeat(80));

  console.log(`\n  Total Iterations: ${iteration.toLocaleString()}`);
  console.log(
    `  Total Time: ${Math.round(totalTime)}s (${(iteration / totalTime).toFixed(1)} iter/s)`
  );
  console.log(`  Valid Results: ${results.length}`);

  // Sort by different metrics
  const bySharpe = [...results].sort((a, b) => b.sharpe - a.sharpe).slice(0, 5);
  const bySortino = [...results]
    .sort((a, b) => b.sortino - a.sortino)
    .slice(0, 5);
  const byCalmar = [...results].sort((a, b) => b.calmar - a.calmar).slice(0, 5);
  const byReturn = [...results]
    .sort((a, b) => b.totalReturn - a.totalReturn)
    .slice(0, 5);
  const byWinRate = [...results]
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 5);
  const byProfitFactor = [...results]
    .sort((a, b) => b.profitFactor - a.profitFactor)
    .slice(0, 5);

  console.log("\n" + "═".repeat(80));
  console.log("  TOP 5 CONFIGURATIONS BY SHARPE RATIO");
  console.log("═".repeat(80));
  for (let i = 0; i < bySharpe.length; i++) {
    const r = bySharpe[i];
    console.log(
      `\n  ${i + 1}. Sharpe: ${r.sharpe.toFixed(3)} | Sortino: ${r.sortino.toFixed(3)} | Calmar: ${r.calmar.toFixed(3)}`
    );
    console.log(
      `     Return: ${(r.totalReturn * 100).toFixed(2)}% | MaxDD: ${(r.maxDrawdown * 100).toFixed(2)}% | Win Rate: ${(r.winRate * 100).toFixed(1)}%`
    );
    console.log(
      `     Trades: ${r.trades.length} | Profit Factor: ${r.profitFactor.toFixed(2)}`
    );
    console.log(
      `     Avg Win: $${r.avgWin.toFixed(2)} | Avg Loss: $${r.avgLoss.toFixed(2)}`
    );
    console.log(
      `     Config: buyThresh=${r.config.buyThreshold.toFixed(2)}, conf=${r.config.confidenceMin.toFixed(2)}, stop=${r.config.atrMultStop.toFixed(2)}x, target=${r.config.atrMultTarget.toFixed(2)}x`
    );
    console.log(`     Risk/Reward: ${r.riskRewardRatio.toFixed(2)}:1`);
  }

  console.log("\n" + "═".repeat(80));
  console.log("  TOP 5 BY SORTINO RATIO");
  console.log("═".repeat(80));
  for (let i = 0; i < bySortino.length; i++) {
    const r = bySortino[i];
    console.log(
      `  ${i + 1}. Sortino: ${r.sortino.toFixed(3)} | buyThresh=${r.config.buyThreshold.toFixed(2)}, conf=${r.config.confidenceMin.toFixed(2)}, stop=${r.config.atrMultStop.toFixed(2)}x, target=${r.config.atrMultTarget.toFixed(2)}x`
    );
  }

  console.log("\n" + "═".repeat(80));
  console.log("  TOP 5 BY CALMAR RATIO");
  console.log("═".repeat(80));
  for (let i = 0; i < byCalmar.length; i++) {
    const r = byCalmar[i];
    console.log(
      `  ${i + 1}. Calmar: ${r.calmar.toFixed(3)} | buyThresh=${r.config.buyThreshold.toFixed(2)}, conf=${r.config.confidenceMin.toFixed(2)}, stop=${r.config.atrMultStop.toFixed(2)}x, target=${r.config.atrMultTarget.toFixed(2)}x`
    );
  }

  console.log("\n" + "═".repeat(80));
  console.log("  TOP 5 BY TOTAL RETURN");
  console.log("═".repeat(80));
  for (let i = 0; i < byReturn.length; i++) {
    const r = byReturn[i];
    console.log(
      `  ${i + 1}. Return: ${(r.totalReturn * 100).toFixed(2)}% | buyThresh=${r.config.buyThreshold.toFixed(2)}, conf=${r.config.confidenceMin.toFixed(2)}, stop=${r.config.atrMultStop.toFixed(2)}x, target=${r.config.atrMultTarget.toFixed(2)}x`
    );
  }

  console.log("\n" + "═".repeat(80));
  console.log("  TOP 5 BY WIN RATE");
  console.log("═".repeat(80));
  for (let i = 0; i < byWinRate.length; i++) {
    const r = byWinRate[i];
    console.log(
      `  ${i + 1}. Win Rate: ${(r.winRate * 100).toFixed(1)}% | buyThresh=${r.config.buyThreshold.toFixed(2)}, conf=${r.config.confidenceMin.toFixed(2)}, stop=${r.config.atrMultStop.toFixed(2)}x, target=${r.config.atrMultTarget.toFixed(2)}x`
    );
  }

  console.log("\n" + "═".repeat(80));
  console.log("  TOP 5 BY PROFIT FACTOR");
  console.log("═".repeat(80));
  for (let i = 0; i < byProfitFactor.length; i++) {
    const r = byProfitFactor[i];
    console.log(
      `  ${i + 1}. Profit Factor: ${r.profitFactor.toFixed(2)} | buyThresh=${r.config.buyThreshold.toFixed(2)}, conf=${r.config.confidenceMin.toFixed(2)}, stop=${r.config.atrMultStop.toFixed(2)}x, target=${r.config.atrMultTarget.toFixed(2)}x`
    );
  }

  // Analysis of optimal ranges
  console.log("\n" + "═".repeat(80));
  console.log("  PARAMETER RANGE ANALYSIS (Top 20% Performers by Sharpe)");
  console.log("═".repeat(80));

  const topPerformers = [...results]
    .sort((a, b) => b.sharpe - a.sharpe)
    .slice(0, Math.ceil(results.length * 0.2));

  const buyThresholds = topPerformers.map((r) => r.config.buyThreshold);
  const confidenceMins = topPerformers.map((r) => r.config.confidenceMin);
  const atrStops = topPerformers.map((r) => r.config.atrMultStop);
  const atrTargets = topPerformers.map((r) => r.config.atrMultTarget);

  console.log(`\n  Buy Threshold:`);
  console.log(`    Min: ${Math.min(...buyThresholds).toFixed(2)}`);
  console.log(`    Max: ${Math.max(...buyThresholds).toFixed(2)}`);
  console.log(
    `    Avg: ${(buyThresholds.reduce((a, b) => a + b, 0) / buyThresholds.length).toFixed(2)}`
  );

  console.log(`\n  Confidence Min:`);
  console.log(`    Min: ${Math.min(...confidenceMins).toFixed(2)}`);
  console.log(`    Max: ${Math.max(...confidenceMins).toFixed(2)}`);
  console.log(
    `    Avg: ${(confidenceMins.reduce((a, b) => a + b, 0) / confidenceMins.length).toFixed(2)}`
  );

  console.log(`\n  ATR Stop Multiplier:`);
  console.log(`    Min: ${Math.min(...atrStops).toFixed(2)}`);
  console.log(`    Max: ${Math.max(...atrStops).toFixed(2)}`);
  console.log(
    `    Avg: ${(atrStops.reduce((a, b) => a + b, 0) / atrStops.length).toFixed(2)}`
  );

  console.log(`\n  ATR Target Multiplier:`);
  console.log(`    Min: ${Math.min(...atrTargets).toFixed(2)}`);
  console.log(`    Max: ${Math.max(...atrTargets).toFixed(2)}`);
  console.log(
    `    Avg: ${(atrTargets.reduce((a, b) => a + b, 0) / atrTargets.length).toFixed(2)}`
  );

  console.log(`\n  Risk/Reward Ratios:`);
  const riskRewards = topPerformers.map((r) => r.riskRewardRatio);
  console.log(`    Min: ${Math.min(...riskRewards).toFixed(2)}:1`);
  console.log(`    Max: ${Math.max(...riskRewards).toFixed(2)}:1`);
  console.log(
    `    Avg: ${(riskRewards.reduce((a, b) => a + b, 0) / riskRewards.length).toFixed(2)}:1`
  );

  console.log("\n" + "═".repeat(80));
  console.log("  RECOMMENDED THRESHOLD CONFIGURATION");
  console.log("═".repeat(80));

  const best = bySharpe[0];
  console.log(
    `\n  Based on ${results.length} backtests, the optimal configuration is:`
  );
  console.log(`\n  Entry Thresholds:`);
  console.log(`    Buy Threshold: ${best.config.buyThreshold.toFixed(2)}`);
  console.log(
    `    Confidence Minimum: ${best.config.confidenceMin.toFixed(2)}`
  );
  console.log(`\n  Exit Thresholds:`);
  console.log(
    `    ATR Stop Multiplier: ${best.config.atrMultStop.toFixed(2)}x`
  );
  console.log(
    `    ATR Target Multiplier: ${best.config.atrMultTarget.toFixed(2)}x`
  );
  console.log(`    Risk/Reward Ratio: ${best.riskRewardRatio.toFixed(2)}:1`);
  console.log(`\n  Expected Performance:`);
  console.log(`    Sharpe Ratio: ${best.sharpe.toFixed(3)}`);
  console.log(`    Sortino Ratio: ${best.sortino.toFixed(3)}`);
  console.log(`    Calmar Ratio: ${best.calmar.toFixed(3)}`);
  console.log(`    Total Return: ${(best.totalReturn * 100).toFixed(2)}%`);
  console.log(`    Max Drawdown: ${(best.maxDrawdown * 100).toFixed(2)}%`);
  console.log(`    Win Rate: ${(best.winRate * 100).toFixed(1)}%`);
  console.log(`    Trades: ${best.trades.length}`);
  console.log(`    Profit Factor: ${best.profitFactor.toFixed(2)}`);
  console.log(`    Avg Win: $${best.avgWin.toFixed(2)}`);
  console.log(`    Avg Loss: $${best.avgLoss.toFixed(2)}`);

  console.log("\n" + "═".repeat(80) + "\n");
}

runThresholdOptimizer().catch(console.error);
