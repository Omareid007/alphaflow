import { z } from 'zod';
import { wrapWithLimiter } from '../lib/rateLimiter';
import { ApiCache } from '../lib/api-cache';
import { log } from '../utils/logger';

const BINANCE_API = 'https://api.binance.com/api/v3';

const cache = new ApiCache<any>({
  freshDuration: 15 * 1000,
  staleDuration: 5 * 60 * 1000,
});

const SYMBOL_MAP: Record<string, string> = {
  'BTC': 'BTCUSDT',
  'ETH': 'ETHUSDT',
  'SOL': 'SOLUSDT',
  'BNB': 'BNBUSDT',
  'XRP': 'XRPUSDT',
  'ADA': 'ADAUSDT',
  'DOGE': 'DOGEUSDT',
  'DOT': 'DOTUSDT',
  'AVAX': 'AVAXUSDT',
  'MATIC': 'MATICUSDT',
  'LINK': 'LINKUSDT',
  'UNI': 'UNIUSDT',
  'LTC': 'LTCUSDT',
  'ATOM': 'ATOMUSDT',
  'ETC': 'ETCUSDT',
  'XLM': 'XLMUSDT',
  'ALGO': 'ALGOUSDT',
  'VET': 'VETUSDT',
  'NEAR': 'NEARUSDT',
  'FTM': 'FTMUSDT',
};

const TickerSchema = z.object({
  symbol: z.string(),
  priceChange: z.string(),
  priceChangePercent: z.string(),
  lastPrice: z.string(),
  volume: z.string(),
  quoteVolume: z.string(),
  highPrice: z.string(),
  lowPrice: z.string(),
  openPrice: z.string(),
  count: z.number().optional(),
});

export interface CryptoQuote {
  symbol: string;
  binanceSymbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  quoteVolume24h: number;
  high24h: number;
  low24h: number;
  open24h: number;
  tradeCount?: number;
  timestamp: Date;
}

export interface CryptoOHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  tradeCount: number;
}

export interface CryptoOrderBook {
  symbol: string;
  lastUpdateId: number;
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
  timestamp: Date;
}

function toBinanceSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.endsWith('USDT')) return upper;
  if (upper.endsWith('USD')) return upper.replace('USD', 'USDT');
  return SYMBOL_MAP[upper] || `${upper}USDT`;
}

function fromBinanceSymbol(binanceSymbol: string): string {
  for (const [key, val] of Object.entries(SYMBOL_MAP)) {
    if (val === binanceSymbol) return key;
  }
  return binanceSymbol.replace('USDT', '');
}

