import { Router, Request, Response } from "express";
import { fred, FRED_SERIES, MacroCategory } from "../connectors/fred";
import { macroIndicatorsService } from "../services/macro-indicators-service";
import { log } from "../utils/logger";
import { badRequest, notFound, serverError } from "../lib/standard-errors";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

router.get("/indicators", requireAuth, async (_req: Request, res: Response) => {
  try {
    const indicators = await macroIndicatorsService.getLatestIndicators();
    res.json({ success: true, data: indicators });
  } catch (error) {
    log.error("MacroRoutes", "Failed to get indicators", { error });
    return serverError(res, "Failed to fetch indicators");
  }
});

router.get(
  "/indicators/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const indicator = await macroIndicatorsService.getIndicator(
        req.params.id
      );
      if (!indicator) {
        return notFound(res, "Indicator not found");
      }
      res.json({ success: true, data: indicator });
    } catch (error) {
      log.error("MacroRoutes", "Failed to get indicator", { error });
      return serverError(res, "Failed to fetch indicator");
    }
  }
);

router.get(
  "/category/:category",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const category = req.params.category as MacroCategory;
      const validCategories = [
        "treasury_yields",
        "inflation",
        "employment",
        "volatility",
        "interest_rates",
        "money_supply",
        "gdp",
        "consumer",
        "housing",
        "manufacturing",
      ];

      if (!validCategories.includes(category)) {
        return badRequest(res, "Invalid category");
      }

      const indicators =
        await macroIndicatorsService.getIndicatorsByCategory(category);
      res.json({ success: true, data: indicators });
    } catch (error) {
      log.error("MacroRoutes", "Failed to get indicators by category", {
        error,
      });
      return serverError(res, "Failed to fetch indicators");
    }
  }
);

router.get("/summary", requireAuth, async (_req: Request, res: Response) => {
  try {
    const summary = await macroIndicatorsService.getMacroSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    log.error("MacroRoutes", "Failed to get summary", { error });
    res.status(500).json({ success: false, error: "Failed to fetch summary" });
  }
});

router.post("/refresh", requireAuth, async (_req: Request, res: Response) => {
  try {
    const result = await macroIndicatorsService.refreshCriticalIndicators();
    res.json({ success: true, data: result });
  } catch (error) {
    log.error("MacroRoutes", "Failed to refresh indicators", { error });
    res
      .status(500)
      .json({ success: false, error: "Failed to refresh indicators" });
  }
});

router.post(
  "/refresh/all",
  requireAuth,
  async (_req: Request, res: Response) => {
    try {
      const result = await macroIndicatorsService.refreshAllIndicators();
      res.json({ success: true, data: result });
    } catch (error) {
      log.error("MacroRoutes", "Failed to refresh all indicators", { error });
      res
        .status(500)
        .json({ success: false, error: "Failed to refresh indicators" });
    }
  }
);

router.get("/regime", requireAuth, async (_req: Request, res: Response) => {
  try {
    const indicators = await macroIndicatorsService.getLatestIndicators();
    const regime = macroIndicatorsService.getMarketRegimeFromMacro(indicators);
    res.json({ success: true, data: regime });
  } catch (error) {
    log.error("MacroRoutes", "Failed to get market regime", { error });
    res
      .status(500)
      .json({ success: false, error: "Failed to determine regime" });
  }
});

router.get("/series", requireAuth, async (_req: Request, res: Response) => {
  try {
    const series = Object.entries(FRED_SERIES).map(([id, config]) => ({
      id,
      name: config.name,
      category: config.category,
    }));
    res.json({ success: true, data: series });
  } catch (error) {
    log.error("MacroRoutes", "Failed to get series list", { error });
    res.status(500).json({ success: false, error: "Failed to fetch series" });
  }
});

router.get("/status", requireAuth, async (_req: Request, res: Response) => {
  try {
    const isConfigured = macroIndicatorsService.isConfigured();
    const indicators = await macroIndicatorsService.getLatestIndicators();

    res.json({
      success: true,
      data: {
        configured: isConfigured,
        hasApiKey: isConfigured,
        cachedIndicators: indicators.length,
        availableSeries: Object.keys(FRED_SERIES).length,
      },
    });
  } catch (error) {
    log.error("MacroRoutes", "Failed to get status", { error });
    res.status(500).json({ success: false, error: "Failed to get status" });
  }
});

export default router;
