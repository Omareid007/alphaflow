import type { HistoricalBar } from "./historical-data-service";
import type {
  FeesModel,
  SlippageModel,
  ExecutionPriceRule,
  BacktestTradeEvent,
  BacktestEquityPoint,
  BacktestResultsSummary,
} from "../../../shared/types/backtesting";

export interface StrategySignal {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  reason: string;
}

export interface StrategySignalGenerator {
  onBar(bar: HistoricalBar, barIndex: number, allBarsUpToNow: HistoricalBar[]): StrategySignal[];
}

export interface SimulationResult {
  trades: BacktestTradeEvent[];
  equityCurve: BacktestEquityPoint[];
  metrics: BacktestResultsSummary;
}

export interface SimulationConfig {
  runId: string;
  initialCash: number;
  feesModel: FeesModel;
  slippageModel: SlippageModel;
  executionPriceRule: ExecutionPriceRule;
}

interface Position {
  qty: number;
  avgPrice: number;
}

interface PendingSignal {
  signal: StrategySignal;
  signalBarIndex: number;
}

interface PendingSignalsPerSymbol {
  [symbol: string]: PendingSignal[];
}

function calculateSlippage(price: number, model: SlippageModel, side: "buy" | "sell"): number {
  const direction = side === "buy" ? 1 : -1;

  if (model.type === "bps") {
    return price * (model.value / 10000) * direction;
  } else if (model.type === "spread_proxy") {
    const estimatedSpread = price * 0.001;
    return estimatedSpread * model.value * direction;
  }
  return 0;
}

function calculateFees(notional: number, model: FeesModel): number {
  if (model.type === "fixed") {
    return model.value;
  } else if (model.type === "percentage") {
    return notional * (model.value / 100);
  }
  return 0;
}

function getExecutionPrice(
  bar: HistoricalBar,
  rule: ExecutionPriceRule,
  slippageModel: SlippageModel,
  side: "buy" | "sell"
): number {
  const basePrice = rule === "NEXT_OPEN" ? bar.open : bar.close;
  const slippage = calculateSlippage(basePrice, slippageModel, side);
  return basePrice + slippage;
}

function calculateEquity(
  cash: number,
  positions: Record<string, Position>,
  prices: Record<string, number>
): number {
  let equity = cash;
  for (const [symbol, position] of Object.entries(positions)) {
    const price = prices[symbol] || position.avgPrice;
    equity += position.qty * price;
  }
  return equity;
}

function calculateExposure(
  positions: Record<string, Position>,
  prices: Record<string, number>
): number {
  let totalValue = 0;
  for (const [symbol, position] of Object.entries(positions)) {
    const price = prices[symbol] || position.avgPrice;
    totalValue += Math.abs(position.qty * price);
  }
  return totalValue;
}

function mergeAndSortBars(bars: Record<string, HistoricalBar[]>): { symbol: string; bar: HistoricalBar; symbolBarIndex: number }[] {
  const allEntries: { symbol: string; bar: HistoricalBar; symbolBarIndex: number; time: number }[] = [];

  for (const [symbol, symbolBars] of Object.entries(bars)) {
    symbolBars.forEach((bar, index) => {
      allEntries.push({
        symbol,
        bar,
        symbolBarIndex: index,
        time: new Date(bar.ts).getTime(),
      });
    });
  }

  allEntries.sort((a, b) => a.time - b.time);

  return allEntries.map(({ symbol, bar, symbolBarIndex }) => ({ symbol, bar, symbolBarIndex }));
}

