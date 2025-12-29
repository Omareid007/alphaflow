/**
 * Order Queue Management
 *
 * Functions for queuing order execution and cancellation through the work queue.
 * This provides:
 * - Idempotency to prevent duplicate orders
 * - Retry logic with exponential backoff
 * - Polling for order completion status
 */

import { alpaca, CreateOrderParams } from "../connectors/alpaca";
import { workQueue, generateIdempotencyKey } from "../lib/work-queue";
import { log } from "../utils/logger";
import type { QueuedOrderResult } from "./types";

// ============================================================================
// CONSTANTS
// ============================================================================

const QUEUE_POLL_INTERVAL_MS = 2000;
const QUEUE_POLL_TIMEOUT_MS = 60000;

// ============================================================================
// ORDER EXECUTION QUEUE
// ============================================================================

/**
 * Queue an order for execution through the work queue
 *
 * This function:
 * 1. Creates an idempotency key to prevent duplicate orders
 * 2. Enqueues the order in the work queue
 * 3. Polls for completion or failure
 * 4. Validates order status with Alpaca for cached results
 *
 * @param params - Order parameters and metadata
 * @returns QueuedOrderResult with order ID, status, and work item ID
 * @throws Error if order submission fails or times out
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
 * Queue an order cancellation through the work queue
 *
 * This function:
 * 1. Creates an idempotency key for the cancellation
 * 2. Enqueues the cancellation in the work queue
 * 3. Polls for completion or failure
 * 4. Handles already-cancelled orders gracefully
 *
 * @param params - Cancellation parameters
 * @throws Error if cancellation work item not found during polling
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
