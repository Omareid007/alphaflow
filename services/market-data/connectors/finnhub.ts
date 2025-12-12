/**
 * AI Active Trader - Finnhub Connector for Market Data Service
 * Fetches market data from Finnhub API with caching and event publishing
 */

import { ApiCache } from '../cache';
import { EventBusClient } from '../../shared/events';
import {
  ConnectorType,
  MarketQuote,
  MarketBar,
  MarketNews,
  CompanyProfile,
  FinnhubQuote,
  FinnhubCandle,
  FinnhubNews,
  FinnhubProfile,
  normalizeQuote,
  normalizeBars,
  normalizeNews,
  normalizeProfile,
} from '../types';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

export class FinnhubConnector {
  private quoteCache = new ApiCache<FinnhubQuote>({ ttlMs: 60 * 1000 });
  private candleCache = new ApiCache<FinnhubCandle>({ ttlMs: 5 * 60 * 1000 });
  private profileCache = new ApiCache<FinnhubProfile>({ ttlMs: 60 * 60 * 1000 });
  private newsCache = new ApiCache<FinnhubNews[]>({ ttlMs: 5 * 60 * 1000 });

  private lastRequestTime = 0;
  private minRequestInterval = 1100;
  private rateLimitedUntil = 0;

  private eventBus: EventBusClient | null = null;

  constructor(eventBus?: EventBusClient) {
    this.eventBus = eventBus ?? null;
  }

  setEventBus(eventBus: EventBusClient): void {
    this.eventBus = eventBus;
  }

  private getApiKey(): string | undefined {
    return process.env.FINNHUB_API_KEY;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();

    if (now < this.rateLimitedUntil) {
      const waitTime = this.rateLimitedUntil - now;
      console.log(`[Finnhub] Rate limited, waiting ${waitTime}ms`);
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

  private async fetchWithRetry<T>(
    url: string,
    cacheKey: string,
    cache: ApiCache<T>,
    retries = 3
  ): Promise<T> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log(`[Finnhub] No API key, serving cached data for ${cacheKey}`);
        return cached;
      }
      throw new Error('FINNHUB_API_KEY is not configured');
    }

    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    await this.throttle();

    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${separator}token=${apiKey}`;

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(fullUrl, {
          headers: { Accept: 'application/json' },
        });

        if (response.status === 429) {
          this.rateLimitedUntil = Date.now() + Math.pow(2, i + 1) * 1000;
          const cachedData = cache.get(cacheKey);
          if (cachedData) {
            console.log(`[Finnhub] Rate limited, serving cached data for ${cacheKey}`);
            return cachedData;
          }
          const waitTime = Math.pow(2, i) * 1000;
          console.log(`[Finnhub] Rate limited, waiting ${waitTime}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`Finnhub API error: ${response.status}`);
        }

        const data = (await response.json()) as T;
        cache.set(cacheKey, data);
        return data;
      } catch (error) {
        const cachedData = cache.get(cacheKey);
        if (cachedData && i === retries - 1) {
          console.log(`[Finnhub] Error fetching, serving cached data for ${cacheKey}`);
          return cachedData;
        }
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    throw new Error('Failed to fetch from Finnhub after retries');
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    const cacheKey = `quote_${symbol.toUpperCase()}`;
    const url = `${FINNHUB_BASE_URL}/quote?symbol=${symbol.toUpperCase()}`;
    
    const raw = await this.fetchWithRetry<FinnhubQuote>(url, cacheKey, this.quoteCache);
    const normalized = normalizeQuote(raw, symbol);

    if (this.eventBus?.isConnected()) {
      await this.eventBus.publish('market.quote.received', {
        symbol: normalized.symbol,
        bidPrice: normalized.currentPrice,
        askPrice: normalized.currentPrice,
        bidSize: 0,
        askSize: 0,
        timestamp: normalized.timestamp,
      });
    }

    return normalized;
  }

  async getCandles(
    symbol: string,
    resolution = 'D',
    from?: number,
    to?: number
  ): Promise<MarketBar[]> {
    const now = Math.floor(Date.now() / 1000);
    const fromTime = from || now - 30 * 24 * 60 * 60;
    const toTime = to || now;

    const cacheKey = `candles_${symbol.toUpperCase()}_${resolution}_${fromTime}_${toTime}`;
    const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${symbol.toUpperCase()}&resolution=${resolution}&from=${fromTime}&to=${toTime}`;

    const timeframeMap: Record<string, MarketBar['timeframe']> = {
      '1': '1m',
      '5': '5m',
      '15': '15m',
      '60': '1h',
      'D': '1d',
    };

    const raw = await this.fetchWithRetry<FinnhubCandle>(url, cacheKey, this.candleCache);
    const timeframe = timeframeMap[resolution] || '1d';
    const bars = normalizeBars(raw, symbol, timeframe);

    if (this.eventBus?.isConnected() && bars.length > 0) {
      const latestBar = bars[bars.length - 1];
      await this.eventBus.publish('market.bar.received', {
        symbol: latestBar.symbol,
        open: latestBar.open,
        high: latestBar.high,
        low: latestBar.low,
        close: latestBar.close,
        volume: latestBar.volume,
        timestamp: latestBar.timestamp,
        timeframe: latestBar.timeframe,
      });
    }

    return bars;
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    const cacheKey = `profile_${symbol.toUpperCase()}`;
    const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${symbol.toUpperCase()}`;

    const raw = await this.fetchWithRetry<FinnhubProfile>(url, cacheKey, this.profileCache);
    return normalizeProfile(raw);
  }

  async getNews(symbol?: string, category = 'general'): Promise<MarketNews[]> {
    const cacheKey = symbol ? `news_${symbol.toUpperCase()}` : `news_${category}`;
    const url = symbol
      ? `${FINNHUB_BASE_URL}/company-news?symbol=${symbol.toUpperCase()}&from=${this.getDateParam(-7)}&to=${this.getDateParam(0)}`
      : `${FINNHUB_BASE_URL}/news?category=${category}`;

    const raw = await this.fetchWithRetry<FinnhubNews[]>(url, cacheKey, this.newsCache);
    const news = normalizeNews(raw, symbol || 'GENERAL');

    if (this.eventBus?.isConnected() && news.length > 0) {
      const latestNews = news[0];
      await this.eventBus.publish('market.news.received', {
        symbol: latestNews.symbol,
        headline: latestNews.headline,
        summary: latestNews.summary,
        source: latestNews.source,
        url: latestNews.url,
        sentiment: latestNews.sentiment,
        publishedAt: latestNews.publishedAt,
      });
    }

    return news;
  }

  private getDateParam(daysOffset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
  }

  getConnectionStatus(): { connected: boolean; hasApiKey: boolean; cacheStats: { quotes: number; candles: number; profiles: number; news: number } } {
    return {
      connected: !!this.getApiKey(),
      hasApiKey: !!this.getApiKey(),
      cacheStats: {
        quotes: this.quoteCache.size(),
        candles: this.candleCache.size(),
        profiles: this.profileCache.size(),
        news: this.newsCache.size(),
      },
    };
  }

  clearCache(): void {
    this.quoteCache.clear();
    this.candleCache.clear();
    this.profileCache.clear();
    this.newsCache.clear();
  }
}
