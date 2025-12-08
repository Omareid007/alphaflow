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

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class CoinGeckoConnector {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cacheDuration = 60 * 1000;
  private lastRequestTime = 0;
  private minRequestInterval = 2100;

  private getApiKey(): string | undefined {
    return process.env.COINGECKO_API_KEY;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (entry && Date.now() - entry.timestamp < this.cacheDuration) {
      return entry.data;
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private async fetchWithRetry<T>(
    url: string,
    retries = 3
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
          const waitTime = Math.pow(2, i) * 1000;
          console.log(`CoinGecko rate limited, waiting ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        return response.json() as Promise<T>;
      } catch (error) {
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
    const cached = this.getCached<CoinPrice[]>(cacheKey);
    if (cached) return cached;

    const url = `${COINGECKO_BASE_URL}/coins/markets?vs_currency=${vsCurrency}&order=${order}&per_page=${perPage}&page=${page}&sparkline=false`;
    const data = await this.fetchWithRetry<CoinPrice[]>(url);
    this.setCache(cacheKey, data);
    return data;
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
    const cached = this.getCached<SimplePriceData>(cacheKey);
    if (cached) return cached;

    const url = `${COINGECKO_BASE_URL}/simple/price?ids=${ids}&vs_currencies=${vsCurrencies}&include_market_cap=${includeMarketCap}&include_24hr_vol=${include24hVol}&include_24hr_change=${include24hChange}&include_last_updated_at=true`;
    const data = await this.fetchWithRetry<SimplePriceData>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getMarketChart(
    coinId: string,
    vsCurrency = "usd",
    days: number | string = 7
  ): Promise<MarketChartData> {
    const cacheKey = `chart_${coinId}_${vsCurrency}_${days}`;
    const cached = this.getCached<MarketChartData>(cacheKey);
    if (cached) return cached;

    const url = `${COINGECKO_BASE_URL}/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}`;
    const data = await this.fetchWithRetry<MarketChartData>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getTrending(): Promise<{ coins: TrendingCoin[] }> {
    const cacheKey = "trending";
    const cached = this.getCached<{ coins: TrendingCoin[] }>(cacheKey);
    if (cached) return cached;

    const url = `${COINGECKO_BASE_URL}/search/trending`;
    const data = await this.fetchWithRetry<{ coins: TrendingCoin[] }>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getGlobalData(): Promise<GlobalMarketData> {
    const cacheKey = "global";
    const cached = this.getCached<GlobalMarketData>(cacheKey);
    if (cached) return cached;

    const url = `${COINGECKO_BASE_URL}/global`;
    const data = await this.fetchWithRetry<GlobalMarketData>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getCoinList(): Promise<{ id: string; symbol: string; name: string }[]> {
    const cacheKey = "coinlist";
    const cached = this.getCached<{ id: string; symbol: string; name: string }[]>(cacheKey);
    if (cached) return cached;

    const url = `${COINGECKO_BASE_URL}/coins/list`;
    const data = await this.fetchWithRetry<{ id: string; symbol: string; name: string }[]>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async searchCoins(query: string): Promise<{
    coins: { id: string; name: string; symbol: string; market_cap_rank: number; thumb: string }[];
  }> {
    const cacheKey = `search_${query}`;
    const cached = this.getCached<{
      coins: { id: string; name: string; symbol: string; market_cap_rank: number; thumb: string }[];
    }>(cacheKey);
    if (cached) return cached;

    const url = `${COINGECKO_BASE_URL}/search?query=${encodeURIComponent(query)}`;
    const data = await this.fetchWithRetry<{
      coins: { id: string; name: string; symbol: string; market_cap_rank: number; thumb: string }[];
    }>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  getConnectionStatus(): { connected: boolean; hasApiKey: boolean; cacheSize: number } {
    return {
      connected: true,
      hasApiKey: !!this.getApiKey(),
      cacheSize: this.cache.size,
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const coingecko = new CoinGeckoConnector();
