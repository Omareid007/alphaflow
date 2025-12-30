import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { createSession, getSession, deleteSession } from "../lib/session";
import { storage } from "../storage";
import { log } from "../utils/logger";
import {
  badRequest,
  unauthorized,
  serverError,
  fromZodError,
} from "../lib/standard-errors";
import { sanitizeInput } from "../lib/sanitization";
import { insertUserSchema } from "@shared/schema";
import { sendPasswordResetEmail, isEmailConfigured } from "../lib/email-service";

const router = Router();

// Rate limiter for authentication routes - prevents brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  message: { error: "Too many authentication attempts, please try again later" },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    log.warn("AuthAPI", "Rate limit exceeded", {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({ error: "Too many authentication attempts, please try again later" });
  },
});

// Helper function to get secure cookie options
function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

// POST /api/auth/signup
// Register a new user account
router.post("/signup", authLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return fromZodError(res, parsed.error);
    }

    const { username, password } = parsed.data;

    // SECURITY: Sanitize username to prevent XSS attacks
    const sanitizedUsername = sanitizeInput(username);

    if (sanitizedUsername.length < 3) {
      return badRequest(res, "Username must be at least 3 characters");
    }

    if (password.length < 6) {
      return badRequest(res, "Password must be at least 6 characters");
    }

    const existingUser = await storage.getUserByUsername(sanitizedUsername);
    if (existingUser) {
      return badRequest(res, "Username already taken");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await storage.createUser({
      username: sanitizedUsername,
      password: hashedPassword,
    });

    const sessionId = await createSession(user.id);

    res.cookie("session", sessionId, getCookieOptions());

    log.info("AuthAPI", `User registered: ${sanitizedUsername}`);

    res
      .status(201)
      .json({ id: user.id, username: user.username, isAdmin: user.isAdmin });
  } catch (error) {
    log.error("AuthAPI", `Signup error: ${error}`);
    return serverError(res, "Failed to create account");
  }
});

// POST /api/auth/login
// Authenticate user and create session
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // SECURITY: Sanitize username to prevent XSS attacks
    const sanitizedUsername = sanitizeInput(username);

    if (!username || !password) {
      return badRequest(res, "Username and password required");
    }

    const user = await storage.getUserByUsername(sanitizedUsername);
    if (!user) {
      return unauthorized(res, "Invalid username or password");
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return unauthorized(res, "Invalid username or password");
    }

    const sessionId = await createSession(user.id);

    res.cookie("session", sessionId, getCookieOptions());

    log.info("AuthAPI", `User logged in: ${sanitizedUsername}`);

    res.json({ id: user.id, username: user.username, isAdmin: user.isAdmin });
  } catch (error) {
    log.error("AuthAPI", `Login error: ${error}`);
    return serverError(res, "Failed to login");
  }
});

// POST /api/auth/logout
// Destroy user session and clear cookies
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies?.session;
    if (sessionId) {
      await deleteSession(sessionId);
    }

    const { maxAge, ...clearOptions } = getCookieOptions();
    res.clearCookie("session", clearOptions);

    log.info("AuthAPI", "User logged out");

    res.json({ success: true });
  } catch (error) {
    log.error("AuthAPI", `Logout error: ${error}`);
    res.status(500).json({ error: "Failed to logout" });
  }
});

