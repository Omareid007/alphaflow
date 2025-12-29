/**
 * @module shared/schema/auth
 * @description Authentication and user management schema
 *
 * This module defines the core database tables for user authentication, session management,
 * admin settings, and audit logging. It implements security features including:
 * - Cascade deletion for user sessions when users are deleted
 * - Session expiry tracking for automatic cleanup
 * - Soft deletion for admin settings (set null on user delete)
 * - Comprehensive audit trails for all system actions
 */

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, index, unique, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// AUTHENTICATION & USER MANAGEMENT
// ============================================================================

/**
 * Users table
 *
 * Stores system users with authentication credentials and role information.
 *
 * @property {string} id - Auto-generated UUID primary key
 * @property {string} username - Unique username for authentication
 * @property {string} password - Hashed password (never stored in plaintext)
 * @property {boolean} isAdmin - Whether the user has administrator privileges (default: false)
 *
 * @remarks
 * - All sessions and related records are cascade deleted when a user is removed
 * - Usernames are unique and required for login
 * - Passwords should be hashed using bcrypt or similar before storage
 */
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
});

/**
 * Sessions table
 *
 * Manages user authentication sessions with automatic expiry tracking.
 *
 * @property {string} id - Session token used as primary key
 * @property {string} userId - Foreign key to users table (cascade delete)
 * @property {Date} expiresAt - Timestamp when the session expires
 * @property {Date} createdAt - When the session was created
 *
 * @remarks
 * Security features:
 * - Sessions are cascade deleted when the user is removed
 * - Indexed on userId for efficient user session lookups
 * - Indexed on expiresAt for automated cleanup of expired sessions
 * - Expired sessions should be purged regularly via background job
 */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
  index("sessions_expires_at_idx").on(table.expiresAt),
]);

// ============================================================================
// ADMIN SETTINGS
// ============================================================================

/**
 * Admin Settings table
 *
 * Stores system-wide configuration settings organized by namespace and key.
 * Supports secret values and read-only protection.
 *
 * @property {string} id - Auto-generated UUID primary key
 * @property {string} namespace - Logical grouping for settings (e.g., "broker", "ai", "system")
 * @property {string} key - Setting key within the namespace
 * @property {object} value - JSON value of the setting (can be any JSON-serializable type)
 * @property {string|null} description - Human-readable description of the setting
 * @property {boolean} isSecret - Whether the setting contains sensitive data (default: false)
 * @property {boolean} isReadOnly - Whether the setting can be modified via UI (default: false)
 * @property {string|null} updatedBy - Foreign key to users table (set null on user delete)
 * @property {Date} createdAt - When the setting was created
 * @property {Date} updatedAt - When the setting was last modified
 *
 * @remarks
 * - Unique constraint on (namespace, key) ensures no duplicates
 * - Indexed on namespace and key for efficient lookups
 * - Secret settings should be encrypted at rest
 * - Read-only settings prevent accidental modification of critical config
 */
export const adminSettings = pgTable("admin_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  namespace: text("namespace").notNull(),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  description: text("description"),
  isSecret: boolean("is_secret").default(false).notNull(),
  isReadOnly: boolean("is_read_only").default(false).notNull(),
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("admin_settings_namespace_idx").on(table.namespace),
  index("admin_settings_key_idx").on(table.key),
  unique("admin_settings_namespace_key_unique").on(table.namespace, table.key),
]);

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Audit Logs table
 *
 * Comprehensive audit trail for all system actions, API calls, and user activities.
 * Captures request/response metadata for security and compliance.
 *
 * @property {string} id - Auto-generated UUID primary key
 * @property {string|null} userId - Foreign key to users table (set null on user delete)
 * @property {string|null} username - Denormalized username for historical record keeping
 * @property {string} action - Action performed (e.g., "create", "update", "delete", "login")
 * @property {string} resource - Resource type affected (e.g., "user", "order", "strategy")
 * @property {string|null} resourceId - ID of the specific resource affected
 * @property {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @property {string} path - API endpoint path
 * @property {string|null} ipAddress - Client IP address
 * @property {string|null} userAgent - Client user agent string
 * @property {object|null} requestBody - JSON snapshot of request payload
 * @property {number|null} responseStatus - HTTP response status code
 * @property {string|null} errorMessage - Error message if the action failed
 * @property {Date} timestamp - When the action occurred
 *
 * @remarks
 * - Indexed on userId, action, resource, and timestamp for efficient querying
 * - Username is denormalized to preserve audit trail even after user deletion
 * - Request body is stored for debugging and compliance purposes
 * - Should be rotated/archived periodically based on retention policies
 */
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  username: text("username"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  method: text("method").notNull(),
  path: text("path").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  requestBody: jsonb("request_body"),
  responseStatus: integer("response_status"),
  errorMessage: text("error_message"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("audit_logs_user_id_idx").on(table.userId),
  index("audit_logs_action_idx").on(table.action),
  index("audit_logs_resource_idx").on(table.resource),
  index("audit_logs_timestamp_idx").on(table.timestamp),
]);

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

/**
 * Zod schema for inserting a new user
 *
 * @remarks
 * - Omits auto-generated fields (id)
 * - isAdmin is optional and defaults to false
 * - Password should be hashed before insertion
 */
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isAdmin: true,
}).extend({
  isAdmin: z.boolean().optional(),
});

/**
 * Zod schema for inserting a new session
 *
 * @remarks
 * - Omits createdAt (auto-generated)
 * - Requires session id (token), userId, and expiresAt
 */
export const insertSessionSchema = createInsertSchema(sessions).omit({
  createdAt: true,
});

/**
 * Zod schema for inserting a new admin setting
 *
 * @remarks
 * - Omits auto-generated fields (id, createdAt, updatedAt)
 * - Requires namespace, key, and value
 */
export const insertAdminSettingSchema = createInsertSchema(adminSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * Zod schema for inserting a new audit log
 *
 * @remarks
 * - Omits auto-generated fields (id, timestamp)
 * - Requires action, resource, method, and path at minimum
 */
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

// ============================================================================
// TYPES
// ============================================================================

/**
 * Type for inserting a new user (inferred from table schema)
 */
export type InsertUser = typeof users.$inferInsert;

/**
 * Type for a user record (inferred from table schema)
 */
export type User = typeof users.$inferSelect;

/**
 * Type for inserting a new session (inferred from table schema)
 */
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Type for a session record (inferred from table schema)
 */
export type Session = typeof sessions.$inferSelect;

/**
 * Type for inserting a new admin setting (inferred from Zod schema)
 */
export type InsertAdminSetting = z.infer<typeof insertAdminSettingSchema>;

/**
 * Type for an admin setting record (inferred from table schema)
 */
export type AdminSetting = typeof adminSettings.$inferSelect;

/**
 * Type for inserting a new audit log (inferred from Zod schema)
 */
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

/**
 * Type for an audit log record (inferred from table schema)
 */
export type AuditLog = typeof auditLogs.$inferSelect;
