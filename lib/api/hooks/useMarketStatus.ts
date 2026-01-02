import { useQuery } from "@tanstack/react-query";
import { api } from "../client";

/**
 * Market status response from Alpaca API
 */
export interface MarketStatus {
  isOpen: boolean;
  isPreMarket: boolean;
  isAfterHours: boolean;
  isExtendedHours: boolean;
  currentTime: string;
  nextOpen: string;
  nextClose: string;
  session: "pre-market" | "regular" | "after-hours" | "closed";
}

/**
 * Hook to fetch current market status from Alpaca
 *
 * Polls the market status endpoint every 60 seconds to keep
 * the status up-to-date.
 *
 * @param enabled - Whether to enable the query (default: true)
 * @returns Query result with market status data
 *
 * @example
 * ```tsx
 * const { data: status, isLoading } = useMarketStatus();
 * if (status?.isOpen) {
 *   console.log("Market is open!");
 * }
 * ```
 */
export function useMarketStatus(enabled = true) {
  return useQuery({
    queryKey: ["market", "status"],
    queryFn: () => api.get<MarketStatus>("/api/alpaca/market-status"),
    enabled,
    refetchInterval: 60000, // Refresh every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: 2,
    refetchOnWindowFocus: true,
  });
}

/**
 * Helper to format time until next market event
 *
 * @param isoTime - ISO 8601 timestamp
 * @returns Human-readable time string (e.g., "2h 30m", "45m", "in 5 days")
 */
export function formatTimeUntil(isoTime: string): string {
  const now = new Date();
  const target = new Date(isoTime);
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return "now";

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return diffDays === 1 ? "tomorrow" : `in ${diffDays} days`;
  }

  if (diffHours > 0) {
    const remainingMinutes = diffMinutes % 60;
    if (remainingMinutes > 0) {
      return `${diffHours}h ${remainingMinutes}m`;
    }
    return `${diffHours}h`;
  }

  return `${diffMinutes}m`;
}
