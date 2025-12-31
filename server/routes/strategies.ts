import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../utils/logger";
import {
  badRequest,
  notFound,
  serverError,
  validationError,
} from "../lib/standard-errors";
import { sanitizeInput, sanitizeStrategyInput } from "../lib/sanitization";
import {
  insertStrategySchema,
  type InsertStrategyVersion,
} from "@shared/schema";
import { deployStrategySchema } from "@shared/schema/trading";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";
import { strategyLifecycleService } from "../services/strategy-lifecycle-service";
import { strategyOrderService } from "../trading/strategy-order-service";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

// ============================================================================
// STRATEGY CRUD ROUTES
// ============================================================================

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const strategies = await storage.getStrategies();
    res.json(strategies);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get strategies", { error });
    return serverError(res, "Failed to get strategies");
  }
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
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

router.post("/", requireAuth, async (req: Request, res: Response) => {
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

router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
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

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
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

router.post("/:id/toggle", requireAuth, async (req: Request, res: Response) => {
  try {
    const currentStrategy = await storage.getStrategy(req.params.id);
    if (!currentStrategy) {
      return notFound(res, "Strategy not found");
    }
    const strategy = await storage.toggleStrategy(
      req.params.id,
      !currentStrategy.isActive
    );
    res.json(strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to toggle strategy", { error });
    return serverError(res, "Failed to toggle strategy");
  }
});

router.post("/:id/start", requireAuth, async (req: Request, res: Response) => {
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

router.post("/:id/stop", requireAuth, async (req: Request, res: Response) => {
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

router.get("/:id/status", requireAuth, async (req: Request, res: Response) => {
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
      status: strategy.status,
      mode: strategy.mode,
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
// STRATEGY LIFECYCLE ROUTES
// ============================================================================

/**
 * Deploy a strategy to paper or live trading
 * POST /api/strategies/:id/deploy
 * Body: { mode: "paper" | "live" }
 */
router.post("/:id/deploy", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = deployStrategySchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, "Mode must be 'paper' or 'live'");
    }

    const result = await strategyLifecycleService.deployStrategy(
      req.params.id,
      parsed.data.mode
    );

    if (!result.success) {
      return badRequest(res, result.error || "Failed to deploy strategy");
    }

    // Start the strategy in the trading engine
    await alpacaTradingEngine.startStrategy(req.params.id);

    res.json(result.strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to deploy strategy", { error });
    return serverError(res, "Failed to deploy strategy");
  }
});

/**
 * Pause a running strategy
 * POST /api/strategies/:id/pause
 */
router.post("/:id/pause", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await strategyLifecycleService.pauseStrategy(req.params.id);

    if (!result.success) {
      return badRequest(res, result.error || "Failed to pause strategy");
    }

    // Stop the strategy in the trading engine
    await alpacaTradingEngine.stopStrategy(req.params.id);

    res.json(result.strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to pause strategy", { error });
    return serverError(res, "Failed to pause strategy");
  }
});

/**
 * Resume a paused strategy
 * POST /api/strategies/:id/resume
 */
router.post("/:id/resume", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await strategyLifecycleService.resumeStrategy(req.params.id);

    if (!result.success) {
      return badRequest(res, result.error || "Failed to resume strategy");
    }

    // Start the strategy in the trading engine
    await alpacaTradingEngine.startStrategy(req.params.id);

    res.json(result.strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to resume strategy", { error });
    return serverError(res, "Failed to resume strategy");
  }
});

/**
 * Stop a strategy with optional position closing
 * POST /api/strategies/:id/lifecycle/stop
 * Body: { closePositions?: boolean }
 *
 * If closePositions is undefined and strategy has open positions,
 * returns requiresConfirmation: true with position count
 */
router.post("/:id/lifecycle/stop", requireAuth, async (req: Request, res: Response) => {
  try {
    const { closePositions } = req.body;

    const result = await strategyLifecycleService.stopStrategy(
      req.params.id,
      closePositions
    );

    if (!result.success) {
      // Check if we need user confirmation
      if (result.requiresConfirmation) {
        return res.status(200).json({
          requiresConfirmation: true,
          positionCount: result.positionCount,
          message: result.message,
        });
      }
      return badRequest(res, result.error || "Failed to stop strategy");
    }

    // Stop the strategy in the trading engine
    await alpacaTradingEngine.stopStrategy(req.params.id);

    res.json(result.strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to stop strategy (lifecycle)", { error });
    return serverError(res, "Failed to stop strategy");
  }
});

/**
 * Start backtesting for a strategy
 * POST /api/strategies/:id/backtest/start
 */
router.post("/:id/backtest/start", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await strategyLifecycleService.startBacktest(req.params.id);

    if (!result.success) {
      return badRequest(res, result.error || "Failed to start backtest");
    }

    res.json(result.strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to start backtest", { error });
    return serverError(res, "Failed to start backtest");
  }
});

/**
 * Complete backtesting and record results
 * POST /api/strategies/:id/backtest/complete
 * Body: { backtestId: string, performance?: PerformanceSummary }
 */
router.post("/:id/backtest/complete", requireAuth, async (req: Request, res: Response) => {
  try {
    const { backtestId, performance } = req.body;

    if (!backtestId) {
      return badRequest(res, "backtestId is required");
    }

    const result = await strategyLifecycleService.completeBacktest(
      req.params.id,
      backtestId,
      performance
    );

    if (!result.success) {
      return badRequest(res, result.error || "Failed to complete backtest");
    }

    res.json(result.strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to complete backtest", { error });
    return serverError(res, "Failed to complete backtest");
  }
});

/**
 * Reset a stopped strategy to draft
 * POST /api/strategies/:id/reset
 */
router.post("/:id/reset", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await strategyLifecycleService.resetToDraft(req.params.id);

    if (!result.success) {
      return badRequest(res, result.error || "Failed to reset strategy");
    }

    res.json(result.strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to reset strategy", { error });
    return serverError(res, "Failed to reset strategy");
  }
});

/**
 * Update performance metrics for a strategy
 * POST /api/strategies/:id/metrics/update
 */
router.post("/:id/metrics/update", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await strategyLifecycleService.updatePerformanceMetrics(
      req.params.id
    );

    if (!result.success) {
      return badRequest(res, result.error || "Failed to update metrics");
    }

    res.json(result.strategy);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to update strategy metrics", { error });
    return serverError(res, "Failed to update strategy metrics");
  }
});

/**
 * Get all running strategies
 * GET /api/strategies/running
 */
router.get("/running", requireAuth, async (req: Request, res: Response) => {
  try {
    const strategies = await strategyLifecycleService.getRunningStrategies();
    res.json(strategies);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get running strategies", { error });
    return serverError(res, "Failed to get running strategies");
  }
});

// ============================================================================
// STRATEGY SCHEMA ROUTES
// ============================================================================

router.get("/moving-average/schema", requireAuth, async (req: Request, res: Response) => {
  try {
    const { STRATEGY_SCHEMA } =
      await import("../strategies/moving-average-crossover");
    res.json(STRATEGY_SCHEMA);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get MA strategy schema", { error });
    return serverError(res, "Failed to get strategy schema");
  }
});

router.get("/mean-reversion/schema", requireAuth, async (req: Request, res: Response) => {
  try {
    const { STRATEGY_SCHEMA } =
      await import("../strategies/mean-reversion-scalper");
    res.json(STRATEGY_SCHEMA);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get mean reversion strategy schema", {
      error,
    });
    return serverError(res, "Failed to get strategy schema");
  }
});

