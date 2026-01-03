/**
 * @module shared/schema/orders
 * @description Order execution tracking schema
 *
 * This module defines the database tables and enums for tracking order execution,
 * broker assets, and trade fills. It integrates with broker APIs (primarily Alpaca)
 * to maintain a complete record of order lifecycle and execution details.
 *
 * @remarks
 * The orders table serves as the central hub linking:
 * - User requests (users)
 * - AI decisions (aiDecisions)
 * - Trade intents (trades)
 * - Work orchestration (workItems)
 * - Actual fills (fills)
 *
 * All numeric fields use PostgreSQL NUMERIC type for precision in financial calculations.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";
import { aiDecisions } from "./ai-decisions";
import { trades } from "./trading";
import { workItems } from "./orchestration";
import { debateConsensus } from "./debate-arena";

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Order status values
 *
 * Tracks the lifecycle of an order from creation through completion or cancellation.
 * Based on standard broker order statuses (primarily Alpaca).
 *
 * @enum {string}
 * @property {string} new - Order has been received by the broker
 * @property {string} accepted - Order has been accepted by the exchange
 * @property {string} pending_new - Order is being sent to the exchange
 * @property {string} partially_filled - Order has been partially executed
 * @property {string} filled - Order has been completely executed
 * @property {string} canceled - Order has been successfully canceled
 * @property {string} rejected - Order was rejected by the broker or exchange
 * @property {string} expired - Order expired before execution
 * @property {string} replaced - Order was replaced by another order
 * @property {string} pending_cancel - Cancellation request is pending
 * @property {string} pending_replace - Replace request is pending
 * @property {string} stopped - Order has been stopped
 * @property {string} suspended - Order has been suspended
 * @property {string} calculated - Order price has been calculated
 * @property {string} done_for_day - Order is done for the trading day
 */
export const orderStatuses = [
  "new",
  "accepted",
  "pending_new",
  "partially_filled",
  "filled",
  "canceled",
  "rejected",
  "expired",
  "replaced",
  "pending_cancel",
  "pending_replace",
  "stopped",
  "suspended",
  "calculated",
  "done_for_day",
] as const;

/**
 * TypeScript type derived from orderStatuses array
 */
export type OrderStatus = (typeof orderStatuses)[number];

/**
 * Order type values
 *
 * Defines the type of order to be executed.
 *
 * @enum {string}
 * @property {string} market - Execute immediately at current market price
 * @property {string} limit - Execute only at specified price or better
 * @property {string} stop - Market order triggered when stop price is reached
 * @property {string} stop_limit - Limit order triggered when stop price is reached
 */
export const orderTypes = ["market", "limit", "stop", "stop_limit"] as const;

/**
 * TypeScript type derived from orderTypes array
 */
export type OrderType = (typeof orderTypes)[number];

/**
 * Time in force values
 *
 * Specifies how long an order remains active.
 *
 * @enum {string}
 * @property {string} day - Order valid until market close
 * @property {string} gtc - Good 'til canceled (remains active until filled or canceled)
 * @property {string} opg - Execute at market open or cancel
 * @property {string} cls - Execute at market close or cancel
 * @property {string} ioc - Immediate or cancel (fill immediately or cancel unfilled portion)
 * @property {string} fok - Fill or kill (fill entire order immediately or cancel)
 */
export const timeInForceValues = [
  "day",
  "gtc",
  "opg",
  "cls",
  "ioc",
  "fok",
] as const;

/**
 * TypeScript type derived from timeInForceValues array
 */
export type TimeInForce = (typeof timeInForceValues)[number];

/**
 * Asset class values
 *
 * Defines the type of financial instrument being traded.
 *
 * @enum {string}
 * @property {string} us_equity - U.S. stocks and equity securities
 * @property {string} crypto - Cryptocurrency assets
 */
export const assetClasses = ["us_equity", "crypto"] as const;

/**
 * TypeScript type derived from assetClasses array
 */
export type AssetClass = (typeof assetClasses)[number];

// ============================================================================
// TABLES
// ============================================================================