export function runSimulation(
  bars: Record<string, HistoricalBar[]>,
  signalGenerator: StrategySignalGenerator,
  config: SimulationConfig
): SimulationResult {
  const { runId, initialCash, feesModel, slippageModel, executionPriceRule } = config;

  const positions: Record<string, Position> = {};
  let cash = initialCash;
  const trades: BacktestTradeEvent[] = [];
  const equityCurve: BacktestEquityPoint[] = [];
  const tradePnLs: number[] = [];
  const equityHistory: number[] = [];

  const pendingSignals: PendingSignalsPerSymbol = {};
  const processedBarsBySymbol: Record<string, HistoricalBar[]> = {};
  const lastProcessedBarIndex: Record<string, number> = {};
  const currentPrices: Record<string, number> = {};

  for (const symbol of Object.keys(bars)) {
    pendingSignals[symbol] = [];
    processedBarsBySymbol[symbol] = [];
    lastProcessedBarIndex[symbol] = -1;
  }

  const sortedBars = mergeAndSortBars(bars);

  for (const { symbol, bar, symbolBarIndex } of sortedBars) {
    currentPrices[symbol] = bar.close;

    const symbolPendingSignals = pendingSignals[symbol] || [];
    const signalsToExecute: PendingSignal[] = [];
    const signalsToKeep: PendingSignal[] = [];

    for (const ps of symbolPendingSignals) {
      if (ps.signal.symbol === symbol && ps.signalBarIndex < symbolBarIndex) {
        signalsToExecute.push(ps);
      } else {
        signalsToKeep.push(ps);
      }
    }
    pendingSignals[symbol] = signalsToKeep;

    for (const { signal } of signalsToExecute) {
      const executionPrice = getExecutionPrice(bar, executionPriceRule, slippageModel, signal.side);
      const slippageAmount = calculateSlippage(
        executionPriceRule === "NEXT_OPEN" ? bar.open : bar.close,
        slippageModel,
        signal.side
      );
      const notional = signal.qty * executionPrice;
      const fees = calculateFees(notional, feesModel);

      const currentPosition = positions[symbol] || { qty: 0, avgPrice: 0 };
      let pnl = 0;

      if (signal.side === "buy") {
        const totalCost = notional + fees;
        if (cash >= totalCost) {
          cash -= totalCost;
          const newQty = currentPosition.qty + signal.qty;
          const newAvgPrice =
            currentPosition.qty > 0
              ? (currentPosition.avgPrice * currentPosition.qty + executionPrice * signal.qty) / newQty
              : executionPrice;
          positions[symbol] = { qty: newQty, avgPrice: newAvgPrice };
        } else {
          continue;
        }
      } else {
        const sellQty = Math.min(signal.qty, currentPosition.qty);
        if (sellQty > 0) {
          const proceeds = sellQty * executionPrice - fees;
          pnl = (executionPrice - currentPosition.avgPrice) * sellQty - fees;
          cash += proceeds;
          tradePnLs.push(pnl);

          const remainingQty = currentPosition.qty - sellQty;
          if (remainingQty > 0) {
            positions[symbol] = { qty: remainingQty, avgPrice: currentPosition.avgPrice };
          } else {
            delete positions[symbol];
          }
        } else {
          continue;
        }
      }

      const tradeEvent: BacktestTradeEvent = {
        id: `${runId}-${trades.length}`,
        runId,
        ts: bar.ts,
        symbol,
        side: signal.side,
        qty: signal.qty,
        price: executionPrice,
        reason: signal.reason,
        orderType: "market",
        fees,
        slippage: Math.abs(slippageAmount),
        positionAfter: positions[symbol]?.qty || 0,
        cashAfter: cash,
      };
      trades.push(tradeEvent);
    }

    processedBarsBySymbol[symbol].push(bar);
    lastProcessedBarIndex[symbol] = symbolBarIndex;

    const newSignals = signalGenerator.onBar(bar, symbolBarIndex, [...processedBarsBySymbol[symbol]]);

    for (const signal of newSignals) {
      const targetSymbol = signal.symbol;
      if (targetSymbol === symbol) {
        pendingSignals[targetSymbol] = pendingSignals[targetSymbol] || [];
        pendingSignals[targetSymbol].push({ signal, signalBarIndex: symbolBarIndex });
      }
    }

    const equity = calculateEquity(cash, positions, currentPrices);
    const exposure = calculateExposure(positions, currentPrices);
    equityHistory.push(equity);

    equityCurve.push({
      runId,
      ts: bar.ts,
      equity,
      cash,
      exposure,
    });
  }

  const metrics = calculateMetrics(initialCash, equityHistory, tradePnLs);

  return { trades, equityCurve, metrics };
}

