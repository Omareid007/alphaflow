import { ApiCache } from "../lib/api-cache";

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

export interface CoinPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  ath: number;
  ath_change_percentage: number;
  last_updated: string;
  image: string;
}

export interface SimplePriceData {
  [coinId: string]: {
    usd: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
    usd_24h_change?: number;
    last_updated_at?: number;
  };
}

export interface MarketChartData {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export interface TrendingCoin {
  item: {
    id: string;
    coin_id: number;
    name: string;
    symbol: string;
    market_cap_rank: number;
    thumb: string;
    small: string;
    large: string;
    slug: string;
    price_btc: number;
    score: number;
  };
}

export interface GlobalMarketData {
  data: {
    active_cryptocurrencies: number;
    upcoming_icos: number;
    ongoing_icos: number;
    ended_icos: number;
    markets: number;
    total_market_cap: { [key: string]: number };
    total_volume: { [key: string]: number };
    market_cap_percentage: { [key: string]: number };
    market_cap_change_percentage_24h_usd: number;
    updated_at: number;
  };
}

type CoinListItem = { id: string; symbol: string; name: string };
type SearchResult = { coins: { id: string; name: string; symbol: string; market_cap_rank: number; thumb: string }[] };
type TrendingResult = { coins: TrendingCoin[] };

class CoinGeckoConnector {
  private marketsCache = new ApiCache<CoinPrice[]>({
    freshDuration: 60 * 1000,
    staleDuration: 30 * 60 * 1000,
  });
  private priceCache = new ApiCache<SimplePriceData>({
    freshDuration: 60 * 1000,
    staleDuration: 30 * 60 * 1000,
  });
  private chartCache = new ApiCache<MarketChartData>({
    freshDuration: 5 * 60 * 1000,
    staleDuration: 60 * 60 * 1000,
  });
  private trendingCache = new ApiCache<TrendingResult>({
    freshDuration: 10 * 60 * 1000,
    staleDuration: 60 * 60 * 1000,
  });
  private globalCache = new ApiCache<GlobalMarketData>({
    freshDuration: 5 * 60 * 1000,
    staleDuration: 30 * 60 * 1000,
  });
  private coinListCache = new ApiCache<CoinListItem[]>({
    freshDuration: 60 * 60 * 1000,
    staleDuration: 24 * 60 * 60 * 1000,
  });
  private searchCache = new ApiCache<SearchResult>({
    freshDuration: 15 * 60 * 1000,
    staleDuration: 60 * 60 * 1000,
  });
  
  private lastRequestTime = 0;
  private minRequestInterval = 2100;
  private rateLimitedUntil = 0;

