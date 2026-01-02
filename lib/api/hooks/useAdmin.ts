import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { toast } from "sonner";

// ============================================================================
// ALLOCATION POLICIES
// ============================================================================

export interface AllocationPolicy {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  maxPositionWeightPct: string;
  maxSectorWeightPct: string;
  rebalanceFrequency: string;
  createdAt: string;
  updatedAt: string;
}

export function useAllocationPolicies() {
  return useQuery({
    queryKey: ["allocation-policies"],
    queryFn: () =>
      api.get<{ policies: AllocationPolicy[]; count: number }>(
        "/api/allocation-policies"
      ),
    select: (data) => data.policies,
  });
}

export function useCreateAllocationPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policy: Partial<AllocationPolicy>) =>
      api.post<AllocationPolicy>("/api/allocation-policies", policy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocation-policies"] });
    },
  });
}

export function useUpdateAllocationPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: { id: string } & Partial<AllocationPolicy>) =>
      api.patch<AllocationPolicy>(`/api/allocation-policies/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocation-policies"] });
    },
  });
}

export function useDeleteAllocationPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/allocation-policies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocation-policies"] });
    },
  });
}

// ============================================================================
// REBALANCE RUNS
// ============================================================================

export interface RebalanceRun {
  id: string;
  policyId?: string;
  traceId: string;
  status: string;
  triggerType: string;
  inputSnapshot?: any;
  orderIntents?: any;
  executedOrders?: any;
  rationale?: string;
  startedAt: string;
  completedAt?: string;
}

export function useRebalanceRuns(limit?: number) {
  return useQuery({
    queryKey: ["rebalance-runs", limit],
    queryFn: () =>
      api.get<{ runs: RebalanceRun[]; count: number }>("/api/rebalance/runs", {
        params: limit ? { limit } : undefined,
      }),
    select: (data) => data.runs,
  });
}

export function useTriggerRebalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { policyId?: string; triggerType?: string }) =>
      api.post<{ success: boolean; run: RebalanceRun }>(
        "/api/rebalance/trigger",
        params
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rebalance-runs"] });
    },
  });
}

// ============================================================================
// ENFORCEMENT RULES
// ============================================================================

export interface EnforcementRule {
  id: string;
  name: string;
  description?: string;
  ruleType: string;
  condition: { scope?: string; [key: string]: any };
  threshold: string;
  enabled: boolean;
  webhookUrl?: string;
  lastTriggeredAt?: string;
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function useEnforcementRules() {
  return useQuery({
    queryKey: ["enforcement-rules"],
    queryFn: () =>
      api.get<{ rules: EnforcementRule[]; count: number }>(
        "/api/enforcement/rules"
      ),
    select: (data) => data.rules,
  });
}

export function useCreateEnforcementRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rule: Partial<EnforcementRule>) =>
      api.post<EnforcementRule>("/api/enforcement/rules", rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enforcement-rules"] });
    },
  });
}

export function useUpdateEnforcementRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: { id: string } & Partial<EnforcementRule>) =>
      api.patch<EnforcementRule>(`/api/enforcement/rules/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enforcement-rules"] });
    },
  });
}

export function useDeleteEnforcementRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/enforcement/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enforcement-rules"] });
    },
  });
}

// ============================================================================
// FUNDAMENTALS DATA
// ============================================================================

export interface FundamentalFactor {
  id: string;
  name: string;
  source: string;
  cadence: string;
  status: string;
  lastUpdated: string;
}

export function useFundamentalFactors(symbol?: string) {
  return useQuery({
    queryKey: ["fundamentals", symbol],
    queryFn: () =>
      api.get<{ factors: FundamentalFactor[]; rawData: any[]; count: number }>(
        "/api/fundamentals/factors",
        {
          params: symbol ? { symbol } : undefined,
        }
      ),
    select: (data) => data.factors,
  });
}

export function useRefreshFundamentals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ success: boolean; message: string }>(
        "/api/fundamentals/refresh"
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fundamentals"] });
    },
  });
}

