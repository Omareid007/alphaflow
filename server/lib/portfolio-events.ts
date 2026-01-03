/**
 * Portfolio Events - Real-Time Streaming Event Types
 *
 * @module server/lib/portfolio-events
 * @description Type definitions, schemas, and utilities for real-time portfolio WebSocket events.
 *
 * This module provides:
 * - TypeScript interfaces for all event types
 * - Zod schemas for runtime validation
 * - Event factory functions for consistent event creation
 * - Type guards for event discrimination
 *
 * Event Types:
 * - position_update: Position quantity/price/P&L changes
 * - order_update: Order status transitions
 * - account_update: Account balance/equity changes
 * - trade_executed: New trade completions
 * - batch: Aggregated events in 1-second window
 *
 * @see openspec/changes/realtime-portfolio-streaming/design.md
 */

import { z } from "zod";

// ============================================================================
// EVENT TYPE ENUMS
// ============================================================================

/**
 * Portfolio event types for WebSocket streaming
 */
export const portfolioEventTypes = [
  "position_update",
  "order_update",
  "account_update",
  "trade_executed",
  "batch",
  "error",
  "pong",
] as const;

export type PortfolioEventType = (typeof portfolioEventTypes)[number];

/**
 * WebSocket channel types for selective subscriptions
 */
export const channelTypes = [
  "positions",
  "orders",
  "account",
  "trades",
] as const;

export type ChannelType = (typeof channelTypes)[number];

/**
 * Client message types
 */
export const clientMessageTypes = ["subscribe", "unsubscribe", "ping"] as const;

export type ClientMessageType = (typeof clientMessageTypes)[number];

// ============================================================================
// EVENT DATA INTERFACES
// ============================================================================

/**
 * Position update event data
 *
 * Represents a position's current state including P&L calculations.
 * Sent when position quantity, price, or unrealized P&L changes.
 *
 * @property {string} symbol - Stock symbol (e.g., "AAPL")
 * @property {string} quantity - Current position size (numeric string for precision)
 * @property {string} currentPrice - Latest market price
 * @property {string} entryPrice - Average entry price
 * @property {string} unrealizedPnl - Unrealized profit/loss ($ amount)
 * @property {string} unrealizedPnlPercent - Unrealized P&L as percentage
 * @property {string} marketValue - Current market value (quantity * currentPrice)
 * @property {'long' | 'short'} side - Position direction
 * @property {string} [strategyId] - Associated strategy (optional)
 * @property {string} openedAt - ISO timestamp when position was opened
 */
export interface PositionUpdate {
  symbol: string;
  quantity: string;
  currentPrice: string;
  entryPrice: string;
  unrealizedPnl: string;
  unrealizedPnlPercent: string;
  marketValue: string;
  side: "long" | "short";
  strategyId?: string;
  openedAt: string;
}

/**
 * Order update event data
 *
 * Represents an order's current state and execution status.
 * Sent when order status transitions (new → filled, etc.).
 *
 * @property {string} orderId - Internal order ID (database)
 * @property {string} brokerOrderId - Broker's order ID (Alpaca)
 * @property {string} symbol - Stock symbol
 * @property {'buy' | 'sell'} side - Order direction
 * @property {string} type - Order type (market, limit, stop, etc.)
 * @property {string} status - Current order status
 * @property {string} [qty] - Order quantity (optional)
 * @property {string} [filledQty] - Filled quantity so far
 * @property {string} [filledAvgPrice] - Average fill price
 * @property {string} submittedAt - ISO timestamp when submitted
 * @property {string} [filledAt] - ISO timestamp when filled (if completed)
 */
export interface OrderUpdate {
  orderId: string;
  brokerOrderId: string;
  symbol: string;
  side: "buy" | "sell";
  type: string;
  status: string;
  qty?: string;
  filledQty?: string;
  filledAvgPrice?: string;
  submittedAt: string;
  filledAt?: string;
}

/**
 * Account update event data
 *
 * Represents the account's current financial state.
 * Sent when equity, buying power, or P&L changes.
 *
 * @property {string} equity - Total account equity
 * @property {string} buyingPower - Available buying power
 * @property {string} cash - Cash balance
 * @property {string} portfolioValue - Total portfolio value
 * @property {string} dayPnl - Day profit/loss ($ amount)
 * @property {string} dayPnlPercent - Day P&L as percentage
 * @property {string} timestamp - ISO timestamp of account snapshot
 */
