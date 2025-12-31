/**
 * Redis Caching Service
 *
 * High-performance caching layer using Redis for:
 * - Market data caching (quotes, candles, fundamentals)
 * - API response caching (Alpaca, AI providers)
 * - Session data (user preferences, watchlists)
 * - Rate limiting counters
 *
 * Features:
 * - Automatic connection management with health checks
 * - TTL-based expiration for all cached data
 * - Graceful degradation when Redis unavailable
 * - Structured logging with pino
 */

import Redis from "ioredis";
import { log } from "../utils/logger";

// Redis client instance
let redisClient: Redis | null = null;

// Configuration from environment
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  lazyConnect: true,
};

// Default TTL values (seconds)
export const CacheTTL = {
  MARKET_QUOTE: 60, // 1 minute for real-time quotes
  MARKET_CANDLE: 300, // 5 minutes for candle data
  FUNDAMENTALS: 3600, // 1 hour for fundamental data
  API_RESPONSE: 120, // 2 minutes for API responses
  SESSION_DATA: 86400, // 24 hours for session data
  RATE_LIMIT: 900, // 15 minutes for rate limit counters
} as const;

/**
 * Initialize Redis connection
 */
export async function initRedis(): Promise<boolean> {
  try {
    if (redisClient) {
      log.info("Redis", "Already connected", { host: REDIS_CONFIG.host });
      return true;
    }

    redisClient = new Redis(REDIS_CONFIG);

    // Event handlers
    redisClient.on("connect", () => {
      log.info("Redis", "Connection established", {
        host: REDIS_CONFIG.host,
        port: REDIS_CONFIG.port,
      });
    });

    redisClient.on("ready", () => {
      log.info("Redis", "Ready for commands");
    });

    redisClient.on("error", (error) => {
      log.error("Redis", "Connection error", {
        error: error.message,
        code: (error as NodeJS.ErrnoException).code,
      });
    });

    redisClient.on("close", () => {
      log.warn("Redis", "Connection closed");
    });

    redisClient.on("reconnecting", () => {
      log.info("Redis", "Reconnecting...");
    });

    // Attempt connection
    await redisClient.connect();

    // Test connection with PING
    const pong = await redisClient.ping();
    if (pong === "PONG") {
      log.info("Redis", "Health check passed", { pong });
      return true;
    }

    return false;
  } catch (error) {
    log.error("Redis", "Failed to initialize", {
      error: error instanceof Error ? error.message : String(error),
    });
    redisClient = null;
    return false;
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.status === "ready";
}

/**
 * Get value from cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!isRedisAvailable()) {
    log.debug("Redis", "Cache unavailable, returning null", { key });
    return null;
  }

  try {
    const value = await redisClient!.get(key);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    log.error("Redis", "Get cache failed", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Set value in cache with TTL
 */
export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds: number = CacheTTL.API_RESPONSE
): Promise<boolean> {
  if (!isRedisAvailable()) {
    log.debug("Redis", "Cache unavailable, skipping set", { key });
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    await redisClient!.setex(key, ttlSeconds, serialized);

    log.debug("Redis", "Cache set successfully", {
      key,
      ttl: ttlSeconds,
      size: serialized.length,
    });
    return true;
  } catch (error) {
    log.error("Redis", "Set cache failed", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Delete value from cache
 */
export async function delCache(key: string): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    await redisClient!.del(key);
    log.debug("Redis", "Cache deleted", { key });
    return true;
  } catch (error) {
    log.error("Redis", "Delete cache failed", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Invalidate all keys matching pattern
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  if (!isRedisAvailable()) {
    return 0;
  }

  try {
    const keys = await redisClient!.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }

    await redisClient!.del(...keys);
    log.info("Redis", "Pattern invalidated", { pattern, count: keys.length });
    return keys.length;
  } catch (error) {
    log.error("Redis", "Pattern invalidation failed", {
      pattern,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Increment counter (for rate limiting)
 */
export async function incrementCounter(
  key: string,
  ttlSeconds: number = CacheTTL.RATE_LIMIT
): Promise<number> {
  if (!isRedisAvailable()) {
    return 0;
  }

  try {
    const count = await redisClient!.incr(key);

    // Set TTL on first increment
    if (count === 1) {
      await redisClient!.expire(key, ttlSeconds);
    }

    return count;
  } catch (error) {
    log.error("Redis", "Increment counter failed", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Decrement counter (atomic)
 *
 * @param key - Cache key
 * @param min - Minimum value (default: 0, won't go below this)
 * @returns New counter value
 */
export async function decrementCounter(key: string, min = 0): Promise<number> {
  if (!isRedisAvailable()) {
    return 0;
  }

  try {
    // Use Lua script for atomic decrement with minimum value
    const script = `
      local current = redis.call('GET', KEYS[1])
      if not current then
        return 0
      end
      local value = tonumber(current)
      if value <= tonumber(ARGV[1]) then
        return value
      end
      return redis.call('DECR', KEYS[1])
    `;

    const count = (await redisClient!.eval(script, 1, key, min)) as number;
    return count;
  } catch (error) {
    log.error("Redis", "Decrement counter failed", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Get counter value
 *
 * @param key - Cache key
 * @returns Current counter value, or null if not found
 */
export async function getCounter(key: string): Promise<number | null> {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const value = await redisClient!.get(key);
    if (value === null) {
      return null;
    }
    return parseInt(value, 10);
  } catch (error) {
    log.error("Redis", "Get counter failed", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Set counter value
 *
 * @param key - Cache key
 * @param value - Counter value to set
 * @param ttlSeconds - Optional TTL (no TTL if not specified)
 * @returns True if successful
 */
export async function setCounter(
  key: string,
  value: number,
  ttlSeconds?: number
): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    if (ttlSeconds) {
      await redisClient!.setex(key, ttlSeconds, value.toString());
    } else {
      await redisClient!.set(key, value.toString());
    }
    return true;
  } catch (error) {
    log.error("Redis", "Set counter failed", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  isConnected: boolean;
  keyCount?: number;
  memoryUsed?: string;
  uptimeSeconds?: number;
}> {
  if (!isRedisAvailable()) {
    return { isConnected: false };
  }

  try {
    const info = await redisClient!.info("stats");
    const keyspace = await redisClient!.info("keyspace");
    const server = await redisClient!.info("server");

    // Parse key count
    const keyCountMatch = keyspace.match(/keys=(\d+)/);
    const keyCount = keyCountMatch ? parseInt(keyCountMatch[1], 10) : 0;

    // Parse memory usage
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memoryUsed = memoryMatch ? memoryMatch[1].trim() : "unknown";

    // Parse uptime
    const uptimeMatch = server.match(/uptime_in_seconds:(\d+)/);
    const uptimeSeconds = uptimeMatch ? parseInt(uptimeMatch[1], 10) : 0;

    return {
      isConnected: true,
      keyCount,
      memoryUsed,
      uptimeSeconds,
    };
  } catch (error) {
    log.error("Redis", "Failed to get stats", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { isConnected: true };
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    log.info("Redis", "Connection closed gracefully");
  }
}

/**
 * Health check for monitoring
 */
export async function healthCheck(): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const pong = await redisClient!.ping();
    return pong === "PONG";
  } catch (error) {
    log.error("Redis", "Health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ============================================================================
// DISTRIBUTED LOCK OPERATIONS (for race condition prevention)
// ============================================================================

/**
 * Acquire a distributed lock
 *
 * @param lockKey - Lock key (e.g., 'work_queue:claim')
 * @param lockValue - Unique lock identifier (e.g., worker ID)
 * @param ttlSeconds - Lock TTL in seconds (default: 30s)
 * @returns True if lock acquired, false otherwise
 */
export async function acquireLock(
  lockKey: string,
  lockValue: string,
  ttlSeconds: number = 30
): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    // SET NX EX - Set if Not eXists with EXpiry
    const result = await redisClient!.set(
      lockKey,
      lockValue,
      "EX",
      ttlSeconds,
      "NX"
    );

    const acquired = result === "OK";

    if (acquired) {
      log.debug("Redis", "Lock acquired", {
        lockKey,
        lockValue,
        ttl: ttlSeconds,
      });
    } else {
      log.debug("Redis", "Lock already held", { lockKey });
    }

    return acquired;
  } catch (error) {
    log.error("Redis", "Acquire lock failed", {
      lockKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Release a distributed lock (atomic check-and-delete)
 *
 * @param lockKey - Lock key
 * @param lockValue - Lock identifier to verify ownership
 * @returns True if lock was released by this holder
 */
export async function releaseLock(
  lockKey: string,
  lockValue: string
): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    // Lua script for atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = (await redisClient!.eval(
      script,
      1,
      lockKey,
      lockValue
    )) as number;

    if (result === 1) {
      log.debug("Redis", "Lock released", { lockKey, lockValue });
      return true;
    } else {
      log.debug("Redis", "Lock not owned by this holder", {
        lockKey,
        lockValue,
      });
      return false;
    }
  } catch (error) {
    log.error("Redis", "Release lock failed", {
      lockKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Execute a function with automatic lock management
 *
 * @param lockKey - Lock key
 * @param fn - Function to execute while holding lock
 * @param ttlSeconds - Lock TTL in seconds (default: 30s)
 * @returns Function result or null if lock not acquired
 */
export async function withLock<T>(
  lockKey: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 30
): Promise<T | null> {
  const lockValue = `lock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Try to acquire lock
  const acquired = await acquireLock(lockKey, lockValue, ttlSeconds);
  if (!acquired) {
    log.debug("Redis", "Failed to acquire lock, skipping execution", {
      lockKey,
    });
    return null;
  }

  try {
    // Execute function while holding lock
    const result = await fn();

    // Release lock
    await releaseLock(lockKey, lockValue);

    return result;
  } catch (error) {
    // Ensure lock is released even on error
    await releaseLock(lockKey, lockValue);

    log.error("Redis", "Error while holding lock", {
      lockKey,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

// ============================================================================
// HASH OPERATIONS (for complex objects)
// ============================================================================

/**
 * Set value in a hash field
 *
 * @param hashKey - Hash key (e.g., 'pending_signals')
 * @param field - Field name within the hash
 * @param value - Value to store (will be JSON serialized)
 * @param ttlSeconds - Optional TTL for the entire hash
 * @returns True if successful
 */
export async function setHashField(
  hashKey: string,
  field: string,
  value: unknown,
  ttlSeconds?: number
): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    await redisClient!.hset(hashKey, field, serialized);

    // Set TTL on entire hash if specified
    if (ttlSeconds) {
      await redisClient!.expire(hashKey, ttlSeconds);
    }

    log.debug("Redis", "Hash field set", {
      hashKey,
      field,
      size: serialized.length,
    });
    return true;
  } catch (error) {
    log.error("Redis", "Set hash field failed", {
      hashKey,
      field,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get value from a hash field
 *
 * @param hashKey - Hash key
 * @param field - Field name within the hash
 * @returns Deserialized value or null if not found
 */
export async function getHashField<T>(
  hashKey: string,
  field: string
): Promise<T | null> {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const value = await redisClient!.hget(hashKey, field);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    log.error("Redis", "Get hash field failed", {
      hashKey,
      field,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Get all fields and values from a hash
 *
 * @param hashKey - Hash key
 * @returns Map of field names to deserialized values
 */
export async function getAllHashFields<T>(
  hashKey: string
): Promise<Map<string, T>> {
  const result = new Map<string, T>();

  if (!isRedisAvailable()) {
    return result;
  }

  try {
    const data = await redisClient!.hgetall(hashKey);

    for (const [field, value] of Object.entries(data)) {
      try {
        result.set(field, JSON.parse(value) as T);
      } catch (parseError) {
        log.warn("Redis", "Failed to parse hash field", {
          hashKey,
          field,
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        });
      }
    }

    return result;
  } catch (error) {
    log.error("Redis", "Get all hash fields failed", {
      hashKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return result;
  }
}

/**
 * Delete a field from a hash
 *
 * @param hashKey - Hash key
 * @param field - Field name to delete
 * @returns True if field was deleted
 */
export async function deleteHashField(
  hashKey: string,
  field: string
): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const deleted = await redisClient!.hdel(hashKey, field);
    log.debug("Redis", "Hash field deleted", {
      hashKey,
      field,
      wasDeleted: deleted > 0,
    });
    return deleted > 0;
  } catch (error) {
    log.error("Redis", "Delete hash field failed", {
      hashKey,
      field,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Check if a field exists in a hash
 *
 * @param hashKey - Hash key
 * @param field - Field name to check
 * @returns True if field exists
 */
export async function hasHashField(
  hashKey: string,
  field: string
): Promise<boolean> {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const exists = await redisClient!.hexists(hashKey, field);
    return exists === 1;
  } catch (error) {
    log.error("Redis", "Check hash field failed", {
      hashKey,
      field,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
