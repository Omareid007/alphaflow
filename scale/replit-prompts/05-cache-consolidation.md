# Replit Prompt: Cache Consolidation (L1/L2 Tiered Caching)

## OBJECTIVE
Consolidate overlapping cache implementations (order cache, API cache, LLM response cache) into a unified L1 (memory) / L2 (Redis) tiered caching system with consistent TTLs and invalidation patterns.

## FILES TO CREATE/MODIFY

### New Files:
- `/server/cache/cache-manager.ts` - Unified cache manager
- `/server/cache/cache-config.ts` - TTL and configuration

### Files to Modify:
- `/server/services/external-api-cache.ts` - Use unified cache
- `/server/trading/order-cache.ts` - Use unified cache (if exists)
- `/server/ai/llmGateway.ts` - Add response caching

## IMPLEMENTATION DETAILS

### Step 1: Create Cache Configuration

Create `/server/cache/cache-config.ts`:

```typescript
export interface CacheConfig {
  namespace: string;
  l1TTL: number; // Memory cache TTL in seconds
  l2TTL: number; // Redis cache TTL in seconds
  maxL1Size: number; // Max items in memory
  compression: boolean;
}

export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Market data - short TTL, high frequency
  marketData: {
    namespace: 'mkt',
    l1TTL: 30,
    l2TTL: 60,
    maxL1Size: 1000,
    compression: false
  },

  // Price quotes - very short TTL
  quotes: {
    namespace: 'qt',
    l1TTL: 5,
    l2TTL: 15,
    maxL1Size: 500,
    compression: false
  },

  // News/Sentiment - medium TTL
  news: {
    namespace: 'news',
    l1TTL: 300, // 5 min
    l2TTL: 900, // 15 min
    maxL1Size: 200,
    compression: true
  },

  // LLM responses - longer TTL
  llmResponses: {
    namespace: 'llm',
    l1TTL: 3600, // 1 hour
    l2TTL: 86400, // 24 hours
    maxL1Size: 100,
    compression: true
  },

  // Technical indicators - computed values
  indicators: {
    namespace: 'ind',
    l1TTL: 60,
    l2TTL: 300,
    maxL1Size: 500,
    compression: false
  },

  // Order status - critical, short TTL
  orders: {
    namespace: 'ord',
    l1TTL: 10,
    l2TTL: 60,
    maxL1Size: 200,
    compression: false
  },

  // Fundamentals - long TTL
  fundamentals: {
    namespace: 'fund',
    l1TTL: 3600, // 1 hour
    l2TTL: 14400, // 4 hours
    maxL1Size: 100,
    compression: true
  }
};

export const CACHE_STATS_INTERVAL = 60000; // Log stats every minute
export const L1_CLEANUP_INTERVAL = 30000; // Clean expired L1 entries
```

### Step 2: Create Unified Cache Manager

Create `/server/cache/cache-manager.ts`:

