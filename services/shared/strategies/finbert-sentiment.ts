/**
 * AI Active Trader - FinBERT Sentiment Analysis
 * News-driven sentiment signals using Hugging Face's FinBERT model
 * 
 * Features:
 * - Real-time sentiment analysis via Hugging Face Inference API
 * - Batch processing with intelligent caching
 * - Sentiment decay over time
 * - Aggregated sentiment scores per symbol
 * - Integration with Alpha Generation module
 */

import { performance } from 'perf_hooks';
import { createLogger, getSecretManager } from '../common';

const logger = createLogger('finbert-sentiment');

export interface NewsArticle {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  symbol?: string;
  symbols?: string[];
  source: string;
  publishedAt: Date;
  url?: string;
}

export interface SentimentResult {
  articleId: string;
  symbol: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  text: string;
  analyzedAt: Date;
  expiresAt: Date;
}

export interface AggregatedSentiment {
  symbol: string;
  overallSentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  articleCount: number;
  weightedScore: number;
  momentum: number;
  lastUpdated: Date;
}

export interface FinBERTConfig {
  huggingFaceModel: string;
  maxTokens: number;
  batchSize: number;
  cacheEnabled: boolean;
  cacheTTLMs: number;
  sentimentDecayHours: number;
  minConfidence: number;
  retryAttempts: number;
  retryDelayMs: number;
  rateLimitPerMinute: number;
}

interface HuggingFaceResponse {
  label: string;
  score: number;
}

interface CacheEntry {
  result: SentimentResult;
  expiresAt: number;
}

export class FinBERTSentimentAnalyzer {
  private config: FinBERTConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private sentimentHistory: Map<string, SentimentResult[]> = new Map();
  private apiKey: string | null = null;
  private requestCount = 0;
  private lastRequestWindow = Date.now();
  private isInitialized = false;

  constructor(config: Partial<FinBERTConfig> = {}) {
    this.config = {
      huggingFaceModel: config.huggingFaceModel ?? 'ProsusAI/finbert',
      maxTokens: config.maxTokens ?? 512,
      batchSize: config.batchSize ?? 10,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTLMs: config.cacheTTLMs ?? 3600000,
      sentimentDecayHours: config.sentimentDecayHours ?? 24,
      minConfidence: config.minConfidence ?? 0.6,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      rateLimitPerMinute: config.rateLimitPerMinute ?? 30,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const secretManager = getSecretManager();
      this.apiKey = await secretManager.get('HUGGINGFACE_API_KEY') ?? null;
      
      if (!this.apiKey) {
        logger.warn('HUGGINGFACE_API_KEY not found, sentiment analysis will be disabled');
      } else {
        logger.info('FinBERT Sentiment Analyzer initialized', {
          model: this.config.huggingFaceModel,
          cacheEnabled: this.config.cacheEnabled,
        });
      }
      
      this.isInitialized = true;
    } catch (err) {
      logger.error('Failed to initialize FinBERT analyzer', err as Error);
      throw err;
    }
  }

