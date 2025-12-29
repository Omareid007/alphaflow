/**
 * @module schema/debate-arena
 * @description Multi-agent debate system for collaborative trading decisions.
 * Implements a debate framework where AI agents with different perspectives
 * (bull, bear, risk manager, etc.) analyze markets and reach consensus on
 * trading actions. Tracks full conversation history and links decisions to outcomes.
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, boolean, integer, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { aiDecisions } from "./ai-decisions";
// Note: workItems import creates circular dependency
// workItems references aiDecisions, and debateConsensus/aiOutcomeLinks reference workItems
// Using varchar without .references() with database-level FK constraint

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Roles agents can assume in debate sessions.
 *
 * @typedef {string} DebateRole
 * @property {string} bull - Optimistic agent advocating for long positions
 * @property {string} bear - Pessimistic agent advocating for short positions or caution
 * @property {string} risk_manager - Focuses on risk assessment and position sizing
 * @property {string} technical_analyst - Analyzes charts and technical indicators
 * @property {string} fundamental_analyst - Analyzes company fundamentals and valuations
 * @property {string} judge - Synthesizes perspectives and makes final decisions
 */
export type DebateRole = "bull" | "bear" | "risk_manager" | "technical_analyst" | "fundamental_analyst" | "judge";

/**
 * Lifecycle status of a debate session.
 *
 * @typedef {string} DebateSessionStatus
 * @property {string} pending - Debate scheduled but not started
 * @property {string} running - Debate in progress
 * @property {string} completed - Debate finished successfully
 * @property {string} failed - Debate failed with error
 * @property {string} cancelled - Debate was cancelled
 */
export type DebateSessionStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * LLM provider for agent execution.
 *
 * @typedef {string} AgentProvider
 * @property {string} openai - OpenAI API
 * @property {string} openrouter - OpenRouter API
 * @property {string} groq - Groq API
 * @property {string} together - Together AI API
 */
export type AgentProvider = "openai" | "openrouter" | "groq" | "together";

/**
 * Cost optimization mode for agent execution.
 *
 * @typedef {string} AgentMode
 * @property {string} cheap_first - Try cheaper models first, escalate if needed
 * @property {string} escalation_only - Only use in escalation scenarios
 * @property {string} always - Always use this agent configuration
 */
export type AgentMode = "cheap_first" | "escalation_only" | "always";

/**
 * Operational status of an agent profile.
 *
 * @typedef {string} AgentProfileStatus
 * @property {string} active - Agent is active and available for use
 * @property {string} disabled - Agent is disabled and won't be used
 * @property {string} testing - Agent is in testing mode
 */
export type AgentProfileStatus = "active" | "disabled" | "testing";

/**
 * Status of linking a decision to its execution outcome.
 *
 * @typedef {string} OutcomeLinkStatus
 * @property {string} pending - Order not yet submitted
 * @property {string} submitted - Order submitted to broker
 * @property {string} filled - Order completely filled
 * @property {string} partial - Order partially filled
 * @property {string} cancelled - Order cancelled
 * @property {string} rejected - Order rejected by broker
 * @property {string} expired - Order expired
 */
export type OutcomeLinkStatus = "pending" | "submitted" | "filled" | "partial" | "cancelled" | "rejected" | "expired";

// ============================================================================
// AI DEBATE ARENA
// ============================================================================

/**
 * Debate sessions coordinating multi-agent market analysis.
 * Orchestrates conversations between agents with different perspectives.
 *
 * @table debate_sessions
 * @description Tracks debate sessions where multiple AI agents discuss market
 * opportunities and risks. Records configuration, market context, timing, and costs.
 * Serves as the parent container for debate messages and consensus decisions.
 *
 * @relation strategyVersions - Associated strategy version (database-level FK only)
 */
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

/**
 * Individual messages from agents during debate sessions.
 * Captures each agent's perspective, analysis, and recommendations.
 *
 * @table debate_messages
 * @description Stores each agent's contribution to a debate including their role,
 * stance, confidence, key signals, risks, proposed actions, and evidence references.
 * Tracks LLM usage metrics for cost and performance monitoring.
 *
 * @relation debateSessions - Parent debate session (cascade delete)
 */
export const debateMessages = pgTable("debate_messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => debateSessions.id, { onDelete: "cascade" }).notNull(),
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

/**
 * Final consensus decision from a debate session.
 * Synthesizes agent perspectives into an actionable trading decision.
 *
 * @table debate_consensus
 * @description One-to-one with debate sessions. Records the final decision,
 * order intent, reasoning summary, risk checks, confidence level, and any
 * dissenting opinions. Links to work items for execution tracking.
 *
 * @relation debateSessions - Parent debate session (cascade delete, unique)
 * @relation workItems - Associated work item for execution (database-level FK only)
 * Note: workItemId foreign key defined at database level to avoid circular dependency
 */
export const debateConsensus = pgTable("debate_consensus", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => debateSessions.id, { onDelete: "cascade" }).notNull().unique(),
  decision: text("decision").notNull(),
  orderIntent: jsonb("order_intent"),
  reasonsSummary: text("reasons_summary"),
  riskChecks: jsonb("risk_checks"),
  confidence: numeric("confidence"),
  dissent: jsonb("dissent"),
  // Note: workItemId references workItems table - foreign key defined at database level to avoid circular dependency
  workItemId: varchar("work_item_id"),
  brokerOrderId: text("broker_order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("debate_consensus_session_id_idx").on(table.sessionId),
  index("debate_consensus_work_item_id_idx").on(table.workItemId),
]);

