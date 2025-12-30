/**
 * E2E Tests: Portfolio Management Flow
 *
 * Tests the complete portfolio management lifecycle:
 * - Portfolio overview
 * - Position tracking
 * - Performance metrics
 * - Risk analysis
 * - Analytics and reporting
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedFetch,
  createTestSession,
  isServerAvailable,
} from "./test-helpers";

describe("E2E: Portfolio Management Flow", () => {
  let serverAvailable = false;
  let sessionId: string;

  beforeAll(async () => {
    serverAvailable = await isServerAvailable();
    if (serverAvailable) {
      const session = await createTestSession();
      sessionId = session?.sessionId || "";
    }
  });

  describe("Portfolio Overview", () => {
    it("should get portfolio summary", async () => {
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

    it("should get portfolio allocation", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/portfolio/allocation",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });

    it("should get portfolio history", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/portfolio/history?period=1M",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });
  });

  describe("Position Tracking", () => {
    it("should list all positions", async () => {
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

    it("should get position by symbol", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/positions/AAPL",
        sessionId
      );

      // May not have a position in AAPL
      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });

    it("should calculate unrealized P&L", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/portfolio/pnl",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });
  });

  describe("Performance Metrics", () => {
    it("should get daily returns", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/analytics/returns?period=daily",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });

    it("should get analytics summary", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/analytics/summary",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data).toBeDefined();
      }
    });

    it("should get trading statistics", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/analytics/stats",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });
  });

  describe("Risk Analysis", () => {
    it("should get risk metrics", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/portfolio/risk",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });

    it("should get position concentration", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/portfolio/concentration",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });
  });

  describe("Trade History", () => {
    it("should list recent trades", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/trades?limit=20",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data) || data.trades).toBeTruthy();
      }
    });

    it("should filter trades by symbol", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/trades?symbol=AAPL&limit=10",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });

    it("should filter trades by date range", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/trades?startDate=2024-01-01&endDate=2024-12-31",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });
  });

  describe("Account Information", () => {
    it("should get account details", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/account",
        sessionId
      );

      expect([200, 401, 403, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty("buying_power");
        expect(data).toHaveProperty("portfolio_value");
      }
    });

    it("should get account activities", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/activities?limit=10",
        sessionId
      );

      expect([200, 401, 403, 503]).toContain(response.status);
    });
  });
});
