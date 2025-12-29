import { sql } from "drizzle-orm";
import { pgTable, varchar, text, numeric, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
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

export const orderStatuses = [
  'new',
  'accepted',
  'pending_new',
  'partially_filled',
  'filled',
  'canceled',
  'rejected',
  'expired',
  'replaced',
  'pending_cancel',
  'pending_replace',
  'stopped',
  'suspended',
  'calculated',
  'done_for_day',
] as const;

export type OrderStatus = typeof orderStatuses[number];

export const orderTypes = ['market', 'limit', 'stop', 'stop_limit'] as const;
export type OrderType = typeof orderTypes[number];

export const timeInForceValues = ['day', 'gtc', 'opg', 'cls', 'ioc', 'fok'] as const;
export type TimeInForce = typeof timeInForceValues[number];

export const assetClasses = ["us_equity", "crypto"] as const;
export type AssetClass = typeof assetClasses[number];

// ============================================================================
// TABLES
// ============================================================================

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

export const orders = pgTable("orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
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
  orderClass: text("order_class"),  // simple, bracket, oco, oto
  submittedAt: timestamp("submitted_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  filledAt: timestamp("filled_at"),
  expiredAt: timestamp("expired_at"),
  canceledAt: timestamp("canceled_at"),
  failedAt: timestamp("failed_at"),
  filledQty: numeric("filled_qty"),
  filledAvgPrice: numeric("filled_avg_price"),
  traceId: text("trace_id"),
  decisionId: varchar("decision_id").references(() => aiDecisions.id, { onDelete: "set null" }),
  tradeIntentId: varchar("trade_intent_id").references(() => trades.id, { onDelete: "set null" }),
  workItemId: varchar("work_item_id").references(() => workItems.id, { onDelete: "set null" }),
  rawJson: jsonb("raw_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("orders_user_id_idx").on(table.userId),
  index("orders_broker_order_id_idx").on(table.brokerOrderId),
  index("orders_client_order_id_idx").on(table.clientOrderId),
  index("orders_symbol_idx").on(table.symbol),
  index("orders_status_idx").on(table.status),
  index("orders_trace_id_idx").on(table.traceId),
  index("orders_decision_id_idx").on(table.decisionId),
]);

export const fills = pgTable("fills", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  broker: text("broker").notNull(),
  brokerOrderId: text("broker_order_id").notNull(),
  brokerFillId: text("broker_fill_id").unique(),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  qty: numeric("qty").notNull(),
  price: numeric("price").notNull(),
  occurredAt: timestamp("occurred_at").notNull(),
  traceId: text("trace_id"),
  rawJson: jsonb("raw_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("fills_broker_order_id_idx").on(table.brokerOrderId),
  index("fills_order_id_idx").on(table.orderId),
  index("fills_symbol_idx").on(table.symbol),
  index("fills_trace_id_idx").on(table.traceId),
]);

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

export const insertBrokerAssetSchema = createInsertSchema(brokerAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

export const insertFillSchema = createInsertSchema(fills).omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// TYPES
// ============================================================================

export type InsertBrokerAsset = z.infer<typeof insertBrokerAssetSchema>;
export type BrokerAsset = typeof brokerAssets.$inferSelect;

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertFill = z.infer<typeof insertFillSchema>;
export type Fill = typeof fills.$inferSelect;

/**
 * Manual input type for order creation/updates that matches actual runtime data.
 * This avoids drizzle-zod's incorrect array type inference for some fields.
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
