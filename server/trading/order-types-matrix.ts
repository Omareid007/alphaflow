/**
 * EXHAUSTIVE ORDER TYPE MATRIX FOR ALPACA TRADING
 *
 * This file documents all valid order type combinations supported by Alpaca API
 * and provides validation schemas and execution handlers for each.
 */

import { z } from "zod";

// ============================================================================
// ORDER TYPE DEFINITIONS
// ============================================================================

/**
 * Base Order Types:
 * - market: Execute at current market price
 * - limit: Execute at specified price or better
 * - stop: Trigger market order when stop price is reached
 * - stop_limit: Trigger limit order when stop price is reached
 * - trailing_stop: Dynamic stop that follows price movement
 */
export const OrderTypeEnum = z.enum([
  "market",
  "limit",
  "stop",
  "stop_limit",
  "trailing_stop",
]);

/**
 * Order Classes:
 * - simple: Single-leg order (default)
 * - bracket: Entry + take-profit + stop-loss (3 legs)
 * - oco: One-cancels-other (2 legs)
 * - oto: One-triggers-other (2 legs)
 */
export const OrderClassEnum = z.enum(["simple", "bracket", "oco", "oto"]);

/**
 * Time in Force options:
 * - day: Valid for trading day only (9:30 AM - 4:00 PM ET)
 * - gtc: Good til canceled (up to 90 days)
 * - opg: Execute at market open only
 * - cls: Execute at market close only
 * - ioc: Immediate or cancel (fill immediately or cancel)
 * - fok: Fill or kill (fill entire order or cancel)
 * - gtd: Good til date (requires specific date - rarely used)
 */
export const TimeInForceEnum = z.enum([
  "day",
  "gtc",
  "opg",
  "cls",
  "ioc",
  "fok",
]);

/**
 * Order Side
 */
export const OrderSideEnum = z.enum(["buy", "sell"]);

// ============================================================================
// VALID COMBINATION MATRIX
// ============================================================================

/**
 * VALID ORDER TYPE + TIME IN FORCE COMBINATIONS
 *
 * Order Type      | day | gtc | opg | cls | ioc | fok | Extended Hours
 * ----------------|-----|-----|-----|-----|-----|-----|----------------
 * market          |  ✓  |  ✗  |  ✓  |  ✓  |  ✓  |  ✓  |      ✗
 * limit           |  ✓  |  ✓  |  ✓  |  ✓  |  ✓  |  ✓  |      ✓
 * stop            |  ✓  |  ✓  |  ✗  |  ✗  |  ✗  |  ✗  |      ✗
 * stop_limit      |  ✓  |  ✓  |  ✗  |  ✗  |  ✗  |  ✗  |      ✓
 * trailing_stop   |  ✓  |  ✓  |  ✗  |  ✗  |  ✗  |  ✗  |      ✗
 *
 * Notes:
 * - Market orders cannot be GTC (must specify day, ioc, fok, opg, or cls)
 * - Extended hours only works with limit and stop_limit orders
 * - Stop orders require stop_price
 * - Stop_limit requires both stop_price and limit_price
 * - Trailing_stop requires either trail_percent OR trail_price (not both)
 */

export interface OrderTypeCombination {
  orderType: z.infer<typeof OrderTypeEnum>;
  validTimeInForce: z.infer<typeof TimeInForceEnum>[];
  supportsExtendedHours: boolean;
  requiredFields: string[];
  optionalFields: string[];
  description: string;
}

export const ORDER_TYPE_MATRIX: OrderTypeCombination[] = [
  {
    orderType: "market",
    validTimeInForce: ["day", "opg", "cls", "ioc", "fok"],
    supportsExtendedHours: false,
    requiredFields: ["symbol", "side", "qty|notional"],
    optionalFields: ["client_order_id"],
    description: "Execute immediately at best available price",
  },
  {
    orderType: "limit",
    validTimeInForce: ["day", "gtc", "opg", "cls", "ioc", "fok"],
    supportsExtendedHours: true,
    requiredFields: ["symbol", "side", "qty|notional", "limit_price"],
    optionalFields: ["client_order_id", "extended_hours"],
    description: "Execute at specified price or better",
  },
  {
    orderType: "stop",
    validTimeInForce: ["day", "gtc"],
    supportsExtendedHours: false,
    requiredFields: ["symbol", "side", "qty", "stop_price"],
    optionalFields: ["client_order_id"],
    description: "Trigger market order when stop price is reached",
  },
  {
    orderType: "stop_limit",
    validTimeInForce: ["day", "gtc"],
    supportsExtendedHours: true,
    requiredFields: ["symbol", "side", "qty", "stop_price", "limit_price"],
    optionalFields: ["client_order_id", "extended_hours"],
    description: "Trigger limit order when stop price is reached",
  },
  {
    orderType: "trailing_stop",
    validTimeInForce: ["day", "gtc"],
    supportsExtendedHours: false,
    requiredFields: ["symbol", "side", "qty", "trail_percent|trail_price"],
    optionalFields: ["client_order_id"],
    description: "Dynamic stop that follows price movement",
  },
];

