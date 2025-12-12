/**
 * AI Active Trader - Technical Indicators Library
 * Comprehensive TA-Lib inspired technical analysis indicators
 * 
 * Features:
 * - Trend indicators (SMA, EMA, MACD, ADX, Parabolic SAR)
 * - Momentum indicators (RSI, Stochastic, CCI, Williams %R, ROC)
 * - Volatility indicators (ATR, Bollinger Bands, Keltner Channels)
 * - Volume indicators (OBV, MFI, VWAP, Accumulation/Distribution)
 * - Pattern recognition (Support/Resistance, Pivot Points)
 * - Composite signals and indicator fusion
 */

import { createLogger } from '../common';

const logger = createLogger('technical-indicators');

// OHLCV bar data
export interface OHLCVBar {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Indicator result with metadata
export interface IndicatorResult {
  name: string;
  values: number[];
  signal?: number[];
  histogram?: number[];
  upperBand?: number[];
  lowerBand?: number[];
  middleBand?: number[];
  timestamp: Date;
}

// Indicator signal
export interface TechnicalSignal {
  indicator: string;
  signal: 'buy' | 'sell' | 'neutral';
  strength: number;
  value: number;
  threshold?: number;
  crossover?: 'bullish' | 'bearish';
}

// ================== TREND INDICATORS ==================

/**
 * Simple Moving Average (SMA)
 */
export function sma(data: number[], period: number): number[] {
  if (data.length < period) return [];
  
  const result: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

/**
 * Exponential Moving Average (EMA)
 */
export function ema(data: number[], period: number): number[] {
  if (data.length < period) return [];
  
  const multiplier = 2 / (period + 1);
  const result: number[] = [];
  
  // Start with SMA
  let prevEma = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prevEma);
  
  for (let i = period; i < data.length; i++) {
    const currentEma = (data[i] - prevEma) * multiplier + prevEma;
    result.push(currentEma);
    prevEma = currentEma;
  }
  
  return result;
}

/**
 * Weighted Moving Average (WMA)
 */
export function wma(data: number[], period: number): number[] {
  if (data.length < period) return [];
  
  const result: number[] = [];
  const denominator = (period * (period + 1)) / 2;
  
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - period + 1 + j] * (j + 1);
    }
    result.push(sum / denominator);
  }
  
  return result;
}

/**
 * Double Exponential Moving Average (DEMA)
 */
export function dema(data: number[], period: number): number[] {
  const ema1 = ema(data, period);
  const ema2 = ema(ema1, period);
  
  const result: number[] = [];
  const offset = ema1.length - ema2.length;
  
  for (let i = 0; i < ema2.length; i++) {
    result.push(2 * ema1[i + offset] - ema2[i]);
  }
  
  return result;
}

/**
 * Triple Exponential Moving Average (TEMA)
 */
export function tema(data: number[], period: number): number[] {
  const ema1 = ema(data, period);
  const ema2 = ema(ema1, period);
  const ema3 = ema(ema2, period);
  
  const result: number[] = [];
  const offset1 = ema1.length - ema3.length;
  const offset2 = ema2.length - ema3.length;
  
  for (let i = 0; i < ema3.length; i++) {
    result.push(3 * ema1[i + offset1] - 3 * ema2[i + offset2] + ema3[i]);
  }
  
  return result;
}

/**
 * Moving Average Convergence Divergence (MACD)
 */
export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function macd(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const fastEma = ema(data, fastPeriod);
  const slowEma = ema(data, slowPeriod);
  
  const offset = fastEma.length - slowEma.length;
  const macdLine: number[] = [];
  
  for (let i = 0; i < slowEma.length; i++) {
    macdLine.push(fastEma[i + offset] - slowEma[i]);
  }
  
  const signalLine = ema(macdLine, signalPeriod);
  const histOffset = macdLine.length - signalLine.length;
  
  const histogram: number[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + histOffset] - signalLine[i]);
  }
  
  return {
    macd: macdLine.slice(histOffset),
    signal: signalLine,
    histogram,
  };
}

/**
 * Average Directional Index (ADX)
 */
export interface ADXResult {
  adx: number[];
  plusDI: number[];
  minusDI: number[];
}

