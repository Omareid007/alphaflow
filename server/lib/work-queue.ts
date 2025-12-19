import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { log } from "../utils/logger";
import { tradabilityService } from "../services/tradability-service";
import { tradingEnforcementService } from "../universe";
import type { WorkItem, InsertWorkItem, WorkItemType, WorkItemStatus, InsertOrder, InsertFill } from "@shared/schema";
import crypto from "crypto";

const RETRY_DELAYS_MS: Record<WorkItemType, number[]> = {
  ORDER_SUBMIT: [1000, 5000, 15000],
  ORDER_CANCEL: [1000, 3000, 10000],
  ORDER_SYNC: [5000, 15000, 60000],
  POSITION_CLOSE: [1000, 5000, 15000],
  KILL_SWITCH: [500, 2000, 5000],
  DECISION_EVALUATION: [2000, 10000, 30000],
  ASSET_UNIVERSE_SYNC: [60000, 300000, 600000],
};

const TRANSIENT_ERROR_PATTERNS = [
  /timeout/i,
  /network/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /rate.?limit/i,
  /429/,
  /5\d\d/,
  /temporary/i,
  /unavailable/i,
];

const PERMANENT_ERROR_PATTERNS = [
  /invalid.*symbol/i,
  /insufficient.*buying/i,
  /account.*blocked/i,
  /not.*tradable/i,
  /market.*closed/i,
  /invalid.*quantity/i,
  /rejected/i,
  /4[0-3]\d/,
];

export function generateIdempotencyKey(params: {
  strategyId: string;
  symbol: string;
  side: string;
  signalHash?: string;
  timeframeBucket?: string;
}): string {
  const bucket = params.timeframeBucket || Math.floor(Date.now() / 60000).toString();
  const data = `${params.strategyId}:${params.symbol}:${params.side}:${params.signalHash || ""}:${bucket}`;
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 32);
}

export function classifyError(error: unknown): "transient" | "permanent" | "unknown" {
  const errorStr = error instanceof Error ? error.message : String(error);
  
  if (PERMANENT_ERROR_PATTERNS.some(p => p.test(errorStr))) {
    return "permanent";
  }
  if (TRANSIENT_ERROR_PATTERNS.some(p => p.test(errorStr))) {
    return "transient";
  }
  return "unknown";
}

export function calculateNextRunAt(type: WorkItemType, attempts: number): Date {
  const delays = RETRY_DELAYS_MS[type] || [5000, 15000, 60000];
  const delayIndex = Math.min(attempts, delays.length - 1);
  const baseDelay = delays[delayIndex];
  const jitter = Math.random() * baseDelay * 0.2;
  return new Date(Date.now() + baseDelay + jitter);
}

export interface WorkQueueService {
  enqueue(item: InsertWorkItem): Promise<WorkItem>;
  claimNext(types?: WorkItemType[]): Promise<WorkItem | null>;
  markSucceeded(id: string, result?: string): Promise<void>;
  markFailed(id: string, error: string, retryable?: boolean): Promise<void>;
  markDeadLetter(id: string, reason: string): Promise<void>;
  getById(id: string): Promise<WorkItem | null>;
  getByIdempotencyKey(key: string): Promise<WorkItem | null>;
  getPendingCount(type?: WorkItemType): Promise<number>;
  getRecentItems(limit?: number, status?: WorkItemStatus): Promise<WorkItem[]>;
  retryDeadLetter(id: string): Promise<WorkItem | null>;
  processOrderSubmit(item: WorkItem): Promise<void>;
  processOrderCancel(item: WorkItem): Promise<void>;
  processOrderSync(item: WorkItem): Promise<void>;
  processKillSwitch(item: WorkItem): Promise<void>;
  startWorker(intervalMs?: number): void;
  stopWorker(): void;
}

