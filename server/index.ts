// Load environment variables from .env file with OVERRIDE enabled
// This ensures .env values ALWAYS take precedence over Replit Secrets
import * as dotenv from "dotenv";
dotenv.config({ override: true });

import express from "express";
import type { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";
import { log, createRequestLogger } from "./utils/logger";
import { validateAndReportEnvironment } from "./config/env-validator";
import { positionReconciliationJob } from "./jobs/position-reconciliation";
import { exitRuleEnforcer } from "./autonomous/exit-rule-enforcer";
import { alpaca } from "./connectors/alpaca";
import { positionManager } from "./trading/position-manager";
import { cleanupExpiredSessions } from "./lib/session";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { requestLogger, performanceLogger } from "./middleware/request-logger";
import { wsServer } from "./lib/websocket-server";
import {
  initializePortfolioStream,
  getPortfolioStreamManager,
} from "./lib/portfolio-stream";
import { initRedis, closeRedis, isRedisAvailable } from "./lib/redis-cache";

process.on("uncaughtException", (err) => {
  log.error("FATAL", "Uncaught exception", { error: err });
});

process.on("unhandledRejection", (reason, promise) => {
  log.error("FATAL", "Unhandled rejection", { promise, reason });
});

// Graceful shutdown handler
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info("SHUTDOWN", `${signal} received, starting graceful shutdown...`);

  try {
    // Stop accepting new requests
    if (global.httpServer) {
      log.info("SHUTDOWN", "Closing HTTP server...");
      await new Promise<void>((resolve) => {
        global.httpServer.close(() => {
          log.info("SHUTDOWN", "HTTP server closed");
          resolve();
        });
      });
    }

    // Shutdown WebSocket server
    log.info("SHUTDOWN", "Shutting down WebSocket server...");
    wsServer.shutdown();
    log.info("SHUTDOWN", "WebSocket server shutdown complete");

    // Shutdown portfolio stream (real-time updates)
    log.info("SHUTDOWN", "Shutting down portfolio stream...");
    const portfolioStream = getPortfolioStreamManager();
    if (portfolioStream) {
      portfolioStream.shutdown();
      log.info("SHUTDOWN", "Portfolio stream shutdown complete");
    } else {
      log.info("SHUTDOWN", "Portfolio stream not initialized - skipping");
    }

    // Stop background jobs
    log.info("SHUTDOWN", "Stopping background jobs...");
    positionReconciliationJob.stop();
    exitRuleEnforcer.stop();
    log.info("SHUTDOWN", "Background jobs stopped");

    // Drain work queue
    const { workQueue } = await import("./lib/work-queue");
    log.info("SHUTDOWN", "Draining work queue...");
    await workQueue.drain();
    log.info("SHUTDOWN", "Work queue drained");

    // Disconnect Redis
    log.info("SHUTDOWN", "Disconnecting Redis...");
    await closeRedis();
    log.info("SHUTDOWN", "Redis disconnected");

    // Close database connection
    const { db } = await import("./db");
    log.info("SHUTDOWN", "Closing database pool...");
    await db.$client.end();
    log.info("SHUTDOWN", "Database pool closed");

    log.info("SHUTDOWN", "Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    log.error("SHUTDOWN", "Error during graceful shutdown", { error });
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("beforeExit", (code) => log.info("PROCESS", "beforeExit", { code }));
process.on("exit", (code) => log.info("PROCESS", "exit", { code }));

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare global {
  var httpServer: import("http").Server;
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    // Allow requests with no origin (native apps like Expo Go, same-origin, curl, etc.)
    // or with an origin matching our allowed Replit domains
    if (!origin || origins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin || "*");
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  // Use new structured request logger with correlation IDs
  app.use(requestLogger);
  // Log slow requests (> 1 second)
  app.use(performanceLogger(1000));
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log.debug("Server", "Landing page URL generation", { baseUrl, expsUrl });

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  log.info("Server", "Serving static Expo files with dynamic manifest routing");

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  log.info(
    "Server",
    "Expo routing: Checking expo-platform header on / and /manifest"
  );
}

function setupErrorHandler(app: express.Application) {
  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);
}

// Verify Alpaca account on startup to catch credential mismatches early
async function verifyAlpacaAccount() {
  const apiKey = process.env.ALPACA_API_KEY;
  const maskedKey = apiKey
    ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`
    : "NOT SET";

  log.info("ALPACA_VERIFY", `Using API Key: ${maskedKey}`);

  try {
    const account = await alpaca.getAccount();
    log.info("ALPACA_VERIFY", `Connected to Alpaca account: ${account.id}`);
    log.info("ALPACA_VERIFY", `Account Status: ${account.status}`);
    log.info(
      "ALPACA_VERIFY",
      `Buying Power: $${parseFloat(account.buying_power).toFixed(2)}`
    );
    log.info(
      "ALPACA_VERIFY",
      `Portfolio Value: $${parseFloat(account.portfolio_value).toFixed(2)}`
    );
    return true;
  } catch (error) {
    log.error("ALPACA_VERIFY", "Failed to connect to Alpaca", { error });
    log.warn(
      "ALPACA_VERIFY",
      "Server will continue but trading features may not work"
    );
    return false;
  }
}

(async () => {
  try {
    // Validate environment variables before any initialization
    validateAndReportEnvironment();

    // Verify Alpaca account credentials
    log.info("STARTUP", "Verifying Alpaca account...");
    await verifyAlpacaAccount();

    // Sync orders from Alpaca (fixes TE-003: bi-directional order sync)
    log.info("STARTUP", "Syncing orders from Alpaca...");
    try {
      const syncResult = await positionManager.syncOrdersFromAlpaca();
      log.info("STARTUP", "Order sync completed", {
        created: syncResult.created.length,
        skipped: syncResult.skipped.length,
        errors: syncResult.errors.length,
      });
    } catch (error) {
      log.warn("STARTUP", "Order sync failed - will continue without sync", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Initialize Redis for caching (only if explicitly configured)
    if (process.env.REDIS_HOST) {
      log.info("STARTUP", "Initializing Redis connection...");
      await initRedis();
      if (isRedisAvailable()) {
        log.info("STARTUP", "Redis connection established successfully");
      } else {
        log.warn(
          "STARTUP",
          "Redis unavailable - will continue without caching"
        );
      }
    } else {
      log.info(
        "STARTUP",
        "Redis not configured - skipping cache initialization"
      );
    }

    log.info("STARTUP", "Beginning server initialization...");
    setupCors(app);

    // Security headers via helmet
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com",
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https:", "wss:"],
          },
        },
        crossOriginEmbedderPolicy: false, // Required for some external resources
        crossOriginResourcePolicy: { policy: "cross-origin" },
      })
    );
    log.info("STARTUP", "Security headers configured (helmet)");

    setupBodyParsing(app);
    app.use(cookieParser());
    setupRequestLogging(app);

    configureExpoAndLanding(app);

    log.info("STARTUP", "Registering routes...");
    const server = await registerRoutes(app);
    log.info("STARTUP", "Routes registered successfully");

    // Start position reconciliation job after routes are initialized
    log.info("STARTUP", "Starting position reconciliation job...");
    positionReconciliationJob.start();
    log.info("STARTUP", "Position reconciliation job started");

    // Start exit rule enforcer for automated stop-loss/take-profit
    log.info("STARTUP", "Starting exit rule enforcer...");
    exitRuleEnforcer.start(30000); // 30-second check interval
    log.info("STARTUP", "Exit rule enforcer started (30s interval)");

    // Start session cleanup job - runs every hour
    log.info("STARTUP", "Starting session cleanup job...");
    setInterval(
      async () => {
        try {
          await cleanupExpiredSessions();
        } catch (error) {
          log.error("SessionCleanup", "Error cleaning up expired sessions", {
            error,
          });
        }
      },
      60 * 60 * 1000
    ); // Every hour
    log.info("STARTUP", "Session cleanup job started (runs every hour)");

    setupErrorHandler(app);

    const port = parseInt(process.env.PORT || "5000", 10);
    log.info("STARTUP", `Starting server on port ${port}...`);

    // Store server globally for graceful shutdown
    global.httpServer = server;

    // Initialize WebSocket server for real-time updates
    log.info("STARTUP", "Initializing WebSocket server...");
    wsServer.initialize(server);
    log.info("STARTUP", "WebSocket server initialized on /ws path");

    // Initialize portfolio stream for real-time portfolio updates
    log.info("STARTUP", "Initializing portfolio stream...");
    const portfolioStream = initializePortfolioStream(server);
    if (portfolioStream) {
      log.info("STARTUP", "Portfolio stream initialized on /ws/portfolio", {
        maxConnectionsPerUser: 5,
        maxTotalConnections: 100,
        batchWindowMs: 1000,
        heartbeatIntervalMs: 15000,
      });
    } else {
      log.info(
        "STARTUP",
        "Portfolio stream disabled (ENABLE_REALTIME_PORTFOLIO=false)"
      );
    }

    server.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log.info("Server", `Express server listening on port ${port}`);
      }
    );
  } catch (error) {
    log.error("STARTUP", "Fatal error during server initialization", { error });
  }
})();
