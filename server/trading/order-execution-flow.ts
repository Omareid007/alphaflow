/**
 * ORDER EXECUTION FLOW WITH ERROR HANDLING AND AUTO-RECOVERY
 *
 * This file implements comprehensive order execution with:
 * - Pre-execution validation
 * - Retry mechanisms with exponential backoff
 * - Error classification and recovery strategies
 * - Order status tracking and reconciliation
 * - Expected outcome validation
 */

import { randomUUID } from "crypto";
import { alpaca, CreateOrderParams, AlpacaOrder } from "../connectors/alpaca";
import { storage } from "../storage";
import { safeParseFloat } from "../utils/numeric";
import {
  toDecimal,
  calculateQuantity,
  priceWithBuffer,
  percentChange,
  positionValue,
  formatPrice,
} from "../utils/money";
import { performanceTracker } from "../lib/performance-metrics";
import {
  cacheQuickQuote,
  getQuickQuote,
  cacheAccountSnapshot,
  getAccountSnapshot,
  cacheTradability,
  getTradability,
} from "../lib/order-execution-cache";
import { emitEvent } from "../lib/webhook-emitter";
import { sendNotification } from "../lib/notification-service";
import { tradabilityService } from "../services/tradability-service";
import { log } from "../utils/logger";
import {
  CreateOrderSchema,
  validateOrderTypeCombination,
  validateStopPrice,
  validateLimitPrice,
  validateBracketOrder,
  validateTrailingStop,
  isTerminalStatus,
  isActiveStatus,
  isFailedStatus,
  type ValidationResult,
  type FailedStatus,
} from "./order-types-matrix";
import { tradingConfig } from "../config/trading-config";

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

export enum OrderErrorType {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  INVALID_SYMBOL = "INVALID_SYMBOL",
  MARKET_CLOSED = "MARKET_CLOSED",
  RATE_LIMITED = "RATE_LIMITED",
  NETWORK_ERROR = "NETWORK_ERROR",
  BROKER_REJECTION = "BROKER_REJECTION",
  POSITION_NOT_FOUND = "POSITION_NOT_FOUND",
  ORDER_NOT_FOUND = "ORDER_NOT_FOUND",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN",
}

export interface ClassifiedError {
  type: OrderErrorType;
  message: string;
  retryable: boolean;
  suggestedDelay: number;
  recoveryStrategy: RecoveryStrategy;
  originalError?: Error;
}

export enum RecoveryStrategy {
  NONE = "NONE",
  RETRY_IMMEDIATELY = "RETRY_IMMEDIATELY",
  RETRY_WITH_BACKOFF = "RETRY_WITH_BACKOFF",
  ADJUST_AND_RETRY = "ADJUST_AND_RETRY",
  CANCEL_AND_REPLACE = "CANCEL_AND_REPLACE",
  WAIT_FOR_MARKET_OPEN = "WAIT_FOR_MARKET_OPEN",
  CHECK_AND_SYNC = "CHECK_AND_SYNC",
  MANUAL_INTERVENTION = "MANUAL_INTERVENTION",
}

/**
 * Classify error and determine recovery strategy
 */
function classifyError(error: Error, context?: string): ClassifiedError {
  const message = error.message.toLowerCase();

  if (message.includes("insufficient") || message.includes("buying power")) {
    return {
      type: OrderErrorType.INSUFFICIENT_FUNDS,
      message: error.message,
      retryable: false,
      suggestedDelay: 0,
      recoveryStrategy: RecoveryStrategy.ADJUST_AND_RETRY,
    };
  }

  if (
    message.includes("symbol") &&
    (message.includes("not found") || message.includes("invalid"))
  ) {
    return {
      type: OrderErrorType.INVALID_SYMBOL,
      message: error.message,
      retryable: false,
      suggestedDelay: 0,
      recoveryStrategy: RecoveryStrategy.MANUAL_INTERVENTION,
    };
  }

  if (
    message.includes("market") &&
    (message.includes("closed") || message.includes("not open"))
  ) {
    return {
      type: OrderErrorType.MARKET_CLOSED,
      message: error.message,
      retryable: true,
      suggestedDelay: 60000,
      recoveryStrategy: RecoveryStrategy.WAIT_FOR_MARKET_OPEN,
    };
  }

  if (message.includes("429") || message.includes("rate limit")) {
    return {
      type: OrderErrorType.RATE_LIMITED,
      message: error.message,
      retryable: true,
      suggestedDelay: 5000,
      recoveryStrategy: RecoveryStrategy.RETRY_WITH_BACKOFF,
    };
  }

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("econnrefused")
  ) {
    return {
      type: OrderErrorType.NETWORK_ERROR,
      message: error.message,
      retryable: true,
      suggestedDelay: 2000,
      recoveryStrategy: RecoveryStrategy.RETRY_WITH_BACKOFF,
    };
  }

  if (message.includes("timeout")) {
    return {
      type: OrderErrorType.TIMEOUT,
      message: error.message,
      retryable: true,
      suggestedDelay: 1000,
      recoveryStrategy: RecoveryStrategy.CHECK_AND_SYNC,
    };
  }

  if (message.includes("rejected") || message.includes("refused")) {
    return {
      type: OrderErrorType.BROKER_REJECTION,
      message: error.message,
      retryable: false,
      suggestedDelay: 0,
      recoveryStrategy: RecoveryStrategy.ADJUST_AND_RETRY,
    };
  }

  if (message.includes("position") && message.includes("not found")) {
    return {
      type: OrderErrorType.POSITION_NOT_FOUND,
      message: error.message,
      retryable: false,
      suggestedDelay: 0,
      recoveryStrategy: RecoveryStrategy.CHECK_AND_SYNC,
    };
  }

  if (message.includes("order") && message.includes("not found")) {
    return {
      type: OrderErrorType.ORDER_NOT_FOUND,
      message: error.message,
      retryable: false,
      suggestedDelay: 0,
      recoveryStrategy: RecoveryStrategy.CHECK_AND_SYNC,
    };
  }

  return {
    type: OrderErrorType.UNKNOWN,
    message: error.message,
    retryable: true,
    suggestedDelay: 3000,
    recoveryStrategy: RecoveryStrategy.RETRY_WITH_BACKOFF,
    originalError: error,
  };
}

