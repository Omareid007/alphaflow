import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, numeric, jsonb, integer, boolean, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { aiDecisions } from "./ai-decisions";
import { aiTradeOutcomes } from "./ai-decisions";

// Data Source Analysis - Store analysis results from each connector
export const dataSourceAnalysis = pgTable("data_source_analysis", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  decisionId: varchar("decision_id").references(() => aiDecisions.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  source: text("source").notNull(), // finra, sec-edgar, finnhub, fred, frankfurter, etc.
  analysisType: text("analysis_type").notNull(), // short_interest, insider_activity, fundamentals, macro, forex
  dataJson: jsonb("data_json").notNull(), // Raw analysis data
  score: numeric("score"), // Normalized score (-1 to 1 or 0 to 100)
  signal: text("signal"), // bullish, bearish, neutral
  confidence: numeric("confidence"), // 0 to 1
  reliability: numeric("reliability"), // Source reliability weight
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("data_source_analysis_decision_id_idx").on(table.decisionId),
  index("data_source_analysis_symbol_idx").on(table.symbol),
  index("data_source_analysis_source_idx").on(table.source),
  index("data_source_analysis_created_at_idx").on(table.createdAt),
]);

// Short Interest Analysis - FINRA RegSHO data for each symbol
export const shortInterestAnalysis = pgTable("short_interest_analysis", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  shortRatio: numeric("short_ratio").notNull(), // Short volume / Total volume
  shortVolume: numeric("short_volume"),
  totalVolume: numeric("total_volume"),
  daysToCover: numeric("days_to_cover"),
  shortRatioTrend: text("short_ratio_trend"), // increasing, decreasing, stable
  squeezePotential: text("squeeze_potential"), // high, medium, low
  averageShortRatio: numeric("average_short_ratio"), // 20-day average
  analysisDate: timestamp("analysis_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("short_interest_symbol_idx").on(table.symbol),
  index("short_interest_date_idx").on(table.analysisDate),
  unique("short_interest_symbol_date_unique").on(table.symbol, table.analysisDate),
]);

// Insider Activity Analysis - SEC EDGAR Form 4 data
export const insiderActivityAnalysis = pgTable("insider_activity_analysis", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  totalBuys: numeric("total_buys").default("0"),
  totalSells: numeric("total_sells").default("0"),
  netActivity: numeric("net_activity").default("0"), // Buys - Sells (shares)
  netValue: numeric("net_value").default("0"), // Dollar value
  buyToSellRatio: numeric("buy_to_sell_ratio"),
  sentiment: text("sentiment"), // bullish, bearish, neutral
  recentTransactionsJson: jsonb("recent_transactions_json"), // Last 10 transactions
  analysisWindowDays: integer("analysis_window_days").default(90),
  analysisDate: timestamp("analysis_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("insider_activity_symbol_idx").on(table.symbol),
  index("insider_activity_date_idx").on(table.analysisDate),
  unique("insider_activity_symbol_date_unique").on(table.symbol, table.analysisDate),
]);

// Macro Analysis - FRED economic indicators
export const macroAnalysis = pgTable("macro_analysis", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  vix: numeric("vix"),
  fedFundsRate: numeric("fed_funds_rate"),
  yieldCurve: numeric("yield_curve"), // 10Y-2Y spread
  inflation: numeric("inflation"), // CPI
  unemployment: numeric("unemployment"),
  marketRegime: text("market_regime"), // risk_on, risk_off, neutral
  indicatorsJson: jsonb("indicators_json"), // All FRED indicators
  analysisDate: timestamp("analysis_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("macro_analysis_date_idx").on(table.analysisDate),
  unique("macro_analysis_date_unique").on(table.analysisDate),
]);

// Analysis Feedback - Track how analysis signals correlated with trade outcomes
export const analysisFeedback = pgTable("analysis_feedback", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  dataSourceAnalysisId: varchar("data_source_analysis_id").references(() => dataSourceAnalysis.id, { onDelete: "cascade" }),
  tradeOutcomeId: varchar("trade_outcome_id").references(() => aiTradeOutcomes.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  source: text("source").notNull(),
  signalAtEntry: text("signal_at_entry"), // The signal when trade was entered
  confidenceAtEntry: numeric("confidence_at_entry"),
  tradeResult: text("trade_result"), // win, loss
  pnlPercent: numeric("pnl_percent"),
  signalAccuracy: boolean("signal_accuracy"), // Did signal predict correctly?
  holdingTimeMs: integer("holding_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("analysis_feedback_source_idx").on(table.source),
  index("analysis_feedback_symbol_idx").on(table.symbol),
  index("analysis_feedback_created_at_idx").on(table.createdAt),
]);

// Insert schemas
export const insertDataSourceAnalysisSchema = createInsertSchema(dataSourceAnalysis).omit({
  id: true,
  createdAt: true,
});

export const insertShortInterestAnalysisSchema = createInsertSchema(shortInterestAnalysis).omit({
  id: true,
  createdAt: true,
});

export const insertInsiderActivityAnalysisSchema = createInsertSchema(insiderActivityAnalysis).omit({
  id: true,
  createdAt: true,
});

export const insertMacroAnalysisSchema = createInsertSchema(macroAnalysis).omit({
  id: true,
  createdAt: true,
});

export const insertAnalysisFeedbackSchema = createInsertSchema(analysisFeedback).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertDataSourceAnalysis = typeof dataSourceAnalysis.$inferInsert;
export type DataSourceAnalysis = typeof dataSourceAnalysis.$inferSelect;

export type InsertShortInterestAnalysis = typeof shortInterestAnalysis.$inferInsert;
export type ShortInterestAnalysis = typeof shortInterestAnalysis.$inferSelect;

export type InsertInsiderActivityAnalysis = typeof insiderActivityAnalysis.$inferInsert;
export type InsiderActivityAnalysis = typeof insiderActivityAnalysis.$inferSelect;

export type InsertMacroAnalysis = typeof macroAnalysis.$inferInsert;
export type MacroAnalysis = typeof macroAnalysis.$inferSelect;

export type InsertAnalysisFeedback = typeof analysisFeedback.$inferInsert;
export type AnalysisFeedback = typeof analysisFeedback.$inferSelect;
