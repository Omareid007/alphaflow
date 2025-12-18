import { workQueue, generateIdempotencyKey } from "../lib/work-queue";
import { alpaca, type CreateOrderParams, type AlpacaOrder } from "../connectors/alpaca";
import { storage } from "../storage";
import { log } from "../utils/logger";
import { tradabilityService } from "../services/tradability-service";
import { tradingEnforcementService } from "../universe";
import type { InsertOrder } from "@shared/schema";

const QUEUE_POLL_INTERVAL_MS = 500;
const QUEUE_POLL_TIMEOUT_MS = 30000;

export interface UnifiedOrderRequest {
  symbol: string;
  side: "buy" | "sell";
  qty?: string;
  notional?: string;
  type?: "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";
  timeInForce?: "day" | "gtc" | "ioc" | "fok";
  limitPrice?: string;
  stopPrice?: string;
  extendedHours?: boolean;
  orderClass?: "simple" | "bracket" | "oco" | "oto";
  takeProfitLimitPrice?: string;
  stopLossStopPrice?: string;
  trailPercent?: string;
  strategyId?: string;
  decisionId?: string;
  traceId?: string;
  bypassQueue?: boolean;
}

export interface UnifiedOrderResult {
  success: boolean;
  orderId?: string;
  clientOrderId?: string;
  status?: string;
  workItemId?: string;
  error?: string;
  deduplicated?: boolean;
}

class UnifiedOrderExecutor {
  private useQueueByDefault = true;

  setQueueEnabled(enabled: boolean): void {
    this.useQueueByDefault = enabled;
    log.info("UnifiedOrderExecutor", `Queue mode: ${enabled ? "ENABLED" : "DISABLED"}`);
  }

  isQueueEnabled(): boolean {
    return this.useQueueByDefault;
  }

  async submitOrder(request: UnifiedOrderRequest): Promise<UnifiedOrderResult> {
    const {
      symbol,
      side,
      qty,
      notional,
      type = "market",
      timeInForce = "day",
      limitPrice,
      stopPrice,
      extendedHours,
      orderClass,
      takeProfitLimitPrice,
      stopLossStopPrice,
      trailPercent,
      strategyId,
      decisionId,
      traceId,
      bypassQueue = false,
    } = request;

    const clientOrderId = this.generateClientOrderId(request);

    log.info("UnifiedOrderExecutor", `Order request: ${side} ${symbol}`, {
      traceId,
      clientOrderId,
      qty,
      notional,
      type,
      useQueue: this.useQueueByDefault && !bypassQueue,
    });

    if (side === "buy") {
      const enforcement = await tradingEnforcementService.canTradeSymbol(symbol, traceId);
      if (!enforcement.eligible) {
        return {
          success: false,
          error: `Trading enforcement blocked: ${enforcement.reason}`,
        };
      }
    }

    const tradability = await tradabilityService.validateSymbolTradable(symbol);
    if (!tradability.tradable) {
      return {
        success: false,
        error: `Symbol not tradable: ${tradability.reason || "Not found"}`,
      };
    }

    if (this.useQueueByDefault && !bypassQueue) {
      return this.executeViaQueue({
        symbol,
        side,
        qty,
        notional,
        type,
        timeInForce,
        limitPrice,
        stopPrice,
        extendedHours,
        orderClass,
        takeProfitLimitPrice,
        stopLossStopPrice,
        trailPercent,
        strategyId,
        decisionId,
        traceId,
        clientOrderId,
      });
    }

    return this.executeDirect({
      symbol,
      side,
      qty,
      notional,
      type,
      timeInForce,
      limitPrice,
      stopPrice,
      extendedHours,
      orderClass,
      takeProfitLimitPrice,
      stopLossStopPrice,
      traceId,
      clientOrderId,
    });
  }