// ============================================================================
// AI AGENT PROFILES (Cost-aware Arena)
// ============================================================================

/**
 * Reusable agent profile configurations.
 * Defines agent personalities, capabilities, and cost constraints.
 *
 * @table ai_agent_profiles
 * @description Stores agent configuration profiles including provider, model,
 * role, execution mode, prompt templates, tool policies, and budget limits.
 * Tracks usage statistics and performance metrics for each profile.
 */
export const aiAgentProfiles = pgTable("ai_agent_profiles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  provider: text("provider").$type<AgentProvider>().notNull(),
  model: text("model").notNull(),
  role: text("role").$type<DebateRole>().notNull(),
  mode: text("mode").$type<AgentMode>().default("cheap_first").notNull(),
  temperature: numeric("temperature").default("0.7"),
  maxTokens: integer("max_tokens").default(2000),
  promptTemplateId: varchar("prompt_template_id"),
  toolPolicy: jsonb("tool_policy"),
  budgetLimitPerDay: numeric("budget_limit_per_day"),
  budgetLimitPerRun: numeric("budget_limit_per_run"),
  priority: integer("priority").default(0),
  status: text("status").$type<AgentProfileStatus>().default("active").notNull(),
  totalCalls: integer("total_calls").default(0).notNull(),
  totalTokens: integer("total_tokens").default(0).notNull(),
  totalCostUsd: numeric("total_cost_usd").default("0").notNull(),
  avgLatencyMs: numeric("avg_latency_ms"),
  successRate: numeric("success_rate"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("ai_agent_profiles_status_idx").on(table.status),
  index("ai_agent_profiles_role_idx").on(table.role),
  index("ai_agent_profiles_mode_idx").on(table.mode),
]);

// ============================================================================
// AI OUTCOME LINKS (Decision → Order → Fill)
// ============================================================================

/**
 * Links AI decisions to their execution outcomes.
 * Tracks the full lifecycle from decision through order execution to PnL.
 *
 * @table ai_outcome_links
 * @description Creates an audit trail connecting consensus decisions and debate
 * sessions to work items, broker orders, fills, and realized PnL. Essential for
 * measuring AI decision quality and calculating true ROI including LLM costs.
 *
 * @relation debateConsensus - Source consensus decision (set null on delete)
 * @relation debateSessions - Source debate session (set null on delete)
 * @relation aiDecisions - Associated AI decision (set null on delete)
 * @relation workItems - Execution work item (database-level FK only)
 * Note: workItemId foreign key defined at database level to avoid circular dependency
 */
export const aiOutcomeLinks = pgTable("ai_outcome_links", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  consensusId: varchar("consensus_id").references(() => debateConsensus.id, { onDelete: "set null" }),
  debateSessionId: varchar("debate_session_id").references(() => debateSessions.id, { onDelete: "set null" }),
  decisionId: varchar("decision_id").references(() => aiDecisions.id, { onDelete: "set null" }),
  // Note: workItemId references workItems table - foreign key defined at database level to avoid circular dependency
  workItemId: varchar("work_item_id"),
  brokerOrderId: varchar("broker_order_id"),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  intendedQty: numeric("intended_qty"),
  intendedNotional: numeric("intended_notional"),
  filledQty: numeric("filled_qty"),
  filledAvgPrice: numeric("filled_avg_price"),
  fillCount: integer("fill_count").default(0),
  status: text("status").$type<OutcomeLinkStatus>().default("pending").notNull(),
  pnlRealized: numeric("pnl_realized"),
  pnlUnrealized: numeric("pnl_unrealized"),
  entryPrice: numeric("entry_price"),
  exitPrice: numeric("exit_price"),
  holdDurationMs: integer("hold_duration_ms"),
  outcome: text("outcome").$type<"win" | "loss" | "breakeven" | "open" | "unknown">().default("unknown"),
  llmCostUsd: numeric("llm_cost_usd"),
  traceId: text("trace_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
}, (table) => [
  index("ai_outcome_links_consensus_id_idx").on(table.consensusId),
  index("ai_outcome_links_debate_session_id_idx").on(table.debateSessionId),
  index("ai_outcome_links_work_item_id_idx").on(table.workItemId),
  index("ai_outcome_links_symbol_idx").on(table.symbol),
  index("ai_outcome_links_status_idx").on(table.status),
  index("ai_outcome_links_outcome_idx").on(table.outcome),
  index("ai_outcome_links_created_at_idx").on(table.createdAt),
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
// INSERT SCHEMAS & TYPES - AI AGENT PROFILES
// ============================================================================

export const insertAiAgentProfileSchema = createInsertSchema(aiAgentProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalCalls: true,
  totalTokens: true,
  totalCostUsd: true,
});

export type InsertAiAgentProfile = z.infer<typeof insertAiAgentProfileSchema>;
export type AiAgentProfile = typeof aiAgentProfiles.$inferSelect;

// ============================================================================
// INSERT SCHEMAS & TYPES - AI OUTCOME LINKS
// ============================================================================

export const insertAiOutcomeLinkSchema = createInsertSchema(aiOutcomeLinks).omit({
  id: true,
  createdAt: true,
});

export type InsertAiOutcomeLink = z.infer<typeof insertAiOutcomeLinkSchema>;
export type AiOutcomeLink = typeof aiOutcomeLinks.$inferSelect;
