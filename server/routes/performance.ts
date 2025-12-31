import { Router, Request, Response } from "express";
import { log } from "../utils/logger";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

// GET /api/performance/metrics
// Get comprehensive performance metrics for the system
router.get("/metrics", requireAuth, async (req: Request, res: Response) => {
  try {
    const { performanceTracker } = await import("../lib/performance-metrics");
    const { getOrderCacheStats } = await import("../lib/order-execution-cache");
    const { getPoolStats } = await import("../db");

    const metrics = performanceTracker.getMetrics();
    const sloStatus = performanceTracker.getSLOStatus();
    const cacheStats = getOrderCacheStats();
    const poolStats = getPoolStats();

    res.json({
      orderExecution: performanceTracker.getMetricSummary("orderExecution"),
      quoteRetrieval: performanceTracker.getMetricSummary("quoteRetrieval"),
      aiDecision: performanceTracker.getMetricSummary("aiDecision"),
      databaseQuery: performanceTracker.getMetricSummary("databaseQuery"),
      apiCall: performanceTracker.getMetricSummary("apiCall"),
      sloCompliance: sloStatus,
      cache: cacheStats,
      dbPool: poolStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("Routes", "Performance metrics error", { error: error });
    res.status(500).json({ error: "Failed to get performance metrics" });
  }
});

export default router;
