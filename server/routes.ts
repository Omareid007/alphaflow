import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import bcrypt from "bcryptjs";
import { createSession, getSession, deleteSession, cleanupExpiredSessions } from "./lib/session";
import { storage } from "./storage";
import { db, getPoolStats } from "./db";
import { sql, desc, eq } from "drizzle-orm";
import { allocationPolicies, rebalanceRuns, alertRules, universeFundamentals } from "@shared/schema";
import { badRequest, unauthorized, serverError, validationError } from "./lib/standard-errors";
import { sanitizeInput, sanitizeUserInput } from "./lib/sanitization";
import {
  insertUserSchema,
  insertStrategySchema,
  insertTradeSchema,
  insertPositionSchema,
  insertAiDecisionSchema,
  type Fill,
  type Order,
  type Trade,
  type Position,
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
import { generateTraceId, getLLMCacheStats, clearLLMCache, clearLLMCacheForRole, resetLLMCacheStats } from "./ai/llmGateway";
import { dataFusionEngine } from "./fusion/data-fusion-engine";
// DEPRECATED: paperTradingEngine is no longer used in UI paths - Alpaca is source of truth
// import { paperTradingEngine } from "./trading/paper-trading-engine";
import { alpacaTradingEngine } from "./trading/alpaca-trading-engine";
import { alpacaStream } from "./trading/alpaca-stream";
import { tradingSessionManager } from "./services/trading-session-manager";
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
import { observabilityRouter } from "./observability/routes";
import debateRouter from "./routes/debate";
import toolsRouter from "./routes/tools";
import competitionRouter from "./routes/competition";
import strategiesRouter from "./routes/strategies";
import arenaRouter from "./routes/arena";
import jinaRouter from "./routes/jina";
import macroRouter from "./routes/macro";
import enrichmentRouter from "./routes/enrichment";
import providersRouter from "./routes/providers";
// Newly modularized routes
import authRouter from "./routes/auth";
import positionsRouter from "./routes/positions";
import ordersRouter from "./routes/orders";
import tradesRouter from "./routes/trades";
import marketDataRouter from "./routes/market-data";
import webhooksRouter from "./routes/webhooks";
import aiDecisionsRouter from "./routes/ai-decisions";
import { registerAutonomousRoutes } from "./routes/autonomous";
import cacheRouter from "./routes/cache";
import llmRouter from "./routes/llm";
import adminRouter from "./routes/admin";
import notificationsRouter from "./routes/notifications";
import allocationRebalanceRouter from "./routes/allocation-rebalance";
import enforcementFundamentalsRouter from "./routes/enforcement-fundamentals";
import { registerPortfolioTradingRoutes } from "./routes/portfolio-trading";
import alpacaRouter from "./routes/alpaca";
import alpacaTradingRouter from "./routes/alpaca-trading";
import uaeMarketsRouter from "./routes/uae-markets";
import newsRouter from "./routes/news";
import cmcRouter from "./routes/cmc";
import tradingSessionsRouter from "./routes/trading-sessions";
import feedsRouter from "./routes/feeds";
import connectorsRouter from "./routes/connectors";
import fusionRouter from "./routes/fusion";
import marketQuotesRouter from "./routes/market-quotes";
import healthRouter from "./routes/health";
import aiAnalysisRouter from "./routes/ai-analysis";
import agentControlRouter from "./routes/agent-control";
import activityRouter from "./routes/activity";
import performanceRouter from "./routes/performance";
import analyticsRouter from "./routes/analytics";
import cryptoRouter from "./routes/crypto";
import stockRouter from "./routes/stock";
import { enrichmentScheduler } from "./services/enrichment-scheduler";
import { alertService } from "./observability/alertService";
import { initializeDefaultModules, getModules, getModule, getAdminOverview } from "./admin/registry";
import { createRBACContext, hasCapability, filterModulesByCapability, getAllRoles, getRoleInfo, type RBACContext } from "./admin/rbac";
import { getSetting, getSettingFull, setSetting, deleteSetting, listSettings, sanitizeSettingForResponse } from "./admin/settings";
import { globalSearch, getRelatedEntities } from "./admin/global-search";
import { alpacaUniverseService, liquidityService, fundamentalsService, candidatesService, tradingEnforcementService, allocationService, rebalancerService } from "./universe";
import type { AdminCapability } from "@shared/types/admin-module";
import { auditLogger } from "./middleware/audit-logger";
import { log } from "./utils/logger";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    rbac?: RBACContext;
  }
}

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

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      log.warn("Auth", "No session cookie found for request:", { path: req.path });
      return res.status(401).json({
        error: "Not authenticated",
        code: "NO_SESSION",
        message: "Please log in to access this resource"
      });
    }

    const session = await getSession(sessionId);
    if (!session) {
      log.warn("Auth", "Session expired or invalid:", { sessionId: sessionId.substring(0, 8) + '...' });
      return res.status(401).json({
        error: "Session expired",
        code: "SESSION_EXPIRED",
        message: "Your session has expired. Please log in again."
      });
    }

    req.userId = session.userId;
    next();
  } catch (error) {
    log.error("Auth", "Middleware error", { error: error });
    return res.status(500).json({
      error: "Authentication error",
      code: "AUTH_ERROR",
      message: "An error occurred while verifying your session"
    });
  }
}

