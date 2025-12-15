import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
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
  traceId: text("trace_id"),
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
  traceId: text("trace_id"),
  metadata: text("metadata"),
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
  autoExecuteTrades: boolean("auto_execute_trades").default(false).notNull(),
  conservativeMode: boolean("conservative_mode").default(false).notNull(),
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

export const valyuRetrievalCounters = pgTable("valyu_retrieval_counters", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sourceTier: text("source_tier").notNull(),
  monthKey: text("month_key").notNull(),
  retrievalCount: integer("retrieval_count").default(0).notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
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

export const llmRoles = [
  "market_news_summarizer",
  "technical_analyst",
  "risk_manager",
  "execution_planner",
  "post_trade_reporter",
] as const;

export type LLMRole = typeof llmRoles[number];

export const llmRoleConfigs = pgTable("llm_role_configs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  role: text("role").notNull().unique(),
  description: text("description"),
  fallbackChain: text("fallback_chain").notNull(),
  maxTokens: integer("max_tokens").default(1000),
  temperature: numeric("temperature").default("0.3"),
  enableCitations: boolean("enable_citations").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const llmCalls = pgTable("llm_calls", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  role: text("role").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  estimatedCost: numeric("estimated_cost"),
  latencyMs: integer("latency_ms"),
  status: text("status").default("success").notNull(),
  errorMessage: text("error_message"),
  systemPrompt: text("system_prompt"),
  userPrompt: text("user_prompt"),
  response: text("response"),
  cacheHit: boolean("cache_hit").default(false).notNull(),
  fallbackUsed: boolean("fallback_used").default(false).notNull(),
  fallbackReason: text("fallback_reason"),
  traceId: text("trace_id"),
  criticality: text("criticality"),
  purpose: text("purpose"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLlmRoleConfigSchema = createInsertSchema(llmRoleConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLlmCallSchema = createInsertSchema(llmCalls).omit({
  id: true,
  createdAt: true,
});

export type InsertLlmRoleConfig = z.infer<typeof insertLlmRoleConfigSchema>;
export type LlmRoleConfig = typeof llmRoleConfigs.$inferSelect;

export type InsertLlmCall = z.infer<typeof insertLlmCallSchema>;
export type LlmCall = typeof llmCalls.$inferSelect;

export const workItemTypes = [
  "ORDER_SUBMIT",
  "ORDER_CANCEL",
  "ORDER_SYNC",
  "POSITION_CLOSE",
  "KILL_SWITCH",
  "DECISION_EVALUATION",
  "ASSET_UNIVERSE_SYNC",
] as const;

export type WorkItemType = typeof workItemTypes[number];

export const workItemStatuses = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "DEAD_LETTER",
] as const;

export type WorkItemStatus = typeof workItemStatuses[number];

export const workItems = pgTable("work_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  status: text("status").default("PENDING").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  nextRunAt: timestamp("next_run_at").defaultNow().notNull(),
  lastError: text("last_error"),
  payload: text("payload"),
  idempotencyKey: text("idempotency_key").unique(),
  decisionId: varchar("decision_id").references(() => aiDecisions.id),
  brokerOrderId: text("broker_order_id"),
  symbol: text("symbol"),
  result: text("result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workItemRuns = pgTable("work_item_runs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workItemId: varchar("work_item_id").references(() => workItems.id).notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  status: text("status").default("RUNNING").notNull(),
  error: text("error"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWorkItemSchema = createInsertSchema(workItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  attempts: true,
});

export const insertWorkItemRunSchema = createInsertSchema(workItemRuns).omit({
  id: true,
  createdAt: true,
});

export type InsertWorkItem = z.infer<typeof insertWorkItemSchema>;
export type WorkItem = typeof workItems.$inferSelect;

export type InsertWorkItemRun = z.infer<typeof insertWorkItemRunSchema>;
export type WorkItemRun = typeof workItemRuns.$inferSelect;

export const assetClasses = ["us_equity", "crypto"] as const;
export type AssetClass = typeof assetClasses[number];

export const brokerAssets = pgTable("broker_assets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  alpacaId: text("alpaca_id").notNull().unique(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  assetClass: text("asset_class").notNull(),
  exchange: text("exchange").notNull(),
  status: text("status").notNull(),
  tradable: boolean("tradable").default(false).notNull(),
  marginable: boolean("marginable").default(false).notNull(),
  shortable: boolean("shortable").default(false).notNull(),
  easyToBorrow: boolean("easy_to_borrow").default(false).notNull(),
  fractionable: boolean("fractionable").default(false).notNull(),
  minOrderSize: numeric("min_order_size"),
  minTradeIncrement: numeric("min_trade_increment"),
  priceIncrement: numeric("price_increment"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBrokerAssetSchema = createInsertSchema(brokerAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBrokerAsset = z.infer<typeof insertBrokerAssetSchema>;
export type BrokerAsset = typeof brokerAssets.$inferSelect;

export const orderStatuses = [
  'new',
  'accepted',
  'pending_new',
  'partially_filled',
  'filled',
  'canceled',
  'rejected',
  'expired',
  'replaced',
  'pending_cancel',
  'pending_replace',
  'stopped',
  'suspended',
  'calculated',
  'done_for_day',
] as const;

export type OrderStatus = typeof orderStatuses[number];

export const orderTypes = ['market', 'limit', 'stop', 'stop_limit'] as const;
export type OrderType = typeof orderTypes[number];

export const timeInForceValues = ['day', 'gtc', 'opg', 'cls', 'ioc', 'fok'] as const;
export type TimeInForce = typeof timeInForceValues[number];

export const orders = pgTable("orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  broker: text("broker").notNull(),
  brokerOrderId: text("broker_order_id").notNull().unique(),
  clientOrderId: text("client_order_id").unique(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  type: text("type").notNull(),
  timeInForce: text("time_in_force"),
  qty: numeric("qty"),
  notional: numeric("notional"),
  limitPrice: numeric("limit_price"),
  stopPrice: numeric("stop_price"),
  status: text("status").notNull(),
  submittedAt: timestamp("submitted_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  filledAt: timestamp("filled_at"),
  filledQty: numeric("filled_qty"),
  filledAvgPrice: numeric("filled_avg_price"),
  traceId: text("trace_id"),
  decisionId: varchar("decision_id").references(() => aiDecisions.id),
  tradeIntentId: varchar("trade_intent_id").references(() => trades.id),
  workItemId: varchar("work_item_id").references(() => workItems.id),
  rawJson: jsonb("raw_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("orders_broker_order_id_idx").on(table.brokerOrderId),
  index("orders_client_order_id_idx").on(table.clientOrderId),
  index("orders_symbol_idx").on(table.symbol),
  index("orders_status_idx").on(table.status),
  index("orders_trace_id_idx").on(table.traceId),
  index("orders_decision_id_idx").on(table.decisionId),
]);

export const fills = pgTable("fills", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  broker: text("broker").notNull(),
  brokerOrderId: text("broker_order_id").notNull(),
  brokerFillId: text("broker_fill_id").unique(),
  orderId: varchar("order_id").references(() => orders.id),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  qty: numeric("qty").notNull(),
  price: numeric("price").notNull(),
  occurredAt: timestamp("occurred_at").notNull(),
  traceId: text("trace_id"),
  rawJson: jsonb("raw_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("fills_broker_order_id_idx").on(table.brokerOrderId),
  index("fills_order_id_idx").on(table.orderId),
  index("fills_symbol_idx").on(table.symbol),
  index("fills_trace_id_idx").on(table.traceId),
]);

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

export const insertFillSchema = createInsertSchema(fills).omit({
  id: true,
  createdAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertFill = z.infer<typeof insertFillSchema>;
export type Fill = typeof fills.$inferSelect;

export const backtestStatuses = ['QUEUED', 'RUNNING', 'DONE', 'FAILED'] as const;
export type BacktestStatusType = typeof backtestStatuses[number];

export const executionPriceRules = ['NEXT_OPEN', 'NEXT_CLOSE'] as const;
export type ExecutionPriceRuleType = typeof executionPriceRules[number];

export const backtestRuns = pgTable("backtest_runs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  status: text("status").default("QUEUED").notNull(),
  strategyId: varchar("strategy_id").references(() => strategies.id),
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
  runId: varchar("run_id").references(() => backtestRuns.id).notNull(),
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
  runId: varchar("run_id").references(() => backtestRuns.id).notNull(),
  ts: timestamp("ts").notNull(),
  equity: numeric("equity").notNull(),
  cash: numeric("cash").notNull(),
  exposure: numeric("exposure").notNull(),
}, (table) => [
  index("backtest_equity_curve_run_id_idx").on(table.runId),
  index("backtest_equity_curve_ts_idx").on(table.ts),
]);

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

export type InsertBacktestRun = z.infer<typeof insertBacktestRunSchema>;
export type BacktestRun = typeof backtestRuns.$inferSelect;

export type InsertBacktestTradeEvent = z.infer<typeof insertBacktestTradeEventSchema>;
export type BacktestTradeEvent = typeof backtestTradeEvents.$inferSelect;

export type InsertBacktestEquityCurve = z.infer<typeof insertBacktestEquityCurveSchema>;
export type BacktestEquityCurve = typeof backtestEquityCurve.$inferSelect;

export interface TradabilityCheck {
  symbol: string;
  tradable: boolean;
  reason?: string;
  assetClass?: AssetClass;
  exchange?: string;
  fractionable?: boolean;
  marginable?: boolean;
  shortable?: boolean;
  lastSyncedAt?: Date;
}
