import {
  alpaca,
  type AlpacaOrder,
  type AlpacaPosition,
  type CreateOrderParams,
} from "../connectors/alpaca";
import { storage } from "../storage";
import { log } from "../utils/logger";
import { alpacaStream, type AlpacaTradeUpdate } from "./alpaca-stream";
import type { InsertOrder } from "@shared/schema";
import { tradingConfig } from "../config/trading-config";
import {
  toDecimal,
  priceWithBuffer,
  calculateWholeShares,
  roundPrice,
} from "../utils/money";

// Type definitions for Alpaca order parameters
export type OrderType =
  | "market"
  | "limit"
  | "stop"
  | "stop_limit"
  | "trailing_stop";
export type TimeInForce = "day" | "gtc" | "opg" | "cls" | "ioc" | "fok";

const VALID_ORDER_TYPES: OrderType[] = [
  "market",
  "limit",
  "stop",
  "stop_limit",
  "trailing_stop",
];
const VALID_TIME_IN_FORCE: TimeInForce[] = [
  "day",
  "gtc",
  "opg",
  "cls",
  "ioc",
  "fok",
];

/**
 * Safely convert string to OrderType with fallback
 */
function toOrderType(
  value: string | undefined,
  fallback: OrderType = "limit"
): OrderType {
  if (value && VALID_ORDER_TYPES.includes(value as OrderType)) {
    return value as OrderType;
  }
  return fallback;
}

/**
 * Safely convert string to TimeInForce with fallback
 */
function toTimeInForce(
  value: string | undefined,
  fallback: TimeInForce = "day"
): TimeInForce {
  if (value && VALID_TIME_IN_FORCE.includes(value as TimeInForce)) {
    return value as TimeInForce;
  }
  return fallback;
}

// Re-export AlpacaTradeUpdate for external consumers
export type { AlpacaTradeUpdate };

/**
 * Order Rejection Feedback Loop System
 *
 * Automatically detects rejected/canceled orders via Alpaca websocket,
 * analyzes rejection reasons, applies appropriate fixes, and retries
 * with corrected parameters.
 */

export interface RejectionPattern {
  pattern: RegExp;
  category: RejectionCategory;
  description: string;
}

export type RejectionCategory =
  | "market_hours"
  | "order_type"
  | "price_validation"
  | "insufficient_funds"
  | "position_limits"
  | "regulatory"
  | "symbol_invalid"
  | "unknown";

export interface FixedOrderParams {
  params: CreateOrderParams;
  explanation: string;
  confidence: "high" | "medium" | "low";
}

export interface RejectionHandler {
  pattern: RegExp;
  fix: (
    order: AlpacaTradeUpdate,
    reason: string
  ) => Promise<FixedOrderParams | null>;
  category: RejectionCategory;
  description: string;
}

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: Date;
  reason: string;
  fix: string;
  success: boolean;
  error?: string;
}

export interface RetryResult {
  success: boolean;
  originalOrderId: string;
  newOrderId?: string;
  attempts: RetryAttempt[];
  finalStatus:
    | "retried_successfully"
    | "max_retries_exceeded"
    | "permanent_failure"
    | "no_fix_available";
  error?: string;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailureTime: Date | null;
  isOpen: boolean;
  resetTime: Date | null;
}

// Configuration
const MAX_RETRIES_PER_ORDER = tradingConfig.orderRetry.maxRetriesPerOrder;
const RETRY_BACKOFF_BASE_MS = tradingConfig.orderRetry.retryBackoffBaseMs;
const CIRCUIT_BREAKER_THRESHOLD =
  tradingConfig.orderRetry.circuitBreakerThreshold;
const CIRCUIT_BREAKER_WINDOW_MS =
  tradingConfig.orderRetry.circuitBreakerWindowMs;
const CIRCUIT_BREAKER_RESET_MS = tradingConfig.orderRetry.circuitBreakerResetMs;

// Global retry tracking
const retryTracker = new Map<string, RetryAttempt[]>();
const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailureTime: null,
  isOpen: false,
  resetTime: null,
};

/**
 * Core rejection patterns with automated fixes
 */
