import type {
  StrategySignal,
  StrategySignalGenerator,
} from "./execution-engine";
import type { HistoricalBar } from "./historical-data-service";

export type StrategyType =
  | "moving_average_crossover"
  | "rsi_oscillator"
  | "buy_and_hold"
  | "mean_reversion";

export interface StrategyConfig {
  type: StrategyType;
  params: Record<string, number>;
}

interface SymbolState {
  prices: number[];
  position: "none" | "long";
  positionQty: number;
}

export function createMovingAverageCrossoverStrategy(
  universe: string[],
  initialCash: number,
  fastPeriod: number = 10,
  slowPeriod: number = 20,
  allocationPct: number = 10
): StrategySignalGenerator {
  const state: Map<string, SymbolState> = new Map();

  for (const symbol of universe) {
    state.set(symbol, { prices: [], position: "none", positionQty: 0 });
  }

  return {
    onBar(
      bar: HistoricalBar,
      barIndex: number,
      allBarsUpToNow: HistoricalBar[]
    ): StrategySignal[] {
      const signals: StrategySignal[] = [];
      const symbol = bar.symbol;

      let symbolState = state.get(symbol);
      if (!symbolState) {
        symbolState = { prices: [], position: "none", positionQty: 0 };
        state.set(symbol, symbolState);
      }

      symbolState.prices.push(bar.close);

      if (symbolState.prices.length < slowPeriod) return signals;

      const recentPrices = symbolState.prices.slice(-slowPeriod);
      const fastMA =
        recentPrices.slice(-fastPeriod).reduce((a, b) => a + b, 0) / fastPeriod;
      const slowMA = recentPrices.reduce((a, b) => a + b, 0) / slowPeriod;

      if (symbolState.prices.length > slowPeriod) {
        const prevPrices = symbolState.prices.slice(-slowPeriod - 1, -1);
        const prevFastMA =
          prevPrices.slice(-fastPeriod).reduce((a, b) => a + b, 0) / fastPeriod;
        const prevSlowMA = prevPrices.reduce((a, b) => a + b, 0) / slowPeriod;

        if (
          prevFastMA <= prevSlowMA &&
          fastMA > slowMA &&
          symbolState.position === "none"
        ) {
          const allocationAmount = initialCash * (allocationPct / 100);
          const qty = Math.floor(allocationAmount / bar.close);

          if (qty > 0) {
            signals.push({
              symbol,
              side: "buy",
              qty,
              reason: `Bullish crossover: Fast MA (${fastMA.toFixed(2)}) crossed above Slow MA (${slowMA.toFixed(2)})`,
            });
            symbolState.position = "long";
            symbolState.positionQty = qty;
          }
        } else if (
          prevFastMA >= prevSlowMA &&
          fastMA < slowMA &&
          symbolState.position === "long"
        ) {
          signals.push({
            symbol,
            side: "sell",
            qty: symbolState.positionQty,
            reason: `Bearish crossover: Fast MA (${fastMA.toFixed(2)}) crossed below Slow MA (${slowMA.toFixed(2)})`,
          });
          symbolState.position = "none";
          symbolState.positionQty = 0;
        }
      }

      return signals;
    },
  };
}

