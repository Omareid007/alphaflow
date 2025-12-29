/**
 * @module schema/competition
 * @description Trader competition framework for evaluating multiple strategies.
 * Enables A/B testing of different trader profiles (strategy + model combinations)
 * in parallel to identify top performers. Supports paper trading and recommendation modes.
 */

import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, numeric, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// COMPETITION MODE
// ============================================================================

/**
 * Operational status of a trader profile.
 *
 * @typedef {string} TraderProfileStatus
 * @property {string} active - Trader is active and participating in competitions
 * @property {string} inactive - Trader is inactive and excluded from competitions
 * @property {string} testing - Trader is in testing mode
 */
export type TraderProfileStatus = "active" | "inactive" | "testing";

/**
 * Competition execution mode.
 *
 * @typedef {string} CompetitionMode
 * @property {string} paper_execute_all - Execute all trader decisions in paper trading
 * @property {string} recommend_only - Generate recommendations without execution
 */
export type CompetitionMode = "paper_execute_all" | "recommend_only";

/**
 * Lifecycle status of a competition run.
 *
 * @typedef {string} CompetitionRunStatus
 * @property {string} pending - Competition scheduled but not started
 * @property {string} running - Competition in progress
 * @property {string} completed - Competition finished
 * @property {string} stopped - Competition stopped early
 */
export type CompetitionRunStatus = "pending" | "running" | "completed" | "stopped";

/**
 * Trader profile configurations for competition mode.
 * Defines distinct trading strategies with unique AI models and parameters.
 *
 * @table trader_profiles
 * @description Stores trader profile definitions combining strategy versions
 * with specific model configurations, risk presets, and universe filters.
 * Profiles can be promoted to production based on competition performance.
 *
 * @relation strategyVersions - Associated strategy version (database-level FK only)
 */
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

/**
 * Competition run sessions comparing multiple traders.
 * Orchestrates parallel execution of multiple trader profiles.
 *
 * @table competition_runs
 * @description Tracks competition sessions where multiple trader profiles
 * operate simultaneously on the same universe. Records configuration, duration,
 * and status. Used for A/B testing and identifying best-performing strategies.
 */
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

/**
 * Performance scores for traders in competition runs.
 * Tracks detailed metrics to rank and evaluate trader performance.
 *
 * @table competition_scores
 * @description Stores performance metrics for each trader in a competition run
 * including PnL, ROI, drawdown, win rate, trade count, error rate, and cost per
 * decision. Supports periodic snapshots and ranking calculations.
 *
 * @relation competitionRuns - Parent competition run (cascade delete)
 * @relation traderProfiles - Trader being scored (cascade delete)
 */
export const competitionScores = pgTable("competition_scores", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  runId: varchar("run_id").references(() => competitionRuns.id, { onDelete: "cascade" }).notNull(),
  traderProfileId: varchar("trader_profile_id").references(() => traderProfiles.id, { onDelete: "cascade" }).notNull(),
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
// INSERT SCHEMAS & TYPES
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
