import { ApiCache } from "../lib/api-cache";
import { connectorFetch, buildCacheKey } from "../lib/connectorClient";
import { getProviderStatus } from "../lib/callExternal";
import { log } from "../utils/logger";

const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";
const PROVIDER = "twelvedata";

export interface TwelveDataQuote {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  datetime: string;
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  previous_close: string;
  change: string;
  percent_change: string;
  average_volume: string;
  is_market_open: boolean;
  fifty_two_week: {
    low: string;
    high: string;
    low_change: string;
    high_change: string;
    low_change_percent: string;
    high_change_percent: string;
    range: string;
  };
}

export interface TwelveDataTimeSeries {
  meta: {
    symbol: string;
    interval: string;
    currency: string;
    exchange_timezone: string;
    exchange: string;
    mic_code: string;
    type: string;
  };
  values: {
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }[];
  status: string;
}

export interface TwelveDataSymbol {
  symbol: string;
  instrument_name: string;
  exchange: string;
  mic_code: string;
  exchange_timezone: string;
  instrument_type: string;
  country: string;
  currency: string;
}

export interface TwelveDataTechnicalIndicator {
  datetime: string;
  [key: string]: string;
}

export interface TwelveDataEarnings {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  mic_code: string;
  country: string;
  type: string;
  earnings: {
    date: string;
    time: string;
    eps_estimate: number;
    eps_actual: number;
    difference: number;
    surprise_prc: number;
  }[];
}

export interface TwelveDataProfile {
  symbol: string;
  name: string;
  exchange: string;
  mic_code: string;
  sector: string;
  industry: string;
  employees: number;
  website: string;
  description: string;
  type: string;
  CEO: string;
  address: string;
  city: string;
  zip: string;
  state: string;
  country: string;
  phone: string;
}

class TwelveDataClient {
  private apiKey: string | null = null;
  private l1Cache: ApiCache<unknown>;

