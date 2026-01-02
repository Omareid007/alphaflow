/**
 * Action Executor
 *
 * Executes approved signals as orders through the broker.
 * Part of the Strategy Signal Pipeline.
 *
 * Handles order submission, tracking, and result reporting.
 */

import { log } from "../utils/logger";
import { alpacaClient } from "../connectors/alpaca";

// ============================================================================
// TYPES
// ============================================================================

export type ActionType = "buy" | "sell" | "close" | "adjust";

export type OrderType = "market" | "limit" | "stop" | "stop_limit";

export type TimeInForce = "day" | "gtc" | "ioc" | "fok";

export interface ActionSignal {
  id: string;
  strategyId: string;
  symbol: string;
  action: ActionType;
  quantity: number;
  orderType: OrderType;
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: TimeInForce;
  confidence: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionOptions {
  mode?: "live" | "paper";
  maxSlippage?: number;
  timeout?: number;
  retryAttempts?: number;
}

export interface ActionResult {
  signalId: string;
  success: boolean;
  orderId?: string;
  brokerOrderId?: string;
  status: "submitted" | "filled" | "partial" | "rejected" | "error";
  filledQty?: number;
  avgPrice?: number;
  error?: string;
  timestamp: Date;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export const actionExecutor = {
  /**
   * Execute a single action signal
   */
  async execute(
    signal: ActionSignal,
    options: ExecutionOptions
  ): Promise<ActionResult> {
    log.info("ActionExecutor", "Executing signal", {
      signalId: signal.id,
      symbol: signal.symbol,
      action: signal.action,
      quantity: signal.quantity,
      mode: options.mode,
    });

    try {
      // Convert signal to order parameters
      const orderParams = this.signalToOrderParams(signal);

      // Submit order through Alpaca
      const side =
        signal.action === "sell" || signal.action === "close" ? "sell" : "buy";

      const order = await alpacaClient.createOrder({
        symbol: signal.symbol,
        qty: signal.quantity.toString(),
        side,
        type: signal.orderType,
        time_in_force: signal.timeInForce,
        limit_price: signal.limitPrice?.toString(),
        stop_price: signal.stopPrice?.toString(),
      });

      log.info("ActionExecutor", "Order submitted", {
        signalId: signal.id,
        orderId: order.id,
      });

      return {
        signalId: signal.id,
        success: true,
        orderId: order.id,
        brokerOrderId: order.id,
        status: "submitted",
        timestamp: new Date(),
      };
    } catch (error) {
      log.error("ActionExecutor", "Order execution failed", {
        signalId: signal.id,
        error,
      });

      return {
        signalId: signal.id,
        success: false,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  },

  /**
   * Execute multiple signals in sequence
   */
  async executeAll(
    signals: ActionSignal[],
    options: ExecutionOptions
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const signal of signals) {
      const result = await this.execute(signal, options);
      results.push(result);

      // Stop on first error if configured
      if (!result.success && options.retryAttempts === 0) {
        break;
      }
    }

    return results;
  },

  /**
   * Convert signal to order parameters
   */
  signalToOrderParams(signal: ActionSignal): Record<string, unknown> {
    const side =
      signal.action === "sell" || signal.action === "close" ? "sell" : "buy";

    return {
      symbol: signal.symbol,
      qty: signal.quantity,
      side,
      type: signal.orderType,
      time_in_force: signal.timeInForce,
      limit_price: signal.limitPrice,
      stop_price: signal.stopPrice,
      client_order_id: `strategy-${signal.strategyId}-${signal.id}`,
    };
  },

  /**
   * Validate signal before execution
   */
  validateSignal(signal: ActionSignal): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!signal.symbol) {
      errors.push("Symbol is required");
    }

    if (!signal.quantity || signal.quantity <= 0) {
      errors.push("Quantity must be positive");
    }

    if (signal.orderType === "limit" && !signal.limitPrice) {
      errors.push("Limit price required for limit orders");
    }

    if (signal.orderType === "stop" && !signal.stopPrice) {
      errors.push("Stop price required for stop orders");
    }

    if (
      signal.orderType === "stop_limit" &&
      (!signal.limitPrice || !signal.stopPrice)
    ) {
      errors.push("Both limit and stop price required for stop_limit orders");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};
