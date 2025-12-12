/**
 * AI Active Trader - Analytics Service Types
 * Type definitions for P&L, equity curves, metrics, and positions
 */

export interface PnLSummary {
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  dailyPnl: number;
  winRate: number;
  totalTrades: number;
  calculatedAt: string;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  cashBalance: number;
  positionsValue: number;
}

export interface TradeMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  avgHoldTime: number;
  calculatedAt: string;
}

export interface PositionSummary {
  positionId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  pnlPercent: number;
  openedAt: string;
}

export interface StoredTrade {
  tradeId: string;
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  pnl: number | null;
  filledAt: string;
}

export interface StoredPosition {
  positionId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  openedAt: string;
  updatedAt: string;
}

export interface ClosedPosition {
  positionId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
  openedAt: string;
  closedAt: string;
  holdTimeMs: number;
}

export interface AnalyticsState {
  trades: StoredTrade[];
  openPositions: Map<string, StoredPosition>;
  closedPositions: ClosedPosition[];
  equityCurve: EquityPoint[];
  cashBalance: number;
  lastUpdated: string;
}