router.get("/momentum/schema", requireAuth, async (req: Request, res: Response) => {
  try {
    const { STRATEGY_SCHEMA } = await import("../strategies/momentum-strategy");
    res.json(STRATEGY_SCHEMA);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get momentum strategy schema", {
      error,
    });
    return serverError(res, "Failed to get strategy schema");
  }
});

router.get("/all-schemas", requireAuth, async (req: Request, res: Response) => {
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

router.post("/moving-average/backtest", requireAuth, async (req: Request, res: Response) => {
  try {
    const { normalizeMovingAverageConfig, backtestMovingAverageStrategy } =
      await import("../strategies/moving-average-crossover");
    const config = normalizeMovingAverageConfig(req.body);
    const lookbackDays = parseInt(req.query.lookbackDays as string) || 365;
    const result = await backtestMovingAverageStrategy(config, lookbackDays);
    res.json(result);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to run MA backtest", { error });
    return serverError(
      res,
      (error as Error).message || "Failed to run backtest"
    );
  }
});

router.post(
  "/moving-average/ai-validate",
  async (req: Request, res: Response) => {
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
      const marketIntelligence = req.body.marketIntelligence;
      const result = await validateMovingAverageConfig(
        config,
        marketIntelligence
      );
      res.json(result);
    } catch (error) {
      log.error("StrategiesAPI", "Failed to AI validate strategy", { error });
      return serverError(
        res,
        (error as Error).message || "Failed to validate strategy"
      );
    }
  }
);

router.post("/mean-reversion/backtest", requireAuth, async (req: Request, res: Response) => {
  try {
    const { normalizeMeanReversionConfig, backtestMeanReversionStrategy } =
      await import("../strategies/mean-reversion-scalper");
    const config = normalizeMeanReversionConfig(req.body);
    const lookbackDays = parseInt(req.query.lookbackDays as string) || 365;
    const result = await backtestMeanReversionStrategy(config, lookbackDays);
    res.json(result);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to run mean reversion backtest", {
      error,
    });
    return serverError(
      res,
      (error as Error).message || "Failed to run backtest"
    );
  }
});

