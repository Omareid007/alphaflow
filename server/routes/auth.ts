import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { createSession, getSession, deleteSession } from "../lib/session";
import { storage } from "../storage";
import { log } from "../utils/logger";
import { badRequest, unauthorized, serverError, validationError } from "../lib/standard-errors";
import { sanitizeInput } from "../lib/sanitization";
import { insertUserSchema } from "@shared/schema";

const router = Router();

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
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, "Invalid input: username and password required", parsed.error);
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
    const user = await storage.createUser({ username: sanitizedUsername, password: hashedPassword });

    const sessionId = await createSession(user.id);

    res.cookie("session", sessionId, getCookieOptions());

    log.info("AuthAPI", `User registered: ${sanitizedUsername}`);

    res.status(201).json({ id: user.id, username: user.username, isAdmin: user.isAdmin });
  } catch (error) {
    log.error("AuthAPI", `Signup error: ${error}`);
    return serverError(res, "Failed to create account");
  }
});

// POST /api/auth/login
// Authenticate user and create session
router.post("/login", async (req: Request, res: Response) => {
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

export default router;
