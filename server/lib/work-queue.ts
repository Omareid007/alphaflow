import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { log } from "../utils/logger";
import { tradabilityService } from "../services/tradability-service";
import type { WorkItem, InsertWorkItem, WorkItemType, WorkItemStatus } from "@shared/schema";
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
    const { symbol, side, qty, type, time_in_force, limit_price, stop_price, extended_hours } = payload;

    const tradabilityCheck = await tradabilityService.validateSymbolTradable(symbol);
    if (!tradabilityCheck.tradable) {
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
      log.info("work-queue", `Order already exists for client_order_id ${clientOrderId}: ${existingOrder.id}`);
      await storage.updateWorkItem(item.id, {
        brokerOrderId: existingOrder.id,
        result: JSON.stringify({ orderId: existingOrder.id, status: existingOrder.status }),
      });
      await this.markSucceeded(item.id, JSON.stringify({ orderId: existingOrder.id, deduplicated: true }));
      return;
    }

    const order = await alpaca.createOrder({
      symbol,
      qty,
      side,
      type: type || "market",
      time_in_force: time_in_force || "day",
      limit_price,
      stop_price,
      client_order_id: clientOrderId,
      extended_hours,
    });

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
    const [openOrders, recentOrders] = await Promise.all([
      alpaca.getOrders("open", 100),
      alpaca.getOrders("closed", 50),
    ]);

    const allOrders = [...openOrders, ...recentOrders];
    let syncedCount = 0;

    for (const order of allOrders) {
      if (order.client_order_id) {
        const workItem = await this.getByIdempotencyKey(order.client_order_id);
        if (workItem && !workItem.brokerOrderId) {
          await storage.updateWorkItem(workItem.id, {
            brokerOrderId: order.id,
            result: JSON.stringify({ status: order.status, filled_qty: order.filled_qty }),
          });
          syncedCount++;
        }
      }
    }

    await this.markSucceeded(item.id, JSON.stringify({
      syncedCount,
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
