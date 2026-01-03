/**
 * API endpoints for Order Retry Handler
 *
 * Provides REST API access to retry statistics, circuit breaker control,
 * and manual retry triggering.
 */

import type { Express, Request, Response } from "express";
import {
  getRetryStats,
  clearRetryHistory,
  resetCircuitBreaker,
  testRejectionReason,
  getRegisteredHandlers,
  handleOrderRejection,
  type AlpacaTradeUpdate,
} from "./order-retry-handler";
import { storage } from "../storage";
import { log } from "../utils/logger";

/**
 * GET /api/trading/retry-stats
 * Get current retry statistics
 */
export async function getRetryStatsHandler(req: Request, res: Response) {
  try {
    const stats = getRetryStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("RetryAPI", "Failed to get retry stats", { error: errorMsg });
    res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
}

/**
 * POST /api/trading/retry-circuit-breaker/reset
 * Manually reset the circuit breaker
 */
export async function resetCircuitBreakerHandler(req: Request, res: Response) {
  try {
    resetCircuitBreaker();
    log.info("RetryAPI", "Circuit breaker manually reset via API");

    res.json({
      success: true,
      message: "Circuit breaker reset successfully",
      stats: getRetryStats().circuitBreakerState,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("RetryAPI", "Failed to reset circuit breaker", {
      error: errorMsg,
    });
    res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
}

/**
 * DELETE /api/trading/retry-history/:orderId
 * Clear retry history for a specific order
 */
export async function clearRetryHistoryHandler(req: Request, res: Response) {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "orderId is required",
      });
    }

    clearRetryHistory(orderId);
    log.info("RetryAPI", `Retry history cleared for order ${orderId}`);

    res.json({
      success: true,
      message: `Retry history cleared for order ${orderId}`,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("RetryAPI", "Failed to clear retry history", { error: errorMsg });
    res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
}

/**
 * POST /api/trading/test-rejection-reason
 * Test a rejection reason against registered handlers
 */
export async function testRejectionReasonHandler(req: Request, res: Response) {
  try {
    const { reason } = req.body;

    if (!reason || typeof reason !== "string") {
      return res.status(400).json({
        success: false,
        error: "reason (string) is required",
      });
    }

    const result = testRejectionReason(reason);

    res.json({
      success: true,
      data: {
        matched: result.matched,
        category: result.category,
        handler: result.handler
          ? {
              description: result.handler.description,
              category: result.handler.category,
              pattern: result.handler.pattern.source,
            }
          : null,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("RetryAPI", "Failed to test rejection reason", {
      error: errorMsg,
    });
    res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
}

/**
 * GET /api/trading/retry-handlers
 * Get all registered rejection handlers
 */
export async function getRetryHandlersHandler(req: Request, res: Response) {
  try {
    const handlers = getRegisteredHandlers();

    res.json({
      success: true,
      data: {
        count: handlers.length,
        handlers: handlers.map((h) => ({
          category: h.category,
          description: h.description,
          pattern: h.pattern.source,
        })),
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("RetryAPI", "Failed to get retry handlers", { error: errorMsg });
    res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
}

/**
 * POST /api/trading/manual-retry/:orderId
 * Manually trigger a retry for a failed order
 */
export async function manualRetryHandler(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "orderId is required",
      });
    }

    // Fetch the order from storage
    const order = await storage.getOrderByBrokerOrderId(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order ${orderId} not found`,
      });
    }

    // Reconstruct AlpacaTradeUpdate from stored order
    const mockUpdate: AlpacaTradeUpdate = {
      event: order.status === "rejected" ? "rejected" : "canceled",
      order: {
        id: orderId,
        client_order_id: order.clientOrderId || "",
        created_at:
          order.submittedAt?.toISOString() || new Date().toISOString(),
        updated_at: order.updatedAt?.toISOString() || new Date().toISOString(),
        submitted_at:
          order.submittedAt?.toISOString() || new Date().toISOString(),
        filled_at: order.filledAt?.toISOString() || null,
        expired_at: null,
        canceled_at:
          order.status === "canceled"
            ? order.updatedAt?.toISOString() || null
            : null,
        failed_at:
          order.status === "rejected"
            ? order.updatedAt?.toISOString() || null
            : null,
        asset_id: "",
        symbol: order.symbol,
        asset_class: "us_equity",
        notional: order.notional || null,
        qty: order.qty || "0",
        filled_qty: order.filledQty || "0",
        filled_avg_price: order.filledAvgPrice || null,
        order_class: "simple",
        order_type: order.type || "market",
        type: order.type || "market",
        side: order.side,
        time_in_force: order.timeInForce || "day",
        limit_price: order.limitPrice || null,
        stop_price: order.stopPrice || null,
        status: order.status,
        extended_hours: false,
      },
      timestamp: new Date().toISOString(),
    };

    log.info("RetryAPI", `Manual retry triggered for order ${orderId}`);

    // Trigger retry
    const result = await handleOrderRejection(mockUpdate, reason);

    res.json({
      success: result.success,
      data: {
        originalOrderId: result.originalOrderId,
        newOrderId: result.newOrderId,
        attempts: result.attempts,
        finalStatus: result.finalStatus,
      },
      error: result.error,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("RetryAPI", "Failed to manually retry order", {
      error: errorMsg,
    });
    res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
}

/**
 * Register all retry API routes
 */
export function registerRetryAPIRoutes(app: Express) {
  app.get("/api/trading/retry-stats", getRetryStatsHandler);
  app.post(
    "/api/trading/retry-circuit-breaker/reset",
    resetCircuitBreakerHandler
  );
  app.delete("/api/trading/retry-history/:orderId", clearRetryHistoryHandler);
  app.post("/api/trading/test-rejection-reason", testRejectionReasonHandler);
  app.get("/api/trading/retry-handlers", getRetryHandlersHandler);
  app.post("/api/trading/manual-retry/:orderId", manualRetryHandler);

  log.info("RetryAPI", "Order retry API routes registered");
}
