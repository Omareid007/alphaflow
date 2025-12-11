import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";

const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";

export interface CMCCryptocurrency {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  cmc_rank: number;
  num_market_pairs: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number | null;
  infinite_supply: boolean;
  last_updated: string;
  date_added: string;
  tags: string[];
  platform: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    token_address: string;
  } | null;
  quote: {
    USD: {
      price: number;
      volume_24h: number;
      volume_change_24h: number;
      percent_change_1h: number;
      percent_change_24h: number;
      percent_change_7d: number;
      percent_change_30d: number;
      percent_change_60d: number;
      percent_change_90d: number;
      market_cap: number;
      market_cap_dominance: number;
      fully_diluted_market_cap: number;
      last_updated: string;
    };
  };
}

export interface CMCListingsResponse {
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
    elapsed: number;
    credit_count: number;
    notice: string | null;
  };
  data: CMCCryptocurrency[];
}

export interface CMCQuotesResponse {
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
    elapsed: number;
    credit_count: number;
    notice: string | null;
  };
  data: { [id: string]: CMCCryptocurrency };
}

export interface CMCGlobalMetrics {
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
  };
  data: {
    active_cryptocurrencies: number;
    total_cryptocurrencies: number;
    active_market_pairs: number;
    active_exchanges: number;
    total_exchanges: number;
    eth_dominance: number;
    btc_dominance: number;
    eth_dominance_yesterday: number;
    btc_dominance_yesterday: number;
    eth_dominance_24h_percentage_change: number;
    btc_dominance_24h_percentage_change: number;
    defi_volume_24h: number;
    defi_volume_24h_reported: number;
    defi_market_cap: number;
    defi_24h_percentage_change: number;
    stablecoin_volume_24h: number;
    stablecoin_volume_24h_reported: number;
    stablecoin_market_cap: number;
    stablecoin_24h_percentage_change: number;
    derivatives_volume_24h: number;
    derivatives_volume_24h_reported: number;
    derivatives_24h_percentage_change: number;
    quote: {
      USD: {
        total_market_cap: number;
        total_volume_24h: number;
        total_volume_24h_reported: number;
        altcoin_volume_24h: number;
        altcoin_volume_24h_reported: number;
        altcoin_market_cap: number;
        defi_volume_24h: number;
        defi_volume_24h_reported: number;
        defi_24h_percentage_change: number;
        defi_market_cap: number;
        stablecoin_volume_24h: number;
        stablecoin_volume_24h_reported: number;
        stablecoin_24h_percentage_change: number;
        stablecoin_market_cap: number;
        derivatives_volume_24h: number;
        derivatives_volume_24h_reported: number;
        derivatives_24h_percentage_change: number;
        last_updated: string;
        total_market_cap_yesterday: number;
        total_volume_24h_yesterday: number;
        total_market_cap_yesterday_percentage_change: number;
        total_volume_24h_yesterday_percentage_change: number;
      };
    };
    last_updated: string;
  };
}

export interface CMCMapItem {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  rank: number;
  is_active: number;
  first_historical_data: string;
  last_historical_data: string;
  platform: {
    id: number;
    name: string;
    symbol: string;
    slug: string;
    token_address: string;
  } | null;
}

export interface CMCMapResponse {
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
  };
  data: CMCMapItem[];
}

class CoinMarketCapConnector {
  private listingsCache = new ApiCache<CMCCryptocurrency[]>({
    freshDuration: 5 * 60 * 1000,
    staleDuration: 60 * 60 * 1000,
  });
  private quotesCache = new ApiCache<{ [id: string]: CMCCryptocurrency }>({
    freshDuration: 5 * 60 * 1000,
    staleDuration: 30 * 60 * 1000,
  });
  private globalCache = new ApiCache<CMCGlobalMetrics["data"]>({
    freshDuration: 10 * 60 * 1000,
    staleDuration: 60 * 60 * 1000,
  });
  private mapCache = new ApiCache<CMCMapItem[]>({
    freshDuration: 60 * 60 * 1000,
    staleDuration: 24 * 60 * 60 * 1000,
  });
  
