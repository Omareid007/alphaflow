/**
 * OMAR Enhanced Multi-Factor Backtest
 *
 * Comprehensive backtest framework integrating:
 * - Technical indicators (RSI, MACD, Bollinger, Stochastic, ATR, ADX)
 * - Price momentum and regime detection
 * - Volume analysis
 * - Simulated sentiment factors (based on price action proxies)
 * - News impact simulation
 * - Multi-factor scoring model
 *
 * @author Omar Algorithm
 */

// ============================================================================
// DATA STRUCTURES
// ============================================================================

interface AlpacaBar {
  t: string;  // timestamp
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
  n: number;  // trade count
  vw: number; // volume weighted avg price
}

interface BacktestConfig {
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  maxPositionPct: number;
  maxPortfolioExposure: number;

  // Technical indicator parameters
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  smaPeriod: number;
  emaPeriodFast: number;
  emaPeriodSlow: number;
  atrPeriod: number;
  adxPeriod: number;
  stochPeriod: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  bbPeriod: number;
  bbStdDev: number;

  // Risk management
  atrMultiplierStop: number;
  atrMultiplierTarget: number;
  maxDailyLoss: number;

  // Signal thresholds
  buyThreshold: number;
  sellThreshold: number;
  confidenceMinimum: number;

  // Multi-factor weights (must sum to 1)
  technicalWeight: number;
  momentumWeight: number;
  volatilityWeight: number;
  volumeWeight: number;
  sentimentWeight: number;
}

interface Trade {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  shares: number;
  side: "long" | "short";
  pnl: number;
  pnlPct: number;
  exitReason: string;
  holdingDays: number;
  signals: SignalComponents;
}

interface SignalComponents {
  technical: number;
  momentum: number;
  volatility: number;
  volume: number;
  sentiment: number;
  composite: number;
  confidence: number;
  regime: string;
}

interface BacktestResult {
  config: BacktestConfig;
  trades: Trade[];
  metrics: BacktestMetrics;
  equityCurve: { date: string; equity: number }[];
  signalStats: SignalStats;
}

interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPct: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  avgHoldingDays: number;
  finalEquity: number;
  cagr: number;
  calmarRatio: number;
  avgTradeReturn: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

interface SignalStats {
  avgTechnical: number;
  avgMomentum: number;
  avgVolatility: number;
  avgVolume: number;
  avgSentiment: number;
  avgComposite: number;
  avgConfidence: number;
  regimeCounts: Record<string, number>;
}

// ============================================================================
// ALPACA DATA FETCHING
// ============================================================================

