import { candidatesService } from "../universe/candidatesService";
import { log } from "../utils/logger";

// FALLBACK_WATCHLIST: Used only when database has no approved/watchlist symbols
// Primary source is candidatesService.getWatchlistSymbols() from the database
const FALLBACK_WATCHLIST = {
  stocks: ["SPY", "QQQ", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM"],
  crypto: ["BTC", "ETH", "SOL"],
};

// Cache for dynamic watchlist with TTL
let cachedWatchlist: { stocks: string[]; crypto: string[] } | null = null;
let watchlistCacheTime: number = 0;
const WATCHLIST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
      log.info("WatchlistCache", `Loaded ${dynamicWatchlist.stocks.length} stocks and ${dynamicWatchlist.crypto.length} crypto from database`);
      return dynamicWatchlist;
    }
  } catch (error) {
    log.warn("WatchlistCache", "Failed to load watchlist from database, using fallback", { error: String(error) });
  }

  // Fallback to hardcoded minimal list
  cachedWatchlist = FALLBACK_WATCHLIST;
  watchlistCacheTime = now;
  return FALLBACK_WATCHLIST;
}

// Synchronous access to current watchlist (for functions that can't be async)
export function getWatchlistSync(): { stocks: string[]; crypto: string[] } {
  return cachedWatchlist || FALLBACK_WATCHLIST;
}

// Force refresh of watchlist cache
export async function refreshWatchlistCache(): Promise<void> {
  cachedWatchlist = null;
  watchlistCacheTime = 0;
  await getWatchlist();
}
