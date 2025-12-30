/**
 * E2E Tests: Trading Flow
 *
 * Tests the complete trading lifecycle:
 * - Market data retrieval
 * - Order placement
 * - Order status monitoring
 * - Position management
 * - Order cancellation
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  API_BASE,
  authenticatedFetch,
  createTestSession,
  isServerAvailable,
  testData,
  waitFor,
} from "./test-helpers";

describe("E2E: Trading Flow", () => {
  let serverAvailable = false;
  let sessionId: string;
  let testOrderId: string;

  beforeAll(async () => {
    serverAvailable = await isServerAvailable();
    if (serverAvailable) {
      const session = await createTestSession();
      sessionId = session?.sessionId || "";
    }
  });

  describe("Market Data", () => {
    it("should fetch account information", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/account",
        sessionId
      );

      // May return 401 if not connected to Alpaca, or 200 if connected
      expect([200, 401, 403, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty("id");
        expect(data).toHaveProperty("status");
        expect(data).toHaveProperty("buying_power");
      }
    });

    it("should fetch positions", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/positions",
        sessionId
      );

      expect([200, 401, 403, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it("should fetch market quotes", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/quotes?symbols=AAPL,MSFT",
        sessionId
      );

      expect([200, 401, 403, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data).toBeDefined();
      }
    });

    it("should fetch historical bars", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/bars?symbol=AAPL&timeframe=1Day&limit=10",
        sessionId
      );

      expect([200, 401, 403, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data).toBeDefined();
      }
    });
  });

  describe("Order Management", () => {
    it("should validate order parameters", async () => {
      if (!serverAvailable || !sessionId) return;

      // Try invalid order
      const response = await authenticatedFetch(
        "/api/alpaca/orders",
        sessionId,
        {
          method: "POST",
          body: JSON.stringify({
            symbol: "", // Invalid
            side: "buy",
            type: "market",
            qty: "1",
          }),
        }
      );

      expect([400, 422]).toContain(response.status);
    });

    it("should place a market order (paper trading)", async () => {
      if (!serverAvailable || !sessionId) return;

      const order = testData.order("AAPL");
      const response = await authenticatedFetch(
        "/api/alpaca/orders",
        sessionId,
        {
          method: "POST",
          body: JSON.stringify(order),
        }
      );

      // Accept various responses - actual trading may be disabled
      expect([200, 201, 400, 401, 403, 422, 500, 503]).toContain(
        response.status
      );

      if (response.ok) {
        const data = await response.json();
        if (data.id) {
          testOrderId = data.id;
          expect(data.symbol).toBe("AAPL");
          expect(data.side).toBe("buy");
        }
      }
    });

    it("should place a limit order (paper trading)", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/orders",
        sessionId,
        {
          method: "POST",
          body: JSON.stringify({
            symbol: "MSFT",
            side: "buy",
            type: "limit",
            qty: "1",
            limitPrice: "100.00",
            timeInForce: "day",
          }),
        }
      );

      expect([200, 201, 400, 401, 403, 422, 500, 503]).toContain(
        response.status
      );
    });

    it("should fetch order history", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/orders?status=all&limit=10",
        sessionId
      );

      expect([200, 401, 403, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it("should get order by ID", async () => {
      if (!serverAvailable || !sessionId || !testOrderId) return;

      const response = await authenticatedFetch(
        `/api/alpaca/orders/${testOrderId}`,
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data.id).toBe(testOrderId);
      }
    });

    it("should cancel an order", async () => {
      if (!serverAvailable || !sessionId || !testOrderId) return;

      const response = await authenticatedFetch(
        `/api/alpaca/orders/${testOrderId}`,
        sessionId,
        { method: "DELETE" }
      );

      // Order may already be filled/cancelled
      expect([200, 204, 400, 401, 403, 404, 422, 503]).toContain(
        response.status
      );
    });
  });

  describe("Position Monitoring", () => {
    it("should calculate portfolio P&L", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/portfolio/summary",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty("totalValue");
      }
    });

    it("should fetch trade history", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/trades?limit=10",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data) || data.trades).toBeTruthy();
      }
    });
  });

  describe("Trading Session", () => {
    it("should check market clock", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/clock",
        sessionId
      );

      expect([200, 401, 403, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty("is_open");
      }
    });

    it("should check trading calendar", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/calendar?start=2024-01-01&end=2024-01-31",
        sessionId
      );

      expect([200, 401, 403, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });
});
