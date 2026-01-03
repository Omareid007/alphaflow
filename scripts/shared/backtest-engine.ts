/**
 * Backtest Engine - Core trading simulation
 * Consolidated from omar-backtest*.ts scripts
 */

import type {
  AlpacaBar,
  BacktestConfig,
  Trade,
  SignalResult,
  BacktestResult,
  BacktestMetrics,
  EquityPoint,
  DEFAULT_CONFIG,
} from "./types.js";

import {
  calculateRSI,
  calculateSMA,
  calculateEMA,
  calculateATR,
  calculateStochastic,
  calculateMACD,
  calculateBollingerBands,
} from "./technical-indicators.js";

import { extractOHLCV } from "./alpaca-api.js";

// ============================================================================
// SIGNAL GENERATION
// ============================================================================

export interface SignalGeneratorOptions {
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  smaPeriod: number;
  emaPeriodFast: number;
  emaPeriodSlow: number;
  atrPeriod: number;
  atrMultiplierStop: number;
  atrMultiplierTarget: number;
  buyThreshold: number;
  sellThreshold: number;
  confidenceMinimum: number;
}

export interface IndicatorData {
  rsi: (number | null)[];
  sma: (number | null)[];
  emaFast: (number | null)[];
  emaSlow: (number | null)[];
  atr: (number | null)[];
  stochK: (number | null)[];
  stochD: (number | null)[];
  macdHistogram: (number | null)[];
  bbUpper: (number | null)[];
  bbLower: (number | null)[];
  bbWidth: (number | null)[];
}

/**
 * Calculate all technical indicators for a symbol
 */
export function calculateIndicators(
  bars: AlpacaBar[],
  config: Partial<SignalGeneratorOptions> = {}
): IndicatorData {
  const { closes, highs, lows } = extractOHLCV(bars);

  const rsiPeriod = config.rsiPeriod ?? 14;
  const smaPeriod = config.smaPeriod ?? 20;
  const emaPeriodFast = config.emaPeriodFast ?? 12;
  const emaPeriodSlow = config.emaPeriodSlow ?? 26;
  const atrPeriod = config.atrPeriod ?? 14;

  const rsi = calculateRSI(closes, rsiPeriod);
  const sma = calculateSMA(closes, smaPeriod);
  const emaFast = calculateEMA(closes, emaPeriodFast);
  const emaSlow = calculateEMA(closes, emaPeriodSlow);
  const atr = calculateATR(highs, lows, closes, atrPeriod);
  const stoch = calculateStochastic(highs, lows, closes, 14);
  const macd = calculateMACD(closes);
  const bb = calculateBollingerBands(closes, 20);

  return {
    rsi,
    sma,
    emaFast,
    emaSlow,
    atr,
    stochK: stoch.k,
    stochD: stoch.d,
    macdHistogram: macd.histogram,
    bbUpper: bb.upper,
    bbLower: bb.lower,
    bbWidth: bb.width,
  };
}

/**
 * Generate trading signal based on technical indicators
 */
