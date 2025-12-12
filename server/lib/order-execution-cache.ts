import { ApiCache } from './api-cache';

interface QuickQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  timestamp: number;
}

interface AssetTradability {
  symbol: string;
  tradable: boolean;
  fractionable: boolean;
  shortable: boolean;
  marginable: boolean;
  timestamp: number;
}

interface AccountSnapshot {
  buyingPower: number;
  cash: number;
  equity: number;
  timestamp: number;
}

const quickQuoteCache = new ApiCache<QuickQuote>({
  freshDuration: 5 * 1000,
  staleDuration: 30 * 1000,
  maxEntries: 500,
});

const tradabilityCache = new ApiCache<AssetTradability>({
  freshDuration: 5 * 60 * 1000,
  staleDuration: 60 * 60 * 1000,
  maxEntries: 1000,
});

const accountSnapshotCache = new ApiCache<AccountSnapshot>({
  freshDuration: 10 * 1000,
  staleDuration: 60 * 1000,
  maxEntries: 1,
});

export function cacheQuickQuote(quote: QuickQuote): void {
  quickQuoteCache.set(quote.symbol, quote);
}

export function getQuickQuote(symbol: string): QuickQuote | null {
  const result = quickQuoteCache.get(symbol);
  return result?.data ?? null;
}

export function getCachedPrice(symbol: string): number | null {
  const quote = getQuickQuote(symbol);
  return quote?.price ?? null;
}

export function cacheTradability(asset: AssetTradability): void {
  tradabilityCache.set(asset.symbol, asset);
}

export function getTradability(symbol: string): AssetTradability | null {
  const result = tradabilityCache.get(symbol);
  return result?.data ?? null;
}

export function isTradable(symbol: string): boolean | null {
  const asset = getTradability(symbol);
  return asset?.tradable ?? null;
}

export function cacheAccountSnapshot(snapshot: AccountSnapshot): void {
  accountSnapshotCache.set('account', snapshot);
}

export function getAccountSnapshot(): AccountSnapshot | null {
  const result = accountSnapshotCache.get('account');
  return result?.data ?? null;
}

export function getCachedBuyingPower(): number | null {
  const snapshot = getAccountSnapshot();
  return snapshot?.buyingPower ?? null;
}

export function preloadOrderValidationData(
  symbols: string[],
  getQuote: (symbol: string) => Promise<{ price: number; bid: number; ask: number }>,
  getAsset: (symbol: string) => Promise<{ tradable: boolean; fractionable: boolean; shortable: boolean; marginable: boolean }>,
  getAccount: () => Promise<{ buying_power: string; cash: string; equity: string }>
): Promise<void> {
  const now = Date.now();
  
  const quotePromises = symbols.map(async (symbol) => {
    const cached = getQuickQuote(symbol);
    if (cached) return;
    
    try {
      const quote = await getQuote(symbol);
      cacheQuickQuote({
        symbol,
        price: quote.price,
        bid: quote.bid,
        ask: quote.ask,
        spread: quote.ask - quote.bid,
        timestamp: now,
      });
    } catch {
    }
  });
  
  const assetPromises = symbols.map(async (symbol) => {
    const cached = getTradability(symbol);
    if (cached) return;
    
    try {
      const asset = await getAsset(symbol);
      cacheTradability({
        symbol,
        tradable: asset.tradable,
        fractionable: asset.fractionable,
        shortable: asset.shortable,
        marginable: asset.marginable,
        timestamp: now,
      });
    } catch {
    }
  });
  
  const accountPromise = (async () => {
    const cached = getAccountSnapshot();
    if (cached) return;
    
    try {
      const account = await getAccount();
      cacheAccountSnapshot({
        buyingPower: parseFloat(account.buying_power),
        cash: parseFloat(account.cash),
        equity: parseFloat(account.equity),
        timestamp: now,
      });
    } catch {
    }
  })();
  
  return Promise.all([...quotePromises, ...assetPromises, accountPromise]).then(() => {});
}

export function clearOrderCaches(): void {
  quickQuoteCache.clear();
  tradabilityCache.clear();
  accountSnapshotCache.clear();
}

export function getOrderCacheStats(): {
  quotes: number;
  tradability: number;
  hasAccountSnapshot: boolean;
} {
  return {
    quotes: quickQuoteCache.size(),
    tradability: tradabilityCache.size(),
    hasAccountSnapshot: accountSnapshotCache.has('account'),
  };
}
