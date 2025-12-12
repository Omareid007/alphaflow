/**
 * AI Active Trader - RAG Cache
 * LRU cache with TTL for AI analysis results to minimize redundant API calls.
 */

export interface RAGCacheConfig {
  maxSize: number;
  ttlMs: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
  accessCount: number;
}

export class RAGCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: RAGCacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(config: Partial<RAGCacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 10000,
      ttlMs: config.ttlMs || 3600000,
    };
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.stats.hits++;

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs || this.config.ttlMs),
      lastAccessed: Date.now(),
      accessCount: 1,
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  getStats(): Readonly<typeof this.stats & { size: number; hitRate: number }> {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.getHitRate(),
    };
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  getFrequentKeys(limit = 10): Array<{ key: string; accessCount: number }> {
    return Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, accessCount: entry.accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }
}

export function createRAGCache<T = unknown>(config?: Partial<RAGCacheConfig>): RAGCache<T> {
  return new RAGCache<T>(config);
}
