import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../utils/logger";
import { badRequest, notFound, serverError, validationError } from "../lib/standard-errors";
import { sanitizeInput, sanitizeStrategyInput } from "../lib/sanitization";
import { insertStrategySchema, type InsertStrategyVersion } from "@shared/schema";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";

const router = Router();

// ============================================================================
// STRATEGY CRUD ROUTES
// ============================================================================

router.get("/", async (req: Request, res: Response) => {
  try {
    const strategies = await storage.getStrategies();
    res.json(strategies);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get strategies", { error });
    return serverError(res, "Failed to get strategies");
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const strategy = await storage.getStrategy(req.params.id);
    if (!strategy) {
      return notFound(res, "Strategy not found");
    }
    res.json(strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get strategy", { error });
    return serverError(res, "Failed to get strategy");
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = insertStrategySchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }
    const strategy = await storage.createStrategy(parsed.data);
    res.status(201).json(strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to create strategy", { error });
    return serverError(res, "Failed to create strategy");
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const strategy = await storage.updateStrategy(req.params.id, req.body);
    if (!strategy) {
      return notFound(res, "Strategy not found");
    }
    res.json(strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to update strategy", { error });
    return serverError(res, "Failed to update strategy");
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const strategy = await storage.updateStrategy(req.params.id, req.body);
    if (!strategy) {
      return notFound(res, "Strategy not found");
    }
    res.json(strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to update strategy", { error });
    return serverError(res, "Failed to update strategy");
  }
});

router.post("/:id/toggle", async (req: Request, res: Response) => {
  try {
    const currentStrategy = await storage.getStrategy(req.params.id);
    if (!currentStrategy) {
      return notFound(res, "Strategy not found");
    }
    const strategy = await storage.toggleStrategy(req.params.id, !currentStrategy.isActive);
    res.json(strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to toggle strategy", { error });
    return serverError(res, "Failed to toggle strategy");
  }
});

router.post("/:id/start", async (req: Request, res: Response) => {
  try {
    const strategy = await storage.getStrategy(req.params.id);
    if (!strategy) {
      return notFound(res, "Strategy not found");
    }
    const result = await alpacaTradingEngine.startStrategy(req.params.id);
    if (!result.success) {
      return badRequest(res, result.error || "Failed to start strategy");
    }
    const updatedStrategy = await storage.getStrategy(req.params.id);
    res.json(updatedStrategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to start strategy", { error });
    return serverError(res, "Failed to start strategy");
  }
});

router.post("/:id/stop", async (req: Request, res: Response) => {
  try {
    const strategy = await storage.getStrategy(req.params.id);
    if (!strategy) {
      return notFound(res, "Strategy not found");
    }
    const result = await alpacaTradingEngine.stopStrategy(req.params.id);
    if (!result.success) {
      return badRequest(res, result.error || "Failed to stop strategy");
    }
    const updatedStrategy = await storage.getStrategy(req.params.id);
    res.json(updatedStrategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to stop strategy", { error });
    return serverError(res, "Failed to stop strategy");
  }
});

router.get("/:id/status", async (req: Request, res: Response) => {
  try {
    const strategy = await storage.getStrategy(req.params.id);
    if (!strategy) {
      return notFound(res, "Strategy not found");
    }
    const strategyState = alpacaTradingEngine.getStrategyState(req.params.id);
    res.json({
      id: req.params.id,
      name: strategy.name,
      isActive: strategy.isActive,
      isRunning: strategyState?.isRunning ?? false,
      lastCheck: strategyState?.lastCheck ?? null,
      error: strategyState?.error ?? null,
    });
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get strategy status", { error });
    return serverError(res, "Failed to get strategy status");
  }
});

// ============================================================================
// STRATEGY SCHEMA ROUTES
// ============================================================================

router.get("/moving-average/schema", async (req: Request, res: Response) => {
  try {
    const { STRATEGY_SCHEMA } = await import("../strategies/moving-average-crossover");
    res.json(STRATEGY_SCHEMA);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get MA strategy schema", { error });
    return serverError(res, "Failed to get strategy schema");
  }
});

router.get("/mean-reversion/schema", async (req: Request, res: Response) => {
  try {
    const { STRATEGY_SCHEMA } = await import("../strategies/mean-reversion-scalper");
    res.json(STRATEGY_SCHEMA);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get mean reversion strategy schema", { error });
    return serverError(res, "Failed to get strategy schema");
  }
});

router.get("/momentum/schema", async (req: Request, res: Response) => {
  try {
    const { STRATEGY_SCHEMA } = await import("../strategies/momentum-strategy");
    res.json(STRATEGY_SCHEMA);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get momentum strategy schema", { error });
    return serverError(res, "Failed to get strategy schema");
  }
});

router.get("/all-schemas", async (req: Request, res: Response) => {
  try {
    const { ALL_STRATEGIES } = await import("../strategies/index");
    res.json(ALL_STRATEGIES);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get all strategy schemas", { error });
    return serverError(res, "Failed to get strategy schemas");
  }
});

// ============================================================================
// STRATEGY BACKTEST ROUTES
// ============================================================================

router.post("/moving-average/backtest", async (req: Request, res: Response) => {
  try {
    const { normalizeMovingAverageConfig, backtestMovingAverageStrategy } = await import("../strategies/moving-average-crossover");
    const config = normalizeMovingAverageConfig(req.body);
    const lookbackDays = parseInt(req.query.lookbackDays as string) || 365;
    const result = await backtestMovingAverageStrategy(config, lookbackDays);
    res.json(result);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to run MA backtest", { error });
    return serverError(res, (error as Error).message || "Failed to run backtest");
  }
});

router.post("/moving-average/ai-validate", async (req: Request, res: Response) => {
  try {
    const { normalizeMovingAverageConfig } = await import("../strategies/moving-average-crossover");
    const { validateMovingAverageConfig, getValidatorStatus } = await import("../ai/ai-strategy-validator");

    const status = getValidatorStatus();
    if (!status.available) {
      return res.status(503).json({ error: "AI validation service is not available" });
    }

    const config = normalizeMovingAverageConfig(req.body.config || req.body);
    const marketIntelligence = req.body.marketIntelligence;
    const result = await validateMovingAverageConfig(config, marketIntelligence);
    res.json(result);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to AI validate strategy", { error });
    return serverError(res, (error as Error).message || "Failed to validate strategy");
  }
});

router.post("/mean-reversion/backtest", async (req: Request, res: Response) => {
  try {
    const { normalizeMeanReversionConfig, backtestMeanReversionStrategy } = await import("../strategies/mean-reversion-scalper");
    const config = normalizeMeanReversionConfig(req.body);
    const lookbackDays = parseInt(req.query.lookbackDays as string) || 365;
    const result = await backtestMeanReversionStrategy(config, lookbackDays);
    res.json(result);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to run mean reversion backtest", { error });
    return serverError(res, (error as Error).message || "Failed to run backtest");
  }
});

router.post("/mean-reversion/signal", async (req: Request, res: Response) => {
  try {
    const { normalizeMeanReversionConfig, generateMeanReversionSignal } = await import("../strategies/mean-reversion-scalper");
    const config = normalizeMeanReversionConfig(req.body.config || req.body);
    const prices = req.body.prices as number[];

    if (!prices || !Array.isArray(prices) || prices.length < config.lookbackPeriod) {
      return badRequest(res, `Need at least ${config.lookbackPeriod} price points`);
    }

    const signal = generateMeanReversionSignal(prices, config);
    res.json(signal);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to generate mean reversion signal", { error });
    return serverError(res, (error as Error).message || "Failed to generate signal");
  }
});

router.post("/momentum/backtest", async (req: Request, res: Response) => {
  try {
    const { normalizeMomentumConfig, backtestMomentumStrategy } = await import("../strategies/momentum-strategy");
    const config = normalizeMomentumConfig(req.body);
    const lookbackDays = parseInt(req.query.lookbackDays as string) || 365;
    const result = await backtestMomentumStrategy(config, lookbackDays);
    res.json(result);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to run momentum backtest", { error });
    return serverError(res, (error as Error).message || "Failed to run backtest");
  }
});

router.post("/momentum/signal", async (req: Request, res: Response) => {
  try {
    const { normalizeMomentumConfig, generateMomentumSignal } = await import("../strategies/momentum-strategy");
    const config = normalizeMomentumConfig(req.body.config || req.body);
    const prices = req.body.prices as number[];

    const requiredLength = Math.max(config.lookbackPeriod, config.rsiPeriod) + 1;
    if (!prices || !Array.isArray(prices) || prices.length < requiredLength) {
      return badRequest(res, `Need at least ${requiredLength} price points`);
    }

    const signal = generateMomentumSignal(prices, config);
    res.json(signal);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to generate momentum signal", { error });
    return serverError(res, (error as Error).message || "Failed to generate signal");
  }
});

router.post("/backtest", async (req: Request, res: Response) => {
  try {
    const { strategyType, symbol, lookbackDays = 365 } = req.body;
    const parameters = req.body.parameters || {};

    if (!strategyType || typeof strategyType !== "string") {
      return badRequest(res, "strategyType is required");
    }
    if (!symbol || typeof symbol !== "string") {
      return badRequest(res, "symbol is required");
    }

    let result;

    switch (strategyType) {
      case "moving-average-crossover":
      case "moving-average": {
        const { normalizeMovingAverageConfig, backtestMovingAverageStrategy } = await import("../strategies/moving-average-crossover");
        const config = normalizeMovingAverageConfig({ symbol, ...parameters });
        result = await backtestMovingAverageStrategy(config, lookbackDays);
        break;
      }
      case "mean-reversion":
      case "mean-reversion-scalper": {
        const { normalizeMeanReversionConfig, backtestMeanReversionStrategy } = await import("../strategies/mean-reversion-scalper");
        const config = normalizeMeanReversionConfig({ symbol, ...parameters });
        result = await backtestMeanReversionStrategy(config, lookbackDays);
        break;
      }
      case "momentum":
      case "momentum-breakout": {
        const { normalizeMomentumConfig, backtestMomentumStrategy } = await import("../strategies/momentum-strategy");
        const config = normalizeMomentumConfig({ symbol, ...parameters });
        result = await backtestMomentumStrategy(config, lookbackDays);
        break;
      }
      case "range-trading":
      case "breakout": {
        const { normalizeMeanReversionConfig, backtestMeanReversionStrategy } = await import("../strategies/mean-reversion-scalper");
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
        const { normalizeMomentumConfig, backtestMomentumStrategy } = await import("../strategies/momentum-strategy");
        const config = normalizeMomentumConfig({ symbol, ...parameters });
        result = await backtestMomentumStrategy(config, lookbackDays);
        break;
      }
    }

    res.json(result);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to run generic backtest", { error });
    return serverError(res, (error as Error).message || "Failed to run backtest");
  }
});

router.post("/config", async (req: Request, res: Response) => {
  try {
    const { normalizeMovingAverageConfig } = await import("../strategies/moving-average-crossover");
    const config = normalizeMovingAverageConfig(req.body);
    res.json(config);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to normalize strategy config", { error });
    return serverError(res, (error as Error).message || "Failed to normalize config");
  }
});

router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { name, type, parameters } = req.body;
    const errors: string[] = [];

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      errors.push("Strategy name is required");
    }
    if (!type || typeof type !== "string") {
      errors.push("Strategy type is required");
    }
    if (!parameters || typeof parameters !== "object") {
      errors.push("Strategy parameters are required");
    }

    if (errors.length > 0) {
      return validationError(res, errors.join(", "));
    }

    res.json({ valid: true, name, type, parameters });
  } catch (error) {
    log.error("StrategiesAPI", "Failed to validate strategy", { error });
    return serverError(res, (error as Error).message || "Failed to validate strategy");
  }
});

// ============================================================================
// STRATEGY VERSION ROUTES
// ============================================================================

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
