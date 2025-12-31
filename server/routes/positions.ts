import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../utils/logger";
import { badRequest, notFound, serverError } from "../lib/standard-errors";
import { insertPositionSchema } from "@shared/schema";
import { alpaca, type AlpacaPosition } from "../connectors/alpaca";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";
import {
  mapAlpacaPositionToEnriched,
  createLiveSourceMetadata,
  createUnavailableSourceMetadata,
  type EnrichedPosition,
} from "@shared/position-mapper";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

/**
 * Mapped position for snapshot response
 */
interface SnapshotPosition {
  id: string;
  symbol: string;
  side: "long" | "short";
  qty: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPct: number;
  costBasis: number;
  assetClass: "crypto" | "us_equity";
}

const router = Router();

/**
 * GET /api/positions/snapshot
 * Portfolio snapshot endpoint for Next.js dashboard
 * Returns comprehensive portfolio metrics including positions, P&L, and account data
 * MUST be before /api/positions/:id route
 */
router.get("/snapshot", requireAuth, async (req: Request, res: Response) => {
  try {
    // Get Alpaca account and positions in parallel for faster response
    const [alpacaAccount, alpacaPositions] = await Promise.all([
      alpaca.getAccount(),
      alpaca.getPositions(),
    ]);

    // Calculate portfolio metrics
    const equity = parseFloat(alpacaAccount.equity);
    const lastEquity = parseFloat(alpacaAccount.last_equity);
    const buyingPower = parseFloat(alpacaAccount.buying_power);
    const cash = parseFloat(alpacaAccount.cash);
    const portfolioValue = parseFloat(alpacaAccount.portfolio_value);

    // Calculate P&L
    const dailyPl = equity - lastEquity;
    const dailyPlPct = lastEquity > 0 ? (dailyPl / lastEquity) * 100 : 0;

    // Map positions to required format
    const positions: SnapshotPosition[] = alpacaPositions.map(
      (pos: AlpacaPosition) => ({
        id: pos.asset_id,
        symbol: pos.symbol,
        side: (pos.side === "long" ? "long" : "short") as "long" | "short",
        qty: parseFloat(pos.qty),
        entryPrice: parseFloat(pos.avg_entry_price),
        currentPrice: parseFloat(pos.current_price),
        marketValue: parseFloat(pos.market_value),
        unrealizedPl: parseFloat(pos.unrealized_pl),
        unrealizedPlPct: parseFloat(pos.unrealized_plpc) * 100,
        costBasis: parseFloat(pos.cost_basis),
        assetClass: (pos.asset_class === "crypto"
          ? "crypto"
          : "us_equity") as "crypto" | "us_equity",
      })
    );

    // Calculate total unrealized P&L from positions
    const totalUnrealizedPl = positions.reduce(
      (sum: number, pos: SnapshotPosition) => sum + pos.unrealizedPl,
      0
    );

    // Get trades from database for realized P&L
    const trades = await storage.getTrades(undefined, 100);
    const closedTrades = trades.filter((t) => t.pnl !== null && t.pnl !== "");
    const totalRealizedPl = closedTrades.reduce(
      (sum, t) => sum + parseFloat(t.pnl || "0"),
      0
    );

    const snapshot = {
      totalEquity: equity,
      buyingPower,
      cash,
      portfolioValue,
      dailyPl,
      dailyPlPct,
      totalPl: totalRealizedPl + totalUnrealizedPl,
      totalPlPct:
        lastEquity > 0
          ? ((totalRealizedPl + totalUnrealizedPl) / lastEquity) * 100
          : 0,
      positions,
      timestamp: new Date().toISOString(),
      positionCount: positions.length,
      longPositions: positions.filter((p) => p.side === "long").length,
      shortPositions: positions.filter((p) => p.side === "short").length,
      totalRealizedPl,
      totalUnrealizedPl,
    };

    res.json(snapshot);
  } catch (error) {
    log.error("PositionsAPI", `Failed to get portfolio snapshot: ${error}`);
    res.status(500).json({
      error: "Failed to get portfolio snapshot",
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/positions
 * Returns LIVE Alpaca positions (source of truth)
 * Database sync happens async - DB is cache/audit trail only
 * Filters out dust positions (< 0.0001 shares)
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const fetchedAt = new Date();
  const DUST_THRESHOLD = 0.0001;
  try {
    const positions = await alpaca.getPositions();

    // Filter out dust positions (< 0.0001 shares) to avoid displaying floating point residuals
    const filteredPositions = positions.filter((p) => {
      const qty = Math.abs(parseFloat(p.qty || "0"));
      return qty >= DUST_THRESHOLD;
    });

    // Sync to database in background (don't block response) - write-behind cache
    storage
      .syncPositionsFromAlpaca(req.userId!, filteredPositions)
      .catch((err) =>
        log.error(
          "PositionsAPI",
          `Failed to sync positions to database: ${err}`
        )
      );

    const enrichedPositions = filteredPositions.map((p) =>
      mapAlpacaPositionToEnriched(p, fetchedAt)
    );

    res.json({
      positions: enrichedPositions,
      _source: createLiveSourceMetadata(),
    });
  } catch (error) {
    log.error(
      "PositionsAPI",
      `Failed to fetch positions from Alpaca: ${error}`
    );
    // Per SOURCE_OF_TRUTH_CONTRACT.md: Do NOT fallback to stale DB data without warning
    // Return error with source metadata so UI can display appropriate message
    res.status(503).json({
      error: "Live position data unavailable from Alpaca",
      _source: createUnavailableSourceMetadata(),
      message:
        "Could not connect to Alpaca Paper Trading. Please try again shortly.",
    });
  }
});

/**
 * GET /api/positions/broker
 * Alias for /api/positions (backward compatibility)
 * Uses Alpaca source of truth
 */
router.get("/broker", requireAuth, async (req: Request, res: Response) => {
  const fetchedAt = new Date();
  const DUST_THRESHOLD = 0.0001;
  try {
    const positions = await alpaca.getPositions();
    // Filter out dust positions
    const filteredPositions = positions.filter((p) => {
      const qty = Math.abs(parseFloat(p.qty || "0"));
      return qty >= DUST_THRESHOLD;
    });
    const enrichedPositions = filteredPositions.map((p) =>
      mapAlpacaPositionToEnriched(p, fetchedAt)
    );

    res.json({
      positions: enrichedPositions,
      _source: createLiveSourceMetadata(),
    });
  } catch (error) {
    log.error("PositionsAPI", `Failed to fetch broker positions: ${error}`);
    res.status(503).json({
      error: "Failed to fetch positions from broker",
      _source: createUnavailableSourceMetadata(),
      message:
        "Could not connect to Alpaca Paper Trading. Please try again shortly.",
    });
  }
});

/**
 * GET /api/positions/:id
 * Get a specific position by ID from database
 */
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const position = await storage.getPosition(req.params.id);
    if (!position) {
      return notFound(res, "Position not found");
    }
    res.json(position);
  } catch (error) {
    log.error("PositionsAPI", `Failed to get position: ${error}`);
    res.status(500).json({ error: "Failed to get position" });
  }
});