// ============================================================================
// EXECUTION FLOW STATE
// ============================================================================

export interface OrderExecutionState {
  orderId: string | null;
  clientOrderId: string;
  status:
    | "pending"
    | "validating"
    | "submitting"
    | "submitted"
    | "monitoring"
    | "filled"
    | "failed"
    | "canceled"
    | "recovering";
  symbol: string;
  side: "buy" | "sell";
  orderType: string;
  requestedQty: string;
  filledQty: string;
  requestedPrice: string | null;
  filledPrice: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  errors: ClassifiedError[];
  validationResult: ValidationResult | null;
  expectedOutcome: ExpectedOutcome | null;
  actualOutcome: ActualOutcome | null;
}

export interface ExpectedOutcome {
  fillPrice: { min: number; max: number };
  fillQty: number;
  estimatedCost: number;
  shouldFillImmediately: boolean;
  fillTimeEstimateMs: number;
  risksIdentified: string[];
}

export interface ActualOutcome {
  filled: boolean;
  fillPrice: number | null;
  fillQty: number;
  totalCost: number;
  fillTimeMs: number;
  slippage: number | null;
  status: string;
  unexpectedEvents: string[];
}

// ============================================================================
// ORDER EXECUTION ENGINE
// ============================================================================

export interface ExecuteOrderOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  validateBeforeSubmit?: boolean;
  trackExpectedOutcome?: boolean;
  autoRecover?: boolean;
}

const DEFAULT_OPTIONS: Required<ExecuteOrderOptions> = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 30000,
  validateBeforeSubmit: true,
  trackExpectedOutcome: true,
  autoRecover: true,
};

export interface OrderExecutionResult {
  success: boolean;
  state: OrderExecutionState;
  order?: AlpacaOrder;
  error?: ClassifiedError;
  validationWarnings: string[];
  outcomeAnalysis?: OutcomeAnalysis;
}

export interface OutcomeAnalysis {
  matchesExpected: boolean;
  slippagePercent: number | null;
  fillTimeDeviation: number | null;
  unexpectedIssues: string[];
  recommendations: string[];
}

class OrderExecutionEngine {
  private activeExecutions: Map<string, OrderExecutionState> = new Map();

  /**
   * Execute order with full validation, retry, and recovery
   */
  async executeOrder(
    params: CreateOrderParams,
    options: ExecuteOrderOptions = {}
  ): Promise<OrderExecutionResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const clientOrderId = params.client_order_id || randomUUID();

    const state: OrderExecutionState = {
      orderId: null,
      clientOrderId,
      status: "pending",
      symbol: params.symbol,
      side: params.side,
      orderType: params.type,
      requestedQty: params.qty || params.notional || "0",
      filledQty: "0",
      requestedPrice: params.limit_price || params.stop_price || null,
      filledPrice: null,
      attempts: 0,
      maxAttempts: opts.maxRetries,
      createdAt: new Date(),
      updatedAt: new Date(),
      errors: [],
      validationResult: null,
      expectedOutcome: null,
      actualOutcome: null,
    };

    this.activeExecutions.set(clientOrderId, state);
    const warnings: string[] = [];

