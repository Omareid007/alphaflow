/**
 * Alpaca Trading API Routes
 * Handles account, positions, orders, assets, and market data from Alpaca
 */

import { Router, Request, Response } from "express";
import { alpaca } from "../connectors/alpaca";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";
import { log } from "../utils/logger";
import { emitOrderUpdate, emitPositionUpdate } from "../lib/sse-emitter";
import {
  alpacaOrderSchema,
  bracketOrderSchema,
  trailingStopSchema,
  validateRequest,
} from "../validation/api-schemas";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";
import { asyncHandler, badRequest, serverError } from "../lib/standard-errors";

/** Order parameters for Alpaca API */
interface AlpacaOrderParams {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";
  time_in_force: "day" | "gtc" | "opg" | "cls" | "ioc" | "fok";
  qty?: string;
  notional?: string;
  limit_price?: string;
  stop_price?: string;
}

/** Error type with message property */
interface ErrorWithMessage {
  message: string;
}

const router = Router();

// POST /api/alpaca/clear-cache - Clear Alpaca cache (admin only)
router.post(
  "/clear-cache",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    alpaca.clearCache();
    log.info("AlpacaAPI", "Cache cleared successfully");
    res.json({ success: true, message: "Alpaca cache cleared" });
  })
);

// GET /api/alpaca/account - Get Alpaca account info
router.get(
  "/account",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const account = await alpaca.getAccount();
    res.json(account);
  })
);

// GET /api/alpaca/positions - Get current positions
router.get(
  "/positions",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const positions = await alpaca.getPositions();
    // Filter out dust positions (< 0.0001 shares)
    const DUST_THRESHOLD = 0.0001;
    const filteredPositions = positions.filter((p) => {
      const qty = Math.abs(parseFloat(p.qty || "0"));
      return qty >= DUST_THRESHOLD;
    });
    res.json(filteredPositions);
  })
);

// GET /api/alpaca/assets - Get tradable assets
router.get(
  "/assets",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const assetClass =
      (req.query.asset_class as "us_equity" | "crypto") || "us_equity";
    const assets = await alpaca.getAssets("active", assetClass);
    res.json(assets);
  })
);

// GET /api/alpaca/assets/search - Search for assets
router.get(
  "/assets/search",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const query = ((req.query.query as string) || "").toUpperCase();
    if (!query) {
      return res.json([]);
    }
    const allAssets = await alpaca.getAssets("active", "us_equity");
    const matches = allAssets
      .filter(
        (a) =>
          a.symbol.includes(query) ||
          (a.name && a.name.toUpperCase().includes(query))
      )
      .slice(0, 20);
    res.json(matches);
  })
);

// GET /api/alpaca/allocations - Get current portfolio allocations
router.get(
  "/allocations",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await alpacaTradingEngine.getCurrentAllocations();
    res.json(result);
  })
);

// POST /api/alpaca/rebalance/preview - Preview rebalance trades
router.post(
  "/rebalance/preview",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { targetAllocations } = req.body;
    if (!targetAllocations || !Array.isArray(targetAllocations)) {
      throw badRequest("targetAllocations array required");
    }

    for (const alloc of targetAllocations) {
      if (!alloc.symbol || typeof alloc.targetPercent !== "number") {
        throw badRequest("Each allocation must have symbol and targetPercent");
      }
    }

    const preview =
      await alpacaTradingEngine.previewRebalance(targetAllocations);
    res.json(preview);
  })
);

// POST /api/alpaca/rebalance/execute - Execute rebalance trades
router.post(
  "/rebalance/execute",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { targetAllocations, preview } = req.body;
    if (!targetAllocations || !Array.isArray(targetAllocations)) {
      throw badRequest("targetAllocations array required");
    }

    const result = await alpacaTradingEngine.executeRebalance(
      targetAllocations,
      preview
    );
    res.json(result);
  })
);

// GET /api/alpaca/rebalance/suggestions - Get AI rebalance suggestions
router.get(
  "/rebalance/suggestions",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const suggestions = await alpacaTradingEngine.getRebalanceSuggestions();
    res.json(suggestions);
  })
);

// GET /api/alpaca/bars - Get historical price bars
router.get(
  "/bars",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { symbol, timeframe = "1Day", limit = 100 } = req.query;
    if (!symbol) {
      throw badRequest("symbol parameter required");
    }
    const symbolArr = (symbol as string)
      .split(",")
      .map((s) => s.trim().toUpperCase());
    const bars = await alpaca.getBars(
      symbolArr,
      timeframe as string,
      undefined,
      undefined,
      parseInt(limit as string)
    );
    res.json(bars);
  })
);

// GET /api/alpaca/snapshots - Get market snapshots for multiple symbols
router.get(
  "/snapshots",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const symbolsParam = req.query.symbols as string;
    if (!symbolsParam) {
      throw badRequest("symbols parameter required");
    }
    const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase());
    const snapshots = await alpaca.getSnapshots(symbols);

    const result = symbols.map((symbol) => {
      const snap = snapshots[symbol];
      if (!snap) {
        return { symbol, price: null, change: null, volume: null };
      }
      const price = snap.latestTrade?.p || snap.dailyBar?.c || 0;
      const prevClose = snap.prevDailyBar?.c || price;
      const change = price - prevClose;
      const changePercent = prevClose ? (change / prevClose) * 100 : 0;
      return {
        symbol,
        price,
        change,
        changePercent,
        volume: snap.dailyBar?.v || 0,
        high: snap.dailyBar?.h || 0,
        low: snap.dailyBar?.l || 0,
        open: snap.dailyBar?.o || 0,
      };
    });
    res.json(result);
  })
);