/**
 * Broker Assets table
 *
 * Caches asset metadata from the broker (Alpaca) for validation and trading constraints.
 * Synchronized periodically with the broker's asset list.
 *
 * @property {string} id - Auto-generated UUID primary key
 * @property {string} alpacaId - Alpaca's unique asset identifier (unique)
 * @property {string} symbol - Trading symbol (e.g., "AAPL", "BTC/USD") (unique)
 * @property {string} name - Full asset name
 * @property {string} assetClass - Asset class type ("us_equity" or "crypto")
 * @property {string} exchange - Exchange where the asset trades
 * @property {string} status - Asset status (e.g., "active", "inactive")
 * @property {boolean} tradable - Whether the asset can be traded (default: false)
 * @property {boolean} marginable - Whether the asset can be traded on margin (default: false)
 * @property {boolean} shortable - Whether the asset can be sold short (default: false)
 * @property {boolean} easyToBorrow - Whether the asset is easy to borrow for shorting (default: false)
 * @property {boolean} fractionable - Whether fractional shares are allowed (default: false)
 * @property {string|null} minOrderSize - Minimum order size allowed
 * @property {string|null} minTradeIncrement - Minimum increment for order quantities
 * @property {string|null} priceIncrement - Minimum tick size for prices
 * @property {Date} lastSyncedAt - When this asset was last synchronized with broker
 * @property {Date} createdAt - When this asset record was created
 * @property {Date} updatedAt - When this asset record was last updated
 *
 * @remarks
 * - Unique constraints on both alpacaId and symbol
 * - Should be refreshed daily or before trading to ensure accurate constraints
 * - Used for pre-trade validation and order parameter constraints
 */
