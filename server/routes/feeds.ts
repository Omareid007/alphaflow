import { Router, Request, Response } from "express";
import { log } from "../utils/logger";

const router = Router();

/**
 * GET /api/feeds
 * Get status of all data feed connectors
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const feeds = [
      {
        id: 'alpaca',
        name: 'Alpaca Markets',
        category: 'market' as const,
        status: 'active' as const,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'coingecko',
        name: 'CoinGecko',
        category: 'market' as const,
        status: 'active' as const,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'finnhub',
        name: 'Finnhub',
        category: 'market' as const,
        status: 'active' as const,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'coinmarketcap',
        name: 'CoinMarketCap',
        category: 'market' as const,
        status: 'active' as const,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'newsapi',
        name: 'NewsAPI',
        category: 'news' as const,
        status: 'active' as const,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'gdelt',
        name: 'GDELT Project',
        category: 'news' as const,
        status: 'active' as const,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'uae-markets',
        name: 'UAE Markets',
        category: 'market' as const,
        status: 'active' as const,
        lastUpdate: new Date().toISOString(),
      },
      {
        id: 'huggingface',
        name: 'HuggingFace',
        category: 'fundamental' as const,
        status: 'active' as const,
        lastUpdate: new Date().toISOString(),
      },
    ];
    res.json(feeds);
  } catch (error) {
    log.error("FeedsRoutes", "Failed to get feed sources", { error: error });
    res.status(500).json({ error: "Failed to get feed sources" });
  }
});

export default router;
