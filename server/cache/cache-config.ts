/**
 * Cache Configuration
 *
 * Defines TTL, size limits, and other configuration for each cache namespace.
 * Used by the unified cache layer for consistent caching behavior.
 */

export interface CacheNamespaceConfig {
  namespace: string;
  l1TTL: number; // L1 (memory) TTL in milliseconds
  l2TTL: number; // L2 (persistent) TTL in milliseconds
  maxL1Size: number; // Maximum entries in L1 cache
  compression?: boolean; // Whether to compress values in L2
}

/**
 * Cache namespace configurations
 *
 * Each namespace has specific TTL values based on data characteristics:
 * - High-frequency, low-latency data (quotes, positions) → short TTL, in-memory priority
 * - Computed/expensive data (indicators, LLM) → longer TTL
 * - Reference data (fundamentals, news) → longest TTL
 */
export const CACHE_NAMESPACES: Record<string, CacheNamespaceConfig> = {
  // Real-time market data (30s fresh)
  marketData: {
    namespace: "mkt",
    l1TTL: 30 * 1000,
    l2TTL: 60 * 1000,
    maxL1Size: 1000,
    compression: false,
  },

  // Price quotes (30s fresh for consistent behavior with existing caches)
  quotes: {
    namespace: "qt",
    l1TTL: 30 * 1000,
    l2TTL: 60 * 1000,
    maxL1Size: 500,
    compression: false,
  },

  // News and sentiment data (30 min fresh)
  news: {
    namespace: "news",
    l1TTL: 30 * 60 * 1000,
    l2TTL: 60 * 60 * 1000,
    maxL1Size: 200,
    compression: true,
  },

  // LLM responses (5 min fresh, 30 min stale)
  llmResponses: {
    namespace: "llm",
    l1TTL: 5 * 60 * 1000,
    l2TTL: 30 * 60 * 1000,
    maxL1Size: 100,
    compression: true,
  },

  // Technical indicators (60s fresh)
  indicators: {
    namespace: "ind",
    l1TTL: 60 * 1000,
    l2TTL: 5 * 60 * 1000,
    maxL1Size: 500,
    compression: false,
  },

  // Order status and execution data (10s fresh)
  orders: {
    namespace: "ord",
    l1TTL: 10 * 1000,
    l2TTL: 60 * 1000,
    maxL1Size: 200,
    compression: false,
  },

  // Fundamental data (1 hour fresh)
  fundamentals: {
    namespace: "fund",
    l1TTL: 60 * 60 * 1000,
    l2TTL: 4 * 60 * 60 * 1000,
    maxL1Size: 100,
    compression: true,
  },

  // Trading account data (5s fresh for real-time buying power)
  tradingAccount: {
    namespace: "trd-acct",
    l1TTL: 5 * 1000,
    l2TTL: 30 * 1000,
    maxL1Size: 10,
    compression: false,
  },

  // Trading positions (5s fresh for position tracking)
  tradingPositions: {
    namespace: "trd-pos",
    l1TTL: 5 * 1000,
    l2TTL: 30 * 1000,
    maxL1Size: 100,
    compression: false,
  },

  // Quick quotes for order validation (5s fresh)
  tradingQuotes: {
    namespace: "trd-qt",
    l1TTL: 5 * 1000,
    l2TTL: 30 * 1000,
    maxL1Size: 500,
    compression: false,
  },

  // Asset tradability info (5 min fresh)
  tradingAssets: {
    namespace: "trd-asset",
    l1TTL: 5 * 60 * 1000,
    l2TTL: 60 * 60 * 1000,
    maxL1Size: 1000,
    compression: false,
  },
};

/**
 * Cache statistics and maintenance intervals
 */
export const CACHE_STATS_INTERVAL = 60 * 1000; // Log stats every minute
export const L1_CLEANUP_INTERVAL = 30 * 1000; // Clean expired L1 entries every 30s
