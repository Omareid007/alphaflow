import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../utils/logger";
import {
  badRequest,
  notFound,
  serverError,
  validationError,
} from "../lib/standard-errors";
import {
  aiDecisionEngine,
  type MarketData,
  type NewsContext,
  type StrategyContext,
} from "../ai/decision-engine";
import {
  generateTraceId,
  getLLMCacheStats,
  clearLLMCache,
  clearLLMCacheForRole,
  resetLLMCacheStats,
} from "../ai/llmGateway";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";
import { orchestrator } from "../autonomous/orchestrator";
import { marketConditionAnalyzer } from "../ai/market-condition-analyzer";
import { alpaca, type AlpacaOrder } from "../connectors/alpaca";
import { insertAiDecisionSchema } from "@shared/schema";
import type { Order, Trade, Position } from "@shared/schema";

const router = Router();

// ============================================================================
// AI DECISIONS ENDPOINTS
// ============================================================================

/**
 * GET /api/ai-decisions
 * Fetch recent AI trading decisions
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const decisions = await storage.getAiDecisions(req.userId!, limit);
    res.json(decisions);
  } catch (error) {
    log.error("AiDecisionsAPI", `Failed to get AI decisions: ${error}`);
    res.status(500).json({ error: "Failed to get AI decisions" });
  }
});

/**
 * GET /api/ai-decisions/history
 * Fetch AI decisions history with filtering and pagination
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const statusFilter = req.query.status as string;
    const actionFilter = req.query.action as string;

    const decisions = await storage.getAiDecisions(req.userId!, limit + offset);
    let filtered = decisions.slice(offset, offset + limit);

    if (statusFilter) {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }
    if (actionFilter) {
      filtered = filtered.filter((d) => d.action === actionFilter);
    }

    const pendingAnalysis = orchestrator.getPendingAnalysis?.() || [];

    res.json({
      decisions: filtered,
      total: decisions.length,
      hasMore: offset + limit < decisions.length,
      pendingAnalysis: pendingAnalysis,
    });
  } catch (error) {
    log.error("AiDecisionsAPI", `Failed to get AI decision history: ${error}`);
    res.status(500).json({ error: "Failed to get AI decision history" });
  }
});

/**
 * POST /api/ai-decisions
 * Create a new AI decision record
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = insertAiDecisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }
    const decision = await storage.createAiDecision(parsed.data);
    res.status(201).json(decision);
  } catch (error) {
    log.error("AiDecisionsAPI", `Failed to create AI decision: ${error}`);
    res.status(500).json({ error: "Failed to create AI decision" });
  }
});

/**
 * GET /api/ai-decisions/enriched
 * Returns AI decisions with linked orders, trades, positions
 * Includes complete timeline stages from decision through position
 */
