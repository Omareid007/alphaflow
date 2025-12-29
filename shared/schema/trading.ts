/**
 * @module shared/schema/trading
 * @description Core trading entities schema
 *
 * This module defines the database tables for trading strategies, trades, and positions.
 * These are the primary entities that track trading activity and portfolio state.
 *
 * @remarks
 * - The trades.orderId field has a circular dependency with the orders table
 * - orderId is defined without .references() to avoid TypeScript circular type issues
 * - The foreign key constraint exists at the database level via migrations
 * - All user-related records cascade delete when the user is removed
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

// ============================================================================
// TRADING CORE TABLES
// ============================================================================

/**
 * Strategies table
 *
 * Stores trading strategy configurations and metadata.
 * Strategies can be activated/deactivated and linked to trades and positions.
 *
 * @property {string} id - Auto-generated UUID primary key
 * @property {string} name - Human-readable strategy name
 * @property {string} type - Strategy type/algorithm identifier
 * @property {string|null} description - Detailed description of the strategy
 * @property {boolean} isActive - Whether the strategy is currently active (default: false)
 * @property {string[]|null} assets - Array of asset symbols this strategy trades
 * @property {string|null} parameters - JSON-serialized strategy parameters
 * @property {Date} createdAt - When the strategy was created
 * @property {Date} updatedAt - When the strategy was last modified
 *
 * @remarks
 * - Strategies can be linked to multiple trades and positions
 * - Setting a strategy to inactive doesn't affect historical trades
 * - Parameters field can store strategy-specific configuration
 */
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

/**
 * Trades table
 *
 * Records completed trade executions with P&L tracking.
 * Represents the actual executed trades, not order intentions.
 *
 * @property {string} id - Auto-generated UUID primary key
 * @property {string} userId - Foreign key to users table (cascade delete)
 * @property {string|null} strategyId - Foreign key to strategies table (set null on strategy delete)
 * @property {string|null} orderId - Foreign key to orders table (no TypeScript reference due to circular dependency)
 * @property {string} symbol - Asset symbol traded
 * @property {string} side - Trade side ("buy" or "sell")
 * @property {string} quantity - Trade quantity (stored as numeric string for precision)
 * @property {string} price - Execution price (stored as numeric string for precision)
 * @property {Date} executedAt - When the trade was executed
 * @property {string|null} pnl - Profit and loss for the trade (stored as numeric string)
 * @property {string} status - Trade status (default: "completed")
 * @property {string|null} notes - Optional notes or annotations
 * @property {string|null} traceId - Distributed tracing identifier
 *
 * @remarks
 * Circular Dependency Issue:
 * - orderId should reference orders.id, but this creates a circular type dependency
 * - The field is defined without .references() in TypeScript
 * - The foreign key constraint exists at the database level via migration
 * - This allows proper referential integrity while avoiding TypeScript compilation issues
 *
 * Foreign Key Relationships:
 * - userId: CASCADE DELETE - trades deleted when user is removed
 * - strategyId: SET NULL - strategy reference cleared if strategy is deleted
 * - orderId: Database-level FK only (see circular dependency note above)
 *
 * Indexing:
 * - Indexed on userId for efficient user trade lookups
 */
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

/**
 * Positions table
 *
 * Tracks current open positions in the portfolio with real-time P&L.
 * Represents the user's current holdings and exposure.
 *
 * @property {string} id - Auto-generated UUID primary key
 * @property {string} userId - Foreign key to users table (cascade delete)
 * @property {string} symbol - Asset symbol for this position
 * @property {string} quantity - Current position size (stored as numeric string for precision)
 * @property {string} entryPrice - Average entry price (stored as numeric string for precision)
 * @property {string|null} currentPrice - Latest market price (stored as numeric string for precision)
 * @property {string|null} unrealizedPnl - Unrealized profit/loss (stored as numeric string for precision)
 * @property {string} side - Position side ("long" or "short")
 * @property {Date} openedAt - When the position was first opened
 * @property {string|null} strategyId - Foreign key to strategies table (set null on strategy delete)
 *
 * @remarks
 * Foreign Key Relationships:
 * - userId: CASCADE DELETE - positions deleted when user is removed
 * - strategyId: SET NULL - strategy reference cleared if strategy is deleted
 *
 * Indexing:
 * - Indexed on userId for efficient user position lookups
 *
 * P&L Calculation:
 * - unrealizedPnl = (currentPrice - entryPrice) * quantity
 * - Should be updated whenever currentPrice is updated
 */
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

/**
 * Zod schema for inserting a new strategy
 *
 * @remarks
 * - Omits auto-generated fields (id, createdAt, updatedAt)
 * - assets field is optional and defaults to empty array
 * - Ensures consistent validation for strategy creation
 */
export const insertStrategySchema = createInsertSchema(strategies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Make assets optional and allow empty arrays
  assets: z.array(z.string()).optional().default([]),
});

/**
 * Zod schema for inserting a new trade
 *
 * @remarks
 * - Omits auto-generated fields (id, executedAt)
 * - Requires userId, symbol, side, quantity, and price
 * - orderId can be provided to link to an order record
 */
export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  executedAt: true,
});

/**
 * Zod schema for inserting a new position
 *
 * @remarks
 * - Omits auto-generated fields (id, openedAt)
 * - Requires userId, symbol, quantity, entryPrice, and side
 * - currentPrice and unrealizedPnl should be calculated/updated separately
 */
export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  openedAt: true,
});

// ============================================================================
// TYPES
// ============================================================================

/**
 * Type for inserting a new strategy (inferred from table schema)
 */
export type InsertStrategy = typeof strategies.$inferInsert;

/**
 * Type for a strategy record (inferred from table schema)
 */
export type Strategy = typeof strategies.$inferSelect;

/**
 * Type for inserting a new trade (inferred from table schema)
 */
export type InsertTrade = typeof trades.$inferInsert;

/**
 * Type for a trade record (inferred from table schema)
 */
export type Trade = typeof trades.$inferSelect;

/**
 * Type for inserting a new position (inferred from table schema)
 */
export type InsertPosition = typeof positions.$inferInsert;

/**
 * Type for a position record (inferred from table schema)
 */
export type Position = typeof positions.$inferSelect;
