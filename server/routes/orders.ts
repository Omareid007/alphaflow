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
    log.error("OrdersRoutes", "Failed to identify unreal orders", {
      error: error instanceof Error ? error.message : String(error),
    });
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
    log.error("OrdersRoutes", "Failed to cleanup unreal orders", {
      error: error instanceof Error ? error.message : String(error),
    });
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
    log.error("OrdersRoutes", "Failed to reconcile order book", {
      error: error instanceof Error ? error.message : String(error),
    });
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
    const executions = Array.from(activeExecutions.entries()).map(
      ([id, state]) => ({
        clientOrderId: id,
        orderId: state.orderId,
        symbol: state.symbol,
        side: state.side,
        status: state.status,
        attempts: state.attempts,
        createdAt: state.createdAt.toISOString(),
        updatedAt: state.updatedAt.toISOString(),
      })
    );
    res.json({
      activeCount: executions.length,
      executions,
    });
  } catch (error) {
    log.error("OrdersRoutes", "Failed to get execution engine status", {
      error: error instanceof Error ? error.message : String(error),
    });
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
    log.error("OrdersRoutes", "Failed to fetch orders", {
      error: error instanceof Error ? error.message : String(error),
    });
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
    log.error("OrdersRoutes", "Failed to enqueue order sync", {
      error: error instanceof Error ? error.message : String(error),
    });
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
    log.error("OrdersRoutes", "Failed to fetch recent orders", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({
      error: "Failed to fetch recent orders",
      _source: createUnavailableSourceMetadata(),
      message:
        "Could not connect to Alpaca Paper Trading. Please try again shortly.",
    });
  }
});

// ============================================================================
// FILLS ENDPOINTS (must be before /:id to avoid being caught by it)
// ============================================================================

/**
 * GET /api/orders/fills
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
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
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
    log.error("OrdersRoutes", "Failed to fetch fills", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/orders/fills/order/:orderId
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
    log.error("OrdersRoutes", "Failed to fetch fills for order", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================================
// CATCH-ALL ORDER BY ID (must be LAST to not catch other routes)
// ============================================================================

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
      const orders = await storage.getRecentOrders(undefined, 1000);
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
    log.error("OrdersRoutes", "Failed to fetch order", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: String(error) });
  }
});

export default router;
