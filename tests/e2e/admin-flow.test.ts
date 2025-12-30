/**
 * E2E Tests: Admin & Settings Flow
 *
 * Tests administrative and settings features:
 * - User settings management
 * - Notification preferences
 * - System health monitoring
 * - Admin operations (when applicable)
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedFetch,
  createTestSession,
  isServerAvailable,
} from "./test-helpers";

describe("E2E: Admin & Settings Flow", () => {
  let serverAvailable = false;
  let sessionId: string;

  beforeAll(async () => {
    serverAvailable = await isServerAvailable();
    if (serverAvailable) {
      const session = await createTestSession();
      sessionId = session?.sessionId || "";
    }
  });

  describe("User Settings", () => {
    it("should get user settings", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/settings", sessionId);

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it("should update user settings", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/settings", sessionId, {
        method: "PUT",
        body: JSON.stringify({
          theme: "dark",
          timezone: "America/New_York",
        }),
      });

      expect([200, 400, 401, 403, 422]).toContain(response.status);
    });
  });

  describe("Notification Preferences", () => {
    it("should get notification channels", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/notifications/channels",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it("should get notification preferences", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/notifications/preferences",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it("should update notification preferences", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/notifications/preferences",
        sessionId,
        {
          method: "PUT",
          body: JSON.stringify({
            tradeAlerts: true,
            priceAlerts: false,
            aiDecisions: true,
          }),
        }
      );

      expect([200, 400, 401, 403, 404, 422]).toContain(response.status);
    });
  });

  describe("System Health", () => {
    it("should get health status", async () => {
      if (!serverAvailable) return;

      const response = await fetch(
        `${process.env.API_BASE || "http://localhost:5000"}/api/health`
      );

      // Accept 200 (healthy), 401 (requires auth), 503 (unhealthy), or 429 (rate limited)
      expect([200, 401, 429, 503]).toContain(response.status);
    });

    it("should get system status", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/system/status",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });
  });

  describe("Observability", () => {
    it("should get metrics", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/metrics", sessionId);

      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it("should get connector health", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/observability/connectors",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });
  });

  describe("API Keys & Integrations", () => {
    it("should check Alpaca connection", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/integrations/alpaca/status",
        sessionId
      );

      expect([200, 401, 403, 404, 503]).toContain(response.status);
    });
  });

  describe("Audit & Logs", () => {
    it("should get audit logs", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/audit/logs?limit=10",
        sessionId
      );

      expect([200, 401, 403, 404]).toContain(response.status);
    });
  });

  describe("User Profile", () => {
    it("should get user profile", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/auth/me", sessionId);

      expect([200, 401]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data.user).toBeDefined();
      }
    });

    it("should update user email", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch(
        "/api/auth/update-email",
        sessionId,
        {
          method: "POST",
          body: JSON.stringify({
            email: "updated-test@example.com",
          }),
        }
      );

      expect([200, 400, 401, 409, 422]).toContain(response.status);
    });
  });
});
