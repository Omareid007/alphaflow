"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000, // 2 minutes - reduce redundant fetches
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              console.log("[QueryProvider] Query retry check:", {
                failureCount,
                error: error instanceof Error ? error.message : String(error),
              });

              // Don't retry on auth errors (401, 403)
              if (error instanceof Error) {
                const errorMessage = error.message.toLowerCase();
                if (
                  errorMessage.includes("401") ||
                  errorMessage.includes("403") ||
                  errorMessage.includes("unauthorized") ||
                  errorMessage.includes("forbidden")
                ) {
                  console.log(
                    "[QueryProvider] Not retrying - authentication error"
                  );
                  return false;
                }
              }
              // Retry up to 2 times for other errors
              const shouldRetry = failureCount < 2;
              console.log("[QueryProvider] Retry decision:", shouldRetry);
              return shouldRetry;
            },
            retryDelay: (attemptIndex) => {
              const delay = Math.min(1000 * 2 ** attemptIndex, 30000);
              console.log("[QueryProvider] Retry delay:", {
                attemptIndex,
                delay,
              });
              return delay;
            },
            // Only refetch if data is stale (after staleTime)
            refetchOnMount: true,
            // Show stale data while refetching
            refetchOnReconnect: true,
            // Set a timeout for queries
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            // Add network mode for better offline handling
            networkMode: "online",
          },
          mutations: {
            retry: (failureCount, error) => {
              console.log("[QueryProvider] Mutation retry check:", {
                failureCount,
                error: error instanceof Error ? error.message : String(error),
              });

              // Don't retry mutations on client errors (4xx)
              if (error instanceof Error) {
                const errorMessage = error.message.toLowerCase();
                if (
                  errorMessage.includes("400") ||
                  errorMessage.includes("401") ||
                  errorMessage.includes("403") ||
                  errorMessage.includes("404") ||
                  errorMessage.includes("422")
                ) {
                  console.log(
                    "[QueryProvider] Not retrying mutation - client error"
                  );
                  return false;
                }
              }
              // Retry once for 5xx errors
              const shouldRetry = failureCount < 1;
              console.log(
                "[QueryProvider] Mutation retry decision:",
                shouldRetry
              );
              return shouldRetry;
            },
            networkMode: "online",
          },
        },
        // Add query cache logger
        queryCache: undefined,
        mutationCache: undefined,
      })
  );

  // Log query client initialization
  console.log("[QueryProvider] Initialized with configuration:", {
    defaultOptions: queryClient.getDefaultOptions(),
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