// GET /api/alpaca/health - Check Alpaca connection health
router.get(
  "/health",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const start = Date.now();
    const account = await alpaca.getAccount();
    const latencyMs = Date.now() - start;

    res.json({
      status: "healthy",
      latencyMs,
      accountStatus: account.status,
      tradingBlocked: account.trading_blocked,
      accountBlocked: account.account_blocked,
      buyingPower: account.buying_power,
      equity: account.equity,
    });
  })
);

// POST /api/alpaca/reset-circuit-breaker - Reset circuit breaker
router.post(
  "/reset-circuit-breaker",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    alpaca.resetCircuitBreaker();
    log.info("AlpacaAPI", "Circuit breaker reset successfully via API");
    res.json({
      success: true,
      message: "Circuit breaker reset successfully",
    });
  })
);

// GET /api/alpaca/orders - Get orders
router.get(
  "/orders",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const statusParam = (req.query.status as string) || "all";
    const status: "open" | "closed" | "all" =
      statusParam === "open"
        ? "open"
        : statusParam === "closed"
          ? "closed"
          : "all";
    const limit = parseInt(req.query.limit as string) || 100;
    const orders = await alpaca.getOrders(status, limit);
    res.json(orders);
  })
);

// POST /api/alpaca/orders - Create a new order
router.post(
  "/orders",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body using Zod schema
    const validation = validateRequest(alpacaOrderSchema, req.body);
    if (!validation.success) {
      throw badRequest(validation.error);
    }

    const {
      symbol,
      side,
      type,
      qty,
      notional,
      time_in_force,
      limit_price,
      stop_price,
    } = validation.data;

    const orderParams: AlpacaOrderParams = {
      symbol: symbol.toUpperCase(),
      side,
      type: type || "market",
      time_in_force: time_in_force || "day",
    };

    if (qty) orderParams.qty = String(qty);
    if (notional) orderParams.notional = String(notional);
    if (limit_price) orderParams.limit_price = String(limit_price);
    if (stop_price) orderParams.stop_price = String(stop_price);

    const order = await alpaca.createOrder(orderParams);

    // Emit real-time order update to connected clients
    const userId = (req as any).user?.id;
    if (userId) {
      emitOrderUpdate(
        order.id,
        {
          status: order.status,
          symbol: order.symbol,
          side: order.side,
          qty: order.qty,
          filled_qty: order.filled_qty,
          type: order.type,
          created_at: order.created_at,
        },
        userId
      );
    }

    res.json(order);
  })
);

// DELETE /api/alpaca/orders/:orderId - Cancel an order
router.delete(
  "/orders/:orderId",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    await alpaca.cancelOrder(orderId);
    res.json({ success: true, message: "Order cancelled" });
  })
);

// DELETE /api/alpaca/orders - Cancel all orders
router.delete(
  "/orders",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    await alpaca.cancelAllOrders();
    res.json({ success: true, message: "All orders cancelled" });
  })
);

// DELETE /api/alpaca/positions/:symbol - Close a position
router.delete(
  "/positions/:symbol",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const result = await alpaca.closePosition(symbol);
    res.json(result);
  })
);

// DELETE /api/alpaca/positions - Close all positions
router.delete(
  "/positions",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await alpaca.closeAllPositions();
    res.json(result);
  })
);

// GET /api/alpaca/clock - Get market clock
router.get(
  "/clock",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { alpacaTradingEngine } =
      await import("../trading/alpaca-trading-engine");
    const clock = await alpacaTradingEngine.getClock();
    res.json(clock);
  })
);

// GET /api/alpaca/market-status - Get market status
router.get(
  "/market-status",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { alpacaTradingEngine } =
      await import("../trading/alpaca-trading-engine");
    const status = await alpacaTradingEngine.getMarketStatus();
    res.json(status);
  })
);

// GET /api/alpaca/can-trade-extended/:symbol - Check extended hours availability
router.get(
  "/can-trade-extended/:symbol",
  asyncHandler(async (req: Request, res: Response) => {
    const { symbol } = req.params;
    const { alpacaTradingEngine } =
      await import("../trading/alpaca-trading-engine");
    const result = await alpacaTradingEngine.canTradeExtendedHours(symbol);
    res.json(result);
  })
);

// GET /api/alpaca/portfolio-history - Get portfolio history
router.get(
  "/portfolio-history",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const period = (req.query.period as string) || "1M";
    const timeframe = (req.query.timeframe as string) || "1D";
    const history = await alpaca.getPortfolioHistory(period, timeframe);
    res.json(history);
  })
);

// GET /api/alpaca/top-stocks - Get top stocks by market cap
router.get(
  "/top-stocks",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 25;
    const stocks = await alpaca.getTopStocks(limit);
    res.json(stocks);
  })
);

// GET /api/alpaca/top-crypto - Get top crypto by market cap
router.get(
  "/top-crypto",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 25;
    const crypto = await alpaca.getTopCrypto(limit);
    res.json(crypto);
  })
);

// GET /api/alpaca/top-etfs - Get top ETFs by market cap
router.get(
  "/top-etfs",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 25;
    const etfs = await alpaca.getTopETFs(limit);
    res.json(etfs);
  })
);

// POST /api/alpaca/validate-order - Validate order parameters
router.post(
  "/validate-order",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = alpaca.validateOrder(req.body);
    res.json(validation);
  })
);

export default router;