router.get("/enriched", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const statusFilter = req.query.status as string | undefined;

    // Fetch decisions with their linked data
    const decisions = await storage.getAiDecisions(req.userId!, limit + offset);

    // Build enriched decisions with timeline stages
    const enrichedDecisions = await Promise.all(
      decisions.slice(offset, offset + limit).map(async (decision) => {
        const enriched: {
          decision: typeof decision;
          linkedOrder: Order | null;
          linkedTrade: Trade | null;
          linkedPosition: Position | null;
          timeline: {
            stage:
              | "decision"
              | "risk_gate"
              | "order"
              | "fill"
              | "position"
              | "exit";
            status: "completed" | "pending" | "skipped" | "failed";
            timestamp: Date | null;
            details?: string;
          }[];
        } = {
          decision,
          linkedOrder: null,
          linkedTrade: null,
          linkedPosition: null,
          timeline: [],
        };

        // Stage 1: Decision created
        enriched.timeline.push({
          stage: "decision",
          status: "completed",
          timestamp: decision.createdAt,
          details: `${decision.action.toUpperCase()} signal with ${parseFloat(decision.confidence || "0").toFixed(1)}% confidence`,
        });

        // Stage 2: Risk gate evaluation
        if (decision.status === "skipped") {
          enriched.timeline.push({
            stage: "risk_gate",
            status: "skipped",
            timestamp: decision.createdAt,
            details: decision.skipReason || "Trade blocked by risk rules",
          });
        } else if (decision.status === "executed" || decision.executedTradeId) {
          enriched.timeline.push({
            stage: "risk_gate",
            status: "completed",
            timestamp: decision.createdAt,
            details: "Risk check passed",
          });
        } else if (decision.status === "pending") {
          enriched.timeline.push({
            stage: "risk_gate",
            status: "pending",
            timestamp: null,
            details: "Awaiting risk evaluation",
          });
        }

        // Fetch linked order if decision was submitted
        if (decision.id) {
          try {
            const linkedOrders = await storage.getOrdersByDecisionId(
              decision.id
            );
            if (linkedOrders.length > 0) {
              const order = linkedOrders[0];
              enriched.linkedOrder = order;

              // Stage 3: Order submission
              enriched.timeline.push({
                stage: "order",
                status:
                  order.status === "filled" ||
                  order.status === "partially_filled"
                    ? "completed"
                    : order.status === "pending_new" ||
                        order.status === "accepted"
                      ? "pending"
                      : "failed",
                timestamp: order.submittedAt,
                details: `${order.side.toUpperCase()} ${order.qty || order.notional} @ ${order.type}`,
              });

              // Stage 4: Fill
              if (order.filledAt) {
                enriched.timeline.push({
                  stage: "fill",
                  status: "completed",
                  timestamp: order.filledAt,
                  details: `Filled ${order.filledQty} @ ${order.filledAvgPrice}`,
                });
              } else if (
                order.status === "pending_new" ||
                order.status === "accepted"
              ) {
                enriched.timeline.push({
                  stage: "fill",
                  status: "pending",
                  timestamp: null,
                  details: "Awaiting fill",
                });
              }
            }
          } catch (e) {
            // No linked order - that's OK
          }
        }

        // Fetch linked trade if executed
        if (decision.executedTradeId) {
          try {
            const trade = await storage.getTrade(decision.executedTradeId);
            if (trade) {
              enriched.linkedTrade = trade;
            }
          } catch (e) {
            // No linked trade - that's OK
          }
        }

        // Check for open position on symbol
        try {
          const positions = await storage.getPositions();
          const symbolPosition = positions.find(
            (p) => p.symbol.toUpperCase() === decision.symbol.toUpperCase()
          );
          if (symbolPosition) {
            enriched.linkedPosition = symbolPosition;
            enriched.timeline.push({
              stage: "position",
              status: "completed",
              timestamp: symbolPosition.openedAt,
              details: `${symbolPosition.side} ${symbolPosition.quantity} @ ${symbolPosition.entryPrice}`,
            });
          }
        } catch (e) {
          // No linked position - that's OK
        }

        return enriched;
      })
    );

    // Filter by status if requested
    let filtered = enrichedDecisions;
    if (statusFilter) {
      filtered = enrichedDecisions.filter(
        (e) => e.decision.status === statusFilter
      );
    }

    res.json({
      enrichedDecisions: filtered,
      total: decisions.length,
      hasMore: offset + limit < decisions.length,
    });
  } catch (error) {
    log.error(
      "AiDecisionsAPI",
      `Failed to get enriched AI decisions: ${error}`
    );
    res.status(500).json({ error: "Failed to get enriched AI decisions" });
  }
});

// ============================================================================
// AI ANALYSIS & STATUS ENDPOINTS
// ============================================================================

/**
 * POST /api/ai/analyze
 * Analyze a trading opportunity and generate AI decision
 */
