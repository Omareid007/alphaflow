/**
 * Global Error Handler Middleware
 * Catches all unhandled errors and returns standardized responses
 */

import type { Request, Response, NextFunction } from "express";
import { log } from "../utils/logger";
import { serverError } from "../lib/standard-errors";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Async handler wrapper to catch promise rejections
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global error handling middleware
 * Should be registered last in the middleware chain
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const correlationId = (req as any).correlationId || "unknown";

  // Log the error with context
  log.error("ErrorHandler", `Unhandled error in ${req.method} ${req.path}`, {
    correlationId,
    error: err.message,
    stack: err.stack,
    code: err.code,
    statusCode: err.statusCode,
    method: req.method,
    path: req.path,
    userId: (req as any).userId,
  });

  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  // Use the error's status code or default to 500
  const statusCode = err.statusCode || 500;

  // Construct error response
  const errorResponse: any = {
    error: isDevelopment ? err.message : "Internal server error",
    code: err.code || "INTERNAL_ERROR",
    correlationId,
  };

  // Add stack trace in development
  if (isDevelopment && err.stack) {
    errorResponse.stack = err.stack.split("\n").slice(0, 5);
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response) {
  const correlationId = (req as any).correlationId || "unknown";

  log.warn("ErrorHandler", `Route not found: ${req.method} ${req.path}`, {
    correlationId,
    method: req.method,
    path: req.path,
  });

  res.status(404).json({
    error: "Not found",
    code: "NOT_FOUND",
    message: `Route ${req.method} ${req.path} not found`,
    correlationId,
  });
}
