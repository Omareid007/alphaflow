/**
 * @module schema/monitoring
 * @description Monitoring and infrastructure tracking schema for the AI trading system.
 * Tracks LLM usage, connector performance, alerting rules, and tool invocations.
 * Provides comprehensive observability for system health, cost tracking, and debugging.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  numeric,
  boolean,
  integer,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// ENUMS
// ============================================================================

/**
 * LLM roles used throughout the trading system.
 *
 * @enum {string}
 * @property {string} market_news_summarizer - Summarizes market news and events
 * @property {string} technical_analyst - Analyzes technical indicators and chart patterns
 * @property {string} risk_manager - Evaluates risk metrics and position sizing
 * @property {string} execution_planner - Plans trade execution strategies
 * @property {string} post_trade_reporter - Generates post-trade analysis reports
 * @property {string} position_sizer - Calculates optimal position sizes based on risk
 * @property {string} sentiment_analyst - Analyzes market sentiment from news and social media
 * @property {string} post_trade_analyzer - Performs detailed trade performance analysis
 * @property {string} futures_analyst - Specializes in futures market analysis
 */
export const llmRoles = [
  "market_news_summarizer",
  "technical_analyst",
  "risk_manager",
  "execution_planner",
  "post_trade_reporter",
  // New roles added for enhanced trading capabilities
  "position_sizer", // Optimal position sizing based on risk and market conditions
  "sentiment_analyst", // Dedicated sentiment analysis from news and social sources
  "post_trade_analyzer", // Detailed trade performance analysis and learning
  "futures_analyst", // Specialized futures market analysis
] as const;

export type LLMRole = (typeof llmRoles)[number];

/**
 * Types of alert rules for system monitoring.
 *
 * @typedef {string} AlertRuleType
 * @property {string} dead_letter_count - Alerts when dead letter queue exceeds threshold
 * @property {string} retry_rate - Alerts on high retry rates indicating failures
 * @property {string} orchestrator_silent - Alerts when orchestrator stops producing heartbeats
 * @property {string} llm_error_rate - Alerts on high LLM error rates
 * @property {string} provider_budget_exhausted - Alerts when LLM provider budget is exhausted
 */
export type AlertRuleType =
  | "dead_letter_count"
  | "retry_rate"
  | "orchestrator_silent"
  | "llm_error_rate"
  | "provider_budget_exhausted";

/**
 * Categories of tools available in the system.
 *
 * @typedef {string} ToolCategory
 * @property {string} market_data - Tools for fetching market data
 * @property {string} broker - Tools for broker interactions
 * @property {string} analytics - Tools for data analysis
 * @property {string} ai - AI/LLM-related tools
 * @property {string} admin - Administrative tools
 */
export type ToolCategory =
  | "market_data"
  | "broker"
  | "analytics"
  | "ai"
  | "admin";

/**
 * Status of a tool invocation.
 *
 * @typedef {string} ToolInvocationStatus
 * @property {string} pending - Tool invocation is queued
 * @property {string} success - Tool invocation completed successfully
 * @property {string} error - Tool invocation failed
 * @property {string} cached - Result returned from cache
 */
export type ToolInvocationStatus = "pending" | "success" | "error" | "cached";

// ============================================================================
// TABLES
// ============================================================================

/**
 * Configuration settings for each LLM role.
 * Defines model parameters, fallback chains, and capabilities for each role.
 *
 * @table llm_role_configs
 * @description Stores configuration for LLM roles including fallback chains,
 * token limits, temperature settings, and feature flags. Each role can have
 * a unique configuration to optimize performance and cost.
 */
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

/**
 * Audit log of all LLM API calls made by the system.
 * Tracks usage, costs, performance, and errors for monitoring and debugging.
 *
 * @table llm_calls
 * @description Records every LLM invocation including tokens consumed, latency,
 * costs, cache hits, fallback usage, and the full conversation context.
 * Essential for cost tracking, performance monitoring, and debugging.
 */
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

/**
 * Aggregated performance metrics for external API connectors.
 * Tracks success rates, latency, caching, and rate limiting per connector/endpoint.
 *
 * @table connector_metrics
 * @description Stores daily aggregated metrics for each connector (market data,
 * broker APIs, etc.) including request counts, cache hit rates, latency percentiles,
 * and error tracking. Used for reliability monitoring and performance optimization.
 */