function calculateMetrics(
  initialCash: number,
  equityHistory: number[],
  tradePnLs: number[]
): BacktestResultsSummary {
  if (equityHistory.length === 0) {
    return {
      cagr: null,
      totalReturnPct: 0,
      maxDrawdownPct: 0,
      sharpeRatio: null,
      sortinoRatio: null,
      winRatePct: 0,
      totalTrades: 0,
      profitFactor: null,
      avgWinPct: 0,
      avgLossPct: 0,
    };
  }

  const finalEquity = equityHistory[equityHistory.length - 1];

  if (!Number.isFinite(finalEquity) || initialCash <= 0) {
    return {
      cagr: null,
      totalReturnPct: 0,
      maxDrawdownPct: 0,
      sharpeRatio: null,
      sortinoRatio: null,
      winRatePct: 0,
      totalTrades: tradePnLs.length,
      profitFactor: null,
      avgWinPct: 0,
      avgLossPct: 0,
    };
  }

  const totalReturnPct = ((finalEquity - initialCash) / initialCash) * 100;

  let maxDrawdownPct = 0;
  let peak = initialCash;
  for (const equity of equityHistory) {
    if (equity > peak) {
      peak = equity;
    }
    if (peak > 0) {
      const drawdown = ((peak - equity) / peak) * 100;
      if (drawdown > maxDrawdownPct) {
        maxDrawdownPct = drawdown;
      }
    }
  }

  const returns: number[] = [];
  for (let i = 1; i < equityHistory.length; i++) {
    const prevEquity = equityHistory[i - 1];
    if (prevEquity > 0 && Number.isFinite(prevEquity)) {
      const ret = (equityHistory[i] - prevEquity) / prevEquity;
      if (Number.isFinite(ret)) {
        returns.push(ret);
      }
    }
  }

  let sharpeRatio: number | null = null;
  let sortinoRatio: number | null = null;

  if (returns.length > 1) {
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > 1e-10 && Number.isFinite(stdDev)) {
      const annualizedMean = meanReturn * 252;
      const annualizedStd = stdDev * Math.sqrt(252);
      if (annualizedStd > 0 && Number.isFinite(annualizedStd)) {
        sharpeRatio = annualizedMean / annualizedStd;
        if (!Number.isFinite(sharpeRatio)) {
          sharpeRatio = null;
        }
      }
    }

    const negativeReturns = returns.filter((r) => r < 0);
    if (negativeReturns.length > 0) {
      const downVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
      const downStdDev = Math.sqrt(downVariance);
      if (downStdDev > 1e-10 && Number.isFinite(downStdDev)) {
        const annualizedMean = meanReturn * 252;
        const annualizedDownStd = downStdDev * Math.sqrt(252);
        if (annualizedDownStd > 0 && Number.isFinite(annualizedDownStd)) {
          sortinoRatio = annualizedMean / annualizedDownStd;
          if (!Number.isFinite(sortinoRatio)) {
            sortinoRatio = null;
          }
        }
      }
    }
  }

  const totalTrades = tradePnLs.length;
  const winningTrades = tradePnLs.filter((pnl) => pnl > 0);
  const losingTrades = tradePnLs.filter((pnl) => pnl < 0);

  const winRatePct = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

  const grossProfit = winningTrades.reduce((sum, pnl) => sum + pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, pnl) => sum + pnl, 0));

  let profitFactor: number | null = null;
  if (grossLoss > 0) {
    profitFactor = grossProfit / grossLoss;
  } else if (grossProfit > 0) {
    profitFactor = null;
  } else {
    profitFactor = null;
  }
  if (profitFactor !== null && !Number.isFinite(profitFactor)) {
    profitFactor = null;
  }

  const avgWinPct =
    winningTrades.length > 0 && initialCash > 0
      ? (grossProfit / winningTrades.length / initialCash) * 100
      : 0;

  const avgLossPct =
    losingTrades.length > 0 && initialCash > 0
      ? (grossLoss / losingTrades.length / initialCash) * 100
      : 0;

  let cagr: number | null = null;
  if (equityHistory.length >= 252 && finalEquity > 0 && initialCash > 0) {
    const years = equityHistory.length / 252;
    const ratio = finalEquity / initialCash;
    if (ratio > 0 && years > 0) {
      cagr = (Math.pow(ratio, 1 / years) - 1) * 100;
      if (!Number.isFinite(cagr)) {
        cagr = null;
      }
    }
  }

  return {
    cagr,
    totalReturnPct: Number.isFinite(totalReturnPct) ? totalReturnPct : 0,
    maxDrawdownPct: Number.isFinite(maxDrawdownPct) ? maxDrawdownPct : 0,
    sharpeRatio,
    sortinoRatio,
    winRatePct: Number.isFinite(winRatePct) ? winRatePct : 0,
    totalTrades,
    profitFactor,
    avgWinPct: Number.isFinite(avgWinPct) ? avgWinPct : 0,
    avgLossPct: Number.isFinite(avgLossPct) ? avgLossPct : 0,
  };
}

export { calculateSlippage, calculateFees, calculateEquity };
