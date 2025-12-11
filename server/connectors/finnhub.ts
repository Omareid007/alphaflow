import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";

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

export interface BasicFinancials {
  symbol: string;
  metric: {
    "10DayAverageTradingVolume"?: number;
    "52WeekHigh"?: number;
    "52WeekLow"?: number;
    "52WeekPriceReturnDaily"?: number;
    beta?: number;
    bookValuePerShareQuarterly?: number;
    currentRatioQuarterly?: number;
    dividendYieldIndicatedAnnual?: number;
    epsBasicExclExtraItemsTTM?: number;
    epsGrowth3Y?: number;
    epsGrowth5Y?: number;
    epsGrowthTTMYoy?: number;
    grossMargin5Y?: number;
    grossMarginTTM?: number;
    marketCapitalization?: number;
    netProfitMargin5Y?: number;
    netProfitMarginTTM?: number;
    operatingMargin5Y?: number;
    operatingMarginTTM?: number;
    peBasicExclExtraTTM?: number;
    peExclExtraTTM?: number;
    pbQuarterly?: number;
    priceToSalesTTM?: number;
    psTTM?: number;
    revenueGrowth3Y?: number;
    revenueGrowth5Y?: number;
    revenueGrowthTTMYoy?: number;
    roaRfy?: number;
    roaTTM?: number;
    roeRfy?: number;
    roeTTM?: number;
    roiTTM?: number;
    totalDebtToEquityQuarterly?: number;
    totalDebtToTotalCapitalQuarterly?: number;
    [key: string]: number | undefined;
  };
  metricType?: string;
  series?: Record<string, unknown>;
}

export interface TechnicalIndicator {
  technicalAnalysis: {
    count: {
      buy: number;
      neutral: number;
      sell: number;
    };
    signal: "buy" | "neutral" | "sell";
  };
  trend: {
    adx: number;
    trending: boolean;
  };
}

class FinnhubConnector {
  private quoteCache = new ApiCache<StockQuote>({
    freshDuration: 60 * 1000,
    staleDuration: 30 * 60 * 1000,
  });
  private candleCache = new ApiCache<StockCandle>({
    freshDuration: 5 * 60 * 1000,
    staleDuration: 60 * 60 * 1000,
  });
  private profileCache = new ApiCache<CompanyProfile>({
    freshDuration: 60 * 60 * 1000,
    staleDuration: 24 * 60 * 60 * 1000,
  });
  private searchCache = new ApiCache<SymbolSearchResult>({
    freshDuration: 15 * 60 * 1000,
    staleDuration: 60 * 60 * 1000,
  });
  private newsCache = new ApiCache<MarketNews[]>({
    freshDuration: 5 * 60 * 1000,
    staleDuration: 60 * 60 * 1000,
  });
  private financialsCache = new ApiCache<BasicFinancials>({
    freshDuration: 60 * 60 * 1000,
    staleDuration: 24 * 60 * 60 * 1000,
  });
  private technicalCache = new ApiCache<TechnicalIndicator>({
    freshDuration: 5 * 60 * 1000,
    staleDuration: 30 * 60 * 1000,
  });
  
  private lastRequestTime = 0;
  private minRequestInterval = 1100;
  private rateLimitedUntil = 0;