// ============================================================================
// ORDER CLASS COMBINATIONS
// ============================================================================

/**
 * BRACKET ORDERS (order_class: "bracket")
 *
 * A bracket order is a set of 3 orders:
 * 1. Entry order (market or limit)
 * 2. Take-profit (limit order)
 * 3. Stop-loss (stop or stop-limit order)
 *
 * When the entry fills:
 * - Both exit orders become active
 * - When one exit fills, the other is canceled
 *
 * Valid combinations:
 * - Entry: market/limit + take_profit (limit_price) + stop_loss (stop_price + optional limit_price)
 */
export interface BracketOrderConfig {
  entryType: "market" | "limit";
  timeInForce: "day" | "gtc";
  takeProfitLimitPrice: string;
  stopLossStopPrice: string;
  stopLossLimitPrice?: string; // If provided, creates stop-limit for stop-loss leg
}

/**
 * OCO ORDERS (order_class: "oco")
 *
 * One-Cancels-Other: Two orders where filling one cancels the other
 *
 * Must have exactly 2 legs:
 * - One limit order
 * - One stop or stop-limit order
 *
 * Used for: Setting both take-profit and stop-loss on existing position
 */
export interface OCOOrderConfig {
  limitPrice: string; // Take profit level
  stopPrice: string; // Stop loss trigger level
  stopLimitPrice?: string; // Optional limit for stop leg
}

/**
 * OTO ORDERS (order_class: "oto")
 *
 * One-Triggers-Other: When first order fills, second order activates
 *
 * Used for: Entering position then immediately setting protective stop
 */
export interface OTOOrderConfig {
  primaryType: "market" | "limit";
  primaryLimitPrice?: string;
  secondaryType: "stop" | "stop_limit" | "limit";
  secondaryStopPrice?: string;
  secondaryLimitPrice?: string;
}

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

/**
 * Base order schema with common fields
 */
const BaseOrderSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  side: OrderSideEnum,
  client_order_id: z.string().uuid().optional(),
});

/**
 * Quantity specification (either qty OR notional, not both)
 */
const QuantitySchema = z.union([
  z.object({
    qty: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive number"),
  }),
  z.object({
    notional: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a positive dollar amount"),
  }),
]);

/**
 * Market Order Schema
 */
export const MarketOrderSchema = BaseOrderSchema.extend({
  type: z.literal("market"),
  time_in_force: z.enum(["day", "opg", "cls", "ioc", "fok"]),
  extended_hours: z.literal(false).optional(),
}).and(QuantitySchema);

/**
 * Limit Order Schema
 */
export const LimitOrderSchema = BaseOrderSchema.extend({
  type: z.literal("limit"),
  time_in_force: TimeInForceEnum,
  limit_price: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive price"),
  extended_hours: z.boolean().optional(),
}).and(QuantitySchema);

/**
 * Stop Order Schema
 */
export const StopOrderSchema = BaseOrderSchema.extend({
  type: z.literal("stop"),
  time_in_force: z.enum(["day", "gtc"]),
  stop_price: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive price"),
  qty: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive number"),
  extended_hours: z.literal(false).optional(),
});

/**
 * Stop-Limit Order Schema
 */
export const StopLimitOrderSchema = BaseOrderSchema.extend({
  type: z.literal("stop_limit"),
  time_in_force: z.enum(["day", "gtc"]),
  stop_price: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive price"),
  limit_price: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive price"),
  qty: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive number"),
  extended_hours: z.boolean().optional(),
});

/**
 * Trailing Stop Order Schema
 */