  private lastRequestTime = 0;
  private minRequestInterval = 1000;
  private rateLimitedUntil = 0;

  private getApiKey(): string | undefined {
    return process.env.COINMARKETCAP_API_KEY;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    
    if (now < this.rateLimitedUntil) {
      const waitTime = this.rateLimitedUntil - now;
      log.warn("CMC", `Rate limited, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  private pendingRefreshes = new Set<string>();

  private async fetchWithRetry<T, R>(
    url: string,
    cacheKey: string,
    cache: ApiCache<R>,
    extractData: (response: T) => R,
    retries = 3
  ): Promise<R> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      const stale = cache.getStale(cacheKey);
      if (stale) {
        log.debug("CMC", `No API key, serving stale data for ${cacheKey}`);
        return stale;
      }
      throw new Error("COINMARKETCAP_API_KEY is not configured");
    }

    const cached = cache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    if (cached && !cached.isFresh) {
      if (!this.pendingRefreshes.has(cacheKey)) {
        this.pendingRefreshes.add(cacheKey);
        this.backgroundRefresh(url, cacheKey, cache, extractData, retries);
      }
      log.debug("CMC", `Serving stale data for ${cacheKey}, refreshing in background`);
      return cached.data;
    }

    return this.doFetch(url, cacheKey, cache, extractData, retries);
  }

  private async backgroundRefresh<T, R>(
    url: string,
    cacheKey: string,
    cache: ApiCache<R>,
    extractData: (response: T) => R,
    retries: number
  ): Promise<void> {
    try {
      await this.doFetch(url, cacheKey, cache, extractData, retries);
    } catch (error) {
      log.warn("CMC", `Background refresh failed for ${cacheKey}`);
    } finally {
      this.pendingRefreshes.delete(cacheKey);
    }
  }

  private async doFetch<T, R>(
    url: string,
    cacheKey: string,
    cache: ApiCache<R>,
    extractData: (response: T) => R,
    retries: number
  ): Promise<R> {
    const apiKey = this.getApiKey()!;
    await this.throttle();

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            "X-CMC_PRO_API_KEY": apiKey,
            Accept: "application/json",
          },
        });

        if (response.status === 429) {
          this.rateLimitedUntil = Date.now() + Math.pow(2, i + 1) * 1000;
          
          const stale = cache.getStale(cacheKey);
          if (stale) {
            log.debug("CMC", `Rate limited, serving stale data for ${cacheKey}`);
            return stale;
          }
          
          const waitTime = Math.pow(2, i) * 1000;
          log.warn("CMC", `Rate limited, waiting ${waitTime}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`CoinMarketCap API error: ${response.status}`);
        }

        const jsonResponse = await response.json() as T;
        const data = extractData(jsonResponse);
        cache.set(cacheKey, data);
        return data;
      } catch (error) {
        const stale = cache.getStale(cacheKey);
        if (stale && i === retries - 1) {
          log.debug("CMC", `Error fetching, serving stale data for ${cacheKey}`);
          return stale;
        }
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    throw new Error("Failed to fetch from CoinMarketCap after retries");
  }

  async getLatestListings(
    start = 1,
    limit = 100,
    sort = "market_cap",
    sortDir: "asc" | "desc" = "desc"
  ): Promise<CMCCryptocurrency[]> {
    const cacheKey = `listings_${start}_${limit}_${sort}_${sortDir}`;
    const url = `${CMC_BASE_URL}/v1/cryptocurrency/listings/latest?start=${start}&limit=${limit}&sort=${sort}&sort_dir=${sortDir}&convert=USD`;
    
    return this.fetchWithRetry<CMCListingsResponse, CMCCryptocurrency[]>(
      url,
      cacheKey,
      this.listingsCache,
      (response) => {
        if (response.status.error_code !== 0) {
          throw new Error(response.status.error_message || "CoinMarketCap API error");
        }
        return response.data;
      }
    );
  }