  private getApiKey(): string | undefined {
    return process.env.FINNHUB_API_KEY;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    
    if (now < this.rateLimitedUntil) {
      const waitTime = this.rateLimitedUntil - now;
      log.warn("Finnhub", `Rate limited, waiting ${waitTime}ms`);
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
    const apiKey = this.getApiKey();
    if (!apiKey) {
      const stale = cache.getStale(cacheKey);
      if (stale) {
        log.debug("Finnhub", `No API key, serving stale data for ${cacheKey}`);
        return stale;
      }
      throw new Error("FINNHUB_API_KEY is not configured");
    }

    const cached = cache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    if (cached && !cached.isFresh) {
      if (!this.pendingRefreshes.has(cacheKey)) {
        this.pendingRefreshes.add(cacheKey);
        this.backgroundRefresh(url, cacheKey, cache, retries);
      }
      log.debug("Finnhub", `Serving stale data for ${cacheKey}, refreshing in background`);
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
      log.warn("Finnhub", `Background refresh failed for ${cacheKey}`);
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
    const apiKey = this.getApiKey()!;
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
          this.rateLimitedUntil = Date.now() + Math.pow(2, i + 1) * 1000;
          
          const stale = cache.getStale(cacheKey);
          if (stale) {
            log.debug("Finnhub", `Rate limited, serving stale data for ${cacheKey}`);
            return stale;
          }
          
          const waitTime = Math.pow(2, i) * 1000;
          log.warn("Finnhub", `Rate limited, waiting ${waitTime}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`Finnhub API error: ${response.status}`);
        }

        const data = await response.json() as T;
        cache.set(cacheKey, data);
        return data;
      } catch (error) {
        const stale = cache.getStale(cacheKey);
        if (stale && i === retries - 1) {
          log.debug("Finnhub", `Error fetching, serving stale data for ${cacheKey}`);
          return stale;
        }
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    throw new Error("Failed to fetch from Finnhub after retries");
  }

  async getQuote(symbol: string): Promise<StockQuote> {
    const cacheKey = `quote_${symbol}`;
    const url = `${FINNHUB_BASE_URL}/quote?symbol=${symbol.toUpperCase()}`;
    return this.fetchWithRetry<StockQuote>(url, cacheKey, this.quoteCache);
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
    const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${symbol.toUpperCase()}&resolution=${resolution}&from=${fromTime}&to=${toTime}`;
    return this.fetchWithRetry<StockCandle>(url, cacheKey, this.candleCache);
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    const cacheKey = `profile_${symbol}`;
    const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${symbol.toUpperCase()}`;
    return this.fetchWithRetry<CompanyProfile>(url, cacheKey, this.profileCache);
  }

  async searchSymbols(query: string): Promise<SymbolSearchResult> {
    const cacheKey = `search_${query}`;
    const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(query)}`;
    return this.fetchWithRetry<SymbolSearchResult>(url, cacheKey, this.searchCache);
  }

  async getMarketNews(category = "general"): Promise<MarketNews[]> {
    const cacheKey = `news_${category}`;
    const url = `${FINNHUB_BASE_URL}/news?category=${category}`;
    return this.fetchWithRetry<MarketNews[]>(url, cacheKey, this.newsCache);
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
        log.error("Finnhub", `Failed to fetch quote for ${symbol}`, { error: String(error) });
      }
    }
    
    return quotes;
  }

  async getBasicFinancials(symbol: string): Promise<BasicFinancials> {
    const cacheKey = `financials_${symbol}`;
    const url = `${FINNHUB_BASE_URL}/stock/metric?symbol=${symbol.toUpperCase()}&metric=all`;
    return this.fetchWithRetry<BasicFinancials>(url, cacheKey, this.financialsCache);
  }

  async getTechnicalIndicator(symbol: string, resolution = "D"): Promise<TechnicalIndicator> {
    const cacheKey = `technical_${symbol}_${resolution}`;
    const url = `${FINNHUB_BASE_URL}/scan/technical-indicator?symbol=${symbol.toUpperCase()}&resolution=${resolution}`;
    return this.fetchWithRetry<TechnicalIndicator>(url, cacheKey, this.technicalCache);
  }

  async getKeyMetrics(symbol: string): Promise<{
    peRatio: number | null;
    pbRatio: number | null;
    roe: number | null;
    roa: number | null;
    currentRatio: number | null;
    debtToEquity: number | null;
    grossMargin: number | null;
    netProfitMargin: number | null;
    beta: number | null;
    dividendYield: number | null;
    epsGrowth: number | null;
    revenueGrowth: number | null;
    weekHigh52: number | null;
    weekLow52: number | null;
  }> {
    try {
      const financials = await this.getBasicFinancials(symbol);
      const m = financials.metric;
      return {
        peRatio: m.peBasicExclExtraTTM ?? m.peExclExtraTTM ?? null,
        pbRatio: m.pbQuarterly ?? null,
        roe: m.roeTTM ?? m.roeRfy ?? null,
        roa: m.roaTTM ?? m.roaRfy ?? null,
        currentRatio: m.currentRatioQuarterly ?? null,
        debtToEquity: m.totalDebtToEquityQuarterly ?? null,
        grossMargin: m.grossMarginTTM ?? m.grossMargin5Y ?? null,
        netProfitMargin: m.netProfitMarginTTM ?? m.netProfitMargin5Y ?? null,
        beta: m.beta ?? null,
        dividendYield: m.dividendYieldIndicatedAnnual ?? null,
        epsGrowth: m.epsGrowthTTMYoy ?? m.epsGrowth3Y ?? null,
        revenueGrowth: m.revenueGrowthTTMYoy ?? m.revenueGrowth3Y ?? null,
        weekHigh52: m["52WeekHigh"] ?? null,
        weekLow52: m["52WeekLow"] ?? null,
      };
    } catch (error) {
      log.warn("Finnhub", `Failed to get key metrics for ${symbol}`, { error: String(error) });
      return {
        peRatio: null,
        pbRatio: null,
        roe: null,
        roa: null,
        currentRatio: null,
        debtToEquity: null,
        grossMargin: null,
        netProfitMargin: null,
        beta: null,
        dividendYield: null,
        epsGrowth: null,
        revenueGrowth: null,
        weekHigh52: null,
        weekLow52: null,
      };
    }
  }

  async getTechnicalSignals(symbol: string): Promise<{
    signal: "buy" | "neutral" | "sell";
    buyCount: number;
    sellCount: number;
    neutralCount: number;
    adx: number | null;
    isTrending: boolean;
  }> {
    try {
      const indicator = await this.getTechnicalIndicator(symbol);
      return {
        signal: indicator.technicalAnalysis.signal,
        buyCount: indicator.technicalAnalysis.count.buy,
        sellCount: indicator.technicalAnalysis.count.sell,
        neutralCount: indicator.technicalAnalysis.count.neutral,
        adx: indicator.trend.adx,
        isTrending: indicator.trend.trending,
      };
    } catch (error) {
      log.warn("Finnhub", `Failed to get technical signals for ${symbol}`, { error: String(error) });
      return {
        signal: "neutral",
        buyCount: 0,
        sellCount: 0,
        neutralCount: 0,
        adx: null,
        isTrending: false,
      };
    }
  }

  getConnectionStatus(): { connected: boolean; hasApiKey: boolean; cacheSize: number } {
    const totalCacheSize = 
      this.quoteCache.size() + 
      this.candleCache.size() + 
      this.profileCache.size() + 
      this.searchCache.size() + 
      this.newsCache.size() +
      this.financialsCache.size() +
      this.technicalCache.size();
    
    return {
      connected: !!this.getApiKey(),
      hasApiKey: !!this.getApiKey(),
      cacheSize: totalCacheSize,
    };
  }

  clearCache(): void {
    this.quoteCache.clear();
    this.candleCache.clear();
    this.profileCache.clear();
    this.searchCache.clear();
    this.newsCache.clear();
    this.financialsCache.clear();
    this.technicalCache.clear();
  }
}

export const finnhub = new FinnhubConnector();