const rejectionHandlers: RejectionHandler[] = [
  // Market Hours Issues
  {
    pattern: /market.*(?:closed|extended|hours)/i,
    category: "market_hours",
    description: "Market order rejected during extended hours",
    fix: async (order, reason) => {
      // Extended hours requires limit orders
      const currentPrice = await getCurrentPrice(order.order.symbol);
      if (!currentPrice) return null;

      // Use Decimal.js for precise limit price buffer calculation (0.5%)
      const direction = order.order.side === "buy" ? 1 : -1;
      const limitPrice = roundPrice(
        priceWithBuffer(currentPrice, 0.005, direction as 1 | -1),
        2
      ).toNumber();

      return {
        params: {
          symbol: order.order.symbol,
          side: order.order.side as "buy" | "sell",
          qty: order.order.qty,
          type: "limit",
          time_in_force: "day",
          limit_price: limitPrice.toFixed(2),
          extended_hours: true,
        },
        explanation: `Converted market order to limit order at $${limitPrice.toFixed(2)} for extended hours trading`,
        confidence: "high",
      };
    },
  },

  {
    pattern: /day.*(?:trading|closed)/i,
    category: "market_hours",
    description: "Day order attempted when market closed",
    fix: async (order, reason) => {
      // Convert to GTC limit order
      const currentPrice = await getCurrentPrice(order.order.symbol);
      if (!currentPrice) return null;

      // Use Decimal.js for precise limit price buffer calculation (0.5%)
      const direction = order.order.side === "buy" ? 1 : -1;
      const limitPrice = roundPrice(
        priceWithBuffer(currentPrice, 0.005, direction as 1 | -1),
        2
      ).toNumber();

      return {
        params: {
          symbol: order.order.symbol,
          side: order.order.side as "buy" | "sell",
          qty: order.order.qty,
          type: "limit",
          time_in_force: "gtc",
          limit_price: limitPrice.toFixed(2),
        },
        explanation: `Converted to GTC limit order at $${limitPrice.toFixed(2)} to execute when market opens`,
        confidence: "high",
      };
    },
  },

  // Price Validation Issues
  {
    pattern: /price.*(?:aggressive|outside|collar|range)/i,
    category: "price_validation",
    description: "Limit price too aggressive or outside allowed range",
    fix: async (order, reason) => {
      const currentPrice = await getCurrentPrice(order.order.symbol);
      if (!currentPrice) return null;

      // Use Decimal.js for precise limit price buffer calculation (0.5%)
      const direction = order.order.side === "buy" ? 1 : -1;
      const limitPrice = roundPrice(
        priceWithBuffer(currentPrice, 0.005, direction as 1 | -1),
        2
      ).toNumber();

      return {
        params: {
          symbol: order.order.symbol,
          side: order.order.side as "buy" | "sell",
          qty: order.order.qty,
          type: "limit",
          time_in_force: toTimeInForce(order.order.time_in_force),
          limit_price: limitPrice.toFixed(2),
        },
        explanation: `Adjusted limit price to $${limitPrice.toFixed(2)} (0.5% from market) to meet broker requirements`,
        confidence: "high",
      };
    },
  },

  {
    pattern: /notional.*(?:below|minimum|threshold)/i,
    category: "price_validation",
    description: "Order value too small",
    fix: async (order, reason) => {
      const currentPrice = await getCurrentPrice(order.order.symbol);
      if (!currentPrice) return null;

      // Use Decimal.js for precise minimum notional quantity calculation
      // Alpaca minimum is usually $1, increase to $5 minimum
      const minNotional = 5;
      const requiredQty = toDecimal(minNotional)
        .dividedBy(currentPrice)
        .ceil()
        .toNumber();

      return {
        params: {
          symbol: order.order.symbol,
          side: order.order.side as "buy" | "sell",
          qty: requiredQty.toString(),
          type: toOrderType(order.order.type),
          time_in_force: toTimeInForce(order.order.time_in_force),
          limit_price: order.order.limit_price || undefined,
        },
        explanation: `Increased quantity to ${requiredQty} shares to meet minimum order value ($${minNotional})`,
        confidence: "medium",
      };
    },
  },

  // Insufficient Funds
  {
    pattern: /insufficient.*(?:buying|funds|balance|capital)/i,
    category: "insufficient_funds",
    description: "Not enough buying power",
    fix: async (order, reason) => {
      const account = await alpaca.getAccount();
      const buyingPower = toDecimal(account.buying_power);
      const currentPrice = await getCurrentPrice(order.order.symbol);

      if (!currentPrice || buyingPower.lessThanOrEqualTo(0)) return null;

      // Use Decimal.js for precise affordability calculation (95% of buying power)
      const affordableValue = buyingPower.times(0.95);
      const affordableQty = calculateWholeShares(
        affordableValue,
        currentPrice
      ).toNumber();

      if (affordableQty < 1) {
        return null; // Cannot afford even 1 share
      }

      return {
        params: {
          symbol: order.order.symbol,
          side: order.order.side as "buy" | "sell",
          qty: affordableQty.toString(),
          type: toOrderType(order.order.type),
          time_in_force: toTimeInForce(order.order.time_in_force),
          limit_price: order.order.limit_price || undefined,
        },
        explanation: `Reduced quantity to ${affordableQty} shares to fit within buying power ($${buyingPower.toFixed(2)})`,
        confidence: "high",
      };
    },
  },

  // Position Limits
  {
    pattern: /(?:max|maximum).*positions/i,
    category: "position_limits",
    description: "Maximum position count exceeded",
    fix: async (order, reason) => {
      // Cannot auto-fix, need manual intervention to close positions
      log.warn(
        "OrderRetry",
        `Max positions limit - manual intervention required for ${order.order.symbol}`
      );
      return null;
    },
  },

  // Fractional Shares Issues
  {
    pattern: /fractional.*(?:not.*supported|shares)/i,
    category: "order_type",
    description: "Fractional shares not allowed",
    fix: async (order, reason) => {
      const qty = parseFloat(order.order.qty);
      const wholeShares = Math.floor(qty);

      if (wholeShares < 1) {
        return null; // Need at least 1 whole share
      }

      return {
        params: {
          symbol: order.order.symbol,
          side: order.order.side as "buy" | "sell",
          qty: wholeShares.toString(),
          type: toOrderType(order.order.type),
          time_in_force: toTimeInForce(order.order.time_in_force),
          limit_price: order.order.limit_price || undefined,
          extended_hours: order.order.extended_hours,
        },
        explanation: `Rounded down to ${wholeShares} whole shares (fractional not supported for this symbol)`,
        confidence: "high",
      };
    },
  },

  // Order Type Issues
  {
    pattern: /(?:gtc|time.*force).*(?:not.*supported|invalid)/i,
    category: "order_type",
    description: "Time-in-force not supported",
    fix: async (order, reason) => {
      return {
        params: {
          symbol: order.order.symbol,
          side: order.order.side as "buy" | "sell",
          qty: order.order.qty,
          type: toOrderType(order.order.type),
          time_in_force: "day", // Safest default
          limit_price: order.order.limit_price || undefined,
          stop_price: order.order.stop_price || undefined,
        },
        explanation: `Changed time-in-force to 'day' (most compatible option)`,
        confidence: "high",
      };
    },
  },

  {
    pattern: /market.*order.*(?:not.*allowed|invalid)/i,
    category: "order_type",
    description: "Market orders not allowed",
    fix: async (order, reason) => {
      const currentPrice = await getCurrentPrice(order.order.symbol);
      if (!currentPrice) return null;

      const buffer = order.order.side === "buy" ? 1.01 : 0.99;
      const limitPrice = Math.round(currentPrice * buffer * 100) / 100;

      return {
        params: {
          symbol: order.order.symbol,
          side: order.order.side as "buy" | "sell",
          qty: order.order.qty,
          type: "limit",
          time_in_force: "day",
          limit_price: limitPrice.toFixed(2),
        },
        explanation: `Converted to limit order at $${limitPrice.toFixed(2)} (1% buffer from market)`,
        confidence: "high",
      };
    },
  },

  // Bracket Order Issues
  {
    pattern: /bracket.*(?:not.*supported|invalid)/i,
    category: "order_type",
    description: "Bracket orders not supported",
    fix: async (order, reason) => {
      // Convert to simple order without bracket legs
      return {
        params: {
          symbol: order.order.symbol,
          side: order.order.side as "buy" | "sell",
          qty: order.order.qty,
          type: toOrderType(order.order.type),
          time_in_force: toTimeInForce(order.order.time_in_force),
          limit_price: order.order.limit_price || undefined,
          order_class: "simple", // Remove bracket
        },
        explanation: `Converted to simple order (bracket orders not supported for this symbol/session)`,
        confidence: "medium",
      };
    },
  },

  // Symbol Issues
  {
    pattern: /symbol.*(?:not.*found|invalid|unknown)/i,
    category: "symbol_invalid",
    description: "Symbol not found or invalid",
    fix: async (order, reason) => {
      // Cannot auto-fix invalid symbols
      log.error(
        "OrderRetry",
        `Invalid symbol ${order.order.symbol} - cannot retry`
      );
      return null;
    },
  },

  // Regulatory/Account Issues
  {
    pattern: /pattern.*day.*trad(?:er|ing)/i,
    category: "regulatory",
    description: "Pattern day trader restriction",
    fix: async (order, reason) => {
      // Cannot bypass PDT rule
      log.warn(
        "OrderRetry",
        `PDT restriction for ${order.order.symbol} - cannot retry`
      );
      return null;
    },
  },

  {
    pattern: /account.*(?:blocked|suspended|restricted)/i,
    category: "regulatory",
    description: "Account restricted",
    fix: async (order, reason) => {
      log.error("OrderRetry", `Account restricted - cannot retry orders`);
      return null;
    },
  },

  // Short Sale Issues
  {
    pattern: /short.*(?:not.*available|restricted|locate)/i,
    category: "position_limits",
    description: "Short selling not available",
    fix: async (order, reason) => {
      if (order.order.side === "sell") {
        log.warn(
          "OrderRetry",
          `Short selling restricted for ${order.order.symbol} - cannot retry`
        );
        return null;
      }
      return null;
    },
  },

  // Wash Trade Prevention
  {
    pattern: /wash.*trade/i,
    category: "regulatory",
    description: "Potential wash trade detected",
    fix: async (order, reason) => {
      // Cannot bypass wash trade rules - delay needed
      log.warn(
        "OrderRetry",
        `Wash trade rule for ${order.order.symbol} - delaying retry`
      );
      await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 second delay

      return {
        params: {
          symbol: order.order.symbol,
          side: order.order.side as "buy" | "sell",
          qty: order.order.qty,
          type: toOrderType(order.order.type),
          time_in_force: toTimeInForce(order.order.time_in_force),
          limit_price: order.order.limit_price || undefined,
        },
        explanation: `Delayed retry by 30 seconds to avoid wash trade rule`,
        confidence: "low",
      };
    },
  },

  // Order Canceled (generic - often due to market session issues)
  {
    pattern: /order.*cancel/i,
    category: "market_hours",
    description: "Order canceled by broker (usually session-related)",
    fix: async (order, reason) => {
      // Check current market session to determine order type
      const { tradingSessionManager } =
        await import("../services/trading-session-manager");
      const sessionInfo =
        tradingSessionManager.getCurrentSession("US_EQUITIES");
      const isRegularHours =
        sessionInfo.session === "regular" && sessionInfo.isOpen;
      const isExtendedHours =
        sessionInfo.session === "pre_market" ||
        sessionInfo.session === "after_hours";

      // During regular hours: use MARKET orders for immediate execution
      if (isRegularHours) {
        // Preserve qty OR notional from original order
        if (order.order.qty) {
          return {
            params: {
              symbol: order.order.symbol,
              side: order.order.side as "buy" | "sell",
              qty: order.order.qty,
              type: "market",
              time_in_force: "day",
            },
            explanation: `Retrying as MARKET order during regular hours (qty=${order.order.qty})`,
            confidence: "high",
          };
        }
        if (order.order.notional) {
          return {
            params: {
              symbol: order.order.symbol,
              side: order.order.side as "buy" | "sell",
              notional: order.order.notional,
              type: "market",
              time_in_force: "day",
            },
            explanation: `Retrying as MARKET order during regular hours (notional=${order.order.notional})`,
            confidence: "high",
          };
        }
      }

      // During extended hours or closed: use LIMIT orders
      const currentPrice = await getCurrentPrice(order.order.symbol);
      if (!currentPrice) return null;

      // Use buffer for limit price
      const buffer = order.order.side === "buy" ? 1.01 : 0.99;
      const limitPrice = Math.round(currentPrice * buffer * 100) / 100;

      // Preserve qty OR notional from original order
      if (order.order.qty) {
        return {
          params: {
            symbol: order.order.symbol,
            side: order.order.side as "buy" | "sell",
            qty: order.order.qty,
            type: "limit",
            time_in_force: "day",
            limit_price: limitPrice.toFixed(2),
            extended_hours: isExtendedHours,
          },
          explanation: `Converted to limit order at $${limitPrice.toFixed(2)} (extended_hours=${isExtendedHours}, qty=${order.order.qty})`,
          confidence: "medium",
        };
      }

      if (order.order.notional) {
        // For notional orders during extended hours, convert to qty (fractional not allowed)
        const estimatedQty = Math.floor(
          parseFloat(order.order.notional) / currentPrice
        );
        if (estimatedQty < 1) {
          log.warn(
            "OrderRetry",
            `Notional ${order.order.notional} too small for whole shares at $${currentPrice}`
          );
          return null;
        }
        return {
          params: {
            symbol: order.order.symbol,
            side: order.order.side as "buy" | "sell",
            qty: estimatedQty.toString(),
            type: "limit",
            time_in_force: "day",
            limit_price: limitPrice.toFixed(2),
            extended_hours: isExtendedHours,
          },
          explanation: `Converted notional=${order.order.notional} to qty=${estimatedQty} limit order at $${limitPrice.toFixed(2)} (extended_hours=${isExtendedHours})`,
          confidence: "medium",
        };
      }

      // Fallback: no qty or notional
      log.warn(
        "OrderRetry",
        `Order ${order.order.symbol} has no qty or notional - cannot retry`
      );
      return null;
    },
  },

  // Missing qty or notional (validation error)
  {
    pattern: /qty.*(?:or|and).*notional.*required/i,
    category: "order_type",
    description: "Order missing qty or notional parameter",
    fix: async (order, reason) => {
      // If the original order has qty, use it; otherwise fetch position or calculate from notional
      if (order.order.qty) {
        return {
          params: {
            symbol: order.order.symbol,
            side: order.order.side as "buy" | "sell",
            qty: order.order.qty,
            type: toOrderType(order.order.type || "limit"),
            time_in_force: toTimeInForce(order.order.time_in_force || "day"),
            limit_price: order.order.limit_price || undefined,
            extended_hours: order.order.extended_hours,
          },
          explanation: `Retried with explicit qty=${order.order.qty}`,
          confidence: "high",
        };
      }

      if (order.order.notional) {
        return {
          params: {
            symbol: order.order.symbol,
            side: order.order.side as "buy" | "sell",
            notional: order.order.notional,
            type: toOrderType(order.order.type || "limit"),
            time_in_force: toTimeInForce(order.order.time_in_force || "day"),
            limit_price: order.order.limit_price || undefined,
            extended_hours: order.order.extended_hours,
          },
          explanation: `Retried with explicit notional=${order.order.notional}`,
          confidence: "high",
        };
      }

      // Fallback: For sell orders, get position qty; for buy orders, use minimum
      if (order.order.side === "sell") {
        try {
          const positions = await alpaca.getPositions();
          const position = positions.find(
            (p: AlpacaPosition) => p.symbol === order.order.symbol
          );
          if (position) {
            const availableQty = Math.floor(
              parseFloat(position.qty_available || position.qty || "0")
            );
            if (availableQty >= 1) {
              return {
                params: {
                  symbol: order.order.symbol,
                  side: "sell",
                  qty: availableQty.toString(),
                  type: toOrderType(order.order.type || "limit"),
                  time_in_force: toTimeInForce(
                    order.order.time_in_force || "day"
                  ),
                  limit_price: order.order.limit_price || undefined,
                  extended_hours: order.order.extended_hours,
                },
                explanation: `Sell order: Using available position qty=${availableQty}`,
                confidence: "medium",
              };
            }
          }
        } catch (e) {
          log.warn(
            "OrderRetry",
            `Failed to get position for ${order.order.symbol}`
          );
        }
      }

      // For buy orders, calculate from limit price or use minimum notional
      const currentPrice = await getCurrentPrice(order.order.symbol);
      if (currentPrice) {
        const minNotional = 10; // $10 minimum
        return {
          params: {
            symbol: order.order.symbol,
            side: order.order.side as "buy" | "sell",
            notional: minNotional.toString(),
            type: toOrderType(order.order.type || "limit"),
            time_in_force: toTimeInForce(order.order.time_in_force || "day"),
            limit_price: order.order.limit_price || undefined,
            extended_hours: order.order.extended_hours,
          },
          explanation: `Using minimum notional=$${minNotional} as fallback`,
          confidence: "low",
        };
      }

      return null;
    },
  },

  // Insufficient Quantity Available (position mismatch)
  {
    pattern: /insufficient.*qty.*available/i,
    category: "position_limits",
    description: "Requested quantity exceeds available shares",
    fix: async (order, reason) => {
      // Get actual position from Alpaca
      try {
        const positions = await alpaca.getPositions();
        const position = positions.find(
          (p: AlpacaPosition) => p.symbol === order.order.symbol
        );

        if (!position) {
          log.warn(
            "OrderRetry",
            `No position found for ${order.order.symbol} - cannot retry sell`
          );
          return null;
        }

        const availableQty = parseFloat(
          position.qty_available || position.qty || "0"
        );
        const wholeQty = Math.floor(availableQty);

        if (wholeQty < 1) {
          log.warn(
            "OrderRetry",
            `No whole shares available for ${order.order.symbol} (${availableQty} available)`
          );
          return null;
        }

        return {
          params: {
            symbol: order.order.symbol,
            side: order.order.side as "buy" | "sell",
            qty: wholeQty.toString(),
            type: toOrderType(order.order.type),
            time_in_force: toTimeInForce(order.order.time_in_force),
            limit_price: order.order.limit_price || undefined,
            extended_hours: order.order.extended_hours,
          },
          explanation: `Reduced quantity to ${wholeQty} shares (actual available from position)`,
          confidence: "high",
        };
      } catch (error) {
        log.error(
          "OrderRetry",
          `Failed to get position for ${order.order.symbol}`,
          { error }
        );
        return null;
      }
    },
  },
];

