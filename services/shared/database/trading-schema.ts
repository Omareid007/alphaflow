/**
 * AI Active Trader - Trading Engine Database Schema
 * Schema for orders, positions, and execution tracking
 */

import { sql } from 'drizzle-orm';
import { pgTable, pgSchema, varchar, text, numeric, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const tradingSchema = pgSchema('trading');

export const orders = tradingSchema.table('orders', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  externalId: varchar('external_id'),
  symbol: text('symbol').notNull(),
  side: text('side').notNull(),
  orderType: text('order_type').notNull(),
  quantity: numeric('quantity').notNull(),
  limitPrice: numeric('limit_price'),
  stopPrice: numeric('stop_price'),
  filledQuantity: numeric('filled_quantity').default('0'),
  filledPrice: numeric('filled_price'),
  status: text('status').notNull().default('pending'),
  timeInForce: text('time_in_force').default('day'),
  stopLoss: numeric('stop_loss'),
  takeProfit: numeric('take_profit'),
  decisionId: varchar('decision_id'),
  strategyId: varchar('strategy_id'),
  userId: varchar('user_id'),
  broker: text('broker').default('paper'),
  fees: numeric('fees').default('0'),
  slippage: numeric('slippage'),
  metadata: jsonb('metadata'),
  errorMessage: text('error_message'),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  filledAt: timestamp('filled_at'),
  canceledAt: timestamp('canceled_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orderExecutions = tradingSchema.table('order_executions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar('order_id').notNull().references(() => orders.id),
  executionId: varchar('execution_id'),
  quantity: numeric('quantity').notNull(),
  price: numeric('price').notNull(),
  fees: numeric('fees').default('0'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  venue: text('venue'),
  metadata: jsonb('metadata'),
});

export const positions = tradingSchema.table('positions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  symbol: text('symbol').notNull(),
  side: text('side').notNull(),
  quantity: numeric('quantity').notNull(),
  entryPrice: numeric('entry_price').notNull(),
  currentPrice: numeric('current_price'),
  unrealizedPnl: numeric('unrealized_pnl'),
  unrealizedPnlPercent: numeric('unrealized_pnl_percent'),
  realizedPnl: numeric('realized_pnl').default('0'),
  totalFees: numeric('total_fees').default('0'),
  stopLoss: numeric('stop_loss'),
  takeProfit: numeric('take_profit'),
  trailingStop: numeric('trailing_stop'),
  strategyId: varchar('strategy_id'),
  userId: varchar('user_id'),
  broker: text('broker').default('paper'),
  status: text('status').default('open').notNull(),
  entryOrderId: varchar('entry_order_id').references(() => orders.id),
  exitOrderId: varchar('exit_order_id').references(() => orders.id),
  metadata: jsonb('metadata'),
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
  lastUpdatedAt: timestamp('last_updated_at').defaultNow().notNull(),
});

export const portfolioSnapshots = tradingSchema.table('portfolio_snapshots', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id'),
  strategyId: varchar('strategy_id'),
  cashBalance: numeric('cash_balance').notNull(),
  positionsValue: numeric('positions_value').notNull(),
  totalEquity: numeric('total_equity').notNull(),
  unrealizedPnl: numeric('unrealized_pnl').default('0'),
  realizedPnl: numeric('realized_pnl').default('0'),
  dayPnl: numeric('day_pnl').default('0'),
  dayPnlPercent: numeric('day_pnl_percent').default('0'),
  openPositionsCount: integer('open_positions_count').default(0),
  marginUsed: numeric('margin_used').default('0'),
  buyingPower: numeric('buying_power'),
  snapshotTime: timestamp('snapshot_time').defaultNow().notNull(),
});

export const riskLimits = tradingSchema.table('risk_limits', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id'),
  strategyId: varchar('strategy_id'),
  maxPositionSizePercent: numeric('max_position_size_percent').default('10'),
  maxTotalExposurePercent: numeric('max_total_exposure_percent').default('50'),
  maxPositionsCount: integer('max_positions_count').default(10),
  dailyLossLimitPercent: numeric('daily_loss_limit_percent').default('5'),
  maxOrderValue: numeric('max_order_value'),
  minPositionHoldTime: integer('min_position_hold_time'),
  maxPositionHoldTime: integer('max_position_hold_time'),
  allowedSymbols: text('allowed_symbols').array(),
  blockedSymbols: text('blocked_symbols').array(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectOrderSchema = createSelectSchema(orders);

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  openedAt: true,
  lastUpdatedAt: true,
});

export const selectPositionSchema = createSelectSchema(positions);

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;

export type OrderExecution = typeof orderExecutions.$inferSelect;
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type RiskLimits = typeof riskLimits.$inferSelect;