class WorkQueueServiceImpl implements WorkQueueService {
  private workerInterval: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  async enqueue(item: InsertWorkItem): Promise<WorkItem> {
    if (item.idempotencyKey) {
      const existing = await this.getByIdempotencyKey(item.idempotencyKey);
      if (existing) {
        log.info("work-queue", `Duplicate work item detected: ${item.idempotencyKey}`);
        return existing;
      }
    }
    return storage.createWorkItem(item);
  }

  async claimNext(types?: WorkItemType[]): Promise<WorkItem | null> {
    return storage.claimNextWorkItem(types);
  }

  async markSucceeded(id: string, result?: string): Promise<void> {
    await storage.updateWorkItem(id, {
      status: "SUCCEEDED",
      result: result || null,
      updatedAt: new Date(),
    });
  }

  async markFailed(id: string, error: string, retryable = true): Promise<void> {
    const item = await storage.getWorkItem(id);
    if (!item) return;

    const newAttempts = item.attempts + 1;
    const maxAttempts = item.maxAttempts || 3;

    if (!retryable || newAttempts >= maxAttempts) {
      await storage.updateWorkItem(id, {
        status: "DEAD_LETTER",
        lastError: error,
        attempts: newAttempts,
        updatedAt: new Date(),
      });
    } else {
      const nextRunAt = calculateNextRunAt(item.type as WorkItemType, newAttempts);
      await storage.updateWorkItem(id, {
        status: "PENDING",
        lastError: error,
        attempts: newAttempts,
        nextRunAt,
        updatedAt: new Date(),
      });
    }
  }

  async markDeadLetter(id: string, reason: string): Promise<void> {
    await storage.updateWorkItem(id, {
      status: "DEAD_LETTER",
      lastError: reason,
      updatedAt: new Date(),
    });
  }

  async getById(id: string): Promise<WorkItem | null> {
    const item = await storage.getWorkItem(id);
    return item || null;
  }

  async getByIdempotencyKey(key: string): Promise<WorkItem | null> {
    return storage.getWorkItemByIdempotencyKey(key);
  }

  async getPendingCount(type?: WorkItemType): Promise<number> {
    return storage.getWorkItemCount("PENDING", type);
  }

  async getRecentItems(limit = 50, status?: WorkItemStatus): Promise<WorkItem[]> {
    return storage.getWorkItems(limit, status);
  }

  async retryDeadLetter(id: string): Promise<WorkItem | null> {
    const item = await storage.getWorkItem(id);
    if (!item || item.status !== "DEAD_LETTER") return null;

    await storage.updateWorkItem(id, {
      status: "PENDING",
      attempts: 0,
      nextRunAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    });

    const updated = await storage.getWorkItem(id);
    return updated || null;
  }

