export interface TechnicalIndicators {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  atr14: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  adx14: number | null;
}

export function calculateSMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

export function calculateEMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const sma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(sma);
    } else {
      const prevEma = result[i - 1];
      if (prevEma !== null) {
        const ema = (prices[i] - prevEma) * multiplier + prevEma;
        result.push(ema);
      } else {
        result.push(null);
      }
    }
  }
  return result;
}

export function calculateRSI(prices: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  
  if (prices.length < period + 1) {
    return prices.map(() => null);
  }

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      result.push(null);
      continue;
    }

    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i < period) {
      avgGain += gain;
      avgLoss += loss;
      result.push(null);
    } else if (i === period) {
      avgGain = (avgGain + gain) / period;
      avgLoss = (avgLoss + loss) / period;

      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      }
    }
  }
  return result;
}

export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine.push(emaFast[i]! - emaSlow[i]!);
    } else {
      macdLine.push(null);
    }
  }

  const validMacd = macdLine.filter((v): v is number => v !== null);
  const signalLine = calculateEMA(validMacd, signalPeriod);

  const signal: (number | null)[] = [];
  const histogram: (number | null)[] = [];
  let signalIdx = 0;

  for (let i = 0; i < prices.length; i++) {
    if (macdLine[i] !== null) {
      const sig = signalLine[signalIdx] ?? null;
      signal.push(sig);
      histogram.push(sig !== null ? macdLine[i]! - sig : null);
      signalIdx++;
    } else {
      signal.push(null);
      histogram.push(null);
    }
  }

  return { macd: macdLine, signal, histogram };
}

export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = calculateSMA(prices, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1 || middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = middle[i]!;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);

      upper.push(mean + stdDevMultiplier * stdDev);
      lower.push(mean - stdDevMultiplier * stdDev);
    }
  }

  return { upper, middle, lower };
}

export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): (number | null)[] {
  const trueRanges: number[] = [];

  for (let i = 0; i < highs.length; i++) {
    if (i === 0) {
      trueRanges.push(highs[i] - lows[i]);
    } else {
      const highLow = highs[i] - lows[i];
      const highPrevClose = Math.abs(highs[i] - closes[i - 1]);
      const lowPrevClose = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
    }
  }

  const result: (number | null)[] = [];
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(atr);
    } else {
      const prevAtr = result[i - 1];
      if (prevAtr !== null) {
        const atr = (prevAtr * (period - 1) + trueRanges[i]) / period;
        result.push(atr);
      } else {
        result.push(null);
      }
    }
  }

  return result;
}

export function calculateStdDev(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      result.push(Math.sqrt(variance));
    }
  }
  return result;
}

export function calculateROC(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      result.push(null);
    } else {
      const roc = (prices[i] - prices[i - period]) / prices[i - period];
      result.push(roc);
    }
  }
  return result;
}

export interface OHLCBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export function computeAllIndicators(bars: OHLCBar[]): TechnicalIndicators | null {
  if (bars.length < 200) {
    return null;
  }

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);

  const lastIdx = closes.length - 1;

  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const rsi14 = calculateRSI(closes, 14);
  const macdResult = calculateMACD(closes, 12, 26, 9);
  const atr14 = calculateATR(highs, lows, closes, 14);
  const bollingerBands = calculateBollingerBands(closes, 20, 2);

  return {
    sma20: sma20[lastIdx],
    sma50: sma50[lastIdx],
    sma200: sma200[lastIdx],
    ema12: ema12[lastIdx],
    ema26: ema26[lastIdx],
    rsi14: rsi14[lastIdx],
    macd: macdResult.macd[lastIdx],
    macdSignal: macdResult.signal[lastIdx],
    macdHistogram: macdResult.histogram[lastIdx],
    atr14: atr14[lastIdx],
    bollingerUpper: bollingerBands.upper[lastIdx],
    bollingerLower: bollingerBands.lower[lastIdx],
    adx14: null,
  };
}

export function getLatestIndicatorValue<T>(arr: (T | null)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null) {
      return arr[i];
    }
  }
  return null;
}