  private async executeViaQueue(params: {
    symbol: string;
    side: string;
    qty?: string;
    notional?: string;
    type: string;
    timeInForce: string;
    limitPrice?: string;
    stopPrice?: string;
    extendedHours?: boolean;
    orderClass?: string;
    takeProfitLimitPrice?: string;
    stopLossStopPrice?: string;
    trailPercent?: string;
    strategyId?: string;
    decisionId?: string;
    traceId?: string;
    clientOrderId: string;
  }): Promise<UnifiedOrderResult> {
    const {
      symbol,
      side,
      qty,
      notional,
      type,
      timeInForce,
      limitPrice,
      stopPrice,
      extendedHours,
      orderClass,
      takeProfitLimitPrice,
      stopLossStopPrice,
      strategyId,
      decisionId,
      traceId,
      clientOrderId,
    } = params;

    const workItem = await workQueue.enqueue({
      type: "ORDER_SUBMIT",
      symbol,
      idempotencyKey: clientOrderId,
      decisionId: decisionId || null,
      payload: JSON.stringify({
        symbol,
        side,
        qty,
        notional,
        type,
        time_in_force: timeInForce,
        limit_price: limitPrice,
        stop_price: stopPrice,
        extended_hours: extendedHours,
        order_class: orderClass,
        take_profit_limit_price: takeProfitLimitPrice,
        stop_loss_stop_price: stopLossStopPrice,
        traceId,
        strategyId,
      }),
      maxAttempts: 3,
    });

    if (workItem.status === "SUCCEEDED" && workItem.result) {
      const result = JSON.parse(workItem.result);
      return {
        success: true,
        orderId: result.orderId,
        clientOrderId,
        status: result.status || "filled",
        workItemId: workItem.id,
        deduplicated: result.deduplicated || false,
      };
    }

    const startTime = Date.now();
    while (Date.now() - startTime < QUEUE_POLL_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, QUEUE_POLL_INTERVAL_MS));

      const updatedItem = await workQueue.getById(workItem.id);
      if (!updatedItem) {
        return { success: false, error: `Work item ${workItem.id} not found` };
      }

      if (updatedItem.status === "SUCCEEDED") {
        const result = updatedItem.result ? JSON.parse(updatedItem.result) : {};
        return {
          success: true,
          orderId: result.orderId,
          clientOrderId,
          status: result.status,
          workItemId: workItem.id,
          deduplicated: result.deduplicated,
        };
      }

