import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, boolean, integer, jsonb, index, unique } from "drizzle-orm/pg-core";
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

export const adminSettings = pgTable("admin_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  namespace: text("namespace").notNull(),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  description: text("description"),
  isSecret: boolean("is_secret").default(false).notNull(),
  isReadOnly: boolean("is_read_only").default(false).notNull(),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("admin_settings_namespace_idx").on(table.namespace),
  index("admin_settings_key_idx").on(table.key),
  unique("admin_settings_namespace_key_unique").on(table.namespace, table.key),
]);

export const insertAdminSettingSchema = createInsertSchema(adminSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdminSetting = z.infer<typeof insertAdminSettingSchema>;
export type AdminSetting = typeof adminSettings.$inferSelect;

// ============================================================================
// UNIVERSE & ALLOCATION TABLES (Phases A-E)
// ============================================================================

export const universeAssets = pgTable("universe_assets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  exchange: text("exchange").notNull(),
  assetClass: text("asset_class").notNull(),
  status: text("status").notNull(),
  tradable: boolean("tradable").default(false).notNull(),
  marginable: boolean("marginable").default(false).notNull(),
  shortable: boolean("shortable").default(false).notNull(),
  fractionable: boolean("fractionable").default(false).notNull(),
  easyToBorrow: boolean("easy_to_borrow").default(false).notNull(),
  isOtc: boolean("is_otc").default(false).notNull(),
  isSpac: boolean("is_spac").default(false).notNull(),
  isPennyStock: boolean("is_penny_stock").default(false).notNull(),
  excluded: boolean("excluded").default(false).notNull(),
  excludeReason: text("exclude_reason"),
  lastRefreshedAt: timestamp("last_refreshed_at").defaultNow().notNull(),
  rawJson: jsonb("raw_json"),
}, (table) => [
  index("universe_assets_symbol_idx").on(table.symbol),
  index("universe_assets_tradable_idx").on(table.tradable),
  index("universe_assets_exchange_idx").on(table.exchange),
]);

export const universeLiquidityMetrics = pgTable("universe_liquidity_metrics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  avgDailyVolumeShares: numeric("avg_daily_volume_shares"),
  avgDailyTradedValueUsd: numeric("avg_daily_traded_value_usd"),
  avgBidAskSpreadPct: numeric("avg_bid_ask_spread_pct"),
  latestPrice: numeric("latest_price"),
  priceDataDays: integer("price_data_days").default(30),
  liquidityTier: text("liquidity_tier"),
  source: text("source").notNull(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  rawJson: jsonb("raw_json"),
}, (table) => [
  index("universe_liquidity_symbol_idx").on(table.symbol),
  index("universe_liquidity_tier_idx").on(table.liquidityTier),
]);

export const universeFundamentals = pgTable("universe_fundamentals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  marketCap: numeric("market_cap"),
  revenueTtm: numeric("revenue_ttm"),
  revenueCagr3y: numeric("revenue_cagr_3y"),
  grossMargin: numeric("gross_margin"),
  operatingMargin: numeric("operating_margin"),
  netMargin: numeric("net_margin"),
  freeCashFlowMargin: numeric("free_cash_flow_margin"),
  debtToEquity: numeric("debt_to_equity"),
  sharesDilution1y: numeric("shares_dilution_1y"),
  sector: text("sector"),
  industry: text("industry"),
  source: text("source").notNull(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  rawJson: jsonb("raw_json"),
}, (table) => [
  index("universe_fundamentals_symbol_idx").on(table.symbol),
  index("universe_fundamentals_sector_idx").on(table.sector),
]);