export interface AccountUpdate {
  equity: string;
  buyingPower: string;
  cash: string;
  portfolioValue: string;
  dayPnl: string;
  dayPnlPercent: string;
  timestamp: string;
}

/**
 * Trade executed event data
 *
 * Represents a completed trade execution.
 * Sent when a new trade record is created in the database.
 *
 * @property {string} tradeId - Internal trade ID (database)
 * @property {string} symbol - Stock symbol
 * @property {'buy' | 'sell'} side - Trade direction
 * @property {string} quantity - Trade quantity
 * @property {string} price - Execution price
 * @property {string | null} pnl - Realized P&L (if closing position)
 * @property {string} executedAt - ISO timestamp of execution
 * @property {string} [strategyId] - Associated strategy (optional)
 */
export interface TradeExecuted {
  tradeId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: string;
  price: string;
  pnl: string | null;
  executedAt: string;
  strategyId?: string;
}

/**
 * Batch update event data
 *
 * Aggregates multiple events into a single message to reduce bandwidth.
 * Sent every 1 second if events occurred in that window.
 *
 * @property {PositionUpdate[]} [positions] - Position updates in this batch
 * @property {OrderUpdate[]} [orders] - Order updates in this batch
 * @property {AccountUpdate} [account] - Account update (max 1 per batch)
 * @property {TradeExecuted[]} [trades] - Trade executions in this batch
 */
export interface BatchUpdate {
  positions?: PositionUpdate[];
  orders?: OrderUpdate[];
  account?: AccountUpdate;
  trades?: TradeExecuted[];
}

/**
 * Error event data
 *
 * Sent when an error occurs on the server that the client should know about.
 *
 * @property {string} code - Error code (e.g., "SUBSCRIPTION_FAILED")
 * @property {string} message - Human-readable error message
 * @property {unknown} [details] - Additional error context (optional)
 */
export interface ErrorEvent {
  code: string;
  message: string;
  details?: unknown;
}

// ============================================================================
// MAIN EVENT INTERFACE
// ============================================================================

/**
 * Base portfolio event structure
 *
 * All WebSocket events sent from server to client follow this structure.
 *
 * @property {PortfolioEventType} type - Event type discriminator
 * @property {string} timestamp - ISO timestamp when event was created
 * @property {string} userId - User ID for event isolation
 * @property {EventData} data - Event-specific payload
 */
export interface PortfolioEvent {
  type: PortfolioEventType;
  timestamp: string;
  userId: string;
  data:
    | PositionUpdate
    | OrderUpdate
    | AccountUpdate
    | TradeExecuted
    | BatchUpdate
    | ErrorEvent
    | Record<string, never>; // pong has empty data
}

/**
 * Client message from browser to server
 *
 * Clients send these messages to control subscriptions and maintain connection.
 *
 * @property {ClientMessageType} type - Message type
 * @property {ChannelType[]} [channels] - Channels to subscribe/unsubscribe (optional)
 * @property {string[]} [symbols] - Specific symbols to filter (optional)
 */
export interface ClientMessage {
  type: ClientMessageType;
  channels?: ChannelType[];
  symbols?: string[];
}

// ============================================================================
// ZOD SCHEMAS FOR RUNTIME VALIDATION
// ============================================================================

/**
 * Zod schema for PositionUpdate validation
 */
export const positionUpdateSchema = z.object({
  symbol: z.string().min(1),
  quantity: z.string(),
  currentPrice: z.string(),
  entryPrice: z.string(),
  unrealizedPnl: z.string(),
  unrealizedPnlPercent: z.string(),
  marketValue: z.string(),
  side: z.enum(["long", "short"]),
  strategyId: z.string().optional(),
  openedAt: z.string(),
});

/**
 * Zod schema for OrderUpdate validation
 */
export const orderUpdateSchema = z.object({
  orderId: z.string(),
  brokerOrderId: z.string(),
  symbol: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  type: z.string(),
  status: z.string(),
  qty: z.string().optional(),
  filledQty: z.string().optional(),
  filledAvgPrice: z.string().optional(),
  submittedAt: z.string(),
  filledAt: z.string().optional(),
});

