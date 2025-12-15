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
  type Fill,
} from "@shared/schema";
import { coingecko } from "./connectors/coingecko";
import { finnhub } from "./connectors/finnhub";
import { alpaca, AlpacaOrder } from "./connectors/alpaca";
import { coinmarketcap } from "./connectors/coinmarketcap";
import { newsapi } from "./connectors/newsapi";
import { uaeMarkets } from "./connectors/uae-markets";
import { valyu } from "./connectors/valyu";
import { huggingface } from "./connectors/huggingface";
import { gdelt } from "./connectors/gdelt";
import { aiDecisionEngine, type MarketData, type NewsContext, type StrategyContext } from "./ai/decision-engine";
import { generateTraceId } from "./ai/llmGateway";
import { dataFusionEngine } from "./fusion/data-fusion-engine";
// DEPRECATED: paperTradingEngine is no longer used in UI paths - Alpaca is source of truth
// import { paperTradingEngine } from "./trading/paper-trading-engine";
import { alpacaTradingEngine } from "./trading/alpaca-trading-engine";
import { alpacaStream } from "./trading/alpaca-stream";
import { 
  orderExecutionEngine,
  identifyUnrealOrders, 
  cleanupUnrealOrders, 
  reconcileOrderBook 
} from "./trading/order-execution-flow";
import { orchestrator } from "./autonomous/orchestrator";
import { marketConditionAnalyzer } from "./ai/market-condition-analyzer";
import { eventBus, logger, coordinator } from "./orchestration";
import { safeParseFloat } from "./utils/numeric";
import { 
  mapAlpacaPositionToEnriched, 
  mapAlpacaOrderToEnriched,
  createLiveSourceMetadata,
  createUnavailableSourceMetadata,
  type DataSourceMetadata,
  type EnrichedPosition,
  type EnrichedOrder,
} from "@shared/position-mapper";
import {
  registerWebhook,
  unregisterWebhook,
  getWebhooks,
  getWebhook,
  updateWebhook,
  emitEvent,
  getDeliveryHistory,
  getWebhookStats,
  SUPPORTED_EVENTS,
  type WebhookConfig,
} from "./lib/webhook-emitter";
import { getAllUsageStats, getUsageStats } from "./lib/apiBudget";
import { getCacheStats, getAllCacheEntries, purgeExpiredCache, invalidateCache } from "./lib/persistentApiCache";
import { getAllProviderPolicies, getProviderPolicy, enableProvider, disableProvider } from "./lib/apiPolicy";
import { roleBasedRouter, getAllRoleConfigs, updateRoleConfig, getRecentCalls, getCallStats, type RoleConfig } from "./ai/roleBasedRouter";
import { tradabilityService } from "./services/tradability-service";
import { workQueue } from "./lib/work-queue";
import backtestsRouter from "./routes/backtests";
import { tracesRouter } from "./routes/traces";
import { initializeDefaultModules, getModules, getModule, getAdminOverview } from "./admin/registry";
import { createRBACContext, hasCapability, filterModulesByCapability, getAllRoles, getRoleInfo, type RBACContext } from "./admin/rbac";
import { getSetting, getSettingFull, setSetting, deleteSetting, listSettings, sanitizeSettingForResponse } from "./admin/settings";
import type { AdminCapability } from "../shared/types/admin-module";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    rbac?: RBACContext;
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

