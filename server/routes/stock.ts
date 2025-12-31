/**
 * Stock Market Data Routes
 * Handles stock quotes, charts, and company info from Finnhub
 */

import { Router, Request, Response } from "express";
import { finnhub } from "../connectors/finnhub";
import { log } from "../utils/logger";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

// GET /api/stock/quote/:symbol - Get stock quote
router.get("/quote/:symbol", requireAuth, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const quote = await finnhub.getQuote(symbol);
    res.json(quote);
  } catch (error) {
    log.error("StockAPI", "Failed to get stock quote", { error });
    res.status(500).json({ error: "Failed to fetch stock quote" });
  }
});

// GET /api/stock/quotes - Get multiple stock quotes
router.get("/quotes", requireAuth, async (req: Request, res: Response) => {
  try {
    const symbols =
      (req.query.symbols as string) || "AAPL,GOOGL,MSFT,AMZN,TSLA";
    const symbolList = symbols.split(",").map((s) => s.trim().toUpperCase());
    const quotes = await finnhub.getMultipleQuotes(symbolList);
    const result: Record<string, unknown> = {};
    quotes.forEach((quote, symbol) => {
      result[symbol] = quote;
    });
    res.json(result);
  } catch (error) {
    log.error("StockAPI", "Failed to get stock quotes", { error });
    res.status(500).json({ error: "Failed to fetch stock quotes" });
  }
});

// GET /api/stock/candles/:symbol - Get stock candles/chart data
router.get("/candles/:symbol", requireAuth, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const resolution = (req.query.resolution as string) || "D";
    const from = req.query.from
      ? parseInt(req.query.from as string)
      : undefined;
    const to = req.query.to ? parseInt(req.query.to as string) : undefined;
    const candles = await finnhub.getCandles(symbol, resolution, from, to);
    res.json(candles);
  } catch (error) {
    log.error("StockAPI", "Failed to get stock candles", { error });
    res.status(500).json({ error: "Failed to fetch stock candles" });
  }
});

// GET /api/stock/profile/:symbol - Get company profile
router.get("/profile/:symbol", requireAuth, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const profile = await finnhub.getCompanyProfile(symbol);
    res.json(profile);
  } catch (error) {
    log.error("StockAPI", "Failed to get company profile", { error });
    res.status(500).json({ error: "Failed to fetch company profile" });
  }
});

// GET /api/stock/search - Search for stocks
router.get("/search", requireAuth, async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || "";
    if (!query) {
      return res.status(400).json({ error: "Search query required" });
    }
    const results = await finnhub.searchSymbols(query);
    res.json(results);
  } catch (error) {
    log.error("StockAPI", "Failed to search stocks", { error });
    res.status(500).json({ error: "Failed to search stocks" });
  }
});

// GET /api/stock/news - Get market news
router.get("/news", requireAuth, async (req: Request, res: Response) => {
  try {
    const category = (req.query.category as string) || "general";
    const news = await finnhub.getMarketNews(category);
    res.json(news);
  } catch (error) {
    log.error("StockAPI", "Failed to get stock news", { error });
    res.status(500).json({ error: "Failed to fetch market news" });
  }
});

export default router;