export const TrailingStopOrderSchema = BaseOrderSchema.extend({
  type: z.literal("trailing_stop"),
  time_in_force: z.enum(["day", "gtc"]),
  qty: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive number"),
  extended_hours: z.literal(false).optional(),
}).and(
  z.union([
    z.object({
      trail_percent: z
        .string()
        .regex(/^\d+(\.\d+)?$/, "Must be a positive percent"),
    }),
    z.object({
      trail_price: z
        .string()
        .regex(/^\d+(\.\d+)?$/, "Must be a positive dollar amount"),
    }),
  ])
);

/**
 * Bracket Order Schema
 * CRITICAL: Bracket orders MUST use time_in_force: "day" per Alpaca API requirements
 * Using "gtc" will result in HTTP 422 rejection from the API
 */
export const BracketOrderSchema = BaseOrderSchema.extend({
  order_class: z.literal("bracket"),
  type: z.enum(["market", "limit"]),
  time_in_force: z.literal("day"), // FIXED: Must be "day" only - "gtc" causes 422 rejection
  qty: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive number"),
  limit_price: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
  take_profit: z.object({
    limit_price: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive price"),
  }),
  stop_loss: z.object({
    stop_price: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive price"),
    limit_price: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .optional(),
  }),
});

/**
 * OCO Order Schema
 */
export const OCOOrderSchema = BaseOrderSchema.extend({
  order_class: z.literal("oco"),
  qty: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive number"),
  time_in_force: z.enum(["day", "gtc"]),
  take_profit: z.object({
    limit_price: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive price"),
  }),
  stop_loss: z.object({
    stop_price: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive price"),
    limit_price: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .optional(),
  }),
});

/**
 * OTO Order Schema
 */
export const OTOOrderSchema = BaseOrderSchema.extend({
  order_class: z.literal("oto"),
  type: z.enum(["market", "limit"]),
  time_in_force: z.enum(["day", "gtc"]),
  qty: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive number"),
  limit_price: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
  stop_loss: z
    .object({
      stop_price: z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive price"),
      limit_price: z
        .string()
        .regex(/^\d+(\.\d+)?$/)
        .optional(),
    })
    .optional(),
  take_profit: z
    .object({
      limit_price: z
        .string()
        .regex(/^\d+(\.\d+)?$/, "Must be a positive price"),
    })
    .optional(),
});

/**
 * Combined Order Validation Schema
 * Note: Using union instead of discriminatedUnion due to intersection types
 */
export const SimpleOrderSchema = z.union([
  MarketOrderSchema,
  LimitOrderSchema,
  StopOrderSchema,
  StopLimitOrderSchema,
  TrailingStopOrderSchema,
]);

export const ComplexOrderSchema = z.union([
  BracketOrderSchema,
  OCOOrderSchema,
  OTOOrderSchema,
]);

export const CreateOrderSchema = z.union([
  SimpleOrderSchema,
  ComplexOrderSchema,
]);

// ============================================================================
// ORDER STATUS DEFINITIONS
// ============================================================================

/**
 * Order Status Lifecycle:
 *
 * new -> pending_new -> accepted -> (partially_filled) -> filled
 *                    -> rejected
 *                    -> pending_cancel -> canceled
 *                    -> expired
 *                    -> suspended
 *                    -> pending_replace -> replaced
 *                    -> stopped
 *                    -> calculated
 *                    -> done_for_day
 */
export const OrderStatusEnum = z.enum([
  "new", // Order has been received but not yet accepted
  "pending_new", // Order is being processed
  "accepted", // Order is accepted and live in the market
  "partially_filled", // Order has been partially filled
  "filled", // Order has been completely filled
  "done_for_day", // Order is done for the day
  "canceled", // Order has been canceled
  "expired", // Order has expired
  "replaced", // Order has been replaced
  "pending_cancel", // Order cancel request is pending
  "pending_replace", // Order replace request is pending
  "stopped", // Order has been stopped
  "rejected", // Order has been rejected
  "suspended", // Order has been suspended
  "calculated", // Order is being calculated
]);

/**
 * Terminal statuses - no further changes expected
 */
export const TERMINAL_STATUSES = [
  "filled",
  "canceled",
  "expired",
  "replaced",
  "rejected",
] as const;

/**
 * Active/pending statuses - order is still in progress
 */
export const ACTIVE_STATUSES = [
  "new",
  "pending_new",
  "accepted",
  "partially_filled",
  "pending_cancel",
  "pending_replace",
] as const;

