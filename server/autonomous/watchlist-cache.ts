/**
 * @module autonomous/watchlist-cache
 * @description Watchlist Caching Utilities
 *
 * Provides caching layer for trading watchlist symbols with TTL-based invalidation.
 * Reduces database load by caching watchlist for 5 minutes while ensuring fresh
 * data availability.
 *
 * Features:
 * - 5-minute TTL cache for watchlist symbols
 * - Automatic fallback to hardcoded watchlist if database is unavailable
 * - Both async and sync access methods
 * - Manual cache refresh capability
 */

import { candidatesService } from "../universe/candidatesService";
import { log } from "../utils/logger";

/**
 * Fallback watchlist used when database has no approved/watchlist symbols.
 *
 * Primary source is candidatesService.getWatchlistSymbols() from the database.
 * This serves as a safety net to ensure trading can continue even if database
 * is unavailable or empty.
 *
 * @constant
 * @type {{ stocks: string[], crypto: string[] }}
 * @private
 */
const FALLBACK_WATCHLIST = {
  stocks: [
    "SPY",
    "QQQ",
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "NVDA",
    "META",
    "TSLA",
    "JPM",
  ],
  crypto: ["BTC", "ETH", "SOL"],
};

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
 *
 * @constant
 * @type {number}
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
 * Side effects:
 * - Updates cachedWatchlist on successful database fetch
 * - Updates watchlistCacheTime
 * - Logs watchlist load info and warnings
 *
 * @returns {Promise<{ stocks: string[], crypto: string[] }>} Object containing arrays of stock and crypto symbols
 *
 * @example
 * const watchlist = await getWatchlist();
 * console.log(watchlist.stocks); // ["AAPL", "MSFT", ...]
 * console.log(watchlist.crypto); // ["BTC", "ETH", ...]
 */
export async function getWatchlist(): Promise<{
  stocks: string[];
  crypto: string[];
}> {
  const now = Date.now();

  // Return cached if still valid
  if (cachedWatchlist && now - watchlistCacheTime < WATCHLIST_CACHE_TTL_MS) {
    return cachedWatchlist;
  }

  try {
    const dynamicWatchlist = await candidatesService.getWatchlistSymbols();

    // If database has symbols, use them; otherwise fall back to defaults
    if (
      dynamicWatchlist.stocks.length > 0 ||
      dynamicWatchlist.crypto.length > 0
    ) {
      cachedWatchlist = dynamicWatchlist;
      watchlistCacheTime = now;
      log.info(
        "WatchlistCache",
        `Loaded ${dynamicWatchlist.stocks.length} stocks and ${dynamicWatchlist.crypto.length} crypto from database`
      );
      return dynamicWatchlist;
    }
  } catch (error) {
    log.warn(
      "WatchlistCache",
      "Failed to load watchlist from database, using fallback",
      { error: String(error) }
    );
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
 * yet. Call getWatchlist() first in async contexts to ensure fresh data.
 *
 * @returns {{ stocks: string[], crypto: string[] }} Cached watchlist or fallback
 *
 * @example
 * // In sync context
 * const watchlist = getWatchlistSync();
 * const hasSymbol = watchlist.stocks.includes("AAPL");
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
 * - Resets watchlistCacheTime to 0
 * - Fetches fresh data from database via getWatchlist()
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