/**
 * Get current market price for a symbol
 */
async function getCurrentPrice(symbol: string): Promise<number | null> {
  try {
    const snapshot = await alpaca.getSnapshots([symbol]);
    const data = snapshot[symbol];
    if (!data) return null;

    return (
      data.latestTrade?.p || data.latestQuote?.ap || data.dailyBar?.c || null
    );
  } catch (error) {
    log.error("OrderRetry", `Failed to get price for ${symbol}`, { error });
    return null;
  }
}

/**
 * Extract rejection reason from various sources
 */
function extractRejectionReason(update: AlpacaTradeUpdate): string {
  // Check order status and timestamps
  if (update.order.status === "rejected" || update.order.failed_at) {
    // Alpaca doesn't always provide explicit rejection reasons in websocket
    // We need to infer from order type, time_in_force, etc.
    const reasons: string[] = [];

    if (update.order.extended_hours && update.order.type === "market") {
      reasons.push("market orders not allowed during extended hours");
    }

    if (update.order.order_class === "bracket" && update.order.extended_hours) {
      reasons.push("bracket orders not supported during extended hours");
    }

    // Generic rejection
    if (reasons.length === 0) {
      reasons.push("order rejected by broker");
    }

    return reasons.join("; ");
  }

  if (update.order.status === "canceled" || update.order.canceled_at) {
    return "order canceled";
  }

  return "unknown rejection reason";
}

