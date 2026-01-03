/**
 * @module schema/strategy-versioning
 * @description Strategy version control system for managing strategy evolution.
 * Enables versioned strategy configurations with support for drafts, activation,
 * archival, and deprecation. Integrates with backtesting and competition systems.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { strategies } from "./trading";

// ============================================================================
// STRATEGY STUDIO (Versioning)
// ============================================================================

/**
 * Lifecycle status of a strategy version.
 *
 * @typedef {string} StrategyVersionStatus
 * @property {string} draft - Strategy version is in development
 * @property {string} active - Strategy version is active and can be used for trading
 * @property {string} archived - Strategy version is archived for reference
 * @property {string} deprecated - Strategy version is deprecated and should not be used
 */
export type StrategyVersionStatus =
  | "draft"
  | "active"
  | "archived"
  | "deprecated";

/**
 * Versioned strategy configurations.
 * Tracks evolution of trading strategies with full configuration snapshots.
 *
 * @table strategy_versions
 * @description Stores immutable versions of strategy configurations including
 * specifications, universe settings, signal configs, risk parameters, LLM policies,
 * and prompt templates. Supports dry-run testing before activation. Enforces
 * unique version numbers per strategy.
 *
 * @relation strategies - Parent strategy (cascade delete)
 * Note: Unique constraint on (strategyId, version) ensures no duplicate versions
 */
export const strategyVersions = pgTable(
  "strategy_versions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    strategyId: varchar("strategy_id")
      .references(() => strategies.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    spec: jsonb("spec").notNull(),
    universeConfig: jsonb("universe_config"),
    signalsConfig: jsonb("signals_config"),
    riskConfig: jsonb("risk_config"),
    llmPolicy: jsonb("llm_policy"),
    promptTemplate: text("prompt_template"),
    status: text("status")
      .$type<StrategyVersionStatus>()
      .default("draft")
      .notNull(),
    dryRunResult: jsonb("dry_run_result"),
    changeNotes: text("change_notes"),
    createdBy: varchar("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    activatedAt: timestamp("activated_at"),
  },
  (table) => [
    index("strategy_versions_strategy_id_idx").on(table.strategyId),
    index("strategy_versions_status_idx").on(table.status),
    unique("strategy_versions_unique").on(table.strategyId, table.version),
  ]
);

// ============================================================================
// INSERT SCHEMAS & TYPES
// ============================================================================

export const insertStrategyVersionSchema = createInsertSchema(
  strategyVersions
).omit({
  id: true,
  createdAt: true,
});

export type InsertStrategyVersion = z.infer<typeof insertStrategyVersionSchema>;
export type StrategyVersion = typeof strategyVersions.$inferSelect;
