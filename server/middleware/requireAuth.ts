import { Response, NextFunction } from "express";
import { unauthorized } from "../lib/standard-errors";
import type { AuthenticatedRequest } from "./auth";

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
 * TODO: Add admin role check when user roles implemented
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.userId) {
    unauthorized(res, "Authentication required");
    return;
  }

  // TODO: Add admin role check when user roles are implemented in schema
  // Currently all authenticated users can access admin routes
  // Future implementation:
  // if (req.user.role !== "admin") {
  //   forbidden(res, "Admin access required");
  //   return;
  // }

  next();
};
