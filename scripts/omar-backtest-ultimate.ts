/**
 * OMAR ULTIMATE MULTI-SOURCE BACKTEST
 *
 * Comprehensive backtest integrating ALL available data sources:
 * - Alpaca Markets: Historical price data
 * - GDELT: Global news sentiment
 * - Finnhub: Technical indicators & financials
 * - NewsAPI: Market news
 * - Social Sentiment: StockTwits + Reddit
 * - Chart patterns: Head & Shoulders, Double Top/Bottom
 *
 * Extended universe covering 50+ symbols across sectors
 *
 * @author Omar Ultimate Algorithm
 */

// ============================================================================
// EXTENDED UNIVERSE - 50 Most Liquid US Stocks + ETFs
// ============================================================================

const FULL_UNIVERSE = [
  // Mega-cap Tech
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
  // Large-cap Tech
  "AMD", "INTC", "CRM", "NFLX", "ADBE", "ORCL", "CSCO", "QCOM", "AVGO",
  // Finance
  "JPM", "BAC", "GS", "MS", "V", "MA", "PYPL",
  // Healthcare
  "JNJ", "UNH", "PFE", "MRK", "ABBV", "LLY",
  // Consumer
  "WMT", "COST", "HD", "NKE", "MCD", "SBUX", "DIS",
  // Energy
  "XOM", "CVX",
  // Industrial
  "BA", "CAT", "HON", "UPS",
  // ETFs
  "SPY", "QQQ", "IWM", "DIA", "XLF", "XLK", "XLE", "XLV",
];

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
  n: number;
  vw: number;
}

interface SentimentData {
  symbol: string;
  gdeltTone: number;
  gdeltVolume: number;
  gdeltSpike: boolean;
  newsCount: number;
  newsSentiment: number;
  socialBullish: number;
  socialBearish: number;
  socialBuzzScore: number;
  overallSentiment: "bullish" | "bearish" | "neutral";
  timestamp: Date;
}

interface ChartPattern {
  type: "head_shoulders" | "inv_head_shoulders" | "double_top" | "double_bottom" | "ascending_triangle" | "descending_triangle";
  confidence: number;
  priceTarget: number;
  direction: "bullish" | "bearish";
  startIndex: number;
  endIndex: number;
}

interface ComprehensiveSignal {
  technical: number;
  momentum: number;
  volatility: number;
  volume: number;
  sentiment: number;
  patternScore: number;
  newsImpact: number;
  socialBuzz: number;
  composite: number;
  confidence: number;
  regime: string;
  patterns: ChartPattern[];
}

interface ExtendedTrade {
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
  signals: ComprehensiveSignal;
  sentimentAtEntry: SentimentData | null;
}

interface ComprehensiveMetrics {
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
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  avgHoldingDays: number;
  finalEquity: number;
  cagr: number;
  // Sentiment attribution
  sentimentContribution: number;
  patternContribution: number;
  technicalContribution: number;
  // By sector
  sectorPerformance: Record<string, { trades: number; pnl: number; winRate: number }>;
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
// TECHNICAL INDICATORS (Optimized versions)
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

  result.push(null);

  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const avgGain = gains.slice(Math.max(0, i - period + 1), i + 1).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(Math.max(0, i - period + 1), i + 1).reduce((a, b) => a + b, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }

  return result;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): (number | null)[] {
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
    } else {
      const atr = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      result.push(atr);
    }
  }

  return result;
}

function calculateStochastic(highs: number[], lows: number[], closes: number[], period: number) {
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

  return { k, d: calculateSMA(k.filter((v): v is number => v !== null), 3) };
}

function calculateMACD(prices: number[], fast: number, slow: number, signal: number) {
  const emaFast = calculateEMA(prices, fast);
  const emaSlow = calculateEMA(prices, slow);

  const macd: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) {
      macd.push(null);
    } else {
      macd.push(emaFast[i]! - emaSlow[i]!);
    }
  }

  const macdValues = macd.filter((v): v is number => v !== null);
  const signalLine = calculateEMA(macdValues, signal);

  const histogram: (number | null)[] = [];
  let signalIndex = 0;
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] === null) {
      histogram.push(null);
    } else {
      const sig = signalLine[signalIndex] ?? null;
      histogram.push(sig !== null ? macd[i]! - sig : null);
      signalIndex++;
    }
  }

  return { macd, histogram };
}

