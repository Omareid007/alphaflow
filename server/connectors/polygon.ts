import { ApiCache } from "../lib/api-cache";
import { connectorFetch, buildCacheKey } from "../lib/connectorClient";
import { log } from "../utils/logger";

const POLYGON_BASE_URL = "https://api.polygon.io";
const PROVIDER = "polygon";

export interface PolygonQuote {
  ticker: string;
  c: number;
  h: number;
  l: number;
  o: number;
  v: number;
  vw: number;
  t: number;
}

export interface PolygonAggregateBar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw: number;
  t: number;
  n: number;
}

export interface PolygonAggregatesResponse {
  ticker: string;
  status: string;
  adjusted: boolean;
  queryCount: number;
  resultsCount: number;
  results: PolygonAggregateBar[];
}

export interface PolygonTickerDetails {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange: string;
  type: string;
  active: boolean;
  currency_name: string;
  cik?: string;
  composite_figi?: string;
  share_class_figi?: string;
  market_cap?: number;
  phone_number?: string;
  address?: {
    address1: string;
    city: string;
    state: string;
    postal_code: string;
  };
  description?: string;
  sic_code?: string;
  sic_description?: string;
  ticker_root?: string;
  homepage_url?: string;
  total_employees?: number;
  list_date?: string;
  branding?: {
    logo_url?: string;
    icon_url?: string;
  };
  share_class_shares_outstanding?: number;
  weighted_shares_outstanding?: number;
}

export interface PolygonTrade {
  conditions: number[];
  exchange: number;
  id: string;
  participant_timestamp: number;
  price: number;
  sequence_number: number;
  sip_timestamp: number;
  size: number;
  trf_id: number;
  trf_timestamp: number;
}

export interface PolygonTicker {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange: string;
  type: string;
  active: boolean;
  currency_name: string;
  last_updated_utc: string;
}

export interface PolygonNews {
  id: string;
  publisher: {
    name: string;
    homepage_url: string;
    logo_url: string;
    favicon_url: string;
  };
  title: string;
  author: string;
  published_utc: string;
  article_url: string;
  tickers: string[];
  amp_url?: string;
  image_url?: string;
  description?: string;
  keywords?: string[];
}

class PolygonClient {
  private apiKey: string | null = null;
  private l1Cache: ApiCache<unknown>;

  constructor() {
    this.apiKey = process.env.POLYGON_API_KEY || null;
    this.l1Cache = new ApiCache({ freshDuration: 60000, staleDuration: 300000 });
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getConnectionStatus(): { configured: boolean; provider: string } {
    return {
      configured: this.isConfigured(),
      provider: PROVIDER,
    };
  }

  private async fetchWithBudget<T>(
    url: string,
    endpoint: string,
    cacheKey: string
  ): Promise<T | null> {
    if (!this.apiKey) {
      log.warn("Polygon", "API key not configured");
      return null;
    }

    const l1Cached = this.l1Cache.get(cacheKey);
    if (l1Cached) {
      log.debug("Polygon", `L1 cache hit for ${cacheKey}`);
      return l1Cached.data as T;
    }

    try {
      const fullUrl = url.includes("?")
        ? `${url}&apiKey=${this.apiKey}`
        : `${url}?apiKey=${this.apiKey}`;

      const result = await connectorFetch<T>(fullUrl, {
        provider: PROVIDER,
        endpoint,
        cacheKey,
        headers: { Accept: "application/json" },
      });

      this.l1Cache.set(cacheKey, result.data);

      return result.data;
    } catch (error) {
      log.error("Polygon", `Fetch error for ${endpoint}: ${error}`);
      return null;
    }
  }

  async getQuote(symbol: string): Promise<PolygonQuote | null> {
    const endpoint = "/v2/aggs/ticker/prev";
    const cacheKey = buildCacheKey(PROVIDER, "quote", symbol);
    const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/prev`;

    const response = await this.fetchWithBudget<{ results: PolygonAggregateBar[] }>(
      url,
      endpoint,
      cacheKey
    );

    if (!response?.results?.[0]) return null;

    const bar = response.results[0];
    return {
      ticker: symbol,
      c: bar.c,
      h: bar.h,
      l: bar.l,
      o: bar.o,
      v: bar.v,
      vw: bar.vw,
      t: bar.t,
    };
  }

  async getAggregates(
    symbol: string,
    multiplier: number,
    timespan: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year",
    from: string,
    to: string
  ): Promise<PolygonAggregatesResponse | null> {
    const endpoint = "/v2/aggs/ticker/range";
    const cacheKey = buildCacheKey(PROVIDER, "aggs", symbol, multiplier, timespan, from, to);
    const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc`;

    return this.fetchWithBudget<PolygonAggregatesResponse>(url, endpoint, cacheKey);
  }

  async getTickerDetails(symbol: string): Promise<PolygonTickerDetails | null> {
    const endpoint = "/v3/reference/tickers";
    const cacheKey = buildCacheKey(PROVIDER, "details", symbol);
    const url = `${POLYGON_BASE_URL}/v3/reference/tickers/${symbol}`;

    const response = await this.fetchWithBudget<{ results: PolygonTickerDetails }>(
      url,
      endpoint,
      cacheKey
    );
    return response?.results || null;
  }

  async searchTickers(query: string, type?: string, market?: string): Promise<PolygonTicker[]> {
    const endpoint = "/v3/reference/tickers/search";
    const cacheKey = buildCacheKey(PROVIDER, "search", query, type, market);
    let url = `${POLYGON_BASE_URL}/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&limit=20`;
    if (type) url += `&type=${type}`;
    if (market) url += `&market=${market}`;

    const response = await this.fetchWithBudget<{ results: PolygonTicker[] }>(
      url,
      endpoint,
      cacheKey
    );
    return response?.results || [];
  }

  async getNews(ticker?: string, limit = 10): Promise<PolygonNews[]> {
    const endpoint = "/v2/reference/news";
    const cacheKey = buildCacheKey(PROVIDER, "news", ticker || "all", limit);
    let url = `${POLYGON_BASE_URL}/v2/reference/news?limit=${limit}`;
    if (ticker) url += `&ticker=${ticker}`;

    const response = await this.fetchWithBudget<{ results: PolygonNews[] }>(
      url,
      endpoint,
      cacheKey
    );
    return response?.results || [];
  }

  async getLastTrade(symbol: string): Promise<PolygonTrade | null> {
    const endpoint = "/v2/last/trade";
    const cacheKey = buildCacheKey(PROVIDER, "lasttrade", symbol);
    const url = `${POLYGON_BASE_URL}/v2/last/trade/${symbol}`;

    const response = await this.fetchWithBudget<{ results: PolygonTrade }>(
      url,
      endpoint,
      cacheKey
    );
    return response?.results || null;
  }

  async getMarketStatus(): Promise<{ market: string; serverTime: string; exchanges: Record<string, string> } | null> {
    const endpoint = "/v1/marketstatus/now";
    const cacheKey = buildCacheKey(PROVIDER, "marketstatus");
    const url = `${POLYGON_BASE_URL}/v1/marketstatus/now`;

    return this.fetchWithBudget(url, endpoint, cacheKey);
  }

  async getDailyOpenClose(symbol: string, date: string): Promise<{
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    afterHours: number;
    preMarket: number;
  } | null> {
    const endpoint = "/v1/open-close";
    const cacheKey = buildCacheKey(PROVIDER, "openclose", symbol, date);
    const url = `${POLYGON_BASE_URL}/v1/open-close/${symbol}/${date}`;

    return this.fetchWithBudget(url, endpoint, cacheKey);
  }
}

export const polygon = new PolygonClient();
