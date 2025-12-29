/**
 * @module schema/backtest
 * @description Backtesting system schema for historical strategy simulation.
 * Enables testing trading strategies against historical market data to evaluate
 * performance metrics before live deployment. Includes support for realistic
 * fees, slippage, and execution modeling.
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { strategies } from "./trading";

// ============================================================================
// BACKTEST ENUMS
// ============================================================================

/**
 * Lifecycle status of a backtest run.
 *
 * @enum {string}
 * @property {string} QUEUED - Backtest is queued for execution
 * @property {string} RUNNING - Backtest is currently executing
 * @property {string} DONE - Backtest completed successfully
 * @property {string} FAILED - Backtest failed due to error
 */
export const backtestStatuses = ['QUEUED', 'RUNNING', 'DONE', 'FAILED'] as const;
export type BacktestStatusType = typeof backtestStatuses[number];

/**
 * Rules for determining trade execution prices in backtests.
 *
 * @enum {string}
 * @property {string} NEXT_OPEN - Execute at next bar's open price (realistic)
 * @property {string} NEXT_CLOSE - Execute at next bar's close price (optimistic)
 */
export const executionPriceRules = ['NEXT_OPEN', 'NEXT_CLOSE'] as const;
export type ExecutionPriceRuleType = typeof executionPriceRules[number];

// ============================================================================
// BACKTEST TABLES
// ============================================================================

/**
 * Backtest run configurations and results.
 * Stores complete backtest setup and performance summary.
 *
 * @table backtest_runs
 * @description Records backtest executions including strategy configuration,
 * universe, timeframe, cost models, and summary results. Supports provenance
 * tracking to link results back to strategy versions.
 *
 * @relation strategies - The strategy being backtested (set null on delete)
 */
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

/**
 * Individual trade events that occurred during backtests.
 * Records each simulated trade with full details.
 *
 * @table backtest_trade_events
 * @description Stores every trade executed during a backtest including timing,
 * symbol, side, quantity, price, fees, slippage, and resulting position/cash.
 * Essential for analyzing trade-by-trade behavior and strategy mechanics.
 *
 * @relation backtestRuns - Parent backtest run (cascade delete)
 */
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

/**
 * Time-series equity curve data for backtests.
 * Tracks portfolio value over time during the backtest period.
 *
 * @table backtest_equity_curve
 * @description Stores periodic snapshots of portfolio equity, cash, and exposure
 * throughout a backtest run. Used to calculate drawdowns, visualize performance,
 * and analyze portfolio dynamics.
 *
 * @relation backtestRuns - Parent backtest run (cascade delete)
 */
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
