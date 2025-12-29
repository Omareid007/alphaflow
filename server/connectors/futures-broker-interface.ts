/**
 * Futures Broker Integration Interface
 *
 * This file defines a standardized interface for futures trading brokers.
 * Since Alpaca doesn't support futures, this provides a connector abstraction
 * that can be implemented for futures-capable brokers like Interactive Brokers,
 * Tradovate, NinjaTrader, etc.
 *
 * @see /server/strategies/futures-strategy.ts for futures instrument configurations
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Futures account information including margin and buying power
 */
export interface FuturesAccount {
  id: string;
  accountNumber: string;
  currency: string;

  // Account balances
  cashBalance: number;
  netLiquidation: number;

  // Margin information
  initialMargin: number;
  maintenanceMargin: number;
  availableFunds: number;
  excessLiquidity: number;

  // Buying power specific to futures
  futuresPNL: number;
  unrealizedPNL: number;
  realizedPNL: number;

  // Leverage
  leverage: number;

  // Metadata
  timestamp: Date;
}

/**
 * Futures position with contract-specific details
 */
export interface FuturesPosition {
  symbol: string;
  contractMonth: string; // e.g., "202503" for March 2025
  exchange: string; // e.g., "CME", "EUREX"

  // Position details
  side: "long" | "short";
  quantity: number; // Number of contracts
  avgEntryPrice: number;
  currentPrice: number;

  // P&L
  unrealizedPnl: number;
  realizedPnl: number;

  // Contract specifications
  tickSize: number;
  tickValue: number;
  contractSize: number;
  pointValue: number;

  // Margin requirements
  initialMarginPerContract: number;
  maintenanceMarginPerContract: number;

  // Metadata
  openedAt: Date;
  lastUpdate: Date;
}

/**
 * Futures order parameters
 */
export interface FuturesOrderParams {
  symbol: string;
  contractMonth?: string; // Optional: if not provided, use front month
  side: "buy" | "sell";
  quantity: number;

  // Order types
  type: "market" | "limit" | "stop" | "stop_limit";
  limitPrice?: number;
  stopPrice?: number;

  // Time in force
  timeInForce: "day" | "gtc" | "ioc" | "fok";

  // Advanced order types
  bracket?: {
    takeProfitPrice: number;
    stopLossPrice: number;
  };

  // Metadata
  clientOrderId?: string;
  notes?: string;
}

/**
 * Futures order response
 */
export interface FuturesOrder {
  id: string;
  clientOrderId?: string;
  symbol: string;
  contractMonth: string;
  side: "buy" | "sell";
  quantity: number;
  filledQuantity: number;

  // Order type
  type: "market" | "limit" | "stop" | "stop_limit";
  limitPrice?: number;
  stopPrice?: number;

  // Status
  status:
    | "pending"
    | "open"
    | "filled"
    | "partially_filled"
    | "cancelled"
    | "rejected";
  timeInForce: "day" | "gtc" | "ioc" | "fok";

  // Execution details
  avgFillPrice?: number;
  commission?: number;

  // Bracket orders (if applicable)
  legs?: FuturesOrder[];
  parentOrderId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  filledAt?: Date;
  cancelledAt?: Date;
}

/**
 * Futures market data quote
 */
export interface FuturesQuote {
  symbol: string;
  contractMonth: string;

  // Bid/Ask
  bid: number;
  bidSize: number;
  ask: number;
  askSize: number;

  // Last trade
  last: number;
  lastSize: number;

  // Volume
  volume: number;
  openInterest: number;

  // Day statistics
  open: number;
  high: number;
  low: number;
  close: number;

  // Metadata
  timestamp: Date;
  exchange: string;
}

/**
 * Futures bar (OHLCV) data
 */
export interface FuturesBar {
  symbol: string;
  contractMonth: string;
  timestamp: Date;

  // OHLCV
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;

  // Additional metrics
  vwap?: number;
  trades?: number;
  openInterest?: number;
}

/**
 * Quote update callback type
 */
export type QuoteCallback = (quote: FuturesQuote) => void;

/**
 * Bar update callback type
 */
export type BarCallback = (bar: FuturesBar) => void;

// ============================================================================
// BROKER INTERFACE
// ============================================================================

/**
 * Main futures broker interface
 * All futures brokers must implement this interface
 */