/**
 * Find matching rejection handler for the given reason
 */
function findHandler(reason: string): RejectionHandler | null {
  for (const handler of rejectionHandlers) {
    if (handler.pattern.test(reason)) {
      return handler;
    }
  }
  return null;
}

/**
 * Check if circuit breaker is open
 */
function checkCircuitBreaker(): boolean {
  const now = Date.now();

  // Reset if enough time has passed
  if (circuitBreaker.resetTime && now >= circuitBreaker.resetTime.getTime()) {
    circuitBreaker.failures = 0;
    circuitBreaker.isOpen = false;
    circuitBreaker.resetTime = null;
    circuitBreaker.lastFailureTime = null;
    log.info("OrderRetry", "Circuit breaker reset");
  }

  // Check if we're within failure window
  if (circuitBreaker.lastFailureTime) {
    const timeSinceLastFailure = now - circuitBreaker.lastFailureTime.getTime();
    if (timeSinceLastFailure > CIRCUIT_BREAKER_WINDOW_MS) {
      // Outside window, reset counter
      circuitBreaker.failures = 0;
    }
  }

  return circuitBreaker.isOpen;
}

/**
 * Record a retry failure
 */
function recordFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailureTime = new Date();

  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.isOpen = true;
    circuitBreaker.resetTime = new Date(Date.now() + CIRCUIT_BREAKER_RESET_MS);
    log.error(
      "OrderRetry",
      `Circuit breaker OPENED after ${circuitBreaker.failures} failures. Will reset at ${circuitBreaker.resetTime.toISOString()}`
    );
  }
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attemptNumber: number): number {
  return RETRY_BACKOFF_BASE_MS * Math.pow(2, attemptNumber - 1);
}

