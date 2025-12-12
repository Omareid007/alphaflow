/**
 * AI Active Trader - Trading Engine Types
 * Type definitions for order execution and position management
 */

export type OrderSide = 'buy' | 'sell';
export type PositionSide = 'long' | 'short';
export type OrderType = 'market' | 'limit';
export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok';

export enum OrderStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  FILLED = 'filled',
  PARTIALLY_FILLED = 'partially_filled',
  CANCELED = 'canceled',
  FAILED = 'failed',
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  quantity: number;
  orderType: OrderType;
  limitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeInForce?: TimeInForce;
  decisionId?: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  filledQuantity?: number;
  filledPrice?: number;
  status: OrderStatus;
}

export interface Order {
  orderId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  orderType: OrderType;
  limitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeInForce: TimeInForce;
  status: OrderStatus;
  filledQuantity: number;
  filledPrice?: number;
  decisionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  positionId: string;
  symbol: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  currentPrice?: number;
  unrealizedPnl?: number;
  openedAt: string;
  updatedAt: string;
}

export interface RiskLimits {
  maxPositionSizePercent: number;
  maxTotalExposurePercent: number;
  maxPositionsCount: number;
  dailyLossLimitPercent: number;
}

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface PortfolioSnapshot {
  totalEquity: number;
  cashBalance: number;
  positionsValue: number;
  dailyPnl: number;
}
