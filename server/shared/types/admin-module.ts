/**
 * Admin Module Registry Types
 * 
 * Defines the contract for pluggable admin modules in a WordPress-like architecture.
 * Modules can register themselves with metadata, capabilities, settings, and health checks.
 */

/**
 * Admin capability for RBAC
 */
export type AdminCapability =
  | "admin:read"       // View admin dashboards
  | "admin:write"      // Modify settings
  | "admin:danger"     // Destructive actions (purge cache, force refresh)
  | "trading:read"     // View trading data
  | "trading:write"    // Execute trades
  | "trading:manage"   // Manage strategies, kill switch
  | "system:read"      // View system health
  | "system:write"     // Modify system settings
  | "ai:read"          // View AI decisions
  | "ai:write";        // Modify AI config

/**
 * Navigation group for organizing admin modules
 */
export type AdminNavGroup = "trading" | "ai" | "system" | "observability";

/**
 * Health check result for a module
 */
export interface ModuleHealthCheck {
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  message?: string;
  lastChecked?: string;
  details?: Record<string, unknown>;
}

/**
 * Settings field type for dynamic form rendering
 */
export type SettingsFieldType = "string" | "number" | "boolean" | "select" | "json";

/**
 * Settings field definition for dynamic admin settings
 */
export interface SettingsField {
  key: string;
  label: string;
  type: SettingsFieldType;
  description?: string;
  defaultValue?: unknown;
  options?: Array<{ value: string | number; label: string }>; // For select type
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/**
 * Settings section groups related fields
 */
export interface SettingsSection {
  id: string;
  title: string;
  description?: string;
  fields: SettingsField[];
}

/**
 * Settings schema for a module
 */
export interface SettingsSchema {
  sections: SettingsSection[];
}

/**
 * Admin Module definition
 */
export interface AdminModule {
  id: string;                          // Unique identifier (e.g., "api-budget")
  title: string;                       // Display title (e.g., "API Budgets")
  description?: string;                // Short description for dashboard
  icon: string;                        // Feather icon name (e.g., "activity")
  navGroup: AdminNavGroup;             // Group in navigation
  capability: AdminCapability;         // Required capability to access
  route?: string;                      // React Navigation route name (if has dedicated screen)
  apiEndpoints?: string[];             // Related API endpoints for discovery
  settingsSchema?: SettingsSchema;     // Dynamic settings form schema
  healthCheckEndpoint?: string;        // API endpoint for health check
  priority?: number;                   // Sort order within navGroup (lower = first)
  enabled?: boolean;                   // Whether module is active
  version?: string;                    // Module version
}

/**
 * Module registration result
 */
export interface ModuleRegistrationResult {
  success: boolean;
  moduleId: string;
  error?: string;
}

/**
 * Module health status aggregated
 */
export interface ModuleHealthStatus {
  moduleId: string;
  title: string;
  health: ModuleHealthCheck;
}

/**
 * Admin overview combining all module statuses
 */
export interface AdminOverview {
  modules: Array<{
    id: string;
    title: string;
    navGroup: AdminNavGroup;
    enabled: boolean;
    health?: ModuleHealthCheck;
  }>;
  systemHealth: {
    overall: "healthy" | "degraded" | "unhealthy";
    unhealthyCount: number;
    degradedCount: number;
  };
}
