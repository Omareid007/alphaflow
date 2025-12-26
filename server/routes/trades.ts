import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { safeParseFloat } from "../utils/numeric";
import { badRequest, notFound, serverError } from "../lib/standard-errors";
import type { InsertTrade } from "@shared/schema";
import { insertTradeSchema } from "@shared/schema";
import { log } from "../utils/logger";

const router = Router();

// GET /api/trades - Get trades with optional limit
router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const trades = await storage.getTrades(req.userId!, limit);
    res.json(trades);
  } catch (error) {
    log.error("TradesAPI", "Failed to get trades", { error: error instanceof Error ? error.message : String(error) });
    return serverError(res, "Failed to get trades");
  }
});

// GET /api/trades/enriched - Get trades with filters (symbols, strategy, P&L direction, dates)
router.get("/enriched", async (req: Request, res: Response) => {
  try {
    const filters = {
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
      symbol: req.query.symbol as string | undefined,
      strategyId: req.query.strategyId as string | undefined,
      pnlDirection: (req.query.pnlDirection as 'profit' | 'loss' | 'all') || 'all',
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const result = await storage.getTradesFiltered(req.userId!, filters);
    res.json(result);
  } catch (error) {
    log.error("TradesAPI", "Failed to get enriched trades", { error: error instanceof Error ? error.message : String(error) });
    return serverError(res, "Failed to get enriched trades");
  }
});

// GET /api/trades/symbols - Get all distinct symbols from trades
router.get("/symbols", async (req: Request, res: Response) => {
  try {
    const symbols = await storage.getDistinctSymbols();
    res.json(symbols);
  } catch (error) {
    log.error("TradesAPI", "Failed to get symbols", { error: error instanceof Error ? error.message : String(error) });
    return serverError(res, "Failed to get symbols");
  }
});

// GET /api/trades/:id - Get single trade by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const trade = await storage.getTrade(req.params.id);
    if (!trade) {
      return notFound(res, "Trade not found");
    }
    res.json(trade);
  } catch (error) {
    log.error("TradesAPI", "Failed to get trade", { error: error instanceof Error ? error.message : String(error) });
    return serverError(res, "Failed to get trade");
  }
});

// GET /api/trades/:id/enriched - Get enriched trade by ID with additional metadata
router.get("/:id/enriched", async (req: Request, res: Response) => {
  try {
    const trade = await storage.getEnrichedTrade(req.params.id);
    if (!trade) {
      return notFound(res, "Trade not found");
    }
    res.json(trade);
  } catch (error) {
    log.error("TradesAPI", "Failed to get enriched trade", { error: error instanceof Error ? error.message : String(error) });
    return serverError(res, "Failed to get enriched trade");
  }
});

// POST /api/trades - Create a new trade
router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = insertTradeSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.message);
    }
    const trade = await storage.createTrade(parsed.data);
    res.status(201).json(trade);
  } catch (error) {
    log.error("TradesAPI", "Failed to create trade", { error: error instanceof Error ? error.message : String(error) });
    return serverError(res, "Failed to create trade");
  }
});

// POST /api/trades/backfill-prices - Backfill trade prices from Alpaca order history
router.post("/backfill-prices", async (req: Request, res: Response) => {
  try {
    const trades = await storage.getTrades(500);
    const zeroTrades = trades.filter(t => safeParseFloat(t.price, 0) === 0);

    if (zeroTrades.length === 0) {
      return res.json({ message: "No trades need backfilling", updated: 0 });
    }

    let orders: any[] = [];
    try {
      orders = await alpaca.getOrders("all", 500);
    } catch (e) {
      log.error("TradesAPI", "Failed to fetch Alpaca orders for backfill", { error: e instanceof Error ? e.message : String(e) });
      return serverError(res, "Failed to fetch order history from broker");
    }

    let updated = 0;
    for (const trade of zeroTrades) {
      const matchingOrder = orders.find(o =>
        o.symbol === trade.symbol &&
        o.side === trade.side &&
        o.status === "filled" &&
        safeParseFloat(o.filled_avg_price, 0) > 0 &&
        Math.abs(new Date(o.filled_at).getTime() - new Date(trade.executedAt).getTime()) < 60000
      );

      if (matchingOrder) {
        const filledPrice = safeParseFloat(matchingOrder.filled_avg_price, 0);
        const filledQty = safeParseFloat(matchingOrder.filled_qty, 0);

        await storage.updateTrade(trade.id, {
          price: filledPrice.toString(),
          quantity: filledQty.toString(),
          status: "filled",
        });
        updated++;
      }
    }

    res.json({
      message: `Backfilled ${updated} of ${zeroTrades.length} trades`,
      updated,
      remaining: zeroTrades.length - updated
    });
  } catch (error) {
    log.error("TradesAPI", "Trade backfill error", { error: error instanceof Error ? error.message : String(error) });
    return serverError(res, "Failed to backfill trade prices");
  }
});

export default router;