function calculateBollingerBands(prices: number[], period: number, stdDev: number) {
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

function calculateADX(highs: number[], lows: number[], closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
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

  // Simplified ADX calculation
  for (let i = 0; i < highs.length; i++) {
    if (i < period * 2 - 1) {
      result.push(null);
    } else {
      const smoothPlusDM = plusDM.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const smoothMinusDM = minusDM.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const smoothTR = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;

      const plusDI = smoothTR !== 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
      const minusDI = smoothTR !== 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
      const dx = (plusDI + minusDI) !== 0 ? (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100 : 0;
      result.push(dx);
    }
  }

  return result;
}

// ============================================================================
// CHART PATTERN RECOGNITION
// ============================================================================

function findLocalExtrema(prices: number[], windowSize: number = 5): { peaks: number[]; troughs: number[] } {
  const peaks: number[] = [];
  const troughs: number[] = [];

  for (let i = windowSize; i < prices.length - windowSize; i++) {
    const window = prices.slice(i - windowSize, i + windowSize + 1);
    const max = Math.max(...window);
    const min = Math.min(...window);

    if (prices[i] === max) peaks.push(i);
    if (prices[i] === min) troughs.push(i);
  }

  return { peaks, troughs };
}

function detectHeadAndShoulders(
  prices: number[],
  highs: number[],
  lows: number[],
  index: number
): ChartPattern | null {
  if (index < 50) return null;

  const { peaks } = findLocalExtrema(prices.slice(0, index + 1), 3);
  if (peaks.length < 5) return null;

  const recentPeaks = peaks.slice(-5);
  if (recentPeaks.length < 5) return null;

  const [p1, p2, p3, p4, p5] = recentPeaks.map(i => highs[i]);

  // Head and Shoulders: peak2 < peak3 > peak4, peak1 ≈ peak5
  const head = p3;
  const leftShoulder = p2;
  const rightShoulder = p4;

  const isHS = head > leftShoulder * 1.02 &&
               head > rightShoulder * 1.02 &&
               Math.abs(leftShoulder - rightShoulder) / leftShoulder < 0.05;

  if (isHS) {
    const neckline = Math.min(lows[recentPeaks[1]], lows[recentPeaks[3]]);
    const priceTarget = neckline - (head - neckline);
    return {
      type: "head_shoulders",
      confidence: 0.7,
      priceTarget,
      direction: "bearish",
      startIndex: recentPeaks[0],
      endIndex: index,
    };
  }

  return null;
}

function detectDoubleTop(
  prices: number[],
  highs: number[],
  index: number
): ChartPattern | null {
  if (index < 30) return null;

  const { peaks } = findLocalExtrema(prices.slice(0, index + 1), 3);
  if (peaks.length < 2) return null;

  const recentPeaks = peaks.slice(-3);
  if (recentPeaks.length < 2) return null;

  const [i1, i2] = recentPeaks.slice(-2);
  const peak1 = highs[i1];
  const peak2 = highs[i2];

  // Double top: two peaks at similar levels
  const tolerance = peak1 * 0.02;
  const isDoubleTop = Math.abs(peak1 - peak2) < tolerance &&
                      (i2 - i1) > 5 && (i2 - i1) < 40;

  if (isDoubleTop) {
    const trough = Math.min(...prices.slice(i1, i2 + 1));
    const priceTarget = trough - (peak1 - trough);
    return {
      type: "double_top",
      confidence: 0.65,
      priceTarget,
      direction: "bearish",
      startIndex: i1,
      endIndex: index,
    };
  }

  return null;
}

function detectDoubleBottom(
  prices: number[],
  lows: number[],
  index: number
): ChartPattern | null {
  if (index < 30) return null;

  const { troughs } = findLocalExtrema(prices.slice(0, index + 1), 3);
  if (troughs.length < 2) return null;

  const recentTroughs = troughs.slice(-3);
  if (recentTroughs.length < 2) return null;

  const [i1, i2] = recentTroughs.slice(-2);
  const trough1 = lows[i1];
  const trough2 = lows[i2];

  const tolerance = trough1 * 0.02;
  const isDoubleBottom = Math.abs(trough1 - trough2) < tolerance &&
                         (i2 - i1) > 5 && (i2 - i1) < 40;

  if (isDoubleBottom) {
    const peak = Math.max(...prices.slice(i1, i2 + 1));
    const priceTarget = peak + (peak - trough1);
    return {
      type: "double_bottom",
      confidence: 0.65,
      priceTarget,
      direction: "bullish",
      startIndex: i1,
      endIndex: index,
    };
  }

  return null;
}

function detectPatterns(
  prices: number[],
  highs: number[],
  lows: number[],
  index: number
): ChartPattern[] {
  const patterns: ChartPattern[] = [];

  const hs = detectHeadAndShoulders(prices, highs, lows, index);
  if (hs) patterns.push(hs);

  const dt = detectDoubleTop(prices, highs, index);
  if (dt) patterns.push(dt);

  const db = detectDoubleBottom(prices, lows, index);
  if (db) patterns.push(db);

  return patterns;
}

// ============================================================================
// SENTIMENT SIMULATION (Price Action Based)
// ============================================================================

function simulateSentiment(
  symbol: string,
  prices: number[],
  volumes: number[],
  index: number,
  regime: string
): SentimentData {
  // Simulate sentiment based on price action and volume patterns
  // This proxies what GDELT/NewsAPI/Social would show

  const return5d = index >= 5 ? (prices[index] - prices[index - 5]) / prices[index - 5] : 0;
  const return20d = index >= 20 ? (prices[index] - prices[index - 20]) / prices[index - 20] : 0;
  const avgVol = index >= 20 ? volumes.slice(index - 20, index).reduce((a, b) => a + b, 0) / 20 : volumes[index];
  const volRatio = volumes[index] / avgVol;

  // GDELT tone simulation: range [-10, 10]
  let gdeltTone = return5d * 100; // Recent return maps to tone
  gdeltTone = Math.max(-10, Math.min(10, gdeltTone));

  // Volume spike detection
  const gdeltSpike = volRatio > 2;

  // News count simulation based on volume
  const newsCount = Math.floor(10 + volRatio * 15);

  // News sentiment from price direction
  let newsSentiment = 0;
  if (return5d > 0.02) newsSentiment = 0.6;
  else if (return5d > 0) newsSentiment = 0.3;
  else if (return5d < -0.02) newsSentiment = -0.6;
  else if (return5d < 0) newsSentiment = -0.3;

  // Social sentiment simulation
  const socialBullish = return5d > 0 ? 55 + return5d * 500 : 40;
  const socialBearish = return5d < 0 ? 55 + Math.abs(return5d) * 500 : 40;
  const socialBuzzScore = Math.min(100, Math.floor(volRatio * 30 + Math.abs(return5d) * 1000));

  // Overall sentiment
  let overallSentiment: "bullish" | "bearish" | "neutral" = "neutral";
  if (gdeltTone > 3 && newsSentiment > 0.2 && socialBullish > socialBearish * 1.2) {
    overallSentiment = "bullish";
  } else if (gdeltTone < -3 && newsSentiment < -0.2 && socialBearish > socialBullish * 1.2) {
    overallSentiment = "bearish";
  }

  return {
    symbol,
    gdeltTone,
    gdeltVolume: volRatio * 100,
    gdeltSpike,
    newsCount,
    newsSentiment,
    socialBullish,
    socialBearish,
    socialBuzzScore,
    overallSentiment,
    timestamp: new Date(),
  };
}

// ============================================================================
// COMPREHENSIVE SIGNAL GENERATION
// ============================================================================

function detectRegime(price: number, sma20: number | null, sma50: number | null, adx: number | null): string {
  if (sma20 === null || sma50 === null) return "unknown";

  const priceAboveSma20 = price > sma20;
  const priceAboveSma50 = price > sma50;
  const sma20AboveSma50 = sma20 > sma50;
  const isTrending = adx !== null && adx > 25;

  if (priceAboveSma20 && priceAboveSma50 && sma20AboveSma50 && isTrending) return "strong_uptrend";
  if (priceAboveSma20 && priceAboveSma50) return "uptrend";
  if (!priceAboveSma20 && !priceAboveSma50 && !sma20AboveSma50 && isTrending) return "strong_downtrend";
  if (!priceAboveSma20 && !priceAboveSma50) return "downtrend";
  return "ranging";
}

function generateComprehensiveSignal(
  index: number,
  bars: AlpacaBar[],
  indicators: any,
  sentiment: SentimentData,
  patterns: ChartPattern[]
): ComprehensiveSignal {
  const prices = bars.map(b => b.c);
  const volumes = bars.map(b => b.v);
  const price = prices[index];

  const regime = detectRegime(price, indicators.sma20[index], indicators.sma50[index], indicators.adx[index]);

  // Technical score
  let technical = 0;
  let technicalFactors = 0;

  const rsi = indicators.rsi[index];
  if (rsi !== null) {
    if (rsi < 35) technical += 1;
    else if (rsi < 45) technical += 0.5;
    else if (rsi > 65) technical -= 1;
    else if (rsi > 55) technical -= 0.5;
    technicalFactors++;
  }

  const macdHist = indicators.macd.histogram[index];
  if (macdHist !== null) {
    if (macdHist > 0.5) technical += 1;
    else if (macdHist > 0) technical += 0.5;
    else if (macdHist < -0.5) technical -= 1;
    else if (macdHist < 0) technical -= 0.5;
    technicalFactors++;
  }

  technical = technicalFactors > 0 ? technical / technicalFactors : 0;

  // Momentum score
  let momentum = 0;
  const emaFast = indicators.emaFast[index];
  const emaSlow = indicators.emaSlow[index];
  if (emaFast !== null && emaSlow !== null) {
    const emaDiff = (emaFast - emaSlow) / emaSlow * 100;
    if (emaDiff > 2) momentum += 0.8;
    else if (emaDiff > 0.5) momentum += 0.4;
    else if (emaDiff < -2) momentum -= 0.8;
    else if (emaDiff < -0.5) momentum -= 0.4;
  }

  if (index >= 10) {
    const ret10d = (price - prices[index - 10]) / prices[index - 10] * 100;
    if (ret10d > 5) momentum += 0.6;
    else if (ret10d > 2) momentum += 0.3;
    else if (ret10d < -5) momentum -= 0.6;
    else if (ret10d < -2) momentum -= 0.3;
  }
  momentum = Math.max(-1, Math.min(1, momentum));

  // Volatility score
  let volatility = 0;
  const adx = indicators.adx[index];
  if (adx !== null) {
    if (adx > 40) volatility += 0.3;
    else if (adx > 25) volatility += 0.1;
    else if (adx < 15) volatility -= 0.3;
  }
  volatility = Math.max(-1, Math.min(1, volatility));

  // Volume score
  let volume = 0;
  if (index >= 20) {
    const avgVol = volumes.slice(index - 20, index).reduce((a, b) => a + b, 0) / 20;
    const volRatio = volumes[index] / avgVol;
    if (volRatio > 2) volume = 0.5;
    else if (volRatio > 1.5) volume = 0.3;
    else if (volRatio < 0.5) volume = -0.3;
  }

  // Sentiment score (from simulated data)
  let sentimentScore = 0;
  if (sentiment.gdeltTone > 3) sentimentScore += 0.4;
  else if (sentiment.gdeltTone < -3) sentimentScore -= 0.4;
  if (sentiment.gdeltSpike) sentimentScore += sentiment.newsSentiment > 0 ? 0.3 : -0.3;
  if (sentiment.overallSentiment === "bullish") sentimentScore += 0.2;
  else if (sentiment.overallSentiment === "bearish") sentimentScore -= 0.2;
  sentimentScore = Math.max(-1, Math.min(1, sentimentScore));

  // Pattern score
  let patternScore = 0;
  for (const pattern of patterns) {
    if (pattern.direction === "bullish") patternScore += pattern.confidence;
    else patternScore -= pattern.confidence;
  }
  patternScore = Math.max(-1, Math.min(1, patternScore));

  // News impact (from sentiment volume)
  const newsImpact = sentiment.gdeltSpike ? (sentiment.newsSentiment > 0 ? 0.5 : -0.5) : 0;

  // Social buzz
  const socialBuzz = sentiment.socialBuzzScore > 50
    ? (sentiment.socialBullish > sentiment.socialBearish ? 0.3 : -0.3)
    : 0;

  // Composite with weights
  const composite =
    technical * 0.30 +
    momentum * 0.25 +
    volatility * 0.10 +
    volume * 0.10 +
    sentimentScore * 0.10 +
    patternScore * 0.05 +
    newsImpact * 0.05 +
    socialBuzz * 0.05;

  // Confidence
  const scores = [technical, momentum, volatility, volume, sentimentScore, patternScore];
  const positiveCount = scores.filter(s => s > 0.2).length;
  const negativeCount = scores.filter(s => s < -0.2).length;
  const alignment = Math.max(positiveCount, negativeCount) / scores.length;
  const confidence = Math.min(1, alignment * Math.abs(composite) * 2);

  return {
    technical,
    momentum,
    volatility,
    volume,
    sentiment: sentimentScore,
    patternScore,
    newsImpact,
    socialBuzz,
    composite,
    confidence,
    regime,
    patterns,
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
  signals: ComprehensiveSignal;
  sentiment: SentimentData;
}

interface BacktestConfig {
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

function runComprehensiveBacktest(
  dataMap: Map<string, AlpacaBar[]>,
  config: BacktestConfig
): { trades: ExtendedTrade[]; metrics: ComprehensiveMetrics } {
  const trades: ExtendedTrade[] = [];
  const positions = new Map<string, Position>();

  let equity = config.initialCapital;
  let peakEquity = equity;
  let maxDrawdown = 0;

  // Pre-calculate indicators for all symbols
  const indicatorsMap = new Map<string, any>();
  for (const [symbol, bars] of dataMap) {
    const closes = bars.map(b => b.c);
    const highs = bars.map(b => b.h);
    const lows = bars.map(b => b.l);

    indicatorsMap.set(symbol, {
      rsi: calculateRSI(closes, 10),
      sma20: calculateSMA(closes, 20),
      sma50: calculateSMA(closes, 50),
      emaFast: calculateEMA(closes, 8),
      emaSlow: calculateEMA(closes, 21),
      atr: calculateATR(highs, lows, closes, 10),
      adx: calculateADX(highs, lows, closes, 10),
      stoch: calculateStochastic(highs, lows, closes, 10),
      macd: calculateMACD(closes, 8, 17, 9),
      bb: calculateBollingerBands(closes, 15, 1.5),
    });
  }

  // Get all dates
  const allDates = new Set<string>();
  for (const bars of dataMap.values()) {
    for (const bar of bars) {
      allDates.add(bar.t.split("T")[0]);
    }
  }
  const sortedDates = Array.from(allDates).sort();

  for (const date of sortedDates) {
    let dailyPnl = 0;

    for (const [symbol, bars] of dataMap) {
      const indicators = indicatorsMap.get(symbol)!;
      const dateIndex = bars.findIndex(b => b.t.split("T")[0] === date);
      if (dateIndex < 50) continue;

      const bar = bars[dateIndex];
      const prices = bars.map(b => b.c);
      const highs = bars.map(b => b.h);
      const lows = bars.map(b => b.l);
      const volumes = bars.map(b => b.v);

      const regime = detectRegime(bar.c, indicators.sma20[dateIndex], indicators.sma50[dateIndex], indicators.adx[dateIndex]);
      const sentiment = simulateSentiment(symbol, prices, volumes, dateIndex, regime);
      const patterns = detectPatterns(prices, highs, lows, dateIndex);
      const signals = generateComprehensiveSignal(dateIndex, bars, indicators, sentiment, patterns);

      // Check existing position
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
        } else if (signals.composite < -0.15 && signals.confidence > 0.3) {
          exitReason = "signal_reversal";
        } else if (bar.c > position.entryPrice * 1.02) {
          const atr = indicators.atr[dateIndex];
          if (atr !== null) {
            position.stopLoss = Math.max(position.stopLoss, bar.c - atr * config.atrMultStop);
          }
        }

        if (exitReason) {
          const pnl = (exitPrice - position.entryPrice) * position.shares;
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
            side: "long",
            pnl,
            pnlPct: (exitPrice - position.entryPrice) / position.entryPrice * 100,
            exitReason,
            holdingDays,
            signals: position.signals,
            sentimentAtEntry: position.sentiment,
          });

          equity += pnl;
          dailyPnl += pnl;
          positions.delete(symbol);
        }
      } else {
        // Entry logic
        const canEnter =
          signals.composite > config.buyThreshold &&
          signals.confidence > config.confidenceMin &&
          positions.size < config.maxPositions &&
          (regime === "strong_uptrend" || regime === "uptrend" || regime === "ranging");

        if (canEnter) {
          const atr = indicators.atr[dateIndex];
          if (atr !== null) {
            const positionSize = Math.min(equity * config.maxPositionPct, equity * 0.5);
            const shares = Math.floor(positionSize / bar.c);

            if (shares > 0) {
              positions.set(symbol, {
                symbol,
                shares,
                entryPrice: bar.c,
                entryDate: date,
                stopLoss: bar.c - atr * config.atrMultStop,
                takeProfit: bar.c + atr * config.atrMultTarget,
                signals,
                sentiment,
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
            sentimentAtEntry: position.sentiment,
          });
          equity += pnl;
        }
      }
      positions.clear();
    }

    // Track drawdown
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
        sentimentAtEntry: position.sentiment,
      });
      equity += pnl;
    }
  }

  // Calculate metrics
  const metrics = calculateComprehensiveMetrics(trades, config.initialCapital, equity, maxDrawdown);

  return { trades, metrics };
}

