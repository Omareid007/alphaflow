/**
 * Portfolio Trading Routes
 *
 * Provides API endpoints for portfolio-level operations:
 * - Portfolio summary and allocation
 * - Position management by strategy
 * - Rebalancing utilities
 * - Strategy configuration
 */

import type { Express, Request, Response, NextFunction } from "express";
import { getSession } from "../lib/session";
import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { log } from "../utils/logger";
import { badRequest, serverError } from "../lib/standard-errors";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      log.warn("Auth", "No session cookie found for request:", {
        path: req.path,
      });
      return res.status(401).json({
        error: "Not authenticated",
        code: "NO_SESSION",
        message: "Please log in to access this resource",
      });
    }

    const session = await getSession(sessionId);
    if (!session) {
      log.warn("Auth", "Session expired or invalid:", {
        sessionId: sessionId.substring(0, 8) + "...",
      });
      return res.status(401).json({
        error: "Session expired",
        code: "SESSION_EXPIRED",
        message: "Your session has expired. Please log in again.",
      });
    }

    req.userId = session.userId;
    next();
  } catch (error) {
    log.error("Auth", "Authentication error:", { error });
    res.status(500).json({
      error: "Authentication failed",
      code: "AUTH_ERROR",
    });
  }
}

export function registerPortfolioTradingRoutes(app: Express) {
  app.post("/api/strategy-config", authMiddleware, async (req, res) => {
    try {
      const { normalizeMovingAverageConfig } =
        await import("../strategies/moving-average-crossover");
      const config = normalizeMovingAverageConfig(req.body);
      res.json(config);
    } catch (error) {
      log.error("Routes", "Failed to normalize strategy config", {
        error: error,
      });
      res.status(500).json({
        error: (error as Error).message || "Failed to normalize config",
      });
    }
  });

  app.post("/api/strategy-validate", authMiddleware, async (req, res) => {
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
      const result = await validateMovingAverageConfig(config);
      res.json(result);
    } catch (error) {
      log.error("Routes", "Failed to validate strategy", { error: error });
      res.status(500).json({
        error: (error as Error).message || "Failed to validate strategy",
      });
    }
  });

  // Portfolio snapshot endpoint for Next.js dashboard (MUST be before /api/positions/:id)

  // Portfolio snapshot endpoint - comprehensive portfolio metrics
  app.get("/api/portfolio/snapshot", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId!;

      // Get account info from Alpaca
      const account = await alpaca.getAccount();

      // Get positions from database
      const positions = await storage.getPositions(userId);

      // Calculate metrics
      const totalEquity = parseFloat(account.equity);
      const totalCash = parseFloat(account.cash);
      const todayPnL =
        parseFloat(account.equity) - parseFloat(account.last_equity);
      const totalPositionValue = positions.reduce(
        (sum, pos) =>
          sum + parseFloat(pos.currentPrice || "0") * parseFloat(pos.quantity),
        0
      );

      res.json({
        totalEquity,
        totalCash,
        todayPnL,
        totalPositions: positions.length,
        totalPositionValue,
        buyingPower: parseFloat(account.buying_power),
        portfolioValue: parseFloat(account.portfolio_value),
        lastEquity: parseFloat(account.last_equity),
        accountStatus: account.status,
        daytradeCount: parseInt(String(account.daytrade_count)),
        patternDayTrader: account.pattern_day_trader,
      });
    } catch (error) {
      log.error("Routes", "Failed to get portfolio snapshot", { error: error });
      res.status(500).json({ error: "Failed to get portfolio snapshot" });
    }
  });

  // Trading candidates endpoint - get current trading opportunities
  app.get("/api/trading/candidates", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId!;

      // Get recent AI decisions that could be trading candidates
      const recentDecisions = await storage.getAiDecisions(userId, 50);

      // Filter for high-confidence buy/sell signals that haven't been executed
      const candidates = recentDecisions
        .filter(
          (d) =>
            (d.action === "buy" || d.action === "sell") &&
            d.status === "pending" &&
            parseFloat(d.confidence || "0") >= 0.6
        )
        .map((d) => ({
          symbol: d.symbol,
          action: d.action,
          confidence: d.confidence,
          reasoning: d.reasoning,
          createdAt: d.createdAt,
          entryPrice: d.entryPrice,
          stopLoss: d.stopLoss,
          takeProfit: d.takeProfit,
        }))
        .slice(0, 20);

      res.json(candidates);
    } catch (error) {
      log.error("Routes", "Failed to get trading candidates", { error: error });
      res.status(500).json({ error: "Failed to get trading candidates" });
    }
  });

  // GET /api/portfolio/allocation - Current asset allocation with strategy links
  app.get("/api/portfolio/allocation", authMiddleware, async (req, res) => {
    try {
      const [positions, account] = await Promise.all([
        alpaca.getPositions(),
        alpaca.getAccount(),
      ]);

      const portfolioValue = parseFloat(account.portfolio_value);
      const cash = parseFloat(account.cash);

      // Get database positions to link strategies
      const dbPositions = await storage.getPositions(req.userId);
      const positionStrategyMap = new Map(
        dbPositions.map((p) => [p.symbol, p.strategyId])
      );

      const allocation = positions.map((p) => {
        const marketValue = parseFloat(p.market_value);
        return {
          symbol: p.symbol,
          value: marketValue,
          percent: (marketValue / portfolioValue) * 100,
          qty: parseFloat(p.qty),
          currentPrice: parseFloat(p.current_price),
          unrealizedPnl: parseFloat(p.unrealized_pl),
          strategyId: positionStrategyMap.get(p.symbol) || null,
        };
      });

      // Sort by allocation percentage descending
      allocation.sort((a, b) => b.percent - a.percent);

      res.json({
        allocation,
        cash: {
          value: cash,
          percent: (cash / portfolioValue) * 100,
        },
        portfolioValue,
        totalPositions: positions.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error("PortfolioAPI", "Failed to get allocation", { error });
      return serverError(res, "Failed to get portfolio allocation");
    }
  });

  // GET /api/portfolio/positions - Positions with optional strategy filter
  app.get("/api/portfolio/positions", authMiddleware, async (req, res) => {
    try {
      const { strategyId } = req.query;

      const [alpacaPositions, dbPositions] = await Promise.all([
        alpaca.getPositions(),
        storage.getPositions(req.userId),
      ]);

      // Create maps for quick lookup
      const alpacaMap = new Map(alpacaPositions.map((p) => [p.symbol, p]));
      const dbMap = new Map(dbPositions.map((p) => [p.symbol, p]));

      // Merge data from both sources
      const mergedPositions = alpacaPositions.map((ap) => {
        const dbPos = dbMap.get(ap.symbol);
        return {
          symbol: ap.symbol,
          qty: parseFloat(ap.qty),
          marketValue: parseFloat(ap.market_value),
          costBasis: parseFloat(ap.cost_basis),
          currentPrice: parseFloat(ap.current_price),
          unrealizedPnl: parseFloat(ap.unrealized_pl),
          unrealizedPnlPercent: parseFloat(ap.unrealized_plpc) * 100,
          avgEntryPrice: parseFloat(ap.avg_entry_price),
          side: parseFloat(ap.qty) > 0 ? "long" : "short",
          strategyId: dbPos?.strategyId || null,
          openedAt: dbPos?.openedAt || null,
          dbPositionId: dbPos?.id || null,
        };
      });

      // Filter by strategy if specified
      const filtered = strategyId
        ? mergedPositions.filter((p) => p.strategyId === strategyId)
        : mergedPositions;

      res.json({
        positions: filtered,
        count: filtered.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error("PortfolioAPI", "Failed to get positions", { error });
      return serverError(res, "Failed to get positions");
    }
  });

  // GET /api/portfolio/by-strategy - Portfolio breakdown by strategy
  app.get("/api/portfolio/by-strategy", authMiddleware, async (req, res) => {
    try {
      const [strategies, dbPositions, trades] = await Promise.all([
        storage.getStrategies(),
        storage.getPositions(req.userId),
        storage.getTrades(req.userId, 500),
      ]);

      const alpacaPositions = await alpaca.getPositions();
      const alpacaMap = new Map(alpacaPositions.map((p) => [p.symbol, p]));

      const strategyBreakdown = strategies.map((strategy) => {
        const strategyPositions = dbPositions.filter(
          (p) => p.strategyId === strategy.id
        );
        const strategyTrades = trades.filter(
          (t) => t.strategyId === strategy.id
        );
        const closedTrades = strategyTrades.filter((t) => t.pnl !== null);

        // Calculate market value from Alpaca positions
        let totalMarketValue = 0;
        let totalUnrealizedPnl = 0;
        for (const pos of strategyPositions) {
          const alpacaPos = alpacaMap.get(pos.symbol);
          if (alpacaPos) {
            totalMarketValue += parseFloat(alpacaPos.market_value);
            totalUnrealizedPnl += parseFloat(alpacaPos.unrealized_pl);
          }
        }

        const totalRealizedPnl = closedTrades.reduce(
          (sum, t) => sum + parseFloat(t.pnl || "0"),
          0
        );
        const winningTrades = closedTrades.filter(
          (t) => parseFloat(t.pnl || "0") > 0
        );

        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          strategyType: strategy.type,
          isActive: strategy.isActive,
          positionCount: strategyPositions.length,
          totalMarketValue,
          unrealizedPnl: totalUnrealizedPnl,
          realizedPnl: totalRealizedPnl,
          totalPnl: totalUnrealizedPnl + totalRealizedPnl,
          totalTrades: strategyTrades.length,
          closedTrades: closedTrades.length,
          winRate:
            closedTrades.length > 0
              ? (winningTrades.length / closedTrades.length) * 100
              : 0,
          symbols: strategyPositions.map((p) => p.symbol),
        };
      });

      res.json({
        strategies: strategyBreakdown,
        totalStrategies: strategies.length,
        activeStrategies: strategies.filter((s) => s.isActive).length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error("PortfolioAPI", "Failed to get strategy breakdown", { error });
      return serverError(res, "Failed to get portfolio by strategy");
    }
  });

  // POST /api/portfolio/rebalance/preview - Preview rebalance without executing
  app.post("/api/portfolio/rebalance/preview", authMiddleware, async (req, res) => {
    try {
      const { targetAllocations } = req.body as {
        targetAllocations: { symbol: string; targetPercent: number }[];
      };

      if (!targetAllocations || !Array.isArray(targetAllocations)) {
        return badRequest(res, "targetAllocations array is required");
      }

      const totalTarget = targetAllocations.reduce(
        (sum, a) => sum + a.targetPercent,
        0
      );
      if (totalTarget > 100) {
        return badRequest(res, `Total target allocation (${totalTarget}%) exceeds 100%`);
      }

      const [positions, account] = await Promise.all([
        alpaca.getPositions(),
        alpaca.getAccount(),
      ]);

      const portfolioValue = parseFloat(account.portfolio_value);
      const positionMap = new Map(positions.map((p) => [p.symbol, p]));

      const rebalanceActions = targetAllocations.map((target) => {
        const position = positionMap.get(target.symbol);
        const currentValue = position ? parseFloat(position.market_value) : 0;
        const currentPercent = (currentValue / portfolioValue) * 100;
        const targetValue = (target.targetPercent / 100) * portfolioValue;
        const deltaValue = targetValue - currentValue;
        const currentPrice = position ? parseFloat(position.current_price) : 0;

        let action: "buy" | "sell" | "hold" = "hold";
        if (deltaValue > 50) action = "buy";
        else if (deltaValue < -50) action = "sell";

        return {
          symbol: target.symbol,
          action,
          currentPercent,
          targetPercent: target.targetPercent,
          currentValue,
          targetValue,
          deltaValue,
          estimatedQty: currentPrice > 0 ? Math.abs(Math.floor(deltaValue / currentPrice)) : 0,
        };
      });

      const buys = rebalanceActions.filter((a) => a.action === "buy");
      const sells = rebalanceActions.filter((a) => a.action === "sell");

      res.json({
        preview: {
          actions: rebalanceActions,
          totalBuys: buys.length,
          totalSells: sells.length,
          totalBuyValue: buys.reduce((sum, a) => sum + a.deltaValue, 0),
          totalSellValue: Math.abs(sells.reduce((sum, a) => sum + a.deltaValue, 0)),
        },
        portfolioValue,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error("PortfolioAPI", "Failed to preview rebalance", { error });
      return serverError(res, "Failed to preview rebalance");
    }
  });

  log.info("Routes", "Portfolio trading routes registered");
}
