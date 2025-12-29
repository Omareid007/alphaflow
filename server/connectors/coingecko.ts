import { ApiCache } from "../lib/api-cache";
import { connectorFetch, buildCacheKey } from "../lib/connectorClient";
import { log } from "../utils/logger";

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

export interface OHLCData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

type CoinListItem = { id: string; symbol: string; name: string };
type SearchResult = {
  coins: {
    id: string;
    name: string;
    symbol: string;
    market_cap_rank: number;
    thumb: string;
  }[];
};
type TrendingResult = { coins: TrendingCoin[] };

type OHLCRaw = [number, number, number, number, number][];

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
  private ohlcCache = new ApiCache<OHLCRaw>({
    freshDuration: 5 * 60 * 1000,
    staleDuration: 60 * 60 * 1000,
  });

  private pendingRefreshes = new Set<string>();

  private getApiKey(): string | undefined {
    return process.env.COINGECKO_API_KEY;
  }

  private async fetchWithL1Cache<T>(
    url: string,
    endpoint: string,
    cacheKey: string,
    cache: ApiCache<T>
  ): Promise<T> {
    const cached = cache.get(cacheKey);
    if (cached?.isFresh) {
      log.debug("CoinGecko", `L1 cache HIT (fresh) for ${cacheKey}`);
      return cached.data;
    }

    if (cached && !cached.isFresh) {
      if (!this.pendingRefreshes.has(cacheKey)) {
        this.pendingRefreshes.add(cacheKey);
        this.backgroundRefresh(url, endpoint, cacheKey, cache);
      }
      log.debug(
        "CoinGecko",
        `Serving stale L1 data for ${cacheKey}, refreshing in background`
      );
      return cached.data;
    }

    return this.doFetch(url, endpoint, cacheKey, cache);
  }

  private async backgroundRefresh<T>(
    url: string,
    endpoint: string,
    cacheKey: string,
    cache: ApiCache<T>
  ): Promise<void> {
    try {
      await this.doFetch(url, endpoint, cacheKey, cache);
    } catch (error) {
      log.warn("CoinGecko", `Background refresh failed for ${cacheKey}`);
    } finally {
      this.pendingRefreshes.delete(cacheKey);
    }
  }

  private async doFetch<T>(
    url: string,
    endpoint: string,
    cacheKey: string,
    cache: ApiCache<T>
  ): Promise<T> {
    const apiKey = this.getApiKey();
    const separator = url.includes("?") ? "&" : "?";
    const fullUrl = apiKey
      ? `${url}${separator}x_cg_demo_api_key=${apiKey}`
      : url;

    const externalCacheKey = buildCacheKey("coingecko", endpoint, cacheKey);

    try {
      const result = await connectorFetch<T>(fullUrl, {
        provider: "coingecko",
        endpoint: endpoint,
        cacheKey: externalCacheKey,
        headers: { Accept: "application/json" },
      });

      cache.set(cacheKey, result.data);
      return result.data;
    } catch (error) {
      const stale = cache.getStale(cacheKey);
      if (stale) {
        log.debug(
          "CoinGecko",
          `Error fetching, serving stale L1 data for ${cacheKey}`
        );
        return stale;
      }
      throw error;
    }
  }

  async getMarkets(
    vsCurrency = "usd",
    perPage = 20,
    page = 1,
    order = "market_cap_desc"
  ): Promise<CoinPrice[]> {
    const cacheKey = buildCacheKey(
      "coingecko",
      "markets",
      vsCurrency,
      perPage,
      page,
      order
    );
    const url = `${COINGECKO_BASE_URL}/coins/markets?vs_currency=${vsCurrency}&order=${order}&per_page=${perPage}&page=${page}&sparkline=false`;
    return this.fetchWithL1Cache<CoinPrice[]>(
      url,
      "/coins/markets",
      cacheKey,
      this.marketsCache
    );
  }

  async getSimplePrice(
    coinIds: string[],
    vsCurrencies = "usd",
    includeMarketCap = true,
    include24hVol = true,
    include24hChange = true
  ): Promise<SimplePriceData> {
    const ids = coinIds.join(",");
    const cacheKey = buildCacheKey("coingecko", "simple", ids, vsCurrencies);
    const url = `${COINGECKO_BASE_URL}/simple/price?ids=${ids}&vs_currencies=${vsCurrencies}&include_market_cap=${includeMarketCap}&include_24hr_vol=${include24hVol}&include_24hr_change=${include24hChange}&include_last_updated_at=true`;
    return this.fetchWithL1Cache<SimplePriceData>(
      url,
      "/simple/price",
      cacheKey,
      this.priceCache
    );
  }

  async getMarketChart(
    coinId: string,
    vsCurrency = "usd",
    days: number | string = 7
  ): Promise<MarketChartData> {
    const cacheKey = buildCacheKey(
      "coingecko",
      "chart",
      coinId,
      vsCurrency,
      days
    );
    const url = `${COINGECKO_BASE_URL}/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}`;
    return this.fetchWithL1Cache<MarketChartData>(
      url,
      `/coins/${coinId}/market_chart`,
      cacheKey,
      this.chartCache
    );
  }

  async getTrending(): Promise<TrendingResult> {
    const cacheKey = buildCacheKey("coingecko", "trending");
    const url = `${COINGECKO_BASE_URL}/search/trending`;
    return this.fetchWithL1Cache<TrendingResult>(
      url,
      "/search/trending",
      cacheKey,
      this.trendingCache
    );
  }

  async getGlobalData(): Promise<GlobalMarketData> {
    const cacheKey = buildCacheKey("coingecko", "global");
    const url = `${COINGECKO_BASE_URL}/global`;
    return this.fetchWithL1Cache<GlobalMarketData>(
      url,
      "/global",
      cacheKey,
      this.globalCache
    );
  }

  async getCoinList(): Promise<CoinListItem[]> {
    const cacheKey = buildCacheKey("coingecko", "coinlist");
    const url = `${COINGECKO_BASE_URL}/coins/list`;
    return this.fetchWithL1Cache<CoinListItem[]>(
      url,
      "/coins/list",
      cacheKey,
      this.coinListCache
    );
  }

  async searchCoins(query: string): Promise<SearchResult> {
    const cacheKey = buildCacheKey("coingecko", "search", query);
    const url = `${COINGECKO_BASE_URL}/search?query=${encodeURIComponent(query)}`;
    return this.fetchWithL1Cache<SearchResult>(
      url,
      "/search",
      cacheKey,
      this.searchCache
    );
  }

  async getOHLC(
    coinId: string,
    vsCurrency = "usd",
    days: 1 | 7 | 14 | 30 | 90 | 180 | 365 | "max" = 7
  ): Promise<OHLCData[]> {
    const cacheKey = buildCacheKey(
      "coingecko",
      "ohlc",
      coinId,
      vsCurrency,
      days
    );
    const url = `${COINGECKO_BASE_URL}/coins/${coinId}/ohlc?vs_currency=${vsCurrency}&days=${days}`;
    const rawData = await this.fetchWithL1Cache<OHLCRaw>(
      url,
      `/coins/${coinId}/ohlc`,
      cacheKey,
      this.ohlcCache
    );
    return rawData.map(([timestamp, open, high, low, close]) => ({
      timestamp,
      open,
      high,
      low,
      close,
    }));
  }

  async getOHLCWithIndicators(
    coinId: string,
    days: 1 | 7 | 14 | 30 | 90 | 180 | 365 | "max" = 30
  ): Promise<{
    candles: OHLCData[];
    latestPrice: number;
    priceChange24h: number;
    volatility: number;
    trend: "bullish" | "bearish" | "neutral";
    support: number;
    resistance: number;
  }> {
    const ohlc = await this.getOHLC(coinId, "usd", days);
    if (ohlc.length === 0) {
      return {
        candles: [],
        latestPrice: 0,
        priceChange24h: 0,
        volatility: 0,
        trend: "neutral",
        support: 0,
        resistance: 0,
      };
    }

    const latestCandle = ohlc[ohlc.length - 1];
    const latestPrice = latestCandle.close;
    const firstCandle = ohlc[0];
    const priceChange24h =
      ((latestPrice - firstCandle.close) / firstCandle.close) * 100;

    const highs = ohlc.map((c) => c.high);
    const lows = ohlc.map((c) => c.low);
    const closes = ohlc.map((c) => c.close);

    const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;
    const variance =
      closes.reduce((sum, c) => sum + Math.pow(c - avgClose, 2), 0) /
      closes.length;
    const volatility = (Math.sqrt(variance) / avgClose) * 100;

    const resistance = Math.max(...highs);
    const support = Math.min(...lows);

    const recentCandles = ohlc.slice(-5);
    const bullishCount = recentCandles.filter((c) => c.close > c.open).length;
    const trend =
      bullishCount >= 4 ? "bullish" : bullishCount <= 1 ? "bearish" : "neutral";

    return {
      candles: ohlc,
      latestPrice,
      priceChange24h,
      volatility,
      trend,
      support,
      resistance,
    };
  }

  getConnectionStatus(): {
    connected: boolean;
    hasApiKey: boolean;
    cacheSize: number;
  } {
    const totalCacheSize =
      this.marketsCache.size() +
      this.priceCache.size() +
      this.chartCache.size() +
      this.trendingCache.size() +
      this.globalCache.size() +
      this.coinListCache.size() +
      this.searchCache.size() +
      this.ohlcCache.size();

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
    this.ohlcCache.clear();
  }
}

export const coingecko = new CoinGeckoConnector();
