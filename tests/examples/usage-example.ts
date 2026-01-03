/**
 * AI Active Trader - Trading Configuration Usage Examples
 *
 * This file demonstrates how to use the centralized trading configuration
 * in various parts of the trading system.
 *
 * DO NOT import this file in production code - it's for demonstration only!
 */

import {
  tradingConfig,
  getAlpacaBaseUrl,
  getConfigSummary,
  validateTradingConfig,
} from "./trading-config";

// ============================================================================
// EXAMPLE 1: Startup Validation
// ============================================================================

/**
 * Validate configuration on application startup
 */
function exampleStartupValidation(): void {
  try {
    // Validate configuration
    validateTradingConfig();
    console.log("✓ Trading configuration is valid");

    // Log configuration summary
    const summary = getConfigSummary();
    console.log("Trading Configuration Summary:");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error("✗ Configuration validation failed:", error);
    process.exit(1);
  }
}

// ============================================================================
// EXAMPLE 2: Alpaca Client Initialization
// ============================================================================

/**
 * Initialize Alpaca client with configuration
 */
function exampleAlpacaClientInit(): void {
  const baseUrl = getAlpacaBaseUrl();
  const tradingMode = tradingConfig.alpaca.tradingMode;

  console.log(`Initializing Alpaca client in ${tradingMode} mode`);
  console.log(`API URL: ${baseUrl}`);
  console.log(`Data URL: ${tradingConfig.alpaca.dataUrl}`);
  console.log(`Stream URL: ${tradingConfig.alpaca.streamUrl}`);

  // Warning for live trading
  if (tradingMode === "live") {
    console.warn("⚠️  WARNING: Using LIVE trading mode with REAL MONEY!");
  }
}

// ============================================================================
// EXAMPLE 3: Order Retry Handler
// ============================================================================

/**
 * Implement order retry logic with exponential backoff
 */
async function exampleOrderRetryHandler(
  orderFn: () => Promise<any>,
  orderId: string
): Promise<any> {
  const { maxRetriesPerOrder, retryBackoffBaseMs } = tradingConfig.orderRetry;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetriesPerOrder; attempt++) {
    try {
      console.log(
        `Attempt ${attempt}/${maxRetriesPerOrder} for order ${orderId}`
      );
      return await orderFn();
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt < maxRetriesPerOrder) {
        // Exponential backoff: base * 2^(attempt - 1)
        const delayMs = retryBackoffBaseMs * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }

  throw new Error(
    `Order ${orderId} failed after ${maxRetriesPerOrder} attempts: ${lastError?.message}`
  );
}

// ============================================================================
// EXAMPLE 4: Circuit Breaker Implementation
// ============================================================================

/**
 * Simple circuit breaker implementation using configuration
 */
class OrderCircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: Date | null = null;
  private isOpen: boolean = false;
  private resetTime: Date | null = null;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const config = tradingConfig.orderRetry;

    // Check if circuit breaker needs reset
    if (this.resetTime && Date.now() >= this.resetTime.getTime()) {
      console.log("Circuit breaker auto-reset");
      this.reset();
    }

    // Reject if circuit is open
    if (this.isOpen) {
      throw new Error(
        `Circuit breaker is open. Resets at ${this.resetTime?.toISOString()}`
      );
    }

    // Check if we're within the failure window
    if (this.lastFailureTime) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
      if (timeSinceLastFailure > config.circuitBreakerWindowMs) {
        // Outside window, reset counter
        this.failures = 0;
      }
    }

    try {
      const result = await fn();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    const config = tradingConfig.orderRetry;
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.failures >= config.circuitBreakerThreshold) {
      this.isOpen = true;
      this.resetTime = new Date(Date.now() + config.circuitBreakerResetMs);
      console.error(
        `Circuit breaker OPENED after ${this.failures} failures. ` +
          `Will reset at ${this.resetTime.toISOString()}`
      );
    }
  }

  private reset(): void {
    this.failures = 0;
    this.lastFailureTime = null;
    this.isOpen = false;
    this.resetTime = null;
  }
}

// ============================================================================
// EXAMPLE 5: Order Fill Polling
// ============================================================================

/**
 * Poll order status until filled or timeout
 */
async function exampleWaitForOrderFill(orderId: string): Promise<any> {
  const { orderFillPollIntervalMs, orderFillTimeoutMs } =
    tradingConfig.orderExecution;

  const startTime = Date.now();

  while (Date.now() - startTime < orderFillTimeoutMs) {
    // Mock order status check
    const order = await mockGetOrder(orderId);

    if (order.status === "filled") {
      console.log(`Order ${orderId} filled after ${Date.now() - startTime}ms`);
      return order;
    }

    if (["canceled", "rejected", "expired"].includes(order.status)) {
      throw new Error(`Order ${orderId} ended with status: ${order.status}`);
    }

    // Wait before next poll
    await sleep(orderFillPollIntervalMs);
  }

  throw new Error(
    `Order ${orderId} fill timeout after ${orderFillTimeoutMs}ms`
  );
}

