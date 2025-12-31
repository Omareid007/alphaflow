/**
 * Cryptocurrency Market Routes
 * Handles crypto market data from CoinGecko
 */

import { Router, Request, Response } from "express";
import { coingecko } from "../connectors/coingecko";
import { log } from "../utils/logger";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

// GET /api/crypto/markets - Get top cryptocurrencies
router.get("/markets", requireAuth, async (req: Request, res: Response) => {
  try {
    const perPage = parseInt(req.query.per_page as string) || 20;
    const page = parseInt(req.query.page as string) || 1;
    const order = (req.query.order as string) || "market_cap_desc";
    const markets = await coingecko.getMarkets("usd", perPage, page, order);
    res.json(markets);
  } catch (error) {
    log.error("CryptoAPI", "Failed to get crypto markets", { error });
    res.status(500).json({ error: "Failed to fetch crypto market data" });
  }
});

// GET /api/crypto/prices - Get prices for specific coins
router.get("/prices", requireAuth, async (req: Request, res: Response) => {
  try {
    const ids = (req.query.ids as string) || "bitcoin,ethereum,solana";
    const coinIds = ids.split(",").map((id) => id.trim());
    const prices = await coingecko.getSimplePrice(coinIds);
    res.json(prices);
  } catch (error) {
    log.error("CryptoAPI", "Failed to get crypto prices", { error });
    res.status(500).json({ error: "Failed to fetch crypto prices" });
  }
});

// GET /api/crypto/chart/:coinId - Get price chart data
router.get("/chart/:coinId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { coinId } = req.params;
    const days = (req.query.days as string) || "7";
    const chart = await coingecko.getMarketChart(coinId, "usd", days);
    res.json(chart);
  } catch (error) {
    log.error("CryptoAPI", "Failed to get crypto chart", { error });
    res.status(500).json({ error: "Failed to fetch crypto chart data" });
  }
});

// GET /api/crypto/trending - Get trending cryptocurrencies
router.get("/trending", requireAuth, async (req: Request, res: Response) => {
  try {
    const trending = await coingecko.getTrending();
    res.json(trending);
  } catch (error) {
    log.error("CryptoAPI", "Failed to get trending crypto", { error });
    res.status(500).json({ error: "Failed to fetch trending coins" });
  }
});

// GET /api/crypto/global - Get global crypto market stats
router.get("/global", requireAuth, async (req: Request, res: Response) => {
  try {
    const global = await coingecko.getGlobalData();
    res.json(global);
  } catch (error) {
    log.error("CryptoAPI", "Failed to get global crypto stats", { error });
    res.status(500).json({ error: "Failed to fetch global market data" });
  }
});

// GET /api/crypto/search - Search for cryptocurrencies
router.get("/search", requireAuth, async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || "";
    if (!query) {
      return res.status(400).json({ error: "Search query required" });
    }
    const results = await coingecko.searchCoins(query);
    res.json(results);
  } catch (error) {
    log.error("CryptoAPI", "Failed to search crypto", { error });
    res.status(500).json({ error: "Failed to search coins" });
  }
});

export default router;
