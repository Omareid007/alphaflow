import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  type: string;
  templateId: string;
  status: "draft" | "backtesting" | "paper" | "live" | "paused" | "stopped";
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
  });
}

export function useUpdateStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Strategy> & { id: string }) =>
      api.put<Strategy>(`/api/strategies/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["strategies", variables.id] });
    },
  });
}

export function useDeleteStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/strategies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
  });
}

export function useDeployStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: "paper" | "live" }) =>
      api.post<Strategy>(`/api/strategies/${id}/deploy`, { mode }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["strategies", variables.id] });
    },
  });
}

export function usePauseStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<Strategy>(`/api/strategies/${id}/pause`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["strategies", id] });
    },
  });
}

export function useResumeStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<Strategy>(`/api/strategies/${id}/resume`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["strategies", id] });
    },
  });
}

export function useStopStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<Strategy>(`/api/strategies/${id}/stop`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      queryClient.invalidateQueries({ queryKey: ["strategies", id] });
    },
  });
}
