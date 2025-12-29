/**
 * @module autonomous/types
 * @description Autonomous Orchestrator Types
 *
 * This module contains all TypeScript interfaces, types, and constants for the autonomous
 * trading orchestrator. These types define the configuration, state management, risk controls,
 * and execution results for automated trading operations.
 *
 * Extracted from orchestrator.ts for better modularity and separation of concerns.
 */

import { tradingConfig } from "../config/trading-config";
import type { AIDecision } from "../ai/decision-engine";

// ============================================================================
// CONFIG CONSTANTS (from tradingConfig)
// ============================================================================

/**
 * Default hard stop loss percentage for risk management.
 * Loaded from tradingConfig.riskManagement.defaultHardStopLossPercent
 */
export const DEFAULT_HARD_STOP_LOSS_PERCENT = tradingConfig.riskManagement.defaultHardStopLossPercent;

/**
 * Default take profit percentage for risk management.
 * Loaded from tradingConfig.riskManagement.defaultTakeProfitPercent
 */
export const DEFAULT_TAKE_PROFIT_PERCENT = tradingConfig.riskManagement.defaultTakeProfitPercent;

/**
 * Maximum number of stock symbols to analyze per trading cycle.
 * Limits computational load and API rate usage.
 */
export const MAX_STOCK_SYMBOLS_PER_CYCLE = tradingConfig.universe.maxStockSymbolsPerCycle;

/**
 * Maximum number of crypto symbols to analyze per trading cycle.
 * Limits computational load and API rate usage.
 */
export const MAX_CRYPTO_SYMBOLS_PER_CYCLE = tradingConfig.universe.maxCryptoSymbolsPerCycle;

/**
 * Number of symbols to request in each Alpaca snapshot API call.
 * Used for batching symbol requests to avoid rate limits.
 */
export const ALPACA_SNAPSHOT_CHUNK_SIZE = tradingConfig.universe.alpacaSnapshotChunkSize;

/**
 * Minimum AI confidence score (0-1) required for a symbol to be included in the trading universe.
 * Higher values increase selectivity but may reduce opportunities.
 */
export const MIN_CONFIDENCE_FOR_UNIVERSE = tradingConfig.universe.minConfidenceForUniverse;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Represents the symbols in the trading universe, categorized by asset type.
 *
 * The universe is built from multiple sources: watchlist, candidates database,
 * recent AI decisions, and executed trades. This interface tracks both the
 * final symbol lists and the contribution from each source.
 *
 * @interface UniverseSymbols
 * @property {string[]} stocks - Array of stock ticker symbols (e.g., ["AAPL", "MSFT"])
 * @property {string[]} crypto - Array of crypto symbols (e.g., ["BTC/USD", "ETH/USD"])
 * @property {Object} sources - Breakdown of how many symbols came from each source
 * @property {number} sources.watchlist - Count of symbols from user watchlist
 * @property {number} sources.candidates - Count of symbols from candidates database
 * @property {number} sources.recentDecisions - Count of symbols from recent AI decisions
 * @property {number} sources.executedTrades - Count of symbols from recently executed trades
 */
export interface UniverseSymbols {
  stocks: string[];
  crypto: string[];
  sources: {
    watchlist: number;
    candidates: number;
    recentDecisions: number;
    executedTrades: number;
  };
}

/**
 * Configuration for the autonomous orchestrator.
 *
 * Controls the timing and enablement of autonomous trading operations.
 *
 * @interface OrchestratorConfig
 * @property {number} analysisIntervalMs - Interval between market analysis cycles (milliseconds)
 * @property {number} positionCheckIntervalMs - Interval between position monitoring checks (milliseconds)
 * @property {boolean} enabled - Whether autonomous trading is enabled
 */
export interface OrchestratorConfig {
  analysisIntervalMs: number;
  positionCheckIntervalMs: number;
  enabled: boolean;
}