export const universeCandidates = pgTable("universe_candidates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  tier: text("tier").notNull(),
  liquidityScore: numeric("liquidity_score"),
  growthScore: numeric("growth_score"),
  qualityScore: numeric("quality_score"),
  finalScore: numeric("final_score"),
  themeTags: jsonb("theme_tags"),
  rationale: text("rationale"),
  status: text("status").notNull().default("NEW"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  traceId: text("trace_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("universe_candidates_symbol_idx").on(table.symbol),
  index("universe_candidates_status_idx").on(table.status),
  index("universe_candidates_tier_idx").on(table.tier),
  index("universe_candidates_final_score_idx").on(table.finalScore),
]);

export const allocationPolicies = pgTable("allocation_policies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(false).notNull(),
  maxPositionWeightPct: numeric("max_position_weight_pct").default("8"),
  maxSectorWeightPct: numeric("max_sector_weight_pct").default("25"),
  minLiquidityTier: text("min_liquidity_tier").default("B"),
  profitTakingThresholdPct: numeric("profit_taking_threshold_pct").default("20"),
  overweightThresholdPct: numeric("overweight_threshold_pct").default("50"),
  rotationTopN: integer("rotation_top_n").default(10),
  rebalanceFrequency: text("rebalance_frequency").default("daily"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("allocation_policies_active_idx").on(table.isActive),
]);

export const rebalanceRuns = pgTable("rebalance_runs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  policyId: varchar("policy_id").references(() => allocationPolicies.id),
  traceId: text("trace_id").notNull(),
  status: text("status").notNull().default("pending"),
  triggerType: text("trigger_type").notNull(),
  inputSnapshot: jsonb("input_snapshot"),
  orderIntents: jsonb("order_intents"),
  executedOrders: jsonb("executed_orders"),
  rationale: text("rationale"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("rebalance_runs_trace_id_idx").on(table.traceId),
  index("rebalance_runs_status_idx").on(table.status),
]);

export const insertUniverseAssetSchema = createInsertSchema(universeAssets).omit({
  id: true,
  lastRefreshedAt: true,
});
export const insertUniverseLiquiditySchema = createInsertSchema(universeLiquidityMetrics).omit({
  id: true,
  lastUpdatedAt: true,
});
export const insertUniverseFundamentalsSchema = createInsertSchema(universeFundamentals).omit({
  id: true,
  lastUpdatedAt: true,
});
export const insertUniverseCandidateSchema = createInsertSchema(universeCandidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAllocationPolicySchema = createInsertSchema(allocationPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRebalanceRunSchema = createInsertSchema(rebalanceRuns).omit({
  id: true,
  startedAt: true,
});

export type InsertUniverseAsset = z.infer<typeof insertUniverseAssetSchema>;
export type UniverseAsset = typeof universeAssets.$inferSelect;
export type InsertUniverseLiquidity = z.infer<typeof insertUniverseLiquiditySchema>;
export type UniverseLiquidity = typeof universeLiquidityMetrics.$inferSelect;
export type InsertUniverseFundamentals = z.infer<typeof insertUniverseFundamentalsSchema>;
export type UniverseFundamentals = typeof universeFundamentals.$inferSelect;
export type InsertUniverseCandidate = z.infer<typeof insertUniverseCandidateSchema>;
export type UniverseCandidate = typeof universeCandidates.$inferSelect;
export type InsertAllocationPolicy = z.infer<typeof insertAllocationPolicySchema>;
export type AllocationPolicy = typeof allocationPolicies.$inferSelect;
export type InsertRebalanceRun = z.infer<typeof insertRebalanceRunSchema>;
export type RebalanceRun = typeof rebalanceRuns.$inferSelect;

export type CandidateStatus = "NEW" | "WATCHLISTED" | "APPROVED" | "REJECTED";
export type LiquidityTier = "A" | "B" | "C";

export const alertRules = pgTable("alert_rules", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  ruleType: text("rule_type").notNull(),
  condition: jsonb("condition").notNull(),
  threshold: numeric("threshold").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  webhookUrl: text("webhook_url"),
  lastTriggeredAt: timestamp("last_triggered_at"),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("alert_rules_enabled_idx").on(table.enabled),
  index("alert_rules_type_idx").on(table.ruleType),
]);

export const alertEvents = pgTable("alert_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ruleId: varchar("rule_id").references(() => alertRules.id).notNull(),
  ruleName: text("rule_name").notNull(),
  ruleType: text("rule_type").notNull(),
  triggeredValue: numeric("triggered_value").notNull(),
  threshold: numeric("threshold").notNull(),
  status: text("status").default("triggered").notNull(),
  webhookSent: boolean("webhook_sent").default(false),
  webhookResponse: text("webhook_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("alert_events_rule_id_idx").on(table.ruleId),
  index("alert_events_created_at_idx").on(table.createdAt),
]);

export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertAlertEventSchema = createInsertSchema(alertEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AlertRule = typeof alertRules.$inferSelect;
export type InsertAlertEvent = z.infer<typeof insertAlertEventSchema>;
export type AlertEvent = typeof alertEvents.$inferSelect;
export type AlertRuleType = "dead_letter_count" | "retry_rate" | "orchestrator_silent" | "llm_error_rate" | "provider_budget_exhausted";

// ============================================================================
// AI DEBATE ARENA
// ============================================================================

export type DebateRole = "bull" | "bear" | "risk_manager" | "technical_analyst" | "fundamental_analyst" | "judge";
export type DebateSessionStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export const debateSessions = pgTable("debate_sessions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  traceId: text("trace_id").notNull(),
  strategyVersionId: varchar("strategy_version_id"),
  symbols: text("symbols").array().notNull(),
  status: text("status").$type<DebateSessionStatus>().default("pending").notNull(),
  triggeredBy: text("triggered_by"),
  marketContext: jsonb("market_context"),
  config: jsonb("config"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  totalCost: numeric("total_cost"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("debate_sessions_trace_id_idx").on(table.traceId),
  index("debate_sessions_status_idx").on(table.status),
  index("debate_sessions_created_at_idx").on(table.createdAt),
]);

export const debateMessages = pgTable("debate_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => debateSessions.id).notNull(),
  role: text("role").$type<DebateRole>().notNull(),
  stance: text("stance"),
  confidence: numeric("confidence"),
  keySignals: jsonb("key_signals"),
  risks: jsonb("risks"),
  invalidationPoints: jsonb("invalidation_points"),
  proposedAction: text("proposed_action"),
  proposedOrder: jsonb("proposed_order"),
  evidenceRefs: jsonb("evidence_refs"),
  rawOutput: text("raw_output"),
  provider: text("provider"),
  model: text("model"),
  tokensUsed: integer("tokens_used"),
  estimatedCost: numeric("estimated_cost"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("debate_messages_session_id_idx").on(table.sessionId),
  index("debate_messages_role_idx").on(table.role),
]);

export const debateConsensus = pgTable("debate_consensus", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => debateSessions.id).notNull().unique(),
  decision: text("decision").notNull(),
  orderIntent: jsonb("order_intent"),
  reasonsSummary: text("reasons_summary"),
  riskChecks: jsonb("risk_checks"),
  confidence: numeric("confidence"),
  dissent: jsonb("dissent"),
  workItemId: varchar("work_item_id").references(() => workItems.id),
  brokerOrderId: text("broker_order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("debate_consensus_session_id_idx").on(table.sessionId),
  index("debate_consensus_work_item_id_idx").on(table.workItemId),
]);

// ============================================================================
// COMPETITION MODE
// ============================================================================

export type TraderProfileStatus = "active" | "inactive" | "testing";
export type CompetitionMode = "paper_execute_all" | "recommend_only";
export type CompetitionRunStatus = "pending" | "running" | "completed" | "stopped";

export const traderProfiles = pgTable("trader_profiles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  strategyVersionId: varchar("strategy_version_id"),
  modelProfile: jsonb("model_profile"),
  riskPreset: jsonb("risk_preset"),
  universeFilter: jsonb("universe_filter"),
  isPromoted: boolean("is_promoted").default(false).notNull(),
  status: text("status").$type<TraderProfileStatus>().default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("trader_profiles_status_idx").on(table.status),
  index("trader_profiles_promoted_idx").on(table.isPromoted),
]);

export const competitionRuns = pgTable("competition_runs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  traceId: text("trace_id").notNull(),
  mode: text("mode").$type<CompetitionMode>().notNull(),
  traderIds: text("trader_ids").array().notNull(),
  universeSymbols: text("universe_symbols").array(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  durationMinutes: integer("duration_minutes"),
  status: text("status").$type<CompetitionRunStatus>().default("pending").notNull(),
  config: jsonb("config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("competition_runs_trace_id_idx").on(table.traceId),
  index("competition_runs_status_idx").on(table.status),
]);

export const competitionScores = pgTable("competition_scores", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  runId: varchar("run_id").references(() => competitionRuns.id).notNull(),
  traderProfileId: varchar("trader_profile_id").references(() => traderProfiles.id).notNull(),
  totalPnl: numeric("total_pnl").default("0").notNull(),
  roi: numeric("roi").default("0").notNull(),
  maxDrawdown: numeric("max_drawdown").default("0").notNull(),
  winRate: numeric("win_rate").default("0").notNull(),
  avgHoldTime: integer("avg_hold_time"),
  tradeCount: integer("trade_count").default(0).notNull(),
  errorCount: integer("error_count").default(0).notNull(),
  costPerDecision: numeric("cost_per_decision"),
  slippageProxy: numeric("slippage_proxy"),
  rank: integer("rank"),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
  details: jsonb("details"),
}, (table) => [
  index("competition_scores_run_id_idx").on(table.runId),
  index("competition_scores_trader_id_idx").on(table.traderProfileId),
  index("competition_scores_rank_idx").on(table.rank),
]);

// ============================================================================
// STRATEGY STUDIO (Versioning)
// ============================================================================

export type StrategyVersionStatus = "draft" | "active" | "archived" | "deprecated";

export const strategyVersions = pgTable("strategy_versions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").references(() => strategies.id).notNull(),
  version: integer("version").notNull(),
  name: text("name").notNull(),
  spec: jsonb("spec").notNull(),
  universeConfig: jsonb("universe_config"),
  signalsConfig: jsonb("signals_config"),
  riskConfig: jsonb("risk_config"),
  llmPolicy: jsonb("llm_policy"),
  promptTemplate: text("prompt_template"),
  status: text("status").$type<StrategyVersionStatus>().default("draft").notNull(),
  dryRunResult: jsonb("dry_run_result"),
  changeNotes: text("change_notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  activatedAt: timestamp("activated_at"),
}, (table) => [
  index("strategy_versions_strategy_id_idx").on(table.strategyId),
  index("strategy_versions_status_idx").on(table.status),
  unique("strategy_versions_unique").on(table.strategyId, table.version),
]);

// ============================================================================
// TOOL ROUTER (MCP-style)
// ============================================================================

export type ToolCategory = "market_data" | "broker" | "analytics" | "ai" | "admin";
export type ToolInvocationStatus = "pending" | "success" | "error" | "cached";

export const toolInvocations = pgTable("tool_invocations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  traceId: text("trace_id").notNull(),
  toolName: text("tool_name").notNull(),
  category: text("category").$type<ToolCategory>().notNull(),
  inputParams: jsonb("input_params"),
  outputResult: jsonb("output_result"),
  status: text("status").$type<ToolInvocationStatus>().default("pending").notNull(),
  errorMessage: text("error_message"),
  cacheHit: boolean("cache_hit").default(false).notNull(),
  latencyMs: integer("latency_ms"),
  callerRole: text("caller_role"),
  debateSessionId: varchar("debate_session_id").references(() => debateSessions.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("tool_invocations_trace_id_idx").on(table.traceId),
  index("tool_invocations_tool_name_idx").on(table.toolName),
  index("tool_invocations_created_at_idx").on(table.createdAt),
  index("tool_invocations_session_id_idx").on(table.debateSessionId),
]);

// ============================================================================
// INSERT SCHEMAS & TYPES - DEBATE ARENA
// ============================================================================

export const insertDebateSessionSchema = createInsertSchema(debateSessions).omit({
  id: true,
  createdAt: true,
});
export const insertDebateMessageSchema = createInsertSchema(debateMessages).omit({
  id: true,
  createdAt: true,
});
export const insertDebateConsensusSchema = createInsertSchema(debateConsensus).omit({
  id: true,
  createdAt: true,
});

export type InsertDebateSession = z.infer<typeof insertDebateSessionSchema>;
export type DebateSession = typeof debateSessions.$inferSelect;
export type InsertDebateMessage = z.infer<typeof insertDebateMessageSchema>;
export type DebateMessage = typeof debateMessages.$inferSelect;
export type InsertDebateConsensus = z.infer<typeof insertDebateConsensusSchema>;
export type DebateConsensus = typeof debateConsensus.$inferSelect;

// ============================================================================
// INSERT SCHEMAS & TYPES - COMPETITION MODE
// ============================================================================

export const insertTraderProfileSchema = createInsertSchema(traderProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCompetitionRunSchema = createInsertSchema(competitionRuns).omit({
  id: true,
  createdAt: true,
});
export const insertCompetitionScoreSchema = createInsertSchema(competitionScores).omit({
  id: true,
  snapshotAt: true,
});

export type InsertTraderProfile = z.infer<typeof insertTraderProfileSchema>;
export type TraderProfile = typeof traderProfiles.$inferSelect;
export type InsertCompetitionRun = z.infer<typeof insertCompetitionRunSchema>;
export type CompetitionRun = typeof competitionRuns.$inferSelect;
export type InsertCompetitionScore = z.infer<typeof insertCompetitionScoreSchema>;
export type CompetitionScore = typeof competitionScores.$inferSelect;

// ============================================================================
// INSERT SCHEMAS & TYPES - STRATEGY VERSIONS
// ============================================================================

export const insertStrategyVersionSchema = createInsertSchema(strategyVersions).omit({
  id: true,
  createdAt: true,
});

export type InsertStrategyVersion = z.infer<typeof insertStrategyVersionSchema>;
export type StrategyVersion = typeof strategyVersions.$inferSelect;

// ============================================================================
// INSERT SCHEMAS & TYPES - TOOL ROUTER
// ============================================================================

export const insertToolInvocationSchema = createInsertSchema(toolInvocations).omit({
  id: true,
  createdAt: true,
});

export type InsertToolInvocation = z.infer<typeof insertToolInvocationSchema>;
export type ToolInvocation = typeof toolInvocations.$inferSelect;