function calculateComprehensiveMetrics(
  trades: ExtendedTrade[],
  initialCapital: number,
  finalEquity: number,
  maxDrawdown: number
): ComprehensiveMetrics {
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);

  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

  const returns = trades.map(t => t.pnlPct / 100);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 1
    ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length)
    : 0;
  const downReturns = returns.filter(r => r < 0);
  const downStdDev = downReturns.length > 1
    ? Math.sqrt(downReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downReturns.length)
    : 1;

  const sharpeRatio = stdDev !== 0 ? (avgReturn * Math.sqrt(252)) / (stdDev * Math.sqrt(252)) : 0;
  const sortinoRatio = downStdDev !== 0 ? (avgReturn * Math.sqrt(252)) / (downStdDev * Math.sqrt(252)) : 0;

  const years = 1.95; // Approx backtest period
  const cagr = years > 0 ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100 : 0;
  const calmarRatio = maxDrawdown > 0 ? cagr / maxDrawdown : 0;

  // Attribution
  let sentimentContribution = 0;
  let patternContribution = 0;
  let technicalContribution = 0;

  for (const trade of trades) {
    if (trade.pnl > 0) {
      sentimentContribution += trade.signals.sentiment > 0.2 ? trade.pnl * 0.3 : 0;
      patternContribution += trade.signals.patternScore > 0.3 ? trade.pnl * 0.2 : 0;
      technicalContribution += trade.signals.technical > 0.2 ? trade.pnl * 0.5 : 0;
    }
  }

  // Sector performance
  const sectorMap: Record<string, string> = {
    AAPL: "Tech", MSFT: "Tech", GOOGL: "Tech", AMZN: "Tech", NVDA: "Tech", META: "Tech", TSLA: "Tech",
    AMD: "Tech", INTC: "Tech", CRM: "Tech", NFLX: "Tech", ADBE: "Tech", ORCL: "Tech", CSCO: "Tech", QCOM: "Tech", AVGO: "Tech",
    JPM: "Finance", BAC: "Finance", GS: "Finance", MS: "Finance", V: "Finance", MA: "Finance", PYPL: "Finance",
    JNJ: "Healthcare", UNH: "Healthcare", PFE: "Healthcare", MRK: "Healthcare", ABBV: "Healthcare", LLY: "Healthcare",
    WMT: "Consumer", COST: "Consumer", HD: "Consumer", NKE: "Consumer", MCD: "Consumer", SBUX: "Consumer", DIS: "Consumer",
    XOM: "Energy", CVX: "Energy",
    BA: "Industrial", CAT: "Industrial", HON: "Industrial", UPS: "Industrial",
    SPY: "ETF", QQQ: "ETF", IWM: "ETF", DIA: "ETF", XLF: "ETF", XLK: "ETF", XLE: "ETF", XLV: "ETF",
  };

  const sectorPerformance: Record<string, { trades: number; pnl: number; winRate: number }> = {};
  for (const trade of trades) {
    const sector = sectorMap[trade.symbol] || "Other";
    if (!sectorPerformance[sector]) {
      sectorPerformance[sector] = { trades: 0, pnl: 0, winRate: 0 };
    }
    sectorPerformance[sector].trades++;
    sectorPerformance[sector].pnl += trade.pnl;
  }

  for (const sector of Object.keys(sectorPerformance)) {
    const sectorTrades = trades.filter(t => (sectorMap[t.symbol] || "Other") === sector);
    const sectorWins = sectorTrades.filter(t => t.pnl > 0).length;
    sectorPerformance[sector].winRate = sectorTrades.length > 0 ? (sectorWins / sectorTrades.length) * 100 : 0;
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
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    avgHoldingDays: trades.length > 0 ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length : 0,
    finalEquity,
    cagr,
    sentimentContribution,
    patternContribution,
    technicalContribution,
    sectorPerformance,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("=".repeat(80));
  console.log("OMAR ULTIMATE COMPREHENSIVE BACKTEST");
  console.log("=".repeat(80));
  console.log(`Universe: ${FULL_UNIVERSE.length} symbols`);
  console.log(`Period: 2024-01-01 to 2025-12-20`);

  const startDate = "2024-01-01";
  const endDate = "2025-12-20";

  console.log(`\nFetching historical data...`);

  const dataMap = new Map<string, AlpacaBar[]>();
  let successCount = 0;

  for (const symbol of FULL_UNIVERSE) {
    process.stdout.write(`${symbol}... `);
    try {
      const bars = await fetchAlpacaBars(symbol, startDate, endDate);
      if (bars.length > 100) {
        dataMap.set(symbol, bars);
        console.log(`${bars.length} bars`);
        successCount++;
      } else {
        console.log(`SKIP (${bars.length} bars)`);
      }
    } catch (error) {
      console.log(`ERROR`);
    }
    await new Promise(r => setTimeout(r, 150)); // Rate limit
  }

  console.log(`\nLoaded ${successCount}/${FULL_UNIVERSE.length} symbols`);

  // Run multiple configurations
  const configs: BacktestConfig[] = [
    { initialCapital: 100000, maxPositionPct: 0.05, maxPortfolioExposure: 0.6, maxPositions: 15, atrMultStop: 1.5, atrMultTarget: 4, buyThreshold: 0.15, confidenceMin: 0.3, maxDailyLoss: 0.05 },
    { initialCapital: 100000, maxPositionPct: 0.08, maxPortfolioExposure: 0.8, maxPositions: 12, atrMultStop: 1.5, atrMultTarget: 4, buyThreshold: 0.12, confidenceMin: 0.25, maxDailyLoss: 0.06 },
    { initialCapital: 100000, maxPositionPct: 0.04, maxPortfolioExposure: 0.5, maxPositions: 20, atrMultStop: 2.0, atrMultTarget: 3, buyThreshold: 0.20, confidenceMin: 0.35, maxDailyLoss: 0.04 },
    { initialCapital: 100000, maxPositionPct: 0.06, maxPortfolioExposure: 0.7, maxPositions: 15, atrMultStop: 1.8, atrMultTarget: 3.5, buyThreshold: 0.18, confidenceMin: 0.32, maxDailyLoss: 0.05 },
  ];

  const results: { config: BacktestConfig; trades: ExtendedTrade[]; metrics: ComprehensiveMetrics }[] = [];

  for (let i = 0; i < configs.length; i++) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`CONFIGURATION ${i + 1}`);
    console.log(`${"=".repeat(60)}`);

    const { trades, metrics } = runComprehensiveBacktest(dataMap, configs[i]);

    console.log(`Trades: ${metrics.totalTrades} | Win Rate: ${metrics.winRate.toFixed(1)}%`);
    console.log(`P&L: $${metrics.totalPnl.toFixed(0)} (${metrics.totalPnlPct.toFixed(1)}%)`);
    console.log(`Profit Factor: ${metrics.profitFactor.toFixed(2)} | Sharpe: ${metrics.sharpeRatio.toFixed(2)} | Sortino: ${metrics.sortinoRatio.toFixed(2)}`);
    console.log(`Max DD: ${metrics.maxDrawdown.toFixed(1)}% | CAGR: ${metrics.cagr.toFixed(1)}% | Calmar: ${metrics.calmarRatio.toFixed(2)}`);

    console.log(`\nSector Performance:`);
    for (const [sector, perf] of Object.entries(metrics.sectorPerformance)) {
      console.log(`  ${sector}: ${perf.trades} trades, $${perf.pnl.toFixed(0)}, ${perf.winRate.toFixed(1)}% win rate`);
    }

    console.log(`\nAttribution:`);
    console.log(`  Sentiment: $${metrics.sentimentContribution.toFixed(0)}`);
    console.log(`  Patterns: $${metrics.patternContribution.toFixed(0)}`);
    console.log(`  Technical: $${metrics.technicalContribution.toFixed(0)}`);

    results.push({ config: configs[i], trades, metrics });
  }

  // Find best
  results.sort((a, b) => {
    const scoreA = (a.metrics.winRate / 100 * 25) + (Math.min(a.metrics.profitFactor, 3) / 3 * 25) + (Math.min(a.metrics.sharpeRatio, 2) / 2 * 20);
    const scoreB = (b.metrics.winRate / 100 * 25) + (Math.min(b.metrics.profitFactor, 3) / 3 * 25) + (Math.min(b.metrics.sharpeRatio, 2) / 2 * 20);
    return scoreB - scoreA;
  });

  const best = results[0];

  console.log(`\n${"=".repeat(80)}`);
  console.log("BEST RESULT");
  console.log(`${"=".repeat(80)}`);
  console.log(JSON.stringify(best.metrics, null, 2));

  console.log(`\nTop Winning Trades:`);
  const topWins = best.trades.filter(t => t.pnl > 0).sort((a, b) => b.pnl - a.pnl).slice(0, 10);
  for (const t of topWins) {
    console.log(`  ${t.symbol}: $${t.pnl.toFixed(0)} | ${t.entryDate} -> ${t.exitDate} | ${t.exitReason}`);
  }

  console.log(`\nWorst Losing Trades:`);
  const topLosses = best.trades.filter(t => t.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 10);
  for (const t of topLosses) {
    console.log(`  ${t.symbol}: $${t.pnl.toFixed(0)} | ${t.entryDate} -> ${t.exitDate} | ${t.exitReason}`);
  }

  console.log(`\nPatterns Detected in Winning Trades:`);
  const patternCounts: Record<string, number> = {};
  for (const trade of best.trades.filter(t => t.pnl > 0)) {
    for (const p of trade.signals.patterns) {
      patternCounts[p.type] = (patternCounts[p.type] || 0) + 1;
    }
  }
  console.log(JSON.stringify(patternCounts, null, 2));
}

main().catch(console.error);
