/**
 * Trading Engine Type Definitions
 *
 * Core TypeScript interfaces and types used throughout the trading engine system.
 * These types define the structure for trade requests, portfolio rebalancing,
 * strategy execution, and trade results.
 *
 * @module engine-types
 */

/**
 * Request structure for executing a trade on Alpaca
 *
 * This interface defines all parameters needed to execute a trade, including
 * security authorization, order types, and advanced features like bracket orders
 * and trailing stops.
 *
 * @interface AlpacaTradeRequest
 *
 * @example
 * ```typescript
 * const tradeRequest: AlpacaTradeRequest = {
 *   symbol: "AAPL",
 *   side: "buy",
 *   quantity: 10,
 *   orderType: "limit",
 *   limitPrice: 150.00,
 *   stopLossPrice: 145.00,
 *   useBracketOrder: true,
 *   authorizedByOrchestrator: true
 * };
 * ```
 */
export interface AlpacaTradeRequest {
  /** The trading symbol (e.g., "AAPL" for stocks, "BTC/USD" for crypto) */
  symbol: string;

  /** Direction of the trade */
  side: "buy" | "sell";

  /** Number of shares or units to trade */
  quantity: number;

  /** Optional strategy identifier for tracking which strategy initiated this trade */
  strategyId?: string;

  /** Optional notes or metadata about the trade (e.g., "AI-driven momentum play") */
  notes?: string;

  /** Type of order to place (defaults to "market" if not specified) */
  orderType?: "market" | "limit";

  /** Limit price for limit orders (required when orderType is "limit") */
  limitPrice?: number;

  /** Stop loss price to automatically exit position if price moves against you */
  stopLossPrice?: number;

  /** Take profit price to automatically exit position when target is reached */
  takeProfitPrice?: number;

  /** Whether to create a bracket order with stop loss and take profit legs */
  useBracketOrder?: boolean;

  /** Trailing stop percentage (e.g., 5 for 5% trailing stop) */
  trailingStopPercent?: number;

  /** Whether to allow trading during extended hours (pre-market and after-hours) */
  extendedHours?: boolean;

  /**
   * SECURITY: Authorization flag for orchestrator-controlled trading
   *
   * Only the work queue processor should set this to true.
   * When orchestratorControlEnabled is true, trades are only allowed if this flag is true.
   * This prevents bypass attacks via notes manipulation where malicious actors
   * could try to execute unauthorized trades by crafting special notes fields.
   *
   * @security Critical security field - do not set manually
   */
  authorizedByOrchestrator?: boolean;
}

/**
 * Target allocation for a symbol in portfolio rebalancing
 *
 * Defines the desired percentage allocation for a specific symbol
 * in the portfolio after rebalancing is complete.
 *
 * @interface TargetAllocation
 *
 * @example
 * ```typescript
 * const targets: TargetAllocation[] = [
 *   { symbol: "AAPL", targetPercent: 25 },
 *   { symbol: "GOOGL", targetPercent: 25 },
 *   { symbol: "MSFT", targetPercent: 25 },
 *   { symbol: "AMZN", targetPercent: 25 }
 * ];
 * ```
 */
export interface TargetAllocation {
  /** The trading symbol */
  symbol: string;

  /** Target percentage of portfolio (0-100) */
  targetPercent: number;
}

/**
 * Current allocation for a symbol in the portfolio
 *
 * Represents the current state of a position, including its percentage
 * of the portfolio, dollar value, quantity, and current price.
 *
 * @interface CurrentAllocation
 */
export interface CurrentAllocation {
  /** The trading symbol */
  symbol: string;

  /** Current percentage of portfolio (0-100) */
  currentPercent: number;

  /** Current dollar value of the position */
  currentValue: number;

  /** Number of shares or units held */
  quantity: number;

  /** Current price per share/unit */
  price: number;
}

/**
 * A proposed trade for portfolio rebalancing
 *
 * Describes a single trade that would be executed as part of rebalancing
 * the portfolio to match target allocations.
 *
 * @interface RebalanceTrade
 */
