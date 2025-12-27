/**
 * Alpaca Trading API Routes
 * Handles account, positions, orders, assets, and market data from Alpaca
 */

import { Router, Request, Response } from "express";
import { alpaca } from "../connectors/alpaca";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";
import { log } from "../utils/logger";

const router = Router();

// GET /api/alpaca/account - Get Alpaca account info
router.get("/account", async (req: Request, res: Response) => {
  try {
    const account = await alpaca.getAccount();
    res.json(account);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get Alpaca account", { error });
    res.status(500).json({ error: "Failed to get Alpaca account" });
  }
});

// GET /api/alpaca/positions - Get current positions
router.get("/positions", async (req: Request, res: Response) => {
  try {
    const positions = await alpaca.getPositions();
    // Filter out dust positions (< 0.0001 shares)
    const DUST_THRESHOLD = 0.0001;
    const filteredPositions = positions.filter(p => {
      const qty = Math.abs(parseFloat(p.qty || "0"));
      return qty >= DUST_THRESHOLD;
    });
    res.json(filteredPositions);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get Alpaca positions", { error });
    res.status(500).json({ error: "Failed to get Alpaca positions" });
  }
});

// GET /api/alpaca/assets - Get tradable assets
router.get("/assets", async (req: Request, res: Response) => {
  try {
    const assetClass = (req.query.asset_class as "us_equity" | "crypto") || "us_equity";
    const assets = await alpaca.getAssets("active", assetClass);
    res.json(assets);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get Alpaca assets", { error });
    res.status(500).json({ error: "Failed to get Alpaca assets" });
  }
});

// GET /api/alpaca/assets/search - Search for assets
router.get("/assets/search", async (req: Request, res: Response) => {
  try {
    const query = (req.query.query as string || "").toUpperCase();
    if (!query) {
      return res.json([]);
    }
    const allAssets = await alpaca.getAssets("active", "us_equity");
    const matches = allAssets.filter(a =>
      a.symbol.includes(query) || (a.name && a.name.toUpperCase().includes(query))
    ).slice(0, 20);
    res.json(matches);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to search assets", { error });
    res.status(500).json({ error: "Failed to search assets" });
  }
});

// GET /api/alpaca/allocations - Get current portfolio allocations
router.get("/allocations", async (req: Request, res: Response) => {
  try {
    const result = await alpacaTradingEngine.getCurrentAllocations();
    res.json(result);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get current allocations", { error });
    res.status(500).json({ error: "Failed to get current allocations" });
  }
});

// POST /api/alpaca/rebalance/preview - Preview rebalance trades
router.post("/rebalance/preview", async (req: Request, res: Response) => {
  try {
    const { targetAllocations } = req.body;
    if (!targetAllocations || !Array.isArray(targetAllocations)) {
      return res.status(400).json({ error: "targetAllocations array required" });
    }

    for (const alloc of targetAllocations) {
      if (!alloc.symbol || typeof alloc.targetPercent !== "number") {
        return res.status(400).json({ error: "Each allocation must have symbol and targetPercent" });
      }
    }

    const preview = await alpacaTradingEngine.previewRebalance(targetAllocations);
    res.json(preview);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to preview rebalance", { error });
    res.status(500).json({ error: "Failed to preview rebalance" });
  }
});

// POST /api/alpaca/rebalance/execute - Execute rebalance trades
router.post("/rebalance/execute", async (req: Request, res: Response) => {
  try {
    const { targetAllocations, preview } = req.body;
    if (!targetAllocations || !Array.isArray(targetAllocations)) {
      return res.status(400).json({ error: "targetAllocations array required" });
    }

    const result = await alpacaTradingEngine.executeRebalance(targetAllocations, preview);
    res.json(result);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to execute rebalance", { error });
    res.status(500).json({ error: "Failed to execute rebalance" });
  }
});

// GET /api/alpaca/rebalance/suggestions - Get AI rebalance suggestions
router.get("/rebalance/suggestions", async (req: Request, res: Response) => {
  try {
    const suggestions = await alpacaTradingEngine.getRebalanceSuggestions();
    res.json(suggestions);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get rebalance suggestions", { error });
    res.status(500).json({ error: "Failed to get rebalance suggestions" });
  }
});

// GET /api/alpaca/bars - Get historical price bars
router.get("/bars", async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe = "1Day", limit = 100 } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: "symbol parameter required" });
    }
    const symbolArr = (symbol as string).split(",").map(s => s.trim().toUpperCase());
    const bars = await alpaca.getBars(
      symbolArr,
      timeframe as string,
      undefined,
      undefined,
      parseInt(limit as string)
    );
    res.json(bars);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get bars", { error });
    res.status(500).json({ error: "Failed to get bars" });
  }
});

