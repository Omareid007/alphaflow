import type { AdminCapability } from "../../shared/types/admin-module";

export type UserRole = "admin" | "operator" | "viewer" | "guest";

export interface RBACContext {
  userId: string;
  username: string;
  isAdmin: boolean;
  role: UserRole;
  capabilities: AdminCapability[];
}

const ROLE_CAPABILITIES: Record<UserRole, AdminCapability[]> = {
  admin: [
    "admin:read",
    "admin:write",
    "admin:danger",
    "trading:read",
    "trading:write",
    "trading:manage",
    "system:read",
    "system:write",
    "ai:read",
    "ai:write",
  ],
  operator: [
    "admin:read",
    "admin:write",
    "trading:read",
    "trading:write",
    "trading:manage",
    "system:read",
    "ai:read",
    "ai:write",
  ],
  viewer: ["admin:read", "trading:read", "system:read", "ai:read"],
  guest: [],
};

export function getRoleFromUser(user: { isAdmin: boolean }): UserRole {
  return user.isAdmin ? "admin" : "viewer";
}

export function getCapabilitiesForRole(role: UserRole): AdminCapability[] {
  return ROLE_CAPABILITIES[role] || [];
}

export function hasCapability(
  context: RBACContext,
  capability: AdminCapability
): boolean {
  return context.capabilities.includes(capability);
}

export function hasAnyCapability(
  context: RBACContext,
  capabilities: AdminCapability[]
): boolean {
  return capabilities.some((cap) => context.capabilities.includes(cap));
}

export function hasAllCapabilities(
  context: RBACContext,
  capabilities: AdminCapability[]
): boolean {
  return capabilities.every((cap) => context.capabilities.includes(cap));
}

export function createRBACContext(user: {
  id: string;
  username: string;
  isAdmin: boolean;
}): RBACContext {
  const role = getRoleFromUser(user);
  return {
    userId: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    role,
    capabilities: getCapabilitiesForRole(role),
  };
}

export function filterModulesByCapability<
  T extends { capability: AdminCapability },
>(modules: T[], context: RBACContext): T[] {
  return modules.filter((module) => hasCapability(context, module.capability));
}

export function getAllRoles(): UserRole[] {
  return ["admin", "operator", "viewer", "guest"];
}

export function getRoleInfo(role: UserRole): {
  role: UserRole;
  capabilities: AdminCapability[];
  description: string;
} {
  const descriptions: Record<UserRole, string> = {
    admin: "Full access to all admin features including dangerous operations",
    operator:
      "Can manage trading and view all data, but no destructive operations",
    viewer: "Read-only access to dashboards and data",
    guest: "No access to admin features",
  };

  return {
    role,
    capabilities: getCapabilitiesForRole(role),
    description: descriptions[role],
  };
}
