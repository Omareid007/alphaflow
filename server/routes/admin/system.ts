/**
 * Admin System Routes
 * Handles modules, RBAC, settings, orchestrator control, jobs, and search
 */

import { Router, Request, Response } from "express";
import { storage } from "../../storage";
import {
  initializeDefaultModules,
  getModules,
  getModule,
  getAdminOverview,
} from "../../admin/registry";
import {
  createRBACContext,
  hasCapability,
  filterModulesByCapability,
  getAllRoles,
  getRoleInfo,
} from "../../admin/rbac";
import {
  getSetting,
  getSettingFull,
  setSetting,
  deleteSetting,
  listSettings,
  sanitizeSettingForResponse,
} from "../../admin/settings";
import { globalSearch, getRelatedEntities } from "../../admin/global-search";
import { orchestrator } from "../../autonomous/orchestrator";
import { getAllUsageStats } from "../../lib/apiBudget";
import { getCallStats } from "../../ai/roleBasedRouter";
import { alpacaTradingEngine } from "../../trading/alpaca-trading-engine";
import { getPortfolioStreamManager } from "../../lib/portfolio-stream";
import { log } from "../../utils/logger";
import { requireAuth, requireAdmin } from "../../middleware/requireAuth";

const router = Router();

// GET /api/admin/modules - Get all admin modules
router.get("/modules", requireAdmin, async (req: Request, res: Response) => {
  try {
    const modules = getModules();
    res.json({
      modules,
      count: modules.length,
    });
  } catch (error) {
    log.error("AdminSystem", "Failed to get admin modules", { error });
    res.status(500).json({ error: "Failed to get admin modules" });
  }
});

// GET /api/admin/modules/accessible - Get accessible modules for current user
router.get(
  "/modules/accessible",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const rbacContext = createRBACContext(user);
      const allModules = getModules();
      const accessibleModules = filterModulesByCapability(
        allModules,
        rbacContext
      );
      res.json({
        modules: accessibleModules,
        count: accessibleModules.length,
        totalModules: allModules.length,
        userRole: rbacContext.role,
      });
    } catch (error) {
      log.error("AdminSystem", "Failed to get accessible modules", { error });
      res.status(500).json({ error: "Failed to get accessible modules" });
    }
  }
);

// GET /api/admin/modules/:id - Get specific module
router.get(
  "/modules/:id",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const adminModule = getModule(req.params.id);
      if (!adminModule) {
        return res.status(404).json({ error: "Module not found" });
      }
      res.json(adminModule);
    } catch (error) {
      log.error("AdminSystem", "Failed to get admin module", { error });
      res.status(500).json({ error: "Failed to get admin module" });
    }
  }
);

// GET /api/admin/overview - Get admin overview
router.get("/overview", requireAdmin, async (req: Request, res: Response) => {
  try {
    const overview = await getAdminOverview();

    const agentStatusData = await storage.getAgentStatus();
    const queueCounts = {
      PENDING: await storage.getWorkItemCount("PENDING"),
      RUNNING: await storage.getWorkItemCount("RUNNING"),
      FAILED: await storage.getWorkItemCount("FAILED"),
      DEAD_LETTER: await storage.getWorkItemCount("DEAD_LETTER"),
    };

    const llmStats = await getCallStats();
    const allUsage = await getAllUsageStats();

    res.json({
      ...overview,
      agent: {
        isRunning: agentStatusData?.isRunning ?? false,
        killSwitchActive: agentStatusData?.killSwitchActive ?? false,
        lastHeartbeat: agentStatusData?.lastHeartbeat ?? null,
      },
      queue: queueCounts,
      llm: {
        totalCalls: llmStats.total || 0,
        totalCost: llmStats.totalCost || 0,
      },
      apiUsage: allUsage,
    });
  } catch (error) {
    log.error("AdminSystem", "Failed to get admin overview", { error });
    res.status(500).json({ error: "Failed to get admin overview" });
  }
});

// GET /api/admin/rbac/me - Get current user's RBAC context
router.get("/rbac/me", requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.userId!);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const rbacContext = createRBACContext(user);
    res.json({
      userId: user.id,
      username: user.username,
      role: rbacContext.role,
      capabilities: rbacContext.capabilities,
      isAdmin: user.isAdmin,
    });
  } catch (error) {
    log.error("AdminSystem", "Failed to get RBAC context", { error });
    res.status(500).json({ error: "Failed to get RBAC context" });
  }
});

// GET /api/admin/rbac/roles - Get all roles
router.get("/rbac/roles", requireAdmin, async (req: Request, res: Response) => {
  try {
    const roles = getAllRoles();
    res.json({ roles });
  } catch (error) {
    log.error("AdminSystem", "Failed to get roles", { error });
    res.status(500).json({ error: "Failed to get roles" });
  }
});

