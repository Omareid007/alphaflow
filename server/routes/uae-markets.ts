import { Router, Request, Response } from "express";
import { log } from "../utils/logger";
import { serverError } from "../lib/standard-errors";
import { uaeMarkets } from "../connectors/uae-markets";

const router = Router();

// UAE MARKETS ENDPOINTS
// =====================

// Get top stocks from UAE markets (ADX/DFM)
router.get("/stocks", async (req: Request, res: Response) => {
  try {
    const exchange = req.query.exchange as "ADX" | "DFM" | undefined;
    const stocks = await uaeMarkets.getTopStocks(exchange);
    res.json(stocks);
  } catch (error) {
    log.error("Routes", "Failed to fetch UAE stocks", { error: error });
    res.status(500).json({ error: "Failed to fetch UAE stocks" });
  }
});

// Get market summary for UAE exchanges
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const exchange = req.query.exchange as "ADX" | "DFM" | undefined;
    const summary = await uaeMarkets.getMarketSummary(exchange);
    res.json(summary);
  } catch (error) {
    log.error("Routes", "Failed to fetch UAE market summary", { error: error });
    res.status(500).json({ error: "Failed to fetch UAE market summary" });
  }
});

// Get UAE market info
router.get("/info", async (req: Request, res: Response) => {
  try {
    const info = uaeMarkets.getMarketInfo();
    res.json(info);
  } catch (error) {
    log.error("Routes", "Failed to fetch UAE market info", { error: error });
    res.status(500).json({ error: "Failed to fetch UAE market info" });
  }
});

// Get UAE connector status
router.get("/status", async (req: Request, res: Response) => {
  try {
    const status = uaeMarkets.getConnectionStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to get UAE connector status" });
  }
});

export default router;