export const connectorMetrics = pgTable(
  "connector_metrics",
  {
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
  },
  (table) => [
    index("connector_metrics_connector_idx").on(table.connector),
    index("connector_metrics_date_idx").on(table.date),
    unique("connector_metrics_connector_endpoint_date_unique").on(
      table.connector,
      table.endpoint,
      table.date
    ),
  ]
);

/**
 * Configurable alert rules for system monitoring and operational awareness.
 * Defines thresholds and conditions that trigger notifications.
 *
 * @table alert_rules
 * @description Stores alert rule definitions including conditions, thresholds,
 * and webhook URLs for notifications. Supports various rule types for monitoring
 * system health, performance, and operational metrics.
 */
export const alertRules = pgTable(
  "alert_rules",
  {
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
  },
  (table) => [
    index("alert_rules_enabled_idx").on(table.enabled),
    index("alert_rules_type_idx").on(table.ruleType),
  ]
);

/**
 * Log of triggered alert events.
 * Records when alert rules fire and tracks notification delivery.
 *
 * @table alert_events
 * @description Stores instances when alert rules are triggered, including the
 * threshold breach value, webhook delivery status, and timing. References the
 * parent alert rule for context.
 *
 * @relation alertRules - Parent alert rule that triggered this event (cascade delete)
 */
export const alertEvents = pgTable(
  "alert_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    ruleId: varchar("rule_id")
      .references(() => alertRules.id, { onDelete: "cascade" })
      .notNull(),
    ruleName: text("rule_name").notNull(),
    ruleType: text("rule_type").notNull(),
    triggeredValue: numeric("triggered_value").notNull(),
    threshold: numeric("threshold").notNull(),
    status: text("status").default("triggered").notNull(),
    webhookSent: boolean("webhook_sent").default(false),
    webhookResponse: text("webhook_response"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("alert_events_rule_id_idx").on(table.ruleId),
    index("alert_events_created_at_idx").on(table.createdAt),
  ]
);

/**
 * Audit log of tool invocations made by AI agents.
 * Tracks all tool calls including parameters, results, and performance metrics.
 *
 * @table tool_invocations
 * @description Records every tool invocation (market data, broker actions, analytics)
 * made during AI agent operations. Includes input parameters, output results,
 * execution status, latency, and cache hits. Essential for debugging agent behavior
 * and optimizing tool performance.
 *
 * @relation debateSessions - Associated debate session (database-level FK only)
 * Note: Foreign key to debateSessions is defined at database level to avoid circular dependencies
 */
export const toolInvocations = pgTable(
  "tool_invocations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    traceId: text("trace_id").notNull(),
    toolName: text("tool_name").notNull(),
    category: text("category").$type<ToolCategory>().notNull(),
    inputParams: jsonb("input_params"),
    outputResult: jsonb("output_result"),
    status: text("status")
      .$type<ToolInvocationStatus>()
      .default("pending")
      .notNull(),
    errorMessage: text("error_message"),
    cacheHit: boolean("cache_hit").default(false).notNull(),
    latencyMs: integer("latency_ms"),
    callerRole: text("caller_role"),
    // Note: debateSessionId references debateSessions.id from debate-arena module
    // Foreign key constraint will be resolved in main schema index
    debateSessionId: varchar("debate_session_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("tool_invocations_trace_id_idx").on(table.traceId),
    index("tool_invocations_tool_name_idx").on(table.toolName),
    index("tool_invocations_created_at_idx").on(table.createdAt),
    index("tool_invocations_session_id_idx").on(table.debateSessionId),
  ]
);

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

export const insertLlmRoleConfigSchema = createInsertSchema(
  llmRoleConfigs
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLlmCallSchema = createInsertSchema(llmCalls).omit({
  id: true,
  createdAt: true,
});

export const insertConnectorMetricsSchema = createInsertSchema(
  connectorMetrics
).omit({
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

export const insertToolInvocationSchema = createInsertSchema(
  toolInvocations
).omit({
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
