/**
 * AI Active Trader - Multi-Source Sentiment Fusion
 * Aggregates sentiment signals from GDELT, NewsAPI, FinBERT, and social sources
 * 
 * Features:
 * - Source-weighted sentiment aggregation
 * - Time-decay for recency bias
 * - Conflict detection between sources
 * - Confidence propagation with uncertainty handling
 * - Market regime-aware signal adjustment
 */

import { performance } from 'perf_hooks';
import { createLogger, getSecretManager } from '../common';

const logger = createLogger('sentiment-fusion');

// Source identifiers for attribution
export enum SentimentSource {
  GDELT = 'gdelt',
  NEWSAPI = 'newsapi',
  FINBERT = 'finbert',
  TWITTER = 'twitter',
  REDDIT = 'reddit',
  STOCKTWITS = 'stocktwits',
  CUSTOM = 'custom',
}

// Sentiment polarity classification
export type SentimentPolarity = 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish';

// Individual sentiment signal from a single source
export interface SentimentSignal {
  id: string;
  source: SentimentSource;
  symbol: string;
  polarity: SentimentPolarity;
  score: number;        // -1 to +1 normalized score
  confidence: number;   // 0 to 1 confidence in the signal
  volume: number;       // Number of data points aggregated
  timestamp: Date;
  metadata?: {
    headline?: string;
    url?: string;
    articleCount?: number;
    mentionCount?: number;
    engagementScore?: number;
    geographicFocus?: string;
    eventType?: string;
  };
}

// Aggregated sentiment across all sources
export interface FusedSentiment {
  symbol: string;
  overallPolarity: SentimentPolarity;
  fusedScore: number;           // -1 to +1 weighted average
  confidence: number;           // Combined confidence
  sourceCount: number;          // Number of contributing sources
  signalCount: number;          // Total signals aggregated
  divergence: number;           // 0 to 1, higher = sources disagree
  momentum: number;             // Rate of change in sentiment
  trend: 'improving' | 'stable' | 'deteriorating';
  sourceBreakdown: SourceContribution[];
  lastUpdated: Date;
  signals: SentimentSignal[];   // Raw signals for transparency
}

// Per-source contribution to the fused score
export interface SourceContribution {
  source: SentimentSource;
  weight: number;
  score: number;
  confidence: number;
  signalCount: number;
  lastUpdate: Date;
}

// Configuration for source weighting and fusion
export interface SourceConfig {
  source: SentimentSource;
  baseWeight: number;           // Default weight (0-1)
  reliabilityMultiplier: number; // Historical accuracy multiplier
  freshnessDecayHours: number;  // Time for signal strength to halve
  minSignalsRequired: number;   // Minimum signals for valid reading
  enabled: boolean;
}

// Fusion engine configuration
export interface FusionConfig {
  sources: SourceConfig[];
  aggregationWindowMs: number;  // Window for combining signals
  minSourcesForConfidence: number;
  divergenceThreshold: number;  // Score diff to flag divergence
  momentumWindowMs: number;     // Window for momentum calculation
  cacheEnabled: boolean;
  cacheTTLMs: number;
  conflictResolution: 'weighted_average' | 'majority_vote' | 'max_confidence';
}

// GDELT-specific data structures
export interface GDELTEvent {
  eventId: string;
  actor1: string;
  actor2?: string;
  eventCode: string;
  goldsteinScale: number;  // -10 to +10 impact scale
  numMentions: number;
  numSources: number;
  numArticles: number;
  avgTone: number;
  dateAdded: Date;
  sourceUrl?: string;
  location?: {
    country: string;
    region?: string;
  };
}

// NewsAPI-specific data structures
export interface NewsAPIArticle {
  source: { id: string; name: string };
  author?: string;
  title: string;
  description?: string;
  url: string;
  urlToImage?: string;
  publishedAt: string;
  content?: string;
}

