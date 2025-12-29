/**
 * @module autonomous/crypto-utils
 * @description Crypto Symbol Utilities
 *
 * Helper functions for detecting and normalizing cryptocurrency symbols.
 * Handles multiple symbol formats:
 * - Bare ticker: BTC, ETH, SOL
 * - USD pair with slash: BTC/USD, ETH/USD
 * - USD pair without slash: BTCUSD, ETHUSD
 *
 * This module also provides watchlist caching functionality with a 5-minute TTL
 * to minimize database queries while keeping symbol lists reasonably fresh.
 */

import { candidatesService } from "../universe/candidatesService";

// ============================================================================
// FALLBACK WATCHLIST
// ============================================================================

/**
 * Fallback watchlist used when database has no approved/watchlist symbols.
 *
 * Primary source is candidatesService.getWatchlistSymbols() from the database.
 * This hardcoded list serves as a safety net to ensure trading can continue
 * even if database is empty or unavailable.
 *
 * @constant
 * @type {{ stocks: string[], crypto: string[] }}
 * @private
 */
const FALLBACK_WATCHLIST = {
  stocks: ["SPY", "QQQ", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM"],
  crypto: ["BTC", "ETH", "SOL"],
};

// ============================================================================
// WATCHLIST CACHE
// ============================================================================

/**
 * Cached watchlist to minimize database queries.
 * @private
 */
let cachedWatchlist: { stocks: string[]; crypto: string[] } | null = null;

/**
 * Timestamp of when the watchlist was last cached.
 * @private
 */
let watchlistCacheTime: number = 0;

/**
 * Time-to-live for watchlist cache in milliseconds (5 minutes).
 * After this period, the cache will be refreshed from the database.
 * @constant
 * @private
 */
const WATCHLIST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the current watchlist from database with caching.
 *
 * Fetches the watchlist from the database via candidatesService, with a 5-minute
 * cache to reduce database load. Falls back to FALLBACK_WATCHLIST if the database
 * is empty or unavailable.
 *
 * @returns {Promise<{ stocks: string[], crypto: string[] }>} Object containing arrays of stock and crypto symbols
 *
 * @example
 * const watchlist = await getWatchlist();
 * console.log(watchlist.stocks); // ["AAPL", "MSFT", ...]
 * console.log(watchlist.crypto); // ["BTC", "ETH", ...]
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
 * Synchronous access to current watchlist.
 *
 * Returns the cached watchlist without making database calls. Use this in
 * synchronous contexts where async operations aren't possible. If no cache
 * exists, returns FALLBACK_WATCHLIST.
 *
 * Note: This function may return stale data if the cache hasn't been populated
 * yet. Call getWatchlist() first to ensure fresh data.
 *
 * @returns {{ stocks: string[], crypto: string[] }} Cached watchlist or fallback
 *
 * @example
 * const watchlist = getWatchlistSync();
 * const isCrypto = watchlist.crypto.includes("BTC");
 */
export function getWatchlistSync(): { stocks: string[]; crypto: string[] } {
  return cachedWatchlist || FALLBACK_WATCHLIST;
}

/**
 * Force refresh of watchlist cache.
 *
 * Invalidates the current cache and immediately fetches fresh data from the database.
 * Use this when you know the watchlist has changed and need to bypass the TTL.
 *
 * Side effects:
 * - Clears cachedWatchlist
 * - Resets watchlistCacheTime
 * - Fetches fresh data from database
 *
 * @returns {Promise<void>}
 *
 * @example
 * // After updating watchlist in database
 * await refreshWatchlistCache();
 * const freshWatchlist = getWatchlistSync();
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
 * Check if a symbol represents a cryptocurrency.
 *
 * Checks against the cached watchlist to determine if a symbol is crypto.
 * Handles multiple symbol formats:
 * - Bare ticker (BTC)
 * - Slash-separated USD pair (BTC/USD)
 * - Concatenated USD pair (BTCUSD)
 *
 * @param {string} symbol - The symbol to check (e.g., "BTC", "BTC/USD", "BTCUSD")
 * @returns {boolean} true if the symbol is a cryptocurrency, false otherwise
 *
 * @example
 * isCryptoSymbol("BTC")      // true
 * isCryptoSymbol("BTC/USD")  // true
 * isCryptoSymbol("BTCUSD")   // true
 * isCryptoSymbol("AAPL")     // false
 * isCryptoSymbol("eth")      // true (case-insensitive)
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
 * Normalize a crypto symbol to the standard format (BASE/USD).
 *
 * Converts various crypto symbol formats to the standardized slash-separated
 * format used by most crypto exchanges (e.g., "BTC/USD").
 *
 * Handles these input formats:
 * - Already normalized: "BTC/USD" -> "BTC/USD"
 * - Bare ticker: "BTC" -> "BTC/USD"
 * - Concatenated: "BTCUSD" -> "BTC/USD"
 *
 * @param {string} symbol - The symbol to normalize (e.g., "BTC", "BTCUSD", "BTC/USD")
 * @returns {string} Normalized symbol in BASE/USD format
 *
 * @example
 * normalizeCryptoSymbol("BTC")      // "BTC/USD"
 * normalizeCryptoSymbol("BTCUSD")   // "BTC/USD"
 * normalizeCryptoSymbol("BTC/USD")  // "BTC/USD"
 * normalizeCryptoSymbol("eth")      // "ETH/USD" (case-insensitive)
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
