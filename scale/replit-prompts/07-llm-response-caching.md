# Replit Prompt: LLM Response Caching Implementation

## OBJECTIVE
Implement intelligent caching for LLM API responses to reduce API costs by 30-40%, with semantic similarity matching for cache hits and role-based TTL configuration.

## FILES TO CREATE/MODIFY

### New Files:
- `/server/ai/llm-cache.ts` - LLM-specific caching logic
- `/server/ai/prompt-hasher.ts` - Semantic prompt hashing

### Files to Modify:
- `/server/ai/llmGateway.ts` - Add caching layer
- `/server/ai/roleBasedRouter.ts` - Configure per-role caching

## IMPLEMENTATION DETAILS

### Step 1: Create Prompt Hasher

Create `/server/ai/prompt-hasher.ts`:

```typescript
import crypto from 'crypto';

export interface PromptHash {
  exactHash: string; // MD5 of exact prompt
  semanticHash: string; // Normalized prompt hash
  keyTerms: string[]; // Extracted key terms
}

export class PromptHasher {
  // Stop words to remove for semantic hashing
  private static STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall',
    'for', 'and', 'nor', 'but', 'or', 'yet', 'so', 'at', 'by',
    'in', 'of', 'on', 'to', 'up', 'it', 'its', 'this', 'that',
    'with', 'from', 'into', 'as', 'if', 'then', 'than', 'too'
  ]);

  // Financial terms to preserve
  private static KEY_TERMS = new Set([
    'buy', 'sell', 'hold', 'long', 'short', 'bullish', 'bearish',
    'price', 'volume', 'momentum', 'trend', 'support', 'resistance',
    'overbought', 'oversold', 'rsi', 'macd', 'sma', 'ema', 'breakout',
    'earnings', 'revenue', 'profit', 'loss', 'margin', 'growth',
    'risk', 'reward', 'position', 'allocation', 'portfolio'
  ]);

  /**
   * Generate multiple hash representations of a prompt
   */
  static hash(prompt: string, role: string): PromptHash {
    const exactHash = this.exactHash(prompt, role);
    const { semanticHash, keyTerms } = this.semanticHash(prompt, role);

    return { exactHash, semanticHash, keyTerms };
  }

  /**
   * Exact hash - MD5 of role + prompt
   */
  private static exactHash(prompt: string, role: string): string {
    return crypto
      .createHash('md5')
      .update(`${role}:${prompt}`)
      .digest('hex');
  }

  /**
   * Semantic hash - normalized version for similar prompts
   */
  private static semanticHash(prompt: string, role: string): { semanticHash: string; keyTerms: string[] } {
    // Normalize prompt
    const normalized = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();

    // Extract tokens
    const tokens = normalized.split(' ');

    // Filter and sort
    const filtered = tokens
      .filter(t => t.length > 2)
      .filter(t => !this.STOP_WORDS.has(t));

    // Extract key financial terms
    const keyTerms = filtered.filter(t => this.KEY_TERMS.has(t));

    // Sort for consistency
    const sorted = [...new Set(filtered)].sort();

    const semanticHash = crypto
      .createHash('md5')
      .update(`${role}:${sorted.join(' ')}`)
      .digest('hex');

    return { semanticHash, keyTerms };
  }

  /**
   * Check if two prompts are semantically similar
   */
  static areSimilar(hash1: PromptHash, hash2: PromptHash, threshold: number = 0.7): boolean {
    // Exact match
    if (hash1.exactHash === hash2.exactHash) return true;

    // Semantic match
    if (hash1.semanticHash === hash2.semanticHash) return true;

    // Key term overlap
    const overlap = hash1.keyTerms.filter(t => hash2.keyTerms.includes(t));
    const similarity = overlap.length / Math.max(hash1.keyTerms.length, hash2.keyTerms.length);

    return similarity >= threshold;
  }

  /**
   * Extract stock symbols from prompt
   */
  static extractSymbols(prompt: string): string[] {
    const symbolPattern = /\b[A-Z]{1,5}\b/g;
    const matches = prompt.match(symbolPattern) || [];

    // Filter common words that look like symbols
    const commonWords = new Set(['I', 'A', 'THE', 'AND', 'OR', 'NOT', 'FOR', 'THE', 'IS', 'IT']);
    return matches.filter(m => !commonWords.has(m));
  }
}
```

### Step 2: Create LLM Cache

Create `/server/ai/llm-cache.ts`:

