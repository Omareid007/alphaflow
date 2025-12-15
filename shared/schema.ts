import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
});

export const strategies = pgTable("strategies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(false).notNull(),
  assets: text("assets").array(),
  parameters: text("parameters"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const trades = pgTable("trades", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").references(() => strategies.id),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  quantity: numeric("quantity").notNull(),
  price: numeric("price").notNull(),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  pnl: numeric("pnl"),
  status: text("status").default("completed").notNull(),
  notes: text("notes"),
});

export const positions = pgTable("positions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  quantity: numeric("quantity").notNull(),
  entryPrice: numeric("entry_price").notNull(),
  currentPrice: numeric("current_price"),
  unrealizedPnl: numeric("unrealized_pnl"),
  side: text("side").notNull(),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  strategyId: varchar("strategy_id").references(() => strategies.id),
});

export const aiDecisions = pgTable("ai_decisions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").references(() => strategies.id),
  symbol: text("symbol").notNull(),
  action: text("action").notNull(),
  confidence: numeric("confidence"),
  reasoning: text("reasoning"),
  marketContext: text("market_context"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  executedTradeId: varchar("executed_trade_id").references(() => trades.id),
  status: text("status").default("pending").notNull(),
  stopLoss: numeric("stop_loss"),
  takeProfit: numeric("take_profit"),
  entryPrice: numeric("entry_price"),
  filledPrice: numeric("filled_price"),
  filledAt: timestamp("filled_at"),
  skipReason: text("skip_reason"),
});

export const agentStatus = pgTable("agent_status", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  isRunning: boolean("is_running").default(false).notNull(),
  lastHeartbeat: timestamp("last_heartbeat"),
  totalTrades: integer("total_trades").default(0),
  totalPnl: numeric("total_pnl").default("0"),
  winRate: numeric("win_rate"),
  cashBalance: numeric("cash_balance").default("100000"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  killSwitchActive: boolean("kill_switch_active").default(false).notNull(),
  maxPositionSizePercent: numeric("max_position_size_percent").default("10"),
  maxTotalExposurePercent: numeric("max_total_exposure_percent").default("50"),
  maxPositionsCount: integer("max_positions_count").default(10),
  dailyLossLimitPercent: numeric("daily_loss_limit_percent").default("5"),
  dynamicOrderLimit: integer("dynamic_order_limit").default(10),
  minOrderLimit: integer("min_order_limit").default(10),
  maxOrderLimit: integer("max_order_limit").default(50),
  marketCondition: text("market_condition").default("neutral"),
  aiConfidenceScore: numeric("ai_confidence_score").default("0.5"),
  autoStartEnabled: boolean("auto_start_enabled").default(true).notNull(),
  lastMarketAnalysis: timestamp("last_market_analysis"),
});

export const aiDecisionFeatures = pgTable("ai_decision_features", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  decisionId: varchar("decision_id").references(() => aiDecisions.id).notNull(),
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
  decisionId: varchar("decision_id").references(() => aiDecisions.id).notNull(),
  tradeId: varchar("trade_id").references(() => trades.id),
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
  strategyId: varchar("strategy_id").references(() => strategies.id),
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isAdmin: true,
}).extend({
  isAdmin: z.boolean().optional(),
});

export const insertStrategySchema = createInsertSchema(strategies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  executedAt: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  openedAt: true,
});

export const insertAiDecisionSchema = createInsertSchema(aiDecisions).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertStrategy = z.infer<typeof insertStrategySchema>;
export type Strategy = typeof strategies.$inferSelect;

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;

export type InsertAiDecision = z.infer<typeof insertAiDecisionSchema>;
export type AiDecision = typeof aiDecisions.$inferSelect;

export type AgentStatus = typeof agentStatus.$inferSelect;

export type InsertAiDecisionFeatures = z.infer<typeof insertAiDecisionFeaturesSchema>;
export type AiDecisionFeatures = typeof aiDecisionFeatures.$inferSelect;

export type InsertAiTradeOutcomes = z.infer<typeof insertAiTradeOutcomesSchema>;
export type AiTradeOutcomes = typeof aiTradeOutcomes.$inferSelect;

export type InsertAiCalibrationLog = z.infer<typeof insertAiCalibrationLogSchema>;
export type AiCalibrationLog = typeof aiCalibrationLog.$inferSelect;

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

export type InsertExternalApiCacheEntry = z.infer<typeof insertExternalApiCacheEntrySchema>;
export type ExternalApiCacheEntry = typeof externalApiCacheEntries.$inferSelect;

export type InsertExternalApiUsageCounter = z.infer<typeof insertExternalApiUsageCounterSchema>;
export type ExternalApiUsageCounter = typeof externalApiUsageCounters.$inferSelect;