/**
 * Main retry handler - processes rejected/canceled orders
 */
export async function handleOrderRejection(
  update: AlpacaTradeUpdate,
  reason?: string
): Promise<RetryResult> {
  const orderId = update.order.id;
  const symbol = update.order.symbol;

  // Extract or use provided reason
  const rejectionReason = reason || extractRejectionReason(update);

  log.warn(
    "OrderRetry",
    `Order ${orderId} for ${symbol} ${update.order.status}`,
    {
      reason: rejectionReason,
      orderType: update.order.type,
      timeInForce: update.order.time_in_force,
    }
  );

  // Initialize retry tracking
  if (!retryTracker.has(orderId)) {
    retryTracker.set(orderId, []);
  }
  const attempts = retryTracker.get(orderId)!;

  // Check retry limit
  if (attempts.length >= MAX_RETRIES_PER_ORDER) {
    log.error(
      "OrderRetry",
      `Max retries (${MAX_RETRIES_PER_ORDER}) exceeded for order ${orderId}`
    );
    return {
      success: false,
      originalOrderId: orderId,
      attempts,
      finalStatus: "max_retries_exceeded",
      error: `Exceeded maximum retry attempts (${MAX_RETRIES_PER_ORDER})`,
    };
  }

  // Check circuit breaker
  if (checkCircuitBreaker()) {
    log.error(
      "OrderRetry",
      `Circuit breaker is OPEN - rejecting retry for ${orderId}`
    );
    return {
      success: false,
      originalOrderId: orderId,
      attempts,
      finalStatus: "permanent_failure",
      error: "Circuit breaker is open - too many failures recently",
    };
  }

  // Find matching handler
  const handler = findHandler(rejectionReason);
  if (!handler) {
    log.warn(
      "OrderRetry",
      `No handler found for rejection reason: ${rejectionReason}`
    );
    return {
      success: false,
      originalOrderId: orderId,
      attempts,
      finalStatus: "no_fix_available",
      error: `No automated fix available for: ${rejectionReason}`,
    };
  }

  log.info(
    "OrderRetry",
    `Found handler: ${handler.description} (${handler.category})`
  );

  // Apply fix
  let fixedParams: FixedOrderParams | null;
  try {
    fixedParams = await handler.fix(update, rejectionReason);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("OrderRetry", `Fix function failed for ${orderId}`, {
      error: errorMsg,
    });
    recordFailure();

    const attempt: RetryAttempt = {
      attemptNumber: attempts.length + 1,
      timestamp: new Date(),
      reason: rejectionReason,
      fix: handler.description,
      success: false,
      error: `Fix function error: ${errorMsg}`,
    };
    attempts.push(attempt);

    return {
      success: false,
      originalOrderId: orderId,
      attempts,
      finalStatus: "permanent_failure",
      error: errorMsg,
    };
  }

  if (!fixedParams) {
    log.warn("OrderRetry", `Handler could not generate fix for ${orderId}`);
    return {
      success: false,
      originalOrderId: orderId,
      attempts,
      finalStatus: "no_fix_available",
      error: `Handler could not generate fix: ${handler.description}`,
    };
  }

  // Apply exponential backoff
  const backoffMs = calculateBackoff(attempts.length + 1);
  log.info(
    "OrderRetry",
    `Waiting ${backoffMs}ms before retry (attempt ${attempts.length + 1}/${MAX_RETRIES_PER_ORDER})`
  );
  await new Promise((resolve) => setTimeout(resolve, backoffMs));

  // Generate new client order ID to avoid duplicates
  const newClientOrderId = `retry-${orderId}-${attempts.length + 1}-${Date.now()}`;
  fixedParams.params.client_order_id = newClientOrderId;

  // Submit retry
  log.info(
    "OrderRetry",
    `Retrying order ${orderId} with fix: ${fixedParams.explanation}`
  );

  try {
    const newOrder = await alpaca.createOrder(fixedParams.params);

    log.info(
      "OrderRetry",
      `Retry successful! New order ${newOrder.id} created for ${symbol}`,
      {
        status: newOrder.status,
        fix: fixedParams.explanation,
      }
    );

    // Record successful attempt
    const attempt: RetryAttempt = {
      attemptNumber: attempts.length + 1,
      timestamp: new Date(),
      reason: rejectionReason,
      fix: fixedParams.explanation,
      success: true,
    };
    attempts.push(attempt);

    // Store in database
    await storage.upsertOrderByBrokerOrderId(newOrder.id, {
      broker: "alpaca",
      brokerOrderId: newOrder.id,
      clientOrderId: newClientOrderId,
      symbol: newOrder.symbol,
      side: newOrder.side,
      type: newOrder.type,
      timeInForce: newOrder.time_in_force,
      qty: newOrder.qty,
      notional: newOrder.notional,
      limitPrice: newOrder.limit_price,
      stopPrice: newOrder.stop_price,
      status: newOrder.status,
      submittedAt: new Date(newOrder.submitted_at || Date.now()),
      updatedAt: new Date(),
      filledQty: newOrder.filled_qty,
      filledAvgPrice: newOrder.filled_avg_price,
      traceId: `retry-${orderId}`,
      rawJson: {
        ...newOrder,
        retryMetadata: {
          originalOrderId: orderId,
          attemptNumber: attempts.length,
          rejectionReason,
          fix: fixedParams.explanation,
        },
      },
    });

    return {
      success: true,
      originalOrderId: orderId,
      newOrderId: newOrder.id,
      attempts,
      finalStatus: "retried_successfully",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error("OrderRetry", `Retry failed for ${orderId}`, { error: errorMsg });
    recordFailure();

    const attempt: RetryAttempt = {
      attemptNumber: attempts.length + 1,
      timestamp: new Date(),
      reason: rejectionReason,
      fix: fixedParams.explanation,
      success: false,
      error: errorMsg,
    };
    attempts.push(attempt);

    // If we have retries left, recursively retry
    if (attempts.length < MAX_RETRIES_PER_ORDER) {
      log.info(
        "OrderRetry",
        `Retry failed, will attempt again (${attempts.length}/${MAX_RETRIES_PER_ORDER})`
      );
      return handleOrderRejection(update, errorMsg);
    }

    return {
      success: false,
      originalOrderId: orderId,
      attempts,
      finalStatus: "max_retries_exceeded",
      error: errorMsg,
    };
  }
}

/**
 * Register a custom rejection handler
 */
export function registerRejectionHandler(handler: RejectionHandler): void {
  rejectionHandlers.push(handler);
  log.info(
    "OrderRetry",
    `Registered custom handler: ${handler.description} (${handler.category})`
  );
}

/**
 * Get retry statistics
 */
export function getRetryStats(): {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  circuitBreakerState: CircuitBreakerState;
  activeRetries: number;
} {
  let totalRetries = 0;
  let successfulRetries = 0;
  let failedRetries = 0;

  retryTracker.forEach((attempts) => {
    totalRetries += attempts.length;
    successfulRetries += attempts.filter((a) => a.success).length;
    failedRetries += attempts.filter((a) => !a.success).length;
  });

  return {
    totalRetries,
    successfulRetries,
    failedRetries,
    circuitBreakerState: { ...circuitBreaker },
    activeRetries: retryTracker.size,
  };
}

/**
 * Clear retry history for an order
 */
export function clearRetryHistory(orderId: string): void {
  retryTracker.delete(orderId);
}

/**
 * Reset circuit breaker manually
 */
export function resetCircuitBreaker(): void {
  circuitBreaker.failures = 0;
  circuitBreaker.lastFailureTime = null;
  circuitBreaker.isOpen = false;
  circuitBreaker.resetTime = null;
  log.info("OrderRetry", "Circuit breaker manually reset");
}

/**
 * Get all registered handlers
 */
export function getRegisteredHandlers(): RejectionHandler[] {
  return [...rejectionHandlers];
}

/**
 * Test a rejection reason against handlers
 */
export function testRejectionReason(reason: string): {
  matched: boolean;
  handler?: RejectionHandler;
  category?: RejectionCategory;
} {
  const handler = findHandler(reason);
  if (handler) {
    return {
      matched: true,
      handler,
      category: handler.category,
    };
  }
  return { matched: false };
}

// Auto-hook into Alpaca stream if not already hooked
// This would need to be integrated into the alpaca-stream.ts handleTradeUpdate method
// For now, export a hook function that can be called from there
export function hookIntoTradeUpdates(update: AlpacaTradeUpdate): void {
  const status = update.order.status;

  // Only handle rejected and canceled orders
  if (status === "rejected" || status === "canceled") {
    // Process asynchronously to not block the stream
    handleOrderRejection(update).catch((error) => {
      log.error("OrderRetry", "Unhandled error in rejection handler", {
        error,
      });
    });
  }
}

log.info(
  "OrderRetry",
  `Order Retry Handler initialized with ${rejectionHandlers.length} handlers`
);
