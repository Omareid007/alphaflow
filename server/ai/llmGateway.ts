/**
 * LLM Gateway - Centralized entry point for ALL LLM calls
 *
 * This module provides a single, policy-driven interface for LLM requests:
 * - Criticality-based routing (low/medium/high)
 * - TraceId propagation for full observability
 * - Structured output support (JSON schema)
 * - Role-based model selection with fallback chains
 * - Unified logging and cost tracking
 * - Response caching with stale-while-revalidate pattern
 *
 * NO direct OpenAI or provider usage should happen outside this gateway.
 *
 * @see docs/AI_MODELS_AND_PROVIDERS.md for routing policies
 * @see docs/OBSERVABILITY.md for traceability
 */

import { randomUUID, createHash } from "crypto";
import { log } from "../utils/logger";
import { db } from "../db";
import { llmCalls, type LLMRole, type InsertLlmCall } from "@shared/schema";
import { LLMRequest, LLMResponse, LLMMessage, LLMTool, LLMToolChoice } from "./llmClient";
import { openaiClient } from "./openaiClient";
import { openrouterClient } from "./openrouterClient";
import { groqClient } from "./groqClient";
import { togetherClient } from "./togetherClient";
import { aimlClient } from "./aimlClient";
import { claudeClient } from "./claudeClient";
import { geminiClient } from "./geminiClient";
import { cloudflareClient } from "./cloudflareClient";
import { huggingfaceClient } from "./huggingfaceClient";

// ============================================================================
// TYPES
// ============================================================================

export type Criticality = "low" | "medium" | "high";

export interface ResponseFormat {
  type: "json_object" | "json_schema";
  json_schema?: {
    name: string;
    schema: object;
    strict?: boolean;
  };
}

export interface LLMGatewayRequest {
  role: LLMRole;
  criticality: Criticality;
  purpose: string;
  traceId: string;
  userId?: string;
  sessionId?: string;
  symbol?: string;
  system?: string;
  messages: LLMMessage[];
  tools?: LLMTool[];
  toolChoice?: "auto" | "none" | LLMToolChoice;
  responseFormat?: ResponseFormat;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMGatewayResponse {
  text?: string;
  json?: unknown;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  provider: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  traceId: string;
  estimatedCost: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
  cached?: boolean;
}

// ============================================================================
// RESPONSE CACHING
// ============================================================================

interface CacheEntry {
  response: LLMGatewayResponse;
  cachedAt: number;
  freshUntil: number;
  staleUntil: number;
  cacheKey: string;
}

interface RoleCacheConfig {
  freshTtlMs: number;
  staleTtlMs: number;
  enabled: boolean;
}

const ROLE_CACHE_CONFIG: Record<LLMRole, RoleCacheConfig> = {
  technical_analyst: {
    freshTtlMs: 5 * 60 * 1000, // 5 minutes fresh
    staleTtlMs: 30 * 60 * 1000, // 30 minutes stale
    enabled: true,
  },
  risk_manager: {
    freshTtlMs: 5 * 60 * 1000, // 5 minutes fresh
    staleTtlMs: 15 * 60 * 1000, // 15 minutes stale
    enabled: true,
  },
  market_news_summarizer: {
    freshTtlMs: 30 * 60 * 1000, // 30 minutes fresh
    staleTtlMs: 2 * 60 * 60 * 1000, // 2 hours stale
    enabled: true,
  },
  execution_planner: {
    freshTtlMs: 1 * 60 * 1000, // 1 minute fresh
    staleTtlMs: 5 * 60 * 1000, // 5 minutes stale (time-sensitive)
    enabled: true,
  },
  post_trade_reporter: {
    freshTtlMs: 30 * 60 * 1000, // 30 minutes fresh
    staleTtlMs: 2 * 60 * 60 * 1000, // 2 hours stale
    enabled: true,
  },
  position_sizer: {
    freshTtlMs: 5 * 60 * 1000,
    staleTtlMs: 15 * 60 * 1000,
    enabled: true,
  },
  sentiment_analyst: {
    freshTtlMs: 15 * 60 * 1000,
    staleTtlMs: 60 * 60 * 1000,
    enabled: true,
  },
  post_trade_analyzer: {
    freshTtlMs: 30 * 60 * 1000,
    staleTtlMs: 2 * 60 * 60 * 1000,
    enabled: true,
  },
  futures_analyst: {
    freshTtlMs: 5 * 60 * 1000,
    staleTtlMs: 30 * 60 * 1000,
    enabled: true,
  },
};

class LLMResponseCache {
  private cache = new Map<string, CacheEntry>();
  private hitsByRole = new Map<LLMRole, number>();
  private missByRole = new Map<LLMRole, number>();
  private tokensSaved = 0;
  private costSaved = 0;

