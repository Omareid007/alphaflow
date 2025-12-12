/**
 * AI Active Trader - OpenBB-Inspired Data Adapter
 * Unified data normalization layer for stocks, crypto, forex, and commodities.
 * Adapts multiple data providers into a consistent schema.
 */

import { createLogger } from '../shared/common';
import { CircuitBreakerRegistry } from '../shared/common/circuit-breaker';

const logger = createLogger('openbb-adapter');

export interface NormalizedQuote {
  symbol: string;
  name?: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  previousClose?: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume?: number;
  marketCap?: number;
  peRatio?: number;
  dividend?: number;
  dividendYield?: number;
  eps?: number;
  high52Week?: number;
  low52Week?: number;
  exchange?: string;
  currency: string;
  timestamp: Date;
  source: string;
}

export interface NormalizedBar {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
  timestamp: Date;
  source: string;
}

export interface NormalizedTrade {
  symbol: string;
  price: number;
  size: number;
  exchange?: string;
  conditions?: string[];
  timestamp: Date;
  source: string;
}

export interface NormalizedOrderBook {
  symbol: string;
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  timestamp: Date;
  source: string;
}

export interface NormalizedNews {
  id: string;
  headline: string;
  summary?: string;
  source: string;
  url?: string;
  symbols: string[];
  sentiment?: number;
  publishedAt: Date;
  dataSource: string;
}

export interface NormalizedEarnings {
  symbol: string;
  reportDate: Date;
  fiscalQuarter: string;
  fiscalYear: number;
  epsEstimate?: number;
  epsActual?: number;
  epsSurprise?: number;
  revenueEstimate?: number;
  revenueActual?: number;
  revenueSurprise?: number;
  source: string;
}

export type AssetClass = 'stock' | 'crypto' | 'forex' | 'commodity' | 'etf' | 'index';

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  rateLimit: number;
  priority: number;
  supportedAssets: AssetClass[];
}

type DataProviderAdapter = {
  name: string;
  config: ProviderConfig;
  getQuote: (symbol: string) => Promise<NormalizedQuote>;
  getHistoricalBars: (symbol: string, timeframe: string, start: Date, end: Date) => Promise<NormalizedBar[]>;
  getNews?: (symbol: string, limit?: number) => Promise<NormalizedNews[]>;
};

const TIMEFRAME_MAP: Record<string, string> = {
  '1m': '1Min',
  '5m': '5Min',
  '15m': '15Min',
  '30m': '30Min',
  '1h': '1Hour',
  '4h': '4Hour',
  '1d': '1Day',
  '1w': '1Week',
  '1M': '1Month',
};

export class OpenBBAdapter {
  private providers: Map<string, DataProviderAdapter> = new Map();
  private circuitRegistry: CircuitBreakerRegistry;
  private cache: Map<string, { data: unknown; expiresAt: number }> = new Map();
  private cacheTTLMs: number = 5000;

  constructor() {
    this.circuitRegistry = CircuitBreakerRegistry.getInstance();
    this.initializeDefaultProviders();
  }

  private initializeDefaultProviders(): void {
    if (process.env.FINNHUB_API_KEY) {
      this.registerProvider(this.createFinnhubAdapter());
    }

    if (process.env.ALPACA_API_KEY) {
      this.registerProvider(this.createAlpacaDataAdapter());
    }

    if (process.env.COINMARKETCAP_API_KEY) {
      this.registerProvider(this.createCryptoAdapter());
    }

    logger.info('OpenBB adapter initialized', { providers: this.providers.size });
  }

  registerProvider(adapter: DataProviderAdapter): void {
    this.providers.set(adapter.name, adapter);
    logger.info('Data provider registered', { name: adapter.name });
  }

