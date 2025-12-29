/**
 * @module autonomous/order-queue
 * @description Order Queue Management
 *
 * Functions for queuing order execution and cancellation through the work queue system.
 *
 * Key features:
 * - Idempotency keys prevent duplicate order submissions (5-minute time buckets)
 * - Automatic retry with exponential backoff (up to 3 attempts)
 * - Polling-based order status monitoring with 60-second timeout
 * - Validation of cached order results against broker state
 * - Graceful handling of cancelled/rejected orders
 *
 * The idempotency mechanism uses time-bucketed keys to allow same-symbol orders
 * to be placed in different time windows while preventing duplicates within a
 * 5-minute window.
 */

import { alpaca, CreateOrderParams } from "../connectors/alpaca";
import { workQueue, generateIdempotencyKey } from "../lib/work-queue";
import { log } from "../utils/logger";
import type { QueuedOrderResult } from "./types";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Interval between polling attempts when waiting for work queue item completion.
 * @constant
 * @type {number}
 * @private
 */
const QUEUE_POLL_INTERVAL_MS = 2000;

/**
 * Maximum time to wait for work queue item completion before timing out.
 * @constant
 * @type {number}
 * @private
 */
const QUEUE_POLL_TIMEOUT_MS = 60000;

// ============================================================================
// ORDER EXECUTION QUEUE
// ============================================================================

/**
 * Queue an order for execution through the work queue.
 *
 * This function provides idempotent order submission with the following workflow:
 * 1. Creates an idempotency key based on strategy, symbol, side, and 5-minute time bucket
 * 2. Enqueues the order in the work queue system
 * 3. Polls for completion with 2-second intervals (up to 60 seconds)
 * 4. For cached results, validates order status with Alpaca to prevent stale data issues
 *
 * Idempotency behavior:
 * - Same symbol/side within 5-minute window returns cached result
 * - Orders in different 5-minute windows get fresh idempotency keys
 * - Cached orders with terminal failed states (canceled/rejected/expired) are invalidated
 *
 * Side effects:
 * - Creates work queue item in database
 * - May invalidate existing work items if orders are canceled/rejected
 * - Logs order submission progress
 *
 * @param {Object} params - Order parameters and metadata
 * @param {CreateOrderParams} params.orderParams - Alpaca order parameters
 * @param {string | null} params.traceId - Trace ID for logging
 * @param {string} [params.strategyId] - Strategy identifier (defaults to "autonomous")
 * @param {string} params.symbol - Trading symbol
 * @param {"buy" | "sell"} params.side - Order side
 * @param {string} [params.decisionId] - AI decision ID that triggered this order
 *
 * @returns {Promise<QueuedOrderResult>} Object containing orderId, status, and workItemId
 *
 * @throws {Error} If order submission fails, times out, or broker rejects the order
 *
 * @example
 * const result = await queueOrderExecution({
 *   orderParams: { symbol: "AAPL", qty: "10", side: "buy", type: "market", time_in_force: "day" },
 *   traceId: "abc123",
 *   strategyId: "momentum",
 *   symbol: "AAPL",
 *   side: "buy",
 *   decisionId: "decision-456"
 * });
 * console.log(`Order ${result.orderId} status: ${result.status}`);
 */