/**
 * Zod schema for AccountUpdate validation
 */
export const accountUpdateSchema = z.object({
  equity: z.string(),
  buyingPower: z.string(),
  cash: z.string(),
  portfolioValue: z.string(),
  dayPnl: z.string(),
  dayPnlPercent: z.string(),
  timestamp: z.string(),
});

/**
 * Zod schema for TradeExecuted validation
 */
export const tradeExecutedSchema = z.object({
  tradeId: z.string(),
  symbol: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  quantity: z.string(),
  price: z.string(),
  pnl: z.string().nullable(),
  executedAt: z.string(),
  strategyId: z.string().optional(),
});

/**
 * Zod schema for BatchUpdate validation
 */
export const batchUpdateSchema = z.object({
  positions: z.array(positionUpdateSchema).optional(),
  orders: z.array(orderUpdateSchema).optional(),
  account: accountUpdateSchema.optional(),
  trades: z.array(tradeExecutedSchema).optional(),
});

/**
 * Zod schema for ErrorEvent validation
 */
export const errorEventSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

/**
 * Zod schema for PortfolioEvent validation
 */
export const portfolioEventSchema = z.object({
  type: z.enum(portfolioEventTypes),
  timestamp: z.string(),
  userId: z.string(),
  data: z.union([
    positionUpdateSchema,
    orderUpdateSchema,
    accountUpdateSchema,
    tradeExecutedSchema,
    batchUpdateSchema,
    errorEventSchema,
    z.object({}), // pong has empty data
  ]),
});

/**
 * Zod schema for ClientMessage validation
 */
export const clientMessageSchema = z.object({
  type: z.enum(clientMessageTypes),
  channels: z.array(z.enum(channelTypes)).optional(),
  symbols: z.array(z.string()).optional(),
});

// ============================================================================
// EVENT FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a position update event
 *
 * @param userId - User ID for event isolation
 * @param position - Position data
 * @returns Validated PortfolioEvent
 *
 * @example
 * const event = createPositionUpdateEvent('user-123', {
 *   symbol: 'AAPL',
 *   quantity: '100',
 *   currentPrice: '175.50',
 *   entryPrice: '170.25',
 *   unrealizedPnl: '525.00',
 *   unrealizedPnlPercent: '3.08',
 *   marketValue: '17550.00',
 *   side: 'long',
 *   openedAt: new Date().toISOString()
 * });
 */
export function createPositionUpdateEvent(
  userId: string,
  position: PositionUpdate
): PortfolioEvent {
  const event: PortfolioEvent = {
    type: "position_update",
    timestamp: new Date().toISOString(),
    userId,
    data: position,
  };

  // Validate before returning
  portfolioEventSchema.parse(event);
  return event;
}

/**
 * Create an order update event
 *
 * @param userId - User ID for event isolation
 * @param order - Order data
 * @returns Validated PortfolioEvent
 *
 * @example
 * const event = createOrderUpdateEvent('user-123', {
 *   orderId: 'order-123',
 *   brokerOrderId: 'alpaca-456',
 *   symbol: 'TSLA',
 *   side: 'buy',
 *   type: 'limit',
 *   status: 'filled',
 *   qty: '50',
 *   filledQty: '50',
 *   filledAvgPrice: '245.75',
 *   submittedAt: new Date().toISOString(),
 *   filledAt: new Date().toISOString()
 * });
 */
export function createOrderUpdateEvent(
  userId: string,
  order: OrderUpdate
): PortfolioEvent {
  const event: PortfolioEvent = {
    type: "order_update",
    timestamp: new Date().toISOString(),
    userId,
    data: order,
  };

  portfolioEventSchema.parse(event);
  return event;
}

/**
 * Create an account update event
 *
 * @param userId - User ID for event isolation
 * @param account - Account data
 * @returns Validated PortfolioEvent
 *
 * @example
 * const event = createAccountUpdateEvent('user-123', {
 *   equity: '104308.75',
 *   buyingPower: '354905.24',
 *   cash: '50000.00',
 *   portfolioValue: '104308.75',
 *   dayPnl: '1234.56',
 *   dayPnlPercent: '1.20',
 *   timestamp: new Date().toISOString()
 * });
 */
