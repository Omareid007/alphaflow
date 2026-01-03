import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../utils/logger";
import {
  generateTraceId,
  getLLMCacheStats,
  clearLLMCache,
  clearLLMCacheForRole,
  resetLLMCacheStats,
} from "../ai/llmGateway";
import {
  aiDecisionEngine,
  type MarketData,
  type NewsContext,
  type StrategyContext,
} from "../ai/decision-engine";
import { sentimentAggregator } from "../services/sentiment-aggregator";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

// POST /api/ai/analyze
// Analyze a trading opportunity using the AI decision engine
router.post("/analyze", requireAuth, async (req: Request, res: Response) => {
  try {
    const { symbol, marketData, newsContext, strategyId } = req.body;

    if (!symbol || !marketData) {
      return res
        .status(400)
        .json({ error: "Symbol and market data are required" });
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
    log.error("Routes", "AI analysis error", { error: error });
    res.status(500).json({ error: "Failed to analyze trading opportunity" });
  }
});

// GET /api/ai/status
// Get the current status of the AI decision engine
router.get("/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const status = aiDecisionEngine.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to get AI status" });
  }
});

// GET /api/ai/events
// AI Events endpoint - aggregates recent AI activity for dashboard
router.get("/events", requireAuth, async (req: Request, res: Response) => {
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
        headline: `${d.action?.toUpperCase() || "SIGNAL"} - ${d.symbol}`,
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
          signals: [],
        },
      }));

    res.json(events);
  } catch (error) {
    log.error("Routes", "Failed to get AI events", { error: error });
    // Return empty array instead of error to prevent UI breaking
    res.json([]);
  }
});

// GET /api/ai/cache/stats
// Get LLM response cache statistics
router.get("/cache/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = getLLMCacheStats();
    res.json(stats);
  } catch (error) {
    log.error("Routes", "Error getting LLM cache stats", { error: error });
    res.status(500).json({ error: "Failed to get cache stats" });
  }
});

// POST /api/ai/cache/clear
// Clear all LLM response cache
router.post(
  "/cache/clear",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      clearLLMCache();
      res.json({ success: true, message: "LLM cache cleared" });
    } catch (error) {
      log.error("Routes", "Error clearing LLM cache", { error: error });
      res.status(500).json({ error: "Failed to clear cache" });
    }
  }
);

// POST /api/ai/cache/clear/:role
// Clear LLM response cache for a specific role
router.post(
  "/cache/clear/:role",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { role } = req.params;
      clearLLMCacheForRole(role as any);
      res.json({ success: true, message: `Cache cleared for role: ${role}` });
    } catch (error) {
      log.error("Routes", "Error clearing LLM cache for role", {
        error: error,
      });
      res.status(500).json({ error: "Failed to clear cache for role" });
    }
  }
);

// POST /api/ai/cache/reset-stats
// Reset LLM cache statistics
router.post(
  "/cache/reset-stats",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      resetLLMCacheStats();
      res.json({ success: true, message: "Cache statistics reset" });
    } catch (error) {
      log.error("Routes", "Error resetting LLM cache stats", { error: error });
      res.status(500).json({ error: "Failed to reset cache stats" });
    }
  }
);

// GET /api/ai/sentiment
// Get sentiment signals for symbols
router.get("/sentiment", requireAuth, async (req: Request, res: Response) => {
  try {
    const symbols = (req.query.symbols as string)?.split(",") || [
      "SPY",
      "QQQ",
      "AAPL",
      "TSLA",
      "NVDA",
    ];

    // Get sentiment from the aggregator service
    const sentimentResults =
      await sentimentAggregator.batchGetSentiment(symbols);

    // Transform to frontend-expected format
    const sentiments = Array.from(sentimentResults.entries()).map(
      ([symbol, result]) => ({
        id: `sent-${symbol}-${Date.now()}`,
        sourceId: "sentiment-aggregator",
        sourceName: "Sentiment Aggregator",
        symbol,
        // Convert from -1 to 1 range to -100 to 100 range for frontend
        score: Math.round(result.overallScore * 100),
        trend:
          result.recommendation === "bullish"
            ? ("up" as const)
            : result.recommendation === "bearish"
              ? ("down" as const)
              : ("neutral" as const),
        explanation: `${result.recommendation.charAt(0).toUpperCase() + result.recommendation.slice(1)} sentiment based on ${result.sources.length} sources. Confidence: ${Math.round(result.overallConfidence * 100)}%${result.conflictDetected ? " (conflicting signals)" : ""}`,
        timestamp: result.timestamp.toISOString(),
      })
    );

    res.json(sentiments);
  } catch (error) {
    log.error("Routes", "Failed to get sentiment signals", { error: error });
    res.status(500).json({ error: "Failed to get sentiment signals" });
  }
});

export default router;