export function adx(bars: OHLCVBar[], period: number = 14): ADXResult {
  if (bars.length < period + 1) {
    return { adx: [], plusDI: [], minusDI: [] };
  }
  
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevHigh = bars[i - 1].high;
    const prevLow = bars[i - 1].low;
    const prevClose = bars[i - 1].close;
    
    tr.push(Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    ));
    
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  
  const smoothedTR = smoothWilder(tr, period);
  const smoothedPlusDM = smoothWilder(plusDM, period);
  const smoothedMinusDM = smoothWilder(minusDM, period);
  
  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];
  
  for (let i = 0; i < smoothedTR.length; i++) {
    const pdi = (smoothedPlusDM[i] / smoothedTR[i]) * 100;
    const mdi = (smoothedMinusDM[i] / smoothedTR[i]) * 100;
    plusDI.push(pdi);
    minusDI.push(mdi);
    
    const sum = pdi + mdi;
    dx.push(sum === 0 ? 0 : (Math.abs(pdi - mdi) / sum) * 100);
  }
  
  const adxValues = smoothWilder(dx, period);
  
  const offset = plusDI.length - adxValues.length;
  
  return {
    adx: adxValues,
    plusDI: plusDI.slice(offset),
    minusDI: minusDI.slice(offset),
  };
}

function smoothWilder(data: number[], period: number): number[] {
  if (data.length < period) return [];
  
  const result: number[] = [];
  let sum = data.slice(0, period).reduce((a, b) => a + b, 0);
  result.push(sum / period);
  
  for (let i = period; i < data.length; i++) {
    const smoothed = (result[result.length - 1] * (period - 1) + data[i]) / period;
    result.push(smoothed);
  }
  
  return result;
}

/**
 * Parabolic SAR
 */
export function parabolicSAR(
  bars: OHLCVBar[],
  acceleration: number = 0.02,
  maximum: number = 0.2
): number[] {
  if (bars.length < 2) return [];
  
  const result: number[] = [];
  let af = acceleration;
  let isUpTrend = bars[1].close > bars[0].close;
  let ep = isUpTrend ? bars[0].high : bars[0].low;
  let sar = isUpTrend ? bars[0].low : bars[0].high;
  
  result.push(sar);
  
  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i];
    
    if (isUpTrend) {
      sar = sar + af * (ep - sar);
      sar = Math.min(sar, bars[i - 1].low);
      if (i > 1) sar = Math.min(sar, bars[i - 2].low);
      
      if (high > ep) {
        ep = high;
        af = Math.min(af + acceleration, maximum);
      }
      
      if (low < sar) {
        isUpTrend = false;
        sar = ep;
        ep = low;
        af = acceleration;
      }
    } else {
      sar = sar + af * (ep - sar);
      sar = Math.max(sar, bars[i - 1].high);
      if (i > 1) sar = Math.max(sar, bars[i - 2].high);
      
      if (low < ep) {
        ep = low;
        af = Math.min(af + acceleration, maximum);
      }
      
      if (high > sar) {
        isUpTrend = true;
        sar = ep;
        ep = high;
        af = acceleration;
      }
    }
    
    result.push(sar);
  }
  
  return result;
}

// ================== MOMENTUM INDICATORS ==================

/**
 * Relative Strength Index (RSI)
 */
export function rsi(data: number[], period: number = 14): number[] {
  if (data.length < period + 1) return [];
  
  const changes: number[] = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i] - data[i - 1]);
  }
  
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss -= changes[i];
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  const result: number[] = [];
  result.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    result.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  }
  
  return result;
}

/**
 * Stochastic Oscillator
 */
export interface StochasticResult {
  k: number[];
  d: number[];
}

export function stochastic(
  bars: OHLCVBar[],
  kPeriod: number = 14,
  dPeriod: number = 3,
  smooth: number = 3
): StochasticResult {
  if (bars.length < kPeriod) {
    return { k: [], d: [] };
  }
  
  const rawK: number[] = [];
  
  for (let i = kPeriod - 1; i < bars.length; i++) {
    const periodBars = bars.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...periodBars.map(b => b.high));
    const low = Math.min(...periodBars.map(b => b.low));
    const close = bars[i].close;
    
    const denominator = high - low;
    rawK.push(denominator === 0 ? 50 : ((close - low) / denominator) * 100);
  }
  
  const k = sma(rawK, smooth);
  const d = sma(k, dPeriod);
  
  return { k, d };
}

