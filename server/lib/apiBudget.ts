import { db } from "../db";
import { externalApiUsageCounters } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { log } from "../utils/logger";
import { getProviderPolicy, getWindowBoundaries, getLimitForWindow, WindowType } from "./apiPolicy";

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  limit: number;
  windowType: WindowType;
  retryAfterMs?: number;
}

export interface UsageStats {
  provider: string;
  windowType: WindowType;
  windowStart: Date;
  windowEnd: Date;
  requestCount: number;
  tokenCount: number;
  errorCount: number;
  rateLimitHits: number;
  cacheHits: number;
  cacheMisses: number;
  avgLatencyMs: number | null;
}

const inMemoryCounters: Map<string, { count: number; windowStart: number }> = new Map();

function getCounterKey(provider: string, windowType: WindowType): string {
  const { start } = getWindowBoundaries(windowType);
  return `${provider}:${windowType}:${start.getTime()}`;
}

export async function checkBudget(provider: string): Promise<BudgetCheckResult> {
  const policy = getProviderPolicy(provider);
  
  if (!policy.enabled) {
    return {
      allowed: false,
      reason: `Provider ${provider} is disabled`,
      currentCount: 0,
      limit: 0,
      windowType: "minute",
    };
  }

  const windowTypes: WindowType[] = ["minute", "hour", "day", "week"];
  
  for (const windowType of windowTypes) {
    const limit = getLimitForWindow(policy, windowType);
    if (limit === undefined) continue;

    const { start, end } = getWindowBoundaries(windowType);
    const counterKey = getCounterKey(provider, windowType);
    
    let currentCount = 0;
    const cached = inMemoryCounters.get(counterKey);
    if (cached && cached.windowStart === start.getTime()) {
      currentCount = cached.count;
    } else {
      try {
        const result = await db
          .select()
          .from(externalApiUsageCounters)
          .where(
            and(
              eq(externalApiUsageCounters.provider, provider),
              eq(externalApiUsageCounters.windowType, windowType),
              gte(externalApiUsageCounters.windowStart, start),
              lte(externalApiUsageCounters.windowEnd, end)
            )
          )
          .limit(1);
        
        if (result.length > 0) {
          currentCount = result[0].requestCount;
          inMemoryCounters.set(counterKey, { count: currentCount, windowStart: start.getTime() });
        }
      } catch (error) {
        log.warn("ApiBudget", `Failed to check DB budget for ${provider}, using in-memory only`);
      }
    }

    if (currentCount >= limit) {
      const retryAfterMs = end.getTime() - Date.now();
      return {
        allowed: false,
        reason: `${provider} budget exhausted: ${currentCount}/${limit} requests per ${windowType}`,
        currentCount,
        limit,
        windowType,
        retryAfterMs: Math.max(0, retryAfterMs),
      };
    }
  }

  return {
    allowed: true,
    currentCount: 0,
    limit: Infinity,
    windowType: "minute",
  };
}