export interface RebalanceTrade {
  /** The trading symbol */
  symbol: string;

  /** Direction of the trade */
  side: "buy" | "sell";

  /** Number of shares or units to trade */
  quantity: number;

  /** Estimated dollar value of the trade */
  estimatedValue: number;

  /** Current percentage of portfolio before rebalance */
  currentPercent: number;

  /** Target percentage of portfolio after rebalance */
  targetPercent: number;

  /** Human-readable reason for this trade */
  reason: string;
}

/**
 * Preview of a portfolio rebalancing operation
 *
 * Provides a complete view of the current state, target state, and all
 * proposed trades needed to rebalance the portfolio. Includes cash
 * calculations and estimated costs.
 *
 * @interface RebalancePreview
 *
 * @example
 * ```typescript
 * const preview: RebalancePreview = {
 *   currentAllocations: [...],
 *   targetAllocations: [...],
 *   proposedTrades: [...],
 *   portfolioValue: 100000,
 *   cashAvailable: 5000,
 *   cashAfterRebalance: 4500,
 *   estimatedTradingCost: 500
 * };
 * ```
 */
export interface RebalancePreview {
  /** Current allocation of all positions */
  currentAllocations: CurrentAllocation[];

  /** Desired target allocations */
  targetAllocations: TargetAllocation[];

  /** List of trades that would be executed */
  proposedTrades: RebalanceTrade[];

  /** Total portfolio value in dollars */
  portfolioValue: number;

  /** Cash available for trading */
  cashAvailable: number;

  /** Estimated cash remaining after rebalance */
  cashAfterRebalance: number;

  /** Estimated cost of all trades (commissions, slippage, etc.) */
  estimatedTradingCost: number;
}

/**
 * Result of a portfolio rebalancing operation
 *
 * Contains the outcome of executing a rebalance, including all trades
 * that were executed, any errors encountered, and portfolio values
 * before and after the rebalance.
 *
 * @interface RebalanceResult
 */
export interface RebalanceResult {
  /** Whether the overall rebalance operation succeeded */
  success: boolean;

  /** List of individual trades that were executed */
  tradesExecuted: Array<{
    /** The trading symbol */
    symbol: string;

    /** Direction of the trade */
    side: string;

    /** Number of shares or units traded */
    quantity: number;

    /** Status of the trade execution (e.g., "filled", "rejected") */
    status: string;

    /** Alpaca order ID if trade was submitted */
    orderId?: string;

    /** Error message if trade failed */
    error?: string;
  }>;

  /** List of errors encountered during rebalancing */
  errors: string[];

  /** Portfolio value before rebalancing */
  portfolioValueBefore: number;

  /** Portfolio value after rebalancing */
  portfolioValueAfter: number;
}

/**
 * Result of an individual trade execution on Alpaca
 *
 * Contains the outcome of a single trade request, including the order
 * details from Alpaca, the trade record saved to the database, and
 * any error information.
 *
 * @interface AlpacaTradeResult
 */
export interface AlpacaTradeResult {
  /** Whether the trade was successfully executed */
  success: boolean;

  /** Order details from Alpaca API (if trade was submitted) */
  order?: import("../connectors/alpaca").AlpacaOrder;

  /** Trade record saved to database (if successful) */
  trade?: import("@shared/schema").Trade;

  /** Error message if trade failed */
  error?: string;
}

/**
 * Execution state for an automated trading strategy
 *
 * Tracks the current running state of a strategy, including when it
 * last ran, what decision it made, and any errors encountered.
 *
 * @interface StrategyRunState
 */
export interface StrategyRunState {
  /** Unique identifier for the strategy */
  strategyId: string;

  /** Whether the strategy is currently running */
  isRunning: boolean;

  /** Timestamp of last strategy check */
  lastCheck?: Date;

  /** Last AI decision made by the strategy */
  lastDecision?: import("../ai/decision-engine").AIDecision;

  /** Error message if strategy encountered an error */
  error?: string;
}
