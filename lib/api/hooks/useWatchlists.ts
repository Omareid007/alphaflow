import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { Watchlist } from '@/lib/types';

export function useWatchlists() {
  return useQuery({
    queryKey: ['watchlists'],
    queryFn: async () => {
      try {
        return await api.get<Watchlist[]>('/api/watchlists');
      } catch {
        // Return empty array if endpoint unavailable
        return [];
      }
    },
  });
}

export function useWatchlist(id: string) {
  return useQuery({
    queryKey: ['watchlists', id],
    queryFn: () => api.get<Watchlist>(`/api/watchlists/${id}`),
    enabled: !!id,
  });
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ watchlistId, symbol }: { watchlistId: string; symbol: string }) => {
      return await api.post(`/api/watchlists/${watchlistId}/symbols`, { symbol });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      queryClient.invalidateQueries({ queryKey: ['watchlists', variables.watchlistId] });
    },
  });
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ watchlistId, symbol }: { watchlistId: string; symbol: string }) => {
      return await api.delete(`/api/watchlists/${watchlistId}/symbols/${symbol}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
      queryClient.invalidateQueries({ queryKey: ['watchlists', variables.watchlistId] });
    },
  });
}

export function useCreateWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; symbols?: string[] }) =>
      api.post<Watchlist>('/api/watchlists', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
    },
  });
}

export function useDeleteWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/watchlists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
    },
  });
}