export async function recordUsage(
  provider: string,
  options: {
    tokens?: number;
    isError?: boolean;
    isRateLimited?: boolean;
    isCacheHit?: boolean;
    latencyMs?: number;
  } = {}
): Promise<void> {
  const windowTypes: WindowType[] = ["minute", "hour", "day", "week"];
  const policy = getProviderPolicy(provider);
  
  const isCacheHit = options.isCacheHit === true;
  
  for (const windowType of windowTypes) {
    const limit = getLimitForWindow(policy, windowType);
    if (limit === undefined) continue;

    const { start, end } = getWindowBoundaries(windowType);
    const counterKey = getCounterKey(provider, windowType);

    if (!isCacheHit) {
      const cached = inMemoryCounters.get(counterKey);
      if (cached && cached.windowStart === start.getTime()) {
        cached.count++;
      } else {
        inMemoryCounters.set(counterKey, { count: 1, windowStart: start.getTime() });
      }
    }

    try {
      const existing = await db
        .select()
        .from(externalApiUsageCounters)
        .where(
          and(
            eq(externalApiUsageCounters.provider, provider),
            eq(externalApiUsageCounters.windowType, windowType),
            gte(externalApiUsageCounters.windowStart, start),
            lte(externalApiUsageCounters.windowEnd, end)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const record = existing[0];
        const newRequestCount = isCacheHit ? record.requestCount : record.requestCount + 1;
        const newTokenCount = (record.tokenCount || 0) + (options.tokens || 0);
        const newErrorCount = record.errorCount + (options.isError ? 1 : 0);
        const newRateLimitHits = record.rateLimitHits + (options.isRateLimited ? 1 : 0);
        const newCacheHits = record.cacheHits + (isCacheHit ? 1 : 0);
        const newCacheMisses = record.cacheMisses + (options.isCacheHit === false ? 1 : 0);
        
        let newAvgLatency = record.avgLatencyMs;
        if (options.latencyMs !== undefined && !isCacheHit) {
          const prevAvg = parseFloat(record.avgLatencyMs || "0");
          const prevCount = record.requestCount - record.cacheHits;
          const newCount = prevCount + 1;
          newAvgLatency = String(((prevAvg * prevCount) + options.latencyMs) / newCount);
        }

        await db
          .update(externalApiUsageCounters)
          .set({
            requestCount: newRequestCount,
            tokenCount: newTokenCount,
            errorCount: newErrorCount,
            rateLimitHits: newRateLimitHits,
            cacheHits: newCacheHits,
            cacheMisses: newCacheMisses,
            avgLatencyMs: newAvgLatency,
            updatedAt: new Date(),
          })
          .where(eq(externalApiUsageCounters.id, record.id));
      } else {
        await db.insert(externalApiUsageCounters).values({
          provider,
          windowType,
          windowStart: start,
          windowEnd: end,
          requestCount: isCacheHit ? 0 : 1,
          tokenCount: options.tokens || 0,
          errorCount: options.isError ? 1 : 0,
          rateLimitHits: options.isRateLimited ? 1 : 0,
          cacheHits: isCacheHit ? 1 : 0,
          cacheMisses: options.isCacheHit === false ? 1 : 0,
          avgLatencyMs: (options.latencyMs !== undefined && !isCacheHit) ? String(options.latencyMs) : null,
        });
      }
    } catch (error) {
      log.warn("ApiBudget", `Failed to record usage to DB for ${provider}: ${error}`);
    }
  }
}

export async function getUsageStats(provider: string): Promise<UsageStats[]> {
  const windowTypes: WindowType[] = ["minute", "hour", "day", "week"];
  const stats: UsageStats[] = [];
  
  for (const windowType of windowTypes) {
    const { start, end } = getWindowBoundaries(windowType);
    
    try {
      const result = await db
        .select()
        .from(externalApiUsageCounters)
        .where(
          and(
            eq(externalApiUsageCounters.provider, provider),
            eq(externalApiUsageCounters.windowType, windowType),
            gte(externalApiUsageCounters.windowStart, start),
            lte(externalApiUsageCounters.windowEnd, end)
          )
        )
        .limit(1);

      if (result.length > 0) {
        const r = result[0];
        stats.push({
          provider: r.provider,
          windowType: r.windowType as WindowType,
          windowStart: r.windowStart,
          windowEnd: r.windowEnd,
          requestCount: r.requestCount,
          tokenCount: r.tokenCount || 0,
          errorCount: r.errorCount,
          rateLimitHits: r.rateLimitHits,
          cacheHits: r.cacheHits,
          cacheMisses: r.cacheMisses,
          avgLatencyMs: r.avgLatencyMs ? parseFloat(r.avgLatencyMs) : null,
        });
      } else {
        stats.push({
          provider,
          windowType,
          windowStart: start,
          windowEnd: end,
          requestCount: 0,
          tokenCount: 0,
          errorCount: 0,
          rateLimitHits: 0,
          cacheHits: 0,
          cacheMisses: 0,
          avgLatencyMs: null,
        });
      }
    } catch (error) {
      log.warn("ApiBudget", `Failed to get usage stats for ${provider}: ${error}`);
    }
  }
  
  return stats;
}

export async function getAllUsageStats(): Promise<Record<string, UsageStats[]>> {
  const providers = [
    "alpaca", "finnhub", "coingecko", "coinmarketcap", "newsapi",
    "polygon", "twelvedata", "valyu", "huggingface", "gdelt",
    "openai", "groq", "together"
  ];
  
  const allStats: Record<string, UsageStats[]> = {};
  
  for (const provider of providers) {
    allStats[provider] = await getUsageStats(provider);
  }
  
  return allStats;
}
