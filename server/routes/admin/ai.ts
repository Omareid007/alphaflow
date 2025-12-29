/**
 * Admin AI Configuration Routes
 * Handles AI config, model router, and work items management
 */

import { Router, Request, Response } from "express";
import { storage } from "../../storage";
import {
  roleBasedRouter,
  getAllRoleConfigs,
  updateRoleConfig,
  getRecentCalls,
  getCallStats,
  type RoleConfig,
} from "../../ai/roleBasedRouter";
import { log } from "../../utils/logger";

const router = Router();

// GET /api/admin/ai-config - Get AI configuration
router.get("/ai-config", async (req: Request, res: Response) => {
  try {
    const agentStatus = await storage.getAgentStatus();
    res.json({
      autoExecuteTrades: agentStatus?.autoExecuteTrades ?? false,
      conservativeMode: agentStatus?.conservativeMode ?? false,
    });
  } catch (error) {
    log.error("AdminAI", "Failed to get AI config", { error });
    res.status(500).json({ error: "Failed to get AI config" });
  }
});

// PUT /api/admin/ai-config - Update AI configuration
router.put("/ai-config", async (req: Request, res: Response) => {
  try {
    const { autoExecuteTrades, conservativeMode } = req.body;
    const updates: { autoExecuteTrades?: boolean; conservativeMode?: boolean } =
      {};
    if (typeof autoExecuteTrades === "boolean")
      updates.autoExecuteTrades = autoExecuteTrades;
    if (typeof conservativeMode === "boolean")
      updates.conservativeMode = conservativeMode;

    await storage.updateAgentStatus(updates);
    const status = await storage.getAgentStatus();
    res.json({
      autoExecuteTrades: status?.autoExecuteTrades ?? false,
      conservativeMode: status?.conservativeMode ?? false,
    });
  } catch (error) {
    log.error("AdminAI", "Failed to update AI config", { error });
    res.status(500).json({ error: "Failed to update AI config" });
  }
});

// GET /api/admin/model-router/configs - Get model router configurations
router.get("/model-router/configs", async (req: Request, res: Response) => {
  try {
    const configs = await getAllRoleConfigs();
    const availableProviders = roleBasedRouter.getAvailableProviders();
    res.json({ configs, availableProviders });
  } catch (error) {
    log.error("AdminAI", "Failed to get role configs", { error });
    res.status(500).json({ error: "Failed to get role configurations" });
  }
});

// PUT /api/admin/model-router/configs/:role - Update role configuration
router.put(
  "/model-router/configs/:role",
  async (req: Request, res: Response) => {
    try {
      const { role } = req.params;
      const validRoles = [
        "market_news_summarizer",
        "technical_analyst",
        "risk_manager",
        "execution_planner",
        "post_trade_reporter",
      ];

      if (!validRoles.includes(role)) {
        return res
          .status(400)
          .json({
            error: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
          });
      }

      const updates = req.body as Partial<RoleConfig>;
      const updated = await updateRoleConfig(role as any, updates);
      res.json({ success: true, config: updated });
    } catch (error) {
      log.error("AdminAI", "Failed to update role config", { error });
      res.status(500).json({ error: "Failed to update role configuration" });
    }
  }
);

// GET /api/admin/model-router/calls - Get recent LLM calls
router.get("/model-router/calls", async (req: Request, res: Response) => {
  try {
    const { role, limit } = req.query;
    const limitNum = parseInt(limit as string) || 20;
    const roleFilter = typeof role === "string" ? (role as any) : undefined;

    const calls = await getRecentCalls(limitNum, roleFilter);
    res.json({ calls, count: calls.length });
  } catch (error) {
    log.error("AdminAI", "Failed to get recent LLM calls", { error });
    res.status(500).json({ error: "Failed to get recent LLM calls" });
  }
});

// GET /api/admin/model-router/stats - Get LLM call statistics
router.get("/model-router/stats", async (req: Request, res: Response) => {
  try {
    const stats = await getCallStats();
    res.json(stats);
  } catch (error) {
    log.error("AdminAI", "Failed to get LLM call stats", { error });
    res.status(500).json({ error: "Failed to get LLM call statistics" });
  }
});

