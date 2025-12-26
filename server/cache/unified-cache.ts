/**
 * Unified Cache Layer
 *
 * Two-tier cache architecture:
 * - L1 (Hot): In-memory Map for ultra-fast access
 * - L2 (Warm): Database-backed persistent cache for longer-lived data
 *
 * Features:
 * - Namespace-based organization with configurable TTLs
 * - Cache-aside pattern support via getOrFetch
 * - Automatic L1→L2 promotion on L2 hits
 * - LRU eviction when L1 reaches capacity
 * - Hit/miss statistics per namespace
 * - Pattern-based invalidation
 */

import { db } from '../db';
import { externalApiCacheEntries } from '@shared/schema';
import { eq, and, lt } from 'drizzle-orm';
import { log } from '../utils/logger';
import {
  CACHE_NAMESPACES,
  CacheNamespaceConfig,
  CACHE_STATS_INTERVAL,
  L1_CLEANUP_INTERVAL,
} from './cache-config';

interface L1Entry<T> {
  value: T;
  expiresAt: number;
  hits: number;
  lastAccessedAt: number;
}

interface CacheStats {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  l1Size: number;
  l2Writes: number;
  l2WriteErrors: number;
}

/**
 * Unified Cache Manager
 *
 * Manages a two-tier cache with in-memory (L1) and persistent (L2) layers.
 */
export class UnifiedCache {
  private l1Cache: Map<string, L1Entry<unknown>> = new Map();
  private stats: Record<string, CacheStats> = {};
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  constructor() {
    this.initializeStats();
  }

  /**
   * Initialize the cache and start background tasks
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.startCleanup();
    this.startStatsLogging();
    this.initialized = true;

    log.info('UnifiedCache', 'Cache layer initialized');
  }

  /**
   * Initialize statistics for all namespaces
   */
  private initializeStats(): void {
    Object.keys(CACHE_NAMESPACES).forEach((namespace) => {
      this.stats[namespace] = {
        l1Hits: 0,
        l1Misses: 0,
        l2Hits: 0,
        l2Misses: 0,
        l1Size: 0,
        l2Writes: 0,
        l2WriteErrors: 0,
      };
    });
  }

  /**
   * Build full cache key from namespace and key
   */
  private getFullKey(namespace: string, key: string): string {
    const config = CACHE_NAMESPACES[namespace];
    if (!config) {
      log.warn('UnifiedCache', `Unknown namespace: ${namespace}, using as-is`);
      return `${namespace}:${key}`;
    }
    return `${config.namespace}:${key}`;
  }

  /**
   * Get configuration for a namespace
   */
  private getConfig(namespace: string): CacheNamespaceConfig {
    return (
      CACHE_NAMESPACES[namespace] || {
        namespace: namespace,
        l1TTL: 60 * 1000,
        l2TTL: 5 * 60 * 1000,
        maxL1Size: 100,
        compression: false,
      }
    );
  }

  /**
   * Get value from cache (L1 → L2 → miss)
   *
   * @param namespace Cache namespace
   * @param key Cache key
   * @returns Cached value or null if not found/expired
   */
  async get<T>(namespace: string, key: string): Promise<T | null> {
    const fullKey = this.getFullKey(namespace, key);
    const config = this.getConfig(namespace);
    const now = Date.now();

    // Check L1 (memory)
    const l1Entry = this.l1Cache.get(fullKey) as L1Entry<T> | undefined;
    if (l1Entry && l1Entry.expiresAt > now) {
      l1Entry.hits++;
      l1Entry.lastAccessedAt = now;
      this.stats[namespace].l1Hits++;
      return l1Entry.value;
    }

    // Remove expired L1 entry
    if (l1Entry) {
      this.l1Cache.delete(fullKey);
    }
    this.stats[namespace].l1Misses++;

    // Check L2 (database)
    try {
      const result = await db
        .select()
        .from(externalApiCacheEntries)
        .where(
          and(
            eq(externalApiCacheEntries.provider, namespace),
            eq(externalApiCacheEntries.cacheKey, key)
          )
        )
        .limit(1);

      if (result.length > 0) {
        const entry = result[0];
        const expiresAt = entry.staleUntilAt.getTime();

        // Check if still valid
        if (now < expiresAt) {
          const data = JSON.parse(entry.responseJson) as T;

          // Promote to L1
          this.setL1(namespace, key, data, config);

          // Update access stats in L2
          await db
            .update(externalApiCacheEntries)
            .set({
              hitCount: entry.hitCount + 1,
              lastAccessedAt: new Date(now),
            })
            .where(eq(externalApiCacheEntries.id, entry.id))
            .catch((err) => {
              log.warn('UnifiedCache', `Failed to update L2 stats: ${err}`);
            });

          this.stats[namespace].l2Hits++;
          return data;
        } else {
          // Expired, delete from L2
          await db
            .delete(externalApiCacheEntries)
            .where(eq(externalApiCacheEntries.id, entry.id))
            .catch((err) => {
              log.warn('UnifiedCache', `Failed to delete expired L2 entry: ${err}`);
            });
        }
      }
    } catch (error) {
      log.warn('UnifiedCache', `L2 get error for ${fullKey}: ${error}`);
    }

    this.stats[namespace].l2Misses++;
    return null;
  }