export function createAccountUpdateEvent(
  userId: string,
  account: AccountUpdate
): PortfolioEvent {
  const event: PortfolioEvent = {
    type: "account_update",
    timestamp: new Date().toISOString(),
    userId,
    data: account,
  };

  portfolioEventSchema.parse(event);
  return event;
}

/**
 * Create a trade executed event
 *
 * @param userId - User ID for event isolation
 * @param trade - Trade data
 * @returns Validated PortfolioEvent
 *
 * @example
 * const event = createTradeExecutedEvent('user-123', {
 *   tradeId: 'trade-789',
 *   symbol: 'NVDA',
 *   side: 'sell',
 *   quantity: '25',
 *   price: '520.50',
 *   pnl: '1250.00',
 *   executedAt: new Date().toISOString(),
 *   strategyId: 'strategy-xyz'
 * });
 */
export function createTradeExecutedEvent(
  userId: string,
  trade: TradeExecuted
): PortfolioEvent {
  const event: PortfolioEvent = {
    type: "trade_executed",
    timestamp: new Date().toISOString(),
    userId,
    data: trade,
  };

  portfolioEventSchema.parse(event);
  return event;
}

/**
 * Create a batch event
 *
 * @param userId - User ID for event isolation
 * @param batch - Aggregated events
 * @returns Validated PortfolioEvent
 *
 * @example
 * const event = createBatchEvent('user-123', {
 *   positions: [positionUpdate1, positionUpdate2],
 *   orders: [orderUpdate1],
 *   account: accountUpdate
 * });
 */
export function createBatchEvent(
  userId: string,
  batch: BatchUpdate
): PortfolioEvent {
  const event: PortfolioEvent = {
    type: "batch",
    timestamp: new Date().toISOString(),
    userId,
    data: batch,
  };

  portfolioEventSchema.parse(event);
  return event;
}

/**
 * Create an error event
 *
 * @param userId - User ID for event isolation
 * @param code - Error code
 * @param message - Error message
 * @param details - Additional error context (optional)
 * @returns Validated PortfolioEvent
 *
 * @example
 * const event = createErrorEvent('user-123', 'SUBSCRIPTION_FAILED', 'Invalid channel name', {channel: 'invalid'});
 */
export function createErrorEvent(
  userId: string,
  code: string,
  message: string,
  details?: unknown
): PortfolioEvent {
  const event: PortfolioEvent = {
    type: "error",
    timestamp: new Date().toISOString(),
    userId,
    data: { code, message, details },
  };

  return event;
}

/**
 * Create a pong event (heartbeat response)
 *
 * @param userId - User ID for event isolation
 * @returns Validated PortfolioEvent
 */
