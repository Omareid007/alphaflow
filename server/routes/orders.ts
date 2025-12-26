import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";
import { log } from "../utils/logger";
import {
  orderExecutionEngine,
  identifyUnrealOrders,
  cleanupUnrealOrders,
  reconcileOrderBook,
} from "../trading/order-execution-flow";
import {
  mapAlpacaOrderToEnriched,
  createLiveSourceMetadata,
  createUnavailableSourceMetadata,
} from "@shared/position-mapper";
import { workQueue } from "../lib/work-queue";
import { tradabilityService } from "../services/tradability-service";
import type { Fill } from "@shared/schema";

const router = Router();

// ============================================================================
// AUTONOMOUS TRADING ORDERS
// ============================================================================

/**
 * GET /api/autonomous/open-orders
 * Retrieve all open orders from the trading engine
 */
router.get("/autonomous/open-orders", async (req: Request, res: Response) => {
  try {
    const orders = await alpacaTradingEngine.getOpenOrders();
    res.json(orders);
  } catch (error) {
    log.error("OrdersRoutes", "Failed to get open orders", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/autonomous/cancel-stale-orders
 * Cancel orders that have been open for longer than maxAgeMinutes
 * Body: { maxAgeMinutes?: number }
 */
router.post("/autonomous/cancel-stale-orders", async (req: Request, res: Response) => {
  try {
    const { maxAgeMinutes } = req.body;
    const result = await alpacaTradingEngine.cancelStaleOrders(maxAgeMinutes || 60);
    res.json({ success: true, ...result });
  } catch (error) {
    log.error("OrdersRoutes", "Failed to cancel stale orders", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/autonomous/cancel-all-orders
 * Cancel all open orders
 */
router.post("/autonomous/cancel-all-orders", async (req: Request, res: Response) => {
  try {
    const result = await alpacaTradingEngine.cancelAllOpenOrders();
    res.json({ success: result.cancelled > 0, ...result });
  } catch (error) {
    log.error("OrdersRoutes", "Failed to cancel all orders", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================================
// ORDER RECONCILIATION & CLEANUP
// ============================================================================

/**
 * GET /api/orders/unreal
 * Identify orders that exist locally but not in the broker
 */
router.get("/unreal", async (req: Request, res: Response) => {
  try {
    const unrealOrders = await identifyUnrealOrders();
    res.json({
      count: unrealOrders.length,
      orders: unrealOrders,
    });
  } catch (error) {
    log.error("OrdersRoutes", "Failed to identify unreal orders", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/orders/cleanup
 * Clean up unreal orders (cancel them locally)
 */
router.post("/cleanup", async (req: Request, res: Response) => {
  try {
    const result = await cleanupUnrealOrders();
    res.json({
      success: result.errors.length === 0,
      identified: result.identified,
      canceled: result.canceled,
      errors: result.errors,
    });
  } catch (error) {
    log.error("OrdersRoutes", "Failed to cleanup unreal orders", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/orders/reconcile
 * Reconcile order book between local database and broker
 */
router.post("/reconcile", async (req: Request, res: Response) => {
  try {
    const result = await reconcileOrderBook();
    res.json({
      success: true,
      alpacaOrders: result.alpacaOrders,
      localTrades: result.localTrades,
      missingLocal: result.missingLocal,
      orphanedLocal: result.orphanedLocal,
      synced: result.synced,
    });
  } catch (error) {
    log.error("OrdersRoutes", "Failed to reconcile order book", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/orders/execution-engine/status
 * Get status of active order executions
 */
router.get("/execution-engine/status", async (req: Request, res: Response) => {
  try {
    const activeExecutions = orderExecutionEngine.getActiveExecutions();
    const executions = Array.from(activeExecutions.entries()).map(([id, state]) => ({
      clientOrderId: id,
      orderId: state.orderId,
      symbol: state.symbol,
      side: state.side,
      status: state.status,
      attempts: state.attempts,
      createdAt: state.createdAt.toISOString(),
      updatedAt: state.updatedAt.toISOString(),
    }));
    res.json({
      activeCount: executions.length,
      executions,
    });
  } catch (error) {
    log.error("OrdersRoutes", "Failed to get execution engine status", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================================
// ORDER RETRIEVAL & MANAGEMENT
// ============================================================================

/**
 * GET /api/orders
 * Get orders from local database with optional status filter
 * Query params: { limit?: number, status?: string }
 */
router.get("/", async (req: Request, res: Response) => {
  const fetchedAt = new Date();
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;

    let orders;
    if (status) {
      orders = await storage.getOrdersByStatus(req.userId!, status, limit);
    } else {
      orders = await storage.getRecentOrders(req.userId!, limit);
    }

    res.json({
      orders,
      _source: {
        type: "database",
        table: "orders",
        fetchedAt: fetchedAt.toISOString(),
        note: "Orders stored in local database, synced from broker",
      },
    });
  } catch (error) {
    log.error("OrdersRoutes", "Failed to fetch orders", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/orders/sync
 * Manually trigger order sync with broker
 */
router.post("/sync", async (req: Request, res: Response) => {
  try {
    const traceId = `api-sync-${Date.now()}`;

    // Enqueue an ORDER_SYNC work item
    const workItem = await workQueue.enqueue({
      type: "ORDER_SYNC",
      payload: JSON.stringify({ traceId }),
      maxAttempts: 3,
    });

    res.json({
      success: true,
      workItemId: workItem.id,
      message: "Order sync enqueued",
      traceId,
    });
  } catch (error) {
    log.error("OrdersRoutes", "Failed to enqueue order sync", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/orders/recent
 * Get live orders from Alpaca (source of truth per SOURCE_OF_TRUTH_CONTRACT.md)
 * Query params: { limit?: number }
 */
router.get("/recent", async (req: Request, res: Response) => {
  const fetchedAt = new Date();
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const orders = await alpaca.getOrders("all", limit);

    const enrichedOrders = orders.map((o) => ({
      ...mapAlpacaOrderToEnriched(o, fetchedAt),
      assetClass: o.asset_class,
      submittedAt: o.submitted_at,
      isAI: true,
    }));

    res.json({
      orders: enrichedOrders,
      _source: createLiveSourceMetadata(),
    });
  } catch (error) {
    log.error("OrdersRoutes", "Failed to fetch recent orders", { error: error instanceof Error ? error.message : String(error) });
    res.status(503).json({
      error: "Failed to fetch recent orders",
      _source: createUnavailableSourceMetadata(),
      message: "Could not connect to Alpaca Paper Trading. Please try again shortly.",
    });
  }
});

/**
 * GET /api/orders/:id
 * Get a single order by ID with its associated fills
 * Supports both database ID and broker order ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Try by database ID first, then by brokerOrderId
    let order = await storage.getOrderByBrokerOrderId(id);

    if (!order) {
      // Could also try by ID if needed
      const orders = await storage.getRecentOrders(1000);
      order = orders.find((o) => o.id === id);
    }

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Fetch fills for this order
    const fills = await storage.getFillsByOrderId(order.id);

    res.json({
      order,
      fills,
      _source: {
        type: "database",
        table: "orders",
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error("OrdersRoutes", "Failed to fetch order", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================================
// FILLS ENDPOINTS
// ============================================================================

/**
 * GET /api/fills
 * Get recent fills from all orders
 * Query params: { limit?: number }
 */
router.get("/fills", async (req: Request, res: Response) => {
  const fetchedAt = new Date();
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    // Get recent fills - we'll need to add a method for this
    const orders = await storage.getRecentOrders(req.userId!, 100);
    const orderIds = orders.map((o) => o.id);

    let allFills: Fill[] = [];
    for (const orderId of orderIds) {
      const fills = await storage.getFillsByOrderId(orderId);
      allFills = allFills.concat(fills);
    }

    // Sort by occurredAt descending and limit
    allFills.sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
    allFills = allFills.slice(0, limit);

    res.json({
      fills: allFills,
      _source: {
        type: "database",
        table: "fills",
        fetchedAt: fetchedAt.toISOString(),
      },
    });
  } catch (error) {
    log.error("OrdersRoutes", "Failed to fetch fills", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/fills/order/:orderId
 * Get fills for a specific order
 */
router.get("/fills/order/:orderId", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    // Try by database order ID first
    let fills = await storage.getFillsByOrderId(orderId);

    // If not found, try by brokerOrderId
    if (fills.length === 0) {
      fills = await storage.getFillsByBrokerOrderId(orderId);
    }

    res.json({
      fills,
      _source: {
        type: "database",
        table: "fills",
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error("OrdersRoutes", "Failed to fetch fills for order", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================================
// ALPACA BROKER ORDERS
// ============================================================================

/**
 * GET /api/alpaca/orders
 * Get orders from Alpaca broker
 * Query params: { status?: "open" | "closed" | "all", limit?: number }
 */
router.get("/alpaca/orders", async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as "open" | "closed" | "all") || "all";
    const limit = parseInt(req.query.limit as string) || 50;
    const orders = await alpaca.getOrders(status, limit);
    res.json(orders);
  } catch (error) {
    log.error("OrdersRoutes", "Failed to get Alpaca orders", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: "Failed to get Alpaca orders" });
  }
});

/**
 * POST /api/alpaca/orders
 * Create a new order on Alpaca broker
 * Body: Order creation parameters (symbol required)
 */
router.post("/alpaca/orders", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    const tradabilityCheck = await tradabilityService.validateSymbolTradable(symbol);
    if (!tradabilityCheck.tradable) {
      return res.status(400).json({
        error: `Symbol ${symbol} is not tradable`,
        reason: tradabilityCheck.reason || "Not found in broker universe",
        tradabilityCheck,
      });
    }

    const order = await alpaca.createOrder(req.body);
    res.status(201).json(order);
  } catch (error) {
    log.error("OrdersRoutes", "Failed to create Alpaca order", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: "Failed to create Alpaca order" });
  }
});

/**
 * DELETE /api/alpaca/orders/:orderId
 * Cancel an order on Alpaca broker
 */
router.delete("/alpaca/orders/:orderId", async (req: Request, res: Response) => {
  try {
    await alpaca.cancelOrder(req.params.orderId);
    res.status(204).send();
  } catch (error) {
    log.error("OrdersRoutes", "Failed to cancel Alpaca order", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: "Failed to cancel Alpaca order" });
  }
});

export default router;