  /**
   * Set value in cache (L1 + L2)
   *
   * @param namespace Cache namespace
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Optional TTL override in milliseconds
   */
  async set<T>(
    namespace: string,
    key: string,
    value: T,
    ttl?: number
  ): Promise<void> {
    const config = this.getConfig(namespace);

    // Set L1
    this.setL1(namespace, key, value, config, ttl);

    // Set L2 (async, don't block)
    this.setL2(namespace, key, value, config, ttl).catch((err) => {
      log.warn('UnifiedCache', `L2 set error for ${namespace}:${key}: ${err}`);
      this.stats[namespace].l2WriteErrors++;
    });
  }

  /**
   * Set value in L1 cache
   */
  private setL1<T>(
    namespace: string,
    key: string,
    value: T,
    config: CacheNamespaceConfig,
    ttl?: number
  ): void {
    const fullKey = this.getFullKey(namespace, key);
    const now = Date.now();
    const effectiveTTL = ttl ?? config.l1TTL;

    // Evict if over capacity (LRU)
    const namespaceEntries = Array.from(this.l1Cache.entries()).filter(([k]) =>
      k.startsWith(`${config.namespace}:`)
    );

    if (namespaceEntries.length >= config.maxL1Size) {
      // Find least recently accessed entry
      const lru = namespaceEntries.reduce((min, curr) =>
        curr[1].lastAccessedAt < min[1].lastAccessedAt ? curr : min
      );
      this.l1Cache.delete(lru[0]);
    }

    this.l1Cache.set(fullKey, {
      value,
      expiresAt: now + effectiveTTL,
      hits: 0,
      lastAccessedAt: now,
    });

    this.updateL1Size(namespace);
  }

