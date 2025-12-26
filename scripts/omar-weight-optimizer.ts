/**
 * OMAR FACTOR WEIGHT OPTIMIZATION ENGINE
 *
 * Tests 1000+ weight combinations to find optimal factor weights
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
 */

// ============================================================================
// TYPES & IMPORTS
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
  useRiskParity: boolean;
  regimeFilter: boolean;
  sectorRotation: boolean;
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

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n: number;
  vw: number;
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
  momentum: (number | null)[];
  willR: (number | null)[];
  cci: (number | null)[];
  bollingerUpper: (number | null)[];
  bollingerLower: (number | null)[];
  bollingerWidth: (number | null)[];
  keltnerUpper: (number | null)[];
  keltnerLower: (number | null)[];
  obv: (number | null)[];
  vwap: (number | null)[];
  mfi: (number | null)[];
  macdHist: (number | null)[];
  parabolicSar: (number | null)[];
  ichimokuCloud: { tenkan: (number | null)[]; kijun: (number | null)[]; senkouA: (number | null)[]; senkouB: (number | null)[] };
}

interface ChartPattern {
  type: string;
  confidence: number;
  priceTarget: number;
  direction: "bullish" | "bearish" | "neutral";
  startIndex: number;
  endIndex: number;
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
  vwapDeviation: number;
  volumeProfile: number;
  composite: number;
  confidence: number;
  regime: string;
  trendStrength: number;
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
  side: "long" | "short";
  pnl: number;
  pnlPct: number;
  exitReason: string;
  holdingDays: number;
  signals: FullPowerSignal;
  regimeAtEntry: string;
  atrAtEntry: number;
  correlationAtEntry: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Use top performing symbols for faster optimization
const OPTIMIZATION_UNIVERSE = [
  // US Mega-Cap Tech
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META",
  // Large-Cap Tech
  "AMD", "CRM", "NFLX", "ADBE",
  // Finance
  "JPM", "BAC", "V", "MA",
  // Healthcare
  "JNJ", "UNH", "LLY",
  // Consumer
  "WMT", "COST", "HD",
  // ETFs
  "SPY", "QQQ", "IWM",
];

const SECTOR_MAP: Record<string, string> = {
  AAPL: "Tech", MSFT: "Tech", GOOGL: "Tech", AMZN: "Tech", NVDA: "Tech", META: "Tech",
  AMD: "Tech", CRM: "Tech", NFLX: "Tech", ADBE: "Tech",
  JPM: "Finance", BAC: "Finance", V: "Finance", MA: "Finance",
  JNJ: "Healthcare", UNH: "Healthcare", LLY: "Healthcare",
  WMT: "Consumer", COST: "Consumer", HD: "Consumer",
  SPY: "ETF", QQQ: "ETF", IWM: "ETF",
};

const WEIGHT_RANGES = {
  technical: { min: 0.05, max: 0.35 },
  momentum: { min: 0.05, max: 0.35 },
  volatility: { min: 0.02, max: 0.20 },
  volume: { min: 0.05, max: 0.25 },
  sentiment: { min: 0.05, max: 0.25 },
  pattern: { min: 0.02, max: 0.20 },
  breadth: { min: 0.02, max: 0.15 },
  correlation: { min: 0.02, max: 0.20 },
};

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchAlpacaBars(symbol: string, startDate: string, endDate: string): Promise<AlpacaBar[]> {
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

    if (pageToken) params.set("page_token", pageToken);

    const url = `${baseUrl}/${symbol}/bars?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": ALPACA_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET,
      },
    });

    if (!response.ok) {
      throw new Error(`Alpaca API error: ${response.status}`);
    }

    const data = await response.json();
    allBars.push(...(data.bars || []));
    pageToken = data.next_page_token || null;
  } while (pageToken);

  return allBars;
}

// ============================================================================
// TECHNICAL INDICATORS (from original backtest)
// ============================================================================

function calculateSMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) result.push(null);
    else result.push(prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function calculateEMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) result.push(null);
    else if (i === period - 1) result.push(prices.slice(0, period).reduce((a, b) => a + b, 0) / period);
    else result.push((prices[i] - result[i - 1]!) * k + result[i - 1]!);
  }
  return result;
}

function calculateRSI(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      let gains = 0, losses = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const change = prices[j] - prices[j - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }
  return result;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const tr: number[] = [];
  for (let i = 0; i < highs.length; i++) {
    if (i === 0) tr.push(highs[i] - lows[i]);
    else tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1) result.push(null);
    else result.push(tr.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function calculateADX(highs: number[], lows: number[], closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < highs.length; i++) {
    if (i < period * 2) result.push(null);
    else {
      let sumPlusDM = 0, sumMinusDM = 0, sumTR = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const upMove = highs[j] - highs[j - 1];
        const downMove = lows[j - 1] - lows[j];
        sumPlusDM += upMove > downMove && upMove > 0 ? upMove : 0;
        sumMinusDM += downMove > upMove && downMove > 0 ? downMove : 0;
        sumTR += Math.max(highs[j] - lows[j], Math.abs(highs[j] - closes[j - 1]), Math.abs(lows[j] - closes[j - 1]));
      }
      const plusDI = sumTR !== 0 ? (sumPlusDM / sumTR) * 100 : 0;
      const minusDI = sumTR !== 0 ? (sumMinusDM / sumTR) * 100 : 0;
      result.push((plusDI + minusDI) !== 0 ? (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100 : 0);
    }
  }
  return result;
}

function calculateMACD(prices: number[], fast: number, slow: number, signal: number) {
  const emaFast = calculateEMA(prices, fast);
  const emaSlow = calculateEMA(prices, slow);
  const macd: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) macd.push(null);
    else macd.push(emaFast[i]! - emaSlow[i]!);
  }
  const macdVals = macd.filter((v): v is number => v !== null);
  const signalLine = calculateEMA(macdVals, signal);
  const hist: (number | null)[] = [];
  let si = 0;
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] === null) hist.push(null);
    else { hist.push(signalLine[si] !== null && signalLine[si] !== undefined ? macd[i]! - signalLine[si]! : null); si++; }
  }
  return { macd, histogram: hist };
}

function calculateOBV(closes: number[], volumes: number[]): (number | null)[] {
  const result: (number | null)[] = [volumes[0]];
  for (let i = 1; i < closes.length; i++) {
    const prev = result[i - 1]!;
    if (closes[i] > closes[i - 1]) result.push(prev + volumes[i]);
    else if (closes[i] < closes[i - 1]) result.push(prev - volumes[i]);
    else result.push(prev);
  }
  return result;
}

function calculateMFI(highs: number[], lows: number[], closes: number[], volumes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const typicalPrice = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const rawMoneyFlow = typicalPrice.map((tp, i) => tp * volumes[i]);

  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      let posFlow = 0, negFlow = 0;
      for (let j = i - period + 1; j <= i; j++) {
        if (typicalPrice[j] > typicalPrice[j - 1]) posFlow += rawMoneyFlow[j];
        else negFlow += rawMoneyFlow[j];
      }
      const mfr = negFlow === 0 ? 100 : posFlow / negFlow;
      result.push(100 - (100 / (1 + mfr)));
    }
  }
  return result;
}

function calculateROC(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) result.push(null);
    else result.push(((prices[i] - prices[i - period]) / prices[i - period]) * 100);
  }
  return result;
}

function calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) result.push(null);
    else {
      const periodHighs = highs.slice(i - period + 1, i + 1);
      const periodLows = lows.slice(i - period + 1, i + 1);
      const hh = Math.max(...periodHighs);
      const ll = Math.min(...periodLows);
      result.push(hh === ll ? -50 : ((hh - closes[i]) / (hh - ll)) * -100);
    }
  }
  return result;
}

function calculateCCI(highs: number[], lows: number[], closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = tp.slice(i - period + 1, i + 1);
      const sma = slice.reduce((a, b) => a + b, 0) / period;
      const meanDev = slice.reduce((sum, p) => sum + Math.abs(p - sma), 0) / period;
      result.push(meanDev === 0 ? 0 : (tp[i] - sma) / (0.015 * meanDev));
    }
  }
  return result;
}

function calculateBollingerBands(prices: number[], period: number, stdDev: number) {
  const middle = calculateSMA(prices, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const width: (number | null)[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (middle[i] === null) {
      upper.push(null); lower.push(null); width.push(null);
    } else {
      const slice = prices.slice(Math.max(0, i - period + 1), i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / slice.length;
      const std = Math.sqrt(variance);
      upper.push(middle[i]! + stdDev * std);
      lower.push(middle[i]! - stdDev * std);
      width.push(middle[i]! > 0 ? ((upper[i]! - lower[i]!) / middle[i]!) * 100 : null);
    }
  }

  return { upper, middle, lower, width };
}

function calculateAllIndicators(bars: AlpacaBar[]): AdvancedIndicators {
  const closes = bars.map(b => b.c);
  const highs = bars.map(b => b.h);
  const lows = bars.map(b => b.l);
  const volumes = bars.map(b => b.v);

  const bb = calculateBollingerBands(closes, 20, 2);
  const macd = calculateMACD(closes, 12, 26, 9);

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
    momentum: calculateROC(closes, 10),
    willR: calculateWilliamsR(highs, lows, closes, 14),
    cci: calculateCCI(highs, lows, closes, 20),
    bollingerUpper: bb.upper,
    bollingerLower: bb.lower,
    bollingerWidth: bb.width,
    keltnerUpper: bb.upper,
    keltnerLower: bb.lower,
    obv: calculateOBV(closes, volumes),
    vwap: closes.map((c, i) => bars.slice(0, i + 1).reduce((sum, b) => sum + b.c * b.v, 0) / bars.slice(0, i + 1).reduce((sum, b) => sum + b.v, 0)),
    mfi: calculateMFI(highs, lows, closes, volumes, 14),
    macdHist: macd.histogram,
    parabolicSar: closes,
    ichimokuCloud: { tenkan: calculateSMA(closes, 9), kijun: calculateSMA(closes, 26), senkouA: closes, senkouB: closes },
  };
}

// ============================================================================
// PATTERN RECOGNITION & REGIME DETECTION
// ============================================================================

function findExtrema(prices: number[], windowSize: number = 5): { peaks: number[]; troughs: number[] } {
  const peaks: number[] = [];
  const troughs: number[] = [];

  for (let i = windowSize; i < prices.length - windowSize; i++) {
    const window = prices.slice(i - windowSize, i + windowSize + 1);
    if (prices[i] === Math.max(...window)) peaks.push(i);
    if (prices[i] === Math.min(...window)) troughs.push(i);
  }

  return { peaks, troughs };
}

function detectAllPatterns(prices: number[], highs: number[], lows: number[], index: number): ChartPattern[] {
  const patterns: ChartPattern[] = [];
  if (index < 50) return patterns;

  const { peaks, troughs } = findExtrema(prices.slice(0, index + 1), 3);

  // Double Bottom
  if (troughs.length >= 2) {
    const [i1, i2] = troughs.slice(-2);
    const t1 = lows[i1], t2 = lows[i2];
    if (Math.abs(t1 - t2) / t1 < 0.02 && (i2 - i1) > 5 && (i2 - i1) < 50) {
      patterns.push({ type: "double_bottom", confidence: 0.65, priceTarget: t1 * 1.05, direction: "bullish", startIndex: i1, endIndex: index });
    }
  }

  // Ascending Triangle
  if (peaks.length >= 3 && troughs.length >= 3) {
    const recentPeaks = peaks.slice(-3).map(i => highs[i]);
    const recentTroughs = troughs.slice(-3).map(i => lows[i]);
    const flatTop = Math.abs(recentPeaks[0] - recentPeaks[2]) / recentPeaks[0] < 0.02;
    const risingBottom = recentTroughs[2] > recentTroughs[0] * 1.02;
    if (flatTop && risingBottom) {
      patterns.push({ type: "ascending_triangle", confidence: 0.6, priceTarget: prices[index] * 1.08, direction: "bullish", startIndex: peaks.slice(-3)[0], endIndex: index });
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

  let num = 0, xDen = 0, yDen = 0;
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
  adx: number | null,
  volatility: number
): string {
  if (sma20 === null || sma50 === null) return "unknown";

  const aboveSma20 = price > sma20;
  const aboveSma50 = price > sma50;
  const aboveSma200 = sma200 !== null ? price > sma200 : aboveSma50;
  const sma20Above50 = sma20 > sma50;
  const trending = adx !== null && adx > 25;

  if (aboveSma20 && aboveSma50 && aboveSma200 && sma20Above50 && trending) return "strong_bull";
  if (aboveSma20 && aboveSma50 && sma20Above50) return "bull";
  if (!aboveSma20 && !aboveSma50 && !aboveSma200 && !sma20Above50 && trending) return "strong_bear";
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
  const prices = bars.map(b => b.c);
  const volumes = bars.map(b => b.v);
  const price = prices[index];
  const highs = bars.map(b => b.h);
  const lows = bars.map(b => b.l);

  const returns = index >= 20 ? prices.slice(index - 20, index + 1).map((p, i, arr) => i > 0 ? (p - arr[i - 1]) / arr[i - 1] : 0) : [0];
  const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length);

  const regime = detectMarketRegime(
    price,
    indicators.sma20[index],
    indicators.sma50[index],
    indicators.sma200[index],
    indicators.adx[index],
    volatility
  );

  // ============== TECHNICAL SCORE ==============
  let technical = 0;
  let techFactors = 0;

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

  // ============== MOMENTUM SCORE ==============
  let momentum = 0;

  const emaFast = indicators.emaFast[index];
  const emaSlow = indicators.emaSlow[index];
  if (emaFast !== null && emaSlow !== null) {
    const emaDiff = (emaFast - emaSlow) / emaSlow * 100;
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

  // ============== VOLATILITY SCORE ==============
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

  // ============== VOLUME SCORE ==============
  let volume = 0;
  if (index >= 20) {
    const avgVol = volumes.slice(index - 20, index).reduce((a, b) => a + b, 0) / 20;
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

  // ============== SENTIMENT SCORE ==============
  let sentiment = 0;
  const return5d = index >= 5 ? (price - prices[index - 5]) / prices[index - 5] : 0;
  const return20d = index >= 20 ? (price - prices[index - 20]) / prices[index - 20] : 0;

  if (return20d > 0.05 && return5d < 0) sentiment += 0.5;
  if (return20d < -0.05 && return5d > 0) sentiment -= 0.5;

  if (regime === "strong_bull") sentiment += 0.3;
  else if (regime === "bull") sentiment += 0.15;
  else if (regime === "strong_bear") sentiment -= 0.3;
  else if (regime === "bear") sentiment -= 0.15;

  sentiment = Math.max(-1, Math.min(1, sentiment));

  // ============== PATTERN SCORE ==============
  const patterns = detectAllPatterns(prices, highs, lows, index);
  let pattern = 0;
  for (const p of patterns) {
    if (p.direction === "bullish") pattern += p.confidence * 0.5;
    else if (p.direction === "bearish") pattern -= p.confidence * 0.5;
  }
  pattern = Math.max(-1, Math.min(1, pattern));

  // ============== BREADTH SCORE ==============
  let breadth = 0;
  if (regime === "strong_bull" || regime === "bull") breadth += 0.3;
  else if (regime === "strong_bear" || regime === "bear") breadth -= 0.3;

  // ============== CORRELATION SCORE ==============
  let correlation = 0;
  if (spyReturns.length > 20 && index >= 20) {
    const stockReturns = prices.slice(index - 20, index + 1).map((p, i, arr) => i > 0 ? (p - arr[i - 1]) / arr[i - 1] : 0);
    const corr = calculateCorrelation(stockReturns, spyReturns.slice(-21));
    if (corr > 0.8) correlation = 0.2;
    else if (corr < 0.3) correlation = -0.1;
  }

  // ============== VWAP DEVIATION ==============
  let vwapDev = 0;
  const vwap = indicators.vwap[index];
  if (vwap !== null) {
    const deviation = (price - vwap) / vwap * 100;
    if (deviation < -2) vwapDev = 0.4;
    else if (deviation > 2) vwapDev = -0.4;
  }

  // ============== COMPOSITE WITH DYNAMIC WEIGHTS ==============
  const composite =
    technical * weights.technicalWeight +
    momentum * weights.momentumWeight +
    vol * weights.volatilityWeight +
    volume * weights.volumeWeight +
    sentiment * weights.sentimentWeight +
    pattern * weights.patternWeight +
    breadth * weights.breadthWeight +
    correlation * weights.correlationWeight;

  // ============== CONFIDENCE ==============
  const scores = [technical, momentum, vol, volume, sentiment, pattern, breadth];
  const posCount = scores.filter(s => s > 0.2).length;
  const negCount = scores.filter(s => s < -0.2).length;
  const alignment = Math.max(posCount, negCount) / scores.length;
  const confidence = Math.min(1, alignment * Math.abs(composite) * 2.5);

  const trendStrength = adx !== null ? adx / 100 : 0.3;

  return {
    technical,
    momentum,
    volatility: vol,
    volume,
    sentiment,
    pattern,
    breadth,
    correlation,
    vwapDeviation: vwapDev,
    volumeProfile: volume,
    composite,
    confidence,
    regime,
    trendStrength,
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

  // Pre-calculate indicators
  const indicatorsMap = new Map<string, AdvancedIndicators>();
  for (const [symbol, bars] of dataMap) {
    indicatorsMap.set(symbol, calculateAllIndicators(bars));
  }

  const spyReturns = spyBars.map((b, i, arr) => i > 0 ? (b.c - arr[i - 1].c) / arr[i - 1].c : 0);

  const allDates = new Set<string>();
  for (const bars of dataMap.values()) {
    for (const bar of bars) allDates.add(bar.t.split("T")[0]);
  }
  const sortedDates = Array.from(allDates).sort();

  for (const date of sortedDates) {
    let dailyPnl = 0;

    for (const [symbol, bars] of dataMap) {
      const indicators = indicatorsMap.get(symbol)!;
      const dateIndex = bars.findIndex(b => b.t.split("T")[0] === date);
      if (dateIndex < 100) continue;

      const bar = bars[dateIndex];
      const signals = generateFullPowerSignal(dateIndex, bars, indicators, spyReturns, config);
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
          if (atr !== null) {
            position.stopLoss = Math.max(position.stopLoss, bar.c - atr * config.atrMultStop);
          }
        }

        if (exitReason) {
          const pnl = (exitPrice - position.entryPrice) * position.shares;
          const holdingDays = Math.floor((new Date(date).getTime() - new Date(position.entryDate).getTime()) / (1000 * 60 * 60 * 24));

          trades.push({
            symbol,
            sector,
            entryDate: position.entryDate,
            entryPrice: position.entryPrice,
            exitDate: date,
            exitPrice,
            shares: position.shares,
            side: "long",
            pnl,
            pnlPct: (exitPrice - position.entryPrice) / position.entryPrice * 100,
            exitReason,
            holdingDays,
            signals: position.signals,
            regimeAtEntry: position.signals.regime,
            atrAtEntry: position.atr,
            correlationAtEntry: position.signals.correlation,
          });

          equity += pnl;
          dailyPnl += pnl;
          positions.delete(symbol);
        }
      } else {
        const favorableRegime = ["strong_bull", "bull", "ranging"].includes(signals.regime);

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

    // Daily loss check
    if (dailyPnl < -equity * config.maxDailyLoss) {
      for (const [symbol, position] of positions) {
        const bars = dataMap.get(symbol)!;
        const bar = bars.find(b => b.t.split("T")[0] === date);
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
            side: "long",
            pnl,
            pnlPct: (bar.c - position.entryPrice) / position.entryPrice * 100,
            exitReason: "daily_loss_limit",
            holdingDays: 0,
            signals: position.signals,
            regimeAtEntry: position.signals.regime,
            atrAtEntry: position.atr,
            correlationAtEntry: position.signals.correlation,
          });
          equity += pnl;
        }
      }
      positions.clear();
    }

    if (equity > peakEquity) peakEquity = equity;
    maxDrawdown = Math.max(maxDrawdown, (peakEquity - equity) / peakEquity * 100);
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
        sector: position.sector,
        entryDate: position.entryDate,
        entryPrice: position.entryPrice,
        exitDate: lastDate,
        exitPrice: bar.c,
        shares: position.shares,
        side: "long",
        pnl,
        pnlPct: (bar.c - position.entryPrice) / position.entryPrice * 100,
        exitReason: "end_of_backtest",
        holdingDays: Math.floor((new Date(lastDate).getTime() - new Date(position.entryDate).getTime()) / (1000 * 60 * 60 * 24)),
        signals: position.signals,
        regimeAtEntry: position.signals.regime,
        atrAtEntry: position.atr,
        correlationAtEntry: position.signals.correlation,
      });
      equity += pnl;
    }
  }

  // Calculate metrics
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

  const returns = trades.map(t => t.pnlPct / 100);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length) : 0;
  const downReturns = returns.filter(r => r < 0);
  const downStdDev = downReturns.length > 1 ? Math.sqrt(downReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downReturns.length) : 1;

  const sharpeRatio = stdDev !== 0 ? (avgReturn * Math.sqrt(252)) / stdDev : 0;
  const sortinoRatio = downStdDev !== 0 ? (avgReturn * Math.sqrt(252)) / downStdDev : 0;
  const years = 2.95;
  const cagr = years > 0 ? (Math.pow(equity / config.initialCapital, 1 / years) - 1) * 100 : 0;
  const calmarRatio = maxDrawdown > 0 ? cagr / maxDrawdown : 0;
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

  return {
    trades,
    metrics: {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      totalPnl,
      totalPnlPct: (totalPnl / config.initialCapital) * 100,
      avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
      profitFactor,
      maxDrawdown,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      avgHoldingDays: trades.length > 0 ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length : 0,
      finalEquity: equity,
      cagr,
    },
  };
}

// ============================================================================
// WEIGHT GENERATION
// ============================================================================

function normalizeWeights(weights: WeightConfig): WeightConfig {
  const sum = weights.technicalWeight + weights.momentumWeight + weights.volatilityWeight +
    weights.volumeWeight + weights.sentimentWeight + weights.patternWeight +
    weights.breadthWeight + weights.correlationWeight;

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
  const weights: WeightConfig = {
    technicalWeight: Math.random() * (WEIGHT_RANGES.technical.max - WEIGHT_RANGES.technical.min) + WEIGHT_RANGES.technical.min,
    momentumWeight: Math.random() * (WEIGHT_RANGES.momentum.max - WEIGHT_RANGES.momentum.min) + WEIGHT_RANGES.momentum.min,
    volatilityWeight: Math.random() * (WEIGHT_RANGES.volatility.max - WEIGHT_RANGES.volatility.min) + WEIGHT_RANGES.volatility.min,
    volumeWeight: Math.random() * (WEIGHT_RANGES.volume.max - WEIGHT_RANGES.volume.min) + WEIGHT_RANGES.volume.min,
    sentimentWeight: Math.random() * (WEIGHT_RANGES.sentiment.max - WEIGHT_RANGES.sentiment.min) + WEIGHT_RANGES.sentiment.min,
    patternWeight: Math.random() * (WEIGHT_RANGES.pattern.max - WEIGHT_RANGES.pattern.min) + WEIGHT_RANGES.pattern.min,
    breadthWeight: Math.random() * (WEIGHT_RANGES.breadth.max - WEIGHT_RANGES.breadth.min) + WEIGHT_RANGES.breadth.min,
    correlationWeight: Math.random() * (WEIGHT_RANGES.correlation.max - WEIGHT_RANGES.correlation.min) + WEIGHT_RANGES.correlation.min,
  };

  return normalizeWeights(weights);
}

function generateBalancedWeights(): WeightConfig {
  return normalizeWeights({
    technicalWeight: 0.20,
    momentumWeight: 0.20,
    volatilityWeight: 0.10,
    volumeWeight: 0.15,
    sentimentWeight: 0.15,
    patternWeight: 0.10,
    breadthWeight: 0.05,
    correlationWeight: 0.05,
  });
}

function generateDominantWeights(dominantFactor: string): WeightConfig {
  const weights: WeightConfig = {
    technicalWeight: 0.05,
    momentumWeight: 0.05,
    volatilityWeight: 0.05,
    volumeWeight: 0.05,
    sentimentWeight: 0.05,
    patternWeight: 0.05,
    breadthWeight: 0.05,
    correlationWeight: 0.05,
  };

  // Assign 60% to dominant factor
  (weights as any)[`${dominantFactor}Weight`] = 0.60;

  return normalizeWeights(weights);
}

function generateWeightVariations(): WeightConfig[] {
  const variations: WeightConfig[] = [];

  // 1. Balanced baseline
  variations.push(generateBalancedWeights());

  // 2. Test each factor as dominant (8 configurations)
  const factors = ['technical', 'momentum', 'volatility', 'volume', 'sentiment', 'pattern', 'breadth', 'correlation'];
  for (const factor of factors) {
    variations.push(generateDominantWeights(factor));
  }

  // 3. Technical + Momentum heavy
  variations.push(normalizeWeights({
    technicalWeight: 0.35,
    momentumWeight: 0.35,
    volatilityWeight: 0.05,
    volumeWeight: 0.05,
    sentimentWeight: 0.05,
    patternWeight: 0.05,
    breadthWeight: 0.05,
    correlationWeight: 0.05,
  }));

  // 4. Volume + Sentiment heavy
  variations.push(normalizeWeights({
    technicalWeight: 0.10,
    momentumWeight: 0.10,
    volatilityWeight: 0.05,
    volumeWeight: 0.25,
    sentimentWeight: 0.25,
    patternWeight: 0.10,
    breadthWeight: 0.10,
    correlationWeight: 0.05,
  }));

  // 5. Pattern + Breadth + Correlation (alternative factors)
  variations.push(normalizeWeights({
    technicalWeight: 0.10,
    momentumWeight: 0.10,
    volatilityWeight: 0.05,
    volumeWeight: 0.10,
    sentimentWeight: 0.10,
    patternWeight: 0.20,
    breadthWeight: 0.20,
    correlationWeight: 0.15,
  }));

  // 6. Low volatility focus
  variations.push(normalizeWeights({
    technicalWeight: 0.15,
    momentumWeight: 0.15,
    volatilityWeight: 0.20,
    volumeWeight: 0.10,
    sentimentWeight: 0.10,
    patternWeight: 0.10,
    breadthWeight: 0.10,
    correlationWeight: 0.10,
  }));

  // 7. Random combinations (optimized for speed - 100 random samples)
  for (let i = 0; i < 100; i++) {
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
    useRiskParity: true,
    regimeFilter: true,
    sectorRotation: true,
  };

  for (let i = 0; i < weightVariations.length; i++) {
    const weights = weightVariations[i];
    const config: BacktestConfig = { ...baseConfig, ...weights };

    try {
      const { trades, metrics } = runBacktest(dataMap, config, spyBars);

      // Composite score: prioritize Sharpe, Calmar, Win Rate, and Return
      const score =
        metrics.sharpeRatio * 30 +
        metrics.calmarRatio * 25 +
        metrics.winRate * 0.25 +
        metrics.totalPnlPct * 0.15 +
        (metrics.profitFactor > 10 ? 10 : metrics.profitFactor) * 2;

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

      if ((i + 1) % 50 === 0) {
        console.log(`Progress: ${i + 1}/${weightVariations.length} (${((i + 1) / weightVariations.length * 100).toFixed(1)}%)`);
      }
    } catch (error) {
      console.log(`Error testing weight combination ${i + 1}: ${error}`);
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
  console.log(`Universe: ${OPTIMIZATION_UNIVERSE.length} symbols (optimized for speed)`);
  console.log(`Period: 2022-01-01 to 2025-12-20 (3 years)`);
  console.log(`Target: 100+ weight combinations (structured + random sampling)`);
  console.log("=".repeat(100));

  const startDate = "2022-01-01";
  const endDate = "2025-12-20";

  console.log(`\nFetching historical data...`);

  const dataMap = new Map<string, AlpacaBar[]>();
  let successCount = 0;

  // Fetch SPY first
  console.log("Fetching SPY...");
  let spyBars: AlpacaBar[] = [];
  try {
    spyBars = await fetchAlpacaBars("SPY", startDate, endDate);
    dataMap.set("SPY", spyBars);
    console.log(`SPY: ${spyBars.length} bars`);
    successCount++;
  } catch (e) {
    console.log("SPY: ERROR");
  }

  // Fetch rest
  for (const symbol of OPTIMIZATION_UNIVERSE.filter(s => s !== "SPY")) {
    process.stdout.write(`${symbol}... `);
    try {
      const bars = await fetchAlpacaBars(symbol, startDate, endDate);
      if (bars.length > 200) {
        dataMap.set(symbol, bars);
        console.log(`${bars.length} bars`);
        successCount++;
      } else {
        console.log(`SKIP (${bars.length} bars)`);
      }
    } catch (error) {
      console.log(`ERROR`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nLoaded ${successCount}/${OPTIMIZATION_UNIVERSE.length} symbols`);

