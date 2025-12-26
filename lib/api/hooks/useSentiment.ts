import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { SentimentSignal } from '@/lib/types';

/**
 * Hook to fetch sentiment signals for symbols
 */
export function useSentiment(symbols?: string[]) {
  return useQuery({
    queryKey: ['sentiment', symbols],
    queryFn: () => {
      const params = symbols ? { symbols: symbols.join(',') } : undefined;
      return api.get<SentimentSignal[]>('/api/ai/sentiment', { params });
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // Refetch every 2 minutes
  });
}
