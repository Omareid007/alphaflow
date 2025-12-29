import type { Express, Request, Response, NextFunction } from "express";
import { getSession } from "../lib/session";
import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { log } from "../utils/logger";

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      log.warn("Auth", "No session cookie found for request:", {
        path: req.path,
      });
      return res.status(401).json({
        error: "Not authenticated",
        code: "NO_SESSION",
        message: "Please log in to access this resource",
      });
    }

    const session = await getSession(sessionId);
    if (!session) {
      log.warn("Auth", "Session expired or invalid:", {
        sessionId: sessionId.substring(0, 8) + "...",
      });
      return res.status(401).json({
        error: "Session expired",
        code: "SESSION_EXPIRED",
        message: "Your session has expired. Please log in again.",
      });
    }

    req.userId = session.userId;
    next();
  } catch (error) {
    log.error("Auth", "Authentication error:", { error });
    res.status(500).json({
      error: "Authentication failed",
      code: "AUTH_ERROR",
    });
  }
}

export function registerPortfolioTradingRoutes(app: Express) {
  app.post("/api/strategy-config", authMiddleware, async (req, res) => {
    try {
      const { normalizeMovingAverageConfig } =
        await import("../strategies/moving-average-crossover");
      const config = normalizeMovingAverageConfig(req.body);
      res.json(config);
    } catch (error) {
      log.error("Routes", "Failed to normalize strategy config", {
        error: error,
      });
      res
        .status(500)
        .json({
          error: (error as Error).message || "Failed to normalize config",
        });
    }
  });

  app.post("/api/strategy-validate", authMiddleware, async (req, res) => {
    try {
      const { normalizeMovingAverageConfig } =
        await import("../strategies/moving-average-crossover");
      const { validateMovingAverageConfig, getValidatorStatus } =
        await import("../ai/ai-strategy-validator");

      const status = getValidatorStatus();
      if (!status.available) {
        return res
          .status(503)
          .json({ error: "AI validation service is not available" });
      }

      const config = normalizeMovingAverageConfig(req.body.config || req.body);
      const result = await validateMovingAverageConfig(config);
      res.json(result);
    } catch (error) {
      log.error("Routes", "Failed to validate strategy", { error: error });
      res
        .status(500)
        .json({
          error: (error as Error).message || "Failed to validate strategy",
        });
    }
  });

  // Portfolio snapshot endpoint for Next.js dashboard (MUST be before /api/positions/:id)

  // Portfolio snapshot endpoint - comprehensive portfolio metrics
  app.get("/api/portfolio/snapshot", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId!;

      // Get account info from Alpaca
      const account = await alpaca.getAccount();

      // Get positions from database
      const positions = await storage.getPositions(userId);

      // Calculate metrics
      const totalEquity = parseFloat(account.equity);
      const totalCash = parseFloat(account.cash);
      const todayPnL =
        parseFloat(account.equity) - parseFloat(account.last_equity);
      const totalPositionValue = positions.reduce(
        (sum, pos) =>
          sum + parseFloat(pos.currentPrice || "0") * parseFloat(pos.quantity),
        0
      );

      res.json({
        totalEquity,
        totalCash,
        todayPnL,
        totalPositions: positions.length,
        totalPositionValue,
        buyingPower: parseFloat(account.buying_power),
        portfolioValue: parseFloat(account.portfolio_value),
        lastEquity: parseFloat(account.last_equity),
        accountStatus: account.status,
        daytradeCount: parseInt(String(account.daytrade_count)),
        patternDayTrader: account.pattern_day_trader,
      });
    } catch (error) {
      log.error("Routes", "Failed to get portfolio snapshot", { error: error });
      res.status(500).json({ error: "Failed to get portfolio snapshot" });
    }
  });

  // Trading candidates endpoint - get current trading opportunities
  app.get("/api/trading/candidates", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId!;

      // Get recent AI decisions that could be trading candidates
      const recentDecisions = await storage.getAiDecisions(userId, 50);

      // Filter for high-confidence buy/sell signals that haven't been executed
      const candidates = recentDecisions
        .filter(
          (d) =>
            (d.action === "buy" || d.action === "sell") &&
            d.status === "pending" &&
            parseFloat(d.confidence || "0") >= 0.6
        )
        .map((d) => ({
          symbol: d.symbol,
          action: d.action,
          confidence: d.confidence,
          reasoning: d.reasoning,
          createdAt: d.createdAt,
          entryPrice: d.entryPrice,
          stopLoss: d.stopLoss,
          takeProfit: d.takeProfit,
        }))
        .slice(0, 20);

      res.json(candidates);
    } catch (error) {
      log.error("Routes", "Failed to get trading candidates", { error: error });
      res.status(500).json({ error: "Failed to get trading candidates" });
    }
  });
}
