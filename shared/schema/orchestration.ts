/**
 * @module schema/orchestration
 * @description Agent orchestration and work queue system schema.
 * Manages agent lifecycle, task queuing, execution tracking, and AI arena runs.
 * Central coordination layer for autonomous trading agent operations.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  numeric,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { aiDecisions } from "./ai-decisions";

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Types of work items that can be queued for execution.
 *
 * @enum {string}
 * @property {string} ORDER_SUBMIT - Submit a new order to the broker
 * @property {string} ORDER_CANCEL - Cancel an existing order
 * @property {string} ORDER_SYNC - Synchronize order status with broker
 * @property {string} POSITION_CLOSE - Close an open position
 * @property {string} KILL_SWITCH - Emergency stop all trading activity
 * @property {string} DECISION_EVALUATION - Evaluate an AI trading decision
 * @property {string} ASSET_UNIVERSE_SYNC - Synchronize asset universe data
 */
export const workItemTypes = [
  "ORDER_SUBMIT",
  "ORDER_CANCEL",
  "ORDER_SYNC",
  "POSITION_CLOSE",
  "KILL_SWITCH",
  "DECISION_EVALUATION",
  "ASSET_UNIVERSE_SYNC",
] as const;

export type WorkItemType = (typeof workItemTypes)[number];

/**
 * Execution status of a work item.
 *
 * @enum {string}
 * @property {string} PENDING - Work item queued but not yet started
 * @property {string} RUNNING - Work item currently executing
 * @property {string} SUCCEEDED - Work item completed successfully
 * @property {string} FAILED - Work item failed with error
 * @property {string} DEAD_LETTER - Work item exceeded retry limit and moved to dead letter queue
 */
export const workItemStatuses = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "DEAD_LETTER",
] as const;

export type WorkItemStatus = (typeof workItemStatuses)[number];

/**
 * Status of an AI arena run.
 *
 * @typedef {string} ArenaRunStatus
 * @property {string} pending - Arena run scheduled but not started
 * @property {string} running - Arena run in progress
 * @property {string} completed - Arena run finished successfully
 * @property {string} failed - Arena run failed with error
 * @property {string} cancelled - Arena run was cancelled
 */
export type ArenaRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Mode of operation for an AI arena run.
 *
 * @typedef {string} ArenaMode
 * @property {string} debate - Multi-agent debate mode with bull/bear perspectives
 * @property {string} competition - Competition mode where agents compete for best performance
 * @property {string} consensus - Consensus-seeking mode for collaborative decisions
 */
export type ArenaMode = "debate" | "competition" | "consensus";

// ============================================================================
// AGENT STATUS TABLE
// ============================================================================

/**
 * Central agent status and configuration singleton.
 * Tracks runtime state, risk parameters, and operational mode.
 *
 * @table agent_status
 * @description Single-row table storing the trading agent's current state including
 * running status, performance metrics, risk limits, kill switch, and operational
 * parameters. Controls agent behavior and provides real-time health monitoring.
 */
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

export type AgentStatus = typeof agentStatus.$inferSelect;
export type InsertAgentStatus = typeof agentStatus.$inferInsert;

// ============================================================================
// WORK ITEMS TABLE
// ============================================================================

/**
 * Task queue for agent work items.
 * Implements durable task queue with retry logic and dead letter handling.
 *
 * @table work_items
 * @description Stores all queued and executed tasks for the trading agent including
 * order submissions, cancellations, position management, and decision evaluations.
 * Supports retry logic, idempotency, and failure tracking.
 *
 * @relation aiDecisions - Associated AI decision (set null on delete)
 */
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
  decisionId: varchar("decision_id").references(() => aiDecisions.id, {
    onDelete: "set null",
  }),
  brokerOrderId: text("broker_order_id"),
  symbol: text("symbol"),
  result: text("result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWorkItemSchema = createInsertSchema(workItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  attempts: true,
});

export type InsertWorkItem = z.infer<typeof insertWorkItemSchema>;
export type WorkItem = typeof workItems.$inferSelect;

// ============================================================================
// WORK ITEM RUNS TABLE
// ============================================================================

/**
 * Execution history for work item attempts.
 * Logs each retry attempt with timing and error details.
 *
 * @table work_item_runs
 * @description Tracks individual execution attempts for work items. Records start/end
 * times, status, errors, and duration. Essential for debugging failures and analyzing
 * retry patterns.
 *
 * @relation workItems - Parent work item (cascade delete)
 */