/**
 * Commodity Channel Index (CCI)
 */
export function cci(bars: OHLCVBar[], period: number = 20): number[] {
  if (bars.length < period) return [];
  
  const typicalPrices = bars.map(b => (b.high + b.low + b.close) / 3);
  const result: number[] = [];
  
  for (let i = period - 1; i < typicalPrices.length; i++) {
    const slice = typicalPrices.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const meanDev = slice.reduce((sum, tp) => sum + Math.abs(tp - mean), 0) / period;
    
    const cciValue = meanDev === 0 ? 0 : (typicalPrices[i] - mean) / (0.015 * meanDev);
    result.push(cciValue);
  }
  
  return result;
}

/**
 * Williams %R
 */
export function williamsR(bars: OHLCVBar[], period: number = 14): number[] {
  if (bars.length < period) return [];
  
  const result: number[] = [];
  
  for (let i = period - 1; i < bars.length; i++) {
    const periodBars = bars.slice(i - period + 1, i + 1);
    const high = Math.max(...periodBars.map(b => b.high));
    const low = Math.min(...periodBars.map(b => b.low));
    const close = bars[i].close;
    
    const denominator = high - low;
    result.push(denominator === 0 ? -50 : ((high - close) / denominator) * -100);
  }
  
  return result;
}

/**
 * Rate of Change (ROC)
 */
export function roc(data: number[], period: number = 10): number[] {
  if (data.length <= period) return [];
  
  const result: number[] = [];
  
  for (let i = period; i < data.length; i++) {
    const prev = data[i - period];
    result.push(prev === 0 ? 0 : ((data[i] - prev) / prev) * 100);
  }
  
  return result;
}

/**
 * Momentum Indicator
 */
export function momentum(data: number[], period: number = 10): number[] {
  if (data.length <= period) return [];
  
  const result: number[] = [];
  
  for (let i = period; i < data.length; i++) {
    result.push(data[i] - data[i - period]);
  }
  
  return result;
}

/**
 * Money Flow Index (MFI)
 */
export function mfi(bars: OHLCVBar[], period: number = 14): number[] {
  if (bars.length < period + 1) return [];
  
  const typicalPrices = bars.map(b => (b.high + b.low + b.close) / 3);
  const moneyFlows = typicalPrices.map((tp, i) => tp * bars[i].volume);
  
  const result: number[] = [];
  
  for (let i = period; i < bars.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;
    
    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) {
        positiveFlow += moneyFlows[j];
      } else if (typicalPrices[j] < typicalPrices[j - 1]) {
        negativeFlow += moneyFlows[j];
      }
    }
    
    const mfiValue = negativeFlow === 0 ? 100 : 100 - (100 / (1 + positiveFlow / negativeFlow));
    result.push(mfiValue);
  }
  
  return result;
}

// ================== VOLATILITY INDICATORS ==================

/**
 * Average True Range (ATR)
 */
export function atr(bars: OHLCVBar[], period: number = 14): number[] {
  if (bars.length < period + 1) return [];
  
  const tr: number[] = [];
  
  for (let i = 1; i < bars.length; i++) {
    tr.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    ));
  }
  
  return smoothWilder(tr, period);
}

/**
 * Bollinger Bands
 */
export interface BollingerBandsResult {
  upper: number[];
  middle: number[];
  lower: number[];
  bandwidth: number[];
  percentB: number[];
}