export interface FuturesBroker {
  // ========== Connection Management ==========

  /**
   * Connect to the broker's API
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the broker's API
   */
  disconnect(): Promise<void>;

  /**
   * Check if currently connected
   */
  isConnected(): boolean;

  /**
   * Get connection status details
   */
  getConnectionStatus(): {
    connected: boolean;
    authenticated: boolean;
    lastPing?: Date;
    error?: string;
  };

  // ========== Account Management ==========

  /**
   * Get account information
   */
  getAccount(): Promise<FuturesAccount>;

  /**
   * Get all open positions
   */
  getPositions(): Promise<FuturesPosition[]>;

  /**
   * Get position for specific symbol
   */
  getPosition(
    symbol: string,
    contractMonth?: string
  ): Promise<FuturesPosition | null>;

  // ========== Order Management ==========

  /**
   * Create a new order
   */
  createOrder(params: FuturesOrderParams): Promise<FuturesOrder>;

  /**
   * Create a bracket order (entry + stop loss + take profit)
   */
  createBracketOrder(
    params: FuturesOrderParams & {
      takeProfitPrice: number;
      stopLossPrice: number;
    }
  ): Promise<FuturesOrder>;

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): Promise<void>;

  /**
   * Cancel all orders
   */
  cancelAllOrders(symbol?: string): Promise<number>;

  /**
   * Get order by ID
   */
  getOrder(orderId: string): Promise<FuturesOrder>;

  /**
   * Get all orders
   */
  getOrders(status?: "all" | "open" | "closed"): Promise<FuturesOrder[]>;

  /**
   * Close position (market order to exit)
   */
  closePosition(symbol: string, contractMonth?: string): Promise<FuturesOrder>;

  // ========== Market Data ==========

  /**
   * Get current quote for a symbol
   */
  getQuote(symbol: string, contractMonth?: string): Promise<FuturesQuote>;

  /**
   * Get historical bars
   */
  getBars(
    symbol: string,
    timeframe: string,
    start: Date,
    end: Date,
    contractMonth?: string
  ): Promise<FuturesBar[]>;

  /**
   * Get contract specifications
   */
  getContractSpecs(symbol: string): Promise<{
    symbol: string;
    exchange: string;
    tickSize: number;
    tickValue: number;
    contractSize: number;
    currency: string;
    tradingHours: string;
    expirationMonths: string[];
  }>;

  // ========== Streaming Data ==========

  /**
   * Subscribe to real-time quotes
   */
  subscribeQuotes(symbols: string[], callback: QuoteCallback): void;

  /**
   * Unsubscribe from quotes
   */
  unsubscribeQuotes(symbols: string[]): void;

  /**
   * Subscribe to real-time bars
   */
  subscribeBars(
    symbols: string[],
    timeframe: string,
    callback: BarCallback
  ): void;

  /**
   * Unsubscribe from bars
   */
  unsubscribeBars(symbols: string[]): void;
}

// ============================================================================
// PLACEHOLDER IMPLEMENTATIONS
// ============================================================================

/**
 * Interactive Brokers (IBKR) futures connector stub
 *
 * To implement:
 * - Install IB Gateway or TWS
 * - Use @stoqey/ib package for Node.js IB API
 * - Implement authentication and connection
 * - Map IB's contract definitions to our interface
 *
 * @see https://www.interactivebrokers.com/en/trading/tws-api.php
 */
export class InteractiveBrokersFutures implements FuturesBroker {
  private connected: boolean = false;