```typescript
import { cacheManager } from '../cache/cache-manager';
import { PromptHasher, PromptHash } from './prompt-hasher';

export interface CacheEntry {
  response: string;
  promptHash: PromptHash;
  model: string;
  timestamp: Date;
  tokens: {
    prompt: number;
    completion: number;
  };
  metadata: {
    role: string;
    symbols: string[];
    cached: boolean;
  };
}

export interface LLMCacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  maxEntries: number;
  semanticMatching: boolean;
  semanticThreshold: number;
}

// Per-role cache configuration
export const ROLE_CACHE_CONFIG: Record<string, LLMCacheConfig> = {
  // News summaries can be cached longer (news doesn't change frequently)
  news_summarizer: {
    enabled: true,
    ttlSeconds: 3600, // 1 hour
    maxEntries: 200,
    semanticMatching: true,
    semanticThreshold: 0.8
  },

  // Technical analysis changes with price data
  technical_analyst: {
    enabled: true,
    ttlSeconds: 300, // 5 minutes
    maxEntries: 100,
    semanticMatching: false, // Need exact match for technical data
    semanticThreshold: 0.9
  },

  // Risk analysis can be cached briefly
  risk_manager: {
    enabled: true,
    ttlSeconds: 600, // 10 minutes
    maxEntries: 50,
    semanticMatching: true,
    semanticThreshold: 0.85
  },

  // Execution plans are time-sensitive
  execution_planner: {
    enabled: true,
    ttlSeconds: 60, // 1 minute
    maxEntries: 30,
    semanticMatching: false,
    semanticThreshold: 0.95
  },

  // Post-trade reports can be cached
  post_trade_reporter: {
    enabled: true,
    ttlSeconds: 1800, // 30 minutes
    maxEntries: 100,
    semanticMatching: true,
    semanticThreshold: 0.8
  },

  // Default config for unknown roles
  default: {
    enabled: true,
    ttlSeconds: 300,
    maxEntries: 50,
    semanticMatching: false,
    semanticThreshold: 0.9
  }
};

class LLMCache {
  private hitCount: number = 0;
  private missCount: number = 0;
  private savings: { tokens: number; estimatedCost: number } = { tokens: 0, estimatedCost: 0 };

  /**
   * Get cached response if available
   */
  async get(role: string, prompt: string, model: string): Promise<CacheEntry | null> {
    const config = this.getConfig(role);
    if (!config.enabled) {
      return null;
    }

    const promptHash = PromptHasher.hash(prompt, role);

    // Try exact match first
    const exactKey = `${role}:${model}:${promptHash.exactHash}`;
    let cached = await cacheManager.get<CacheEntry>('llmResponses', exactKey);

    if (cached) {
      this.hitCount++;
      this.recordSavings(cached);
      return { ...cached, metadata: { ...cached.metadata, cached: true } };
    }

    // Try semantic match if enabled
    if (config.semanticMatching) {
      const semanticKey = `${role}:${model}:${promptHash.semanticHash}`;
      cached = await cacheManager.get<CacheEntry>('llmResponses', semanticKey);

      if (cached && PromptHasher.areSimilar(promptHash, cached.promptHash, config.semanticThreshold)) {
        this.hitCount++;
        this.recordSavings(cached);
        return { ...cached, metadata: { ...cached.metadata, cached: true } };
      }
    }

    this.missCount++;
    return null;
  }

  /**
   * Store response in cache
   */
  async set(
    role: string,
    prompt: string,
    model: string,
    response: string,
    tokens: { prompt: number; completion: number }
  ): Promise<void> {
    const config = this.getConfig(role);
    if (!config.enabled) {
      return;
    }

    const promptHash = PromptHasher.hash(prompt, role);
    const symbols = PromptHasher.extractSymbols(prompt);

    const entry: CacheEntry = {
      response,
      promptHash,
      model,
      timestamp: new Date(),
      tokens,
      metadata: {
        role,
        symbols,
        cached: false
      }
    };

    // Store with exact hash
    const exactKey = `${role}:${model}:${promptHash.exactHash}`;
    await cacheManager.set('llmResponses', exactKey, entry);

    // Also store with semantic hash for semantic matching
    if (config.semanticMatching) {
      const semanticKey = `${role}:${model}:${promptHash.semanticHash}`;
      await cacheManager.set('llmResponses', semanticKey, entry);
    }
  }

  /**
   * Invalidate cache entries for a symbol
   */
  async invalidateSymbol(symbol: string): Promise<void> {
    await cacheManager.invalidatePattern('llmResponses', `*${symbol}*`);
  }

  /**
   * Invalidate cache for a role
   */
  async invalidateRole(role: string): Promise<void> {
    await cacheManager.invalidatePattern('llmResponses', `${role}:*`);
  }

  private getConfig(role: string): LLMCacheConfig {
    return ROLE_CACHE_CONFIG[role] || ROLE_CACHE_CONFIG.default;
  }

  private recordSavings(entry: CacheEntry): void {
    const totalTokens = entry.tokens.prompt + entry.tokens.completion;
    this.savings.tokens += totalTokens;

    // Estimate cost savings (using average pricing)
    const avgCostPer1k = 0.002; // $0.002 per 1K tokens average
    this.savings.estimatedCost += (totalTokens / 1000) * avgCostPer1k;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    hitRate: number;
    hits: number;
    misses: number;
    tokensSaved: number;
    costSaved: number;
  } {
    const total = this.hitCount + this.missCount;
    return {
      hitRate: total > 0 ? this.hitCount / total : 0,
      hits: this.hitCount,
      misses: this.missCount,
      tokensSaved: this.savings.tokens,
      costSaved: this.savings.estimatedCost
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
    this.savings = { tokens: 0, estimatedCost: 0 };
  }
}

export const llmCache = new LLMCache();
```

