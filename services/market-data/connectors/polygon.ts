/**
 * AI Active Trader - Polygon.io Market Data Connector
 * Real-time and historical market data from Polygon.io
 */

import { EventBusClient } from '../../shared/events';
import { createLogger } from '../../shared/common';
import { MarketQuote, MarketBar, ConnectorType } from '../types';

const logger = createLogger('polygon-connector', 'info');

const POLYGON_REST_URL = 'https://api.polygon.io';

interface PolygonQuote {
  T: string;
  p: number;
  s: number;
  P: number;
  S: number;
  t: number;
}

interface PolygonAgg {
  T: string;
  v: number;
  vw: number;
  o: number;
  c: number;
  h: number;
  l: number;
  t: number;
  n: number;
}

interface PolygonTickerDetails {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange: string;
  type: string;
  active: boolean;
  currency_name: string;
  market_cap?: number;
}

export class PolygonConnector {
  private apiKey: string | null = null;
  private eventBus: EventBusClient | null = null;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL = 5000;

  constructor(eventBus?: EventBusClient) {
    this.loadApiKey();
    if (eventBus) {
      this.eventBus = eventBus;
    }
  }

  private loadApiKey(): void {
    this.apiKey = process.env.POLYGON_API_KEY || null;
    if (this.apiKey) {
      logger.info('Polygon API key loaded');
    } else {
      logger.warn('Polygon API key not found');
    }
  }

  setEventBus(eventBus: EventBusClient): void {
    this.eventBus = eventBus;
  }

  isAvailable(): boolean {
    return this.apiKey !== null;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.cacheTTL) {
      return entry.data as T;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
  }

  private async makeRequest<T>(endpoint: string): Promise<T | null> {
    if (!this.apiKey) {
      logger.warn('Cannot make request - no API key');
      return null;
    }

    const cacheKey = endpoint;
    const cached = this.getCached<T>(cacheKey);
    if (cached) return cached;

    try {
      const separator = endpoint.includes('?') ? '&' : '?';
      const url = `${POLYGON_REST_URL}${endpoint}${separator}apiKey=${this.apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn('Polygon rate limit exceeded');
          return null;
        }
        throw new Error(`Polygon API error: ${response.status}`);
      }

      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      logger.error('Polygon API request failed', error instanceof Error ? error : undefined, {
        endpoint,
      });
      return null;
    }
  }

  async getQuote(symbol: string): Promise<MarketQuote | null> {
    const response = await this.makeRequest<{
      status: string;
      results: { ticker: string; last: { price: number; size: number } };
    }>(`/v2/last/trade/${symbol.toUpperCase()}`);

    if (!response || response.status !== 'OK') {
      return null;
    }

    const quote: MarketQuote = {
      symbol: symbol.toUpperCase(),
      currentPrice: response.results.last.price,
      change: 0,
      changePercent: 0,
      high: response.results.last.price,
      low: response.results.last.price,
      open: response.results.last.price,
      previousClose: response.results.last.price,
      timestamp: new Date().toISOString(),
      source: ConnectorType.POLYGON,
    };

    if (this.eventBus) {
      try {
        await this.eventBus.publish('market.quote.received', {
          symbol: quote.symbol,
          bidPrice: quote.currentPrice,
          askPrice: quote.currentPrice,
          bidSize: 0,
          askSize: 0,
          timestamp: quote.timestamp,
        });
      } catch (error) {
        logger.warn('Failed to publish quote event');
      }
    }

    return quote;
  }

  async getBars(
    symbol: string,
    timeframe: string = '1',
    from: string,
    to: string
  ): Promise<MarketBar[]> {
    const multiplier = parseInt(timeframe) || 1;
    const timespan = 'minute';

    const response = await this.makeRequest<{
      status: string;
      results: PolygonAgg[];
    }>(`/v2/aggs/ticker/${symbol.toUpperCase()}/range/${multiplier}/${timespan}/${from}/${to}`);

    if (!response || response.status !== 'OK' || !response.results) {
      return [];
    }

    return response.results.map((agg) => ({
      symbol: symbol.toUpperCase(),
      open: agg.o,
      high: agg.h,
      low: agg.l,
      close: agg.c,
      volume: agg.v,
      timestamp: new Date(agg.t).toISOString(),
      timeframe: '1m' as const,
      source: ConnectorType.POLYGON,
    }));
  }

  async getPreviousClose(symbol: string): Promise<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null> {
    const response = await this.makeRequest<{
      status: string;
      results: PolygonAgg[];
    }>(`/v2/aggs/ticker/${symbol.toUpperCase()}/prev`);

    if (!response || response.status !== 'OK' || !response.results?.[0]) {
      return null;
    }

    const prev = response.results[0];
    return {
      open: prev.o,
      high: prev.h,
      low: prev.l,
      close: prev.c,
      volume: prev.v,
    };
  }

  async getTickerDetails(symbol: string): Promise<PolygonTickerDetails | null> {
    const response = await this.makeRequest<{
      status: string;
      results: PolygonTickerDetails;
    }>(`/v3/reference/tickers/${symbol.toUpperCase()}`);

    if (!response || response.status !== 'OK') {
      return null;
    }

    return response.results;
  }

  async getMarketStatus(): Promise<{
    market: string;
    serverTime: string;
    exchanges: Record<string, string>;
  } | null> {
    const response = await this.makeRequest<{
      market: string;
      serverTime: string;
      exchanges: Record<string, string>;
    }>('/v1/marketstatus/now');

    return response;
  }

  async searchTickers(query: string, limit: number = 10): Promise<{ ticker: string; name: string }[]> {
    const response = await this.makeRequest<{
      status: string;
      results: Array<{ ticker: string; name: string }>;
    }>(`/v3/reference/tickers?search=${encodeURIComponent(query)}&limit=${limit}`);

    if (!response || response.status !== 'OK') {
      return [];
    }

    return response.results.map((r) => ({ ticker: r.ticker, name: r.name }));
  }

  getConnectionStatus(): { hasApiKey: boolean; source: string } {
    return {
      hasApiKey: this.apiKey !== null,
      source: 'polygon',
    };
  }
}

export const polygonConnector = new PolygonConnector();
