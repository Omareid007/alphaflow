import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, numeric, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