// GET /api/alpaca/snapshots - Get market snapshots for multiple symbols
router.get("/snapshots", async (req: Request, res: Response) => {
  try {
    const symbolsParam = req.query.symbols as string;
    if (!symbolsParam) {
      return res.status(400).json({ error: "symbols parameter required" });
    }
    const symbols = symbolsParam.split(",").map(s => s.trim().toUpperCase());
    const snapshots = await alpaca.getSnapshots(symbols);

    const result = symbols.map(symbol => {
      const snap = snapshots[symbol];
      if (!snap) {
        return { symbol, price: null, change: null, volume: null };
      }
      const price = snap.latestTrade?.p || snap.dailyBar?.c || 0;
      const prevClose = snap.prevDailyBar?.c || price;
      const change = price - prevClose;
      const changePercent = prevClose ? ((change / prevClose) * 100) : 0;
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
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get snapshots", { error });
    res.status(500).json({ error: "Failed to get snapshots" });
  }
});

// GET /api/alpaca/health - Check Alpaca connection health
router.get("/health", async (req: Request, res: Response) => {
  try {
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
  } catch (error: any) {
    log.error("AlpacaAPI", "Alpaca health check failed", { error });
    res.status(503).json({
      status: "unhealthy",
      error: error.message || "Connection failed",
    });
  }
});

// GET /api/alpaca/orders - Get orders
router.get("/orders", async (req: Request, res: Response) => {
  try {
    const statusParam = (req.query.status as string) || "all";
    const status: "open" | "closed" | "all" =
      statusParam === "open" ? "open" :
      statusParam === "closed" ? "closed" : "all";
    const limit = parseInt(req.query.limit as string) || 100;
    const orders = await alpaca.getOrders(status, limit);
    res.json(orders);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get orders", { error });
    res.status(500).json({ error: "Failed to get orders" });
  }
});

// POST /api/alpaca/orders - Create a new order
router.post("/orders", async (req: Request, res: Response) => {
  try {
    const { symbol, side, type, qty, notional, time_in_force, limit_price, stop_price } = req.body;

    if (!symbol || !side) {
      return res.status(400).json({ error: "symbol and side are required" });
    }

    const orderParams: any = {
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
    res.json(order);
  } catch (error: any) {
    log.error("AlpacaAPI", "Failed to create order", { error });
    res.status(500).json({ error: error.message || "Failed to create order" });
  }
});

// DELETE /api/alpaca/orders/:orderId - Cancel an order
router.delete("/orders/:orderId", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    await alpaca.cancelOrder(orderId);
    res.json({ success: true, message: "Order cancelled" });
  } catch (error: any) {
    log.error("AlpacaAPI", "Failed to cancel order", { error });
    res.status(500).json({ error: error.message || "Failed to cancel order" });
  }
});

// DELETE /api/alpaca/orders - Cancel all orders
router.delete("/orders", async (req: Request, res: Response) => {
  try {
    await alpaca.cancelAllOrders();
    res.json({ success: true, message: "All orders cancelled" });
  } catch (error: any) {
    log.error("AlpacaAPI", "Failed to cancel all orders", { error });
    res.status(500).json({ error: error.message || "Failed to cancel all orders" });
  }
});

// DELETE /api/alpaca/positions/:symbol - Close a position
router.delete("/positions/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const result = await alpaca.closePosition(symbol);
    res.json(result);
  } catch (error: any) {
    log.error("AlpacaAPI", "Failed to close position", { error });
    res.status(500).json({ error: error.message || "Failed to close position" });
  }
});

// DELETE /api/alpaca/positions - Close all positions
router.delete("/positions", async (req: Request, res: Response) => {
  try {
    const result = await alpaca.closeAllPositions();
    res.json(result);
  } catch (error: any) {
    log.error("AlpacaAPI", "Failed to close all positions", { error });
    res.status(500).json({ error: error.message || "Failed to close all positions" });
  }
});

// GET /api/alpaca/clock - Get market clock
router.get("/clock", async (req: Request, res: Response) => {
  try {
    const { alpacaTradingEngine } = await import("../trading/alpaca-trading-engine");
    const clock = await alpacaTradingEngine.getClock();
    res.json(clock);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get market clock", { error });
    res.status(500).json({ error: "Failed to get market clock" });
  }
});

// GET /api/alpaca/market-status - Get market status
router.get("/market-status", async (req: Request, res: Response) => {
  try {
    const { alpacaTradingEngine } = await import("../trading/alpaca-trading-engine");
    const status = await alpacaTradingEngine.getMarketStatus();
    res.json(status);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get market status", { error });
    res.status(500).json({ error: "Failed to get market status" });
  }
});

// GET /api/alpaca/can-trade-extended/:symbol - Check extended hours availability
router.get("/can-trade-extended/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { alpacaTradingEngine } = await import("../trading/alpaca-trading-engine");
    const result = await alpacaTradingEngine.canTradeExtendedHours(symbol);
    res.json(result);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to check extended hours", { error });
    res.status(500).json({ error: "Failed to check extended hours availability" });
  }
});

// GET /api/alpaca/portfolio-history - Get portfolio history
router.get("/portfolio-history", async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || "1M";
    const timeframe = (req.query.timeframe as string) || "1D";
    const history = await alpaca.getPortfolioHistory(period, timeframe);
    res.json(history);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get portfolio history", { error });
    res.status(500).json({ error: "Failed to get portfolio history" });
  }
});

// GET /api/alpaca/top-stocks - Get top stocks by market cap
router.get("/top-stocks", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const stocks = await alpaca.getTopStocks(limit);
    res.json(stocks);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get top stocks", { error });
    res.status(500).json({ error: "Failed to get top stocks" });
  }
});

// GET /api/alpaca/top-crypto - Get top crypto by market cap
router.get("/top-crypto", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const crypto = await alpaca.getTopCrypto(limit);
    res.json(crypto);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get top crypto", { error });
    res.status(500).json({ error: "Failed to get top crypto" });
  }
});

// GET /api/alpaca/top-etfs - Get top ETFs by market cap
router.get("/top-etfs", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const etfs = await alpaca.getTopETFs(limit);
    res.json(etfs);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to get top ETFs", { error });
    res.status(500).json({ error: "Failed to get top ETFs" });
  }
});

// POST /api/alpaca/validate-order - Validate order parameters
router.post("/validate-order", async (req: Request, res: Response) => {
  try {
    const validation = alpaca.validateOrder(req.body);
    res.json(validation);
  } catch (error) {
    log.error("AlpacaAPI", "Failed to validate order", { error });
    res.status(500).json({ error: "Failed to validate order" });
  }
});

export default router;
