/**
 * Portfolio Snapshot API
 *
 * Provides aggregated portfolio data for the Next.js web dashboard
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { log } from "../utils/logger";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

/**
 * GET /api/positions/snapshot
 * Returns comprehensive portfolio snapshot with positions and performance metrics
 */
router.get("/snapshot", requireAuth, async (req: Request, res: Response) => {
  try {
    // Get Alpaca account data
    const alpacaAccount = await alpaca.getAccount();

    // Get current positions from Alpaca
    const alpacaPositions = await alpaca.getPositions();

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
    const positions = alpacaPositions.map((pos: any) => ({
      id: pos.asset_id,
      symbol: pos.symbol,
      side: pos.side === "long" ? "long" : "short",
      qty: parseFloat(pos.qty),
      entryPrice: parseFloat(pos.avg_entry_price),
      currentPrice: parseFloat(pos.current_price),
      marketValue: parseFloat(pos.market_value),
      unrealizedPl: parseFloat(pos.unrealized_pl),
      unrealizedPlPct: parseFloat(pos.unrealized_plpc) * 100,
      costBasis: parseFloat(pos.cost_basis),
      assetClass: pos.asset_class === "crypto" ? "crypto" : "us_equity",
    }));

    // Calculate total unrealized P&L from positions
    const totalUnrealizedPl = positions.reduce(
      (sum, pos) => sum + pos.unrealizedPl,
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
      // Additional metrics
      positionCount: positions.length,
      longPositions: positions.filter((p) => p.side === "long").length,
      shortPositions: positions.filter((p) => p.side === "short").length,
      totalRealizedPl,
      totalUnrealizedPl,
    };

    res.json(snapshot);
  } catch (error) {
    log.error(
      "PortfolioSnapshot",
      `Failed to get portfolio snapshot: ${error}`
    );
    res.status(500).json({
      error: "Failed to get portfolio snapshot",
      message: (error as Error).message,
    });
  }
});

export default router;