// Social signal data structure
export interface SocialSignal {
  platform: 'twitter' | 'reddit' | 'stocktwits';
  symbol: string;
  mentionCount: number;
  sentimentScore: number;
  engagementScore: number;
  influencerMentions: number;
  timestamp: Date;
  trendingRank?: number;
}

// Default source configurations based on research on source reliability
const DEFAULT_SOURCE_CONFIGS: SourceConfig[] = [
  {
    source: SentimentSource.GDELT,
    baseWeight: 0.25,
    reliabilityMultiplier: 1.0,
    freshnessDecayHours: 12,
    minSignalsRequired: 3,
    enabled: true,
  },
  {
    source: SentimentSource.NEWSAPI,
    baseWeight: 0.30,
    reliabilityMultiplier: 1.1,
    freshnessDecayHours: 6,
    minSignalsRequired: 2,
    enabled: true,
  },
  {
    source: SentimentSource.FINBERT,
    baseWeight: 0.35,
    reliabilityMultiplier: 1.2,
    freshnessDecayHours: 4,
    minSignalsRequired: 1,
    enabled: true,
  },
  {
    source: SentimentSource.TWITTER,
    baseWeight: 0.15,
    reliabilityMultiplier: 0.8,
    freshnessDecayHours: 2,
    minSignalsRequired: 10,
    enabled: false, // Disabled by default, requires API access
  },
  {
    source: SentimentSource.REDDIT,
    baseWeight: 0.15,
    reliabilityMultiplier: 0.7,
    freshnessDecayHours: 4,
    minSignalsRequired: 5,
    enabled: false,
  },
  {
    source: SentimentSource.STOCKTWITS,
    baseWeight: 0.10,
    reliabilityMultiplier: 0.6,
    freshnessDecayHours: 1,
    minSignalsRequired: 20,
    enabled: false,
  },
];

const DEFAULT_FUSION_CONFIG: FusionConfig = {
  sources: DEFAULT_SOURCE_CONFIGS,
  aggregationWindowMs: 24 * 60 * 60 * 1000, // 24 hours
  minSourcesForConfidence: 2,
  divergenceThreshold: 0.4,
  momentumWindowMs: 4 * 60 * 60 * 1000, // 4 hours
  cacheEnabled: true,
  cacheTTLMs: 5 * 60 * 1000, // 5 minutes
  conflictResolution: 'weighted_average',
};

// Singleton cache for fused sentiments
interface CacheEntry {
  sentiment: FusedSentiment;
  expiresAt: number;
}

export class SentimentFusionEngine {
  private config: FusionConfig;
  private signalBuffer: Map<string, SentimentSignal[]> = new Map();
  private fusionCache: Map<string, CacheEntry> = new Map();
  private sentimentHistory: Map<string, FusedSentiment[]> = new Map();
  private apiKeys: Map<string, string> = new Map();
  private isInitialized = false;
  
  private metrics = {
    signalsProcessed: 0,
    fusionsPerformed: 0,
    cacheHits: 0,
    cacheMisses: 0,
    divergenceAlerts: 0,
    avgFusionLatencyMs: 0,
    sourceHealthScores: new Map<SentimentSource, number>(),
  };

  constructor(config?: Partial<FusionConfig>) {
    this.config = { ...DEFAULT_FUSION_CONFIG, ...config };
    if (config?.sources) {
      this.config.sources = config.sources.map(s => ({
        ...DEFAULT_SOURCE_CONFIGS.find(d => d.source === s.source) || DEFAULT_SOURCE_CONFIGS[0],
        ...s,
      }));
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const secretManager = getSecretManager();
      
      const newsApiKey = await secretManager.get('NEWS_API_KEY');
      if (newsApiKey) this.apiKeys.set('newsapi', newsApiKey);
      
      for (const source of this.config.sources) {
        this.metrics.sourceHealthScores.set(source.source, 1.0);
      }

      this.isInitialized = true;
      logger.info('Sentiment Fusion Engine initialized', {
        enabledSources: this.config.sources.filter(s => s.enabled).map(s => s.source),
        aggregationWindow: this.config.aggregationWindowMs,
      });
    } catch (err) {
      logger.error('Failed to initialize Sentiment Fusion Engine', err as Error);
      throw err;
    }
  }

