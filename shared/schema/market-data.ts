import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, numeric, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
