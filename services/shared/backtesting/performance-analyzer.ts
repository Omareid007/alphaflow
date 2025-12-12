/**
 * AI Active Trader - Performance Analyzer
 * Comprehensive backtesting metrics and analysis
 */

import { createLogger } from '../common';

const logger = createLogger('backtesting-performance-analyzer');

/**
 * Individual trade record
 */
export interface TradeRecord {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryDate: Date;
  entryPrice: number;
  entryQuantity: number;
  exitDate?: Date;
  exitPrice?: number;
  exitQuantity?: number;
  pnl?: number;
  pnlPercent?: number;
  commission: number;
  slippage: number;
  holdingPeriodDays?: number;
  mae?: number;
  mfe?: number;
  tags?: string[];
}

/**
 * Equity curve point
 */
export interface EquityPoint {
  timestamp: Date;
  equity: number;
  cash: number;
  positionsValue: number;
  drawdown: number;
  drawdownPercent: number;
  returns: number;
  cumulativeReturns: number;
}

/**
 * Drawdown period
 */
export interface DrawdownPeriod {
  startDate: Date;
  endDate?: Date;
  recoveryDate?: Date;
  peakEquity: number;
  troughEquity: number;
  drawdownPercent: number;
  durationDays: number;
  recoveryDays?: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  cagr: number;

  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  informationRatio?: number;

  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageDrawdown: number;
  maxDrawdownDuration: number;
  averageDrawdownDuration: number;

  volatility: number;
  annualizedVolatility: number;
  downsideDeviation: number;
  skewness: number;
  kurtosis: number;

  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  payoffRatio: number;

  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  averageHoldingPeriod: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;

  riskFreeRate: number;
  tradingDays: number;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalEquity: number;
}

/**
 * Trade analysis breakdown
 */
export interface TradeAnalysis {
  bySymbol: Map<string, {
    trades: number;
    winRate: number;
    totalPnl: number;
    avgPnl: number;
  }>;
  bySide: {
    long: { trades: number; winRate: number; totalPnl: number };
    short: { trades: number; winRate: number; totalPnl: number };
  };
  byMonth: Map<string, {
    trades: number;
    pnl: number;
    winRate: number;
  }>;
  byDayOfWeek: Map<number, {
    trades: number;
    pnl: number;
    winRate: number;
  }>;
}

/**
 * PerformanceAnalyzer class
 * Calculates comprehensive backtesting metrics
 */
export class PerformanceAnalyzer {
  private equityCurve: EquityPoint[];
  private trades: TradeRecord[];
  private riskFreeRate: number;
  private tradingDaysPerYear: number;

  /**
   * Create a new PerformanceAnalyzer
   * @param riskFreeRate - Annual risk-free rate (default 0.05 = 5%)
   * @param tradingDaysPerYear - Trading days per year (default 252)
   */
  constructor(riskFreeRate: number = 0.05, tradingDaysPerYear: number = 252) {
    this.equityCurve = [];
    this.trades = [];
    this.riskFreeRate = riskFreeRate;
    this.tradingDaysPerYear = tradingDaysPerYear;
  }

  /**
   * Add equity point to the curve
   */
  addEquityPoint(point: Omit<EquityPoint, 'drawdown' | 'drawdownPercent' | 'returns' | 'cumulativeReturns'>): void {
    const prevPoint = this.equityCurve[this.equityCurve.length - 1];
    const peak = prevPoint 
      ? Math.max(prevPoint.equity - prevPoint.drawdown, point.equity)
      : point.equity;

    const drawdown = peak - point.equity;
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

    const returns = prevPoint 
      ? (point.equity - prevPoint.equity) / prevPoint.equity
      : 0;

    const cumulativeReturns = prevPoint
      ? ((1 + prevPoint.cumulativeReturns) * (1 + returns)) - 1
      : returns;

    this.equityCurve.push({
      ...point,
      drawdown,
      drawdownPercent,
      returns,
      cumulativeReturns,
    });
  }

  /**
   * Add a completed trade
   */
  addTrade(trade: TradeRecord): void {
    this.trades.push(trade);
  }