router.post("/mean-reversion/signal", requireAuth, async (req: Request, res: Response) => {
  try {
    const { normalizeMeanReversionConfig, generateMeanReversionSignal } =
      await import("../strategies/mean-reversion-scalper");
    const config = normalizeMeanReversionConfig(req.body.config || req.body);
    const prices = req.body.prices as number[];

    if (
      !prices ||
      !Array.isArray(prices) ||
      prices.length < config.lookbackPeriod
    ) {
      return badRequest(
        res,
        `Need at least ${config.lookbackPeriod} price points`
      );
    }

    const signal = generateMeanReversionSignal(prices, config);
    res.json(signal);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to generate mean reversion signal", {
      error,
    });
    return serverError(
      res,
      (error as Error).message || "Failed to generate signal"
    );
  }
});

router.post("/momentum/backtest", requireAuth, async (req: Request, res: Response) => {
  try {
    const { normalizeMomentumConfig, backtestMomentumStrategy } =
      await import("../strategies/momentum-strategy");
    const config = normalizeMomentumConfig(req.body);
    const lookbackDays = parseInt(req.query.lookbackDays as string) || 365;
    const result = await backtestMomentumStrategy(config, lookbackDays);
    res.json(result);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to run momentum backtest", { error });
    return serverError(
      res,
      (error as Error).message || "Failed to run backtest"
    );
  }
});

router.post("/momentum/signal", requireAuth, async (req: Request, res: Response) => {
  try {
    const { normalizeMomentumConfig, generateMomentumSignal } =
      await import("../strategies/momentum-strategy");
    const config = normalizeMomentumConfig(req.body.config || req.body);
    const prices = req.body.prices as number[];

    const requiredLength =
      Math.max(config.lookbackPeriod, config.rsiPeriod) + 1;
    if (!prices || !Array.isArray(prices) || prices.length < requiredLength) {
      return badRequest(res, `Need at least ${requiredLength} price points`);
    }

    const signal = generateMomentumSignal(prices, config);
    res.json(signal);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to generate momentum signal", { error });
    return serverError(
      res,
      (error as Error).message || "Failed to generate signal"
    );
  }
});