  async connect(): Promise<void> {
    throw new Error(
      "Interactive Brokers connector not yet implemented. Install IB Gateway and @stoqey/ib package."
    );
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionStatus() {
    return {
      connected: this.connected,
      authenticated: false,
      error: "Not implemented - requires IB Gateway setup",
    };
  }

  async getAccount(): Promise<FuturesAccount> {
    throw new Error("Not implemented");
  }

  async getPositions(): Promise<FuturesPosition[]> {
    throw new Error("Not implemented");
  }

  async getPosition(
    symbol: string,
    contractMonth?: string
  ): Promise<FuturesPosition | null> {
    throw new Error("Not implemented");
  }

  async createOrder(params: FuturesOrderParams): Promise<FuturesOrder> {
    throw new Error("Not implemented");
  }

  async createBracketOrder(
    params: FuturesOrderParams & {
      takeProfitPrice: number;
      stopLossPrice: number;
    }
  ): Promise<FuturesOrder> {
    throw new Error("Not implemented");
  }

  async cancelOrder(orderId: string): Promise<void> {
    throw new Error("Not implemented");
  }

  async cancelAllOrders(symbol?: string): Promise<number> {
    throw new Error("Not implemented");
  }

  async getOrder(orderId: string): Promise<FuturesOrder> {
    throw new Error("Not implemented");
  }

  async getOrders(status?: "all" | "open" | "closed"): Promise<FuturesOrder[]> {
    throw new Error("Not implemented");
  }

  async closePosition(
    symbol: string,
    contractMonth?: string
  ): Promise<FuturesOrder> {
    throw new Error("Not implemented");
  }

  async getQuote(
    symbol: string,
    contractMonth?: string
  ): Promise<FuturesQuote> {
    throw new Error("Not implemented");
  }

  async getBars(
    symbol: string,
    timeframe: string,
    start: Date,
    end: Date,
    contractMonth?: string
  ): Promise<FuturesBar[]> {
    throw new Error("Not implemented");
  }

  async getContractSpecs(symbol: string): Promise<any> {
    throw new Error("Not implemented");
  }

  subscribeQuotes(symbols: string[], callback: QuoteCallback): void {
    throw new Error("Not implemented");
  }

  unsubscribeQuotes(symbols: string[]): void {
    throw new Error("Not implemented");
  }

  subscribeBars(
    symbols: string[],
    timeframe: string,
    callback: BarCallback
  ): void {
    throw new Error("Not implemented");
  }

  unsubscribeBars(symbols: string[]): void {
    throw new Error("Not implemented");
  }
}

/**
 * Tradovate futures connector stub
 *
 * To implement:
 * - Sign up for Tradovate API access
 * - Use Tradovate REST API and WebSocket API
 * - Implement OAuth authentication
 * - Map Tradovate's contract IDs to symbols
 *
 * @see https://api.tradovate.com/
 */
export class TradovateFutures implements FuturesBroker {
  private connected: boolean = false;

  async connect(): Promise<void> {
    throw new Error(
      "Tradovate connector not yet implemented. Requires Tradovate API credentials."
    );
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionStatus() {
    return {
      connected: this.connected,
      authenticated: false,
      error: "Not implemented - requires Tradovate API setup",
    };
  }

  async getAccount(): Promise<FuturesAccount> {
    throw new Error("Not implemented");
  }

  async getPositions(): Promise<FuturesPosition[]> {
    throw new Error("Not implemented");
  }

  async getPosition(
    symbol: string,
    contractMonth?: string
  ): Promise<FuturesPosition | null> {
    throw new Error("Not implemented");
  }

  async createOrder(params: FuturesOrderParams): Promise<FuturesOrder> {
    throw new Error("Not implemented");
  }

  async createBracketOrder(
    params: FuturesOrderParams & {
      takeProfitPrice: number;
      stopLossPrice: number;
    }
  ): Promise<FuturesOrder> {
    throw new Error("Not implemented");
  }

  async cancelOrder(orderId: string): Promise<void> {
    throw new Error("Not implemented");
  }

  async cancelAllOrders(symbol?: string): Promise<number> {
    throw new Error("Not implemented");
  }

  async getOrder(orderId: string): Promise<FuturesOrder> {
    throw new Error("Not implemented");
  }

  async getOrders(status?: "all" | "open" | "closed"): Promise<FuturesOrder[]> {
    throw new Error("Not implemented");
  }

  async closePosition(
    symbol: string,
    contractMonth?: string
  ): Promise<FuturesOrder> {
    throw new Error("Not implemented");
  }

  async getQuote(
    symbol: string,
    contractMonth?: string
  ): Promise<FuturesQuote> {
    throw new Error("Not implemented");
  }

  async getBars(
    symbol: string,
    timeframe: string,
    start: Date,
    end: Date,
    contractMonth?: string
  ): Promise<FuturesBar[]> {
    throw new Error("Not implemented");
  }

  async getContractSpecs(symbol: string): Promise<any> {
    throw new Error("Not implemented");
  }

  subscribeQuotes(symbols: string[], callback: QuoteCallback): void {
    throw new Error("Not implemented");
  }

  unsubscribeQuotes(symbols: string[]): void {
    throw new Error("Not implemented");
  }

  subscribeBars(
    symbols: string[],
    timeframe: string,
    callback: BarCallback
  ): void {
    throw new Error("Not implemented");
  }

  unsubscribeBars(symbols: string[]): void {
    throw new Error("Not implemented");
  }
}

/**
 * NinjaTrader futures connector stub
 *
 * To implement:
 * - Install NinjaTrader 8
 * - Enable NinjaTrader's ATI (Automated Trading Interface)
 * - Use NinjaTrader's C# API or HTTP endpoints
 *
 * @see https://ninjatrader.com/support/helpGuides/nt8/automated_trading_interface.htm
 */
export class NinjaTraderFutures implements FuturesBroker {
  private connected: boolean = false;

