/**
 * Technical Indicators Library
 * Consolidated from omar-backtest*.ts scripts
 *
 * All indicators return arrays where null indicates insufficient data
 */

import type {
  StochasticResult,
  MACDResult,
  BollingerBandsResult,
} from "./types.js";

// ============================================================================
// MOVING AVERAGES
// ============================================================================

/**
 * Simple Moving Average
 */
export function calculateSMA(
  prices: number[],
  period: number
): (number | null)[] {
  const sma: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period) return sma;

  for (let i = period - 1; i < prices.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += prices[i - j];
    }
    sma[i] = sum / period;
  }
  return sma;
}

/**
 * Exponential Moving Average
 */
export function calculateEMA(
  prices: number[],
  period: number
): (number | null)[] {
  const ema: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period) return ema;

  const multiplier = 2 / (period + 1);

  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  ema[period - 1] = sum / period;

  // Subsequent EMAs
  for (let i = period; i < prices.length; i++) {
    ema[i] = (prices[i] - (ema[i - 1] || 0)) * multiplier + (ema[i - 1] || 0);
  }

  return ema;
}

/**
 * Weighted Moving Average
 */
export function calculateWMA(
  prices: number[],
  period: number
): (number | null)[] {
  const wma: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period) return wma;

  const weightSum = (period * (period + 1)) / 2;

  for (let i = period - 1; i < prices.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += prices[i - j] * (period - j);
    }
    wma[i] = sum / weightSum;
  }
  return wma;
}

// ============================================================================
// MOMENTUM INDICATORS
// ============================================================================

/**
 * Relative Strength Index
 */
export function calculateRSI(
  prices: number[],
  period: number
): (number | null)[] {
  const rsi: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period + 1) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  // First average
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Subsequent RSI values using smoothed averages
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

/**
 * Stochastic Oscillator
 */
export function calculateStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14,
  smoothK: number = 3,
  smoothD: number = 3
): StochasticResult {
  const k: (number | null)[] = new Array(closes.length).fill(null);
  const d: (number | null)[] = new Array(closes.length).fill(null);

  // Calculate %K
  for (let i = period - 1; i < closes.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = 0; j < period; j++) {
      highestHigh = Math.max(highestHigh, highs[i - j]);
      lowestLow = Math.min(lowestLow, lows[i - j]);
    }
    k[i] =
      highestHigh === lowestLow
        ? 50
        : ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
  }

  // Calculate %D (SMA of %K)
  for (let i = period + smoothD - 2; i < closes.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = 0; j < smoothD; j++) {
      if (k[i - j] !== null) {
        sum += k[i - j]!;
        count++;
      }
    }
    d[i] = count > 0 ? sum / count : null;
  }

  return { k, d };
}

/**
 * Rate of Change
 */
export function calculateROC(
  prices: number[],
  period: number
): (number | null)[] {
  const roc: (number | null)[] = new Array(prices.length).fill(null);
  for (let i = period; i < prices.length; i++) {
    roc[i] = ((prices[i] - prices[i - period]) / prices[i - period]) * 100;
  }
  return roc;
}

/**
 * Williams %R
 */
export function calculateWilliamsR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): (number | null)[] {
  const wr: (number | null)[] = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = 0; j < period; j++) {
      highestHigh = Math.max(highestHigh, highs[i - j]);
      lowestLow = Math.min(lowestLow, lows[i - j]);
    }
    wr[i] =
      highestHigh === lowestLow
        ? -50
        : ((highestHigh - closes[i]) / (highestHigh - lowestLow)) * -100;
  }
  return wr;
}

/**
 * Commodity Channel Index
 */
export function calculateCCI(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 20
): (number | null)[] {
  const cci: (number | null)[] = new Array(closes.length).fill(null);
  const tp: number[] = highs.map((h, i) => (h + lows[i] + closes[i]) / 3);

  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += tp[i - j];
    }
    const smaTP = sum / period;

    let meanDeviation = 0;
    for (let j = 0; j < period; j++) {
      meanDeviation += Math.abs(tp[i - j] - smaTP);
    }
    meanDeviation /= period;

    cci[i] =
      meanDeviation === 0 ? 0 : (tp[i] - smaTP) / (0.015 * meanDeviation);
  }
  return cci;
}

// ============================================================================
// TREND INDICATORS
// ============================================================================

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);

  const line: (number | null)[] = new Array(prices.length).fill(null);
  for (let i = slowPeriod - 1; i < prices.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      line[i] = emaFast[i]! - emaSlow[i]!;
    }
  }

  // Calculate signal line (EMA of MACD line)
  const validLineValues = line.filter((v): v is number => v !== null);
  const signalEMA = calculateEMA(validLineValues, signalPeriod);

  const signal: (number | null)[] = new Array(prices.length).fill(null);
  const histogram: (number | null)[] = new Array(prices.length).fill(null);

  let signalIdx = 0;
  for (let i = slowPeriod - 1; i < prices.length; i++) {
    if (
      line[i] !== null &&
      signalIdx < signalEMA.length &&
      signalEMA[signalIdx] !== null
    ) {
      signal[i] = signalEMA[signalIdx]!;
      histogram[i] = line[i]! - signal[i]!;
      signalIdx++;
    }
  }

  return { line, signal, histogram };
}