      if (updatedItem.status === "DEAD_LETTER") {
        return {
          success: false,
          error: updatedItem.lastError || "Order failed after retries",
          workItemId: workItem.id,
        };
      }
    }

    return {
      success: false,
      error: `Order submission timed out after ${QUEUE_POLL_TIMEOUT_MS}ms`,
      workItemId: workItem.id,
    };
  }

  private async executeDirect(params: {
    symbol: string;
    side: string;
    qty?: string;
    notional?: string;
    type: string;
    timeInForce: string;
    limitPrice?: string;
    stopPrice?: string;
    extendedHours?: boolean;
    orderClass?: string;
    takeProfitLimitPrice?: string;
    stopLossStopPrice?: string;
    traceId?: string;
    clientOrderId: string;
  }): Promise<UnifiedOrderResult> {
    const {
      symbol,
      side,
      qty,
      notional,
      type,
      timeInForce,
      limitPrice,
      stopPrice,
      extendedHours,
      orderClass,
      takeProfitLimitPrice,
      stopLossStopPrice,
      traceId,
      clientOrderId,
    } = params;

    try {
      const existingOrders = await alpaca.getOrders("open", 100);
      const existingOrder = existingOrders.find(
        (o) => o.client_order_id === clientOrderId
      );

      if (existingOrder) {
        log.info("UnifiedOrderExecutor", `Duplicate order detected: ${clientOrderId}`, {
          traceId,
          existingOrderId: existingOrder.id,
        });
        return {
          success: true,
          orderId: existingOrder.id,
          clientOrderId,
          status: existingOrder.status,
          deduplicated: true,
        };
      }

      const orderParams: CreateOrderParams = {
        symbol,
        side: side as "buy" | "sell",
        type: type as any,
        time_in_force: timeInForce as any,
        client_order_id: clientOrderId,
      };

      if (qty) orderParams.qty = qty;
      if (notional) orderParams.notional = notional;
      if (limitPrice) orderParams.limit_price = limitPrice;
      if (stopPrice) orderParams.stop_price = stopPrice;
      if (extendedHours) orderParams.extended_hours = extendedHours;
      if (orderClass) orderParams.order_class = orderClass as any;
      if (takeProfitLimitPrice) orderParams.take_profit = { limit_price: takeProfitLimitPrice };
      if (stopLossStopPrice) orderParams.stop_loss = { stop_price: stopLossStopPrice };

      const order = await alpaca.createOrder(orderParams);

      log.info("UnifiedOrderExecutor", `Order submitted: ${order.id}`, {
        traceId,
        status: order.status,
      });

      const orderData: InsertOrder = {
        broker: "alpaca",
        brokerOrderId: order.id,
        clientOrderId,
        symbol,
        side,
        type,
        timeInForce,
        qty,
        notional,
        limitPrice,
        stopPrice,
        status: order.status,
        submittedAt: new Date(order.submitted_at || Date.now()),
        updatedAt: new Date(),
        filledQty: order.filled_qty,
        filledAvgPrice: order.filled_avg_price,
        traceId,
        rawJson: order,
      };

      await storage.upsertOrderByBrokerOrderId(order.id, orderData);

      return {
        success: true,
        orderId: order.id,
        clientOrderId,
        status: order.status,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error("UnifiedOrderExecutor", `Order failed: ${errorMsg}`, { traceId });
      return { success: false, error: errorMsg };
    }
  }

  async cancelOrder(orderId: string, traceId?: string): Promise<{ success: boolean; error?: string }> {
    const clientOrderId = generateIdempotencyKey({
      strategyId: "cancel",
      symbol: orderId,
      side: "cancel",
      timeframeBucket: Math.floor(Date.now() / 60000).toString(),
    });

    if (this.useQueueByDefault) {
      const workItem = await workQueue.enqueue({
        type: "ORDER_CANCEL",
        symbol: orderId,
        idempotencyKey: clientOrderId,
        payload: JSON.stringify({ orderId, traceId }),
        maxAttempts: 3,
      });

      if (workItem.status === "SUCCEEDED") {
        return { success: true };
      }

      const startTime = Date.now();
      while (Date.now() - startTime < QUEUE_POLL_TIMEOUT_MS) {
        await new Promise((resolve) => setTimeout(resolve, QUEUE_POLL_INTERVAL_MS));

        const updatedItem = await workQueue.getById(workItem.id);
        if (!updatedItem) continue;

        if (updatedItem.status === "SUCCEEDED") {
          return { success: true };
        }

        if (updatedItem.status === "DEAD_LETTER") {
          const errorLower = (updatedItem.lastError || "").toLowerCase();
          if (errorLower.includes("already") || errorLower.includes("not found")) {
            return { success: true };
          }
          return { success: false, error: updatedItem.lastError || "Cancel failed" };
        }
      }

      return { success: false, error: "Cancel timed out" };
    }

    try {
      await alpaca.cancelOrder(orderId);
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.toLowerCase().includes("already") || errorMsg.toLowerCase().includes("not found")) {
        return { success: true };
      }
      return { success: false, error: errorMsg };
    }
  }

  private generateClientOrderId(request: UnifiedOrderRequest): string {
    const bucket = Math.floor(Date.now() / 300000).toString();
    return generateIdempotencyKey({
      strategyId: request.strategyId || "unified",
      symbol: request.symbol,
      side: request.side,
      timeframeBucket: bucket,
    });
  }
}

export const unifiedOrderExecutor = new UnifiedOrderExecutor();