function requireCapability(...capabilities: AdminCapability[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUser(req.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const rbacContext = createRBACContext(user);
    req.rbac = rbacContext;

    const hasRequiredCapability = capabilities.some(cap => hasCapability(rbacContext, cap));
    if (!hasRequiredCapability) {
      return res.status(403).json({
        error: "Forbidden",
        message: `Requires one of: ${capabilities.join(", ")}`,
        userCapabilities: rbacContext.capabilities,
      });
    }

    next();
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  console.log("[Routes] Starting route registration...");
  
  // Initialize admin module registry
  initializeDefaultModules();
  console.log("[Routes] Admin module registry initialized");
  
  // Delay async initializations to let server start first
  setTimeout(() => {
    console.log("[Routes] Starting delayed initializations...");
    coordinator.start().catch(err => 
      console.error("Failed to start trading coordinator:", err)
    );
    alpacaTradingEngine.initialize().catch(err => 
      console.error("Failed to initialize Alpaca trading engine:", err)
    );
    orchestrator.autoStart().catch(err =>
      console.error("Failed to auto-start orchestrator:", err)
    );
    // Start the work queue worker for durable order execution
    workQueue.startWorker(5000);
    console.log("[Routes] Work queue worker started with 5s poll interval");
    
    // Connect to Alpaca WebSocket for real-time trade updates
    alpacaStream.connect().catch((err) => {
      console.error("[Routes] Failed to connect to Alpaca stream:", err);
    });
    console.log("[Routes] Alpaca trade updates stream connecting...");
    
    // Start periodic order reconciler (every 45 seconds)
    setInterval(async () => {
      try {
        const traceId = `reconcile-${Date.now()}`;
        await workQueue.enqueue({
          type: "ORDER_SYNC",
          payload: { traceId, source: "periodic-reconciler" },
          traceId,
          idempotencyKey: `ORDER_SYNC:periodic:${Math.floor(Date.now() / 45000)}`,
        });
        console.log("[Routes] Periodic order reconciliation triggered");
      } catch (err) {
        console.error("[Routes] Failed to trigger order reconciliation:", err);
      }
    }, 45000);
    console.log("[Routes] Order reconciliation job scheduled (45s interval)");
  }, 2000);

  // Bootstrap admin user deferred to background to not block startup
  setTimeout(async () => {
    try {
      console.log("[Bootstrap] Checking for admin user...");
      const adminUser = await storage.getUserByUsername("admintest");
      console.log("[Bootstrap] Admin user check complete:", adminUser ? "exists" : "not found");
      if (!adminUser) {
        const hashedPassword = await bcrypt.hash("admin1234", 10);
        await storage.createUser({ username: "admintest", password: hashedPassword, isAdmin: true });
        console.log("[Bootstrap] Created admin user: admintest");
      } else {
        if (!adminUser.isAdmin) {
          await storage.updateUser(adminUser.id, { isAdmin: true });
          console.log("[Bootstrap] Promoted admintest to admin");
        } else {
          console.log("[Bootstrap] Admin user admintest already exists");
        }
      }
    } catch (err) {
      console.error("[Bootstrap] Failed to create admin user:", err);
    }
  }, 3000);
  console.log("[Routes] Continuing registration (admin bootstrap deferred)...");

  app.use("/api/backtests", backtestsRouter);
  app.use("/api/traces", tracesRouter);

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

      res.status(201).json({ id: user.id, username: user.username, isAdmin: user.isAdmin });
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

      res.json({ id: user.id, username: user.username, isAdmin: user.isAdmin });
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

      res.json({ id: user.id, username: user.username, isAdmin: user.isAdmin });
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

  app.get("/api/agent/market-analysis", async (req, res) => {
    try {
      const analyzerStatus = marketConditionAnalyzer.getStatus();
      const lastAnalysis = marketConditionAnalyzer.getLastAnalysis();
      
      res.json({
        isRunning: analyzerStatus.isRunning,
        lastAnalysis,
        lastAnalysisTime: analyzerStatus.lastAnalysisTime,
        currentOrderLimit: analyzerStatus.currentOrderLimit,
      });
    } catch (error) {
      console.error("Failed to get market analysis:", error);
      res.status(500).json({ error: "Failed to get market analysis" });
    }
  });

  app.post("/api/agent/market-analysis/refresh", async (req, res) => {
    try {
      const analysis = await marketConditionAnalyzer.runAnalysis();
      res.json({ success: true, analysis });
    } catch (error) {
      console.error("Failed to refresh market analysis:", error);
      res.status(500).json({ error: "Failed to refresh market analysis" });
    }
  });

  app.get("/api/agent/dynamic-limits", async (req, res) => {
    try {
      const agentStatus = await storage.getAgentStatus();
      const analyzerStatus = marketConditionAnalyzer.getStatus();
      
      const minLimit = agentStatus?.minOrderLimit ?? 10;
      const maxLimit = agentStatus?.maxOrderLimit ?? 50;
      
      let currentLimit = agentStatus?.dynamicOrderLimit ?? analyzerStatus.currentOrderLimit ?? 25;
      currentLimit = Math.max(minLimit, Math.min(maxLimit, currentLimit));
      
      res.json({
        currentDynamicLimit: currentLimit,
        minOrderLimit: minLimit,
        maxOrderLimit: maxLimit,
        marketCondition: agentStatus?.marketCondition || "neutral",
        aiConfidenceScore: agentStatus?.aiConfidenceScore || "0.5",
        lastMarketAnalysis: agentStatus?.lastMarketAnalysis,
      });
    } catch (error) {
      console.error("Failed to get dynamic limits:", error);
      res.status(500).json({ error: "Failed to get dynamic limits" });
    }
  });

  app.post("/api/agent/set-limits", async (req, res) => {
    try {
      const { minOrderLimit, maxOrderLimit } = req.body;
      
      const updates: { minOrderLimit?: number; maxOrderLimit?: number } = {};
      
      if (minOrderLimit !== undefined) {
        if (minOrderLimit < 1 || minOrderLimit > 100) {
          return res.status(400).json({ error: "minOrderLimit must be between 1 and 100" });
        }
        updates.minOrderLimit = minOrderLimit;
      }
      
      if (maxOrderLimit !== undefined) {
        if (maxOrderLimit < 1 || maxOrderLimit > 100) {
          return res.status(400).json({ error: "maxOrderLimit must be between 1 and 100" });
        }
        updates.maxOrderLimit = maxOrderLimit;
      }
      
      if (updates.minOrderLimit && updates.maxOrderLimit && updates.minOrderLimit > updates.maxOrderLimit) {
        return res.status(400).json({ error: "minOrderLimit cannot be greater than maxOrderLimit" });
      }
      
      await storage.updateAgentStatus(updates);
      const updatedStatus = await storage.getAgentStatus();
      
      res.json({
        success: true,
        minOrderLimit: updatedStatus?.minOrderLimit,
        maxOrderLimit: updatedStatus?.maxOrderLimit,
      });
    } catch (error) {
      console.error("Failed to set limits:", error);
      res.status(500).json({ error: "Failed to set limits" });
    }
  });

  app.get("/api/agent/health", async (req, res) => {
    try {
      const healthStatus = orchestrator.getHealthStatus();
      const agentStatus = await storage.getAgentStatus();
      
      res.json({
        ...healthStatus,
        autoStartEnabled: agentStatus?.autoStartEnabled ?? true,
        lastHeartbeatFromDb: agentStatus?.lastHeartbeat,
      });
    } catch (error) {
      console.error("Failed to get agent health:", error);
      res.status(500).json({ error: "Failed to get agent health" });
    }
  });

  app.post("/api/agent/auto-start", async (req, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }
      
      await orchestrator.setAutoStartEnabled(enabled);
      
      res.json({ success: true, autoStartEnabled: enabled });
    } catch (error) {
      console.error("Failed to set auto-start:", error);
      res.status(500).json({ error: "Failed to set auto-start" });
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

  app.get("/api/orders/unreal", async (req, res) => {
    try {
      const unrealOrders = await identifyUnrealOrders();
      res.json({
        count: unrealOrders.length,
        orders: unrealOrders
      });
    } catch (error) {
      console.error("Failed to identify unreal orders:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/orders/cleanup", async (req, res) => {
    try {
      const result = await cleanupUnrealOrders();
      res.json({
        success: result.errors.length === 0,
        identified: result.identified,
        canceled: result.canceled,
        errors: result.errors
      });
    } catch (error) {
      console.error("Failed to cleanup unreal orders:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/orders/reconcile", async (req, res) => {
    try {
      const result = await reconcileOrderBook();
      res.json({
        success: true,
        alpacaOrders: result.alpacaOrders,
        localTrades: result.localTrades,
        missingLocal: result.missingLocal,
        orphanedLocal: result.orphanedLocal,
        synced: result.synced
      });
    } catch (error) {
      console.error("Failed to reconcile order book:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/orders/execution-engine/status", async (req, res) => {
    try {
      const activeExecutions = orderExecutionEngine.getActiveExecutions();
      const executions = Array.from(activeExecutions.entries()).map(([id, state]) => ({
        clientOrderId: id,
        orderId: state.orderId,
        symbol: state.symbol,
        side: state.side,
        status: state.status,
        attempts: state.attempts,
        createdAt: state.createdAt.toISOString(),
        updatedAt: state.updatedAt.toISOString()
      }));
      res.json({
        activeCount: executions.length,
        executions
      });
    } catch (error) {
      console.error("Failed to get execution engine status:", error);
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

  app.post("/api/strategies/backtest", async (req, res) => {
    try {
      const { strategyType, symbol, lookbackDays = 365 } = req.body;
      const parameters = req.body.parameters || {};
      
      if (!strategyType || typeof strategyType !== "string") {
        return res.status(400).json({ 
          error: "strategyType is required", 
          message: "Please provide a valid strategy type (e.g., 'moving-average-crossover', 'momentum', 'mean-reversion')" 
        });
      }
      if (!symbol || typeof symbol !== "string") {
        return res.status(400).json({ 
          error: "symbol is required",
          message: "Please provide a valid trading symbol (e.g., 'SPY', 'AAPL')"
        });
      }

      let result;
      
      switch (strategyType) {
        case "moving-average-crossover":
        case "moving-average": {
          const { normalizeMovingAverageConfig, backtestMovingAverageStrategy } = await import("./strategies/moving-average-crossover");
          const config = normalizeMovingAverageConfig({ symbol, ...parameters });
          result = await backtestMovingAverageStrategy(config, lookbackDays);
          break;
        }
        case "mean-reversion":
        case "mean-reversion-scalper": {
          const { normalizeMeanReversionConfig, backtestMeanReversionStrategy } = await import("./strategies/mean-reversion-scalper");
          const config = normalizeMeanReversionConfig({ symbol, ...parameters });
          result = await backtestMeanReversionStrategy(config, lookbackDays);
          break;
        }
        case "momentum":
        case "momentum-breakout": {
          const { normalizeMomentumConfig, backtestMomentumStrategy } = await import("./strategies/momentum-strategy");
          const config = normalizeMomentumConfig({ symbol, ...parameters });
          result = await backtestMomentumStrategy(config, lookbackDays);
          break;
        }
        case "range-trading":
        case "breakout": {
          const { normalizeMeanReversionConfig, backtestMeanReversionStrategy } = await import("./strategies/mean-reversion-scalper");
          const defaultParams = {
            lookbackPeriod: parameters?.lookbackPeriod ?? 20,
            deviationThreshold: parameters?.deviationThreshold ?? 2.0,
            maxHoldingPeriod: parameters?.maxHoldingPeriod ?? 10,
            ...parameters,
          };
          const config = normalizeMeanReversionConfig({ symbol, ...defaultParams });
          result = await backtestMeanReversionStrategy(config, lookbackDays);
          break;
        }
        default: {
          const { normalizeMomentumConfig, backtestMomentumStrategy } = await import("./strategies/momentum-strategy");
          const config = normalizeMomentumConfig({ symbol, ...parameters });
          result = await backtestMomentumStrategy(config, lookbackDays);
          break;
        }
      }
      
      res.json(result);
    } catch (error) {
      console.error("Failed to run generic backtest:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to run backtest" });
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

  // Returns LIVE Alpaca positions (source of truth per SOURCE_OF_TRUTH_CONTRACT.md)
  // Database sync happens async - DB is cache/audit trail only
  app.get("/api/positions", async (req, res) => {
    const fetchedAt = new Date();
    const DUST_THRESHOLD = 0.0001;
    try {
      const positions = await alpaca.getPositions();
      
      // Filter out dust positions (< 0.0001 shares) to avoid displaying floating point residuals
      const filteredPositions = positions.filter(p => {
        const qty = Math.abs(parseFloat(p.qty || "0"));
        return qty >= DUST_THRESHOLD;
      });
      
      // Sync to database in background (don't block response) - write-behind cache
      storage.syncPositionsFromAlpaca(filteredPositions).catch(err => 
        console.error("Failed to sync positions to database:", err)
      );
      
      const enrichedPositions = filteredPositions.map(p => mapAlpacaPositionToEnriched(p, fetchedAt));
      
      res.json({
        positions: enrichedPositions,
        _source: createLiveSourceMetadata(),
      });
    } catch (error) {
      console.error("Failed to fetch positions from Alpaca:", error);
      // Per SOURCE_OF_TRUTH_CONTRACT.md: Do NOT fallback to stale DB data without warning
      // Return error with source metadata so UI can display appropriate message
      res.status(503).json({ 
        error: "Live position data unavailable from Alpaca",
        _source: createUnavailableSourceMetadata(),
        message: "Could not connect to Alpaca Paper Trading. Please try again shortly.",
      });
    }
  });

  // Alias for /api/positions (backward compatibility) - Uses Alpaca source of truth
  app.get("/api/positions/broker", async (req, res) => {
    const fetchedAt = new Date();
    const DUST_THRESHOLD = 0.0001;
    try {
      const positions = await alpaca.getPositions();
      // Filter out dust positions
      const filteredPositions = positions.filter(p => {
        const qty = Math.abs(parseFloat(p.qty || "0"));
        return qty >= DUST_THRESHOLD;
      });
      const enrichedPositions = filteredPositions.map(p => mapAlpacaPositionToEnriched(p, fetchedAt));
      
      res.json({
        positions: enrichedPositions,
        _source: createLiveSourceMetadata(),
      });
    } catch (error) {
      console.error("Failed to fetch broker positions:", error);
      res.status(503).json({ 
        error: "Failed to fetch positions from broker",
        _source: createUnavailableSourceMetadata(),
        message: "Could not connect to Alpaca Paper Trading. Please try again shortly.",
      });
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

  app.get("/api/ai-decisions/history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const statusFilter = req.query.status as string;
      const actionFilter = req.query.action as string;
      
      const decisions = await storage.getAiDecisions(limit + offset);
      let filtered = decisions.slice(offset, offset + limit);
      
      if (statusFilter) {
        filtered = filtered.filter(d => d.status === statusFilter);
      }
      if (actionFilter) {
        filtered = filtered.filter(d => d.action === actionFilter);
      }
      
      const pendingAnalysis = orchestrator.getPendingAnalysis?.() || [];
      
      res.json({
        decisions: filtered,
        total: decisions.length,
        hasMore: offset + limit < decisions.length,
        pendingAnalysis: pendingAnalysis,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get AI decision history" });
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

  // ============================================================================
  // UNIFIED ACTIVITY TIMELINE ENDPOINT
  // Composes events from AI decisions, broker orders, fills, and system events
  // ============================================================================
  app.get("/api/activity/timeline", async (req, res) => {
    const fetchedAt = new Date();
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const cursor = req.query.cursor as string | undefined;
      const categoryFilter = req.query.category as string | undefined;
      
      // Fetch data from multiple sources in parallel
      const [decisions, brokerOrders, trades] = await Promise.all([
        storage.getAiDecisions(limit * 2),
        alpaca.getOrders("all", limit).catch(() => [] as AlpacaOrder[]),
        storage.getTrades(limit),
      ]);

      // Check Alpaca connectivity
      const alpacaConnected = brokerOrders.length > 0 || decisions.some(d => d.executedTradeId);
      const alpacaStatus = alpacaConnected ? "live" : "unavailable";

      // Build timeline events
      interface TimelineEventInternal {
        id: string;
        ts: string;
        category: "decision" | "order" | "fill" | "position" | "risk" | "system" | "data_fetch";
        title: string;
        subtitle: string | null;
        status: "success" | "pending" | "warning" | "error" | "info";
        entityLinks: {
          decisionId?: string;
          brokerOrderId?: string;
          symbol?: string;
          strategyId?: string;
          tradeId?: string;
        };
        provenance: {
          provider: string;
          cacheStatus: "fresh" | "stale" | "miss" | "unknown";
          latencyMs?: number;
        };
        details?: Record<string, unknown>;
      }

      const events: TimelineEventInternal[] = [];

      // Add decision events
      for (const d of decisions) {
        const status = d.status === "filled" || d.status === "executed" ? "success" :
                       d.status === "skipped" || d.status === "rejected" ? "warning" :
                       d.status === "pending" || d.status === "pending_execution" ? "pending" :
                       d.status === "failed" ? "error" : "info";
        
        const subtitle = d.action === "hold" ? "No action taken" :
                         d.skipReason ? `Skipped: ${d.skipReason}` :
                         `${d.action.toUpperCase()} ${d.symbol}`;

        events.push({
          id: `decision-${d.id}`,
          ts: new Date(d.createdAt).toISOString(),
          category: "decision",
          title: `AI Decision: ${d.action.toUpperCase()} ${d.symbol}`,
          subtitle: d.confidence ? `Confidence: ${(parseFloat(d.confidence) * 100).toFixed(0)}%` : null,
          status,
          entityLinks: {
            decisionId: d.id,
            symbol: d.symbol,
            strategyId: d.strategyId ?? undefined,
            tradeId: d.executedTradeId ?? undefined,
          },
          provenance: {
            provider: "ai-decision-engine",
            cacheStatus: "unknown",
          },
          details: {
            action: d.action,
            confidence: d.confidence,
            reasoning: d.reasoning?.substring(0, 200),
            entryPrice: d.entryPrice,
            stopLoss: d.stopLoss,
            takeProfit: d.takeProfit,
          },
        });
      }

      // Add broker order events
      for (const o of brokerOrders) {
        const status = o.status === "filled" ? "success" :
                       o.status === "canceled" || o.status === "expired" ? "warning" :
                       o.status === "rejected" ? "error" :
                       "pending";
        
        const filledInfo = o.filled_qty && parseFloat(o.filled_qty) > 0 
          ? `${o.filled_qty} @ $${parseFloat(o.filled_avg_price || "0").toFixed(2)}`
          : `${o.qty} shares`;

        events.push({
          id: `order-${o.id}`,
          ts: o.submitted_at,
          category: o.status === "filled" ? "fill" : "order",
          title: `${o.side.toUpperCase()} ${o.symbol}`,
          subtitle: filledInfo,
          status,
          entityLinks: {
            brokerOrderId: o.id,
            symbol: o.symbol,
          },
          provenance: {
            provider: "alpaca",
            cacheStatus: "fresh",
          },
          details: {
            orderId: o.id,
            orderType: o.order_type,
            timeInForce: o.time_in_force,
            limitPrice: o.limit_price,
            stopPrice: o.stop_price,
            filledQty: o.filled_qty,
            filledAvgPrice: o.filled_avg_price,
            brokerStatus: o.status,
          },
        });
      }

      // Add trade fill events from database (for historical fills)
      for (const t of trades) {
        // Skip if we already have an order event for this
        const matchingOrder = brokerOrders.find(o => 
          o.symbol === t.symbol && 
          o.status === "filled" &&
          Math.abs(new Date(o.filled_at || 0).getTime() - new Date(t.executedAt).getTime()) < 60000
        );
        if (matchingOrder) continue;

        const pnl = t.pnl ? parseFloat(t.pnl) : null;
        const status = pnl !== null ? (pnl >= 0 ? "success" : "warning") : "info";

        events.push({
          id: `trade-${t.id}`,
          ts: new Date(t.executedAt).toISOString(),
          category: "fill",
          title: `${t.side.toUpperCase()} ${t.symbol}`,
          subtitle: `${t.quantity} @ $${parseFloat(t.price).toFixed(2)}`,
          status,
          entityLinks: {
            tradeId: t.id,
            symbol: t.symbol,
            strategyId: t.strategyId ?? undefined,
          },
          provenance: {
            provider: "database",
            cacheStatus: "unknown",
          },
          details: {
            quantity: t.quantity,
            price: t.price,
            pnl: t.pnl,
          },
        });
      }

      // Filter by category if specified
      let filteredEvents = events;
      if (categoryFilter && categoryFilter !== "all") {
        filteredEvents = events.filter(e => e.category === categoryFilter);
      }

      // Sort by timestamp descending
      filteredEvents.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

      // Apply cursor-based pagination
      let startIdx = 0;
      if (cursor) {
        const cursorIdx = filteredEvents.findIndex(e => e.id === cursor);
        if (cursorIdx >= 0) startIdx = cursorIdx + 1;
      }
      
      const paginatedEvents = filteredEvents.slice(startIdx, startIdx + limit);
      const hasMore = startIdx + limit < filteredEvents.length;
      const nextCursor = hasMore ? paginatedEvents[paginatedEvents.length - 1]?.id : null;

      res.json({
        events: paginatedEvents,
        hasMore,
        cursor: nextCursor,
        meta: {
          alpacaConnected,
          alpacaStatus,
          totalEvents: filteredEvents.length,
          fetchedAt: fetchedAt.toISOString(),
        },
      });
    } catch (error) {
      console.error("Timeline fetch error:", error);
      res.status(500).json({ 
        error: "Failed to fetch activity timeline",
        meta: {
          alpacaConnected: false,
          alpacaStatus: "unavailable",
          totalEvents: 0,
        },
      });
    }
  });

  app.post("/api/trades/backfill-prices", async (req, res) => {
    try {
      const trades = await storage.getTrades(500);
      const zeroTrades = trades.filter(t => safeParseFloat(t.price, 0) === 0);
      
      if (zeroTrades.length === 0) {
        return res.json({ message: "No trades need backfilling", updated: 0 });
      }

      let orders: any[] = [];
      try {
        orders = await alpaca.getOrders("all", 500);
      } catch (e) {
        console.error("Failed to fetch Alpaca orders for backfill:", e);
        return res.status(500).json({ error: "Failed to fetch order history from broker" });
      }

      let updated = 0;
      for (const trade of zeroTrades) {
        const matchingOrder = orders.find(o => 
          o.symbol === trade.symbol && 
          o.side === trade.side &&
          o.status === "filled" &&
          safeParseFloat(o.filled_avg_price, 0) > 0 &&
          Math.abs(new Date(o.filled_at).getTime() - new Date(trade.executedAt).getTime()) < 60000
        );

        if (matchingOrder) {
          const filledPrice = safeParseFloat(matchingOrder.filled_avg_price, 0);
          const filledQty = safeParseFloat(matchingOrder.filled_qty, 0);
          
          await storage.updateTrade(trade.id, {
            price: filledPrice.toString(),
            quantity: filledQty.toString(),
            status: "filled",
          });
          updated++;
        }
      }

      res.json({ 
        message: `Backfilled ${updated} of ${zeroTrades.length} trades`,
        updated,
        remaining: zeroTrades.length - updated
      });
    } catch (error) {
      console.error("Trade backfill error:", error);
      res.status(500).json({ error: "Failed to backfill trade prices" });
    }
  });

  // Orders from database (with source metadata)
  app.get("/api/orders", async (req, res) => {
    const fetchedAt = new Date();
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const status = req.query.status as string;
      
      let orders;
      if (status) {
        orders = await storage.getOrdersByStatus(status, limit);
      } else {
        orders = await storage.getRecentOrders(limit);
      }
      
      res.json({
        orders,
        _source: {
          type: "database",
          table: "orders",
          fetchedAt: fetchedAt.toISOString(),
          note: "Orders stored in local database, synced from broker"
        }
      });
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Get fills
  app.get("/api/fills", async (req, res) => {
    const fetchedAt = new Date();
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Get recent fills - we'll need to add a method for this
      const orders = await storage.getRecentOrders(100);
      const orderIds = orders.map(o => o.id);
      
      let allFills: Fill[] = [];
      for (const orderId of orderIds) {
        const fills = await storage.getFillsByOrderId(orderId);
        allFills = allFills.concat(fills);
      }
      
      // Sort by occurredAt descending and limit
      allFills.sort((a, b) => 
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );
      allFills = allFills.slice(0, limit);
      
      res.json({
        fills: allFills,
        _source: {
          type: "database",
          table: "fills",
          fetchedAt: fetchedAt.toISOString(),
        }
      });
    } catch (error) {
      console.error("Failed to fetch fills:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Get fills for a specific order
  app.get("/api/fills/order/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      
      // Try by database order ID first
      let fills = await storage.getFillsByOrderId(orderId);
      
      // If not found, try by brokerOrderId
      if (fills.length === 0) {
        fills = await storage.getFillsByBrokerOrderId(orderId);
      }
      
      res.json({
        fills,
        _source: {
          type: "database",
          table: "fills",
          fetchedAt: new Date().toISOString(),
        }
      });
    } catch (error) {
      console.error("Failed to fetch fills:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Trigger order sync manually
  app.post("/api/orders/sync", async (req, res) => {
    try {
      const traceId = `api-sync-${Date.now()}`;
      
      // Enqueue an ORDER_SYNC work item
      const workItem = await workQueue.enqueue({
        type: "ORDER_SYNC",
        payload: JSON.stringify({ traceId }),
        maxAttempts: 3,
      });
      
      res.json({
        success: true,
        workItemId: workItem.id,
        message: "Order sync enqueued",
        traceId,
      });
    } catch (error) {
      console.error("Failed to enqueue order sync:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Returns LIVE Alpaca orders (source of truth per SOURCE_OF_TRUTH_CONTRACT.md)
  app.get("/api/orders/recent", async (req, res) => {
    const fetchedAt = new Date();
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const orders = await alpaca.getOrders("all", limit);
      
      const enrichedOrders = orders.map(o => ({
        ...mapAlpacaOrderToEnriched(o, fetchedAt),
        assetClass: o.asset_class,
        submittedAt: o.submitted_at,
        isAI: true,
      }));
      
      res.json({
        orders: enrichedOrders,
        _source: createLiveSourceMetadata(),
      });
    } catch (error) {
      console.error("Failed to fetch recent orders:", error);
      res.status(503).json({ 
        error: "Failed to fetch recent orders",
        _source: createUnavailableSourceMetadata(),
        message: "Could not connect to Alpaca Paper Trading. Please try again shortly.",
      });
    }
  });

  // Get single order by ID (must come after all specific /api/orders/* routes)
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Try by database ID first, then by brokerOrderId
      let order = await storage.getOrderByBrokerOrderId(id);
      
      if (!order) {
        // Could also try by ID if needed
        const orders = await storage.getRecentOrders(1000);
        order = orders.find(o => o.id === id);
      }
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Fetch fills for this order
      const fills = await storage.getFillsByOrderId(order.id);
      
      res.json({
        order,
        fills,
        _source: {
          type: "database",
          table: "orders",
          fetchedAt: new Date().toISOString(),
        }
      });
    } catch (error) {
      console.error("Failed to fetch order:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/analytics/summary", async (req, res) => {
    try {
      const trades = await storage.getTrades(5000);
      const orchestratorState = orchestrator.getState();
      const riskLimits = orchestrator.getRiskLimits();
      
      let alpacaPositions: any[] = [];
      let unrealizedPnl = 0;
      let dailyPnlFromAccount = 0;
      let accountData = {
        equity: "0",
        cash: "0",
        buyingPower: "0",
        lastEquity: "0",
        portfolioValue: "0",
      };
      
      try {
        alpacaPositions = await alpaca.getPositions();
        unrealizedPnl = alpacaPositions.reduce((sum, p) => sum + safeParseFloat(p.unrealized_pl, 0), 0);
        
        const account = await alpaca.getAccount();
        const portfolioValue = safeParseFloat(account.portfolio_value, 0);
        const lastEquity = safeParseFloat(account.last_equity, 0);
        
        dailyPnlFromAccount = portfolioValue - lastEquity;
        
        accountData = {
          equity: account.equity || "0",
          cash: account.cash || "0",
          buyingPower: account.buying_power || "0",
          lastEquity: account.last_equity || "0",
          portfolioValue: account.portfolio_value || "0",
        };
      } catch (e) {
        console.error("Failed to fetch Alpaca data for analytics:", e);
      }

      // Filter to only count filled/completed trades (not pending or failed)
      const filledTrades = trades.filter(t => {
        const status = (t.status || "").toLowerCase();
        return status === "filled" || status === "completed" || status === "executed";
      });
      
      const sellTrades = filledTrades.filter(t => t.side === "sell");
      
      const closedTrades = sellTrades.filter(t => {
        if (t.pnl === null || t.pnl === undefined) return false;
        const pnlStr = String(t.pnl).trim();
        if (pnlStr === "") return false;
        const pnlValue = parseFloat(pnlStr);
        return Number.isFinite(pnlValue);
      });
      
      const realizedPnl = closedTrades.reduce((sum, t) => sum + safeParseFloat(t.pnl, 0), 0);
      
      const totalPnl = unrealizedPnl + realizedPnl;
      
      const winningTrades = closedTrades.filter(t => safeParseFloat(t.pnl, 0) > 0);
      const losingTrades = closedTrades.filter(t => safeParseFloat(t.pnl, 0) < 0);
      const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todaysTrades = closedTrades.filter(t => {
        const executedAt = new Date(t.executedAt);
        return executedAt >= todayStart;
      });
      const dailyTradeCount = todaysTrades.length;
      
      const dailyWinningTrades = todaysTrades.filter(t => safeParseFloat(t.pnl, 0) > 0);
      const dailyLosingTrades = todaysTrades.filter(t => safeParseFloat(t.pnl, 0) < 0);
      const dailyRealizedPnl = todaysTrades.reduce((sum, t) => sum + safeParseFloat(t.pnl, 0), 0);

      res.json({
        totalTrades: filledTrades.length,
        closedTradesCount: closedTrades.length,
        totalPnl: totalPnl.toFixed(2),
        realizedPnl: realizedPnl.toFixed(2),
        winRate: winRate.toFixed(1),
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        openPositions: alpacaPositions.length,
        unrealizedPnl: unrealizedPnl.toFixed(2),
        isAgentRunning: orchestratorState.isRunning,
        dailyPnl: dailyPnlFromAccount.toFixed(2),
        dailyTradeCount: dailyTradeCount,
        dailyWinningTrades: dailyWinningTrades.length,
        dailyLosingTrades: dailyLosingTrades.length,
        dailyRealizedPnl: dailyRealizedPnl.toFixed(2),
        account: accountData,
        riskControls: {
          maxPositionSizePercent: riskLimits.maxPositionSizePercent,
          maxTotalExposurePercent: riskLimits.maxTotalExposurePercent,
          maxPositionsCount: riskLimits.maxPositionsCount,
          dailyLossLimitPercent: riskLimits.dailyLossLimitPercent,
          killSwitchActive: riskLimits.killSwitchActive,
        },
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

      const traceId = generateTraceId();
      const decision = await aiDecisionEngine.analyzeOpportunity(
        symbol,
        marketData as MarketData,
        newsContext as NewsContext | undefined,
        strategy,
        { traceId }
      );

      const aiDecisionRecord = await storage.createAiDecision({
        strategyId: strategyId || null,
        symbol,
        action: decision.action,
        confidence: decision.confidence.toString(),
        reasoning: decision.reasoning,
        traceId,
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
      const alpacaStatus = alpaca.getConnectionStatus();
      const newsStatus = newsapi.getConnectionStatus();
      const coinmarketcapStatus = coinmarketcap.getConnectionStatus();
      const valyuStatus = valyu.getConnectionStatus();
      const huggingfaceStatus = huggingface.getConnectionStatus();
      const uaeStatus = uaeMarkets.getConnectionStatus();
      const gdeltStatus = gdelt.getConnectionStatus();
      
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
        allConnectors: [
          {
            id: "alpaca",
            name: "Alpaca",
            category: "broker",
            description: "Paper trading execution & account management",
            connected: alpacaStatus.connected,
            hasApiKey: alpacaStatus.hasCredentials,
            cacheSize: alpacaStatus.cacheSize,
            lastChecked: new Date().toISOString(),
          },
          {
            id: "finnhub",
            name: "Finnhub",
            category: "market_data",
            description: "Real-time stock quotes & fundamentals",
            connected: stockStatus.connected,
            hasApiKey: stockStatus.hasApiKey,
            cacheSize: stockStatus.cacheSize,
            lastChecked: new Date().toISOString(),
          },
          {
            id: "coingecko",
            name: "CoinGecko",
            category: "market_data",
            description: "Cryptocurrency prices & market data",
            connected: cryptoStatus.connected,
            hasApiKey: cryptoStatus.hasApiKey,
            cacheSize: cryptoStatus.cacheSize,
            lastChecked: new Date().toISOString(),
          },
          {
            id: "coinmarketcap",
            name: "CoinMarketCap",
            category: "market_data",
            description: "Comprehensive crypto market data",
            connected: coinmarketcapStatus.connected,
            hasApiKey: coinmarketcapStatus.hasApiKey,
            cacheSize: coinmarketcapStatus.cacheSize,
            lastChecked: new Date().toISOString(),
          },
          {
            id: "newsapi",
            name: "NewsAPI",
            category: "news",
            description: "Real-time news headlines for sentiment",
            connected: newsStatus.connected,
            hasApiKey: newsStatus.hasApiKey,
            cacheSize: newsStatus.cacheSize,
            circuitBreakerOpen: newsStatus.isCircuitOpen,
            rateLimitedUntil: newsStatus.isRateLimited ? newsStatus.rateLimitExpiresIn : null,
            lastChecked: new Date().toISOString(),
          },
          {
            id: "valyu",
            name: "Valyu.ai",
            category: "enrichment",
            description: "9 financial datasets: earnings, ratios, balance sheets, income, cash flow, dividends, insider trades, SEC filings, market movers",
            connected: valyuStatus.connected,
            hasApiKey: valyuStatus.hasApiKey,
            cacheSize: valyuStatus.cacheSize,
            lastChecked: new Date().toISOString(),
          },
          {
            id: "huggingface",
            name: "Hugging Face",
            category: "enrichment",
            description: "FinBERT sentiment analysis & ML models",
            connected: huggingfaceStatus.connected,
            hasApiKey: huggingfaceStatus.hasApiKey,
            cacheSize: huggingfaceStatus.cacheSize,
            lastChecked: new Date().toISOString(),
          },
          {
            id: "openai",
            name: "OpenAI",
            category: "ai",
            description: "GPT-4o-mini for trading decisions",
            connected: aiStatus.available,
            hasApiKey: aiStatus.available,
            model: aiStatus.model,
            lastChecked: new Date().toISOString(),
          },
          {
            id: "uae-markets",
            name: "UAE Markets",
            category: "market_data",
            description: "Dubai DFM & Abu Dhabi ADX stocks",
            connected: uaeStatus.connected,
            hasApiKey: uaeStatus.apiConfigured,
            cacheSize: uaeStatus.cacheSize,
            isMockData: uaeStatus.isMockData,
            lastChecked: new Date().toISOString(),
          },
          {
            id: "gdelt",
            name: "GDELT",
            category: "news",
            description: "Real-time global news (100+ languages), sentiment tracking, breaking news detection (FREE, updates every 15min)",
            connected: gdeltStatus.connected,
            hasApiKey: true,
            cacheSize: gdeltStatus.cacheSize,
            lastChecked: new Date().toISOString(),
          },
        ],
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

  // DEPRECATED: Use /api/alpaca/trade instead - Alpaca is source of truth per SOURCE_OF_TRUTH_CONTRACT.md
  // This endpoint now routes to Alpaca trading engine
  app.post("/api/trading/execute", async (req, res) => {
    try {
      const { symbol, side, quantity, strategyId, notes } = req.body;

      if (!symbol || !side || !quantity) {
        return res.status(400).json({ error: "Symbol, side, and quantity are required" });
      }

      if (!["buy", "sell"].includes(side)) {
        return res.status(400).json({ error: "Side must be 'buy' or 'sell'" });
      }

      console.log(`[DEPRECATED] /api/trading/execute called - redirecting to Alpaca trading engine`);
      
      const result = await alpacaTradingEngine.executeAlpacaTrade({
        symbol,
        side,
        quantity: safeParseFloat(quantity),
        strategyId,
      });

      res.json({
        ...result,
        _deprecated: true,
        _message: "Use /api/alpaca/trade endpoint instead",
        _source: createLiveSourceMetadata(),
      });
    } catch (error) {
      console.error("Trade execution error:", error);
      res.status(500).json({ error: "Failed to execute trade" });
    }
  });

  // DEPRECATED: Use /api/alpaca/positions/:symbol/close instead - Alpaca is source of truth
  app.post("/api/trading/close/:positionId", async (req, res) => {
    try {
      const { positionId } = req.params;
      
      console.log(`[DEPRECATED] /api/trading/close called - closing position via Alpaca`);
      
      // positionId might be a symbol - try to close via Alpaca
      const result = await alpacaTradingEngine.closeAlpacaPosition(positionId);

      res.json({
        ...result,
        _deprecated: true,
        _message: "Use /api/alpaca/positions/:symbol/close endpoint instead",
        _source: createLiveSourceMetadata(),
      });
    } catch (error) {
      console.error("Close position error:", error);
      res.status(500).json({ error: "Failed to close position" });
    }
  });

  // DEPRECATED: Use /api/account for Alpaca account data - Alpaca is source of truth
  app.get("/api/trading/portfolio", async (req, res) => {
    try {
      console.log(`[DEPRECATED] /api/trading/portfolio called - fetching from Alpaca`);
      
      const account = await alpaca.getAccount();
      const positions = await alpaca.getPositions();
      const fetchedAt = new Date();
      
      const enrichedPositions = positions.map(p => mapAlpacaPositionToEnriched(p, fetchedAt));
      const unrealizedPnl = positions.reduce((sum, p) => sum + safeParseFloat(p.unrealized_pl, 0), 0);
      
      res.json({
        cashBalance: safeParseFloat(account.cash, 0),
        equity: safeParseFloat(account.equity, 0),
        portfolioValue: safeParseFloat(account.portfolio_value, 0),
        buyingPower: safeParseFloat(account.buying_power, 0),
        positionsCount: positions.length,
        unrealizedPnl,
        positions: enrichedPositions,
        _deprecated: true,
        _message: "Use /api/account and /api/positions endpoints instead",
        _source: createLiveSourceMetadata(),
      });
    } catch (error) {
      console.error("Portfolio summary error:", error);
      res.status(503).json({ 
        error: "Failed to get portfolio summary",
        _source: createUnavailableSourceMetadata(),
      });
    }
  });

  // DEPRECATED: Use /api/alpaca/analyze-execute instead - Alpaca is source of truth
  app.post("/api/trading/analyze-execute", async (req, res) => {
    try {
      const { symbol, strategyId } = req.body;

      if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" });
      }

      console.log(`[DEPRECATED] /api/trading/analyze-execute called - using Alpaca engine`);
      
      const result = await alpacaTradingEngine.analyzeAndExecute(symbol, strategyId);
      res.json({
        ...result,
        _deprecated: true,
        _message: "Use /api/alpaca/analyze-execute endpoint instead",
        _source: createLiveSourceMetadata(),
      });
    } catch (error) {
      console.error("Analyze and execute error:", error);
      res.status(500).json({ error: "Failed to analyze and execute trade" });
    }
  });

  // DEPRECATED: Prices now always come live from Alpaca - no manual update needed
  app.post("/api/trading/update-prices", async (req, res) => {
    console.log(`[DEPRECATED] /api/trading/update-prices called - prices come live from Alpaca`);
    res.json({ 
      success: true, 
      message: "Prices are now fetched live from Alpaca. This endpoint is deprecated.",
      _deprecated: true,
      _source: createLiveSourceMetadata(),
    });
  });

  // DEPRECATED: Cannot reset Alpaca paper trading account via API
  app.post("/api/trading/reset", async (req, res) => {
    console.log(`[DEPRECATED] /api/trading/reset called - Alpaca accounts cannot be reset via API`);
    res.status(400).json({ 
      error: "Cannot reset Alpaca paper trading account via API. Use the Alpaca dashboard to reset your paper account.",
      _deprecated: true,
    });
  });

  // DEPRECATED: Use /api/account for Alpaca account balance - Alpaca is source of truth
  app.get("/api/trading/balance", async (req, res) => {
    try {
      console.log(`[DEPRECATED] /api/trading/balance called - fetching from Alpaca`);
      
      const account = await alpaca.getAccount();
      res.json({ 
        cashBalance: safeParseFloat(account.cash, 0),
        buyingPower: safeParseFloat(account.buying_power, 0),
        equity: safeParseFloat(account.equity, 0),
        _deprecated: true,
        _message: "Use /api/account endpoint instead",
        _source: createLiveSourceMetadata(),
      });
    } catch (error) {
      res.status(503).json({ 
        error: "Failed to get balance",
        _source: createUnavailableSourceMetadata(),
      });
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

  // Close all positions via Alpaca - source of truth per SOURCE_OF_TRUTH_CONTRACT.md
  app.post("/api/risk/close-all", async (req, res) => {
    try {
      console.log("[RISK] Closing all positions via Alpaca...");
      const result = await alpacaTradingEngine.closeAllPositions();
      res.json({
        ...result,
        _source: createLiveSourceMetadata(),
      });
    } catch (error) {
      console.error("Failed to close all positions:", error);
      res.status(500).json({ error: "Failed to close all positions" });
    }
  });

  // Emergency liquidation endpoint - closes ALL positions including fractional shares
  app.post("/api/risk/emergency-liquidate", async (req, res) => {
    try {
      console.log("[EMERGENCY] Initiating full portfolio liquidation...");
      
      // Step 1: Activate kill switch to prevent new trades
      await storage.updateAgentStatus({ killSwitchActive: true, isRunning: false });
      console.log("[EMERGENCY] Kill switch activated");
      
      // Step 2: Get count of open orders before cancelling
      const openOrders = await alpaca.getOrders("open", 100);
      const orderCount = openOrders.length;
      
      // Step 3: Cancel all open orders
      await alpaca.cancelAllOrders();
      console.log(`[EMERGENCY] Cancelled ${orderCount} orders`);
      
      // Step 4: Close all positions using Alpaca's DELETE with cancel_orders=true
      // This handles fractional shares correctly
      const closeResult = await alpaca.closeAllPositions();
      console.log(`[EMERGENCY] Submitted close orders for ${closeResult.length} positions`);
      
      // Step 5: Wait briefly for Alpaca to process close orders
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 6: Sync database with Alpaca state (positions and account)
      await alpacaTradingEngine.syncPositionsFromAlpaca();
      const account = await alpaca.getAccount();
      console.log(`[EMERGENCY] Synced positions from Alpaca. Account equity: $${account.equity}`);
      
      res.json({
        success: true,
        killSwitchActivated: true,
        ordersCancelled: orderCount,
        positionsClosing: closeResult.length,
        closeOrders: closeResult.map((order: AlpacaOrder) => ({
          symbol: order.symbol,
          qty: order.qty,
          status: order.status,
          type: order.type,
        })),
        message: `Emergency liquidation initiated: ${orderCount} orders cancelled, ${closeResult.length} positions closing`,
      });
    } catch (error) {
      console.error("[EMERGENCY] Liquidation failed:", error);
      res.status(500).json({ error: "Emergency liquidation failed: " + String(error) });
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
      // Filter out dust positions (< 0.0001 shares) to avoid displaying floating point residuals
      const DUST_THRESHOLD = 0.0001;
      const filteredPositions = positions.filter(p => {
        const qty = Math.abs(parseFloat(p.qty || "0"));
        return qty >= DUST_THRESHOLD;
      });
      res.json(filteredPositions);
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
      const { symbol } = req.body;
      if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" });
      }
      
      const tradabilityCheck = await tradabilityService.validateSymbolTradable(symbol);
      if (!tradabilityCheck.tradable) {
        return res.status(400).json({
          error: `Symbol ${symbol} is not tradable`,
          reason: tradabilityCheck.reason || "Not found in broker universe",
          tradabilityCheck,
        });
      }
      
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

  app.get("/api/alpaca/allocations", async (req, res) => {
    try {
      const result = await alpacaTradingEngine.getCurrentAllocations();
      res.json(result);
    } catch (error) {
      console.error("Failed to get current allocations:", error);
      res.status(500).json({ error: "Failed to get current allocations" });
    }
  });

  app.post("/api/alpaca/rebalance/preview", async (req, res) => {
    try {
      const { targetAllocations } = req.body;
      if (!targetAllocations || !Array.isArray(targetAllocations)) {
        return res.status(400).json({ error: "targetAllocations array required" });
      }
      
      for (const alloc of targetAllocations) {
        if (!alloc.symbol || typeof alloc.targetPercent !== "number") {
          return res.status(400).json({ error: "Each allocation must have symbol and targetPercent" });
        }
        if (alloc.targetPercent < 0 || alloc.targetPercent > 100) {
          return res.status(400).json({ error: "targetPercent must be between 0 and 100" });
        }
      }
      
      const preview = await alpacaTradingEngine.previewRebalance(targetAllocations);
      res.json(preview);
    } catch (error) {
      console.error("Failed to preview rebalance:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to preview rebalance" });
    }
  });

  app.post("/api/alpaca/rebalance/execute", async (req, res) => {
    try {
      const { targetAllocations, dryRun = false } = req.body;
      if (!targetAllocations || !Array.isArray(targetAllocations)) {
        return res.status(400).json({ error: "targetAllocations array required" });
      }
      
      for (const alloc of targetAllocations) {
        if (!alloc.symbol || typeof alloc.targetPercent !== "number") {
          return res.status(400).json({ error: "Each allocation must have symbol and targetPercent" });
        }
        if (alloc.targetPercent < 0 || alloc.targetPercent > 100) {
          return res.status(400).json({ error: "targetPercent must be between 0 and 100" });
        }
      }
      
      const result = await alpacaTradingEngine.executeRebalance(targetAllocations, dryRun);
      res.json(result);
    } catch (error) {
      console.error("Failed to execute rebalance:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to execute rebalance" });
    }
  });

  app.get("/api/alpaca/rebalance/suggestions", async (req, res) => {
    try {
      const suggestions = await alpacaTradingEngine.getRebalanceSuggestions();
      res.json(suggestions);
    } catch (error) {
      console.error("Failed to get rebalance suggestions:", error);
      res.status(500).json({ error: "Failed to get rebalance suggestions" });
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

  app.get("/api/performance/metrics", async (req, res) => {
    try {
      const { performanceTracker } = await import("./lib/performance-metrics");
      const { getOrderCacheStats } = await import("./lib/order-execution-cache");
      const { getPoolStats } = await import("./db");
      
      const metrics = performanceTracker.getMetrics();
      const sloStatus = performanceTracker.getSLOStatus();
      const cacheStats = getOrderCacheStats();
      const poolStats = getPoolStats();
      
      res.json({
        orderExecution: performanceTracker.getMetricSummary('orderExecution'),
        quoteRetrieval: performanceTracker.getMetricSummary('quoteRetrieval'),
        aiDecision: performanceTracker.getMetricSummary('aiDecision'),
        databaseQuery: performanceTracker.getMetricSummary('databaseQuery'),
        apiCall: performanceTracker.getMetricSummary('apiCall'),
        sloCompliance: sloStatus,
        cache: cacheStats,
        dbPool: poolStats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Performance metrics error:", error);
      res.status(500).json({ error: "Failed to get performance metrics" });
    }
  });

  const redactWebhook = (webhook: WebhookConfig) => ({
    ...webhook,
    secret: webhook.secret ? '***REDACTED***' : undefined,
    headers: webhook.headers ? Object.fromEntries(
      Object.entries(webhook.headers).map(([k, v]) => 
        k.toLowerCase().includes('auth') || k.toLowerCase().includes('token') || k.toLowerCase().includes('key')
          ? [k, '***REDACTED***'] : [k, v]
      )
    ) : undefined,
  });

  app.get("/api/webhooks", authMiddleware, (req, res) => {
    const webhooks = getWebhooks().map(redactWebhook);
    res.json({ webhooks, supportedEvents: SUPPORTED_EVENTS });
  });

  app.get("/api/webhooks/:id", authMiddleware, (req, res) => {
    const webhook = getWebhook(req.params.id);
    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }
    res.json(redactWebhook(webhook));
  });

  app.post("/api/webhooks", authMiddleware, (req, res) => {
    try {
      const { name, url, eventTypes, enabled, headers, secret } = req.body;
      if (!name || !url) {
        return res.status(400).json({ error: "name and url are required" });
      }
      if (!url.startsWith('https://') && process.env.NODE_ENV === 'production') {
        return res.status(400).json({ error: "Webhook URL must use HTTPS in production" });
      }
      const id = `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const config: WebhookConfig = {
        id,
        name,
        url,
        eventTypes: eventTypes || ['*'],
        enabled: enabled !== false,
        headers,
        secret,
      };
      registerWebhook(config);
      res.status(201).json(redactWebhook(config));
    } catch (error) {
      console.error("Webhook creation error:", error);
      res.status(500).json({ error: "Failed to create webhook" });
    }
  });

  app.put("/api/webhooks/:id", authMiddleware, (req, res) => {
    const updated = updateWebhook(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Webhook not found" });
    }
    res.json(redactWebhook(updated));
  });

  app.delete("/api/webhooks/:id", authMiddleware, (req, res) => {
    const result = unregisterWebhook(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Webhook not found" });
    }
    res.json({ success: true });
  });

  app.post("/api/webhooks/test", authMiddleware, async (req, res) => {
    try {
      const { eventType, payload } = req.body;
      const results = await emitEvent(eventType || 'system.test', payload || { test: true, timestamp: new Date().toISOString() });
      res.json({ deliveries: results.length, results });
    } catch (error) {
      console.error("Webhook test error:", error);
      res.status(500).json({ error: "Failed to send test event" });
    }
  });

  app.get("/api/webhooks/stats/overview", authMiddleware, (req, res) => {
    res.json(getWebhookStats());
  });

  app.get("/api/webhooks/history/deliveries", authMiddleware, (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({ deliveries: getDeliveryHistory(limit) });
  });

  const {
    registerChannel,
    getChannel,
    getChannels,
    updateChannel,
    deleteChannel,
    registerTemplate,
    getTemplates,
    updateTemplate,
    deleteTemplate,
    sendNotification,
    sendDirectNotification,
    getNotificationHistory,
    getNotificationStats,
    NotificationChannel,
    NotificationTemplate,
  } = await import('./lib/notification-service');

  const redactChannelConfig = (channel: any) => {
    const redacted = { ...channel };
    if (redacted.config) {
      const config = { ...redacted.config };
      if ('botToken' in config) config.botToken = '***REDACTED***';
      if ('webhookUrl' in config) config.webhookUrl = config.webhookUrl.replace(/\/[^/]+$/, '/***REDACTED***');
      if ('password' in config) config.password = '***REDACTED***';
      redacted.config = config;
    }
    return redacted;
  };

  app.get("/api/notifications/channels", authMiddleware, (req, res) => {
    res.json({ channels: getChannels().map(redactChannelConfig) });
  });

  app.get("/api/notifications/channels/:id", authMiddleware, (req, res) => {
    const channel = getChannel(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }
    res.json(redactChannelConfig(channel));
  });

  app.post("/api/notifications/channels", authMiddleware, (req, res) => {
    try {
      const { type, name, config, enabled } = req.body;
      if (!type || !name || !config) {
        return res.status(400).json({ error: "type, name, and config are required" });
      }
      if (!['telegram', 'slack', 'discord', 'email'].includes(type)) {
        return res.status(400).json({ error: "Invalid channel type" });
      }
      if (type === 'email') {
        return res.status(400).json({ error: "Email notifications not yet supported" });
      }
      const id = `ch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const channel: NotificationChannel = {
        id,
        type,
        name,
        config,
        enabled: enabled === true,
        createdAt: new Date(),
      };
      registerChannel(channel);
      res.status(201).json(redactChannelConfig(channel));
    } catch (error) {
      console.error("Channel creation error:", error);
      res.status(500).json({ error: "Failed to create channel" });
    }
  });

  app.put("/api/notifications/channels/:id", authMiddleware, (req, res) => {
    const updated = updateChannel(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Channel not found" });
    }
    res.json(redactChannelConfig(updated));
  });

  app.delete("/api/notifications/channels/:id", authMiddleware, (req, res) => {
    const result = deleteChannel(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Channel not found" });
    }
    res.json({ success: true });
  });

  app.get("/api/notifications/templates", authMiddleware, (req, res) => {
    res.json({ templates: getTemplates() });
  });

  app.post("/api/notifications/templates", authMiddleware, (req, res) => {
    try {
      const { name, eventType, channels, messageTemplate, enabled } = req.body;
      if (!name || !eventType || !messageTemplate) {
        return res.status(400).json({ error: "name, eventType, and messageTemplate are required" });
      }
      const id = `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const template: NotificationTemplate = {
        id,
        name,
        eventType,
        channels: channels || [],
        messageTemplate,
        enabled: enabled !== false,
      };
      registerTemplate(template);
      res.status(201).json(template);
    } catch (error) {
      console.error("Template creation error:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.put("/api/notifications/templates/:id", authMiddleware, (req, res) => {
    const updated = updateTemplate(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json(updated);
  });

  app.delete("/api/notifications/templates/:id", authMiddleware, (req, res) => {
    const result = deleteTemplate(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json({ success: true });
  });

  app.post("/api/notifications/send", authMiddleware, async (req, res) => {
    try {
      const { eventType, data } = req.body;
      if (!eventType) {
        return res.status(400).json({ error: "eventType is required" });
      }
      const results = await sendNotification(eventType, data || {});
      res.json({ sent: results.length, results });
    } catch (error) {
      console.error("Notification send error:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  app.post("/api/notifications/channels/:id/test", authMiddleware, async (req, res) => {
    try {
      const { message } = req.body;
      const result = await sendDirectNotification(
        req.params.id,
        message || 'Test notification from AI Active Trader'
      );
      if (!result) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Notification test error:", error);
      res.status(500).json({ error: "Failed to send test notification" });
    }
  });

  app.get("/api/notifications/history", authMiddleware, (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({ notifications: getNotificationHistory(limit) });
  });

  app.get("/api/notifications/stats", authMiddleware, (req, res) => {
    res.json(getNotificationStats());
  });

  // ============================================================
  // Admin API - Budget & Cache Management
  // ============================================================

  app.get("/api/admin/api-usage", authMiddleware, async (req, res) => {
    try {
      const { provider } = req.query;
      
      if (provider && typeof provider === "string") {
        const stats = await getUsageStats(provider);
        const policy = getProviderPolicy(provider);
        res.json({ provider, stats, policy });
      } else {
        const allStats = await getAllUsageStats();
        const policies = getAllProviderPolicies();
        res.json({ usage: allStats, policies });
      }
    } catch (error) {
      console.error("Failed to get API usage stats:", error);
      res.status(500).json({ error: "Failed to get API usage stats" });
    }
  });

  app.get("/api/admin/api-cache", authMiddleware, async (req, res) => {
    try {
      const { provider } = req.query;
      const providerFilter = typeof provider === "string" ? provider : undefined;
      
      const stats = await getCacheStats(providerFilter);
      const entries = await getAllCacheEntries(providerFilter);
      
      res.json({ stats, entries });
    } catch (error) {
      console.error("Failed to get API cache stats:", error);
      res.status(500).json({ error: "Failed to get API cache stats" });
    }
  });

  app.post("/api/admin/api-cache/purge", authMiddleware, requireCapability("admin:danger"), async (req, res) => {
    try {
      const { provider, key, expiredOnly } = req.body;
      
      let purgedCount = 0;
      let message = "";
      
      if (provider && key) {
        purgedCount = await invalidateCache(provider, key);
        message = `Invalidated cache for ${provider}:${key}`;
      } else if (provider && !expiredOnly) {
        purgedCount = await invalidateCache(provider);
        message = `Invalidated all cache entries for ${provider}`;
      } else {
        purgedCount = await purgeExpiredCache();
        message = provider 
          ? `Purged expired cache entries (provider filter not supported for expired purge)`
          : "Purged all expired cache entries";
      }
      
      res.json({ success: true, purgedCount, message });
    } catch (error) {
      console.error("Failed to purge API cache:", error);
      res.status(500).json({ error: "Failed to purge API cache" });
    }
  });

  app.get("/api/admin/provider-status", authMiddleware, async (req, res) => {
    try {
      const { getAllProviderStatuses } = await import("./lib/callExternal");
      const statuses = await getAllProviderStatuses();
      res.json({ providers: statuses });
    } catch (error) {
      console.error("Failed to get provider statuses:", error);
      res.status(500).json({ error: "Failed to get provider statuses" });
    }
  });

  app.post("/api/admin/provider/:provider/force-refresh", authMiddleware, requireCapability("admin:danger"), async (req, res) => {
    try {
      const { provider } = req.params;
      const { cacheKey, confirmValyu } = req.body;
      
      if (provider.toLowerCase() === "valyu" && !confirmValyu) {
        return res.status(400).json({ 
          error: "Valyu force refresh requires explicit confirmation",
          message: "Set confirmValyu: true to force refresh Valyu data (1 call/week limit)"
        });
      }

      if (cacheKey) {
        await invalidateCache(provider, cacheKey);
        res.json({ 
          success: true, 
          message: `Cache invalidated for ${provider}:${cacheKey}. Next request will fetch fresh data.`
        });
      } else {
        await invalidateCache(provider);
        res.json({ 
          success: true, 
          message: `All cache entries invalidated for ${provider}. Next requests will fetch fresh data.`
        });
      }
    } catch (error) {
      console.error("Failed to force refresh provider:", error);
      res.status(500).json({ error: "Failed to force refresh provider" });
    }
  });

  app.patch("/api/admin/provider/:provider/toggle", authMiddleware, requireCapability("admin:write"), async (req, res) => {
    try {
      const { provider } = req.params;
      const { enabled } = req.body;
      
      if (enabled === true) {
        enableProvider(provider);
      } else if (enabled === false) {
        disableProvider(provider);
      } else {
        return res.status(400).json({ error: "enabled must be true or false" });
      }

      const policy = getProviderPolicy(provider);
      res.json({ 
        success: true, 
        provider,
        enabled: policy.enabled,
        message: `Provider ${provider} is now ${policy.enabled ? 'enabled' : 'disabled'}`
      });
    } catch (error) {
      console.error("Failed to toggle provider:", error);
      res.status(500).json({ error: "Failed to toggle provider" });
    }
  });

  app.get("/api/admin/valyu-budget", authMiddleware, async (req, res) => {
    try {
      const { getValyuBudgetStatus, getValyuBudgetConfig } = await import("./lib/valyuBudget");
      const statuses = await getValyuBudgetStatus();
      const config = getValyuBudgetConfig();
      res.json({ statuses, config });
    } catch (error) {
      console.error("Failed to get Valyu budget status:", error);
      res.status(500).json({ error: "Failed to get Valyu budget status" });
    }
  });

  app.put("/api/admin/valyu-budget", authMiddleware, async (req, res) => {
    try {
      const { updateValyuBudgetConfig, getValyuBudgetConfig } = await import("./lib/valyuBudget");
      const { webRetrievalsPerMonth, financeRetrievalsPerMonth, proprietaryRetrievalsPerMonth } = req.body;
      
      const updates: { 
        webRetrievalsPerMonth?: number; 
        financeRetrievalsPerMonth?: number; 
        proprietaryRetrievalsPerMonth?: number;
      } = {};
      
      if (webRetrievalsPerMonth !== undefined) updates.webRetrievalsPerMonth = webRetrievalsPerMonth;
      if (financeRetrievalsPerMonth !== undefined) updates.financeRetrievalsPerMonth = financeRetrievalsPerMonth;
      if (proprietaryRetrievalsPerMonth !== undefined) updates.proprietaryRetrievalsPerMonth = proprietaryRetrievalsPerMonth;
      
      updateValyuBudgetConfig(updates);
      const config = getValyuBudgetConfig();
      
      res.json({ success: true, config, message: "Valyu budget limits updated" });
    } catch (error) {
      console.error("Failed to update Valyu budget:", error);
      res.status(500).json({ error: "Failed to update Valyu budget" });
    }
  });

  // ============================================================
  // Admin API - Connector Health & Status
  // ============================================================

  app.get("/api/admin/connectors-health", authMiddleware, async (req, res) => {
    try {
      const { getAllProviderStatuses } = await import("./lib/callExternal");
      const providerStatuses = await getAllProviderStatuses();
      
      const connectors = [
        {
          name: "Alpaca Paper",
          provider: "alpaca",
          type: "brokerage",
          hasApiKey: !!(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY),
          status: "checking" as string,
          lastSync: null as string | null,
          callsRemaining: null as number | null,
          healthDetails: null as { overall: string; account?: unknown } | null,
        },
        {
          name: "Finnhub",
          provider: "finnhub",
          type: "market_data",
          hasApiKey: !!process.env.FINNHUB_API_KEY,
          status: "checking" as string,
          lastSync: null as string | null,
          callsRemaining: null as number | null,
          healthDetails: null as { overall: string; account?: unknown } | null,
        },
        {
          name: "CoinGecko",
          provider: "coingecko",
          type: "crypto_data",
          hasApiKey: true,
          status: "checking" as string,
          lastSync: null as string | null,
          callsRemaining: null as number | null,
          healthDetails: null as { overall: string; account?: unknown } | null,
        },
        {
          name: "CoinMarketCap",
          provider: "coinmarketcap",
          type: "crypto_data",
          hasApiKey: !!process.env.COINMARKETCAP_API_KEY,
          status: "checking" as string,
          lastSync: null as string | null,
          callsRemaining: null as number | null,
          healthDetails: null as { overall: string; account?: unknown } | null,
        },
        {
          name: "GDELT News",
          provider: "gdelt",
          type: "news",
          hasApiKey: true,
          status: "checking" as string,
          lastSync: null as string | null,
          callsRemaining: null as number | null,
          healthDetails: null as { overall: string; account?: unknown } | null,
        },
        {
          name: "NewsAPI",
          provider: "newsapi",
          type: "news",
          hasApiKey: !!process.env.NEWS_API_KEY,
          status: "checking" as string,
          lastSync: null as string | null,
          callsRemaining: null as number | null,
          healthDetails: null as { overall: string; account?: unknown } | null,
        },
        {
          name: "Valyu AI",
          provider: "valyu",
          type: "data_enrichment",
          hasApiKey: !!process.env.VALYU_API_KEY,
          status: "checking" as string,
          lastSync: null as string | null,
          callsRemaining: null as number | null,
          healthDetails: null as { overall: string; account?: unknown } | null,
        },
        {
          name: "Hugging Face",
          provider: "huggingface",
          type: "ai_sentiment",
          hasApiKey: !!process.env.HUGGINGFACE_API_KEY,
          status: "checking" as string,
          lastSync: null as string | null,
          callsRemaining: null as number | null,
          healthDetails: null as { overall: string; account?: unknown } | null,
        },
      ];

      let alpacaHealthResult: { overall: string; timestamp: string; account: unknown } | null = null;
      const alpacaConnector = connectors.find(c => c.provider === "alpaca");
      if (alpacaConnector?.hasApiKey) {
        try {
          alpacaHealthResult = await alpaca.healthCheck();
        } catch (err) {
          console.error("Alpaca health check failed:", err);
        }
      }

      for (const connector of connectors) {
        const providerStatus = providerStatuses[connector.provider];
        
        if (connector.provider === "alpaca") {
          if (!connector.hasApiKey) {
            connector.status = "offline";
            connector.lastSync = "Not configured";
          } else if (alpacaHealthResult) {
            connector.healthDetails = { 
              overall: alpacaHealthResult.overall,
              account: alpacaHealthResult.account 
            };
            if (alpacaHealthResult.overall === "healthy") {
              connector.status = "healthy";
              connector.lastSync = alpacaHealthResult.timestamp ? new Date(alpacaHealthResult.timestamp).toLocaleTimeString() : "Connected";
            } else if (alpacaHealthResult.overall === "degraded") {
              connector.status = "warning";
              connector.lastSync = "Partially connected";
            } else {
              connector.status = "offline";
              connector.lastSync = "Connection failed";
            }
          } else {
            connector.status = "offline";
            connector.lastSync = "Health check failed";
          }
          if (providerStatus?.policy.maxRequestsPerMinute) {
            connector.callsRemaining = Math.max(0, providerStatus.policy.maxRequestsPerMinute - providerStatus.budgetStatus.currentCount);
          }
          continue;
        }

        if (providerStatus) {
          if (!connector.hasApiKey) {
            connector.status = "offline";
            connector.lastSync = "Not configured";
          } else if (!providerStatus.enabled) {
            connector.status = "disabled";
            connector.lastSync = "Disabled";
          } else if (!providerStatus.budgetStatus.allowed) {
            connector.status = "warning";
            connector.lastSync = "Rate limited";
            connector.callsRemaining = 0;
          } else {
            connector.status = "healthy";
            if (providerStatus.lastCallTime) {
              const ago = Date.now() - providerStatus.lastCallTime;
              if (ago < 60000) connector.lastSync = "Just now";
              else if (ago < 3600000) connector.lastSync = `${Math.floor(ago / 60000)} min ago`;
              else connector.lastSync = `${Math.floor(ago / 3600000)} hr ago`;
            } else {
              connector.lastSync = "Ready";
            }
            if (providerStatus.policy.maxRequestsPerMinute) {
              connector.callsRemaining = Math.max(0, providerStatus.policy.maxRequestsPerMinute - providerStatus.budgetStatus.currentCount);
            }
          }
        }
      }

      res.json({ connectors });
    } catch (error) {
      console.error("Failed to get connector health:", error);
      res.status(500).json({ error: "Failed to get connector health" });
    }
  });

  app.get("/api/admin/api-keys-status", authMiddleware, async (req, res) => {
    try {
      const { getAllAvailableProviders } = await import("./ai/index");
      const aiProviders = getAllAvailableProviders();
      const providerPolicies = getAllProviderPolicies();
      
      const getPolicyEnabled = (provider: string): boolean => {
        const policy = providerPolicies.find(p => p.provider.toLowerCase() === provider.toLowerCase());
        return policy?.enabled ?? true;
      };

      const apiKeys = [
        { name: "Alpaca API", key: "ALPACA_API_KEY", category: "brokerage", configured: !!(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY), enabled: getPolicyEnabled("alpaca") },
        { name: "Finnhub API", key: "FINNHUB_API_KEY", category: "market_data", configured: !!process.env.FINNHUB_API_KEY, enabled: getPolicyEnabled("finnhub") },
        { name: "CoinGecko API", key: "COINGECKO_API_KEY", category: "crypto", configured: true, enabled: getPolicyEnabled("coingecko") },
        { name: "CoinMarketCap API", key: "COINMARKETCAP_API_KEY", category: "crypto", configured: !!process.env.COINMARKETCAP_API_KEY, enabled: getPolicyEnabled("coinmarketcap") },
        { name: "NewsAPI", key: "NEWS_API_KEY", category: "news", configured: !!process.env.NEWS_API_KEY, enabled: getPolicyEnabled("newsapi") },
        { name: "GDELT News", key: "GDELT", category: "news", configured: true, enabled: getPolicyEnabled("gdelt") },
        { name: "Valyu API", key: "VALYU_API_KEY", category: "data", configured: !!process.env.VALYU_API_KEY, enabled: getPolicyEnabled("valyu") },
        { name: "Hugging Face API", key: "HUGGINGFACE_API_KEY", category: "ai", configured: !!process.env.HUGGINGFACE_API_KEY, enabled: getPolicyEnabled("huggingface") },
        { name: "OpenAI API", key: "OPENAI_API_KEY", category: "ai", configured: aiProviders.includes("openai"), enabled: getPolicyEnabled("openai") },
        { name: "Groq API", key: "GROQ_API_KEY", category: "ai", configured: aiProviders.includes("groq"), enabled: getPolicyEnabled("groq") },
        { name: "Together API", key: "TOGETHER_API_KEY", category: "ai", configured: aiProviders.includes("together"), enabled: getPolicyEnabled("together") },
        { name: "AIML API", key: "AIMLAPI_KEY", category: "ai", configured: aiProviders.includes("aimlapi"), enabled: true },
        { name: "OpenRouter API", key: "OPENROUTER_API_KEY", category: "ai", configured: !!process.env.OPENROUTER_API_KEY, enabled: true },
      ];

      const summary = {
        total: apiKeys.length,
        configured: apiKeys.filter(k => k.configured).length,
        missing: apiKeys.filter(k => !k.configured).length,
        enabled: apiKeys.filter(k => k.enabled).length,
        byCategory: {
          brokerage: apiKeys.filter(k => k.category === "brokerage"),
          market_data: apiKeys.filter(k => k.category === "market_data"),
          crypto: apiKeys.filter(k => k.category === "crypto"),
          news: apiKeys.filter(k => k.category === "news"),
          data: apiKeys.filter(k => k.category === "data"),
          ai: apiKeys.filter(k => k.category === "ai"),
        }
      };

      res.json({ apiKeys, summary });
    } catch (error) {
      console.error("Failed to get API keys status:", error);
      res.status(500).json({ error: "Failed to get API keys status" });
    }
  });

  app.get("/api/admin/data-fusion-status", authMiddleware, async (req, res) => {
    try {
      const { getAllProviderStatuses } = await import("./lib/callExternal");
      const providerStatuses = await getAllProviderStatuses();
      
      const fusionEngineStatus = dataFusionEngine.getStatus();
      
      let marketIntelligence = null;
      try {
        marketIntelligence = await dataFusionEngine.getMarketIntelligence();
      } catch (err) {
        console.error("Failed to get market intelligence:", err);
      }

      const dataSources = [
        { name: "Market Prices", provider: "finnhub", active: !!process.env.FINNHUB_API_KEY && providerStatuses.finnhub?.enabled },
        { name: "Crypto Prices", provider: "coingecko", active: providerStatuses.coingecko?.enabled },
        { name: "News Feed", provider: "gdelt", active: providerStatuses.gdelt?.enabled },
        { name: "News Headlines", provider: "newsapi", active: !!process.env.NEWS_API_KEY && providerStatuses.newsapi?.enabled },
        { name: "Sentiment Analysis", provider: "huggingface", active: !!process.env.HUGGINGFACE_API_KEY && providerStatuses.huggingface?.enabled },
        { name: "Financial Data", provider: "valyu", active: !!process.env.VALYU_API_KEY && providerStatuses.valyu?.enabled },
        { name: "Trade Execution", provider: "alpaca", active: !!(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY) && providerStatuses.alpaca?.enabled },
      ];

      const activeSourcesCount = marketIntelligence?.activeSources ?? dataSources.filter(s => s.active).length;
      const totalSources = marketIntelligence?.totalSources ?? dataSources.length;
      const intelligenceScore = marketIntelligence?.overall ?? (activeSourcesCount / totalSources);

      const fusionMetrics = {
        intelligenceScore,
        activeSources: activeSourcesCount,
        totalSources,
        dataSources,
        dataQuality: marketIntelligence?.dataQuality ?? "unknown",
        components: marketIntelligence?.components ?? null,
        signals: marketIntelligence?.signals ?? [],
        embeddingsCount: fusionEngineStatus.cacheSize,
        lastFusionRun: fusionEngineStatus.lastFusionTime 
          ? new Date(fusionEngineStatus.lastFusionTime).toISOString() 
          : null,
        capabilities: {
          marketData: dataSources.some(s => s.provider === "finnhub" && s.active) || dataSources.some(s => s.provider === "coingecko" && s.active),
          newsAnalysis: dataSources.some(s => (s.provider === "gdelt" || s.provider === "newsapi") && s.active),
          sentimentAnalysis: dataSources.some(s => s.provider === "huggingface" && s.active),
          tradingCapability: dataSources.some(s => s.provider === "alpaca" && s.active),
        }
      };

      res.json(fusionMetrics);
    } catch (error) {
      console.error("Failed to get data fusion status:", error);
      res.status(500).json({ error: "Failed to get data fusion status" });
    }
  });

  // ============================================================
  // Admin API - AI Configuration
  // ============================================================

  app.get("/api/admin/ai-config", authMiddleware, async (req, res) => {
    try {
      const agentStatus = await storage.getAgentStatus();
      res.json({
        autoExecuteTrades: agentStatus?.autoExecuteTrades ?? false,
        conservativeMode: agentStatus?.conservativeMode ?? false,
      });
    } catch (error) {
      console.error("Failed to get AI config:", error);
      res.status(500).json({ error: "Failed to get AI config" });
    }
  });

  app.put("/api/admin/ai-config", authMiddleware, async (req, res) => {
    try {
      const { autoExecuteTrades, conservativeMode } = req.body;
      const updates: { autoExecuteTrades?: boolean; conservativeMode?: boolean } = {};
      if (typeof autoExecuteTrades === "boolean") updates.autoExecuteTrades = autoExecuteTrades;
      if (typeof conservativeMode === "boolean") updates.conservativeMode = conservativeMode;
      
      await storage.updateAgentStatus(updates);
      const status = await storage.getAgentStatus();
      res.json({
        autoExecuteTrades: status?.autoExecuteTrades ?? false,
        conservativeMode: status?.conservativeMode ?? false,
      });
    } catch (error) {
      console.error("Failed to update AI config:", error);
      res.status(500).json({ error: "Failed to update AI config" });
    }
  });

  // ============================================================
  // Admin API - Model Router (Role-Based LLM Routing)
  // ============================================================

  app.get("/api/admin/model-router/configs", authMiddleware, async (req, res) => {
    try {
      const configs = await getAllRoleConfigs();
      const availableProviders = roleBasedRouter.getAvailableProviders();
      res.json({ configs, availableProviders });
    } catch (error) {
      console.error("Failed to get role configs:", error);
      res.status(500).json({ error: "Failed to get role configurations" });
    }
  });

  app.put("/api/admin/model-router/configs/:role", authMiddleware, async (req, res) => {
    try {
      const { role } = req.params;
      const validRoles = ["market_news_summarizer", "technical_analyst", "risk_manager", "execution_planner", "post_trade_reporter"];
      
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
      }

      const updates = req.body as Partial<RoleConfig>;
      const updated = await updateRoleConfig(role as any, updates);
      res.json({ success: true, config: updated });
    } catch (error) {
      console.error("Failed to update role config:", error);
      res.status(500).json({ error: "Failed to update role configuration" });
    }
  });

  app.get("/api/admin/model-router/calls", authMiddleware, async (req, res) => {
    try {
      const { role, limit } = req.query;
      const limitNum = parseInt(limit as string) || 20;
      const roleFilter = typeof role === "string" ? role as any : undefined;
      
      const calls = await getRecentCalls(limitNum, roleFilter);
      res.json({ calls, count: calls.length });
    } catch (error) {
      console.error("Failed to get recent LLM calls:", error);
      res.status(500).json({ error: "Failed to get recent LLM calls" });
    }
  });

  app.get("/api/admin/model-router/stats", authMiddleware, async (req, res) => {
    try {
      const stats = await getCallStats();
      res.json(stats);
    } catch (error) {
      console.error("Failed to get LLM call stats:", error);
      res.status(500).json({ error: "Failed to get LLM call statistics" });
    }
  });

  app.get("/api/admin/work-items", authMiddleware, async (req, res) => {
    try {
      const { status, type, limit } = req.query;
      const limitNum = parseInt(limit as string) || 50;
      const items = await storage.getWorkItems(limitNum, status as any);
      
      const filteredItems = type 
        ? items.filter(i => i.type === type)
        : items;

      const counts = {
        PENDING: await storage.getWorkItemCount("PENDING"),
        RUNNING: await storage.getWorkItemCount("RUNNING"),
        SUCCEEDED: await storage.getWorkItemCount("SUCCEEDED"),
        FAILED: await storage.getWorkItemCount("FAILED"),
        DEAD_LETTER: await storage.getWorkItemCount("DEAD_LETTER"),
      };

      res.json({
        items: filteredItems,
        counts,
        total: items.length,
      });
    } catch (error) {
      console.error("Failed to get work items:", error);
      res.status(500).json({ error: "Failed to get work items" });
    }
  });

  app.post("/api/admin/work-items/retry", authMiddleware, requireCapability("admin:write"), async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Work item ID required" });
      }

      const item = await storage.getWorkItem(id);
      if (!item) {
        return res.status(404).json({ error: "Work item not found" });
      }

      if (item.status !== "DEAD_LETTER" && item.status !== "FAILED") {
        return res.status(400).json({ error: "Can only retry DEAD_LETTER or FAILED items" });
      }

      await storage.updateWorkItem(id, {
        status: "PENDING",
        attempts: 0,
        nextRunAt: new Date(),
        lastError: null,
      });

      res.json({ success: true, message: "Work item queued for retry" });
    } catch (error) {
      console.error("Failed to retry work item:", error);
      res.status(500).json({ error: "Failed to retry work item" });
    }
  });

  app.post("/api/admin/work-items/dead-letter", authMiddleware, requireCapability("admin:danger"), async (req, res) => {
    try {
      const { id, reason } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Work item ID required" });
      }

      const item = await storage.getWorkItem(id);
      if (!item) {
        return res.status(404).json({ error: "Work item not found" });
      }

      await storage.updateWorkItem(id, {
        status: "DEAD_LETTER",
        lastError: reason || "Manually moved to dead letter",
      });

      res.json({ success: true, message: "Work item moved to dead letter" });
    } catch (error) {
      console.error("Failed to dead-letter work item:", error);
      res.status(500).json({ error: "Failed to dead-letter work item" });
    }
  });

  app.get("/api/admin/orchestrator-health", authMiddleware, async (req, res) => {
    try {
      const agentStatusData = await storage.getAgentStatus();
      const counts = {
        PENDING: await storage.getWorkItemCount("PENDING"),
        RUNNING: await storage.getWorkItemCount("RUNNING"),
        FAILED: await storage.getWorkItemCount("FAILED"),
        DEAD_LETTER: await storage.getWorkItemCount("DEAD_LETTER"),
      };

      const recentErrors = await storage.getWorkItems(5, "FAILED");
      
      res.json({
        isRunning: agentStatusData?.isRunning || false,
        killSwitchActive: agentStatusData?.killSwitchActive || false,
        lastHeartbeat: agentStatusData?.lastHeartbeat || null,
        queueDepth: counts,
        totalPending: counts.PENDING + counts.RUNNING,
        recentErrors: recentErrors.map(e => ({
          id: e.id,
          type: e.type,
          symbol: e.symbol,
          error: e.lastError,
          createdAt: e.createdAt,
        })),
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to get orchestrator health:", error);
      res.status(500).json({ error: "Failed to get orchestrator health" });
    }
  });

  // ============================================================================
  // ADMIN MODULE REGISTRY ENDPOINTS
  // ============================================================================

  app.get("/api/admin/modules", authMiddleware, async (req, res) => {
    try {
      const modules = getModules();
      res.json({
        modules,
        count: modules.length,
      });
    } catch (error) {
      console.error("Failed to get admin modules:", error);
      res.status(500).json({ error: "Failed to get admin modules" });
    }
  });

  app.get("/api/admin/modules/accessible", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const rbacContext = createRBACContext(user);
      const allModules = getModules();
      const accessibleModules = filterModulesByCapability(allModules, rbacContext);
      res.json({
        modules: accessibleModules,
        count: accessibleModules.length,
        totalModules: allModules.length,
        userRole: rbacContext.role,
      });
    } catch (error) {
      console.error("Failed to get accessible modules:", error);
      res.status(500).json({ error: "Failed to get accessible modules" });
    }
  });

  app.get("/api/admin/modules/:id", authMiddleware, async (req, res) => {
    try {
      const module = getModule(req.params.id);
      if (!module) {
        return res.status(404).json({ error: "Module not found" });
      }
      res.json(module);
    } catch (error) {
      console.error("Failed to get admin module:", error);
      res.status(500).json({ error: "Failed to get admin module" });
    }
  });

  app.get("/api/admin/overview", authMiddleware, async (req, res) => {
    try {
      const overview = await getAdminOverview();
      
      const agentStatusData = await storage.getAgentStatus();
      const queueCounts = {
        PENDING: await storage.getWorkItemCount("PENDING"),
        RUNNING: await storage.getWorkItemCount("RUNNING"),
        FAILED: await storage.getWorkItemCount("FAILED"),
        DEAD_LETTER: await storage.getWorkItemCount("DEAD_LETTER"),
      };

      const llmStats = await getCallStats();
      const allUsage = await getAllUsageStats();

      res.json({
        ...overview,
        orchestrator: {
          isRunning: agentStatusData?.isRunning || false,
          killSwitchActive: agentStatusData?.killSwitchActive || false,
          lastHeartbeat: agentStatusData?.lastHeartbeat || null,
        },
        workQueue: {
          pending: queueCounts.PENDING,
          running: queueCounts.RUNNING,
          failed: queueCounts.FAILED,
          deadLetter: queueCounts.DEAD_LETTER,
        },
        llm: {
          totalCalls: llmStats.total,
          successRate: llmStats.byProvider && Object.keys(llmStats.byProvider).length > 0
            ? Object.values(llmStats.byProvider).reduce((acc, p) => acc + (p.successRate || 0), 0) / Object.keys(llmStats.byProvider).length
            : 0,
          avgLatency: llmStats.byRole && Object.keys(llmStats.byRole).length > 0
            ? Object.values(llmStats.byRole).reduce((acc, r) => acc + (r.avgLatency || 0), 0) / Object.keys(llmStats.byRole).length
            : 0,
        },
        providers: Object.keys(allUsage).map(provider => ({
          provider,
          callsUsed: allUsage[provider]?.length || 0,
        })),
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to get admin overview:", error);
      res.status(500).json({ error: "Failed to get admin overview" });
    }
  });

  // ============================================================================
  // RBAC ENDPOINTS
  // ============================================================================

  app.get("/api/admin/rbac/me", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const rbacContext = createRBACContext(user);
      res.json({
        userId: rbacContext.userId,
        username: rbacContext.username,
        role: rbacContext.role,
        isAdmin: rbacContext.isAdmin,
        capabilities: rbacContext.capabilities,
      });
    } catch (error) {
      console.error("Failed to get RBAC context:", error);
      res.status(500).json({ error: "Failed to get RBAC context" });
    }
  });

  app.get("/api/admin/rbac/roles", authMiddleware, async (req, res) => {
    try {
      const roles = getAllRoles().map(role => getRoleInfo(role));
      res.json({ roles });
    } catch (error) {
      console.error("Failed to get roles:", error);
      res.status(500).json({ error: "Failed to get roles" });
    }
  });

  app.get("/api/admin/rbac/check/:capability", authMiddleware, async (req, res) => {
    try {
      const { capability } = req.params;
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const rbacContext = createRBACContext(user);
      const hasIt = hasCapability(rbacContext, capability as AdminCapability);
      res.json({
        capability,
        hasCapability: hasIt,
        userRole: rbacContext.role,
      });
    } catch (error) {
      console.error("Failed to check capability:", error);
      res.status(500).json({ error: "Failed to check capability" });
    }
  });

  // ============================================================================
  // ADMIN SETTINGS ENDPOINTS
  // ============================================================================

  app.get("/api/admin/settings", authMiddleware, async (req, res) => {
    try {
      const { namespace } = req.query;
      const namespaceFilter = typeof namespace === "string" ? namespace : undefined;
      const settings = await listSettings(namespaceFilter);
      const sanitized = settings.map(sanitizeSettingForResponse);
      res.json({
        settings: sanitized,
        count: sanitized.length,
      });
    } catch (error) {
      console.error("Failed to list settings:", error);
      res.status(500).json({ error: "Failed to list settings" });
    }
  });

  app.get("/api/admin/settings/:namespace/:key", authMiddleware, async (req, res) => {
    try {
      const { namespace, key } = req.params;
      const setting = await getSettingFull(namespace, key);
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      const sanitized = sanitizeSettingForResponse(setting);
      res.json(sanitized);
    } catch (error) {
      console.error("Failed to get setting:", error);
      res.status(500).json({ error: "Failed to get setting" });
    }
  });

  app.put("/api/admin/settings/:namespace/:key", authMiddleware, requireCapability("admin:write"), async (req, res) => {
    try {
      const { namespace, key } = req.params;
      const { value, description, isSecret, isReadOnly } = req.body;
      if (value === undefined) {
        return res.status(400).json({ error: "Value is required" });
      }
      const setting = await setSetting(namespace, key, value, {
        description,
        isSecret,
        isReadOnly,
        userId: req.userId,
      });
      res.json(sanitizeSettingForResponse(setting));
    } catch (error: any) {
      if (error.message?.includes("read-only")) {
        return res.status(403).json({ error: error.message });
      }
      console.error("Failed to set setting:", error);
      res.status(500).json({ error: "Failed to set setting" });
    }
  });

  app.delete("/api/admin/settings/:namespace/:key", authMiddleware, requireCapability("admin:danger"), async (req, res) => {
    try {
      const { namespace, key } = req.params;
      const deleted = await deleteSetting(namespace, key);
      if (!deleted) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json({ success: true, message: `Deleted ${namespace}:${key}` });
    } catch (error: any) {
      if (error.message?.includes("read-only")) {
        return res.status(403).json({ error: error.message });
      }
      console.error("Failed to delete setting:", error);
      res.status(500).json({ error: "Failed to delete setting" });
    }
  });

  // ============================================================================
  // SYMBOL UNIVERSE & TRADABILITY ENDPOINTS
  // ============================================================================

  app.get("/api/universe/stats", authMiddleware, async (req, res) => {
    try {
      const stats = await tradabilityService.getUniverseStats();
      res.json(stats);
    } catch (error) {
      console.error("Failed to get universe stats:", error);
      res.status(500).json({ error: "Failed to get universe stats" });
    }
  });

  app.get("/api/universe/symbols", authMiddleware, async (req, res) => {
    try {
      const { assetClass, tradableOnly, limit } = req.query;
      const assets = await storage.getBrokerAssets(
        assetClass as "us_equity" | "crypto" | undefined,
        tradableOnly === "true",
        limit ? parseInt(limit as string) : 1000
      );
      res.json({
        assets,
        count: assets.length,
      });
    } catch (error) {
      console.error("Failed to get symbols:", error);
      res.status(500).json({ error: "Failed to get symbols" });
    }
  });

  app.get("/api/universe/search", authMiddleware, async (req, res) => {
    try {
      const { q, limit } = req.query;
      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Search query required" });
      }
      const assets = await tradabilityService.searchSymbols(
        q,
        limit ? parseInt(limit as string) : 20
      );
      res.json({ assets, count: assets.length });
    } catch (error) {
      console.error("Failed to search symbols:", error);
      res.status(500).json({ error: "Failed to search symbols" });
    }
  });

  app.get("/api/universe/check/:symbol", authMiddleware, async (req, res) => {
    try {
      const { symbol } = req.params;
      const check = await tradabilityService.validateSymbolTradable(symbol);
      res.json(check);
    } catch (error) {
      console.error("Failed to check tradability:", error);
      res.status(500).json({ error: "Failed to check tradability" });
    }
  });

  app.post("/api/universe/sync", authMiddleware, async (req, res) => {
    try {
      const { assetClass } = req.body;
      
      await workQueue.enqueue({
        type: "ASSET_UNIVERSE_SYNC",
        status: "PENDING",
        payload: JSON.stringify({ assetClass: assetClass || "us_equity" }),
        maxAttempts: 3,
        nextRunAt: new Date(),
      });
      
      res.json({
        message: "Asset universe sync queued",
        assetClass: assetClass || "us_equity",
      });
    } catch (error) {
      console.error("Failed to queue universe sync:", error);
      res.status(500).json({ error: "Failed to queue universe sync" });
    }
  });

  app.post("/api/universe/sync-now", authMiddleware, async (req, res) => {
    try {
      const { assetClass } = req.body;
      const result = await tradabilityService.syncAssetUniverse(assetClass || "us_equity");
      tradabilityService.clearMemoryCache();
      res.json(result);
    } catch (error) {
      console.error("Failed to sync universe:", error);
      res.status(500).json({ error: "Failed to sync universe" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