  constructor() {
    this.apiKey = process.env.TWELVE_DATA_API_KEY || null;
    this.l1Cache = new ApiCache({ freshDuration: 30000, staleDuration: 60000 });
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async getConnectionStatus(): Promise<{
    configured: boolean;
    enabled: boolean;
    budgetStatus: {
      allowed: boolean;
      currentCount: number;
      limit: number;
      windowType: string;
    };
  }> {
    const status = await getProviderStatus(PROVIDER);
    return {
      configured: this.isConfigured(),
      enabled: status.enabled,
      budgetStatus: status.budgetStatus,
    };
  }

  private async fetchFromApi<T>(
    endpoint: string,
    cacheKey: string
  ): Promise<T | null> {
    if (!this.apiKey) {
      log.warn("TwelveData", "API key not configured");
      return null;
    }

    const l1Cached = this.l1Cache.get(cacheKey);
    if (l1Cached) {
      log.debug("TwelveData", `L1 cache hit for ${cacheKey}`);
      return l1Cached.data as T;
    }

    try {
      const url = `${TWELVE_DATA_BASE_URL}${endpoint}${endpoint.includes("?") ? "&" : "?"}apikey=${this.apiKey}`;

      const result = await connectorFetch<T>(url, {
        provider: PROVIDER,
        endpoint,
        cacheKey,
        headers: { Accept: "application/json" },
      });

      const data = result.data;

      if ((data as any).status === "error") {
        log.error("TwelveData", `API error: ${(data as any).message}`);
        return null;
      }

      this.l1Cache.set(cacheKey, data);

      return data;
    } catch (error) {
      log.error("TwelveData", `Fetch error: ${error}`);
      return null;
    }
  }

  async getQuote(symbol: string): Promise<TwelveDataQuote | null> {
    const endpoint = `/quote?symbol=${symbol}`;
    const cacheKey = buildCacheKey(PROVIDER, "quote", symbol);
    return this.fetchFromApi<TwelveDataQuote>(endpoint, cacheKey);
  }

  async getTimeSeries(
    symbol: string,
    interval: "1min" | "5min" | "15min" | "30min" | "45min" | "1h" | "2h" | "4h" | "1day" | "1week" | "1month",
    outputSize = 30,
    startDate?: string,
    endDate?: string
  ): Promise<TwelveDataTimeSeries | null> {
    let endpoint = `/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputSize}`;
    if (startDate) endpoint += `&start_date=${startDate}`;
    if (endDate) endpoint += `&end_date=${endDate}`;

    const cacheKey = buildCacheKey(PROVIDER, "ts", symbol, interval, outputSize);
    return this.fetchFromApi<TwelveDataTimeSeries>(endpoint, cacheKey);
  }

  async searchSymbols(query: string, outputSize = 20): Promise<TwelveDataSymbol[]> {
    const endpoint = `/symbol_search?symbol=${encodeURIComponent(query)}&outputsize=${outputSize}`;
    const cacheKey = buildCacheKey(PROVIDER, "search", query);
    const response = await this.fetchFromApi<{ data: TwelveDataSymbol[] }>(endpoint, cacheKey);
    return response?.data || [];
  }

  async getProfile(symbol: string): Promise<TwelveDataProfile | null> {
    const endpoint = `/profile?symbol=${symbol}`;
    const cacheKey = buildCacheKey(PROVIDER, "profile", symbol);
    return this.fetchFromApi<TwelveDataProfile>(endpoint, cacheKey);
  }

  async getEarnings(symbol: string): Promise<TwelveDataEarnings | null> {
    const endpoint = `/earnings?symbol=${symbol}`;
    const cacheKey = buildCacheKey(PROVIDER, "earnings", symbol);
    return this.fetchFromApi<TwelveDataEarnings>(endpoint, cacheKey);
  }

  async getRSI(symbol: string, interval = "1day", timePeriod = 14): Promise<TwelveDataTechnicalIndicator[] | null> {
    const endpoint = `/rsi?symbol=${symbol}&interval=${interval}&time_period=${timePeriod}`;
    const cacheKey = buildCacheKey(PROVIDER, "rsi", symbol, interval, timePeriod);
    const response = await this.fetchFromApi<{ values: TwelveDataTechnicalIndicator[] }>(endpoint, cacheKey);
    return response?.values || null;
  }

  async getMACD(symbol: string, interval = "1day"): Promise<TwelveDataTechnicalIndicator[] | null> {
    const endpoint = `/macd?symbol=${symbol}&interval=${interval}`;
    const cacheKey = buildCacheKey(PROVIDER, "macd", symbol, interval);
    const response = await this.fetchFromApi<{ values: TwelveDataTechnicalIndicator[] }>(endpoint, cacheKey);
    return response?.values || null;
  }

  async getSMA(symbol: string, interval = "1day", timePeriod = 20): Promise<TwelveDataTechnicalIndicator[] | null> {
    const endpoint = `/sma?symbol=${symbol}&interval=${interval}&time_period=${timePeriod}`;
    const cacheKey = buildCacheKey(PROVIDER, "sma", symbol, interval, timePeriod);
    const response = await this.fetchFromApi<{ values: TwelveDataTechnicalIndicator[] }>(endpoint, cacheKey);
    return response?.values || null;
  }

  async getEMA(symbol: string, interval = "1day", timePeriod = 20): Promise<TwelveDataTechnicalIndicator[] | null> {
    const endpoint = `/ema?symbol=${symbol}&interval=${interval}&time_period=${timePeriod}`;
    const cacheKey = buildCacheKey(PROVIDER, "ema", symbol, interval, timePeriod);
    const response = await this.fetchFromApi<{ values: TwelveDataTechnicalIndicator[] }>(endpoint, cacheKey);
    return response?.values || null;
  }

  async getBBands(symbol: string, interval = "1day", timePeriod = 20): Promise<TwelveDataTechnicalIndicator[] | null> {
    const endpoint = `/bbands?symbol=${symbol}&interval=${interval}&time_period=${timePeriod}`;
    const cacheKey = buildCacheKey(PROVIDER, "bbands", symbol, interval, timePeriod);
    const response = await this.fetchFromApi<{ values: TwelveDataTechnicalIndicator[] }>(endpoint, cacheKey);
    return response?.values || null;
  }

  async getATR(symbol: string, interval = "1day", timePeriod = 14): Promise<TwelveDataTechnicalIndicator[] | null> {
    const endpoint = `/atr?symbol=${symbol}&interval=${interval}&time_period=${timePeriod}`;
    const cacheKey = buildCacheKey(PROVIDER, "atr", symbol, interval, timePeriod);
    const response = await this.fetchFromApi<{ values: TwelveDataTechnicalIndicator[] }>(endpoint, cacheKey);
    return response?.values || null;
  }

  async getStoch(symbol: string, interval = "1day"): Promise<TwelveDataTechnicalIndicator[] | null> {
    const endpoint = `/stoch?symbol=${symbol}&interval=${interval}`;
    const cacheKey = buildCacheKey(PROVIDER, "stoch", symbol, interval);
    const response = await this.fetchFromApi<{ values: TwelveDataTechnicalIndicator[] }>(endpoint, cacheKey);
    return response?.values || null;
  }

  async getPrice(symbol: string): Promise<{ price: string } | null> {
    const endpoint = `/price?symbol=${symbol}`;
    const cacheKey = buildCacheKey(PROVIDER, "price", symbol);
    return this.fetchFromApi<{ price: string }>(endpoint, cacheKey);
  }
}

export const twelveData = new TwelveDataClient();
