import { Request, Response, NextFunction } from "express";
import { unauthorized, forbidden } from "../lib/standard-errors";
import { storage } from "../storage";

/**
 * Extended Request type with authentication properties
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * Middleware to require authentication for protected routes
 * Checks if req.userId exists (set by authMiddleware)
 * Returns 401 Unauthorized if not authenticated
 */
export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.userId) {
    unauthorized(res, "Authentication required");
    return;
  }
  next();
};

/**
 * Middleware to require admin role for admin-only routes
 * First checks authentication, then verifies admin role
 * SECURITY: Blocks access to admin routes for non-admin users
 */
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.userId) {
    unauthorized(res, "Authentication required");
    return;
  }

  try {
    // SECURITY: Fetch user from database and check admin status
    const user = await storage.getUser(req.userId);

    if (!user) {
      unauthorized(res, "User not found");
      return;
    }

    if (!user.isAdmin) {
      forbidden(res, "Admin access required");
      return;
    }

    // User is authenticated and has admin privileges
    next();
  } catch (error) {
    console.error("Admin role check failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
