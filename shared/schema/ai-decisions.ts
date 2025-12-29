import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, numeric, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./auth";
import { strategies, trades } from "./trading";

// ============================================================================
// AI DECISIONS TABLES
// ============================================================================

export const aiDecisions = pgTable("ai_decisions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  strategyId: varchar("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
  symbol: text("symbol").notNull(),
  action: text("action").notNull(),
  confidence: numeric("confidence"),
  reasoning: text("reasoning"),
  marketContext: text("market_context"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Note: executedTradeId references trades table - foreign key defined at database level
  executedTradeId: varchar("executed_trade_id"),
  status: text("status").default("pending").notNull(),
  stopLoss: numeric("stop_loss"),
  takeProfit: numeric("take_profit"),
  entryPrice: numeric("entry_price"),
  filledPrice: numeric("filled_price"),
  filledAt: timestamp("filled_at"),
  skipReason: text("skip_reason"),
  traceId: text("trace_id"),
  metadata: text("metadata"),
}, (table) => ({
  userIdIdx: index("ai_decisions_user_id_idx").on(table.userId),
}));

export const aiDecisionFeatures = pgTable("ai_decision_features", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  decisionId: varchar("decision_id").references(() => aiDecisions.id, { onDelete: "cascade" }).notNull(),
  symbol: text("symbol").notNull(),
  volatility: numeric("volatility"),
  trendStrength: numeric("trend_strength"),
  signalAgreement: numeric("signal_agreement"),
  sentimentScore: numeric("sentiment_score"),
  peRatio: numeric("pe_ratio"),
  pbRatio: numeric("pb_ratio"),
  rsi: numeric("rsi"),
  macdSignal: text("macd_signal"),
  volumeRatio: numeric("volume_ratio"),
  priceChangePercent: numeric("price_change_percent"),
  marketCondition: text("market_condition"),
  dataQuality: numeric("data_quality"),
  activeSources: integer("active_sources"),
  featureVector: text("feature_vector"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiTradeOutcomes = pgTable("ai_trade_outcomes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  decisionId: varchar("decision_id").references(() => aiDecisions.id, { onDelete: "cascade" }).notNull(),
  tradeId: varchar("trade_id").references(() => trades.id, { onDelete: "set null" }),
  symbol: text("symbol").notNull(),
  action: text("action").notNull(),
  predictionConfidence: numeric("prediction_confidence"),
  entryPrice: numeric("entry_price"),
  exitPrice: numeric("exit_price"),
  quantity: numeric("quantity"),
  realizedPnl: numeric("realized_pnl"),
  realizedPnlPercent: numeric("realized_pnl_percent"),
  holdingTimeMs: integer("holding_time_ms"),
  isWin: boolean("is_win"),
  slippagePercent: numeric("slippage_percent"),
  targetPriceHit: boolean("target_price_hit"),
  stopLossHit: boolean("stop_loss_hit"),
  maxDrawdown: numeric("max_drawdown"),
  maxGain: numeric("max_gain"),
  marketSessionAtEntry: text("market_session_at_entry"),
  marketSessionAtExit: text("market_session_at_exit"),
  strategyId: varchar("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
  exitReason: text("exit_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const aiCalibrationLog = pgTable("ai_calibration_log", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  calibrationType: text("calibration_type").notNull(),
  dataWindowDays: integer("data_window_days").default(30),
  totalDecisions: integer("total_decisions"),
  winCount: integer("win_count"),
  lossCount: integer("loss_count"),
  avgConfidenceOnWins: numeric("avg_confidence_on_wins"),
  avgConfidenceOnLosses: numeric("avg_confidence_on_losses"),
  avgHoldingTimeWins: integer("avg_holding_time_wins"),
  avgHoldingTimeLosses: integer("avg_holding_time_losses"),
  topWinningSymbols: text("top_winning_symbols"),
  topLosingSymbols: text("top_losing_symbols"),
  recommendedAdjustments: text("recommended_adjustments"),
  modelVersion: text("model_version"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

export const insertAiDecisionSchema = createInsertSchema(aiDecisions).omit({
  id: true,
  createdAt: true,
});

export const insertAiDecisionFeaturesSchema = createInsertSchema(aiDecisionFeatures).omit({
  id: true,
  createdAt: true,
});

export const insertAiTradeOutcomesSchema = createInsertSchema(aiTradeOutcomes).omit({
  id: true,
  createdAt: true,
});

export const insertAiCalibrationLogSchema = createInsertSchema(aiCalibrationLog).omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// TYPES
// ============================================================================

export type InsertAiDecision = typeof aiDecisions.$inferInsert;
export type AiDecision = typeof aiDecisions.$inferSelect;

export type InsertAiDecisionFeatures = typeof aiDecisionFeatures.$inferInsert;
export type AiDecisionFeatures = typeof aiDecisionFeatures.$inferSelect;

export type InsertAiTradeOutcomes = typeof aiTradeOutcomes.$inferInsert;
export type AiTradeOutcomes = typeof aiTradeOutcomes.$inferSelect;

export type InsertAiCalibrationLog = typeof aiCalibrationLog.$inferInsert;
export type AiCalibrationLog = typeof aiCalibrationLog.$inferSelect;