  async processOrderSubmit(item: WorkItem): Promise<void> {
    const payload = JSON.parse(item.payload || "{}");
    const { 
      symbol, 
      side, 
      qty, 
      notional,
      type, 
      time_in_force, 
      limit_price, 
      stop_price, 
      extended_hours,
      order_class,
      take_profit_limit_price,
      stop_loss_stop_price,
      traceId,
    } = payload;

    log.info("work-queue", `Processing ORDER_SUBMIT for ${symbol} ${side}`, { 
      traceId, 
      workItemId: item.id,
      symbol,
      side,
    });

    // For SELL orders, skip enforcement check - we must be able to close existing positions
    // even if the symbol is no longer in the approved candidates list
    if (side !== "sell") {
      const enforcementCheck = await tradingEnforcementService.canTradeSymbol(symbol, traceId);
      if (!enforcementCheck.eligible) {
        // ENHANCED ORDER FAILURE LOGGING
        log.warn("work-queue", `ORDER_BLOCKED: ${symbol} - Trading enforcement rejected`, {
          traceId,
          workItemId: item.id,
          symbol,
          side,
          qty,
          notional,
          orderType: type,
          reason: "TRADING_ENFORCEMENT_BLOCKED",
          enforcementReason: enforcementCheck.reason,
          blockCategory: "SYMBOL_NOT_APPROVED",
          suggestion: "Add symbol to approved candidates list or ensure it passes universe eligibility"
        });
        await this.markFailed(
          item.id,
          `Symbol ${symbol} blocked by trading enforcement: ${enforcementCheck.reason}`,
          false
        );
        return;
      }
    } else {
      log.info("work-queue", `Bypassing enforcement check for SELL order on ${symbol}`, { traceId });
    }

    const tradabilityCheck = await tradabilityService.validateSymbolTradable(symbol);
    if (!tradabilityCheck.tradable) {
      // ENHANCED ORDER FAILURE LOGGING
      log.warn("work-queue", `ORDER_BLOCKED: ${symbol} - Symbol not tradable`, {
        traceId,
        workItemId: item.id,
        symbol,
        side,
        qty,
        notional,
        orderType: type,
        reason: "SYMBOL_NOT_TRADABLE",
        tradabilityReason: tradabilityCheck.reason,
        blockCategory: "BROKER_UNIVERSE",
        suggestion: "Symbol may not be in Alpaca universe or may be a penny stock (<$5)"
      });
      await this.markFailed(
        item.id,
        `Symbol ${symbol} is not tradable: ${tradabilityCheck.reason || 'Not found in broker universe'}`,
        false
      );
      return;
    }

    const clientOrderId = item.idempotencyKey || item.id;
    const existingOrders = await alpaca.getOrders("open", 100);
    const existingOrder = existingOrders.find(o => o.client_order_id === clientOrderId);

    if (existingOrder) {
      log.info("work-queue", `Order already exists for client_order_id ${clientOrderId}: ${existingOrder.id}`, { traceId });
      await storage.updateWorkItem(item.id, {
        brokerOrderId: existingOrder.id,
        result: JSON.stringify({ orderId: existingOrder.id, status: existingOrder.status }),
      });
      await this.markSucceeded(item.id, JSON.stringify({ orderId: existingOrder.id, deduplicated: true }));
      return;
    }

    // FIX: Bracket orders MUST use time_in_force: "day" per Alpaca API requirements
    // Using "gtc" will result in 422 rejection from the API
    let correctedTif = time_in_force || "day";
    if (order_class === "bracket" && correctedTif !== "day") {
      log.warn("work-queue", `Correcting bracket order TIF from "${correctedTif}" to "day" (Alpaca requirement)`, { traceId, symbol });
      correctedTif = "day";
    }

    const orderParams: any = {
      symbol,
      side,
      type: type || "market",
      time_in_force: correctedTif,
      client_order_id: clientOrderId,
    };

    if (qty) orderParams.qty = qty;
    if (notional) orderParams.notional = notional;
    if (limit_price) orderParams.limit_price = limit_price;
    if (stop_price) orderParams.stop_price = stop_price;
    if (extended_hours) orderParams.extended_hours = extended_hours;
    if (order_class) orderParams.order_class = order_class;
    if (take_profit_limit_price) orderParams.take_profit = { limit_price: take_profit_limit_price };
    if (stop_loss_stop_price) orderParams.stop_loss = { stop_price: stop_loss_stop_price };

    const order = await alpaca.createOrder(orderParams);

    log.info("work-queue", `ORDER_SUBMIT succeeded: ${order.id}`, { 
      traceId, 
      workItemId: item.id,
      orderId: order.id,
      status: order.status,
    });

    const orderData: InsertOrder = {
      broker: "alpaca",
      brokerOrderId: order.id,
      clientOrderId: clientOrderId,
      symbol,
      side,
      type: type || "market",
      timeInForce: time_in_force || "day",
      qty: qty?.toString(),
      notional: notional?.toString(),
      limitPrice: limit_price?.toString(),
      stopPrice: stop_price?.toString(),
      status: order.status,
      submittedAt: new Date(order.submitted_at || Date.now()),
      updatedAt: new Date(),
      filledQty: order.filled_qty?.toString(),
      filledAvgPrice: order.filled_avg_price?.toString(),
      traceId,
      workItemId: item.id,
      rawJson: order,
    };

    await storage.upsertOrderByBrokerOrderId(order.id, orderData);

    await storage.updateWorkItem(item.id, { brokerOrderId: order.id });
    await this.markSucceeded(item.id, JSON.stringify({ orderId: order.id, status: order.status }));
  }