  /**
   * Calculate all performance metrics
   */
  analyze(initialCapital: number): PerformanceMetrics {
    if (this.equityCurve.length === 0) {
      throw new Error('No equity data to analyze');
    }

    const returns = this.equityCurve.map(p => p.returns).filter(r => !isNaN(r));
    const equityValues = this.equityCurve.map(p => p.equity);

    const startDate = this.equityCurve[0].timestamp;
    const endDate = this.equityCurve[this.equityCurve.length - 1].timestamp;
    const tradingDays = this.equityCurve.length;
    const years = tradingDays / this.tradingDaysPerYear;

    const finalEquity = equityValues[equityValues.length - 1];
    const totalReturn = finalEquity - initialCapital;
    const totalReturnPercent = (totalReturn / initialCapital) * 100;

    const cagr = years > 0
      ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100
      : 0;
    const annualizedReturn = cagr;

    const volatility = this.calculateStdDev(returns);
    const annualizedVolatility = volatility * Math.sqrt(this.tradingDaysPerYear) * 100;

    const sharpeRatio = this.calculateSharpe(returns);
    const sortinoRatio = this.calculateSortino(returns);

    const drawdownPeriods = this.identifyDrawdownPeriods();
    const maxDrawdown = Math.max(...this.equityCurve.map(p => p.drawdown), 0);
    const maxDrawdownPercent = Math.max(...this.equityCurve.map(p => p.drawdownPercent), 0);
    const avgDrawdown = drawdownPeriods.length > 0
      ? drawdownPeriods.reduce((sum, d) => sum + d.drawdownPercent, 0) / drawdownPeriods.length
      : 0;
    const maxDrawdownDuration = drawdownPeriods.length > 0
      ? Math.max(...drawdownPeriods.map(d => d.durationDays))
      : 0;
    const avgDrawdownDuration = drawdownPeriods.length > 0
      ? drawdownPeriods.reduce((sum, d) => sum + d.durationDays, 0) / drawdownPeriods.length
      : 0;

    const calmarRatio = maxDrawdownPercent > 0
      ? cagr / maxDrawdownPercent
      : 0;

    const downsideDeviation = this.calculateDownsideDeviation(returns);
    const skewness = this.calculateSkewness(returns);
    const kurtosis = this.calculateKurtosis(returns);

    const completedTrades = this.trades.filter(t => t.exitDate !== undefined);
    const totalTrades = completedTrades.length;
    const winningTrades = completedTrades.filter(t => (t.pnl || 0) > 0).length;
    const losingTrades = completedTrades.filter(t => (t.pnl || 0) < 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const grossProfit = completedTrades
      .filter(t => (t.pnl || 0) > 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(completedTrades
      .filter(t => (t.pnl || 0) < 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const avgWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
    const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

    const expectancy = totalTrades > 0
      ? (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss)
      : 0;

    const largestWin = Math.max(...completedTrades.map(t => t.pnl || 0), 0);
    const largestLoss = Math.min(...completedTrades.map(t => t.pnl || 0), 0);

    const holdingPeriods = completedTrades
      .filter(t => t.holdingPeriodDays !== undefined)
      .map(t => t.holdingPeriodDays!);
    const averageHoldingPeriod = holdingPeriods.length > 0
      ? holdingPeriods.reduce((sum, d) => sum + d, 0) / holdingPeriods.length
      : 0;

    const { maxConsecutiveWins, maxConsecutiveLosses } = this.calculateStreaks(completedTrades);

    return {
      totalReturn,
      totalReturnPercent,
      annualizedReturn,
      cagr,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDrawdown,
      maxDrawdownPercent,
      averageDrawdown: avgDrawdown,
      maxDrawdownDuration,
      averageDrawdownDuration: avgDrawdownDuration,
      volatility,
      annualizedVolatility,
      downsideDeviation,
      skewness,
      kurtosis,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      profitFactor,
      expectancy,
      payoffRatio,
      averageWin: avgWin,
      averageLoss: avgLoss,
      largestWin,
      largestLoss,
      averageHoldingPeriod,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      riskFreeRate: this.riskFreeRate,
      tradingDays,
      startDate,
      endDate,
      initialCapital,
      finalEquity,
    };
  }

  /**
   * Get detailed trade analysis
   */
  getTradeAnalysis(): TradeAnalysis {
    const completedTrades = this.trades.filter(t => t.exitDate !== undefined);

    const bySymbol = new Map<string, { trades: number; wins: number; totalPnl: number }>();
    for (const trade of completedTrades) {
      const existing = bySymbol.get(trade.symbol) || { trades: 0, wins: 0, totalPnl: 0 };
      existing.trades++;
      if ((trade.pnl || 0) > 0) existing.wins++;
      existing.totalPnl += trade.pnl || 0;
      bySymbol.set(trade.symbol, existing);
    }

    const bySymbolResult = new Map<string, { trades: number; winRate: number; totalPnl: number; avgPnl: number }>();
    for (const [symbol, data] of bySymbol) {
      bySymbolResult.set(symbol, {
        trades: data.trades,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
        totalPnl: data.totalPnl,
        avgPnl: data.trades > 0 ? data.totalPnl / data.trades : 0,
      });
    }

    const longTrades = completedTrades.filter(t => t.side === 'long');
    const shortTrades = completedTrades.filter(t => t.side === 'short');

    const bySide = {
      long: {
        trades: longTrades.length,
        winRate: longTrades.length > 0
          ? (longTrades.filter(t => (t.pnl || 0) > 0).length / longTrades.length) * 100
          : 0,
        totalPnl: longTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
      },
      short: {
        trades: shortTrades.length,
        winRate: shortTrades.length > 0
          ? (shortTrades.filter(t => (t.pnl || 0) > 0).length / shortTrades.length) * 100
          : 0,
        totalPnl: shortTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
      },
    };

    const byMonth = new Map<string, { trades: number; pnl: number; wins: number }>();
    for (const trade of completedTrades) {
      const monthKey = `${trade.entryDate.getFullYear()}-${String(trade.entryDate.getMonth() + 1).padStart(2, '0')}`;
      const existing = byMonth.get(monthKey) || { trades: 0, pnl: 0, wins: 0 };
      existing.trades++;
      existing.pnl += trade.pnl || 0;
      if ((trade.pnl || 0) > 0) existing.wins++;
      byMonth.set(monthKey, existing);
    }

    const byMonthResult = new Map<string, { trades: number; pnl: number; winRate: number }>();
    for (const [month, data] of byMonth) {
      byMonthResult.set(month, {
        trades: data.trades,
        pnl: data.pnl,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      });
    }

    const byDayOfWeek = new Map<number, { trades: number; pnl: number; wins: number }>();
    for (const trade of completedTrades) {
      const dow = trade.entryDate.getDay();
      const existing = byDayOfWeek.get(dow) || { trades: 0, pnl: 0, wins: 0 };
      existing.trades++;
      existing.pnl += trade.pnl || 0;
      if ((trade.pnl || 0) > 0) existing.wins++;
      byDayOfWeek.set(dow, existing);
    }

    const byDayOfWeekResult = new Map<number, { trades: number; pnl: number; winRate: number }>();
    for (const [dow, data] of byDayOfWeek) {
      byDayOfWeekResult.set(dow, {
        trades: data.trades,
        pnl: data.pnl,
        winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      });
    }

    return {
      bySymbol: bySymbolResult,
      bySide,
      byMonth: byMonthResult,
      byDayOfWeek: byDayOfWeekResult,
    };
  }

  /**
   * Get equity curve data
   */
  getEquityCurve(): EquityPoint[] {
    return [...this.equityCurve];
  }

  /**
   * Get all trade records
   */
  getTrades(): TradeRecord[] {
    return [...this.trades];
  }

  /**
   * Get daily returns series
   */
  getDailyReturns(): { date: Date; return: number }[] {
    return this.equityCurve.map(p => ({
      date: p.timestamp,
      return: p.returns * 100,
    }));
  }

  /**
   * Get drawdown periods
   */
  getDrawdownPeriods(): DrawdownPeriod[] {
    return this.identifyDrawdownPeriods();
  }

  /**
   * Reset the analyzer
   */
  reset(): void {
    this.equityCurve = [];
    this.trades = [];
  }

  private calculateSharpe(returns: number[]): number {
    if (returns.length < 2) return 0;

    const dailyRiskFree = this.riskFreeRate / this.tradingDaysPerYear;
    const excessReturns = returns.map(r => r - dailyRiskFree);
    const avgExcess = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
    const stdDev = this.calculateStdDev(excessReturns);

    if (stdDev === 0) return 0;
    return (avgExcess / stdDev) * Math.sqrt(this.tradingDaysPerYear);
  }

  private calculateSortino(returns: number[]): number {
    if (returns.length < 2) return 0;

    const dailyRiskFree = this.riskFreeRate / this.tradingDaysPerYear;
    const excessReturns = returns.map(r => r - dailyRiskFree);
    const avgExcess = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
    const downsideDev = this.calculateDownsideDeviation(returns);

    if (downsideDev === 0) return 0;
    return (avgExcess / downsideDev) * Math.sqrt(this.tradingDaysPerYear);
  }

  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, d) => sum + d, 0) / (values.length - 1));
  }