export const workItemRuns = pgTable("work_item_runs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workItemId: varchar("work_item_id")
    .references(() => workItems.id, { onDelete: "cascade" })
    .notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  status: text("status").default("RUNNING").notNull(),
  error: text("error"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWorkItemRunSchema = createInsertSchema(workItemRuns).omit({
  id: true,
  createdAt: true,
});

export type InsertWorkItemRun = z.infer<typeof insertWorkItemRunSchema>;
export type WorkItemRun = typeof workItemRuns.$inferSelect;

// ============================================================================
// AI ARENA RUNS TABLE
// ============================================================================

/**
 * Multi-agent AI arena execution sessions.
 * Coordinates debate, competition, or consensus-seeking among AI agents.
 *
 * @table ai_arena_runs
 * @description Records AI arena sessions where multiple agents analyze market data
 * and propose trading decisions. Tracks mode (debate/competition/consensus),
 * participants, market snapshots, outcomes, and cost metrics. Supports strategy
 * versioning and escalation workflows.
 *
 * @relation strategyVersions - Associated strategy version (database-level FK only)
 * Note: Foreign key left unresolved to avoid circular dependency
 */
export const aiArenaRuns = pgTable(
  "ai_arena_runs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    traceId: text("trace_id").notNull(),
    mode: text("mode").$type<ArenaMode>().default("debate").notNull(),
    symbols: text("symbols").array().notNull(),
    agentProfileIds: text("agent_profile_ids").array().notNull(),
    marketSnapshotHash: text("market_snapshot_hash"),
    portfolioSnapshotHash: text("portfolio_snapshot_hash"),
    // Note: strategyVersionId references strategy_versions table but defined without .references() to avoid circular type dependency
    // The foreign key constraint exists at database level via migration
    strategyVersionId: varchar("strategy_version_id"),
    status: text("status").$type<ArenaRunStatus>().default("pending").notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    durationMs: integer("duration_ms"),
    totalTokensUsed: integer("total_tokens_used").default(0),
    totalCostUsd: numeric("total_cost_usd").default("0"),
    escalationTriggered: boolean("escalation_triggered").default(false),
    escalationReason: text("escalation_reason"),
    consensusReached: boolean("consensus_reached"),
    finalDecision: text("final_decision"),
    disagreementRate: numeric("disagreement_rate"),
    avgConfidence: numeric("avg_confidence"),
    triggeredBy: text("triggered_by"),
    outcomeLinked: boolean("outcome_linked").default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ai_arena_runs_trace_id_idx").on(table.traceId),
    index("ai_arena_runs_status_idx").on(table.status),
    index("ai_arena_runs_mode_idx").on(table.mode),
    index("ai_arena_runs_created_at_idx").on(table.createdAt),
  ]
);

export const insertAiArenaRunSchema = createInsertSchema(aiArenaRuns).omit({
  id: true,
  createdAt: true,
});

export type InsertAiArenaRun = z.infer<typeof insertAiArenaRunSchema>;
export type AiArenaRun = typeof aiArenaRuns.$inferSelect;

// ============================================================================
// AI ARENA AGENT DECISIONS TABLE
// ============================================================================

import { DebateRole } from "./debate-arena";

/**
 * Individual agent decisions within an AI arena run.
 * Captures each agent's analysis, proposed actions, and reasoning.
 *
 * @table ai_arena_agent_decisions
 * @description Stores individual agent outputs during arena runs including their role,
 * action recommendations, confidence levels, rationale, risks, and proposed orders.
 * Tracks cost metrics and performance data for each agent's contribution.
 *
 * @relation aiArenaRuns - Parent arena run (cascade delete)
 * @relation aiAgentProfiles - Agent profile (database-level FK only)
 * Note: agentProfileId foreign key left unresolved to avoid circular dependency
 */
export const aiArenaAgentDecisions = pgTable(
  "ai_arena_agent_decisions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    arenaRunId: varchar("arena_run_id")
      .references(() => aiArenaRuns.id, { onDelete: "cascade" })
      .notNull(),
    // Note: agentProfileId references ai_agent_profiles table but defined without .references() to avoid circular type dependency
    // The foreign key constraint exists at database level via migration
    agentProfileId: varchar("agent_profile_id"),
    role: text("role").$type<DebateRole>().notNull(),
    action: text("action").notNull(),
    symbols: text("symbols").array(),
    confidence: numeric("confidence"),
    stance: text("stance"),
    rationale: text("rationale"),
    keySignals: text("key_signals"),
    risks: text("risks"),
    proposedOrder: text("proposed_order"),
    tokensUsed: integer("tokens_used"),
    costUsd: numeric("cost_usd"),
    latencyMs: integer("latency_ms"),
    modelUsed: text("model_used"),
    wasEscalation: boolean("was_escalation").default(false),
    rawOutput: text("raw_output"),
    toolCallsCount: integer("tool_calls_count").default(0),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ai_arena_agent_decisions_run_id_idx").on(table.arenaRunId),
    index("ai_arena_agent_decisions_agent_profile_id_idx").on(
      table.agentProfileId
    ),
    index("ai_arena_agent_decisions_role_idx").on(table.role),
  ]
);

export const insertAiArenaAgentDecisionSchema = createInsertSchema(
  aiArenaAgentDecisions
).omit({
  id: true,
  createdAt: true,
});

export type InsertAiArenaAgentDecision = z.infer<
  typeof insertAiArenaAgentDecisionSchema
>;
export type AiArenaAgentDecision = typeof aiArenaAgentDecisions.$inferSelect;
