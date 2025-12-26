import express from "express";
import type { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import * as fs from "fs";
import * as path from "path";
import { log, createRequestLogger } from "./utils/logger";
import { validateAndReportEnvironment } from "./config/env-validator";
import { positionReconciliationJob } from "./jobs/position-reconciliation";
import { cleanupExpiredSessions } from "./lib/session";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { requestLogger, performanceLogger } from "./middleware/request-logger";

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
});

process.on('SIGTERM', () => console.log('[SIGNAL] SIGTERM received'));
process.on('SIGINT', () => console.log('[SIGNAL] SIGINT received'));
process.on('beforeExit', (code) => console.log('[PROCESS] beforeExit with code:', code));
process.on('exit', (code) => console.log('[PROCESS] exit with code:', code));

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
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
        "GET, POST, PUT, DELETE, OPTIONS",
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
    }),
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
    "manifest.json",
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
    "landing-page.html",
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

  log.info("Server", "Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);
}

(async () => {
  try {
    // Validate environment variables before any initialization
    validateAndReportEnvironment();

    console.log("[STARTUP] Beginning server initialization...");
    setupCors(app);
    setupBodyParsing(app);
    app.use(cookieParser());
    setupRequestLogging(app);

    configureExpoAndLanding(app);

    console.log("[STARTUP] Registering routes...");
    const server = await registerRoutes(app);
    console.log("[STARTUP] Routes registered successfully");

    // Start position reconciliation job after routes are initialized
    console.log("[STARTUP] Starting position reconciliation job...");
    positionReconciliationJob.start();
    console.log("[STARTUP] Position reconciliation job started");

    // Start session cleanup job - runs every hour
    console.log("[STARTUP] Starting session cleanup job...");
    setInterval(async () => {
      try {
        await cleanupExpiredSessions();
      } catch (error) {
        console.error("[SessionCleanup] Error cleaning up expired sessions:", error);
      }
    }, 60 * 60 * 1000); // Every hour
    console.log("[STARTUP] Session cleanup job started (runs every hour)");

    setupErrorHandler(app);

    const port = parseInt(process.env.PORT || "5000", 10);
    console.log(`[STARTUP] Starting server on port ${port}...`);
    server.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log.info("Server", `Express server listening on port ${port}`);
      },
    );
  } catch (error) {
    console.error("[STARTUP] Fatal error during server initialization:", error);
  }
})();