  async connect(): Promise<void> {
    throw new Error(
      "NinjaTrader connector not yet implemented. Requires NinjaTrader 8 with ATI enabled."
    );
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionStatus() {
    return {
      connected: this.connected,
      authenticated: false,
      error: "Not implemented - requires NinjaTrader setup",
    };
  }

  async getAccount(): Promise<FuturesAccount> {
    throw new Error("Not implemented");
  }

  async getPositions(): Promise<FuturesPosition[]> {
    throw new Error("Not implemented");
  }

  async getPosition(
    symbol: string,
    contractMonth?: string
  ): Promise<FuturesPosition | null> {
    throw new Error("Not implemented");
  }

  async createOrder(params: FuturesOrderParams): Promise<FuturesOrder> {
    throw new Error("Not implemented");
  }

  async createBracketOrder(
    params: FuturesOrderParams & {
      takeProfitPrice: number;
      stopLossPrice: number;
    }
  ): Promise<FuturesOrder> {
    throw new Error("Not implemented");
  }

  async cancelOrder(orderId: string): Promise<void> {
    throw new Error("Not implemented");
  }

  async cancelAllOrders(symbol?: string): Promise<number> {
    throw new Error("Not implemented");
  }

  async getOrder(orderId: string): Promise<FuturesOrder> {
    throw new Error("Not implemented");
  }

  async getOrders(status?: "all" | "open" | "closed"): Promise<FuturesOrder[]> {
    throw new Error("Not implemented");
  }

  async closePosition(
    symbol: string,
    contractMonth?: string
  ): Promise<FuturesOrder> {
    throw new Error("Not implemented");
  }

  async getQuote(
    symbol: string,
    contractMonth?: string
  ): Promise<FuturesQuote> {
    throw new Error("Not implemented");
  }

  async getBars(
    symbol: string,
    timeframe: string,
    start: Date,
    end: Date,
    contractMonth?: string
  ): Promise<FuturesBar[]> {
    throw new Error("Not implemented");
  }

  async getContractSpecs(symbol: string): Promise<any> {
    throw new Error("Not implemented");
  }

  subscribeQuotes(symbols: string[], callback: QuoteCallback): void {
    throw new Error("Not implemented");
  }

  unsubscribeQuotes(symbols: string[]): void {
    throw new Error("Not implemented");
  }

  subscribeBars(
    symbols: string[],
    timeframe: string,
    callback: BarCallback
  ): void {
    throw new Error("Not implemented");
  }

  unsubscribeBars(symbols: string[]): void {
    throw new Error("Not implemented");
  }
}

// ============================================================================
// BROKER FACTORY
// ============================================================================

/**
 * Supported futures broker types
 */
export type FuturesBrokerType =
  | "interactive_brokers"
  | "tradovate"
  | "ninjatrader";

/**
 * Factory function to create futures broker instances
 */
export function createFuturesBroker(
  type: FuturesBrokerType,
  config?: {
    apiKey?: string;
    apiSecret?: string;
    accountId?: string;
    paperTrading?: boolean;
    [key: string]: any;
  }
): FuturesBroker {
  switch (type) {
    case "interactive_brokers":
      return new InteractiveBrokersFutures();
    case "tradovate":
      return new TradovateFutures();
    case "ninjatrader":
      return new NinjaTraderFutures();
    default:
      throw new Error(`Unsupported futures broker type: ${type}`);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createFuturesBroker,
  InteractiveBrokersFutures,
  TradovateFutures,
  NinjaTraderFutures,
};
