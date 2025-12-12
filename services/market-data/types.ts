/**
 * AI Active Trader - Market Data Service Types
 * Shared types for market data connectors and normalized data structures
 */

export enum ConnectorType {
  FINNHUB = 'finnhub',
  ALPACA = 'alpaca',
  COINGECKO = 'coingecko',
  POLYGON = 'polygon',
  TWELVEDATA = 'twelvedata',
  NEWSAPI = 'newsapi',
}

export interface MarketQuote {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: string;
  source: ConnectorType;
}

export interface MarketBar {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '1d';
  source: ConnectorType;
}

export interface MarketNews {
  id: string;
  symbol: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  imageUrl?: string;
  category: string;
  sentiment?: number;
  publishedAt: string;
  connectorSource: ConnectorType;
}

export interface CompanyProfile {
  symbol: string;
  name: string;
  country: string;
  currency: string;
  exchange: string;
  industry: string;
  marketCap: number;
  logo?: string;
  weburl?: string;
  source: ConnectorType;
}

export interface FinnhubQuote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface FinnhubCandle {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  s: string;
  t: number[];
  v: number[];
}

export interface FinnhubNews {
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

export interface FinnhubProfile {
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

export function normalizeQuote(raw: FinnhubQuote, symbol: string): MarketQuote {
  return {
    symbol: symbol.toUpperCase(),
    currentPrice: raw.c,
    change: raw.d,
    changePercent: raw.dp,
    high: raw.h,
    low: raw.l,
    open: raw.o,
    previousClose: raw.pc,
    timestamp: new Date(raw.t * 1000).toISOString(),
    source: ConnectorType.FINNHUB,
  };
}

export function normalizeBars(raw: FinnhubCandle, symbol: string, timeframe: MarketBar['timeframe'] = '1d'): MarketBar[] {
  if (raw.s !== 'ok' || !raw.t || raw.t.length === 0) {
    return [];
  }

  return raw.t.map((timestamp, i) => ({
    symbol: symbol.toUpperCase(),
    open: raw.o[i],
    high: raw.h[i],
    low: raw.l[i],
    close: raw.c[i],
    volume: raw.v[i],
    timestamp: new Date(timestamp * 1000).toISOString(),
    timeframe,
    source: ConnectorType.FINNHUB,
  }));
}

export function normalizeNews(raw: FinnhubNews[], symbol: string): MarketNews[] {
  return raw.map(item => ({
    id: String(item.id),
    symbol: symbol.toUpperCase(),
    headline: item.headline,
    summary: item.summary,
    source: item.source,
    url: item.url,
    imageUrl: item.image || undefined,
    category: item.category,
    publishedAt: new Date(item.datetime * 1000).toISOString(),
    connectorSource: ConnectorType.FINNHUB,
  }));
}

export function normalizeProfile(raw: FinnhubProfile): CompanyProfile {
  return {
    symbol: raw.ticker,
    name: raw.name,
    country: raw.country,
    currency: raw.currency,
    exchange: raw.exchange,
    industry: raw.finnhubIndustry,
    marketCap: raw.marketCapitalization,
    logo: raw.logo || undefined,
    weburl: raw.weburl || undefined,
    source: ConnectorType.FINNHUB,
  };
}
