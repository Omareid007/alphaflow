/**
 * Mean Reversion Trading Algorithm
 *
 * Strategy: Buy when price falls below lower Bollinger Band (oversold)
 *           Sell when price reverts to moving average or hits stop loss
 *
 * Parameters:
 * - meanPeriod: SMA lookback period (default: 20)
 * - stdDevMultiple: Bollinger Band width (default: 2.0)
 * - stopLossPercent: Maximum loss per trade (default: 5%)
 * - takeProfitTarget: Where to take profit (default: 'mean')
 */

export interface MeanReversionConfig {
  symbols: string[];
  meanPeriod: number;
  stdDevMultiple: number;
  stopLossPercent: number;
  takeProfitTarget: "mean" | "upperBand" | "percentAboveMean";
  percentAboveMean?: number;
  maxPositions: number;
  positionSizePercent: number;
}

export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  symbol: string;
  action: "buy" | "sell" | "hold";
  price: number;
  reason: string;
  confidence: number;
  indicators: {
    sma: number;
    upperBand: number;
    lowerBand: number;
    zScore: number;
  };
}

export interface Position {
  symbol: string;
  entryPrice: number;
  entryDate: string;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

/**
 * Calculate Standard Deviation
 */
function calculateStdDev(
  prices: number[],
  period: number,
  sma: number
): number {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  const squaredDiffs = slice.map((p) => Math.pow(p - sma, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / period;
  return Math.sqrt(variance);
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
  prices: number[],
  period: number,
  stdDevMultiple: number
): {
  sma: number;
  upperBand: number;
  lowerBand: number;
  stdDev: number;
} {
  const sma = calculateSMA(prices, period);
  const stdDev = calculateStdDev(prices, period, sma);

  return {
    sma,
    upperBand: sma + stdDev * stdDevMultiple,
    lowerBand: sma - stdDev * stdDevMultiple,
    stdDev,
  };
}

/**
 * Calculate Z-Score (how many std devs from mean)
 */
export function calculateZScore(
  price: number,
  sma: number,
  stdDev: number
): number {
  if (stdDev === 0) return 0;
  return (price - sma) / stdDev;
}

/**
 * Generate trading signal for a symbol
 */
export function generateSignal(
  symbol: string,
  priceHistory: number[],
  currentPrice: number,
  config: MeanReversionConfig,
  currentPosition?: Position
): Signal {
  const bands = calculateBollingerBands(
    priceHistory,
    config.meanPeriod,
    config.stdDevMultiple
  );

  const zScore = calculateZScore(currentPrice, bands.sma, bands.stdDev);

  const indicators = {
    sma: bands.sma,
    upperBand: bands.upperBand,
    lowerBand: bands.lowerBand,
    zScore,
  };

  // If we have a position, check for exit signals
  if (currentPosition) {
    // Stop loss hit
    if (currentPrice <= currentPosition.stopLoss) {
      return {
        symbol,
        action: "sell",
        price: currentPrice,
        reason: `Stop loss triggered at ${currentPrice.toFixed(2)}`,
        confidence: 1.0,
        indicators,
      };
    }

    // Take profit hit
    if (currentPrice >= currentPosition.takeProfit) {
      return {
        symbol,
        action: "sell",
        price: currentPrice,
        reason: `Take profit target reached at ${currentPrice.toFixed(2)}`,
        confidence: 0.9,
        indicators,
      };
    }

    // Mean reversion complete (price returned to SMA)
    if (config.takeProfitTarget === "mean" && currentPrice >= bands.sma) {
      return {
        symbol,
        action: "sell",
        price: currentPrice,
        reason: `Price reverted to mean (SMA: ${bands.sma.toFixed(2)})`,
        confidence: 0.85,
        indicators,
      };
    }

    // Hold position
    return {
      symbol,
      action: "hold",
      price: currentPrice,
      reason: `Holding - waiting for mean reversion (Z-score: ${zScore.toFixed(2)})`,
      confidence: 0.5,
      indicators,
    };
  }

  // No position - check for entry signals
  // BUY when price is below lower Bollinger Band (oversold)
  if (currentPrice < bands.lowerBand && zScore < -config.stdDevMultiple) {
    const confidence = Math.min(1.0, Math.abs(zScore) / 3);
    return {
      symbol,
      action: "buy",
      price: currentPrice,
      reason: `Oversold: Price ${currentPrice.toFixed(2)} below lower band ${bands.lowerBand.toFixed(2)} (Z-score: ${zScore.toFixed(2)})`,
      confidence,
      indicators,
    };
  }

  // No signal
  return {
    symbol,
    action: "hold",
    price: currentPrice,
    reason: `No signal - price within bands (Z-score: ${zScore.toFixed(2)})`,
    confidence: 0,
    indicators,
  };
}

/**
 * Calculate position size based on portfolio value
 */
export function calculatePositionSize(
  portfolioValue: number,
  positionSizePercent: number,
  price: number,
  maxPositions: number,
  currentPositionCount: number
): number {
  if (currentPositionCount >= maxPositions) return 0;

  const allocationPerPosition = portfolioValue * (positionSizePercent / 100);
  const shares = Math.floor(allocationPerPosition / price);

  return Math.max(0, shares);
}

/**
 * Calculate stop loss and take profit levels
 */
export function calculateExitLevels(
  entryPrice: number,
  config: MeanReversionConfig,
  bands: { sma: number; upperBand: number }
): { stopLoss: number; takeProfit: number } {
  const stopLoss = entryPrice * (1 - config.stopLossPercent / 100);

  let takeProfit: number;
  switch (config.takeProfitTarget) {
    case "mean":
      takeProfit = bands.sma;
      break;
    case "upperBand":
      takeProfit = bands.upperBand;
      break;
    case "percentAboveMean":
      takeProfit = bands.sma * (1 + (config.percentAboveMean || 2) / 100);
      break;
    default:
      takeProfit = bands.sma;
  }

  return { stopLoss, takeProfit };
}

export default {
  generateSignal,
  calculateBollingerBands,
  calculateZScore,
  calculatePositionSize,
  calculateExitLevels,
};