  // Ingest a raw sentiment signal from any source
  ingestSignal(signal: SentimentSignal): void {
    const key = signal.symbol.toUpperCase();
    const signals = this.signalBuffer.get(key) || [];
    signals.push(signal);
    
    // Prune old signals outside aggregation window
    const cutoff = Date.now() - this.config.aggregationWindowMs;
    const pruned = signals.filter(s => s.timestamp.getTime() > cutoff);
    
    this.signalBuffer.set(key, pruned);
    this.metrics.signalsProcessed++;
    
    // Invalidate cache for this symbol
    this.fusionCache.delete(key);
    
    logger.debug('Signal ingested', {
      symbol: key,
      source: signal.source,
      score: signal.score.toFixed(3),
      bufferSize: pruned.length,
    });
  }

  // Batch ingest multiple signals
  ingestSignals(signals: SentimentSignal[]): void {
    for (const signal of signals) {
      this.ingestSignal(signal);
    }
  }

  // Transform GDELT event to sentiment signal
  transformGDELTEvent(event: GDELTEvent, symbol: string): SentimentSignal {
    // Goldstein scale ranges from -10 (conflict) to +10 (cooperation)
    // Normalize to -1 to +1
    const normalizedScore = event.goldsteinScale / 10;
    
    // avgTone is typically -100 to +100, normalize
    const toneScore = event.avgTone / 100;
    
    // Combine Goldstein and tone with more weight on tone
    const combinedScore = (normalizedScore * 0.4) + (toneScore * 0.6);
    
    // Confidence based on mentions and sources
    const volumeConfidence = Math.min(1, Math.log10(event.numMentions + 1) / 3);
    const sourceConfidence = Math.min(1, event.numSources / 20);
    const confidence = (volumeConfidence + sourceConfidence) / 2;
    
    return {
      id: `gdelt_${event.eventId}`,
      source: SentimentSource.GDELT,
      symbol: symbol.toUpperCase(),
      polarity: this.scoreToPolarity(combinedScore),
      score: Math.max(-1, Math.min(1, combinedScore)),
      confidence,
      volume: event.numArticles,
      timestamp: event.dateAdded,
      metadata: {
        articleCount: event.numArticles,
        mentionCount: event.numMentions,
        eventType: event.eventCode,
        geographicFocus: event.location?.country,
        url: event.sourceUrl,
      },
    };
  }

  // Transform NewsAPI article to sentiment signal (requires external sentiment analysis)
  transformNewsAPIArticle(
    article: NewsAPIArticle,
    symbol: string,
    sentimentScore: number,
    confidence: number
  ): SentimentSignal {
    return {
      id: `newsapi_${Buffer.from(article.url).toString('base64').substring(0, 20)}`,
      source: SentimentSource.NEWSAPI,
      symbol: symbol.toUpperCase(),
      polarity: this.scoreToPolarity(sentimentScore),
      score: Math.max(-1, Math.min(1, sentimentScore)),
      confidence,
      volume: 1,
      timestamp: new Date(article.publishedAt),
      metadata: {
        headline: article.title,
        url: article.url,
      },
    };
  }

  // Transform social signal to sentiment signal
  transformSocialSignal(social: SocialSignal): SentimentSignal {
    // Weight engagement and influencer mentions
    const engagementWeight = Math.min(1, social.engagementScore / 10000);
    const influencerBoost = 1 + (social.influencerMentions * 0.1);
    const confidence = Math.min(1, (engagementWeight * influencerBoost));
    
    const sourceMap: Record<string, SentimentSource> = {
      twitter: SentimentSource.TWITTER,
      reddit: SentimentSource.REDDIT,
      stocktwits: SentimentSource.STOCKTWITS,
    };
    
    return {
      id: `${social.platform}_${social.symbol}_${social.timestamp.getTime()}`,
      source: sourceMap[social.platform] || SentimentSource.CUSTOM,
      symbol: social.symbol.toUpperCase(),
      polarity: this.scoreToPolarity(social.sentimentScore),
      score: Math.max(-1, Math.min(1, social.sentimentScore)),
      confidence,
      volume: social.mentionCount,
      timestamp: social.timestamp,
      metadata: {
        mentionCount: social.mentionCount,
        engagementScore: social.engagementScore,
      },
    };
  }

