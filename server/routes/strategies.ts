import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../utils/logger";
import { badRequest, notFound, serverError, validationError } from "../lib/standard-errors";
import { sanitizeInput, sanitizeStrategyInput } from "../lib/sanitization";
import type { InsertStrategyVersion } from "@shared/schema";

const router = Router();

router.get("/versions", async (req: Request, res: Response) => {
  try {
    const strategyId = req.query.strategyId as string;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!strategyId) {
      return badRequest(res, "strategyId is required");
    }

    const versions = await storage.getStrategyVersionsByStrategy(strategyId);
    res.json({ versions, count: versions.length });
  } catch (error) {
    log.error("StrategiesAPI", `Failed to list strategy versions: ${error}`);
    return serverError(res, "Failed to list strategy versions");
  }
});

router.post("/versions", async (req: Request, res: Response) => {
  try {
    const {
      strategyId,
      name,
      spec,
      createdBy,
      universeConfig,
      signalsConfig,
      riskConfig,
      executionConfig,
      backtestResultId,
      description
    } = req.body;

    if (!strategyId || !name || !spec) {
      return badRequest(res, "strategyId, name, and spec are required");
    }

    // SECURITY: Sanitize strategy input to prevent XSS attacks
    const sanitizedName = sanitizeInput(name);
    const sanitizedDescription = description ? sanitizeInput(description) : undefined;

    const version = await storage.getNextVersionNumber(strategyId);

    const strategyVersion = await storage.createStrategyVersion({
      strategyId,
      name: sanitizedName,
      version,
      spec,
      createdBy,
      universeConfig,
      signalsConfig,
      riskConfig,
      executionConfig,
      backtestResultId,
      description: sanitizedDescription,
      status: "draft",
    } as InsertStrategyVersion);

    res.json(strategyVersion);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to create strategy version: ${error}`);
    return serverError(res, (error as Error).message || "Failed to create strategy version");
  }
});

router.get("/versions/:id", async (req: Request, res: Response) => {
  try {
    const version = await storage.getStrategyVersion(req.params.id);
    if (!version) {
      return notFound(res, "Strategy version not found");
    }
    res.json(version);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to get strategy version: ${error}`);
    return serverError(res, "Failed to get strategy version");
  }
});

router.patch("/versions/:id", async (req: Request, res: Response) => {
  try {
    // SECURITY: Sanitize strategy input to prevent XSS attacks
    const sanitizedBody = sanitizeStrategyInput(req.body);

    const version = await storage.updateStrategyVersion(req.params.id, sanitizedBody);
    if (!version) {
      return notFound(res, "Strategy version not found");
    }
    res.json(version);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to update strategy version: ${error}`);
    return serverError(res, (error as Error).message || "Failed to update strategy version");
  }
});

router.post("/versions/:id/activate", async (req: Request, res: Response) => {
  try {
    // 1. Get the strategy version to validate
    const version = await storage.getStrategyVersion(req.params.id);
    if (!version) {
      return notFound(res, "Strategy version not found");
    }

    // 2. BACKTEST VALIDATION GATE: Check if strategy has successful backtest
    if (version.strategyId) {
      const { db } = await import("../db");
      const { backtestRuns } = await import("@shared/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      // Query for successful backtests for this strategy
      const successfulBacktests = await db
        .select()
        .from(backtestRuns)
        .where(
          and(
            eq(backtestRuns.strategyId, version.strategyId),
            eq(backtestRuns.status, "DONE")
          )
        )
        .orderBy(desc(backtestRuns.createdAt))
        .limit(1);

      if (successfulBacktests.length === 0) {
        log.warn("StrategiesAPI", `Activation blocked for strategy version ${req.params.id}: No successful backtest found`);
        return validationError(
          res,
          "Strategy must have at least one successful backtest before activation. Please run a backtest and verify results before activating this strategy.",
          {
            strategyId: version.strategyId,
            strategyVersionId: req.params.id
          }
        );
      }

      log.info("StrategiesAPI", `Backtest validation passed for strategy version ${req.params.id}`, {
        strategyId: version.strategyId,
        backtestId: successfulBacktests[0].id,
        backtestDate: successfulBacktests[0].createdAt
      });
    }

    // 3. Activate the strategy version
    const updatedVersion = await storage.updateStrategyVersion(req.params.id, {
      status: "active",
      activatedAt: new Date(),
    });

    if (!updatedVersion) {
      return notFound(res, "Strategy version not found");
    }

    res.json(updatedVersion);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to activate strategy version: ${error}`);
    return serverError(res, (error as Error).message || "Failed to activate strategy version");
  }
});

router.post("/versions/:id/archive", async (req: Request, res: Response) => {
  try {
    const version = await storage.updateStrategyVersion(req.params.id, {
      status: "archived",
    });

    if (!version) {
      return res.status(404).json({ error: "Strategy version not found" });
    }

    res.json(version);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to archive strategy version: ${error}`);
    res.status(500).json({ error: (error as Error).message || "Failed to archive strategy version" });
  }
});

router.get("/versions/:strategyId/latest", async (req: Request, res: Response) => {
  try {
    const version = await storage.getLatestStrategyVersion(req.params.strategyId);
    if (!version) {
      return res.status(404).json({ error: "No versions found for this strategy" });
    }
    res.json(version);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to get latest strategy version: ${error}`);
    res.status(500).json({ error: "Failed to get latest strategy version" });
  }
});

