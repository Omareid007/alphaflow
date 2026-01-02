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
import { requireAuth, requireAdmin } from "../middleware/requireAuth";
import { asyncHandler, notFoundError } from "../lib/standard-errors";

const router = Router();

// ============================================================================
// ORDER RECONCILIATION & CLEANUP
// ============================================================================

/**
 * GET /api/orders/unreal
 * Identify orders that exist locally but not in the broker
 */
router.get(
  "/unreal",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const unrealOrders = await identifyUnrealOrders();
    res.json({
      count: unrealOrders.length,
      orders: unrealOrders,
    });
  })
);

/**
 * POST /api/orders/cleanup
 * Clean up unreal orders (cancel them locally)
 */
router.post(
  "/cleanup",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await cleanupUnrealOrders();
    res.json({
      success: result.errors.length === 0,
      identified: result.identified,
      canceled: result.canceled,
      errors: result.errors,
    });
  })
);

/**
 * POST /api/orders/reconcile
 * Reconcile order book between local database and broker
 */
router.post(
  "/reconcile",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await reconcileOrderBook();
    res.json({
      success: true,
      alpacaOrders: result.alpacaOrders,
      localTrades: result.localTrades,
      missingLocal: result.missingLocal,
      orphanedLocal: result.orphanedLocal,
      synced: result.synced,
    });
  })
);

/**
 * GET /api/orders/execution-engine/status
 * Get status of active order executions
 */
router.get(
  "/execution-engine/status",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

// ============================================================================
// ORDER RETRIEVAL & MANAGEMENT
// ============================================================================

/**
 * GET /api/orders
 * Get orders from local database with optional status filter
 * Query params: { limit?: number, status?: string }
 */
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const fetchedAt = new Date();
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
  })
);

/**
 * POST /api/orders/sync
 * Manually trigger order sync with broker
 */
router.post(
  "/sync",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

/**
 * GET /api/orders/recent
 * Get live orders from Alpaca (source of truth per SOURCE_OF_TRUTH_CONTRACT.md)
 * Query params: { limit?: number }
 */
router.get(
  "/recent",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const fetchedAt = new Date();
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
  })
);

// ============================================================================
// FILLS ENDPOINTS (must be before /:id to avoid being caught by it)
// ============================================================================

/**
 * GET /api/orders/fills
 * Get recent fills from all orders
 * Query params: { limit?: number }
 */
router.get(
  "/fills",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const fetchedAt = new Date();
    const limit = parseInt(req.query.limit as string) || 50;

    // Get recent fills using batch query (100x faster than N+1)
    const orders = await storage.getRecentOrders(req.userId!, 100);
    const orderIds = orders.map((o) => o.id);

    // Batch fetch all fills in a single query instead of N queries
    let allFills = await storage.getFillsByOrderIds(orderIds);

    // Sort by occurredAt descending and limit (already sorted by DB, but limit here)
    allFills = allFills.slice(0, limit);

    res.json({
      fills: allFills,
      _source: {
        type: "database",
        table: "fills",
        fetchedAt: fetchedAt.toISOString(),
      },
    });
  })
);

/**
 * GET /api/orders/fills/order/:orderId
 * Get fills for a specific order
 */
router.get(
  "/fills/order/:orderId",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

// ============================================================================
// CATCH-ALL ORDER BY ID (must be LAST to not catch other routes)
// ============================================================================

/**
 * GET /api/orders/:id
 * Get a single order by ID with its associated fills
 * Supports both database ID and broker order ID
 */
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Try by database ID first, then by brokerOrderId
    let order = await storage.getOrderById(id);

    if (!order) {
      // Fallback to broker order ID lookup
      order = await storage.getOrderByBrokerOrderId(id);
    }

    if (!order) {
      throw notFoundError("Order not found");
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
  })
);

export default router;
