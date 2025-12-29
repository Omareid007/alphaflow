import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

// ============================================================================
// TRADING CORE TABLES
// ============================================================================

export const strategies = pgTable("strategies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(false).notNull(),
  assets: text("assets").array(),
  parameters: text("parameters"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const trades = pgTable("trades", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  strategyId: varchar("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
  // Note: orderId references orders table but defined without .references() to avoid circular type dependency
  // The foreign key constraint exists at database level via migration
  orderId: varchar("order_id"),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  quantity: numeric("quantity").notNull(),
  price: numeric("price").notNull(),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  pnl: numeric("pnl"),
  status: text("status").default("completed").notNull(),
  notes: text("notes"),
  traceId: text("trace_id"),
}, (table) => ({
  userIdIdx: index("trades_user_id_idx").on(table.userId),
}));

export const positions = pgTable("positions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  symbol: text("symbol").notNull(),
  quantity: numeric("quantity").notNull(),
  entryPrice: numeric("entry_price").notNull(),
  currentPrice: numeric("current_price"),
  unrealizedPnl: numeric("unrealized_pnl"),
  side: text("side").notNull(),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  strategyId: varchar("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
}, (table) => ({
  userIdIdx: index("positions_user_id_idx").on(table.userId),
}));

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

export const insertStrategySchema = createInsertSchema(strategies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Make assets optional and allow empty arrays
  assets: z.array(z.string()).optional().default([]),
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  executedAt: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  openedAt: true,
});

// ============================================================================
// TYPES
// ============================================================================

export type InsertStrategy = typeof strategies.$inferInsert;
export type Strategy = typeof strategies.$inferSelect;

export type InsertTrade = typeof trades.$inferInsert;
export type Trade = typeof trades.$inferSelect;

export type InsertPosition = typeof positions.$inferInsert;
export type Position = typeof positions.$inferSelect;
