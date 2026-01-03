import { pgTable, varchar, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

/**
 * Notification Preferences Schema
 * Stores user-specific email notification preferences for trading events.
 *
 * @property {string} id - Auto-generated UUID primary key
 * @property {string} userId - Foreign key to users table (cascade delete)
 * @property {boolean} emailOrderFills - Notify on order fills (default: true)
 * @property {boolean} emailLargeLosses - Notify on large losses (default: true)
 * @property {boolean} emailCircuitBreaker - Notify on circuit breaker triggers (default: true)
 * @property {boolean} emailDailySummary - Send daily trading summary (default: false)
 * @property {boolean} emailWeeklyReport - Send weekly performance report (default: true)
 * @property {Date} createdAt - When the record was created
 * @property {Date} updatedAt - When the record was last modified
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emailOrderFills: boolean("email_order_fills").default(true).notNull(),
    emailLargeLosses: boolean("email_large_losses").default(true).notNull(),
    emailCircuitBreaker: boolean("email_circuit_breaker").default(true).notNull(),
    emailDailySummary: boolean("email_daily_summary").default(false).notNull(),
    emailWeeklyReport: boolean("email_weekly_report").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Ensure one preferences record per user
    unique("notification_preferences_user_id_unique").on(table.userId),
    // Index for fast user lookup
    index("notification_preferences_user_id_idx").on(table.userId),
  ]
);

// Zod schemas for validation
export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences, {
  emailOrderFills: z.boolean().default(true),
  emailLargeLosses: z.boolean().default(true),
  emailCircuitBreaker: z.boolean().default(true),
  emailDailySummary: z.boolean().default(false),
  emailWeeklyReport: z.boolean().default(true),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectNotificationPreferencesSchema = createSelectSchema(notificationPreferences);

export const updateNotificationPreferencesSchema = insertNotificationPreferencesSchema.partial().omit({
  userId: true,
});

// TypeScript types
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type SelectNotificationPreferences = z.infer<typeof selectNotificationPreferencesSchema>;
export type UpdateNotificationPreferences = z.infer<typeof updateNotificationPreferencesSchema>;

// Default preferences for new users
export const defaultNotificationPreferences: Omit<InsertNotificationPreferences, "userId"> = {
  emailOrderFills: true,
  emailLargeLosses: true,
  emailCircuitBreaker: true,
  emailDailySummary: false,
  emailWeeklyReport: true,
};