  // Create FinBERT signal from existing analysis
  createFinBERTSignal(
    symbol: string,
    score: number,
    confidence: number,
    articleId: string
  ): SentimentSignal {
    return {
      id: `finbert_${articleId}`,
      source: SentimentSource.FINBERT,
      symbol: symbol.toUpperCase(),
      polarity: this.scoreToPolarity(score),
      score: Math.max(-1, Math.min(1, score)),
      confidence,
      volume: 1,
      timestamp: new Date(),
    };
  }

  // Get fused sentiment for a symbol
  getFusedSentiment(symbol: string): FusedSentiment | null {
    const key = symbol.toUpperCase();
    
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.fusionCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        this.metrics.cacheHits++;
        return cached.sentiment;
      }
    }
    
    this.metrics.cacheMisses++;
    
    const signals = this.signalBuffer.get(key);
    if (!signals || signals.length === 0) {
      return null;
    }
    
    const startTime = performance.now();
    const fused = this.performFusion(key, signals);
    const latencyMs = performance.now() - startTime;
    
    // Update average latency
    this.metrics.avgFusionLatencyMs = 
      (this.metrics.avgFusionLatencyMs * this.metrics.fusionsPerformed + latencyMs) /
      (this.metrics.fusionsPerformed + 1);
    this.metrics.fusionsPerformed++;
    
    // Cache result
    if (this.config.cacheEnabled) {
      this.fusionCache.set(key, {
        sentiment: fused,
        expiresAt: Date.now() + this.config.cacheTTLMs,
      });
    }
    
    // Add to history for momentum calculation
    this.addToHistory(key, fused);
    
    return fused;
  }

  // Perform the actual fusion calculation
  private performFusion(symbol: string, signals: SentimentSignal[]): FusedSentiment {
    const now = Date.now();
    const sourceSignals = new Map<SentimentSource, SentimentSignal[]>();
    
    // Group signals by source
    for (const signal of signals) {
      const existing = sourceSignals.get(signal.source) || [];
      existing.push(signal);
      sourceSignals.set(signal.source, existing);
    }
    
    const contributions: SourceContribution[] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;
    let totalConfidence = 0;
    let signalCount = 0;
    
    for (const [source, sourceConfig] of this.getEnabledSources()) {
      const sourceSignalList = sourceSignals.get(source);
      
      if (!sourceSignalList || sourceSignalList.length < sourceConfig.minSignalsRequired) {
        continue;
      }
      
      // Calculate time-weighted average for this source
      let sourceWeightedScore = 0;
      let sourceWeightSum = 0;
      let sourceConfidenceSum = 0;
      let latestUpdate = new Date(0);
      
      for (const signal of sourceSignalList) {
        const ageHours = (now - signal.timestamp.getTime()) / (1000 * 60 * 60);
        const freshnessWeight = Math.exp(-ageHours / sourceConfig.freshnessDecayHours);
        const signalWeight = signal.confidence * freshnessWeight * signal.volume;
        
        sourceWeightedScore += signal.score * signalWeight;
        sourceWeightSum += signalWeight;
        sourceConfidenceSum += signal.confidence;
        
        if (signal.timestamp > latestUpdate) {
          latestUpdate = signal.timestamp;
        }
      }
      
      if (sourceWeightSum === 0) continue;
      
      const sourceAvgScore = sourceWeightedScore / sourceWeightSum;
      const sourceAvgConfidence = sourceConfidenceSum / sourceSignalList.length;
      
      // Apply source-level weights
      const healthScore = this.metrics.sourceHealthScores.get(source) || 1.0;
      const finalWeight = sourceConfig.baseWeight * sourceConfig.reliabilityMultiplier * healthScore;
      
      contributions.push({
        source,
        weight: finalWeight,
        score: sourceAvgScore,
        confidence: sourceAvgConfidence,
        signalCount: sourceSignalList.length,
        lastUpdate: latestUpdate,
      });
      
      totalWeightedScore += sourceAvgScore * finalWeight * sourceAvgConfidence;
      totalWeight += finalWeight * sourceAvgConfidence;
      totalConfidence += sourceAvgConfidence * finalWeight;
      signalCount += sourceSignalList.length;
    }
    
    if (totalWeight === 0) {
      return this.createEmptyFusion(symbol, signals);
    }
    
    const fusedScore = totalWeightedScore / totalWeight;
    const avgConfidence = totalConfidence / contributions.length;
    
    // Calculate divergence (how much sources disagree)
    const divergence = this.calculateDivergence(contributions);
    
    if (divergence > this.config.divergenceThreshold) {
      this.metrics.divergenceAlerts++;
      logger.warn('High sentiment divergence detected', {
        symbol,
        divergence: divergence.toFixed(3),
        sources: contributions.map(c => ({ source: c.source, score: c.score.toFixed(3) })),
      });
    }
    
    // Calculate momentum from history
    const momentum = this.calculateMomentum(symbol, fusedScore);
    
    // Determine trend
    const trend = momentum > 0.05 ? 'improving' : momentum < -0.05 ? 'deteriorating' : 'stable';
    
    // Adjust confidence based on source count
    const sourceCountBonus = Math.min(1, contributions.length / this.config.minSourcesForConfidence);
    const adjustedConfidence = avgConfidence * sourceCountBonus * (1 - divergence * 0.5);
    
    return {
      symbol,
      overallPolarity: this.scoreToPolarity(fusedScore),
      fusedScore,
      confidence: Math.max(0, Math.min(1, adjustedConfidence)),
      sourceCount: contributions.length,
      signalCount,
      divergence,
      momentum,
      trend,
      sourceBreakdown: contributions,
      lastUpdated: new Date(),
      signals,
    };
  }

  // Calculate divergence between source scores using weighted variance
  private calculateDivergence(contributions: SourceContribution[]): number {
    if (contributions.length < 2) return 0;
    
    // Calculate weighted mean using confidence and weight
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const c of contributions) {
      const effectiveWeight = c.weight * c.confidence;
      weightedSum += c.score * effectiveWeight;
      totalWeight += effectiveWeight;
    }
    
    if (totalWeight === 0) return 0;
    
    const weightedMean = weightedSum / totalWeight;
    
    // Calculate weighted variance
    let varianceSum = 0;
    for (const c of contributions) {
      const effectiveWeight = c.weight * c.confidence;
      varianceSum += effectiveWeight * Math.pow(c.score - weightedMean, 2);
    }
    
    const weightedVariance = varianceSum / totalWeight;
    
    // Normalize to 0-1 range (max variance for -1 to +1 range is 1)
    return Math.min(1, Math.sqrt(weightedVariance));
  }

  // Calculate momentum from historical data
  private calculateMomentum(symbol: string, currentScore: number): number {
    const history = this.sentimentHistory.get(symbol);
    if (!history || history.length < 2) return 0;
    
    const cutoff = Date.now() - this.config.momentumWindowMs;
    const recentHistory = history.filter(h => h.lastUpdated.getTime() > cutoff);
    
    if (recentHistory.length < 2) return 0;
    
    // Calculate simple linear regression slope
    const n = recentHistory.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += recentHistory[i].fusedScore;
      sumXY += i * recentHistory[i].fusedScore;
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // Normalize slope to reasonable range
    return Math.max(-1, Math.min(1, slope * 10));
  }

  // Add fused sentiment to history
  private addToHistory(symbol: string, sentiment: FusedSentiment): void {
    const history = this.sentimentHistory.get(symbol) || [];
    history.push(sentiment);
    
    // Keep only recent history
    const cutoff = Date.now() - (this.config.momentumWindowMs * 6);
    const pruned = history.filter(h => h.lastUpdated.getTime() > cutoff);
    
    // Limit size
    if (pruned.length > 100) {
      pruned.splice(0, pruned.length - 100);
    }
    
    this.sentimentHistory.set(symbol, pruned);
  }

  // Create empty fusion result
  private createEmptyFusion(symbol: string, signals: SentimentSignal[]): FusedSentiment {
    return {
      symbol,
      overallPolarity: 'neutral',
      fusedScore: 0,
      confidence: 0,
      sourceCount: 0,
      signalCount: signals.length,
      divergence: 0,
      momentum: 0,
      trend: 'stable',
      sourceBreakdown: [],
      lastUpdated: new Date(),
      signals,
    };
  }

  // Convert numeric score to polarity label
  private scoreToPolarity(score: number): SentimentPolarity {
    if (score >= 0.5) return 'very_bullish';
    if (score >= 0.15) return 'bullish';
    if (score <= -0.5) return 'very_bearish';
    if (score <= -0.15) return 'bearish';
    return 'neutral';
  }

  // Get enabled sources with their configs
  private getEnabledSources(): Map<SentimentSource, SourceConfig> {
    const enabled = new Map<SentimentSource, SourceConfig>();
    for (const config of this.config.sources) {
      if (config.enabled) {
        enabled.set(config.source, config);
      }
    }
    return enabled;
  }

  // Get all fused sentiments for monitored symbols
  getAllFusedSentiments(): FusedSentiment[] {
    const results: FusedSentiment[] = [];
    
    for (const symbol of this.signalBuffer.keys()) {
      const fused = this.getFusedSentiment(symbol);
      if (fused) {
        results.push(fused);
      }
    }
    
    return results.sort((a, b) => Math.abs(b.fusedScore) - Math.abs(a.fusedScore));
  }

  // Get symbols with high divergence (conflicting signals)
  getConflictedSymbols(): FusedSentiment[] {
    return this.getAllFusedSentiments()
      .filter(s => s.divergence > this.config.divergenceThreshold);
  }

  // Get symbols with strong momentum (trending sentiment)
  getTrendingSymbols(direction?: 'improving' | 'deteriorating'): FusedSentiment[] {
    return this.getAllFusedSentiments()
      .filter(s => {
        if (!direction) return Math.abs(s.momentum) > 0.1;
        return s.trend === direction && Math.abs(s.momentum) > 0.1;
      })
      .sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum));
  }

  // Update source health based on prediction accuracy
  updateSourceHealth(source: SentimentSource, accuracyScore: number): void {
    const current = this.metrics.sourceHealthScores.get(source) || 1.0;
    // Exponential moving average
    const alpha = 0.1;
    const newScore = current * (1 - alpha) + accuracyScore * alpha;
    this.metrics.sourceHealthScores.set(source, Math.max(0.1, Math.min(1.5, newScore)));
  }

  // Clear all data for a symbol
  clearSymbol(symbol: string): void {
    const key = symbol.toUpperCase();
    this.signalBuffer.delete(key);
    this.fusionCache.delete(key);
    this.sentimentHistory.delete(key);
  }

  // Clear all data
  clearAll(): void {
    this.signalBuffer.clear();
    this.fusionCache.clear();
    this.sentimentHistory.clear();
  }

  // Get metrics
  getMetrics(): typeof this.metrics & { bufferSize: number; cacheSize: number } {
    return {
      ...this.metrics,
      bufferSize: Array.from(this.signalBuffer.values()).reduce((sum, arr) => sum + arr.length, 0),
      cacheSize: this.fusionCache.size,
      sourceHealthScores: new Map(this.metrics.sourceHealthScores),
    };
  }

  // Get trading signal from fused sentiment
  getTradingSignal(symbol: string): {
    action: 'buy' | 'sell' | 'hold';
    strength: number;
    confidence: number;
    reasoning: string[];
  } | null {
    const fused = this.getFusedSentiment(symbol);
    
    // Guard: No data available
    if (!fused) return null;
    
    // Guard: Insufficient confidence
    if (fused.confidence < 0.3) {
      return {
        action: 'hold',
        strength: 0,
        confidence: fused.confidence,
        reasoning: ['Insufficient confidence in sentiment data'],
      };
    }
    
    // Guard: Insufficient source coverage
    if (fused.sourceCount < this.config.minSourcesForConfidence) {
      return {
        action: 'hold',
        strength: 0,
        confidence: fused.confidence,
        reasoning: [`Only ${fused.sourceCount} source(s) available, need ${this.config.minSourcesForConfidence} for reliable signal`],
      };
    }
    
    // Guard: High divergence forces hold
    if (fused.divergence > this.config.divergenceThreshold) {
      return {
        action: 'hold',
        strength: 0,
        confidence: fused.confidence * (1 - fused.divergence),
        reasoning: [
          `High divergence (${(fused.divergence * 100).toFixed(0)}%) between sources`,
          'Conflicting signals - recommend holding until clarity',
        ],
      };
    }
    
    const reasoning: string[] = [];
    let action: 'buy' | 'sell' | 'hold';
    let strength = Math.abs(fused.fusedScore);
    
    // Determine action
    if (fused.fusedScore >= 0.2 && fused.trend !== 'deteriorating') {
      action = 'buy';
      reasoning.push(`Bullish sentiment (${fused.overallPolarity}) from ${fused.sourceCount} sources`);
    } else if (fused.fusedScore <= -0.2 && fused.trend !== 'improving') {
      action = 'sell';
      reasoning.push(`Bearish sentiment (${fused.overallPolarity}) from ${fused.sourceCount} sources`);
    } else {
      action = 'hold';
      reasoning.push('Neutral or mixed sentiment signals');
    }
    
    // Adjust strength based on factors
    if (fused.trend === 'improving' && action === 'buy') {
      strength *= 1.2;
      reasoning.push('Sentiment momentum is positive');
    } else if (fused.trend === 'deteriorating' && action === 'sell') {
      strength *= 1.2;
      reasoning.push('Sentiment momentum is negative');
    }
    
    if (fused.divergence > 0.3) {
      strength *= 0.7;
      reasoning.push('Warning: Sources show significant disagreement');
    }
    
    // Add source details
    const topSources = fused.sourceBreakdown
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
      .slice(0, 3);
    
    for (const source of topSources) {
      const direction = source.score > 0 ? 'bullish' : source.score < 0 ? 'bearish' : 'neutral';
      reasoning.push(`${source.source}: ${direction} (${source.signalCount} signals)`);
    }
    
    return {
      action,
      strength: Math.min(1, strength),
      confidence: fused.confidence,
      reasoning,
    };
  }
}