  async processOrderCancel(item: WorkItem): Promise<void> {
    const payload = JSON.parse(item.payload || "{}");
    const { orderId } = payload;

    if (!orderId) {
      await this.markFailed(item.id, "Missing orderId in payload", false);
      return;
    }

    await alpaca.cancelOrder(orderId);
    await this.markSucceeded(item.id, JSON.stringify({ canceledOrderId: orderId }));
  }

  async processOrderSync(item: WorkItem): Promise<void> {
    const payload = JSON.parse(item.payload || "{}");
    const traceId = payload.traceId || `sync-${Date.now()}`;
    
    log.info("work-queue", "Starting order sync", { traceId, workItemId: item.id });

    const [openOrders, recentOrders] = await Promise.all([
      alpaca.getOrders("open", 100),
      alpaca.getOrders("closed", 50),
    ]);

    const allOrders = [...openOrders, ...recentOrders];
    let ordersUpserted = 0;
    let fillsCreated = 0;

    for (const alpacaOrder of allOrders) {
      try {
        const orderData: Partial<InsertOrder> = {
          broker: "alpaca",
          brokerOrderId: alpacaOrder.id,
          clientOrderId: alpacaOrder.client_order_id || undefined,
          symbol: alpacaOrder.symbol,
          side: alpacaOrder.side,
          type: alpacaOrder.type || alpacaOrder.order_type || "market",
          timeInForce: alpacaOrder.time_in_force,
          qty: alpacaOrder.qty,
          notional: alpacaOrder.notional || undefined,
          limitPrice: alpacaOrder.limit_price || undefined,
          stopPrice: alpacaOrder.stop_price || undefined,
          status: alpacaOrder.status,
          submittedAt: new Date(alpacaOrder.submitted_at),
          updatedAt: new Date(alpacaOrder.updated_at || Date.now()),
          filledAt: alpacaOrder.filled_at ? new Date(alpacaOrder.filled_at) : undefined,
          filledQty: alpacaOrder.filled_qty,
          filledAvgPrice: alpacaOrder.filled_avg_price || undefined,
          traceId,
          rawJson: alpacaOrder,
        };

        if (alpacaOrder.client_order_id) {
          const workItem = await storage.getWorkItemByIdempotencyKey(alpacaOrder.client_order_id);
          if (workItem) {
            orderData.workItemId = workItem.id;
          }
        }

        await storage.upsertOrderByBrokerOrderId(alpacaOrder.id, orderData);
        ordersUpserted++;

        if (alpacaOrder.filled_at && parseFloat(alpacaOrder.filled_qty) > 0) {
          const existingFills = await storage.getFillsByBrokerOrderId(alpacaOrder.id);
          if (existingFills.length === 0) {
            const dbOrder = await storage.getOrderByBrokerOrderId(alpacaOrder.id);
            
            const fillData: InsertFill = {
              broker: "alpaca",
              brokerOrderId: alpacaOrder.id,
              orderId: dbOrder?.id,
              symbol: alpacaOrder.symbol,
              side: alpacaOrder.side,
              qty: alpacaOrder.filled_qty,
              price: alpacaOrder.filled_avg_price || "0",
              occurredAt: new Date(alpacaOrder.filled_at),
              traceId,
              rawJson: {
                filled_qty: alpacaOrder.filled_qty,
                filled_avg_price: alpacaOrder.filled_avg_price,
                filled_at: alpacaOrder.filled_at,
              },
            };
            await storage.createFill(fillData);
            fillsCreated++;
          }
        }
      } catch (error) {
        log.warn("work-queue", `Failed to sync order ${alpacaOrder.id}: ${error}`, { traceId });
      }
    }

    log.info("work-queue", `Order sync completed`, { 
      traceId, 
      ordersUpserted, 
      fillsCreated,
      openOrders: openOrders.length,
      recentOrders: recentOrders.length,
    });

    await this.markSucceeded(item.id, JSON.stringify({
      ordersUpserted,
      fillsCreated,
      openOrders: openOrders.length,
      recentOrders: recentOrders.length,
      syncedAt: new Date().toISOString(),
    }));
  }

