import { log } from "../utils/logger";
import { checkBudget, recordUsage } from "./apiBudget";
import { getFromCache, setInCache } from "./persistentApiCache";
import { getProviderPolicy } from "./apiPolicy";

export interface CallExternalOptions {
  provider: string;
  endpoint: string;
  cacheKey?: string;
  budgetPolicy?: {
    skipBudgetCheck?: boolean;
    countAsMultiple?: number;
  };
  cachePolicy?: {
    skipCache?: boolean;
    forceRefresh?: boolean;
    customTTLMs?: number;
  };
  fallbackProvider?: string;
  fallbackFetcher?: () => Promise<unknown>;
}

export interface CallExternalResult<T> {
  data: T;
  provenance: {
    provider: string;
    cacheStatus: "fresh" | "stale" | "miss";
    budgetRemaining: number;
    latencyMs: number;
    usedFallback: boolean;
  };
}

const lastCallTimes: Map<string, number> = new Map();

async function enforceMinInterval(provider: string): Promise<void> {
  const policy = getProviderPolicy(provider);
  const lastCall = lastCallTimes.get(provider) || 0;
  const elapsed = Date.now() - lastCall;
  const minInterval = policy.minRequestIntervalMs;

  if (elapsed < minInterval) {
    const waitTime = minInterval - elapsed;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastCallTimes.set(provider, Date.now());
}

export async function callExternal<T>(
  fetcher: () => Promise<T>,
  options: CallExternalOptions
): Promise<CallExternalResult<T>> {
  const {
    provider,
    endpoint,
    cacheKey,
    budgetPolicy = {},
    cachePolicy = {},
    fallbackProvider,
    fallbackFetcher,
  } = options;

  const effectiveCacheKey = cacheKey || `${provider}:${endpoint}`;
  const startTime = Date.now();
  let cacheStatus: "fresh" | "stale" | "miss" = "miss";
  let usedFallback = false;

  if (!cachePolicy.skipCache && !cachePolicy.forceRefresh) {
    const cached = await getFromCache<T>(provider, effectiveCacheKey);
    if (cached) {
      if (cached.isFresh) {
        cacheStatus = "fresh";
        await recordUsage(provider, { isCacheHit: true });
        log.debug("CallExternal", `Cache HIT (fresh) for ${provider}:${effectiveCacheKey}`);
        return {
          data: cached.data,
          provenance: {
            provider,
            cacheStatus: "fresh",
            budgetRemaining: Infinity,
            latencyMs: Date.now() - startTime,
            usedFallback: false,
          },
        };
      }
      cacheStatus = "stale";
    }
  }

  if (!budgetPolicy.skipBudgetCheck) {
    const budgetCheck = await checkBudget(provider);
    if (!budgetCheck.allowed) {
      log.warn("CallExternal", `Budget exhausted for ${provider}: ${budgetCheck.reason}`);

      if (cacheStatus === "stale") {
        const staleData = await getFromCache<T>(provider, effectiveCacheKey);
        if (staleData) {
          log.info("CallExternal", `Serving stale data for ${provider} due to budget limit`);
          await recordUsage(provider, { isCacheHit: true });
          return {
            data: staleData.data,
            provenance: {
              provider,
              cacheStatus: "stale",
              budgetRemaining: 0,
              latencyMs: Date.now() - startTime,
              usedFallback: false,
            },
          };
        }
      }

      if (fallbackProvider && fallbackFetcher) {
        log.info("CallExternal", `Trying fallback provider ${fallbackProvider} for ${provider}`);
        try {
          const fallbackResult = await callExternal<T>(fallbackFetcher as () => Promise<T>, {
            provider: fallbackProvider,
            endpoint,
            cacheKey: effectiveCacheKey,
            budgetPolicy,
            cachePolicy,
          });
          return {
            ...fallbackResult,
            provenance: {
              ...fallbackResult.provenance,
              usedFallback: true,
            },
          };
        } catch (fallbackError) {
          log.warn("CallExternal", `Fallback provider ${fallbackProvider} also failed`);
        }
      }

      throw new Error(`Budget exhausted for ${provider}: ${budgetCheck.reason}`);
    }
  }

  await enforceMinInterval(provider);

  try {
    const data = await fetcher();
    const latencyMs = Date.now() - startTime;

    await setInCache(provider, effectiveCacheKey, data);

    const requestCount = budgetPolicy.countAsMultiple || 1;
    for (let i = 0; i < requestCount; i++) {
      await recordUsage(provider, {
        isCacheHit: false,
        latencyMs: i === 0 ? latencyMs : undefined,
      });
    }

    log.debug("CallExternal", `Fetched ${provider}:${effectiveCacheKey} in ${latencyMs}ms`);

    const postBudget = await checkBudget(provider);

    return {
      data,
      provenance: {
        provider,
        cacheStatus: "miss",
        budgetRemaining: postBudget.allowed ? postBudget.limit - postBudget.currentCount : 0,
        latencyMs,
        usedFallback,
      },
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    await recordUsage(provider, {
      isCacheHit: false,
      isError: true,
      latencyMs,
    });

    if (cacheStatus === "stale") {
      const staleData = await getFromCache<T>(provider, effectiveCacheKey);
      if (staleData) {
        log.warn("CallExternal", `Serving stale data for ${provider} after fetch error: ${error}`);
        return {
          data: staleData.data,
          provenance: {
            provider,
            cacheStatus: "stale",
            budgetRemaining: 0,
            latencyMs,
            usedFallback: false,
          },
        };
      }
    }

    if (fallbackProvider && fallbackFetcher) {
      log.info("CallExternal", `Trying fallback provider ${fallbackProvider} after error`);
      try {
        const fallbackResult = await callExternal<T>(fallbackFetcher as () => Promise<T>, {
          provider: fallbackProvider,
          endpoint,
          cacheKey: effectiveCacheKey,
          budgetPolicy,
          cachePolicy,
        });
        return {
          ...fallbackResult,
          provenance: {
            ...fallbackResult.provenance,
            usedFallback: true,
          },
        };
      } catch (fallbackError) {
        log.warn("CallExternal", `Fallback provider ${fallbackProvider} also failed`);
      }
    }

    throw error;
  }
}

export async function getProviderStatus(provider: string): Promise<{
  enabled: boolean;
  budgetStatus: {
    allowed: boolean;
    currentCount: number;
    limit: number;
    windowType: string;
  };
  lastCallTime: number | null;
  policy: {
    maxRequestsPerMinute?: number;
    maxRequestsPerDay?: number;
    maxRequestsPerWeek?: number;
    cacheFreshDurationMs: number;
  };
}> {
  const policy = getProviderPolicy(provider);
  const budgetCheck = await checkBudget(provider);
  const lastCall = lastCallTimes.get(provider) || null;

  return {
    enabled: policy.enabled,
    budgetStatus: {
      allowed: budgetCheck.allowed,
      currentCount: budgetCheck.currentCount,
      limit: budgetCheck.limit,
      windowType: budgetCheck.windowType,
    },
    lastCallTime: lastCall,
    policy: {
      maxRequestsPerMinute: policy.maxRequestsPerMinute,
      maxRequestsPerDay: policy.maxRequestsPerDay,
      maxRequestsPerWeek: policy.maxRequestsPerWeek,
      cacheFreshDurationMs: policy.cacheFreshDurationMs,
    },
  };
}

export async function getAllProviderStatuses(): Promise<Record<string, Awaited<ReturnType<typeof getProviderStatus>>>> {
  const providers = [
    "alpaca", "finnhub", "coingecko", "coinmarketcap", "newsapi",
    "polygon", "twelvedata", "valyu", "huggingface", "gdelt",
    "openai", "groq", "together",
    "aitrados_ohlc", "aitrados_news", "aitrados_econ"
  ];

  const statuses: Record<string, Awaited<ReturnType<typeof getProviderStatus>>> = {};
  for (const provider of providers) {
    statuses[provider] = await getProviderStatus(provider);
  }
  return statuses;
}
