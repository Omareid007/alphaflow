/**
 * AI Active Trader - Analytics Engine
 * Core calculation logic for P&L, equity curves, and trade metrics
 */

import {
  PnLSummary,
  EquityPoint,
  TradeMetrics,
  PositionSummary,
  StoredTrade,
  StoredPosition,
  ClosedPosition,
  AnalyticsState,
} from './types';

const DEFAULT_CASH_BALANCE = 100000;

export class AnalyticsEngine {
  private state: AnalyticsState;

  constructor(initialCashBalance: number = DEFAULT_CASH_BALANCE) {
    this.state = {
      trades: [],
      openPositions: new Map(),
      closedPositions: [],
      equityCurve: [],
      cashBalance: initialCashBalance,
      lastUpdated: new Date().toISOString(),
    };

    this.recordEquityPoint();
  }

  recordTrade(trade: StoredTrade): void {
    this.state.trades.push(trade);
    this.state.lastUpdated = new Date().toISOString();
  }

  openPosition(position: StoredPosition): void {
    this.state.openPositions.set(position.positionId, position);
    this.state.lastUpdated = new Date().toISOString();
    this.recordEquityPoint();
  }

  updatePosition(positionId: string, currentPrice: number): void {
    const position = this.state.openPositions.get(positionId);
    if (position) {
      position.currentPrice = currentPrice;
      position.updatedAt = new Date().toISOString();
      this.state.lastUpdated = new Date().toISOString();
    }
  }

  closePosition(
    positionId: string,
    exitPrice: number,
    realizedPnl: number,
    closedAt: string
  ): void {
    const position = this.state.openPositions.get(positionId);
    if (position) {
      const closedPosition: ClosedPosition = {
        positionId: position.positionId,
        symbol: position.symbol,
        side: position.side,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        exitPrice,
        realizedPnl,
        openedAt: position.openedAt,
        closedAt,
        holdTimeMs: new Date(closedAt).getTime() - new Date(position.openedAt).getTime(),
      };
      
      this.state.closedPositions.push(closedPosition);
      this.state.openPositions.delete(positionId);
      this.state.cashBalance += realizedPnl;
      this.state.lastUpdated = new Date().toISOString();
      this.recordEquityPoint();
    }
  }

  setCashBalance(balance: number): void {
    this.state.cashBalance = balance;
    this.recordEquityPoint();
  }

  recordEquityPoint(): void {
    const positionsValue = this.calculatePositionsValue();
    const point: EquityPoint = {
      timestamp: new Date().toISOString(),
      equity: this.state.cashBalance + positionsValue,
      cashBalance: this.state.cashBalance,
      positionsValue,
    };
    
    this.state.equityCurve.push(point);
    
    if (this.state.equityCurve.length > 10000) {
      this.state.equityCurve = this.state.equityCurve.slice(-5000);
    }
  }

  private calculatePositionsValue(): number {
    let value = 0;
    for (const position of this.state.openPositions.values()) {
      value += position.quantity * position.currentPrice;
    }
    return value;
  }

  calculatePnL(): PnLSummary {
    const realizedPnl = this.state.closedPositions.reduce(
      (sum, p) => sum + p.realizedPnl,
      0
    );

    let unrealizedPnl = 0;
    for (const position of this.state.openPositions.values()) {
      const pnl = (position.currentPrice - position.entryPrice) * position.quantity;
      unrealizedPnl += position.side === 'buy' ? pnl : -pnl;
    }

    const totalPnl = realizedPnl + unrealizedPnl;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayPositions = this.state.closedPositions.filter(
      (p) => new Date(p.closedAt) >= todayStart
    );
    const dailyPnl = todayPositions.reduce((sum, p) => sum + p.realizedPnl, 0);

    const winningTrades = this.state.closedPositions.filter(
      (p) => p.realizedPnl > 0
    ).length;
    const totalTrades = this.state.closedPositions.length;
    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

    return {
      realizedPnl,
      unrealizedPnl,
      totalPnl,
      dailyPnl,
      winRate,
      totalTrades,
      calculatedAt: new Date().toISOString(),
    };
  }

  calculateEquityCurve(limit?: number): EquityPoint[] {
    if (limit && limit > 0) {
      return this.state.equityCurve.slice(-limit);
    }
    return [...this.state.equityCurve];
  }

  calculateMetrics(): TradeMetrics {
    const closed = this.state.closedPositions;
    const totalTrades = closed.length;

    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        largestWin: 0,
        largestLoss: 0,
        avgHoldTime: 0,
        calculatedAt: new Date().toISOString(),
      };
    }

    const winners = closed.filter((p) => p.realizedPnl > 0);
    const losers = closed.filter((p) => p.realizedPnl < 0);

    const winningTrades = winners.length;
    const losingTrades = losers.length;

    const totalWins = winners.reduce((sum, p) => sum + p.realizedPnl, 0);
    const totalLosses = Math.abs(losers.reduce((sum, p) => sum + p.realizedPnl, 0));

    const avgWin = winningTrades > 0 ? totalWins / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? totalLosses / losingTrades : 0;

    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    const largestWin = winners.length > 0
      ? Math.max(...winners.map((p) => p.realizedPnl))
      : 0;
    const largestLoss = losers.length > 0
      ? Math.min(...losers.map((p) => p.realizedPnl))
      : 0;

    const totalHoldTime = closed.reduce((sum, p) => sum + p.holdTimeMs, 0);
    const avgHoldTime = totalHoldTime / totalTrades;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      avgWin,
      avgLoss,
      profitFactor,
      largestWin,
      largestLoss,
      avgHoldTime,
      calculatedAt: new Date().toISOString(),
    };
  }

  getPositionSummaries(): PositionSummary[] {
    const summaries: PositionSummary[] = [];
    
    for (const position of this.state.openPositions.values()) {
      const pnl = (position.currentPrice - position.entryPrice) * position.quantity;
      const unrealizedPnl = position.side === 'buy' ? pnl : -pnl;
      const pnlPercent = position.entryPrice > 0
        ? ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100
        : 0;

      summaries.push({
        positionId: position.positionId,
        symbol: position.symbol,
        side: position.side,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice,
        unrealizedPnl,
        pnlPercent: position.side === 'buy' ? pnlPercent : -pnlPercent,
        openedAt: position.openedAt,
      });
    }

    return summaries;
  }

  getState(): Readonly<AnalyticsState> {
    return {
      ...this.state,
      openPositions: new Map(this.state.openPositions),
    };
  }

  reset(initialCashBalance: number = DEFAULT_CASH_BALANCE): void {
    this.state = {
      trades: [],
      openPositions: new Map(),
      closedPositions: [],
      equityCurve: [],
      cashBalance: initialCashBalance,
      lastUpdated: new Date().toISOString(),
    };
    this.recordEquityPoint();
  }
}

export const analyticsEngine = new AnalyticsEngine();
