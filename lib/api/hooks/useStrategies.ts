import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { toast } from "sonner";

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  type: string;
  templateId: string;
  status:
    | "draft"
    | "backtesting"
    | "backtested"
    | "paper"
    | "live"
    | "paused"
    | "stopped";
  mode?: "paper" | "live";
  config: Record<string, unknown>;
  performanceSummary?: {
    totalReturn?: number;
    winRate?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
    totalTrades?: number;
  };
  lastBacktestId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyOrder {
  id: string;
  strategyId: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  type: "market" | "limit" | "stop" | "stop_limit";
  status: "pending" | "filled" | "partial" | "cancelled" | "rejected";
  filledQty?: number;
  avgPrice?: number;
  limitPrice?: number;
  stopPrice?: number;
  createdAt: string;
  filledAt?: string;
}

export interface StrategyExecutionParams {
  positionSizing: {
    method: "percent" | "fixed" | "risk";
    percentOfPortfolio?: number;
    fixedAmount?: number;
    riskPerTradePercent?: number;
    maxPositionPercent: number;
  };
  entryRules: {
    minConfidence: number;
    maxPositions: number;
  };
  bracketOrders: {
    enabled: boolean;
    takeProfitPercent?: number;
    stopLossPercent?: number;
  };
  orderExecution: {
    orderType: "market" | "limit";
    timeInForce: "day" | "gtc" | "ioc";
  };
}

export interface StrategyExecutionContext {
  strategyId: string;
  isRunning: boolean;
  lastSignalAt?: string;
  lastOrderAt?: string;
  currentPositions: number;
  totalOrdersToday: number;
  totalPnL: number;
  riskLevel: "low" | "medium" | "high";
  params: StrategyExecutionParams;
}

export function useStrategies() {
  return useQuery({
    queryKey: ["strategies"],
    queryFn: () => api.get<Strategy[]>("/api/strategies"),
  });
}

export function useStrategy(id: string) {
  return useQuery({
    queryKey: ["strategies", id],
    queryFn: () => api.get<Strategy>(`/api/strategies/${id}`),
    enabled: !!id,
  });
}