  private calculateDownsideDeviation(returns: number[]): number {
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length < 2) return 0;
    
    const squaredNegative = negativeReturns.map(r => r * r);
    return Math.sqrt(squaredNegative.reduce((sum, r) => sum + r, 0) / negativeReturns.length);
  }

  private calculateSkewness(values: number[]): number {
    if (values.length < 3) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const stdDev = this.calculateStdDev(values);
    if (stdDev === 0) return 0;

    const n = values.length;
    const cubedDiffs = values.map(v => Math.pow((v - mean) / stdDev, 3));
    return (n / ((n - 1) * (n - 2))) * cubedDiffs.reduce((sum, d) => sum + d, 0);
  }

  private calculateKurtosis(values: number[]): number {
    if (values.length < 4) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const stdDev = this.calculateStdDev(values);
    if (stdDev === 0) return 0;

    const n = values.length;
    const fourthPowers = values.map(v => Math.pow((v - mean) / stdDev, 4));
    const sum4 = fourthPowers.reduce((sum, d) => sum + d, 0);

    const kurtosis = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum4;
    const excess = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    return kurtosis - excess;
  }

  private calculateStreaks(trades: TradeRecord[]): { maxConsecutiveWins: number; maxConsecutiveLosses: number } {
    let maxWins = 0;
    let maxLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const trade of trades) {
      if ((trade.pnl || 0) > 0) {
        currentWins++;
        currentLosses = 0;
        maxWins = Math.max(maxWins, currentWins);
      } else if ((trade.pnl || 0) < 0) {
        currentLosses++;
        currentWins = 0;
        maxLosses = Math.max(maxLosses, currentLosses);
      }
    }

    return { maxConsecutiveWins: maxWins, maxConsecutiveLosses: maxLosses };
  }

  private identifyDrawdownPeriods(): DrawdownPeriod[] {
    const periods: DrawdownPeriod[] = [];
    let inDrawdown = false;
    let currentPeriod: Partial<DrawdownPeriod> = {};
    let peak = 0;

    for (let i = 0; i < this.equityCurve.length; i++) {
      const point = this.equityCurve[i];

      if (!inDrawdown && point.drawdown > 0) {
        inDrawdown = true;
        peak = point.equity + point.drawdown;
        currentPeriod = {
          startDate: point.timestamp,
          peakEquity: peak,
          troughEquity: point.equity,
          drawdownPercent: point.drawdownPercent,
          durationDays: 1,
        };
      } else if (inDrawdown) {
        if (point.equity >= peak) {
          currentPeriod.endDate = this.equityCurve[i - 1]?.timestamp;
          currentPeriod.recoveryDate = point.timestamp;
          const startIdx = this.equityCurve.findIndex(
            p => p.timestamp.getTime() === currentPeriod.startDate?.getTime()
          );
          currentPeriod.recoveryDays = i - startIdx;
          
          periods.push(currentPeriod as DrawdownPeriod);
          inDrawdown = false;
          currentPeriod = {};
        } else {
          if (point.equity < (currentPeriod.troughEquity || Infinity)) {
            currentPeriod.troughEquity = point.equity;
            currentPeriod.drawdownPercent = point.drawdownPercent;
          }
          currentPeriod.durationDays = (currentPeriod.durationDays || 0) + 1;
        }
      }
    }

    if (inDrawdown && currentPeriod.startDate) {
      const lastPoint = this.equityCurve[this.equityCurve.length - 1];
      currentPeriod.endDate = lastPoint.timestamp;
      periods.push(currentPeriod as DrawdownPeriod);
    }

    return periods;
  }
}

