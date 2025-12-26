/**
 * Sentiment Aggregator Service - Unified sentiment analysis orchestrator
 *
 * Aggregates sentiment from multiple sources with intelligent prioritization:
 * - GDELT (free, priority 1) - Global news with tone analysis
 * - NewsAPI (budget-limited, priority 2) - Curated news sources
 * - HuggingFace FinBERT (classification, priority 3) - ML-based sentiment
 *
 * Features:
 * - Intelligent 30-min TTL caching
 * - Weighted sentiment scoring with conflict detection
 * - Rate limiting and graceful fallbacks
 * - API usage cost tracking
 * - Batch processing for multiple symbols
 *
 * @see scale/replit-prompts/02-sentiment-aggregator.md
 */

import { gdelt } from "../connectors/gdelt";
import { newsapi } from "../connectors/newsapi";
import { huggingface } from "../connectors/huggingface";
import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";

// ============================================================================
// Types and Interfaces
// ============================================================================

export type SentimentSourceName = "gdelt" | "newsapi" | "huggingface";

export interface SentimentSource {
  name: SentimentSourceName;
  score: number; // -1 to 1 (bearish to bullish)
  confidence: number; // 0 to 1
  articleCount: number;
  timestamp: Date;
  error?: string;
  latencyMs?: number;
}

export interface AggregatedSentiment {
  symbol: string;
  overallScore: number; // -1 to 1 (bearish to bullish)
  overallConfidence: number; // 0 to 1
  sources: SentimentSource[];
  conflictDetected: boolean;
  conflictSeverity: number; // 0 to 1
  recommendation: "bullish" | "bearish" | "neutral" | "conflicted";
  timestamp: Date;
  cacheHit: boolean;
}

export interface SentimentConfig {
  weights: {
    gdelt: number;
    newsapi: number;
    huggingface: number;
  };
  minSources: number; // Minimum sources for high confidence
  conflictThreshold: number; // Standard deviation threshold for conflict
  cacheTTLMinutes: number;
  enableParallelFetch: boolean;
}

