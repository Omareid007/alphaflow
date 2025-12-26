/**
 * Order Retry Handler - Usage Examples
 *
 * Demonstrates various use cases and integration patterns
 */

import {
  handleOrderRejection,
  registerRejectionHandler,
  getRetryStats,
  testRejectionReason,
  resetCircuitBreaker,
  type RejectionHandler,
  type AlpacaTradeUpdate,
} from "./order-retry-handler";

/**
 * Example 1: Custom Handler for Crypto-Specific Errors
 */
export function registerCryptoHandlers() {
  // Crypto trading is 24/7, but may have different restrictions
  const cryptoHandler: RejectionHandler = {
    pattern: /crypto.*(?:not.*available|suspended)/i,
    category: "symbol_invalid",
    description: "Crypto trading temporarily unavailable",
    fix: async (order, reason) => {
      // Could retry with a different crypto pair
      // or wait for maintenance to complete
      return null; // For now, cannot auto-fix
    },
  };

  registerRejectionHandler(cryptoHandler);
  console.log("Registered crypto-specific rejection handler");
}

/**
 * Example 2: Position Size Handler
 */
export function registerPositionSizeHandler() {
  const handler: RejectionHandler = {
    pattern: /position.*(?:too.*large|exceeds.*limit)/i,
    category: "position_limits",
    description: "Position size exceeds broker limits",
    fix: async (order, reason) => {
      // Extract max position size from error message if available
      const currentQty = parseFloat(order.order.qty);
      const reducedQty = Math.floor(currentQty * 0.5); // Try 50% of original

      if (reducedQty < 1) {
        return null; // Cannot reduce further
      }

      return {
        params: {
          symbol: order.order.symbol,
          side: order.order.side as "buy" | "sell",
          qty: reducedQty.toString(),
          type: order.order.type as any,
          time_in_force: order.order.time_in_force as any,
          limit_price: order.order.limit_price || undefined,
        },
        explanation: `Reduced position size to ${reducedQty} shares (50% of original)`,
        confidence: "medium",
      };
    },
  };

  registerRejectionHandler(handler);
  console.log("Registered position size handler");
}

/**
 * Example 3: Pre-Market Trading Handler
 */
export function registerPreMarketHandler() {
  const handler: RejectionHandler = {
    pattern: /pre.*market.*(?:not.*allowed|restricted)/i,
    category: "market_hours",
    description: "Pre-market trading not allowed for this account",
    fix: async (order, reason) => {
      // Convert to regular market hours order
      return {
        params: {
          symbol: order.order.symbol,
          side: order.order.side as "buy" | "sell",
          qty: order.order.qty,
          type: "limit",
          time_in_force: "day",
          limit_price: order.order.limit_price || undefined,
          extended_hours: false, // Disable extended hours
        },
        explanation: "Converted to regular market hours order (no pre-market)",
        confidence: "high",
      };
    },
  };

  registerRejectionHandler(handler);
  console.log("Registered pre-market handler");
}

/**
 * Example 4: Testing Rejection Reasons
 */
export async function testRejectionPatterns() {
  const testCases = [
    "market orders not allowed during extended hours",
    "limit price too aggressive",
    "insufficient buying power",
    "fractional shares not supported",
    "account blocked",
    "symbol INVALID not found",
  ];

  console.log("\n=== Testing Rejection Patterns ===\n");

  for (const reason of testCases) {
    const result = testRejectionReason(reason);
    console.log(`Reason: "${reason}"`);
    console.log(`  Matched: ${result.matched}`);
    if (result.matched) {
      console.log(`  Category: ${result.category}`);
      console.log(`  Handler: ${result.handler?.description}`);
    }
    console.log();
  }
}

/**
 * Example 5: Monitoring and Alerting
 */
