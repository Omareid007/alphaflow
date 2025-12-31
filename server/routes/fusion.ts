import { Router, Request, Response } from "express";
import { dataFusionEngine } from "../fusion/data-fusion-engine";
import { log } from "../utils/logger";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

/**
 * GET /api/fusion/intelligence
 * Get market intelligence from the data fusion engine
 */
router.get("/intelligence", requireAuth, async (req: Request, res: Response) => {
  try {
    const intelligence = await dataFusionEngine.getMarketIntelligence();
    res.json(intelligence);
  } catch (error) {
    log.error("FusionRoutes", "Failed to get market intelligence", {
      error: error,
    });
    res.status(500).json({ error: "Failed to get market intelligence" });
  }
});

/**
 * GET /api/fusion/market-data
 * Get fused market data from multiple sources
 */
router.get("/market-data", requireAuth, async (req: Request, res: Response) => {
  try {
    const fusedData = await dataFusionEngine.getFusedMarketData();
    res.json(fusedData);
  } catch (error) {
    log.error("FusionRoutes", "Failed to get fused market data", {
      error: error,
    });
    res.status(500).json({ error: "Failed to get fused market data" });
  }
});

/**
 * GET /api/fusion/status
 * Get status of the data fusion engine
 */
router.get("/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const status = dataFusionEngine.getStatus();
    res.json(status);
  } catch (error) {
    log.error("FusionRoutes", "Failed to get fusion status", { error: error });
    res.status(500).json({ error: "Failed to get fusion status" });
  }
});

export default router;
