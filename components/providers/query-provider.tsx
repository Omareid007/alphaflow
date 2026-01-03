"use client";

import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Enhanced Query Provider with optimized caching, smart refetching, and performance tuning
 *
 * Performance Strategy:
 * - Real-time data (portfolio, quotes): 5s stale time, frequent refetch
 * - Semi-static data (strategies, backtests): 60s stale time, selective refetch
 * - Static data (settings, preferences): 5min stale time, minimal refetch
 * - Query deduplication prevents duplicate parallel requests
 * - Exponential backoff retry with auth error detection
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          // Default stale time: 1 minute (overridden per query type below)
          // Data is considered "fresh" for this duration and won't refetch
          staleTime: 60 * 1000, // 1 minute

          // Cache time (gcTime): How long unused queries stay in memory
          // Increased from 5 to 10 minutes for better performance
          gcTime: 10 * 60 * 1000, // 10 minutes

          // Selective refetch on window focus (disabled by default, enabled per query type)
          // This prevents unnecessary refetches when user switches tabs
          refetchOnWindowFocus: false,

          // Smart retry logic with exponential backoff
          retry: (failureCount, error) => {
            // Don't retry on auth errors (401, 403)
            if (error instanceof Error) {
              const errorMessage = error.message.toLowerCase();
              if (
                errorMessage.includes("401") ||
                errorMessage.includes("403") ||
                errorMessage.includes("unauthorized") ||
                errorMessage.includes("forbidden")
              ) {
                return false;
              }
            }

            // Retry up to 2 times for network errors
            return failureCount < 2;
          },

          // Exponential backoff: 1s, 2s, 4s (capped at 30s)
          retryDelay: (attemptIndex) =>
            Math.min(1000 * 2 ** attemptIndex, 30000),

          // Refetch on mount only if data is stale
          refetchOnMount: (query) => query.state.dataUpdatedAt === 0,

          // Always refetch on reconnect for data consistency
          refetchOnReconnect: true,

          // Network mode
          networkMode: "online",

          // Enable structural sharing (deduplication)
          // Prevents duplicate requests when multiple components use same query
          structuralSharing: true,
        },

        mutations: {
          // Smart mutation retry logic
          retry: (failureCount, error) => {
            // Never retry client errors (4xx)
            if (error instanceof Error) {
              const errorMessage = error.message.toLowerCase();
              if (
                errorMessage.includes("400") ||
                errorMessage.includes("401") ||
                errorMessage.includes("403") ||
                errorMessage.includes("404") ||
                errorMessage.includes("422")
              ) {
                return false;
              }
            }

            // Retry once for server errors (5xx)
            return failureCount < 1;
          },

          networkMode: "online",
        },
      },

      // Query Cache - Global error handling for all queries
      queryCache: new QueryCache({
        onError: (error, query) => {
          // Log error (will be replaced with proper error tracking)
          console.error("[QueryCache] Query error:", {
            queryKey: query.queryKey,
            error: error instanceof Error ? error.message : String(error),
          });

          // Don't show toast for background refetches
          if (query.state.data !== undefined) {
            return;
          }

          // Show user-friendly error toast
          const errorMessage =
            error instanceof Error ? error.message : "An error occurred";

          if (
            errorMessage.includes("401") ||
            errorMessage.includes("unauthorized")
          ) {
            toast.error("Session expired. Please log in again.");
          } else if (
            errorMessage.includes("403") ||
            errorMessage.includes("forbidden")
          ) {
            toast.error("You don't have permission to access this resource.");
          } else if (errorMessage.includes("404")) {
            toast.error("Resource not found.");
          } else if (errorMessage.includes("Network")) {
            toast.error("Network error. Please check your connection.");
          } else {
            toast.error("Failed to load data. Please try again.");
          }
        },

        onSuccess: (data, query) => {
          // Optional: Log successful queries in development
          if (process.env.NODE_ENV === "development") {
            console.log("[QueryCache] Query success:", {
              queryKey: query.queryKey,
              dataSize: JSON.stringify(data).length,
            });
          }
        },
      }),

      // Mutation Cache - Global error handling for all mutations
      mutationCache: new MutationCache({
        onError: (error, variables, context, mutation) => {
          // Log error (will be replaced with proper error tracking)
          console.error("[MutationCache] Mutation error:", {
            error: error instanceof Error ? error.message : String(error),
            variables,
          });

          // Show user-friendly error toast (if not handled by individual mutation)
          const errorMessage =
            error instanceof Error ? error.message : "An error occurred";

          // Don't show toast if mutation has onError handler (individual mutations handle their own toasts)
          if (mutation.options.onError) {
            return;
          }

          if (
            errorMessage.includes("401") ||
            errorMessage.includes("unauthorized")
          ) {
            toast.error("Session expired. Please log in again.");
          } else if (
            errorMessage.includes("403") ||
            errorMessage.includes("forbidden")
          ) {
            toast.error("You don't have permission to perform this action.");
          } else if (
            errorMessage.includes("400") ||
            errorMessage.includes("validation")
          ) {
            toast.error("Invalid data. Please check your input.");
          } else if (errorMessage.includes("422")) {
            toast.error("Unable to process your request. Please try again.");
          } else if (errorMessage.includes("Network")) {
            toast.error("Network error. Please check your connection.");
          } else {
            toast.error("Action failed. Please try again.");
          }
        },

        onSuccess: (data, variables, context, mutation) => {
          // Optional: Log successful mutations in development
          if (process.env.NODE_ENV === "development") {
            console.log("[MutationCache] Mutation success:", {
              variables,
            });
          }
        },
      }),
    });

    // Per-Query Type Optimizations
    // Configure specific query types with optimal staleTime and refetch behavior

    // Real-time data: Portfolio, positions, market quotes
    // Rationale: Financial data changes frequently, users expect real-time updates
    // StaleTime: 5s (very fresh), RefetchOnFocus: true, RefetchInterval: 30s
    client.setQueryDefaults(["portfolio"], {
      staleTime: 5 * 1000, // 5 seconds
      refetchOnWindowFocus: true,
      refetchInterval: 30 * 1000, // Refetch every 30s when page is visible
    });

    client.setQueryDefaults(["positions"], {
      staleTime: 5 * 1000, // 5 seconds
      refetchOnWindowFocus: true,
      refetchInterval: 30 * 1000,
    });

    client.setQueryDefaults(["market"], {
      staleTime: 5 * 1000, // 5 seconds
      refetchOnWindowFocus: true,
      refetchInterval: 30 * 1000,
    });

    client.setQueryDefaults(["account"], {
      staleTime: 5 * 1000, // 5 seconds
      refetchOnWindowFocus: true,
      refetchInterval: 30 * 1000,
    });

    // Semi-static data: Strategies, backtests, orders, trades
    // Rationale: Changes less frequently, updated via mutations
    // StaleTime: 60s (1 minute), RefetchOnFocus: false, Manual invalidation on mutations
    client.setQueryDefaults(["strategies"], {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    });

    client.setQueryDefaults(["backtests"], {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    });

    client.setQueryDefaults(["orders"], {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
      refetchInterval: 30 * 1000, // Still refetch orders periodically for status updates
    });

    client.setQueryDefaults(["trades"], {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    });

    client.setQueryDefaults(["strategyOrders"], {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    });

    client.setQueryDefaults(["executionContext"], {
      staleTime: 10 * 1000, // 10 seconds (more real-time for execution status)
      refetchOnWindowFocus: true,
      refetchInterval: 10 * 1000,
    });

    // Static data: User settings, preferences, watchlists
    // Rationale: Rarely changes, only updated by explicit user actions
    // StaleTime: 5 minutes, RefetchOnFocus: false, Invalidate only on mutations
    client.setQueryDefaults(["settings"], {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    });

    client.setQueryDefaults(["user-preferences"], {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    });

    client.setQueryDefaults(["watchlists"], {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    });

    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* React Query DevTools - only in development */}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
