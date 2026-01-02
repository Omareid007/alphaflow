"use client";

import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Enhanced Query Provider with smart caching, error handling, and performance optimizations
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time varies by data type (configured per hook)
            staleTime: 2 * 60 * 1000, // 2 minutes default

            // Selective refetch on window focus (only for critical data)
            refetchOnWindowFocus: (query) => {
              // Refetch portfolio data when user returns to tab
              if (query.queryKey[0] === 'portfolio' || query.queryKey[0] === 'positions') {
                return true;
              }
              // Don't refetch static data
              return false;
            },

            // Smart retry logic
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

            // Exponential backoff
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000),

            // Refetch on mount only if data is stale
            refetchOnMount: (query) => query.state.dataUpdatedAt === 0,

            // Always refetch on reconnect for data consistency
            refetchOnReconnect: true,

            // Garbage collection time (how long unused data stays in cache)
            gcTime: 5 * 60 * 1000, // 5 minutes

            // Network mode
            networkMode: "online",

            // Enable query deduplication (prevents duplicate requests)
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
            console.error('[QueryCache] Query error:', {
              queryKey: query.queryKey,
              error: error instanceof Error ? error.message : String(error),
            });

            // Don't show toast for background refetches
            if (query.state.data !== undefined) {
              return;
            }

            // Show user-friendly error toast
            const errorMessage = error instanceof Error ? error.message : 'An error occurred';

            if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
              toast.error('Session expired. Please log in again.');
            } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
              toast.error('You don\'t have permission to access this resource.');
            } else if (errorMessage.includes('404')) {
              toast.error('Resource not found.');
            } else if (errorMessage.includes('Network')) {
              toast.error('Network error. Please check your connection.');
            } else {
              toast.error('Failed to load data. Please try again.');
            }
          },

          onSuccess: (data, query) => {
            // Optional: Log successful queries in development
            if (process.env.NODE_ENV === 'development') {
              console.log('[QueryCache] Query success:', {
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
            console.error('[MutationCache] Mutation error:', {
              error: error instanceof Error ? error.message : String(error),
              variables,
            });

            // Show user-friendly error toast (if not handled by individual mutation)
            const errorMessage = error instanceof Error ? error.message : 'An error occurred';

            // Don't show toast if mutation has onError handler (individual mutations handle their own toasts)
            if (mutation.options.onError) {
              return;
            }

            if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
              toast.error('Session expired. Please log in again.');
            } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
              toast.error('You don\'t have permission to perform this action.');
            } else if (errorMessage.includes('400') || errorMessage.includes('validation')) {
              toast.error('Invalid data. Please check your input.');
            } else if (errorMessage.includes('422')) {
              toast.error('Unable to process your request. Please try again.');
            } else if (errorMessage.includes('Network')) {
              toast.error('Network error. Please check your connection.');
            } else {
              toast.error('Action failed. Please try again.');
            }
          },

          onSuccess: (data, variables, context, mutation) => {
            // Optional: Log successful mutations in development
            if (process.env.NODE_ENV === 'development') {
              console.log('[MutationCache] Mutation success:', {
                variables,
              });
            }
          },
        }),
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