/**
 * Average Directional Index
 */
export function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): (number | null)[] {
  const adx: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period * 2) return adx;

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];

    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);

    const highLow = highs[i] - lows[i];
    const highPrevClose = Math.abs(highs[i] - closes[i - 1]);
    const lowPrevClose = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(highLow, highPrevClose, lowPrevClose));
  }

  // Smooth TR, +DM, -DM
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

  const dx: number[] = [];
  for (let i = period; i < tr.length; i++) {
    atr = atr - atr / period + tr[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];

    const plusDI = (smoothPlusDM / atr) * 100;
    const minusDI = (smoothMinusDM / atr) * 100;
    const diSum = plusDI + minusDI;
    dx.push(diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100);
  }

  // Calculate ADX as smoothed DX
  let adxSum = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  adx[period * 2] = adxSum;

  for (let i = period; i < dx.length; i++) {
    adxSum = (adxSum * (period - 1) + dx[i]) / period;
    adx[i + period + 1] = adxSum;
  }

  return adx;
}

// ============================================================================
// VOLATILITY INDICATORS
// ============================================================================

/**
 * Average True Range
 */
export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): (number | null)[] {
  const atr: (number | null)[] = new Array(highs.length).fill(null);
  if (highs.length < period + 1) return atr;

  const tr: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const highLow = highs[i] - lows[i];
    const highPrevClose = Math.abs(highs[i] - closes[i - 1]);
    const lowPrevClose = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(highLow, highPrevClose, lowPrevClose));
  }

  // First ATR is simple average
  let atrSum = 0;
  for (let i = 0; i < period; i++) {
    atrSum += tr[i];
  }
  atr[period] = atrSum / period;

  // Subsequent ATRs use smoothing
  for (let i = period + 1; i < highs.length; i++) {
    atr[i] = ((atr[i - 1] || 0) * (period - 1) + tr[i - 1]) / period;
  }

  return atr;
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsResult {
  const middle = calculateSMA(prices, period);
  const upper: (number | null)[] = new Array(prices.length).fill(null);
  const lower: (number | null)[] = new Array(prices.length).fill(null);
  const width: (number | null)[] = new Array(prices.length).fill(null);

  for (let i = period - 1; i < prices.length; i++) {
    if (middle[i] === null) continue;

    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      sumSq += Math.pow(prices[i - j] - middle[i]!, 2);
    }
    const std = Math.sqrt(sumSq / period);

    upper[i] = middle[i]! + stdDev * std;
    lower[i] = middle[i]! - stdDev * std;
    width[i] = (upper[i]! - lower[i]!) / middle[i]!;
  }

  return { upper, middle, lower, width };
}

/**
 * Keltner Channels
 */
export function calculateKeltnerChannels(
  highs: number[],
  lows: number[],
  closes: number[],
  emaPeriod: number = 20,
  atrPeriod: number = 10,
  multiplier: number = 2
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const middle = calculateEMA(closes, emaPeriod);
  const atr = calculateATR(highs, lows, closes, atrPeriod);

  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);

  for (let i = 0; i < closes.length; i++) {
    if (middle[i] !== null && atr[i] !== null) {
      upper[i] = middle[i]! + multiplier * atr[i]!;
      lower[i] = middle[i]! - multiplier * atr[i]!;
    }
  }

  return { upper, middle, lower };
}

// ============================================================================
// VOLUME INDICATORS
// ============================================================================

/**
 * On-Balance Volume
 */
export function calculateOBV(closes: number[], volumes: number[]): number[] {
  const obv: number[] = [volumes[0]];

  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obv.push(obv[i - 1] + volumes[i]);
    } else if (closes[i] < closes[i - 1]) {
      obv.push(obv[i - 1] - volumes[i]);
    } else {
      obv.push(obv[i - 1]);
    }
  }

  return obv;
}

/**
 * Money Flow Index
 */
export function calculateMFI(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 14
): (number | null)[] {
  const mfi: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return mfi;

  const typicalPrice = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const rawMoneyFlow = typicalPrice.map((tp, i) => tp * volumes[i]);

  for (let i = period; i < closes.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrice[j] > typicalPrice[j - 1]) {
        positiveFlow += rawMoneyFlow[j];
      } else {
        negativeFlow += rawMoneyFlow[j];
      }
    }

    const moneyRatio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
    mfi[i] = 100 - 100 / (1 + moneyRatio);
  }

  return mfi;
}

/**
 * Volume Weighted Average Price
 */
export function calculateVWAP(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[]
): number[] {
  const vwap: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < closes.length; i++) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    cumulativeTPV += typicalPrice * volumes[i];
    cumulativeVolume += volumes[i];
    vwap.push(
      cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice
    );
  }

  return vwap;
}