async function fetchAlpacaBars(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<AlpacaBar[]> {
  const ALPACA_KEY = process.env.ALPACA_API_KEY;
  const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;

  if (!ALPACA_KEY || !ALPACA_SECRET) {
    throw new Error("Alpaca API credentials not configured");
  }

  const baseUrl = "https://data.alpaca.markets/v2/stocks";
  const allBars: AlpacaBar[] = [];
  let pageToken: string | null = null;

  do {
    const params = new URLSearchParams({
      start: `${startDate}T00:00:00Z`,
      end: `${endDate}T23:59:59Z`,
      timeframe: "1Day",
      limit: "10000",
    });

    if (pageToken) {
      params.set("page_token", pageToken);
    }

    const url = `${baseUrl}/${symbol}/bars?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": ALPACA_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Alpaca API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const bars = data.bars || [];
    allBars.push(...bars);
    pageToken = data.next_page_token || null;

  } while (pageToken);

  return allBars;
}

// ============================================================================
// TECHNICAL INDICATORS
// ============================================================================

function calculateSMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

function calculateEMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const sma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(sma);
    } else {
      const prevEMA = result[i - 1]!;
      const ema = (prices[i] - prevEMA) * multiplier + prevEMA;
      result.push(ema);
    }
  }
  return result;
}

function calculateRSI(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  result.push(null); // First element has no RSI

  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    } else {
      const prevRSI = result[result.length - 1];
      if (prevRSI === null) {
        result.push(null);
        continue;
      }

      const prevAvgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const prevAvgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;

      const avgGain = (prevAvgGain * (period - 1) + gains[i]) / period;
      const avgLoss = (prevAvgLoss * (period - 1) + losses[i]) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }

  return result;
}

function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): (number | null)[] {
  const result: (number | null)[] = [];
  const trueRanges: number[] = [];

  for (let i = 0; i < highs.length; i++) {
    if (i === 0) {
      trueRanges.push(highs[i] - lows[i]);
    } else {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
  }

  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(atr);
    } else {
      const prevATR = result[i - 1]!;
      const atr = (prevATR * (period - 1) + trueRanges[i]) / period;
      result.push(atr);
    }
  }

  return result;
}

function calculateStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): { k: (number | null)[]; d: (number | null)[] } {
  const k: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      k.push(null);
    } else {
      const periodHighs = highs.slice(i - period + 1, i + 1);
      const periodLows = lows.slice(i - period + 1, i + 1);
      const highestHigh = Math.max(...periodHighs);
      const lowestLow = Math.min(...periodLows);

      if (highestHigh === lowestLow) {
        k.push(50);
      } else {
        k.push(((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100);
      }
    }
  }

  const d = calculateSMA(k.filter((v): v is number => v !== null), 3);
  const dPadded: (number | null)[] = [];
  let dIndex = 0;

  for (let i = 0; i < k.length; i++) {
    if (k[i] === null || dIndex >= d.length) {
      dPadded.push(null);
    } else {
      dPadded.push(d[dIndex]);
      dIndex++;
    }
  }

  return { k, d: dPadded };
}

function calculateMACD(
  prices: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);

  const macd: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) {
      macd.push(null);
    } else {
      macd.push(emaFast[i]! - emaSlow[i]!);
    }
  }

  const macdValues = macd.filter((v): v is number => v !== null);
  const signalLine = calculateEMA(macdValues, signalPeriod);

  const signal: (number | null)[] = [];
  const histogram: (number | null)[] = [];
  let signalIndex = 0;

  for (let i = 0; i < macd.length; i++) {
    if (macd[i] === null) {
      signal.push(null);
      histogram.push(null);
    } else {
      const sig = signalLine[signalIndex] ?? null;
      signal.push(sig);
      histogram.push(sig !== null ? macd[i]! - sig : null);
      signalIndex++;
    }
  }

  return { macd, signal, histogram };
}

function calculateBollingerBands(
  prices: number[],
  period: number,
  stdDev: number
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = calculateSMA(prices, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = prices.slice(Math.max(0, i - period + 1), i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / slice.length;
      const std = Math.sqrt(variance);

      upper.push(middle[i]! + stdDev * std);
      lower.push(middle[i]! - stdDev * std);
    }
  }

  return { upper, middle, lower };
}

function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): (number | null)[] {
  const result: (number | null)[] = [];

  // Calculate +DM and -DM
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const trueRanges: number[] = [];

  for (let i = 0; i < highs.length; i++) {
    if (i === 0) {
      plusDM.push(0);
      minusDM.push(0);
      trueRanges.push(highs[i] - lows[i]);
    } else {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];

      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
  }

  // Smooth with Wilder's method
  const smoothPlusDM: number[] = [];
  const smoothMinusDM: number[] = [];
  const smoothTR: number[] = [];

  for (let i = 0; i < period - 1; i++) {
    result.push(null);
    smoothPlusDM.push(0);
    smoothMinusDM.push(0);
    smoothTR.push(0);
  }

  if (highs.length < period) return result;

  let sumPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let sumMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let sumTR = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);

  const dx: number[] = [];

  for (let i = period - 1; i < highs.length; i++) {
    if (i === period - 1) {
      smoothPlusDM.push(sumPlusDM);
      smoothMinusDM.push(sumMinusDM);
      smoothTR.push(sumTR);
    } else {
      sumPlusDM = smoothPlusDM[smoothPlusDM.length - 1] - (smoothPlusDM[smoothPlusDM.length - 1] / period) + plusDM[i];
      sumMinusDM = smoothMinusDM[smoothMinusDM.length - 1] - (smoothMinusDM[smoothMinusDM.length - 1] / period) + minusDM[i];
      sumTR = smoothTR[smoothTR.length - 1] - (smoothTR[smoothTR.length - 1] / period) + trueRanges[i];

      smoothPlusDM.push(sumPlusDM);
      smoothMinusDM.push(sumMinusDM);
      smoothTR.push(sumTR);
    }

    const plusDI = sumTR !== 0 ? (sumPlusDM / sumTR) * 100 : 0;
    const minusDI = sumTR !== 0 ? (sumMinusDM / sumTR) * 100 : 0;

    const diDiff = Math.abs(plusDI - minusDI);
    const diSum = plusDI + minusDI;

    dx.push(diSum !== 0 ? (diDiff / diSum) * 100 : 0);
  }

  // Calculate ADX as smoothed DX
  for (let i = 0; i < dx.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(adx);
    } else {
      const prevADX = result[result.length - 1]!;
      const adx = ((prevADX * (period - 1)) + dx[i]) / period;
      result.push(adx);
    }
  }

  return result;
}

// ============================================================================
// SIGNAL GENERATION - MULTI-FACTOR MODEL
// ============================================================================

function detectRegime(
  prices: number[],
  index: number,
  sma20: number | null,
  sma50: number | null,
  adx: number | null
): string {
  if (index < 50 || sma20 === null || sma50 === null) return "unknown";

  const price = prices[index];
  const priceAboveSma20 = price > sma20;
  const priceAboveSma50 = price > sma50;
  const sma20AboveSma50 = sma20 > sma50;
  const isTrending = adx !== null && adx > 25;

  if (priceAboveSma20 && priceAboveSma50 && sma20AboveSma50 && isTrending) {
    return "strong_uptrend";
  }
  if (priceAboveSma20 && priceAboveSma50) {
    return "uptrend";
  }
  if (!priceAboveSma20 && !priceAboveSma50 && !sma20AboveSma50 && isTrending) {
    return "strong_downtrend";
  }
  if (!priceAboveSma20 && !priceAboveSma50) {
    return "downtrend";
  }
  return "ranging";
}

function calculateTechnicalScore(
  rsi: number | null,
  macdHist: number | null,
  stochK: number | null,
  stochD: number | null,
  price: number,
  bbUpper: number | null,
  bbLower: number | null,
  bbMiddle: number | null,
  config: BacktestConfig
): number {
  let score = 0;
  let factors = 0;

  // RSI signal
  if (rsi !== null) {
    if (rsi < config.rsiOversold) {
      score += 1.0;
    } else if (rsi < 40) {
      score += 0.5;
    } else if (rsi > config.rsiOverbought) {
      score -= 1.0;
    } else if (rsi > 60) {
      score -= 0.5;
    }
    factors++;
  }

  // MACD histogram signal
  if (macdHist !== null) {
    if (macdHist > 0.5) {
      score += 1.0;
    } else if (macdHist > 0) {
      score += 0.5;
    } else if (macdHist < -0.5) {
      score -= 1.0;
    } else if (macdHist < 0) {
      score -= 0.5;
    }
    factors++;
  }

  // Stochastic signal
  if (stochK !== null && stochD !== null) {
    if (stochK < 20 && stochK > stochD) {
      score += 1.0;
    } else if (stochK < 30) {
      score += 0.3;
    } else if (stochK > 80 && stochK < stochD) {
      score -= 1.0;
    } else if (stochK > 70) {
      score -= 0.3;
    }
    factors++;
  }

  // Bollinger Bands signal
  if (bbUpper !== null && bbLower !== null && bbMiddle !== null) {
    const bbWidth = (bbUpper - bbLower) / bbMiddle;
    const pricePosition = (price - bbLower) / (bbUpper - bbLower);

    if (pricePosition < 0.2) {
      score += 0.8;
    } else if (pricePosition < 0.35) {
      score += 0.4;
    } else if (pricePosition > 0.8) {
      score -= 0.8;
    } else if (pricePosition > 0.65) {
      score -= 0.4;
    }
    factors++;
  }

  return factors > 0 ? score / factors : 0;
}

function calculateMomentumScore(
  prices: number[],
  index: number,
  emaFast: number | null,
  emaSlow: number | null,
  sma20: number | null
): number {
  if (index < 20 || emaFast === null || emaSlow === null) return 0;

  let score = 0;
  const price = prices[index];

  // EMA crossover
  const emaDiff = emaFast - emaSlow;
  const emaDiffPct = emaDiff / emaSlow * 100;

  if (emaDiffPct > 2) {
    score += 0.8;
  } else if (emaDiffPct > 0.5) {
    score += 0.4;
  } else if (emaDiffPct < -2) {
    score -= 0.8;
  } else if (emaDiffPct < -0.5) {
    score -= 0.4;
  }

  // Price momentum (10-day return)
  if (index >= 10) {
    const returnPct = (price - prices[index - 10]) / prices[index - 10] * 100;
    if (returnPct > 5) {
      score += 0.6;
    } else if (returnPct > 2) {
      score += 0.3;
    } else if (returnPct < -5) {
      score -= 0.6;
    } else if (returnPct < -2) {
      score -= 0.3;
    }
  }

  // Price vs SMA20
  if (sma20 !== null) {
    const distFromSma = (price - sma20) / sma20 * 100;
    if (distFromSma > 5 && distFromSma < 15) {
      score += 0.2; // Strong but not extended
    } else if (distFromSma > 15) {
      score -= 0.3; // Extended, potential pullback
    } else if (distFromSma < -5 && distFromSma > -15) {
      score -= 0.2;
    } else if (distFromSma < -15) {
      score += 0.3; // Oversold bounce potential
    }
  }

  return Math.max(-1, Math.min(1, score));
}

function calculateVolatilityScore(
  atr: number | null,
  adx: number | null,
  bbUpper: number | null,
  bbLower: number | null,
  bbMiddle: number | null,
  price: number
): number {
  let score = 0;

  // ADX trend strength
  if (adx !== null) {
    if (adx > 40) {
      score += 0.3; // Strong trend
    } else if (adx > 25) {
      score += 0.1; // Moderate trend
    } else if (adx < 15) {
      score -= 0.3; // No trend, choppy
    }
  }

  // Bollinger Band width (volatility)
  if (bbUpper !== null && bbLower !== null && bbMiddle !== null) {
    const bbWidth = (bbUpper - bbLower) / bbMiddle * 100;

    if (bbWidth < 5) {
      score += 0.4; // Low volatility, potential breakout
    } else if (bbWidth > 15) {
      score -= 0.2; // High volatility, risky
    }
  }

  return Math.max(-1, Math.min(1, score));
}

function calculateVolumeScore(
  volumes: number[],
  index: number
): number {
  if (index < 20) return 0;

  const currentVol = volumes[index];
  const avgVol = volumes.slice(index - 20, index).reduce((a, b) => a + b, 0) / 20;

  const volRatio = currentVol / avgVol;

  // Volume confirmation
  if (volRatio > 2) {
    return 0.5; // Strong volume, confirms moves
  } else if (volRatio > 1.5) {
    return 0.3;
  } else if (volRatio < 0.5) {
    return -0.3; // Low volume, unreliable moves
  }

  return 0;
}

function calculateSentimentScore(
  prices: number[],
  volumes: number[],
  index: number,
  regime: string
): number {
  // Simulate sentiment based on price action and volume patterns
  // This is a proxy since we can't get historical sentiment data

  if (index < 30) return 0;

  let score = 0;

  // Recent price action sentiment
  const return5d = (prices[index] - prices[index - 5]) / prices[index - 5];
  const return20d = (prices[index] - prices[index - 20]) / prices[index - 20];

  // Positive divergence: short-term weakness in uptrend
  if (return20d > 0.05 && return5d < 0) {
    score += 0.4; // Buying opportunity
  }

  // Negative divergence: short-term strength in downtrend
  if (return20d < -0.05 && return5d > 0) {
    score -= 0.4; // Selling opportunity
  }

  // Regime-based sentiment adjustment
  if (regime === "strong_uptrend") {
    score += 0.3;
  } else if (regime === "uptrend") {
    score += 0.1;
  } else if (regime === "strong_downtrend") {
    score -= 0.3;
  } else if (regime === "downtrend") {
    score -= 0.1;
  }

  // Volume spike sentiment (news proxy)
  const avgVol = volumes.slice(index - 20, index).reduce((a, b) => a + b, 0) / 20;
  const volRatio = volumes[index] / avgVol;

  if (volRatio > 2.5) {
    // Big volume spike - likely news
    const dayReturn = (prices[index] - prices[index - 1]) / prices[index - 1];
    if (dayReturn > 0.02) {
      score += 0.5; // Positive news sentiment
    } else if (dayReturn < -0.02) {
      score -= 0.5; // Negative news sentiment
    }
  }

  return Math.max(-1, Math.min(1, score));
}

function generateSignal(
  index: number,
  bars: AlpacaBar[],
  indicators: {
    rsi: (number | null)[];
    sma20: (number | null)[];
    sma50: (number | null)[];
    emaFast: (number | null)[];
    emaSlow: (number | null)[];
    atr: (number | null)[];
    adx: (number | null)[];
    stoch: { k: (number | null)[]; d: (number | null)[] };
    macd: { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] };
    bb: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] };
  },
  config: BacktestConfig
): SignalComponents {
  const prices = bars.map(b => b.c);
  const volumes = bars.map(b => b.v);
  const price = prices[index];

  // Detect market regime
  const regime = detectRegime(
    prices,
    index,
    indicators.sma20[index],
    indicators.sma50[index],
    indicators.adx[index]
  );

  // Calculate individual factor scores
  const technical = calculateTechnicalScore(
    indicators.rsi[index],
    indicators.macd.histogram[index],
    indicators.stoch.k[index],
    indicators.stoch.d[index],
    price,
    indicators.bb.upper[index],
    indicators.bb.lower[index],
    indicators.bb.middle[index],
    config
  );

  const momentum = calculateMomentumScore(
    prices,
    index,
    indicators.emaFast[index],
    indicators.emaSlow[index],
    indicators.sma20[index]
  );

  const volatility = calculateVolatilityScore(
    indicators.atr[index],
    indicators.adx[index],
    indicators.bb.upper[index],
    indicators.bb.lower[index],
    indicators.bb.middle[index],
    price
  );

  const volume = calculateVolumeScore(volumes, index);

  const sentiment = calculateSentimentScore(prices, volumes, index, regime);

  // Composite score with weights
  const composite =
    technical * config.technicalWeight +
    momentum * config.momentumWeight +
    volatility * config.volatilityWeight +
    volume * config.volumeWeight +
    sentiment * config.sentimentWeight;

  // Confidence based on signal alignment
  const signals = [technical, momentum, volatility, volume, sentiment];
  const positiveCount = signals.filter(s => s > 0.2).length;
  const negativeCount = signals.filter(s => s < -0.2).length;
  const alignment = Math.max(positiveCount, negativeCount) / signals.length;

  const confidence = Math.min(1, alignment * Math.abs(composite) * 2);

  return {
    technical,
    momentum,
    volatility,
    volume,
    sentiment,
    composite,
    confidence,
    regime,
  };
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

interface Position {
  symbol: string;
  shares: number;
  entryPrice: number;
  entryDate: string;
  stopLoss: number;
  takeProfit: number;
  side: "long" | "short";
  signals: SignalComponents;
}

function runBacktest(
  dataMap: Map<string, AlpacaBar[]>,
  config: BacktestConfig
): BacktestResult {
  const trades: Trade[] = [];
  const equityCurve: { date: string; equity: number }[] = [];
  const positions = new Map<string, Position>();

  let equity = config.initialCapital;
  let peakEquity = equity;
  let maxDrawdown = 0;
  let dailyPnl = 0;

  // Pre-calculate all indicators
  const indicatorsMap = new Map<string, ReturnType<typeof calculateAllIndicators>>();

  for (const [symbol, bars] of dataMap) {
    indicatorsMap.set(symbol, calculateAllIndicators(bars, config));
  }

  // Get union of all dates
  const allDates = new Set<string>();
  for (const bars of dataMap.values()) {
    for (const bar of bars) {
      allDates.add(bar.t.split("T")[0]);
    }
  }
  const sortedDates = Array.from(allDates).sort();

  // Signal statistics
  const allSignals: SignalComponents[] = [];

  for (const date of sortedDates) {
    dailyPnl = 0;

    // Process each symbol
    for (const [symbol, bars] of dataMap) {
      const indicators = indicatorsMap.get(symbol)!;
      const dateIndex = bars.findIndex(b => b.t.split("T")[0] === date);

      if (dateIndex < 50) continue; // Need enough data for indicators

      const bar = bars[dateIndex];
      const signals = generateSignal(dateIndex, bars, indicators, config);

      // Check existing position
      const position = positions.get(symbol);

      if (position) {
        // Check exit conditions
        let exitReason: string | null = null;
        let exitPrice = bar.c;

        // Stop loss
        if (bar.l <= position.stopLoss) {
          exitReason = "stop_loss";
          exitPrice = position.stopLoss;
        }
        // Take profit
        else if (bar.h >= position.takeProfit) {
          exitReason = "take_profit";
          exitPrice = position.takeProfit;
        }
        // Signal reversal
        else if (signals.composite < -config.sellThreshold && signals.confidence > config.confidenceMinimum) {
          exitReason = "signal_reversal";
        }
        // Trailing stop (update stop if price moved up)
        else if (bar.c > position.entryPrice * 1.02) {
          const atr = indicators.atr[dateIndex];
          if (atr !== null) {
            const newStop = bar.c - atr * config.atrMultiplierStop;
            position.stopLoss = Math.max(position.stopLoss, newStop);
          }
        }

        if (exitReason) {
          const pnl = (exitPrice - position.entryPrice) * position.shares;
          const pnlPct = (exitPrice - position.entryPrice) / position.entryPrice * 100;
          const holdingDays = Math.floor(
            (new Date(date).getTime() - new Date(position.entryDate).getTime()) / (1000 * 60 * 60 * 24)
          );

          trades.push({
            symbol,
            entryDate: position.entryDate,
            entryPrice: position.entryPrice,
            exitDate: date,
            exitPrice,
            shares: position.shares,
            side: position.side,
            pnl,
            pnlPct,
            exitReason,
            holdingDays,
            signals: position.signals,
          });

          equity += pnl;
          dailyPnl += pnl;
          positions.delete(symbol);
        }
      } else {
        // Check entry conditions
        const canEnter =
          signals.composite > config.buyThreshold &&
          signals.confidence > config.confidenceMinimum &&
          positions.size < 10 && // Max 10 positions
          (equity - Array.from(positions.values()).reduce((sum, p) => sum + p.shares * p.entryPrice, 0)) > equity * (1 - config.maxPortfolioExposure);

        if (canEnter) {
          const atr = indicators.atr[dateIndex];
          const positionSize = Math.min(
            equity * config.maxPositionPct,
            equity * 0.5 // Never more than 50% in one position
          );
          const shares = Math.floor(positionSize / bar.c);

          if (shares > 0 && atr !== null) {
            positions.set(symbol, {
              symbol,
              shares,
              entryPrice: bar.c,
              entryDate: date,
              stopLoss: bar.c - atr * config.atrMultiplierStop,
              takeProfit: bar.c + atr * config.atrMultiplierTarget,
              side: "long",
              signals,
            });

            allSignals.push(signals);
          }
        }
      }
    }

    // Check daily loss limit
    if (dailyPnl < -equity * config.maxDailyLoss) {
      // Close all positions
      for (const [symbol, position] of positions) {
        const bars = dataMap.get(symbol)!;
        const bar = bars.find(b => b.t.split("T")[0] === date);
        if (bar) {
          const pnl = (bar.c - position.entryPrice) * position.shares;
          trades.push({
            symbol,
            entryDate: position.entryDate,
            entryPrice: position.entryPrice,
            exitDate: date,
            exitPrice: bar.c,
            shares: position.shares,
            side: position.side,
            pnl,
            pnlPct: (bar.c - position.entryPrice) / position.entryPrice * 100,
            exitReason: "daily_loss_limit",
            holdingDays: Math.floor(
              (new Date(date).getTime() - new Date(position.entryDate).getTime()) / (1000 * 60 * 60 * 24)
            ),
            signals: position.signals,
          });
          equity += pnl;
        }
      }
      positions.clear();
    }

    // Update equity curve
    const unrealizedPnl = Array.from(positions.values()).reduce((sum, pos) => {
      const bars = dataMap.get(pos.symbol)!;
      const bar = bars.find(b => b.t.split("T")[0] === date);
      return sum + (bar ? (bar.c - pos.entryPrice) * pos.shares : 0);
    }, 0);

    const totalEquity = equity + unrealizedPnl;
    equityCurve.push({ date, equity: totalEquity });

    // Track drawdown
    if (totalEquity > peakEquity) {
      peakEquity = totalEquity;
    }
    const drawdown = (peakEquity - totalEquity) / peakEquity * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  // Close remaining positions
  const lastDate = sortedDates[sortedDates.length - 1];
  for (const [symbol, position] of positions) {
    const bars = dataMap.get(symbol)!;
    const bar = bars.find(b => b.t.split("T")[0] === lastDate);
    if (bar) {
      const pnl = (bar.c - position.entryPrice) * position.shares;
      trades.push({
        symbol,
        entryDate: position.entryDate,
        entryPrice: position.entryPrice,
        exitDate: lastDate,
        exitPrice: bar.c,
        shares: position.shares,
        side: position.side,
        pnl,
        pnlPct: (bar.c - position.entryPrice) / position.entryPrice * 100,
        exitReason: "end_of_backtest",
        holdingDays: Math.floor(
          (new Date(lastDate).getTime() - new Date(position.entryDate).getTime()) / (1000 * 60 * 60 * 24)
        ),
        signals: position.signals,
      });
      equity += pnl;
    }
  }

  // Calculate metrics
  const metrics = calculateMetrics(trades, config.initialCapital, equity, maxDrawdown, equityCurve);

  // Calculate signal statistics
  const signalStats = calculateSignalStats(allSignals);

  return { config, trades, metrics, equityCurve, signalStats };
}

function calculateAllIndicators(bars: AlpacaBar[], config: BacktestConfig) {
  const closes = bars.map(b => b.c);
  const highs = bars.map(b => b.h);
  const lows = bars.map(b => b.l);

  return {
    rsi: calculateRSI(closes, config.rsiPeriod),
    sma20: calculateSMA(closes, 20),
    sma50: calculateSMA(closes, 50),
    emaFast: calculateEMA(closes, config.emaPeriodFast),
    emaSlow: calculateEMA(closes, config.emaPeriodSlow),
    atr: calculateATR(highs, lows, closes, config.atrPeriod),
    adx: calculateADX(highs, lows, closes, config.adxPeriod),
    stoch: calculateStochastic(highs, lows, closes, config.stochPeriod),
    macd: calculateMACD(closes, config.macdFast, config.macdSlow, config.macdSignal),
    bb: calculateBollingerBands(closes, config.bbPeriod, config.bbStdDev),
  };
}

function calculateMetrics(
  trades: Trade[],
  initialCapital: number,
  finalEquity: number,
  maxDrawdown: number,
  equityCurve: { date: string; equity: number }[]
): BacktestMetrics {
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);

  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

  // Calculate Sharpe and Sortino ratios
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i].equity - equityCurve[i-1].equity) / equityCurve[i-1].equity);
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  const downstdDev = Math.sqrt(returns.filter(r => r < 0).reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.filter(r => r < 0).length || 1);

  const sharpeRatio = stdDev !== 0 ? (avgReturn * 252) / (stdDev * Math.sqrt(252)) : 0;
  const sortinoRatio = downstdDev !== 0 ? (avgReturn * 252) / (downstdDev * Math.sqrt(252)) : 0;

  // CAGR
  const startDate = new Date(equityCurve[0]?.date || Date.now());
  const endDate = new Date(equityCurve[equityCurve.length - 1]?.date || Date.now());
  const years = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const cagr = years > 0 ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100 : 0;

  // Consecutive wins/losses
  let maxConsecWins = 0, maxConsecLosses = 0;
  let currentConsecWins = 0, currentConsecLosses = 0;
  for (const trade of trades) {
    if (trade.pnl > 0) {
      currentConsecWins++;
      currentConsecLosses = 0;
      maxConsecWins = Math.max(maxConsecWins, currentConsecWins);
    } else {
      currentConsecLosses++;
      currentConsecWins = 0;
      maxConsecLosses = Math.max(maxConsecLosses, currentConsecLosses);
    }
  }

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    totalPnl,
    totalPnlPct: (totalPnl / initialCapital) * 100,
    avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
    avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    maxDrawdown,
    maxDrawdownPct: maxDrawdown,
    sharpeRatio,
    sortinoRatio,
    avgHoldingDays: trades.length > 0 ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length : 0,
    finalEquity,
    cagr,
    calmarRatio: maxDrawdown > 0 ? cagr / maxDrawdown : 0,
    avgTradeReturn: trades.length > 0 ? trades.reduce((sum, t) => sum + t.pnlPct, 0) / trades.length : 0,
    consecutiveWins: maxConsecWins,
    consecutiveLosses: maxConsecLosses,
  };
}

function calculateSignalStats(signals: SignalComponents[]): SignalStats {
  if (signals.length === 0) {
    return {
      avgTechnical: 0,
      avgMomentum: 0,
      avgVolatility: 0,
      avgVolume: 0,
      avgSentiment: 0,
      avgComposite: 0,
      avgConfidence: 0,
      regimeCounts: {},
    };
  }

  const regimeCounts: Record<string, number> = {};
  for (const sig of signals) {
    regimeCounts[sig.regime] = (regimeCounts[sig.regime] || 0) + 1;
  }

  return {
    avgTechnical: signals.reduce((sum, s) => sum + s.technical, 0) / signals.length,
    avgMomentum: signals.reduce((sum, s) => sum + s.momentum, 0) / signals.length,
    avgVolatility: signals.reduce((sum, s) => sum + s.volatility, 0) / signals.length,
    avgVolume: signals.reduce((sum, s) => sum + s.volume, 0) / signals.length,
    avgSentiment: signals.reduce((sum, s) => sum + s.sentiment, 0) / signals.length,
    avgComposite: signals.reduce((sum, s) => sum + s.composite, 0) / signals.length,
    avgConfidence: signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length,
    regimeCounts,
  };
}

// ============================================================================
// OPTIMIZATION SCORING
// ============================================================================

function calculateOptimizationScore(metrics: BacktestMetrics): number {
  // Multi-objective optimization score
  // Higher is better

  const winRateScore = Math.min(metrics.winRate, 60) / 60 * 25; // Max 25 points
  const profitFactorScore = Math.min(metrics.profitFactor, 3) / 3 * 25; // Max 25 points
  const sharpeScore = Math.min(Math.max(metrics.sharpeRatio, 0), 2) / 2 * 20; // Max 20 points
  const cagrScore = Math.min(Math.max(metrics.cagr, 0), 50) / 50 * 15; // Max 15 points
  const drawdownPenalty = Math.min(metrics.maxDrawdown, 20) / 20 * 15; // Max 15 penalty

  return winRateScore + profitFactorScore + sharpeScore + cagrScore - drawdownPenalty;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("=".repeat(80));
  console.log("OMAR ENHANCED MULTI-FACTOR BACKTEST");
  console.log("=".repeat(80));

  const symbols = ["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA", "META", "AMZN", "AMD", "SPY", "QQQ", "NFLX", "CRM"];
  const startDate = "2024-01-01";
  const endDate = "2025-12-20";

  console.log(`\nFetching historical data from ${startDate} to ${endDate}...`);

  // Fetch data
  const dataMap = new Map<string, AlpacaBar[]>();
  for (const symbol of symbols) {
    process.stdout.write(`Fetching ${symbol}... `);
    try {
      const bars = await fetchAlpacaBars(symbol, startDate, endDate);
      dataMap.set(symbol, bars);
      console.log(`${bars.length} bars`);
    } catch (error) {
      console.log(`ERROR: ${error}`);
    }
    await new Promise(r => setTimeout(r, 200)); // Rate limit
  }

  // Define parameter configurations for iteration
  const configs: BacktestConfig[] = [
    // 1. Baseline configuration
    {
      symbols, startDate, endDate,
      initialCapital: 100000,
      maxPositionPct: 0.05,
      maxPortfolioExposure: 0.6,
      rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
      smaPeriod: 20, emaPeriodFast: 12, emaPeriodSlow: 26,
      atrPeriod: 14, adxPeriod: 14, stochPeriod: 14,
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      bbPeriod: 20, bbStdDev: 2,
      atrMultiplierStop: 2, atrMultiplierTarget: 3,
      maxDailyLoss: 0.05,
      buyThreshold: 0.25, sellThreshold: 0.25, confidenceMinimum: 0.4,
      technicalWeight: 0.35, momentumWeight: 0.25, volatilityWeight: 0.15, volumeWeight: 0.1, sentimentWeight: 0.15,
    },
    // 2. Technical-heavy
    {
      symbols, startDate, endDate,
      initialCapital: 100000,
      maxPositionPct: 0.06,
      maxPortfolioExposure: 0.7,
      rsiPeriod: 14, rsiOversold: 25, rsiOverbought: 75,
      smaPeriod: 20, emaPeriodFast: 9, emaPeriodSlow: 21,
      atrPeriod: 14, adxPeriod: 14, stochPeriod: 14,
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      bbPeriod: 20, bbStdDev: 2,
      atrMultiplierStop: 1.5, atrMultiplierTarget: 2.5,
      maxDailyLoss: 0.04,
      buyThreshold: 0.3, sellThreshold: 0.3, confidenceMinimum: 0.45,
      technicalWeight: 0.50, momentumWeight: 0.20, volatilityWeight: 0.10, volumeWeight: 0.10, sentimentWeight: 0.10,
    },
    // 3. Momentum-focused
    {
      symbols, startDate, endDate,
      initialCapital: 100000,
      maxPositionPct: 0.07,
      maxPortfolioExposure: 0.6,
      rsiPeriod: 10, rsiOversold: 35, rsiOverbought: 65,
      smaPeriod: 20, emaPeriodFast: 8, emaPeriodSlow: 21,
      atrPeriod: 10, adxPeriod: 14, stochPeriod: 10,
      macdFast: 8, macdSlow: 17, macdSignal: 9,
      bbPeriod: 20, bbStdDev: 2,
      atrMultiplierStop: 2, atrMultiplierTarget: 4,
      maxDailyLoss: 0.05,
      buyThreshold: 0.2, sellThreshold: 0.2, confidenceMinimum: 0.35,
      technicalWeight: 0.25, momentumWeight: 0.40, volatilityWeight: 0.10, volumeWeight: 0.15, sentimentWeight: 0.10,
    },
    // 4. Sentiment-aware
    {
      symbols, startDate, endDate,
      initialCapital: 100000,
      maxPositionPct: 0.05,
      maxPortfolioExposure: 0.5,
      rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
      smaPeriod: 20, emaPeriodFast: 12, emaPeriodSlow: 26,
      atrPeriod: 14, adxPeriod: 14, stochPeriod: 14,
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      bbPeriod: 20, bbStdDev: 2,
      atrMultiplierStop: 2, atrMultiplierTarget: 3,
      maxDailyLoss: 0.04,
      buyThreshold: 0.3, sellThreshold: 0.3, confidenceMinimum: 0.5,
      technicalWeight: 0.25, momentumWeight: 0.20, volatilityWeight: 0.10, volumeWeight: 0.15, sentimentWeight: 0.30,
    },
    // 5. Conservative
    {
      symbols, startDate, endDate,
      initialCapital: 100000,
      maxPositionPct: 0.04,
      maxPortfolioExposure: 0.4,
      rsiPeriod: 14, rsiOversold: 25, rsiOverbought: 75,
      smaPeriod: 20, emaPeriodFast: 12, emaPeriodSlow: 26,
      atrPeriod: 14, adxPeriod: 14, stochPeriod: 14,
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      bbPeriod: 20, bbStdDev: 2.5,
      atrMultiplierStop: 2.5, atrMultiplierTarget: 3,
      maxDailyLoss: 0.03,
      buyThreshold: 0.35, sellThreshold: 0.35, confidenceMinimum: 0.55,
      technicalWeight: 0.30, momentumWeight: 0.20, volatilityWeight: 0.20, volumeWeight: 0.15, sentimentWeight: 0.15,
    },
    // 6. Aggressive
    {
      symbols, startDate, endDate,
      initialCapital: 100000,
      maxPositionPct: 0.08,
      maxPortfolioExposure: 0.8,
      rsiPeriod: 10, rsiOversold: 35, rsiOverbought: 65,
      smaPeriod: 15, emaPeriodFast: 8, emaPeriodSlow: 21,
      atrPeriod: 10, adxPeriod: 10, stochPeriod: 10,
      macdFast: 8, macdSlow: 17, macdSignal: 9,
      bbPeriod: 15, bbStdDev: 1.5,
      atrMultiplierStop: 1.5, atrMultiplierTarget: 4,
      maxDailyLoss: 0.06,
      buyThreshold: 0.15, sellThreshold: 0.15, confidenceMinimum: 0.3,
      technicalWeight: 0.35, momentumWeight: 0.30, volatilityWeight: 0.10, volumeWeight: 0.15, sentimentWeight: 0.10,
    },
    // 7. Low volatility
    {
      symbols, startDate, endDate,
      initialCapital: 100000,
      maxPositionPct: 0.05,
      maxPortfolioExposure: 0.5,
      rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
      smaPeriod: 20, emaPeriodFast: 12, emaPeriodSlow: 26,
      atrPeriod: 20, adxPeriod: 20, stochPeriod: 14,
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      bbPeriod: 25, bbStdDev: 2,
      atrMultiplierStop: 2.5, atrMultiplierTarget: 2.5,
      maxDailyLoss: 0.03,
      buyThreshold: 0.25, sellThreshold: 0.25, confidenceMinimum: 0.45,
      technicalWeight: 0.25, momentumWeight: 0.15, volatilityWeight: 0.35, volumeWeight: 0.10, sentimentWeight: 0.15,
    },
    // 8. High confidence only
    {
      symbols, startDate, endDate,
      initialCapital: 100000,
      maxPositionPct: 0.06,
      maxPortfolioExposure: 0.6,
      rsiPeriod: 14, rsiOversold: 25, rsiOverbought: 75,
      smaPeriod: 20, emaPeriodFast: 12, emaPeriodSlow: 26,
      atrPeriod: 14, adxPeriod: 14, stochPeriod: 14,
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      bbPeriod: 20, bbStdDev: 2,
      atrMultiplierStop: 2, atrMultiplierTarget: 3.5,
      maxDailyLoss: 0.04,
      buyThreshold: 0.4, sellThreshold: 0.4, confidenceMinimum: 0.6,
      technicalWeight: 0.30, momentumWeight: 0.25, volatilityWeight: 0.15, volumeWeight: 0.15, sentimentWeight: 0.15,
    },
    // 9. Wide targets
    {
      symbols, startDate, endDate,
      initialCapital: 100000,
      maxPositionPct: 0.05,
      maxPortfolioExposure: 0.5,
      rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
      smaPeriod: 20, emaPeriodFast: 12, emaPeriodSlow: 26,
      atrPeriod: 14, adxPeriod: 14, stochPeriod: 14,
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      bbPeriod: 20, bbStdDev: 2,
      atrMultiplierStop: 1.5, atrMultiplierTarget: 5,
      maxDailyLoss: 0.05,
      buyThreshold: 0.25, sellThreshold: 0.25, confidenceMinimum: 0.4,
      technicalWeight: 0.35, momentumWeight: 0.25, volatilityWeight: 0.15, volumeWeight: 0.10, sentimentWeight: 0.15,
    },
    // 10. Tight risk management
    {
      symbols, startDate, endDate,
      initialCapital: 100000,
      maxPositionPct: 0.04,
      maxPortfolioExposure: 0.4,
      rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
      smaPeriod: 20, emaPeriodFast: 12, emaPeriodSlow: 26,
      atrPeriod: 14, adxPeriod: 14, stochPeriod: 14,
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      bbPeriod: 20, bbStdDev: 2,
      atrMultiplierStop: 1.2, atrMultiplierTarget: 2.5,
      maxDailyLoss: 0.02,
      buyThreshold: 0.3, sellThreshold: 0.3, confidenceMinimum: 0.5,
      technicalWeight: 0.30, momentumWeight: 0.20, volatilityWeight: 0.20, volumeWeight: 0.15, sentimentWeight: 0.15,
    },
    // 11. Balanced optimized
    {
      symbols, startDate, endDate,
      initialCapital: 100000,
      maxPositionPct: 0.055,
      maxPortfolioExposure: 0.55,
      rsiPeriod: 12, rsiOversold: 28, rsiOverbought: 72,
      smaPeriod: 20, emaPeriodFast: 10, emaPeriodSlow: 24,
      atrPeriod: 12, adxPeriod: 12, stochPeriod: 12,
      macdFast: 10, macdSlow: 22, macdSignal: 8,
      bbPeriod: 18, bbStdDev: 2,
      atrMultiplierStop: 1.8, atrMultiplierTarget: 3.2,
      maxDailyLoss: 0.04,
      buyThreshold: 0.28, sellThreshold: 0.28, confidenceMinimum: 0.48,
      technicalWeight: 0.32, momentumWeight: 0.23, volatilityWeight: 0.15, volumeWeight: 0.12, sentimentWeight: 0.18,
    },
    // 12. Volume-weighted
    {
      symbols, startDate, endDate,
      initialCapital: 100000,
      maxPositionPct: 0.05,
      maxPortfolioExposure: 0.6,
      rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
      smaPeriod: 20, emaPeriodFast: 12, emaPeriodSlow: 26,
      atrPeriod: 14, adxPeriod: 14, stochPeriod: 14,
      macdFast: 12, macdSlow: 26, macdSignal: 9,
      bbPeriod: 20, bbStdDev: 2,
      atrMultiplierStop: 2, atrMultiplierTarget: 3,
      maxDailyLoss: 0.05,
      buyThreshold: 0.25, sellThreshold: 0.25, confidenceMinimum: 0.4,
      technicalWeight: 0.25, momentumWeight: 0.20, volatilityWeight: 0.15, volumeWeight: 0.25, sentimentWeight: 0.15,
    },
  ];

  const results: { iteration: number; result: BacktestResult; score: number }[] = [];

  for (let i = 0; i < configs.length; i++) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`ITERATION ${i + 1}`);
    console.log(`${"=".repeat(60)}`);

    const result = runBacktest(dataMap, configs[i]);
    const score = calculateOptimizationScore(result.metrics);

    console.log(`Trades: ${result.metrics.totalTrades} | Win Rate: ${result.metrics.winRate.toFixed(1)}%`);
    console.log(`P&L: $${result.metrics.totalPnl.toFixed(0)} (${result.metrics.totalPnlPct.toFixed(1)}%)`);
    console.log(`Profit Factor: ${result.metrics.profitFactor.toFixed(2)} | Sharpe: ${result.metrics.sharpeRatio.toFixed(2)} | Sortino: ${result.metrics.sortinoRatio.toFixed(2)}`);
    console.log(`Max DD: ${result.metrics.maxDrawdown.toFixed(1)}% | CAGR: ${result.metrics.cagr.toFixed(1)}% | Calmar: ${result.metrics.calmarRatio.toFixed(2)}`);
    console.log(`Avg Hold: ${result.metrics.avgHoldingDays.toFixed(1)} days | Consec W/L: ${result.metrics.consecutiveWins}/${result.metrics.consecutiveLosses}`);
    console.log(`Score: ${score.toFixed(2)}`);

    console.log(`\nSignal Stats:`);
    console.log(`  Technical: ${result.signalStats.avgTechnical.toFixed(3)}`);
    console.log(`  Momentum:  ${result.signalStats.avgMomentum.toFixed(3)}`);
    console.log(`  Volatility: ${result.signalStats.avgVolatility.toFixed(3)}`);
    console.log(`  Volume:    ${result.signalStats.avgVolume.toFixed(3)}`);
    console.log(`  Sentiment: ${result.signalStats.avgSentiment.toFixed(3)}`);
    console.log(`  Composite: ${result.signalStats.avgComposite.toFixed(3)}`);
    console.log(`  Confidence: ${result.signalStats.avgConfidence.toFixed(3)}`);
    console.log(`  Regimes:   ${JSON.stringify(result.signalStats.regimeCounts)}`);

    results.push({ iteration: i + 1, result, score });
  }

  // Sort by score and find best
  results.sort((a, b) => b.score - a.score);
  const best = results[0];

  console.log(`\n${"=".repeat(80)}`);
  console.log("OPTIMIZATION COMPLETE - BEST RESULT");
  console.log(`${"=".repeat(80)}`);
  console.log(`Iteration: ${best.iteration}`);
  console.log(`Score: ${best.score.toFixed(2)}`);
  console.log(`\nMetrics:`);
  console.log(JSON.stringify(best.result.metrics, null, 2));
  console.log(`\nFactor Weights:`);
  console.log(`  Technical: ${(best.result.config.technicalWeight * 100).toFixed(0)}%`);
  console.log(`  Momentum:  ${(best.result.config.momentumWeight * 100).toFixed(0)}%`);
  console.log(`  Volatility: ${(best.result.config.volatilityWeight * 100).toFixed(0)}%`);
  console.log(`  Volume:    ${(best.result.config.volumeWeight * 100).toFixed(0)}%`);
  console.log(`  Sentiment: ${(best.result.config.sentimentWeight * 100).toFixed(0)}%`);

  console.log(`\nKey Parameters:`);
  console.log(`  RSI: ${best.result.config.rsiPeriod} (${best.result.config.rsiOversold}/${best.result.config.rsiOverbought})`);
  console.log(`  EMA: ${best.result.config.emaPeriodFast}/${best.result.config.emaPeriodSlow}`);
  console.log(`  MACD: ${best.result.config.macdFast}/${best.result.config.macdSlow}/${best.result.config.macdSignal}`);
  console.log(`  ATR Mult: ${best.result.config.atrMultiplierStop}x stop / ${best.result.config.atrMultiplierTarget}x target`);
  console.log(`  Thresholds: Buy ${best.result.config.buyThreshold} / Confidence ${best.result.config.confidenceMinimum}`);

  console.log(`\nSample Winning Trades:`);
  const winningTrades = best.result.trades.filter(t => t.pnl > 0).slice(0, 5);
  for (const trade of winningTrades) {
    console.log(`  ${trade.symbol}: ${trade.entryDate} @ $${trade.entryPrice.toFixed(2)} -> ${trade.exitDate} @ $${trade.exitPrice.toFixed(2)} | P&L: $${trade.pnl.toFixed(2)} (${trade.exitReason})`);
  }

  console.log(`\nSample Losing Trades:`);
  const losingTrades = best.result.trades.filter(t => t.pnl < 0).slice(0, 5);
  for (const trade of losingTrades) {
    console.log(`  ${trade.symbol}: ${trade.entryDate} @ $${trade.entryPrice.toFixed(2)} -> ${trade.exitDate} @ $${trade.exitPrice.toFixed(2)} | P&L: $${trade.pnl.toFixed(2)} (${trade.exitReason})`);
  }

  console.log(`\n=== ALL RESULTS RANKED ===`);
  for (const r of results) {
    console.log(`Iter ${r.iteration}: Score=${r.score.toFixed(2)}, WinRate=${r.result.metrics.winRate.toFixed(1)}%, PF=${r.result.metrics.profitFactor.toFixed(2)}, Sharpe=${r.result.metrics.sharpeRatio.toFixed(2)}, CAGR=${r.result.metrics.cagr.toFixed(1)}%`);
  }

  // Output summary for documentation
  console.log(`\n=== ALGO SUMMARY FOR DOCUMENTATION ===`);
  console.log(`Best Configuration:`);
  console.log(JSON.stringify(best.result.config, null, 2));
}

main().catch(console.error);