  private createFinnhubAdapter(): DataProviderAdapter {
    const config: ProviderConfig = {
      name: 'finnhub',
      baseUrl: 'https://finnhub.io/api/v1',
      apiKey: process.env.FINNHUB_API_KEY || '',
      rateLimit: 60,
      priority: 1,
      supportedAssets: ['stock', 'etf', 'index', 'forex', 'crypto'],
    };

    return {
      name: 'finnhub',
      config,
      getQuote: async (symbol: string): Promise<NormalizedQuote> => {
        const breaker = this.circuitRegistry.getOrCreate({
          name: 'openbb:finnhub',
          failureThreshold: 5,
          timeout: 30000,
        });

        return breaker.execute(async () => {
          const [quoteRaw, profileRaw] = await Promise.all([
            this.fetchJson(`${config.baseUrl}/quote?symbol=${symbol}&token=${config.apiKey}`),
            this.fetchJson(`${config.baseUrl}/stock/profile2?symbol=${symbol}&token=${config.apiKey}`).catch(() => ({})),
          ]);
          const quote = quoteRaw as { c: number; o: number; h: number; l: number; pc: number; d: number; dp: number; t: number };
          const profile = profileRaw as { name?: string; marketCapitalization?: number; exchange?: string; currency?: string };

          return {
            symbol,
            name: profile.name,
            price: quote.c,
            open: quote.o,
            high: quote.h,
            low: quote.l,
            close: quote.c,
            previousClose: quote.pc,
            change: quote.d,
            changePercent: quote.dp,
            volume: 0,
            marketCap: profile.marketCapitalization ? profile.marketCapitalization * 1000000 : undefined,
            exchange: profile.exchange,
            currency: profile.currency || 'USD',
            timestamp: new Date(quote.t * 1000),
            source: 'finnhub',
          };
        });
      },
      getHistoricalBars: async (symbol: string, timeframe: string, start: Date, end: Date): Promise<NormalizedBar[]> => {
        const breaker = this.circuitRegistry.getOrCreate({
          name: 'openbb:finnhub:historical',
          failureThreshold: 5,
          timeout: 60000,
        });

        return breaker.execute(async () => {
          const resolution = this.mapTimeframeToFinnhub(timeframe);
          const url = `${config.baseUrl}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${Math.floor(start.getTime() / 1000)}&to=${Math.floor(end.getTime() / 1000)}&token=${config.apiKey}`;
          
          const dataRaw = await this.fetchJson(url);
          const data = dataRaw as { s: string; t?: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[] };
          
          if (data.s !== 'ok' || !data.t) {
            return [];
          }

          return data.t.map((timestamp: number, i: number) => ({
            symbol,
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i],
            volume: data.v[i],
            timestamp: new Date(timestamp * 1000),
            source: 'finnhub',
          }));
        });
      },
      getNews: async (symbol: string, limit = 20): Promise<NormalizedNews[]> => {
        const breaker = this.circuitRegistry.getOrCreate({
          name: 'openbb:finnhub:news',
          failureThreshold: 5,
          timeout: 30000,
        });

        return breaker.execute(async () => {
          const to = new Date().toISOString().split('T')[0];
          const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const url = `${config.baseUrl}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${config.apiKey}`;
          
          const newsRaw = await this.fetchJson(url);
          const news = newsRaw as Array<{ id: number; headline: string; summary: string; source: string; url: string; datetime: number }>;
          
          return news.slice(0, limit).map((item) => ({
            id: `finnhub_${item.id}`,
            headline: item.headline,
            summary: item.summary,
            source: item.source,
            url: item.url,
            symbols: [symbol],
            publishedAt: new Date(item.datetime * 1000),
            dataSource: 'finnhub',
          }));
        });
      },
    };
  }

  private createAlpacaDataAdapter(): DataProviderAdapter {
    const config: ProviderConfig = {
      name: 'alpaca',
      baseUrl: 'https://data.alpaca.markets',
      apiKey: process.env.ALPACA_API_KEY || '',
      rateLimit: 200,
      priority: 2,
      supportedAssets: ['stock', 'crypto'],
    };

    const headers = {
      'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
      'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY || '',
    };

    return {
      name: 'alpaca',
      config,
      getQuote: async (symbol: string): Promise<NormalizedQuote> => {
        const breaker = this.circuitRegistry.getOrCreate({
          name: 'openbb:alpaca',
          failureThreshold: 5,
          timeout: 30000,
        });

        return breaker.execute(async () => {
          const snapshotRaw = await this.fetchJson(
            `${config.baseUrl}/v2/stocks/${symbol}/snapshot`,
            { headers }
          );
          const snapshot = snapshotRaw as { latestTrade?: { p: number; t: string }; latestQuote?: Record<string, unknown>; dailyBar?: { o: number; h: number; l: number; c: number; v: number }; prevDailyBar?: { c: number } };

          const trade = snapshot.latestTrade || {} as { p?: number; t?: string };
          const quote = snapshot.latestQuote || {};
          const bar = snapshot.dailyBar || {} as { o?: number; h?: number; l?: number; c?: number; v?: number };
          const prevBar = snapshot.prevDailyBar || {} as { c?: number };

          const price = trade.p || bar.c || 0;
          const prevClose = prevBar.c || price;
          const change = price - prevClose;

          return {
            symbol,
            price,
            open: bar.o || price,
            high: bar.h || price,
            low: bar.l || price,
            close: bar.c || price,
            previousClose: prevClose,
            change,
            changePercent: prevClose ? (change / prevClose) * 100 : 0,
            volume: bar.v || 0,
            currency: 'USD',
            timestamp: new Date(trade.t || Date.now()),
            source: 'alpaca',
          };
        });
      },
      getHistoricalBars: async (symbol: string, timeframe: string, start: Date, end: Date): Promise<NormalizedBar[]> => {
        const breaker = this.circuitRegistry.getOrCreate({
          name: 'openbb:alpaca:historical',
          failureThreshold: 5,
          timeout: 60000,
        });

        return breaker.execute(async () => {
          const tf = TIMEFRAME_MAP[timeframe] || timeframe;
          const url = `${config.baseUrl}/v2/stocks/${symbol}/bars?timeframe=${tf}&start=${start.toISOString()}&end=${end.toISOString()}`;
          
          const dataRaw = await this.fetchJson(url, { headers });
          const data = dataRaw as { bars?: Array<{ o: number; h: number; l: number; c: number; v: number; vw: number; n: number; t: string }> };
          
          return (data.bars || []).map((bar) => ({
            symbol,
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v,
            vwap: bar.vw,
            trades: bar.n,
            timestamp: new Date(bar.t),
            source: 'alpaca',
          }));
        });
      },
    };
  }

  private createCryptoAdapter(): DataProviderAdapter {
    const config: ProviderConfig = {
      name: 'coinmarketcap',
      baseUrl: 'https://pro-api.coinmarketcap.com/v1',
      apiKey: process.env.COINMARKETCAP_API_KEY || '',
      rateLimit: 30,
      priority: 1,
      supportedAssets: ['crypto'],
    };

    const headers = {
      'X-CMC_PRO_API_KEY': config.apiKey,
    };

    return {
      name: 'coinmarketcap',
      config,
      getQuote: async (symbol: string): Promise<NormalizedQuote> => {
        const breaker = this.circuitRegistry.getOrCreate({
          name: 'openbb:coinmarketcap',
          failureThreshold: 5,
          timeout: 30000,
        });

        return breaker.execute(async () => {
          const dataRaw = await this.fetchJson(
            `${config.baseUrl}/cryptocurrency/quotes/latest?symbol=${symbol}`,
            { headers }
          );
          const data = dataRaw as { data: Record<string, { name: string; quote: { USD: { price: number; percent_change_24h: number; volume_24h: number; market_cap: number; last_updated: string } } }> };

          const coin = data.data[symbol];
          if (!coin) throw new Error(`Symbol ${symbol} not found`);

          const quote = coin.quote.USD;

          return {
            symbol,
            name: coin.name,
            price: quote.price,
            open: quote.price,
            high: quote.price,
            low: quote.price,
            close: quote.price,
            change: quote.price * (quote.percent_change_24h / 100),
            changePercent: quote.percent_change_24h,
            volume: quote.volume_24h,
            marketCap: quote.market_cap,
            currency: 'USD',
            timestamp: new Date(quote.last_updated),
            source: 'coinmarketcap',
          };
        });
      },
      getHistoricalBars: async (): Promise<NormalizedBar[]> => {
        logger.warn('Historical bars not supported by CoinMarketCap free tier');
        return [];
      },
    };
  }

  async getQuote(symbol: string, preferredSource?: string): Promise<NormalizedQuote> {
    const cacheKey = `quote:${symbol}:${preferredSource || 'any'}`;
    const cached = this.getFromCache<NormalizedQuote>(cacheKey);
    if (cached) return cached;

    const providers = this.getProvidersForSymbol(symbol, preferredSource);
    
    for (const provider of providers) {
      try {
        const quote = await provider.getQuote(symbol);
        this.setCache(cacheKey, quote);
        return quote;
      } catch (error) {
        logger.debug('Provider failed for quote', { 
          provider: provider.name, 
          symbol,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw new Error(`Failed to get quote for ${symbol} from any provider`);
  }

  async getQuotes(symbols: string[]): Promise<NormalizedQuote[]> {
    const results = await Promise.allSettled(
      symbols.map(symbol => this.getQuote(symbol))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<NormalizedQuote> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  async getHistoricalBars(
    symbol: string,
    timeframe: string,
    start: Date,
    end: Date,
    preferredSource?: string
  ): Promise<NormalizedBar[]> {
    const cacheKey = `bars:${symbol}:${timeframe}:${start.getTime()}:${end.getTime()}`;
    const cached = this.getFromCache<NormalizedBar[]>(cacheKey);
    if (cached) return cached;

    const providers = this.getProvidersForSymbol(symbol, preferredSource);
    
    for (const provider of providers) {
      try {
        const bars = await provider.getHistoricalBars(symbol, timeframe, start, end);
        if (bars.length > 0) {
          this.setCache(cacheKey, bars, 60000);
          return bars;
        }
      } catch (error) {
        logger.debug('Provider failed for historical bars', {
          provider: provider.name,
          symbol,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw new Error(`Failed to get historical bars for ${symbol}`);
  }

  async getNews(symbol: string, limit = 20): Promise<NormalizedNews[]> {
    const cacheKey = `news:${symbol}:${limit}`;
    const cached = this.getFromCache<NormalizedNews[]>(cacheKey);
    if (cached) return cached;

    const providers = this.getProvidersForSymbol(symbol);
    
    for (const provider of providers) {
      if (!provider.getNews) continue;
      
      try {
        const news = await provider.getNews(symbol, limit);
        if (news.length > 0) {
          this.setCache(cacheKey, news, 300000);
          return news;
        }
      } catch (error) {
        logger.debug('Provider failed for news', {
          provider: provider.name,
          symbol,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return [];
  }

  async searchSymbols(query: string): Promise<Array<{ symbol: string; name: string; type: AssetClass; exchange?: string }>> {
    const finnhubProvider = this.providers.get('finnhub');
    if (!finnhubProvider) {
      return [];
    }

    const breaker = this.circuitRegistry.getOrCreate({
      name: 'openbb:search',
      failureThreshold: 5,
      timeout: 30000,
    });

    try {
      const dataRaw = await breaker.execute(() =>
        this.fetchJson(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${process.env.FINNHUB_API_KEY}`)
      );
      const data = dataRaw as { result?: Array<{ symbol: string; description: string; type: string; displaySymbol: string }> };

      return (data.result || []).slice(0, 20).map((item) => ({
        symbol: item.symbol,
        name: item.description,
        type: this.mapFinnhubType(item.type),
        exchange: item.displaySymbol,
      }));
    } catch {
      return [];
    }
  }

  getProviderStatus(): Array<{ name: string; healthy: boolean; assetClasses: AssetClass[] }> {
    return Array.from(this.providers.values()).map(provider => {
      const breaker = this.circuitRegistry.get(`openbb:${provider.name}`);
      return {
        name: provider.name,
        healthy: !breaker || breaker.getStats().state === 'CLOSED',
        assetClasses: provider.config.supportedAssets,
      };
    });
  }

  private getProvidersForSymbol(symbol: string, preferredSource?: string): DataProviderAdapter[] {
    const providers = Array.from(this.providers.values());
    
    if (preferredSource) {
      const preferred = providers.find(p => p.name === preferredSource);
      if (preferred) {
        return [preferred, ...providers.filter(p => p.name !== preferredSource)];
      }
    }

    const isCrypto = /^(BTC|ETH|USDT|BNB|XRP|ADA|SOL|DOGE|DOT|MATIC)/i.test(symbol);
    
    return providers
      .filter(p => isCrypto 
        ? p.config.supportedAssets.includes('crypto')
        : p.config.supportedAssets.includes('stock')
      )
      .sort((a, b) => a.config.priority - b.config.priority);
  }

  private mapTimeframeToFinnhub(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '30m': '30',
      '1h': '60',
      '1d': 'D',
      '1w': 'W',
      '1M': 'M',
    };
    return map[timeframe] || 'D';
  }

  private mapFinnhubType(type: string): AssetClass {
    const map: Record<string, AssetClass> = {
      'Common Stock': 'stock',
      'ETF': 'etf',
      'Crypto': 'crypto',
      'FOREX': 'forex',
    };
    return map[type] || 'stock';
  }

  private async fetchJson(url: string, options: RequestInit = {}): Promise<unknown> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      logger.error('API request failed', undefined, { url, status: response.status, body: errorBody.slice(0, 200) });
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody.slice(0, 100)}`);
    }

    const data = await response.json();
    if (data === null || data === undefined) {
      throw new Error('Empty response from API');
    }

    return data;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: unknown, ttlMs = this.cacheTTLMs): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  cleanupCache(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of this.cache) {
      if (value.expiresAt <= now) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
}

export function createOpenBBAdapter(): OpenBBAdapter {
  return new OpenBBAdapter();
}
