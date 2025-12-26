import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  handleOrderRejection,
  registerRejectionHandler,
  getRetryStats,
  clearRetryHistory,
  resetCircuitBreaker,
  testRejectionReason,
  type AlpacaTradeUpdate,
  type RejectionHandler,
} from "../../server/trading/order-retry-handler";

/**
 * Test suite for order retry handler
 */

describe("Order Retry Handler", () => {
  beforeEach(() => {
    // Reset state before each test
    vi.clearAllMocks();
  });

  describe("Rejection Pattern Matching", () => {
    it("should match market hours rejection", () => {
      const reason = "market orders not allowed during extended hours";
      const result = testRejectionReason(reason);

      expect(result.matched).toBe(true);
      expect(result.category).toBe("market_hours");
    });

    it("should match price validation rejection", () => {
      const reason = "limit price too aggressive";
      const result = testRejectionReason(reason);

      expect(result.matched).toBe(true);
      expect(result.category).toBe("price_validation");
    });

    it("should match insufficient funds rejection", () => {
      const reason = "insufficient buying power";
      const result = testRejectionReason(reason);

      expect(result.matched).toBe(true);
      expect(result.category).toBe("insufficient_funds");
    });

    it("should match fractional shares rejection", () => {
      const reason = "fractional shares not supported";
      const result = testRejectionReason(reason);

      expect(result.matched).toBe(true);
      expect(result.category).toBe("order_type");
    });

    it("should not match unknown patterns", () => {
      const reason = "some unknown error";
      const result = testRejectionReason(reason);

      expect(result.matched).toBe(false);
    });
  });

  describe("Custom Handler Registration", () => {
    it("should allow registering custom handlers", () => {
      const customHandler: RejectionHandler = {
        pattern: /custom.*error/i,
        category: "unknown",
        description: "Custom test handler",
        fix: async () => null,
      };

      registerRejectionHandler(customHandler);

      const result = testRejectionReason("custom error detected");
      expect(result.matched).toBe(true);
    });
  });

  describe("Retry Statistics", () => {
    it("should track retry statistics", () => {
      const stats = getRetryStats();

      expect(stats).toHaveProperty("totalRetries");
      expect(stats).toHaveProperty("successfulRetries");
      expect(stats).toHaveProperty("failedRetries");
      expect(stats).toHaveProperty("circuitBreakerState");
      expect(stats).toHaveProperty("activeRetries");
    });
  });

  describe("Circuit Breaker", () => {
    it("should have circuit breaker state", () => {
      const stats = getRetryStats();

      expect(stats.circuitBreakerState).toHaveProperty("failures");
      expect(stats.circuitBreakerState).toHaveProperty("isOpen");
      expect(stats.circuitBreakerState.failures).toBe(0);
      expect(stats.circuitBreakerState.isOpen).toBe(false);
    });

    it("should allow manual circuit breaker reset", () => {
      resetCircuitBreaker();
      const stats = getRetryStats();

      expect(stats.circuitBreakerState.failures).toBe(0);
      expect(stats.circuitBreakerState.isOpen).toBe(false);
    });
  });
});

/**
 * Example usage demonstrations
 */
describe("Usage Examples", () => {
  it("demonstrates extended hours market order rejection fix", async () => {
    const mockUpdate: AlpacaTradeUpdate = {
      event: "rejected",
      order: {
        id: "test-order-1",
        client_order_id: "client-1",
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

    // This would normally trigger the retry handler
    // In a real scenario, it would convert to a limit order
    console.log("Example: Extended hours market order would be converted to limit order");
  });

  it("demonstrates insufficient funds fix", () => {
    const reason = "insufficient buying power to complete order";
    const result = testRejectionReason(reason);

    console.log("Example: Insufficient funds rejection would reduce quantity to fit buying power");
    expect(result.category).toBe("insufficient_funds");
  });

  it("demonstrates fractional shares fix", () => {
    const reason = "fractional shares not supported for this symbol";
    const result = testRejectionReason(reason);

    console.log("Example: Fractional shares rejection would round down to whole shares");
    expect(result.category).toBe("order_type");
  });
});
