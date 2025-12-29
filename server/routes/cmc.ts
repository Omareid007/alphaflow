import { Router, Request, Response } from "express";
import { log } from "../utils/logger";
import { badRequest, serverError } from "../lib/standard-errors";
import { coinmarketcap } from "../connectors/coinmarketcap";

const router = Router();

// COINMARKETCAP ENDPOINTS
// ========================

// Get CoinMarketCap cryptocurrency listings
router.get("/listings", async (req: Request, res: Response) => {
  try {
    const start = parseInt(req.query.start as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const listings = await coinmarketcap.getLatestListings(start, limit);
    res.json(listings);
  } catch (error) {
    log.error("Routes", "Failed to get CMC listings", { error: error });
    res.status(500).json({ error: "Failed to get CoinMarketCap listings" });
  }
});

// Get CoinMarketCap quotes for symbols
router.get("/quotes", async (req: Request, res: Response) => {
  try {
    const symbols = (req.query.symbols as string)?.split(",") || ["BTC", "ETH"];
    const quotes = await coinmarketcap.getQuotesBySymbols(symbols);
    res.json(quotes);
  } catch (error) {
    log.error("Routes", "Failed to get CMC quotes", { error: error });
    res.status(500).json({ error: "Failed to get CoinMarketCap quotes" });
  }
});

// Get CoinMarketCap global metrics
router.get("/global", async (req: Request, res: Response) => {
  try {
    const metrics = await coinmarketcap.getGlobalMetrics();
    res.json(metrics);
  } catch (error) {
    log.error("Routes", "Failed to get CMC global metrics", { error: error });
    res
      .status(500)
      .json({ error: "Failed to get CoinMarketCap global metrics" });
  }
});

// Search cryptocurrencies on CoinMarketCap
router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return badRequest(res, "Search query required");
    }
    const results = await coinmarketcap.searchCryptos(query);
    res.json(results);
  } catch (error) {
    log.error("Routes", "Failed to search CMC", { error: error });
    res.status(500).json({ error: "Failed to search CoinMarketCap" });
  }
});

export default router;
