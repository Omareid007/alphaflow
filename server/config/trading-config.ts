/**
 * AI Active Trader - Centralized Trading Configuration
 *
 * This file contains all trading-related configuration values with environment variable overrides.
 * Centralizing these values makes the system configurable without code changes.
 *
 * Configuration Categories:
 * 1. Alpaca Broker URLs (paper/live switching)
 * 2. Order Retry Configuration (exponential backoff, circuit breaker)
 * 3. Order Execution Configuration (polling, timeouts)
 * 4. Risk Management Configuration (stop loss, take profit, position sizing)
 * 5. Universe Configuration (symbol selection, confidence thresholds)
 * 6. Queue Configuration (polling intervals, heartbeats)
 */

import { getEnvFloat, getEnvString, getEnvBool } from "./env-helpers";

// ============================================================================
// ALPACA BROKER CONFIGURATION
// ============================================================================

/**
 * Alpaca broker URLs for paper trading, live trading, data feeds, and streaming.
 * Use ALPACA_TRADING_MODE environment variable to switch between 'paper' and 'live'.
 */
const alpacaConfig = Object.freeze({
  // Trading mode: 'paper' or 'live'
  tradingMode: getEnvString("ALPACA_TRADING_MODE", "paper") as "paper" | "live",

  // Paper trading URL (default for testing)
  paperUrl: getEnvString(
    "ALPACA_PAPER_URL",
    "https://paper-api.alpaca.markets"
  ),

  // Live trading URL (use with caution!)
  liveUrl: getEnvString("ALPACA_LIVE_URL", "https://api.alpaca.markets"),

  // Market data URL (same for both paper and live)
  dataUrl: getEnvString("ALPACA_DATA_URL", "https://data.alpaca.markets"),

  // WebSocket streaming URL (same for both paper and live)
  streamUrl: getEnvString(
    "ALPACA_STREAM_URL",
    "wss://stream.data.alpaca.markets"
  ),
});

// ============================================================================
// ORDER RETRY CONFIGURATION
// ============================================================================

/**
 * Order retry configuration for handling transient broker errors.
 * Implements exponential backoff and circuit breaker pattern.
 *
 * Circuit Breaker Pattern:
 * - Monitors failure rate within a time window
 * - Opens (stops retries) when threshold is exceeded
 * - Auto-resets after cooldown period
 */
const orderRetryConfig = Object.freeze({
  // Maximum number of retry attempts per order before giving up
  maxRetriesPerOrder: getEnvFloat("MAX_RETRIES_PER_ORDER", 3),

  // Base delay in milliseconds for exponential backoff (doubles each retry)
  // Formula: delay = retryBackoffBaseMs * 2^(attemptNumber - 1)
  // Example: 2000ms, 4000ms, 8000ms for 3 attempts
  retryBackoffBaseMs: getEnvFloat("RETRY_BACKOFF_BASE_MS", 2000),

  // Circuit breaker: number of failures before opening circuit
  circuitBreakerThreshold: getEnvFloat("CIRCUIT_BREAKER_THRESHOLD", 10),

  // Circuit breaker: time window in ms to count failures (1 minute default)
  circuitBreakerWindowMs: getEnvFloat("CIRCUIT_BREAKER_WINDOW_MS", 60000),

  // Circuit breaker: cooldown period before auto-reset (5 minutes default)
  circuitBreakerResetMs: getEnvFloat("CIRCUIT_BREAKER_RESET_MS", 300000),
});

// ============================================================================
// ORDER EXECUTION CONFIGURATION
// ============================================================================

/**
 * Order execution configuration for polling, timeouts, and staleness detection.
 *
 * Order Fill Polling:
 * - Polls broker API at regular intervals to check if order is filled
 * - Times out after maximum wait period
 *
 * Stale Order Detection:
 * - Orders older than threshold with no fills are considered stale
 * - Stale orders are automatically canceled to prevent unintended executions
 */
