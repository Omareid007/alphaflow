import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { toast } from "sonner";

export interface BacktestConfig {
  strategyId: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  symbols?: string[];
}

export interface BacktestRun {
  id: string;
  strategyId: string;
  status: "pending" | "running" | "completed" | "failed";
  config: BacktestConfig;
  results?: BacktestResults;
  interpretation?: string;
  createdAt: string;
  completedAt?: string;
}

export interface BacktestResults {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  equityCurve: Array<{ date: string; equity: number }>;
  trades: Array<{
    symbol: string;
    side: "buy" | "sell";
    qty: number;
    price: number;
    pnl: number;
    timestamp: string;
  }>;
}

// Helper to normalize backend status (UPPERCASE) to frontend status (lowercase)
// Backend uses: QUEUED, RUNNING, DONE, FAILED
// Frontend expects: pending, running, completed, failed
function normalizeBacktestStatus(
  status: string | undefined
): BacktestRun["status"] {
  if (!status) return "pending";
  const lower = status.toLowerCase();
  if (lower === "done") return "completed";
  if (lower === "queued") return "pending";
  return lower as BacktestRun["status"];
}

export function useBacktests(strategyId?: string) {
  return useQuery({
    queryKey: ["backtests", strategyId],
    initialData: [] as BacktestRun[],
    queryFn: async () => {
      const response = await api.get<
        { runs: BacktestRun[]; limit: number; offset: number } | BacktestRun[]
      >("/api/backtests", { params: strategyId ? { strategyId } : undefined });

      let runs: BacktestRun[] = [];

      // Handle array response (direct format)
      if (Array.isArray(response)) {
        runs = response;
      }
      // Handle wrapped response with 'runs' property
      else if ("runs" in response && Array.isArray(response.runs)) {
        runs = response.runs;
      } else {
        // Unexpected format - log warning and return empty array
        console.warn("[useBacktests] Unexpected response format:", response);
        return [];
      }

      // Normalize status for all runs (backend uses UPPERCASE, frontend expects lowercase)
      return runs.map((run) => ({
        ...run,
        status: normalizeBacktestStatus(run.status),
      }));
    },
  });
}

export function useBacktest(id: string) {
  return useQuery({
    queryKey: ["backtests", "detail", id],
    queryFn: async () => {
      const data = await api.get<BacktestRun>(`/api/backtests/${id}`);
      // Normalize status from backend (RUNNING/DONE/QUEUED/FAILED) to frontend (running/completed/pending/failed)
      if (data?.status) {
        data.status = normalizeBacktestStatus(data.status);
      }
      return data;
    },
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 2000 : false,
  });
}

export function useRunBacktest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: BacktestConfig) =>
      api.post<BacktestRun>("/api/backtests/run", config),

    onMutate: async (config) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["backtests"] });
      await queryClient.cancelQueries({
        queryKey: ["backtests", config.strategyId],
      });

      // Snapshot previous state
      const previousBacktests = queryClient.getQueryData<BacktestRun[]>([
        "backtests",
      ]);
      const previousStrategyBacktests = queryClient.getQueryData<BacktestRun[]>(
        ["backtests", config.strategyId]
      );

      // Optimistically add new backtest with pending status
      const optimisticBacktest: BacktestRun = {
        id: `temp-${Date.now()}`,
        strategyId: config.strategyId,
        status: "pending" as const,
        config,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<BacktestRun[]>(["backtests"], (old) => [
        optimisticBacktest,
        ...(old ?? []),
      ]);

      queryClient.setQueryData<BacktestRun[]>(
        ["backtests", config.strategyId],
        (old) => [optimisticBacktest, ...(old ?? [])]
      );

      return { previousBacktests, previousStrategyBacktests };
    },

    onError: (err, config, context) => {
      // Rollback on error
      if (context?.previousBacktests) {
        queryClient.setQueryData(["backtests"], context.previousBacktests);
      }
      if (context?.previousStrategyBacktests) {
        queryClient.setQueryData(
          ["backtests", config.strategyId],
          context.previousStrategyBacktests
        );
      }
      toast.error("Failed to start backtest");
      console.error("Failed to start backtest:", err);
    },

    onSuccess: (_, config) => {
      // Only invalidate backtests list (not strategies, orders, etc.)
      queryClient.invalidateQueries({ queryKey: ["backtests"], exact: false });
      // Also invalidate strategy-specific backtests
      queryClient.invalidateQueries({
        queryKey: ["backtests", config.strategyId],
        exact: true,
      });
      toast.success("Backtest started successfully");
    },
  });
}

export function useBacktestEquityCurve(backtestId: string) {
  return useQuery({
    queryKey: ["backtests", "equity-curve", backtestId],
    initialData: [] as Array<{ date: string; equity: number }>,
    queryFn: async () => {
      const response = await api.get<
        | { points: Array<{ ts: string; equity: number }> }
        | Array<{ date: string; equity: number }>
      >(`/api/backtests/${backtestId}/equity-curve`);

      // Handle wrapped response with 'points' property
      if ("points" in response && Array.isArray(response.points)) {
        return response.points.map((p) => ({
          date: p.ts,
          equity: p.equity,
        }));
      }

      // Handle direct array response
      if (Array.isArray(response)) {
        return response;
      }

      console.warn(
        "[useBacktestEquityCurve] Unexpected response format:",
        response
      );
      return [];
    },
    enabled: !!backtestId,
  });
}

export function useBacktestTrades(backtestId: string) {
  return useQuery({
    queryKey: ["backtests", "trades", backtestId],
    initialData: [] as Array<{
      symbol: string;
      side: "buy" | "sell";
      qty: number;
      price: number;
      pnl: number;
      timestamp: string;
    }>,
    queryFn: async () => {
      const response = await api.get<
        | { trades: Array<any> }
        | Array<{
            symbol: string;
            side: "buy" | "sell";
            qty: number;
            price: number;
            pnl: number;
            timestamp: string;
          }>
      >(`/api/backtests/${backtestId}/trades`);

      // Handle wrapped response with 'trades' property
      if ("trades" in response && Array.isArray(response.trades)) {
        return response.trades.map((t: any) => ({
          symbol: t.symbol,
          side: t.side,
          qty: parseFloat(t.qty) || 0,
          price: parseFloat(t.price) || 0,
          pnl: 0, // Calculate if needed from position data
          timestamp: t.ts || t.timestamp,
        }));
      }

      // Handle direct array response
      if (Array.isArray(response)) {
        return response;
      }

      console.warn("[useBacktestTrades] Unexpected response format:", response);
      return [];
    },
    enabled: !!backtestId,
  });
}