// STRATEGY PERFORMANCE MONITORING DASHBOARD API
router.get("/:id/performance", async (req: Request, res: Response) => {
  try {
    const strategyId = req.params.id;

    // 1. Get strategy to verify it exists
    const strategy = await storage.getStrategy(strategyId);
    if (!strategy) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    // 2. Get real-time state from alpacaTradingEngine
    const { alpacaTradingEngine } = await import("../trading/alpaca-trading-engine");
    const strategyState = alpacaTradingEngine.getStrategyState(strategyId);

    // 3. Get all trades for this strategy from database
    const { db } = await import("../db");
    const { trades } = await import("@shared/schema");
    const { eq, and, isNotNull, sql } = await import("drizzle-orm");

    const allTrades = await db
      .select()
      .from(trades)
      .where(eq(trades.strategyId, strategyId))
      .orderBy(sql`${trades.executedAt} DESC`)
      .limit(1000);

    // 4. Calculate metrics from trades
    const totalTrades = allTrades.length;

    // Separate opening and closing trades
    const closingTrades = allTrades.filter(t => t.pnl !== null && t.pnl !== "0");
    const winningTrades = closingTrades.filter(t => parseFloat(t.pnl || "0") > 0);
    const losingTrades = closingTrades.filter(t => parseFloat(t.pnl || "0") < 0);

    const winRate = closingTrades.length > 0
      ? (winningTrades.length / closingTrades.length) * 100
      : 0;

    // Calculate total P&L from all closing trades
    const totalPnl = closingTrades.reduce((sum, t) => {
      return sum + parseFloat(t.pnl || "0");
    }, 0);

    // Calculate average win and loss
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0) / winningTrades.length
      : 0;

    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0) / losingTrades.length
      : 0;

    // 5. Get current positions for this strategy
    const { positions } = await import("@shared/schema");
    const currentPositions = await db
      .select()
      .from(positions)
      .where(eq(positions.strategyId, strategyId));

    // Calculate unrealized P&L from positions
    const unrealizedPnl = currentPositions.reduce((sum, p) => {
      return sum + parseFloat(p.unrealizedPnl || "0");
    }, 0);

    // 6. Build performance response
    const performance = {
      strategyId,
      strategyName: strategy.name,
      status: strategyState?.isRunning ? "running" : "stopped",
      lastCheck: strategyState?.lastCheck || null,
      lastError: strategyState?.error || null,

      // Real-time metrics
      metrics: {
        totalTrades,
        closingTrades: closingTrades.length,
        openingTrades: totalTrades - closingTrades.length,

        // P&L metrics
        realizedPnl: totalPnl,
        unrealizedPnl,
        totalPnl: totalPnl + unrealizedPnl,

        // Win/Loss metrics
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: parseFloat(winRate.toFixed(2)),

        // Average trade metrics
        avgWin: parseFloat(avgWin.toFixed(2)),
        avgLoss: parseFloat(avgLoss.toFixed(2)),
        avgTrade: closingTrades.length > 0
          ? parseFloat((totalPnl / closingTrades.length).toFixed(2))
          : 0,

        // Profit factor (avg win / abs(avg loss))
        profitFactor: avgLoss !== 0
          ? parseFloat((avgWin / Math.abs(avgLoss)).toFixed(2))
          : avgWin > 0 ? Infinity : 0,
      },

      // Current positions
      positions: currentPositions.map(p => ({
        id: p.id,
        symbol: p.symbol,
        side: p.side,
        quantity: parseFloat(p.quantity),
        entryPrice: parseFloat(p.entryPrice),
        currentPrice: parseFloat(p.currentPrice || p.entryPrice),
        unrealizedPnl: parseFloat(p.unrealizedPnl || "0"),
        openedAt: p.openedAt,
      })),

      // Recent trades (last 10)
      recentTrades: allTrades.slice(0, 10).map(t => ({
        id: t.id,
        symbol: t.symbol,
        side: t.side,
        quantity: parseFloat(t.quantity),
        price: parseFloat(t.price),
        pnl: t.pnl ? parseFloat(t.pnl) : null,
        status: t.status,
        executedAt: t.executedAt,
        notes: t.notes,
      })),

      // Last decision info (if available)
      lastDecision: strategyState?.lastDecision ? {
        action: strategyState.lastDecision.action,
        confidence: strategyState.lastDecision.confidence,
        reasoning: strategyState.lastDecision.reasoning,
        riskLevel: strategyState.lastDecision.riskLevel,
      } : null,
    };

    res.json(performance);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to get strategy performance: ${error}`);
    res.status(500).json({ error: (error as Error).message || "Failed to get strategy performance" });
  }
});

export default router;