  /**
   * Generate a cache key from role, system prompt, and messages
   */
  private generateCacheKey(role: LLMRole, system: string | undefined, messages: LLMMessage[]): string {
    // Normalize whitespace in content
    const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();

    const systemNormalized = system ? normalizeWhitespace(system) : '';
    const messagesContent = messages
      .map(m => {
        if (typeof m.content === 'string') {
          return normalizeWhitespace(m.content);
        }
        return JSON.stringify(m.content);
      })
      .join('|');

    const combined = `${role}:${systemNormalized}:${messagesContent}`;

    return createHash('md5').update(combined).digest('hex');
  }

  /**
   * Get cached response if available
   * Returns fresh or stale data based on TTL configuration
   */
  get(role: LLMRole, system: string | undefined, messages: LLMMessage[]): CacheEntry | null {
    const config = ROLE_CACHE_CONFIG[role];
    if (!config.enabled) {
      return null;
    }

    const cacheKey = this.generateCacheKey(role, system, messages);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.recordMiss(role);
      return null;
    }

    const now = Date.now();

    // Check if completely stale (beyond stale TTL)
    if (now > entry.staleUntil) {
      this.cache.delete(cacheKey);
      this.recordMiss(role);
      return null;
    }

    // Record hit and savings
    this.recordHit(role);
    this.recordSavings(entry.response.tokensUsed, entry.response.estimatedCost);

    // Check if fresh
    if (now <= entry.freshUntil) {
      log.ai(`LLMCache: Fresh hit for ${role}`, { cacheKey });
      return entry;
    }

    // Stale but valid - return immediately and trigger background refresh
    log.ai(`LLMCache: Stale hit for ${role} (will refresh in background)`, { cacheKey });
    return entry;
  }

  /**
   * Store response in cache with role-based TTL
   */
  set(role: LLMRole, system: string | undefined, messages: LLMMessage[], response: LLMGatewayResponse): void {
    const config = ROLE_CACHE_CONFIG[role];
    if (!config.enabled) {
      return;
    }

    const cacheKey = this.generateCacheKey(role, system, messages);
    const now = Date.now();

    const entry: CacheEntry = {
      response: { ...response, cached: false }, // Store original response without cache flag
      cachedAt: now,
      freshUntil: now + config.freshTtlMs,
      staleUntil: now + config.staleTtlMs,
      cacheKey,
    };

    this.cache.set(cacheKey, entry);

    // Evict old entries if cache gets too large
    if (this.cache.size > 1000) {
      this.evictOldest();
    }
  }

  /**
   * Check if entry needs refresh (is in stale window)
   */
  needsRefresh(role: LLMRole, system: string | undefined, messages: LLMMessage[]): boolean {
    const config = ROLE_CACHE_CONFIG[role];
    if (!config.enabled) {
      return false;
    }

    const cacheKey = this.generateCacheKey(role, system, messages);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return false;
    }