export function useCreateStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Strategy>) =>
      api.post<Strategy>("/api/strategies", data),

    onMutate: async (newStrategy) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["strategies"] });

      // Snapshot previous state
      const previousStrategies = queryClient.getQueryData<Strategy[]>([
        "strategies",
      ]);

      // Optimistically add new strategy with temporary ID
      queryClient.setQueryData<Strategy[]>(["strategies"], (old) => [
        ...(old ?? []),
        {
          ...newStrategy,
          id: `temp-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: "draft" as const,
        } as Strategy,
      ]);

      return { previousStrategies };
    },

    onError: (err, newStrategy, context) => {
      // Rollback on error
      if (context?.previousStrategies) {
        queryClient.setQueryData(["strategies"], context.previousStrategies);
      }
      toast.error("Failed to create strategy");
      console.error("Failed to create strategy:", err);
    },

    onSuccess: () => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      toast.success("Strategy created successfully");
    },
  });
}

export function useUpdateStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Strategy> & { id: string }) =>
      api.put<Strategy>(`/api/strategies/${id}`, data),

    onMutate: async ({ id, ...updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["strategies"] });
      await queryClient.cancelQueries({ queryKey: ["strategies", id] });

      // Snapshot previous state
      const previousStrategies = queryClient.getQueryData<Strategy[]>([
        "strategies",
      ]);
      const previousStrategy = queryClient.getQueryData<Strategy>([
        "strategies",
        id,
      ]);

      // Optimistically update strategy in list
      queryClient.setQueryData<Strategy[]>(
        ["strategies"],
        (old) =>
          old?.map((s) =>
            s.id === id
              ? { ...s, ...updates, updatedAt: new Date().toISOString() }
              : s
          ) ?? []
      );

      // Optimistically update single strategy
      queryClient.setQueryData<Strategy>(["strategies", id], (old) =>
        old ? { ...old, ...updates, updatedAt: new Date().toISOString() } : old
      );

      return { previousStrategies, previousStrategy };
    },

    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousStrategies) {
        queryClient.setQueryData(["strategies"], context.previousStrategies);
      }
      if (context?.previousStrategy) {
        queryClient.setQueryData(["strategies", id], context.previousStrategy);
      }
      toast.error("Failed to update strategy");
      console.error("Failed to update strategy:", err);
    },

    onSuccess: (_, { id }) => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["strategies", id] });
      toast.success("Strategy updated successfully");
    },
  });
}

export function useDeleteStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/strategies/${id}`),

    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["strategies"] });
      await queryClient.cancelQueries({ queryKey: ["strategies", id] });

      // Snapshot previous state
      const previousStrategies = queryClient.getQueryData<Strategy[]>([
        "strategies",
      ]);
      const previousStrategy = queryClient.getQueryData<Strategy>([
        "strategies",
        id,
      ]);

      // Optimistically remove strategy from list
      queryClient.setQueryData<Strategy[]>(
        ["strategies"],
        (old) => old?.filter((s) => s.id !== id) ?? []
      );

      // Remove single strategy cache
      queryClient.removeQueries({ queryKey: ["strategies", id] });

      return { previousStrategies, previousStrategy };
    },

    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousStrategies) {
        queryClient.setQueryData(["strategies"], context.previousStrategies);
      }
      if (context?.previousStrategy) {
        queryClient.setQueryData(["strategies", id], context.previousStrategy);
      }
      toast.error("Failed to delete strategy");
      console.error("Failed to delete strategy:", err);
    },

    onSuccess: () => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      toast.success("Strategy deleted successfully");
    },
  });
}

export function useDeployStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: "paper" | "live" }) =>
      api.post<Strategy>(`/api/strategies/${id}/deploy`, { mode }),

    onMutate: async ({ id, mode }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["strategies"] });
      await queryClient.cancelQueries({ queryKey: ["strategies", id] });

      // Snapshot previous state
      const previousStrategies = queryClient.getQueryData<Strategy[]>([
        "strategies",
      ]);
      const previousStrategy = queryClient.getQueryData<Strategy>([
        "strategies",
        id,
      ]);

      // Optimistically update strategy status
      queryClient.setQueryData<Strategy[]>(
        ["strategies"],
        (old) =>
          old?.map((s) => (s.id === id ? { ...s, status: mode, mode } : s)) ??
          []
      );

      queryClient.setQueryData<Strategy>(["strategies", id], (old) =>
        old ? { ...old, status: mode, mode } : old
      );

      return { previousStrategies, previousStrategy };
    },

    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousStrategies) {
        queryClient.setQueryData(["strategies"], context.previousStrategies);
      }
      if (context?.previousStrategy) {
        queryClient.setQueryData(["strategies", id], context.previousStrategy);
      }
      toast.error("Failed to deploy strategy");
      console.error("Failed to deploy strategy:", err);
    },

    onSuccess: (_, { id }) => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["strategies", id] });
      toast.success("Strategy deployed successfully");
    },
  });
}

export function usePauseStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<Strategy>(`/api/strategies/${id}/pause`),

    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["strategies"] });
      await queryClient.cancelQueries({ queryKey: ["strategies", id] });

      // Snapshot previous state
      const previousStrategies = queryClient.getQueryData<Strategy[]>([
        "strategies",
      ]);
      const previousStrategy = queryClient.getQueryData<Strategy>([
        "strategies",
        id,
      ]);

      // Optimistically update strategy status
      queryClient.setQueryData<Strategy[]>(
        ["strategies"],
        (old) =>
          old?.map((s) =>
            s.id === id ? { ...s, status: "paused" as const } : s
          ) ?? []
      );

      queryClient.setQueryData<Strategy>(["strategies", id], (old) =>
        old ? { ...old, status: "paused" as const } : old
      );

      return { previousStrategies, previousStrategy };
    },

    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousStrategies) {
        queryClient.setQueryData(["strategies"], context.previousStrategies);
      }
      if (context?.previousStrategy) {
        queryClient.setQueryData(["strategies", id], context.previousStrategy);
      }
      toast.error("Failed to pause strategy");
      console.error("Failed to pause strategy:", err);
    },

    onSuccess: (_, id) => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["strategies", id] });
      toast.success("Strategy paused successfully");
    },
  });
}