export function setupRetryMonitoring() {
  // Check stats every 60 seconds
  setInterval(() => {
    const stats = getRetryStats();

    // Calculate success rate
    const successRate =
      stats.totalRetries > 0
        ? (stats.successfulRetries / stats.totalRetries) * 100
        : 100;

    console.log("\n=== Retry Handler Stats ===");
    console.log(`Total Retries: ${stats.totalRetries}`);
    console.log(`Successful: ${stats.successfulRetries}`);
    console.log(`Failed: ${stats.failedRetries}`);
    console.log(`Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`Active Retries: ${stats.activeRetries}`);
    console.log(
      `Circuit Breaker: ${stats.circuitBreakerState.isOpen ? "OPEN ⚠️" : "CLOSED ✓"}`
    );

    // Alert on low success rate
    if (successRate < 70 && stats.totalRetries > 10) {
      console.warn(`⚠️ WARNING: Retry success rate below 70% (${successRate.toFixed(1)}%)`);
    }

    // Alert on circuit breaker
    if (stats.circuitBreakerState.isOpen) {
      console.error("🚨 ALERT: Circuit breaker is OPEN - retries are blocked!");
      console.error(
        `   Failures: ${stats.circuitBreakerState.failures} in last minute`
      );
      console.error(
        `   Will reset at: ${stats.circuitBreakerState.resetTime?.toISOString()}`
      );
    }

    console.log();
  }, 60000);
}

/**
 * Example 6: Manual Retry Workflow
 */
export async function manualRetryWorkflow(orderId: string) {
  console.log(`\n=== Manual Retry for Order ${orderId} ===\n`);

  // Simulate fetching order details
  const mockOrder: AlpacaTradeUpdate = {
    event: "rejected",
    order: {
      id: orderId,
      client_order_id: `client-${orderId}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      filled_at: null,
      expired_at: null,
      canceled_at: null,
      failed_at: new Date().toISOString(),
      asset_id: "test-asset",
      symbol: "AAPL",
      asset_class: "us_equity",
      notional: null,
      qty: "10",
      filled_qty: "0",
      filled_avg_price: null,
      order_class: "simple",
      order_type: "market",
      type: "market",
      side: "buy",
      time_in_force: "day",
      limit_price: null,
      stop_price: null,
      status: "rejected",
      extended_hours: true,
    },
    timestamp: new Date().toISOString(),
  };

  // Trigger manual retry
  const result = await handleOrderRejection(
    mockOrder,
    "market orders not allowed during extended hours"
  );

  console.log(`Result: ${result.success ? "SUCCESS ✓" : "FAILED ✗"}`);
  console.log(`Status: ${result.finalStatus}`);
  if (result.success) {
    console.log(`New Order ID: ${result.newOrderId}`);
  } else {
    console.log(`Error: ${result.error}`);
  }

  console.log(`\nAttempts:`);
  result.attempts.forEach((attempt, i) => {
    console.log(`  ${i + 1}. ${attempt.fix}`);
    console.log(`     Result: ${attempt.success ? "Success" : "Failed"}`);
    if (attempt.error) {
      console.log(`     Error: ${attempt.error}`);
    }
  });
}

/**
 * Example 7: Integration with Trading Strategy
 */
export class RetryAwareTradingStrategy {
  private retryAttempts = new Map<string, number>();

  async submitOrder(params: any): Promise<{ success: boolean; orderId?: string }> {
    try {
      // Submit order via normal flow
      // This is just a placeholder
      const orderId = "mock-order-id";

      // The retry handler will automatically kick in if rejected
      // We just track our own attempts for strategy purposes
      this.retryAttempts.set(orderId, 0);

      return { success: true, orderId };
    } catch (error) {
      console.error("Order submission failed:", error);
      return { success: false };
    }
  }

  async onOrderUpdate(orderId: string, status: string) {
    if (status === "rejected" || status === "canceled") {
      const attempts = this.retryAttempts.get(orderId) || 0;
      console.log(`Order ${orderId} ${status} (attempt ${attempts + 1})`);

      // Retry handler will automatically process this
      // We just update our tracking
      this.retryAttempts.set(orderId, attempts + 1);

      if (attempts >= 3) {
        console.warn(`Order ${orderId} failed after 3 attempts - strategy may need adjustment`);
        this.retryAttempts.delete(orderId);
      }
    } else if (status === "filled") {
      // Success - clean up tracking
      this.retryAttempts.delete(orderId);
    }
  }

  getStats() {
    return {
      activeRetries: this.retryAttempts.size,
      ordersByAttempts: Array.from(this.retryAttempts.entries()).reduce(
        (acc, [orderId, attempts]) => {
          acc[attempts] = (acc[attempts] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>
      ),
    };
  }
}

/**
 * Example 8: Circuit Breaker Recovery
 */
export async function handleCircuitBreakerRecovery() {
  const stats = getRetryStats();

  if (stats.circuitBreakerState.isOpen) {
    console.log("🔧 Circuit breaker is open - investigating...");

    // Check if it's a temporary issue
    const resetTime = stats.circuitBreakerState.resetTime;
    if (resetTime) {
      const minutesUntilReset = Math.ceil(
        (resetTime.getTime() - Date.now()) / 60000
      );
      console.log(`   Auto-reset in ${minutesUntilReset} minutes`);

      // Option 1: Wait for auto-reset
      console.log("   Option 1: Wait for auto-reset");

      // Option 2: Manual investigation and reset
      console.log("   Option 2: Investigate and manually reset");
      console.log("   - Check broker status");
      console.log("   - Review error logs");
      console.log("   - Verify market conditions");
      console.log("   - If safe, call resetCircuitBreaker()");
    }

    // Log recent failures
    console.log(`\n   Recent failures: ${stats.circuitBreakerState.failures}`);
    console.log(
      `   Last failure: ${stats.circuitBreakerState.lastFailureTime?.toISOString()}`
    );
  } else {
    console.log("✓ Circuit breaker is closed - normal operation");
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log("\n" + "=".repeat(60));
  console.log("Order Retry Handler - Examples");
  console.log("=".repeat(60) + "\n");

  // Register custom handlers
  registerCryptoHandlers();
  registerPositionSizeHandler();
  registerPreMarketHandler();

  // Test rejection patterns
  await testRejectionPatterns();

  // Check circuit breaker status
  await handleCircuitBreakerRecovery();

  // Display current stats
  const stats = getRetryStats();
  console.log("\n=== Current Statistics ===");
  console.log(JSON.stringify(stats, null, 2));

  console.log("\n" + "=".repeat(60));
  console.log("Examples complete!");
  console.log("=".repeat(60) + "\n");
}

// Export for use in other modules
export default {
  registerCryptoHandlers,
  registerPositionSizeHandler,
  registerPreMarketHandler,
  testRejectionPatterns,
  setupRetryMonitoring,
  manualRetryWorkflow,
  RetryAwareTradingStrategy,
  handleCircuitBreakerRecovery,
  runAllExamples,
};
