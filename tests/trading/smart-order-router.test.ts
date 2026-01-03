/**
 * SMART ORDER ROUTER TESTS
 *
 * Comprehensive test suite demonstrating the smart order router's ability
 * to prevent order rejections in various scenarios.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SmartOrderRouter,
  type OrderInput,
  type CurrentPriceData,
  createPriceData,
} from "../../server/trading/smart-order-router";
import type { SessionType } from "../../server/services/trading-session-manager";

describe("SmartOrderRouter", () => {
  let router: SmartOrderRouter;
  let mockPrice: CurrentPriceData;

  beforeEach(() => {
    router = new SmartOrderRouter();
    mockPrice = {
      bid: 100.0,
      ask: 100.1,
      last: 100.05,
      spread: 0.001, // 0.1% spread
    };
  });

  // ============================================================================
  // REGULAR HOURS TESTS
  // ============================================================================

  describe("Regular Hours Trading", () => {
    const session: SessionType = "regular";

    it("should pass through valid market order during regular hours", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "market",
        timeInForce: "day",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.type).toBe("market");
      expect(result.timeInForce).toBe("day");
      expect(result.extendedHours).toBe(false);
      expect(result.transformations).toHaveLength(0);
    });

    it("should fix market order with GTC time-in-force", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "market",
        timeInForce: "gtc", // INVALID for market orders
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.type).toBe("market");
      expect(result.timeInForce).toBe("day");
      expect(result.transformations).toContain(
        "Changed market order TIF from 'gtc' to 'day' (not allowed)"
      );
    });

    it("should allow limit orders with GTC during regular hours", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "limit",
        limitPrice: "100.00",
        timeInForce: "gtc",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.type).toBe("limit");
      expect(result.timeInForce).toBe("gtc");
      expect(result.limitPrice).toBe("100.00");
      expect(result.extendedHours).toBe(false);
    });

    it("should force bracket orders to use day TIF", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "limit",
        limitPrice: "100.00",
        timeInForce: "gtc", // INVALID for bracket orders
        orderClass: "bracket",
        takeProfitLimitPrice: "105.00",
        stopLossStopPrice: "95.00",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.timeInForce).toBe("day");
      expect(result.transformations).toContain(
        "Forced bracket order TIF to 'day' (Alpaca requirement)"
      );
    });
  });

  // ============================================================================
  // EXTENDED HOURS TESTS (PRE-MARKET)
  // ============================================================================

  describe("Pre-Market Trading", () => {
    const session: SessionType = "pre_market";

    it("should upgrade market order to limit in pre-market", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "market", // NOT ALLOWED in extended hours
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.type).toBe("limit");
      expect(result.timeInForce).toBe("day");
      expect(result.extendedHours).toBe(true);
      expect(result.limitPrice).toBeDefined();
      expect(result.transformations).toContain(
        "Upgraded market to limit order (pre_market)"
      );
    });

    it("should auto-calculate buy limit price with buffer in pre-market", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "market",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.type).toBe("limit");
      expect(result.limitPrice).toBeDefined();

      const limitPrice = parseFloat(result.limitPrice!);
      const expectedPrice = mockPrice.ask * 1.005; // 0.5% buffer for extended hours

      expect(limitPrice).toBeCloseTo(expectedPrice, 2);
      expect(
        result.transformations.some((t) =>
          t.includes("Auto-calculated buy limit")
        )
      ).toBe(true);
    });

    it("should auto-calculate sell limit price with buffer in pre-market", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "sell",
        qty: "10",
        type: "market",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.type).toBe("limit");
      expect(result.limitPrice).toBeDefined();

      const limitPrice = parseFloat(result.limitPrice!);
      const expectedPrice = mockPrice.bid * 0.995; // 0.5% buffer for extended hours

      expect(limitPrice).toBeCloseTo(expectedPrice, 2);
    });

    it("should force day TIF for extended hours", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "limit",
        limitPrice: "100.00",
        timeInForce: "gtc", // Should be forced to 'day'
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.timeInForce).toBe("day");
      expect(result.extendedHours).toBe(true);
      expect(result.transformations).toContain(
        "Forced TIF to 'day' for extended hours (pre_market)"
      );
    });

    it("should upgrade stop order to stop_limit in pre-market", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "sell",
        qty: "10",
        type: "stop", // NOT ALLOWED in extended hours
        stopPrice: "95.00",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.type).toBe("stop_limit");
      expect(result.transformations).toContain(
        "Upgraded stop to stop_limit (pre_market)"
      );
    });

    it("should convert trailing stop to limit in pre-market", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "sell",
        qty: "10",
        type: "trailing_stop", // NOT ALLOWED in extended hours
        trailPercent: "2",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.type).toBe("limit");
      expect(result.transformations).toContain(
        "Changed trailing_stop to limit (not supported in pre_market)"
      );
    });

    it("should warn about fractional shares in pre-market", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10.5", // Fractional shares NOT ALLOWED in extended hours
        type: "limit",
        limitPrice: "100.00",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.warnings).toContain(
        "Fractional shares not allowed in extended hours - order may be rejected"
      );
    });
  });

  // ============================================================================
  // AFTER-HOURS TESTS
  // ============================================================================

  describe("After-Hours Trading", () => {
    const session: SessionType = "after_hours";

    it("should handle after-hours same as pre-market", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "market",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.type).toBe("limit");
      expect(result.timeInForce).toBe("day");
      expect(result.extendedHours).toBe(true);
      expect(result.transformations).toContain(
        "Upgraded market to limit order (after_hours)"
      );
    });

    it("should set extended_hours flag automatically", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "limit",
        limitPrice: "100.00",
        // extendedHours NOT specified
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.extendedHours).toBe(true);
      expect(result.transformations).toContain(
        "Set extended_hours=true for after_hours session"
      );
    });

    it("should warn about bracket orders in after-hours", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "limit",
        limitPrice: "100.00",
        orderClass: "bracket",
        takeProfitLimitPrice: "105.00",
        stopLossStopPrice: "95.00",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.warnings).toContain(
        "Bracket orders only recommended during regular hours"
      );
    });
  });

  // ============================================================================
  // MARKET CLOSED TESTS
  // ============================================================================

  describe("Market Closed", () => {
    const session: SessionType = "closed";

    it("should upgrade market order to limit when market is closed", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "market",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.type).toBe("limit");
      expect(result.transformations).toContain(
        "Upgraded market order to limit (market closed)"
      );
    });

    it("should change IOC to day when market is closed", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "limit",
        limitPrice: "100.00",
        timeInForce: "ioc", // Won't work when closed
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(result.timeInForce).toBe("day");
      expect(result.transformations).toContain(
        "Changed TIF from 'ioc'/'fok' to 'day' (market closed)"
      );
    });
  });

  // ============================================================================
  // CRYPTO 24/7 TESTS
  // ============================================================================

  describe("Crypto 24/7 Trading", () => {
    it("should detect crypto symbols", () => {
      const order: OrderInput = {
        symbol: "BTC/USD",
        side: "buy",
        qty: "0.1",
        type: "market",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        "regular"
      );

      expect(result.isCrypto).toBe(true);
      expect(result.extendedHours).toBe(false);
    });

    it("should allow market orders for crypto anytime", () => {
      const order: OrderInput = {
        symbol: "ETH/USD",
        side: "buy",
        qty: "1",
        type: "market",
        timeInForce: "day",
      };

      // Even during "closed" hours for equities
      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        "closed"
      );

      expect(result.type).toBe("market");
      expect(result.isCrypto).toBe(true);
      expect(result.extendedHours).toBe(false);
    });

    it("should fix crypto market orders with GTC", () => {
      const order: OrderInput = {
        symbol: "BTC/USD",
        side: "buy",
        qty: "0.1",
        type: "market",
        timeInForce: "gtc", // NOT ALLOWED for market orders
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        "regular"
      );

      // Market orders can't use GTC for any asset type, so should be changed to 'day'
      expect(result.timeInForce).toBe("day");
      expect(result.transformations).toContain(
        "Changed market order TIF from 'gtc' to 'day' (not allowed)"
      );
    });

    it("should allow crypto limit orders with GTC", () => {
      const order: OrderInput = {
        symbol: "ETH/USD",
        side: "buy",
        qty: "1",
        type: "limit",
        limitPrice: "2000.00",
        timeInForce: "gtc",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        "regular"
      );

      expect(result.type).toBe("limit");
      expect(result.timeInForce).toBe("gtc");
      expect(result.isCrypto).toBe(true);
    });
  });

  // ============================================================================
  // PRICE VALIDATION TESTS
  // ============================================================================

  describe("Price Validation", () => {
    const session: SessionType = "regular";

    it("should warn on buy limit far above market", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "limit",
        limitPrice: "110.00", // 10% above market
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(
        result.warnings.some(
          (w) => w.includes("above market") && w.includes("worse price")
        )
      ).toBe(true);
    });

    it("should warn on sell limit far below market", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "sell",
        qty: "10",
        type: "limit",
        limitPrice: "90.00", // 10% below market
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        session
      );

      expect(
        result.warnings.some(
          (w) => w.includes("below market") && w.includes("worse price")
        )
      ).toBe(true);
    });

    it("should warn on wide spread", () => {
      const wideSpreadPrice: CurrentPriceData = {
        bid: 100.0,
        ask: 103.0, // 3% spread
        last: 101.5,
        spread: 0.03,
      };

      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "limit",
        limitPrice: "102.00", // Need limit order for price validation
      };

      const result = router.transformOrderForExecution(
        order,
        wideSpreadPrice,
        session
      );

      expect(
        result.warnings.some((w) => w.includes("Wide spread detected"))
      ).toBe(true);
    });
  });

  // ============================================================================
  // CONFIGURATION TESTS
  // ============================================================================

  describe("Configuration", () => {
    it("should use custom buffer percentages", () => {
      const customRouter = new SmartOrderRouter({
        buyBufferPercent: 1.0, // 1% buffer
        aggressiveLimitBufferPercent: 2.0, // 2% for extended hours
      });

      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "market",
      };

      const result = customRouter.transformOrderForExecution(
        order,
        mockPrice,
        "pre_market"
      );

      const limitPrice = parseFloat(result.limitPrice!);
      const expectedPrice = mockPrice.ask * 1.02; // 2% aggressive buffer

      expect(limitPrice).toBeCloseTo(expectedPrice, 2);
    });

    it("should disable auto-upgrade when configured", () => {
      const customRouter = new SmartOrderRouter({
        autoUpgradeMarketToLimit: false,
      });

      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "market",
      };

      const result = customRouter.transformOrderForExecution(
        order,
        mockPrice,
        "pre_market"
      );

      // Should still upgrade, but through the forced rule
      expect(result.type).toBe("limit");
    });

    it("should update configuration dynamically", () => {
      router.updateConfig({
        buyBufferPercent: 0.5,
      });

      const config = router.getConfig();
      expect(config.buyBufferPercent).toBe(0.5);
    });
  });

  // ============================================================================
  // HELPER FUNCTION TESTS
  // ============================================================================

  describe("Helper Functions", () => {
    it("should create price data from quote", () => {
      const quote = {
        bid: 100.0,
        ask: 100.1,
        last: 100.05,
      };

      const priceData = createPriceData(quote);

      expect(priceData.bid).toBe(100.0);
      expect(priceData.ask).toBe(100.1);
      expect(priceData.last).toBe(100.05);
      expect(priceData.spread).toBeCloseTo(0.001, 4);
    });

    it("should handle missing bid/ask in quote", () => {
      const quote = {
        last: 100.0,
      };

      const priceData = createPriceData(quote);

      expect(priceData.bid).toBe(100.0);
      expect(priceData.ask).toBe(100.0);
      expect(priceData.last).toBe(100.0);
    });
  });

  // ============================================================================
  // COMPLEX SCENARIO TESTS
  // ============================================================================

  describe("Complex Scenarios", () => {
    it("should handle market order in pre-market with notional", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        notional: "1000.00",
        type: "market",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        "pre_market"
      );

      expect(result.type).toBe("limit");
      expect(result.timeInForce).toBe("day");
      expect(result.extendedHours).toBe(true);
      expect(result.limitPrice).toBeDefined();
      expect(result.warnings).toContain(
        "Notional orders may not work in extended hours - consider using qty instead"
      );
    });

    it("should handle stop_limit in extended hours correctly", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "sell",
        qty: "10",
        type: "stop_limit",
        stopPrice: "95.00",
        limitPrice: "94.50",
        timeInForce: "gtc",
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        "after_hours"
      );

      expect(result.type).toBe("stop_limit");
      expect(result.timeInForce).toBe("day"); // Forced
      expect(result.extendedHours).toBe(true);
      expect(result.stopPrice).toBe("95.00");
      expect(result.limitPrice).toBe("94.50");
    });

    it("should preserve user limit price when provided", () => {
      const order: OrderInput = {
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        type: "limit",
        limitPrice: "99.00", // User-specified
      };

      const result = router.transformOrderForExecution(
        order,
        mockPrice,
        "pre_market"
      );

      expect(result.limitPrice).toBe("99.00");
      expect(
        result.transformations.some((t) => t.includes("Auto-calculated"))
      ).toBe(false);
    });
  });
});
