/**
 * Traces API - Full observability into AI decision chains
 *
 * Provides traceId-based inspection of the complete flow:
 * decision → LLM calls → trade execution → broker confirmation
 *
 * @see docs/OBSERVABILITY.md
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { aiDecisions, llmCalls, workItems, trades } from "@shared/schema";
import { eq, desc, and, or, like } from "drizzle-orm";
import { log } from "../utils/logger";

export const tracesRouter = Router();

interface TraceEvent {
  timestamp: Date;
  type: "decision" | "llm_call" | "work_item" | "trade";
  id: string;
  status: string;
  details: Record<string, unknown>;
}

interface TraceResponse {
  traceId: string;
  events: TraceEvent[];
  decision?: {
    id: string;
    symbol: string;
    action: string;
    confidence: number | null;
    reasoning: string | null;
    status: string;
    createdAt: Date;
  };
  llmCalls: Array<{
    id: string;
    role: string;
    provider: string;
    model: string;
    purpose: string | null;
    criticality: string | null;
    tokensUsed: number | null;
    latencyMs: number | null;
    status: string;
    createdAt: Date;
  }>;
  workItems: Array<{
    id: string;
    type: string;
    status: string;
    attempts: number;
    brokerOrderId: string | null;
    symbol: string | null;
    result: string | null;
  }>;
  trades: Array<{
    id: string;
    symbol: string;
    side: string;
    quantity: string;
    price: string;
    status: string;
    executedAt: Date;
  }>;
  summary: {
    totalLLMCalls: number;
    totalTokens: number;
    estimatedCost: number;
    latencyMs: number;
    providersUsed: string[];
    finalOutcome: string;
  };
}

tracesRouter.get("/:traceId", async (req: Request, res: Response) => {
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
        Promise.resolve([]),
      ]);

    const decision = decisionResults[0] || null;

    let relatedTrades: (typeof trades.$inferSelect)[] = [];
    if (decision?.executedTradeId) {
      relatedTrades = await db
        .select()
        .from(trades)
        .where(eq(trades.id, decision.executedTradeId));
    }

    const events: TraceEvent[] = [];

    if (decision) {
      events.push({
        timestamp: decision.createdAt,
        type: "decision",
        id: decision.id,
        status: decision.status,
        details: {
          symbol: decision.symbol,
          action: decision.action,
          confidence: decision.confidence,
        },
      });
    }

    for (const call of llmCallResults) {
      events.push({
        timestamp: call.createdAt,
        type: "llm_call",
        id: call.id,
        status: call.status,
        details: {
          role: call.role,
          provider: call.provider,
          model: call.model,
          tokensUsed: call.totalTokens,
          latencyMs: call.latencyMs,
        },
      });
    }

    for (const item of workItemResults) {
      events.push({
        timestamp: item.nextRunAt,
        type: "work_item",
        id: item.id,
        status: item.status,
        details: {
          type: item.type,
          attempts: item.attempts,
          brokerOrderId: item.brokerOrderId,
        },
      });
    }

    for (const trade of relatedTrades) {
      events.push({
        timestamp: trade.executedAt,
        type: "trade",
        id: trade.id,
        status: trade.status,
        details: {
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          price: trade.price,
        },
      });
    }

    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

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

    let finalOutcome = "unknown";
    if (relatedTrades.length > 0) {
      finalOutcome = relatedTrades[0].status;
    } else if (decision?.status === "executed") {
      finalOutcome = "executed";
    } else if (decision?.status === "skipped") {
      finalOutcome = `skipped: ${decision.skipReason || "unknown"}`;
    } else if (decision) {
      finalOutcome = decision.status;
    } else if (llmCallResults.length > 0) {
      finalOutcome = "pending";
    }

    const response: TraceResponse = {
      traceId,
      events,
      decision: decision
        ? {
            id: decision.id,
            symbol: decision.symbol,
            action: decision.action,
            confidence: decision.confidence
              ? parseFloat(decision.confidence)
              : null,
            reasoning: decision.reasoning,
            status: decision.status,
            createdAt: decision.createdAt,
          }
        : undefined,
      llmCalls: llmCallResults.map((c) => {
        let purpose: string | null = null;
        let criticality: string | null = null;
        try {
          if (c.metadata) {
            const meta = JSON.parse(c.metadata);
            purpose = meta.purpose || null;
            criticality = meta.criticality || null;
          }
        } catch {}
        return {
          id: c.id,
          role: c.role,
          provider: c.provider,
          model: c.model,
          purpose: c.purpose || purpose,
          criticality: c.criticality || criticality,
          tokensUsed: c.totalTokens,
          latencyMs: c.latencyMs,
          status: c.status,
          createdAt: c.createdAt,
        };
      }),
      workItems: workItemResults.map((w) => ({
        id: w.id,
        type: w.type,
        status: w.status,
        attempts: w.attempts,
        brokerOrderId: w.brokerOrderId,
        symbol: w.symbol,
        result: w.result,
      })),
      trades: relatedTrades.map((t) => ({
        id: t.id,
        symbol: t.symbol,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
        status: t.status,
        executedAt: t.executedAt,
      })),
      summary: {
        totalLLMCalls: llmCallResults.length,
        totalTokens,
        estimatedCost,
        latencyMs: totalLatency,
        providersUsed,
        finalOutcome,
      },
    };

    log.debug("Traces", "Trace lookup complete", {
      traceId,
      eventsCount: events.length,
      llmCallsCount: llmCallResults.length,
    });

    return res.json(response);
  } catch (error) {
    log.error("Traces", "Failed to fetch trace", {
      traceId,
      error: String(error),
    });
    return res.status(500).json({ error: "Failed to fetch trace" });
  }
});

tracesRouter.get("/", async (req: Request, res: Response) => {
  const { limit: limitStr = "20", symbol, status } = req.query;
  const limit = Math.min(parseInt(limitStr as string, 10) || 20, 100);

  try {
    let query = db
      .select({
        traceId: aiDecisions.traceId,
        id: aiDecisions.id,
        symbol: aiDecisions.symbol,
        action: aiDecisions.action,
        status: aiDecisions.status,
        createdAt: aiDecisions.createdAt,
      })
      .from(aiDecisions);

    const conditions = [];
    if (symbol) {
      conditions.push(eq(aiDecisions.symbol, symbol as string));
    }
    if (status) {
      conditions.push(eq(aiDecisions.status, status as string));
    }
    conditions.push(eq(aiDecisions.traceId, aiDecisions.traceId));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const results = await query
      .orderBy(desc(aiDecisions.createdAt))
      .limit(limit);

    return res.json({
      traces: results.filter((r) => r.traceId),
      total: results.length,
    });
  } catch (error) {
    log.error("Traces", "Failed to list traces", { error: String(error) });
    return res.status(500).json({ error: "Failed to list traces" });
  }
});