// ============================================================================
// EXAMPLE 6: Risk Management Calculations
// ============================================================================

/**
 * Calculate position sizes and risk parameters
 */
function exampleRiskManagement(portfolioValue: number, entryPrice: number) {
  const {
    defaultHardStopLossPercent,
    defaultTakeProfitPercent,
    defaultMaxPositionSizePercent,
    defaultMaxExposurePercent,
  } = tradingConfig.riskManagement;

  // Calculate maximum position size
  const maxPositionValue =
    portfolioValue * (defaultMaxPositionSizePercent / 100);
  const maxShares = Math.floor(maxPositionValue / entryPrice);

  // Calculate stop loss and take profit prices
  const stopLossPrice = entryPrice * (1 - defaultHardStopLossPercent / 100);
  const takeProfitPrice = entryPrice * (1 + defaultTakeProfitPercent / 100);

  // Calculate maximum portfolio exposure
  const maxExposureValue = portfolioValue * (defaultMaxExposurePercent / 100);

  console.log("Risk Management Parameters:");
  console.log(`  Portfolio Value: $${portfolioValue.toFixed(2)}`);
  console.log(`  Entry Price: $${entryPrice.toFixed(2)}`);
  console.log(`  Max Position Size: ${defaultMaxPositionSizePercent}%`);
  console.log(`  Max Position Value: $${maxPositionValue.toFixed(2)}`);
  console.log(`  Max Shares: ${maxShares}`);
  console.log(
    `  Stop Loss: $${stopLossPrice.toFixed(2)} (-${defaultHardStopLossPercent}%)`
  );
  console.log(
    `  Take Profit: $${takeProfitPrice.toFixed(2)} (+${defaultTakeProfitPercent}%)`
  );
  console.log(`  Max Exposure: ${defaultMaxExposurePercent}%`);
  console.log(`  Max Exposure Value: $${maxExposureValue.toFixed(2)}`);

  return {
    maxShares,
    stopLossPrice,
    takeProfitPrice,
    maxPositionValue,
    maxExposureValue,
  };
}

// ============================================================================
// EXAMPLE 7: Universe Selection
// ============================================================================

/**
 * Filter trading candidates by configuration parameters
 */
function exampleUniverseSelection(
  stockCandidates: Array<{ symbol: string; confidence: number }>,
  cryptoCandidates: Array<{ symbol: string; confidence: number }>
) {
  const {
    maxStockSymbolsPerCycle,
    maxCryptoSymbolsPerCycle,
    minConfidenceForUniverse,
  } = tradingConfig.universe;

  // Filter by confidence threshold
  const qualifiedStocks = stockCandidates.filter(
    (c) => c.confidence >= minConfidenceForUniverse
  );
  const qualifiedCrypto = cryptoCandidates.filter(
    (c) => c.confidence >= minConfidenceForUniverse
  );

  // Sort by confidence (highest first)
  qualifiedStocks.sort((a, b) => b.confidence - a.confidence);
  qualifiedCrypto.sort((a, b) => b.confidence - a.confidence);

  // Limit to max symbols per cycle
  const selectedStocks = qualifiedStocks.slice(0, maxStockSymbolsPerCycle);
  const selectedCrypto = qualifiedCrypto.slice(0, maxCryptoSymbolsPerCycle);

  console.log("Universe Selection:");
  console.log(
    `  Stock Candidates: ${stockCandidates.length} → Qualified: ${qualifiedStocks.length} → Selected: ${selectedStocks.length}`
  );
  console.log(
    `  Crypto Candidates: ${cryptoCandidates.length} → Qualified: ${qualifiedCrypto.length} → Selected: ${selectedCrypto.length}`
  );
  console.log(`  Min Confidence Threshold: ${minConfidenceForUniverse}`);

  return {
    stocks: selectedStocks,
    crypto: selectedCrypto,
  };
}

// ============================================================================
// EXAMPLE 8: Stale Order Cleanup
// ============================================================================

/**
 * Cancel orders older than the stale threshold
 */
async function exampleStaleOrderCleanup(orders: Array<any>): Promise<number> {
  const { staleOrderTimeoutMs } = tradingConfig.orderExecution;
  const now = Date.now();
  let canceledCount = 0;

  for (const order of orders) {
    const orderAge = now - new Date(order.created_at).getTime();

    if (orderAge > staleOrderTimeoutMs && order.status === "pending") {
      try {
        await mockCancelOrder(order.id);
        canceledCount++;
        console.log(
          `Canceled stale order ${order.id} (age: ${Math.floor(orderAge / 1000)}s)`
        );
      } catch (error) {
        console.error(`Failed to cancel order ${order.id}:`, error);
      }
    }
  }

  console.log(`Cleaned up ${canceledCount} stale orders`);
  return canceledCount;
}

