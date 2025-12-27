import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../utils/logger";
import { alpaca, AlpacaOrder } from "../connectors/alpaca";

const router = Router();

// GET /api/activity/timeline
// Unified Activity Timeline Endpoint
// Composes events from AI decisions, broker orders, fills, and system events
router.get("/timeline", async (req: Request, res: Response) => {
  const fetchedAt = new Date();
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const cursor = req.query.cursor as string | undefined;
    const categoryFilter = req.query.category as string | undefined;

    // Fetch data from multiple sources in parallel
    const [decisions, brokerOrders, trades] = await Promise.all([
      storage.getAiDecisions({ limit: limit * 2 }),
      alpaca.getOrders("all", limit).catch(() => [] as AlpacaOrder[]),
      storage.getTrades(limit),
    ]);

    // Check Alpaca connectivity
    const alpacaConnected = brokerOrders.length > 0 || decisions.some(d => d.executedTradeId);
    const alpacaStatus = alpacaConnected ? "live" : "unavailable";

    // Build timeline events
    interface TimelineEventInternal {
      id: string;
      ts: string;
      category: "decision" | "order" | "fill" | "position" | "risk" | "system" | "data_fetch";
      title: string;
      subtitle: string | null;
      status: "success" | "pending" | "warning" | "error" | "info";
      entityLinks: {
        decisionId?: string;
        brokerOrderId?: string;
        symbol?: string;
        strategyId?: string;
        tradeId?: string;
      };
      provenance: {
        provider: string;
        cacheStatus: "fresh" | "stale" | "miss" | "unknown";
        latencyMs?: number;
      };
      details?: Record<string, unknown>;
    }

    const events: TimelineEventInternal[] = [];

    // Add decision events
    for (const d of decisions) {
      const status = d.status === "filled" || d.status === "executed" ? "success" :
                     d.status === "skipped" || d.status === "rejected" ? "warning" :
                     d.status === "pending" || d.status === "pending_execution" ? "pending" :
                     d.status === "failed" ? "error" : "info";

      const subtitle = d.action === "hold" ? "No action taken" :
                       d.skipReason ? `Skipped: ${d.skipReason}` :
                       `${d.action.toUpperCase()} ${d.symbol}`;

      events.push({
        id: `decision-${d.id}`,
        ts: new Date(d.createdAt).toISOString(),
        category: "decision",
        title: `AI Decision: ${d.action.toUpperCase()} ${d.symbol}`,
        subtitle: d.confidence ? `Confidence: ${(parseFloat(d.confidence) * 100).toFixed(0)}%` : null,
        status,
        entityLinks: {
          decisionId: d.id,
          symbol: d.symbol,
          strategyId: d.strategyId ?? undefined,
          tradeId: d.executedTradeId ?? undefined,
        },
        provenance: {
          provider: "ai-decision-engine",
          cacheStatus: "unknown",
        },
        details: {
          action: d.action,
          confidence: d.confidence,
          reasoning: d.reasoning?.substring(0, 200),
          entryPrice: d.entryPrice,
          stopLoss: d.stopLoss,
          takeProfit: d.takeProfit,
        },
      });
    }

    // Add broker order events
    for (const o of brokerOrders) {
      const status = o.status === "filled" ? "success" :
                     o.status === "canceled" || o.status === "expired" ? "warning" :
                     o.status === "rejected" ? "error" :
                     "pending";

      const filledInfo = o.filled_qty && parseFloat(o.filled_qty) > 0
        ? `${o.filled_qty} @ $${parseFloat(o.filled_avg_price || "0").toFixed(2)}`
        : `${o.qty} shares`;

      events.push({
        id: `order-${o.id}`,
        ts: o.submitted_at,
        category: o.status === "filled" ? "fill" : "order",
        title: `${o.side.toUpperCase()} ${o.symbol}`,
        subtitle: filledInfo,
        status,
        entityLinks: {
          brokerOrderId: o.id,
          symbol: o.symbol,
        },
        provenance: {
          provider: "alpaca",
          cacheStatus: "fresh",
        },
        details: {
          orderId: o.id,
          orderType: o.order_type,
          timeInForce: o.time_in_force,
          limitPrice: o.limit_price,
          stopPrice: o.stop_price,
          filledQty: o.filled_qty,
          filledAvgPrice: o.filled_avg_price,
          brokerStatus: o.status,
        },
      });
    }

    // Add trade fill events from database (for historical fills)
    for (const t of trades) {
      // Skip if we already have an order event for this
      const matchingOrder = brokerOrders.find(o =>
        o.symbol === t.symbol &&
        o.status === "filled" &&
        Math.abs(new Date(o.filled_at || 0).getTime() - new Date(t.executedAt).getTime()) < 60000
      );
      if (matchingOrder) continue;

      const pnl = t.pnl ? parseFloat(t.pnl) : null;
      const status = pnl !== null ? (pnl >= 0 ? "success" : "warning") : "info";

      events.push({
        id: `trade-${t.id}`,
        ts: new Date(t.executedAt).toISOString(),
        category: "fill",
        title: `${t.side.toUpperCase()} ${t.symbol}`,
        subtitle: `${t.quantity} @ $${parseFloat(t.price).toFixed(2)}`,
        status,
        entityLinks: {
          tradeId: t.id,
          symbol: t.symbol,
          strategyId: t.strategyId ?? undefined,
        },
        provenance: {
          provider: "database",
          cacheStatus: "unknown",
        },
        details: {
          quantity: t.quantity,
          price: t.price,
          pnl: t.pnl,
        },
      });
    }

    // Filter by category if specified
    let filteredEvents = events;
    if (categoryFilter && categoryFilter !== "all") {
      filteredEvents = events.filter(e => e.category === categoryFilter);
    }

    // Sort by timestamp descending
    filteredEvents.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    // Apply cursor-based pagination
    let startIdx = 0;
    if (cursor) {
      const cursorIdx = filteredEvents.findIndex(e => e.id === cursor);
      if (cursorIdx >= 0) startIdx = cursorIdx + 1;
    }

    const paginatedEvents = filteredEvents.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < filteredEvents.length;
    const nextCursor = hasMore ? paginatedEvents[paginatedEvents.length - 1]?.id : null;

    res.json({
      events: paginatedEvents,
      hasMore,
      cursor: nextCursor,
      meta: {
        alpacaConnected,
        alpacaStatus,
        totalEvents: filteredEvents.length,
        fetchedAt: fetchedAt.toISOString(),
      },
    });
  } catch (error) {
    log.error("Routes", "Timeline fetch error", { error: error });
    res.status(500).json({
      error: "Failed to fetch activity timeline",
      meta: {
        alpacaConnected: false,
        alpacaStatus: "unavailable",
        totalEvents: 0,
        fetchedAt: fetchedAt.toISOString(),
      },
    });
  }
});

export default router;