// ============================================================================
// UNIVERSE DATA
// ============================================================================

export interface UniverseStats {
  totalSymbols: number;
  activeSymbols: number;
  cryptoCount: number;
  equityCount: number;
}

export interface UniverseAsset {
  symbol: string;
  name: string;
  exchange: string;
  assetClass: string;
  tradable: boolean;
}

export function useUniverseStats() {
  return useQuery({
    queryKey: ["universe", "stats"],
    queryFn: () => api.get<UniverseStats>("/api/universe/stats"),
  });
}

export function useUniverseSymbols(options?: {
  assetClass?: string;
  tradableOnly?: boolean;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["universe", "symbols", options],
    queryFn: () =>
      api.get<{ assets: UniverseAsset[]; count: number }>(
        "/api/universe/symbols",
        {
          params: options,
        }
      ),
    select: (data) => data.assets,
  });
}

export function useUniverseSearch(query: string) {
  return useQuery({
    queryKey: ["universe", "search", query],
    queryFn: () =>
      api.get<{ assets: UniverseAsset[]; count: number }>(
        "/api/universe/search",
        {
          params: { q: query },
        }
      ),
    select: (data) => data.assets,
    enabled: query.length >= 1,
  });
}

export function useSyncUniverse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean }>("/api/universe/sync-now"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["universe"] });
    },
  });
}

// ============================================================================
// AI ARENA
// ============================================================================

export interface ArenaRun {
  id: string;
  mode: string;
  symbols: string[];
  consensusDecision?: string;
  consensusConfidence?: number;
  totalCostUsd?: string;
  escalationTriggered?: boolean;
  triggeredBy?: string;
  strategyVersionId?: string;
  traceId?: string;
  createdAt: string;
}

export interface ArenaStats {
  runsToday: number;
  costToday: number;
  costWeek: number;
  escalationsToday: number;
  activeProfiles: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  description?: string;
  provider: string;
  model: string;
  role: string;
  mode: string;
  temperature?: string;
  maxTokens?: number;
  budgetLimitPerDay?: string;
  budgetLimitPerRun?: string;
  priority?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function useArenaStats() {
  return useQuery({
    queryKey: ["arena", "stats"],
    queryFn: () => api.get<ArenaStats>("/api/arena/stats"),
  });
}

export function useArenaRuns(limit?: number) {
  return useQuery({
    queryKey: ["arena", "runs", limit],
    queryFn: () =>
      api.get<{ runs: ArenaRun[]; count: number; costToday: number }>(
        "/api/arena/runs",
        {
          params: limit ? { limit } : undefined,
        }
      ),
    select: (data) => data.runs,
  });
}

export function useArenaRun(id: string) {
  return useQuery({
    queryKey: ["arena", "run", id],
    queryFn: () =>
      api.get<{
        run: ArenaRun;
        decisions: any[];
        outcomeLinks: any[];
        costBreakdown: any;
      }>(`/api/arena/runs/${id}`),
    enabled: !!id,
  });
}

export function useRunArena() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      symbols: string[];
      mode?: string;
      agentProfileIds?: string[];
      triggeredBy?: string;
    }) =>
      api.post<{
        success: boolean;
        run: ArenaRun;
        consensus: any;
        decisionsCount: number;
      }>("/api/arena/run", params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arena"] });
    },
  });
}

export function useAgentProfiles() {
  return useQuery({
    queryKey: ["arena", "profiles"],
    queryFn: () =>
      api.get<{ profiles: AgentProfile[]; count: number }>(
        "/api/arena/profiles"
      ),
    select: (data) => data.profiles,
  });
}

export function useCreateAgentProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: Partial<AgentProfile>) =>
      api.post<AgentProfile>("/api/arena/profiles", profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arena", "profiles"] });
    },
  });
}

