import { db } from "../db";
import { aiDecisions, trades, orders, fills, workItems, llmCalls } from "../shared/schema";
import { like, or, eq, desc } from "drizzle-orm";

export interface SearchResult {
  type: "ai_decision" | "trade" | "order" | "fill" | "work_item" | "llm_call";
  id: string;
  traceId?: string | null;
  symbol?: string | null;
  createdAt: Date;
  summary: string;
}

export interface GlobalSearchResponse {
  query: string;
  totalResults: number;
  results: SearchResult[];
  byType: Record<string, number>;
}

export async function globalSearch(query: string, limit: number = 50): Promise<GlobalSearchResponse> {
  if (!query || query.length < 2) {
    return { query, totalResults: 0, results: [], byType: {} };
  }

  const likePattern = `%${query}%`;
  const results: SearchResult[] = [];

  const aiDecisionResults = await db
    .select()
    .from(aiDecisions)
    .where(
      or(
        like(aiDecisions.traceId, likePattern),
        like(aiDecisions.symbol, likePattern),
        like(aiDecisions.id, likePattern)
      )
    )
    .orderBy(desc(aiDecisions.createdAt))
    .limit(limit);

  for (const r of aiDecisionResults) {
    results.push({
      type: "ai_decision",
      id: r.id,
      traceId: r.traceId,
      symbol: r.symbol,
      createdAt: r.createdAt,
      summary: `${r.action} ${r.symbol} - ${r.reasoning?.substring(0, 50) || "No reason"}`,
    });
  }

  const tradeResults = await db
    .select()
    .from(trades)
    .where(
      or(
        like(trades.traceId, likePattern),
        like(trades.symbol, likePattern),
        like(trades.id, likePattern)
      )
    )
    .orderBy(desc(trades.executedAt))
    .limit(limit);

  for (const r of tradeResults) {
    results.push({
      type: "trade",
      id: r.id,
      traceId: r.traceId,
      symbol: r.symbol,
      createdAt: r.executedAt,
      summary: `${r.side} ${r.quantity} ${r.symbol} @ $${r.price}`,
    });
  }

  const orderResults = await db
    .select()
    .from(orders)
    .where(
      or(
        like(orders.traceId, likePattern),
        like(orders.symbol, likePattern),
        like(orders.id, likePattern),
        like(orders.brokerOrderId, likePattern),
        like(orders.clientOrderId, likePattern)
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  for (const r of orderResults) {
    results.push({
      type: "order",
      id: r.id,
      traceId: r.traceId,
      symbol: r.symbol,
      createdAt: r.createdAt,
      summary: `${r.side} ${r.qty || r.notional} ${r.symbol} - ${r.status}`,
    });
  }

  const fillResults = await db
    .select()
    .from(fills)
    .where(
      or(
        like(fills.traceId, likePattern),
        like(fills.symbol, likePattern),
        like(fills.id, likePattern),
        like(fills.brokerOrderId, likePattern)
      )
    )
    .orderBy(desc(fills.createdAt))
    .limit(limit);

  for (const r of fillResults) {
    results.push({
      type: "fill",
      id: r.id,
      traceId: r.traceId,
      symbol: r.symbol,
      createdAt: r.createdAt,
      summary: `${r.side} ${r.qty} ${r.symbol} @ $${r.price}`,
    });
  }

  const workItemResults = await db
    .select()
    .from(workItems)
    .where(
      or(
        like(workItems.id, likePattern),
        like(workItems.idempotencyKey, likePattern),
        like(workItems.symbol, likePattern)
      )
    )
    .orderBy(desc(workItems.createdAt))
    .limit(limit);

  for (const r of workItemResults) {
    results.push({
      type: "work_item",
      id: r.id,
      traceId: null,
      symbol: r.symbol,
      createdAt: r.createdAt,
      summary: `${r.type} - ${r.status}`,
    });
  }

  const llmCallResults = await db
    .select()
    .from(llmCalls)
    .where(
      or(
        like(llmCalls.traceId, likePattern),
        like(llmCalls.id, likePattern)
      )
    )
    .orderBy(desc(llmCalls.createdAt))
    .limit(limit);

  for (const r of llmCallResults) {
    results.push({
      type: "llm_call",
      id: r.id,
      traceId: r.traceId,
      symbol: null,
      createdAt: r.createdAt,
      summary: `${r.role} via ${r.provider} - ${r.status}`,
    });
  }

  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const limitedResults = results.slice(0, limit);

  const byType: Record<string, number> = {};
  for (const r of limitedResults) {
    byType[r.type] = (byType[r.type] || 0) + 1;
  }

  return {
    query,
    totalResults: limitedResults.length,
    results: limitedResults,
    byType,
  };
}

export async function getRelatedEntities(traceId: string): Promise<{
  aiDecisions: any[];
  trades: any[];
  orders: any[];
  fills: any[];
  llmCalls: any[];
}> {
  const [aiDecisionResults, tradeResults, orderResults, fillResults, llmCallResults] = await Promise.all([
    db.select().from(aiDecisions).where(eq(aiDecisions.traceId, traceId)),
    db.select().from(trades).where(eq(trades.traceId, traceId)),
    db.select().from(orders).where(eq(orders.traceId, traceId)),
    db.select().from(fills).where(eq(fills.traceId, traceId)),
    db.select().from(llmCalls).where(eq(llmCalls.traceId, traceId)),
  ]);

  return {
    aiDecisions: aiDecisionResults,
    trades: tradeResults,
    orders: orderResults,
    fills: fillResults,
    llmCalls: llmCallResults,
  };
}
