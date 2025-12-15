import type { StrategySignal, StrategySignalGenerator } from './execution-engine';
import type { HistoricalBar } from './historical-data-service';

export type StrategyType = 'moving_average_crossover' | 'rsi_oscillator' | 'buy_and_hold';

export interface StrategyConfig {
  type: StrategyType;
  params: Record<string, number>;
}

interface SymbolState {
  prices: number[];
  position: 'none' | 'long';
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
    state.set(symbol, { prices: [], position: 'none', positionQty: 0 });
  }
  
  return {
    onBar(bar: HistoricalBar, barIndex: number, allBarsUpToNow: HistoricalBar[]): StrategySignal[] {
      const signals: StrategySignal[] = [];
      const symbol = bar.symbol;
      
      let symbolState = state.get(symbol);
      if (!symbolState) {
        symbolState = { prices: [], position: 'none', positionQty: 0 };
        state.set(symbol, symbolState);
      }
      
      symbolState.prices.push(bar.close);
      
      if (symbolState.prices.length < slowPeriod) return signals;
      
      const recentPrices = symbolState.prices.slice(-slowPeriod);
      const fastMA = recentPrices.slice(-fastPeriod).reduce((a, b) => a + b, 0) / fastPeriod;
      const slowMA = recentPrices.reduce((a, b) => a + b, 0) / slowPeriod;
      
      if (symbolState.prices.length > slowPeriod) {
        const prevPrices = symbolState.prices.slice(-slowPeriod - 1, -1);
        const prevFastMA = prevPrices.slice(-fastPeriod).reduce((a, b) => a + b, 0) / fastPeriod;
        const prevSlowMA = prevPrices.reduce((a, b) => a + b, 0) / slowPeriod;
        
        if (prevFastMA <= prevSlowMA && fastMA > slowMA && symbolState.position === 'none') {
          const allocationAmount = initialCash * (allocationPct / 100);
          const qty = Math.floor(allocationAmount / bar.close);
          
          if (qty > 0) {
            signals.push({
              symbol,
              side: 'buy',
              qty,
              reason: `Bullish crossover: Fast MA (${fastMA.toFixed(2)}) crossed above Slow MA (${slowMA.toFixed(2)})`
            });
            symbolState.position = 'long';
            symbolState.positionQty = qty;
          }
        } else if (prevFastMA >= prevSlowMA && fastMA < slowMA && symbolState.position === 'long') {
          signals.push({
            symbol,
            side: 'sell',
            qty: symbolState.positionQty,
            reason: `Bearish crossover: Fast MA (${fastMA.toFixed(2)}) crossed below Slow MA (${slowMA.toFixed(2)})`
          });
          symbolState.position = 'none';
          symbolState.positionQty = 0;
        }
      }
      
      return signals;
    }
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
  const state: Map<string, SymbolState & { gains: number[], losses: number[] }> = new Map();
  
  for (const symbol of universe) {
    state.set(symbol, { prices: [], position: 'none', positionQty: 0, gains: [], losses: [] });
  }
  
  return {
    onBar(bar: HistoricalBar, barIndex: number, allBarsUpToNow: HistoricalBar[]): StrategySignal[] {
      const signals: StrategySignal[] = [];
      const symbol = bar.symbol;
      
      let symbolState = state.get(symbol);
      if (!symbolState) {
        symbolState = { prices: [], position: 'none', positionQty: 0, gains: [], losses: [] };
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
      const rsi = 100 - (100 / (1 + rs));
      
      if (rsi < oversoldThreshold && symbolState.position === 'none') {
        const allocationAmount = initialCash * (allocationPct / 100);
        const qty = Math.floor(allocationAmount / bar.close);
        
        if (qty > 0) {
          signals.push({
            symbol,
            side: 'buy',
            qty,
            reason: `RSI oversold: RSI (${rsi.toFixed(2)}) < ${oversoldThreshold}`
          });
          symbolState.position = 'long';
          symbolState.positionQty = qty;
        }
      } else if (rsi > overboughtThreshold && symbolState.position === 'long') {
        signals.push({
          symbol,
          side: 'sell',
          qty: symbolState.positionQty,
          reason: `RSI overbought: RSI (${rsi.toFixed(2)}) > ${overboughtThreshold}`
        });
        symbolState.position = 'none';
        symbolState.positionQty = 0;
      }
      
      return signals;
    }
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
    onBar(bar: HistoricalBar, barIndex: number, allBarsUpToNow: HistoricalBar[]): StrategySignal[] {
      const symbol = bar.symbol;
      
      if (!bought.has(symbol)) {
        const allocationAmount = initialCash * (allocationPct / 100);
        const qty = Math.floor(allocationAmount / bar.close);
        
        if (qty > 0) {
          bought.add(symbol);
          positionQty.set(symbol, qty);
          return [{
            symbol,
            side: 'buy',
            qty,
            reason: `Buy and hold: Initial purchase of ${symbol}`
          }];
        }
      }
      return [];
    }
  };
}

export function createStrategy(
  strategyConfig: StrategyConfig,
  universe: string[],
  initialCash: number
): StrategySignalGenerator {
  const { type, params } = strategyConfig;
  
  switch (type) {
    case 'moving_average_crossover':
      return createMovingAverageCrossoverStrategy(
        universe,
        initialCash,
        params.fastPeriod || 10,
        params.slowPeriod || 20,
        params.allocationPct || 10
      );
    case 'rsi_oscillator':
      return createRSIStrategy(
        universe,
        initialCash,
        params.period || 14,
        params.oversoldThreshold || 30,
        params.overboughtThreshold || 70,
        params.allocationPct || 10
      );
    case 'buy_and_hold':
    default:
      return createBuyAndHoldStrategy(universe, initialCash, params.allocationPct || 10);
  }
}