async function fetchBinance(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${BINANCE_API}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return wrapWithLimiter('binance', async () => {
    const response = await fetch(url.toString());
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Binance API error: ${response.status} - ${error.msg || response.statusText}`);
    }
    return response.json();
  });
}

export async function getCryptoQuote(symbol: string): Promise<CryptoQuote | null> {
  const binanceSymbol = toBinanceSymbol(symbol);
  const cacheKey = `binance-quote-${binanceSymbol}`;
  
  const cached = cache.getFresh(cacheKey);
  if (cached) return cached as CryptoQuote;

  try {
    const data = await fetchBinance('/ticker/24hr', { symbol: binanceSymbol });
    const parsed = TickerSchema.parse(data);

    const quote: CryptoQuote = {
      symbol: fromBinanceSymbol(binanceSymbol),
      binanceSymbol,
      price: parseFloat(parsed.lastPrice),
      change24h: parseFloat(parsed.priceChange),
      changePercent24h: parseFloat(parsed.priceChangePercent),
      volume24h: parseFloat(parsed.volume),
      quoteVolume24h: parseFloat(parsed.quoteVolume),
      high24h: parseFloat(parsed.highPrice),
      low24h: parseFloat(parsed.lowPrice),
      open24h: parseFloat(parsed.openPrice),
      tradeCount: parsed.count,
      timestamp: new Date(),
    };

    cache.set(cacheKey, quote);
    log.debug('Binance', `Quote for ${symbol}: $${quote.price} (${quote.changePercent24h.toFixed(2)}%)`);
    return quote;
  } catch (error) {
    log.error('Binance', `Failed to fetch quote for ${symbol}: ${(error as Error).message}`);
    return null;
  }
}

export async function getCryptoOHLCV(
  symbol: string,
  interval: '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M' = '1h',
  limit: number = 100
): Promise<CryptoOHLCV[]> {
  const binanceSymbol = toBinanceSymbol(symbol);
  const cacheKey = `binance-ohlcv-${binanceSymbol}-${interval}-${limit}`;
  
  const cached = cache.getFresh(cacheKey);
  if (cached) return cached as CryptoOHLCV[];

  try {
    const data = await fetchBinance('/klines', {
      symbol: binanceSymbol,
      interval,
      limit: String(limit),
    });

    const ohlcv: CryptoOHLCV[] = data.map((k: any[]) => ({
      timestamp: new Date(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      quoteVolume: parseFloat(k[7]),
      tradeCount: k[8],
    }));

    cache.set(cacheKey, ohlcv);
    log.debug('Binance', `Fetched ${ohlcv.length} OHLCV bars for ${symbol}`);
    return ohlcv;
  } catch (error) {
    log.error('Binance', `Failed to fetch OHLCV for ${symbol}: ${(error as Error).message}`);
    return [];
  }
}

export async function getOrderBook(symbol: string, limit: number = 10): Promise<CryptoOrderBook | null> {
  const binanceSymbol = toBinanceSymbol(symbol);

  try {
    const data = await fetchBinance('/depth', {
      symbol: binanceSymbol,
      limit: String(Math.min(limit, 100)),
    });

    return {
      symbol: fromBinanceSymbol(binanceSymbol),
      lastUpdateId: data.lastUpdateId,
      bids: data.bids.map((b: string[]) => ({
        price: parseFloat(b[0]),
        quantity: parseFloat(b[1]),
      })),
      asks: data.asks.map((a: string[]) => ({
        price: parseFloat(a[0]),
        quantity: parseFloat(a[1]),
      })),
      timestamp: new Date(),
    };
  } catch (error) {
    log.error('Binance', `Failed to fetch order book for ${symbol}: ${(error as Error).message}`);
    return null;
  }
}

export async function getMultipleQuotes(symbols: string[]): Promise<Map<string, CryptoQuote>> {
  const results = new Map<string, CryptoQuote>();
  const cacheKey = 'binance-all-tickers';

  try {
    let allTickers: any[];
    
    const cached = cache.getFresh(cacheKey);
    if (cached) {
      allTickers = cached as any[];
    } else {
      allTickers = await fetchBinance('/ticker/24hr');
      cache.set(cacheKey, allTickers);
    }
    
    const tickerMap = new Map(allTickers.map((t: any) => [t.symbol, t]));

    for (const symbol of symbols) {
      const binanceSymbol = toBinanceSymbol(symbol);
      const ticker = tickerMap.get(binanceSymbol);
      
      if (ticker) {
        try {
          const parsed = TickerSchema.parse(ticker);
          results.set(symbol.toUpperCase(), {
            symbol: symbol.toUpperCase(),
            binanceSymbol,
            price: parseFloat(parsed.lastPrice),
            change24h: parseFloat(parsed.priceChange),
            changePercent24h: parseFloat(parsed.priceChangePercent),
            volume24h: parseFloat(parsed.volume),
            quoteVolume24h: parseFloat(parsed.quoteVolume),
            high24h: parseFloat(parsed.highPrice),
            low24h: parseFloat(parsed.lowPrice),
            open24h: parseFloat(parsed.openPrice),
            tradeCount: parsed.count,
            timestamp: new Date(),
          });
        } catch {
          continue;
        }
      }
    }
  } catch (error) {
    log.error('Binance', `Failed to fetch multiple quotes: ${(error as Error).message}`);
  }

  return results;
}

export async function getExchangeInfo(): Promise<{
  symbols: Array<{
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    status: string;
  }>;
}> {
  const cacheKey = 'binance-exchange-info';
  
  const cached = cache.getFresh(cacheKey);
  if (cached) return cached as any;

  try {
    const data = await fetchBinance('/exchangeInfo');
    
    const info = {
      symbols: data.symbols.map((s: any) => ({
        symbol: s.symbol,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
        status: s.status,
      })),
    };
    
    cache.set(cacheKey, info);
    return info;
  } catch (error) {
    log.error('Binance', `Failed to fetch exchange info: ${(error as Error).message}`);
    return { symbols: [] };
  }
}

export async function getServerTime(): Promise<number> {
  const data = await fetchBinance('/time');
  return data.serverTime;
}

class BinanceConnector {
  async getQuote(symbol: string): Promise<CryptoQuote | null> {
    return getCryptoQuote(symbol);
  }

  async getOHLCV(
    symbol: string,
    interval?: '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M',
    limit?: number
  ): Promise<CryptoOHLCV[]> {
    return getCryptoOHLCV(symbol, interval, limit);
  }

  async getOrderBook(symbol: string, limit?: number): Promise<CryptoOrderBook | null> {
    return getOrderBook(symbol, limit);
  }

  async getMultipleQuotes(symbols: string[]): Promise<Map<string, CryptoQuote>> {
    return getMultipleQuotes(symbols);
  }

  async getExchangeInfo(): Promise<any> {
    return getExchangeInfo();
  }

  toBinanceSymbol(symbol: string): string {
    return toBinanceSymbol(symbol);
  }

  fromBinanceSymbol(binanceSymbol: string): string {
    return fromBinanceSymbol(binanceSymbol);
  }
}

export const binanceConnector = new BinanceConnector();
export default binanceConnector;