  async processKillSwitch(item: WorkItem): Promise<void> {
    await alpaca.cancelAllOrders();

    const payload = JSON.parse(item.payload || "{}");
    if (payload.closePositions) {
      const positions = await alpaca.getPositions();
      for (const pos of positions) {
        try {
          await alpaca.closePosition(pos.symbol);
        } catch (e) {
          log.warn("work-queue", `Failed to close position ${pos.symbol}: ${e}`);
        }
      }
    }

    await storage.updateAgentStatus({
      killSwitchActive: true,
      updatedAt: new Date(),
    });

    await this.markSucceeded(item.id, JSON.stringify({
      canceledOrders: true,
      closedPositions: payload.closePositions || false,
      executedAt: new Date().toISOString(),
    }));
  }

  async processAssetUniverseSync(item: WorkItem): Promise<void> {
    const payload = JSON.parse(item.payload || "{}");
    const assetClass = payload.assetClass || "us_equity";
    
    log.info("work-queue", `Starting asset universe sync for ${assetClass}`);
    
    const result = await tradabilityService.syncAssetUniverse(assetClass);
    
    if (result.errors.length > 0) {
      throw new Error(result.errors.join("; "));
    }
    
    tradabilityService.clearMemoryCache();
    
    await this.markSucceeded(item.id, JSON.stringify({
      assetClass,
      synced: result.synced,
      tradable: result.tradable,
      syncedAt: new Date().toISOString(),
    }));
  }

  async processItem(item: WorkItem): Promise<void> {
    const startTime = Date.now();
    
    await storage.createWorkItemRun({
      workItemId: item.id,
      attemptNumber: item.attempts + 1,
      status: "RUNNING",
    });

    try {
      switch (item.type) {
        case "ORDER_SUBMIT":
          await this.processOrderSubmit(item);
          break;
        case "ORDER_CANCEL":
          await this.processOrderCancel(item);
          break;
        case "ORDER_SYNC":
          await this.processOrderSync(item);
          break;
        case "KILL_SWITCH":
          await this.processKillSwitch(item);
          break;
        case "ASSET_UNIVERSE_SYNC":
          await this.processAssetUniverseSync(item);
          break;
        default:
          log.warn("work-queue", `Unknown work item type: ${item.type}`);
          await this.markFailed(item.id, `Unknown type: ${item.type}`, false);
      }
    } catch (error) {
      const errorClass = classifyError(error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      log.error("work-queue", `Work item ${item.id} failed (${errorClass}): ${errorMsg}`);
      
      await this.markFailed(item.id, errorMsg, errorClass === "transient");
    }
  }

  async runWorkerCycle(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const item = await this.claimNext();
      if (item) {
        await this.processItem(item);
      }
    } catch (error) {
      log.error("work-queue", `Worker cycle error: ${error}`);
    } finally {
      this.processing = false;
    }
  }

  startWorker(intervalMs = 5000): void {
    if (this.workerInterval) return;
    
    log.info("work-queue", `Starting work queue worker with ${intervalMs}ms interval`);
    this.workerInterval = setInterval(() => this.runWorkerCycle(), intervalMs);
  }

  stopWorker(): void {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
      log.info("work-queue", "Work queue worker stopped");
    }
  }
}

export const workQueue = new WorkQueueServiceImpl();