router.post("/backtest", requireAuth, async (req: Request, res: Response) => {
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
        const { normalizeMovingAverageConfig, backtestMovingAverageStrategy } =
          await import("../strategies/moving-average-crossover");
        const config = normalizeMovingAverageConfig({ symbol, ...parameters });
        result = await backtestMovingAverageStrategy(config, lookbackDays);
        break;
      }
      case "mean-reversion":
      case "mean-reversion-scalper": {
        const { normalizeMeanReversionConfig, backtestMeanReversionStrategy } =
          await import("../strategies/mean-reversion-scalper");
        const config = normalizeMeanReversionConfig({ symbol, ...parameters });
        result = await backtestMeanReversionStrategy(config, lookbackDays);
        break;
      }
      case "momentum":
      case "momentum-breakout": {
        const { normalizeMomentumConfig, backtestMomentumStrategy } =
          await import("../strategies/momentum-strategy");
        const config = normalizeMomentumConfig({ symbol, ...parameters });
        result = await backtestMomentumStrategy(config, lookbackDays);
        break;
      }
      case "range-trading":
      case "breakout": {
        const { normalizeMeanReversionConfig, backtestMeanReversionStrategy } =
          await import("../strategies/mean-reversion-scalper");
        const defaultParams = {
          lookbackPeriod: parameters?.lookbackPeriod ?? 20,
          deviationThreshold: parameters?.deviationThreshold ?? 2.0,
          maxHoldingPeriod: parameters?.maxHoldingPeriod ?? 10,
          ...parameters,
        };
        const config = normalizeMeanReversionConfig({
          symbol,
          ...defaultParams,
        });
        result = await backtestMeanReversionStrategy(config, lookbackDays);
        break;
      }
      default: {
        const { normalizeMomentumConfig, backtestMomentumStrategy } =
          await import("../strategies/momentum-strategy");
        const config = normalizeMomentumConfig({ symbol, ...parameters });
        result = await backtestMomentumStrategy(config, lookbackDays);
        break;
      }
    }

    res.json(result);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to run generic backtest", { error });
    return serverError(
      res,
      (error as Error).message || "Failed to run backtest"
    );
  }
});

router.post("/config", requireAuth, async (req: Request, res: Response) => {
  try {
    const { normalizeMovingAverageConfig } =
      await import("../strategies/moving-average-crossover");
    const config = normalizeMovingAverageConfig(req.body);
    res.json(config);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to normalize strategy config", {
      error,
    });
    return serverError(
      res,
      (error as Error).message || "Failed to normalize config"
    );
  }
});

router.post("/validate", requireAuth, async (req: Request, res: Response) => {
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
    return serverError(
      res,
      (error as Error).message || "Failed to validate strategy"
    );
  }
});

// ============================================================================
// STRATEGY VERSION ROUTES
// ============================================================================

router.get("/versions", requireAuth, async (req: Request, res: Response) => {
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

router.post("/versions", requireAuth, async (req: Request, res: Response) => {
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
      description,
    } = req.body;

    if (!strategyId || !name || !spec) {
      return badRequest(res, "strategyId, name, and spec are required");
    }

    // SECURITY: Sanitize strategy input to prevent XSS attacks
    const sanitizedName = sanitizeInput(name);
    const sanitizedDescription = description
      ? sanitizeInput(description)
      : undefined;

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
    return serverError(
      res,
      (error as Error).message || "Failed to create strategy version"
    );
  }
});

