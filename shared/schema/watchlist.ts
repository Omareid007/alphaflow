/**
 * @module shared/schema/watchlist
 * @description Watchlist management schema for user-defined stock tracking lists.
 *
 * Provides database tables for storing user watchlists and their associated symbols.
 * Supports multiple watchlists per user with tagging and sorting capabilities.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

// ============================================================================
// WATCHLIST TABLES
// ============================================================================

/**
 * Watchlists table
 *
 * Stores user-created watchlists for tracking stocks and securities.
 *
 * @property {string} id - Auto-generated UUID primary key
 * @property {string} userId - Foreign key to users table (cascade delete)
 * @property {string} name - User-defined watchlist name
 * @property {string|null} description - Optional description for the watchlist
 * @property {boolean} isDefault - Whether this is the user's default watchlist
 * @property {number} sortOrder - Display order for the watchlist
 * @property {Date} createdAt - When the watchlist was created
 * @property {Date} updatedAt - When the watchlist was last modified
 *
 * @remarks
 * - Each user can have multiple watchlists
 * - Watchlists are cascade deleted when the user is removed
 * - isDefault ensures one default watchlist per user
 */
export const watchlists = pgTable(
  "watchlists",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isDefault: boolean("is_default").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("watchlists_user_id_idx").on(table.userId),
    index("watchlists_is_default_idx").on(table.isDefault),
  ]
);

/**
 * Watchlist Symbols table
 *
 * Junction table linking watchlists to their tracked symbols.
 *
 * @property {string} id - Auto-generated UUID primary key
 * @property {string} watchlistId - Foreign key to watchlists table (cascade delete)
 * @property {string} symbol - Stock ticker symbol (e.g., "AAPL", "BTC/USD")
 * @property {string|null} notes - User notes about this symbol
 * @property {string|null} tags - Comma-separated tags for categorization
 * @property {number} sortOrder - Display order within the watchlist
 * @property {Date} addedAt - When the symbol was added to the watchlist
 *
 * @remarks
 * - Symbols are cascade deleted when the watchlist is removed
 * - The same symbol can be in multiple watchlists
 * - Tags allow for filtering (e.g., "tech", "dividend", "growth")
 */
export const watchlistSymbols = pgTable(
  "watchlist_symbols",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    watchlistId: varchar("watchlist_id")
      .references(() => watchlists.id, { onDelete: "cascade" })
      .notNull(),
    symbol: text("symbol").notNull(),
    notes: text("notes"),
    tags: text("tags"),
    sortOrder: integer("sort_order").default(0).notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    index("watchlist_symbols_watchlist_id_idx").on(table.watchlistId),
    index("watchlist_symbols_symbol_idx").on(table.symbol),
  ]
);

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

/**
 * Zod schema for inserting a new watchlist
 *
 * @remarks
 * - Omits auto-generated fields (id, createdAt, updatedAt)
 * - sortOrder is optional and defaults to 0
 * - isDefault is optional and defaults to false
 */
export const insertWatchlistSchema = createInsertSchema(watchlists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * Zod schema for inserting a new watchlist symbol
 *
 * @remarks
 * - Omits auto-generated fields (id, addedAt)
 * - sortOrder is optional and defaults to 0
 */
export const insertWatchlistSymbolSchema = createInsertSchema(
  watchlistSymbols
).omit({
  id: true,
  addedAt: true,
});

/**
 * Zod schema for creating a new watchlist via API
 */
export const createWatchlistSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
});

/**
 * Zod schema for updating a watchlist
 */
export const updateWatchlistSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/**
 * Zod schema for adding a symbol to a watchlist
 */
export const addWatchlistSymbolSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
  notes: z.string().max(500).optional(),
  tags: z.string().max(200).optional(),
});

/**
 * Zod schema for updating a watchlist symbol
 */
export const updateWatchlistSymbolSchema = z.object({
  notes: z.string().max(500).optional(),
  tags: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ============================================================================
// TYPES
// ============================================================================

/**
 * Type for inserting a new watchlist (inferred from Zod schema)
 */
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;

/**
 * Type for a watchlist record (inferred from table schema)
 */
export type Watchlist = typeof watchlists.$inferSelect;

/**
 * Type for inserting a new watchlist symbol (inferred from Zod schema)
 */
export type InsertWatchlistSymbol = z.infer<typeof insertWatchlistSymbolSchema>;

/**
 * Type for a watchlist symbol record (inferred from table schema)
 */
export type WatchlistSymbol = typeof watchlistSymbols.$inferSelect;

/**
 * Type for creating a watchlist via API
 */
export type CreateWatchlistInput = z.infer<typeof createWatchlistSchema>;

/**
 * Type for updating a watchlist
 */
export type UpdateWatchlistInput = z.infer<typeof updateWatchlistSchema>;

/**
 * Type for adding a symbol to a watchlist
 */
export type AddWatchlistSymbolInput = z.infer<typeof addWatchlistSymbolSchema>;

/**
 * Type for updating a watchlist symbol
 */
export type UpdateWatchlistSymbolInput = z.infer<
  typeof updateWatchlistSymbolSchema
>;

/**
 * Type for watchlist with symbols included
 */
export interface WatchlistWithSymbols extends Watchlist {
  symbols: WatchlistSymbol[];
}
