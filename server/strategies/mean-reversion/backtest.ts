/**
 * Mean Reversion Backtest Engine
 *
 * Runs historical simulation of the mean reversion strategy
 */

import {
  MeanReversionConfig,
  PriceBar,
  Signal,
  Position,
  generateSignal,
  calculateBollingerBands,
  calculatePositionSize,
  calculateExitLevels,
} from "./algorithm";

export interface BacktestConfig extends MeanReversionConfig {
  startDate: string;
  endDate: string;
  initialCapital: number;
}

export interface Trade {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  holdingDays: number;
  exitReason: string;
}

export interface BacktestResult {
  // Summary metrics
  totalReturn: number;
  totalReturnPercent: number;
  cagr: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgTradeReturn: number;
  avgHoldingDays: number;

  // Time series
  equityCurve: { date: string; equity: number }[];
  drawdownCurve: { date: string; drawdown: number }[];

  // Trade details
  trades: Trade[];

  // Risk metrics
  volatility: number;
  sortinoRatio: number;
  calmarRatio: number;
}

/**
 * Get positions value at a specific date
 */
function getPositionsValue(
  positions: Map<string, Position>,
  priceData: Map<string, PriceBar[]>,
  date: string
): number {
  let value = 0;

  positions.forEach((position, symbol) => {
    const bars = priceData.get(symbol);
    if (!bars) return;

    const bar = bars.find((b) => b.date === date) || bars[bars.length - 1];
    if (bar) {
      value += position.quantity * bar.close;
    }
  });

  return value;
}

/**
 * Run backtest simulation
 */
export async function runBacktest(
  config: BacktestConfig,
  priceData: Map<string, PriceBar[]>
): Promise<BacktestResult> {
  let cash = config.initialCapital;
  const positions: Map<string, Position> = new Map();
  const trades: Trade[] = [];
  const equityCurve: { date: string; equity: number }[] = [];

  // Get all unique dates from price data
  const allDates = new Set<string>();
  priceData.forEach((bars) => {
    bars.forEach((bar) => allDates.add(bar.date));
  });

  const sortedDates = Array.from(allDates).sort();
  const filteredDates = sortedDates.filter(
    (d) => d >= config.startDate && d <= config.endDate
  );

  let peakEquity = config.initialCapital;
  let maxDrawdown = 0;
  const dailyReturns: number[] = [];
  let previousEquity = config.initialCapital;

  // Simulate each trading day
  for (const date of filteredDates) {
    // Process each symbol
    for (const symbol of config.symbols) {
      const bars = priceData.get(symbol);
      if (!bars) continue;

      // Get price history up to current date
      const historicalBars = bars.filter((b) => b.date <= date);
      if (historicalBars.length < config.meanPeriod) continue;

      const priceHistory = historicalBars.map((b) => b.close);
      const currentBar = historicalBars[historicalBars.length - 1];
      const currentPrice = currentBar.close;

      // Get current position if any
      const currentPosition = positions.get(symbol);

      // Generate signal
      const signal = generateSignal(
        symbol,
        priceHistory,
        currentPrice,
        config,
        currentPosition
      );

      // Execute signal
      if (signal.action === "buy" && !currentPosition) {
        const quantity = calculatePositionSize(
          cash + getPositionsValue(positions, priceData, date),
          config.positionSizePercent,
          currentPrice,
          config.maxPositions,
          positions.size
        );

        if (quantity > 0) {
          const cost = quantity * currentPrice;
          if (cost <= cash) {
            const bands = calculateBollingerBands(
              priceHistory,
              config.meanPeriod,
              config.stdDevMultiple
            );
            const exits = calculateExitLevels(currentPrice, config, bands);

            positions.set(symbol, {
              symbol,
              entryPrice: currentPrice,
              entryDate: date,
              quantity,
              stopLoss: exits.stopLoss,
              takeProfit: exits.takeProfit,
            });

            cash -= cost;
          }
        }
      } else if (signal.action === "sell" && currentPosition) {
        const proceeds = currentPosition.quantity * currentPrice;
        const pnl =
          proceeds - currentPosition.quantity * currentPosition.entryPrice;
        const pnlPercent =
          (pnl / (currentPosition.quantity * currentPosition.entryPrice)) * 100;

        const entryDate = new Date(currentPosition.entryDate);
        const exitDate = new Date(date);
        const holdingDays = Math.ceil(
          (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        trades.push({
          symbol,
          entryDate: currentPosition.entryDate,
          entryPrice: currentPosition.entryPrice,
          exitDate: date,
          exitPrice: currentPrice,
          quantity: currentPosition.quantity,
          pnl,
          pnlPercent,
          holdingDays,
          exitReason: signal.reason,
        });

        cash += proceeds;
        positions.delete(symbol);
      }
    }

    // Calculate daily equity
    const positionsValue = getPositionsValue(positions, priceData, date);
    const totalEquity = cash + positionsValue;

    equityCurve.push({ date, equity: totalEquity });

    // Track drawdown
    peakEquity = Math.max(peakEquity, totalEquity);
    const drawdown = ((peakEquity - totalEquity) / peakEquity) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);

    // Track daily returns
    const dailyReturn = (totalEquity - previousEquity) / previousEquity;
    if (!isNaN(dailyReturn) && isFinite(dailyReturn)) {
      dailyReturns.push(dailyReturn);
    }
    previousEquity = totalEquity;
  }

  // Calculate final metrics
  const finalEquity =
    equityCurve[equityCurve.length - 1]?.equity || config.initialCapital;
  const totalReturn = finalEquity - config.initialCapital;
  const totalReturnPercent = (totalReturn / config.initialCapital) * 100;

  // Calculate CAGR
  const years = filteredDates.length / 252; // Trading days per year
  const cagr =
    years > 0
      ? (Math.pow(finalEquity / config.initialCapital, 1 / years) - 1) * 100
      : 0;

  // Calculate Sharpe Ratio (assuming 0% risk-free rate)
  const avgDailyReturn =
    dailyReturns.length > 0
      ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
      : 0;
  const variance =
    dailyReturns.length > 0
      ? dailyReturns.reduce(
          (sum, r) => sum + Math.pow(r - avgDailyReturn, 2),
          0
        ) / dailyReturns.length
      : 0;
  const stdDailyReturn = Math.sqrt(variance);
  const sharpeRatio =
    stdDailyReturn > 0 ? (avgDailyReturn / stdDailyReturn) * Math.sqrt(252) : 0;

  // Calculate win rate and profit factor
  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl <= 0);
  const winRate =
    trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Calculate average metrics
  const avgTradeReturn =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + t.pnlPercent, 0) / trades.length
      : 0;
  const avgHoldingDays =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length
      : 0;

  // Generate drawdown curve
  const drawdownCurve = equityCurve.map((point, idx) => {
    const peak = Math.max(
      ...equityCurve.slice(0, idx + 1).map((p) => p.equity)
    );
    const dd = ((peak - point.equity) / peak) * 100;
    return { date: point.date, drawdown: dd };
  });

  return {
    totalReturn,
    totalReturnPercent,
    cagr,
    sharpeRatio,
    maxDrawdown,
    maxDrawdownPercent: maxDrawdown,
    winRate,
    profitFactor,
    totalTrades: trades.length,
    avgTradeReturn,
    avgHoldingDays,
    equityCurve,
    drawdownCurve,
    trades,
    volatility: stdDailyReturn * Math.sqrt(252) * 100,
    sortinoRatio: 0, // TODO: Calculate downside deviation
    calmarRatio: maxDrawdown > 0 ? cagr / maxDrawdown : 0,
  };
}

export default { runBacktest };
