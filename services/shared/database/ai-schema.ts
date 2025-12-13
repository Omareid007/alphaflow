/**
 * AI Active Trader - AI Decision Service Database Schema
 * Schema for AI decisions, features, outcomes, and model tracking
 */

import { sql } from 'drizzle-orm';
import { pgTable, pgSchema, varchar, text, numeric, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const aiSchema = pgSchema('ai');

export const decisions = aiSchema.table('decisions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  symbol: text('symbol').notNull(),
  action: text('action').notNull(),
  confidence: numeric('confidence').notNull(),
  reasoning: text('reasoning'),
  strategyId: varchar('strategy_id'),
  cycleId: varchar('cycle_id'),
  modelId: varchar('model_id'),
  modelVersion: text('model_version'),
  provider: text('provider'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  latencyMs: integer('latency_ms'),
  marketContext: jsonb('market_context'),
  technicalSignals: jsonb('technical_signals'),
  sentimentData: jsonb('sentiment_data'),
  newsContext: jsonb('news_context'),
  suggestedEntryPrice: numeric('suggested_entry_price'),
  suggestedStopLoss: numeric('suggested_stop_loss'),
  suggestedTakeProfit: numeric('suggested_take_profit'),
  suggestedQuantity: numeric('suggested_quantity'),
  riskScore: numeric('risk_score'),
  status: text('status').default('pending').notNull(),
  executedOrderId: varchar('executed_order_id'),
  skipReason: text('skip_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  expiresAt: timestamp('expires_at'),
});

export const decisionFeatures = aiSchema.table('decision_features', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  decisionId: varchar('decision_id').notNull().references(() => decisions.id),
  symbol: text('symbol').notNull(),
  volatility: numeric('volatility'),
  trendStrength: numeric('trend_strength'),
  signalAgreement: numeric('signal_agreement'),
  sentimentScore: numeric('sentiment_score'),
  newsScore: numeric('news_score'),
  socialScore: numeric('social_score'),
  peRatio: numeric('pe_ratio'),
  pbRatio: numeric('pb_ratio'),
  rsi: numeric('rsi'),
  macd: numeric('macd'),
  macdSignal: text('macd_signal'),
  bollingerPosition: numeric('bollinger_position'),
  atr: numeric('atr'),
  volumeRatio: numeric('volume_ratio'),
  priceChange1h: numeric('price_change_1h'),
  priceChange24h: numeric('price_change_24h'),
  priceChange7d: numeric('price_change_7d'),
  marketCondition: text('market_condition'),
  sectorStrength: numeric('sector_strength'),
  dataQuality: numeric('data_quality'),
  activeSources: integer('active_sources'),
  featureVector: jsonb('feature_vector'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const decisionOutcomes = aiSchema.table('decision_outcomes', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  decisionId: varchar('decision_id').notNull().references(() => decisions.id),
  orderId: varchar('order_id'),
  positionId: varchar('position_id'),
  symbol: text('symbol').notNull(),
  action: text('action').notNull(),
  predictionConfidence: numeric('prediction_confidence'),
  entryPrice: numeric('entry_price'),
  exitPrice: numeric('exit_price'),
  quantity: numeric('quantity'),
  realizedPnl: numeric('realized_pnl'),
  realizedPnlPercent: numeric('realized_pnl_percent'),
  holdingTimeMs: integer('holding_time_ms'),
  isWin: boolean('is_win'),
  slippagePercent: numeric('slippage_percent'),
  targetPriceHit: boolean('target_price_hit'),
  stopLossHit: boolean('stop_loss_hit'),
  maxDrawdown: numeric('max_drawdown'),
  maxGain: numeric('max_gain'),
  marketSessionAtEntry: text('market_session_at_entry'),
  marketSessionAtExit: text('market_session_at_exit'),
  exitReason: text('exit_reason'),
  feedback: jsonb('feedback'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
});

export const modelVersions = aiSchema.table('model_versions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  modelId: varchar('model_id').notNull(),
  version: text('version').notNull(),
  provider: text('provider').notNull(),
  modelName: text('model_name').notNull(),
  config: jsonb('config'),
  promptTemplate: text('prompt_template'),
  systemPrompt: text('system_prompt'),
  temperature: numeric('temperature'),
  maxTokens: integer('max_tokens'),
  isActive: boolean('is_active').default(false),
  totalDecisions: integer('total_decisions').default(0),
  winRate: numeric('win_rate'),
  avgConfidence: numeric('avg_confidence'),
  avgLatencyMs: integer('avg_latency_ms'),
  totalTokensUsed: integer('total_tokens_used').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  activatedAt: timestamp('activated_at'),
  deactivatedAt: timestamp('deactivated_at'),
});

export const calibrationLogs = aiSchema.table('calibration_logs', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  calibrationType: text('calibration_type').notNull(),
  modelVersionId: varchar('model_version_id').references(() => modelVersions.id),
  dataWindowDays: integer('data_window_days').default(30),
  totalDecisions: integer('total_decisions'),
  winCount: integer('win_count'),
  lossCount: integer('loss_count'),
  avgConfidenceOnWins: numeric('avg_confidence_on_wins'),
  avgConfidenceOnLosses: numeric('avg_confidence_on_losses'),
  avgHoldingTimeWins: integer('avg_holding_time_wins'),
  avgHoldingTimeLosses: integer('avg_holding_time_losses'),
  topWinningSymbols: jsonb('top_winning_symbols'),
  topLosingSymbols: jsonb('top_losing_symbols'),
  confidenceCalibration: jsonb('confidence_calibration'),
  recommendedAdjustments: jsonb('recommended_adjustments'),
  appliedAdjustments: jsonb('applied_adjustments'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertDecisionSchema = createInsertSchema(decisions).omit({
  id: true,
  createdAt: true,
});

export const selectDecisionSchema = createSelectSchema(decisions);

export const insertDecisionFeaturesSchema = createInsertSchema(decisionFeatures).omit({
  id: true,
  createdAt: true,
});

export const insertDecisionOutcomesSchema = createInsertSchema(decisionOutcomes).omit({
  id: true,
  createdAt: true,
});

export type InsertDecision = z.infer<typeof insertDecisionSchema>;
export type Decision = typeof decisions.$inferSelect;

export type InsertDecisionFeatures = z.infer<typeof insertDecisionFeaturesSchema>;
export type DecisionFeatures = typeof decisionFeatures.$inferSelect;

export type InsertDecisionOutcomes = z.infer<typeof insertDecisionOutcomesSchema>;
export type DecisionOutcomes = typeof decisionOutcomes.$inferSelect;

export type ModelVersion = typeof modelVersions.$inferSelect;
export type CalibrationLog = typeof calibrationLogs.$inferSelect;
