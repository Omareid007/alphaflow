/**
 * Universe Management Routes
 * Handles trading universe, symbols, tradability checks, candidates, and watchlist
 */

import { Router, Request, Response } from "express";
import { tradabilityService } from "../services/tradability-service";
import { storage } from "../storage";
import { workQueue } from "../lib/work-queue";
import { log } from "../utils/logger";
import { candidatesService } from "../universe";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

// GET /api/universe/stats - Get universe statistics
router.get("/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await tradabilityService.getUniverseStats();
    res.json(stats);
  } catch (error) {
    log.error("UniverseAPI", "Failed to get universe stats", { error });
    res.status(500).json({ error: "Failed to get universe stats" });
  }
});

// GET /api/universe/symbols - Get all tradable symbols
router.get("/symbols", requireAuth, async (req: Request, res: Response) => {
  try {
    const { assetClass, tradableOnly, limit } = req.query;
    const assets = await storage.getBrokerAssets(
      assetClass as "us_equity" | "crypto" | undefined,
      tradableOnly === "true",
      limit ? parseInt(limit as string) : 1000
    );
    res.json({
      assets,
      count: assets.length,
    });
  } catch (error) {
    log.error("UniverseAPI", "Failed to get symbols", { error });
    res.status(500).json({ error: "Failed to get symbols" });
  }
});

// GET /api/universe/search - Search symbols
router.get("/search", requireAuth, async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Search query required" });
    }
    const assets = await tradabilityService.searchSymbols(
      q,
      limit ? parseInt(limit as string) : 20
    );
    res.json({ assets, count: assets.length });
  } catch (error) {
    log.error("UniverseAPI", "Failed to search symbols", { error });
    res.status(500).json({ error: "Failed to search symbols" });
  }
});

// GET /api/universe/check/:symbol - Check if symbol is tradable
router.get(
  "/check/:symbol",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const check = await tradabilityService.validateSymbolTradable(symbol);
      res.json(check);
    } catch (error) {
      log.error("UniverseAPI", "Failed to check tradability", { error });
      res.status(500).json({ error: "Failed to check tradability" });
    }
  }
);

// POST /api/universe/sync - Sync universe (queued)
router.post("/sync", requireAuth, async (req: Request, res: Response) => {
  try {
    const { assetClass } = req.body;

    await workQueue.enqueue({
      type: "ASSET_UNIVERSE_SYNC",
      status: "PENDING",
      payload: JSON.stringify({ assetClass: assetClass || "us_equity" }),
      maxAttempts: 3,
      nextRunAt: new Date(),
    });

    res.json({
      message: "Asset universe sync queued",
      assetClass: assetClass || "us_equity",
    });
  } catch (error) {
    log.error("UniverseAPI", "Failed to queue universe sync", { error });
    res.status(500).json({ error: "Failed to queue universe sync" });
  }
});

// POST /api/universe/sync-now - Sync universe immediately
router.post("/sync-now", requireAuth, async (req: Request, res: Response) => {
  try {
    const { assetClass } = req.body;
    const result = await tradabilityService.syncAssetUniverse(
      assetClass || "us_equity"
    );
    tradabilityService.clearMemoryCache();
    res.json(result);
  } catch (error) {
    log.error("UniverseAPI", "Failed to sync universe", { error });
    res.status(500).json({ error: "Failed to sync universe" });
  }
});

// GET /api/candidates - Get trading candidates
router.get("/candidates", requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query;

    let candidates;
    if (
      status &&
      ["NEW", "WATCHLIST", "APPROVED", "REJECTED"].includes(status as string)
    ) {
      candidates = await candidatesService.getCandidatesByStatus(
        status as "NEW" | "WATCHLIST" | "APPROVED" | "REJECTED",
        limit ? parseInt(limit as string) : 50
      );
    } else {
      candidates = await candidatesService.getTopCandidates(
        limit ? parseInt(limit as string) : 50
      );
    }

    res.json({ candidates, count: candidates.length });
  } catch (error) {
    log.error("UniverseAPI", "Failed to get candidates", { error });
    res.status(500).json({ error: "Failed to get candidates" });
  }
});

// GET /api/watchlist - Get watchlist candidates
router.get("/watchlist", requireAuth, async (req: Request, res: Response) => {
  try {
    const candidates = await candidatesService.getCandidatesByStatus(
      "WATCHLIST",
      100
    );
    res.json({
      watchlist: candidates.map((c) => ({
        symbol: c.symbol,
        tier: c.tier,
        score: c.finalScore,
        addedAt: c.createdAt,
      })),
      count: candidates.length,
    });
  } catch (error) {
    log.error("UniverseAPI", "Failed to get watchlist", { error });
    res.status(500).json({ error: "Failed to get watchlist" });
  }
});

export default router;