export function useResumeStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<Strategy>(`/api/strategies/${id}/resume`),

    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["strategies"] });
      await queryClient.cancelQueries({ queryKey: ["strategies", id] });

      // Snapshot previous state
      const previousStrategies = queryClient.getQueryData<Strategy[]>([
        "strategies",
      ]);
      const previousStrategy = queryClient.getQueryData<Strategy>([
        "strategies",
        id,
      ]);

      // Optimistically update strategy status (resume typically goes back to previous mode)
      queryClient.setQueryData<Strategy[]>(
        ["strategies"],
        (old) =>
          old?.map((s) =>
            s.id === id ? { ...s, status: s.mode || "paper" } : s
          ) ?? []
      );

      queryClient.setQueryData<Strategy>(["strategies", id], (old) =>
        old ? { ...old, status: old.mode || "paper" } : old
      );

      return { previousStrategies, previousStrategy };
    },

    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousStrategies) {
        queryClient.setQueryData(["strategies"], context.previousStrategies);
      }
      if (context?.previousStrategy) {
        queryClient.setQueryData(["strategies", id], context.previousStrategy);
      }
      toast.error("Failed to resume strategy");
      console.error("Failed to resume strategy:", err);
    },

    onSuccess: (_, id) => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["strategies", id] });
      toast.success("Strategy resumed successfully");
    },
  });
}

export function useStopStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<Strategy>(`/api/strategies/${id}/stop`),

    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["strategies"] });
      await queryClient.cancelQueries({ queryKey: ["strategies", id] });

      // Snapshot previous state
      const previousStrategies = queryClient.getQueryData<Strategy[]>([
        "strategies",
      ]);
      const previousStrategy = queryClient.getQueryData<Strategy>([
        "strategies",
        id,
      ]);

      // Optimistically update strategy status
      queryClient.setQueryData<Strategy[]>(
        ["strategies"],
        (old) =>
          old?.map((s) =>
            s.id === id ? { ...s, status: "stopped" as const } : s
          ) ?? []
      );

      queryClient.setQueryData<Strategy>(["strategies", id], (old) =>
        old ? { ...old, status: "stopped" as const } : old
      );

      return { previousStrategies, previousStrategy };
    },

    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousStrategies) {
        queryClient.setQueryData(["strategies"], context.previousStrategies);
      }
      if (context?.previousStrategy) {
        queryClient.setQueryData(["strategies", id], context.previousStrategy);
      }
      toast.error("Failed to stop strategy");
      console.error("Failed to stop strategy:", err);
    },

    onSuccess: (_, id) => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["strategies", id] });
      toast.success("Strategy stopped successfully");
    },
  });
}

export function useStrategyOrders(strategyId: string) {
  return useQuery({
    queryKey: ["strategyOrders", strategyId],
    queryFn: () =>
      api.get<StrategyOrder[]>(`/api/strategies/${strategyId}/orders`),
    enabled: !!strategyId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useExecutionContext(strategyId: string) {
  return useQuery({
    queryKey: ["executionContext", strategyId],
    queryFn: () =>
      api.get<StrategyExecutionContext>(
        `/api/strategies/${strategyId}/execution-context`
      ),
    enabled: !!strategyId,
    refetchInterval: 10000, // Refresh every 10 seconds for real-time status
  });
}