    const now = Date.now();
    return now > entry.freshUntil && now <= entry.staleUntil;
  }

  /**
   * Clear cache for a specific role
   */
  clearRole(role: LLMRole): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((entry, key) => {
      if (key.startsWith(`${role}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((entry, key) => {
      if (entry.cachedAt < oldestTime) {
        oldestTime = entry.cachedAt;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private recordHit(role: LLMRole): void {
    this.hitsByRole.set(role, (this.hitsByRole.get(role) || 0) + 1);
  }

  private recordMiss(role: LLMRole): void {
    this.missByRole.set(role, (this.missByRole.get(role) || 0) + 1);
  }

  private recordSavings(tokens: number, cost: number): void {
    this.tokensSaved += tokens;
    this.costSaved += cost;
  }

  /**
   * Get cache statistics by role
   */
  getStats(): {
    overall: {
      hitRate: number;
      totalHits: number;
      totalMisses: number;
      tokensSaved: number;
      costSaved: number;
      cacheSize: number;
    };
    byRole: Record<string, {
      hits: number;
      misses: number;
      hitRate: number;
    }>;
  } {
    let totalHits = 0;
    let totalMisses = 0;

    this.hitsByRole.forEach(hits => totalHits += hits);
    this.missByRole.forEach(misses => totalMisses += misses);

    const byRole: Record<string, { hits: number; misses: number; hitRate: number }> = {};

    const hitRoles = Array.from(this.hitsByRole.keys());
    const missRoles = Array.from(this.missByRole.keys());
    const allRoles = new Set([...hitRoles, ...missRoles]);
    allRoles.forEach(role => {
      const hits = this.hitsByRole.get(role) || 0;
      const misses = this.missByRole.get(role) || 0;
      const total = hits + misses;
      byRole[role] = {
        hits,
        misses,
        hitRate: total > 0 ? hits / total : 0,
      };
    });

    return {
      overall: {
        hitRate: totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0,
        totalHits,
        totalMisses,
        tokensSaved: this.tokensSaved,
        costSaved: this.costSaved,
        cacheSize: this.cache.size,
      },
      byRole,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hitsByRole.clear();
    this.missByRole.clear();
    this.tokensSaved = 0;
    this.costSaved = 0;
  }
}

// Singleton instance
const llmResponseCache = new LLMResponseCache();

// ============================================================================
// MODEL CHAINS BY CRITICALITY
// ============================================================================

interface ModelConfig {
  provider: string;
  model: string;
  costPer1kTokens: number;
}

// Environment overrides for model chains
const getEnvModel = (key: string): string | undefined => process.env[key];

const CRITICALITY_CHAINS: Record<LLMRole, Record<Criticality, ModelConfig[]>> = {
  technical_analyst: {
    high: [
      { provider: "claude", model: "claude-sonnet-4-20250514", costPer1kTokens: 0.003 },
      { provider: "openrouter", model: getEnvModel("TECH_ANALYST_HIGH_MODEL") || "deepseek/deepseek-r1", costPer1kTokens: 0.00055 },
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
    ],
    medium: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "claude", model: "claude-sonnet-4-20250514", costPer1kTokens: 0.003 },
      { provider: "openrouter", model: "deepseek/deepseek-r1", costPer1kTokens: 0.00055 },
    ],
    low: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
    ],
  },
  risk_manager: {
    high: [
      { provider: "claude", model: "claude-sonnet-4-20250514", costPer1kTokens: 0.003 },
      { provider: "openrouter", model: getEnvModel("RISK_MANAGER_HIGH_MODEL") || "anthropic/claude-3.5-sonnet", costPer1kTokens: 0.003 },
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
    ],
    medium: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "claude", model: "claude-sonnet-4-20250514", costPer1kTokens: 0.003 },
    ],
    low: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
    ],
  },
  execution_planner: {
    high: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", costPer1kTokens: 0.003 },
    ],
    medium: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct", costPer1kTokens: 0.00001 },
      { provider: "groq", model: "llama-3.1-70b-versatile", costPer1kTokens: 0.00059 },
    ],
    low: [
      { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct", costPer1kTokens: 0.00001 },
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
    ],
  },
  market_news_summarizer: {
    high: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "groq", model: "llama-3.3-70b-versatile", costPer1kTokens: 0.00059 },
    ],
    medium: [
      { provider: "gemini", model: "gemini-2.5-flash", costPer1kTokens: 0.00002 },
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
      { provider: "together", model: "meta-llama/Llama-3.2-3B-Instruct-Turbo", costPer1kTokens: 0.0001 },
    ],
    low: [
      { provider: "gemini", model: "gemini-2.5-flash-lite", costPer1kTokens: 0.00001 },
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
      { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct", costPer1kTokens: 0.00001 },
    ],
  },
  post_trade_reporter: {
    high: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
    ],
    medium: [
      { provider: "gemini", model: "gemini-2.5-flash", costPer1kTokens: 0.00002 },
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
      { provider: "together", model: "meta-llama/Llama-3.2-3B-Instruct-Turbo", costPer1kTokens: 0.0001 },
    ],
    low: [
      { provider: "gemini", model: "gemini-2.5-flash-lite", costPer1kTokens: 0.00001 },
      { provider: "cloudflare", model: "@cf/meta/llama-3.1-8b-instruct", costPer1kTokens: 0.00001 },
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
      { provider: "together", model: "meta-llama/Llama-3.2-3B-Instruct-Turbo", costPer1kTokens: 0.0001 },
    ],
  },
  // NEW ROLE: Position sizing optimization based on risk and market conditions
  position_sizer: {
    high: [
      { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", costPer1kTokens: 0.003 },
      { provider: "openrouter", model: "deepseek/deepseek-r1", costPer1kTokens: 0.00055 },
    ],
    medium: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "groq", model: "llama-3.1-70b-versatile", costPer1kTokens: 0.00059 },
    ],
    low: [
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
    ],
  },
  // NEW ROLE: Dedicated sentiment analysis from news and social sources
  sentiment_analyst: {
    high: [
      { provider: "openrouter", model: "deepseek/deepseek-r1", costPer1kTokens: 0.00055 },
      { provider: "groq", model: "llama-3.3-70b-versatile", costPer1kTokens: 0.00059 },
    ],
    medium: [
      { provider: "gemini", model: "gemini-2.5-flash", costPer1kTokens: 0.00002 },
      { provider: "groq", model: "llama-3.1-70b-versatile", costPer1kTokens: 0.00059 },
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
    ],
    low: [
      { provider: "gemini", model: "gemini-2.5-flash", costPer1kTokens: 0.00002 },
      { provider: "huggingface", model: "meta-llama/Llama-3.2-3B-Instruct", costPer1kTokens: 0.00001 },
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
    ],
  },
  // NEW ROLE: Detailed post-trade performance analysis and learning
  post_trade_analyzer: {
    high: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "claude", model: "claude-sonnet-4-20250514", costPer1kTokens: 0.003 },
    ],
    medium: [
      { provider: "groq", model: "llama-3.1-70b-versatile", costPer1kTokens: 0.00059 },
    ],
    low: [
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
    ],
  },
  // NEW ROLE: Specialized futures market analysis
  futures_analyst: {
    high: [
      { provider: "openrouter", model: "deepseek/deepseek-r1", costPer1kTokens: 0.00055 },
      { provider: "claude", model: "claude-sonnet-4-20250514", costPer1kTokens: 0.003 },
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
    ],
    medium: [
      { provider: "openai", model: "gpt-4o-mini", costPer1kTokens: 0.00015 },
      { provider: "groq", model: "llama-3.1-70b-versatile", costPer1kTokens: 0.00059 },
    ],
    low: [
      { provider: "groq", model: "llama-3.1-8b-instant", costPer1kTokens: 0.00005 },
    ],
  },
};

// ============================================================================
// PROVIDER CLIENTS
// ============================================================================

const PROVIDER_CLIENTS: Record<string, { client: any; isAvailable: () => boolean }> = {
  openai: { client: openaiClient, isAvailable: () => openaiClient.isAvailable() },
  groq: { client: groqClient, isAvailable: () => groqClient.isAvailable() },
  together: { client: togetherClient, isAvailable: () => togetherClient.isAvailable() },
  aimlapi: { client: aimlClient, isAvailable: () => aimlClient.isAvailable() },
  openrouter: { client: openrouterClient, isAvailable: () => openrouterClient.isAvailable() },
  claude: { client: claudeClient, isAvailable: () => claudeClient.isAvailable() },
  gemini: { client: geminiClient, isAvailable: () => geminiClient.isAvailable() },
  cloudflare: { client: cloudflareClient, isAvailable: () => cloudflareClient.isAvailable() },
  huggingface: { client: huggingfaceClient, isAvailable: () => huggingfaceClient.isAvailable() },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function estimateCost(tokens: number, costPer1kTokens: number): number {
  return (tokens / 1000) * costPer1kTokens;
}

function getModelChain(role: LLMRole, criticality: Criticality): ModelConfig[] {
  const roleChains = CRITICALITY_CHAINS[role];
  if (!roleChains) {
    return CRITICALITY_CHAINS.technical_analyst[criticality];
  }
  return roleChains[criticality] || roleChains.medium;
}

async function logCall(callData: InsertLlmCall & { traceId?: string; criticality?: string; purpose?: string }): Promise<void> {
  try {
    const metadata = JSON.stringify({
      traceId: callData.traceId,
      criticality: callData.criticality,
      purpose: callData.purpose,
    });
    await db.insert(llmCalls).values({
      ...callData,
      metadata,
    } as InsertLlmCall);
  } catch (error) {
    log.warn("LLMGateway", "Failed to log LLM call", { error: String(error) });
  }
}

function parseJsonFromText(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function extractTokenCount(tokensUsed: LLMResponse["tokensUsed"]): number {
  if (typeof tokensUsed === "number") {
    return tokensUsed;
  }
  if (tokensUsed && typeof tokensUsed === "object") {
    return tokensUsed.total || 0;
  }
  return 0;
}

// ============================================================================
// MAIN GATEWAY FUNCTION
// ============================================================================

/**
 * Unified LLM Gateway - All LLM calls should go through this function
 *
 * @param req - Gateway request with role, criticality, traceId, and standard LLM params
 * @returns Gateway response with text, json, toolCalls, and tracing metadata
 *
 * @example
 * ```typescript
 * const response = await callLLM({
 *   role: "technical_analyst",
 *   criticality: "high",
 *   purpose: "analyze_trade_opportunity",
 *   traceId: crypto.randomUUID(),
 *   system: "You are an expert trading analyst.",
 *   messages: [{ role: "user", content: "Analyze AAPL" }],
 * });
 * ```
 */
export async function callLLM(req: LLMGatewayRequest): Promise<LLMGatewayResponse> {
  const startTime = Date.now();

  // Check cache first
  const cachedEntry = llmResponseCache.get(req.role, req.system, req.messages);

  if (cachedEntry) {
    const cachedResponse = { ...cachedEntry.response, cached: true };

    // If stale, trigger background refresh but return cached data immediately
    if (llmResponseCache.needsRefresh(req.role, req.system, req.messages)) {
      // Background refresh - don't await
      callLLMUncached(req).then(freshResponse => {
        llmResponseCache.set(req.role, req.system, req.messages, freshResponse);
      }).catch(err => {
        log.warn("LLMGateway", "Background refresh failed", {
          role: req.role,
          error: String(err)
        });
      });
    }

    log.ai(`LLMGateway: Cache hit for ${req.role}/${req.criticality}`, {
      role: req.role,
      criticality: req.criticality,
      purpose: req.purpose,
      traceId: req.traceId,
      cacheKey: cachedEntry.cacheKey,
      cached: true,
    });

    return cachedResponse;
  }

  // Cache miss - call LLM and cache result
  const response = await callLLMUncached(req);
  llmResponseCache.set(req.role, req.system, req.messages, response);

  return response;
}

/**
 * Internal function to call LLM without caching
 * Separated to support background refresh pattern
 */
async function callLLMUncached(req: LLMGatewayRequest): Promise<LLMGatewayResponse> {
  const startTime = Date.now();
  const chain = getModelChain(req.role, req.criticality);

  let fallbackUsed = false;
  let fallbackReason: string | undefined;
  let lastError: Error | undefined;
  
  for (let i = 0; i < chain.length; i++) {
    const modelConfig = chain[i];
    const providerEntry = PROVIDER_CLIENTS[modelConfig.provider];
    
    if (!providerEntry || !providerEntry.isAvailable()) {
      if (i === 0) {
        fallbackUsed = true;
        fallbackReason = `Primary provider ${modelConfig.provider} not available`;
      }
      continue;
    }
    
    try {
      const llmRequest: LLMRequest & { responseFormat?: ResponseFormat } = {
        model: modelConfig.model,
        system: req.system,
        messages: req.messages,
        tools: req.tools,
        toolChoice: req.toolChoice,
        maxTokens: req.maxTokens,
        temperature: req.temperature,
        responseFormat: req.responseFormat,
      };
      
      const response: LLMResponse = await providerEntry.client.call(llmRequest);
      const latencyMs = Date.now() - startTime;
      const tokensUsed = extractTokenCount(response.tokensUsed);
      const estimatedCost = estimateCost(tokensUsed, modelConfig.costPer1kTokens);
      
      let jsonResponse: unknown | null = null;
      if (req.responseFormat && response.text) {
        jsonResponse = parseJsonFromText(response.text);
      }
      
      await logCall({
        role: req.role,
        provider: modelConfig.provider,
        model: modelConfig.model,
        promptTokens: null,
        completionTokens: null,
        totalTokens: tokensUsed || null,
        estimatedCost: estimatedCost.toFixed(6),
        latencyMs,
        status: "success",
        systemPrompt: req.system || null,
        userPrompt: req.messages.map(m => m.content).join("\n").slice(0, 2000),
        response: response.text?.slice(0, 2000) || null,
        cacheHit: false,
        fallbackUsed,
        fallbackReason: fallbackReason || null,
        traceId: req.traceId,
        criticality: req.criticality,
        purpose: req.purpose,
      });
      
      log.ai(`LLMGateway: ${req.role}/${req.criticality} succeeded`, {
        role: req.role,
        criticality: req.criticality,
        purpose: req.purpose,
        traceId: req.traceId,
        provider: modelConfig.provider,
        model: modelConfig.model,
        tokensUsed,
        estimatedCost,
        latencyMs,
        fallbackUsed,
      });
      
      return {
        text: response.text,
        json: jsonResponse,
        toolCalls: response.toolCalls,
        provider: modelConfig.provider,
        model: modelConfig.model,
        tokensUsed,
        latencyMs,
        traceId: req.traceId,
        estimatedCost,
        fallbackUsed,
        fallbackReason,
      };
    } catch (error) {
      lastError = error as Error;
      const errorMsg = (error as Error).message || String(error);
      
      log.warn("LLMGateway", `${modelConfig.provider}/${modelConfig.model} failed for ${req.role}`, {
        traceId: req.traceId,
        criticality: req.criticality,
        purpose: req.purpose,
        error: errorMsg,
      });
      
      if (i === 0) {
        fallbackUsed = true;
        fallbackReason = errorMsg.includes("rate") || errorMsg.includes("429")
          ? "Rate limit exceeded"
          : errorMsg.includes("401") || errorMsg.includes("403")
            ? "Auth error"
            : "Provider error";
      }
      
      if (errorMsg.includes("429") || errorMsg.includes("rate")) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  
  const latencyMs = Date.now() - startTime;
  await logCall({
    role: req.role,
    provider: "none",
    model: "none",
    status: "error",
    errorMessage: String(lastError),
    latencyMs,
    systemPrompt: req.system || null,
    userPrompt: req.messages.map(m => m.content).join("\n").slice(0, 2000),
    fallbackUsed: true,
    fallbackReason: "All providers failed",
    traceId: req.traceId,
    criticality: req.criticality,
    purpose: req.purpose,
  });
  
  log.error("LLMGateway", `All providers failed for ${req.role}/${req.criticality}`, {
    traceId: req.traceId,
    purpose: req.purpose,
    triedProviders: chain.map(c => c.provider),
    lastError: String(lastError),
  });
  
  throw lastError || new Error(`All LLM providers failed for role: ${req.role}, criticality: ${req.criticality}`);
}

// ============================================================================
// HELPER: Generate trace ID
// ============================================================================

export function generateTraceId(): string {
  return randomUUID();
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Get cache statistics including hit rates and cost savings
 */
export function getLLMCacheStats() {
  return llmResponseCache.getStats();
}

/**
 * Clear cache for a specific role
 */
export function clearLLMCacheForRole(role: LLMRole) {
  llmResponseCache.clearRole(role);
}

/**
 * Clear all LLM response cache
 */
export function clearLLMCache() {
  llmResponseCache.clear();
}

/**
 * Reset cache statistics
 */
export function resetLLMCacheStats() {
  llmResponseCache.resetStats();
}

// ============================================================================
// EXPORTS
// ============================================================================

export const llmGateway = {
  call: callLLM,
  generateTraceId,
  getAvailableProviders: () => {
    return Object.entries(PROVIDER_CLIENTS)
      .filter(([_, v]) => v.isAvailable())
      .map(([name]) => name);
  },
  cache: {
    getStats: getLLMCacheStats,
    clearRole: clearLLMCacheForRole,
    clear: clearLLMCache,
    resetStats: resetLLMCacheStats,
  },
};
