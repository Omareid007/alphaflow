/**
 * Alpaca Trading Engine Routes
 * Handles trading operations, analysis, and strategy management via alpacaTradingEngine
 */

import { Router, Request, Response } from "express";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";
import { safeParseFloat } from "../utils/numeric";
import { log } from "../utils/logger";

const router = Router();

// GET /api/alpaca-trading/status - Get Alpaca trading engine status
router.get("/status", async (req: Request, res: Response) => {
  try {
    const status = alpacaTradingEngine.getStatus();
    const connected = await alpacaTradingEngine.isAlpacaConnected();
    res.json({ ...status, alpacaConnected: connected });
  } catch (error) {
    log.error("AlpacaTradingAPI", "Failed to get Alpaca trading status", {
      error,
    });
    res.status(500).json({ error: "Failed to get Alpaca trading status" });
  }
});

// POST /api/alpaca-trading/execute - Execute a trade via Alpaca trading engine
router.post("/execute", async (req: Request, res: Response) => {
  try {
    const { symbol, side, quantity, strategyId, notes, orderType, limitPrice } =
      req.body;

    if (!symbol || !side || !quantity) {
      return res
        .status(400)
        .json({ error: "Symbol, side, and quantity are required" });
    }

    if (!["buy", "sell"].includes(side)) {
      return res.status(400).json({ error: "Side must be 'buy' or 'sell'" });
    }

    // SECURITY: Mark as authorized since this is an admin-initiated action
    const result = await alpacaTradingEngine.executeAlpacaTrade({
      symbol,
      side,
      quantity: safeParseFloat(quantity),
      strategyId,
      notes,
      orderType,
      limitPrice: limitPrice ? safeParseFloat(limitPrice) : undefined,
      authorizedByOrchestrator: true,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error("AlpacaTradingAPI", "Alpaca trade execution error", { error });
    res.status(500).json({ error: "Failed to execute Alpaca trade" });
  }
});

// POST /api/alpaca-trading/close/:symbol - Close a position for a symbol
router.post("/close/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { strategyId } = req.body;

    // SECURITY: Mark as authorized since this is an admin-initiated action
    const result = await alpacaTradingEngine.closeAlpacaPosition(
      symbol,
      strategyId,
      {
        authorizedByOrchestrator: true,
      }
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    log.error("AlpacaTradingAPI", "Close Alpaca position error", { error });
    res.status(500).json({ error: "Failed to close Alpaca position" });
  }
});

// POST /api/alpaca-trading/analyze - Analyze a symbol
router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { symbol, strategyId } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const result = await alpacaTradingEngine.analyzeSymbol(symbol, strategyId);
    res.json(result);
  } catch (error) {
    log.error("AlpacaTradingAPI", "Analyze symbol error", { error });
    res.status(500).json({ error: "Failed to analyze symbol" });
  }
});

// POST /api/alpaca-trading/analyze-execute - Analyze and execute trade for a symbol
router.post("/analyze-execute", async (req: Request, res: Response) => {
  try {
    const { symbol, strategyId } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const result = await alpacaTradingEngine.analyzeAndExecute(
      symbol,
      strategyId
    );
    res.json(result);
  } catch (error) {
    log.error("AlpacaTradingAPI", "Analyze and execute error", { error });
    res.status(500).json({ error: "Failed to analyze and execute trade" });
  }
});

// POST /api/alpaca-trading/stop-all - Stop all running strategies
router.post("/stop-all", async (req: Request, res: Response) => {
  try {
    await alpacaTradingEngine.stopAllStrategies();
    res.json({ success: true, message: "All strategies stopped" });
  } catch (error) {
    log.error("AlpacaTradingAPI", "Stop all strategies error", { error });
    res.status(500).json({ error: "Failed to stop all strategies" });
  }
});

export default router;
