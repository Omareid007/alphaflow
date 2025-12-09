interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleTimestamp: number;
}

interface CacheConfig {
  freshDuration: number;
  staleDuration: number;
  maxEntries?: number;
}

const DEFAULT_FRESH_DURATION = 60 * 1000;
const DEFAULT_STALE_DURATION = 30 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 1000;

export class ApiCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: Required<CacheConfig>;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      freshDuration: config.freshDuration ?? DEFAULT_FRESH_DURATION,
      staleDuration: config.staleDuration ?? DEFAULT_STALE_DURATION,
      maxEntries: config.maxEntries ?? DEFAULT_MAX_ENTRIES,
    };
  }

  get(key: string): { data: T; isFresh: boolean } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    
    if (now - entry.timestamp < this.config.freshDuration) {
      return { data: entry.data, isFresh: true };
    }

    if (now - entry.timestamp < this.config.staleDuration) {
      return { data: entry.data, isFresh: false };
    }

    this.cache.delete(key);
    return null;
  }

  getFresh(key: string): T | null {
    const result = this.get(key);
    return result?.isFresh ? result.data : null;
  }

  getStale(key: string): T | null {
    const result = this.get(key);
    return result?.data ?? null;
  }

  set(key: string, data: T): void {
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      staleTimestamp: now + this.config.staleDuration,
    });
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; freshCount: number; staleCount: number } {
    const now = Date.now();
    let freshCount = 0;
    let staleCount = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp < this.config.freshDuration) {
        freshCount++;
      } else if (now - entry.timestamp < this.config.staleDuration) {
        staleCount++;
      }
    }

    return { size: this.cache.size, freshCount, staleCount };
  }
}

export interface FetchWithCacheOptions<T> {
  cacheKey: string;
  cache: ApiCache<T>;
  fetcher: () => Promise<T>;
  onStaleServed?: (key: string) => void;
  onError?: (error: Error, staleData: T | null) => void;
}

export async function fetchWithCache<T>(
  options: FetchWithCacheOptions<T>
): Promise<T> {
  const { cacheKey, cache, fetcher, onStaleServed, onError } = options;

  const cached = cache.get(cacheKey);

  if (cached?.isFresh) {
    return cached.data;
  }

  try {
    const data = await fetcher();
    cache.set(cacheKey, data);
    return data;
  } catch (error) {
    const staleData = cache.getStale(cacheKey);
    
    if (staleData !== null) {
      onStaleServed?.(cacheKey);
      console.log(`[ApiCache] Serving stale data for ${cacheKey} due to fetch error`);
      return staleData;
    }

    onError?.(error as Error, null);
    throw error;
  }
}

const pendingRefreshes = new Set<string>();

export interface SWRFetchOptions<T> {
  cacheKey: string;
  cache: ApiCache<T>;
  fetcher: () => Promise<T>;
  onBackgroundRefresh?: (key: string, success: boolean) => void;
}

export async function fetchWithSWR<T>(
  options: SWRFetchOptions<T>
): Promise<T> {
  const { cacheKey, cache, fetcher, onBackgroundRefresh } = options;

  const cached = cache.get(cacheKey);

  if (cached?.isFresh) {
    return cached.data;
  }

  if (cached && !cached.isFresh) {
    if (!pendingRefreshes.has(cacheKey)) {
      pendingRefreshes.add(cacheKey);
      
      setTimeout(async () => {
        try {
          const data = await fetcher();
          cache.set(cacheKey, data);
          onBackgroundRefresh?.(cacheKey, true);
        } catch (error) {
          console.log(`[ApiCache] Background refresh failed for ${cacheKey}`);
          onBackgroundRefresh?.(cacheKey, false);
        } finally {
          pendingRefreshes.delete(cacheKey);
        }
      }, 0);
    }
    
    console.log(`[ApiCache] Serving stale data for ${cacheKey}, refreshing in background`);
    return cached.data;
  }

  const data = await fetcher();
  cache.set(cacheKey, data);
  return data;
}

export interface RateLimitInfo {
  isLimited: boolean;
  retryAfter?: number;
  remaining?: number;
}

export function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
  const retryAfter = headers.get("Retry-After");
  const remaining = headers.get("X-RateLimit-Remaining");
  const reset = headers.get("X-RateLimit-Reset");

  return {
    isLimited: !!retryAfter || remaining === "0",
    retryAfter: retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
    remaining: remaining ? parseInt(remaining, 10) : undefined,
  };
}

export const marketDataCache = new ApiCache({
  freshDuration: 30 * 1000,
  staleDuration: 60 * 60 * 1000,
});

export const stockQuoteCache = new ApiCache({
  freshDuration: 60 * 1000,
  staleDuration: 30 * 60 * 1000,
});

export const cryptoPriceCache = new ApiCache({
  freshDuration: 60 * 1000,
  staleDuration: 30 * 60 * 1000,
});

export const newsCache = new ApiCache({
  freshDuration: 5 * 60 * 1000,
  staleDuration: 60 * 60 * 1000,
});

export const assetListCache = new ApiCache({
  freshDuration: 15 * 60 * 1000,
  staleDuration: 24 * 60 * 60 * 1000,
});

export const portfolioCache = new ApiCache({
  freshDuration: 30 * 1000,
  staleDuration: 10 * 60 * 1000,
});