export function useUpdateAgentProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string } & Partial<AgentProfile>) =>
      api.patch<AgentProfile>(`/api/arena/profiles/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arena", "profiles"] });
    },
  });
}

export function useArenaLeaderboard(window?: string) {
  return useQuery({
    queryKey: ["arena", "leaderboard", window],
    queryFn: () =>
      api.get<{ window: string; leaderboard: any[]; generatedAt: string }>(
        "/api/arena/leaderboard",
        {
          params: window ? { window } : undefined,
        }
      ),
  });
}

// ============================================================================
// ADMIN USERS
// ============================================================================

export interface AdminUser {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () =>
      api.get<{ users: AdminUser[]; count: number }>("/api/admin/users"),
    select: (data) => data.users,
    enabled,
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: {
      username: string;
      password: string;
      isAdmin?: boolean;
    }) => api.post<AdminUser>("/api/admin/users", user),

    onMutate: async (newUser) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["admin", "users"] });

      // Snapshot previous state
      const previousUsers = queryClient.getQueryData<AdminUser[]>(["admin", "users"]);

      // Optimistically add new user
      queryClient.setQueryData<AdminUser[]>(["admin", "users"], (old) => [
        ...(old ?? []),
        {
          id: `temp-${Date.now()}`,
          username: newUser.username,
          isAdmin: newUser.isAdmin ?? false,
          createdAt: new Date().toISOString(),
        },
      ]);

      return { previousUsers };
    },

    onError: (err, newUser, context) => {
      // Rollback on error
      if (context?.previousUsers) {
        queryClient.setQueryData(["admin", "users"], context.previousUsers);
      }
      toast.error("Failed to create admin user");
      console.error("Failed to create admin user:", err);
    },

    onSuccess: () => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Admin user created successfully");
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...updates
    }: {
      id: string;
      username?: string;
      password?: string;
      isAdmin?: boolean;
    }) => api.patch<AdminUser>(`/api/admin/users/${id}`, updates),

    onMutate: async ({ id, ...updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["admin", "users"] });

      // Snapshot previous state
      const previousUsers = queryClient.getQueryData<AdminUser[]>(["admin", "users"]);

      // Optimistically update user (exclude password from optimistic update)
      const { password, ...displayUpdates } = updates;
      queryClient.setQueryData<AdminUser[]>(["admin", "users"], (old) =>
        old?.map((u) => (u.id === id ? { ...u, ...displayUpdates } : u)) ?? []
      );

      return { previousUsers };
    },

    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousUsers) {
        queryClient.setQueryData(["admin", "users"], context.previousUsers);
      }
      toast.error("Failed to update admin user");
      console.error("Failed to update admin user:", err);
    },

    onSuccess: () => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Admin user updated successfully");
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/users/${id}`),

    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["admin", "users"] });

      // Snapshot previous state
      const previousUsers = queryClient.getQueryData<AdminUser[]>(["admin", "users"]);

      // Optimistically remove user
      queryClient.setQueryData<AdminUser[]>(["admin", "users"], (old) =>
        old?.filter((u) => u.id !== id) ?? []
      );

      return { previousUsers };
    },

    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousUsers) {
        queryClient.setQueryData(["admin", "users"], context.previousUsers);
      }
      toast.error("Failed to delete admin user");
      console.error("Failed to delete admin user:", err);
    },

    onSuccess: () => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Admin user deleted successfully");
    },
  });
}

// ============================================================================
// ADMIN OBSERVABILITY
// ============================================================================

export interface SystemMetrics {
  system: {
    memoryUsedMB: number;
    memoryTotalMB: number;
    uptimeHours: number;
    nodeVersion: string;
  };
  workQueue: {
    pending: number;
    running: number;
    failed: number;
    completed: number;
  };
  activity: {
    logsLast24h: number;
    totalRecentLogs: number;
  };
  timestamp: string;
}

