/**
 * @module schema/market-data
 * @description Market data caching and usage tracking schema.
 * Provides caching layers for macroeconomic indicators, external API responses,
 * and usage counters. Optimizes API quota management and reduces latency.
 */

import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, numeric, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Cached macroeconomic indicators.
 * Stores latest values for economic data points.
 *
 * @table macro_indicators
 * @description Caches macroeconomic indicator data from sources like FRED
 * (Federal Reserve Economic Data). Stores current and previous values with
 * change percentages for trend analysis. Indexed by indicator ID and category
 * for efficient lookups.
 */
export const macroIndicators = pgTable("macro_indicators", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  indicatorId: text("indicator_id").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  latestValue: numeric("latest_value"),
  previousValue: numeric("previous_value"),
  changePercent: numeric("change_percent"),
  frequency: text("frequency"),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  source: text("source").notNull().default("FRED"),
  rawJson: jsonb("raw_json"),
}, (table) => [
  index("macro_indicators_category_idx").on(table.category),
  index("macro_indicators_indicator_id_idx").on(table.indicatorId),
]);

/**
 * Generic cache for external API responses.
 * Implements stale-while-revalidate caching strategy.
 *
 * @table external_api_cache_entries
 * @description Stores cached responses from external APIs (market data, news, etc.)
 * with expiration and stale-until timestamps. Supports stale-while-revalidate pattern
 * for improved responsiveness. Tracks hit counts and last access for cache analytics.
 */
export const externalApiCacheEntries = pgTable("external_api_cache_entries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  provider: text("provider").notNull(),
  cacheKey: text("cache_key").notNull(),
  responseJson: text("response_json").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  staleUntilAt: timestamp("stale_until_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  hitCount: integer("hit_count").default(0).notNull(),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow().notNull(),
});

/**
 * Aggregated usage metrics for external API calls.
 * Tracks request volumes, latency, and quota consumption.
 *
 * @table external_api_usage_counters
 * @description Stores windowed usage statistics for external API providers including
 * request counts, token usage, error rates, rate limit hits, cache performance,
 * and latency metrics. Used for quota management and cost optimization.
 */
export const externalApiUsageCounters = pgTable("external_api_usage_counters", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  provider: text("provider").notNull(),
  windowType: text("window_type").notNull(),
  windowStart: timestamp("window_start").notNull(),
  windowEnd: timestamp("window_end").notNull(),
  requestCount: integer("request_count").default(0).notNull(),
  tokenCount: integer("token_count").default(0),
  errorCount: integer("error_count").default(0).notNull(),
  rateLimitHits: integer("rate_limit_hits").default(0).notNull(),
  cacheHits: integer("cache_hits").default(0).notNull(),
  cacheMisses: integer("cache_misses").default(0).notNull(),
  avgLatencyMs: numeric("avg_latency_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Valyu API retrieval quota tracking.
 * Monitors usage of Valyu financial data retrieval limits.
 *
 * @table valyu_retrieval_counters
 * @description Tracks monthly retrieval quotas for Valyu API by source tier.
 * Prevents exceeding API limits and enables usage monitoring. Organized by
 * month and tier for granular quota management.
 */
export const valyuRetrievalCounters = pgTable("valyu_retrieval_counters", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sourceTier: text("source_tier").notNull(),
  monthKey: text("month_key").notNull(),
  retrievalCount: integer("retrieval_count").default(0).notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// Insert schemas
export const insertMacroIndicatorsSchema = createInsertSchema(macroIndicators).omit({
  id: true,
  lastUpdatedAt: true,
});

export const insertExternalApiCacheEntrySchema = createInsertSchema(externalApiCacheEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  hitCount: true,
  lastAccessedAt: true,
});

export const insertExternalApiUsageCounterSchema = createInsertSchema(externalApiUsageCounters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertValyuRetrievalCounterSchema = createInsertSchema(valyuRetrievalCounters).omit({
  id: true,
  lastUpdated: true,
});

// Types
export type InsertMacroIndicators = z.infer<typeof insertMacroIndicatorsSchema>;
export type MacroIndicators = typeof macroIndicators.$inferSelect;

export type InsertExternalApiCacheEntry = typeof externalApiCacheEntries.$inferInsert;
export type ExternalApiCacheEntry = typeof externalApiCacheEntries.$inferSelect;

export type InsertExternalApiUsageCounter = typeof externalApiUsageCounters.$inferInsert;
export type ExternalApiUsageCounter = typeof externalApiUsageCounters.$inferSelect;

export type InsertValyuRetrievalCounter = typeof valyuRetrievalCounters.$inferInsert;
export type ValyuRetrievalCounter = typeof valyuRetrievalCounters.$inferSelect;
