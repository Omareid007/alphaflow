import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, numeric, boolean, integer, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

// ============================================================================
// ENUMS
// ============================================================================

export type CandidateStatus = "NEW" | "WATCHLISTED" | "APPROVED" | "REJECTED";
export type LiquidityTier = "A" | "B" | "C";
export type MarketCapTier = "mega" | "large" | "mid" | "small" | "micro";
export type VolatilityTier = "high" | "medium" | "low";
export type TrendStrength = "strong_up" | "weak_up" | "neutral" | "weak_down" | "strong_down";
export type AssetClassType =
  | "large_cap_growth"
  | "large_cap_value"
  | "mid_cap_growth"
  | "mid_cap_value"
  | "small_cap"
  | "crypto_major"
  | "crypto_alt"
  | "etf_index"
  | "etf_sector";

// ============================================================================
// TABLES
// ============================================================================

export const universeAssets = pgTable("universe_assets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  exchange: text("exchange").notNull(),
  assetClass: text("asset_class").notNull(),
  status: text("status").notNull(),
  tradable: boolean("tradable").default(false).notNull(),
  marginable: boolean("marginable").default(false).notNull(),
  shortable: boolean("shortable").default(false).notNull(),
  fractionable: boolean("fractionable").default(false).notNull(),
  easyToBorrow: boolean("easy_to_borrow").default(false).notNull(),
  isOtc: boolean("is_otc").default(false).notNull(),
  isSpac: boolean("is_spac").default(false).notNull(),
  isPennyStock: boolean("is_penny_stock").default(false).notNull(),
  excluded: boolean("excluded").default(false).notNull(),
  excludeReason: text("exclude_reason"),
  lastRefreshedAt: timestamp("last_refreshed_at").defaultNow().notNull(),
  rawJson: jsonb("raw_json"),
}, (table) => [
  index("universe_assets_symbol_idx").on(table.symbol),
  index("universe_assets_tradable_idx").on(table.tradable),
  index("universe_assets_exchange_idx").on(table.exchange),
]);

export const universeLiquidityMetrics = pgTable("universe_liquidity_metrics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  avgDailyVolumeShares: numeric("avg_daily_volume_shares"),
  avgDailyTradedValueUsd: numeric("avg_daily_traded_value_usd"),
  avgBidAskSpreadPct: numeric("avg_bid_ask_spread_pct"),
  latestPrice: numeric("latest_price"),
  priceDataDays: integer("price_data_days").default(30),
  liquidityTier: text("liquidity_tier"),
  source: text("source").notNull(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  rawJson: jsonb("raw_json"),
}, (table) => [
  index("universe_liquidity_symbol_idx").on(table.symbol),
  index("universe_liquidity_tier_idx").on(table.liquidityTier),
]);

export const universeFundamentals = pgTable("universe_fundamentals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  marketCap: numeric("market_cap"),
  revenueTtm: numeric("revenue_ttm"),
  revenueCagr3y: numeric("revenue_cagr_3y"),
  grossMargin: numeric("gross_margin"),
  operatingMargin: numeric("operating_margin"),
  netMargin: numeric("net_margin"),
  freeCashFlowMargin: numeric("free_cash_flow_margin"),
  debtToEquity: numeric("debt_to_equity"),
  sharesDilution1y: numeric("shares_dilution_1y"),
  peRatio: numeric("pe_ratio"),
  priceToBook: numeric("price_to_book"),
  beta: numeric("beta"),
  week52High: numeric("week_52_high"),
  week52Low: numeric("week_52_low"),
  dividendYield: numeric("dividend_yield"),
  sector: text("sector"),
  industry: text("industry"),
  source: text("source").notNull(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  rawJson: jsonb("raw_json"),
}, (table) => [
  index("universe_fundamentals_symbol_idx").on(table.symbol),
  index("universe_fundamentals_sector_idx").on(table.sector),
]);