// Health status from the existing observability router
export interface ObservabilityHealth {
  queue: {
    pending: number;
    running: number;
    succeeded: number;
    failed: number;
    deadLetter: number;
    oldestPendingAgeMinutes: number;
  };
  orchestrator: {
    isRunning: boolean;
    lastHeartbeat: string | null;
    minutesSinceHeartbeat: number | null;
    killSwitchActive: boolean;
    dynamicOrderLimit: number;
    marketCondition: string;
  };
  llm: {
    lastHour: { calls: number; errors: number; errorRate: string };
    last24Hours: { calls: number; errors: number; errorRate: string };
  };
  fetchedAt: string;
}

// Transformed health data for simpler display
export interface ServiceHealth {
  name: string;
  status: "healthy" | "unhealthy" | "degraded";
  message: string;
}

export interface HealthStatus {
  services: ServiceHealth[];
  overall: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: any;
  timestamp: string;
}

export function useSystemMetrics(enabled = true) {
  return useQuery({
    queryKey: ["admin", "observability", "metrics"],
    queryFn: () => api.get<SystemMetrics>("/api/admin/observability/metrics"),
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled,
  });
}

// Fetches raw observability health data
export function useObservabilityHealth() {
  return useQuery({
    queryKey: ["admin", "observability", "health", "raw"],
    queryFn: () =>
      api.get<ObservabilityHealth>("/api/admin/observability/health"),
    refetchInterval: 30000,
  });
}

// Transforms observability health data into service status format
export function useSystemHealth(enabled = true) {
  return useQuery({
    queryKey: ["admin", "observability", "health"],
    enabled,
    queryFn: async () => {
      const health = await api.get<ObservabilityHealth>(
        "/api/admin/observability/health"
      );

      // Transform to service health format
      const services: ServiceHealth[] = [
        {
          name: "Database",
          status: "healthy" as const,
          message: "Connected",
        },
        {
          name: "Work Queue",
          status: health.queue.failed > 10 ? "degraded" : "healthy",
          message: `${health.queue.running} running, ${health.queue.pending} pending`,
        },
        {
          name: "Orchestrator",
          status: health.orchestrator.isRunning ? "healthy" : "unhealthy",
          message: health.orchestrator.isRunning
            ? health.orchestrator.killSwitchActive
              ? "Running (Kill Switch ON)"
              : "Running"
            : "Stopped",
        },
        {
          name: "LLM Providers",
          status:
            parseFloat(health.llm.lastHour.errorRate) > 20
              ? "degraded"
              : "healthy",
          message: `${health.llm.lastHour.calls} calls, ${health.llm.lastHour.errorRate} errors`,
        },
        {
          name: "Alpaca Trading",
          status: "healthy" as const,
          message: health.orchestrator.marketCondition || "Active",
        },
      ];

      const hasUnhealthy = services.some((s) => s.status === "unhealthy");
      const hasDegraded = services.some((s) => s.status === "degraded");

      return {
        services,
        overall: hasUnhealthy
          ? "unhealthy"
          : hasDegraded
            ? "degraded"
            : "healthy",
        timestamp: health.fetchedAt,
      } as HealthStatus;
    },
    refetchInterval: 60000,
  });
}

export function useSystemLogs(limit?: number, offset?: number, enabled = true) {
  return useQuery({
    queryKey: ["admin", "observability", "logs", limit, offset],
    queryFn: () =>
      api.get<{ logs: AuditLog[]; count: number; offset: number }>(
        "/api/admin/observability/logs",
        {
          params: { limit: limit || 50, offset: offset || 0 },
        }
      ),
    select: (data) => data.logs,
    enabled,
  });
}

// ============================================================================
// ADMIN DASHBOARD
// ============================================================================

export interface DashboardStats {
  providers: { total: number; active: number };
  models: { total: number; enabled: number };
  jobs: { running: number; pending: number; failed: number };
  killSwitch: boolean;
}

export function useAdminDashboard(enabled = true) {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.get<DashboardStats>("/api/admin/dashboard"),
    refetchInterval: 30000,
    enabled,
  });
}