export function createRSIStrategy(
  universe: string[],
  initialCash: number,
  period: number = 14,
  oversoldThreshold: number = 30,
  overboughtThreshold: number = 70,
  allocationPct: number = 10
): StrategySignalGenerator {
  const state: Map<
    string,
    SymbolState & { gains: number[]; losses: number[] }
  > = new Map();

  for (const symbol of universe) {
    state.set(symbol, {
      prices: [],
      position: "none",
      positionQty: 0,
      gains: [],
      losses: [],
    });
  }

  return {
    onBar(
      bar: HistoricalBar,
      barIndex: number,
      allBarsUpToNow: HistoricalBar[]
    ): StrategySignal[] {
      const signals: StrategySignal[] = [];
      const symbol = bar.symbol;

      let symbolState = state.get(symbol);
      if (!symbolState) {
        symbolState = {
          prices: [],
          position: "none",
          positionQty: 0,
          gains: [],
          losses: [],
        };
        state.set(symbol, symbolState);
      }

      const prevPrice = symbolState.prices[symbolState.prices.length - 1];
      symbolState.prices.push(bar.close);

      if (prevPrice !== undefined) {
        const change = bar.close - prevPrice;
        symbolState.gains.push(change > 0 ? change : 0);
        symbolState.losses.push(change < 0 ? Math.abs(change) : 0);
      }

      if (symbolState.gains.length < period) return signals;

      const recentGains = symbolState.gains.slice(-period);
      const recentLosses = symbolState.losses.slice(-period);
      const avgGain = recentGains.reduce((a, b) => a + b, 0) / period;
      const avgLoss = recentLosses.reduce((a, b) => a + b, 0) / period;

      const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
      const rsi = 100 - 100 / (1 + rs);

      if (rsi < oversoldThreshold && symbolState.position === "none") {
        const allocationAmount = initialCash * (allocationPct / 100);
        const qty = Math.floor(allocationAmount / bar.close);

        if (qty > 0) {
          signals.push({
            symbol,
            side: "buy",
            qty,
            reason: `RSI oversold: RSI (${rsi.toFixed(2)}) < ${oversoldThreshold}`,
          });
          symbolState.position = "long";
          symbolState.positionQty = qty;
        }
      } else if (rsi > overboughtThreshold && symbolState.position === "long") {
        signals.push({
          symbol,
          side: "sell",
          qty: symbolState.positionQty,
          reason: `RSI overbought: RSI (${rsi.toFixed(2)}) > ${overboughtThreshold}`,
        });
        symbolState.position = "none";
        symbolState.positionQty = 0;
      }

      return signals;
    },
  };
}

export function createBuyAndHoldStrategy(
  universe: string[],
  initialCash: number,
  allocationPct: number = 10
): StrategySignalGenerator {
  const bought = new Set<string>();
  const positionQty: Map<string, number> = new Map();

  return {
    onBar(
      bar: HistoricalBar,
      barIndex: number,
      allBarsUpToNow: HistoricalBar[]
    ): StrategySignal[] {
      const symbol = bar.symbol;

      if (!bought.has(symbol)) {
        const allocationAmount = initialCash * (allocationPct / 100);
        const qty = Math.floor(allocationAmount / bar.close);

        if (qty > 0) {
          bought.add(symbol);
          positionQty.set(symbol, qty);
          return [
            {
              symbol,
              side: "buy",
              qty,
              reason: `Buy and hold: Initial purchase of ${symbol}`,
            },
          ];
        }
      }
      return [];
    },
  };
}

interface MeanReversionSymbolState extends SymbolState {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryIndex: number;
}