### Step 3: Update LLM Gateway

In `/server/ai/llmGateway.ts`, add caching layer:

```typescript
import { llmCache, CacheEntry } from './llm-cache';

// Wrap the existing callLLM function
export async function callLLMWithCache(
  role: string,
  prompt: string,
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const model = options.model || getModelForRole(role);

  // Check cache first
  const cached = await llmCache.get(role, prompt, model);
  if (cached) {
    console.log(`[LLMGateway] Cache hit for ${role}`);
    return {
      content: cached.response,
      model,
      tokens: cached.tokens,
      cached: true,
      latencyMs: 0
    };
  }

  // Call actual LLM
  const startTime = Date.now();
  const response = await callLLM(role, prompt, options);
  const latencyMs = Date.now() - startTime;

  // Store in cache (don't await to avoid latency)
  llmCache.set(role, prompt, model, response.content, response.tokens).catch(err => {
    console.error('[LLMGateway] Cache set error:', err);
  });

  return {
    ...response,
    cached: false,
    latencyMs
  };
}

// Add cache stats endpoint
export function getLLMCacheStats() {
  return llmCache.getStats();
}
```

### Step 4: Add API Endpoints

```typescript
// Add to your routes
app.get('/api/llm/cache/stats', (req, res) => {
  res.json(llmCache.getStats());
});

app.post('/api/llm/cache/invalidate/:symbol', async (req, res) => {
  await llmCache.invalidateSymbol(req.params.symbol);
  res.json({ success: true });
});

app.post('/api/llm/cache/clear', async (req, res) => {
  await cacheManager.clearNamespace('llmResponses');
  llmCache.resetStats();
  res.json({ success: true });
});
```

## ACCEPTANCE CRITERIA

- [ ] PromptHasher created with exact and semantic hashing
- [ ] LLMCache created with role-based TTL configuration
- [ ] LLM Gateway updated to use cache-first pattern
- [ ] Per-role cache configuration (news=1hr, technical=5min, etc.)
- [ ] Semantic similarity matching for news/reports
- [ ] Cache hit/miss statistics tracking
- [ ] Cost savings estimation
- [ ] Cache invalidation by symbol/role
- [ ] API endpoints for cache management
- [ ] TypeScript compilation succeeds

## VERIFICATION COMMANDS

```bash
# Check files created
ls -la server/ai/llm-cache.ts
ls -la server/ai/prompt-hasher.ts

# Verify TypeScript
npx tsc --noEmit

# Test cache stats
curl http://localhost:5000/api/llm/cache/stats

# Make same LLM call twice, verify second is cached
curl -X POST http://localhost:5000/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","type":"news_summary"}'

# Check stats again - should show 1 hit
curl http://localhost:5000/api/llm/cache/stats
```

## ESTIMATED IMPACT

- **New lines**: ~350
- **Files affected**: 4
- **Risk level**: Low (additive feature)
- **Cost reduction**: 30-40% fewer LLM API calls
- **Testing required**: Cache hit rate verification, TTL tests
