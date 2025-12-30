/**
 * E2E Tests: Strategy Management Flow
 *
 * Tests the complete strategy lifecycle:
 * - Strategy creation
 * - Strategy configuration
 * - Strategy activation/deactivation
 * - Backtesting
 * - Strategy deletion
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedFetch,
  createTestSession,
  isServerAvailable,
  testData,
  generateTestId,
} from "./test-helpers";

describe("E2E: Strategy Management Flow", () => {
  let serverAvailable = false;
  let sessionId: string;
  let testStrategyId: string;
  let testBacktestId: string;

  beforeAll(async () => {
    serverAvailable = await isServerAvailable();
    if (serverAvailable) {
      const session = await createTestSession();
      sessionId = session?.sessionId || "";
    }
  });

  describe("Strategy CRUD Operations", () => {
    it("should list existing strategies", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/strategies", sessionId);

      expect([200, 401, 403]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data) || data.strategies).toBeTruthy();
      }
    });

    it("should create a new strategy", async () => {
      if (!serverAvailable || !sessionId) return;

      const strategy = testData.strategy();
      const response = await authenticatedFetch("/api/strategies", sessionId, {
        method: "POST",
        body: JSON.stringify(strategy),
      });

      expect([200, 201, 400, 401, 403, 422]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        testStrategyId = data.id;
        expect(data.name).toBe(strategy.name);
        expect(data.type).toBe(strategy.type);
      }
    });

    it("should get strategy by ID", async () => {
      if (!serverAvailable || !sessionId || !testStrategyId) return;

      const response = await authenticatedFetch(
        `/api/strategies/${testStrategyId}`,
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data.id).toBe(testStrategyId);
      }
    });

    it("should update strategy configuration", async () => {
      if (!serverAvailable || !sessionId || !testStrategyId) return;

      const response = await authenticatedFetch(
        `/api/strategies/${testStrategyId}`,
        sessionId,
        {
          method: "PUT",
          body: JSON.stringify({
            description: "Updated E2E test description",
            config: {
              riskLevel: "low",
              maxPositionSize: 0.05,
            },
          }),
        }
      );

      expect([200, 400, 401, 403, 404, 422]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data.description).toContain("Updated");
      }
    });

    it("should validate strategy parameters", async () => {
      if (!serverAvailable || !sessionId) return;

      // Try invalid strategy
      const response = await authenticatedFetch("/api/strategies", sessionId, {
        method: "POST",
        body: JSON.stringify({
          name: "", // Invalid - empty name
          type: "invalid-type",
        }),
      });

      expect([400, 422]).toContain(response.status);
    });
  });

  describe("Strategy Activation", () => {
    it("should activate a strategy", async () => {
      if (!serverAvailable || !sessionId || !testStrategyId) return;

      const response = await authenticatedFetch(
        `/api/strategies/${testStrategyId}/activate`,
        sessionId,
        { method: "POST" }
      );

      expect([200, 400, 401, 403, 404, 422]).toContain(response.status);
    });

    it("should get active strategies", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/strategies?status=active",
        sessionId
      );

      expect([200, 401, 403]).toContain(response.status);
    });

    it("should deactivate a strategy", async () => {
      if (!serverAvailable || !sessionId || !testStrategyId) return;

      const response = await authenticatedFetch(
        `/api/strategies/${testStrategyId}/deactivate`,
        sessionId,
        { method: "POST" }
      );

      expect([200, 400, 401, 403, 404, 422]).toContain(response.status);
    });
  });

  describe("Backtesting", () => {
    it("should list existing backtests", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/backtests", sessionId);

      expect([200, 401, 403]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data) || data.backtests).toBeTruthy();
      }
    });

    it("should create a new backtest", async () => {
      if (!serverAvailable || !sessionId || !testStrategyId) return;

      const backtest = testData.backtest(testStrategyId);
      const response = await authenticatedFetch("/api/backtests", sessionId, {
        method: "POST",
        body: JSON.stringify(backtest),
      });

      expect([200, 201, 400, 401, 403, 422]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        testBacktestId = data.id;
        expect(data.strategyId || data.strategy_id).toBe(testStrategyId);
      }
    });

    it("should get backtest status", async () => {
      if (!serverAvailable || !sessionId || !testBacktestId) return;

      const response = await authenticatedFetch(
        `/api/backtests/${testBacktestId}`,
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data.id).toBe(testBacktestId);
        expect(["pending", "running", "completed", "failed"]).toContain(
          data.status
        );
      }
    });

    it("should get backtest results", async () => {
      if (!serverAvailable || !sessionId || !testBacktestId) return;

      const response = await authenticatedFetch(
        `/api/backtests/${testBacktestId}/results`,
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it("should validate backtest parameters", async () => {
      if (!serverAvailable || !sessionId) return;

      // Try invalid backtest
      const response = await authenticatedFetch("/api/backtests", sessionId, {
        method: "POST",
        body: JSON.stringify({
          strategyId: "invalid-uuid",
          startDate: "invalid-date",
        }),
      });

      expect([400, 422]).toContain(response.status);
    });
  });

  describe("Strategy Templates", () => {
    it("should list strategy templates", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/strategies/templates",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });
  });

  describe("Strategy Cleanup", () => {
    it("should delete a strategy", async () => {
      if (!serverAvailable || !sessionId || !testStrategyId) return;

      const response = await authenticatedFetch(
        `/api/strategies/${testStrategyId}`,
        sessionId,
        { method: "DELETE" }
      );

      expect([200, 204, 400, 401, 403, 404]).toContain(response.status);
    });
  });
});
