/**
 * Admin Module Registry - Client Side
 * 
 * Mirrors the server-side registry for navigation and UI rendering.
 * Modules define their routes, icons, and navigation groups.
 */

import type {
  AdminModule,
  AdminNavGroup,
} from "../../shared/types/admin-module";

const moduleRegistry: Map<string, AdminModule> = new Map();

/**
 * Register an admin module on the client
 */
export function registerAdminModule(module: AdminModule): void {
  moduleRegistry.set(module.id, {
    ...module,
    enabled: module.enabled ?? true,
    priority: module.priority ?? 100,
  });
}

/**
 * Get all registered modules sorted by priority
 */
export function getModules(): AdminModule[] {
  return Array.from(moduleRegistry.values())
    .filter(m => m.enabled)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
}

/**
 * Get modules by navigation group
 */
export function getModulesByNavGroup(navGroup: AdminNavGroup): AdminModule[] {
  return getModules().filter(m => m.navGroup === navGroup);
}

/**
 * Get a specific module by ID
 */
export function getModule(moduleId: string): AdminModule | undefined {
  return moduleRegistry.get(moduleId);
}

/**
 * Get modules that have dedicated routes (screens)
 */
export function getRoutableModules(): AdminModule[] {
  return getModules().filter(m => m.route !== undefined);
}

/**
 * Get modules that are inline cards (no dedicated screen)
 */
export function getInlineModules(): AdminModule[] {
  return getModules().filter(m => m.route === undefined);
}

/**
 * Get navigation groups with their modules
 */
export function getNavGroups(): Array<{ group: AdminNavGroup; modules: AdminModule[] }> {
  const groups: AdminNavGroup[] = ["trading", "ai", "system", "observability"];
  return groups
    .map(group => ({
      group,
      modules: getModulesByNavGroup(group),
    }))
    .filter(g => g.modules.length > 0);
}

/**
 * Get icon name for a navigation group
 */
export function getNavGroupIcon(group: AdminNavGroup): string {
  switch (group) {
    case "trading":
      return "trending-up";
    case "ai":
      return "cpu";
    case "system":
      return "settings";
    case "observability":
      return "activity";
    default:
      return "grid";
  }
}

/**
 * Get display label for a navigation group
 */
export function getNavGroupLabel(group: AdminNavGroup): string {
  switch (group) {
    case "trading":
      return "Trading";
    case "ai":
      return "AI & Intelligence";
    case "system":
      return "System";
    case "observability":
      return "Observability";
    default:
      return group;
  }
}

/**
 * Initialize default admin modules (mirrors server)
 */
export function initializeDefaultModules(): void {
  registerAdminModule({
    id: "api-budget",
    title: "API Budgets",
    description: "Monitor rate limits, budget usage, and cache status",
    icon: "activity",
    navGroup: "system",
    capability: "admin:read",
    route: "ApiBudget",
    priority: 10,
  });

  registerAdminModule({
    id: "model-router",
    title: "LLM Model Router",
    description: "Role-based routing, fallback chains, cost tracking",
    icon: "git-branch",
    navGroup: "ai",
    capability: "admin:read",
    route: "ModelRouter",
    priority: 10,
  });

  registerAdminModule({
    id: "connector-health",
    title: "Connector Health",
    description: "External API connector status",
    icon: "database",
    navGroup: "system",
    capability: "admin:read",
    priority: 20,
  });

  registerAdminModule({
    id: "data-fusion",
    title: "Data Fusion",
    description: "Intelligence score and data sources",
    icon: "layers",
    navGroup: "ai",
    capability: "admin:read",
    priority: 20,
  });

  registerAdminModule({
    id: "ai-config",
    title: "AI Configuration",
    description: "Auto-execute and confidence settings",
    icon: "cpu",
    navGroup: "ai",
    capability: "admin:write",
    priority: 30,
  });

  registerAdminModule({
    id: "api-keys",
    title: "API Keys",
    description: "API key configuration status",
    icon: "key",
    navGroup: "system",
    capability: "admin:read",
    priority: 30,
  });

  registerAdminModule({
    id: "work-queue",
    title: "Work Queue",
    description: "Pending and failed work items",
    icon: "list",
    navGroup: "system",
    capability: "admin:read",
    priority: 15,
  });

  registerAdminModule({
    id: "orchestrator",
    title: "Orchestrator",
    description: "Trading agent and cycle management",
    icon: "play-circle",
    navGroup: "trading",
    capability: "trading:manage",
    priority: 5,
  });
}

initializeDefaultModules();