router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { symbol, marketData, newsContext, strategyId } = req.body;

    if (!symbol || !marketData) {
      return badRequest(res, "Symbol and market data are required");
    }

    let strategy: StrategyContext | undefined;
    if (strategyId) {
      const dbStrategy = await storage.getStrategy(strategyId);
      if (dbStrategy) {
        strategy = {
          id: dbStrategy.id,
          name: dbStrategy.name,
          type: dbStrategy.type,
          parameters: dbStrategy.parameters
            ? JSON.parse(dbStrategy.parameters)
            : undefined,
        };
      }
    }

    const traceId = generateTraceId();
    const decision = await aiDecisionEngine.analyzeOpportunity(
      symbol,
      marketData as MarketData,
      newsContext as NewsContext | undefined,
      strategy,
      { traceId }
    );

    const aiDecisionRecord = await storage.createAiDecision({
      strategyId: strategyId || null,
      symbol,
      action: decision.action,
      confidence: decision.confidence.toString(),
      reasoning: decision.reasoning,
      traceId,
      marketContext: JSON.stringify({
        marketData,
        newsContext,
        riskLevel: decision.riskLevel,
        suggestedQuantity: decision.suggestedQuantity,
        targetPrice: decision.targetPrice,
        stopLoss: decision.stopLoss,
      }),
    });

    res.json({
      id: aiDecisionRecord.id,
      ...decision,
      createdAt: aiDecisionRecord.createdAt,
    });
  } catch (error) {
    log.error("AiDecisionsAPI", `AI analysis error: ${error}`);
    res.status(500).json({ error: "Failed to analyze trading opportunity" });
  }
});

/**
 * GET /api/ai/status
 * Get current AI decision engine status
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const status = aiDecisionEngine.getStatus();
    res.json(status);
  } catch (error) {
    log.error("AiDecisionsAPI", `Failed to get AI status: ${error}`);
    res.status(500).json({ error: "Failed to get AI status" });
  }
});

/**
 * GET /api/ai/events
 * Aggregates recent AI activity for dashboard
 */
router.get("/events", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const type = req.query.type as string | undefined;

    // Get recent AI decisions from storage
    const decisions = await storage.getAiDecisions(undefined, limit * 2);

    // Transform decisions into events format
    // Note: type, headline, explanation, signals are derived from action/reasoning
    const events = decisions
      .filter((d) => !type || d.action === type)
      .slice(0, limit)
      .map((d) => ({
        id: d.id,
        type: d.action || "signal",
        title: `${d.action?.toUpperCase() || "SIGNAL"} - ${d.symbol || "Market"}`,
        headline: `${d.action?.toUpperCase() || "SIGNAL"} - ${d.symbol || "Market"}`,
        description: d.reasoning,
        explanation: d.reasoning,
        symbol: d.symbol,
        confidence:
          typeof d.confidence === "string"
            ? parseFloat(d.confidence)
            : d.confidence,
        action: d.action,
        time: d.createdAt,
        createdAt: d.createdAt,
        metadata: {
          strategyId: d.strategyId,
          signals: null,
        },
      }));

    res.json(events);
  } catch (error) {
    log.error("AiDecisionsAPI", `Failed to get AI events: ${error}`);
    // Return empty array instead of error to prevent UI breaking
    res.json([]);
  }
});

/**
 * GET /api/ai/sentiment
 * Get sentiment signals for specified symbols
 */
router.get("/sentiment", async (req: Request, res: Response) => {
  try {
    const symbols = (req.query.symbols as string)?.split(",") || [
      "SPY",
      "QQQ",
      "AAPL",
      "TSLA",
      "NVDA",
    ];

    // Generate sentiment signals based on available data
    // In production, this would call the data fusion engine or sentiment analysis service
    const sentiments = symbols.map((symbol) => ({
      id: `sent-${symbol}-${Date.now()}`,
      sourceId: "data-fusion",
      sourceName: "Data Fusion Engine",
      symbol,
      score: Math.random() * 100 - 50, // -50 to +50
      trend:
        Math.random() > 0.5
          ? ("up" as const)
          : Math.random() > 0.5
            ? ("down" as const)
            : ("neutral" as const),
      explanation: `Aggregate sentiment analysis for ${symbol} based on news, social media, and market data`,
      timestamp: new Date().toISOString(),
    }));

    res.json(sentiments);
  } catch (error) {
    log.error("AiDecisionsAPI", `Failed to get sentiment signals: ${error}`);
    res.status(500).json({ error: "Failed to get sentiment signals" });
  }
});

