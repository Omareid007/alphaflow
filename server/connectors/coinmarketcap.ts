import { ApiCache } from "../lib/api-cache";
import { connectorFetch, buildCacheKey } from "../lib/connectorClient";
import { log } from "../utils/logger";

const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";
const PROVIDER = "coinmarketcap";

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

  private getApiKey(): string | undefined {
    return process.env.COINMARKETCAP_API_KEY;
  }

  private getAuthHeaders(): Record<string, string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("COINMARKETCAP_API_KEY is not configured");
    }
    return {
      "X-CMC_PRO_API_KEY": apiKey,
      Accept: "application/json",
    };
  }

  async getLatestListings(
    start = 1,
    limit = 100,
    sort = "market_cap",
    sortDir: "asc" | "desc" = "desc"
  ): Promise<CMCCryptocurrency[]> {
    const l1CacheKey = `listings_${start}_${limit}_${sort}_${sortDir}`;
    
    const l1Cached = this.listingsCache.get(l1CacheKey);
    if (l1Cached?.isFresh) {
      log.debug("CMC", `L1 cache HIT for ${l1CacheKey}`);
      return l1Cached.data;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      const stale = this.listingsCache.getStale(l1CacheKey);
      if (stale) {
        log.debug("CMC", `No API key, serving stale L1 data for ${l1CacheKey}`);
        return stale;
      }
      throw new Error("COINMARKETCAP_API_KEY is not configured");
    }

    const url = `${CMC_BASE_URL}/v1/cryptocurrency/listings/latest?start=${start}&limit=${limit}&sort=${sort}&sort_dir=${sortDir}&convert=USD`;
    const cacheKey = buildCacheKey(PROVIDER, "listings", start, limit, sort, sortDir);

    const result = await connectorFetch<CMCListingsResponse>(url, {
      provider: PROVIDER,
      endpoint: "listings/latest",
      cacheKey,
      headers: this.getAuthHeaders(),
    });

    if (result.data.status.error_code !== 0) {
      throw new Error(result.data.status.error_message || "CoinMarketCap API error");
    }

    const data = result.data.data;
    this.listingsCache.set(l1CacheKey, data);
    return data;
  }

  async getQuotes(ids: number[]): Promise<{ [id: string]: CMCCryptocurrency }> {
    const idsParam = ids.join(",");
    const l1CacheKey = `quotes_${idsParam}`;
    
    const l1Cached = this.quotesCache.get(l1CacheKey);
    if (l1Cached?.isFresh) {
      log.debug("CMC", `L1 cache HIT for ${l1CacheKey}`);
      return l1Cached.data;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      const stale = this.quotesCache.getStale(l1CacheKey);
      if (stale) {
        log.debug("CMC", `No API key, serving stale L1 data for ${l1CacheKey}`);
        return stale;
      }
      throw new Error("COINMARKETCAP_API_KEY is not configured");
    }

    const url = `${CMC_BASE_URL}/v1/cryptocurrency/quotes/latest?id=${idsParam}&convert=USD`;
    const cacheKey = buildCacheKey(PROVIDER, "quotes", idsParam);

    const result = await connectorFetch<CMCQuotesResponse>(url, {
      provider: PROVIDER,
      endpoint: "quotes/latest",
      cacheKey,
      headers: this.getAuthHeaders(),
    });

    if (result.data.status.error_code !== 0) {
      throw new Error(result.data.status.error_message || "CoinMarketCap API error");
    }

    const data = result.data.data;
    this.quotesCache.set(l1CacheKey, data);
    return data;
  }

  async getQuotesBySymbols(symbols: string[]): Promise<{ [id: string]: CMCCryptocurrency }> {
    const symbolsParam = symbols.join(",");
    const l1CacheKey = `quotes_symbols_${symbolsParam}`;
    
    const l1Cached = this.quotesCache.get(l1CacheKey);
    if (l1Cached?.isFresh) {
      log.debug("CMC", `L1 cache HIT for ${l1CacheKey}`);
      return l1Cached.data;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      const stale = this.quotesCache.getStale(l1CacheKey);
      if (stale) {
        log.debug("CMC", `No API key, serving stale L1 data for ${l1CacheKey}`);
        return stale;
      }
      throw new Error("COINMARKETCAP_API_KEY is not configured");
    }

    const url = `${CMC_BASE_URL}/v1/cryptocurrency/quotes/latest?symbol=${symbolsParam}&convert=USD`;
    const cacheKey = buildCacheKey(PROVIDER, "quotes_symbols", symbolsParam);

    const result = await connectorFetch<CMCQuotesResponse>(url, {
      provider: PROVIDER,
      endpoint: "quotes/latest/symbols",
      cacheKey,
      headers: this.getAuthHeaders(),
    });

    if (result.data.status.error_code !== 0) {
      throw new Error(result.data.status.error_message || "CoinMarketCap API error");
    }

    const data = result.data.data;
    this.quotesCache.set(l1CacheKey, data);
    return data;
  }

  async getGlobalMetrics(): Promise<CMCGlobalMetrics["data"]> {
    const l1CacheKey = "global_metrics";
    
    const l1Cached = this.globalCache.get(l1CacheKey);
    if (l1Cached?.isFresh) {
      log.debug("CMC", `L1 cache HIT for ${l1CacheKey}`);
      return l1Cached.data;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      const stale = this.globalCache.getStale(l1CacheKey);
      if (stale) {
        log.debug("CMC", `No API key, serving stale L1 data for ${l1CacheKey}`);
        return stale;
      }
      throw new Error("COINMARKETCAP_API_KEY is not configured");
    }

    const url = `${CMC_BASE_URL}/v1/global-metrics/quotes/latest?convert=USD`;
    const cacheKey = buildCacheKey(PROVIDER, "global_metrics");

    const result = await connectorFetch<CMCGlobalMetrics>(url, {
      provider: PROVIDER,
      endpoint: "global-metrics/quotes/latest",
      cacheKey,
      headers: this.getAuthHeaders(),
    });

    if (result.data.status.error_code !== 0) {
      throw new Error(result.data.status.error_message || "CoinMarketCap API error");
    }

    const data = result.data.data;
    this.globalCache.set(l1CacheKey, data);
    return data;
  }

  async getCryptoMap(
    start = 1,
    limit = 5000,
    sort = "cmc_rank"
  ): Promise<CMCMapItem[]> {
    const l1CacheKey = `map_${start}_${limit}_${sort}`;
    
    const l1Cached = this.mapCache.get(l1CacheKey);
    if (l1Cached?.isFresh) {
      log.debug("CMC", `L1 cache HIT for ${l1CacheKey}`);
      return l1Cached.data;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      const stale = this.mapCache.getStale(l1CacheKey);
      if (stale) {
        log.debug("CMC", `No API key, serving stale L1 data for ${l1CacheKey}`);
        return stale;
      }
      throw new Error("COINMARKETCAP_API_KEY is not configured");
    }

    const url = `${CMC_BASE_URL}/v1/cryptocurrency/map?start=${start}&limit=${limit}&sort=${sort}`;
    const cacheKey = buildCacheKey(PROVIDER, "map", start, limit, sort);

    const result = await connectorFetch<CMCMapResponse>(url, {
      provider: PROVIDER,
      endpoint: "cryptocurrency/map",
      cacheKey,
      headers: this.getAuthHeaders(),
    });

    if (result.data.status.error_code !== 0) {
      throw new Error(result.data.status.error_message || "CoinMarketCap API error");
    }

    const data = result.data.data;
    this.mapCache.set(l1CacheKey, data);
    return data;
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