export interface SentimentStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  apiCalls: {
    gdelt: number;
    newsapi: number;
    huggingface: number;
  };
  averageLatencyMs: number;
  errors: {
    gdelt: number;
    newsapi: number;
    huggingface: number;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: SentimentConfig = {
  weights: {
    gdelt: 0.40,      // Priority 1: Free, high-volume global news
    newsapi: 0.35,    // Priority 2: Curated sources, budget-limited
    huggingface: 0.25 // Priority 3: ML classification, slower
  },
  minSources: 2,
  conflictThreshold: 0.5, // Conflict if std dev > 0.5
  cacheTTLMinutes: 30,
  enableParallelFetch: true,
};

// ============================================================================
// Sentiment Aggregator Service
// ============================================================================

class SentimentAggregatorService {
  private config: SentimentConfig;
  private cache: ApiCache<AggregatedSentiment>;
  private stats: SentimentStats;

  constructor(config: Partial<SentimentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize cache with 30-min fresh, 2-hour stale
    this.cache = new ApiCache<AggregatedSentiment>({
      freshDuration: this.config.cacheTTLMinutes * 60 * 1000,
      staleDuration: 2 * 60 * 60 * 1000,
    });

    // Initialize stats
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: { gdelt: 0, newsapi: 0, huggingface: 0 },
      averageLatencyMs: 0,
      errors: { gdelt: 0, newsapi: 0, huggingface: 0 },
    };

    log.info("SentimentAggregator", "Service initialized", {
      cacheTTL: this.config.cacheTTLMinutes,
      weights: this.config.weights,
    });
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Get aggregated sentiment for a single symbol
   * Returns cached result if available and fresh
   */
  async getSentiment(symbol: string): Promise<AggregatedSentiment> {
    this.stats.totalRequests++;
    const startTime = Date.now();

    // Check cache
    const cacheKey = this.buildCacheKey(symbol);
    const cached = this.cache.get(cacheKey);

    if (cached?.isFresh) {
      this.stats.cacheHits++;
      log.debug("SentimentAggregator", "Cache hit", { symbol, age: Date.now() - cached.data.timestamp.getTime() });
      return { ...cached.data, cacheHit: true };
    }

    this.stats.cacheMisses++;

    // Fetch from all sources
    const sources = await this.fetchAllSources(symbol);

    // Aggregate sentiment
    const aggregated = this.aggregateSources(symbol, sources);
    aggregated.cacheHit = false;

    // Update cache
    this.cache.set(cacheKey, aggregated);

    // Update stats
    const latency = Date.now() - startTime;
    this.updateLatencyStats(latency);

    log.info("SentimentAggregator", "Sentiment aggregated", {
      symbol,
      score: aggregated.overallScore.toFixed(3),
      confidence: aggregated.overallConfidence.toFixed(3),
      recommendation: aggregated.recommendation,
      sources: aggregated.sources.length,
      latencyMs: latency,
    });

    return aggregated;
  }

  /**
   * Get sentiment with detailed source breakdown
   * Useful for debugging and transparency
   */
  async getSentimentWithSources(symbol: string): Promise<AggregatedSentiment> {
    return this.getSentiment(symbol);
  }

  /**
   * Batch get sentiment for multiple symbols
   * More efficient than calling getSentiment multiple times
   */
  async batchGetSentiment(symbols: string[]): Promise<Map<string, AggregatedSentiment>> {
    log.info("SentimentAggregator", "Batch sentiment request", { count: symbols.length });

    const results = new Map<string, AggregatedSentiment>();

    // Process in parallel with concurrency limit
    const BATCH_SIZE = 5;
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(symbol => this.getSentiment(symbol))
      );

      batch.forEach((symbol, idx) => {
        const result = batchResults[idx];
        if (result.status === "fulfilled") {
          results.set(symbol, result.value);
        } else {
          log.warn("SentimentAggregator", "Batch item failed", {
            symbol,
            error: String(result.reason)
          });
        }
      });
    }

    return results;
  }

  /**
   * Get service statistics
   */
  getStats(): SentimentStats {
    return { ...this.stats };
  }

  /**
   * Clear cache and reset stats
   */
  clearCache(): void {
    this.cache.clear();
    log.info("SentimentAggregator", "Cache cleared");
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(config: Partial<SentimentConfig>): void {
    this.config = { ...this.config, ...config };
    log.info("SentimentAggregator", "Configuration updated", { config: this.config });
  }

  // --------------------------------------------------------------------------
  // Private Methods - Source Fetching
  // --------------------------------------------------------------------------

  private async fetchAllSources(symbol: string): Promise<SentimentSource[]> {
    if (this.config.enableParallelFetch) {
      return this.fetchSourcesParallel(symbol);
    } else {
      return this.fetchSourcesSequential(symbol);
    }
  }

  private async fetchSourcesParallel(symbol: string): Promise<SentimentSource[]> {
    const [gdeltResult, newsapiResult, huggingfaceResult] = await Promise.allSettled([
      this.fetchGDELTSentiment(symbol),
      this.fetchNewsAPISentiment(symbol),
      this.fetchHuggingFaceSentiment(symbol),
    ]);

    const sources: SentimentSource[] = [];

    if (gdeltResult.status === "fulfilled") {
      sources.push(gdeltResult.value);
    }
    if (newsapiResult.status === "fulfilled") {
      sources.push(newsapiResult.value);
    }
    if (huggingfaceResult.status === "fulfilled") {
      sources.push(huggingfaceResult.value);
    }

    return sources;
  }

  private async fetchSourcesSequential(symbol: string): Promise<SentimentSource[]> {
    const sources: SentimentSource[] = [];

    // Priority 1: GDELT (free)
    try {
      const gdeltSource = await this.fetchGDELTSentiment(symbol);
      if (gdeltSource.confidence > 0) {
        sources.push(gdeltSource);
      }
    } catch (error) {
      log.warn("SentimentAggregator", "GDELT fetch failed", { error: String(error) });
    }

    // Priority 2: NewsAPI (budget-limited)
    try {
      const newsapiSource = await this.fetchNewsAPISentiment(symbol);
      if (newsapiSource.confidence > 0) {
        sources.push(newsapiSource);
      }
    } catch (error) {
      log.warn("SentimentAggregator", "NewsAPI fetch failed", { error: String(error) });
    }

    // Priority 3: HuggingFace (ML-based)
    try {
      const hfSource = await this.fetchHuggingFaceSentiment(symbol);
      if (hfSource.confidence > 0) {
        sources.push(hfSource);
      }
    } catch (error) {
      log.warn("SentimentAggregator", "HuggingFace fetch failed", { error: String(error) });
    }

    return sources;
  }

  private async fetchGDELTSentiment(symbol: string): Promise<SentimentSource> {
    const startTime = Date.now();
    this.stats.apiCalls.gdelt++;

    try {
      const sentiment = await gdelt.analyzeSymbolSentiment(symbol);
      const latencyMs = Date.now() - startTime;

      // GDELT tone is typically -10 to 10, normalize to -1 to 1
      const normalizedScore = Math.max(-1, Math.min(1, sentiment.averageTone / 10));

      // Confidence based on article count (more articles = higher confidence)
      const confidence = Math.min(1, sentiment.articleCount / 20);

      return {
        name: "gdelt",
        score: normalizedScore,
        confidence,
        articleCount: sentiment.articleCount,
        timestamp: new Date(),
        latencyMs,
      };
    } catch (error) {
      this.stats.errors.gdelt++;
      log.error("SentimentAggregator", "GDELT error", { symbol, error: String(error) });

      return {
        name: "gdelt",
        score: 0,
        confidence: 0,
        articleCount: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async fetchNewsAPISentiment(symbol: string): Promise<SentimentSource> {
    const startTime = Date.now();
    this.stats.apiCalls.newsapi++;

    try {
      const articles = await newsapi.getStockNews(symbol, 20);
      const latencyMs = Date.now() - startTime;

      if (articles.length === 0) {
        return {
          name: "newsapi",
          score: 0,
          confidence: 0,
          articleCount: 0,
          timestamp: new Date(),
          latencyMs,
        };
      }

      // Perform sentiment analysis using keyword matching
      const sentimentScore = this.analyzeArticlesSentiment(articles);

      // Confidence based on article count
      const confidence = Math.min(1, articles.length / 10);

      return {
        name: "newsapi",
        score: sentimentScore,
        confidence,
        articleCount: articles.length,
        timestamp: new Date(),
        latencyMs,
      };
    } catch (error) {
      this.stats.errors.newsapi++;
      log.error("SentimentAggregator", "NewsAPI error", { symbol, error: String(error) });

      return {
        name: "newsapi",
        score: 0,
        confidence: 0,
        articleCount: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async fetchHuggingFaceSentiment(symbol: string): Promise<SentimentSource> {
    const startTime = Date.now();
    this.stats.apiCalls.huggingface++;

    try {
      // Check if HuggingFace is available
      if (!huggingface.isAvailable()) {
        return {
          name: "huggingface",
          score: 0,
          confidence: 0,
          articleCount: 0,
          timestamp: new Date(),
          error: "HuggingFace API key not configured",
          latencyMs: Date.now() - startTime,
        };
      }

      // Get news headlines first
      const articles = await newsapi.getStockNews(symbol, 5).catch(() => []);
      const headlines = articles
        .map(a => a.title)
        .filter(Boolean)
        .slice(0, 5);

      if (headlines.length === 0) {
        return {
          name: "huggingface",
          score: 0,
          confidence: 0,
          articleCount: 0,
          timestamp: new Date(),
          latencyMs: Date.now() - startTime,
        };
      }

      // Analyze headlines with FinBERT
      const enrichment = await huggingface.generateEnrichmentSignal(symbol, headlines);
      const latencyMs = Date.now() - startTime;

      return {
        name: "huggingface",
        score: enrichment.sentimentScore,
        confidence: enrichment.confidence,
        articleCount: headlines.length,
        timestamp: new Date(),
        latencyMs,
      };
    } catch (error) {
      this.stats.errors.huggingface++;
      log.error("SentimentAggregator", "HuggingFace error", { symbol, error: String(error) });

      return {
        name: "huggingface",
        score: 0,
        confidence: 0,
        articleCount: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  // --------------------------------------------------------------------------
  // Private Methods - Sentiment Analysis
  // --------------------------------------------------------------------------

  private analyzeArticlesSentiment(articles: any[]): number {
    let positiveCount = 0;
    let negativeCount = 0;

    const positiveKeywords = [
      "surge", "surges", "surged", "surging",
      "gain", "gains", "gained", "gaining",
      "rise", "rises", "rose", "rising",
      "rally", "rallies", "rallied", "rallying",
      "up", "bullish", "bull",
      "growth", "growing", "grew",
      "profit", "profitable", "profits",
      "beat", "beats", "beating", "outperform",
      "strong", "strength", "strengthen",
      "boost", "boosted", "boosting",
      "soar", "soared", "soaring",
      "jump", "jumped", "jumping",
      "climb", "climbed", "climbing",
      "advance", "advanced", "advancing",
      "positive", "optimistic", "confident",
      "success", "successful", "win", "winning"
    ];

    const negativeKeywords = [
      "fall", "falls", "fell", "falling",
      "drop", "drops", "dropped", "dropping",
      "decline", "declines", "declined", "declining",
      "plunge", "plunged", "plunging",
      "down", "bearish", "bear",
      "loss", "losses", "losing", "lost",
      "miss", "missed", "missing", "underperform",
      "weak", "weakness", "weaken",
      "crash", "crashed", "crashing",
      "sink", "sank", "sinking",
      "tumble", "tumbled", "tumbling",
      "slide", "slid", "sliding",
      "slump", "slumped", "slumping",
      "negative", "pessimistic", "concern", "worried",
      "fail", "failed", "failure", "risk", "risky"
    ];

    articles.forEach((article) => {
      const text = `${article.title || ""} ${article.description || ""}`.toLowerCase();

      positiveKeywords.forEach(keyword => {
        if (text.includes(keyword)) positiveCount++;
      });

      negativeKeywords.forEach(keyword => {
        if (text.includes(keyword)) negativeCount++;
      });
    });

    const total = positiveCount + negativeCount;
    if (total === 0) return 0;

    // Normalize to -1 to 1 range
    return (positiveCount - negativeCount) / total;
  }

  // --------------------------------------------------------------------------
  // Private Methods - Aggregation
  // --------------------------------------------------------------------------

  private aggregateSources(symbol: string, sources: SentimentSource[]): AggregatedSentiment {
    // Filter out sources with errors or zero confidence
    const validSources = sources.filter(s => !s.error && s.confidence > 0);

    if (validSources.length === 0) {
      log.warn("SentimentAggregator", "No valid sources", { symbol });
      return {
        symbol,
        overallScore: 0,
        overallConfidence: 0,
        sources,
        conflictDetected: false,
        conflictSeverity: 0,
        recommendation: "neutral",
        timestamp: new Date(),
        cacheHit: false,
      };
    }

    // Calculate weighted average score
    let weightedSum = 0;
    let weightSum = 0;
    let confidenceSum = 0;

    validSources.forEach(source => {
      const weight = this.config.weights[source.name] * source.confidence;
      weightedSum += source.score * weight;
      weightSum += weight;
      confidenceSum += source.confidence;
    });

    const overallScore = weightSum > 0 ? weightedSum / weightSum : 0;

    // Adjust confidence based on source count
    const baseConfidence = confidenceSum / validSources.length;
    const sourceCountPenalty = validSources.length < this.config.minSources ? 0.7 : 1.0;
    const overallConfidence = baseConfidence * sourceCountPenalty;

    // Detect conflicts (high variance between sources)
    const { variance, stdDev } = this.calculateVariance(validSources.map(s => s.score));
    const conflictDetected = stdDev > this.config.conflictThreshold;
    const conflictSeverity = Math.min(1, stdDev / this.config.conflictThreshold);

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      overallScore,
      conflictDetected,
      conflictSeverity
    );

    return {
      symbol,
      overallScore,
      overallConfidence,
      sources,
      conflictDetected,
      conflictSeverity,
      recommendation,
      timestamp: new Date(),
      cacheHit: false,
    };
  }

  private calculateVariance(values: number[]): { variance: number; stdDev: number } {
    if (values.length < 2) {
      return { variance: 0, stdDev: 0 };
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { variance, stdDev };
  }

  private generateRecommendation(
    score: number,
    conflictDetected: boolean,
    conflictSeverity: number
  ): "bullish" | "bearish" | "neutral" | "conflicted" {
    // High conflict overrides sentiment
    if (conflictDetected && conflictSeverity > 0.7) {
      return "conflicted";
    }

    // Standard sentiment thresholds
    if (score > 0.25) return "bullish";
    if (score < -0.25) return "bearish";
    return "neutral";
  }

  // --------------------------------------------------------------------------
  // Private Methods - Utilities
  // --------------------------------------------------------------------------

  private buildCacheKey(symbol: string): string {
    return `sentiment_${symbol.toUpperCase()}`;
  }

  private updateLatencyStats(latencyMs: number): void {
    const totalLatency = this.stats.averageLatencyMs * (this.stats.totalRequests - 1);
    this.stats.averageLatencyMs = (totalLatency + latencyMs) / this.stats.totalRequests;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const sentimentAggregator = new SentimentAggregatorService();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Quick helper to get sentiment score for a symbol
 */
export async function getSymbolSentiment(symbol: string): Promise<number> {
  const result = await sentimentAggregator.getSentiment(symbol);
  return result.overallScore;
}

/**
 * Quick helper to get sentiment recommendation for a symbol
 */
export async function getSymbolRecommendation(
  symbol: string
): Promise<"bullish" | "bearish" | "neutral" | "conflicted"> {
  const result = await sentimentAggregator.getSentiment(symbol);
  return result.recommendation;
}

/**
 * Check if sentiment is bullish with high confidence
 */
export async function isBullish(symbol: string, minConfidence = 0.6): Promise<boolean> {
  const result = await sentimentAggregator.getSentiment(symbol);
  return result.recommendation === "bullish" && result.overallConfidence >= minConfidence;
}

/**
 * Check if sentiment is bearish with high confidence
 */
export async function isBearish(symbol: string, minConfidence = 0.6): Promise<boolean> {
  const result = await sentimentAggregator.getSentiment(symbol);
  return result.recommendation === "bearish" && result.overallConfidence >= minConfidence;
}
