import { callExternal, CallExternalResult, CallExternalOptions } from "./callExternal";
import { log } from "../utils/logger";

export interface ConnectorResponse<T> {
  data: T;
  provenance: {
    provider: string;
    cacheHit: boolean;
    cacheAgeMs: number | null;
    budgetStatus: {
      remaining: number;
      windowType: string;
    };
    latencyMs: number;
    timestamp: number;
  };
}

export interface FetchOptions {
  provider: string;
  endpoint: string;
  cacheKey: string;
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  skipCache?: boolean;
  forceRefresh?: boolean;
  customTTLMs?: number;
  countAsMultiple?: number;
}

export async function connectorFetch<T>(
  url: string,
  options: FetchOptions
): Promise<ConnectorResponse<T>> {
  const {
    provider,
    endpoint,
    cacheKey,
    headers = {},
    method = "GET",
    body,
    skipCache = false,
    forceRefresh = false,
    customTTLMs,
    countAsMultiple,
  } = options;

  const startTime = Date.now();

  const fetcher = async (): Promise<T> => {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
      },
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`${provider} API error ${response.status}: ${errorText.substring(0, 200)}`);
    }

    return response.json() as Promise<T>;
  };

  const callExternalOptions: CallExternalOptions = {
    provider,
    endpoint,
    cacheKey,
    cachePolicy: {
      skipCache,
      forceRefresh,
      customTTLMs,
    },
    budgetPolicy: {
      countAsMultiple,
    },
  };

  const result: CallExternalResult<T> = await callExternal(fetcher, callExternalOptions);

  const latencyMs = Date.now() - startTime;
  const cacheHit = result.provenance.cacheStatus !== "miss";
  const cacheAgeMs = cacheHit ? latencyMs : null;

  log.debug("ConnectorClient", `${provider}:${endpoint}`, {
    cacheHit,
    budgetRemaining: result.provenance.budgetRemaining,
    latencyMs,
  });

  return {
    data: result.data,
    provenance: {
      provider,
      cacheHit,
      cacheAgeMs,
      budgetStatus: {
        remaining: result.provenance.budgetRemaining,
        windowType: "minute",
      },
      latencyMs,
      timestamp: Date.now(),
    },
  };
}

export function buildCacheKey(provider: string, ...parts: (string | number | undefined)[]): string {
  const filteredParts = parts.filter((p) => p !== undefined && p !== null);
  return `${provider}:${filteredParts.join(":")}`;
}

export function hashEndpoint(endpoint: string): string {
  let hash = 0;
  for (let i = 0; i < endpoint.length; i++) {
    const char = endpoint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
