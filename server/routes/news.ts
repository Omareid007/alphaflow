import { Router, Request, Response } from "express";
import { log } from "../utils/logger";
import { badRequest, serverError } from "../lib/standard-errors";
import { newsapi } from "../connectors/newsapi";

const router = Router();

// NEWS ENDPOINTS
// ==============

// Get top news headlines by category and country
router.get("/headlines", async (req: Request, res: Response) => {
  try {
    const category = (req.query.category as "business" | "technology" | "general") || "business";
    const country = (req.query.country as string) || "us";
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const headlines = await newsapi.getTopHeadlines(category, country, pageSize);
    res.json(headlines);
  } catch (error) {
    log.error("Routes", "Failed to get news headlines", { error: error });
    res.status(500).json({ error: "Failed to get news headlines" });
  }
});

// Search news articles by query
router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return badRequest(res, "Search query required");
    }
    const sortBy = (req.query.sortBy as "relevancy" | "popularity" | "publishedAt") || "publishedAt";
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const articles = await newsapi.searchNews(query, sortBy, pageSize);
    res.json(articles);
  } catch (error) {
    log.error("Routes", "Failed to search news", { error: error });
    res.status(500).json({ error: "Failed to search news" });
  }
});

// Get market-related news
router.get("/market", async (req: Request, res: Response) => {
  try {
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const articles = await newsapi.getMarketNews(pageSize);
    res.json(articles);
  } catch (error) {
    log.error("Routes", "Failed to get market news", { error: error });
    res.status(500).json({ error: "Failed to get market news" });
  }
});

// Get cryptocurrency-related news
router.get("/crypto", async (req: Request, res: Response) => {
  try {
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const articles = await newsapi.getCryptoNews(pageSize);
    res.json(articles);
  } catch (error) {
    log.error("Routes", "Failed to get crypto news", { error: error });
    res.status(500).json({ error: "Failed to get crypto news" });
  }
});

// Get news for a specific stock symbol
router.get("/stock/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const articles = await newsapi.getStockNews(symbol, pageSize);
    res.json(articles);
  } catch (error) {
    log.error("Routes", "Failed to get stock news", { error: error });
    res.status(500).json({ error: "Failed to get stock news" });
  }
});

export default router;
