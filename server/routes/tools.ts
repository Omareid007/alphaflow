import { Router, Request, Response } from "express";
import {
  invokeTool,
  listTools,
  listToolsByCategory,
  getToolSchemas,
  type ToolContext,
} from "../ai/toolRouter";
import { storage } from "../storage";
import { log } from "../utils/logger";
import { badRequest, serverError } from "../lib/standard-errors";
import type { ToolCategory } from "@shared/schema";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const category = req.query.category as ToolCategory | undefined;
    const tools = category ? listToolsByCategory(category) : listTools();

    res.json({
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        category: t.category,
        dangerous: t.dangerous || false,
        cacheable: t.cacheable || false,
      })),
      count: tools.length,
    });
  } catch (error) {
    log.error("ToolsAPI", `Failed to list tools: ${error}`);
    return serverError(res, "Failed to list tools");
  }
});

router.get("/schemas", async (req: Request, res: Response) => {
  try {
    const schemas = getToolSchemas();
    res.json({ schemas });
  } catch (error) {
    log.error("ToolsAPI", `Failed to get tool schemas: ${error}`);
    return serverError(res, "Failed to get tool schemas");
  }
});

router.post("/invoke", async (req: Request, res: Response) => {
  try {
    const { toolName, params, traceId, callerRole, debateSessionId } = req.body;

    if (!toolName) {
      return badRequest(res, "toolName is required");
    }

    const context: ToolContext = {
      traceId:
        traceId || `tool-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      callerRole,
      debateSessionId,
    };

    const result = await invokeTool(toolName, params || {}, context);
    res.json(result);
  } catch (error) {
    log.error("ToolsAPI", `Failed to invoke tool: ${error}`);
    return serverError(
      res,
      (error as Error).message || "Failed to invoke tool"
    );
  }
});

router.get("/invocations", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const traceId = req.query.traceId as string;
    const sessionId = req.query.sessionId as string;

    let invocations;
    if (traceId) {
      invocations = await storage.getToolInvocationsByTrace(traceId);
    } else if (sessionId) {
      invocations = await storage.getToolInvocationsBySession(sessionId);
    } else {
      invocations = await storage.getRecentToolInvocations(limit);
    }

    res.json({ invocations, count: invocations.length });
  } catch (error) {
    log.error("ToolsAPI", `Failed to get tool invocations: ${error}`);
    return serverError(res, "Failed to get tool invocations");
  }
});

export default router;