export const universeTechnicals = pgTable("universe_technicals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  date: timestamp("date").notNull(),
  open: numeric("open"),
  high: numeric("high"),
  low: numeric("low"),
  close: numeric("close"),
  volume: numeric("volume"),
  vwap: numeric("vwap"),
  sma20: numeric("sma_20"),
  sma50: numeric("sma_50"),
  sma200: numeric("sma_200"),
  ema12: numeric("ema_12"),
  ema26: numeric("ema_26"),
  rsi14: numeric("rsi_14"),
  macd: numeric("macd"),
  macdSignal: numeric("macd_signal"),
  macdHistogram: numeric("macd_histogram"),
  atr14: numeric("atr_14"),
  bollingerUpper: numeric("bollinger_upper"),
  bollingerLower: numeric("bollinger_lower"),
  adx14: numeric("adx_14"),
  plusDi: numeric("plus_di"),
  minusDi: numeric("minus_di"),
  pivotPoint: numeric("pivot_point"),
  resistance1: numeric("resistance_1"),
  support1: numeric("support_1"),
  source: text("source").notNull(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
}, (table) => [
  index("universe_technicals_symbol_idx").on(table.symbol),
  index("universe_technicals_date_idx").on(table.date),
  unique("universe_technicals_symbol_date_unique").on(table.symbol, table.date),
]);

export const assetClassifications = pgTable("asset_classifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  assetClass: text("asset_class"),
  marketCapTier: text("market_cap_tier"),
  liquidityTier: text("liquidity_tier"),
  volatilityTier: text("volatility_tier"),
  trendStrength: text("trend_strength"),
  momentumScore: numeric("momentum_score"),
  valueScore: numeric("value_score"),
  qualityScore: numeric("quality_score"),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  source: text("source").notNull(),
  rawJson: jsonb("raw_json"),
}, (table) => [
  index("asset_classifications_symbol_idx").on(table.symbol),
  index("asset_classifications_asset_class_idx").on(table.assetClass),
  index("asset_classifications_market_cap_tier_idx").on(table.marketCapTier),
]);

export const universeCandidates = pgTable("universe_candidates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  tier: text("tier").notNull(),
  liquidityScore: numeric("liquidity_score"),
  growthScore: numeric("growth_score"),
  qualityScore: numeric("quality_score"),
  finalScore: numeric("final_score"),
  themeTags: jsonb("theme_tags"),
  rationale: text("rationale"),
  status: text("status").notNull().default("NEW"),
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  traceId: text("trace_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("universe_candidates_symbol_idx").on(table.symbol),
  index("universe_candidates_status_idx").on(table.status),
  index("universe_candidates_tier_idx").on(table.tier),
  index("universe_candidates_final_score_idx").on(table.finalScore),
]);

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

export const insertUniverseAssetSchema = createInsertSchema(universeAssets).omit({
  id: true,
  lastRefreshedAt: true,
});

export const insertUniverseLiquiditySchema = createInsertSchema(universeLiquidityMetrics).omit({
  id: true,
  lastUpdatedAt: true,
});

export const insertUniverseFundamentalsSchema = createInsertSchema(universeFundamentals).omit({
  id: true,
  lastUpdatedAt: true,
});

export const insertUniverseTechnicalsSchema = createInsertSchema(universeTechnicals).omit({
  id: true,
  lastUpdatedAt: true,
});

export const insertAssetClassificationSchema = createInsertSchema(assetClassifications).omit({
  id: true,
  lastUpdatedAt: true,
});

export const insertUniverseCandidateSchema = createInsertSchema(universeCandidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// TYPES
// ============================================================================

export type InsertUniverseAsset = z.infer<typeof insertUniverseAssetSchema>;
export type UniverseAsset = typeof universeAssets.$inferSelect;

export type InsertUniverseLiquidity = z.infer<typeof insertUniverseLiquiditySchema>;
export type UniverseLiquidity = typeof universeLiquidityMetrics.$inferSelect;

export type InsertUniverseFundamentals = z.infer<typeof insertUniverseFundamentalsSchema>;
export type UniverseFundamentals = typeof universeFundamentals.$inferSelect;

export type InsertUniverseTechnicals = z.infer<typeof insertUniverseTechnicalsSchema>;
export type UniverseTechnicals = typeof universeTechnicals.$inferSelect;

export type InsertAssetClassification = z.infer<typeof insertAssetClassificationSchema>;
export type AssetClassification = typeof assetClassifications.$inferSelect;

export type InsertUniverseCandidate = z.infer<typeof insertUniverseCandidateSchema>;
export type UniverseCandidate = typeof universeCandidates.$inferSelect;
