import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";

const POLYGON_BASE_URL = "https://api.polygon.io";

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
  private cache: ApiCache<unknown>;
  private rateLimitDelay = 12000;
  private lastRequestTime = 0;

  constructor() {
    this.apiKey = process.env.POLYGON_API_KEY || null;
    this.cache = new ApiCache({ freshDuration: 60000, staleDuration: 300000 });
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private async rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();
    return fetch(url);
  }

  private async fetchWithRetry<T>(url: string, cacheKey?: string): Promise<T | null> {
    if (!this.apiKey) {
      log.warn("Polygon", "API key not configured");
      return null;
    }

    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached.data as T;
    }

    try {
      const fullUrl = url.includes("?") 
        ? `${url}&apiKey=${this.apiKey}`
        : `${url}?apiKey=${this.apiKey}`;
      
      const response = await this.rateLimitedFetch(fullUrl);
      
      if (response.status === 429) {
        log.warn("Polygon", "Rate limited, backing off");
        await new Promise(resolve => setTimeout(resolve, 60000));
        return null;
      }
      
      if (!response.ok) {
        log.error("Polygon", `HTTP error: ${response.status}`);
        return null;
      }

      const data = await response.json() as T;
      
      if (cacheKey) {
        this.cache.set(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      log.error("Polygon", `Fetch error: ${error}`);
      return null;
    }
  }

  async getQuote(symbol: string): Promise<PolygonQuote | null> {
    const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/prev`;
    const response = await this.fetchWithRetry<{ results: PolygonAggregateBar[] }>(
      url, 
      `polygon:quote:${symbol}`
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
    const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc`;
    return this.fetchWithRetry<PolygonAggregatesResponse>(
      url,
      `polygon:aggs:${symbol}:${multiplier}:${timespan}:${from}:${to}`
    );
  }

  async getTickerDetails(symbol: string): Promise<PolygonTickerDetails | null> {
    const url = `${POLYGON_BASE_URL}/v3/reference/tickers/${symbol}`;
    const response = await this.fetchWithRetry<{ results: PolygonTickerDetails }>(
      url,
      `polygon:details:${symbol}`
    );
    return response?.results || null;
  }

  async searchTickers(query: string, type?: string, market?: string): Promise<PolygonTicker[]> {
    let url = `${POLYGON_BASE_URL}/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&limit=20`;
    if (type) url += `&type=${type}`;
    if (market) url += `&market=${market}`;
    
    const response = await this.fetchWithRetry<{ results: PolygonTicker[] }>(
      url,
      `polygon:search:${query}:${type}:${market}`
    );
    return response?.results || [];
  }

  async getNews(ticker?: string, limit = 10): Promise<PolygonNews[]> {
    let url = `${POLYGON_BASE_URL}/v2/reference/news?limit=${limit}`;
    if (ticker) url += `&ticker=${ticker}`;
    
    const response = await this.fetchWithRetry<{ results: PolygonNews[] }>(
      url,
      `polygon:news:${ticker || 'all'}:${limit}`
    );
    return response?.results || [];
  }

  async getLastTrade(symbol: string): Promise<PolygonTrade | null> {
    const url = `${POLYGON_BASE_URL}/v2/last/trade/${symbol}`;
    const response = await this.fetchWithRetry<{ results: PolygonTrade }>(
      url,
      `polygon:lasttrade:${symbol}`
    );
    return response?.results || null;
  }

  async getMarketStatus(): Promise<{ market: string; serverTime: string; exchanges: Record<string, string> } | null> {
    const url = `${POLYGON_BASE_URL}/v1/marketstatus/now`;
    return this.fetchWithRetry(url, "polygon:marketstatus");
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
    const url = `${POLYGON_BASE_URL}/v1/open-close/${symbol}/${date}`;
    return this.fetchWithRetry(url, `polygon:openclose:${symbol}:${date}`);
  }
}

export const polygon = new PolygonClient();
