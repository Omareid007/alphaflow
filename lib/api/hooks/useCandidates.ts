import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export interface Candidate {
  id: string;
  symbol: string;
  score: number;
  qualityScore: number;
  growthScore: number;
  liquidityScore: number;
  rationale: string;
  status: "NEW" | "WATCHLIST" | "APPROVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
}

export function useCandidates(status?: string) {
  return useQuery({
    queryKey: ["candidates", status],
    queryFn: () =>
      api.get<Candidate[]>("/api/candidates", {
        params: status ? { status } : undefined,
      }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useApproveCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) =>
      api.post(`/api/candidates/${symbol}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}

export function useRejectCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) =>
      api.post(`/api/candidates/${symbol}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}

export function useTriggerCandidateRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/candidates/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}