```typescript
import Redis from 'ioredis';
import { CACHE_CONFIGS, CacheConfig, CACHE_STATS_INTERVAL, L1_CLEANUP_INTERVAL } from './cache-config';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

interface L1Entry<T> {
  value: T;
  expires: number;
  hits: number;
}

interface CacheStats {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  l1Size: number;
  l2Writes: number;
}

class CacheManager {
  private l1Cache: Map<string, L1Entry<any>> = new Map();
  private redis: Redis | null = null;
  private stats: Record<string, CacheStats> = {};
  private cleanupInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeStats();
    this.startCleanup();
    this.startStatsLogging();
  }

  async connect(redisUrl?: string): Promise<void> {
    if (redisUrl || process.env.REDIS_URL) {
      try {
        this.redis = new Redis(redisUrl || process.env.REDIS_URL!, {
          retryDelayOnFailover: 1000,
          maxRetriesPerRequest: 3,
          lazyConnect: true
        });
        await this.redis.connect();
        console.log('[CacheManager] Redis L2 cache connected');
      } catch (error) {
        console.warn('[CacheManager] Redis unavailable, L1 only mode');
        this.redis = null;
      }
    }
  }

  private initializeStats(): void {
    Object.keys(CACHE_CONFIGS).forEach(namespace => {
      this.stats[namespace] = {
        l1Hits: 0,
        l1Misses: 0,
        l2Hits: 0,
        l2Misses: 0,
        l1Size: 0,
        l2Writes: 0
      };
    });
  }

  private getFullKey(namespace: string, key: string): string {
    const config = CACHE_CONFIGS[namespace];
    return `${config?.namespace || namespace}:${key}`;
  }

  /**
   * Get value from cache (L1 -> L2 -> miss)
   */
  async get<T>(namespace: string, key: string): Promise<T | null> {
    const fullKey = this.getFullKey(namespace, key);
    const config = CACHE_CONFIGS[namespace] || CACHE_CONFIGS.marketData;

    // Check L1 (memory)
    const l1Entry = this.l1Cache.get(fullKey);
    if (l1Entry && l1Entry.expires > Date.now()) {
      l1Entry.hits++;
      this.stats[namespace].l1Hits++;
      return l1Entry.value as T;
    }

    // Remove expired L1 entry
    if (l1Entry) {
      this.l1Cache.delete(fullKey);
    }
    this.stats[namespace].l1Misses++;

    // Check L2 (Redis)
    if (this.redis) {
      try {
        const l2Value = await this.redis.get(fullKey);
        if (l2Value) {
          this.stats[namespace].l2Hits++;

          let parsed: T;
          if (config.compression) {
            const buffer = Buffer.from(l2Value, 'base64');
            const decompressed = await gunzipAsync(buffer);
            parsed = JSON.parse(decompressed.toString());
          } else {
            parsed = JSON.parse(l2Value);
          }

          // Promote to L1
          this.setL1(namespace, key, parsed, config);
          return parsed;
        }
      } catch (error) {
        console.error(`[CacheManager] L2 get error for ${fullKey}:`, error);
      }
    }

    this.stats[namespace].l2Misses++;
    return null;
  }

  /**
   * Set value in cache (L1 + L2)
   */
  async set<T>(namespace: string, key: string, value: T): Promise<void> {
    const fullKey = this.getFullKey(namespace, key);
    const config = CACHE_CONFIGS[namespace] || CACHE_CONFIGS.marketData;

    // Set L1
    this.setL1(namespace, key, value, config);

    // Set L2 (Redis)
    if (this.redis) {
      try {
        let serialized: string;
        if (config.compression) {
          const json = JSON.stringify(value);
          const compressed = await gzipAsync(Buffer.from(json));
          serialized = compressed.toString('base64');
        } else {
          serialized = JSON.stringify(value);
        }

        await this.redis.setex(fullKey, config.l2TTL, serialized);
        this.stats[namespace].l2Writes++;
      } catch (error) {
        console.error(`[CacheManager] L2 set error for ${fullKey}:`, error);
      }
    }
  }

  private setL1<T>(namespace: string, key: string, value: T, config: CacheConfig): void {
    const fullKey = this.getFullKey(namespace, key);

    // Evict if over capacity
    const namespaceEntries = Array.from(this.l1Cache.entries())
      .filter(([k]) => k.startsWith(config.namespace));

    if (namespaceEntries.length >= config.maxL1Size) {
      // LRU eviction - remove least recently hit
      const lru = namespaceEntries.reduce((min, curr) =>
        curr[1].hits < min[1].hits ? curr : min
      );
      this.l1Cache.delete(lru[0]);
    }

    this.l1Cache.set(fullKey, {
      value,
      expires: Date.now() + (config.l1TTL * 1000),
      hits: 0
    });

    this.stats[namespace].l1Size = this.l1Cache.size;
  }

  /**
   * Delete from cache (L1 + L2)
   */
  async delete(namespace: string, key: string): Promise<void> {
    const fullKey = this.getFullKey(namespace, key);

    this.l1Cache.delete(fullKey);

    if (this.redis) {
      await this.redis.del(fullKey);
    }
  }

  /**
   * Clear entire namespace
   */
  async clearNamespace(namespace: string): Promise<void> {
    const config = CACHE_CONFIGS[namespace];
    const prefix = config?.namespace || namespace;

    // Clear L1
    for (const key of this.l1Cache.keys()) {
      if (key.startsWith(prefix)) {
        this.l1Cache.delete(key);
      }
    }

    // Clear L2
    if (this.redis) {
      const keys = await this.redis.keys(`${prefix}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    namespace: string,
    key: string,
    factory: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get<T>(namespace, key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(namespace, key, value);
    return value;
  }

  /**
   * Invalidate by pattern
   */
  async invalidatePattern(namespace: string, pattern: string): Promise<number> {
    const config = CACHE_CONFIGS[namespace];
    const prefix = config?.namespace || namespace;
    const fullPattern = `${prefix}:${pattern}`;
    let count = 0;

    // Invalidate L1
    for (const key of this.l1Cache.keys()) {
      if (key.match(new RegExp(fullPattern.replace('*', '.*')))) {
        this.l1Cache.delete(key);
        count++;
      }
    }

    // Invalidate L2
    if (this.redis) {
      const keys = await this.redis.keys(fullPattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        count += keys.length;
      }
    }

    return count;
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.l1Cache.entries()) {
        if (entry.expires < now) {
          this.l1Cache.delete(key);
        }
      }
    }, L1_CLEANUP_INTERVAL);
  }

  private startStatsLogging(): void {
    this.statsInterval = setInterval(() => {
      const summary = Object.entries(this.stats).map(([ns, s]) => ({
        namespace: ns,
        l1HitRate: s.l1Hits / (s.l1Hits + s.l1Misses) || 0,
        l2HitRate: s.l2Hits / (s.l2Hits + s.l2Misses) || 0,
        l1Size: s.l1Size
      }));

      console.log('[CacheManager] Stats:', JSON.stringify(summary));
    }, CACHE_STATS_INTERVAL);
  }

  getStats(): Record<string, CacheStats> {
    return { ...this.stats };
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.statsInterval) clearInterval(this.statsInterval);
    if (this.redis) await this.redis.quit();
  }
}

