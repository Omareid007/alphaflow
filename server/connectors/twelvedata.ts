import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";

const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";

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
  private cache: ApiCache<unknown>;
  private rateLimitDelay = 8000;
  private lastRequestTime = 0;

  constructor() {
    this.apiKey = process.env.TWELVE_DATA_API_KEY || null;
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
      log.warn("TwelveData", "API key not configured");
      return null;
    }

    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached.data as T;
    }

    try {
      const fullUrl = url.includes("?") 
        ? `${url}&apikey=${this.apiKey}`
        : `${url}?apikey=${this.apiKey}`;
      
      const response = await this.rateLimitedFetch(fullUrl);
      
      if (response.status === 429) {
        log.warn("TwelveData", "Rate limited, backing off");
        await new Promise(resolve => setTimeout(resolve, 60000));
        return null;
      }
      
      if (!response.ok) {
        log.error("TwelveData", `HTTP error: ${response.status}`);
        return null;
      }

      const data = await response.json() as T;
      
      if ((data as any).status === "error") {
        log.error("TwelveData", `API error: ${(data as any).message}`);
        return null;
      }
      
      if (cacheKey) {
        this.cache.set(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      log.error("TwelveData", `Fetch error: ${error}`);
      return null;
    }
  }

  async getQuote(symbol: string): Promise<TwelveDataQuote | null> {
    const url = `${TWELVE_DATA_BASE_URL}/quote?symbol=${symbol}`;
    return this.fetchWithRetry<TwelveDataQuote>(
      url, 
      `twelvedata:quote:${symbol}`
    );
  }

  async getTimeSeries(
    symbol: string,
    interval: "1min" | "5min" | "15min" | "30min" | "45min" | "1h" | "2h" | "4h" | "1day" | "1week" | "1month",
    outputSize = 30,
    startDate?: string,
    endDate?: string
  ): Promise<TwelveDataTimeSeries | null> {
    let url = `${TWELVE_DATA_BASE_URL}/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputSize}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    
    return this.fetchWithRetry<TwelveDataTimeSeries>(
      url,
      `twelvedata:ts:${symbol}:${interval}:${outputSize}`
    );
  }

  async searchSymbols(query: string, outputSize = 20): Promise<TwelveDataSymbol[]> {
    const url = `${TWELVE_DATA_BASE_URL}/symbol_search?symbol=${encodeURIComponent(query)}&outputsize=${outputSize}`;
    const response = await this.fetchWithRetry<{ data: TwelveDataSymbol[] }>(
      url,
      `twelvedata:search:${query}`
    );
    return response?.data || [];
  }

  async getProfile(symbol: string): Promise<TwelveDataProfile | null> {
    const url = `${TWELVE_DATA_BASE_URL}/profile?symbol=${symbol}`;
    return this.fetchWithRetry<TwelveDataProfile>(
      url,
      `twelvedata:profile:${symbol}`
    );
  }

  async getEarnings(symbol: string): Promise<TwelveDataEarnings | null> {
    const url = `${TWELVE_DATA_BASE_URL}/earnings?symbol=${symbol}`;
    return this.fetchWithRetry<TwelveDataEarnings>(
      url,
      `twelvedata:earnings:${symbol}`
    );
  }

  async getRSI(symbol: string, interval = "1day", timePeriod = 14): Promise<TwelveDataTechnicalIndicator[] | null> {
    const url = `${TWELVE_DATA_BASE_URL}/rsi?symbol=${symbol}&interval=${interval}&time_period=${timePeriod}`;
    const response = await this.fetchWithRetry<{ values: TwelveDataTechnicalIndicator[] }>(
      url,
      `twelvedata:rsi:${symbol}:${interval}`
    );
    return response?.values || null;
  }

  async getMACD(symbol: string, interval = "1day"): Promise<TwelveDataTechnicalIndicator[] | null> {
    const url = `${TWELVE_DATA_BASE_URL}/macd?symbol=${symbol}&interval=${interval}`;
    const response = await this.fetchWithRetry<{ values: TwelveDataTechnicalIndicator[] }>(
      url,
      `twelvedata:macd:${symbol}:${interval}`
    );
    return response?.values || null;
  }

  async getSMA(symbol: string, interval = "1day", timePeriod = 20): Promise<TwelveDataTechnicalIndicator[] | null> {
    const url = `${TWELVE_DATA_BASE_URL}/sma?symbol=${symbol}&interval=${interval}&time_period=${timePeriod}`;
    const response = await this.fetchWithRetry<{ values: TwelveDataTechnicalIndicator[] }>(
      url,
      `twelvedata:sma:${symbol}:${interval}`
    );
    return response?.values || null;
  }

  async getEMA(symbol: string, interval = "1day", timePeriod = 20): Promise<TwelveDataTechnicalIndicator[] | null> {
    const url = `${TWELVE_DATA_BASE_URL}/ema?symbol=${symbol}&interval=${interval}&time_period=${timePeriod}`;
    const response = await this.fetchWithRetry<{ values: TwelveDataTechnicalIndicator[] }>(
      url,
      `twelvedata:ema:${symbol}:${interval}`
    );
    return response?.values || null;
  }

  async getBBands(symbol: string, interval = "1day", timePeriod = 20): Promise<TwelveDataTechnicalIndicator[] | null> {
    const url = `${TWELVE_DATA_BASE_URL}/bbands?symbol=${symbol}&interval=${interval}&time_period=${timePeriod}`;
    const response = await this.fetchWithRetry<{ values: TwelveDataTechnicalIndicator[] }>(
      url,
      `twelvedata:bbands:${symbol}:${interval}`
    );
    return response?.values || null;
  }

  async getATR(symbol: string, interval = "1day", timePeriod = 14): Promise<TwelveDataTechnicalIndicator[] | null> {
    const url = `${TWELVE_DATA_BASE_URL}/atr?symbol=${symbol}&interval=${interval}&time_period=${timePeriod}`;
    const response = await this.fetchWithRetry<{ values: TwelveDataTechnicalIndicator[] }>(
      url,
      `twelvedata:atr:${symbol}:${interval}`
    );
    return response?.values || null;
  }

  async getStoch(symbol: string, interval = "1day"): Promise<TwelveDataTechnicalIndicator[] | null> {
    const url = `${TWELVE_DATA_BASE_URL}/stoch?symbol=${symbol}&interval=${interval}`;
    const response = await this.fetchWithRetry<{ values: TwelveDataTechnicalIndicator[] }>(
      url,
      `twelvedata:stoch:${symbol}:${interval}`
    );
    return response?.values || null;
  }

  async getPrice(symbol: string): Promise<{ price: string } | null> {
    const url = `${TWELVE_DATA_BASE_URL}/price?symbol=${symbol}`;
    return this.fetchWithRetry<{ price: string }>(
      url,
      `twelvedata:price:${symbol}`
    );
  }
}

export const twelveData = new TwelveDataClient();