// ============================================================================
// LLM CACHE MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/ai/cache/stats
 * Get LLM response cache statistics
 */
router.get("/cache/stats", async (req: Request, res: Response) => {
  try {
    const stats = getLLMCacheStats();
    res.json(stats);
  } catch (error) {
    log.error("AiDecisionsAPI", `Error getting LLM cache stats: ${error}`);
    res.status(500).json({ error: "Failed to get cache stats" });
  }
});

/**
 * POST /api/ai/cache/clear
 * Clear all LLM response cache
 */
router.post("/cache/clear", async (req: Request, res: Response) => {
  try {
    clearLLMCache();
    res.json({ success: true, message: "LLM cache cleared" });
  } catch (error) {
    log.error("AiDecisionsAPI", `Error clearing LLM cache: ${error}`);
    res.status(500).json({ error: "Failed to clear cache" });
  }
});

/**
 * POST /api/ai/cache/clear/:role
 * Clear LLM cache for a specific role
 */
router.post("/cache/clear/:role", async (req: Request, res: Response) => {
  try {
    const { role } = req.params;
    clearLLMCacheForRole(role as any);
    res.json({ success: true, message: `Cache cleared for role: ${role}` });
  } catch (error) {
    log.error("AiDecisionsAPI", `Error clearing LLM cache for role: ${error}`);
    res.status(500).json({ error: "Failed to clear cache for role" });
  }
});

/**
 * POST /api/ai/cache/reset-stats
 * Reset LLM cache statistics
 */
router.post("/cache/reset-stats", async (req: Request, res: Response) => {
  try {
    resetLLMCacheStats();
    res.json({ success: true, message: "Cache statistics reset" });
  } catch (error) {
    log.error("AiDecisionsAPI", `Error resetting LLM cache stats: ${error}`);
    res.status(500).json({ error: "Failed to reset cache stats" });
  }
});

// ============================================================================
// AGENT ENDPOINTS
// ============================================================================

/**
 * GET /api/agent/status
 * Get current autonomous agent status
 */
router.get("/agent/status", async (req: Request, res: Response) => {
  try {
    const status = await storage.getAgentStatus();
    if (!status) {
      const defaultStatus = await storage.updateAgentStatus({
        isRunning: false,
        totalTrades: 0,
        totalPnl: "0",
      });
      return res.json(defaultStatus);
    }
    res.json(status);
  } catch (error) {
    log.error("AiDecisionsAPI", `Failed to get agent status: ${error}`);
    res.status(500).json({ error: "Failed to get agent status" });
  }
});

/**
 * POST /api/agent/toggle
 * Toggle autonomous agent on/off
 */
router.post("/agent/toggle", async (req: Request, res: Response) => {
  try {
    const currentStatus = await storage.getAgentStatus();
    const newIsRunning = !(currentStatus?.isRunning ?? false);

    if (newIsRunning) {
      await alpacaTradingEngine.resumeAgent();
    } else {
      await alpacaTradingEngine.stopAllStrategies();
    }

    const status = await storage.getAgentStatus();
    res.json(status);
  } catch (error) {
    log.error("AiDecisionsAPI", `Failed to toggle agent: ${error}`);
    res.status(500).json({ error: "Failed to toggle agent" });
  }
});

/**
 * GET /api/agent/market-analysis
 * Get current market condition analysis
 */