const orderExecutionConfig = Object.freeze({
  // Polling interval in ms to check if order is filled (500ms default)
  orderFillPollIntervalMs: getEnvFloat("ORDER_FILL_POLL_INTERVAL_MS", 500),

  // Maximum time in ms to wait for order fill before timing out (30 seconds default)
  orderFillTimeoutMs: getEnvFloat("ORDER_FILL_TIMEOUT_MS", 30000),

  // Maximum age in ms for unfilled orders before auto-cancellation (5 minutes default)
  staleOrderTimeoutMs: getEnvFloat("STALE_ORDER_TIMEOUT_MS", 300000),
});

// ============================================================================
// RISK MANAGEMENT CONFIGURATION
// ============================================================================

/**
 * Risk management configuration for position sizing and stop loss/take profit.
 *
 * Position Sizing:
 * - Max position size: percentage of portfolio per single position
 * - Max exposure: total percentage of portfolio deployed (can exceed 100% with margin)
 *
 * Stop Loss / Take Profit:
 * - Hard stop loss: automatic exit at loss threshold
 * - Take profit: automatic exit at profit target
 *
 * Examples:
 * - Conservative: 5% position size, 50% exposure, 2% stop loss, 4% take profit
 * - Moderate: 10% position size, 80% exposure, 3% stop loss, 6% take profit
 * - Aggressive: 15% position size, 200% exposure (margin), 3% stop loss, 6% take profit
 */
const riskManagementConfig = Object.freeze({
  // Default hard stop loss percentage (exit when position loses this much)
  defaultHardStopLossPercent: getEnvFloat("DEFAULT_HARD_STOP_LOSS_PERCENT", 3),

  // Default take profit percentage (exit when position gains this much)
  defaultTakeProfitPercent: getEnvFloat("DEFAULT_TAKE_PROFIT_PERCENT", 6),

  // Maximum position size as percentage of portfolio (10% = conservative, 15% = aggressive)
  defaultMaxPositionSizePercent: getEnvFloat(
    "DEFAULT_MAX_POSITION_SIZE_PERCENT",
    15
  ),

  // Maximum total exposure as percentage of portfolio
  // 100% = fully invested, 200% = 2x leverage (margin account)
  defaultMaxExposurePercent: getEnvFloat("DEFAULT_MAX_EXPOSURE_PERCENT", 200),
});

// ============================================================================
// UNIVERSE CONFIGURATION
// ============================================================================

/**
 * Universe configuration for symbol selection and analysis scope.
 *
 * Symbol Limits:
 * - Controls how many symbols to analyze per trading cycle
 * - Higher limits = more opportunities but slower analysis
 * - Lower limits = faster cycles but may miss opportunities
 *
 * Confidence Thresholds:
 * - Minimum AI confidence score to include symbol in trading universe
 * - Higher threshold = fewer but higher quality trades
 * - Lower threshold = more trades but potentially lower win rate
 *
 * Alpaca Snapshot Chunk Size:
 * - API batch size for fetching market data snapshots
 * - Alpaca supports max 100 symbols per request
 * - Smaller chunks = more requests but better error handling
 */
const universeConfig = Object.freeze({
  // Maximum number of stock symbols to analyze per cycle
  // Conservative: 120, Moderate: 300, Aggressive: 500
  maxStockSymbolsPerCycle: getEnvFloat("MAX_STOCK_SYMBOLS_PER_CYCLE", 500),

  // Maximum number of crypto symbols to analyze per cycle
  // Conservative: 20, Moderate: 50, Aggressive: 100
  maxCryptoSymbolsPerCycle: getEnvFloat("MAX_CRYPTO_SYMBOLS_PER_CYCLE", 100),

  // Minimum AI confidence score (0-1) to include symbol in universe
  // Conservative: 0.70, Moderate: 0.60, Aggressive: 0.50
  minConfidenceForUniverse: getEnvFloat("MIN_CONFIDENCE_FOR_UNIVERSE", 0.5),

  // Number of symbols to fetch per Alpaca snapshot API request
  // Max supported: 100, Recommended: 50 for reliability
  alpacaSnapshotChunkSize: getEnvFloat("ALPACA_SNAPSHOT_CHUNK_SIZE", 50),
});

// ============================================================================
// QUEUE CONFIGURATION
// ============================================================================