export const brokerAssets = pgTable("broker_assets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  alpacaId: text("alpaca_id").notNull().unique(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  assetClass: text("asset_class").notNull(),
  exchange: text("exchange").notNull(),
  status: text("status").notNull(),
  tradable: boolean("tradable").default(false).notNull(),
  marginable: boolean("marginable").default(false).notNull(),
  shortable: boolean("shortable").default(false).notNull(),
  easyToBorrow: boolean("easy_to_borrow").default(false).notNull(),
  fractionable: boolean("fractionable").default(false).notNull(),
  minOrderSize: numeric("min_order_size"),
  minTradeIncrement: numeric("min_trade_increment"),
  priceIncrement: numeric("price_increment"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Orders table
 *
 * Tracks order requests sent to brokers and their execution status.
 * Central table linking users, decisions, trades, and fills.
 *
 * @property {string} id - Auto-generated UUID primary key
 * @property {string} userId - Foreign key to users table (cascade delete)
 * @property {string} broker - Broker name (e.g., "alpaca")
 * @property {string} brokerOrderId - Broker's unique order identifier (unique)
 * @property {string|null} clientOrderId - Client-specified order identifier (unique, optional)
 * @property {string} symbol - Asset symbol being traded
 * @property {string} side - Order side ("buy" or "sell")
 * @property {string} type - Order type ("market", "limit", "stop", "stop_limit")
 * @property {string|null} timeInForce - How long order remains active ("day", "gtc", etc.)
 * @property {string|null} qty - Order quantity (mutually exclusive with notional)
 * @property {string|null} notional - Notional dollar amount (mutually exclusive with qty)
 * @property {string|null} limitPrice - Limit price for limit/stop_limit orders
 * @property {string|null} stopPrice - Stop price for stop/stop_limit orders
 * @property {string} status - Current order status (see orderStatuses enum)
 * @property {boolean|null} extendedHours - Whether order can execute in extended hours (default: false)
 * @property {string|null} orderClass - Order class ("simple", "bracket", "oco", "oto")
 * @property {Date} submittedAt - When order was submitted to broker
 * @property {Date} updatedAt - When order status was last updated
 * @property {Date|null} filledAt - When order was completely filled
 * @property {Date|null} expiredAt - When order expired
 * @property {Date|null} canceledAt - When order was canceled
 * @property {Date|null} failedAt - When order failed
 * @property {string|null} filledQty - Quantity filled so far
 * @property {string|null} filledAvgPrice - Average fill price
 * @property {string|null} traceId - Distributed tracing identifier
 * @property {string|null} decisionId - Foreign key to aiDecisions table (set null on delete)
 * @property {string|null} tradeIntentId - Foreign key to trades table (set null on delete)
 * @property {string|null} workItemId - Foreign key to workItems table (set null on delete)
 * @property {object|null} rawJson - Raw JSON response from broker API
 * @property {Date} createdAt - When this order record was created
 *
 * @remarks
 * Foreign Key Relationships:
 * - userId: CASCADE DELETE - orders deleted when user is removed
 * - decisionId: SET NULL - preserves order even if AI decision is deleted
 * - tradeIntentId: SET NULL - preserves order even if trade intent is deleted
 * - workItemId: SET NULL - preserves order even if work item is deleted
 *
 * Indexing:
 * - Indexed on userId, brokerOrderId, clientOrderId, symbol, status, traceId, decisionId
 * - All foreign key fields are indexed for efficient joins
 *
 * Validation:
 * - Either qty or notional must be provided (mutually exclusive)
 * - limitPrice required for limit/stop_limit orders
 * - stopPrice required for stop/stop_limit orders
 */
export const orders = pgTable(
  "orders",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    broker: text("broker").notNull(),
    brokerOrderId: text("broker_order_id").notNull().unique(),
    clientOrderId: text("client_order_id").unique(),
    symbol: text("symbol").notNull(),
    side: text("side").notNull(),
    type: text("type").notNull(),
    timeInForce: text("time_in_force"),
    qty: numeric("qty"),
    notional: numeric("notional"),
    limitPrice: numeric("limit_price"),
    stopPrice: numeric("stop_price"),
    status: text("status").notNull(),
    // ADDED: Missing Alpaca order fields for complete tracking
    extendedHours: boolean("extended_hours").default(false),
    orderClass: text("order_class"), // simple, bracket, oco, oto
    submittedAt: timestamp("submitted_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    filledAt: timestamp("filled_at"),
    expiredAt: timestamp("expired_at"),
    canceledAt: timestamp("canceled_at"),
    failedAt: timestamp("failed_at"),
    filledQty: numeric("filled_qty"),
    filledAvgPrice: numeric("filled_avg_price"),
    traceId: text("trace_id"),
    decisionId: varchar("decision_id").references(() => aiDecisions.id, {
      onDelete: "set null",
    }),
    tradeIntentId: varchar("trade_intent_id").references(() => trades.id, {
      onDelete: "set null",
    }),
    workItemId: varchar("work_item_id").references(() => workItems.id, {
      onDelete: "set null",
    }),
    rawJson: jsonb("raw_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("orders_user_id_idx").on(table.userId),
    index("orders_broker_order_id_idx").on(table.brokerOrderId),
    index("orders_client_order_id_idx").on(table.clientOrderId),
    index("orders_symbol_idx").on(table.symbol),
    index("orders_status_idx").on(table.status),
    index("orders_trace_id_idx").on(table.traceId),
    index("orders_decision_id_idx").on(table.decisionId),
  ]
);

/**
 * Fills table
 *
 * Records individual fill events for orders. An order may have multiple fills
 * if it's executed in partial chunks.
 *
 * @property {string} id - Auto-generated UUID primary key
 * @property {string} broker - Broker name (e.g., "alpaca")
 * @property {string} brokerOrderId - Broker's order identifier that was filled
 * @property {string|null} brokerFillId - Broker's unique fill identifier (unique, optional)
 * @property {string|null} orderId - Foreign key to orders table (cascade delete)
 * @property {string} symbol - Asset symbol that was filled
 * @property {string} side - Fill side ("buy" or "sell")
 * @property {string} qty - Quantity filled in this fill event
 * @property {string} price - Execution price for this fill
 * @property {Date} occurredAt - When the fill occurred
 * @property {string|null} traceId - Distributed tracing identifier
 * @property {object|null} rawJson - Raw JSON response from broker API
 * @property {Date} createdAt - When this fill record was created
 *
 * @remarks
 * Foreign Key Relationships:
 * - orderId: CASCADE DELETE - fills deleted when the order is removed
 * - orderId can be null if the fill arrives before the order record is created
 *
 * Indexing:
 * - Indexed on brokerOrderId for linking fills to orders
 * - Indexed on orderId for efficient joins
 * - Indexed on symbol for symbol-based queries
 * - Indexed on traceId for distributed tracing
 *
 * Fill Aggregation:
 * - Multiple fills for the same order should aggregate to match order.filledQty
 * - Average fill price can be calculated from all fills
 */
export const fills = pgTable(
  "fills",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    broker: text("broker").notNull(),
    brokerOrderId: text("broker_order_id").notNull(),
    brokerFillId: text("broker_fill_id").unique(),
    orderId: varchar("order_id").references(() => orders.id, {
      onDelete: "cascade",
    }),
    symbol: text("symbol").notNull(),
    side: text("side").notNull(),
    qty: numeric("qty").notNull(),
    price: numeric("price").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    traceId: text("trace_id"),
    rawJson: jsonb("raw_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("fills_broker_order_id_idx").on(table.brokerOrderId),
    index("fills_order_id_idx").on(table.orderId),
    index("fills_symbol_idx").on(table.symbol),
    index("fills_trace_id_idx").on(table.traceId),
  ]
);

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

/**
 * Zod schema for inserting a new broker asset
 *
 * @remarks
 * - Omits auto-generated fields (id, createdAt, updatedAt)
 * - Requires alpacaId, symbol, name, assetClass, exchange, status
 * - Used when synchronizing assets from broker API
 */
export const insertBrokerAssetSchema = createInsertSchema(brokerAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * Zod schema for inserting a new order
 *
 * @remarks
 * - Omits auto-generated fields (id, createdAt)
 * - Requires userId, broker, brokerOrderId, symbol, side, type, status, submittedAt, updatedAt
 * - Either qty or notional must be provided
 */
export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

/**
 * Zod schema for inserting a new fill
 *
 * @remarks
 * - Omits auto-generated fields (id, createdAt)
 * - Requires broker, brokerOrderId, symbol, side, qty, price, occurredAt
 */
export const insertFillSchema = createInsertSchema(fills).omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// TYPES
// ============================================================================

/**
 * Type for inserting a new broker asset (inferred from Zod schema)
 */
export type InsertBrokerAsset = z.infer<typeof insertBrokerAssetSchema>;

/**
 * Type for a broker asset record (inferred from table schema)
 */
export type BrokerAsset = typeof brokerAssets.$inferSelect;

/**
 * Type for inserting a new order (inferred from Zod schema)
 */
export type InsertOrder = z.infer<typeof insertOrderSchema>;

/**
 * Type for an order record (inferred from table schema)
 */
export type Order = typeof orders.$inferSelect;

/**
 * Type for inserting a new fill (inferred from Zod schema)
 */
export type InsertFill = z.infer<typeof insertFillSchema>;

/**
 * Type for a fill record (inferred from table schema)
 */
export type Fill = typeof fills.$inferSelect;

/**
 * Manual input type for order creation/updates
 *
 * @remarks
 * This type is used instead of the auto-generated InsertOrder type to avoid
 * drizzle-zod's incorrect array type inference for some fields. It matches
 * the actual runtime data structure when creating/updating orders.
 */
export interface InsertOrderInput {
  userId: string;
  broker: string;
  brokerOrderId: string;
  clientOrderId?: string | null;
  symbol: string;
  side: string;
  type: string;
  timeInForce?: string | null;
  qty?: string | null;
  notional?: string | null;
  limitPrice?: string | null;
  stopPrice?: string | null;
  status: string;
  extendedHours?: boolean | null;
  orderClass?: string | null;
  submittedAt: Date;
  updatedAt: Date;
  filledAt?: Date | null;
  expiredAt?: Date | null;
  canceledAt?: Date | null;
  failedAt?: Date | null;
  filledQty?: string | null;
  filledAvgPrice?: string | null;
  traceId?: string | null;
  decisionId?: string | null;
  tradeIntentId?: string | null;
  workItemId?: string | null;
  rawJson?: unknown;
}

/**
 * Tradability check result interface
 *
 * @remarks
 * Used to return the result of checking whether an asset can be traded.
 * Includes trading constraints and metadata from the broker asset cache.
 *
 * @property {string} symbol - Asset symbol being checked
 * @property {boolean} tradable - Whether the asset can be traded
 * @property {string|undefined} reason - Reason if asset is not tradable
 * @property {AssetClass|undefined} assetClass - Asset class type
 * @property {string|undefined} exchange - Exchange where asset trades
 * @property {boolean|undefined} fractionable - Whether fractional shares are allowed
 * @property {boolean|undefined} marginable - Whether asset can be traded on margin
 * @property {boolean|undefined} shortable - Whether asset can be sold short
 * @property {Date|undefined} lastSyncedAt - When asset data was last synchronized
 */
export interface TradabilityCheck {
  symbol: string;
  tradable: boolean;
  reason?: string;
  assetClass?: AssetClass;
  exchange?: string;
  fractionable?: boolean;
  marginable?: boolean;
  shortable?: boolean;
  lastSyncedAt?: Date;
}