export async function queueOrderExecution(params: {
  orderParams: CreateOrderParams;
  traceId: string | null;
  strategyId?: string;
  symbol: string;
  side: "buy" | "sell";
  decisionId?: string;
}): Promise<QueuedOrderResult> {
  const { orderParams, traceId, strategyId, symbol, side, decisionId } = params;

  const timestampBucket = Math.floor(Date.now() / 300000).toString();
  const idempotencyKey = generateIdempotencyKey({
    strategyId: strategyId || "autonomous",
    symbol,
    side,
    timeframeBucket: timestampBucket,
  });

  log.info("Orchestrator", `Queuing ORDER_SUBMIT for ${symbol} ${side}`, {
    traceId,
    idempotencyKey,
    symbol,
    side,
  });

  const normalizedOrderParams = {
    symbol: orderParams.symbol,
    side: orderParams.side,
    type: orderParams.type || "market",
    time_in_force: orderParams.time_in_force || "day",
    ...(orderParams.qty && { qty: orderParams.qty }),
    ...(orderParams.notional && { notional: orderParams.notional }),
    ...(orderParams.limit_price && { limit_price: orderParams.limit_price }),
    ...(orderParams.stop_price && { stop_price: orderParams.stop_price }),
    ...(orderParams.extended_hours !== undefined && { extended_hours: orderParams.extended_hours }),
    ...(orderParams.order_class && { order_class: orderParams.order_class }),
    // Include both nested and flat formats for bracket order params
    // Work queue expects flat fields, direct API calls may use nested
    ...(orderParams.take_profit && { take_profit: orderParams.take_profit }),
    ...(orderParams.stop_loss && { stop_loss: orderParams.stop_loss }),
    ...((orderParams as any).take_profit_limit_price && { take_profit_limit_price: (orderParams as any).take_profit_limit_price }),
    ...((orderParams as any).stop_loss_stop_price && { stop_loss_stop_price: (orderParams as any).stop_loss_stop_price }),
  };

  const workItem = await workQueue.enqueue({
    type: "ORDER_SUBMIT",
    symbol,
    idempotencyKey,
    decisionId: decisionId || null,
    payload: JSON.stringify({
      ...normalizedOrderParams,
      traceId,
      strategyId,
    }),
    maxAttempts: 3,
  });

  log.info("Orchestrator", `Work item created: ${workItem.id}`, {
    traceId,
    workItemId: workItem.id,
    status: workItem.status,
  });

  if (workItem.status === "SUCCEEDED" && workItem.result) {
    const result = JSON.parse(workItem.result);

    // CRITICAL: Verify actual Alpaca order status before returning cached result
    // This prevents infinite loops when orders are canceled after initial acceptance
    if (result.orderId) {
      try {
        const alpacaOrder = await alpaca.getOrder(result.orderId);
        const actualStatus = alpacaOrder.status?.toLowerCase() || "unknown";
        const terminalFailedStates = ["canceled", "rejected", "expired", "suspended"];

        if (terminalFailedStates.includes(actualStatus)) {
          log.warn("Orchestrator", `Duplicate order ${result.orderId} has terminal failed status: ${actualStatus}, invalidating work item`, { traceId });

          // Invalidate the work item so a new order can be created with fresh idempotency key
          await workQueue.invalidateWorkItem(workItem.id, `Order ${actualStatus} by broker`);

          // Throw to let the caller handle retry with new idempotency key
          throw new Error(`Previous order was ${actualStatus}, retry with new parameters`);
        }

        log.info("Orchestrator", `Order already succeeded (duplicate): ${result.orderId}, current status: ${actualStatus}`, { traceId });
      } catch (orderCheckError: any) {
        // If order not found, it was likely canceled
        if (orderCheckError.message?.includes("not found") || orderCheckError.status === 404) {
          log.warn("Orchestrator", `Duplicate order ${result.orderId} not found in Alpaca, invalidating work item`, { traceId });
          await workQueue.invalidateWorkItem(workItem.id, "Order not found in broker");
          throw new Error("Previous order not found, retry with new parameters");
        }

        // If it's our own thrown error about order being canceled, re-throw it
        if (orderCheckError.message?.includes("retry with new parameters")) {
          throw orderCheckError;
        }

        // For other errors (network issues, etc.), log but return cached result
        log.warn("Orchestrator", `Could not verify duplicate order status: ${orderCheckError.message}`, { traceId });
      }
    }

    return {
      orderId: result.orderId,
      status: result.status || "filled",
      workItemId: workItem.id,
    };
  }

  const startTime = Date.now();
  while (Date.now() - startTime < QUEUE_POLL_TIMEOUT_MS) {
    await new Promise(resolve => setTimeout(resolve, QUEUE_POLL_INTERVAL_MS));

    const updatedItem = await workQueue.getById(workItem.id);
    if (!updatedItem) {
      throw new Error(`Work item ${workItem.id} not found during polling`);
    }

    if (updatedItem.status === "SUCCEEDED") {
      const result = updatedItem.result ? JSON.parse(updatedItem.result) : {};
      const orderStatus = result.status || "accepted";
      const validSuccessStates = ["filled", "accepted", "new", "pending_new", "partially_filled", "queued"];

      if (validSuccessStates.includes(orderStatus.toLowerCase()) || result.orderId || updatedItem.brokerOrderId) {
        log.info("Orchestrator", `ORDER_SUBMIT succeeded: ${result.orderId || updatedItem.brokerOrderId}`, {
          traceId,
          workItemId: workItem.id,
          orderId: result.orderId,
          orderStatus,
        });
        return {
          orderId: result.orderId || updatedItem.brokerOrderId || "",
          status: orderStatus,
          workItemId: workItem.id,
        };
      }
    }

    if (updatedItem.brokerOrderId && !updatedItem.result) {
      log.info("Orchestrator", `ORDER_SUBMIT has broker order ID: ${updatedItem.brokerOrderId}`, {
        traceId,
        workItemId: workItem.id,
      });
      return {
        orderId: updatedItem.brokerOrderId,
        status: "accepted",
        workItemId: workItem.id,
      };
    }

    if (updatedItem.status === "DEAD_LETTER") {
      log.error("Orchestrator", `ORDER_SUBMIT failed permanently: ${updatedItem.lastError}`, {
        traceId,
        workItemId: workItem.id,
      });
      throw new Error(`Order submission failed: ${updatedItem.lastError || "Unknown error"}`);
    }

    log.info("Orchestrator", `Polling work item ${workItem.id}: ${updatedItem.status}`, {
      traceId,
      attempts: updatedItem.attempts,
    });
  }

  throw new Error(`Order submission timed out after ${QUEUE_POLL_TIMEOUT_MS}ms`);
}

