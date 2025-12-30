/**
 * Request Logging Middleware
 * Logs all incoming requests with timing and correlation IDs
 */

import type { Request, Response, NextFunction } from "express";
import { log } from "../utils/logger";
import { randomBytes } from "crypto";

/**
 * Extended Express Request with correlation ID and user info
 */
export interface RequestWithCorrelation extends Request {
  correlationId?: string;
  userId?: string;
}

/**
 * Generate a unique correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return `req_${Date.now()}_${randomBytes(8).toString("hex")}`;
}

/**
 * Request logging middleware with timing
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const extendedReq = req as RequestWithCorrelation;
  const correlationId =
    (req.headers["x-correlation-id"] as string) || generateCorrelationId();

  // Attach correlation ID to request for use in other middleware/routes
  extendedReq.correlationId = correlationId;

  // Add correlation ID to response headers
  res.setHeader("X-Correlation-ID", correlationId);

  // Log incoming request
  log.info("Request", `${req.method} ${req.path}`, {
    correlationId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userId: extendedReq.userId,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  // Capture response - use proper response body type
  const originalSend = res.send;
  res.send = function (data: string | Buffer | object) {
    const duration = Date.now() - startTime;

    // Log response
    log.info("Response", `${req.method} ${req.path} - ${res.statusCode}`, {
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      userId: extendedReq.userId,
    });

    // Call original send
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Performance logging middleware for slow requests
 */
export function performanceLogger(thresholdMs: number = 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const extendedReq = req as RequestWithCorrelation;
    const correlationId = extendedReq.correlationId || "unknown";

    res.on("finish", () => {
      const duration = Date.now() - startTime;

      if (duration > thresholdMs) {
        log.warn(
          "Performance",
          `Slow request detected: ${req.method} ${req.path}`,
          {
            correlationId,
            method: req.method,
            path: req.path,
            durationMs: duration,
            threshold: thresholdMs,
            statusCode: res.statusCode,
          }
        );
      }
    });

    next();
  };
}