// Factory function
let defaultEngine: SentimentFusionEngine | null = null;

export function getSentimentFusionEngine(config?: Partial<FusionConfig>): SentimentFusionEngine {
  if (!defaultEngine) {
    defaultEngine = new SentimentFusionEngine(config);
  }
  return defaultEngine;
}

export function createSentimentFusionEngine(config?: Partial<FusionConfig>): SentimentFusionEngine {
  return new SentimentFusionEngine(config);
}

// GDELT API client for fetching events
export class GDELTClient {
  private baseUrl = 'https://api.gdeltproject.org/api/v2';
  private rateLimit = { calls: 0, windowStart: Date.now() };
  private maxCallsPerMinute = 10;

  async fetchEvents(
    query: string,
    options: {
      mode?: 'artlist' | 'timelinevol' | 'timelinelang' | 'timelinesourcecountry';
      maxRecords?: number;
      timespan?: string;
      format?: 'json' | 'csv';
    } = {}
  ): Promise<GDELTEvent[]> {
    await this.checkRateLimit();
    
    const params = new URLSearchParams({
      query,
      mode: options.mode || 'artlist',
      maxrecords: String(options.maxRecords || 50),
      timespan: options.timespan || '1d',
      format: options.format || 'json',
    });
    
    try {
      const response = await fetch(`${this.baseUrl}/doc/doc?${params}`);
      
      if (!response.ok) {
        throw new Error(`GDELT API error: ${response.status}`);
      }
      
      const data = await response.json();
      return this.parseGDELTResponse(data);
    } catch (err) {
      logger.error('GDELT fetch failed', err as Error);
      return [];
    }
  }