export const cacheManager = new CacheManager();
```

### Step 3: Update External API Cache

In `/server/services/external-api-cache.ts`:

```typescript
import { cacheManager } from '../cache/cache-manager';

// Replace direct cache calls with:
export async function getCachedMarketData(symbol: string): Promise<MarketData | null> {
  return cacheManager.get('marketData', symbol);
}

export async function setCachedMarketData(symbol: string, data: MarketData): Promise<void> {
  await cacheManager.set('marketData', symbol, data);
}

// Use getOrSet pattern:
export async function getMarketData(symbol: string): Promise<MarketData> {
  return cacheManager.getOrSet('marketData', symbol, async () => {
    // Fetch from API
    return fetchFromAPI(symbol);
  });
}
```

### Step 4: Add LLM Response Caching

In `/server/ai/llmGateway.ts`:

```typescript
import { cacheManager } from '../cache/cache-manager';
import crypto from 'crypto';

// Generate cache key from prompt
function getLLMCacheKey(role: string, prompt: string, model: string): string {
  const hash = crypto.createHash('md5')
    .update(`${role}:${model}:${prompt}`)
    .digest('hex');
  return `${role}:${hash}`;
}

// Wrap LLM calls with caching
async function callLLMWithCache(
  role: string,
  prompt: string,
  model: string
): Promise<string> {
  const cacheKey = getLLMCacheKey(role, prompt, model);

  return cacheManager.getOrSet('llmResponses', cacheKey, async () => {
    // Make actual LLM API call
    return await makeActualLLMCall(role, prompt, model);
  });
}
```

## ACCEPTANCE CRITERIA

- [ ] cache-config.ts created with all TTL configurations
- [ ] cache-manager.ts created with L1/L2 tiered caching
- [ ] External API cache updated to use unified manager
- [ ] LLM response caching implemented
- [ ] Stats logging working
- [ ] Compression working for large entries
- [ ] TypeScript compilation succeeds
- [ ] Reduced duplicate cache code

## VERIFICATION COMMANDS

```bash
# Check files created
ls -la server/cache/

# Verify TypeScript
npx tsc --noEmit

# Test cache functionality
curl http://localhost:5000/api/cache/stats

# Run cache tests
npm test -- --grep "cache"
```

## ESTIMATED IMPACT

- **New lines**: ~400
- **Files affected**: 5
- **Risk level**: Medium (affects data freshness)
- **Testing required**: Cache hit/miss verification, TTL tests
- **Performance improvement**: 30-50% fewer API calls