  async getQuotes(ids: number[]): Promise<{ [id: string]: CMCCryptocurrency }> {
    const idsParam = ids.join(",");
    const cacheKey = `quotes_${idsParam}`;
    const url = `${CMC_BASE_URL}/v1/cryptocurrency/quotes/latest?id=${idsParam}&convert=USD`;
    
    return this.fetchWithRetry<CMCQuotesResponse, { [id: string]: CMCCryptocurrency }>(
      url,
      cacheKey,
      this.quotesCache,
      (response) => {
        if (response.status.error_code !== 0) {
          throw new Error(response.status.error_message || "CoinMarketCap API error");
        }
        return response.data;
      }
    );
  }

  async getQuotesBySymbols(symbols: string[]): Promise<{ [id: string]: CMCCryptocurrency }> {
    const symbolsParam = symbols.join(",");
    const cacheKey = `quotes_symbols_${symbolsParam}`;
    const url = `${CMC_BASE_URL}/v1/cryptocurrency/quotes/latest?symbol=${symbolsParam}&convert=USD`;
    
    return this.fetchWithRetry<CMCQuotesResponse, { [id: string]: CMCCryptocurrency }>(
      url,
      cacheKey,
      this.quotesCache,
      (response) => {
        if (response.status.error_code !== 0) {
          throw new Error(response.status.error_message || "CoinMarketCap API error");
        }
        return response.data;
      }
    );
  }

  async getGlobalMetrics(): Promise<CMCGlobalMetrics["data"]> {
    const cacheKey = "global_metrics";
    const url = `${CMC_BASE_URL}/v1/global-metrics/quotes/latest?convert=USD`;
    
    return this.fetchWithRetry<CMCGlobalMetrics, CMCGlobalMetrics["data"]>(
      url,
      cacheKey,
      this.globalCache,
      (response) => {
        if (response.status.error_code !== 0) {
          throw new Error(response.status.error_message || "CoinMarketCap API error");
        }
        return response.data;
      }
    );
  }

  async getCryptoMap(
    start = 1,
    limit = 5000,
    sort = "cmc_rank"
  ): Promise<CMCMapItem[]> {
    const cacheKey = `map_${start}_${limit}_${sort}`;
    const url = `${CMC_BASE_URL}/v1/cryptocurrency/map?start=${start}&limit=${limit}&sort=${sort}`;
    
    return this.fetchWithRetry<CMCMapResponse, CMCMapItem[]>(
      url,
      cacheKey,
      this.mapCache,
      (response) => {
        if (response.status.error_code !== 0) {
          throw new Error(response.status.error_message || "CoinMarketCap API error");
        }
        return response.data;
      }
    );
  }

  async searchCryptos(query: string, limit = 20): Promise<CMCMapItem[]> {
    const allCryptos = await this.getCryptoMap(1, 500);
    const lowerQuery = query.toLowerCase();
    
    return allCryptos
      .filter(
        (crypto) =>
          crypto.symbol.toLowerCase().includes(lowerQuery) ||
          crypto.name.toLowerCase().includes(lowerQuery)
      )
      .slice(0, limit);
  }

  getConnectionStatus(): { connected: boolean; hasApiKey: boolean; cacheSize: number } {
    const totalCacheSize = 
      this.listingsCache.size() + 
      this.quotesCache.size() + 
      this.globalCache.size() + 
      this.mapCache.size();
    
    return {
      connected: !!this.getApiKey(),
      hasApiKey: !!this.getApiKey(),
      cacheSize: totalCacheSize,
    };
  }

  clearCache(): void {
    this.listingsCache.clear();
    this.quotesCache.clear();
    this.globalCache.clear();
    this.mapCache.clear();
  }
}

export const coinmarketcap = new CoinMarketCapConnector();