// GET /api/admin/work-items - Get work items
router.get("/work-items", async (req: Request, res: Response) => {
  try {
    const { status, type, limit } = req.query;
    const limitNum = parseInt(limit as string) || 50;
    const items = await storage.getWorkItems(limitNum, status as any);

    const filteredItems = type ? items.filter((i) => i.type === type) : items;

    const counts = {
      PENDING: await storage.getWorkItemCount("PENDING"),
      RUNNING: await storage.getWorkItemCount("RUNNING"),
      SUCCEEDED: await storage.getWorkItemCount("SUCCEEDED"),
      FAILED: await storage.getWorkItemCount("FAILED"),
      DEAD_LETTER: await storage.getWorkItemCount("DEAD_LETTER"),
    };

    res.json({
      items: filteredItems,
      counts,
      total: items.length,
    });
  } catch (error) {
    log.error("AdminAI", "Failed to get work items", { error });
    res.status(500).json({ error: "Failed to get work items" });
  }
});

// POST /api/admin/work-items/retry - Retry a work item (requires admin:write)
router.post("/work-items/retry", async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Work item ID required" });
    }

    const item = await storage.getWorkItem(id);
    if (!item) {
      return res.status(404).json({ error: "Work item not found" });
    }

    if (item.status !== "DEAD_LETTER" && item.status !== "FAILED") {
      return res
        .status(400)
        .json({ error: "Can only retry DEAD_LETTER or FAILED items" });
    }

    await storage.updateWorkItem(id, {
      status: "PENDING",
      attempts: 0,
      nextRunAt: new Date(),
      lastError: null,
    });

    res.json({ success: true, message: "Work item queued for retry" });
  } catch (error) {
    log.error("AdminAI", "Failed to retry work item", { error });
    res.status(500).json({ error: "Failed to retry work item" });
  }
});

// POST /api/admin/work-items/dead-letter - Move to dead letter (requires admin:danger)
router.post("/work-items/dead-letter", async (req: Request, res: Response) => {
  try {
    const { id, reason } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Work item ID required" });
    }

    const item = await storage.getWorkItem(id);
    if (!item) {
      return res.status(404).json({ error: "Work item not found" });
    }

    await storage.updateWorkItem(id, {
      status: "DEAD_LETTER",
      lastError: reason || "Manually moved to dead letter",
    });

    res.json({ success: true, message: "Work item moved to dead letter" });
  } catch (error) {
    log.error("AdminAI", "Failed to dead-letter work item", { error });
    res.status(500).json({ error: "Failed to dead-letter work item" });
  }
});

// GET /api/admin/orchestrator-health - Get orchestrator health
router.get("/orchestrator-health", async (req: Request, res: Response) => {
  try {
    const agentStatusData = await storage.getAgentStatus();
    const counts = {
      PENDING: await storage.getWorkItemCount("PENDING"),
      RUNNING: await storage.getWorkItemCount("RUNNING"),
      FAILED: await storage.getWorkItemCount("FAILED"),
      DEAD_LETTER: await storage.getWorkItemCount("DEAD_LETTER"),
    };

    const recentErrors = await storage.getWorkItems(5, "FAILED");

    res.json({
      isRunning: agentStatusData?.isRunning || false,
      killSwitchActive: agentStatusData?.killSwitchActive || false,
      lastHeartbeat: agentStatusData?.lastHeartbeat || null,
      queueDepth: counts,
      totalPending: counts.PENDING + counts.RUNNING,
      recentErrors: recentErrors.map((e) => ({
        id: e.id,
        type: e.type,
        symbol: e.symbol,
        error: e.lastError,
        createdAt: e.createdAt,
      })),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminAI", "Failed to get orchestrator health", { error });
    res.status(500).json({ error: "Failed to get orchestrator health" });
  }
});

export default router;
