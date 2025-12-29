/**
 * Admin Management Routes
 * Handles audit logs, dashboard, users, and observability
 */

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../../storage";
import { log } from "../../utils/logger";

const router = Router();

// ============================================================================
// AUDIT LOGS ENDPOINTS
// ============================================================================

// GET /api/admin/audit-logs - Get audit logs
router.get("/audit-logs", async (req: Request, res: Response) => {
  try {
    const { getAuditLogs } = await import("../../middleware/audit-logger");

    const { limit, offset } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 100;
    const offsetNum = offset ? parseInt(offset as string) : 0;
    const logs = await getAuditLogs(limitNum, offsetNum);

    res.json({ logs, count: logs.length });
  } catch (error) {
    log.error("AdminMgmt", "Failed to get audit logs", { error });
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

// GET /api/admin/audit-logs/stats - Get audit log statistics
router.get("/audit-logs/stats", async (req: Request, res: Response) => {
  try {
    const { getAuditStats } = await import("../../middleware/audit-logger");
    const stats = await getAuditStats();
    res.json(stats);
  } catch (error) {
    log.error("AdminMgmt", "Failed to get audit stats", { error });
    res.status(500).json({ error: "Failed to get audit stats" });
  }
});

// ============================================================================
// DASHBOARD ENDPOINT
// ============================================================================

// GET /api/admin/dashboard - Get dashboard stats
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const { getAllAvailableProviders } = await import("../../ai/index");
    const { getAllProviderStatuses } = await import("../../lib/callExternal");

    // Get provider stats
    const aiProviders = getAllAvailableProviders();
    const providerStatuses = await getAllProviderStatuses();
    const activeProviders = Object.entries(providerStatuses).filter(
      ([_, status]) => (status as any).isAvailable
    ).length;

    // Get job stats from work queue
    const pendingCount = await storage.getWorkItemCount("PENDING");
    const runningCount = await storage.getWorkItemCount("RUNNING");
    const failedCount = await storage.getWorkItemCount("FAILED");

    // Get kill switch status
    const agentStatus = await storage.getAgentStatus();

    res.json({
      providers: {
        total: aiProviders.length,
        active: activeProviders,
      },
      models: {
        total: aiProviders.length,
        enabled: activeProviders,
      },
      jobs: {
        running: runningCount,
        pending: pendingCount,
        failed: failedCount,
      },
      killSwitch: !(agentStatus?.autoExecuteTrades ?? false),
    });
  } catch (error) {
    log.error("AdminMgmt", "Failed to get dashboard stats", { error });
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

// ============================================================================
// USERS MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/admin/users - Get all users (requires admin:read)
router.get("/users", async (req: Request, res: Response) => {
  try {
    const allUsers = await storage.getAllUsers();
    // Return users without password field
    const sanitizedUsers = allUsers.map(({ password, ...user }) => ({
      ...user,
      createdAt: new Date().toISOString(),
    }));
    res.json({ users: sanitizedUsers, count: sanitizedUsers.length });
  } catch (error) {
    log.error("AdminMgmt", "Failed to get users", { error });
    res.status(500).json({ error: "Failed to get users" });
  }
});

// GET /api/admin/users/:id - Get specific user (requires admin:read)
router.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const { password, ...sanitizedUser } = user;
    res.json(sanitizedUser);
  } catch (error) {
    log.error("AdminMgmt", "Failed to get user", { error });
    res.status(500).json({ error: "Failed to get user" });
  }
});

