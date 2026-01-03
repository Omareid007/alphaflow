import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { Watchlist } from "@/lib/types";
import { toast } from "sonner";

export function useWatchlists() {
  return useQuery({
    queryKey: ["watchlists"],
    queryFn: async () => {
      try {
        return await api.get<Watchlist[]>("/api/watchlists");
      } catch {
        // Return empty array if endpoint unavailable
        return [];
      }
    },
  });
}

export function useWatchlist(id: string) {
  return useQuery({
    queryKey: ["watchlists", id],
    queryFn: () => api.get<Watchlist>(`/api/watchlists/${id}`),
    enabled: !!id,
  });
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      watchlistId,
      symbol,
    }: {
      watchlistId: string;
      symbol: string;
    }) => {
      return await api.post(`/api/watchlists/${watchlistId}/symbols`, {
        symbol,
      });
    },

    onMutate: async ({ watchlistId, symbol }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["watchlists"] });
      await queryClient.cancelQueries({
        queryKey: ["watchlists", watchlistId],
      });

      // Snapshot previous state
      const previousWatchlists = queryClient.getQueryData<Watchlist[]>([
        "watchlists",
      ]);
      const previousWatchlist = queryClient.getQueryData<Watchlist>([
        "watchlists",
        watchlistId,
      ]);

      // Optimistically add symbol to watchlist (as WatchlistItem)
      queryClient.setQueryData<Watchlist[]>(
        ["watchlists"],
        (old) =>
          old?.map((w) =>
            w.id === watchlistId
              ? {
                  ...w,
                  items: [
                    ...(w.items ?? []),
                    {
                      symbol,
                      name: symbol,
                      price: 0,
                      change: 0,
                      changePercent: 0,
                      tags: [],
                      eligible: true,
                    },
                  ],
                }
              : w
          ) ?? []
      );

      queryClient.setQueryData<Watchlist>(["watchlists", watchlistId], (old) =>
        old
          ? {
              ...old,
              items: [
                ...(old.items ?? []),
                {
                  symbol,
                  name: symbol,
                  price: 0,
                  change: 0,
                  changePercent: 0,
                  tags: [],
                  eligible: true,
                },
              ],
            }
          : old
      );

      return { previousWatchlists, previousWatchlist };
    },

    onError: (err, { watchlistId }, context) => {
      // Rollback on error
      if (context?.previousWatchlists) {
        queryClient.setQueryData(["watchlists"], context.previousWatchlists);
      }
      if (context?.previousWatchlist) {
        queryClient.setQueryData(
          ["watchlists", watchlistId],
          context.previousWatchlist
        );
      }
      toast.error("Failed to add symbol to watchlist");
      console.error("Failed to add symbol to watchlist:", err);
    },

    onSuccess: (_, { watchlistId }) => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      queryClient.invalidateQueries({ queryKey: ["watchlists", watchlistId] });
      toast.success("Symbol added to watchlist");
    },
  });
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      watchlistId,
      symbol,
    }: {
      watchlistId: string;
      symbol: string;
    }) => {
      return await api.delete(
        `/api/watchlists/${watchlistId}/symbols/${symbol}`
      );
    },

    onMutate: async ({ watchlistId, symbol }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["watchlists"] });
      await queryClient.cancelQueries({
        queryKey: ["watchlists", watchlistId],
      });

      // Snapshot previous state
      const previousWatchlists = queryClient.getQueryData<Watchlist[]>([
        "watchlists",
      ]);
      const previousWatchlist = queryClient.getQueryData<Watchlist>([
        "watchlists",
        watchlistId,
      ]);

      // Optimistically remove symbol from watchlist
      queryClient.setQueryData<Watchlist[]>(
        ["watchlists"],
        (old) =>
          old?.map((w) =>
            w.id === watchlistId
              ? {
                  ...w,
                  items: (w.items ?? []).filter(
                    (item) => item.symbol !== symbol
                  ),
                }
              : w
          ) ?? []
      );

      queryClient.setQueryData<Watchlist>(["watchlists", watchlistId], (old) =>
        old
          ? {
              ...old,
              items: (old.items ?? []).filter((item) => item.symbol !== symbol),
            }
          : old
      );

      return { previousWatchlists, previousWatchlist };
    },

    onError: (err, { watchlistId }, context) => {
      // Rollback on error
      if (context?.previousWatchlists) {
        queryClient.setQueryData(["watchlists"], context.previousWatchlists);
      }
      if (context?.previousWatchlist) {
        queryClient.setQueryData(
          ["watchlists", watchlistId],
          context.previousWatchlist
        );
      }
      toast.error("Failed to remove symbol from watchlist");
      console.error("Failed to remove symbol from watchlist:", err);
    },

    onSuccess: (_, { watchlistId }) => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      queryClient.invalidateQueries({ queryKey: ["watchlists", watchlistId] });
      toast.success("Symbol removed from watchlist");
    },
  });
}

export function useCreateWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; symbols?: string[] }) =>
      api.post<Watchlist>("/api/watchlists", data),

    onMutate: async (newWatchlist) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["watchlists"] });

      // Snapshot previous state
      const previousWatchlists = queryClient.getQueryData<Watchlist[]>([
        "watchlists",
      ]);

      // Optimistically add new watchlist
      queryClient.setQueryData<Watchlist[]>(["watchlists"], (old) => [
        ...(old ?? []),
        {
          id: `temp-${Date.now()}`,
          name: newWatchlist.name,
          items: (newWatchlist.symbols ?? []).map((symbol) => ({
            symbol,
            name: symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            tags: [],
            eligible: true,
          })),
          createdAt: new Date().toISOString(),
        },
      ]);

      return { previousWatchlists };
    },

    onError: (err, newWatchlist, context) => {
      // Rollback on error
      if (context?.previousWatchlists) {
        queryClient.setQueryData(["watchlists"], context.previousWatchlists);
      }
      toast.error("Failed to create watchlist");
      console.error("Failed to create watchlist:", err);
    },

    onSuccess: () => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      toast.success("Watchlist created successfully");
    },
  });
}

export function useDeleteWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/watchlists/${id}`),

    onMutate: async (id) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["watchlists"] });
      await queryClient.cancelQueries({ queryKey: ["watchlists", id] });

      // Snapshot previous state
      const previousWatchlists = queryClient.getQueryData<Watchlist[]>([
        "watchlists",
      ]);
      const previousWatchlist = queryClient.getQueryData<Watchlist>([
        "watchlists",
        id,
      ]);

      // Optimistically remove watchlist
      queryClient.setQueryData<Watchlist[]>(
        ["watchlists"],
        (old) => old?.filter((w) => w.id !== id) ?? []
      );

      queryClient.removeQueries({ queryKey: ["watchlists", id] });

      return { previousWatchlists, previousWatchlist };
    },

    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousWatchlists) {
        queryClient.setQueryData(["watchlists"], context.previousWatchlists);
      }
      if (context?.previousWatchlist) {
        queryClient.setQueryData(["watchlists", id], context.previousWatchlist);
      }
      toast.error("Failed to delete watchlist");
      console.error("Failed to delete watchlist:", err);
    },

    onSuccess: () => {
      // Refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      toast.success("Watchlist deleted successfully");
    },
  });
}
