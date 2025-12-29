/**
 * LLM Rate Limiter Service
 *
 * Provides rate limiting and usage tracking for LLM providers.
 * Integrates with the existing apiPolicy/apiBudget infrastructure.
 */

import { getProviderPolicy } from "../lib/apiPolicy";
import { checkBudget, recordUsage } from "../lib/apiBudget";
import { log } from "../utils/logger";

interface LLMRateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
  currentCount?: number;
  limit?: number;
}

const lastLLMCallTimes = new Map<string, number>();
const llmCallCounts = new Map<string, { count: number; windowStart: number }>();

export class LLMRateLimiter {
  async checkLimit(provider: string): Promise<LLMRateLimitResult> {
    const policy = getProviderPolicy(provider);

    if (!policy.enabled) {
      return {
        allowed: false,
        reason: `Provider ${provider} is disabled`,
      };
    }

    const budgetCheck = await checkBudget(provider);
    if (!budgetCheck.allowed) {
      return {
        allowed: false,
        reason: budgetCheck.reason,
        retryAfterMs: budgetCheck.retryAfterMs,
        currentCount: budgetCheck.currentCount,
        limit: budgetCheck.limit,
      };
    }

    return { allowed: true };
  }

  async enforceMinInterval(provider: string): Promise<void> {
    const policy = getProviderPolicy(provider);
    const lastCall = lastLLMCallTimes.get(provider) || 0;
    const elapsed = Date.now() - lastCall;
    const minInterval = policy.minRequestIntervalMs;

    if (elapsed < minInterval) {
      const waitTime = minInterval - elapsed;
      log.debug(
        "LLMRateLimiter",
        `Waiting ${waitTime}ms before next ${provider} call`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    lastLLMCallTimes.set(provider, Date.now());
  }

  async recordCall(
    provider: string,
    options: {
      tokensUsed?: number;
      isError?: boolean;
      isRateLimited?: boolean;
    } = {}
  ): Promise<void> {
    await recordUsage(provider, {
      tokens: options.tokensUsed,
      isError: options.isError,
      isRateLimited: options.isRateLimited,
    });

    const now = Date.now();
    const windowStart = Math.floor(now / 60000) * 60000;
    const key = provider;
    const current = llmCallCounts.get(key);

    if (current && current.windowStart === windowStart) {
      current.count++;
    } else {
      llmCallCounts.set(key, { count: 1, windowStart });
    }
  }

  getStats(provider: string): {
    recentCallCount: number;
    lastCallTime: Date | null;
    policy: ReturnType<typeof getProviderPolicy>;
  } {
    const policy = getProviderPolicy(provider);
    const lastCall = lastLLMCallTimes.get(provider);
    const now = Date.now();
    const windowStart = Math.floor(now / 60000) * 60000;
    const current = llmCallCounts.get(provider);

    return {
      recentCallCount: current?.windowStart === windowStart ? current.count : 0,
      lastCallTime: lastCall ? new Date(lastCall) : null,
      policy,
    };
  }

  async withRateLimit<T>(
    provider: string,
    fn: () => Promise<T>,
    options: { tokensEstimate?: number } = {}
  ): Promise<T> {
    const limitCheck = await this.checkLimit(provider);
    if (!limitCheck.allowed) {
      throw new Error(
        `Rate limit exceeded for ${provider}: ${limitCheck.reason}`
      );
    }

    await this.enforceMinInterval(provider);

    const startTime = Date.now();
    let isError = false;
    let isRateLimited = false;

    try {
      const result = await fn();
      return result;
    } catch (error) {
      isError = true;
      const errorMsg = String(error);
      if (errorMsg.includes("429") || errorMsg.toLowerCase().includes("rate")) {
        isRateLimited = true;
      }
      throw error;
    } finally {
      await this.recordCall(provider, {
        tokensUsed: options.tokensEstimate,
        isError,
        isRateLimited,
      });
    }
  }
}

export const llmRateLimiter = new LLMRateLimiter();