  // Run optimization
  const startTime = Date.now();
  const results = await runWeightOptimization(dataMap, spyBars);
  const endTime = Date.now();

  console.log(`\n${"=".repeat(100)}`);
  console.log("OPTIMIZATION COMPLETE");
  console.log(`${"=".repeat(100)}`);
  console.log(`Total configurations tested: ${results.length}`);
  console.log(`Time elapsed: ${((endTime - startTime) / 1000 / 60).toFixed(2)} minutes`);

  // Display top 20 results
  console.log(`\n${"=".repeat(100)}`);
  console.log("TOP 20 WEIGHT CONFIGURATIONS");
  console.log(`${"=".repeat(100)}`);

  for (let i = 0; i < Math.min(20, results.length); i++) {
    const r = results[i];
    console.log(`\n--- RANK #${i + 1} (Score: ${r.score.toFixed(2)}) ---`);
    console.log(`Sharpe: ${r.sharpe.toFixed(3)} | Sortino: ${r.sortino.toFixed(3)} | Calmar: ${r.calmar.toFixed(3)}`);
    console.log(`Win Rate: ${r.winRate.toFixed(1)}% | Return: ${r.totalReturn.toFixed(1)}% | Max DD: ${r.maxDrawdown.toFixed(1)}%`);
    console.log(`CAGR: ${r.cagr.toFixed(1)}% | Profit Factor: ${r.profitFactor.toFixed(2)} | Trades: ${r.totalTrades}`);
    console.log(`Weights:`);
    console.log(`  Technical:    ${(r.weights.technicalWeight * 100).toFixed(1)}%`);
    console.log(`  Momentum:     ${(r.weights.momentumWeight * 100).toFixed(1)}%`);
    console.log(`  Volatility:   ${(r.weights.volatilityWeight * 100).toFixed(1)}%`);
    console.log(`  Volume:       ${(r.weights.volumeWeight * 100).toFixed(1)}%`);
    console.log(`  Sentiment:    ${(r.weights.sentimentWeight * 100).toFixed(1)}%`);
    console.log(`  Pattern:      ${(r.weights.patternWeight * 100).toFixed(1)}%`);
    console.log(`  Breadth:      ${(r.weights.breadthWeight * 100).toFixed(1)}%`);
    console.log(`  Correlation:  ${(r.weights.correlationWeight * 100).toFixed(1)}%`);
  }

