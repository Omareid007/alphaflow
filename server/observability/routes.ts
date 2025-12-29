/**
 * Observability Admin Routes
 *
 * Provides endpoints for health overview, metrics, work queue management,
 * trace exploration, and alert management.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  workItems,
  llmCalls,
  aiDecisions,
  trades,
  agentStatus,
  alertRules,
  alertEvents,
} from "@shared/schema";
import { eq, desc, and, or, like, gte, sql, count } from "drizzle-orm";
import { log } from "../utils/logger";
import { alertService } from "./alertService";
import { workQueue as workQueueService } from "../lib/work-queue";

export const observabilityRouter = Router();

observabilityRouter.get("/health", async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      queueCounts,
      oldestPending,
      llmStatsHour,
      llmStatsDay,
      orchestratorStatus,
    ] = await Promise.all([
      db
        .select({
          status: workItems.status,
          count: count(),
        })
        .from(workItems)
        .groupBy(workItems.status),

      db
        .select({
          createdAt: workItems.createdAt,
        })
        .from(workItems)
        .where(eq(workItems.status, "PENDING"))
        .orderBy(workItems.createdAt)
        .limit(1),

      db
        .select({
          total: count(),
          errors: sql<number>`count(case when ${llmCalls.status} = 'error' then 1 end)`,
        })
        .from(llmCalls)
        .where(gte(llmCalls.createdAt, oneHourAgo)),

      db
        .select({
          total: count(),
          errors: sql<number>`count(case when ${llmCalls.status} = 'error' then 1 end)`,
        })
        .from(llmCalls)
        .where(gte(llmCalls.createdAt, oneDayAgo)),

      db.select().from(agentStatus).limit(1),
    ]);

    const counts: Record<string, number> = {};
    queueCounts.forEach((c) => {
      counts[c.status] = Number(c.count);
    });

    const oldestPendingAge = oldestPending[0]?.createdAt
      ? Math.round(
          (now.getTime() - new Date(oldestPending[0].createdAt).getTime()) /
            60000
        )
      : 0;

    const agent = orchestratorStatus[0];
    const lastHeartbeat = agent?.lastHeartbeat;
    const minutesSinceHeartbeat = lastHeartbeat
      ? Math.round((now.getTime() - new Date(lastHeartbeat).getTime()) / 60000)
      : null;

    const llmHour = llmStatsHour[0] || { total: 0, errors: 0 };
    const llmDay = llmStatsDay[0] || { total: 0, errors: 0 };

    const response = {
      queue: {
        pending: counts["PENDING"] || 0,
        running: counts["RUNNING"] || 0,
        succeeded: counts["SUCCEEDED"] || 0,
        failed: counts["FAILED"] || 0,
        deadLetter: counts["DEAD_LETTER"] || 0,
        oldestPendingAgeMinutes: oldestPendingAge,
      },
      orchestrator: {
        isRunning: agent?.isRunning ?? false,
        lastHeartbeat: lastHeartbeat?.toISOString() || null,
        minutesSinceHeartbeat,
        killSwitchActive: agent?.killSwitchActive ?? false,
        dynamicOrderLimit: agent?.dynamicOrderLimit ?? 10,
        marketCondition: agent?.marketCondition || "unknown",
      },
      llm: {
        lastHour: {
          calls: Number(llmHour.total),
          errors: Number(llmHour.errors),
          errorRate:
            llmHour.total > 0
              ? (
                  (Number(llmHour.errors) / Number(llmHour.total)) *
                  100
                ).toFixed(2) + "%"
              : "0%",
        },
        last24Hours: {
          calls: Number(llmDay.total),
          errors: Number(llmDay.errors),
          errorRate:
            llmDay.total > 0
              ? ((Number(llmDay.errors) / Number(llmDay.total)) * 100).toFixed(
                  2
                ) + "%"
              : "0%",
        },
      },
      fetchedAt: now.toISOString(),
      sources: {
        queue: "db:work_items",
        orchestrator: "db:agent_status",
        llm: "db:llm_calls",
      },
    };

    return res.json(response);
  } catch (error) {
    log.error("Observability", "Health endpoint failed", {
      error: String(error),
    });
    return res.status(500).json({ error: "Failed to fetch health data" });
  }
});

observabilityRouter.get(
  "/metrics/summary",
  async (req: Request, res: Response) => {
    try {
      const metrics = await alertService.getMetricsSnapshot();

      return res.json({
        metrics,
        fetchedAt: new Date().toISOString(),
        source: "db/computed",
      });
    } catch (error) {
      log.error("Observability", "Metrics summary failed", {
        error: String(error),
      });
      return res.status(500).json({ error: "Failed to fetch metrics" });
    }
  }
);

observabilityRouter.get(
  "/work-queue/items",
  async (req: Request, res: Response) => {
    try {
      const { status, type, traceId, limit: limitStr = "50" } = req.query;
      const limit = Math.min(parseInt(limitStr as string, 10) || 50, 200);

      const conditions = [];

      if (status && status !== "all") {
        conditions.push(eq(workItems.status, status as string));
      }
      if (type) {
        conditions.push(eq(workItems.type, type as string));
      }
      if (traceId) {
        conditions.push(like(workItems.payload, `%${traceId}%`));
      }

      let query = db.select().from(workItems);
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const items = await query.orderBy(desc(workItems.createdAt)).limit(limit);

      return res.json({
        items,
        total: items.length,
      });
    } catch (error) {
      log.error("Observability", "Work queue list failed", {
        error: String(error),
      });
      return res
        .status(500)
        .json({ error: "Failed to fetch work queue items" });
    }
  }
);

observabilityRouter.get(
  "/work-queue/items/:id",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await workQueueService.getById(id);

      if (!item) {
        return res.status(404).json({ error: "Work item not found" });
      }

      let parsedPayload = null;
      try {
        if (item.payload) {
          parsedPayload = JSON.parse(item.payload);
        }
      } catch {}

      return res.json({
        ...item,
        parsedPayload,
      });
    } catch (error) {
      log.error("Observability", "Work item fetch failed", {
        error: String(error),
      });
      return res.status(500).json({ error: "Failed to fetch work item" });
    }
  }
);

observabilityRouter.post(
  "/work-queue/items/:id/retry",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await workQueueService.retryDeadLetter(id);

      if (!item) {
        return res
          .status(404)
          .json({ error: "Work item not found or not a dead letter" });
      }

      log.info("Observability", "Work item retried", { id, type: item.type });

      return res.json({ success: true, item });
    } catch (error) {
      log.error("Observability", "Work item retry failed", {
        error: String(error),
      });
      return res.status(500).json({ error: "Failed to retry work item" });
    }
  }
);

observabilityRouter.post(
  "/work-queue/items/:id/cancel",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await workQueueService.getById(id);

      if (!item) {
        return res.status(404).json({ error: "Work item not found" });
      }

      if (item.status !== "PENDING") {
        return res
          .status(400)
          .json({ error: "Only pending items can be cancelled" });
      }

      await workQueueService.markDeadLetter(id, "Cancelled by admin");

      log.info("Observability", "Work item cancelled", { id, type: item.type });

      return res.json({ success: true, message: "Work item cancelled" });
    } catch (error) {
      log.error("Observability", "Work item cancel failed", {
        error: String(error),
      });
      return res.status(500).json({ error: "Failed to cancel work item" });
    }
  }
);

observabilityRouter.post(
  "/work-queue/items/:id/dead-letter",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason = "Force dead-lettered by admin" } = req.body;

      await workQueueService.markDeadLetter(id, reason);

      log.info("Observability", "Work item force dead-lettered", {
        id,
        reason,
      });

      return res.json({
        success: true,
        message: "Work item moved to dead letter",
      });
    } catch (error) {
      log.error("Observability", "Force dead-letter failed", {
        error: String(error),
      });
      return res.status(500).json({ error: "Failed to dead-letter work item" });
    }
  }
);

observabilityRouter.get(
  "/trace/:traceId",
  async (req: Request, res: Response) => {
    const { traceId } = req.params;

    if (!traceId) {
      return res.status(400).json({ error: "traceId is required" });
    }

    try {
      const [decisionResults, llmCallResults, workItemResults, tradeResults] =
        await Promise.all([
          db.select().from(aiDecisions).where(eq(aiDecisions.traceId, traceId)),
          db
            .select()
            .from(llmCalls)
            .where(eq(llmCalls.traceId, traceId))
            .orderBy(desc(llmCalls.createdAt)),
          db
            .select()
            .from(workItems)
            .where(
              or(
                like(workItems.payload, `%${traceId}%`),
                like(workItems.result, `%${traceId}%`)
              )
            ),
          db.select().from(trades).where(eq(trades.traceId, traceId)),
        ]);

      const totalTokens = llmCallResults.reduce(
        (sum, c) => sum + (c.totalTokens || 0),
        0
      );
      const estimatedCost = llmCallResults.reduce(
        (sum, c) => sum + parseFloat(c.estimatedCost || "0"),
        0
      );
      const totalLatency = llmCallResults.reduce(
        (sum, c) => sum + (c.latencyMs || 0),
        0
      );
      const providersUsed = [...new Set(llmCallResults.map((c) => c.provider))];

      const missingModules: string[] = [];

      return res.json({
        traceId,
        decisions: decisionResults.map((d) => ({
          id: d.id,
          symbol: d.symbol,
          action: d.action,
          confidence: d.confidence ? parseFloat(d.confidence) : null,
          status: d.status,
          createdAt: d.createdAt,
        })),
        llmCalls: llmCallResults.map((c) => ({
          id: c.id,
          role: c.role,
          provider: c.provider,
          model: c.model,
          tokensUsed: c.totalTokens,
          latencyMs: c.latencyMs,
          status: c.status,
          createdAt: c.createdAt,
        })),
        workItems: workItemResults.map((w) => ({
          id: w.id,
          type: w.type,
          status: w.status,
          attempts: w.attempts,
          symbol: w.symbol,
          brokerOrderId: w.brokerOrderId,
        })),
        trades: tradeResults.map((t) => ({
          id: t.id,
          symbol: t.symbol,
          side: t.side,
          quantity: t.quantity,
          price: t.price,
          status: t.status,
          executedAt: t.executedAt,
        })),
        summary: {
          totalDecisions: decisionResults.length,
          totalLLMCalls: llmCallResults.length,
          totalWorkItems: workItemResults.length,
          totalTrades: tradeResults.length,
          totalTokens,
          estimatedCost,
          latencyMs: totalLatency,
          providersUsed,
        },
        missingModules,
      });
    } catch (error) {
      log.error("Observability", "Trace lookup failed", {
        traceId,
        error: String(error),
      });
      return res.status(500).json({ error: "Failed to fetch trace" });
    }
  }
);

observabilityRouter.get(
  "/alerts/rules",
  async (req: Request, res: Response) => {
    try {
      const rules = await alertService.getRules();
      return res.json({ rules });
    } catch (error) {
      log.error("Observability", "Alert rules fetch failed", {
        error: String(error),
      });
      return res.status(500).json({ error: "Failed to fetch alert rules" });
    }
  }
);

observabilityRouter.post(
  "/alerts/rules",
  async (req: Request, res: Response) => {
    try {
      const {
        name,
        description,
        ruleType,
        condition,
        threshold,
        enabled,
        webhookUrl,
      } = req.body;

      if (!name || !ruleType || !condition || threshold === undefined) {
        return res
          .status(400)
          .json({
            error:
              "Missing required fields: name, ruleType, condition, threshold",
          });
      }

      const rule = await alertService.createRule({
        name,
        description,
        ruleType,
        condition,
        threshold,
        enabled,
        webhookUrl,
      });

      return res.status(201).json({ rule });
    } catch (error) {
      log.error("Observability", "Alert rule creation failed", {
        error: String(error),
      });
      return res.status(500).json({ error: "Failed to create alert rule" });
    }
  }
);

observabilityRouter.post(
  "/alerts/rules/:id/toggle",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }

      const rule = await alertService.toggleRule(id, enabled);

      if (!rule) {
        return res.status(404).json({ error: "Alert rule not found" });
      }

      return res.json({ rule });
    } catch (error) {
      log.error("Observability", "Alert rule toggle failed", {
        error: String(error),
      });
      return res.status(500).json({ error: "Failed to toggle alert rule" });
    }
  }
);

observabilityRouter.delete(
  "/alerts/rules/:id",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await alertService.deleteRule(id);
      return res.json({ success: true });
    } catch (error) {
      log.error("Observability", "Alert rule deletion failed", {
        error: String(error),
      });
      return res.status(500).json({ error: "Failed to delete alert rule" });
    }
  }
);

observabilityRouter.post(
  "/alerts/test",
  async (req: Request, res: Response) => {
    try {
      const { ruleId } = req.body;

      if (!ruleId) {
        return res.status(400).json({ error: "ruleId is required" });
      }

      const result = await alertService.testAlert(ruleId);
      return res.json(result);
    } catch (error) {
      log.error("Observability", "Alert test failed", { error: String(error) });
      return res.status(500).json({ error: "Failed to test alert" });
    }
  }
);

observabilityRouter.get(
  "/alerts/events",
  async (req: Request, res: Response) => {
    try {
      const { limit: limitStr = "50" } = req.query;
      const limit = Math.min(parseInt(limitStr as string, 10) || 50, 200);

      const events = await alertService.getRecentEvents(limit);
      return res.json({ events });
    } catch (error) {
      log.error("Observability", "Alert events fetch failed", {
        error: String(error),
      });
      return res.status(500).json({ error: "Failed to fetch alert events" });
    }
  }
);

observabilityRouter.post(
  "/alerts/evaluate",
  async (req: Request, res: Response) => {
    try {
      const result = await alertService.evaluateRules();
      return res.json(result);
    } catch (error) {
      log.error("Observability", "Alert evaluation failed", {
        error: String(error),
      });
      return res.status(500).json({ error: "Failed to evaluate alerts" });
    }
  }
);
