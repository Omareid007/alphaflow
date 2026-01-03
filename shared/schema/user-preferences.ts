import {
  pgTable,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

/**
 * User Preferences Schema
 * Stores user-specific UI preferences including theme, accent color, and animation settings.
 * Part of Phase 3 Robinhood UI theming system.
 */

// Theme options
export const themeValues = ["dark", "light", "system"] as const;
export type ThemeValue = (typeof themeValues)[number];

// Animation level options
export const animationLevelValues = ["full", "reduced", "none"] as const;
export type AnimationLevel = (typeof animationLevelValues)[number];

// Chart style options
export const chartStyleValues = ["area", "candle", "line"] as const;
export type ChartStyle = (typeof chartStyleValues)[number];

// User preferences table
export const userPreferences = pgTable(
  "user_preferences",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    theme: varchar("theme", { length: 10 }).default("dark").notNull(),
    accentColor: varchar("accent_color", { length: 7 })
      .default("#00C805")
      .notNull(),
    animationLevel: varchar("animation_level", { length: 10 })
      .default("full")
      .notNull(),
    chartStyle: varchar("chart_style", { length: 10 })
      .default("area")
      .notNull(),
    // Extensible JSON column for future preferences
    extras: jsonb("extras").default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Ensure one preferences record per user
    unique("user_preferences_user_id_unique").on(table.userId),
    // Index for fast user lookup
    index("user_preferences_user_id_idx").on(table.userId),
  ]
);

// Zod schemas for validation
export const insertUserPreferencesSchema = createInsertSchema(userPreferences, {
  theme: z.enum(themeValues).default("dark"),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g., #00C805)")
    .default("#00C805"),
  animationLevel: z.enum(animationLevelValues).default("full"),
  chartStyle: z.enum(chartStyleValues).default("area"),
  extras: z.record(z.unknown()).default({}),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectUserPreferencesSchema = createSelectSchema(userPreferences);

export const updateUserPreferencesSchema = insertUserPreferencesSchema
  .partial()
  .omit({
    userId: true,
  });

// TypeScript types
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type SelectUserPreferences = z.infer<typeof selectUserPreferencesSchema>;
export type UpdateUserPreferences = z.infer<typeof updateUserPreferencesSchema>;

// Default preferences for new users
export const defaultUserPreferences: Omit<InsertUserPreferences, "userId"> = {
  theme: "dark",
  accentColor: "#00C805",
  animationLevel: "full",
  chartStyle: "area",
  extras: {},
};
