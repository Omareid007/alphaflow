import { wrapWithLimiter } from "./rateLimiter";
import { getBreaker, isCircuitOpen } from "./circuitBreaker";
import { ApiCache } from "./api-cache";
import { log } from "../utils/logger";

export interface ProviderAdapter<T> {
  name: string;
  priority: number;
  costPerCall: number;
  isEnabled: () => boolean;
  fetch: (...args: any[]) => Promise<T>;
  normalize?: (data: any) => T;
}

export interface FallbackResult<T> {
  data: T;
  provider: string;
  cached: boolean;
  latencyMs: number;
  fromStaleCache?: boolean;
}

export interface FallbackManagerOptions {
  cachePrefix: string;
  cacheTTLMs?: number;
  staleCacheTTLMs?: number;
  circuitBreakerTimeout?: number;
  circuitBreakerResetTimeout?: number;
}

export class ProviderFallbackManager<T> {
  private providers: ProviderAdapter<T>[];
  private cache: ApiCache<T>;
  private cachePrefix: string;
  private circuitBreakerTimeout: number;
  private circuitBreakerResetTimeout: number;

  constructor(
    providers: ProviderAdapter<T>[],
    options: FallbackManagerOptions
  ) {
    this.providers = providers.sort((a, b) => a.priority - b.priority);
    this.cachePrefix = options.cachePrefix;
    this.circuitBreakerTimeout = options.circuitBreakerTimeout ?? 15000;
    this.circuitBreakerResetTimeout =
      options.circuitBreakerResetTimeout ?? 60000;

    this.cache = new ApiCache<T>({
      freshDuration: options.cacheTTLMs ?? 60000,
      staleDuration: options.staleCacheTTLMs ?? 30 * 60 * 1000,
    });
  }

  async fetch(cacheKey: string, ...args: any[]): Promise<FallbackResult<T>> {
    const fullCacheKey = `${this.cachePrefix}:${cacheKey}`;

    const cached = this.cache.get(fullCacheKey);
    if (cached?.isFresh) {
      return {
        data: cached.data,
        provider: "cache",
        cached: true,
        latencyMs: 0,
      };
    }

    const enabledProviders = this.providers.filter((p) => p.isEnabled());
    const errors: Error[] = [];

    for (const provider of enabledProviders) {
      if (isCircuitOpen(`provider:${provider.name}`)) {
        log.debug(
          "ProviderFallback",
          `Skipping ${provider.name} - circuit open`
        );
        continue;
      }

      const startTime = Date.now();

      try {
        const breaker = getBreaker(
          `provider:${provider.name}`,
          async () =>
            wrapWithLimiter(provider.name, () => provider.fetch(...args)),
          {
            timeout: this.circuitBreakerTimeout,
            resetTimeout: this.circuitBreakerResetTimeout,
            errorThresholdPercentage: 50,
            volumeThreshold: 3,
          }
        );

        let data: T = (await breaker.fire()) as T;

        if (provider.normalize) {
          data = provider.normalize(data) as T;
        }

        this.cache.set(fullCacheKey, data);

        const latencyMs = Date.now() - startTime;
        log.debug(
          "ProviderFallback",
          `${provider.name} succeeded in ${latencyMs}ms for ${cacheKey}`
        );

        return {
          data,
          provider: provider.name,
          cached: false,
          latencyMs,
        };
      } catch (error) {
        errors.push(error as Error);
        log.warn(
          "ProviderFallback",
          `${provider.name} failed for ${cacheKey}: ${(error as Error).message}`
        );
        continue;
      }
    }

    if (cached?.data) {
      log.warn(
        "ProviderFallback",
        `All providers failed, using stale cache for ${cacheKey}`
      );
      return {
        data: cached.data,
        provider: "stale-cache",
        cached: true,
        latencyMs: 0,
        fromStaleCache: true,
      };
    }

    const errorMessages = errors.map((e) => e.message).join("; ");
    throw new Error(
      `All ${enabledProviders.length} providers failed for ${cacheKey}: ${errorMessages}`
    );
  }

  async fetchWithFallbackOnly(
    cacheKey: string,
    ...args: any[]
  ): Promise<FallbackResult<T> | null> {
    try {
      return await this.fetch(cacheKey, ...args);
    } catch {
      return null;
    }
  }

  getEnabledProviders(): string[] {
    return this.providers.filter((p) => p.isEnabled()).map((p) => p.name);
  }

  getProviderByName(name: string): ProviderAdapter<T> | undefined {
    return this.providers.find((p) => p.name === name);
  }

  addProvider(provider: ProviderAdapter<T>): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  removeProvider(name: string): boolean {
    const index = this.providers.findIndex((p) => p.name === name);
    if (index !== -1) {
      this.providers.splice(index, 1);
      return true;
    }
    return false;
  }

  getCacheStats(): { size: number; freshCount: number; staleCount: number } {
    return this.cache.getStats();
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export interface StockQuote {
  symbol: string;
  price: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
  timestamp: Date;
}

export interface CryptoQuote {
  symbol: string;
  price: number;
  change24h?: number;
  changePercent24h?: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  marketCap?: number;
  timestamp: Date;
}

export interface MarketDataFallbackConfig {
  stockProviders?: ProviderAdapter<StockQuote>[];
  cryptoProviders?: ProviderAdapter<CryptoQuote>[];
}

export function createStockQuoteProvider(
  name: string,
  priority: number,
  costPerCall: number,
  fetchFn: (symbol: string) => Promise<StockQuote>,
  isEnabled: () => boolean = () => true
): ProviderAdapter<StockQuote> {
  return {
    name,
    priority,
    costPerCall,
    isEnabled,
    fetch: fetchFn,
  };
}

export function createCryptoQuoteProvider(
  name: string,
  priority: number,
  costPerCall: number,
  fetchFn: (symbol: string) => Promise<CryptoQuote>,
  isEnabled: () => boolean = () => true
): ProviderAdapter<CryptoQuote> {
  return {
    name,
    priority,
    costPerCall,
    isEnabled,
    fetch: fetchFn,
  };
}
