/**
 * AI Active Trader - Market Data Service Cache
 * Simple in-memory cache with TTL support
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class ApiCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTtlMs: number;
  private maxEntries: number;

  constructor(options: { ttlMs?: number; maxEntries?: number } = {}) {
    this.defaultTtlMs = options.ttlMs ?? 60 * 1000;
    this.maxEntries = options.maxEntries ?? 1000;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxEntries) {
      this.evictExpired();
      if (this.cache.size >= this.maxEntries) {
        this.evictOldest();
      }
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((entry, key) => {
      const age = entry.expiresAt - this.defaultTtlMs;
      if (age < oldestTime) {
        oldestTime = age;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  getStats(): { size: number; validCount: number } {
    const now = Date.now();
    let validCount = 0;

    this.cache.forEach((entry) => {
      if (now <= entry.expiresAt) {
        validCount++;
      }
    });

    return { size: this.cache.size, validCount };
  }
}
