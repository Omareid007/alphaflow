const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

export interface StockQuote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface StockCandle {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  s: string;
  t: number[];
  v: number[];
}

export interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
}

export interface SymbolSearchResult {
  count: number;
  result: {
    description: string;
    displaySymbol: string;
    symbol: string;
    type: string;
  }[];
}

export interface MarketNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class FinnhubConnector {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cacheDuration = 60 * 1000;
  private lastRequestTime = 0;
  private minRequestInterval = 1100;

  private getApiKey(): string | undefined {
    return process.env.FINNHUB_API_KEY;
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
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("FINNHUB_API_KEY is not configured");
    }

    await this.throttle();

    const separator = url.includes("?") ? "&" : "?";
    const fullUrl = `${url}${separator}token=${apiKey}`;

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(fullUrl, {
          headers: {
            Accept: "application/json",
          },
        });

        if (response.status === 429) {
          const waitTime = Math.pow(2, i) * 1000;
          console.log(`Finnhub rate limited, waiting ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`Finnhub API error: ${response.status}`);
        }

        return response.json() as Promise<T>;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    throw new Error("Failed to fetch from Finnhub after retries");
  }

  async getQuote(symbol: string): Promise<StockQuote> {
    const cacheKey = `quote_${symbol}`;
    const cached = this.getCached<StockQuote>(cacheKey);
    if (cached) return cached;

    const url = `${FINNHUB_BASE_URL}/quote?symbol=${symbol.toUpperCase()}`;
    const data = await this.fetchWithRetry<StockQuote>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getCandles(
    symbol: string,
    resolution = "D",
    from?: number,
    to?: number
  ): Promise<StockCandle> {
    const now = Math.floor(Date.now() / 1000);
    const fromTime = from || now - 30 * 24 * 60 * 60;
    const toTime = to || now;

    const cacheKey = `candles_${symbol}_${resolution}_${fromTime}_${toTime}`;
    const cached = this.getCached<StockCandle>(cacheKey);
    if (cached) return cached;

    const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${symbol.toUpperCase()}&resolution=${resolution}&from=${fromTime}&to=${toTime}`;
    const data = await this.fetchWithRetry<StockCandle>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    const cacheKey = `profile_${symbol}`;
    const cached = this.getCached<CompanyProfile>(cacheKey);
    if (cached) return cached;

    const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${symbol.toUpperCase()}`;
    const data = await this.fetchWithRetry<CompanyProfile>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async searchSymbols(query: string): Promise<SymbolSearchResult> {
    const cacheKey = `search_${query}`;
    const cached = this.getCached<SymbolSearchResult>(cacheKey);
    if (cached) return cached;

    const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(query)}`;
    const data = await this.fetchWithRetry<SymbolSearchResult>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getMarketNews(category = "general"): Promise<MarketNews[]> {
    const cacheKey = `news_${category}`;
    const cached = this.getCached<MarketNews[]>(cacheKey);
    if (cached) return cached;

    const url = `${FINNHUB_BASE_URL}/news?category=${category}`;
    const data = await this.fetchWithRetry<MarketNews[]>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getMultipleQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const quotes = new Map<string, StockQuote>();
    
    for (const symbol of symbols) {
      try {
        const quote = await this.getQuote(symbol);
        if (quote && quote.c !== 0) {
          quotes.set(symbol, quote);
        }
      } catch (error) {
        console.error(`Failed to fetch quote for ${symbol}:`, error);
      }
    }
    
    return quotes;
  }

  getConnectionStatus(): { connected: boolean; hasApiKey: boolean; cacheSize: number } {
    return {
      connected: !!this.getApiKey(),
      hasApiKey: !!this.getApiKey(),
      cacheSize: this.cache.size,
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const finnhub = new FinnhubConnector();
