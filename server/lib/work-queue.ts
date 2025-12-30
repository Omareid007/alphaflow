import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { log } from "../utils/logger";
import { tradabilityService } from "../services/tradability-service";
import { tradingEnforcementService } from "../universe";
import { tradingSessionManager } from "../services/trading-session-manager";
import {
  transformOrderForExecution,
  createPriceData,
  type TransformedOrder,
} from "../trading/smart-order-router";
import type {
  WorkItem,
  InsertWorkItem,
  WorkItemType,
  WorkItemStatus,
  InsertOrder,
  InsertFill,
} from "@shared/schema";
import crypto from "crypto";

/**
 * Order types supported by Alpaca
 */
type AlpacaOrderType = "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";

/**
 * Time in force values for orders
 */
type AlpacaTimeInForce = "day" | "gtc" | "opg" | "cls" | "ioc" | "fok";

/**
 * Order class for bracket/OCO orders
 */
type AlpacaOrderClass = "simple" | "bracket" | "oco" | "oto";

/**
 * Alpaca order submission parameters
 */
interface AlpacaOrderParams {
  symbol: string;
  side: "buy" | "sell";
  type: AlpacaOrderType;
  time_in_force: AlpacaTimeInForce;
  client_order_id: string;
  qty?: string;
  notional?: string;
  limit_price?: string;
  stop_price?: string;
  extended_hours?: boolean;
  order_class?: AlpacaOrderClass;
  take_profit?: { limit_price: string };
  stop_loss?: { stop_price: string };
}

/**
 * Alpaca position response structure
 */
interface AlpacaPosition {
  symbol: string;
  qty: string;
  qty_available?: string;
  avg_entry_price: string;
  market_value: string;
  unrealized_pl: string;
  side: string;
}

// Cached admin user ID for database operations
let cachedAdminUserId: string | null = null;

async function getAdminUserId(): Promise<string> {
  if (cachedAdminUserId) return cachedAdminUserId;

  const adminUser = await storage.getAdminUser();
  if (!adminUser) {
    throw new Error("No admin user found - cannot process work items");
  }
  cachedAdminUserId = adminUser.id;
  return cachedAdminUserId;
}

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
  const bucket =
    params.timeframeBucket || Math.floor(Date.now() / 60000).toString();
  const data = `${params.strategyId}:${params.symbol}:${params.side}:${params.signalHash || ""}:${bucket}`;
  return crypto
    .createHash("sha256")
    .update(data)
    .digest("hex")
    .substring(0, 32);
}

