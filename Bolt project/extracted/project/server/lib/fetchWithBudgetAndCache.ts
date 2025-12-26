import { log } from "../utils/logger";
import { checkBudget, recordUsage } from "./apiBudget";
import { getFromCache, setInCache } from "./persistentApiCache";
import { getProviderPolicy } from "./apiPolicy";

export interface FetchOptions {
  provider: string;
  cacheKey: string;
  fetcher: () => Promise<unknown>;
  tokens?: number;
  skipCache?: boolean;
  skipBudget?: boolean;
  onCacheHit?: (data: unknown) => void;
  onBudgetExhausted?: (reason: string, retryAfterMs?: number) => void;
}

export interface FetchResult<T> {
  data: T;
  fromCache: boolean;
  isFresh: boolean;
  latencyMs: number;
}

export class BudgetExhaustedError extends Error {
  constructor(
    public provider: string,
    public reason: string,
    public retryAfterMs?: number
  ) {
    super(`Budget exhausted for ${provider}: ${reason}`);
    this.name = "BudgetExhaustedError";
  }
}

export class ProviderDisabledError extends Error {
  constructor(public provider: string) {
    super(`Provider ${provider} is disabled`);
    this.name = "ProviderDisabledError";
  }
}

const throttleState: Map<string, number> = new Map();

async function throttle(provider: string): Promise<void> {
  const policy = getProviderPolicy(provider);
  const lastRequest = throttleState.get(provider) || 0;
  const timeSinceLastRequest = Date.now() - lastRequest;
  
  if (timeSinceLastRequest < policy.minRequestIntervalMs) {
    const waitTime = policy.minRequestIntervalMs - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  throttleState.set(provider, Date.now());
}

export async function fetchWithBudgetAndCache<T>(
  options: FetchOptions
): Promise<FetchResult<T>> {
  const {
    provider,
    cacheKey,
    fetcher,
    tokens,
    skipCache = false,
    skipBudget = false,
    onCacheHit,
    onBudgetExhausted,
  } = options;

  const startTime = Date.now();

  const policy = getProviderPolicy(provider);
  if (!policy.enabled) {
    throw new ProviderDisabledError(provider);
  }

  if (!skipCache) {
    const cached = await getFromCache<T>(provider, cacheKey);
    if (cached) {
      await recordUsage(provider, { isCacheHit: true });
      onCacheHit?.(cached.data);
      
      log.debug("FetchWithBudget", `Cache hit for ${provider}:${cacheKey}`, {
        isFresh: cached.isFresh,
      });
      
      return {
        data: cached.data,
        fromCache: true,
        isFresh: cached.isFresh,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  if (!skipBudget) {
    const budgetCheck = await checkBudget(provider);
    if (!budgetCheck.allowed) {
      log.warn("FetchWithBudget", `Budget exhausted for ${provider}`, {
        reason: budgetCheck.reason,
        retryAfterMs: budgetCheck.retryAfterMs,
      });
      
      onBudgetExhausted?.(budgetCheck.reason || "Budget exhausted", budgetCheck.retryAfterMs);
      
      const staleData = await getFromCache<T>(provider, cacheKey);
      if (staleData) {
        log.debug("FetchWithBudget", `Serving stale data due to budget for ${provider}:${cacheKey}`);
        return {
          data: staleData.data,
          fromCache: true,
          isFresh: false,
          latencyMs: Date.now() - startTime,
        };
      }
      
      throw new BudgetExhaustedError(
        provider,
        budgetCheck.reason || "Budget exhausted",
        budgetCheck.retryAfterMs
      );
    }
  }

  await throttle(provider);

  const fetchStartTime = Date.now();
  let isError = false;
  let isRateLimited = false;

  try {
    const data = await fetcher() as T;
    const latencyMs = Date.now() - fetchStartTime;

    await setInCache(provider, cacheKey, data);

    await recordUsage(provider, {
      tokens,
      isCacheHit: false,
      latencyMs,
    });

    log.debug("FetchWithBudget", `Fetched fresh data for ${provider}:${cacheKey}`, {
      latencyMs,
    });

    return {
      data,
      fromCache: false,
      isFresh: true,
      latencyMs,
    };
  } catch (error) {
    isError = true;
    
    if (error instanceof Error) {
      if (error.message.includes("429") || error.message.toLowerCase().includes("rate limit")) {
        isRateLimited = true;
      }
    }

    await recordUsage(provider, {
      tokens,
      isError: true,
      isRateLimited,
      isCacheHit: false,
      latencyMs: Date.now() - fetchStartTime,
    });

    const staleData = await getFromCache<T>(provider, cacheKey);
    if (staleData) {
      log.warn("FetchWithBudget", `Serving stale data due to error for ${provider}:${cacheKey}`, {
        error: String(error),
      });
      return {
        data: staleData.data,
        fromCache: true,
        isFresh: false,
        latencyMs: Date.now() - startTime,
      };
    }

    throw error;
  }
}

export async function fetchWithBudgetAndCacheMultiple<T>(
  requests: FetchOptions[]
): Promise<Map<string, FetchResult<T>>> {
  const results = new Map<string, FetchResult<T>>();
  
  const promises = requests.map(async (request) => {
    try {
      const result = await fetchWithBudgetAndCache<T>(request);
      results.set(request.cacheKey, result);
    } catch (error) {
      log.warn("FetchWithBudget", `Failed to fetch ${request.provider}:${request.cacheKey}`, {
        error: String(error),
      });
    }
  });
  
  await Promise.allSettled(promises);
  return results;
}

export function createProviderFetcher(provider: string) {
  return async function <T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    options: Partial<Omit<FetchOptions, "provider" | "cacheKey" | "fetcher">> = {}
  ): Promise<FetchResult<T>> {
    return fetchWithBudgetAndCache<T>({
      provider,
      cacheKey,
      fetcher,
      ...options,
    });
  };
}

export const alpacaFetcher = createProviderFetcher("alpaca");
export const finnhubFetcher = createProviderFetcher("finnhub");
export const coingeckoFetcher = createProviderFetcher("coingecko");
export const coinmarketcapFetcher = createProviderFetcher("coinmarketcap");
export const newsapiFetcher = createProviderFetcher("newsapi");
export const polygonFetcher = createProviderFetcher("polygon");
export const twelvedataFetcher = createProviderFetcher("twelvedata");
export const valyuFetcher = createProviderFetcher("valyu");
export const huggingfaceFetcher = createProviderFetcher("huggingface");
export const gdeltFetcher = createProviderFetcher("gdelt");
export const openaiFetcher = createProviderFetcher("openai");
export const groqFetcher = createProviderFetcher("groq");
export const togetherFetcher = createProviderFetcher("together");
export const aitradosOhlcFetcher = createProviderFetcher("aitrados_ohlc");
export const aitradosNewsFetcher = createProviderFetcher("aitrados_news");
export const aitradosEconFetcher = createProviderFetcher("aitrados_econ");
