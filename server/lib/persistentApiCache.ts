import { db } from "../db";
import { externalApiCacheEntries } from "@shared/schema";
import { eq, and, lt, gt } from "drizzle-orm";
import { log } from "../utils/logger";
import { getProviderPolicy } from "./apiPolicy";

export interface CacheResult<T> {
  data: T;
  isFresh: boolean;
  isStale: boolean;
  hitCount: number;
}

export interface CacheStats {
  totalEntries: number;
  freshEntries: number;
  staleEntries: number;
  expiredEntries: number;
  totalHits: number;
}

const inMemoryCache: Map<
  string,
  { data: unknown; expiresAt: number; staleUntilAt: number }
> = new Map();

function getCacheKey(provider: string, key: string): string {
  return `${provider}:${key}`;
}

export async function getFromCache<T>(
  provider: string,
  key: string
): Promise<CacheResult<T> | null> {
  const cacheKey = getCacheKey(provider, key);
  const now = Date.now();

  const memCached = inMemoryCache.get(cacheKey);
  if (memCached) {
    if (now < memCached.expiresAt) {
      return {
        data: memCached.data as T,
        isFresh: true,
        isStale: false,
        hitCount: 0,
      };
    }
    if (now < memCached.staleUntilAt) {
      return {
        data: memCached.data as T,
        isFresh: false,
        isStale: true,
        hitCount: 0,
      };
    }
    inMemoryCache.delete(cacheKey);
  }

  try {
    const result = await db
      .select()
      .from(externalApiCacheEntries)
      .where(
        and(
          eq(externalApiCacheEntries.provider, provider),
          eq(externalApiCacheEntries.cacheKey, key)
        )
      )
      .limit(1);

    if (result.length === 0) return null;

    const entry = result[0];
    const expiresAt = entry.expiresAt.getTime();
    const staleUntilAt = entry.staleUntilAt.getTime();
    const data = JSON.parse(entry.responseJson) as T;

    inMemoryCache.set(cacheKey, { data, expiresAt, staleUntilAt });

    await db
      .update(externalApiCacheEntries)
      .set({
        hitCount: entry.hitCount + 1,
        lastAccessedAt: new Date(),
      })
      .where(eq(externalApiCacheEntries.id, entry.id));

    if (now < expiresAt) {
      return {
        data,
        isFresh: true,
        isStale: false,
        hitCount: entry.hitCount + 1,
      };
    }
    if (now < staleUntilAt) {
      return {
        data,
        isFresh: false,
        isStale: true,
        hitCount: entry.hitCount + 1,
      };
    }

    await db
      .delete(externalApiCacheEntries)
      .where(eq(externalApiCacheEntries.id, entry.id));
    inMemoryCache.delete(cacheKey);

    return null;
  } catch (error) {
    log.warn(
      "PersistentCache",
      `Failed to get from DB cache for ${provider}:${key}: ${error}`
    );
    return null;
  }
}

