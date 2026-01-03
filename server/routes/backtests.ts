import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  backtestRuns,
  backtestTradeEvents,
  backtestEquityCurve,
} from "@shared/schema";
import {
  runBacktest,
  getBacktestRun,
  listBacktestRuns,
} from "../services/backtesting";
import { eq, desc } from "drizzle-orm";
import { log } from "../utils/logger";
import { sanitizeArray } from "../lib/sanitization";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

router.post("/run", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      strategyId,
      strategyConfig,
      universe,
      timeframe = "1Day",
      startDate,
      endDate,
      initialCash = 10000,
      feesModel = { type: "fixed", value: 1 },
      slippageModel = { type: "bps", value: 5 },
      executionPriceRule = "NEXT_OPEN",
      strategyType = "moving_average_crossover",
      strategyParams = {},
    } = req.body;

    // Allow universe to be optional, but provide helpful validation
    if (universe && !Array.isArray(universe)) {
      return res
        .status(400)
        .json({ error: "universe must be an array of symbols" });
    }

    // If universe is not provided or empty, use a default set of popular symbols
    const defaultUniverse = ["SPY", "QQQ", "AAPL"];
    const backtestUniverse =
      universe && universe.length > 0 ? universe : defaultUniverse;

    if (backtestUniverse.length === 0) {
      return res.status(400).json({
        error:
          "universe must contain at least one symbol. Default symbols: SPY, QQQ, AAPL",
      });
    }
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate are required" });
    }

    const validStrategyTypes = [
      "moving_average_crossover",
      "rsi_oscillator",
      "buy_and_hold",
    ];
    if (strategyType && !validStrategyTypes.includes(strategyType)) {
      return res.status(400).json({
        error: `Invalid strategyType. Must be one of: ${validStrategyTypes.join(", ")}`,
      });
    }

    // SECURITY: Sanitize universe symbols to prevent XSS attacks
    const sanitizedUniverse = sanitizeArray(backtestUniverse);

    const result = await runBacktest({
      strategyId,
      strategyConfig: strategyConfig || {},
      universe: sanitizedUniverse,
      timeframe,
      startDate,
      endDate,
      initialCash,
      feesModel,
      slippageModel,
      executionPriceRule,
      strategyType,
      strategyParams: {
        fastPeriod: strategyParams.fastPeriod || 10,
        slowPeriod: strategyParams.slowPeriod || 20,
        period: strategyParams.period || 14,
        oversoldThreshold: strategyParams.oversoldThreshold || 30,
        overboughtThreshold: strategyParams.overboughtThreshold || 70,
        allocationPct: strategyParams.allocationPct || 10,
        ...strategyParams,
      },
    });

    res.json(result);
  } catch (error) {
    log.error("BacktestAPI", `Failed to run backtest: ${error}`);
    res
      .status(500)
      .json({ error: (error as Error).message || "Failed to run backtest" });
  }
});

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const runs = await listBacktestRuns(limit, offset);
    res.json({ runs, limit, offset });
  } catch (error) {
    log.error("BacktestAPI", `Failed to list backtests: ${error}`);
    res.status(500).json({ error: "Failed to list backtests" });
  }
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const run = await getBacktestRun(req.params.id);
    if (!run) {
      return res.status(404).json({ error: "Backtest not found" });
    }
    res.json(run);
  } catch (error) {
    log.error("BacktestAPI", `Failed to get backtest: ${error}`);
    res.status(500).json({ error: "Failed to get backtest" });
  }
});

router.get(
  "/:id/equity-curve",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const points = await db
        .select()
        .from(backtestEquityCurve)
        .where(eq(backtestEquityCurve.runId, req.params.id))
        .orderBy(backtestEquityCurve.ts);

      const formattedPoints = points.map((p) => ({
        ts: p.ts.toISOString(),
        equity: parseFloat(p.equity),
        cash: parseFloat(p.cash),
        exposure: parseFloat(p.exposure),
      }));

      res.json({ points: formattedPoints });
    } catch (error) {
      log.error("BacktestAPI", `Failed to get equity curve: ${error}`);
      res.status(500).json({ error: "Failed to get equity curve" });
    }
  }
);

router.get("/:id/trades", requireAuth, async (req: Request, res: Response) => {
  try {
    const trades = await db
      .select()
      .from(backtestTradeEvents)
      .where(eq(backtestTradeEvents.runId, req.params.id))
      .orderBy(backtestTradeEvents.ts);

    const formattedTrades = trades.map((t) => ({
      id: t.id,
      runId: t.runId,
      ts: t.ts.toISOString(),
      symbol: t.symbol,
      side: t.side,
      qty: parseFloat(t.qty),
      price: parseFloat(t.price),
      reason: t.reason,
      orderType: t.orderType,
      fees: parseFloat(t.fees),
      slippage: parseFloat(t.slippage),
      positionAfter: parseFloat(t.positionAfter),
      cashAfter: parseFloat(t.cashAfter),
    }));

    res.json({ trades: formattedTrades });
  } catch (error) {
    log.error("BacktestAPI", `Failed to get trades: ${error}`);
    res.status(500).json({ error: "Failed to get trades" });
  }
});

export default router;
