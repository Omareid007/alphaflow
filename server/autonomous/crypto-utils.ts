/**
 * Crypto Symbol Utilities
 *
 * Helper functions for detecting and normalizing cryptocurrency symbols.
 * Crypto symbols can be in multiple formats:
 * - Bare ticker: BTC, ETH, SOL
 * - USD pair with slash: BTC/USD, ETH/USD
 * - USD pair without slash: BTCUSD, ETHUSD
 */

import { candidatesService } from "../universe/candidatesService";

// ============================================================================
// FALLBACK WATCHLIST
// ============================================================================

/**
 * FALLBACK_WATCHLIST: Used only when database has no approved/watchlist symbols
 * Primary source is candidatesService.getWatchlistSymbols() from the database
 */
const FALLBACK_WATCHLIST = {
  stocks: ["SPY", "QQQ", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM"],
  crypto: ["BTC", "ETH", "SOL"],
};

// ============================================================================
// WATCHLIST CACHE
// ============================================================================

let cachedWatchlist: { stocks: string[]; crypto: string[] } | null = null;
let watchlistCacheTime: number = 0;
const WATCHLIST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the current watchlist from database (with caching)
 */
export async function getWatchlist(): Promise<{ stocks: string[]; crypto: string[] }> {
  const now = Date.now();

  // Return cached if still valid
  if (cachedWatchlist && (now - watchlistCacheTime) < WATCHLIST_CACHE_TTL_MS) {
    return cachedWatchlist;
  }

  try {
    const dynamicWatchlist = await candidatesService.getWatchlistSymbols();

    // If database has symbols, use them; otherwise fall back to defaults
    if (dynamicWatchlist.stocks.length > 0 || dynamicWatchlist.crypto.length > 0) {
      cachedWatchlist = dynamicWatchlist;
      watchlistCacheTime = now;
      return dynamicWatchlist;
    }
  } catch (error) {
    // Silently fall back to defaults on error
  }

  // Fallback to hardcoded minimal list
  cachedWatchlist = FALLBACK_WATCHLIST;
  watchlistCacheTime = now;
  return FALLBACK_WATCHLIST;
}

/**
 * Synchronous access to current watchlist (for functions that can't be async)
 */
export function getWatchlistSync(): { stocks: string[]; crypto: string[] } {
  return cachedWatchlist || FALLBACK_WATCHLIST;
}

/**
 * Force refresh of watchlist cache
 */
export async function refreshWatchlistCache(): Promise<void> {
  cachedWatchlist = null;
  watchlistCacheTime = 0;
  await getWatchlist();
}

// ============================================================================
// CRYPTO SYMBOL UTILITIES
// ============================================================================

/**
 * Check if a symbol represents a cryptocurrency
 *
 * @param symbol - The symbol to check (e.g., "BTC", "BTC/USD", "BTCUSD")
 * @returns true if the symbol is a cryptocurrency
 *
 * @example
 * isCryptoSymbol("BTC")      // true
 * isCryptoSymbol("BTC/USD")  // true
 * isCryptoSymbol("BTCUSD")   // true
 * isCryptoSymbol("AAPL")     // false
 */
export function isCryptoSymbol(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase();
  const watchlist = getWatchlistSync();

  // Check bare tickers
  if (watchlist.crypto.includes(upperSymbol)) return true;

  // Check USD pairs (e.g., BTC/USD, BTCUSD)
  const cryptoPairs = watchlist.crypto.flatMap(c => [`${c}/USD`, `${c}USD`]);
  return cryptoPairs.includes(upperSymbol) ||
         (symbol.includes("/") && upperSymbol.endsWith("USD"));
}

/**
 * Normalize a crypto symbol to the standard format (BASE/USD)
 *
 * @param symbol - The symbol to normalize (e.g., "BTC", "BTCUSD", "BTC/USD")
 * @returns Normalized symbol in BASE/USD format
 *
 * @example
 * normalizeCryptoSymbol("BTC")      // "BTC/USD"
 * normalizeCryptoSymbol("BTCUSD")   // "BTC/USD"
 * normalizeCryptoSymbol("BTC/USD")  // "BTC/USD"
 */
export function normalizeCryptoSymbol(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();
  const watchlist = getWatchlistSync();

  // Already in correct format
  if (upperSymbol.includes("/")) return upperSymbol;

  // Bare ticker (BTC -> BTC/USD)
  if (watchlist.crypto.includes(upperSymbol)) return `${upperSymbol}/USD`;

  // BTCUSD format -> BTC/USD
  if (upperSymbol.endsWith("USD") && upperSymbol.length > 3) {
    const base = upperSymbol.slice(0, -3);
    return `${base}/USD`;
  }

  return upperSymbol;
}
