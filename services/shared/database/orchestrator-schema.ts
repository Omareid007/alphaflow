/**
 * AI Active Trader - Orchestrator Service Database Schema
 * Schema for trading cycles, sagas, schedules, and coordination
 */

import { sql } from 'drizzle-orm';
import { pgTable, pgSchema, varchar, text, numeric, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const orchestratorSchema = pgSchema('orchestrator');

export const strategies = orchestratorSchema.table('strategies', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  type: text('type').notNull(),
  description: text('description'),
  version: text('version').default('1.0.0'),
  isActive: boolean('is_active').default(false),
  isPaused: boolean('is_paused').default(false),
  userId: varchar('user_id'),
  assets: text('assets').array(),
  timeframe: text('timeframe').default('1h'),
  parameters: jsonb('parameters'),
  riskConfig: jsonb('risk_config'),
  entryConditions: jsonb('entry_conditions'),
  exitConditions: jsonb('exit_conditions'),
  schedule: jsonb('schedule'),
  maxConcurrentPositions: integer('max_concurrent_positions').default(5),
  maxDailyTrades: integer('max_daily_trades').default(20),
  startedAt: timestamp('started_at'),
  lastCycleAt: timestamp('last_cycle_at'),
  totalCycles: integer('total_cycles').default(0),
  totalTrades: integer('total_trades').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tradingCycles = orchestratorSchema.table('trading_cycles', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar('strategy_id').references(() => strategies.id),
  cycleType: text('cycle_type').notNull(),
  status: text('status').default('pending').notNull(),
  symbols: text('symbols').array(),
  marketDataFetched: boolean('market_data_fetched').default(false),
  newsFetched: boolean('news_fetched').default(false),
  aiDecisionsMade: boolean('ai_decisions_made').default(false),
  ordersExecuted: boolean('orders_executed').default(false),
  decisionsCount: integer('decisions_count').default(0),
  ordersCount: integer('orders_count').default(0),
  errorsCount: integer('errors_count').default(0),
  marketCondition: text('market_condition'),
  duration: integer('duration'),
  steps: jsonb('steps'),
  errors: jsonb('errors'),
  metadata: jsonb('metadata'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const sagas = orchestratorSchema.table('sagas', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  sagaType: text('saga_type').notNull(),
  correlationId: varchar('correlation_id').notNull(),
  status: text('status').default('started').notNull(),
  currentStep: text('current_step'),
  completedSteps: text('completed_steps').array(),
  failedStep: text('failed_step'),
  compensatedSteps: text('compensated_steps').array(),
  context: jsonb('context'),
  result: jsonb('result'),
  error: text('error'),
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  expiresAt: timestamp('expires_at'),
});

export const sagaSteps = orchestratorSchema.table('saga_steps', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  sagaId: varchar('saga_id').notNull().references(() => sagas.id),
  stepName: text('step_name').notNull(),
  stepOrder: integer('step_order').notNull(),
  status: text('status').default('pending').notNull(),
  input: jsonb('input'),
  output: jsonb('output'),
  error: text('error'),
  compensationStatus: text('compensation_status'),
  compensationError: text('compensation_error'),
  duration: integer('duration'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
});

export const schedules = orchestratorSchema.table('schedules', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar('strategy_id').references(() => strategies.id),
  name: text('name').notNull(),
  scheduleType: text('schedule_type').notNull(),
  cronExpression: text('cron_expression'),
  intervalMs: integer('interval_ms'),
  timezone: text('timezone').default('UTC'),
  isActive: boolean('is_active').default(true),
  lastRunAt: timestamp('last_run_at'),
  nextRunAt: timestamp('next_run_at'),
  totalRuns: integer('total_runs').default(0),
  successfulRuns: integer('successful_runs').default(0),
  failedRuns: integer('failed_runs').default(0),
  config: jsonb('config'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const systemState = orchestratorSchema.table('system_state', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  component: text('component').notNull(),
  isRunning: boolean('is_running').default(false),
  isPaused: boolean('is_paused').default(false),
  killSwitchActive: boolean('kill_switch_active').default(false),
  lastHeartbeat: timestamp('last_heartbeat'),
  lastError: text('last_error'),
  lastErrorAt: timestamp('last_error_at'),
  metrics: jsonb('metrics'),
  config: jsonb('config'),
  version: text('version'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const events = orchestratorSchema.table('events', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  eventType: text('event_type').notNull(),
  source: text('source').notNull(),
  correlationId: varchar('correlation_id'),
  aggregateId: varchar('aggregate_id'),
  aggregateType: text('aggregate_type'),
  version: integer('version').default(1),
  payload: jsonb('payload'),
  metadata: jsonb('metadata'),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertStrategySchema = createInsertSchema(strategies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTradingCycleSchema = createInsertSchema(tradingCycles).omit({
  id: true,
  startedAt: true,
});

export const insertSagaSchema = createInsertSchema(sagas).omit({
  id: true,
  startedAt: true,
});

export const insertScheduleSchema = createInsertSchema(schedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStrategy = z.infer<typeof insertStrategySchema>;
export type Strategy = typeof strategies.$inferSelect;

export type InsertTradingCycle = z.infer<typeof insertTradingCycleSchema>;
export type TradingCycle = typeof tradingCycles.$inferSelect;

export type InsertSaga = z.infer<typeof insertSagaSchema>;
export type Saga = typeof sagas.$inferSelect;

export type SagaStep = typeof sagaSteps.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type SystemState = typeof systemState.$inferSelect;
export type Event = typeof events.$inferSelect;