  /**
   * Set value in L2 cache
   */
  private async setL2<T>(
    namespace: string,
    key: string,
    value: T,
    config: CacheNamespaceConfig,
    ttl?: number
  ): Promise<void> {
    const now = Date.now();
    const effectiveTTL = ttl ?? config.l2TTL;
    const expiresAt = new Date(now + effectiveTTL);
    const staleUntilAt = expiresAt; // For unified cache, we use single expiry

    try {
      const serialized = JSON.stringify(value);

      // Check if entry exists
      const existing = await db
        .select()
        .from(externalApiCacheEntries)
        .where(
          and(
            eq(externalApiCacheEntries.provider, namespace),
            eq(externalApiCacheEntries.cacheKey, key)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(externalApiCacheEntries)
          .set({
            responseJson: serialized,
            expiresAt,
            staleUntilAt,
            updatedAt: new Date(now),
          })
          .where(eq(externalApiCacheEntries.id, existing[0].id));
      } else {
        // Insert new
        await db.insert(externalApiCacheEntries).values({
          provider: namespace,
          cacheKey: key,
          responseJson: serialized,
          expiresAt,
          staleUntilAt,
        });
      }

      this.stats[namespace].l2Writes++;
    } catch (error) {
      log.warn('UnifiedCache', `Failed to write to L2: ${error}`);
      this.stats[namespace].l2WriteErrors++;
      throw error;
    }
  }

  /**
   * Get or fetch pattern (cache-aside)
   *
   * @param namespace Cache namespace
   * @param key Cache key
   * @param fetchFn Function to fetch value if not cached
   * @returns Cached or freshly fetched value
   */
  async getOrFetch<T>(
    namespace: string,
    key: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get<T>(namespace, key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFn();
    await this.set(namespace, key, value);
    return value;
  }

  /**
   * Invalidate specific cache entry
   *
   * @param namespace Cache namespace
   * @param key Cache key (optional - if omitted, clears entire namespace)
   */
  async invalidate(namespace: string, key?: string): Promise<void> {
    if (key) {
      // Invalidate specific key
      const fullKey = this.getFullKey(namespace, key);
      this.l1Cache.delete(fullKey);

      await db
        .delete(externalApiCacheEntries)
        .where(
          and(
            eq(externalApiCacheEntries.provider, namespace),
            eq(externalApiCacheEntries.cacheKey, key)
          )
        )
        .catch((err) => {
          log.warn('UnifiedCache', `Failed to invalidate L2 entry: ${err}`);
        });
    } else {
      // Clear entire namespace
      const config = this.getConfig(namespace);
      const prefix = config.namespace;

      // Clear L1
      for (const cacheKey of this.l1Cache.keys()) {
        if (cacheKey.startsWith(`${prefix}:`)) {
          this.l1Cache.delete(cacheKey);
        }
      }

      // Clear L2
      await db
        .delete(externalApiCacheEntries)
        .where(eq(externalApiCacheEntries.provider, namespace))
        .catch((err) => {
          log.warn('UnifiedCache', `Failed to clear L2 namespace: ${err}`);
        });

      this.updateL1Size(namespace);
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Statistics for all namespaces
   */
  getStats(): Record<string, CacheStats> {
    return { ...this.stats };
  }

  /**
   * Update L1 size stat for namespace
   */
  private updateL1Size(namespace: string): void {
    const config = this.getConfig(namespace);
    const count = Array.from(this.l1Cache.keys()).filter((k) =>
      k.startsWith(`${config.namespace}:`)
    ).length;
    this.stats[namespace].l1Size = count;
  }

  /**
   * Start background cleanup of expired L1 entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.l1Cache.entries()) {
        if (entry.expiresAt < now) {
          this.l1Cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        log.debug('UnifiedCache', `Cleaned ${cleaned} expired L1 entries`);
        // Update all namespace sizes
        Object.keys(CACHE_NAMESPACES).forEach((ns) => this.updateL1Size(ns));
      }
    }, L1_CLEANUP_INTERVAL);
  }

  /**
   * Start periodic stats logging
   */
  private startStatsLogging(): void {
    this.statsInterval = setInterval(() => {
      const summary = Object.entries(this.stats)
        .filter(([_, s]) => s.l1Hits + s.l1Misses + s.l2Hits + s.l2Misses > 0)
        .map(([ns, s]) => ({
          namespace: ns,
          l1HitRate:
            s.l1Hits + s.l1Misses > 0
              ? ((s.l1Hits / (s.l1Hits + s.l1Misses)) * 100).toFixed(1) + '%'
              : 'N/A',
          l2HitRate:
            s.l2Hits + s.l2Misses > 0
              ? ((s.l2Hits / (s.l2Hits + s.l2Misses)) * 100).toFixed(1) + '%'
              : 'N/A',
          l1Size: s.l1Size,
          l2Writes: s.l2Writes,
          l2Errors: s.l2WriteErrors,
        }));

      if (summary.length > 0) {
        log.info('UnifiedCache', `Stats: ${JSON.stringify(summary)}`);
      }
    }, CACHE_STATS_INTERVAL);
  }

  /**
   * Shutdown cache and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    this.l1Cache.clear();
    this.initialized = false;
    log.info('UnifiedCache', 'Cache layer shut down');
  }

  /**
   * Purge expired entries from L2 cache
   */
  async purgeExpired(): Promise<number> {
    const now = new Date();
    try {
      const result = await db
        .delete(externalApiCacheEntries)
        .where(lt(externalApiCacheEntries.staleUntilAt, now));

      log.info('UnifiedCache', `Purged expired L2 entries`);
      return 0; // Drizzle doesn't return affected count in this version
    } catch (error) {
      log.warn('UnifiedCache', `Failed to purge expired L2 entries: ${error}`);
      return 0;
    }
  }
}

// Export singleton instance
export const unifiedCache = new UnifiedCache();