// GET /api/auth/me
// Get current authenticated user information
router.get("/me", async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: "Session expired" });
    }

    const user = await storage.getUser(session.userId);
    if (!user) {
      await deleteSession(sessionId);
      return res.status(401).json({ error: "User not found" });
    }

    res.json({ id: user.id, username: user.username, isAdmin: user.isAdmin });
  } catch (error) {
    log.error("AuthAPI", `Get user error: ${error}`);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// POST /api/auth/forgot-password
// Request password reset email
router.post("/forgot-password", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return badRequest(res, "Email is required");
    }

    // Check if email service is configured
    if (!isEmailConfigured()) {
      log.warn("AuthAPI", "Password reset requested but email service not configured");
      // Don't reveal that email is not configured - return success anyway for security
      return res.json({
        message: "If an account with that email exists, a password reset link has been sent",
      });
    }

    const sanitizedEmail = sanitizeInput(email.toLowerCase().trim());
    const user = await storage.getUserByEmail(sanitizedEmail);

    // Always return success to prevent email enumeration
    if (!user) {
      log.info("AuthAPI", `Password reset requested for non-existent email: ${sanitizedEmail}`);
      return res.json({
        message: "If an account with that email exists, a password reset link has been sent",
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token
    await storage.createPasswordResetToken(user.id, token, expiresAt);

    // Get base URL for reset link
    const baseUrl = process.env.BASE_URL || "http://localhost:5000";
    const resetUrl = `${baseUrl}/reset-password`;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@alphaflow.com";

    // Send email
    const result = await sendPasswordResetEmail({
      to: sanitizedEmail,
      from: fromEmail,
      username: user.username,
      resetToken: token,
      resetUrl,
    });

    if (result.success) {
      log.info("AuthAPI", `Password reset email sent to: ${sanitizedEmail}`);
    } else {
      log.error("AuthAPI", `Failed to send password reset email: ${result.error}`);
    }

    // Always return success to prevent email enumeration
    res.json({
      message: "If an account with that email exists, a password reset link has been sent",
    });
  } catch (error) {
    log.error("AuthAPI", `Forgot password error: ${error}`);
    return serverError(res, "Failed to process password reset request");
  }
});

// POST /api/auth/reset-password
// Reset password with token
router.post("/reset-password", authLimiter, async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return badRequest(res, "Token and new password are required");
    }

    if (password.length < 6) {
      return badRequest(res, "Password must be at least 6 characters");
    }

    // Look up token
    const resetToken = await storage.getPasswordResetToken(token);

    if (!resetToken) {
      log.warn("AuthAPI", "Invalid password reset token attempted");
      return badRequest(res, "Invalid or expired reset token");
    }

    // Check if token is expired
    if (new Date() > resetToken.expiresAt) {
      log.warn("AuthAPI", "Expired password reset token attempted");
      return badRequest(res, "Invalid or expired reset token");
    }

    // Check if token was already used
    if (resetToken.used) {
      log.warn("AuthAPI", "Already used password reset token attempted");
      return badRequest(res, "Invalid or expired reset token");
    }

    // Get user
    const user = await storage.getUser(resetToken.userId);
    if (!user) {
      log.error("AuthAPI", `Password reset token refers to non-existent user: ${resetToken.userId}`);
      return badRequest(res, "Invalid or expired reset token");
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(password, 10);
    await storage.updateUser(user.id, { password: hashedPassword });

    // Mark token as used
    await storage.markPasswordResetTokenUsed(token);

    // Clean up expired tokens
    await storage.deleteExpiredPasswordResetTokens();

    log.info("AuthAPI", `Password reset successful for user: ${user.username}`);

    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    log.error("AuthAPI", `Reset password error: ${error}`);
    return serverError(res, "Failed to reset password");
  }
});

// POST /api/auth/update-email
// Update user email (requires authentication)
router.post("/update-email", async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      return unauthorized(res, "Not authenticated");
    }

    const session = await getSession(sessionId);
    if (!session) {
      return unauthorized(res, "Session expired");
    }

    const { email } = req.body;
    if (!email) {
      return badRequest(res, "Email is required");
    }

    const sanitizedEmail = sanitizeInput(email.toLowerCase().trim());

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      return badRequest(res, "Invalid email format");
    }

    // Check if email is already in use by another user
    const existingUser = await storage.getUserByEmail(sanitizedEmail);
    if (existingUser && existingUser.id !== session.userId) {
      return badRequest(res, "Email is already in use");
    }

    // Update user email
    const updatedUser = await storage.updateUser(session.userId, { email: sanitizedEmail });
    if (!updatedUser) {
      return serverError(res, "Failed to update email");
    }

    log.info("AuthAPI", `Email updated for user: ${updatedUser.username}`);

    res.json({ message: "Email updated successfully" });
  } catch (error) {
    log.error("AuthAPI", `Update email error: ${error}`);
    return serverError(res, "Failed to update email");
  }
});

export default router;
