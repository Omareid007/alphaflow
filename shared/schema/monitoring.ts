import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, boolean, integer, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// ENUMS
// ============================================================================

export const llmRoles = [
  "market_news_summarizer",
  "technical_analyst",
  "risk_manager",
  "execution_planner",
  "post_trade_reporter",
  // New roles added for enhanced trading capabilities
  "position_sizer",      // Optimal position sizing based on risk and market conditions
  "sentiment_analyst",   // Dedicated sentiment analysis from news and social sources
  "post_trade_analyzer", // Detailed trade performance analysis and learning
  "futures_analyst",     // Specialized futures market analysis
] as const;

export type LLMRole = typeof llmRoles[number];

export type AlertRuleType = "dead_letter_count" | "retry_rate" | "orchestrator_silent" | "llm_error_rate" | "provider_budget_exhausted";

export type ToolCategory = "market_data" | "broker" | "analytics" | "ai" | "admin";
export type ToolInvocationStatus = "pending" | "success" | "error" | "cached";

// ============================================================================
// TABLES
// ============================================================================

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

export const connectorMetrics = pgTable("connector_metrics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  connector: text("connector").notNull(),
  endpoint: text("endpoint").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  totalRequests: integer("total_requests").default(0).notNull(),
  successCount: integer("success_count").default(0).notNull(),
  failureCount: integer("failure_count").default(0).notNull(),
  cacheHits: integer("cache_hits").default(0).notNull(),
  cacheMisses: integer("cache_misses").default(0).notNull(),
  rateLimitHits: integer("rate_limit_hits").default(0).notNull(),
  fallbackUsed: integer("fallback_used").default(0).notNull(),
  avgLatencyMs: numeric("avg_latency_ms"),
  p50LatencyMs: numeric("p50_latency_ms"),
  p95LatencyMs: numeric("p95_latency_ms"),
  p99LatencyMs: numeric("p99_latency_ms"),
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("connector_metrics_connector_idx").on(table.connector),
  index("connector_metrics_date_idx").on(table.date),
  unique("connector_metrics_connector_endpoint_date_unique").on(table.connector, table.endpoint, table.date),
]);

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
  ruleId: varchar("rule_id").references(() => alertRules.id, { onDelete: "cascade" }).notNull(),
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
  // Note: debateSessionId references debateSessions.id from debate-arena module
  // Foreign key constraint will be resolved in main schema index
  debateSessionId: varchar("debate_session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("tool_invocations_trace_id_idx").on(table.traceId),
  index("tool_invocations_tool_name_idx").on(table.toolName),
  index("tool_invocations_created_at_idx").on(table.createdAt),
  index("tool_invocations_session_id_idx").on(table.debateSessionId),
]);

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

export const insertLlmRoleConfigSchema = createInsertSchema(llmRoleConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLlmCallSchema = createInsertSchema(llmCalls).omit({
  id: true,
  createdAt: true,
});

export const insertConnectorMetricsSchema = createInsertSchema(connectorMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertEventSchema = createInsertSchema(alertEvents).omit({
  id: true,
  createdAt: true,
});

export const insertToolInvocationSchema = createInsertSchema(toolInvocations).omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// TYPES
// ============================================================================

export type InsertLlmRoleConfig = typeof llmRoleConfigs.$inferInsert;
export type LlmRoleConfig = typeof llmRoleConfigs.$inferSelect;

export type InsertLlmCall = typeof llmCalls.$inferInsert;
export type LlmCall = typeof llmCalls.$inferSelect;

export type InsertConnectorMetrics = typeof connectorMetrics.$inferInsert;
export type ConnectorMetrics = typeof connectorMetrics.$inferSelect;

export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AlertRule = typeof alertRules.$inferSelect;

export type InsertAlertEvent = z.infer<typeof insertAlertEventSchema>;
export type AlertEvent = typeof alertEvents.$inferSelect;

export type InsertToolInvocation = z.infer<typeof insertToolInvocationSchema>;
export type ToolInvocation = typeof toolInvocations.$inferSelect;
