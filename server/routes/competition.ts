import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../utils/logger";
import type {
  InsertTraderProfile,
  InsertCompetitionRun,
  InsertCompetitionScore,
} from "@shared/schema";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

router.get("/traders", requireAuth, async (req: Request, res: Response) => {
  try {
    const traders = await storage.getTraderProfiles();
    res.json({ traders, count: traders.length });
  } catch (error) {
    log.error("CompetitionAPI", `Failed to list traders: ${error}`);
    res.status(500).json({ error: "Failed to list traders" });
  }
});

router.post("/traders", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      strategyVersionId,
      modelProfile,
      riskPreset,
      universeFilter,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const trader = await storage.createTraderProfile({
      name,
      description,
      strategyVersionId,
      modelProfile,
      riskPreset,
      universeFilter,
      status: "active",
    } as InsertTraderProfile);

    res.json(trader);
  } catch (error) {
    log.error("CompetitionAPI", `Failed to create trader: ${error}`);
    res
      .status(500)
      .json({ error: (error as Error).message || "Failed to create trader" });
  }
});

router.get("/traders/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const trader = await storage.getTraderProfile(req.params.id);
    if (!trader) {
      return res.status(404).json({ error: "Trader not found" });
    }
    res.json(trader);
  } catch (error) {
    log.error("CompetitionAPI", `Failed to get trader: ${error}`);
    res.status(500).json({ error: "Failed to get trader" });
  }
});

router.patch(
  "/traders/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const trader = await storage.updateTraderProfile(req.params.id, req.body);
      if (!trader) {
        return res.status(404).json({ error: "Trader not found" });
      }
      res.json(trader);
    } catch (error) {
      log.error("CompetitionAPI", `Failed to update trader: ${error}`);
      res
        .status(500)
        .json({ error: (error as Error).message || "Failed to update trader" });
    }
  }
);

router.get("/runs", requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const runs = await storage.getCompetitionRuns(limit);
    res.json({ runs, count: runs.length });
  } catch (error) {
    log.error("CompetitionAPI", `Failed to list competition runs: ${error}`);
    res.status(500).json({ error: "Failed to list competition runs" });
  }
});

router.post("/runs", requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, mode, traderIds, universeSymbols, config } = req.body;

    if (
      !name ||
      !mode ||
      !traderIds ||
      !Array.isArray(traderIds) ||
      traderIds.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "name, mode, and traderIds are required" });
    }

    const validModes = ["paper", "backtest", "simulation"];
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        error: `Invalid mode. Must be one of: ${validModes.join(", ")}`,
      });
    }

    const traceId = `competition-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const run = await storage.createCompetitionRun({
      name,
      mode,
      traceId,
      traderIds,
      universeSymbols,
      config,
      status: "pending",
    } as InsertCompetitionRun);

    res.json(run);
  } catch (error) {
    log.error("CompetitionAPI", `Failed to create competition run: ${error}`);
    res.status(500).json({
      error: (error as Error).message || "Failed to create competition run",
    });
  }
});

router.get("/runs/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const run = await storage.getCompetitionRun(req.params.id);
    if (!run) {
      return res.status(404).json({ error: "Competition run not found" });
    }

    const scores = await storage.getCompetitionScoresByRun(req.params.id);
    res.json({ run, scores });
  } catch (error) {
    log.error("CompetitionAPI", `Failed to get competition run: ${error}`);
    res.status(500).json({ error: "Failed to get competition run" });
  }
});

router.patch("/runs/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const run = await storage.updateCompetitionRun(req.params.id, req.body);
    if (!run) {
      return res.status(404).json({ error: "Competition run not found" });
    }
    res.json(run);
  } catch (error) {
    log.error("CompetitionAPI", `Failed to update competition run: ${error}`);
    res.status(500).json({
      error: (error as Error).message || "Failed to update competition run",
    });
  }
});

router.post(
  "/runs/:id/scores",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const {
        traderId,
        rank,
        metrics,
        pnl,
        pnlPct,
        sharpe,
        sortino,
        maxDrawdown,
        winRate,
        totalTrades,
      } = req.body;

      if (!traderId) {
        return res.status(400).json({ error: "traderId is required" });
      }

      const score = await storage.createCompetitionScore({
        runId: req.params.id,
        traderProfileId: traderId,
        rank,
        totalPnl: pnl ? String(pnl) : undefined,
        roi: pnlPct ? String(pnlPct) : undefined,
        sharpe: sharpe ? String(sharpe) : undefined,
        sortino: sortino ? String(sortino) : undefined,
        maxDrawdown: maxDrawdown ? String(maxDrawdown) : undefined,
        winRate: winRate ? String(winRate) : undefined,
        tradeCount: totalTrades,
        details: metrics,
      } as InsertCompetitionScore);

      res.json(score);
    } catch (error) {
      log.error("CompetitionAPI", `Failed to create score: ${error}`);
      res
        .status(500)
        .json({ error: (error as Error).message || "Failed to create score" });
    }
  }
);

export default router;