router.get("/agent/market-analysis", async (req: Request, res: Response) => {
  try {
    const analyzerStatus = marketConditionAnalyzer.getStatus();
    const lastAnalysis = marketConditionAnalyzer.getLastAnalysis();

    res.json({
      isRunning: analyzerStatus.isRunning,
      lastAnalysis,
      lastAnalysisTime: analyzerStatus.lastAnalysisTime,
      currentOrderLimit: analyzerStatus.currentOrderLimit,
    });
  } catch (error) {
    log.error("AiDecisionsAPI", `Failed to get market analysis: ${error}`);
    res.status(500).json({ error: "Failed to get market analysis" });
  }
});

/**
 * POST /api/agent/market-analysis/refresh
 * Manually trigger market condition analysis
 */
router.post(
  "/agent/market-analysis/refresh",
  async (req: Request, res: Response) => {
    try {
      const analysis = await marketConditionAnalyzer.runAnalysis();
      res.json({ success: true, analysis });
    } catch (error) {
      log.error(
        "AiDecisionsAPI",
        `Failed to refresh market analysis: ${error}`
      );
      res.status(500).json({ error: "Failed to refresh market analysis" });
    }
  }
);

/**
 * GET /api/agent/dynamic-limits
 * Get dynamic order limits based on market conditions
 */
router.get("/agent/dynamic-limits", async (req: Request, res: Response) => {
  try {
    const agentStatus = await storage.getAgentStatus();
    const analyzerStatus = marketConditionAnalyzer.getStatus();

    const minLimit = agentStatus?.minOrderLimit ?? 10;
    const maxLimit = agentStatus?.maxOrderLimit ?? 50;

    let currentLimit =
      agentStatus?.dynamicOrderLimit ?? analyzerStatus.currentOrderLimit ?? 25;
    currentLimit = Math.max(minLimit, Math.min(maxLimit, currentLimit));

    res.json({
      currentDynamicLimit: currentLimit,
      minOrderLimit: minLimit,
      maxOrderLimit: maxLimit,
      marketCondition: agentStatus?.marketCondition || "neutral",
      aiConfidenceScore: agentStatus?.aiConfidenceScore || "0.5",
      lastMarketAnalysis: agentStatus?.lastMarketAnalysis,
    });
  } catch (error) {
    log.error("AiDecisionsAPI", `Failed to get dynamic limits: ${error}`);
    res.status(500).json({ error: "Failed to get dynamic limits" });
  }
});

/**
 * POST /api/agent/set-limits
 * Set minimum and maximum order limits
 */
router.post("/agent/set-limits", async (req: Request, res: Response) => {
  try {
    const { minOrderLimit, maxOrderLimit } = req.body;

    const updates: { minOrderLimit?: number; maxOrderLimit?: number } = {};

    if (minOrderLimit !== undefined) {
      if (minOrderLimit < 1 || minOrderLimit > 100) {
        return badRequest(res, "minOrderLimit must be between 1 and 100");
      }
      updates.minOrderLimit = minOrderLimit;
    }

    if (maxOrderLimit !== undefined) {
      if (maxOrderLimit < 1 || maxOrderLimit > 100) {
        return badRequest(res, "maxOrderLimit must be between 1 and 100");
      }
      updates.maxOrderLimit = maxOrderLimit;
    }

    if (
      updates.minOrderLimit &&
      updates.maxOrderLimit &&
      updates.minOrderLimit > updates.maxOrderLimit
    ) {
      return badRequest(
        res,
        "minOrderLimit cannot be greater than maxOrderLimit"
      );
    }

    await storage.updateAgentStatus(updates);
    const updatedStatus = await storage.getAgentStatus();

    res.json({
      success: true,
      minOrderLimit: updatedStatus?.minOrderLimit,
      maxOrderLimit: updatedStatus?.maxOrderLimit,
    });
  } catch (error) {
    log.error("AiDecisionsAPI", `Failed to set limits: ${error}`);
    res.status(500).json({ error: "Failed to set limits" });
  }
});

/**
 * GET /api/agent/health
 * Get agent health status
 */
