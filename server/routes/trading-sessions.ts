import { Router, Request, Response } from "express";
import { tradingSessionManager } from "../services/trading-session-manager";
import { log } from "../utils/logger";

const router = Router();

/**
 * GET /api/trading-sessions/all
 * Get all trading sessions info
 */
router.get("/all", async (req: Request, res: Response) => {
  try {
    const allSessions = tradingSessionManager.getAllSessionInfo();
    res.json({
      sessions: allSessions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("TradingSessionsRoutes", "Failed to get all trading sessions", {
      error: error,
    });
    res.status(500).json({ error: "Failed to get trading sessions" });
  }
});

/**
 * GET /api/trading-sessions/:exchange
 * Get current session for a specific exchange
 */
router.get("/:exchange", async (req: Request, res: Response) => {
  try {
    const { exchange } = req.params;
    const session = tradingSessionManager.getCurrentSession(
      exchange.toUpperCase()
    );
    const config = tradingSessionManager.getSessionConfig(
      exchange.toUpperCase()
    );

    res.json({
      exchange: exchange.toUpperCase(),
      session,
      config,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("TradingSessionsRoutes", "Failed to get trading session", {
      error: error,
    });
    res.status(500).json({ error: "Failed to get trading session" });
  }
});

/**
 * GET /api/trading-sessions/:exchange/is-open
 * Check if market is currently open for an exchange
 */
router.get("/:exchange/is-open", async (req: Request, res: Response) => {
  try {
    const { exchange } = req.params;
    const isOpen = tradingSessionManager.isMarketOpen(exchange.toUpperCase());

    res.json({
      exchange: exchange.toUpperCase(),
      isOpen,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("TradingSessionsRoutes", "Failed to check if market is open", {
      error: error,
    });
    res.status(500).json({ error: "Failed to check market status" });
  }
});

/**
 * GET /api/trading-sessions/:exchange/next-open
 * Get next market open time for an exchange
 */
router.get("/:exchange/next-open", async (req: Request, res: Response) => {
  try {
    const { exchange } = req.params;
    const nextOpen = tradingSessionManager.getNextMarketOpen(
      exchange.toUpperCase()
    );

    res.json({
      exchange: exchange.toUpperCase(),
      nextOpen: nextOpen?.toISOString() || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("TradingSessionsRoutes", "Failed to get next market open", {
      error: error,
    });
    res.status(500).json({ error: "Failed to get next market open" });
  }
});

/**
 * GET /api/trading-sessions/:exchange/volatility
 * Get volatility multiplier for current session
 */
router.get("/:exchange/volatility", async (req: Request, res: Response) => {
  try {
    const { exchange } = req.params;
    const session = tradingSessionManager.getCurrentSession(
      exchange.toUpperCase()
    );
    const volatilityMultiplier =
      tradingSessionManager.getSessionVolatilityMultiplier(
        exchange.toUpperCase(),
        session.session
      );

    res.json({
      exchange: exchange.toUpperCase(),
      session: session.session,
      volatilityMultiplier,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("TradingSessionsRoutes", "Failed to get volatility multiplier", {
      error: error,
    });
    res.status(500).json({ error: "Failed to get volatility multiplier" });
  }
});

export default router;
