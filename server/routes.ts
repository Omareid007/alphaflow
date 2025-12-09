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
import { alpaca } from "./connectors/alpaca";
import { coinmarketcap } from "./connectors/coinmarketcap";
import { newsapi } from "./connectors/newsapi";
import { uaeMarkets } from "./connectors/uae-markets";
import { aiDecisionEngine, type MarketData, type NewsContext, type StrategyContext } from "./ai/decision-engine";
import { dataFusionEngine } from "./fusion/data-fusion-engine";
import { paperTradingEngine } from "./trading/paper-trading-engine";
import { alpacaTradingEngine } from "./trading/alpaca-trading-engine";
import { orchestrator } from "./autonomous/orchestrator";
import { eventBus, logger, coordinator } from "./orchestration";
import { safeParseFloat } from "./utils/numeric";

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
  alpacaTradingEngine.initialize().catch(err => 
    console.error("Failed to initialize Alpaca trading engine:", err)
  );

  // Bootstrap admin user "Omar" with password "test1234"
  try {
    const adminUser = await storage.getUserByUsername("Omar");
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash("test1234", 10);
      await storage.createUser({ username: "Omar", password: hashedPassword });
      console.log("[Bootstrap] Created admin user: Omar");
    } else {
      console.log("[Bootstrap] Admin user Omar already exists");
    }
  } catch (err) {
    console.error("[Bootstrap] Failed to create admin user:", err);
  }

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
      
      if (newIsRunning) {
        await alpacaTradingEngine.resumeAgent();
      } else {
        await alpacaTradingEngine.stopAllStrategies();
      }
      
      const status = await storage.getAgentStatus();
      res.json(status);
    } catch (error) {
      console.error("Failed to toggle agent:", error);
      res.status(500).json({ error: "Failed to toggle agent" });
    }
  });

  app.get("/api/autonomous/state", async (req, res) => {
    try {
      const state = orchestrator.getState();
      const riskLimits = orchestrator.getRiskLimits();
      res.json({
        ...state,
        riskLimits,
        activePositions: Array.from(state.activePositions.entries()).map(([key, pos]) => ({
          ...pos,
          symbol: key,
        })),
        pendingSignals: Array.from(state.pendingSignals.entries()).map(([symbol, signal]) => ({
          symbol,
          ...signal,
        })),
      });
    } catch (error) {
      console.error("Failed to get autonomous state:", error);
      res.status(500).json({ error: "Failed to get autonomous state" });
    }
  });

  app.post("/api/autonomous/start", async (req, res) => {
    try {
      await orchestrator.start();
      const state = orchestrator.getState();
      res.json({ success: true, mode: state.mode, isRunning: state.isRunning });
    } catch (error) {
      console.error("Failed to start autonomous mode:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/autonomous/stop", async (req, res) => {
    try {
      await orchestrator.stop();
      const state = orchestrator.getState();
      res.json({ success: true, mode: state.mode, isRunning: state.isRunning });
    } catch (error) {
      console.error("Failed to stop autonomous mode:", error);
      res.status(500).json({ error: "Failed to stop autonomous mode" });
    }
  });

  app.post("/api/autonomous/kill-switch", async (req, res) => {
    try {
      const { activate, reason } = req.body;
      if (activate) {
        await orchestrator.activateKillSwitch(reason || "Manual activation");
      } else {
        await orchestrator.deactivateKillSwitch();
      }
      const state = orchestrator.getState();
      res.json({ success: true, killSwitchActive: orchestrator.getRiskLimits().killSwitchActive, state });
    } catch (error) {
      console.error("Failed to toggle kill switch:", error);
      res.status(500).json({ error: "Failed to toggle kill switch" });
    }
  });

  app.put("/api/autonomous/risk-limits", async (req, res) => {
    try {
      const {
        maxPositionSizePercent,
        maxTotalExposurePercent,
        maxPositionsCount,
        dailyLossLimitPercent,
      } = req.body;

      await orchestrator.updateRiskLimits({
        maxPositionSizePercent,
        maxTotalExposurePercent,
        maxPositionsCount,
        dailyLossLimitPercent,
      });

      res.json({ success: true, riskLimits: orchestrator.getRiskLimits() });
    } catch (error) {
      console.error("Failed to update risk limits:", error);
      res.status(500).json({ error: "Failed to update risk limits" });
    }
  });

  app.post("/api/autonomous/mode", async (req, res) => {
    try {
      const { mode } = req.body;
      if (!["autonomous", "semi-auto", "manual"].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Use: autonomous, semi-auto, or manual" });
      }
      await orchestrator.setMode(mode);
      res.json({ success: true, mode: orchestrator.getMode() });
    } catch (error) {
      console.error("Failed to set mode:", error);
      res.status(500).json({ error: "Failed to set mode" });
    }
  });

  app.get("/api/autonomous/execution-history", async (req, res) => {
    try {
      const state = orchestrator.getState();
      res.json(state.executionHistory);
    } catch (error) {
      res.status(500).json({ error: "Failed to get execution history" });
    }
  });

  app.post("/api/autonomous/close-position", async (req, res) => {
    try {
      const { symbol } = req.body;
      if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" });
      }
      
      const result = await alpacaTradingEngine.closeAlpacaPosition(symbol);
      
      if (result.success) {
        res.json({ success: true, message: `Position ${symbol} closed successfully`, result });
      } else {
        res.status(400).json({ success: false, error: result.error || "Failed to close position" });
      }
    } catch (error) {
      console.error("Failed to close position:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/autonomous/execute-trades", async (req, res) => {
    try {
      const { decisionIds } = req.body;
      if (!decisionIds || !Array.isArray(decisionIds) || decisionIds.length === 0) {
        return res.status(400).json({ error: "Decision IDs array is required" });
      }
      
      const results: Array<{ decisionId: string; success: boolean; error?: string; order?: unknown }> = [];
      
      for (const decisionId of decisionIds) {
        const decisions = await storage.getAiDecisions(100);
        const decision = decisions.find(d => d.id === decisionId);
        if (!decision) {
          results.push({ decisionId, success: false, error: "Decision not found" });
          continue;
        }
        
        try {
          const orderResult = await alpacaTradingEngine.executeAlpacaTrade({
            symbol: decision.symbol,
            side: decision.action as "buy" | "sell",
            quantity: 1,
          });
          
          if (orderResult.success) {
            results.push({ decisionId, success: true, order: orderResult.order });
          } else {
            results.push({ decisionId, success: false, error: orderResult.error });
          }
        } catch (err) {
          results.push({ decisionId, success: false, error: String(err) });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      res.json({ 
        success: successCount > 0, 
        message: `Executed ${successCount}/${decisionIds.length} trades`,
        results 
      });
    } catch (error) {
      console.error("Failed to execute trades:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/autonomous/open-orders", async (req, res) => {
    try {
      const orders = await alpacaTradingEngine.getOpenOrders();
      res.json(orders);
    } catch (error) {
      console.error("Failed to get open orders:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/autonomous/cancel-stale-orders", async (req, res) => {
    try {
      const { maxAgeMinutes } = req.body;
      const result = await alpacaTradingEngine.cancelStaleOrders(maxAgeMinutes || 60);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Failed to cancel stale orders:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/autonomous/cancel-all-orders", async (req, res) => {
    try {
      const result = await alpacaTradingEngine.cancelAllOpenOrders();
      res.json({ success: result.cancelled > 0, ...result });
    } catch (error) {
      console.error("Failed to cancel all orders:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/autonomous/reconcile-positions", async (req, res) => {
    try {
      const result = await alpacaTradingEngine.reconcilePositions();
      res.json(result);
    } catch (error) {
      console.error("Failed to reconcile positions:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/autonomous/sync-positions", async (req, res) => {
    try {
      const result = await alpacaTradingEngine.syncPositionsFromAlpaca();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Failed to sync positions:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/autonomous/close-all-positions", async (req, res) => {
    try {
      const result = await alpacaTradingEngine.closeAllPositions();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Failed to close all positions:", error);
      res.status(500).json({ error: String(error) });
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

  app.post("/api/strategies/:id/start", async (req, res) => {
    try {
      const strategy = await storage.getStrategy(req.params.id);
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      
      const result = await alpacaTradingEngine.startStrategy(req.params.id);
      if (!result.success) {
        return res.status(400).json({ error: result.error || "Failed to start strategy" });
      }
      
      const updatedStrategy = await storage.getStrategy(req.params.id);
      res.json(updatedStrategy);
    } catch (error) {
      console.error("Failed to start strategy:", error);
      res.status(500).json({ error: "Failed to start strategy" });
    }
  });

  app.post("/api/strategies/:id/stop", async (req, res) => {
    try {
      const strategy = await storage.getStrategy(req.params.id);
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      
      const result = await alpacaTradingEngine.stopStrategy(req.params.id);
      if (!result.success) {
        return res.status(400).json({ error: result.error || "Failed to stop strategy" });
      }
      
      const updatedStrategy = await storage.getStrategy(req.params.id);
      res.json(updatedStrategy);
    } catch (error) {
      console.error("Failed to stop strategy:", error);
      res.status(500).json({ error: "Failed to stop strategy" });
    }
  });

  app.get("/api/strategies/moving-average/schema", async (req, res) => {
    try {
      const { STRATEGY_SCHEMA } = await import("./strategies/moving-average-crossover");
      res.json(STRATEGY_SCHEMA);
    } catch (error) {
      console.error("Failed to get MA strategy schema:", error);
      res.status(500).json({ error: "Failed to get strategy schema" });
    }
  });

  app.post("/api/strategies/moving-average/backtest", async (req, res) => {
    try {
      const { normalizeMovingAverageConfig, backtestMovingAverageStrategy } = await import("./strategies/moving-average-crossover");
      const config = normalizeMovingAverageConfig(req.body);
      const lookbackDays = parseInt(req.query.lookbackDays as string) || 365;
      const result = await backtestMovingAverageStrategy(config, lookbackDays);
      res.json(result);
    } catch (error) {
      console.error("Failed to run MA backtest:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to run backtest" });
    }
  });

  app.post("/api/strategies/moving-average/ai-validate", async (req, res) => {
    try {
      const { normalizeMovingAverageConfig } = await import("./strategies/moving-average-crossover");
      const { validateMovingAverageConfig, getValidatorStatus } = await import("./ai/ai-strategy-validator");
      
      const status = getValidatorStatus();
      if (!status.available) {
        return res.status(503).json({ error: "AI validation service is not available" });
      }
      
      const config = normalizeMovingAverageConfig(req.body.config || req.body);
      const marketIntelligence = req.body.marketIntelligence;
      const result = await validateMovingAverageConfig(config, marketIntelligence);
      res.json(result);
    } catch (error) {
      console.error("Failed to AI validate strategy:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to validate strategy" });
    }
  });

  app.get("/api/strategies/mean-reversion/schema", async (req, res) => {
    try {
      const { STRATEGY_SCHEMA } = await import("./strategies/mean-reversion-scalper");
      res.json(STRATEGY_SCHEMA);
    } catch (error) {
      console.error("Failed to get mean reversion strategy schema:", error);
      res.status(500).json({ error: "Failed to get strategy schema" });
    }
  });

  app.post("/api/strategies/mean-reversion/backtest", async (req, res) => {
    try {
      const { normalizeMeanReversionConfig, backtestMeanReversionStrategy } = await import("./strategies/mean-reversion-scalper");
      const config = normalizeMeanReversionConfig(req.body);
      const lookbackDays = parseInt(req.query.lookbackDays as string) || 365;
      const result = await backtestMeanReversionStrategy(config, lookbackDays);
      res.json(result);
    } catch (error) {
      console.error("Failed to run mean reversion backtest:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to run backtest" });
    }
  });

  app.post("/api/strategies/mean-reversion/signal", async (req, res) => {
    try {
      const { normalizeMeanReversionConfig, generateMeanReversionSignal } = await import("./strategies/mean-reversion-scalper");
      const config = normalizeMeanReversionConfig(req.body.config || req.body);
      const prices = req.body.prices as number[];
      
      if (!prices || !Array.isArray(prices) || prices.length < config.lookbackPeriod) {
        return res.status(400).json({ error: `Need at least ${config.lookbackPeriod} price points` });
      }
      
      const signal = generateMeanReversionSignal(prices, config);
      res.json(signal);
    } catch (error) {
      console.error("Failed to generate mean reversion signal:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to generate signal" });
    }
  });

  app.get("/api/strategies/momentum/schema", async (req, res) => {
    try {
      const { STRATEGY_SCHEMA } = await import("./strategies/momentum-strategy");
      res.json(STRATEGY_SCHEMA);
    } catch (error) {
      console.error("Failed to get momentum strategy schema:", error);
      res.status(500).json({ error: "Failed to get strategy schema" });
    }
  });

  app.post("/api/strategies/momentum/backtest", async (req, res) => {
    try {
      const { normalizeMomentumConfig, backtestMomentumStrategy } = await import("./strategies/momentum-strategy");
      const config = normalizeMomentumConfig(req.body);
      const lookbackDays = parseInt(req.query.lookbackDays as string) || 365;
      const result = await backtestMomentumStrategy(config, lookbackDays);
      res.json(result);
    } catch (error) {
      console.error("Failed to run momentum backtest:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to run backtest" });
    }
  });

  app.post("/api/strategies/momentum/signal", async (req, res) => {
    try {
      const { normalizeMomentumConfig, generateMomentumSignal } = await import("./strategies/momentum-strategy");
      const config = normalizeMomentumConfig(req.body.config || req.body);
      const prices = req.body.prices as number[];
      
      const requiredLength = Math.max(config.lookbackPeriod, config.rsiPeriod) + 1;
      if (!prices || !Array.isArray(prices) || prices.length < requiredLength) {
        return res.status(400).json({ error: `Need at least ${requiredLength} price points` });
      }
      
      const signal = generateMomentumSignal(prices, config);
      res.json(signal);
    } catch (error) {
      console.error("Failed to generate momentum signal:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to generate signal" });
    }
  });

  app.get("/api/strategies/all-schemas", async (req, res) => {
    try {
      const { ALL_STRATEGIES } = await import("./strategies/index");
      res.json(ALL_STRATEGIES);
    } catch (error) {
      console.error("Failed to get all strategy schemas:", error);
      res.status(500).json({ error: "Failed to get strategy schemas" });
    }
  });

  app.post("/api/strategy-config", async (req, res) => {
    try {
      const { normalizeMovingAverageConfig } = await import("./strategies/moving-average-crossover");
      const config = normalizeMovingAverageConfig(req.body);
      res.json(config);
    } catch (error) {
      console.error("Failed to normalize strategy config:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to normalize config" });
    }
  });

  app.post("/api/strategy-validate", async (req, res) => {
    try {
      const { normalizeMovingAverageConfig } = await import("./strategies/moving-average-crossover");
      const { validateMovingAverageConfig, getValidatorStatus } = await import("./ai/ai-strategy-validator");
      
      const status = getValidatorStatus();
      if (!status.available) {
        return res.status(503).json({ error: "AI validation service is not available" });
      }
      
      const config = normalizeMovingAverageConfig(req.body.config || req.body);
      const result = await validateMovingAverageConfig(config);
      res.json(result);
    } catch (error) {
      console.error("Failed to validate strategy:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to validate strategy" });
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

  app.get("/api/trades/enriched", async (req, res) => {
    try {
      const filters = {
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0,
        symbol: req.query.symbol as string | undefined,
        strategyId: req.query.strategyId as string | undefined,
        pnlDirection: (req.query.pnlDirection as 'profit' | 'loss' | 'all') || 'all',
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };
      
      const result = await storage.getTradesFiltered(filters);
      res.json(result);
    } catch (error) {
      console.error("Failed to get enriched trades:", error);
      res.status(500).json({ error: "Failed to get enriched trades" });
    }
  });

  app.get("/api/trades/symbols", async (req, res) => {
    try {
      const symbols = await storage.getDistinctSymbols();
      res.json(symbols);
    } catch (error) {
      res.status(500).json({ error: "Failed to get symbols" });
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

  app.get("/api/trades/:id/enriched", async (req, res) => {
    try {
      const trade = await storage.getEnrichedTrade(req.params.id);
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      res.json(trade);
    } catch (error) {
      res.status(500).json({ error: "Failed to get enriched trade" });
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
      const status = await storage.getAgentStatus();
      
      const orchestratorState = orchestrator.getState();
      
      let alpacaPositions: any[] = [];
      let unrealizedPnl = 0;
      try {
        alpacaPositions = await alpaca.getPositions();
        unrealizedPnl = alpacaPositions.reduce((sum, p) => sum + safeParseFloat(p.unrealized_pl, 0), 0);
      } catch (e) {
        console.error("Failed to fetch Alpaca positions for analytics:", e);
      }

      const winningTrades = trades.filter(t => safeParseFloat(t.pnl, 0) > 0);
      const totalPnl = trades.reduce((sum, t) => sum + safeParseFloat(t.pnl, 0), 0);
      const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

      res.json({
        totalTrades: trades.length,
        totalPnl: totalPnl.toFixed(2),
        winRate: winRate.toFixed(1),
        winningTrades: winningTrades.length,
        losingTrades: trades.length - winningTrades.length,
        openPositions: alpacaPositions.length,
        unrealizedPnl: unrealizedPnl.toFixed(2),
        isAgentRunning: orchestratorState.isRunning,
        dailyPnl: orchestratorState.dailyPnl.toFixed(2),
        dailyTradeCount: orchestratorState.dailyTradeCount,
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

  app.get("/api/uae/stocks", async (req, res) => {
    try {
      const exchange = req.query.exchange as "ADX" | "DFM" | undefined;
      const stocks = await uaeMarkets.getTopStocks(exchange);
      res.json(stocks);
    } catch (error) {
      console.error("Failed to fetch UAE stocks:", error);
      res.status(500).json({ error: "Failed to fetch UAE stocks" });
    }
  });

  app.get("/api/uae/summary", async (req, res) => {
    try {
      const exchange = req.query.exchange as "ADX" | "DFM" | undefined;
      const summary = await uaeMarkets.getMarketSummary(exchange);
      res.json(summary);
    } catch (error) {
      console.error("Failed to fetch UAE market summary:", error);
      res.status(500).json({ error: "Failed to fetch UAE market summary" });
    }
  });

  app.get("/api/uae/info", async (req, res) => {
    try {
      const info = uaeMarkets.getMarketInfo();
      res.json(info);
    } catch (error) {
      console.error("Failed to fetch UAE market info:", error);
      res.status(500).json({ error: "Failed to fetch UAE market info" });
    }
  });

  app.get("/api/uae/status", async (req, res) => {
    try {
      const status = uaeMarkets.getConnectionStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get UAE connector status" });
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
      const fusionStatus = dataFusionEngine.getStatus();
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
        fusion: {
          provider: "Data Fusion Engine",
          ...fusionStatus,
          lastChecked: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get connector status" });
    }
  });

  app.get("/api/fusion/intelligence", async (req, res) => {
    try {
      const intelligence = await dataFusionEngine.getMarketIntelligence();
      res.json(intelligence);
    } catch (error) {
      console.error("Failed to get market intelligence:", error);
      res.status(500).json({ error: "Failed to get market intelligence" });
    }
  });

  app.get("/api/fusion/market-data", async (req, res) => {
    try {
      const fusedData = await dataFusionEngine.getFusedMarketData();
      res.json(fusedData);
    } catch (error) {
      console.error("Failed to get fused market data:", error);
      res.status(500).json({ error: "Failed to get fused market data" });
    }
  });

  app.get("/api/fusion/status", async (req, res) => {
    try {
      const status = dataFusionEngine.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get fusion status" });
    }
  });

  app.post("/api/trading/execute", async (req, res) => {
    try {
      const { symbol, side, quantity, price, strategyId, notes } = req.body;

      if (!symbol || !side || !quantity || !price) {
        return res.status(400).json({ error: "Symbol, side, quantity, and price are required" });
      }

      if (!["buy", "sell"].includes(side)) {
        return res.status(400).json({ error: "Side must be 'buy' or 'sell'" });
      }

      const result = await paperTradingEngine.executeTrade({
        symbol,
        side,
        quantity: safeParseFloat(quantity),
        price: safeParseFloat(price),
        strategyId,
        notes,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result);
    } catch (error) {
      console.error("Trade execution error:", error);
      res.status(500).json({ error: "Failed to execute trade" });
    }
  });

  app.post("/api/trading/close/:positionId", async (req, res) => {
    try {
      const { positionId } = req.params;
      const { currentPrice } = req.body;

      const result = await paperTradingEngine.closePosition(
        positionId,
        currentPrice ? safeParseFloat(currentPrice) : undefined
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result);
    } catch (error) {
      console.error("Close position error:", error);
      res.status(500).json({ error: "Failed to close position" });
    }
  });

  app.get("/api/trading/portfolio", async (req, res) => {
    try {
      const summary = await paperTradingEngine.getPortfolioSummary();
      res.json(summary);
    } catch (error) {
      console.error("Portfolio summary error:", error);
      res.status(500).json({ error: "Failed to get portfolio summary" });
    }
  });

  app.post("/api/trading/analyze-execute", async (req, res) => {
    try {
      const { symbol, strategyId } = req.body;

      if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" });
      }

      const result = await paperTradingEngine.analyzeAndExecute(symbol, strategyId);
      res.json(result);
    } catch (error) {
      console.error("Analyze and execute error:", error);
      res.status(500).json({ error: "Failed to analyze and execute trade" });
    }
  });

  app.post("/api/trading/update-prices", async (req, res) => {
    try {
      await paperTradingEngine.updatePositionPrices();
      res.json({ success: true, message: "Position prices updated" });
    } catch (error) {
      console.error("Update prices error:", error);
      res.status(500).json({ error: "Failed to update position prices" });
    }
  });

  app.post("/api/trading/reset", async (req, res) => {
    try {
      await paperTradingEngine.resetPortfolio();
      const cashBalance = await paperTradingEngine.getCashBalance();
      res.json({ success: true, cashBalance });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset portfolio" });
    }
  });

  app.get("/api/trading/balance", async (req, res) => {
    try {
      const cashBalance = await paperTradingEngine.getCashBalance();
      res.json({ cashBalance });
    } catch (error) {
      res.status(500).json({ error: "Failed to get balance" });
    }
  });

  app.get("/api/risk/settings", async (req, res) => {
    try {
      const status = await storage.getAgentStatus();
      if (!status) {
        return res.json({
          killSwitchActive: false,
          maxPositionSizePercent: "10",
          maxTotalExposurePercent: "50",
          maxPositionsCount: 10,
          dailyLossLimitPercent: "5",
        });
      }
      res.json({
        killSwitchActive: status.killSwitchActive ?? false,
        maxPositionSizePercent: status.maxPositionSizePercent ?? "10",
        maxTotalExposurePercent: status.maxTotalExposurePercent ?? "50",
        maxPositionsCount: status.maxPositionsCount ?? 10,
        dailyLossLimitPercent: status.dailyLossLimitPercent ?? "5",
      });
    } catch (error) {
      console.error("Failed to get risk settings:", error);
      res.status(500).json({ error: "Failed to get risk settings" });
    }
  });

  app.post("/api/risk/settings", async (req, res) => {
    try {
      const { maxPositionSizePercent, maxTotalExposurePercent, maxPositionsCount, dailyLossLimitPercent } = req.body;
      
      const updates: Record<string, unknown> = {};
      
      if (maxPositionSizePercent !== undefined) {
        const val = parseFloat(maxPositionSizePercent);
        if (isNaN(val) || val <= 0 || val > 100) {
          return res.status(400).json({ error: "Max position size must be between 0 and 100" });
        }
        updates.maxPositionSizePercent = val.toString();
      }
      if (maxTotalExposurePercent !== undefined) {
        const val = parseFloat(maxTotalExposurePercent);
        if (isNaN(val) || val <= 0 || val > 100) {
          return res.status(400).json({ error: "Max total exposure must be between 0 and 100" });
        }
        updates.maxTotalExposurePercent = val.toString();
      }
      if (maxPositionsCount !== undefined) {
        const val = parseInt(maxPositionsCount);
        if (isNaN(val) || val <= 0 || val > 100) {
          return res.status(400).json({ error: "Max positions count must be between 1 and 100" });
        }
        updates.maxPositionsCount = val;
      }
      if (dailyLossLimitPercent !== undefined) {
        const val = parseFloat(dailyLossLimitPercent);
        if (isNaN(val) || val <= 0 || val > 100) {
          return res.status(400).json({ error: "Daily loss limit must be between 0 and 100" });
        }
        updates.dailyLossLimitPercent = val.toString();
      }

      const status = await storage.updateAgentStatus(updates);
      res.json({
        killSwitchActive: status?.killSwitchActive ?? false,
        maxPositionSizePercent: status?.maxPositionSizePercent ?? "10",
        maxTotalExposurePercent: status?.maxTotalExposurePercent ?? "50",
        maxPositionsCount: status?.maxPositionsCount ?? 10,
        dailyLossLimitPercent: status?.dailyLossLimitPercent ?? "5",
      });
    } catch (error) {
      console.error("Failed to update risk settings:", error);
      res.status(500).json({ error: "Failed to update risk settings" });
    }
  });

  app.post("/api/risk/kill-switch", async (req, res) => {
    try {
      const { activate } = req.body;
      const shouldActivate = activate === true || activate === "true";

      const updateData: { killSwitchActive: boolean; isRunning?: boolean } = {
        killSwitchActive: shouldActivate,
      };
      
      if (shouldActivate) {
        updateData.isRunning = false;
      }

      const status = await storage.updateAgentStatus(updateData);

      res.json({
        killSwitchActive: status?.killSwitchActive ?? shouldActivate,
        isRunning: status?.isRunning ?? false,
        message: shouldActivate ? "Kill switch activated - all trading halted" : "Kill switch deactivated",
      });
    } catch (error) {
      console.error("Failed to toggle kill switch:", error);
      res.status(500).json({ error: "Failed to toggle kill switch" });
    }
  });

  app.post("/api/risk/close-all", async (req, res) => {
    try {
      const result = await paperTradingEngine.closeAllPositions();
      res.json(result);
    } catch (error) {
      console.error("Failed to close all positions:", error);
      res.status(500).json({ error: "Failed to close all positions" });
    }
  });

  app.get("/api/alpaca/account", async (req, res) => {
    try {
      const account = await alpaca.getAccount();
      res.json(account);
    } catch (error) {
      console.error("Failed to get Alpaca account:", error);
      res.status(500).json({ error: "Failed to get Alpaca account" });
    }
  });

  app.get("/api/alpaca/positions", async (req, res) => {
    try {
      const positions = await alpaca.getPositions();
      res.json(positions);
    } catch (error) {
      console.error("Failed to get Alpaca positions:", error);
      res.status(500).json({ error: "Failed to get Alpaca positions" });
    }
  });

  app.get("/api/alpaca/orders", async (req, res) => {
    try {
      const status = (req.query.status as "open" | "closed" | "all") || "all";
      const limit = parseInt(req.query.limit as string) || 50;
      const orders = await alpaca.getOrders(status, limit);
      res.json(orders);
    } catch (error) {
      console.error("Failed to get Alpaca orders:", error);
      res.status(500).json({ error: "Failed to get Alpaca orders" });
    }
  });

  app.post("/api/alpaca/orders", async (req, res) => {
    try {
      const order = await alpaca.createOrder(req.body);
      res.status(201).json(order);
    } catch (error) {
      console.error("Failed to create Alpaca order:", error);
      res.status(500).json({ error: "Failed to create Alpaca order" });
    }
  });

  app.delete("/api/alpaca/orders/:orderId", async (req, res) => {
    try {
      await alpaca.cancelOrder(req.params.orderId);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to cancel Alpaca order:", error);
      res.status(500).json({ error: "Failed to cancel Alpaca order" });
    }
  });

  app.get("/api/alpaca/assets", async (req, res) => {
    try {
      const assetClass = (req.query.asset_class as "us_equity" | "crypto") || "us_equity";
      const assets = await alpaca.getAssets("active", assetClass);
      res.json(assets);
    } catch (error) {
      console.error("Failed to get Alpaca assets:", error);
      res.status(500).json({ error: "Failed to get Alpaca assets" });
    }
  });

  app.get("/api/alpaca/assets/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query required" });
      }
      const assets = await alpaca.searchAssets(query);
      res.json(assets);
    } catch (error) {
      console.error("Failed to search Alpaca assets:", error);
      res.status(500).json({ error: "Failed to search Alpaca assets" });
    }
  });

  app.get("/api/alpaca/bars", async (req, res) => {
    try {
      const symbols = (req.query.symbols as string)?.split(",") || ["AAPL"];
      const timeframe = (req.query.timeframe as string) || "1Day";
      const start = req.query.start as string;
      const end = req.query.end as string;
      const bars = await alpaca.getBars(symbols, timeframe, start, end);
      res.json(bars);
    } catch (error) {
      console.error("Failed to get Alpaca bars:", error);
      res.status(500).json({ error: "Failed to get Alpaca bars" });
    }
  });

  app.get("/api/alpaca/snapshots", async (req, res) => {
    try {
      const symbols = (req.query.symbols as string)?.split(",") || ["AAPL"];
      
      const cryptoSymbols: string[] = [];
      const stockSymbols: string[] = [];
      
      for (const symbol of symbols) {
        if (symbol.includes("/") || ["BTCUSD", "ETHUSD", "SOLUSD"].includes(symbol.toUpperCase())) {
          const normalizedCrypto = symbol.includes("/") ? symbol : 
            symbol.toUpperCase() === "BTCUSD" ? "BTC/USD" :
            symbol.toUpperCase() === "ETHUSD" ? "ETH/USD" :
            symbol.toUpperCase() === "SOLUSD" ? "SOL/USD" : symbol;
          cryptoSymbols.push(normalizedCrypto);
        } else {
          stockSymbols.push(symbol);
        }
      }
      
      let result: { [symbol: string]: unknown } = {};
      
      if (stockSymbols.length > 0) {
        const stockSnapshots = await alpaca.getSnapshots(stockSymbols);
        result = { ...result, ...stockSnapshots };
      }
      
      if (cryptoSymbols.length > 0) {
        const cryptoSnapshots = await alpaca.getCryptoSnapshots(cryptoSymbols);
        result = { ...result, ...cryptoSnapshots };
      }
      
      res.json(result);
    } catch (error) {
      console.error("Failed to get Alpaca snapshots:", error);
      res.status(500).json({ error: "Failed to get Alpaca snapshots" });
    }
  });

  app.get("/api/alpaca/health", async (req, res) => {
    try {
      const health = await alpaca.healthCheck();
      res.json(health);
    } catch (error) {
      console.error("Failed to check Alpaca health:", error);
      res.status(500).json({ error: "Failed to check Alpaca health" });
    }
  });

  app.get("/api/alpaca/clock", async (req, res) => {
    try {
      const clock = await alpacaTradingEngine.getClock();
      res.json(clock);
    } catch (error) {
      console.error("Failed to get market clock:", error);
      res.status(500).json({ error: "Failed to get market clock" });
    }
  });

  app.get("/api/alpaca/market-status", async (req, res) => {
    try {
      const status = await alpacaTradingEngine.getMarketStatus();
      res.json(status);
    } catch (error) {
      console.error("Failed to get market status:", error);
      res.status(500).json({ error: "Failed to get market status" });
    }
  });

  app.get("/api/alpaca/can-trade-extended/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const result = await alpacaTradingEngine.canTradeExtendedHours(symbol);
      res.json(result);
    } catch (error) {
      console.error("Failed to check extended hours availability:", error);
      res.status(500).json({ error: "Failed to check extended hours availability" });
    }
  });

  app.get("/api/alpaca/portfolio-history", async (req, res) => {
    try {
      const period = (req.query.period as string) || "1M";
      const timeframe = (req.query.timeframe as string) || "1D";
      const history = await alpaca.getPortfolioHistory(period, timeframe);
      res.json(history);
    } catch (error) {
      console.error("Failed to get portfolio history:", error);
      res.status(500).json({ error: "Failed to get portfolio history" });
    }
  });

  app.get("/api/alpaca/top-stocks", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 25;
      const stocks = await alpaca.getTopStocks(limit);
      res.json(stocks);
    } catch (error) {
      console.error("Failed to get top stocks:", error);
      res.status(500).json({ error: "Failed to get top stocks" });
    }
  });

  app.get("/api/alpaca/top-crypto", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 25;
      const crypto = await alpaca.getTopCrypto(limit);
      res.json(crypto);
    } catch (error) {
      console.error("Failed to get top crypto:", error);
      res.status(500).json({ error: "Failed to get top crypto" });
    }
  });

  app.get("/api/alpaca/top-etfs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 25;
      const etfs = await alpaca.getTopETFs(limit);
      res.json(etfs);
    } catch (error) {
      console.error("Failed to get top ETFs:", error);
      res.status(500).json({ error: "Failed to get top ETFs" });
    }
  });

  app.post("/api/alpaca/validate-order", async (req, res) => {
    try {
      const validation = alpaca.validateOrder(req.body);
      res.json(validation);
    } catch (error) {
      console.error("Failed to validate order:", error);
      res.status(500).json({ error: "Failed to validate order" });
    }
  });

  app.get("/api/cmc/listings", async (req, res) => {
    try {
      const start = parseInt(req.query.start as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const listings = await coinmarketcap.getLatestListings(start, limit);
      res.json(listings);
    } catch (error) {
      console.error("Failed to get CMC listings:", error);
      res.status(500).json({ error: "Failed to get CoinMarketCap listings" });
    }
  });

  app.get("/api/cmc/quotes", async (req, res) => {
    try {
      const symbols = (req.query.symbols as string)?.split(",") || ["BTC", "ETH"];
      const quotes = await coinmarketcap.getQuotesBySymbols(symbols);
      res.json(quotes);
    } catch (error) {
      console.error("Failed to get CMC quotes:", error);
      res.status(500).json({ error: "Failed to get CoinMarketCap quotes" });
    }
  });

  app.get("/api/cmc/global", async (req, res) => {
    try {
      const metrics = await coinmarketcap.getGlobalMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Failed to get CMC global metrics:", error);
      res.status(500).json({ error: "Failed to get CoinMarketCap global metrics" });
    }
  });

  app.get("/api/cmc/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query required" });
      }
      const results = await coinmarketcap.searchCryptos(query);
      res.json(results);
    } catch (error) {
      console.error("Failed to search CMC:", error);
      res.status(500).json({ error: "Failed to search CoinMarketCap" });
    }
  });

  app.get("/api/news/headlines", async (req, res) => {
    try {
      const category = (req.query.category as "business" | "technology" | "general") || "business";
      const country = (req.query.country as string) || "us";
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const headlines = await newsapi.getTopHeadlines(category, country, pageSize);
      res.json(headlines);
    } catch (error) {
      console.error("Failed to get news headlines:", error);
      res.status(500).json({ error: "Failed to get news headlines" });
    }
  });

  app.get("/api/news/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query required" });
      }
      const sortBy = (req.query.sortBy as "relevancy" | "popularity" | "publishedAt") || "publishedAt";
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const articles = await newsapi.searchNews(query, sortBy, pageSize);
      res.json(articles);
    } catch (error) {
      console.error("Failed to search news:", error);
      res.status(500).json({ error: "Failed to search news" });
    }
  });

  app.get("/api/news/market", async (req, res) => {
    try {
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const articles = await newsapi.getMarketNews(pageSize);
      res.json(articles);
    } catch (error) {
      console.error("Failed to get market news:", error);
      res.status(500).json({ error: "Failed to get market news" });
    }
  });

  app.get("/api/news/crypto", async (req, res) => {
    try {
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const articles = await newsapi.getCryptoNews(pageSize);
      res.json(articles);
    } catch (error) {
      console.error("Failed to get crypto news:", error);
      res.status(500).json({ error: "Failed to get crypto news" });
    }
  });

  app.get("/api/news/stock/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const articles = await newsapi.getStockNews(symbol, pageSize);
      res.json(articles);
    } catch (error) {
      console.error("Failed to get stock news:", error);
      res.status(500).json({ error: "Failed to get stock news" });
    }
  });

  app.get("/api/alpaca-trading/status", async (req, res) => {
    try {
      const status = alpacaTradingEngine.getStatus();
      const connected = await alpacaTradingEngine.isAlpacaConnected();
      res.json({ ...status, alpacaConnected: connected });
    } catch (error) {
      console.error("Failed to get Alpaca trading status:", error);
      res.status(500).json({ error: "Failed to get Alpaca trading status" });
    }
  });

  app.post("/api/alpaca-trading/execute", async (req, res) => {
    try {
      const { symbol, side, quantity, strategyId, notes, orderType, limitPrice } = req.body;

      if (!symbol || !side || !quantity) {
        return res.status(400).json({ error: "Symbol, side, and quantity are required" });
      }

      if (!["buy", "sell"].includes(side)) {
        return res.status(400).json({ error: "Side must be 'buy' or 'sell'" });
      }

      const result = await alpacaTradingEngine.executeAlpacaTrade({
        symbol,
        side,
        quantity: safeParseFloat(quantity),
        strategyId,
        notes,
        orderType,
        limitPrice: limitPrice ? safeParseFloat(limitPrice) : undefined,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result);
    } catch (error) {
      console.error("Alpaca trade execution error:", error);
      res.status(500).json({ error: "Failed to execute Alpaca trade" });
    }
  });

  app.post("/api/alpaca-trading/close/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { strategyId } = req.body;

      const result = await alpacaTradingEngine.closeAlpacaPosition(symbol, strategyId);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result);
    } catch (error) {
      console.error("Close Alpaca position error:", error);
      res.status(500).json({ error: "Failed to close Alpaca position" });
    }
  });

  app.post("/api/alpaca-trading/analyze", async (req, res) => {
    try {
      const { symbol, strategyId } = req.body;

      if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" });
      }

      const result = await alpacaTradingEngine.analyzeSymbol(symbol, strategyId);
      res.json(result);
    } catch (error) {
      console.error("Analyze symbol error:", error);
      res.status(500).json({ error: "Failed to analyze symbol" });
    }
  });

  app.post("/api/alpaca-trading/analyze-execute", async (req, res) => {
    try {
      const { symbol, strategyId } = req.body;

      if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" });
      }

      const result = await alpacaTradingEngine.analyzeAndExecute(symbol, strategyId);
      res.json(result);
    } catch (error) {
      console.error("Analyze and execute error:", error);
      res.status(500).json({ error: "Failed to analyze and execute trade" });
    }
  });

  app.post("/api/strategies/:id/start", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await alpacaTradingEngine.startStrategy(id);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, message: "Strategy started" });
    } catch (error) {
      console.error("Start strategy error:", error);
      res.status(500).json({ error: "Failed to start strategy" });
    }
  });

  app.post("/api/strategies/:id/stop", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await alpacaTradingEngine.stopStrategy(id);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, message: "Strategy stopped" });
    } catch (error) {
      console.error("Stop strategy error:", error);
      res.status(500).json({ error: "Failed to stop strategy" });
    }
  });

  app.get("/api/strategies/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const state = alpacaTradingEngine.getStrategyState(id);
      const strategy = await storage.getStrategy(id);

      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }

      res.json({
        strategy,
        runState: state || { strategyId: id, isRunning: false },
      });
    } catch (error) {
      console.error("Get strategy status error:", error);
      res.status(500).json({ error: "Failed to get strategy status" });
    }
  });

  app.post("/api/alpaca-trading/stop-all", async (req, res) => {
    try {
      await alpacaTradingEngine.stopAllStrategies();
      res.json({ success: true, message: "All strategies stopped" });
    } catch (error) {
      console.error("Stop all strategies error:", error);
      res.status(500).json({ error: "Failed to stop all strategies" });
    }
  });

  app.get("/api/orchestration/status", async (req, res) => {
    try {
      const status = coordinator.getStatus();
      const config = coordinator.getConfig();
      res.json({ status, config });
    } catch (error) {
      console.error("Get orchestration status error:", error);
      res.status(500).json({ error: "Failed to get orchestration status" });
    }
  });

  app.post("/api/orchestration/start", async (req, res) => {
    try {
      await coordinator.start();
      res.json({ success: true, message: "Coordinator started" });
    } catch (error) {
      console.error("Start coordinator error:", error);
      res.status(500).json({ error: "Failed to start coordinator" });
    }
  });

  app.post("/api/orchestration/stop", async (req, res) => {
    try {
      await coordinator.stop();
      res.json({ success: true, message: "Coordinator stopped" });
    } catch (error) {
      console.error("Stop coordinator error:", error);
      res.status(500).json({ error: "Failed to stop coordinator" });
    }
  });

  app.put("/api/orchestration/config", async (req, res) => {
    try {
      const updates = req.body;
      coordinator.updateConfig(updates);
      res.json({ success: true, config: coordinator.getConfig() });
    } catch (error) {
      console.error("Update orchestration config error:", error);
      res.status(500).json({ error: "Failed to update configuration" });
    }
  });

  app.get("/api/orchestration/logs", async (req, res) => {
    try {
      const { level, category, limit } = req.query;
      const logs = logger.getLogs({
        level: level as "debug" | "info" | "warn" | "error" | "critical" | undefined,
        category: category as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
      });
      res.json({ logs, stats: logger.getStats() });
    } catch (error) {
      console.error("Get logs error:", error);
      res.status(500).json({ error: "Failed to get logs" });
    }
  });

  app.get("/api/orchestration/logs/errors", async (req, res) => {
    try {
      const { limit } = req.query;
      const errors = logger.getErrorLogs(limit ? parseInt(limit as string) : 50);
      res.json({ errors });
    } catch (error) {
      console.error("Get error logs error:", error);
      res.status(500).json({ error: "Failed to get error logs" });
    }
  });

  app.get("/api/orchestration/events", async (req, res) => {
    try {
      const { type, source, limit } = req.query;
      const events = eventBus.getEventHistory({
        type: type as any,
        source: source as string | undefined,
        limit: limit ? parseInt(limit as string) : 50,
      });
      res.json({ events, stats: eventBus.getStats() });
    } catch (error) {
      console.error("Get events error:", error);
      res.status(500).json({ error: "Failed to get events" });
    }
  });

  app.post("/api/orchestration/reset-stats", async (req, res) => {
    try {
      coordinator.resetStats();
      res.json({ success: true, message: "Statistics reset" });
    } catch (error) {
      console.error("Reset stats error:", error);
      res.status(500).json({ error: "Failed to reset statistics" });
    }
  });

  coordinator.start().catch(err => 
    console.error("Failed to start trading coordinator:", err)
  );

  const httpServer = createServer(app);

  return httpServer;
}
