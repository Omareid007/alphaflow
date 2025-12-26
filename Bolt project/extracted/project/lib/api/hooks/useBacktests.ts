import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

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
  status: 'pending' | 'running' | 'completed' | 'failed';
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
    side: 'buy' | 'sell';
    qty: number;
    price: number;
    pnl: number;
    timestamp: string;
  }>;
}

export function useBacktests(strategyId?: string) {
  return useQuery({
    queryKey: ['backtests', strategyId],
    queryFn: () =>
      api.get<BacktestRun[]>('/api/backtests', {
        params: strategyId ? { strategyId } : undefined,
      }),
  });
}

export function useBacktest(id: string) {
  return useQuery({
    queryKey: ['backtests', 'detail', id],
    queryFn: () => api.get<BacktestRun>(`/api/backtests/${id}`),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 2000 : false,
  });
}

export function useRunBacktest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: BacktestConfig) =>
      api.post<BacktestRun>('/api/backtests/run', config),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backtests'] });
      queryClient.invalidateQueries({
        queryKey: ['backtests', variables.strategyId],
      });
    },
  });
}

export function useBacktestEquityCurve(backtestId: string) {
  return useQuery({
    queryKey: ['backtests', 'equity-curve', backtestId],
    queryFn: () =>
      api.get<Array<{ date: string; equity: number }>>(
        `/api/backtests/${backtestId}/equity-curve`
      ),
    enabled: !!backtestId,
  });
}

export function useBacktestTrades(backtestId: string) {
  return useQuery({
    queryKey: ['backtests', 'trades', backtestId],
    queryFn: () =>
      api.get<
        Array<{
          symbol: string;
          side: 'buy' | 'sell';
          qty: number;
          price: number;
          pnl: number;
          timestamp: string;
        }>
      >(`/api/backtests/${backtestId}/trades`),
    enabled: !!backtestId,
  });
}
