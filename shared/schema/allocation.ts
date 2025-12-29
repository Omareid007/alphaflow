/**
 * @module schema/allocation
 * @description Portfolio allocation and rebalancing system schema.
 * Defines allocation policies with risk constraints and tracks rebalancing
 * runs that adjust portfolio weights based on market conditions and strategy signals.
 */

import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, numeric, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";
import { universeAssets, universeCandidates } from "./universe";

// ============================================================================
// ALLOCATION TABLES
// ============================================================================

/**
 * Portfolio allocation policy configurations.
 * Defines risk limits and rebalancing rules for portfolio management.
 *
 * @table allocation_policies
 * @description Stores allocation policy rules including position weight limits,
 * sector concentration limits, liquidity requirements, profit-taking thresholds,
 * and rebalancing frequency. Only one policy can be active at a time.
 *
 * @relation users - User who created this policy (set null on delete)
 */
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
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("allocation_policies_active_idx").on(table.isActive),
]);

/**
 * Portfolio rebalancing execution records.
 * Logs each rebalancing run with inputs, decisions, and outcomes.
 *
 * @table rebalance_runs
 * @description Tracks portfolio rebalancing events including trigger type,
 * input portfolio snapshot, order intents, executed orders, and rationale.
 * Links to the allocation policy that governed the rebalancing logic.
 *
 * @relation allocationPolicies - Policy used for this rebalance (set null on delete)
 */
export const rebalanceRuns = pgTable("rebalance_runs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  policyId: varchar("policy_id").references(() => allocationPolicies.id, { onDelete: "set null" }),
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

// ============================================================================
// INSERT SCHEMAS & TYPES
// ============================================================================

export const insertAllocationPolicySchema = createInsertSchema(allocationPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRebalanceRunSchema = createInsertSchema(rebalanceRuns).omit({
  id: true,
  startedAt: true,
});

export type InsertAllocationPolicy = z.infer<typeof insertAllocationPolicySchema>;
export type AllocationPolicy = typeof allocationPolicies.$inferSelect;
export type InsertRebalanceRun = z.infer<typeof insertRebalanceRunSchema>;
export type RebalanceRun = typeof rebalanceRuns.$inferSelect;
