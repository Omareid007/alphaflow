import { Router, Request, Response } from "express";
import { log } from "../utils/logger";
import { badRequest, serverError } from "../lib/standard-errors";
import { coingecko } from "../connectors/coingecko";
import { finnhub } from "../connectors/finnhub";
import { alpaca } from "../connectors/alpaca";
import { newsapi } from "../connectors/newsapi";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

// CRYPTO ENDPOINTS
// ================

// Get cryptocurrency markets with pagination and sorting
router.get(
  "/crypto/markets",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const perPage = parseInt(req.query.per_page as string) || 20;
      const page = parseInt(req.query.page as string) || 1;
      const order = (req.query.order as string) || "market_cap_desc";
      const markets = await coingecko.getMarkets("usd", perPage, page, order);
      res.json(markets);
    } catch (error) {
      log.error("MarketDataAPI", `Failed to fetch crypto markets: ${error}`);
      return serverError(res, "Failed to fetch crypto market data");
    }
  }
);

// Get cryptocurrency prices for multiple coins
router.get(
  "/crypto/prices",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const ids = (req.query.ids as string) || "bitcoin,ethereum,solana";
      const coinIds = ids.split(",").map((id) => id.trim());
      const prices = await coingecko.getSimplePrice(coinIds);
      res.json(prices);
    } catch (error) {
      log.error("MarketDataAPI", `Failed to fetch crypto prices: ${error}`);
      return serverError(res, "Failed to fetch crypto prices");
    }
  }
);

// Get cryptocurrency chart data
router.get(
  "/crypto/chart/:coinId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { coinId } = req.params;
      const days = (req.query.days as string) || "7";
      const chart = await coingecko.getMarketChart(coinId, "usd", days);
      res.json(chart);
    } catch (error) {
      log.error("MarketDataAPI", `Failed to fetch crypto chart: ${error}`);
      return serverError(res, "Failed to fetch crypto chart data");
    }
  }
);

// Get trending cryptocurrencies
router.get(
  "/crypto/trending",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const trending = await coingecko.getTrending();
      res.json(trending);
    } catch (error) {
      log.error("MarketDataAPI", `Failed to fetch trending coins: ${error}`);
      return serverError(res, "Failed to fetch trending coins");
    }
  }
);

// Get global cryptocurrency market data
router.get(
  "/crypto/global",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const global = await coingecko.getGlobalData();
      res.json(global);
    } catch (error) {
      log.error(
        "MarketDataAPI",
        `Failed to fetch global market data: ${error}`
      );
      return serverError(res, "Failed to fetch global market data");
    }
  }
);

// Search cryptocurrencies by query
router.get(
  "/crypto/search",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || "";
      if (!query) {
        return badRequest(res, "Search query required");
      }
      const results = await coingecko.searchCoins(query);
      res.json(results);
    } catch (error) {
      log.error("MarketDataAPI", `Failed to search coins: ${error}`);
      return serverError(res, "Failed to search coins");
    }
  }
);

// STOCK ENDPOINTS
// ===============

// Get stock quote for a single symbol
router.get(
  "/stock/quote/:symbol",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const quote = await finnhub.getQuote(symbol);
      res.json(quote);
    } catch (error) {
      log.error("MarketDataAPI", `Failed to fetch stock quote: ${error}`);
      return serverError(res, "Failed to fetch stock quote");
    }
  }
);

// Get stock quotes for multiple symbols
router.get(
  "/stock/quotes",
  requireAuth,
  async (req: Request, res: Response) => {
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
      log.error("MarketDataAPI", `Failed to fetch stock quotes: ${error}`);
      return serverError(res, "Failed to fetch stock quotes");
    }
  }
);

// Get OHLC candles for a stock
router.get(
  "/stock/candles/:symbol",
  requireAuth,
  async (req: Request, res: Response) => {
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
      log.error("MarketDataAPI", `Failed to fetch stock candles: ${error}`);
      return serverError(res, "Failed to fetch stock candles");
    }
  }
);

// Get company profile for a stock
router.get(
  "/stock/profile/:symbol",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const profile = await finnhub.getCompanyProfile(symbol);
      res.json(profile);
    } catch (error) {
      log.error("MarketDataAPI", `Failed to fetch company profile: ${error}`);
      return serverError(res, "Failed to fetch company profile");
    }
  }
);

// Search for stocks by query
router.get(
  "/stock/search",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || "";
      if (!query) {
        return badRequest(res, "Search query required");
      }
      const results = await finnhub.searchSymbols(query);
      res.json(results);
    } catch (error) {
      log.error("MarketDataAPI", `Failed to search stocks: ${error}`);
      return serverError(res, "Failed to search stocks");
    }
  }
);

// Get market news for a category
router.get("/stock/news", requireAuth, async (req: Request, res: Response) => {
  try {
    const category = (req.query.category as string) || "general";
    const news = await finnhub.getMarketNews(category);
    res.json(news);
  } catch (error) {
    log.error("MarketDataAPI", `Failed to fetch market news: ${error}`);
    return serverError(res, "Failed to fetch market news");
  }
});

// MARKET ENDPOINTS
// ================

// Get real-time market quotes for multiple symbols (requires authentication)
router.get(
  "/market/quotes",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const symbolsParam = req.query.symbols as string;
      if (!symbolsParam) {
        return badRequest(res, "symbols parameter required");
      }
      const symbols = symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase());
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
      log.error("MarketDataAPI", `Failed to get market quotes: ${error}`);
      return serverError(res, "Failed to get market quotes");
    }
  }
);

// NEWS ENDPOINTS
// ==============

// Get top news headlines by category and country
router.get(
  "/news/headlines",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const category =
        (req.query.category as "business" | "technology" | "general") ||
        "business";
      const country = (req.query.country as string) || "us";
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const headlines = await newsapi.getTopHeadlines(
        category,
        country,
        pageSize
      );
      res.json(headlines);
    } catch (error) {
      log.error("MarketDataAPI", `Failed to get news headlines: ${error}`);
      return serverError(res, "Failed to get news headlines");
    }
  }
);

// Search news articles by query
router.get("/news/search", requireAuth, async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return badRequest(res, "Search query required");
    }
    const sortBy =
      (req.query.sortBy as "relevancy" | "popularity" | "publishedAt") ||
      "publishedAt";
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const articles = await newsapi.searchNews(query, sortBy, pageSize);
    res.json(articles);
  } catch (error) {
    log.error("MarketDataAPI", `Failed to search news: ${error}`);
    return serverError(res, "Failed to search news");
  }
});

// Get market-related news
router.get("/news/market", requireAuth, async (req: Request, res: Response) => {
  try {
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const articles = await newsapi.getMarketNews(pageSize);
    res.json(articles);
  } catch (error) {
    log.error("MarketDataAPI", `Failed to get market news: ${error}`);
    return serverError(res, "Failed to get market news");
  }
});

// Get cryptocurrency-related news
router.get("/news/crypto", requireAuth, async (req: Request, res: Response) => {
  try {
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const articles = await newsapi.getCryptoNews(pageSize);
    res.json(articles);
  } catch (error) {
    log.error("MarketDataAPI", `Failed to get crypto news: ${error}`);
    return serverError(res, "Failed to get crypto news");
  }
});

// Get news for a specific stock symbol
router.get(
  "/news/stock/:symbol",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const articles = await newsapi.getStockNews(symbol, pageSize);
      res.json(articles);
    } catch (error) {
      log.error("MarketDataAPI", `Failed to get stock news: ${error}`);
      return serverError(res, "Failed to get stock news");
    }
  }
);

export default router;
