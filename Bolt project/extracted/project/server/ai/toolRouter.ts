import { z } from "zod";
import { storage } from "../storage";
import { log } from "../utils/logger";
import type { ToolCategory, InsertToolInvocation } from "@shared/schema";
import { alpaca } from "../connectors/alpaca";

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: z.ZodSchema;
  outputSchema?: z.ZodSchema;
  dangerous?: boolean;
  cacheable?: boolean;
  cacheTtlMs?: number;
  execute: (params: unknown, context: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  traceId: string;
  callerRole?: string;
  debateSessionId?: string;
}

export interface ToolInvocationResult {
  success: boolean;
  result?: unknown;
  error?: string;
  latencyMs: number;
  cacheHit: boolean;
  invocationId: string;
}

const toolRegistry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  if (toolRegistry.has(tool.name)) {
    log.warn("ToolRouter", `Tool already registered: ${tool.name}, overwriting`);
  }
  toolRegistry.set(tool.name, tool);
  log.debug("ToolRouter", `Registered tool: ${tool.name}`, { category: tool.category });
}

export function getTool(name: string): ToolDefinition | undefined {
  return toolRegistry.get(name);
}

export function listTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values());
}

export function listToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return Array.from(toolRegistry.values()).filter(t => t.category === category);
}

export function getToolSchemas(): Array<{ name: string; description: string; inputSchema: unknown }> {
  return Array.from(toolRegistry.values()).map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema instanceof z.ZodObject ? t.inputSchema.shape : {},
  }));
}

