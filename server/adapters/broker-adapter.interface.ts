/**
 * Broker Adapter Interface
 *
 * This module defines broker-agnostic interfaces that abstract away the underlying
 * broker implementation (REST API, SDK, etc.). This enables future SDK migration
 * without breaking changes to the application code.
 *
 * All monetary values are in USD unless otherwise specified.
 * All timestamps are returned as Date objects.
 */

/**
 * Represents a broker account with trading capabilities and restrictions.
 */
export interface BrokerAccount {
  /** Unique account identifier */
  id: string;

  /** Available funds for opening new positions */
  buyingPower: number;

  /** Cash balance available in the account */
  cash: number;

  /** Total account equity (cash + positions market value) */
  equity: number;

  /** Total portfolio value including all assets */
  portfolioValue: number;

  /** Account currency (e.g., 'USD') */
  currency: string;

  /** Whether trading is currently blocked on this account */
  tradingBlocked: boolean;

  /** Whether account is flagged as a pattern day trader */
  patternDayTrader: boolean;
}

/**
 * Represents an open or closed position in a security.
 */
export interface BrokerPosition {
  /** Security symbol (e.g., 'AAPL') */
  symbol: string;

  /** Number of shares held (positive for long, negative for short) */
  quantity: number;

  /** Average price at which the position was entered */
  avgEntryPrice: number;

  /** Current market price of the security */
  currentPrice: number;

  /** Current market value of the position (quantity * currentPrice) */
  marketValue: number;

  /** Unrealized profit/loss in dollars */
  unrealizedPnl: number;

  /** Unrealized profit/loss as a percentage */
  unrealizedPnlPercent: number;

  /** Position side */
  side: "long" | "short";
}

/**
 * Represents an order to buy or sell a security.
 */
export interface BrokerOrder {
  /** Broker-assigned order ID */
  id: string;

  /** Client-assigned order ID for tracking */
  clientOrderId: string;

  /** Security symbol (e.g., 'AAPL') */
  symbol: string;

  /** Order side */
  side: "buy" | "sell";

  /** Order type */
  type: "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";

  /** Current order status */
  status:
    | "new"
    | "accepted"
    | "pending_new"
    | "filled"
    | "partially_filled"
    | "canceled"
    | "rejected"
    | "expired";

  /** Total quantity to be filled */
  quantity: number;

  /** Quantity that has been filled so far */
  filledQuantity: number;

  /** Average price at which the order was filled (null if not filled) */
  filledAvgPrice: number | null;

  /** Limit price for limit orders */
  limitPrice?: number;

  /** Stop price for stop orders */
  stopPrice?: number;

  /** Time in force (e.g., 'day', 'gtc', 'ioc', 'fok') */
  timeInForce: string;

  /** Whether the order can execute during extended hours */
  extendedHours: boolean;

  /** Timestamp when the order was created */
  createdAt: Date;

  /** Timestamp when the order was filled (null if not filled) */
  filledAt: Date | null;
}

/**
 * Parameters for creating a standard order.
 */
export interface OrderParams {
  /** Security symbol (e.g., 'AAPL') */
  symbol: string;

  /** Order side */
  side: "buy" | "sell";

  /** Order type */
  type: "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";

  /** Number of shares to trade (mutually exclusive with notional) */
  quantity?: number;

  /** Dollar amount to trade (mutually exclusive with quantity) */
  notional?: number;

  /** Limit price for limit orders */
  limitPrice?: number;

  /** Stop price for stop orders */
  stopPrice?: number;

  /** Trail percentage for trailing stop orders */
  trailPercent?: number;

  /** Time in force (default: 'day') */
  timeInForce?: string;

  /** Whether the order can execute during extended hours (default: false) */
  extendedHours?: boolean;

  /** Client-assigned order ID for tracking */
  clientOrderId?: string;
}

/**
 * Parameters for creating a bracket order (entry + take profit + stop loss).
 */
export interface BracketOrderParams extends OrderParams {
  /** Take profit price (limit sell for long, limit buy for short) */
  takeProfitPrice: number;

  /** Stop loss price (stop sell for long, stop buy for short) */
  stopLossPrice: number;
}

/**
 * Represents a market data snapshot for a security.
 */
export interface MarketSnapshot {
  /** Security symbol */
  symbol: string;

  /** Current bid price */
  bid: number;

  /** Current ask price */
  ask: number;

  /** Last traded price */
  last: number;

  /** Bid size (number of shares) */
  bidSize?: number;

  /** Ask size (number of shares) */
  askSize?: number;

  /** Trading volume for the day */
  volume?: number;

  /** Timestamp of the snapshot */
  timestamp: Date;
}

/**
 * Represents a real-time quote for a security.
 */
export interface BrokerQuote {
  /** Current bid price */
  bid: number;

  /** Current ask price */
  ask: number;

  /** Last traded price */
  last: number;
}

/**
 * Health check response indicating broker connection status.
 */
export interface BrokerHealthCheck {
  /** Whether the broker connection is healthy */
  healthy: boolean;

  /** API latency in milliseconds */
  latencyMs: number;
}

/**
 * Connection status response.
 */
export interface BrokerConnectionStatus {
  /** Whether connected to the broker */
  connected: boolean;

