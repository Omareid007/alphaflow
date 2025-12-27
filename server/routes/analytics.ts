/**
 * Analytics Routes
 * Handles trading analytics and performance metrics
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { orchestrator } from "../autonomous/orchestrator";
import { safeParseFloat } from "../utils/numeric";
import { log } from "../utils/logger";

const router = Router();

// GET /api/analytics/summary - Get trading performance summary
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const orchestratorState = orchestrator.getState();
    const riskLimits = orchestrator.getRiskLimits();

    let alpacaPositions: any[] = [];
    let unrealizedPnl = 0;
    let dailyPnlFromAccount = 0;
    let accountData = {
      equity: "0",
      cash: "0",
      buyingPower: "0",
      lastEquity: "0",
      portfolioValue: "0",
    };

    // Parallelize Alpaca calls and DB query for faster response
    const [trades, alpacaData] = await Promise.all([
      storage.getTrades(undefined, 100),
      Promise.all([alpaca.getPositions(), alpaca.getAccount()]).catch(e => {
        log.error("AnalyticsAPI", "Failed to fetch Alpaca data", { error: e });
        return [[], null];
      })
    ]);

    const [positions, account] = alpacaData;
    if (positions && positions.length > 0) {
      alpacaPositions = positions;
      unrealizedPnl = alpacaPositions.reduce((sum, p) => sum + safeParseFloat(p.unrealized_pl, 0), 0);
    }

    if (account && !Array.isArray(account)) {
      const portfolioValue = safeParseFloat(account.portfolio_value, 0);
      const lastEquity = safeParseFloat(account.last_equity, 0);
      dailyPnlFromAccount = portfolioValue - lastEquity;

      accountData = {
        equity: account.equity || "0",
        cash: account.cash || "0",
        buyingPower: account.buying_power || "0",
        lastEquity: account.last_equity || "0",
        portfolioValue: account.portfolio_value || "0",
      };
    }

    // Filter to only count filled/completed trades (not pending or failed)
    const filledTrades = trades.filter(t => {
      const status = (t.status || "").toLowerCase();
      return status === "filled" || status === "completed" || status === "executed";
    });

    const sellTrades = filledTrades.filter(t => t.side === "sell");

    const closedTrades = sellTrades.filter(t => {
      if (t.pnl === null || t.pnl === undefined) return false;
      const pnlStr = String(t.pnl).trim();
      if (pnlStr === "") return false;
      const pnlValue = parseFloat(pnlStr);
      return Number.isFinite(pnlValue);
    });

    const realizedPnl = closedTrades.reduce((sum, t) => sum + safeParseFloat(t.pnl, 0), 0);
    const totalPnl = unrealizedPnl + realizedPnl;

    const winningTrades = closedTrades.filter(t => safeParseFloat(t.pnl, 0) > 0);
    const losingTrades = closedTrades.filter(t => safeParseFloat(t.pnl, 0) < 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

    // Daily stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaysTrades = closedTrades.filter(t => {
      const executedAt = new Date(t.executedAt);
      return executedAt >= todayStart;
    });
    const dailyTradeCount = todaysTrades.length;
    const dailyWinningTrades = todaysTrades.filter(t => safeParseFloat(t.pnl, 0) > 0);
    const dailyLosingTrades = todaysTrades.filter(t => safeParseFloat(t.pnl, 0) < 0);
    const dailyRealizedPnl = todaysTrades.reduce((sum, t) => sum + safeParseFloat(t.pnl, 0), 0);

    res.json({
      totalTrades: filledTrades.length,
      closedTradesCount: closedTrades.length,
      totalPnl: totalPnl.toFixed(2),
      realizedPnl: realizedPnl.toFixed(2),
      winRate: winRate.toFixed(1),
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      openPositions: alpacaPositions.length,
      unrealizedPnl: unrealizedPnl.toFixed(2),
      isAgentRunning: orchestratorState.isRunning,
      dailyPnl: dailyPnlFromAccount.toFixed(2),
      dailyTradeCount: dailyTradeCount,
      dailyWinningTrades: dailyWinningTrades.length,
      dailyLosingTrades: dailyLosingTrades.length,
      dailyRealizedPnl: dailyRealizedPnl.toFixed(2),
      account: accountData,
      riskControls: {
        maxPositionSizePercent: riskLimits.maxPositionSizePercent,
        maxTotalExposurePercent: riskLimits.maxTotalExposurePercent,
        maxPositionsCount: riskLimits.maxPositionsCount,
        dailyLossLimitPercent: riskLimits.dailyLossLimitPercent,
        killSwitchActive: riskLimits.killSwitchActive,
      },
    });
  } catch (error) {
    log.error("AnalyticsAPI", "Failed to get analytics summary", { error });
    res.status(500).json({ error: "Failed to get analytics summary" });
  }
});

export default router;
