import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, integer, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { strategies } from "./trading";

// ============================================================================
// STRATEGY STUDIO (Versioning)
// ============================================================================

export type StrategyVersionStatus = "draft" | "active" | "archived" | "deprecated";

export const strategyVersions = pgTable("strategy_versions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").references(() => strategies.id, { onDelete: "cascade" }).notNull(),
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
// INSERT SCHEMAS & TYPES
// ============================================================================

export const insertStrategyVersionSchema = createInsertSchema(strategyVersions).omit({
  id: true,
  createdAt: true,
});

export type InsertStrategyVersion = z.infer<typeof insertStrategyVersionSchema>;
export type StrategyVersion = typeof strategyVersions.$inferSelect;