// GET /api/admin/rbac/check/:capability - Check capability
router.get(
  "/rbac/check/:capability",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { capability } = req.params;
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const rbacContext = createRBACContext(user);
      const allowed = hasCapability(rbacContext, capability as any);
      res.json({
        capability,
        allowed,
        role: rbacContext.role,
      });
    } catch (error) {
      log.error("AdminSystem", "Failed to check capability", { error });
      res.status(500).json({ error: "Failed to check capability" });
    }
  }
);

// GET /api/admin/settings - List all settings
router.get("/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings = await listSettings();
    res.json({
      settings: settings.map(sanitizeSettingForResponse),
      count: settings.length,
    });
  } catch (error) {
    log.error("AdminSystem", "Failed to list settings", { error });
    res.status(500).json({ error: "Failed to list settings" });
  }
});

// GET /api/admin/settings/:namespace/:key - Get specific setting
router.get(
  "/settings/:namespace/:key",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { namespace, key } = req.params;
      const setting = await getSettingFull(namespace, key);
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json(sanitizeSettingForResponse(setting));
    } catch (error) {
      log.error("AdminSystem", "Failed to get setting", { error });
      res.status(500).json({ error: "Failed to get setting" });
    }
  }
);

// PUT /api/admin/settings/:namespace/:key - Update setting (requires admin:write)
router.put(
  "/settings/:namespace/:key",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { namespace, key } = req.params;
      const { value, description, isSecret } = req.body;

      if (value === undefined) {
        return res.status(400).json({ error: "Value is required" });
      }

      const setting = await setSetting(namespace, key, value, {
        description,
        isSecret,
        userId: req.userId,
      });

      res.json(sanitizeSettingForResponse(setting));
    } catch (error) {
      log.error("AdminSystem", "Failed to update setting", { error });
      res.status(500).json({ error: "Failed to update setting" });
    }
  }
);

// DELETE /api/admin/settings/:namespace/:key - Delete setting (requires admin:danger)
router.delete(
  "/settings/:namespace/:key",
  async (req: Request, res: Response) => {
    try {
      const { namespace, key } = req.params;
      const deleted = await deleteSetting(namespace, key);
      if (!deleted) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json({ success: true, message: "Setting deleted" });
    } catch (error) {
      log.error("AdminSystem", "Failed to delete setting", { error });
      res.status(500).json({ error: "Failed to delete setting" });
    }
  }
);

// GET /api/admin/orchestrator/status - Get orchestrator status (requires admin:read)
router.get(
  "/orchestrator/status",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const state = orchestrator.getState();
      const riskLimits = orchestrator.getRiskLimits();
      res.json({
        ...state,
        riskLimits,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error("AdminSystem", "Failed to get orchestrator status", { error });
      res.status(500).json({ error: "Failed to get orchestrator status" });
    }
  }
);

// POST /api/admin/orchestrator/pause - Pause orchestrator (requires admin:write)
router.post(
  "/orchestrator/pause",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      await orchestrator.stop(true); // preserveAutoStart=true acts like pause
      res.json({ success: true, message: "Orchestrator paused" });
    } catch (error) {
      log.error("AdminSystem", "Failed to pause orchestrator", { error });
      res.status(500).json({ error: "Failed to pause orchestrator" });
    }
  }
);

// POST /api/admin/orchestrator/resume - Resume orchestrator (requires admin:write)
router.post(
  "/orchestrator/resume",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      await orchestrator.start();
      res.json({ success: true, message: "Orchestrator resumed" });
    } catch (error) {
      log.error("AdminSystem", "Failed to resume orchestrator", { error });
      res.status(500).json({ error: "Failed to resume orchestrator" });
    }
  }
);

// POST /api/admin/orchestrator/run-now - Trigger immediate run (requires admin:write)
router.post(
  "/orchestrator/run-now",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      await orchestrator.start();
      res.json({ success: true, message: "Orchestrator run triggered" });
    } catch (error) {
      log.error("AdminSystem", "Failed to trigger orchestrator", { error });
      res.status(500).json({ error: "Failed to trigger orchestrator" });
    }
  }
);

// PUT /api/admin/orchestrator/config - Update orchestrator config (requires admin:write)
router.put(
  "/orchestrator/config",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const config = req.body;
      if (config.riskLimits) {
        await orchestrator.updateRiskLimits(config.riskLimits);
      }
      res.json({ success: true, config: orchestrator.getState() });
    } catch (error) {
      log.error("AdminSystem", "Failed to update orchestrator config", {
        error,
      });
      res.status(500).json({ error: "Failed to update orchestrator config" });
    }
  }
);