export function generateSignal(
  index: number,
  prices: number[],
  highs: number[],
  lows: number[],
  indicators: IndicatorData,
  config: SignalGeneratorOptions
): SignalResult {
  const currentPrice = prices[index];
  const currentRSI = indicators.rsi[index];
  const currentSMA = indicators.sma[index];
  const currentEMAFast = indicators.emaFast[index];
  const currentEMASlow = indicators.emaSlow[index];
  const currentATR = indicators.atr[index];
  const currentStochK = indicators.stochK[index];
  const currentMACDHist = indicators.macdHistogram[index];
  const currentBBLower = indicators.bbLower[index];
  const currentBBUpper = indicators.bbUpper[index];

  if (currentRSI === null || currentSMA === null || currentATR === null) {
    return { signal: "hold", confidence: 0, reasoning: ["Insufficient data"] };
  }

  let bullishScore = 0;
  let bearishScore = 0;
  const reasoning: string[] = [];

  // RSI Analysis (weight: 20)
  if (currentRSI < config.rsiOversold) {
    bullishScore += 20;
    reasoning.push(`RSI oversold: ${currentRSI.toFixed(1)}`);
  } else if (currentRSI > config.rsiOverbought) {
    bearishScore += 20;
    reasoning.push(`RSI overbought: ${currentRSI.toFixed(1)}`);
  } else if (currentRSI < 45) {
    bullishScore += 8;
  } else if (currentRSI > 55) {
    bearishScore += 8;
  }

  // Price vs SMA (weight: 15)
  if (currentPrice > currentSMA * 1.02) {
    bullishScore += 15;
    reasoning.push(`Price above SMA${config.smaPeriod}`);
  } else if (currentPrice < currentSMA * 0.98) {
    bearishScore += 15;
    reasoning.push(`Price below SMA${config.smaPeriod}`);
  }

  // EMA Crossover (weight: 15)
  if (currentEMAFast !== null && currentEMASlow !== null) {
    if (currentEMAFast > currentEMASlow) {
      bullishScore += 15;
      reasoning.push("EMA bullish alignment");
    } else {
      bearishScore += 15;
    }
  }

  // Stochastic (weight: 12)
  if (currentStochK !== null) {
    if (currentStochK < 20) {
      bullishScore += 12;
      reasoning.push(`Stochastic oversold: ${currentStochK.toFixed(1)}`);
    } else if (currentStochK > 80) {
      bearishScore += 12;
      reasoning.push(`Stochastic overbought: ${currentStochK.toFixed(1)}`);
    }
  }

  // MACD Histogram (weight: 12)
  if (currentMACDHist !== null) {
    if (currentMACDHist > 0) {
      bullishScore += 12;
      reasoning.push("MACD positive");
    } else {
      bearishScore += 12;
    }
  }

  // Bollinger Bands (weight: 10)
  if (currentBBLower !== null && currentBBUpper !== null) {
    if (currentPrice < currentBBLower) {
      bullishScore += 10;
      reasoning.push("Price at lower Bollinger");
    } else if (currentPrice > currentBBUpper) {
      bearishScore += 10;
      reasoning.push("Price at upper Bollinger");
    }
  }

  // Momentum (weight: 8)
  if (index > 5) {
    const momentum5d =
      ((currentPrice - prices[index - 5]) / prices[index - 5]) * 100;
    if (momentum5d > 3) {
      bullishScore += 8;
      reasoning.push(`5d momentum: +${momentum5d.toFixed(1)}%`);
    } else if (momentum5d < -3) {
      bearishScore += 8;
      reasoning.push(`5d momentum: ${momentum5d.toFixed(1)}%`);
    }
  }

  // Volatility adjustment
  const atrPct = (currentATR / currentPrice) * 100;
  if (atrPct > 4) {
    bearishScore += 8;
  }

  const totalScore = bullishScore + bearishScore;
  const netScore = bullishScore - bearishScore;
  const normalizedScore = totalScore > 0 ? netScore / totalScore : 0;

  const signalStrength = Math.abs(normalizedScore);
  let confidence = 0.35 + signalStrength * 0.45;
  confidence += Math.min(reasoning.length / 15, 0.15);
  confidence = Math.max(0.3, Math.min(confidence, 0.9));

  let signal: "buy" | "sell" | "hold" = "hold";
  if (
    normalizedScore > config.buyThreshold &&
    confidence >= config.confidenceMinimum
  ) {
    signal = "buy";
  } else if (
    normalizedScore < -config.sellThreshold &&
    confidence >= config.confidenceMinimum
  ) {
    signal = "sell";
  }

  const stopLoss = currentPrice - currentATR * config.atrMultiplierStop;
  const takeProfit = currentPrice + currentATR * config.atrMultiplierTarget;

  return { signal, confidence, reasoning, stopLoss, takeProfit };
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

export interface BacktestEngineOptions extends BacktestConfig {
  onTrade?: (trade: Trade) => void;
  onDayEnd?: (date: string, equity: number) => void;
}

/**
 * Run backtest on historical data
 */
export function runBacktest(
  dataMap: Map<string, AlpacaBar[]>,
  config: BacktestEngineOptions
): BacktestResult {
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];

  let equity = config.initialCapital;
  let peakEquity = equity;
  let maxDrawdown = 0;
  const openPositions = new Map<string, Trade>();

  const signalConfig: SignalGeneratorOptions = {
    rsiPeriod: config.rsiPeriod,
    rsiOversold: config.rsiOversold,
    rsiOverbought: config.rsiOverbought,
    smaPeriod: config.smaPeriod,
    emaPeriodFast: config.emaPeriodFast,
    emaPeriodSlow: config.emaPeriodSlow,
    atrPeriod: config.atrPeriod,
    atrMultiplierStop: config.atrMultiplierStop,
    atrMultiplierTarget: config.atrMultiplierTarget,
    buyThreshold: config.buyThreshold,
    sellThreshold: config.sellThreshold,
    confidenceMinimum: config.confidenceMinimum,
  };

  for (const symbol of config.symbols) {
    const bars = dataMap.get(symbol);
    if (!bars || bars.length < 50) continue;

    const { dates, opens, highs, lows, closes } = extractOHLCV(bars);
    const indicators = calculateIndicators(bars, signalConfig);

    for (let i = 50; i < bars.length - 1; i++) {
      const currentDate = dates[i];
      const currentPrice = closes[i];
      const nextDayOpen = opens[i + 1];

      const signalResult = generateSignal(
        i,
        closes,
        highs,
        lows,
        indicators,
        signalConfig
      );

      const positionKey = symbol;
      const existingPosition = openPositions.get(positionKey);

      if (existingPosition) {
        const dayLow = lows[i];
        const dayHigh = highs[i];

        let exitPrice: number | undefined;
        let exitReason: Trade["exitReason"];

        if (dayLow <= existingPosition.stopLoss) {
          exitPrice = existingPosition.stopLoss;
          exitReason = "stop_loss";
        } else if (dayHigh >= existingPosition.takeProfit) {
          exitPrice = existingPosition.takeProfit;
          exitReason = "take_profit";
        } else if (
          signalResult.signal === "sell" &&
          existingPosition.side === "buy"
        ) {
          exitPrice = currentPrice;
          exitReason = "signal";
        }

        if (exitPrice) {
          existingPosition.exitDate = currentDate;
          existingPosition.exitPrice = exitPrice;
          existingPosition.exitReason = exitReason;
          existingPosition.pnl =
            (exitPrice - existingPosition.entryPrice) *
            existingPosition.quantity;
          existingPosition.pnlPct =
            ((exitPrice - existingPosition.entryPrice) /
              existingPosition.entryPrice) *
            100;
          existingPosition.holdingDays = Math.round(
            (new Date(currentDate).getTime() -
              new Date(existingPosition.entryDate).getTime()) /
              (1000 * 60 * 60 * 24)
          );

          equity += existingPosition.pnl;
          trades.push({ ...existingPosition });
          openPositions.delete(positionKey);

          if (config.onTrade) {
            config.onTrade(existingPosition);
          }
        }
      } else if (
        signalResult.signal === "buy" &&
        signalResult.confidence >= config.confidenceMinimum
      ) {
        const positionSize = equity * config.maxPositionPct;
        const quantity = Math.floor(positionSize / nextDayOpen);

        if (quantity > 0 && equity > positionSize) {
          const trade: Trade = {
            symbol,
            entryDate: dates[i + 1],
            entryPrice: nextDayOpen,
            quantity,
            side: "buy",
            stopLoss:
              signalResult.stopLoss || nextDayOpen * (1 - config.stopLossPct),
            takeProfit:
              signalResult.takeProfit ||
              nextDayOpen * (1 + config.takeProfitPct),
            reasoning: signalResult.reasoning,
          };
          openPositions.set(positionKey, trade);
        }
      }

      equityCurve.push({ date: currentDate, equity });
      peakEquity = Math.max(peakEquity, equity);
      const drawdown = (peakEquity - equity) / peakEquity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);

      if (config.onDayEnd) {
        config.onDayEnd(currentDate, equity);
      }
    }

    // Close remaining positions for this symbol
    for (const [key, position] of Array.from(openPositions.entries())) {
      if (position.symbol === symbol) {
        const lastBar = bars[bars.length - 1];
        position.exitDate = lastBar.t.split("T")[0];
        position.exitPrice = lastBar.c;
        position.exitReason = "end_of_period";
        position.pnl = (lastBar.c - position.entryPrice) * position.quantity;
        position.pnlPct =
          ((lastBar.c - position.entryPrice) / position.entryPrice) * 100;
        position.holdingDays = Math.round(
          (new Date(lastBar.t).getTime() -
            new Date(position.entryDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        equity += position.pnl;
        trades.push({ ...position });
        openPositions.delete(key);

        if (config.onTrade) {
          config.onTrade(position);
        }
      }
    }
  }

  const metrics = calculateMetrics(
    trades,
    equityCurve,
    config.initialCapital,
    maxDrawdown
  );

  return {
    config: config as BacktestConfig,
    trades,
    metrics,
    equityCurve,
    sampleTrades: trades.slice(0, 10),
  };
}

// ============================================================================
// METRICS CALCULATION
// ============================================================================

/**
 * Calculate performance metrics from trades
 */
export function calculateMetrics(
  trades: Trade[],
  equityCurve: EquityPoint[],
  initialCapital: number,
  maxDrawdown: number
): BacktestMetrics {
  const winningTrades = trades.filter((t) => (t.pnl || 0) > 0);
  const losingTrades = trades.filter((t) => (t.pnl || 0) <= 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalLosses = Math.abs(
    losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  );
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const avgHoldingDays =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + (t.holdingDays || 0), 0) / trades.length
      : 0;

  // Calculate Sharpe ratio
  const returns =
    equityCurve.length > 1
      ? equityCurve
          .slice(1)
          .map(
            (e, i) => (e.equity - equityCurve[i].equity) / equityCurve[i].equity
          )
      : [];
  const avgReturn =
    returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;
  const stdReturn =
    returns.length > 0
      ? Math.sqrt(
          returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
            returns.length
        )
      : 0;
  const sharpeRatio =
    stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  // Calculate CAGR
  const finalEquity = initialCapital + totalPnl;
  const totalDays = equityCurve.length;
  const years = totalDays / 252;
  const cagr =
    years > 0 ? Math.pow(finalEquity / initialCapital, 1 / years) - 1 : 0;

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate:
      trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    totalPnl,
    totalPnlPct: (totalPnl / initialCapital) * 100,
    avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
    avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
    profitFactor:
      totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    maxDrawdown: maxDrawdown * 100,
    sharpeRatio,
    avgHoldingDays,
    finalEquity,
    cagr: cagr * 100,
  };
}

/**
 * Calculate composite score from metrics
 */
export function calculateScore(metrics: BacktestMetrics): number {
  const winRateScore = metrics.winRate * 0.25;
  const profitFactorScore = Math.min(metrics.profitFactor, 3) * 10 * 0.2;
  const sharpeScore = Math.max(0, metrics.sharpeRatio) * 10 * 0.25;
  const cagrScore = Math.max(0, metrics.cagr) * 2 * 0.15;
  const drawdownPenalty = Math.max(0, 20 - metrics.maxDrawdown) * 0.15;
  return (
    winRateScore + profitFactorScore + sharpeScore + cagrScore + drawdownPenalty
  );
}

/**
 * Calculate Sortino ratio (downside deviation only)
 */
export function calculateSortino(
  returns: number[],
  riskFreeRate: number = 0
): number {
  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const negativeReturns = returns.filter((r) => r < riskFreeRate);

  if (negativeReturns.length === 0) return avgReturn > 0 ? Infinity : 0;

  const downsideDeviation = Math.sqrt(
    negativeReturns.reduce((sum, r) => sum + Math.pow(r - riskFreeRate, 2), 0) /
      negativeReturns.length
  );

  return downsideDeviation > 0
    ? ((avgReturn - riskFreeRate) / downsideDeviation) * Math.sqrt(252)
    : 0;
}

/**
 * Calculate Calmar ratio (CAGR / Max Drawdown)
 */
export function calculateCalmar(cagr: number, maxDrawdown: number): number {
  return maxDrawdown > 0 ? cagr / maxDrawdown : cagr > 0 ? Infinity : 0;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  calculateRSI,
  calculateSMA,
  calculateEMA,
  calculateATR,
  calculateStochastic,
  calculateMACD,
  calculateBollingerBands,
} from "./technical-indicators.js";

export {
  fetchAlpacaBars,
  fetchHistoricalData,
  extractOHLCV,
  SYMBOL_LISTS,
} from "./alpaca-api.js";
