import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  qty: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPct: number;
  costBasis: number;
  assetClass: 'us_equity' | 'crypto';
}

export interface PortfolioSnapshot {
  totalEquity: number;
  buyingPower: number;
  cash: number;
  portfolioValue: number;
  dailyPl: number;
  dailyPlPct: number;
  totalPl: number;
  totalPlPct: number;
  positions: Position[];
  timestamp: string;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  totalValue: number;
  fee?: number;
  strategyId?: string;
  strategyName?: string;
  executedAt: string;
}

export function usePortfolioSnapshot() {
  return useQuery({
    queryKey: ['portfolio', 'snapshot'],
    queryFn: () => api.get<PortfolioSnapshot>('/api/positions/snapshot'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const response = await api.get<{ positions: Position[] } | Position[]>('/api/positions');
      // Handle both wrapped and unwrapped response formats
      if (Array.isArray(response)) {
        return response;
      }
      return response.positions || [];
    },
    refetchInterval: 30000,
  });
}

export function useTrades(options?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['trades', options],
    queryFn: () =>
      api.get<Trade[]>('/api/trades', {
        params: options,
      }),
  });
}

export function useTradesBySymbol(symbol: string) {
  return useQuery({
    queryKey: ['trades', 'symbol', symbol],
    queryFn: () => api.get<Trade[]>(`/api/trades/symbol/${symbol}`),
    enabled: !!symbol,
  });
}

export function useAccountInfo() {
  return useQuery({
    queryKey: ['account'],
    queryFn: () =>
      api.get<{
        id: string;
        status: string;
        currency: string;
        buyingPower: number;
        cash: number;
        portfolioValue: number;
        tradingBlocked: boolean;
        accountBlocked: boolean;
      }>('/api/alpaca/account'),
    refetchInterval: 60000,
  });
}
