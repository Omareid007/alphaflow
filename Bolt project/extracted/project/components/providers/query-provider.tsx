"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
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
              // Retry up to 2 times for other errors
              return failureCount < 2;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Keep data on error if we have cached data
            refetchOnMount: "always",
            // Show stale data while refetching
            refetchOnReconnect: true,
            // Set a timeout for queries
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
          },
          mutations: {
            retry: (failureCount, error) => {
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
                  return false;
                }
              }
              // Retry once for 5xx errors
              return failureCount < 1;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