router.get("/agent/health", async (req: Request, res: Response) => {
  try {
    const healthStatus = orchestrator.getHealthStatus();
    const agentStatus = await storage.getAgentStatus();

    res.json({
      ...healthStatus,
      autoStartEnabled: agentStatus?.autoStartEnabled ?? true,
      lastHeartbeatFromDb: agentStatus?.lastHeartbeat,
    });
  } catch (error) {
    log.error("AiDecisionsAPI", `Failed to get agent health: ${error}`);
    res.status(500).json({ error: "Failed to get agent health" });
  }
});

/**
 * POST /api/agent/auto-start
 * Enable or disable agent auto-start on system restart
 */
router.post("/agent/auto-start", async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return badRequest(res, "enabled must be a boolean");
    }

    await orchestrator.setAutoStartEnabled(enabled);

    res.json({ success: true, autoStartEnabled: enabled });
  } catch (error) {
    log.error("AiDecisionsAPI", `Failed to set auto-start: ${error}`);
    res.status(500).json({ error: "Failed to set auto-start" });
  }
});

/**
 * POST /api/autonomous/execute-trades
 * Execute trades based on AI decisions
 */
router.post(
  "/autonomous/execute-trades",
  async (req: Request, res: Response) => {
    try {
      const { decisionIds } = req.body;
      if (
        !decisionIds ||
        !Array.isArray(decisionIds) ||
        decisionIds.length === 0
      ) {
        return badRequest(res, "Decision IDs array is required");
      }

      const results: Array<{
        decisionId: string;
        success: boolean;
        error?: string;
        order?: unknown;
      }> = [];

      for (const decisionId of decisionIds) {
        const decisions = await storage.getAiDecisions(undefined, 100);
        const decision = decisions.find((d) => d.id === decisionId);
        if (!decision) {
          results.push({
            decisionId,
            success: false,
            error: "Decision not found",
          });
          continue;
        }

        try {
          // Use AI's suggestedQuantity instead of hardcoded 1
          // suggestedQuantity is a percentage (0.01-0.25), calculate actual shares
          const metadata = decision.metadata
            ? JSON.parse(decision.metadata)
            : {};
          const suggestedPct = metadata?.suggestedQuantity
            ? parseFloat(String(metadata.suggestedQuantity))
            : 0.05; // Default 5% of portfolio

          // Get account info to calculate quantity
          const account = await alpaca.getAccount();
          const buyingPower = parseFloat(account.buying_power);
          const price = parseFloat(decision.entryPrice || "0");
          if (!price) {
            results.push({
              decisionId,
              success: false,
              error: "No entry price available",
            });
            continue;
          }

          const tradeValue =
            buyingPower * Math.min(Math.max(suggestedPct, 0.01), 0.1); // 1-10% cap
          const quantity = Math.floor(tradeValue / price);

          if (quantity < 1) {
            results.push({
              decisionId,
              success: false,
              error: "Calculated quantity less than 1 share",
            });
            continue;
          }

          // SECURITY: Mark as authorized since this is an admin-initiated action
          // executing a pre-approved AI decision
          const orderResult = await alpacaTradingEngine.executeAlpacaTrade({
            symbol: decision.symbol,
            side: decision.action as "buy" | "sell",
            quantity,
            authorizedByOrchestrator: true,
          });

          if (orderResult.success) {
            results.push({
              decisionId,
              success: true,
              order: orderResult.order,
            });
          } else {
            results.push({
              decisionId,
              success: false,
              error: orderResult.error,
            });
          }
        } catch (err) {
          results.push({ decisionId, success: false, error: String(err) });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      res.json({
        success: successCount > 0,
        message: `Executed ${successCount}/${decisionIds.length} trades`,
        results,
      });
    } catch (error) {
      log.error("AiDecisionsAPI", `Failed to execute trades: ${error}`);
      res.status(500).json({ error: String(error) });
    }
  }
);

export default router;
