import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { FeedSource } from "@/lib/types";

/**
 * Hook to fetch data source/feed statuses
 */
export function useFeedSources() {
  return useQuery({
    queryKey: ["feeds"],
    queryFn: () => api.get<FeedSource[]>("/api/feeds"),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}
