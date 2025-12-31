import { Router, Request, Response } from "express";
import { alpaca } from "../connectors/alpaca";
import { log } from "../utils/logger";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

/**
 * GET /api/market/quotes
 * Get real-time market quotes for symbols
 * Query params: { symbols: string } - comma-separated list of symbols
 */
router.get("/quotes", requireAuth, async (req: Request, res: Response) => {
  try {
    const symbolsParam = req.query.symbols as string;
    if (!symbolsParam) {
      return res.status(400).json({ error: "symbols parameter required" });
    }
    const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase());
    const snapshots = await alpaca.getSnapshots(symbols);

    // Transform to a simpler format
    const quotes = symbols.map((symbol) => {
      const snap = snapshots[symbol];
      if (!snap) {
        return { symbol, price: null, change: null, changePercent: null };
      }
      const price = snap.latestTrade?.p || snap.dailyBar?.c || 0;
      const prevClose = snap.prevDailyBar?.c || price;
      const change = price - prevClose;
      const changePercent = prevClose ? (change / prevClose) * 100 : 0;
      return {
        symbol,
        price,
        change,
        changePercent,
        volume: snap.dailyBar?.v || 0,
        high: snap.dailyBar?.h || 0,
        low: snap.dailyBar?.l || 0,
        open: snap.dailyBar?.o || 0,
      };
    });
    res.json(quotes);
  } catch (error) {
    log.error("MarketQuotesRoutes", "Failed to get market quotes", {
      error: error,
    });
    res.status(500).json({ error: "Failed to get market quotes" });
  }
});

export default router;