/**
 * Format metrics as a summary string
 */
export function formatMetricsSummary(metrics: PerformanceMetrics): string {
  const lines = [
    '=== Performance Summary ===',
    `Period: ${metrics.startDate.toISOString().split('T')[0]} to ${metrics.endDate.toISOString().split('T')[0]}`,
    `Trading Days: ${metrics.tradingDays}`,
    '',
    '--- Returns ---',
    `Total Return: $${metrics.totalReturn.toFixed(2)} (${metrics.totalReturnPercent.toFixed(2)}%)`,
    `CAGR: ${metrics.cagr.toFixed(2)}%`,
    `Initial Capital: $${metrics.initialCapital.toFixed(2)}`,
    `Final Equity: $${metrics.finalEquity.toFixed(2)}`,
    '',
    '--- Risk Metrics ---',
    `Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`,
    `Sortino Ratio: ${metrics.sortinoRatio.toFixed(2)}`,
    `Calmar Ratio: ${metrics.calmarRatio.toFixed(2)}`,
    `Max Drawdown: ${metrics.maxDrawdownPercent.toFixed(2)}%`,
    `Annualized Volatility: ${metrics.annualizedVolatility.toFixed(2)}%`,
    '',
    '--- Trade Statistics ---',
    `Total Trades: ${metrics.totalTrades}`,
    `Win Rate: ${metrics.winRate.toFixed(1)}%`,
    `Profit Factor: ${metrics.profitFactor.toFixed(2)}`,
    `Expectancy: $${metrics.expectancy.toFixed(2)}`,
    `Avg Win: $${metrics.averageWin.toFixed(2)}`,
    `Avg Loss: $${metrics.averageLoss.toFixed(2)}`,
    `Largest Win: $${metrics.largestWin.toFixed(2)}`,
    `Largest Loss: $${metrics.largestLoss.toFixed(2)}`,
  ];

  return lines.join('\n');
}