// ============================================================================
// ORDER CANCELLATION QUEUE
// ============================================================================

/**
 * Queue an order cancellation through the work queue.
 *
 * This function provides idempotent order cancellation with the following workflow:
 * 1. Creates an idempotency key based on orderId and 1-minute time bucket
 * 2. Enqueues the cancellation in the work queue system
 * 3. Polls for completion with 2-second intervals (up to 60 seconds)
 * 4. Gracefully handles already-cancelled or not-found orders
 *
 * Idempotency behavior:
 * - Same orderId within 1-minute window returns cached result
 * - Different time buckets allow retry if needed
 *
 * Side effects:
 * - Creates work queue item in database
 * - Logs cancellation progress and results
 * - Does not throw on already-cancelled orders (treated as success)
 *
 * @param {Object} params - Cancellation parameters
 * @param {string} params.orderId - Broker order ID to cancel
 * @param {string | null} params.traceId - Trace ID for logging
 * @param {string} params.symbol - Trading symbol
 * @param {string} [params.strategyId] - Strategy identifier (defaults to "autonomous")
 *
 * @returns {Promise<void>} Resolves when cancellation completes or is confirmed already done
 *
 * @throws {Error} If cancellation work item not found during polling
 *
 * @example
 * await queueOrderCancellation({
 *   orderId: "abc-123-def",
 *   traceId: "trace-456",
 *   symbol: "AAPL",
 *   strategyId: "momentum"
 * });
 * console.log("Order cancelled successfully");
 */
export async function queueOrderCancellation(params: {
  orderId: string;
  traceId: string | null;
  symbol: string;
  strategyId?: string;
}): Promise<void> {
  const { orderId, traceId, symbol, strategyId } = params;

  const timestampBucket = Math.floor(Date.now() / 60000).toString();
  const idempotencyKey = generateIdempotencyKey({
    strategyId: strategyId || "autonomous",
    symbol,
    side: `cancel-${orderId}`,
    timeframeBucket: timestampBucket,
  });

  log.info("Orchestrator", `Queuing ORDER_CANCEL for order ${orderId}`, {
    traceId,
    orderId,
    symbol,
    idempotencyKey,
  });

  const workItem = await workQueue.enqueue({
    type: "ORDER_CANCEL",
    symbol,
    idempotencyKey,
    payload: JSON.stringify({ orderId, traceId }),
    maxAttempts: 3,
  });

  if (workItem.status === "SUCCEEDED") {
    log.info("Orchestrator", `Order cancellation already succeeded (duplicate)`, { traceId, orderId });
    return;
  }

  const startTime = Date.now();
  while (Date.now() - startTime < QUEUE_POLL_TIMEOUT_MS) {
    await new Promise(resolve => setTimeout(resolve, QUEUE_POLL_INTERVAL_MS));

    const updatedItem = await workQueue.getById(workItem.id);
    if (!updatedItem) {
      throw new Error(`Cancel work item ${workItem.id} not found during polling`);
    }

    if (updatedItem.status === "SUCCEEDED") {
      log.info("Orchestrator", `ORDER_CANCEL succeeded for order ${orderId}`, { traceId });
      return;
    }

    if (updatedItem.status === "CANCELLED") {
      log.info("Orchestrator", `ORDER_CANCEL completed with CANCELLED status for order ${orderId}`, { traceId });
      return;
    }

    if (updatedItem.status === "DEAD_LETTER") {
      const errorLower = (updatedItem.lastError || "").toLowerCase();
      if (errorLower.includes("already") || errorLower.includes("cancel") || errorLower.includes("not found")) {
        log.info("Orchestrator", `ORDER_CANCEL completed (order already cancelled or not found): ${orderId}`, { traceId });
        return;
      }
      log.warn("Orchestrator", `ORDER_CANCEL failed: ${updatedItem.lastError}`, {
        traceId,
        orderId,
      });
      return;
    }
  }

  log.warn("Orchestrator", `Order cancellation timed out for ${orderId}`, { traceId });
}