  /** Trading mode */
  mode: "paper" | "live";
}

/**
 * Broker Adapter Interface
 *
 * This interface abstracts broker operations to enable switching between
 * different broker implementations (REST API, SDK, mock, etc.) without
 * changing application code.
 *
 * All methods return Promises for async operations.
 * All methods may throw errors that should be handled by the caller.
 */
export interface IBrokerAdapter {
  // ==================== Account Operations ====================

  /**
   * Retrieves the current account information including balances and restrictions.
   *
   * @returns Promise resolving to the broker account details
   * @throws Error if the account cannot be retrieved
   */
  getAccount(): Promise<BrokerAccount>;

  // ==================== Position Operations ====================

  /**
   * Retrieves all open positions in the account.
   *
   * @returns Promise resolving to an array of positions (empty if no positions)
   * @throws Error if positions cannot be retrieved
   */
  getPositions(): Promise<BrokerPosition[]>;

  /**
   * Retrieves a specific position by symbol.
   *
   * @param symbol - The security symbol (e.g., 'AAPL')
   * @returns Promise resolving to the position or null if not found
   * @throws Error if the position lookup fails
   */
  getPosition(symbol: string): Promise<BrokerPosition | null>;

  /**
   * Closes an entire position using a market order.
   *
   * @param symbol - The security symbol to close
   * @returns Promise resolving to the closing order
   * @throws Error if the position cannot be closed
   */
  closePosition(symbol: string): Promise<BrokerOrder>;

  /**
   * Closes all open positions using market orders.
   *
   * @returns Promise resolving to an array of closing orders
   * @throws Error if positions cannot be closed
   */
  closeAllPositions(): Promise<BrokerOrder[]>;

  // ==================== Order Operations ====================

  /**
   * Creates and submits a new order.
   *
   * @param params - Order parameters including symbol, side, type, and quantity/notional
   * @returns Promise resolving to the created order
   * @throws Error if the order cannot be created or is rejected
   */
  createOrder(params: OrderParams): Promise<BrokerOrder>;

  /**
   * Creates a bracket order with entry, take profit, and stop loss.
   * The bracket order consists of three related orders:
   * 1. Entry order (market or limit)
   * 2. Take profit order (limit)
   * 3. Stop loss order (stop)
   *
   * When the entry order fills, the take profit and stop loss orders are activated.
   * When either the take profit or stop loss fills, the other is automatically canceled.
   *
   * @param params - Bracket order parameters including entry and exit prices
   * @returns Promise resolving to the entry order (bracket legs are linked)
   * @throws Error if the bracket order cannot be created
   */
  createBracketOrder(params: BracketOrderParams): Promise<BrokerOrder>;

  /**
   * Retrieves orders filtered by status.
   *
   * @param status - Filter by order status: 'open', 'closed', or 'all' (default: 'all')
   * @param limit - Maximum number of orders to retrieve (default: broker-specific)
   * @returns Promise resolving to an array of orders
   * @throws Error if orders cannot be retrieved
   */
  getOrders(
    status?: "open" | "closed" | "all",
    limit?: number
  ): Promise<BrokerOrder[]>;

  /**
   * Retrieves a specific order by ID.
   *
   * @param orderId - The broker-assigned order ID
   * @returns Promise resolving to the order or null if not found
   * @throws Error if the order lookup fails
   */
  getOrder(orderId: string): Promise<BrokerOrder | null>;

  /**
   * Cancels a pending order.
   *
   * @param orderId - The broker-assigned order ID to cancel
   * @returns Promise that resolves when the order is canceled
   * @throws Error if the order cannot be canceled (e.g., already filled)
   */
  cancelOrder(orderId: string): Promise<void>;

  /**
   * Cancels all pending orders.
   *
   * @returns Promise that resolves when all orders are canceled
   * @throws Error if orders cannot be canceled
   */
  cancelAllOrders(): Promise<void>;

  // ==================== Market Data Operations ====================

  /**
   * Retrieves a real-time quote for a security.
   *
   * @param symbol - The security symbol (e.g., 'AAPL')
   * @returns Promise resolving to current bid/ask/last prices
   * @throws Error if the quote cannot be retrieved
   */
  getQuote(symbol: string): Promise<BrokerQuote>;

  /**
   * Retrieves market snapshots for multiple securities.
   * Snapshots include bid, ask, last price, volume, and other market data.
   *
   * @param symbols - Array of security symbols
   * @returns Promise resolving to a Map of symbol to snapshot
   * @throws Error if snapshots cannot be retrieved
   */
  getSnapshots(symbols: string[]): Promise<Map<string, MarketSnapshot>>;

  // ==================== Health & Connection ====================

  /**
   * Performs a health check on the broker connection.
   * Tests connectivity and measures API latency.
   *
   * @returns Promise resolving to health status and latency
   * @throws Error if health check fails
   */
  healthCheck(): Promise<BrokerHealthCheck>;

  /**
   * Retrieves the current connection status.
   *
   * @returns Promise resolving to connection status and trading mode
   * @throws Error if status cannot be determined
   */
  getConnectionStatus(): Promise<BrokerConnectionStatus>;
}