/**
 * Position with associated trading rules (stop loss, take profit, etc.).
 *
 * Represents an active trading position with risk management parameters.
 * Used by the orchestrator to monitor positions and enforce exit rules.
 *
 * @interface PositionWithRules
 * @property {string} symbol - Trading symbol (e.g., "AAPL", "BTC/USD")
 * @property {number} quantity - Total quantity held
 * @property {number} availableQuantity - Quantity available for trading (not in pending orders)
 * @property {number} entryPrice - Average entry price per unit
 * @property {number} currentPrice - Current market price per unit
 * @property {number} unrealizedPnl - Unrealized profit/loss in dollars
 * @property {number} unrealizedPnlPercent - Unrealized profit/loss as percentage
 * @property {number} [stopLossPrice] - Price at which to trigger stop loss exit
 * @property {number} [takeProfitPrice] - Price at which to trigger take profit exit
 * @property {number} [trailingStopPercent] - Trailing stop percentage (dynamic stop loss)
 * @property {number} [maxHoldingPeriodMs] - Maximum time to hold position (milliseconds)
 * @property {Date} openedAt - Timestamp when position was opened
 * @property {string} [strategyId] - Strategy that created this position
 */
export interface PositionWithRules {
  symbol: string;
  quantity: number;
  availableQuantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  trailingStopPercent?: number;
  maxHoldingPeriodMs?: number;
  openedAt: Date;
  strategyId?: string;
}

/**
 * Risk limits for position sizing and exposure management.
 *
 * Defines hard limits on position sizing, portfolio exposure, and daily losses
 * to prevent catastrophic losses and enforce risk discipline.
 *
 * @interface RiskLimits
 * @property {number} maxPositionSizePercent - Maximum portfolio % for a single position
 * @property {number} maxTotalExposurePercent - Maximum total portfolio exposure %
 * @property {number} maxPositionsCount - Maximum number of concurrent positions
 * @property {number} dailyLossLimitPercent - Maximum daily loss % before halting trading
 * @property {boolean} killSwitchActive - Emergency stop - halts all trading when true
 */
export interface RiskLimits {
  maxPositionSizePercent: number;
  maxTotalExposurePercent: number;
  maxPositionsCount: number;
  dailyLossLimitPercent: number;
  killSwitchActive: boolean;
}

/**
 * Result of an order execution attempt.
 *
 * Contains the outcome of attempting to execute a trading decision,
 * including success/failure status, order details, and reasoning.
 *
 * @interface ExecutionResult
 * @property {boolean} success - Whether the execution was successful
 * @property {string} [orderId] - Broker order ID if order was placed
 * @property {string} [error] - Error message if execution failed
 * @property {"buy" | "sell" | "hold" | "skip"} action - Action taken
 * @property {string} reason - Human-readable explanation of the outcome
 * @property {string} symbol - Trading symbol
 * @property {number} [quantity] - Order quantity if applicable
 * @property {number} [price] - Execution price if available
 */
export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  error?: string;
  action: "buy" | "sell" | "hold" | "skip";
  reason: string;
  symbol: string;
  quantity?: number;
  price?: number;
}

/**
 * Current state of the autonomous orchestrator.
 *
 * Maintains the runtime state of the trading system, including active positions,
 * pending signals, execution history, and performance metrics.
 *
 * @interface OrchestratorState
 * @property {boolean} isRunning - Whether the orchestrator is actively running
 * @property {"autonomous" | "semi-auto" | "manual"} mode - Current operating mode
 * @property {Date | null} lastAnalysisTime - Timestamp of last market analysis cycle
 * @property {Date | null} lastPositionCheckTime - Timestamp of last position monitoring check
 * @property {Map<string, PositionWithRules>} activePositions - Currently held positions by symbol
 * @property {Map<string, AIDecision>} pendingSignals - AI decisions awaiting execution
 * @property {ExecutionResult[]} executionHistory - History of execution attempts
 * @property {number} dailyPnl - Today's profit/loss in dollars
 * @property {number} dailyTradeCount - Number of trades executed today
 * @property {number} [portfolioValue] - Current portfolio value in dollars
 * @property {string[]} errors - Recent error messages
 */
export interface OrchestratorState {
  isRunning: boolean;
  mode: "autonomous" | "semi-auto" | "manual";
  lastAnalysisTime: Date | null;
  lastPositionCheckTime: Date | null;
  activePositions: Map<string, PositionWithRules>;
  pendingSignals: Map<string, AIDecision>;
  executionHistory: ExecutionResult[];
  dailyPnl: number;
  dailyTradeCount: number;
  portfolioValue?: number;
  errors: string[];
}

