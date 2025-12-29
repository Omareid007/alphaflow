/**
 * Audit Logging Middleware
 *
 * Automatically logs all user actions (POST, PUT, DELETE, PATCH)
 * to the audit_logs table for compliance and debugging
 */

import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import type { InsertAuditLog } from "@shared/schema";
import { log } from "../utils/logger";

/**
 * List of sensitive fields to exclude from request body logging
 */
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "apiKey",
  "secret",
  "authorization",
  "cookie",
  "session",
];

/**
 * Sanitize request body by removing sensitive fields
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== "object") {
    return body;
  }

  const sanitized = { ...body };

  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeRequestBody(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Determine action name from method and path
 */
function getActionName(method: string, path: string): string {
  const pathSegments = path.split("/").filter(Boolean);

  // Extract resource from path
  let resource = "unknown";
  if (pathSegments.length >= 2 && pathSegments[0] === "api") {
    resource = pathSegments[1];
  }

  // Map HTTP methods to action verbs
  const actionMap: Record<string, string> = {
    POST: "create",
    PUT: "update",
    PATCH: "update",
    DELETE: "delete",
  };

  const verb = actionMap[method] || method.toLowerCase();
  return `${verb}_${resource}`;
}

/**
 * Extract resource ID from request
 */
function extractResourceId(req: Request): string | undefined {
  // Try to get from params
  if (req.params.id) {
    return req.params.id;
  }

  // Try common ID param names
  for (const param of [
    "userId",
    "strategyId",
    "orderId",
    "tradeId",
    "backtestId",
  ]) {
    if (req.params[param]) {
      return req.params[param];
    }
  }

  // Try from body
  if (req.body?.id) {
    return req.body.id;
  }

  return undefined;
}

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

/**
 * Audit logging middleware
 */
export async function auditLogger(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();

  // Only log state-changing operations
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }

  // Skip health check and non-API endpoints
  if (req.path.startsWith("/health") || !req.path.startsWith("/api")) {
    return next();
  }

  // Get user info from request (set by authMiddleware)
  const userId = req.userId || null;
  let username: string | null = null;

  if (userId) {
    try {
      const user = await storage.getUser(userId);
      username = user?.username || null;
    } catch (error: any) {
      log.error("AuditLogger", "Failed to get username", {
        error: error.message,
      });
    }
  }

  // Prepare audit log data
  const auditLog: Omit<InsertAuditLog, "id" | "timestamp"> = {
    userId,
    username,
    action: getActionName(req.method, req.path),
    resource: req.path.split("/")[2] || "unknown", // Extract from /api/resource/...
    resourceId: extractResourceId(req),
    method: req.method,
    path: req.path,
    ipAddress: getClientIp(req),
    userAgent: req.headers["user-agent"] || null,
    requestBody: sanitizeRequestBody(req.body),
    responseStatus: null,
    errorMessage: null,
  };

  // Capture response
  const originalSend = res.send;
  const originalJson = res.json;
  let responseBody: any;

  res.send = function (body: any) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  res.json = function (body: any) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  // Wait for response to finish
  res.on("finish", async () => {
    try {
      // Update audit log with response info
      auditLog.responseStatus = res.statusCode;

      // Log error message if response failed
      if (res.statusCode >= 400) {
        if (typeof responseBody === "string") {
          try {
            const parsed = JSON.parse(responseBody);
            auditLog.errorMessage =
              parsed.error || parsed.message || "Unknown error";
          } catch {
            auditLog.errorMessage = responseBody.substring(0, 500);
          }
        } else if (responseBody?.error || responseBody?.message) {
          auditLog.errorMessage = responseBody.error || responseBody.message;
        }
      }

      // Save to database
      await storage.createAuditLog(auditLog as InsertAuditLog);

      const duration = Date.now() - startTime;
      log.info("Audit", "Request logged", {
        method: auditLog.method,
        path: auditLog.path,
        status: auditLog.responseStatus,
        durationMs: duration,
        user: username || "anonymous",
      });
    } catch (error: any) {
      log.error("AuditLogger", "Failed to save audit log", {
        error: error.message,
      });
    }
  });

  next();
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(
  userId: string,
  limit: number = 100,
  offset: number = 0
) {
  return storage.getUserAuditLogs(userId, limit, offset);
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditLogs(
  resource: string,
  resourceId: string,
  limit: number = 50
) {
  return storage.getResourceAuditLogs(resource, resourceId, limit);
}

/**
 * Get recent audit logs (admin only)
 */
export async function getRecentAuditLogs(
  limit: number = 100,
  offset: number = 0
) {
  return storage.getRecentAuditLogs(limit, offset);
}

/**
 * Get audit logs (alias for getRecentAuditLogs)
 */
export async function getAuditLogs(limit: number = 100, offset: number = 0) {
  return storage.getRecentAuditLogs(limit, offset);
}

/**
 * Get audit statistics
 */
export async function getAuditStats() {
  try {
    const recentLogs = await storage.getRecentAuditLogs(1000, 0);
    const logs = recentLogs || [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayLogs = logs.filter((l: any) => new Date(l.timestamp) >= today);
    const weekLogs = logs.filter((l: any) => new Date(l.timestamp) >= thisWeek);

    const errorLogs = logs.filter(
      (l: any) => l.responseStatus && l.responseStatus >= 400
    );

    const actionCounts: Record<string, number> = {};
    logs.forEach((l: any) => {
      actionCounts[l.action] = (actionCounts[l.action] || 0) + 1;
    });

    return {
      totalLogs: logs.length,
      todayCount: todayLogs.length,
      weekCount: weekLogs.length,
      errorCount: errorLogs.length,
      topActions: Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([action, count]) => ({ action, count })),
    };
  } catch (error: any) {
    log.error("AuditLogger", "Failed to get audit stats", {
      error: error.message,
    });
    return {
      totalLogs: 0,
      todayCount: 0,
      weekCount: 0,
      errorCount: 0,
      topActions: [],
    };
  }
}