  private getApiKey(): string | undefined {
    return process.env.COINGECKO_API_KEY;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    
    if (now < this.rateLimitedUntil) {
      const waitTime = this.rateLimitedUntil - now;
      console.log(`[CoinGecko] Rate limited, waiting ${waitTime}ms...`);
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

  private async fetchWithRetry<T>(
    url: string,
    cacheKey: string,
    cache: ApiCache<T>,
    retries = 3
  ): Promise<T> {
    const cached = cache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    if (cached && !cached.isFresh) {
      if (!this.pendingRefreshes.has(cacheKey)) {
        this.pendingRefreshes.add(cacheKey);
        this.backgroundRefresh(url, cacheKey, cache, retries);
      }
      console.log(`[CoinGecko] Serving stale data for ${cacheKey}, refreshing in background`);
      return cached.data;
    }

    return this.doFetch(url, cacheKey, cache, retries);
  }

  private async backgroundRefresh<T>(
    url: string,
    cacheKey: string,
    cache: ApiCache<T>,
    retries: number
  ): Promise<void> {
    try {
      await this.doFetch(url, cacheKey, cache, retries);
    } catch (error) {
      console.log(`[CoinGecko] Background refresh failed for ${cacheKey}`);
    } finally {
      this.pendingRefreshes.delete(cacheKey);
    }
  }

  private async doFetch<T>(
    url: string,
    cacheKey: string,
    cache: ApiCache<T>,
    retries: number
  ): Promise<T> {
    await this.throttle();

    const apiKey = this.getApiKey();
    const separator = url.includes("?") ? "&" : "?";
    const fullUrl = apiKey
      ? `${url}${separator}x_cg_demo_api_key=${apiKey}`
      : url;

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(fullUrl, {
          headers: {
            Accept: "application/json",
          },
        });

        if (response.status === 429) {
          this.rateLimitedUntil = Date.now() + Math.pow(2, i + 1) * 1000;
          
          const stale = cache.getStale(cacheKey);
          if (stale) {
            console.log(`[CoinGecko] Rate limited, serving stale data for ${cacheKey}`);
            return stale;
          }
          
          const waitTime = Math.pow(2, i) * 1000;
          console.log(`[CoinGecko] Rate limited, waiting ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json() as T;
        cache.set(cacheKey, data);
        return data;
      } catch (error) {
        const stale = cache.getStale(cacheKey);
        if (stale && i === retries - 1) {
          console.log(`[CoinGecko] Error fetching, serving stale data for ${cacheKey}`);
          return stale;
        }
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    throw new Error("Failed to fetch from CoinGecko after retries");
  }

  async getMarkets(
    vsCurrency = "usd",
    perPage = 20,
    page = 1,
    order = "market_cap_desc"
  ): Promise<CoinPrice[]> {
    const cacheKey = `markets_${vsCurrency}_${perPage}_${page}_${order}`;
    const url = `${COINGECKO_BASE_URL}/coins/markets?vs_currency=${vsCurrency}&order=${order}&per_page=${perPage}&page=${page}&sparkline=false`;
    return this.fetchWithRetry<CoinPrice[]>(url, cacheKey, this.marketsCache);
  }

  async getSimplePrice(
    coinIds: string[],
    vsCurrencies = "usd",
    includeMarketCap = true,
    include24hVol = true,
    include24hChange = true
  ): Promise<SimplePriceData> {
    const ids = coinIds.join(",");
    const cacheKey = `simple_${ids}_${vsCurrencies}`;
    const url = `${COINGECKO_BASE_URL}/simple/price?ids=${ids}&vs_currencies=${vsCurrencies}&include_market_cap=${includeMarketCap}&include_24hr_vol=${include24hVol}&include_24hr_change=${include24hChange}&include_last_updated_at=true`;
    return this.fetchWithRetry<SimplePriceData>(url, cacheKey, this.priceCache);
  }

  async getMarketChart(
    coinId: string,
    vsCurrency = "usd",
    days: number | string = 7
  ): Promise<MarketChartData> {
    const cacheKey = `chart_${coinId}_${vsCurrency}_${days}`;
    const url = `${COINGECKO_BASE_URL}/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}`;
    return this.fetchWithRetry<MarketChartData>(url, cacheKey, this.chartCache);
  }

  async getTrending(): Promise<TrendingResult> {
    const cacheKey = "trending";
    const url = `${COINGECKO_BASE_URL}/search/trending`;
    return this.fetchWithRetry<TrendingResult>(url, cacheKey, this.trendingCache);
  }

  async getGlobalData(): Promise<GlobalMarketData> {
    const cacheKey = "global";
    const url = `${COINGECKO_BASE_URL}/global`;
    return this.fetchWithRetry<GlobalMarketData>(url, cacheKey, this.globalCache);
  }

  async getCoinList(): Promise<CoinListItem[]> {
    const cacheKey = "coinlist";
    const url = `${COINGECKO_BASE_URL}/coins/list`;
    return this.fetchWithRetry<CoinListItem[]>(url, cacheKey, this.coinListCache);
  }

  async searchCoins(query: string): Promise<SearchResult> {
    const cacheKey = `search_${query}`;
    const url = `${COINGECKO_BASE_URL}/search?query=${encodeURIComponent(query)}`;
    return this.fetchWithRetry<SearchResult>(url, cacheKey, this.searchCache);
  }

  getConnectionStatus(): { connected: boolean; hasApiKey: boolean; cacheSize: number } {
    const totalCacheSize = 
      this.marketsCache.size() + 
      this.priceCache.size() + 
      this.chartCache.size() + 
      this.trendingCache.size() + 
      this.globalCache.size() + 
      this.coinListCache.size() + 
      this.searchCache.size();
    
    return {
      connected: true,
      hasApiKey: !!this.getApiKey(),
      cacheSize: totalCacheSize,
    };
  }

  clearCache(): void {
    this.marketsCache.clear();
    this.priceCache.clear();
    this.chartCache.clear();
    this.trendingCache.clear();
    this.globalCache.clear();
    this.coinListCache.clear();
    this.searchCache.clear();
  }
}

export const coingecko = new CoinGeckoConnector();