/**
 * State for rotating through symbols in the universe.
 *
 * When the universe contains more symbols than can be analyzed in a single cycle,
 * this state tracks rotation offsets to ensure all symbols get analyzed over time.
 *
 * @interface UniverseRotationState
 * @property {number} stockRotationOffset - Current offset in stock symbol rotation
 * @property {number} cryptoRotationOffset - Current offset in crypto symbol rotation
 * @property {Date} lastRotationTime - Timestamp of last rotation update
 */
export interface UniverseRotationState {
  stockRotationOffset: number;
  cryptoRotationOffset: number;
  lastRotationTime: Date;
}

/**
 * Result from queued order execution via work queue.
 *
 * Returned when an order is submitted through the work queue system,
 * providing both the broker order ID and work queue tracking ID.
 *
 * @interface QueuedOrderResult
 * @property {string} orderId - Broker-assigned order ID
 * @property {string} status - Order status (e.g., "filled", "accepted", "new")
 * @property {string} workItemId - Work queue item ID for tracking
 */
export interface QueuedOrderResult {
  orderId: string;
  status: string;
  workItemId: string;
}

/**
 * Pre-trade validation check result.
 *
 * Contains the results of validating whether a trade can be executed,
 * including market session info, buying power checks, and order type recommendations.
 *
 * @interface PreTradeCheck
 * @property {boolean} canTrade - Whether the trade can proceed
 * @property {string} [reason] - Explanation if trade cannot proceed
 * @property {"regular" | "pre_market" | "after_hours" | "closed"} marketSession - Current market session
 * @property {number} availableBuyingPower - Available buying power in dollars
 * @property {number} requiredBuyingPower - Required buying power for this trade
 * @property {boolean} useExtendedHours - Whether to use extended hours trading
 * @property {boolean} useLimitOrder - Whether a limit order should be used
 * @property {number} [limitPrice] - Recommended limit price if useLimitOrder is true
 */
export interface PreTradeCheck {
  canTrade: boolean;
  reason?: string;
  marketSession: "regular" | "pre_market" | "after_hours" | "closed";
  availableBuyingPower: number;
  requiredBuyingPower: number;
  useExtendedHours: boolean;
  useLimitOrder: boolean;
  limitPrice?: number;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default orchestrator configuration.
 *
 * Provides sensible defaults for autonomous trading intervals:
 * - Analysis every 60 seconds
 * - Position checks every 30 seconds
 * - Enabled by default
 *
 * @constant
 * @type {OrchestratorConfig}
 */
export const DEFAULT_CONFIG: OrchestratorConfig = {
  analysisIntervalMs: 60000,
  positionCheckIntervalMs: 30000,
  enabled: true,
};

/**
 * Default risk limits - values loaded from tradingConfig.
 *
 * Provides default risk management parameters:
 * - Position size and exposure limits from config
 * - Max 100 concurrent positions (enterprise-level aggressive setting)
 * - 5% daily loss limit for safety
 * - Kill switch disabled by default
 *
 * Note: maxPositionsCount is set to 100 for aggressive/enterprise-level trading.
 * Consider reducing for smaller accounts or conservative strategies.
 *
 * @constant
 * @type {RiskLimits}
 */
export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionSizePercent: tradingConfig.riskManagement.defaultMaxPositionSizePercent,
  maxTotalExposurePercent: tradingConfig.riskManagement.defaultMaxExposurePercent,
  maxPositionsCount: 100,              // AGGRESSIVE: Increased from 10 to enterprise-level 100 positions
  dailyLossLimitPercent: 5,            // Keep same for safety
  killSwitchActive: false,
};

// ============================================================================
// ADDITIONAL CONSTANTS
// ============================================================================

/**
 * Number of recent AI decisions to consider when building the trading universe.
 * Used to ensure recently analyzed symbols remain in scope for potential trades.
 *
 * @constant
 * @type {number}
 */
export const RECENT_DECISIONS_LOOKBACK = 500;