export function createPongEvent(userId: string): PortfolioEvent {
  return {
    type: "pong",
    timestamp: new Date().toISOString(),
    userId,
    data: {},
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if event is a position update
 *
 * @param event - Portfolio event to check
 * @returns True if event is position_update type
 */
export function isPositionUpdate(
  event: PortfolioEvent
): event is PortfolioEvent & { data: PositionUpdate } {
  return event.type === "position_update";
}

/**
 * Type guard to check if event is an order update
 *
 * @param event - Portfolio event to check
 * @returns True if event is order_update type
 */
export function isOrderUpdate(
  event: PortfolioEvent
): event is PortfolioEvent & { data: OrderUpdate } {
  return event.type === "order_update";
}

/**
 * Type guard to check if event is an account update
 *
 * @param event - Portfolio event to check
 * @returns True if event is account_update type
 */
export function isAccountUpdate(
  event: PortfolioEvent
): event is PortfolioEvent & { data: AccountUpdate } {
  return event.type === "account_update";
}

/**
 * Type guard to check if event is a trade executed event
 *
 * @param event - Portfolio event to check
 * @returns True if event is trade_executed type
 */
export function isTradeExecuted(
  event: PortfolioEvent
): event is PortfolioEvent & { data: TradeExecuted } {
  return event.type === "trade_executed";
}

/**
 * Type guard to check if event is a batch update
 *
 * @param event - Portfolio event to check
 * @returns True if event is batch type
 */
export function isBatchUpdate(
  event: PortfolioEvent
): event is PortfolioEvent & { data: BatchUpdate } {
  return event.type === "batch";
}

/**
 * Type guard to check if event is an error event
 *
 * @param event - Portfolio event to check
 * @returns True if event is error type
 */
export function isErrorEvent(
  event: PortfolioEvent
): event is PortfolioEvent & { data: ErrorEvent } {
  return event.type === "error";
}

/**
 * Type guard to check if event is a pong event
 *
 * @param event - Portfolio event to check
 * @returns True if event is pong type
 */
export function isPongEvent(
  event: PortfolioEvent
): event is PortfolioEvent & { data: Record<string, never> } {
  return event.type === "pong";
}

// ============================================================================
// CLIENT MESSAGE VALIDATION
// ============================================================================

/**
 * Validate and parse a client message
 *
 * @param message - Raw message data from WebSocket
 * @returns Parsed ClientMessage if valid, null if invalid
 *
 * @example
 * const message = parseClientMessage(rawData);
 * if (message && message.type === 'subscribe') {
 *   handleSubscription(message.channels);
 * }
 */
export function parseClientMessage(message: unknown): ClientMessage | null {
  try {
    const parsed = clientMessageSchema.parse(message);
    return parsed as ClientMessage;
  } catch (error) {
    return null;
  }
}

/**
 * Validate a portfolio event
 *
 * @param event - Event to validate
 * @returns True if valid, false otherwise
 */
export function validatePortfolioEvent(
  event: unknown
): event is PortfolioEvent {
  const result = portfolioEventSchema.safeParse(event);
  return result.success;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the channel type for a given event type
 *
 * @param eventType - Portfolio event type
 * @returns Corresponding channel type
 *
 * @example
 * getChannelForEventType('position_update') // 'positions'
 * getChannelForEventType('order_update') // 'orders'
 */
export function getChannelForEventType(
  eventType: PortfolioEventType
): ChannelType | null {
  const channelMap: Record<string, ChannelType | null> = {
    position_update: "positions",
    order_update: "orders",
    account_update: "account",
    trade_executed: "trades",
    batch: null, // Batch contains multiple channels
    error: null, // Errors always sent
    pong: null, // Pong always sent
  };

  return channelMap[eventType] ?? null;
}

/**
 * Serialize event to JSON string for WebSocket transmission
 *
 * @param event - Portfolio event to serialize
 * @returns JSON string
 */
export function serializeEvent(event: PortfolioEvent): string {
  return JSON.stringify(event);
}

/**
 * Parse and validate incoming WebSocket message
 *
 * @param rawMessage - Raw message data from WebSocket
 * @returns Parsed PortfolioEvent if valid, null if invalid
 */
export function parsePortfolioEvent(rawMessage: string): PortfolioEvent | null {
  try {
    const parsed = JSON.parse(rawMessage);
    return portfolioEventSchema.parse(parsed);
  } catch {
    return null;
  }
}

/**
 * Calculate unrealized P&L percentage
 *
 * @param currentPrice - Current market price
 * @param entryPrice - Average entry price
 * @returns P&L percentage as string
 */
export function calculatePnlPercent(
  currentPrice: string,
  entryPrice: string
): string {
  const current = parseFloat(currentPrice);
  const entry = parseFloat(entryPrice);

  if (entry === 0) return "0.00";

  const pnlPercent = ((current - entry) / entry) * 100;
  return pnlPercent.toFixed(2);
}

/**
 * Calculate unrealized P&L amount
 *
 * @param quantity - Position quantity
 * @param currentPrice - Current market price
 * @param entryPrice - Average entry price
 * @returns P&L amount as string
 */
export function calculatePnlAmount(
  quantity: string,
  currentPrice: string,
  entryPrice: string
): string {
  const qty = parseFloat(quantity);
  const current = parseFloat(currentPrice);
  const entry = parseFloat(entryPrice);

  const pnl = (current - entry) * qty;
  return pnl.toFixed(2);
}

/**
 * Calculate market value
 *
 * @param quantity - Position quantity
 * @param currentPrice - Current market price
 * @returns Market value as string
 */
export function calculateMarketValue(
  quantity: string,
  currentPrice: string
): string {
  const qty = parseFloat(quantity);
  const price = parseFloat(currentPrice);

  const value = qty * price;
  return value.toFixed(2);
}