export async function invokeTool(
  toolName: string,
  params: unknown,
  context: ToolContext
): Promise<ToolInvocationResult> {
  const startTime = Date.now();
  const tool = toolRegistry.get(toolName);

  if (!tool) {
    log.error("ToolRouter", `Tool not found: ${toolName}`, { traceId: context.traceId });
    return {
      success: false,
      error: `Tool not found: ${toolName}`,
      latencyMs: Date.now() - startTime,
      cacheHit: false,
      invocationId: "",
    };
  }

  const invocation = await storage.createToolInvocation({
    traceId: context.traceId,
    toolName,
    category: tool.category,
    inputParams: params as Record<string, unknown>,
    status: "pending",
    callerRole: context.callerRole,
    debateSessionId: context.debateSessionId,
  });

  try {
    const parseResult = tool.inputSchema.safeParse(params);
    if (!parseResult.success) {
      const errorMsg = `Invalid input: ${parseResult.error.message}`;
      await storage.updateToolInvocation(invocation.id, {
        status: "error",
        errorMessage: errorMsg,
        latencyMs: Date.now() - startTime,
      });
      return {
        success: false,
        error: errorMsg,
        latencyMs: Date.now() - startTime,
        cacheHit: false,
        invocationId: invocation.id,
      };
    }

    const result = await tool.execute(parseResult.data, context);
    const latencyMs = Date.now() - startTime;

    await storage.updateToolInvocation(invocation.id, {
      status: "success",
      outputResult: result as Record<string, unknown>,
      latencyMs,
    });

    log.debug("ToolRouter", `Tool invoked: ${toolName}`, {
      traceId: context.traceId,
      latencyMs,
    });

    return {
      success: true,
      result,
      latencyMs,
      cacheHit: false,
      invocationId: invocation.id,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const latencyMs = Date.now() - startTime;

    await storage.updateToolInvocation(invocation.id, {
      status: "error",
      errorMessage: errorMsg,
      latencyMs,
    });

    log.error("ToolRouter", `Tool execution failed: ${toolName}`, {
      traceId: context.traceId,
      error: errorMsg,
    });

    return {
      success: false,
      error: errorMsg,
      latencyMs,
      cacheHit: false,
      invocationId: invocation.id,
    };
  }
}

registerTool({
  name: "getQuote",
  description: "Get real-time quote for a symbol from Alpaca",
  category: "market_data",
  inputSchema: z.object({
    symbol: z.string().describe("Stock or crypto symbol"),
  }),
  cacheable: true,
  cacheTtlMs: 5000,
  execute: async (params: unknown) => {
    const { symbol } = params as { symbol: string };
    const snapshots = await alpaca.getSnapshots([symbol]);
    const snapshot = snapshots[symbol];
    if (!snapshot) throw new Error(`No quote data for ${symbol}`);
    return {
      symbol,
      price: snapshot.latestTrade?.p || snapshot.dailyBar?.c,
      bid: snapshot.latestQuote?.bp,
      ask: snapshot.latestQuote?.ap,
      volume: snapshot.dailyBar?.v,
      timestamp: new Date().toISOString(),
    };
  },
});

registerTool({
  name: "getBars",
  description: "Get historical price bars for a symbol",
  category: "market_data",
  inputSchema: z.object({
    symbol: z.string(),
    timeframe: z.enum(["1Min", "5Min", "15Min", "1Hour", "1Day"]).default("1Day"),
    limit: z.number().min(1).max(100).default(20),
  }),
  cacheable: true,
  cacheTtlMs: 60000,
  execute: async (params: unknown) => {
    const { symbol, timeframe, limit } = params as { symbol: string; timeframe: string; limit: number };
    const barsResponse = await alpaca.getBars([symbol], timeframe, undefined, undefined, limit);
    const bars = barsResponse.bars[symbol] || [];
    return bars.map((b) => ({
      timestamp: b.t,
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
    }));
  },
});

registerTool({
  name: "listPositions",
  description: "Get all open positions from Alpaca",
  category: "broker",
  inputSchema: z.object({}),
  execute: async () => {
    const positions = await alpaca.getPositions();
    return positions.map((p: { symbol: string; qty: string; market_value: string; avg_entry_price: string; unrealized_pl: string; side: string }) => ({
      symbol: p.symbol,
      qty: parseFloat(p.qty),
      marketValue: parseFloat(p.market_value),
      avgEntryPrice: parseFloat(p.avg_entry_price),
      unrealizedPnl: parseFloat(p.unrealized_pl),
      side: p.side,
    }));
  },
});

registerTool({
  name: "getAccount",
  description: "Get Alpaca account information",
  category: "broker",
  inputSchema: z.object({}),
  execute: async () => {
    const account = await alpaca.getAccount();
    return {
      id: account.id,
      status: account.status,
      buyingPower: parseFloat(account.buying_power),
      cash: parseFloat(account.cash),
      portfolioValue: parseFloat(account.portfolio_value),
      equity: parseFloat(account.equity),
      daytradeCount: account.daytrade_count,
      patternDayTrader: account.pattern_day_trader,
    };
  },
});

registerTool({
  name: "listOrders",
  description: "Get orders from Alpaca",
  category: "broker",
  inputSchema: z.object({
    status: z.enum(["open", "closed", "all"]).default("open"),
    limit: z.number().min(1).max(100).default(50),
  }),
  execute: async (params: unknown) => {
    const { status, limit } = params as { status: "open" | "closed" | "all"; limit: number };
    const orders = await alpaca.getOrders(status, limit);
    return orders.map((o) => ({
      id: o.id,
      clientOrderId: o.client_order_id,
      symbol: o.symbol,
      side: o.side,
      type: o.type,
      qty: o.qty,
      status: o.status,
      submittedAt: o.submitted_at,
      filledQty: o.filled_qty,
      filledAvgPrice: o.filled_avg_price ?? undefined,
    }));
  },
});

registerTool({
  name: "getMarketClock",
  description: "Get market open/close times",
  category: "market_data",
  inputSchema: z.object({}),
  cacheable: true,
  cacheTtlMs: 60000,
  execute: async () => {
    const clock = await alpaca.getClock();
    return {
      isOpen: clock.is_open,
      nextOpen: clock.next_open,
      nextClose: clock.next_close,
      timestamp: clock.timestamp,
    };
  },
});

export { toolRegistry };
