/**
 * Standardized Error Response System
 *
 * Provides consistent error responses across all API endpoints
 * Format: { error: string, message: string, statusCode: number, details?: any }
 */

import type { Response } from "express";
import { log } from "../utils/logger";

export interface StandardError {
  error: string;
  message: string;
  statusCode: number;
  details?: any;
  timestamp?: string;
  path?: string;
}

/**
 * Send a standardized error response
 */
export function sendError(
  res: Response,
  statusCode: number,
  error: string,
  message: string,
  details?: any
): Response {
  const errorResponse: StandardError = {
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  if (details) {
    errorResponse.details = details;
  }

  return res.status(statusCode).json(errorResponse);
}

/**
 * 400 Bad Request
 */
export function badRequest(
  res: Response,
  message: string = "Invalid request parameters",
  details?: any
): Response {
  return sendError(res, 400, "Bad Request", message, details);
}

/**
 * 401 Unauthorized
 */
export function unauthorized(
  res: Response,
  message: string = "Authentication required",
  details?: any
): Response {
  return sendError(res, 401, "Unauthorized", message, details);
}

/**
 * 403 Forbidden
 */
export function forbidden(
  res: Response,
  message: string = "Access denied",
  details?: any
): Response {
  return sendError(res, 403, "Forbidden", message, details);
}

/**
 * 404 Not Found
 */
export function notFound(
  res: Response,
  message: string = "Resource not found",
  details?: any
): Response {
  return sendError(res, 404, "Not Found", message, details);
}

/**
 * 409 Conflict
 */
export function conflict(
  res: Response,
  message: string = "Resource conflict",
  details?: any
): Response {
  return sendError(res, 409, "Conflict", message, details);
}

/**
 * 422 Unprocessable Entity (Validation Error)
 */
export function validationError(
  res: Response,
  message: string = "Validation failed",
  details?: any
): Response {
  return sendError(res, 422, "Validation Error", message, details);
}

/**
 * 429 Too Many Requests
 */
export function tooManyRequests(
  res: Response,
  message: string = "Rate limit exceeded",
  details?: any
): Response {
  return sendError(res, 429, "Too Many Requests", message, details);
}

/**
 * 500 Internal Server Error
 */
export function serverError(
  res: Response,
  message: string = "An internal server error occurred",
  details?: any
): Response {
  return sendError(res, 500, "Internal Server Error", message, details);
}

/**
 * 503 Service Unavailable
 */
export function serviceUnavailable(
  res: Response,
  message: string = "Service temporarily unavailable",
  details?: any
): Response {
  return sendError(res, 503, "Service Unavailable", message, details);
}

/**
 * Create error from Zod validation result
 */
export function fromZodError(res: Response, zodError: any): Response {
  const details = zodError.errors?.map((err: any) => ({
    field: err.path.join("."),
    message: err.message,
  }));

  return validationError(res, "Request validation failed", { fields: details });
}

/**
 * Wrap async route handlers with automatic error handling
 */
export function asyncHandler(
  fn: (req: any, res: any, next: any) => Promise<any>
) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      log.error("AsyncHandler", "Error caught in async handler", {
        error: error.message,
        stack: error.stack,
      });

      // Handle specific error types
      if (error.name === "ZodError") {
        return fromZodError(res, error);
      }

      if (error.statusCode) {
        return sendError(
          res,
          error.statusCode,
          error.name || "Error",
          error.message
        );
      }

      // Default to server error
      return serverError(res, error.message || "An unexpected error occurred", {
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    });
  };
}

/**
 * Custom error class for business logic errors
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}
