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

export type DebateRole = "bull" | "bear" | "risk_manager" | "technical_analyst" | "fundamental_analyst" | "judge";
export type DebateSessionStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type AgentProvider = "openai" | "openrouter" | "groq" | "together";
export type AgentMode = "cheap_first" | "escalation_only" | "always";
export type AgentProfileStatus = "active" | "disabled" | "testing";
export type OutcomeLinkStatus = "pending" | "submitted" | "filled" | "partial" | "cancelled" | "rejected" | "expired";

// ============================================================================
// AI DEBATE ARENA
// ============================================================================

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
