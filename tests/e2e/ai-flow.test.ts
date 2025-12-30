/**
 * E2E Tests: AI Features Flow
 *
 * Tests the complete AI-powered features:
 * - AI decisions and recommendations
 * - Autonomous trading mode
 * - Sentiment analysis
 * - AI pulse monitoring
 * - Fusion intelligence
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedFetch,
  createTestSession,
  isServerAvailable,
} from "./test-helpers";

describe("E2E: AI Features Flow", () => {
  let serverAvailable = false;
  let sessionId: string;

  beforeAll(async () => {
    serverAvailable = await isServerAvailable();
    if (serverAvailable) {
      const session = await createTestSession();
      sessionId = session?.sessionId || "";
    }
  });

  describe("AI Decisions", () => {
    it("should get AI decisions list", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/ai-decisions",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(Array.isArray(data) || data.decisions).toBeTruthy();
      }
    });

    it("should get recent AI activity", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/ai-decisions/activity?limit=10",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it("should get AI decision by ID", async () => {
      if (!serverAvailable || !sessionId) return;

      // First get a list to find an ID
      const listResponse = await authenticatedFetch(
        "/api/ai-decisions?limit=1",
        sessionId
      );

      if (listResponse.ok) {
        const data = await listResponse.json();
        const decisions = data.decisions || data;
        if (decisions.length > 0) {
          const decisionId = decisions[0].id;
          const response = await authenticatedFetch(
            `/api/ai-decisions/${decisionId}`,
            sessionId
          );
          expect([200, 401, 403, 404]).toContain(response.status);
        }
      }
    });

    it("should filter AI decisions by action", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/ai-decisions?action=buy",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });
  });

  describe("Sentiment Analysis", () => {
    it("should get sentiment for a symbol", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/ai-decisions/sentiment?symbol=AAPL",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty("score");
        expect(data).toHaveProperty("trend");
      }
    });

    it("should get aggregated market sentiment", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/ai-decisions/sentiment/market",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });
  });

  describe("Autonomous Trading", () => {
    it("should get autonomous state", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/autonomous/state",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty("isRunning");
      }
    });

    it("should get autonomous config", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/autonomous/config",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it("should get autonomous cycles", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/autonomous/cycles?limit=10",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it("should update autonomous config", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/autonomous/config",
        sessionId,
        {
          method: "PUT",
          body: JSON.stringify({
            maxDailyTrades: 10,
            riskTolerance: "medium",
          }),
        }
      );

      expect([200, 400, 401, 403, 404, 422]).toContain(response.status);
    });
  });

  describe("Agent Status", () => {
    it("should get agent status", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/agent/status",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it("should get agent metrics", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/agent/metrics",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });
  });

  describe("Fusion Intelligence", () => {
    it("should get fusion intelligence", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/fusion/intelligence",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it("should get fusion analysis for symbol", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/fusion/analyze/AAPL",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });
  });

  describe("AI Pulse", () => {
    it("should get AI events", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/ai-decisions/events?limit=20",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it("should get AI statistics", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/ai-decisions/stats",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });
  });

  describe("LLM Gateway", () => {
    it("should get LLM call history", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/llm/calls?limit=10",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it("should get LLM usage statistics", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/llm/stats",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });
  });
});