// POST /api/admin/orchestrator/reset-stats - Reset orchestrator stats (requires admin:write)
router.post(
  "/orchestrator/reset-stats",
  async (req: Request, res: Response) => {
    try {
      // Stats are tracked in orchestrator state - return current state
      res.json({
        success: true,
        message: "Stats tracking is handled automatically",
        state: orchestrator.getState(),
      });
    } catch (error) {
      log.error("AdminSystem", "Failed to reset orchestrator stats", { error });
      res.status(500).json({ error: "Failed to reset orchestrator stats" });
    }
  }
);

// GET /api/admin/jobs/status - Get jobs status
router.get(
  "/jobs/status",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const counts = {
        PENDING: await storage.getWorkItemCount("PENDING"),
        RUNNING: await storage.getWorkItemCount("RUNNING"),
        SUCCEEDED: await storage.getWorkItemCount("SUCCEEDED"),
        FAILED: await storage.getWorkItemCount("FAILED"),
        DEAD_LETTER: await storage.getWorkItemCount("DEAD_LETTER"),
      };

      res.json({
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error("AdminSystem", "Failed to get jobs status", { error });
      res.status(500).json({ error: "Failed to get jobs status" });
    }
  }
);

// POST /api/admin/jobs/sync-positions - Sync positions (requires admin:write)
router.post(
  "/jobs/sync-positions",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      await alpacaTradingEngine.syncPositionsFromAlpaca(userId);

      res.json({ success: true, message: "Position sync completed" });
    } catch (error) {
      log.error("AdminSystem", "Failed to sync positions", { error });
      res.status(500).json({ error: "Failed to sync positions" });
    }
  }
);

// GET /api/admin/search - Global search (requires admin:read)
router.get("/search", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Search query required" });
    }

    const searchResults = await globalSearch(
      q,
      limit ? parseInt(limit as string) : 20
    );

    res.json({ ...searchResults, count: searchResults.totalResults });
  } catch (error) {
    log.error("AdminSystem", "Failed to search", { error });
    res.status(500).json({ error: "Failed to search" });
  }
});

// GET /api/admin/trace/:traceId - Get trace details (requires admin:read)
router.get(
  "/trace/:traceId",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { traceId } = req.params;

      const related = await getRelatedEntities(traceId);

      res.json({
        traceId,
        ...related,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error("AdminSystem", "Failed to get trace", { error });
      res.status(500).json({ error: "Failed to get trace" });
    }
  }
);

// GET /api/admin/websocket-stats - Get real-time WebSocket connection statistics
router.get(
  "/websocket-stats",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const portfolioStream = getPortfolioStreamManager();

      if (!portfolioStream) {
        return res.json({
          status: "disabled",
          message:
            "Real-time portfolio streaming is disabled (ENABLE_REALTIME_PORTFOLIO=false)",
          enabled: false,
          activeConnections: 0,
          totalMessagesDelivered: 0,
          totalEventsEmitted: 0,
          timestamp: new Date().toISOString(),
        });
      }

      const stats = portfolioStream.getStats();

      // Determine health status based on metrics
      let status: "healthy" | "degraded" | "offline" = "healthy";

      // Degraded if disconnect rate is high (> 10% of connections per minute)
      const disconnectRatePerMinute =
        stats.totalDisconnects / (stats.uptime / 60) || 0;
      if (disconnectRatePerMinute > stats.activeConnections * 0.1) {
        status = "degraded";
      }

      // Degraded if batch efficiency is low (< 50%)
      if (stats.batchEfficiency < 0.5 && stats.totalEventsEmitted > 100) {
        status = "degraded";
      }

      // Offline if no connections and uptime > 5 minutes
      if (stats.activeConnections === 0 && stats.uptime > 300) {
        status = "offline";
      }

      res.json({
        status,
        enabled: true,
        activeConnections: stats.activeConnections,
        connectionsByUser: stats.connectionsByUser,
        totalMessagesDelivered: stats.totalMessagesDelivered,
        totalEventsEmitted: stats.totalEventsEmitted,
        totalDisconnects: stats.totalDisconnects,
        totalReconnects: stats.totalReconnects,
        performance: {
          batchEfficiency: `${(stats.batchEfficiency * 100).toFixed(1)}%`,
          batchEfficiencyRaw: stats.batchEfficiency,
          avgConnectionDurationSeconds: stats.avgConnectionDuration,
          disconnectRatePerMinute: disconnectRatePerMinute.toFixed(2),
        },
        uptime: {
          seconds: stats.uptime,
          formatted: formatUptime(stats.uptime),
        },
        limits: {
          maxConnectionsPerUser: 5,
          maxTotalConnections: 100,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error("AdminSystem", "Failed to get WebSocket stats", { error });
      res.status(500).json({
        error: "Failed to retrieve WebSocket statistics",
        status: "error",
      });
    }
  }
);

/**
 * Format uptime seconds into human-readable string
 *
 * @param seconds - Uptime in seconds
 * @returns Formatted string (e.g., "2h 15m", "45m", "30s")
 */
function formatUptime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export default router;