router.get("/versions/:id", requireAuth, async (req: Request, res: Response) => {
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

router.patch("/versions/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    // SECURITY: Sanitize strategy input to prevent XSS attacks
    const sanitizedBody = sanitizeStrategyInput(req.body);

    const version = await storage.updateStrategyVersion(
      req.params.id,
      sanitizedBody
    );
    if (!version) {
      return notFound(res, "Strategy version not found");
    }
    res.json(version);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to update strategy version: ${error}`);
    return serverError(
      res,
      (error as Error).message || "Failed to update strategy version"
    );
  }
});

router.post("/versions/:id/activate", requireAuth, async (req: Request, res: Response) => {
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
        log.warn(
          "StrategiesAPI",
          `Activation blocked for strategy version ${req.params.id}: No successful backtest found`
        );
        return validationError(
          res,
          "Strategy must have at least one successful backtest before activation. Please run a backtest and verify results before activating this strategy.",
          {
            strategyId: version.strategyId,
            strategyVersionId: req.params.id,
          }
        );
      }

      log.info(
        "StrategiesAPI",
        `Backtest validation passed for strategy version ${req.params.id}`,
        {
          strategyId: version.strategyId,
          backtestId: successfulBacktests[0].id,
          backtestDate: successfulBacktests[0].createdAt,
        }
      );
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
    return serverError(
      res,
      (error as Error).message || "Failed to activate strategy version"
    );
  }
});

router.post("/versions/:id/archive", requireAuth, async (req: Request, res: Response) => {
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
    res.status(500).json({
      error: (error as Error).message || "Failed to archive strategy version",
    });
  }
});

router.get(
  "/versions/:strategyId/latest",
  async (req: Request, res: Response) => {
    try {
      const version = await storage.getLatestStrategyVersion(
        req.params.strategyId
      );
      if (!version) {
        return res
          .status(404)
          .json({ error: "No versions found for this strategy" });
      }
      res.json(version);
    } catch (error) {
      log.error(
        "StrategiesAPI",
        `Failed to get latest strategy version: ${error}`
      );
      res.status(500).json({ error: "Failed to get latest strategy version" });
    }
  }
);

// STRATEGY PERFORMANCE MONITORING DASHBOARD API
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await storage.deleteStrategy(req.params.id);
    if (!deleted) {
      return notFound(res, "Strategy not found");
    }
    res.json({ success: true, message: "Strategy deleted" });
  } catch (error) {
    log.error("StrategiesAPI", "Failed to delete strategy", { error });
    return serverError(res, "Failed to delete strategy");
  }
});

router.get("/:id/performance", requireAuth, async (req: Request, res: Response) => {
  try {
    const strategyId = req.params.id;

    // 1. Get strategy to verify it exists
    const strategy = await storage.getStrategy(strategyId);
    if (!strategy) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    // 2. Get real-time state from alpacaTradingEngine
    const { alpacaTradingEngine } =
      await import("../trading/alpaca-trading-engine");
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
    const closingTrades = allTrades.filter(
      (t) => t.pnl !== null && t.pnl !== "0"
    );
    const winningTrades = closingTrades.filter(
      (t) => parseFloat(t.pnl || "0") > 0
    );
    const losingTrades = closingTrades.filter(
      (t) => parseFloat(t.pnl || "0") < 0
    );

    const winRate =
      closingTrades.length > 0
        ? (winningTrades.length / closingTrades.length) * 100
        : 0;

    // Calculate total P&L from all closing trades
    const totalPnl = closingTrades.reduce((sum, t) => {
      return sum + parseFloat(t.pnl || "0");
    }, 0);

    // Calculate average win and loss
    const avgWin =
      winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0) /
          winningTrades.length
        : 0;

    const avgLoss =
      losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0) /
          losingTrades.length
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
        avgTrade:
          closingTrades.length > 0
            ? parseFloat((totalPnl / closingTrades.length).toFixed(2))
            : 0,

        // Profit factor (avg win / abs(avg loss))
        profitFactor:
          avgLoss !== 0
            ? parseFloat((avgWin / Math.abs(avgLoss)).toFixed(2))
            : avgWin > 0
              ? Infinity
              : 0,
      },

      // Current positions
      positions: currentPositions.map((p) => ({
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
      recentTrades: allTrades.slice(0, 10).map((t) => ({
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
      lastDecision: strategyState?.lastDecision
        ? {
            action: strategyState.lastDecision.action,
            confidence: strategyState.lastDecision.confidence,
            reasoning: strategyState.lastDecision.reasoning,
            riskLevel: strategyState.lastDecision.riskLevel,
          }
        : null,
    };

    res.json(performance);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to get strategy performance: ${error}`);
    res.status(500).json({
      error: (error as Error).message || "Failed to get strategy performance",
    });
  }
});

// ============================================================================
// STRATEGY ORDER EXECUTION ROUTES
// ============================================================================

/**
 * Schema for strategy order request
 */
const strategyOrderRequestSchema = z.object({
  symbol: z.string().min(1).max(10),
  side: z.enum(["buy", "sell"]),
  decision: z
    .object({
      confidence: z.number().min(0).max(1),
      reasoning: z.string().optional(),
    })
    .optional(),
  overrideQty: z.number().positive().optional(),
  overrideNotional: z.number().positive().optional(),
});