export function createMeanReversionStrategy(
  universe: string[],
  initialCash: number,
  meanPeriod: number = 20,
  stdDevMultiple: number = 2.0,
  stopLossPercent: number = 5,
  allocationPct: number = 10
): StrategySignalGenerator {
  const state: Map<string, MeanReversionSymbolState> = new Map();

  // Helper: Calculate Simple Moving Average
  function calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    return slice.reduce((sum, p) => sum + p, 0) / period;
  }

  // Helper: Calculate Standard Deviation
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

  // Helper: Calculate Z-Score
  function calculateZScore(price: number, sma: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (price - sma) / stdDev;
  }

  // Initialize state for symbols
  for (const symbol of universe) {
    state.set(symbol, {
      prices: [],
      position: "none",
      positionQty: 0,
      entryPrice: 0,
      stopLoss: 0,
      takeProfit: 0,
      entryIndex: 0,
    });
  }

  return {
    onBar(
      bar: HistoricalBar,
      barIndex: number,
      allBarsUpToNow: HistoricalBar[]
    ): StrategySignal[] {
      const signals: StrategySignal[] = [];
      const symbol = bar.symbol;

      let symbolState = state.get(symbol);
      if (!symbolState) {
        symbolState = {
          prices: [],
          position: "none",
          positionQty: 0,
          entryPrice: 0,
          stopLoss: 0,
          takeProfit: 0,
          entryIndex: 0,
        };
        state.set(symbol, symbolState);
      }

      symbolState.prices.push(bar.close);
      const currentPrice = bar.close;

      // Need enough data for Bollinger Bands calculation
      if (symbolState.prices.length < meanPeriod) return signals;

      // Calculate Bollinger Bands
      const sma = calculateSMA(symbolState.prices, meanPeriod);
      const stdDev = calculateStdDev(symbolState.prices, meanPeriod, sma);
      const lowerBand = sma - stdDev * stdDevMultiple;
      const upperBand = sma + stdDev * stdDevMultiple;
      const zScore = calculateZScore(currentPrice, sma, stdDev);

      // Handle existing position - check for exits
      if (symbolState.position === "long") {
        let shouldExit = false;
        let exitReason = "";

        // Check stop loss
        if (currentPrice <= symbolState.stopLoss) {
          shouldExit = true;
          exitReason = `Stop loss triggered at ${currentPrice.toFixed(2)}`;
        }
        // Check take profit
        else if (currentPrice >= symbolState.takeProfit) {
          shouldExit = true;
          exitReason = `Take profit target reached at ${currentPrice.toFixed(2)}`;
        }
        // Check mean reversion complete
        else if (currentPrice >= sma) {
          shouldExit = true;
          exitReason = `Price reverted to mean (SMA: ${sma.toFixed(2)})`;
        }

        if (shouldExit) {
          signals.push({
            symbol,
            side: "sell",
            qty: symbolState.positionQty,
            reason: exitReason,
          });
          symbolState.position = "none";
          symbolState.positionQty = 0;
          symbolState.entryPrice = 0;
          symbolState.stopLoss = 0;
          symbolState.takeProfit = 0;
        }
      }

      // No position - check for entry signals
      if (
        symbolState.position === "none" &&
        currentPrice < lowerBand &&
        zScore < -stdDevMultiple
      ) {
        const allocationAmount = initialCash * (allocationPct / 100);
        const qty = Math.floor(allocationAmount / currentPrice);

        if (qty > 0) {
          const stopLoss = currentPrice * (1 - stopLossPercent / 100);
          const takeProfit = sma; // Mean reversion target

          signals.push({
            symbol,
            side: "buy",
            qty,
            reason: `Oversold: Price ${currentPrice.toFixed(2)} below lower band ${lowerBand.toFixed(2)} (Z-score: ${zScore.toFixed(2)})`,
          });

          symbolState.position = "long";
          symbolState.positionQty = qty;
          symbolState.entryPrice = currentPrice;
          symbolState.stopLoss = stopLoss;
          symbolState.takeProfit = takeProfit;
          symbolState.entryIndex = barIndex;
        }
      }

      return signals;
    },
  };
}

export function createStrategy(
  strategyConfig: StrategyConfig,
  universe: string[],
  initialCash: number
): StrategySignalGenerator {
  const { type, params } = strategyConfig;

  switch (type) {
    case "moving_average_crossover":
      return createMovingAverageCrossoverStrategy(
        universe,
        initialCash,
        params.fastPeriod || 10,
        params.slowPeriod || 20,
        params.allocationPct || 10
      );
    case "rsi_oscillator":
      return createRSIStrategy(
        universe,
        initialCash,
        params.period || 14,
        params.oversoldThreshold || 30,
        params.overboughtThreshold || 70,
        params.allocationPct || 10
      );
    case "mean_reversion":
      return createMeanReversionStrategy(
        universe,
        initialCash,
        params.meanPeriod || 20,
        params.stdDevMultiple || 2.0,
        params.stopLossPercent || 5,
        params.allocationPct || 10
      );
    case "buy_and_hold":
    default:
      return createBuyAndHoldStrategy(
        universe,
        initialCash,
        params.allocationPct || 10
      );
  }
}
