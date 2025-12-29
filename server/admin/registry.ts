/**
 * Admin Module Registry - Server Side
 *
 * Central registry for all admin modules. Modules register themselves
 * with metadata, capabilities, and health check endpoints.
 */

import type {
  AdminModule,
  ModuleRegistrationResult,
  ModuleHealthCheck,
  AdminOverview,
} from "../../shared/types/admin-module";
import { log } from "../utils/logger";

const moduleRegistry: Map<string, AdminModule> = new Map();

/**
 * Register an admin module
 */
export function registerAdminModule(
  module: AdminModule
): ModuleRegistrationResult {
  if (moduleRegistry.has(module.id)) {
    log.warn(
      "AdminRegistry",
      `Module ${module.id} already registered, overwriting`
    );
  }

  const registeredModule: AdminModule = {
    ...module,
    enabled: module.enabled ?? true,
    priority: module.priority ?? 100,
    version: module.version ?? "1.0.0",
  };

  moduleRegistry.set(module.id, registeredModule);
  log.info("AdminRegistry", `Registered module: ${module.id}`, {
    title: module.title,
    navGroup: module.navGroup,
  });

  return { success: true, moduleId: module.id };
}

/**
 * Unregister an admin module
 */
export function unregisterAdminModule(moduleId: string): boolean {
  if (!moduleRegistry.has(moduleId)) {
    return false;
  }
  moduleRegistry.delete(moduleId);
  log.info("AdminRegistry", `Unregistered module: ${moduleId}`);
  return true;
}

/**
 * Get all registered modules
 */
export function getModules(): AdminModule[] {
  return Array.from(moduleRegistry.values())
    .filter((m) => m.enabled)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
}

/**
 * Get modules by navigation group
 */
export function getModulesByNavGroup(navGroup: string): AdminModule[] {
  return getModules().filter((m) => m.navGroup === navGroup);
}

/**
 * Get a specific module by ID
 */
export function getModule(moduleId: string): AdminModule | undefined {
  return moduleRegistry.get(moduleId);
}

/**
 * Check if a module exists
 */
export function hasModule(moduleId: string): boolean {
  return moduleRegistry.has(moduleId);
}

/**
 * Get admin overview with all module statuses
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  const modules = getModules();

  const moduleStatuses = modules.map((m) => ({
    id: m.id,
    title: m.title,
    navGroup: m.navGroup,
    enabled: m.enabled ?? true,
    health: undefined as ModuleHealthCheck | undefined,
  }));

  const unhealthyCount = moduleStatuses.filter(
    (m) => m.health?.status === "unhealthy"
  ).length;
  const degradedCount = moduleStatuses.filter(
    (m) => m.health?.status === "degraded"
  ).length;

  let overall: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (unhealthyCount > 0) overall = "unhealthy";
  else if (degradedCount > 0) overall = "degraded";

  return {
    modules: moduleStatuses,
    systemHealth: {
      overall,
      unhealthyCount,
      degradedCount,
    },
  };
}

/**
 * Enable or disable a module
 */
export function setModuleEnabled(moduleId: string, enabled: boolean): boolean {
  const module = moduleRegistry.get(moduleId);
  if (!module) return false;

  module.enabled = enabled;
  moduleRegistry.set(moduleId, module);
  log.info(
    "AdminRegistry",
    `Module ${moduleId} ${enabled ? "enabled" : "disabled"}`
  );
  return true;
}

/**
 * Initialize default admin modules
 */
