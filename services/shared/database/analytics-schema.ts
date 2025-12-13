/**
 * AI Active Trader - Analytics Service Database Schema
 * Schema for performance metrics, reports, and aggregated data
 */

import { sql } from 'drizzle-orm';
import { pgTable, pgSchema, varchar, text, numeric, timestamp, boolean, integer, jsonb, date } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const analyticsSchema = pgSchema('analytics');

export const performanceMetrics = analyticsSchema.table('performance_metrics', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar('strategy_id'),
  userId: varchar('user_id'),
  period: text('period').notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  totalPnl: numeric('total_pnl').default('0'),
  totalPnlPercent: numeric('total_pnl_percent').default('0'),
  realizedPnl: numeric('realized_pnl').default('0'),
  unrealizedPnl: numeric('unrealized_pnl').default('0'),
  totalTrades: integer('total_trades').default(0),
  winningTrades: integer('winning_trades').default(0),
  losingTrades: integer('losing_trades').default(0),
  winRate: numeric('win_rate'),
  profitFactor: numeric('profit_factor'),
  avgWin: numeric('avg_win'),
  avgLoss: numeric('avg_loss'),
  largestWin: numeric('largest_win'),
  largestLoss: numeric('largest_loss'),
  avgHoldingTime: integer('avg_holding_time'),
  sharpeRatio: numeric('sharpe_ratio'),
  sortinoRatio: numeric('sortino_ratio'),
  calmarRatio: numeric('calmar_ratio'),
  maxDrawdown: numeric('max_drawdown'),
  maxDrawdownPercent: numeric('max_drawdown_percent'),
  maxDrawdownDuration: integer('max_drawdown_duration'),
  volatility: numeric('volatility'),
  beta: numeric('beta'),
  alpha: numeric('alpha'),
  avgExposure: numeric('avg_exposure'),
  maxExposure: numeric('max_exposure'),
  totalFees: numeric('total_fees').default('0'),
  calculatedAt: timestamp('calculated_at').defaultNow().notNull(),
});

export const dailySummaries = analyticsSchema.table('daily_summaries', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar('strategy_id'),
  userId: varchar('user_id'),
  date: date('date').notNull(),
  openingBalance: numeric('opening_balance'),
  closingBalance: numeric('closing_balance'),
  highBalance: numeric('high_balance'),
  lowBalance: numeric('low_balance'),
  dayPnl: numeric('day_pnl').default('0'),
  dayPnlPercent: numeric('day_pnl_percent').default('0'),
  tradesOpened: integer('trades_opened').default(0),
  tradesClosed: integer('trades_closed').default(0),
  winningTrades: integer('winning_trades').default(0),
  losingTrades: integer('losing_trades').default(0),
  grossProfit: numeric('gross_profit').default('0'),
  grossLoss: numeric('gross_loss').default('0'),
  fees: numeric('fees').default('0'),
  maxDrawdown: numeric('max_drawdown'),
  positionsHeld: integer('positions_held'),
  avgPositionSize: numeric('avg_position_size'),
  topSymbol: text('top_symbol'),
  worstSymbol: text('worst_symbol'),
  marketCondition: text('market_condition'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const symbolPerformance = analyticsSchema.table('symbol_performance', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar('strategy_id'),
  userId: varchar('user_id'),
  symbol: text('symbol').notNull(),
  period: text('period').notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  totalTrades: integer('total_trades').default(0),
  winningTrades: integer('winning_trades').default(0),
  losingTrades: integer('losing_trades').default(0),
  winRate: numeric('win_rate'),
  totalPnl: numeric('total_pnl').default('0'),
  avgPnl: numeric('avg_pnl'),
  avgWin: numeric('avg_win'),
  avgLoss: numeric('avg_loss'),
  avgHoldingTime: integer('avg_holding_time'),
  avgEntrySlippage: numeric('avg_entry_slippage'),
  avgExitSlippage: numeric('avg_exit_slippage'),
  totalVolume: numeric('total_volume'),
  totalFees: numeric('total_fees').default('0'),
  profitFactor: numeric('profit_factor'),
  calculatedAt: timestamp('calculated_at').defaultNow().notNull(),
});

export const tradeAnalytics = analyticsSchema.table('trade_analytics', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar('order_id'),
  positionId: varchar('position_id'),
  decisionId: varchar('decision_id'),
  symbol: text('symbol').notNull(),
  side: text('side').notNull(),
  entryPrice: numeric('entry_price').notNull(),
  exitPrice: numeric('exit_price'),
  quantity: numeric('quantity').notNull(),
  realizedPnl: numeric('realized_pnl'),
  realizedPnlPercent: numeric('realized_pnl_percent'),
  holdingTimeMs: integer('holding_time_ms'),
  entrySlippage: numeric('entry_slippage'),
  exitSlippage: numeric('exit_slippage'),
  fees: numeric('fees').default('0'),
  maxFavorableExcursion: numeric('max_favorable_excursion'),
  maxAdverseExcursion: numeric('max_adverse_excursion'),
  rMultiple: numeric('r_multiple'),
  riskRewardActual: numeric('risk_reward_actual'),
  exitReason: text('exit_reason'),
  marketConditionAtEntry: text('market_condition_at_entry'),
  marketConditionAtExit: text('market_condition_at_exit'),
  volatilityAtEntry: numeric('volatility_at_entry'),
  volumeAtEntry: numeric('volume_at_entry'),
  dayOfWeek: integer('day_of_week'),
  hourOfDay: integer('hour_of_day'),
  strategyId: varchar('strategy_id'),
  userId: varchar('user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
});

export const reports = analyticsSchema.table('reports', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar('strategy_id'),
  userId: varchar('user_id'),
  reportType: text('report_type').notNull(),
  period: text('period').notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  title: text('title').notNull(),
  summary: text('summary'),
  data: jsonb('data'),
  charts: jsonb('charts'),
  insights: jsonb('insights'),
  recommendations: jsonb('recommendations'),
  status: text('status').default('generated'),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
});

export const insertPerformanceMetricsSchema = createInsertSchema(performanceMetrics).omit({
  id: true,
  calculatedAt: true,
});

export const insertDailySummarySchema = createInsertSchema(dailySummaries).omit({
  id: true,
  createdAt: true,
});

export const insertTradeAnalyticsSchema = createInsertSchema(tradeAnalytics).omit({
  id: true,
  createdAt: true,
});

export type InsertPerformanceMetrics = z.infer<typeof insertPerformanceMetricsSchema>;
export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;

export type InsertDailySummary = z.infer<typeof insertDailySummarySchema>;
export type DailySummary = typeof dailySummaries.$inferSelect;

export type InsertTradeAnalytics = z.infer<typeof insertTradeAnalyticsSchema>;
export type TradeAnalytics = typeof tradeAnalytics.$inferSelect;

export type SymbolPerformance = typeof symbolPerformance.$inferSelect;
export type Report = typeof reports.$inferSelect;
