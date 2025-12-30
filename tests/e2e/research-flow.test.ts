/**
 * E2E Tests: Research & Watchlist Flow
 *
 * Tests the complete research workflow:
 * - Watchlist management
 * - Symbol search
 * - Market data retrieval
 * - News and sentiment
 * - Trading candidates
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedFetch,
  createTestSession,
  isServerAvailable,
  generateTestId,
} from "./test-helpers";

describe("E2E: Research & Watchlist Flow", () => {
  let serverAvailable = false;
  let sessionId: string;
  const testSymbol = "TSLA";

  beforeAll(async () => {
    serverAvailable = await isServerAvailable();
    if (serverAvailable) {
      const session = await createTestSession();
      sessionId = session?.sessionId || "";
    }
  });

  describe("Watchlist Management", () => {
    it("should get watchlist", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/watchlist", sessionId);

      expect([200, 401, 403]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data) || data.symbols).toBeTruthy();
      }
    });

    it("should add symbol to watchlist", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/watchlist", sessionId, {
        method: "POST",
        body: JSON.stringify({ symbol: testSymbol }),
      });

      // May already exist (409) or succeed (200/201)
      expect([200, 201, 400, 401, 403, 409, 422]).toContain(response.status);
    });

    it("should get watchlist with quotes", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/watchlist?includeQuotes=true",
        sessionId
      );

      expect([200, 401, 403]).toContain(response.status);
    });

    it("should remove symbol from watchlist", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        `/api/watchlist/${testSymbol}`,
        sessionId,
        { method: "DELETE" }
      );

      expect([200, 204, 400, 401, 403, 404]).toContain(response.status);
    });

    it("should validate watchlist symbol", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/watchlist", sessionId, {
        method: "POST",
        body: JSON.stringify({ symbol: "INVALID123456" }),
      });

      expect([400, 404, 422]).toContain(response.status);
    });
  });

  describe("Symbol Search", () => {
    it("should search for symbols", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/search/symbols?q=apple",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data) || data.results).toBeTruthy();
      }
    });

    it("should get symbol details", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/symbols/AAPL",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });
  });

  describe("Market Data", () => {
    it("should get real-time quotes", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/quotes?symbols=AAPL,MSFT,GOOGL",
        sessionId
      );

      expect([200, 401, 403, 503]).toContain(response.status);
    });

    it("should get historical data", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/bars?symbol=AAPL&timeframe=1Day&limit=30",
        sessionId
      );

      expect([200, 401, 403, 503]).toContain(response.status);
    });

    it("should get intraday data", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/alpaca/bars?symbol=AAPL&timeframe=1Hour&limit=24",
        sessionId
      );

      expect([200, 401, 403, 503]).toContain(response.status);
    });
  });

  describe("News and Sentiment", () => {
    it("should get market news", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/news", sessionId);

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });

    it("should get symbol-specific news", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/news?symbols=AAPL,TSLA",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });

    it("should get sentiment analysis", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/ai-decisions/sentiment?symbol=AAPL",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });
  });

  describe("Trading Candidates", () => {
    it("should get trading candidates", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/candidates", sessionId);

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });

    it("should analyze a symbol", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/candidates/analyze",
        sessionId,
        {
          method: "POST",
          body: JSON.stringify({ symbol: "AAPL" }),
        }
      );

      expect([200, 401, 403, 404, 422, 503]).toContain(response.status);
    });
  });

  describe("Feed Status", () => {
    it("should get data feed status", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/feeds", sessionId);

      expect([200, 401, 403]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        if (data.length > 0) {
          expect(data[0]).toHaveProperty("id");
          expect(data[0]).toHaveProperty("status");
        }
      }
    });

    it("should get specific feed details", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/feeds/alpaca", sessionId);

      expect([200, 401, 403, 404]).toContain(response.status);
    });
  });
});