  private parseGDELTResponse(data: unknown): GDELTEvent[] {
    if (!data || typeof data !== 'object') return [];
    
    const events: GDELTEvent[] = [];
    const articles = (data as Record<string, unknown>).articles as unknown[];
    
    if (!Array.isArray(articles)) return [];
    
    for (const article of articles) {
      const a = article as Record<string, unknown>;
      events.push({
        eventId: String(a.url || Math.random()),
        actor1: String(a.sourcecountry || 'unknown'),
        eventCode: 'article',
        goldsteinScale: 0, // GDELT doc API doesn't include this
        numMentions: 1,
        numSources: 1,
        numArticles: 1,
        avgTone: Number(a.tone) || 0,
        dateAdded: new Date(String(a.seendate) || Date.now()),
        sourceUrl: String(a.url),
        location: {
          country: String(a.sourcecountry || 'unknown'),
        },
      });
    }
    
    return events;
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    if (now - this.rateLimit.windowStart > 60000) {
      this.rateLimit = { calls: 0, windowStart: now };
    }
    
    this.rateLimit.calls++;
    
    if (this.rateLimit.calls > this.maxCallsPerMinute) {
      const waitTime = 60000 - (now - this.rateLimit.windowStart);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.rateLimit = { calls: 1, windowStart: Date.now() };
    }
  }
}