/**
 * Statuses that indicate failed/unexecuted orders
 */
export const FAILED_STATUSES = ["canceled", "expired", "rejected"] as const;

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate order type + time_in_force combination
 */
export function validateOrderTypeCombination(
  orderType: string,
  timeInForce: string,
  extendedHours: boolean = false
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  const typeConfig = ORDER_TYPE_MATRIX.find((t) => t.orderType === orderType);
  if (!typeConfig) {
    result.valid = false;
    result.errors.push(`Invalid order type: ${orderType}`);
    return result;
  }

  if (!typeConfig.validTimeInForce.includes(timeInForce as any)) {
    result.valid = false;
    result.errors.push(
      `Invalid time_in_force '${timeInForce}' for ${orderType} order. ` +
        `Valid options: ${typeConfig.validTimeInForce.join(", ")}`
    );
  }

  if (extendedHours && !typeConfig.supportsExtendedHours) {
    result.valid = false;
    result.errors.push(
      `Extended hours trading not supported for ${orderType} orders. ` +
        `Use limit or stop_limit orders for extended hours.`
    );
  }

  return result;
}

/**
 * Validate stop price logic (buy stop > current price, sell stop < current price)
 */
export function validateStopPrice(
  side: "buy" | "sell",
  currentPrice: number,
  stopPrice: number
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (side === "buy" && stopPrice <= currentPrice) {
    result.warnings.push(
      `Buy stop at $${stopPrice} is below current price $${currentPrice}. ` +
        `This order will trigger immediately as a market order.`
    );
  }

  if (side === "sell" && stopPrice >= currentPrice) {
    result.warnings.push(
      `Sell stop at $${stopPrice} is above current price $${currentPrice}. ` +
        `This order will trigger immediately as a market order.`
    );
  }

  return result;
}

/**
 * Validate limit price logic
 */
export function validateLimitPrice(
  side: "buy" | "sell",
  currentPrice: number,
  limitPrice: number
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (side === "buy" && limitPrice > currentPrice * 1.1) {
    result.warnings.push(
      `Buy limit at $${limitPrice} is significantly above current price $${currentPrice}. ` +
        `This order will likely fill immediately at a worse price.`
    );
  }

  if (side === "sell" && limitPrice < currentPrice * 0.9) {
    result.warnings.push(
      `Sell limit at $${limitPrice} is significantly below current price $${currentPrice}. ` +
        `This order will likely fill immediately at a worse price.`
    );
  }

  return result;
}

/**
 * Validate bracket order legs
 */
export function validateBracketOrder(
  side: "buy" | "sell",
  entryPrice: number,
  takeProfitPrice: number,
  stopLossPrice: number
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (side === "buy") {
    if (takeProfitPrice <= entryPrice) {
      result.valid = false;
      result.errors.push(
        `Take profit price ($${takeProfitPrice}) must be above entry price ($${entryPrice}) for buy orders`
      );
    }
    if (stopLossPrice >= entryPrice) {
      result.valid = false;
      result.errors.push(
        `Stop loss price ($${stopLossPrice}) must be below entry price ($${entryPrice}) for buy orders`
      );
    }
  } else {
    if (takeProfitPrice >= entryPrice) {
      result.valid = false;
      result.errors.push(
        `Take profit price ($${takeProfitPrice}) must be below entry price ($${entryPrice}) for sell orders`
      );
    }
    if (stopLossPrice <= entryPrice) {
      result.valid = false;
      result.errors.push(
        `Stop loss price ($${stopLossPrice}) must be above entry price ($${entryPrice}) for sell orders`
      );
    }
  }

  return result;
}

/**
 * Validate trailing stop parameters
 */
export function validateTrailingStop(
  trailPercent?: number,
  trailPrice?: number
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  if (trailPercent !== undefined && trailPrice !== undefined) {
    result.valid = false;
    result.errors.push(
      "Cannot specify both trail_percent and trail_price. Choose one."
    );
  }

  if (trailPercent === undefined && trailPrice === undefined) {
    result.valid = false;
    result.errors.push(
      "Must specify either trail_percent or trail_price for trailing stop orders."
    );
  }

  if (trailPercent !== undefined) {
    if (trailPercent <= 0 || trailPercent > 100) {
      result.valid = false;
      result.errors.push(
        `Trail percent must be between 0 and 100, got ${trailPercent}`
      );
    }
    if (trailPercent < 0.5) {
      result.warnings.push(
        "Trail percent below 0.5% may trigger too frequently"
      );
    }
    if (trailPercent > 10) {
      result.warnings.push(
        "Trail percent above 10% may not provide adequate protection"
      );
    }
  }

  if (trailPrice !== undefined && trailPrice <= 0) {
    result.valid = false;
    result.errors.push(`Trail price must be positive, got ${trailPrice}`);
  }

  return result;
}

