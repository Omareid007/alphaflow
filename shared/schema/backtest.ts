import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { strategies } from "./trading";

// ============================================================================
// BACKTEST ENUMS
// ============================================================================

export const backtestStatuses = ['QUEUED', 'RUNNING', 'DONE', 'FAILED'] as const;
export type BacktestStatusType = typeof backtestStatuses[number];

export const executionPriceRules = ['NEXT_OPEN', 'NEXT_CLOSE'] as const;
export type ExecutionPriceRuleType = typeof executionPriceRules[number];

// ============================================================================
// BACKTEST TABLES
// ============================================================================

export const backtestRuns = pgTable("backtest_runs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  status: text("status").default("QUEUED").notNull(),
  strategyId: varchar("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
  strategyConfigHash: text("strategy_config_hash").notNull(),
  strategyConfig: jsonb("strategy_config").notNull(),
  universe: text("universe").array().notNull(),
  broker: text("broker").notNull(),
  timeframe: text("timeframe").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  initialCash: numeric("initial_cash").notNull(),
  feesModel: jsonb("fees_model").notNull(),
  slippageModel: jsonb("slippage_model").notNull(),
  executionPriceRule: text("execution_price_rule").notNull(),
  dataSource: text("data_source").notNull(),
  provenance: jsonb("provenance"),
  resultsSummary: jsonb("results_summary"),
  errorMessage: text("error_message"),
  runtimeMs: integer("runtime_ms"),
}, (table) => [
  index("backtest_runs_status_idx").on(table.status),
  index("backtest_runs_strategy_id_idx").on(table.strategyId),
  index("backtest_runs_created_at_idx").on(table.createdAt),
]);

export const backtestTradeEvents = pgTable("backtest_trade_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  runId: varchar("run_id").references(() => backtestRuns.id, { onDelete: "cascade" }).notNull(),
  ts: timestamp("ts").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  qty: numeric("qty").notNull(),
  price: numeric("price").notNull(),
  reason: text("reason").notNull(),
  orderType: text("order_type").notNull(),
  fees: numeric("fees").notNull(),
  slippage: numeric("slippage").notNull(),
  positionAfter: numeric("position_after").notNull(),
  cashAfter: numeric("cash_after").notNull(),
}, (table) => [
  index("backtest_trade_events_run_id_idx").on(table.runId),
  index("backtest_trade_events_ts_idx").on(table.ts),
  index("backtest_trade_events_symbol_idx").on(table.symbol),
]);

export const backtestEquityCurve = pgTable("backtest_equity_curve", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  runId: varchar("run_id").references(() => backtestRuns.id, { onDelete: "cascade" }).notNull(),
  ts: timestamp("ts").notNull(),
  equity: numeric("equity").notNull(),
  cash: numeric("cash").notNull(),
  exposure: numeric("exposure").notNull(),
}, (table) => [
  index("backtest_equity_curve_run_id_idx").on(table.runId),
  index("backtest_equity_curve_ts_idx").on(table.ts),
]);

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

export const insertBacktestRunSchema = createInsertSchema(backtestRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBacktestTradeEventSchema = createInsertSchema(backtestTradeEvents).omit({
  id: true,
});

export const insertBacktestEquityCurveSchema = createInsertSchema(backtestEquityCurve).omit({
  id: true,
});

// ============================================================================
// TYPES
// ============================================================================

export type InsertBacktestRun = z.infer<typeof insertBacktestRunSchema>;
export type BacktestRun = typeof backtestRuns.$inferSelect;

export type InsertBacktestTradeEvent = z.infer<typeof insertBacktestTradeEventSchema>;
export type BacktestTradeEvent = typeof backtestTradeEvents.$inferSelect;

export type InsertBacktestEquityCurve = z.infer<typeof insertBacktestEquityCurveSchema>;
export type BacktestEquityCurve = typeof backtestEquityCurve.$inferSelect;
