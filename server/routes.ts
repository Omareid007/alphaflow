import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertStrategySchema,
  insertTradeSchema,
  insertPositionSchema,
  insertAiDecisionSchema,
} from "@shared/schema";
import { coingecko } from "./connectors/coingecko";
import { finnhub } from "./connectors/finnhub";
import { aiDecisionEngine, type MarketData, type NewsContext, type StrategyContext } from "./ai/decision-engine";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

const sessions = new Map<string, { userId: string; expiresAt: Date }>();

const isProduction = process.env.NODE_ENV === "production";

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" as const : "lax" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.cookies?.session;
  
  if (!sessionId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < new Date()) {
    sessions.delete(sessionId);
    return res.status(401).json({ error: "Session expired" });
  }

  req.userId = session.userId;
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input: username and password required" });
      }

      const { username, password } = parsed.data;

      if (username.length < 3) {
        return res.status(400).json({ error: "Username must be at least 3 characters" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already taken" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, password: hashedPassword });

      const sessionId = generateSessionId();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      sessions.set(sessionId, { userId: user.id, expiresAt });

      res.cookie("session", sessionId, getCookieOptions());

      res.status(201).json({ id: user.id, username: user.username });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const sessionId = generateSessionId();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      sessions.set(sessionId, { userId: user.id, expiresAt });

      res.cookie("session", sessionId, getCookieOptions());

      res.json({ id: user.id, username: user.username });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const sessionId = req.cookies?.session;
      if (sessionId) {
        sessions.delete(sessionId);
      }

      const { maxAge, ...clearOptions } = getCookieOptions();
      res.clearCookie("session", clearOptions);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const sessionId = req.cookies?.session;
      
      if (!sessionId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const session = sessions.get(sessionId);
      if (!session || session.expiresAt < new Date()) {
        sessions.delete(sessionId);
        return res.status(401).json({ error: "Session expired" });
      }

      const user = await storage.getUser(session.userId);
      if (!user) {
        sessions.delete(sessionId);
        return res.status(401).json({ error: "User not found" });
      }

      res.json({ id: user.id, username: user.username });
    } catch (error) {
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.get("/api/agent/status", async (req, res) => {
    try {
      const status = await storage.getAgentStatus();
      if (!status) {
        const defaultStatus = await storage.updateAgentStatus({
          isRunning: false,
          totalTrades: 0,
          totalPnl: "0",
        });
        return res.json(defaultStatus);
      }
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get agent status" });
    }
  });

  app.post("/api/agent/toggle", async (req, res) => {
    try {
      const currentStatus = await storage.getAgentStatus();
      const newIsRunning = !(currentStatus?.isRunning ?? false);
      const status = await storage.updateAgentStatus({
        isRunning: newIsRunning,
        lastHeartbeat: new Date(),
      });
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle agent" });
    }
  });

  app.get("/api/strategies", async (req, res) => {
    try {
      const strategies = await storage.getStrategies();
      res.json(strategies);
    } catch (error) {
      res.status(500).json({ error: "Failed to get strategies" });
    }
  });

  app.get("/api/strategies/:id", async (req, res) => {
    try {
      const strategy = await storage.getStrategy(req.params.id);
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      res.json(strategy);
    } catch (error) {
      res.status(500).json({ error: "Failed to get strategy" });
    }
  });

  app.post("/api/strategies", async (req, res) => {
    try {
      const parsed = insertStrategySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const strategy = await storage.createStrategy(parsed.data);
      res.status(201).json(strategy);
    } catch (error) {
      res.status(500).json({ error: "Failed to create strategy" });
    }
  });

  app.patch("/api/strategies/:id", async (req, res) => {
    try {
      const strategy = await storage.updateStrategy(req.params.id, req.body);
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      res.json(strategy);
    } catch (error) {
      res.status(500).json({ error: "Failed to update strategy" });
    }
  });

  app.post("/api/strategies/:id/toggle", async (req, res) => {
    try {
      const currentStrategy = await storage.getStrategy(req.params.id);
      if (!currentStrategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      const strategy = await storage.toggleStrategy(req.params.id, !currentStrategy.isActive);
      res.json(strategy);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle strategy" });
    }
  });

  app.get("/api/trades", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const trades = await storage.getTrades(limit);
      res.json(trades);
    } catch (error) {
      res.status(500).json({ error: "Failed to get trades" });
    }
  });

  app.get("/api/trades/:id", async (req, res) => {
    try {
      const trade = await storage.getTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      res.json(trade);
    } catch (error) {
      res.status(500).json({ error: "Failed to get trade" });
    }
  });

  app.post("/api/trades", async (req, res) => {
    try {
      const parsed = insertTradeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const trade = await storage.createTrade(parsed.data);
      res.status(201).json(trade);
    } catch (error) {
      res.status(500).json({ error: "Failed to create trade" });
    }
  });

  app.get("/api/positions", async (req, res) => {
    try {
      const positions = await storage.getPositions();
      res.json(positions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get positions" });
    }
  });

  app.get("/api/positions/:id", async (req, res) => {
    try {
      const position = await storage.getPosition(req.params.id);
      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }
      res.json(position);
    } catch (error) {
      res.status(500).json({ error: "Failed to get position" });
    }
  });

  app.post("/api/positions", async (req, res) => {
    try {
      const parsed = insertPositionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const position = await storage.createPosition(parsed.data);
      res.status(201).json(position);
    } catch (error) {
      res.status(500).json({ error: "Failed to create position" });
    }
  });

  app.patch("/api/positions/:id", async (req, res) => {
    try {
      const position = await storage.updatePosition(req.params.id, req.body);
      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }
      res.json(position);
    } catch (error) {
      res.status(500).json({ error: "Failed to update position" });
    }
  });

  app.delete("/api/positions/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePosition(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Position not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete position" });
    }
  });

  app.get("/api/ai-decisions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const decisions = await storage.getAiDecisions(limit);
      res.json(decisions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get AI decisions" });
    }
  });

  app.post("/api/ai-decisions", async (req, res) => {
    try {
      const parsed = insertAiDecisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const decision = await storage.createAiDecision(parsed.data);
      res.status(201).json(decision);
    } catch (error) {
      res.status(500).json({ error: "Failed to create AI decision" });
    }
  });

  app.get("/api/analytics/summary", async (req, res) => {
    try {
      const trades = await storage.getTrades(1000);
      const positions = await storage.getPositions();
      const status = await storage.getAgentStatus();

      const winningTrades = trades.filter(t => parseFloat(t.pnl || "0") > 0);
      const totalPnl = trades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0);
      const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
      const unrealizedPnl = positions.reduce((sum, p) => sum + parseFloat(p.unrealizedPnl || "0"), 0);

      res.json({
        totalTrades: trades.length,
        totalPnl: totalPnl.toFixed(2),
        winRate: winRate.toFixed(1),
        winningTrades: winningTrades.length,
        losingTrades: trades.length - winningTrades.length,
        openPositions: positions.length,
        unrealizedPnl: unrealizedPnl.toFixed(2),
        isAgentRunning: status?.isRunning ?? false,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get analytics summary" });
    }
  });

  app.get("/api/crypto/markets", async (req, res) => {
    try {
      const perPage = parseInt(req.query.per_page as string) || 20;
      const page = parseInt(req.query.page as string) || 1;
      const order = (req.query.order as string) || "market_cap_desc";
      const markets = await coingecko.getMarkets("usd", perPage, page, order);
      res.json(markets);
    } catch (error) {
      console.error("Failed to fetch crypto markets:", error);
      res.status(500).json({ error: "Failed to fetch crypto market data" });
    }
  });

  app.get("/api/crypto/prices", async (req, res) => {
    try {
      const ids = (req.query.ids as string) || "bitcoin,ethereum,solana";
      const coinIds = ids.split(",").map(id => id.trim());
      const prices = await coingecko.getSimplePrice(coinIds);
      res.json(prices);
    } catch (error) {
      console.error("Failed to fetch crypto prices:", error);
      res.status(500).json({ error: "Failed to fetch crypto prices" });
    }
  });

  app.get("/api/crypto/chart/:coinId", async (req, res) => {
    try {
      const { coinId } = req.params;
      const days = (req.query.days as string) || "7";
      const chart = await coingecko.getMarketChart(coinId, "usd", days);
      res.json(chart);
    } catch (error) {
      console.error("Failed to fetch crypto chart:", error);
      res.status(500).json({ error: "Failed to fetch crypto chart data" });
    }
  });

  app.get("/api/crypto/trending", async (req, res) => {
    try {
      const trending = await coingecko.getTrending();
      res.json(trending);
    } catch (error) {
      console.error("Failed to fetch trending coins:", error);
      res.status(500).json({ error: "Failed to fetch trending coins" });
    }
  });

  app.get("/api/crypto/global", async (req, res) => {
    try {
      const global = await coingecko.getGlobalData();
      res.json(global);
    } catch (error) {
      console.error("Failed to fetch global market data:", error);
      res.status(500).json({ error: "Failed to fetch global market data" });
    }
  });

  app.get("/api/crypto/search", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      if (!query) {
        return res.status(400).json({ error: "Search query required" });
      }
      const results = await coingecko.searchCoins(query);
      res.json(results);
    } catch (error) {
      console.error("Failed to search coins:", error);
      res.status(500).json({ error: "Failed to search coins" });
    }
  });

  app.get("/api/stock/quote/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const quote = await finnhub.getQuote(symbol);
      res.json(quote);
    } catch (error) {
      console.error("Failed to fetch stock quote:", error);
      res.status(500).json({ error: "Failed to fetch stock quote" });
    }
  });

  app.get("/api/stock/quotes", async (req, res) => {
    try {
      const symbols = (req.query.symbols as string) || "AAPL,GOOGL,MSFT,AMZN,TSLA";
      const symbolList = symbols.split(",").map(s => s.trim().toUpperCase());
      const quotes = await finnhub.getMultipleQuotes(symbolList);
      const result: Record<string, unknown> = {};
      quotes.forEach((quote, symbol) => {
        result[symbol] = quote;
      });
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch stock quotes:", error);
      res.status(500).json({ error: "Failed to fetch stock quotes" });
    }
  });

  app.get("/api/stock/candles/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const resolution = (req.query.resolution as string) || "D";
      const from = req.query.from ? parseInt(req.query.from as string) : undefined;
      const to = req.query.to ? parseInt(req.query.to as string) : undefined;
      const candles = await finnhub.getCandles(symbol, resolution, from, to);
      res.json(candles);
    } catch (error) {
      console.error("Failed to fetch stock candles:", error);
      res.status(500).json({ error: "Failed to fetch stock candles" });
    }
  });

  app.get("/api/stock/profile/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const profile = await finnhub.getCompanyProfile(symbol);
      res.json(profile);
    } catch (error) {
      console.error("Failed to fetch company profile:", error);
      res.status(500).json({ error: "Failed to fetch company profile" });
    }
  });

  app.get("/api/stock/search", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      if (!query) {
        return res.status(400).json({ error: "Search query required" });
      }
      const results = await finnhub.searchSymbols(query);
      res.json(results);
    } catch (error) {
      console.error("Failed to search stocks:", error);
      res.status(500).json({ error: "Failed to search stocks" });
    }
  });

  app.get("/api/stock/news", async (req, res) => {
    try {
      const category = (req.query.category as string) || "general";
      const news = await finnhub.getMarketNews(category);
      res.json(news);
    } catch (error) {
      console.error("Failed to fetch market news:", error);
      res.status(500).json({ error: "Failed to fetch market news" });
    }
  });

  app.post("/api/ai/analyze", async (req, res) => {
    try {
      const { symbol, marketData, newsContext, strategyId } = req.body;

      if (!symbol || !marketData) {
        return res.status(400).json({ error: "Symbol and market data are required" });
      }

      let strategy: StrategyContext | undefined;
      if (strategyId) {
        const dbStrategy = await storage.getStrategy(strategyId);
        if (dbStrategy) {
          strategy = {
            id: dbStrategy.id,
            name: dbStrategy.name,
            type: dbStrategy.type,
            parameters: dbStrategy.parameters ? JSON.parse(dbStrategy.parameters) : undefined,
          };
        }
      }

      const decision = await aiDecisionEngine.analyzeOpportunity(
        symbol,
        marketData as MarketData,
        newsContext as NewsContext | undefined,
        strategy
      );

      const aiDecisionRecord = await storage.createAiDecision({
        strategyId: strategyId || null,
        symbol,
        action: decision.action,
        confidence: decision.confidence.toString(),
        reasoning: decision.reasoning,
        marketContext: JSON.stringify({
          marketData,
          newsContext,
          riskLevel: decision.riskLevel,
          suggestedQuantity: decision.suggestedQuantity,
          targetPrice: decision.targetPrice,
          stopLoss: decision.stopLoss,
        }),
      });

      res.json({
        id: aiDecisionRecord.id,
        ...decision,
        createdAt: aiDecisionRecord.createdAt,
      });
    } catch (error) {
      console.error("AI analysis error:", error);
      res.status(500).json({ error: "Failed to analyze trading opportunity" });
    }
  });

  app.get("/api/ai/status", async (req, res) => {
    try {
      const status = aiDecisionEngine.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get AI status" });
    }
  });

  app.get("/api/connectors/status", async (req, res) => {
    try {
      const cryptoStatus = coingecko.getConnectionStatus();
      const stockStatus = finnhub.getConnectionStatus();
      const aiStatus = aiDecisionEngine.getStatus();
      res.json({
        crypto: {
          provider: "CoinGecko",
          ...cryptoStatus,
          lastChecked: new Date().toISOString(),
        },
        stock: {
          provider: "Finnhub",
          ...stockStatus,
          lastChecked: new Date().toISOString(),
        },
        ai: {
          ...aiStatus,
          lastChecked: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get connector status" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