  async analyzeSentiment(text: string, symbol: string, articleId: string): Promise<SentimentResult | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.apiKey) {
      return null;
    }

    const cacheKey = this.getCacheKey(text);
    const cached = this.getFromCache(cacheKey, symbol);
    if (cached) {
      return cached;
    }

    await this.checkRateLimit();

    const truncatedText = this.truncateText(text);
    
    try {
      const response = await this.callHuggingFaceAPI(truncatedText);
      
      if (!response || response.length === 0) {
        return null;
      }

      const topResult = this.parseResponse(response);
      const now = new Date();
      
      const result: SentimentResult = {
        articleId,
        symbol,
        sentiment: topResult.sentiment,
        score: topResult.score,
        confidence: topResult.confidence,
        text: truncatedText.substring(0, 200),
        analyzedAt: now,
        expiresAt: new Date(now.getTime() + this.config.sentimentDecayHours * 3600000),
      };

      if (this.config.cacheEnabled) {
        this.cache.set(cacheKey, {
          result,
          expiresAt: Date.now() + this.config.cacheTTLMs,
        });
      }

      this.addToHistory(symbol, result);

      logger.debug('Sentiment analyzed', {
        symbol,
        sentiment: result.sentiment,
        score: result.score.toFixed(3),
        confidence: result.confidence.toFixed(3),
      });

      return result;
    } catch (err) {
      logger.error('Sentiment analysis failed', err as Error, { symbol, articleId });
      return null;
    }
  }

  async analyzeArticle(article: NewsArticle): Promise<SentimentResult[]> {
    const symbols = article.symbols || (article.symbol ? [article.symbol] : []);
    
    if (symbols.length === 0) {
      return [];
    }

    const text = article.content || article.summary || article.title;
    const results: SentimentResult[] = [];

    for (const symbol of symbols) {
      const result = await this.analyzeSentiment(text, symbol, article.id);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  async analyzeArticleBatch(articles: NewsArticle[]): Promise<Map<string, SentimentResult[]>> {
    const results = new Map<string, SentimentResult[]>();
    
    const batches: NewsArticle[][] = [];
    for (let i = 0; i < articles.length; i += this.config.batchSize) {
      batches.push(articles.slice(i, i + this.config.batchSize));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(article => this.analyzeArticle(article));
      const batchResults = await Promise.all(batchPromises);
      
      for (let i = 0; i < batch.length; i++) {
        const article = batch[i];
        const articleResults = batchResults[i];
        
        for (const result of articleResults) {
          const existing = results.get(result.symbol) || [];
          existing.push(result);
          results.set(result.symbol, existing);
        }
      }
    }

    return results;
  }

  getAggregatedSentiment(symbol: string): AggregatedSentiment | null {
    const history = this.sentimentHistory.get(symbol);
    
    if (!history || history.length === 0) {
      return null;
    }

    const now = new Date();
    const validResults = history.filter(r => r.expiresAt > now);

    if (validResults.length === 0) {
      this.sentimentHistory.delete(symbol);
      return null;
    }

    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    let weightedScoreSum = 0;
    let totalWeight = 0;

    for (const result of validResults) {
      const ageHours = (now.getTime() - result.analyzedAt.getTime()) / 3600000;
      const decayFactor = Math.exp(-ageHours / this.config.sentimentDecayHours);
      const weight = result.confidence * decayFactor;

      let sentimentValue: number;
      if (result.sentiment === 'positive') {
        positiveCount++;
        sentimentValue = result.score;
      } else if (result.sentiment === 'negative') {
        negativeCount++;
        sentimentValue = -result.score;
      } else {
        neutralCount++;
        sentimentValue = 0;
      }

      weightedScoreSum += sentimentValue * weight;
      totalWeight += weight;
    }

    const weightedScore = totalWeight > 0 ? weightedScoreSum / totalWeight : 0;
    const normalizedScore = Math.tanh(weightedScore);

    let overallSentiment: 'positive' | 'negative' | 'neutral';
    if (normalizedScore > 0.1) {
      overallSentiment = 'positive';
    } else if (normalizedScore < -0.1) {
      overallSentiment = 'negative';
    } else {
      overallSentiment = 'neutral';
    }

    const recentResults = validResults.slice(-10);
    const momentum = this.calculateMomentum(recentResults);

    const avgConfidence = validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length;

    return {
      symbol,
      overallSentiment,
      score: normalizedScore,
      confidence: avgConfidence,
      positiveCount,
      negativeCount,
      neutralCount,
      articleCount: validResults.length,
      weightedScore,
      momentum,
      lastUpdated: validResults[validResults.length - 1].analyzedAt,
    };
  }

  getAllAggregatedSentiments(): AggregatedSentiment[] {
    const symbols = Array.from(this.sentimentHistory.keys());
    const results: AggregatedSentiment[] = [];

    for (const symbol of symbols) {
      const sentiment = this.getAggregatedSentiment(symbol);
      if (sentiment) {
        results.push(sentiment);
      }
    }

    return results;
  }

  getSentimentSignal(symbol: string): { direction: 'up' | 'down' | 'flat'; strength: number; confidence: number } | null {
    const sentiment = this.getAggregatedSentiment(symbol);
    
    if (!sentiment || sentiment.confidence < this.config.minConfidence) {
      return null;
    }

    let direction: 'up' | 'down' | 'flat';
    if (sentiment.score > 0.15) {
      direction = 'up';
    } else if (sentiment.score < -0.15) {
      direction = 'down';
    } else {
      direction = 'flat';
    }

    const momentumBoost = sentiment.momentum > 0 ? 1.1 : sentiment.momentum < 0 ? 0.9 : 1.0;
    const strength = Math.abs(sentiment.score) * momentumBoost;

    return {
      direction,
      strength: Math.min(strength, 1),
      confidence: sentiment.confidence,
    };
  }

  private async callHuggingFaceAPI(text: string): Promise<HuggingFaceResponse[][] | null> {
    const url = `https://api-inference.huggingface.co/models/${this.config.huggingFaceModel}`;
    
    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: text }),
        });

        if (response.status === 503) {
          const data = await response.json();
          if (data.error && data.error.includes('loading')) {
            logger.info('Model is loading, waiting...', { attempt: attempt + 1 });
            await this.delay(data.estimated_time ? data.estimated_time * 1000 : 20000);
            continue;
          }
        }

        if (response.status === 429) {
          logger.warn('Rate limited, backing off', { attempt: attempt + 1 });
          await this.delay(this.config.retryDelayMs * (attempt + 1));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as HuggingFaceResponse[][];
      } catch (err) {
        if (attempt === this.config.retryAttempts - 1) {
          throw err;
        }
        await this.delay(this.config.retryDelayMs * (attempt + 1));
      }
    }

    return null;
  }

  private parseResponse(response: HuggingFaceResponse[][]): { sentiment: 'positive' | 'negative' | 'neutral'; score: number; confidence: number } {
    const classifications = response[0] || [];
    
    if (classifications.length === 0) {
      return { sentiment: 'neutral', score: 0, confidence: 0 };
    }

    classifications.sort((a, b) => b.score - a.score);
    const top = classifications[0];

    let sentiment: 'positive' | 'negative' | 'neutral';
    const label = top.label.toLowerCase();
    
    if (label === 'positive' || label === 'bullish') {
      sentiment = 'positive';
    } else if (label === 'negative' || label === 'bearish') {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }

    return {
      sentiment,
      score: top.score,
      confidence: top.score,
    };
  }

  private truncateText(text: string): string {
    const words = text.split(/\s+/);
    const maxWords = Math.floor(this.config.maxTokens * 0.75);
    
    if (words.length <= maxWords) {
      return text;
    }

    return words.slice(0, maxWords).join(' ') + '...';
  }

  private getCacheKey(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sentiment_${hash}`;
  }

  private getFromCache(cacheKey: string, symbol: string): SentimentResult | null {
    if (!this.config.cacheEnabled) return null;

    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(cacheKey);
      return null;
    }

    return {
      ...entry.result,
      symbol,
    };
  }

  private addToHistory(symbol: string, result: SentimentResult): void {
    const history = this.sentimentHistory.get(symbol) || [];
    history.push(result);

    const now = new Date();
    const validHistory = history.filter(r => r.expiresAt > now);

    if (validHistory.length > 100) {
      validHistory.splice(0, validHistory.length - 100);
    }

    this.sentimentHistory.set(symbol, validHistory);
  }

  private calculateMomentum(results: SentimentResult[]): number {
    if (results.length < 2) return 0;

    const halfPoint = Math.floor(results.length / 2);
    const recentHalf = results.slice(halfPoint);
    const olderHalf = results.slice(0, halfPoint);

    const recentAvg = recentHalf.reduce((sum, r) => {
      if (r.sentiment === 'positive') return sum + r.score;
      if (r.sentiment === 'negative') return sum - r.score;
      return sum;
    }, 0) / recentHalf.length;

    const olderAvg = olderHalf.reduce((sum, r) => {
      if (r.sentiment === 'positive') return sum + r.score;
      if (r.sentiment === 'negative') return sum - r.score;
      return sum;
    }, 0) / olderHalf.length;

    return recentAvg - olderAvg;
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const windowMs = 60000;

    if (now - this.lastRequestWindow > windowMs) {
      this.requestCount = 0;
      this.lastRequestWindow = now;
    }

    this.requestCount++;

    if (this.requestCount > this.config.rateLimitPerMinute) {
      const waitTime = windowMs - (now - this.lastRequestWindow);
      logger.debug('Rate limit reached, waiting', { waitMs: waitTime });
      await this.delay(waitTime);
      this.requestCount = 1;
      this.lastRequestWindow = Date.now();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearHistory(): void {
    this.sentimentHistory.clear();
  }

  getStats(): {
    cacheSize: number;
    historySymbols: number;
    totalHistoryEntries: number;
  } {
    let totalHistoryEntries = 0;
    for (const history of this.sentimentHistory.values()) {
      totalHistoryEntries += history.length;
    }

    return {
      cacheSize: this.cache.size,
      historySymbols: this.sentimentHistory.size,
      totalHistoryEntries,
    };
  }
}

export const createSentimentAlphaModel = (analyzer: FinBERTSentimentAnalyzer) => ({
  name: 'finbert_sentiment',
  type: 'sentiment' as const,
  weight: 1.2,
  generate: async (securities: Array<{ symbol: string; price: number }>, context: { currentTime: Date }) => {
    const insights: Array<{
      id: string;
      symbol: string;
      direction: 'up' | 'down' | 'flat';
      magnitude: number;
      confidence: number;
      period: number;
      source: string;
      generatedAt: Date;
    }> = [];

    for (const security of securities) {
      const signal = analyzer.getSentimentSignal(security.symbol);
      
      if (signal && signal.direction !== 'flat') {
        insights.push({
          id: `sentiment_${security.symbol}_${Date.now()}`,
          symbol: security.symbol,
          direction: signal.direction,
          magnitude: signal.strength,
          confidence: signal.confidence,
          period: 3,
          source: 'finbert_sentiment',
          generatedAt: context.currentTime,
        });
      }
    }

    return insights;
  },
});

let defaultAnalyzer: FinBERTSentimentAnalyzer | null = null;

export function getFinBERTAnalyzer(): FinBERTSentimentAnalyzer {
  if (!defaultAnalyzer) {
    defaultAnalyzer = new FinBERTSentimentAnalyzer();
  }
  return defaultAnalyzer;
}

export function createFinBERTAnalyzer(config?: Partial<FinBERTConfig>): FinBERTSentimentAnalyzer {
  return new FinBERTSentimentAnalyzer(config);
}