export function bollingerBands(
  data: number[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsResult {
  if (data.length < period) {
    return { upper: [], middle: [], lower: [], bandwidth: [], percentB: [] };
  }
  
  const middle = sma(data, period);
  const upper: number[] = [];
  const lower: number[] = [];
  const bandwidth: number[] = [];
  const percentB: number[] = [];
  
  for (let i = 0; i < middle.length; i++) {
    const dataIndex = period - 1 + i;
    const slice = data.slice(dataIndex - period + 1, dataIndex + 1);
    const avg = middle[i];
    
    const variance = slice.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / period;
    const sd = Math.sqrt(variance);
    
    const upperBand = avg + stdDev * sd;
    const lowerBand = avg - stdDev * sd;
    
    upper.push(upperBand);
    lower.push(lowerBand);
    bandwidth.push((upperBand - lowerBand) / avg * 100);
    
    const range = upperBand - lowerBand;
    percentB.push(range === 0 ? 0.5 : (data[dataIndex] - lowerBand) / range);
  }
  
  return { upper, middle, lower, bandwidth, percentB };
}

/**
 * Keltner Channels
 */
export interface KeltnerChannelsResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function keltnerChannels(
  bars: OHLCVBar[],
  emaPeriod: number = 20,
  atrPeriod: number = 10,
  multiplier: number = 2
): KeltnerChannelsResult {
  const closes = bars.map(b => b.close);
  const middle = ema(closes, emaPeriod);
  const atrValues = atr(bars, atrPeriod);
  
  const minLen = Math.min(middle.length, atrValues.length);
  const middleOffset = middle.length - minLen;
  const atrOffset = atrValues.length - minLen;
  
  const upper: number[] = [];
  const lower: number[] = [];
  const alignedMiddle: number[] = [];
  
  for (let i = 0; i < minLen; i++) {
    const mid = middle[i + middleOffset];
    const atrVal = atrValues[i + atrOffset];
    alignedMiddle.push(mid);
    upper.push(mid + multiplier * atrVal);
    lower.push(mid - multiplier * atrVal);
  }
  
  return { upper, middle: alignedMiddle, lower };
}

/**
 * Standard Deviation
 */
export function stdDev(data: number[], period: number): number[] {
  if (data.length < period) return [];
  
  const result: number[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period;
    result.push(Math.sqrt(variance));
  }
  
  return result;
}

/**
 * Historical Volatility
 */
export function historicalVolatility(
  data: number[],
  period: number = 20,
  annualize: boolean = true
): number[] {
  if (data.length < period + 1) return [];
  
  const returns: number[] = [];
  for (let i = 1; i < data.length; i++) {
    returns.push(Math.log(data[i] / data[i - 1]));
  }
  
  const stdDevValues = stdDev(returns, period);
  const annualizationFactor = annualize ? Math.sqrt(252) : 1;
  
  return stdDevValues.map(s => s * annualizationFactor);
}

// ================== VOLUME INDICATORS ==================

/**
 * On-Balance Volume (OBV)
 */
export function obv(bars: OHLCVBar[]): number[] {
  if (bars.length === 0) return [];
  
  const result: number[] = [0];
  
  for (let i = 1; i < bars.length; i++) {
    const prevOBV = result[result.length - 1];
    if (bars[i].close > bars[i - 1].close) {
      result.push(prevOBV + bars[i].volume);
    } else if (bars[i].close < bars[i - 1].close) {
      result.push(prevOBV - bars[i].volume);
    } else {
      result.push(prevOBV);
    }
  }
  
  return result;
}

/**
 * Volume Weighted Average Price (VWAP)
 */
export function vwap(bars: OHLCVBar[]): number[] {
  if (bars.length === 0) return [];
  
  const result: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  
  for (const bar of bars) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativeTPV += typicalPrice * bar.volume;
    cumulativeVolume += bar.volume;
    result.push(cumulativeVolume === 0 ? typicalPrice : cumulativeTPV / cumulativeVolume);
  }
  
  return result;
}

/**
 * Accumulation/Distribution Line
 */
export function accumulationDistribution(bars: OHLCVBar[]): number[] {
  if (bars.length === 0) return [];
  
  const result: number[] = [];
  let adl = 0;
  
  for (const bar of bars) {
    const range = bar.high - bar.low;
    const mfm = range === 0 ? 0 : ((bar.close - bar.low) - (bar.high - bar.close)) / range;
    adl += mfm * bar.volume;
    result.push(adl);
  }
  
  return result;
}

/**
 * Chaikin Money Flow (CMF)
 */
export function cmf(bars: OHLCVBar[], period: number = 20): number[] {
  if (bars.length < period) return [];
  
  const result: number[] = [];
  
  for (let i = period - 1; i < bars.length; i++) {
    const periodBars = bars.slice(i - period + 1, i + 1);
    let mfvSum = 0;
    let volumeSum = 0;
    
    for (const bar of periodBars) {
      const range = bar.high - bar.low;
      const mfm = range === 0 ? 0 : ((bar.close - bar.low) - (bar.high - bar.close)) / range;
      mfvSum += mfm * bar.volume;
      volumeSum += bar.volume;
    }
    
    result.push(volumeSum === 0 ? 0 : mfvSum / volumeSum);
  }
  
  return result;
}

/**
 * Force Index
 */
export function forceIndex(bars: OHLCVBar[], period: number = 13): number[] {
  if (bars.length < 2) return [];
  
  const rawForce: number[] = [];
  
  for (let i = 1; i < bars.length; i++) {
    rawForce.push((bars[i].close - bars[i - 1].close) * bars[i].volume);
  }
  
  return ema(rawForce, period);
}

// ================== PATTERN RECOGNITION ==================

/**
 * Pivot Points (Standard)
 */
export interface PivotPoints {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export function pivotPoints(bar: OHLCVBar): PivotPoints {
  const { high, low, close } = bar;
  const pivot = (high + low + close) / 3;
  
  return {
    pivot,
    r1: 2 * pivot - low,
    r2: pivot + (high - low),
    r3: high + 2 * (pivot - low),
    s1: 2 * pivot - high,
    s2: pivot - (high - low),
    s3: low - 2 * (high - pivot),
  };
}

/**
 * Support and Resistance Levels
 */
export interface SupportResistance {
  supports: number[];
  resistances: number[];
}

export function findSupportResistance(
  bars: OHLCVBar[],
  lookback: number = 20,
  tolerance: number = 0.02
): SupportResistance {
  if (bars.length < lookback) {
    return { supports: [], resistances: [] };
  }
  
  const supports: number[] = [];
  const resistances: number[] = [];
  const priceMap = new Map<number, number>();
  
  // Find swing highs and lows
  for (let i = 2; i < bars.length - 2; i++) {
    const bar = bars[i];
    
    // Swing high (local maximum)
    if (bar.high > bars[i - 1].high && bar.high > bars[i - 2].high &&
        bar.high > bars[i + 1].high && bar.high > bars[i + 2].high) {
      const rounded = Math.round(bar.high / tolerance) * tolerance;
      priceMap.set(rounded, (priceMap.get(rounded) || 0) + 1);
      if (!resistances.includes(rounded)) resistances.push(rounded);
    }
    
    // Swing low (local minimum)
    if (bar.low < bars[i - 1].low && bar.low < bars[i - 2].low &&
        bar.low < bars[i + 1].low && bar.low < bars[i + 2].low) {
      const rounded = Math.round(bar.low / tolerance) * tolerance;
      priceMap.set(rounded, (priceMap.get(rounded) || 0) + 1);
      if (!supports.includes(rounded)) supports.push(rounded);
    }
  }
  
  // Sort and filter by frequency
  supports.sort((a, b) => a - b);
  resistances.sort((a, b) => a - b);
  
  return {
    supports: supports.slice(0, 5),
    resistances: resistances.slice(0, 5),
  };
}

// ================== COMPOSITE INDICATORS ==================

/**
 * Ichimoku Cloud
 */
export interface IchimokuResult {
  tenkan: number[];
  kijun: number[];
  senkouA: number[];
  senkouB: number[];
  chikou: number[];
}

export function ichimoku(
  bars: OHLCVBar[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52
): IchimokuResult {
  const calcMidpoint = (data: OHLCVBar[], period: number, index: number): number | null => {
    if (index < period - 1) return null;
    const slice = data.slice(index - period + 1, index + 1);
    const high = Math.max(...slice.map(b => b.high));
    const low = Math.min(...slice.map(b => b.low));
    return (high + low) / 2;
  };
  
  const tenkan: number[] = [];
  const kijun: number[] = [];
  const senkouA: number[] = [];
  const senkouB: number[] = [];
  const chikou: number[] = [];
  
  for (let i = 0; i < bars.length; i++) {
    const tenkanVal = calcMidpoint(bars, tenkanPeriod, i);
    const kijunVal = calcMidpoint(bars, kijunPeriod, i);
    const senkouBVal = calcMidpoint(bars, senkouBPeriod, i);
    
    if (tenkanVal !== null) tenkan.push(tenkanVal);
    if (kijunVal !== null) kijun.push(kijunVal);
    
    if (tenkanVal !== null && kijunVal !== null) {
      senkouA.push((tenkanVal + kijunVal) / 2);
    }
    
    if (senkouBVal !== null) senkouB.push(senkouBVal);
    
    chikou.push(bars[i].close);
  }
  
  return { tenkan, kijun, senkouA, senkouB, chikou };
}

/**
 * Ultimate Oscillator
 */
export function ultimateOscillator(
  bars: OHLCVBar[],
  period1: number = 7,
  period2: number = 14,
  period3: number = 28
): number[] {
  if (bars.length < period3 + 1) return [];
  
  const bp: number[] = [];
  const tr: number[] = [];
  
  for (let i = 1; i < bars.length; i++) {
    bp.push(bars[i].close - Math.min(bars[i].low, bars[i - 1].close));
    tr.push(Math.max(bars[i].high, bars[i - 1].close) - Math.min(bars[i].low, bars[i - 1].close));
  }
  
  const result: number[] = [];
  
  for (let i = period3 - 1; i < bp.length; i++) {
    const bp1 = bp.slice(i - period1 + 1, i + 1).reduce((a, b) => a + b, 0);
    const tr1 = tr.slice(i - period1 + 1, i + 1).reduce((a, b) => a + b, 0);
    
    const bp2 = bp.slice(i - period2 + 1, i + 1).reduce((a, b) => a + b, 0);
    const tr2 = tr.slice(i - period2 + 1, i + 1).reduce((a, b) => a + b, 0);
    
    const bp3 = bp.slice(i - period3 + 1, i + 1).reduce((a, b) => a + b, 0);
    const tr3 = tr.slice(i - period3 + 1, i + 1).reduce((a, b) => a + b, 0);
    
    const avg1 = tr1 === 0 ? 0 : bp1 / tr1;
    const avg2 = tr2 === 0 ? 0 : bp2 / tr2;
    const avg3 = tr3 === 0 ? 0 : bp3 / tr3;
    
    result.push(100 * (4 * avg1 + 2 * avg2 + avg3) / 7);
  }
  
  return result;
}

// ================== SIGNAL GENERATION ==================

/**
 * Generate trading signals from multiple indicators
 */
export class TechnicalSignalGenerator {
  generateSignals(bars: OHLCVBar[]): TechnicalSignal[] {
    const signals: TechnicalSignal[] = [];
    const closes = bars.map(b => b.close);
    
    // RSI Signal
    const rsiValues = rsi(closes);
    if (rsiValues.length > 0) {
      const lastRSI = rsiValues[rsiValues.length - 1];
      signals.push({
        indicator: 'RSI',
        signal: lastRSI < 30 ? 'buy' : lastRSI > 70 ? 'sell' : 'neutral',
        strength: Math.abs(50 - lastRSI) / 50,
        value: lastRSI,
        threshold: lastRSI < 30 ? 30 : 70,
      });
    }
    
    // MACD Signal
    const macdResult = macd(closes);
    if (macdResult.histogram.length > 1) {
      const lastHist = macdResult.histogram[macdResult.histogram.length - 1];
      const prevHist = macdResult.histogram[macdResult.histogram.length - 2];
      
      let crossover: 'bullish' | 'bearish' | undefined;
      if (prevHist < 0 && lastHist > 0) crossover = 'bullish';
      if (prevHist > 0 && lastHist < 0) crossover = 'bearish';
      
      signals.push({
        indicator: 'MACD',
        signal: crossover === 'bullish' ? 'buy' : crossover === 'bearish' ? 'sell' : 'neutral',
        strength: Math.min(1, Math.abs(lastHist) / 0.5),
        value: lastHist,
        crossover,
      });
    }
    
    // Bollinger Bands Signal
    const bbResult = bollingerBands(closes);
    if (bbResult.percentB.length > 0) {
      const lastPercentB = bbResult.percentB[bbResult.percentB.length - 1];
      signals.push({
        indicator: 'Bollinger_Bands',
        signal: lastPercentB < 0 ? 'buy' : lastPercentB > 1 ? 'sell' : 'neutral',
        strength: Math.abs(0.5 - lastPercentB),
        value: lastPercentB,
      });
    }
    
    // Stochastic Signal
    const stochResult = stochastic(bars);
    if (stochResult.k.length > 0 && stochResult.d.length > 0) {
      const lastK = stochResult.k[stochResult.k.length - 1];
      const lastD = stochResult.d[stochResult.d.length - 1];
      
      let crossover: 'bullish' | 'bearish' | undefined;
      if (stochResult.k.length > 1 && stochResult.d.length > 1) {
        const prevK = stochResult.k[stochResult.k.length - 2];
        const prevD = stochResult.d[stochResult.d.length - 2];
        if (prevK < prevD && lastK > lastD && lastK < 20) crossover = 'bullish';
        if (prevK > prevD && lastK < lastD && lastK > 80) crossover = 'bearish';
      }
      
      signals.push({
        indicator: 'Stochastic',
        signal: crossover === 'bullish' ? 'buy' : crossover === 'bearish' ? 'sell' : 'neutral',
        strength: Math.abs(50 - lastK) / 50,
        value: lastK,
        crossover,
      });
    }
    
    // ADX Signal (trend strength)
    const adxResult = adx(bars);
    if (adxResult.adx.length > 0) {
      const lastADX = adxResult.adx[adxResult.adx.length - 1];
      const lastPlusDI = adxResult.plusDI[adxResult.plusDI.length - 1];
      const lastMinusDI = adxResult.minusDI[adxResult.minusDI.length - 1];
      
      let signal: 'buy' | 'sell' | 'neutral' = 'neutral';
      if (lastADX > 25) {
        signal = lastPlusDI > lastMinusDI ? 'buy' : 'sell';
      }
      
      signals.push({
        indicator: 'ADX',
        signal,
        strength: lastADX / 100,
        value: lastADX,
        threshold: 25,
      });
    }
    
    return signals;
  }
  
  // Combine signals into overall recommendation
  combineSignals(signals: TechnicalSignal[]): {
    action: 'buy' | 'sell' | 'neutral';
    confidence: number;
    reasoning: string[];
  } {
    let buyScore = 0;
    let sellScore = 0;
    let totalWeight = 0;
    const reasoning: string[] = [];
    
    for (const signal of signals) {
      const weight = signal.strength;
      totalWeight += weight;
      
      if (signal.signal === 'buy') {
        buyScore += weight;
        reasoning.push(`${signal.indicator}: ${signal.crossover || 'buy'} signal (${signal.value.toFixed(2)})`);
      } else if (signal.signal === 'sell') {
        sellScore += weight;
        reasoning.push(`${signal.indicator}: ${signal.crossover || 'sell'} signal (${signal.value.toFixed(2)})`);
      }
    }
    
    const netScore = totalWeight > 0 ? (buyScore - sellScore) / totalWeight : 0;
    const confidence = Math.abs(netScore);
    
    let action: 'buy' | 'sell' | 'neutral';
    if (netScore > 0.2) action = 'buy';
    else if (netScore < -0.2) action = 'sell';
    else action = 'neutral';
    
    return { action, confidence, reasoning };
  }
}

// Factory function
export function createTechnicalSignalGenerator(): TechnicalSignalGenerator {
  return new TechnicalSignalGenerator();
}

// Export all indicator functions for direct use
export const indicators = {
  // Trend
  sma, ema, wma, dema, tema, macd, adx, parabolicSAR,
  // Momentum
  rsi, stochastic, cci, williamsR, roc, momentum, mfi,
  // Volatility
  atr, bollingerBands, keltnerChannels, stdDev, historicalVolatility,
  // Volume
  obv, vwap, accumulationDistribution, cmf, forceIndex,
  // Pattern
  pivotPoints, findSupportResistance,
  // Composite
  ichimoku, ultimateOscillator,
};