export function classifyError(
  error: unknown
): "transient" | "permanent" | "unknown" {
  const errorStr = error instanceof Error ? error.message : String(error);

  if (PERMANENT_ERROR_PATTERNS.some((p) => p.test(errorStr))) {
    return "permanent";
  }
  if (TRANSIENT_ERROR_PATTERNS.some((p) => p.test(errorStr))) {
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
  invalidateWorkItem(id: string, reason: string): Promise<void>;
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
  drain(): Promise<void>;
}

class WorkQueueServiceImpl implements WorkQueueService {
  private workerInterval: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  async enqueue(item: InsertWorkItem): Promise<WorkItem> {
    if (item.idempotencyKey) {
      const existing = await this.getByIdempotencyKey(item.idempotencyKey);
      if (existing) {
        log.info(
          "work-queue",
          `Duplicate work item detected: ${item.idempotencyKey}`
        );
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
      const nextRunAt = calculateNextRunAt(
        item.type as WorkItemType,
        newAttempts
      );
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

  async invalidateWorkItem(id: string, reason: string): Promise<void> {
    // Invalidate a SUCCEEDED work item that had a canceled/rejected order
    // This clears the idempotency key so a new order can be submitted
    const item = await storage.getWorkItem(id);
    if (!item) {
      log.warn("work-queue", `Cannot invalidate work item ${id}: not found`);
      return;
    }

    log.info("work-queue", `Invalidating work item ${id}: ${reason}`, {
      originalStatus: item.status,
      symbol: item.symbol,
      idempotencyKey: item.idempotencyKey,
    });

    // Mark as INVALIDATED (a new status) or update idempotency key to allow retry
    // We'll mark as DEAD_LETTER with a special prefix and nullify the idempotency key
    await storage.updateWorkItem(id, {
      status: "DEAD_LETTER",
      lastError: `INVALIDATED: ${reason}`,
      idempotencyKey: `invalidated-${id}-${Date.now()}`, // Change the key so new orders don't match
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

  async getRecentItems(
    limit = 50,
    status?: WorkItemStatus
  ): Promise<WorkItem[]> {
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
      // Also extract nested objects for bracket orders (orchestrator sends nested format)
      take_profit,
      stop_loss,
      traceId,
    } = payload;

    // SECURITY: Check kill switch before processing any order
    // This ensures emergency halt stops ALL order execution paths
    const agentStatus = await storage.getAgentStatus();
    if (agentStatus?.killSwitchActive) {
      log.warn(
        "work-queue",
        `ORDER_BLOCKED: Kill switch is active - rejecting order for ${symbol}`,
        {
          traceId,
          workItemId: item.id,
          symbol,
          side,
          reason: "KILL_SWITCH_ACTIVE",
        }
      );
      await this.markFailed(
        item.id,
        "Kill switch is active - all trading halted",
        false
      );
      return;
    }

    // Support both flat fields and nested objects for bracket order params
    // Orchestrator sends: take_profit: { limit_price: "123.45" }
    // Some callers may send flat: take_profit_limit_price: "123.45"
    const effectiveTakeProfitLimitPrice =
      take_profit_limit_price || take_profit?.limit_price;
    const effectiveStopLossStopPrice =
      stop_loss_stop_price || stop_loss?.stop_price;

    log.info("work-queue", `Processing ORDER_SUBMIT for ${symbol} ${side}`, {
      traceId,
      workItemId: item.id,
      symbol,
      side,
    });

    // For SELL orders, skip enforcement check - we must be able to close existing positions
    // even if the symbol is no longer in the approved candidates list
    if (side !== "sell") {
      const enforcementCheck = await tradingEnforcementService.canTradeSymbol(
        symbol,
        traceId
      );
      if (!enforcementCheck.eligible) {
        // ENHANCED ORDER FAILURE LOGGING
        log.warn(
          "work-queue",
          `ORDER_BLOCKED: ${symbol} - Trading enforcement rejected`,
          {
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
            suggestion:
              "Add symbol to approved candidates list or ensure it passes universe eligibility",
          }
        );
        await this.markFailed(
          item.id,
          `Symbol ${symbol} blocked by trading enforcement: ${enforcementCheck.reason}`,
          false
        );
        return;
      }
    } else {
      log.info(
        "work-queue",
        `Bypassing enforcement check for SELL order on ${symbol}`,
        { traceId }
      );
    }

    const tradabilityCheck =
      await tradabilityService.validateSymbolTradable(symbol);
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
        suggestion:
          "Symbol may not be in Alpaca universe or may be a penny stock (<$5)",
      });
      await this.markFailed(
        item.id,
        `Symbol ${symbol} is not tradable: ${tradabilityCheck.reason || "Not found in broker universe"}`,
        false
      );
      return;
    }

    // SMART ORDER ROUTING: Transform orders to ensure they are NEVER rejected
    // Instead of blocking orders, we transform them to the correct type/price/TIF
    const isCrypto =
      symbol.includes("/") ||
      ["BTC", "ETH", "SOL", "DOGE", "SHIB", "AVAX"].some((c) =>
        symbol.toUpperCase().startsWith(c)
      );

    // Fetch current price for limit price calculation
    let currentPriceData: {
      bid: number;
      ask: number;
      last: number;
      spread?: number;
    } = { bid: 0, ask: 0, last: 0, spread: 0 };
    try {
      if (!isCrypto) {
        const snapshots = await alpaca.getSnapshots([symbol]);
        const snapshot = snapshots[symbol];
        if (snapshot?.latestTrade?.p) {
          const lastPrice = snapshot.latestTrade.p;
          const bidPrice = snapshot.latestQuote?.bp || lastPrice * 0.999;
          const askPrice = snapshot.latestQuote?.ap || lastPrice * 1.001;
          currentPriceData = createPriceData({
            bid: bidPrice,
            ask: askPrice,
            last: lastPrice,
          });
        }
      } else {
        // For crypto, use crypto snapshots
        const cryptoSnapshots = await alpaca.getCryptoSnapshots([symbol]);
        const snapshot = cryptoSnapshots[symbol];
        if (snapshot?.latestTrade?.p) {
          const lastPrice = snapshot.latestTrade.p;
          currentPriceData = createPriceData({
            bid: lastPrice * 0.999,
            ask: lastPrice * 1.001,
            last: lastPrice,
          });
        }
      }
    } catch (priceError) {
      log.warn(
        "work-queue",
        `Failed to fetch price for ${symbol}, using market order if possible`,
        { traceId, error: String(priceError) }
      );
    }

    // Build order input for smart router
    const orderInput = {
      symbol,
      side: side as "buy" | "sell",
      qty,
      notional,
      type: (type || "market") as AlpacaOrderType,
      timeInForce: (time_in_force || "day") as AlpacaTimeInForce,
      limitPrice: limit_price?.toString(),
      stopPrice: stop_price?.toString(),
      extendedHours: extended_hours,
      orderClass: order_class as AlpacaOrderClass | undefined,
      takeProfitLimitPrice: effectiveTakeProfitLimitPrice?.toString(),
      stopLossStopPrice: effectiveStopLossStopPrice?.toString(),
    };

    // Transform order using smart router
    const transformedOrder = transformOrderForExecution(
      orderInput,
      currentPriceData
    );

    // Log any transformations made
    if (transformedOrder.transformations.length > 0) {
      log.info(
        "work-queue",
        `ORDER_TRANSFORMED: ${symbol} - ${transformedOrder.transformations.length} changes applied`,
        {
          traceId,
          workItemId: item.id,
          symbol,
          side,
          originalType: type || "market",
          newType: transformedOrder.type,
          originalTIF: time_in_force || "day",
          newTIF: transformedOrder.timeInForce,
          limitPrice: transformedOrder.limitPrice,
          extendedHours: transformedOrder.extendedHours,
          session: transformedOrder.session,
          transformations: transformedOrder.transformations,
        }
      );
    }

    // Log any warnings
    if (transformedOrder.warnings.length > 0) {
      log.warn(
        "work-queue",
        `ORDER_WARNINGS: ${symbol} - ${transformedOrder.warnings.length} warnings`,
        {
          traceId,
          workItemId: item.id,
          symbol,
          warnings: transformedOrder.warnings,
        }
      );
    }

    // CRITICAL: Generate consistent client order ID for idempotency
    // Use the work item's idempotency key as base, append retry suffix only for genuine retries
    // This ensures first attempt uses consistent ID, and retries get unique IDs per attempt
    const baseClientOrderId = item.idempotencyKey || item.id;
    // First attempt (attempts=0): use base ID for true idempotency
    // Retry attempts: append -r1, -r2, etc. to distinguish genuine retry orders
    const clientOrderId =
      item.attempts > 0
        ? `${baseClientOrderId.substring(0, 24)}-r${item.attempts}`
        : baseClientOrderId.substring(0, 32);

    // Check BOTH open AND recent closed orders to catch filled/cancelled orders
    // that may have succeeded server-side but timed out locally
    const existingOrders = await alpaca.getOrders("all", 200);
    const existingOrder = existingOrders.find(
      (o) =>
        o.client_order_id === clientOrderId ||
        o.client_order_id === baseClientOrderId ||
        o.client_order_id?.startsWith(baseClientOrderId.substring(0, 20))
    );

    if (existingOrder) {
      log.info(
        "work-queue",
        `Order already exists for client_order_id ${clientOrderId}: ${existingOrder.id}`,
        { traceId }
      );
      await storage.updateWorkItem(item.id, {
        brokerOrderId: existingOrder.id,
        result: JSON.stringify({
          orderId: existingOrder.id,
          status: existingOrder.status,
        }),
      });
      await this.markSucceeded(
        item.id,
        JSON.stringify({ orderId: existingOrder.id, deduplicated: true })
      );
      return;
    }

    // =====================================================================
    // COMPREHENSIVE PRE-SUBMISSION VALIDATION
    // Validates position quantities, adjusts for fractional shares, and
    // ensures 100% order success by catching all potential failures upfront
    // =====================================================================
    let validatedQty = transformedOrder.qty;
    let validatedNotional = transformedOrder.notional;

    if (side === "sell" && validatedQty) {
      try {
        // Fetch LIVE position data directly from Alpaca
        const positions = (await alpaca.getPositions()) as AlpacaPosition[];
        const position = positions.find((p) => p.symbol === symbol);

        if (!position) {
          log.warn(
            "work-queue",
            `ORDER_BLOCKED: ${symbol} - No position found to sell`,
            {
              traceId,
              workItemId: item.id,
              requestedQty: validatedQty,
            }
          );
          await this.markFailed(
            item.id,
            `No position found for ${symbol} - cannot sell`,
            false
          );
          return;
        }

        const availableQty = parseFloat(
          position.qty_available || position.qty || "0"
        );
        const requestedQty = parseFloat(validatedQty);

        const heldForOrders = parseFloat(position.qty) - availableQty;

        log.info("work-queue", `Position validation for ${symbol}`, {
          traceId,
          requestedQty,
          availableQty,
          totalQty: position.qty,
          heldForOrders: heldForOrders.toString(),
        });

        if (availableQty <= 0) {
          log.warn(
            "work-queue",
            `ORDER_BLOCKED: ${symbol} - No available shares (all held for other orders)`,
            {
              traceId,
              workItemId: item.id,
              availableQty,
              heldForOrders: heldForOrders.toString(),
            }
          );
          await this.markFailed(
            item.id,
            `No available shares for ${symbol} (${availableQty} available, rest held for orders)`,
            false
          );
          return;
        }

        // CLAMP requested qty to available qty
        if (requestedQty > availableQty) {
          log.warn(
            "work-queue",
            `ORDER_QTY_ADJUSTED: ${symbol} - Clamping qty from ${requestedQty} to ${availableQty}`,
            {
              traceId,
              workItemId: item.id,
              originalQty: requestedQty,
              clampedQty: availableQty,
            }
          );
        }

        let finalQty = Math.min(requestedQty, availableQty);

        // For extended hours, round DOWN to whole shares (fractional not allowed)
        if (transformedOrder.extendedHours) {
          const wholeQty = Math.floor(finalQty);
          if (wholeQty <= 0) {
            log.warn(
              "work-queue",
              `ORDER_BLOCKED: ${symbol} - Fractional shares cannot trade in extended hours`,
              {
                traceId,
                workItemId: item.id,
                availableQty: finalQty,
                session: transformedOrder.session,
              }
            );
            await this.markFailed(
              item.id,
              `Cannot sell fractional shares (${finalQty}) during extended hours`,
              false
            );
            return;
          }
          if (wholeQty < finalQty) {
            log.info(
              "work-queue",
              `ORDER_QTY_ROUNDED: ${symbol} - Rounding down from ${finalQty} to ${wholeQty} for extended hours`,
              {
                traceId,
                workItemId: item.id,
              }
            );
          }
          finalQty = wholeQty;
        }

        validatedQty = finalQty.toString();
      } catch (posError: unknown) {
        const errorMessage = posError instanceof Error ? posError.message : String(posError);
        log.error(
          "work-queue",
          `Position validation failed for ${symbol}: ${errorMessage}`,
          { traceId }
        );
        // Continue with original qty - let Alpaca reject if invalid
      }
    }

    // For BUY orders in extended hours, ensure notional results in at least 1 whole share
    // NOTE: We do NOT block for insufficient buying power - let Alpaca handle margin validation
    // This allows buy-the-dip to work with margin accounts (negative cash but positive buying power)
    if (
      side === "buy" &&
      validatedNotional &&
      transformedOrder.extendedHours &&
      currentPriceData.last > 0
    ) {
      try {
        const requestedNotional = parseFloat(validatedNotional);
        const estimatedShares = requestedNotional / currentPriceData.last;
        if (estimatedShares < 1) {
          log.warn(
            "work-queue",
            `ORDER_BLOCKED: ${symbol} - Notional too small for whole share in extended hours`,
            {
              traceId,
              workItemId: item.id,
              notional: requestedNotional,
              estimatedShares,
              price: currentPriceData.last,
            }
          );
          await this.markFailed(
            item.id,
            `Notional $${requestedNotional} too small for 1 share at $${currentPriceData.last}`,
            false
          );
          return;
        }
      } catch (validationError: unknown) {
        const errorMessage = validationError instanceof Error ? validationError.message : String(validationError);
        log.warn(
          "work-queue",
          `Extended hours validation failed: ${errorMessage}`,
          { traceId }
        );
        // Continue - let Alpaca handle it
      }
    }

    // USE TRANSFORMED ORDER PARAMS from smart router
    // The smart router has already corrected order type, TIF, and calculated limit prices
    const orderParams: AlpacaOrderParams = {
      symbol,
      side: side as "buy" | "sell",
      type: transformedOrder.type as AlpacaOrderType,
      time_in_force: transformedOrder.timeInForce as AlpacaTimeInForce,
      client_order_id: clientOrderId,
    };

    // Use VALIDATED qty/notional (clamped to available, rounded for extended hours)
    if (validatedQty) orderParams.qty = validatedQty;
    if (validatedNotional) orderParams.notional = validatedNotional;

    // Use transformed limit price (auto-calculated if needed)
    if (transformedOrder.limitPrice)
      orderParams.limit_price = transformedOrder.limitPrice;

    // Use original stop price (smart router doesn't modify this)
    if (stop_price) orderParams.stop_price = stop_price;

    // Use transformed extended_hours flag
    if (transformedOrder.extendedHours)
      orderParams.extended_hours = transformedOrder.extendedHours;

    // Handle bracket orders (smart router ensures TIF is "day")
    if (transformedOrder.orderClass) {
      orderParams.order_class = transformedOrder.orderClass;
      // Only add take_profit/stop_loss for bracket orders
      if (transformedOrder.orderClass === "bracket") {
        if (transformedOrder.takeProfitLimitPrice) {
          orderParams.take_profit = {
            limit_price: transformedOrder.takeProfitLimitPrice,
          };
        }
        if (transformedOrder.stopLossStopPrice) {
          orderParams.stop_loss = {
            stop_price: transformedOrder.stopLossStopPrice,
          };
        }
      }
    }

    log.info("work-queue", `Submitting order to Alpaca`, {
      traceId,
      workItemId: item.id,
      symbol,
      type: orderParams.type,
      timeInForce: orderParams.time_in_force,
      limitPrice: orderParams.limit_price,
      extendedHours: orderParams.extended_hours,
      session: transformedOrder.session,
    });

    const order = await alpaca.createOrder(orderParams);

    log.info("work-queue", `ORDER_SUBMIT succeeded: ${order.id}`, {
      traceId,
      workItemId: item.id,
      orderId: order.id,
      status: order.status,
    });

    const userId = await getAdminUserId();
    const orderData = {
      userId,
      broker: "alpaca",
      brokerOrderId: order.id,
      clientOrderId: clientOrderId,
      symbol,
      side,
      // Use VALIDATED values that were actually submitted
      type: transformedOrder.type,
      timeInForce: transformedOrder.timeInForce,
      qty: validatedQty?.toString(),
      notional: validatedNotional?.toString(),
      limitPrice: transformedOrder.limitPrice?.toString(),
      stopPrice: stop_price?.toString(),
      status: order.status,
      // Capture extended_hours and order_class from Alpaca response
      extendedHours:
        order.extended_hours || transformedOrder.extendedHours || false,
      orderClass: order.order_class || transformedOrder.orderClass || "simple",
      submittedAt: new Date(order.submitted_at || Date.now()),
      updatedAt: new Date(),
      filledAt: order.filled_at ? new Date(order.filled_at) : undefined,
      expiredAt: order.expired_at ? new Date(order.expired_at) : undefined,
      canceledAt: order.canceled_at ? new Date(order.canceled_at) : undefined,
      failedAt: order.failed_at ? new Date(order.failed_at) : undefined,
      filledQty: order.filled_qty?.toString(),
      filledAvgPrice: order.filled_avg_price?.toString(),
      traceId,
      workItemId: item.id,
      rawJson: order,
    };

    await storage.upsertOrderByBrokerOrderId(order.id, orderData);

    await storage.updateWorkItem(item.id, { brokerOrderId: order.id });
    await this.markSucceeded(
      item.id,
      JSON.stringify({ orderId: order.id, status: order.status })
    );
  }

  async processOrderCancel(item: WorkItem): Promise<void> {
    const payload = JSON.parse(item.payload || "{}");
    const { orderId } = payload;

    if (!orderId) {
      await this.markFailed(item.id, "Missing orderId in payload", false);
      return;
    }

    await alpaca.cancelOrder(orderId);
    await this.markSucceeded(
      item.id,
      JSON.stringify({ canceledOrderId: orderId })
    );
  }

  async processOrderSync(item: WorkItem): Promise<void> {
    const payload = JSON.parse(item.payload || "{}");
    const traceId = payload.traceId || `sync-${Date.now()}`;

    log.info("work-queue", "Starting order sync", {
      traceId,
      workItemId: item.id,
    });

    const [openOrders, recentOrders] = await Promise.all([
      alpaca.getOrders("open", 100),
      alpaca.getOrders("closed", 50),
    ]);

    const allOrders = [...openOrders, ...recentOrders];
    let ordersUpserted = 0;
    let fillsCreated = 0;

    for (const alpacaOrder of allOrders) {
      try {
        // Get workItemId if linked to a work item
        let workItemId: string | undefined;
        if (alpacaOrder.client_order_id) {
          const workItem = await storage.getWorkItemByIdempotencyKey(
            alpacaOrder.client_order_id
          );
          if (workItem) {
            workItemId = workItem.id;
          }
        }

        const orderData = {
          broker: "alpaca" as const,
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
          // ADDED: Capture all Alpaca order metadata for complete tracking
          extendedHours: alpacaOrder.extended_hours || false,
          orderClass: alpacaOrder.order_class || "simple",
          submittedAt: new Date(alpacaOrder.submitted_at),
          updatedAt: new Date(alpacaOrder.updated_at || Date.now()),
          filledAt: alpacaOrder.filled_at
            ? new Date(alpacaOrder.filled_at)
            : undefined,
          expiredAt: alpacaOrder.expired_at
            ? new Date(alpacaOrder.expired_at)
            : undefined,
          canceledAt: alpacaOrder.canceled_at
            ? new Date(alpacaOrder.canceled_at)
            : undefined,
          failedAt: alpacaOrder.failed_at
            ? new Date(alpacaOrder.failed_at)
            : undefined,
          filledQty: alpacaOrder.filled_qty,
          filledAvgPrice: alpacaOrder.filled_avg_price || undefined,
          traceId,
          workItemId,
          rawJson: alpacaOrder,
        };

        await storage.upsertOrderByBrokerOrderId(alpacaOrder.id, orderData);
        ordersUpserted++;

        if (alpacaOrder.filled_at && parseFloat(alpacaOrder.filled_qty) > 0) {
          const existingFills = await storage.getFillsByBrokerOrderId(
            alpacaOrder.id
          );
          if (existingFills.length === 0) {
            const dbOrder = await storage.getOrderByBrokerOrderId(
              alpacaOrder.id
            );

            const fillData = {
              broker: "alpaca" as const,
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
        log.warn(
          "work-queue",
          `Failed to sync order ${alpacaOrder.id}: ${error}`,
          { traceId }
        );
      }
    }

    log.info("work-queue", `Order sync completed`, {
      traceId,
      ordersUpserted,
      fillsCreated,
      openOrders: openOrders.length,
      recentOrders: recentOrders.length,
    });

    await this.markSucceeded(
      item.id,
      JSON.stringify({
        ordersUpserted,
        fillsCreated,
        openOrders: openOrders.length,
        recentOrders: recentOrders.length,
        syncedAt: new Date().toISOString(),
      })
    );
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
          log.warn(
            "work-queue",
            `Failed to close position ${pos.symbol}: ${e}`
          );
        }
      }
    }

    await storage.updateAgentStatus({
      killSwitchActive: true,
      updatedAt: new Date(),
    });

    await this.markSucceeded(
      item.id,
      JSON.stringify({
        canceledOrders: true,
        closedPositions: payload.closePositions || false,
        executedAt: new Date().toISOString(),
      })
    );
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

    await this.markSucceeded(
      item.id,
      JSON.stringify({
        assetClass,
        synced: result.synced,
        tradable: result.tradable,
        syncedAt: new Date().toISOString(),
      })
    );
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

      log.error(
        "work-queue",
        `Work item ${item.id} failed (${errorClass}): ${errorMsg}`
      );

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

    log.info(
      "work-queue",
      `Starting work queue worker with ${intervalMs}ms interval`
    );
    this.workerInterval = setInterval(() => this.runWorkerCycle(), intervalMs);
  }

  stopWorker(): void {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
      log.info("work-queue", "Work queue worker stopped");
    }
  }

  async drain(): Promise<void> {
    // Stop accepting new work and wait for current processing to complete
    this.stopWorker();

    // Wait for any in-progress work to complete (with timeout)
    const maxWaitMs = 30000;
    const startTime = Date.now();

    while (this.processing && Date.now() - startTime < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.processing) {
      log.warn("work-queue", "Drain timeout - work item still processing");
    } else {
      log.info("work-queue", "Work queue drained successfully");
    }
  }
}

export const workQueue = new WorkQueueServiceImpl();