    try {
      // Phase 1: Validation
      state.status = "validating";
      state.updatedAt = new Date();

      if (opts.validateBeforeSubmit) {
        const validation = await this.validateOrderParams(params);
        state.validationResult = validation;

        if (!validation.valid) {
          const error = classifyError(new Error(validation.errors.join("; ")));
          error.type = OrderErrorType.VALIDATION_ERROR;
          state.errors.push(error);
          state.status = "failed";
          return {
            success: false,
            state,
            error,
            validationWarnings: validation.warnings,
          };
        }

        warnings.push(...validation.warnings);
      }

      // Phase 2: Calculate Expected Outcome
      if (opts.trackExpectedOutcome) {
        state.expectedOutcome = await this.calculateExpectedOutcome(params);
      }

      // Phase 3: Submit Order with Retry
      state.status = "submitting";
      let order: AlpacaOrder | null = null;

      while (state.attempts < opts.maxRetries) {
        state.attempts++;
        state.updatedAt = new Date();

        try {
          const orderWithClientId = {
            ...params,
            client_order_id: clientOrderId,
          };

          order = await this.submitOrderWithTimeout(
            orderWithClientId,
            opts.timeoutMs
          );
          state.orderId = order.id;
          state.status = "submitted";

          emitEvent("trade.order.submitted", {
            orderId: order.id,
            clientOrderId,
            symbol: params.symbol,
            side: params.side,
            type: params.type,
            qty: params.qty,
            limitPrice: params.limit_price,
            timestamp: new Date().toISOString(),
          }).catch((err) =>
            log.error("Webhook", "Order submitted event failed", {
              error: (err as Error).message,
            })
          );

          sendNotification("trade.order.submitted", {
            orderId: order.id,
            symbol: params.symbol,
            side: params.side,
            qty: params.qty,
            price: params.limit_price || "market",
          }).catch((err) =>
            log.error("Notification", "Order submitted notification failed", {
              error: (err as Error).message,
            })
          );

          break;
        } catch (error) {
          const classifiedError = classifyError(
            error as Error,
            `Attempt ${state.attempts}`
          );
          state.errors.push(classifiedError);

          if (!classifiedError.retryable || state.attempts >= opts.maxRetries) {
            if (
              opts.autoRecover &&
              classifiedError.recoveryStrategy !== RecoveryStrategy.NONE
            ) {
              const recovered = await this.attemptRecovery(
                state,
                classifiedError,
                params
              );
              if (recovered) {
                order = recovered;
                break;
              }
            }

            state.status = "failed";

            sendNotification("trade.order.rejected", {
              symbol: params.symbol,
              side: params.side,
              qty: params.qty,
              reason: classifiedError.message,
            }).catch((err) =>
              log.error("Notification", "Order rejected notification failed", {
                error: (err as Error).message,
              })
            );

            return {
              success: false,
              state,
              error: classifiedError,
              validationWarnings: warnings,
            };
          }

          const delay =
            classifiedError.suggestedDelay * Math.pow(2, state.attempts - 1);
          await this.sleep(delay);
        }
      }

      if (!order) {
        state.status = "failed";
        return {
          success: false,
          state,
          error: state.errors[state.errors.length - 1],
          validationWarnings: warnings,
        };
      }

      // Phase 4: Monitor for Fill
      state.status = "monitoring";
      const monitoredOrder = await this.monitorOrderUntilTerminal(
        order.id,
        opts.timeoutMs
      );

      // Phase 5: Record Actual Outcome
      state.actualOutcome = this.recordActualOutcome(monitoredOrder, state);

      if (isFailedStatus(monitoredOrder.status)) {
        // Map Alpaca status to our execution state (canceled/expired/rejected → canceled or failed)
        state.status = monitoredOrder.status === "canceled" ? "canceled" : "failed";
        return {
          success: false,
          state,
          order: monitoredOrder,
          validationWarnings: warnings,
          outcomeAnalysis: this.analyzeOutcome(state),
        };
      }

      state.status = "filled";
      state.filledQty = monitoredOrder.filled_qty;
      state.filledPrice = monitoredOrder.filled_avg_price;

      emitEvent("trade.order.filled", {
        orderId: monitoredOrder.id,
        clientOrderId,
        symbol: monitoredOrder.symbol,
        side: monitoredOrder.side,
        filledQty: monitoredOrder.filled_qty,
        filledPrice: monitoredOrder.filled_avg_price,
        status: monitoredOrder.status,
        timestamp: new Date().toISOString(),
      }).catch((err) =>
        log.error("Webhook", "Order filled event failed", {
          error: (err as Error).message,
        })
      );

      sendNotification("trade.order.filled", {
        orderId: monitoredOrder.id,
        symbol: monitoredOrder.symbol,
        side: monitoredOrder.side,
        qty: monitoredOrder.filled_qty,
        price: monitoredOrder.filled_avg_price,
      }).catch((err) =>
        log.error("Notification", "Order filled notification failed", {
          error: (err as Error).message,
        })
      );

      return {
        success: true,
        state,
        order: monitoredOrder,
        validationWarnings: warnings,
        outcomeAnalysis: this.analyzeOutcome(state),
      };
    } finally {
      this.activeExecutions.delete(clientOrderId);
    }
  }

  /**
   * Validate order parameters before submission
   */
  private async validateOrderParams(
    params: CreateOrderParams
  ): Promise<ValidationResult> {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };

    // Schema validation
    try {
      CreateOrderSchema.parse(params);
    } catch (e: unknown) {
      result.valid = false;
      const errorMessage = e instanceof Error ? e.message : String(e);
      result.errors.push(`Schema validation failed: ${errorMessage}`);
      return result;
    }

    // Tradability gate - check if symbol is tradable
    const tradabilityCheck = await tradabilityService.validateSymbolTradable(
      params.symbol
    );
    if (!tradabilityCheck.tradable) {
      result.valid = false;
      result.errors.push(
        `Symbol ${params.symbol} is not tradable: ${tradabilityCheck.reason || "Not found in broker universe"}`
      );
      return result;
    }

    // Add warnings for special asset properties
    if (!tradabilityCheck.fractionable && params.notional) {
      result.warnings.push(
        `${params.symbol} does not support fractional trading; use qty instead of notional`
      );
    }
    if (!tradabilityCheck.marginable) {
      result.warnings.push(`${params.symbol} is not marginable`);
    }

    // Type/TIF combination validation
    const typeTifValidation = validateOrderTypeCombination(
      params.type,
      params.time_in_force,
      params.extended_hours
    );
    result.errors.push(...typeTifValidation.errors);
    result.warnings.push(...typeTifValidation.warnings);
    if (!typeTifValidation.valid) result.valid = false;

    // Get current price for price validations (check cache first for faster validation)
    let currentPrice: number | null = null;
    const cachedQuote = getQuickQuote(params.symbol);
    if (cachedQuote) {
      currentPrice = cachedQuote.price;
    } else {
      try {
        const operationId = `quote_${params.symbol}_${Date.now()}`;
        performanceTracker.startTimer(operationId);
        const snapshots = await alpaca.getSnapshots([params.symbol]);
        const latency = performanceTracker.endTimer(
          operationId,
          "quoteRetrieval"
        );
        currentPrice = snapshots[params.symbol]?.latestTrade?.p || null;
        if (currentPrice) {
          const trade = snapshots[params.symbol]?.latestTrade;
          cacheQuickQuote({
            symbol: params.symbol,
            price: currentPrice,
            bid: snapshots[params.symbol]?.latestQuote?.bp || currentPrice,
            ask: snapshots[params.symbol]?.latestQuote?.ap || currentPrice,
            spread: 0,
            timestamp: Date.now(),
          });
        }
        if (latency > 10) {
          log.debug("OrderExecution", "Slow quote retrieval", {
            latencyMs: latency,
            symbol: params.symbol,
          });
        }
      } catch {
        result.warnings.push(
          `Could not fetch current price for ${params.symbol}`
        );
      }
    }

    if (currentPrice) {
      // Stop price validation
      if (params.stop_price) {
        const stopValidation = validateStopPrice(
          params.side,
          currentPrice,
          parseFloat(params.stop_price)
        );
        result.errors.push(...stopValidation.errors);
        result.warnings.push(...stopValidation.warnings);
        if (!stopValidation.valid) result.valid = false;
      }

      // Limit price validation
      if (params.limit_price) {
        const limitValidation = validateLimitPrice(
          params.side,
          currentPrice,
          parseFloat(params.limit_price)
        );
        result.errors.push(...limitValidation.errors);
        result.warnings.push(...limitValidation.warnings);
        if (!limitValidation.valid) result.valid = false;
      }

      // Bracket order validation
      if (
        params.order_class === "bracket" &&
        params.take_profit &&
        params.stop_loss
      ) {
        const entryPrice = params.limit_price
          ? parseFloat(params.limit_price)
          : currentPrice;
        const bracketValidation = validateBracketOrder(
          params.side,
          entryPrice,
          parseFloat(params.take_profit.limit_price),
          parseFloat(params.stop_loss.stop_price)
        );
        result.errors.push(...bracketValidation.errors);
        result.warnings.push(...bracketValidation.warnings);
        if (!bracketValidation.valid) result.valid = false;
      }
    }

    // Trailing stop validation
    if (params.type === "trailing_stop") {
      const trailValidation = validateTrailingStop(
        params.trail_percent ? parseFloat(params.trail_percent) : undefined,
        params.trail_price ? parseFloat(params.trail_price) : undefined
      );
      result.errors.push(...trailValidation.errors);
      result.warnings.push(...trailValidation.warnings);
      if (!trailValidation.valid) result.valid = false;
    }

    // Check market status for non-extended hours
    if (!params.extended_hours) {
      try {
        const marketStatus = await alpaca.getMarketStatus();
        if (!marketStatus.isOpen && params.time_in_force === "day") {
          result.warnings.push(
            `Market is currently ${marketStatus.session}. Day orders will queue until market open.`
          );
        }
      } catch {
        result.warnings.push("Could not verify market status");
      }
    }

    return result;
  }

  /**
   * Calculate expected outcome based on order parameters
   */
  private async calculateExpectedOutcome(
    params: CreateOrderParams
  ): Promise<ExpectedOutcome> {
    const qty = parseFloat(params.qty || "0");
    const notional = parseFloat(params.notional || "0");

    let currentPrice = 0;
    try {
      const snapshots = await alpaca.getSnapshots([params.symbol]);
      currentPrice = snapshots[params.symbol]?.latestTrade?.p || 0;
    } catch {
      currentPrice = params.limit_price ? parseFloat(params.limit_price) : 0;
    }

    // Use Decimal.js for precise quantity calculation
    const expectedQty =
      qty > 0 ? qty : calculateQuantity(notional, currentPrice).toNumber();
    const risks: string[] = [];

    let fillPriceMin = currentPrice;
    let fillPriceMax = currentPrice;
    let shouldFillImmediately = false;
    let fillTimeEstimate = 0;

    switch (params.type) {
      case "market":
        // Use Decimal.js for precise price buffer calculations (0.5% slippage range)
        fillPriceMin = priceWithBuffer(currentPrice, 0.005, -1).toNumber();
        fillPriceMax = priceWithBuffer(currentPrice, 0.005, 1).toNumber();
        shouldFillImmediately = true;
        fillTimeEstimate = 500;
        risks.push("Slippage possible in fast-moving markets");
        break;

      case "limit":
        const limitPrice = parseFloat(params.limit_price || "0");
        fillPriceMin = limitPrice;
        fillPriceMax = limitPrice;
        shouldFillImmediately =
          params.side === "buy"
            ? limitPrice >= currentPrice
            : limitPrice <= currentPrice;
        fillTimeEstimate = shouldFillImmediately ? 1000 : 300000;
        if (!shouldFillImmediately) {
          risks.push("Order may not fill if price doesn't reach limit");
        }
        break;

      case "stop":
        // Use Decimal.js for precise stop price range (1% slippage)
        const stopPrice = parseFloat(params.stop_price || "0");
        fillPriceMin = priceWithBuffer(stopPrice, 0.01, -1).toNumber();
        fillPriceMax = priceWithBuffer(stopPrice, 0.01, 1).toNumber();
        shouldFillImmediately = false;
        fillTimeEstimate = 600000;
        risks.push("Stop orders trigger as market orders - slippage possible");
        break;

      case "stop_limit":
        fillPriceMin = parseFloat(params.limit_price || "0");
        fillPriceMax = parseFloat(params.limit_price || "0");
        shouldFillImmediately = false;
        fillTimeEstimate = 600000;
        risks.push("Order may not fill if gap occurs past limit price");
        break;

      case "trailing_stop":
        // Use Decimal.js for precise trailing stop range (10% buffer)
        fillPriceMin = priceWithBuffer(currentPrice, 0.1, -1).toNumber();
        fillPriceMax = priceWithBuffer(currentPrice, 0.1, 1).toNumber();
        shouldFillImmediately = false;
        fillTimeEstimate = 3600000;
        risks.push("Trailing stop may trigger during normal volatility");
        break;
    }

    // Use Decimal.js for precise estimated cost calculation
    const avgFillPrice = toDecimal(fillPriceMin)
      .plus(fillPriceMax)
      .dividedBy(2);
    const estimatedCost = positionValue(expectedQty, avgFillPrice).toNumber();

    return {
      fillPrice: { min: fillPriceMin, max: fillPriceMax },
      fillQty: expectedQty,
      estimatedCost,
      shouldFillImmediately,
      fillTimeEstimateMs: fillTimeEstimate,
      risksIdentified: risks,
    };
  }

  /**
   * Submit order with timeout and performance tracking
   */
  private async submitOrderWithTimeout(
    params: CreateOrderParams,
    timeoutMs: number
  ): Promise<AlpacaOrder> {
    const operationId = `order_${params.symbol}_${Date.now()}`;
    performanceTracker.startTimer(operationId);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        performanceTracker.endTimer(operationId, "orderExecution");
        reject(new Error(`Order submission timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      alpaca
        .createOrder(params)
        .then((order) => {
          clearTimeout(timeout);
          const latency = performanceTracker.endTimer(
            operationId,
            "orderExecution"
          );
          if (latency > 50) {
            log.debug("OrderExecution", "Slow order submission", {
              latencyMs: latency,
              symbol: params.symbol,
            });
          }
          resolve(order);
        })
        .catch((error) => {
          clearTimeout(timeout);
          performanceTracker.endTimer(operationId, "orderExecution");
          reject(error);
        });
    });
  }

  /**
   * Monitor order until it reaches a terminal state
   */
  private async monitorOrderUntilTerminal(
    orderId: string,
    timeoutMs: number
  ): Promise<AlpacaOrder> {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const order = await alpaca.getOrder(orderId);

        if (isTerminalStatus(order.status)) {
          return order;
        }

        await this.sleep(pollInterval);
      } catch (error) {
        log.error("OrderExecution", "Error polling order", {
          orderId,
          error: (error as Error).message,
        });
        await this.sleep(pollInterval);
      }
    }

    return await alpaca.getOrder(orderId);
  }

  /**
   * Record actual outcome from filled order
   */
  private recordActualOutcome(
    order: AlpacaOrder,
    state: OrderExecutionState
  ): ActualOutcome {
    const fillPrice = safeParseFloat(order.filled_avg_price, 0);
    const fillQty = safeParseFloat(order.filled_qty, 0);
    const fillTimeMs = order.filled_at
      ? new Date(order.filled_at).getTime() - state.createdAt.getTime()
      : Date.now() - state.createdAt.getTime();

    const requestedPrice = state.requestedPrice
      ? parseFloat(state.requestedPrice)
      : null;
    // Use Decimal.js for precise slippage percentage calculation
    const slippage =
      requestedPrice && fillPrice
        ? percentChange(fillPrice, requestedPrice).toNumber()
        : null;

    const unexpectedEvents: string[] = [];

    if (order.status === "partially_filled") {
      unexpectedEvents.push(
        `Only partially filled: ${fillQty} of ${order.qty}`
      );
    }

    if (slippage !== null && Math.abs(slippage) > 1) {
      unexpectedEvents.push(
        `Significant slippage: ${formatPrice(slippage, 2)}%`
      );
    }

    // Use Decimal.js for precise total cost calculation
    const totalCost = positionValue(fillQty, fillPrice).toNumber();

    return {
      filled: order.status === "filled",
      fillPrice,
      fillQty,
      totalCost,
      fillTimeMs,
      slippage,
      status: order.status,
      unexpectedEvents,
    };
  }

  /**
   * Analyze outcome vs expected
   */
  private analyzeOutcome(state: OrderExecutionState): OutcomeAnalysis {
    const expected = state.expectedOutcome;
    const actual = state.actualOutcome;

    if (!expected || !actual) {
      return {
        matchesExpected: true,
        slippagePercent: null,
        fillTimeDeviation: null,
        unexpectedIssues: [],
        recommendations: [],
      };
    }

    const issues: string[] = [];
    const recommendations: string[] = [];

    let matchesExpected = true;

    // Check fill price
    if (actual.fillPrice !== null) {
      if (
        actual.fillPrice < expected.fillPrice.min ||
        actual.fillPrice > expected.fillPrice.max
      ) {
        matchesExpected = false;
        issues.push(
          `Fill price $${actual.fillPrice.toFixed(2)} outside expected range ` +
            `$${expected.fillPrice.min.toFixed(2)}-$${expected.fillPrice.max.toFixed(2)}`
        );
        recommendations.push(
          "Consider using limit orders for better price control"
        );
      }
    }

    // Check fill quantity
    if (actual.fillQty < expected.fillQty * 0.99) {
      matchesExpected = false;
      issues.push(
        `Partial fill: ${actual.fillQty} of ${expected.fillQty} requested`
      );
      recommendations.push("Check liquidity before placing large orders");
    }

    // Check fill time
    const fillTimeDeviation = actual.fillTimeMs - expected.fillTimeEstimateMs;
    if (expected.shouldFillImmediately && actual.fillTimeMs > 5000) {
      issues.push(`Expected immediate fill but took ${actual.fillTimeMs}ms`);
    }

    // Add any unexpected events
    issues.push(...actual.unexpectedEvents);

    return {
      matchesExpected,
      slippagePercent: actual.slippage,
      fillTimeDeviation,
      unexpectedIssues: issues,
      recommendations,
    };
  }

  /**
   * Attempt recovery based on error type
   */
  private async attemptRecovery(
    state: OrderExecutionState,
    error: ClassifiedError,
    originalParams: CreateOrderParams
  ): Promise<AlpacaOrder | null> {
    state.status = "recovering";
    log.info("OrderExecution", "Attempting recovery", {
      recoveryStrategy: error.recoveryStrategy,
    });

    switch (error.recoveryStrategy) {
      case RecoveryStrategy.CHECK_AND_SYNC:
        try {
          const orders = await alpaca.getOrders("all", 10);
          const existingOrder = orders.find(
            (o) => o.client_order_id === state.clientOrderId
          );
          if (existingOrder) {
            log.info("OrderExecution", "Found existing order via sync", {
              orderId: existingOrder.id,
            });
            return existingOrder;
          }
        } catch {
          log.error("OrderExecution", "Sync check failed");
        }
        return null;

      case RecoveryStrategy.ADJUST_AND_RETRY:
        if (error.type === OrderErrorType.INSUFFICIENT_FUNDS) {
          const reducedParams = { ...originalParams };
          // Use Decimal.js for precise 50% reduction calculation
          if (reducedParams.qty) {
            reducedParams.qty = toDecimal(reducedParams.qty)
              .times(0.5)
              .toString();
          } else if (reducedParams.notional) {
            reducedParams.notional = toDecimal(reducedParams.notional)
              .times(0.5)
              .toString();
          }
          try {
            return await alpaca.createOrder(reducedParams);
          } catch {
            return null;
          }
        }
        return null;

      case RecoveryStrategy.WAIT_FOR_MARKET_OPEN:
        const marketStatus = await alpaca.getMarketStatus();
        if (marketStatus.isOpen || marketStatus.isExtendedHours) {
          try {
            return await alpaca.createOrder(originalParams);
          } catch {
            return null;
          }
        }
        return null;

      default:
        return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get active execution states for monitoring
   */
  getActiveExecutions(): Map<string, OrderExecutionState> {
    return new Map(this.activeExecutions);
  }
}

export const orderExecutionEngine = new OrderExecutionEngine();

// ============================================================================
// ORDER BOOK CLEANUP UTILITIES
// ============================================================================

export interface UnrealOrder {
  orderId: string;
  symbol: string;
  status: string;
  reason: string;
  createdAt: string;
  filledQty: string;
  qty: string;
  notional: string | null;
}

/**
 * Identify "unreal" orders - orders that have no value and should be cleaned up
 *
 * Criteria for unreal orders:
 * 1. Status is rejected, canceled, or expired
 * 2. Zero filled quantity
 * 3. Null or zero notional value
 * 4. Stale orders older than 24 hours with no fills
 */
export async function identifyUnrealOrders(): Promise<UnrealOrder[]> {
  const unrealOrders: UnrealOrder[] = [];

  try {
    const allOrders = await alpaca.getOrders("all", 500);
    const staleThresholdMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const order of allOrders) {
      let isUnreal = false;
      let reason = "";

      const filledQty = safeParseFloat(order.filled_qty, 0);
      const notionalValue = order.notional
        ? safeParseFloat(order.notional, 0)
        : 0;
      const orderCreatedAt = new Date(order.created_at).getTime();
      const orderAgeMs = now - orderCreatedAt;

      if (order.status === "rejected") {
        isUnreal = true;
        reason = "Order was rejected by broker";
      } else if (order.status === "canceled" && filledQty === 0) {
        isUnreal = true;
        reason = "Order was canceled with no fills";
      } else if (order.status === "expired" && filledQty === 0) {
        isUnreal = true;
        reason = "Order expired with no fills";
      } else if (filledQty === 0 && notionalValue === 0 && order.qty === "0") {
        isUnreal = true;
        reason = "Order has zero quantity and zero notional";
      } else if (
        isActiveStatus(order.status) &&
        orderAgeMs >= staleThresholdMs &&
        filledQty === 0
      ) {
        isUnreal = true;
        reason = "Stale active order with no fills (>24 hours old)";
      }

      if (isUnreal) {
        unrealOrders.push({
          orderId: order.id,
          symbol: order.symbol,
          status: order.status,
          reason,
          createdAt: order.created_at,
          filledQty: order.filled_qty,
          qty: order.qty,
          notional: order.notional,
        });
      }
    }
  } catch (error) {
    log.error("OrderCleanup", "Failed to identify unreal orders", {
      error: (error as Error).message,
    });
  }

  return unrealOrders;
}

/**
 * Clean up unreal orders from Alpaca order book
 * Only cancels orders that are still in cancelable state
 */
export async function cleanupUnrealOrders(): Promise<{
  identified: number;
  canceled: number;
  errors: string[];
}> {
  const result = {
    identified: 0,
    canceled: 0,
    errors: [] as string[],
  };

  try {
    const unrealOrders = await identifyUnrealOrders();
    result.identified = unrealOrders.length;

    for (const order of unrealOrders) {
      if (isActiveStatus(order.status)) {
        try {
          await alpaca.cancelOrder(order.orderId);
          log.info("OrderCleanup", "Canceled unreal order", {
            orderId: order.orderId,
            reason: order.reason,
          });
          result.canceled++;
        } catch (error) {
          const errorMsg = `Failed to cancel ${order.orderId}: ${(error as Error).message}`;
          result.errors.push(errorMsg);
          log.warn("OrderCleanup", "Failed to cancel order", {
            orderId: order.orderId,
            error: (error as Error).message,
          });
        }
      }
    }

    log.info("OrderCleanup", "Unreal order cleanup complete", {
      identified: result.identified,
      canceled: result.canceled,
    });
  } catch (error) {
    result.errors.push(`Cleanup failed: ${(error as Error).message}`);
  }

  return result;
}

/**
 * Reconcile local order records with Alpaca order book
 */
export async function reconcileOrderBook(): Promise<{
  alpacaOrders: number;
  localTrades: number;
  missingLocal: string[];
  orphanedLocal: string[];
  synced: number;
}> {
  const result = {
    alpacaOrders: 0,
    localTrades: 0,
    missingLocal: [] as string[],
    orphanedLocal: [] as string[],
    synced: 0,
  };

  try {
    const alpacaOrders = await alpaca.getOrders("all", 100);
    result.alpacaOrders = alpacaOrders.length;

    const localTrades = await storage.getTrades(undefined, 100);
    result.localTrades = localTrades.length;

    const alpacaOrderIds = new Set(alpacaOrders.map((o) => o.id));
    const alpacaClientIds = new Set(alpacaOrders.map((o) => o.client_order_id));

    for (const order of alpacaOrders) {
      if (order.status === "filled") {
        const hasLocal = localTrades.some(
          (t) =>
            t.notes?.includes(order.id) ||
            t.notes?.includes(order.client_order_id)
        );

        if (!hasLocal) {
          result.missingLocal.push(order.id);

          await storage.createTrade({
            symbol: order.symbol,
            side: order.side as "buy" | "sell",
            quantity: order.filled_qty,
            price: order.filled_avg_price || "0",
            status: "completed",
            notes: `Synced from Alpaca: ${order.id}`,
            pnl: null,
            strategyId: null,
          });
          result.synced++;
        }
      }
    }

    log.info("Reconciliation", "Order book reconciliation complete", {
      alpacaOrders: result.alpacaOrders,
      localTrades: result.localTrades,
      synced: result.synced,
    });
  } catch (error) {
    log.error("Reconciliation", "Order book reconciliation failed", {
      error: (error as Error).message,
    });
  }

  return result;
}

// ============================================================================
// SHARED ORDER HELPERS (Unified functions for consistent naming)
// ============================================================================

const ORDER_FILL_POLL_INTERVAL_MS =
  tradingConfig.orderExecution.orderFillPollIntervalMs;
const ORDER_FILL_TIMEOUT_MS = tradingConfig.orderExecution.orderFillTimeoutMs;
const STALE_ORDER_TIMEOUT_MS = tradingConfig.orderExecution.staleOrderTimeoutMs;

export interface OrderFillResult {
  order: AlpacaOrder | null;
  timedOut: boolean;
  hasFillData: boolean;
  isFullyFilled: boolean;
}

/**
 * Wait for an Alpaca order to fill with polling and timeout
 * Unified function replacing duplicate implementations
 */
export async function waitForAlpacaOrderFill(
  orderId: string,
  timeoutMs = ORDER_FILL_TIMEOUT_MS
): Promise<OrderFillResult> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const order = await alpaca.getOrder(orderId);
      const filledPrice = safeParseFloat(order.filled_avg_price, 0);
      const filledQty = safeParseFloat(order.filled_qty, 0);
      const hasFillData = filledPrice > 0 && filledQty > 0;

      if (order.status === "filled" && hasFillData) {
        return {
          order,
          timedOut: false,
          hasFillData: true,
          isFullyFilled: true,
        };
      }

      if (isTerminalStatus(order.status)) {
        log.info("OrderFlow", "Order ended with status", {
          orderId,
          status: order.status,
        });
        return { order, timedOut: false, hasFillData, isFullyFilled: false };
      }

      await new Promise((resolve) =>
        setTimeout(resolve, ORDER_FILL_POLL_INTERVAL_MS)
      );
    } catch (error) {
      log.error("OrderFlow", "Error polling order", {
        orderId,
        error: (error as Error).message,
      });
      await new Promise((resolve) =>
        setTimeout(resolve, ORDER_FILL_POLL_INTERVAL_MS)
      );
    }
  }

  log.warn("OrderFlow", "Order fill timeout", { orderId, timeoutMs });
  try {
    const finalOrder = await alpaca.getOrder(orderId);
    const filledPrice = safeParseFloat(finalOrder.filled_avg_price, 0);
    const filledQty = safeParseFloat(finalOrder.filled_qty, 0);
    const hasFillData = filledPrice > 0 && filledQty > 0;
    const isFullyFilled = finalOrder.status === "filled" && hasFillData;
    return { order: finalOrder, timedOut: true, hasFillData, isFullyFilled };
  } catch {
    return {
      order: null,
      timedOut: true,
      hasFillData: false,
      isFullyFilled: false,
    };
  }
}

/**
 * Cancel orders older than the specified timeout
 * Unified function replacing duplicate implementations
 */
export async function cancelExpiredOrders(
  maxAgeMs = STALE_ORDER_TIMEOUT_MS
): Promise<number> {
  let canceledCount = 0;
  try {
    const openOrders = await alpaca.getOrders("open", 100);
    const now = Date.now();

    for (const order of openOrders) {
      const createdAt = new Date(order.created_at).getTime();
      const orderAge = now - createdAt;

      if (orderAge > maxAgeMs) {
        try {
          await alpaca.cancelOrder(order.id);
          canceledCount++;
          log.info("OrderFlow", "Canceled expired order", {
            orderId: order.id,
            symbol: order.symbol,
            ageSec: Math.floor(orderAge / 1000),
          });
        } catch (error) {
          log.warn("OrderFlow", "Failed to cancel expired order", {
            orderId: order.id,
            error: (error as Error).message,
          });
        }
      }
    }

    if (canceledCount > 0) {
      log.info("OrderFlow", "Expired order cancellation complete", {
        canceledCount,
      });
    }
  } catch (error) {
    log.error("OrderFlow", "Error checking for expired orders", {
      error: (error as Error).message,
    });
  }
  return canceledCount;
}