export function initializeDefaultModules(): void {
  registerAdminModule({
    id: "api-budget",
    title: "API Budgets",
    description:
      "Monitor rate limits, budget usage, and cache status for all providers",
    icon: "activity",
    navGroup: "system",
    capability: "admin:read",
    route: "ApiBudget",
    apiEndpoints: [
      "/api/admin/api-usage",
      "/api/admin/api-cache",
      "/api/admin/provider-status",
    ],
    priority: 10,
  });

  registerAdminModule({
    id: "model-router",
    title: "LLM Model Router",
    description:
      "Role-based routing, fallback chains, cost tracking, and call logs",
    icon: "git-branch",
    navGroup: "ai",
    capability: "admin:read",
    route: "ModelRouter",
    apiEndpoints: [
      "/api/admin/model-router/configs",
      "/api/admin/model-router/calls",
      "/api/admin/model-router/stats",
    ],
    priority: 10,
  });

  registerAdminModule({
    id: "connector-health",
    title: "Connector Health",
    description: "Monitor external API connector status and sync times",
    icon: "database",
    navGroup: "system",
    capability: "admin:read",
    apiEndpoints: ["/api/admin/connectors-health"],
    priority: 20,
  });

  registerAdminModule({
    id: "data-fusion",
    title: "Data Fusion Engine",
    description:
      "Intelligence score, active sources, and capabilities overview",
    icon: "layers",
    navGroup: "ai",
    capability: "admin:read",
    apiEndpoints: ["/api/admin/data-fusion-status"],
    priority: 20,
  });

  registerAdminModule({
    id: "ai-config",
    title: "AI Configuration",
    description:
      "Auto-execute trades, conservative mode, and confidence thresholds",
    icon: "cpu",
    navGroup: "ai",
    capability: "admin:write",
    apiEndpoints: ["/api/admin/ai-config"],
    settingsSchema: {
      sections: [
        {
          id: "trading",
          title: "Trading Settings",
          fields: [
            {
              key: "autoExecuteTrades",
              label: "Auto-Execute Trades",
              type: "boolean",
              description:
                "Allow AI to execute trades automatically without approval",
              defaultValue: false,
            },
            {
              key: "conservativeMode",
              label: "Conservative Mode",
              type: "boolean",
              description: "Require 85% confidence instead of 70%",
              defaultValue: false,
            },
          ],
        },
      ],
    },
    priority: 30,
  });

  registerAdminModule({
    id: "api-keys",
    title: "API Keys",
    description: "View configured API keys status across all providers",
    icon: "key",
    navGroup: "system",
    capability: "admin:read",
    apiEndpoints: ["/api/admin/api-keys-status"],
    priority: 30,
  });

  registerAdminModule({
    id: "work-queue",
    title: "Work Queue",
    description: "Monitor pending, processing, and failed work items",
    icon: "list",
    navGroup: "system",
    capability: "admin:read",
    apiEndpoints: [
      "/api/admin/work-items",
      "/api/admin/work-items/retry",
      "/api/admin/work-items/dead-letter",
    ],
    priority: 15,
  });

  registerAdminModule({
    id: "orchestrator",
    title: "Orchestrator",
    description: "Trading agent status, cycle management, and kill switch",
    icon: "play-circle",
    navGroup: "trading",
    capability: "trading:manage",
    apiEndpoints: ["/api/admin/orchestrator-health"],
    priority: 5,
  });

  registerAdminModule({
    id: "debate-arena",
    title: "AI Debate Arena",
    description:
      "Multi-role AI consensus system with debate sessions and voting",
    icon: "message-circle",
    navGroup: "ai",
    capability: "admin:read",
    route: "Debate",
    apiEndpoints: ["/api/debate/sessions", "/api/debate/sessions/:id"],
    priority: 25,
  });

  registerAdminModule({
    id: "competition",
    title: "Competition Mode",
    description: "AI trader profiles competing with performance tracking",
    icon: "award",
    navGroup: "ai",
    capability: "admin:read",
    route: "Competition",
    apiEndpoints: ["/api/competition/traders", "/api/competition/runs"],
    priority: 26,
  });

  registerAdminModule({
    id: "strategy-studio",
    title: "Strategy Studio",
    description: "Strategy versioning, activation, and configuration",
    icon: "layers",
    navGroup: "trading",
    capability: "trading:manage",
    route: "Strategies",
    apiEndpoints: ["/api/strategies/versions"],
    priority: 6,
  });

  registerAdminModule({
    id: "tool-router",
    title: "Tool Registry",
    description: "MCP-style tool router with invocation audit trail",
    icon: "tool",
    navGroup: "ai",
    capability: "admin:read",
    route: "Tools",
    apiEndpoints: ["/api/tools", "/api/tools/invoke", "/api/tools/invocations"],
    priority: 27,
  });

  log.info(
    "AdminRegistry",
    `Initialized ${moduleRegistry.size} default modules`
  );
}