/**
 * Queue configuration for work queue polling and heartbeat monitoring.
 *
 * Work Queue:
 * - Asynchronous task processing for order execution
 * - Polls queue at regular intervals for pending work
 * - Times out tasks that exceed maximum processing time
 *
 * Heartbeat:
 * - Regular health check signals to detect stalled workers
 * - Used for monitoring and alerting
 */
const queueConfig = Object.freeze({
  // Interval in ms to poll work queue for pending tasks (2 seconds default)
  queuePollIntervalMs: getEnvFloat("QUEUE_POLL_INTERVAL_MS", 2000),

  // Maximum time in ms for a work item to complete before timing out (1 minute default)
  queuePollTimeoutMs: getEnvFloat("QUEUE_POLL_TIMEOUT_MS", 60000),

  // Interval in ms to send heartbeat signals (30 seconds default)
  heartbeatIntervalMs: getEnvFloat("HEARTBEAT_INTERVAL_MS", 30000),
});

// ============================================================================
// CONSOLIDATED CONFIGURATION OBJECT
// ============================================================================

/**
 * Consolidated trading configuration object (frozen to prevent mutations).
 * Import this object to access all trading configuration values.
 *
 * Usage:
 * ```typescript
 * import { tradingConfig } from './config/trading-config';
 *
 * const maxRetries = tradingConfig.orderRetry.maxRetriesPerOrder;
 * const stopLoss = tradingConfig.riskManagement.defaultHardStopLossPercent;
 * const baseUrl = tradingConfig.alpaca.paperUrl;
 * ```
 */