/**
 * POST /api/strategies/:id/orders
 * Execute a trade using strategy configuration
 *
 * This endpoint uses the strategy's config (position sizing, bracket orders, entry rules)
 * to execute a trade. The strategyId is used to look up the strategy and apply its settings.
 */
router.post("/:id/orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const strategyId = req.params.id;

    // Validate request body
    const parsed = strategyOrderRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return validationError(res, parsed.error.errors.map(e => e.message).join(", "));
    }

    const { symbol, side, decision, overrideQty, overrideNotional } =
      parsed.data;

    // Execute the order using strategy order service
    const result = await strategyOrderService.executeWithStrategy({
      strategyId,
      symbol,
      side,
      decision: decision
        ? {
            symbol,
            action: side,
            confidence: decision.confidence,
            reasoning: decision.reasoning,
          }
        : undefined,
      overrideQty,
      overrideNotional,
      traceId: req.headers["x-trace-id"] as string,
    });

    if (!result.success) {
      log.warn("StrategiesAPI", "Strategy order failed", {
        strategyId,
        symbol,
        error: result.error,
      });
      return res.status(400).json({
        success: false,
        error: result.error,
        validation: result.validation,
        context: result.context,
      });
    }

    log.info("StrategiesAPI", "Strategy order executed", {
      strategyId,
      symbol,
      side,
      orderId: result.orderId,
    });

    res.json(result);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to execute strategy order", { error });
    return serverError(res, "Failed to execute strategy order");
  }
});

/**
 * GET /api/strategies/:id/orders
 * Get orders for a specific strategy
 */
router.get("/:id/orders", requireAuth, async (req: Request, res: Response) => {
  try {
    const strategyId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;

    // Verify strategy exists
    const strategy = await storage.getStrategy(strategyId);
    if (!strategy) {
      return notFound(res, "Strategy not found");
    }

    // Get orders for this strategy
    const orders = await storage.getOrdersByStrategy(strategyId, limit);

    res.json({
      strategyId,
      strategyName: strategy.name,
      orders,
      total: orders.length,
    });
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get strategy orders", { error });
    return serverError(res, "Failed to get strategy orders");
  }
});

/**
 * POST /api/strategies/:id/close-position
 * Close a position using strategy order settings
 */
router.post("/:id/close-position", requireAuth, async (req: Request, res: Response) => {
  try {
    const strategyId = req.params.id;
    const { symbol, quantity } = req.body;

    if (!symbol) {
      return badRequest(res, "Symbol is required");
    }

    const result = await strategyOrderService.closePosition(
      strategyId,
      symbol,
      quantity,
      req.headers["x-trace-id"] as string
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        context: result.context,
      });
    }

    log.info("StrategiesAPI", "Position closed via strategy", {
      strategyId,
      symbol,
      orderId: result.orderId,
    });

    res.json(result);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to close position", { error });
    return serverError(res, "Failed to close position");
  }
});

/**
 * GET /api/strategies/:id/execution-context
 * Get the parsed execution context for a strategy
 */
router.get("/:id/execution-context", requireAuth, async (req: Request, res: Response) => {
  try {
    const strategyId = req.params.id;

    const context = await strategyOrderService.getExecutionContext(strategyId);
    if (!context) {
      return notFound(res, "Strategy not found");
    }

    res.json(context);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to get execution context", { error });
    return serverError(res, "Failed to get execution context");
  }
});

/**
 * POST /api/strategies/:id/preview-position-size
 * Preview position size calculation for a symbol
 */
router.post("/:id/preview-position-size", requireAuth, async (req: Request, res: Response) => {
  try {
    const strategyId = req.params.id;
    const { symbol } = req.body;

    if (!symbol) {
      return badRequest(res, "Symbol is required");
    }

    const result = await strategyOrderService.previewPositionSize(
      strategyId,
      symbol
    );

    res.json(result);
  } catch (error) {
    log.error("StrategiesAPI", "Failed to preview position size", { error });
    return serverError(res, "Failed to preview position size");
  }
});

export default router;