// ============================================================================
// EXAMPLE 9: Work Queue Polling
// ============================================================================

/**
 * Poll work queue at configured interval
 */
function exampleWorkQueuePoller(): void {
  const { queuePollIntervalMs, queuePollTimeoutMs } = tradingConfig.queue;

  console.log(
    `Starting work queue poller (interval: ${queuePollIntervalMs}ms)`
  );

  setInterval(async () => {
    try {
      const workItems = await mockGetWorkItems();

      for (const item of workItems) {
        const startTime = Date.now();

        try {
          await mockProcessWorkItem(item);

          const duration = Date.now() - startTime;
          if (duration > queuePollTimeoutMs) {
            console.warn(
              `Work item ${item.id} exceeded timeout (${duration}ms > ${queuePollTimeoutMs}ms)`
            );
          }
        } catch (error) {
          console.error(`Work item ${item.id} failed:`, error);
        }
      }
    } catch (error) {
      console.error("Queue polling error:", error);
    }
  }, queuePollIntervalMs);
}

// ============================================================================
// EXAMPLE 10: Complete Trading Flow
// ============================================================================

/**
 * Complete example showing configuration usage across trading flow
 */
async function exampleCompleteTradingFlow(): Promise<void> {
  console.log("=== Complete Trading Flow Example ===\n");

  // 1. Validate configuration
  validateTradingConfig();
  console.log("✓ Configuration validated\n");

  // 2. Log configuration summary
  const summary = getConfigSummary();
  console.log("Configuration:", summary, "\n");

  // 3. Risk calculations
  const portfolioValue = 100000;
  const entryPrice = 150.0;
  const risk = exampleRiskManagement(portfolioValue, entryPrice);
  console.log("");

  // 4. Place order with retry
  const circuitBreaker = new OrderCircuitBreaker();

  try {
    const order = await circuitBreaker.execute(async () => {
      return await exampleOrderRetryHandler(
        async () => mockPlaceOrder("AAPL", risk.maxShares),
        "order-123"
      );
    });

    console.log("✓ Order placed:", order, "\n");

    // 5. Wait for fill
    const filledOrder = await exampleWaitForOrderFill(order.id);
    console.log("✓ Order filled:", filledOrder, "\n");
  } catch (error) {
    console.error("✗ Order failed:", error, "\n");
  }

  // 6. Clean up stale orders
  const staleOrders = await mockGetOrders();
  await exampleStaleOrderCleanup(staleOrders);
}

// ============================================================================
// MOCK FUNCTIONS (for demonstration only)
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mockGetOrder(orderId: string): Promise<any> {
  await sleep(100);
  return {
    id: orderId,
    status: Math.random() > 0.5 ? "filled" : "pending",
    filled_qty: "10",
    filled_avg_price: "150.00",
  };
}

async function mockPlaceOrder(symbol: string, qty: number): Promise<any> {
  await sleep(100);
  return { id: `order-${Date.now()}`, symbol, qty, status: "pending" };
}

async function mockCancelOrder(orderId: string): Promise<void> {
  await sleep(100);
}

async function mockGetOrders(): Promise<any[]> {
  return [
    {
      id: "order-1",
      status: "pending",
      created_at: new Date(Date.now() - 600000).toISOString(),
    },
  ];
}

async function mockGetWorkItems(): Promise<any[]> {
  return [{ id: "work-1", type: "order" }];
}

async function mockProcessWorkItem(item: any): Promise<void> {
  await sleep(100);
}

// ============================================================================
// MAIN
// ============================================================================

if (require.main === module) {
  console.log("Running trading configuration examples...\n");

  // Run examples
  exampleStartupValidation();
  console.log("\n" + "=".repeat(60) + "\n");

  exampleAlpacaClientInit();
  console.log("\n" + "=".repeat(60) + "\n");

  exampleRiskManagement(100000, 150);
  console.log("\n" + "=".repeat(60) + "\n");

  const mockStocks = [
    { symbol: "AAPL", confidence: 0.8 },
    { symbol: "MSFT", confidence: 0.6 },
    { symbol: "GOOGL", confidence: 0.4 },
  ];
  const mockCrypto = [
    { symbol: "BTC", confidence: 0.7 },
    { symbol: "ETH", confidence: 0.5 },
  ];
  exampleUniverseSelection(mockStocks, mockCrypto);

  console.log("\n" + "=".repeat(60) + "\n");
  console.log("Examples completed!");
}
