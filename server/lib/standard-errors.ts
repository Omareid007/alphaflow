/**
 * Standardized Error Response System
 *
 * Provides consistent error responses across all API endpoints
 * Format: { error: string, message: string, statusCode: number, details?: any }
 */

import type { Request, Response, NextFunction } from "express";
import { log } from "../utils/logger";

/**
 * Error details can be field validation errors, additional context, or debug info
 */
export interface ErrorDetails {
  fields?: Array<{ field: string; message: string }>;
  stack?: string;
  [key: string]: unknown;
}

export interface StandardError {
  error: string;
  message: string;
  statusCode: number;
  details?: ErrorDetails;
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
  details?: ErrorDetails
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
  details?: ErrorDetails
): Response {
  return sendError(res, 400, "Bad Request", message, details);
}

/**
 * 401 Unauthorized
 */
export function unauthorized(
  res: Response,
  message: string = "Authentication required",
  details?: ErrorDetails
): Response {
  return sendError(res, 401, "Unauthorized", message, details);
}

/**
 * 403 Forbidden
 */
export function forbidden(
  res: Response,
  message: string = "Access denied",
  details?: ErrorDetails
): Response {
  return sendError(res, 403, "Forbidden", message, details);
}

/**
 * 404 Not Found
 */
export function notFound(
  res: Response,
  message: string = "Resource not found",
  details?: ErrorDetails
): Response {
  return sendError(res, 404, "Not Found", message, details);
}

/**
 * 409 Conflict
 */
export function conflict(
  res: Response,
  message: string = "Resource conflict",
  details?: ErrorDetails
): Response {
  return sendError(res, 409, "Conflict", message, details);
}

/**
 * 422 Unprocessable Entity (Validation Error)
 */
export function validationError(
  res: Response,
  message: string = "Validation failed",
  details?: ErrorDetails
): Response {
  return sendError(res, 422, "Validation Error", message, details);
}

/**
 * 429 Too Many Requests
 */
export function tooManyRequests(
  res: Response,
  message: string = "Rate limit exceeded",
  details?: ErrorDetails
): Response {
  return sendError(res, 429, "Too Many Requests", message, details);
}

/**
 * 500 Internal Server Error
 */
export function serverError(
  res: Response,
  message: string = "An internal server error occurred",
  details?: ErrorDetails
): Response {
  return sendError(res, 500, "Internal Server Error", message, details);
}

/**
 * 503 Service Unavailable
 */
export function serviceUnavailable(
  res: Response,
  message: string = "Service temporarily unavailable",
  details?: ErrorDetails
): Response {
  return sendError(res, 503, "Service Unavailable", message, details);
}

/**
 * Zod error issue structure
 */
interface ZodIssue {
  path: (string | number)[];
  message: string;
  code?: string;
}

/**
 * Zod error structure for typing
 */
interface ZodErrorLike {
  errors?: ZodIssue[];
  issues?: ZodIssue[];
}

/**
 * Create error from Zod validation result
 */
export function fromZodError(res: Response, zodError: ZodErrorLike): Response {
  const issues = zodError.errors || zodError.issues || [];
  const details = issues.map((err: ZodIssue) => ({
    field: err.path.join("."),
    message: err.message,
  }));

  return validationError(res, "Request validation failed", { fields: details });
}

/**
 * Extended error with status code
 */
interface HttpError extends Error {
  statusCode?: number;
}

/**
 * Type guard for ZodError-like objects
 */
function isZodError(error: unknown): error is ZodErrorLike & { name: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: string }).name === "ZodError"
  );
}

/**
 * Type guard for HttpError
 */
function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && "statusCode" in error;
}

/**
 * Wrap async route handlers with automatic error handling
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<Response | void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;

      log.error("AsyncHandler", "Error caught in async handler", {
        error: errorMessage,
        stack: errorStack,
      });

      // Handle specific error types
      if (isZodError(error)) {
        return fromZodError(res, error);
      }

      if (isHttpError(error)) {
        return sendError(
          res,
          error.statusCode || 500,
          error.name || "Error",
          error.message
        );
      }

      // Default to server error
      return serverError(res, errorMessage || "An unexpected error occurred", {
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
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
    public details?: ErrorDetails
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}
