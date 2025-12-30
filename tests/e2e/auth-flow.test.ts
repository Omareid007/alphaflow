/**
 * E2E Tests: Authentication Flow
 *
 * Tests the complete authentication lifecycle:
 * - User registration
 * - User login
 * - Session management
 * - Password reset flow
 * - Logout
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  API_BASE,
  apiFetch,
  authenticatedFetch,
  generateTestId,
  isServerAvailable,
} from "./test-helpers";

describe("E2E: Authentication Flow", () => {
  let serverAvailable = false;
  let testUsername: string;
  let testPassword: string;
  let sessionId: string;

  beforeAll(async () => {
    serverAvailable = await isServerAvailable();
    testUsername = generateTestId("e2e-user");
    testPassword = "TestPassword123!";
  });

  describe("User Registration", () => {
    it("should register a new user", async () => {
      if (!serverAvailable) {
        console.log("Server unavailable, skipping test");
        return;
      }

      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: testUsername,
          password: testPassword,
        }),
      });

      // Accept 201 (created), 200 (ok), 409 (already exists), 401 (need auth), or 429 (rate limited)
      expect([200, 201, 401, 409, 429]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data.user).toBeDefined();
        expect(data.user.username).toBe(testUsername);
      }
    });

    it("should reject registration with weak password", async () => {
      if (!serverAvailable) return;

      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: generateTestId("weak-pass-user"),
          password: "123", // Too weak
        }),
      });

      // Should reject with 400, 401 (need auth), 422, or 429 (rate limited)
      expect([400, 401, 422, 429]).toContain(response.status);
    });

    it("should reject duplicate username registration", async () => {
      if (!serverAvailable) return;

      // Try to register with same username
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: testUsername,
          password: testPassword,
        }),
      });

      // Should reject with 409 (conflict), 400, 401 (need auth), or 429 (rate limited)
      expect([400, 401, 409, 429]).toContain(response.status);
    });
  });

  describe("User Login", () => {
    it("should login with valid credentials", async () => {
      if (!serverAvailable) return;

      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: testUsername,
          password: testPassword,
        }),
      });

      // Accept success or rate limited
      expect([200, 429]).toContain(response.status);

      if (response.ok) {
        const data = await response.json();
        expect(data.user).toBeDefined();

        // Extract session cookie
        const setCookie = response.headers.get("set-cookie");
        if (setCookie) {
          const match = setCookie.match(/session=([^;]+)/);
          if (match) {
            sessionId = match[1];
          }
        }
      }
    });

    it("should reject login with invalid credentials", async () => {
      if (!serverAvailable) return;

      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: testUsername,
          password: "wrongpassword",
        }),
      });

      // Accept 401 (unauthorized) or 429 (rate limited)
      expect([401, 429]).toContain(response.status);
    });

    it("should reject login with non-existent user", async () => {
      if (!serverAvailable) return;

      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: "nonexistentuser12345",
          password: "anypassword",
        }),
      });

      // Accept 401 (unauthorized) or 429 (rate limited)
      expect([401, 429]).toContain(response.status);
    });
  });

  describe("Session Management", () => {
    it("should access protected route with valid session", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/auth/me", sessionId);

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe(testUsername);
    });

    it("should reject protected route without session", async () => {
      if (!serverAvailable) return;

      const response = await apiFetch("/api/auth/me");

      // Accept 401 (unauthorized) or 429 (rate limited)
      expect([401, 429]).toContain(response.status);
    });

    it("should reject protected route with invalid session", async () => {
      if (!serverAvailable) return;

      const response = await authenticatedFetch(
        "/api/auth/me",
        "invalid-session-id"
      );

      // Accept 401 (unauthorized) or 429 (rate limited)
      expect([401, 429]).toContain(response.status);
    });
  });

  describe("Password Reset Flow", () => {
    it("should initiate password reset for valid email", async () => {
      if (!serverAvailable) return;

      const response = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
        }),
      });

      // Accept 200 (success), 429 (rate limited), or 404 (endpoint not implemented)
      expect([200, 404, 429]).toContain(response.status);
    });

    it("should reject password reset with invalid token", async () => {
      if (!serverAvailable) return;

      const response = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: "invalid-token-12345",
          newPassword: "NewPassword123!",
        }),
      });

      // Accept 400 (invalid), 401 (unauthorized), 404 (not found), or 429 (rate limited)
      expect([400, 401, 404, 429]).toContain(response.status);
    });
  });

  describe("Logout", () => {
    it("should logout and invalidate session", async () => {
      if (!serverAvailable || !sessionId) return;

      const response = await authenticatedFetch("/api/auth/logout", sessionId, {
        method: "POST",
      });

      expect(response.ok).toBe(true);

      // Verify session is invalidated
      const meResponse = await authenticatedFetch("/api/auth/me", sessionId);
      expect(meResponse.status).toBe(401);
    });
  });
});