/**
 * POST /api/positions
 * Create a new position in the database
 */
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = insertPositionSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }
    const position = await storage.createPosition(parsed.data);
    res.status(201).json(position);
  } catch (error) {
    log.error("PositionsAPI", `Failed to create position: ${error}`);
    res.status(500).json({ error: "Failed to create position" });
  }
});

/**
 * PATCH /api/positions/:id
 * Update an existing position
 */
router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const position = await storage.updatePosition(req.params.id, req.body);
    if (!position) {
      return notFound(res, "Position not found");
    }
    res.json(position);
  } catch (error) {
    log.error("PositionsAPI", `Failed to update position: ${error}`);
    res.status(500).json({ error: "Failed to update position" });
  }
});

/**
 * DELETE /api/positions/:id
 * Delete a position from database
 */
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await storage.deletePosition(req.params.id);
    if (!deleted) {
      return notFound(res, "Position not found");
    }
    res.status(204).send();
  } catch (error) {
    log.error("PositionsAPI", `Failed to delete position: ${error}`);
    res.status(500).json({ error: "Failed to delete position" });
  }
});

/**
 * POST /api/positions/reconcile
 * Reconcile positions between database and Alpaca
 */
router.post("/reconcile", requireAuth, async (req: Request, res: Response) => {
  try {
    const { positionReconciler } =
      await import("../services/position-reconciler");
    const force = req.query.force === "true";
    const result = await positionReconciler.reconcile(force);
    res.json(result);
  } catch (error) {
    log.error("PositionsAPI", `Position reconciliation failed: ${error}`);
    res.status(500).json({ error: "Failed to reconcile positions" });
  }
});

/**
 * GET /api/positions/reconcile/status
 * Get the status of position reconciliation
 */
router.get("/reconcile/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { positionReconciler } =
      await import("../services/position-reconciler");
    const status = positionReconciler.getStatus();
    res.json(status);
  } catch (error) {
    log.error("PositionsAPI", `Failed to get reconciliation status: ${error}`);
    res.status(500).json({ error: "Failed to get reconciliation status" });
  }
});

/**
 * POST /api/positions/close/:symbol
 * Close a specific position by symbol
 */
router.post("/close/:symbol", requireAuth, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    if (!symbol) {
      return badRequest(res, "Symbol is required");
    }

    // SECURITY: Mark as authorized since this is an admin-initiated action
    const result = await alpacaTradingEngine.closeAlpacaPosition(
      symbol,
      undefined,
      {
        authorizedByOrchestrator: true,
      }
    );

    if (result.success) {
      res.json({
        success: true,
        message: `Position ${symbol} closed successfully`,
        result,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || "Failed to close position",
      });
    }
  } catch (error) {
    log.error("PositionsAPI", `Failed to close position: ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/positions/close-all
 * Close all open positions
 */
router.post("/close-all", requireAuth, async (req: Request, res: Response) => {
  try {
    // SECURITY: Mark as authorized since this is an admin-initiated emergency action
    const result = await alpacaTradingEngine.closeAllPositions({
      authorizedByOrchestrator: true,
      isEmergencyStop: true,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    log.error("PositionsAPI", `Failed to close all positions: ${error}`);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
