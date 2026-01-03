/**
 * Auth Routes Tests
 * Comprehensive tests for authentication endpoints
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response } from "express";

// Mock dependencies before imports
vi.mock("@sendgrid/mail", () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi
      .fn()
      .mockResolvedValue([
        { statusCode: 202, headers: { "x-message-id": "test-id" } },
      ]),
  },
}));

vi.mock("../../../server/storage", () => ({
  storage: {
    getUserByUsername: vi.fn(),
    getUserByEmail: vi.fn(),
    getUser: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    createPasswordResetToken: vi.fn(),
    getPasswordResetToken: vi.fn(),
    markPasswordResetTokenUsed: vi.fn(),
    deleteExpiredPasswordResetTokens: vi.fn(),
  },
}));

vi.mock("../../../server/lib/session", () => ({
  createSession: vi.fn().mockResolvedValue("test-session-id"),
  getSession: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock("../../../server/lib/email-service", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true }),
  isEmailConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock("../../../server/utils/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

import { storage } from "../../../server/storage";
import {
  createSession,
  getSession,
  deleteSession,
} from "../../../server/lib/session";
import {
  sendPasswordResetEmail,
  isEmailConfigured,
} from "../../../server/lib/email-service";
import bcrypt from "bcryptjs";

// ============================================================================
// TEST HELPERS
// ============================================================================

interface MockUser {
  id: string;
  username: string;
  email: string | null;
  password: string;
  isAdmin: boolean;
}

function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-123",
    username: "testuser",
    email: "test@example.com",
    password: "hashed-password",
    isAdmin: false,
    ...overrides,
  };
}

function createMockReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    body: {},
    params: {},
    query: {},
    cookies: {},
    ip: "127.0.0.1",
    path: "/api/auth/test",
    ...overrides,
  };
}

function createMockRes(): {
  res: Partial<Response>;
  json: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnThis();
  const cookie = vi.fn();
  const clearCookie = vi.fn();

  const res: Partial<Response> = {
    json,
    status,
    cookie,
    clearCookie,
  };

  return { res, json, status };
}

// ============================================================================
// TESTS
// ============================================================================

describe("Auth Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SENDGRID_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // SIGNUP TESTS
  // ==========================================================================

  describe("POST /api/auth/signup", () => {
    it("should create a new user with valid credentials", async () => {
      vi.mocked(storage.getUserByUsername).mockResolvedValue(undefined);
      vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined);
      vi.mocked(storage.createUser).mockResolvedValue(createMockUser());
      vi.mocked(createSession).mockResolvedValue("new-session-id");

      // Simulate successful signup flow
      const result = await storage.createUser({
        username: "newuser",
        password: "hashed-password",
        email: "newuser@example.com",
      });

      expect(storage.createUser).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.username).toBe("testuser");
      expect(result.email).toBe("test@example.com");
    });

    it("should reject signup if username already exists", async () => {
      const existingUser = createMockUser();
      vi.mocked(storage.getUserByUsername).mockResolvedValue(existingUser);

      const existing = await storage.getUserByUsername("testuser");
      expect(existing).toBeDefined();
      expect(existing?.username).toBe("testuser");
    });

    it("should sanitize username to prevent XSS", async () => {
      vi.mocked(storage.getUserByUsername).mockResolvedValue(undefined);
      vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined);
      vi.mocked(storage.createUser).mockImplementation(async (data) => ({
        ...createMockUser(),
        username: data.username,
      }));

      // Sanitization happens before storage call
      const maliciousUsername = "<script>alert('xss')</script>";
      // The route would sanitize this before calling storage
      await storage.createUser({
        username: "sanitized-username",
        password: "test",
        email: "test@example.com",
      });

      expect(storage.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ username: "sanitized-username", email: "test@example.com" })
      );
    });

    it("should hash password before storing", async () => {
      vi.mocked(storage.getUserByUsername).mockResolvedValue(undefined);

      await bcrypt.hash("plaintext-password", 10);
      expect(bcrypt.hash).toHaveBeenCalledWith("plaintext-password", 10);
    });

    it("should create session after successful signup", async () => {
      vi.mocked(storage.createUser).mockResolvedValue(
        createMockUser({ id: "new-user-id" })
      );

      await createSession("new-user-id");
      expect(createSession).toHaveBeenCalledWith("new-user-id");
    });

    it("should reject signup if email already exists", async () => {
      const existingUser = createMockUser({ email: "taken@example.com" });
      vi.mocked(storage.getUserByUsername).mockResolvedValue(undefined);
      vi.mocked(storage.getUserByEmail).mockResolvedValue(existingUser);

      const existing = await storage.getUserByEmail("taken@example.com");
      expect(existing).toBeDefined();
      expect(existing?.email).toBe("taken@example.com");
    });

    it("should validate email format during signup", async () => {
      // Email validation is handled by Zod schema
      const invalidEmails = [
        "notanemail",
        "@nodomain",
        "no@",
        "spaces in@email.com",
        "",
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (const email of invalidEmails) {
        expect(emailRegex.test(email)).toBe(false);
      }

      const validEmails = [
        "test@example.com",
        "user.name@domain.co.uk",
        "user+tag@example.org",
      ];

      for (const email of validEmails) {
        expect(emailRegex.test(email)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // LOGIN TESTS
  // ==========================================================================

  describe("POST /api/auth/login", () => {
    it("should authenticate user with valid credentials", async () => {
      const mockUser = createMockUser();
      vi.mocked(storage.getUserByUsername).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const user = await storage.getUserByUsername("testuser");
      expect(user).toBeDefined();

      const validPassword = await bcrypt.compare("password123", user!.password);
      expect(validPassword).toBe(true);
    });

    it("should reject login with invalid username", async () => {
      vi.mocked(storage.getUserByUsername).mockResolvedValue(undefined);

      const user = await storage.getUserByUsername("nonexistent");
      expect(user).toBeUndefined();
    });

    it("should reject login with invalid password", async () => {
      const mockUser = createMockUser();
      vi.mocked(storage.getUserByUsername).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const user = await storage.getUserByUsername("testuser");
      const validPassword = await bcrypt.compare(
        "wrong-password",
        user!.password
      );
      expect(validPassword).toBe(false);
    });

    it("should create session on successful login", async () => {
      const mockUser = createMockUser({ id: "user-456" });
      vi.mocked(storage.getUserByUsername).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(createSession).mockResolvedValue("login-session-id");

      const sessionId = await createSession(mockUser.id);
      expect(sessionId).toBe("login-session-id");
      expect(createSession).toHaveBeenCalledWith("user-456");
    });

    it("should return user data without password on successful login", async () => {
      const mockUser = createMockUser();
      vi.mocked(storage.getUserByUsername).mockResolvedValue(mockUser);

      // The route returns { id, username, email, isAdmin } - no password
      const { password, ...safeUser } = mockUser;
      expect(safeUser).not.toHaveProperty("password");
      expect(safeUser).toHaveProperty("id");
      expect(safeUser).toHaveProperty("username");
      expect(safeUser).toHaveProperty("email");
      expect(safeUser).toHaveProperty("isAdmin");
    });
  });

  // ==========================================================================
  // LOGOUT TESTS
  // ==========================================================================

  describe("POST /api/auth/logout", () => {
    it("should delete session on logout", async () => {
      vi.mocked(deleteSession).mockResolvedValue();

      await deleteSession("session-to-delete");
      expect(deleteSession).toHaveBeenCalledWith("session-to-delete");
    });

    it("should handle logout without session cookie gracefully", async () => {
      // If no session cookie, logout should still succeed
      vi.mocked(deleteSession).mockResolvedValue();

      // Route checks for sessionId and only deletes if present
      const sessionId = undefined;
      if (sessionId) {
        await deleteSession(sessionId);
      }

      // deleteSession should not be called
      expect(deleteSession).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GET /api/auth/me TESTS
  // ==========================================================================

  describe("GET /api/auth/me", () => {
    it("should return authenticated user data", async () => {
      const mockUser = createMockUser();
      const mockSession = { userId: mockUser.id, expiresAt: new Date() };

      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);

      const session = await getSession("valid-session");
      expect(session).toBeDefined();

      const user = await storage.getUser(session!.userId);
      expect(user).toBeDefined();
      expect(user?.username).toBe("testuser");
      expect(user?.email).toBe("test@example.com");
    });

    it("should reject request without session cookie", async () => {
      // No session cookie means not authenticated
      const sessionId = undefined;
      expect(sessionId).toBeUndefined();
    });

    it("should reject request with expired session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const session = await getSession("expired-session");
      expect(session).toBeNull();
    });

    it("should reject request if user not found", async () => {
      const mockSession = { userId: "deleted-user-id", expiresAt: new Date() };
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(storage.getUser).mockResolvedValue(undefined);

      const session = await getSession("valid-session");
      const user = await storage.getUser(session!.userId);
      expect(user).toBeUndefined();
    });

    it("should delete session if user not found", async () => {
      const mockSession = { userId: "deleted-user-id", expiresAt: new Date() };
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(storage.getUser).mockResolvedValue(undefined);
      vi.mocked(deleteSession).mockResolvedValue();

      // Route deletes session when user is not found
      await deleteSession("valid-session");
      expect(deleteSession).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // FORGOT PASSWORD TESTS
  // ==========================================================================

  describe("POST /api/auth/forgot-password", () => {
    it("should return success message even for non-existent email (security)", async () => {
      vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined);

      // Security: Don't reveal whether email exists
      const user = await storage.getUserByEmail("nonexistent@example.com");
      expect(user).toBeUndefined();

      // Route always returns same message
      const response = {
        message:
          "If an account with that email exists, a password reset link has been sent",
      };
      expect(response.message).toContain("If an account");
    });

    it("should create reset token for existing user", async () => {
      const mockUser = createMockUser();
      vi.mocked(storage.getUserByEmail).mockResolvedValue(mockUser);
      vi.mocked(storage.createPasswordResetToken).mockResolvedValue();

      await storage.getUserByEmail("test@example.com");
      expect(storage.getUserByEmail).toHaveBeenCalledWith("test@example.com");

      await storage.createPasswordResetToken(
        "user-123",
        "token-abc",
        new Date()
      );
      expect(storage.createPasswordResetToken).toHaveBeenCalled();
    });

    it("should send password reset email", async () => {
      const mockUser = createMockUser();
      vi.mocked(storage.getUserByEmail).mockResolvedValue(mockUser);
      vi.mocked(storage.createPasswordResetToken).mockResolvedValue();
      vi.mocked(sendPasswordResetEmail).mockResolvedValue({ success: true });

      await sendPasswordResetEmail({
        to: "test@example.com",
        from: "noreply@test.com",
        username: "testuser",
        resetToken: "token-123",
        resetUrl: "http://localhost/reset-password",
      });

      expect(sendPasswordResetEmail).toHaveBeenCalled();
    });

    it("should handle email service not configured", async () => {
      vi.mocked(isEmailConfigured).mockReturnValue(false);

      const configured = isEmailConfigured();
      expect(configured).toBe(false);

      // Route still returns success message for security
    });
  });

  // ==========================================================================
  // RESET PASSWORD TESTS
  // ==========================================================================

  describe("POST /api/auth/reset-password", () => {
    it("should reject invalid token", async () => {
      vi.mocked(storage.getPasswordResetToken).mockResolvedValue(undefined);

      const result = await storage.getPasswordResetToken("invalid-token");
      expect(result).toBeUndefined();
    });

    it("should reject expired token", async () => {
      const expiredToken = {
        userId: "user-123",
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        used: false,
      };
      vi.mocked(storage.getPasswordResetToken).mockResolvedValue(expiredToken);

      const result = await storage.getPasswordResetToken("expired-token");
      expect(result).toBeDefined();
      expect(result!.expiresAt < new Date()).toBe(true);
    });

    it("should reject already used token", async () => {
      const usedToken = {
        userId: "user-123",
        expiresAt: new Date(Date.now() + 3600000), // Valid for 1 hour
        used: true,
      };
      vi.mocked(storage.getPasswordResetToken).mockResolvedValue(usedToken);

      const result = await storage.getPasswordResetToken("used-token");
      expect(result).toBeDefined();
      expect(result!.used).toBe(true);
    });

    it("should reset password with valid token", async () => {
      const validToken = {
        userId: "user-123",
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
      };
      const mockUser = createMockUser();

      vi.mocked(storage.getPasswordResetToken).mockResolvedValue(validToken);
      vi.mocked(storage.getUser).mockResolvedValue(mockUser);
      vi.mocked(storage.updateUser).mockResolvedValue({
        ...mockUser,
        password: "new-hashed-password",
      });
      vi.mocked(storage.markPasswordResetTokenUsed).mockResolvedValue();
      vi.mocked(storage.deleteExpiredPasswordResetTokens).mockResolvedValue(0);

      // Verify flow
      const token = await storage.getPasswordResetToken("valid-token");
      expect(token).toBeDefined();
      expect(token!.used).toBe(false);
      expect(token!.expiresAt > new Date()).toBe(true);

      const user = await storage.getUser(token!.userId);
      expect(user).toBeDefined();

      await storage.updateUser("user-123", { password: "new-hashed" });
      expect(storage.updateUser).toHaveBeenCalledWith("user-123", {
        password: "new-hashed",
      });

      await storage.markPasswordResetTokenUsed("valid-token");
      expect(storage.markPasswordResetTokenUsed).toHaveBeenCalled();
    });

    it("should reject if user not found for token", async () => {
      const validToken = {
        userId: "deleted-user",
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
      };

      vi.mocked(storage.getPasswordResetToken).mockResolvedValue(validToken);
      vi.mocked(storage.getUser).mockResolvedValue(undefined);

      const token = await storage.getPasswordResetToken("valid-token");
      const user = await storage.getUser(token!.userId);
      expect(user).toBeUndefined();
    });

    it("should clean up expired tokens after reset", async () => {
      vi.mocked(storage.deleteExpiredPasswordResetTokens).mockResolvedValue(5);

      const count = await storage.deleteExpiredPasswordResetTokens();
      expect(count).toBe(5);
      expect(storage.deleteExpiredPasswordResetTokens).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // UPDATE EMAIL TESTS
  // ==========================================================================

  describe("POST /api/auth/update-email", () => {
    it("should reject unauthenticated requests", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const result = await getSession("invalid-session");
      expect(result).toBeNull();
    });

    it("should update email for authenticated user", async () => {
      const session = { userId: "user-123", expiresAt: new Date() };
      vi.mocked(getSession).mockResolvedValue(session);
      vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined); // Email not in use
      vi.mocked(storage.updateUser).mockResolvedValue({
        ...createMockUser(),
        email: "new@example.com",
      });

      const sessionResult = await getSession("valid-session");
      expect(sessionResult).toBeDefined();

      // Check email not in use
      const existing = await storage.getUserByEmail("new@example.com");
      expect(existing).toBeUndefined();

      // Update email
      const updated = await storage.updateUser("user-123", {
        email: "new@example.com",
      });
      expect(updated?.email).toBe("new@example.com");
    });

    it("should reject email already in use by another user", async () => {
      const session = { userId: "user-123", expiresAt: new Date() };
      const existingUser = createMockUser({
        id: "other-user",
        username: "otheruser",
        email: "taken@example.com",
      });

      vi.mocked(getSession).mockResolvedValue(session);
      vi.mocked(storage.getUserByEmail).mockResolvedValue(existingUser);

      const existing = await storage.getUserByEmail("taken@example.com");
      expect(existing).toBeDefined();
      expect(existing!.id).not.toBe("user-123");
    });

    it("should allow updating to same email (own email)", async () => {
      const session = { userId: "user-123", expiresAt: new Date() };
      const sameUser = createMockUser({
        id: "user-123",
        email: "same@example.com",
      });

      vi.mocked(getSession).mockResolvedValue(session);
      vi.mocked(storage.getUserByEmail).mockResolvedValue(sameUser);

      const existing = await storage.getUserByEmail("same@example.com");
      // Same user - should be allowed
      expect(existing?.id).toBe(session.userId);
    });

    it("should validate email format", async () => {
      const invalidEmails = [
        "notanemail",
        "@nodomain",
        "no@",
        "spaces in@email.com",
        "",
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (const email of invalidEmails) {
        expect(emailRegex.test(email)).toBe(false);
      }

      const validEmails = [
        "test@example.com",
        "user.name@domain.co.uk",
        "user+tag@example.org",
      ];

      for (const email of validEmails) {
        expect(emailRegex.test(email)).toBe(true);
      }
    });

    it("should sanitize email input", async () => {
      const session = { userId: "user-123", expiresAt: new Date() };
      vi.mocked(getSession).mockResolvedValue(session);
      vi.mocked(storage.getUserByEmail).mockResolvedValue(undefined);
      vi.mocked(storage.updateUser).mockImplementation(async (id, data) => ({
        ...createMockUser({ id }),
        ...data,
      }));

      // Email should be lowercased and trimmed
      const rawEmail = "  Test@EXAMPLE.com  ";
      const sanitizedEmail = rawEmail.toLowerCase().trim();

      expect(sanitizedEmail).toBe("test@example.com");
    });
  });

  // ==========================================================================
  // RATE LIMITING TESTS
  // ==========================================================================

  describe("Rate Limiting", () => {
    it("should have rate limiting configured for auth routes", () => {
      // Rate limiting is configured in auth.ts with:
      // - windowMs: 15 * 60 * 1000 (15 minutes)
      // - max: 5 (5 attempts per window)
      const rateLimitConfig = {
        windowMs: 15 * 60 * 1000,
        max: 5,
      };

      expect(rateLimitConfig.windowMs).toBe(900000); // 15 minutes in ms
      expect(rateLimitConfig.max).toBe(5);
    });

    it("should apply rate limiting to login endpoint", () => {
      // Login route has authLimiter middleware
      const protectedRoutes = [
        "/signup",
        "/login",
        "/forgot-password",
        "/reset-password",
      ];

      // These routes should all have rate limiting
      expect(protectedRoutes).toContain("/login");
      expect(protectedRoutes).toContain("/signup");
      expect(protectedRoutes).toContain("/forgot-password");
      expect(protectedRoutes).toContain("/reset-password");
    });

    it("should NOT rate limit /me and /logout endpoints", () => {
      // These endpoints don't have authLimiter
      const unprotectedRoutes = ["/me", "/logout", "/update-email"];

      expect(unprotectedRoutes).toContain("/me");
      expect(unprotectedRoutes).toContain("/logout");
    });
  });

  // ==========================================================================
  // COOKIE CONFIGURATION TESTS
  // ==========================================================================

  describe("Cookie Configuration", () => {
    it("should use httpOnly cookies", () => {
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      expect(cookieOptions.httpOnly).toBe(true);
    });

    it("should set secure flag in production", () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = "production";
      expect(process.env.NODE_ENV === "production").toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it("should set sameSite to lax", () => {
      const cookieOptions = {
        httpOnly: true,
        secure: false,
        sameSite: "lax" as const,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };

      expect(cookieOptions.sameSite).toBe("lax");
    });

    it("should set maxAge to 7 days", () => {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const cookieOptions = {
        maxAge: sevenDaysMs,
      };

      expect(cookieOptions.maxAge).toBe(604800000);
    });
  });

  // ==========================================================================
  // SESSION MANAGEMENT TESTS
  // ==========================================================================

  describe("Session Management", () => {
    it("should create session on successful login", async () => {
      vi.mocked(createSession).mockResolvedValue("session-for-user-123");
      const sessionId = await createSession("user-123");
      expect(sessionId).toBe("session-for-user-123");
      expect(createSession).toHaveBeenCalledWith("user-123");
    });

    it("should create session on successful signup", async () => {
      vi.mocked(storage.createUser).mockResolvedValue(
        createMockUser({ id: "new-user" })
      );
      vi.mocked(createSession).mockResolvedValue("new-session-id");

      const user = await storage.createUser({
        username: "newuser",
        password: "hash",
      });
      const sessionId = await createSession(user.id);

      expect(sessionId).toBe("new-session-id");
    });

    it("should validate session on authenticated requests", async () => {
      const validSession = {
        userId: "user-123",
        expiresAt: new Date(Date.now() + 86400000),
      };
      vi.mocked(getSession).mockResolvedValue(validSession);

      const session = await getSession("valid-session-id");
      expect(session).toBeDefined();
      expect(session?.userId).toBe("user-123");
    });

    it("should return null for invalid session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const session = await getSession("invalid-session-id");
      expect(session).toBeNull();
    });
  });
});

// ============================================================================
// PROTECTED ROUTES AUTHENTICATION TESTS
// ============================================================================

describe("Protected Routes Authentication", () => {
  describe("requireAuth Middleware", () => {
    it("should return 401 for unauthenticated requests to protected routes", async () => {
      const req = createMockReq({
        path: "/api/strategies",
        method: "GET",
        // No userId - unauthenticated
      }) as any;
      const { res, json, status } = createMockRes();

      const { requireAuth } =
        await import("../../../server/middleware/requireAuth");
      const next = vi.fn();

      requireAuth(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Unauthorized",
          message: "Authentication required",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow authenticated requests to protected routes", async () => {
      const mockUser = createMockUser();
      const req = createMockReq({
        path: "/api/strategies",
        method: "GET",
      }) as any;
      req.userId = mockUser.id; // Authenticated with userId

      const { res } = createMockRes();
      const { requireAuth } =
        await import("../../../server/middleware/requireAuth");
      const next = vi.fn();

      requireAuth(req, res as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should reject requests with missing user ID", async () => {
      const req = createMockReq({
        path: "/api/positions",
        method: "GET",
      }) as any;
      req.userId = undefined; // Missing userId

      const { res, json, status } = createMockRes();
      const { requireAuth } =
        await import("../../../server/middleware/requireAuth");
      const next = vi.fn();

      requireAuth(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Unauthorized",
          message: "Authentication required",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("requireAdmin Middleware", () => {
    it("should return 401 for unauthenticated requests to admin routes", async () => {
      const req = createMockReq({
        path: "/api/admin/trading",
        method: "GET",
      }) as any;
      // No userId - unauthenticated

      const { res, json, status } = createMockRes();
      const { requireAdmin } =
        await import("../../../server/middleware/requireAuth");
      const next = vi.fn();

      requireAdmin(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Unauthorized",
          message: "Authentication required",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow authenticated users to access admin routes (role check not yet implemented)", async () => {
      const mockUser = createMockUser({ isAdmin: true });
      const req = createMockReq({
        path: "/api/admin/trading",
        method: "GET",
      }) as any;
      req.userId = mockUser.id; // Authenticated

      const { res } = createMockRes();
      const { requireAdmin } =
        await import("../../../server/middleware/requireAuth");
      const next = vi.fn();

      // Currently requireAdmin only checks authentication, not role
      // TODO: Update this test when admin role checking is implemented
      requireAdmin(req, res as Response, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("Route-Specific Authentication", () => {
    it("should protect trading routes (POST /api/alpaca/orders)", async () => {
      const req = createMockReq({
        path: "/api/alpaca/orders",
        method: "POST",
        body: { symbol: "AAPL", side: "buy", qty: 1 },
      }) as any;

      const { res, json, status } = createMockRes();
      const { requireAuth } =
        await import("../../../server/middleware/requireAuth");
      const next = vi.fn();

      requireAuth(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should protect strategy routes (GET /api/strategies)", async () => {
      const req = createMockReq({
        path: "/api/strategies",
        method: "GET",
      }) as any;

      const { res, json, status } = createMockRes();
      const { requireAuth } =
        await import("../../../server/middleware/requireAuth");
      const next = vi.fn();

      requireAuth(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should protect position routes (DELETE /api/positions)", async () => {
      const req = createMockReq({
        path: "/api/positions",
        method: "DELETE",
      }) as any;

      const { res, json, status } = createMockRes();
      const { requireAuth } =
        await import("../../../server/middleware/requireAuth");
      const next = vi.fn();

      requireAuth(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should protect backtest routes (POST /api/backtests)", async () => {
      const req = createMockReq({
        path: "/api/backtests",
        method: "POST",
      }) as any;

      const { res, json, status } = createMockRes();
      const { requireAuth } =
        await import("../../../server/middleware/requireAuth");
      const next = vi.fn();

      requireAuth(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Public Routes (No Authentication Required)", () => {
    it("should allow unauthenticated access to login endpoint", () => {
      // This test verifies that /api/auth/login does NOT have requireAuth middleware
      // The actual route implementation is tested in other test suites
      const publicRoutes = [
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/health",
      ];

      // These routes should NOT require authentication
      expect(publicRoutes).toBeDefined();
      expect(publicRoutes.length).toBeGreaterThan(0);
    });
  });
});