// ============================================================================
// MARKET HOURS VALIDATION
// ============================================================================

/**
 * Market Session Types
 */
export type MarketSession = "pre_market" | "regular" | "after_hours" | "closed";

/**
 * Determine current market session based on time
 * Pre-market: 4:00 AM - 9:30 AM ET
 * Regular hours: 9:30 AM - 4:00 PM ET
 * After hours: 4:00 PM - 8:00 PM ET
 * Closed: 8:00 PM - 4:00 AM ET and weekends
 */
export function getMarketSession(date: Date = new Date()): MarketSession {
  // Convert to Eastern Time
  const etTime = new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = etTime.getDay();
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Weekend = closed
  if (day === 0 || day === 6) return "closed";

  // Pre-market: 4:00 AM (240) - 9:30 AM (570)
  if (totalMinutes >= 240 && totalMinutes < 570) return "pre_market";

  // Regular: 9:30 AM (570) - 4:00 PM (960)
  if (totalMinutes >= 570 && totalMinutes < 960) return "regular";

  // After hours: 4:00 PM (960) - 8:00 PM (1200)
  if (totalMinutes >= 960 && totalMinutes < 1200) return "after_hours";

  return "closed";
}

/**
 * Order types allowed during each session
 */
export const SESSION_ORDER_RULES: Record<
  MarketSession,
  {
    allowedOrderTypes: string[];
    allowedTIF: string[];
    fractionalAllowed: boolean;
    cryptoAllowed: boolean;
    notes: string[];
  }
> = {
  pre_market: {
    allowedOrderTypes: ["limit", "stop_limit"],
    allowedTIF: ["day"],
    fractionalAllowed: false,
    cryptoAllowed: true, // Crypto trades 24/7
    notes: [
      "Only limit and stop_limit orders during pre-market",
      "Must use time_in_force: 'day' with extended_hours: true",
      "No fractional shares during extended hours",
    ],
  },
  regular: {
    allowedOrderTypes: [
      "market",
      "limit",
      "stop",
      "stop_limit",
      "trailing_stop",
    ],
    allowedTIF: ["day", "gtc", "ioc", "fok", "opg", "cls"],
    fractionalAllowed: true,
    cryptoAllowed: true,
    notes: [
      "All order types available during regular market hours",
      "Market orders cannot use GTC time_in_force",
      "Bracket orders must use time_in_force: 'day'",
    ],
  },
  after_hours: {
    allowedOrderTypes: ["limit", "stop_limit"],
    allowedTIF: ["day"],
    fractionalAllowed: false,
    cryptoAllowed: true,
    notes: [
      "Only limit and stop_limit orders during after-hours",
      "Must use time_in_force: 'day' with extended_hours: true",
      "No fractional shares during extended hours",
    ],
  },
  closed: {
    allowedOrderTypes: [],
    allowedTIF: [],
    fractionalAllowed: false,
    cryptoAllowed: true, // Crypto trades 24/7
    notes: [
      "Market is closed - equity orders will queue for next open",
      "Crypto can still trade 24/7",
    ],
  },
};

/**
 * Comprehensive order validation for market hours
 */
