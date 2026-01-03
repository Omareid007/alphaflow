import { Router, Request, Response } from "express";
import { log } from "../utils/logger";
import { connectorMetricsService } from "../services/connector-metrics-service";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

/**
 * Feed configuration with connector metadata
 */
interface FeedConfig {
  id: string;
  name: string;
  category: "market" | "news" | "fundamental" | "crypto";
  connectorId: string; // Maps to connector name in metrics
  description: string;
}

const FEED_CONFIGS: FeedConfig[] = [
  {
    id: "alpaca",
    name: "Alpaca Markets",
    category: "market",
    connectorId: "Alpaca",
    description: "US equities, real-time quotes and trades",
  },
  {
    id: "coingecko",
    name: "CoinGecko",
    category: "crypto",
    connectorId: "CoinGecko",
    description: "Cryptocurrency prices and market data",
  },
  {
    id: "finnhub",
    name: "Finnhub",
    category: "market",
    connectorId: "Finnhub",
    description: "Stock data, fundamentals, and earnings",
  },
  {
    id: "coinmarketcap",
    name: "CoinMarketCap",
    category: "crypto",
    connectorId: "CoinMarketCap",
    description: "Cryptocurrency rankings and metrics",
  },
  {
    id: "newsapi",
    name: "NewsAPI",
    category: "news",
    connectorId: "NewsAPI",
    description: "Global news articles and headlines",
  },
  {
    id: "gdelt",
    name: "GDELT Project",
    category: "news",
    connectorId: "GDELT",
    description: "Global event monitoring and sentiment",
  },
  {
    id: "huggingface",
    name: "HuggingFace",
    category: "fundamental",
    connectorId: "HuggingFace",
    description: "AI-powered sentiment analysis (FinBERT)",
  },
  {
    id: "fred",
    name: "FRED",
    category: "fundamental",
    connectorId: "FRED",
    description: "Federal Reserve economic data",
  },
];

/**
 * Determine feed status based on metrics
 */
function determineStatus(
  metrics: { successRate: number; totalRequests: number } | undefined
): "active" | "degraded" | "inactive" | "unknown" {
  if (!metrics || metrics.totalRequests === 0) {
    return "unknown";
  }
  if (metrics.successRate >= 95) {
    return "active";
  }
  if (metrics.successRate >= 70) {
    return "degraded";
  }
  return "inactive";
}

/**
 * GET /api/feeds
 * Get status of all data feed connectors with real health metrics
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    // Get connector summary from metrics service
    const connectorSummaries =
      await connectorMetricsService.getConnectorSummary();
    const summaryByConnector = new Map(
      connectorSummaries.map((s) => [s.connector.toLowerCase(), s])
    );

    // Get latest metrics for error info
    const latestMetrics = await connectorMetricsService.getLatestMetrics();
    const latestByConnector = new Map(
      latestMetrics.map((m) => [m.connector.toLowerCase(), m])
    );

    const feeds = FEED_CONFIGS.map((config) => {
      const connectorKey = config.connectorId.toLowerCase();
      const summary = summaryByConnector.get(connectorKey);
      const latest = latestByConnector.get(connectorKey);

      return {
        id: config.id,
        name: config.name,
        category: config.category,
        description: config.description,
        status: determineStatus(summary),
        metrics: summary
          ? {
              successRate: Math.round(summary.successRate * 10) / 10,
              avgLatencyMs: Math.round(summary.avgLatencyMs),
              totalRequests: summary.totalRequests,
              cacheHitRate: Math.round(summary.cacheHitRate * 10) / 10,
            }
          : null,
        lastError: latest?.lastError || null,
        lastErrorAt: latest?.lastErrorAt?.toISOString() || null,
        lastUpdate:
          latest?.updatedAt?.toISOString() || new Date().toISOString(),
      };
    });

    res.json(feeds);
  } catch (error) {
    log.error("FeedsRoutes", "Failed to get feed sources", { error });
    // Fallback to basic info on error
    const fallback = FEED_CONFIGS.map((config) => ({
      id: config.id,
      name: config.name,
      category: config.category,
      description: config.description,
      status: "unknown" as const,
      metrics: null,
      lastError: null,
      lastErrorAt: null,
      lastUpdate: new Date().toISOString(),
    }));
    res.json(fallback);
  }
});

/**
 * GET /api/feeds/:id
 * Get detailed status for a specific feed
 */
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const config = FEED_CONFIGS.find((f) => f.id === id);

    if (!config) {
      res.status(404).json({ error: "Feed not found" });
      return;
    }

    // Get 7-day metrics for this connector
    const metrics = await connectorMetricsService.getMetricsByConnector(
      config.connectorId,
      7
    );

    // Calculate daily breakdown
    const dailyStats = metrics.map((m) => ({
      date: m.date.toISOString().split("T")[0],
      totalRequests: m.totalRequests,
      successCount: m.successCount,
      failureCount: m.failureCount,
      successRate:
        m.totalRequests > 0
          ? Math.round((m.successCount / m.totalRequests) * 1000) / 10
          : 100,
      avgLatencyMs: Math.round(parseFloat(m.avgLatencyMs || "0")),
      p95LatencyMs: Math.round(parseFloat(m.p95LatencyMs || "0")),
      cacheHitRate:
        m.cacheHits + m.cacheMisses > 0
          ? Math.round((m.cacheHits / (m.cacheHits + m.cacheMisses)) * 1000) /
            10
          : 0,
      rateLimitHits: m.rateLimitHits,
      fallbackUsed: m.fallbackUsed,
    }));

    // Calculate aggregate stats
    const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalSuccess = metrics.reduce((sum, m) => sum + m.successCount, 0);
    const totalCacheHits = metrics.reduce((sum, m) => sum + m.cacheHits, 0);
    const totalCacheMisses = metrics.reduce((sum, m) => sum + m.cacheMisses, 0);

    res.json({
      id: config.id,
      name: config.name,
      category: config.category,
      description: config.description,
      status: determineStatus({
        successRate:
          totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 100,
        totalRequests,
      }),
      aggregate: {
        totalRequests,
        successRate:
          totalRequests > 0
            ? Math.round((totalSuccess / totalRequests) * 1000) / 10
            : 100,
        cacheHitRate:
          totalCacheHits + totalCacheMisses > 0
            ? Math.round(
                (totalCacheHits / (totalCacheHits + totalCacheMisses)) * 1000
              ) / 10
            : 0,
      },
      dailyStats,
      lastError: metrics[0]?.lastError || null,
      lastErrorAt: metrics[0]?.lastErrorAt?.toISOString() || null,
    });
  } catch (error) {
    log.error("FeedsRoutes", "Failed to get feed details", { error });
    res.status(500).json({ error: "Failed to get feed details" });
  }
});

export default router;