  // Best overall
  const best = results[0];
  console.log(`\n${"=".repeat(100)}`);
  console.log("OPTIMAL WEIGHT CONFIGURATION");
  console.log(`${"=".repeat(100)}`);
  console.log(`\nFinal Metrics:`);
  console.log(`  Sharpe Ratio:     ${best.sharpe.toFixed(3)}`);
  console.log(`  Sortino Ratio:    ${best.sortino.toFixed(3)}`);
  console.log(`  Calmar Ratio:     ${best.calmar.toFixed(3)}`);
  console.log(`  Win Rate:         ${best.winRate.toFixed(1)}%`);
  console.log(`  Total Return:     ${best.totalReturn.toFixed(1)}%`);
  console.log(`  CAGR:             ${best.cagr.toFixed(1)}%`);
  console.log(`  Max Drawdown:     ${best.maxDrawdown.toFixed(1)}%`);
  console.log(`  Profit Factor:    ${best.profitFactor.toFixed(2)}`);
  console.log(`  Total Trades:     ${best.totalTrades}`);
  console.log(`\nOptimal Factor Weights:`);
  console.log(`  technicalWeight:    ${best.weights.technicalWeight.toFixed(4)} (${(best.weights.technicalWeight * 100).toFixed(1)}%)`);
  console.log(`  momentumWeight:     ${best.weights.momentumWeight.toFixed(4)} (${(best.weights.momentumWeight * 100).toFixed(1)}%)`);
  console.log(`  volatilityWeight:   ${best.weights.volatilityWeight.toFixed(4)} (${(best.weights.volatilityWeight * 100).toFixed(1)}%)`);
  console.log(`  volumeWeight:       ${best.weights.volumeWeight.toFixed(4)} (${(best.weights.volumeWeight * 100).toFixed(1)}%)`);
  console.log(`  sentimentWeight:    ${best.weights.sentimentWeight.toFixed(4)} (${(best.weights.sentimentWeight * 100).toFixed(1)}%)`);
  console.log(`  patternWeight:      ${best.weights.patternWeight.toFixed(4)} (${(best.weights.patternWeight * 100).toFixed(1)}%)`);
  console.log(`  breadthWeight:      ${best.weights.breadthWeight.toFixed(4)} (${(best.weights.breadthWeight * 100).toFixed(1)}%)`);
  console.log(`  correlationWeight:  ${best.weights.correlationWeight.toFixed(4)} (${(best.weights.correlationWeight * 100).toFixed(1)}%)`);

  console.log(`\n${"=".repeat(100)}`);
}

main().catch(console.error);