export function validateOrderForMarketHours(params: {
  orderType: string;
  timeInForce: string;
  extendedHours?: boolean;
  isCrypto?: boolean;
  isFractional?: boolean;
  isBracketOrder?: boolean;
  session?: MarketSession;
}): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  const session = params.session || getMarketSession();
  const rules = SESSION_ORDER_RULES[session];

  // Crypto trades 24/7 with some restrictions
  if (params.isCrypto) {
    // Market orders for crypto cannot use GTC
    if (params.orderType === "market" && params.timeInForce === "gtc") {
      result.valid = false;
      result.errors.push(
        "Market orders cannot use GTC time_in_force. Use 'day' instead."
      );
    }
    // No fractional crypto during low liquidity periods
    if (session === "closed" && params.isFractional) {
      result.warnings.push(
        "Fractional crypto orders may have lower liquidity outside market hours"
      );
    }
    return result;
  }

  // Market closed - queue for next open
  if (session === "closed") {
    result.warnings.push(
      "Market is closed. Order will queue for next market open."
    );
    if (params.orderType === "market") {
      result.warnings.push(
        "Market orders placed while closed will execute at next day's open price."
      );
    }
    return result;
  }

  // Extended hours validation
  if (session === "pre_market" || session === "after_hours") {
    if (!rules.allowedOrderTypes.includes(params.orderType)) {
      result.valid = false;
      result.errors.push(
        `${params.orderType} orders not allowed during ${session.replace("_", " ")}. ` +
          `Use: ${rules.allowedOrderTypes.join(", ")}`
      );
    }

    if (
      !params.extendedHours &&
      (params.orderType === "limit" || params.orderType === "stop_limit")
    ) {
      result.warnings.push(
        "Set extended_hours: true to execute during extended hours, otherwise order waits for regular hours"
      );
    }

    if (params.isFractional) {
      result.valid = false;
      result.errors.push(
        "Fractional shares not allowed during extended hours. Use whole share quantities."
      );
    }
  }

  // Bracket order validation
  if (params.isBracketOrder) {
    if (params.timeInForce !== "day") {
      result.valid = false;
      result.errors.push(
        "Bracket orders MUST use time_in_force: 'day'. GTC is not supported by Alpaca."
      );
    }
    if (session !== "regular") {
      result.valid = false;
      result.errors.push(
        "Bracket orders only allowed during regular market hours (9:30 AM - 4:00 PM ET)"
      );
    }
  }

  // Market order TIF validation
  if (params.orderType === "market") {
    const validMarketTIF = ["day", "ioc", "fok", "opg", "cls"];
    if (!validMarketTIF.includes(params.timeInForce)) {
      result.valid = false;
      result.errors.push(
        `Market orders cannot use ${params.timeInForce} time_in_force. ` +
          `Valid options: ${validMarketTIF.join(", ")}`
      );
    }
  }

  // General TIF validation
  const typeConfig = ORDER_TYPE_MATRIX.find(
    (t) => t.orderType === params.orderType
  );
  if (
    typeConfig &&
    !typeConfig.validTimeInForce.includes(params.timeInForce as any)
  ) {
    result.valid = false;
    result.errors.push(
      `Invalid time_in_force '${params.timeInForce}' for ${params.orderType} order. ` +
        `Valid options: ${typeConfig.validTimeInForce.join(", ")}`
    );
  }

  return result;
}

/**
 * Auto-correct order parameters to valid combinations
 * Returns corrected parameters and list of corrections made
 */
export function normalizeOrderParams(params: {
  orderType: string;
  timeInForce: string;
  extendedHours?: boolean;
  isCrypto?: boolean;
  isBracketOrder?: boolean;
}): {
  corrected: typeof params;
  corrections: string[];
} {
  const corrections: string[] = [];
  const corrected = { ...params };

  // Fix market order GTC -> day
  if (corrected.orderType === "market" && corrected.timeInForce === "gtc") {
    corrected.timeInForce = "day";
    corrections.push(
      "Changed market order TIF from 'gtc' to 'day' (market orders cannot use GTC)"
    );
  }

  // Fix bracket order GTC -> day
  if (corrected.isBracketOrder && corrected.timeInForce === "gtc") {
    corrected.timeInForce = "day";
    corrections.push(
      "Changed bracket order TIF from 'gtc' to 'day' (bracket orders require 'day')"
    );
  }

  // Disable extended hours for non-limit orders
  if (
    corrected.extendedHours &&
    !["limit", "stop_limit"].includes(corrected.orderType)
  ) {
    corrected.extendedHours = false;
    corrections.push(
      `Disabled extended_hours for ${corrected.orderType} order (only limit/stop_limit supported)`
    );
  }

  return { corrected, corrections };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type OrderType = z.infer<typeof OrderTypeEnum>;
export type OrderClass = z.infer<typeof OrderClassEnum>;
export type TimeInForce = z.infer<typeof TimeInForceEnum>;
export type OrderSide = z.infer<typeof OrderSideEnum>;
export type OrderStatus = z.infer<typeof OrderStatusEnum>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
