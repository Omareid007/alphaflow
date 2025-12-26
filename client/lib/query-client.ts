import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Gets the base URL for the Express API server
 * In development on web, requests go to the same origin (Metro proxies /api to Express)
 * In production, requests go to the deployment domain
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  // In browser environment, use relative URLs (same origin)
  // This works because Metro is configured to proxy /api requests to Express
  if (typeof window !== "undefined" && window.location) {
    const url = window.location.origin;
    console.log('[API Client - RN] Using browser origin:', url);
    return url;
  }

  // For native/non-browser environments, use the configured domain
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    console.error('[API Client - RN] EXPO_PUBLIC_DOMAIN is not set');
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  // Remove port suffix for HTTPS URLs (Replit proxy handles routing)
  if (host.includes(":")) {
    host = host.split(":")[0];
  }

  const url = `https://${host}`;
  console.log('[API Client - RN] Using configured domain:', url);
  return url;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorText = '';
    try {
      errorText = await res.text();
    } catch (e) {
      errorText = res.statusText;
    }

    console.error('[API Client - RN] Request failed:', {
      status: res.status,
      statusText: res.statusText,
      url: res.url,
      errorText,
    });

    throw new Error(`${res.status}: ${errorText || res.statusText}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  console.log('[API Client - RN] Request:', {
    method,
    route,
    url: url.toString(),
    hasData: !!data,
  });

  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    console.log('[API Client - RN] Response:', {
      method,
      route,
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error('[API Client - RN] Error:', {
      method,
      route,
      error,
    });
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    console.log('[API Client - RN] Query:', {
      queryKey,
      url: url.toString(),
    });

    try {
      const res = await fetch(url, {
        credentials: "include",
      });

      console.log('[API Client - RN] Query response:', {
        queryKey,
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        console.log('[API Client - RN] Returning null for 401');
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error('[API Client - RN] Query error:', {
        queryKey,
        error,
      });
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        console.log('[QueryClient - RN] Query retry check:', {
          failureCount,
          error: error instanceof Error ? error.message : String(error),
        });

        // Don't retry on auth errors
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          if (
            errorMessage.includes("401") ||
            errorMessage.includes("403") ||
            errorMessage.includes("unauthorized")
          ) {
            console.log('[QueryClient - RN] Not retrying - auth error');
            return false;
          }
        }

        // Retry up to 2 times for other errors
        const shouldRetry = failureCount < 2;
        console.log('[QueryClient - RN] Retry decision:', shouldRetry);
        return shouldRetry;
      },
      retryDelay: (attemptIndex) => {
        const delay = Math.min(1000 * 2 ** attemptIndex, 30000);
        console.log('[QueryClient - RN] Retry delay:', { attemptIndex, delay });
        return delay;
      },
      networkMode: 'online',
    },
    mutations: {
      retry: (failureCount, error) => {
        console.log('[QueryClient - RN] Mutation retry check:', {
          failureCount,
          error: error instanceof Error ? error.message : String(error),
        });

        // Don't retry mutations on client errors
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          if (
            errorMessage.includes("400") ||
            errorMessage.includes("401") ||
            errorMessage.includes("403") ||
            errorMessage.includes("404")
          ) {
            console.log('[QueryClient - RN] Not retrying mutation - client error');
            return false;
          }
        }

        // Retry once for 5xx errors
        const shouldRetry = failureCount < 1;
        console.log('[QueryClient - RN] Mutation retry decision:', shouldRetry);
        return shouldRetry;
      },
      networkMode: 'online',
    },
  },
});

console.log('[QueryClient - RN] Initialized with default options');