export async function setInCache<T>(
  provider: string,
  key: string,
  data: T
): Promise<void> {
  const policy = getProviderPolicy(provider);
  const now = Date.now();
  const expiresAt = new Date(now + policy.cacheFreshDurationMs);
  const staleUntilAt = new Date(now + policy.cacheStaleDurationMs);
  const cacheKey = getCacheKey(provider, key);

  inMemoryCache.set(cacheKey, {
    data,
    expiresAt: expiresAt.getTime(),
    staleUntilAt: staleUntilAt.getTime(),
  });

  try {
    const existing = await db
      .select()
      .from(externalApiCacheEntries)
      .where(
        and(
          eq(externalApiCacheEntries.provider, provider),
          eq(externalApiCacheEntries.cacheKey, key)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(externalApiCacheEntries)
        .set({
          responseJson: JSON.stringify(data),
          expiresAt,
          staleUntilAt,
          updatedAt: new Date(),
        })
        .where(eq(externalApiCacheEntries.id, existing[0].id));
    } else {
      await db.insert(externalApiCacheEntries).values({
        provider,
        cacheKey: key,
        responseJson: JSON.stringify(data),
        expiresAt,
        staleUntilAt,
      });
    }
  } catch (error) {
    log.warn(
      "PersistentCache",
      `Failed to set DB cache for ${provider}:${key}: ${error}`
    );
  }
}

export async function invalidateCache(
  provider: string,
  key?: string
): Promise<number> {
  let deletedCount = 0;

  if (key) {
    const cacheKey = getCacheKey(provider, key);
    inMemoryCache.delete(cacheKey);

    try {
      const result = await db
        .delete(externalApiCacheEntries)
        .where(
          and(
            eq(externalApiCacheEntries.provider, provider),
            eq(externalApiCacheEntries.cacheKey, key)
          )
        );
      deletedCount = 1;
    } catch (error) {
      log.warn(
        "PersistentCache",
        `Failed to invalidate cache for ${provider}:${key}: ${error}`
      );
    }
  } else {
    for (const k of inMemoryCache.keys()) {
      if (k.startsWith(`${provider}:`)) {
        inMemoryCache.delete(k);
      }
    }

    try {
      await db
        .delete(externalApiCacheEntries)
        .where(eq(externalApiCacheEntries.provider, provider));
    } catch (error) {
      log.warn(
        "PersistentCache",
        `Failed to invalidate all cache for ${provider}: ${error}`
      );
    }
  }

  return deletedCount;
}

export async function purgeExpiredCache(): Promise<number> {
  const now = new Date();
  let purgedCount = 0;

  for (const [key, entry] of inMemoryCache.entries()) {
    if (Date.now() > entry.staleUntilAt) {
      inMemoryCache.delete(key);
      purgedCount++;
    }
  }

  try {
    await db
      .delete(externalApiCacheEntries)
      .where(lt(externalApiCacheEntries.staleUntilAt, now));
  } catch (error) {
    log.warn(
      "PersistentCache",
      `Failed to purge expired cache from DB: ${error}`
    );
  }

  log.info(
    "PersistentCache",
    `Purged ${purgedCount} expired entries from memory cache`
  );
  return purgedCount;
}

export async function getCacheStats(provider?: string): Promise<CacheStats> {
  const now = new Date();

  try {
    let query = db.select().from(externalApiCacheEntries);

    if (provider) {
      query = query.where(
        eq(externalApiCacheEntries.provider, provider)
      ) as typeof query;
    }

    const entries = await query;

    let freshEntries = 0;
    let staleEntries = 0;
    let expiredEntries = 0;
    let totalHits = 0;

    for (const entry of entries) {
      totalHits += entry.hitCount;

      if (now < entry.expiresAt) {
        freshEntries++;
      } else if (now < entry.staleUntilAt) {
        staleEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: entries.length,
      freshEntries,
      staleEntries,
      expiredEntries,
      totalHits,
    };
  } catch (error) {
    log.warn("PersistentCache", `Failed to get cache stats: ${error}`);
    return {
      totalEntries: 0,
      freshEntries: 0,
      staleEntries: 0,
      expiredEntries: 0,
      totalHits: 0,
    };
  }
}

export async function getAllCacheEntries(provider?: string): Promise<
  Array<{
    provider: string;
    cacheKey: string;
    expiresAt: Date;
    staleUntilAt: Date;
    hitCount: number;
    lastAccessedAt: Date;
    sizeBytes: number;
  }>
> {
  try {
    let query = db.select().from(externalApiCacheEntries);

    if (provider) {
      query = query.where(
        eq(externalApiCacheEntries.provider, provider)
      ) as typeof query;
    }

    const entries = await query;

    return entries.map((entry) => ({
      provider: entry.provider,
      cacheKey: entry.cacheKey,
      expiresAt: entry.expiresAt,
      staleUntilAt: entry.staleUntilAt,
      hitCount: entry.hitCount,
      lastAccessedAt: entry.lastAccessedAt,
      sizeBytes: entry.responseJson.length,
    }));
  } catch (error) {
    log.warn("PersistentCache", `Failed to get cache entries: ${error}`);
    return [];
  }
}