export const tradingConfig = Object.freeze({
  alpaca: alpacaConfig,
  orderRetry: orderRetryConfig,
  orderExecution: orderExecutionConfig,
  riskManagement: riskManagementConfig,
  universe: universeConfig,
  queue: queueConfig,
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the active Alpaca base URL based on trading mode.
 *
 * @returns The appropriate Alpaca API URL (paper or live)
 *
 * Usage:
 * ```typescript
 * import { getAlpacaBaseUrl } from './config/trading-config';
 *
 * const baseUrl = getAlpacaBaseUrl();
 * // Returns: 'https://paper-api.alpaca.markets' (if mode is 'paper')
 * // Returns: 'https://api.alpaca.markets' (if mode is 'live')
 * ```
 */
export function getAlpacaBaseUrl(): string {
  return tradingConfig.alpaca.tradingMode === "live"
    ? tradingConfig.alpaca.liveUrl
    : tradingConfig.alpaca.paperUrl;
}

/**
 * Get a human-readable summary of the current configuration.
 * Useful for logging on startup and debugging.
 *
 * @returns Configuration summary object
 */
export function getConfigSummary(): Record<string, any> {
  return {
    tradingMode: tradingConfig.alpaca.tradingMode,
    alpacaUrl: getAlpacaBaseUrl(),
    riskProfile: {
      maxPositionSize: `${tradingConfig.riskManagement.defaultMaxPositionSizePercent}%`,
      maxExposure: `${tradingConfig.riskManagement.defaultMaxExposurePercent}%`,
      stopLoss: `${tradingConfig.riskManagement.defaultHardStopLossPercent}%`,
      takeProfit: `${tradingConfig.riskManagement.defaultTakeProfitPercent}%`,
    },
    universe: {
      maxStocks: tradingConfig.universe.maxStockSymbolsPerCycle,
      maxCrypto: tradingConfig.universe.maxCryptoSymbolsPerCycle,
      minConfidence: tradingConfig.universe.minConfidenceForUniverse,
    },
    orderRetry: {
      maxRetries: tradingConfig.orderRetry.maxRetriesPerOrder,
      backoffBaseMs: tradingConfig.orderRetry.retryBackoffBaseMs,
      circuitBreakerThreshold: tradingConfig.orderRetry.circuitBreakerThreshold,
    },
  };
}

/**
 * Validate trading configuration on startup.
 * Throws error if configuration is invalid.
 *
 * @throws Error if configuration is invalid
 */
export function validateTradingConfig(): void {
  const errors: string[] = [];

  // Validate trading mode
  if (!["paper", "live"].includes(tradingConfig.alpaca.tradingMode)) {
    errors.push(
      `Invalid trading mode: ${tradingConfig.alpaca.tradingMode}. Must be 'paper' or 'live'.`
    );
  }

  // Validate URLs
  if (!tradingConfig.alpaca.paperUrl.startsWith("http")) {
    errors.push(`Invalid paper URL: ${tradingConfig.alpaca.paperUrl}`);
  }
  if (!tradingConfig.alpaca.liveUrl.startsWith("http")) {
    errors.push(`Invalid live URL: ${tradingConfig.alpaca.liveUrl}`);
  }

  // Validate retry config
  if (
    tradingConfig.orderRetry.maxRetriesPerOrder < 0 ||
    tradingConfig.orderRetry.maxRetriesPerOrder > 10
  ) {
    errors.push(
      `Max retries must be between 0 and 10, got: ${tradingConfig.orderRetry.maxRetriesPerOrder}`
    );
  }
  if (
    tradingConfig.orderRetry.retryBackoffBaseMs < 100 ||
    tradingConfig.orderRetry.retryBackoffBaseMs > 30000
  ) {
    errors.push(
      `Retry backoff base must be between 100ms and 30000ms, got: ${tradingConfig.orderRetry.retryBackoffBaseMs}`
    );
  }

  // Validate execution config
  if (
    tradingConfig.orderExecution.orderFillPollIntervalMs < 100 ||
    tradingConfig.orderExecution.orderFillPollIntervalMs > 5000
  ) {
    errors.push(
      `Poll interval must be between 100ms and 5000ms, got: ${tradingConfig.orderExecution.orderFillPollIntervalMs}`
    );
  }

  // Validate risk config
  if (
    tradingConfig.riskManagement.defaultHardStopLossPercent <= 0 ||
    tradingConfig.riskManagement.defaultHardStopLossPercent > 50
  ) {
    errors.push(
      `Stop loss percent must be between 0 and 50, got: ${tradingConfig.riskManagement.defaultHardStopLossPercent}`
    );
  }
  if (
    tradingConfig.riskManagement.defaultTakeProfitPercent <= 0 ||
    tradingConfig.riskManagement.defaultTakeProfitPercent > 100
  ) {
    errors.push(
      `Take profit percent must be between 0 and 100, got: ${tradingConfig.riskManagement.defaultTakeProfitPercent}`
    );
  }
  if (
    tradingConfig.riskManagement.defaultMaxPositionSizePercent <= 0 ||
    tradingConfig.riskManagement.defaultMaxPositionSizePercent > 100
  ) {
    errors.push(
      `Max position size must be between 0 and 100, got: ${tradingConfig.riskManagement.defaultMaxPositionSizePercent}`
    );
  }

  // Validate universe config
  if (
    tradingConfig.universe.maxStockSymbolsPerCycle < 1 ||
    tradingConfig.universe.maxStockSymbolsPerCycle > 10000
  ) {
    errors.push(
      `Max stock symbols must be between 1 and 10000, got: ${tradingConfig.universe.maxStockSymbolsPerCycle}`
    );
  }
  if (
    tradingConfig.universe.minConfidenceForUniverse < 0 ||
    tradingConfig.universe.minConfidenceForUniverse > 1
  ) {
    errors.push(
      `Min confidence must be between 0 and 1, got: ${tradingConfig.universe.minConfidenceForUniverse}`
    );
  }
  if (
    tradingConfig.universe.alpacaSnapshotChunkSize < 1 ||
    tradingConfig.universe.alpacaSnapshotChunkSize > 100
  ) {
    errors.push(
      `Snapshot chunk size must be between 1 and 100, got: ${tradingConfig.universe.alpacaSnapshotChunkSize}`
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Trading configuration validation failed:\n${errors.join("\n")}`
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Re-export individual config sections for convenient access
 */
export {
  alpacaConfig,
  orderRetryConfig,
  orderExecutionConfig,
  riskManagementConfig,
  universeConfig,
  queueConfig,
};

/**
 * Default export: consolidated trading config
 */
export default tradingConfig;