// NewsAPI client for fetching articles
export class NewsAPIClient {
  private apiKey: string | null = null;
  private baseUrl = 'https://newsapi.org/v2';
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    const secretManager = getSecretManager();
    this.apiKey = await secretManager.get('NEWS_API_KEY') ?? null;
    
    if (!this.apiKey) {
      logger.warn('NEWS_API_KEY not configured');
    }
    
    this.isInitialized = true;
  }

  async fetchArticles(
    query: string,
    options: {
      language?: string;
      sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
      pageSize?: number;
      from?: Date;
      to?: Date;
    } = {}
  ): Promise<NewsAPIArticle[]> {
    if (!this.isInitialized) await this.initialize();
    if (!this.apiKey) return [];
    
    const params = new URLSearchParams({
      q: query,
      apiKey: this.apiKey,
      language: options.language || 'en',
      sortBy: options.sortBy || 'publishedAt',
      pageSize: String(options.pageSize || 20),
    });
    
    if (options.from) params.set('from', options.from.toISOString().split('T')[0]);
    if (options.to) params.set('to', options.to.toISOString().split('T')[0]);
    
    try {
      const response = await fetch(`${this.baseUrl}/everything?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`NewsAPI error: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      return (data.articles || []) as NewsAPIArticle[];
    } catch (err) {
      logger.error('NewsAPI fetch failed', err as Error);
      return [];
    }
  }

  async searchBySymbol(
    symbol: string,
    companyName?: string
  ): Promise<NewsAPIArticle[]> {
    const query = companyName 
      ? `("${symbol}" OR "${companyName}") AND (stock OR trading OR market)`
      : `${symbol} stock`;
    
    return this.fetchArticles(query, {
      sortBy: 'publishedAt',
      pageSize: 20,
    });
  }
}

export { GDELTClient as GDELTAPIClient, NewsAPIClient as NewsAPIAPIClient };