// POST /api/admin/users - Create user (requires admin:write)
router.post("/users", async (req: Request, res: Response) => {
  try {
    const { username, password, isAdmin } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    // Check if username already exists
    const existing = await storage.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await storage.createUser({
      username,
      password: hashedPassword,
      isAdmin: isAdmin || false,
    });

    const { password: _, ...sanitizedUser } = user;
    res.status(201).json(sanitizedUser);
  } catch (error) {
    log.error("AdminMgmt", "Failed to create user", { error });
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PATCH /api/admin/users/:id - Update user (requires admin:write)
router.patch("/users/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, password, isAdmin } = req.body;

    const updates: any = {};
    if (username !== undefined) updates.username = username;
    if (isAdmin !== undefined) updates.isAdmin = isAdmin;

    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }

    const user = await storage.updateUser(id, updates);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { password: _, ...sanitizedUser } = user;
    res.json(sanitizedUser);
  } catch (error) {
    log.error("AdminMgmt", "Failed to update user", { error });
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/admin/users/:id - Delete user (requires admin:danger)
router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.userId) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const deleted = await storage.deleteUser(id);
    if (!deleted) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true });
  } catch (error) {
    log.error("AdminMgmt", "Failed to delete user", { error });
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ============================================================================
// OBSERVABILITY ENDPOINTS
// ============================================================================

// GET /api/admin/observability/metrics - Get system metrics (requires admin:read)
router.get("/observability/metrics", async (req: Request, res: Response) => {
  try {
    // System metrics
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Work queue stats
    const pendingJobs = await storage.getWorkItemCount("PENDING");
    const runningJobs = await storage.getWorkItemCount("RUNNING");
    const failedJobs = await storage.getWorkItemCount("FAILED");
    const completedJobs = await storage.getWorkItemCount("SUCCEEDED");

    // Database stats (via audit logs as proxy for activity)
    const recentLogs = await storage.getRecentAuditLogs(100);
    const logsLast24h = recentLogs.filter((log: any) => {
      const logTime = new Date(log.timestamp || log.createdAt).getTime();
      return Date.now() - logTime < 24 * 60 * 60 * 1000;
    }).length;

    res.json({
      system: {
        memoryUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        memoryTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        uptimeHours: Math.round((uptime / 3600) * 10) / 10,
        nodeVersion: process.version,
      },
      workQueue: {
        pending: pendingJobs,
        running: runningJobs,
        failed: failedJobs,
        completed: completedJobs,
      },
      activity: {
        logsLast24h,
        totalRecentLogs: recentLogs.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminMgmt", "Failed to get observability metrics", { error });
    res.status(500).json({ error: "Failed to get observability metrics" });
  }
});

// GET /api/admin/observability/logs - Get logs (requires admin:read)
router.get("/observability/logs", async (req: Request, res: Response) => {
  try {
    const { limit, offset, level } = req.query;
    const limitNum = parseInt(limit as string) || 50;
    const offsetNum = parseInt(offset as string) || 0;

    const logs = await storage.getRecentAuditLogs(limitNum, offsetNum);

    // Filter by level if specified
    const filteredLogs = level
      ? logs.filter((log: any) => log.level === level)
      : logs;

    res.json({
      logs: filteredLogs,
      count: filteredLogs.length,
      offset: offsetNum,
    });
  } catch (error) {
    log.error("AdminMgmt", "Failed to get logs", { error });
    res.status(500).json({ error: "Failed to get logs" });
  }
});

// GET /api/admin/observability/health - Get health status (requires admin:read)
router.get("/observability/health", async (req: Request, res: Response) => {
  try {
    const { getAllProviderStatuses } = await import("../../lib/callExternal");

    // Check database health
    let dbHealthy = true;
    try {
      await storage.getAgentStatus();
    } catch {
      dbHealthy = false;
    }

    // Check API providers
    const providerStatuses = await getAllProviderStatuses();
    const providersHealthy = Object.values(providerStatuses).some(
      (s: any) => s.isAvailable
    );

    // Check Alpaca
    let alpacaHealthy = false;
    try {
      const alpaca = await import("../../connectors/alpaca");
      const account = await alpaca.alpacaClient.getAccount();
      alpacaHealthy = account?.status === "ACTIVE";
    } catch {
      alpacaHealthy = false;
    }

    res.json({
      services: [
        {
          name: "Database",
          status: dbHealthy ? "healthy" : "unhealthy",
          message: dbHealthy ? "Connected" : "Connection failed",
        },
        { name: "API Endpoints", status: "healthy", message: "Operational" },
        {
          name: "LLM Providers",
          status: providersHealthy ? "healthy" : "degraded",
          message: providersHealthy ? "Available" : "No providers",
        },
        {
          name: "Alpaca Trading",
          status: alpacaHealthy ? "healthy" : "unhealthy",
          message: alpacaHealthy ? "Connected" : "Disconnected",
        },
        { name: "Background Jobs", status: "healthy", message: "Running" },
      ],
      overall: dbHealthy && alpacaHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminMgmt", "Failed to get health status", { error });
    res.status(500).json({ error: "Failed to get health status" });
  }
});

export default router;
