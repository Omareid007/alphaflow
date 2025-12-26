import { Router, Request, Response } from "express";
import { log } from "../utils/logger";
import { badRequest, serverError } from "../lib/standard-errors";
import {
  roleBasedRouter,
  getAllRoleConfigs,
  updateRoleConfig,
  getRecentCalls,
  getCallStats,
  type RoleConfig,
} from "../ai/roleBasedRouter";

const router = Router();

/**
 * LLM Role-Based Router Configuration Endpoints
 */

// GET /api/llm/configs - Get all role-based router configurations
router.get("/configs", async (req: Request, res: Response) => {
  try {
    const configs = await getAllRoleConfigs();
    const availableProviders = roleBasedRouter.getAvailableProviders();

    res.json({ configs, availableProviders });
  } catch (error) {
    log.error("LLMAPI", `Failed to get role configs: ${error}`);
    res.status(500).json({ error: "Failed to get role configurations" });
  }
});

// PUT /api/llm/configs/:role - Update role-based router configuration
router.put("/configs/:role", async (req: Request, res: Response) => {
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
      return badRequest(
        res,
        `Invalid role. Must be one of: ${validRoles.join(", ")}`
      );
    }

    const updates = req.body as Partial<RoleConfig>;
    const updated = await updateRoleConfig(role as any, updates);

    res.json({ success: true, config: updated });
  } catch (error) {
    log.error("LLMAPI", `Failed to update role config: ${error}`);
    res.status(500).json({ error: "Failed to update role configuration" });
  }
});

/**
 * LLM Call History and Statistics Endpoints
 */

// GET /api/llm/calls - Get recent LLM calls
router.get("/calls", async (req: Request, res: Response) => {
  try {
    const { role, limit } = req.query;
    const limitNum = parseInt(limit as string) || 20;
    const roleFilter = typeof role === "string" ? (role as any) : undefined;

    const calls = await getRecentCalls(limitNum, roleFilter);

    res.json({ calls, count: calls.length });
  } catch (error) {
    log.error("LLMAPI", `Failed to get recent LLM calls: ${error}`);
    res.status(500).json({ error: "Failed to get recent LLM calls" });
  }
});

// GET /api/llm/stats - Get LLM call statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = await getCallStats();

    res.json(stats);
  } catch (error) {
    log.error("LLMAPI", `Failed to get LLM call stats: ${error}`);
    res.status(500).json({ error: "Failed to get LLM call statistics" });
  }
});

export default router;