async function adminTokenMiddleware(req: Request, res: Response, next: NextFunction) {
  const adminToken = process.env.ADMIN_TOKEN;
  const headerToken = req.headers["x-admin-token"] as string;

  if (adminToken && headerToken === adminToken) {
    req.userId = "admin-token-user";
    return next();
  }

  const sessionId = req.cookies?.session;
  if (sessionId) {
    const session = await getSession(sessionId);
    if (session) {
      req.userId = session.userId;
      return next();
    }
  }

  return res.status(401).json({ error: "Admin authentication required. Provide valid session or X-Admin-Token header." });
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
  log.info("Routes", "Starting route registration...");
  
  // Initialize admin module registry
  initializeDefaultModules();
  log.info("Routes", "Admin module registry initialized");
  
  // Delay async initializations to let server start first
  setTimeout(() => {
    log.info("Routes", "Starting delayed initializations...");
    coordinator.start().catch(err =>
      log.error("Routes", "Failed to start trading coordinator", { error: err })
    );
    alpacaTradingEngine.initialize().catch(err =>
      log.error("Routes", "Failed to initialize Alpaca trading engine", { error: err })
    );
    orchestrator.autoStart().catch(err =>
      log.error("Routes", "Failed to auto-start orchestrator", { error: err })
    );
    // Start the work queue worker for durable order execution
    workQueue.startWorker(5000);
    log.info("Routes", "Work queue worker started with 5s poll interval");
    
    // Connect to Alpaca WebSocket for real-time trade updates
    alpacaStream.connect().catch((err) => {
      log.error("Routes", "Failed to connect to Alpaca stream", { error: err });
    });
    log.info("Routes", "Alpaca trade updates stream connecting...");
    
    // Start periodic order reconciler (every 45 seconds)
    setInterval(async () => {
      try {
        const traceId = `reconcile-${Date.now()}`;
        await workQueue.enqueue({
          type: "ORDER_SYNC",
          payload: JSON.stringify({ traceId }),
          idempotencyKey: `ORDER_SYNC:periodic:${Math.floor(Date.now() / 45000)}`,
        });
        log.info("Routes", "Periodic order reconciliation triggered");
      } catch (err) {
        log.error("Routes", "Failed to trigger order reconciliation", { error: err });
      }
    }, 45000);
    log.info("Routes", "Order reconciliation job scheduled (45s interval)");
  }, 2000);

  // Bootstrap admin user deferred to background to not block startup
  setTimeout(async () => {
    try {
      log.info("Bootstrap", "Checking for admin user...");
      const adminUser = await storage.getUserByUsername("admintest");
      log.info("Bootstrap", "Admin user check complete:", { status: adminUser ? "exists" : "not found" });
      if (!adminUser) {
        const hashedPassword = await bcrypt.hash("admin1234", 10);
        await storage.createUser({ username: "admintest", password: hashedPassword, isAdmin: true });
        log.info("Bootstrap", "Created admin user: admintest");
      } else {
        if (!adminUser.isAdmin) {
          await storage.updateUser(adminUser.id, { isAdmin: true });
          log.info("Bootstrap", "Promoted admintest to admin");
        } else {
          log.info("Bootstrap", "Admin user admintest already exists");
        }
      }
    } catch (err) {
      log.error("Bootstrap", "Failed to create admin user", { error: err });
    }
  }, 3000);
  log.info("Routes", "Continuing registration (admin bootstrap deferred)...");

  // Apply audit logging middleware globally for all API routes
  // This will log all POST/PUT/PATCH/DELETE operations
  app.use("/api", auditLogger);
  log.info("Routes", "Audit logging middleware enabled for all API routes");

  app.use("/api/backtests", authMiddleware, backtestsRouter);
  app.use("/api/traces", authMiddleware, tracesRouter);
  app.use("/api/admin/observability", authMiddleware, observabilityRouter);
  app.use("/api/admin/providers", authMiddleware, providersRouter);

  app.use("/api/debate", authMiddleware, debateRouter);
  app.use("/api/tools", authMiddleware, toolsRouter);
  app.use("/api/competition", authMiddleware, competitionRouter);
  app.use("/api/strategies", authMiddleware, strategiesRouter);
  app.use("/api/arena", authMiddleware, arenaRouter);
  app.use("/api/jina", authMiddleware, jinaRouter);
  app.use("/api/macro", authMiddleware, macroRouter);
  app.use("/api/enrichment", authMiddleware, enrichmentRouter);

  // Newly modularized routes
  app.use("/api/auth", authRouter); // auth routes: /api/auth/login, /api/auth/signup, /api/auth/logout, /api/auth/me
  app.use("/api/positions", authMiddleware, positionsRouter); // positions routes
  app.use("/api/orders", authMiddleware, ordersRouter); // orders routes
  app.use("/api/trades", authMiddleware, tradesRouter); // trades routes
  app.use("/api", authMiddleware, marketDataRouter); // market-data routes
  app.use("/api/webhooks", authMiddleware, webhooksRouter); // webhooks routes
  app.use("/api", authMiddleware, aiDecisionsRouter); // ai-decisions routes
  registerAutonomousRoutes(app, authMiddleware); // autonomous routes
  app.use("/api", authMiddleware, cacheRouter); // cache routes
  app.use("/api/llm", authMiddleware, llmRouter); // llm routes
  app.use("/api/admin", authMiddleware, adminRouter); // admin routes (modular)
  app.use("/api/notifications", authMiddleware, notificationsRouter); // notification routes
  app.use("/api", authMiddleware, allocationRebalanceRouter); // allocation & rebalance routes
  app.use("/api", enforcementFundamentalsRouter); // enforcement & fundamentals routes
  registerPortfolioTradingRoutes(app); // portfolio & trading utility routes
  app.use("/api/alpaca", authMiddleware, alpacaRouter); // alpaca broker API routes
  app.use("/api/alpaca-trading", authMiddleware, alpacaTradingRouter); // alpaca trading engine routes
  app.use("/api/crypto", cryptoRouter); // crypto market routes (public)
  app.use("/api/stock", stockRouter); // stock market routes (public)
  app.use("/api/analytics", authMiddleware, analyticsRouter); // analytics routes
  app.use("/api/uae", uaeMarketsRouter); // UAE markets routes (public)
  app.use("/api/news", newsRouter); // news API routes (public)
  app.use("/api/cmc", cmcRouter); // CoinMarketCap routes (public)
  app.use("/api/trading-sessions", authMiddleware, tradingSessionsRouter); // trading session routes
  app.use("/api/feeds", authMiddleware, feedsRouter); // data feeds status
  app.use("/api/connectors", authMiddleware, connectorsRouter); // connector status
  app.use("/api/fusion", authMiddleware, fusionRouter); // data fusion routes
  app.use("/api/market", authMiddleware, marketQuotesRouter); // market quotes
  app.use("/api/health", authMiddleware, healthRouter); // health checks
  app.use("/api/ai", authMiddleware, aiAnalysisRouter); // AI analysis routes
  app.use("/api/agent", authMiddleware, agentControlRouter); // agent control
  app.use("/api/activity", authMiddleware, activityRouter); // activity timeline
  app.use("/api/performance", authMiddleware, performanceRouter); // performance metrics

  alertService.startEvaluationJob(60000);
  enrichmentScheduler.start();

  // Auth routes handled by authRouter at /api/auth/*

  // Server-Sent Events endpoint for real-time updates
  app.get("/api/events", async (req, res) => {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: "Session expired" });
    }

    const userId = session.userId;
    const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Import SSE emitter
    const { sseEmitter } = require("./lib/sse-emitter");

    // Add client to SSE pool
    sseEmitter.addClient(clientId, res, userId);

    // Keep connection alive
    req.on("close", () => {
      sseEmitter.removeClient(clientId, userId);
    });
  });


  app.delete("/api/alpaca/orders/:orderId", authMiddleware, async (req, res) => {
    try {
      await alpaca.cancelOrder(req.params.orderId);
      res.status(204).send();
    } catch (error) {
      log.error("Routes", "Failed to cancel Alpaca order", { error: error });
      res.status(500).json({ error: "Failed to cancel Alpaca order" });
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
  } = await import('./lib/notification-service');

  type NotificationChannel = import('./lib/notification-service').NotificationChannel;
  type NotificationTemplate = import('./lib/notification-service').NotificationTemplate;

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

  // ============================================================
  // ============================================================================

  // ============================================================================

  // ============================================================================

  // ============================================================================

  // ============================================================================

  // ============================================================================

  const httpServer = createServer(app);

  return httpServer;
}
