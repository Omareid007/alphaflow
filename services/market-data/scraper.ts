/**
 * AI Active Trader - Data Scraper & Caching Layer
 * Fetches, caches, and AI-summarizes market data to minimize future API calls.
 * Stores only AI analysis, not raw data, for minimal storage.
 */

import { createLogger } from '../shared/common';
import { CircuitBreaker, CircuitBreakerRegistry } from '../shared/common/circuit-breaker';
import { RAGCache, createRAGCache } from '../intelligence-fabric/rag-cache';

const logger = createLogger('market-data:scraper');

export interface ScrapedData {
  id: string;
  source: string;
  type: 'news' | 'sec_filing' | 'earnings' | 'economic' | 'social' | 'analyst';
  symbol?: string;
  title: string;
  content: string;
  url?: string;
  publishedAt: Date;
  scrapedAt: Date;
  metadata: Record<string, unknown>;
}

export interface AIAnalysis {
  id: string;
  sourceId: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;
  confidence: number;
  summary: string;
  keyPoints: string[];
  tradingSignals: string[];
  impactedSymbols: string[];
  expiresAt: Date;
  createdAt: Date;
}

export interface DataSourceConfig {
  name: string;
  type: 'api' | 'rss' | 'html';
  url: string;
  apiKey?: string;
  rateLimit: number;
  cacheTTLMs: number;
  parser: (response: unknown) => ScrapedData[];
}

const DEFAULT_SOURCES: DataSourceConfig[] = [
  {
    name: 'NewsAPI',
    type: 'api',
    url: 'https://newsapi.org/v2/everything',
    apiKey: process.env.NEWS_API_KEY,
    rateLimit: 100,
    cacheTTLMs: 300000,
    parser: (response: unknown) => {
      const data = response as { articles: Array<{ title: string; description: string; url: string; publishedAt: string; source: { name: string } }> };
      return (data.articles || []).map((article, i) => ({
        id: `news_${Date.now()}_${i}`,
        source: article.source?.name || 'NewsAPI',
        type: 'news' as const,
        title: article.title,
        content: article.description || '',
        url: article.url,
        publishedAt: new Date(article.publishedAt),
        scrapedAt: new Date(),
        metadata: {},
      }));
    },
  },
  {
    name: 'Finnhub',
    type: 'api',
    url: 'https://finnhub.io/api/v1/news',
    apiKey: process.env.FINNHUB_API_KEY,
    rateLimit: 30,
    cacheTTLMs: 60000,
    parser: (response: unknown) => {
      const data = response as Array<{ headline: string; summary: string; url: string; datetime: number; source: string; related: string }>;
      return (data || []).map((item, i) => ({
        id: `finnhub_${Date.now()}_${i}`,
        source: item.source || 'Finnhub',
        type: 'news' as const,
        symbol: item.related,
        title: item.headline,
        content: item.summary || '',
        url: item.url,
        publishedAt: new Date(item.datetime * 1000),
        scrapedAt: new Date(),
        metadata: {},
      }));
    },
  },
];

export class DataScraper {
  private cache: RAGCache<ScrapedData[]>;
  private analysisCache: RAGCache<AIAnalysis>;
  private sources: Map<string, DataSourceConfig> = new Map();
  private circuitRegistry: CircuitBreakerRegistry;
  private lastFetch: Map<string, number> = new Map();

  constructor() {
    this.cache = createRAGCache({ maxSize: 1000, ttlMs: 300000 });
    this.analysisCache = createRAGCache({ maxSize: 5000, ttlMs: 3600000 });
    this.circuitRegistry = CircuitBreakerRegistry.getInstance();

    for (const source of DEFAULT_SOURCES) {
      if (source.apiKey) {
        this.sources.set(source.name, source);
      }
    }
  }

  addSource(config: DataSourceConfig): void {
    this.sources.set(config.name, config);
    logger.info('Data source added', { name: config.name });
  }

  async fetchNews(query: string, symbols?: string[]): Promise<ScrapedData[]> {
    const cacheKey = `news:${query}:${symbols?.join(',') || 'all'}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const results: ScrapedData[] = [];

    for (const [name, source] of this.sources) {
      if (!this.canFetch(name, source.rateLimit)) continue;

      try {
        const data = await this.fetchFromSource(source, query, symbols);
        results.push(...data);
        this.lastFetch.set(name, Date.now());
      } catch (error) {
        logger.error(`Failed to fetch from ${name}`, error instanceof Error ? error : undefined);
      }
    }

    if (results.length > 0) {
      this.cache.set(cacheKey, results);
    }

    return results;
  }

  private canFetch(sourceName: string, rateLimitPerMinute: number): boolean {
    const lastFetch = this.lastFetch.get(sourceName) || 0;
    const minInterval = 60000 / rateLimitPerMinute;
    return Date.now() - lastFetch >= minInterval;
  }

  private async fetchFromSource(
    source: DataSourceConfig,
    query: string,
    symbols?: string[]
  ): Promise<ScrapedData[]> {
    const breaker = this.circuitRegistry.getOrCreate({
      name: `scraper:${source.name}`,
      failureThreshold: 3,
      timeout: 60000,
    });

    return breaker.execute(async () => {
      let url = source.url;

      if (source.name === 'NewsAPI') {
        const params = new URLSearchParams({
          q: symbols?.length ? symbols.join(' OR ') : query,
          apiKey: source.apiKey || '',
          language: 'en',
          sortBy: 'publishedAt',
          pageSize: '20',
        });
        url = `${source.url}?${params}`;
      } else if (source.name === 'Finnhub') {
        const params = new URLSearchParams({
          category: 'general',
          token: source.apiKey || '',
        });
        url = `${source.url}?${params}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return source.parser(data);
    });
  }

  async analyzeWithAI(data: ScrapedData): Promise<AIAnalysis> {
    const cacheKey = `analysis:${data.id}`;
    const cached = this.analysisCache.get(cacheKey);
    if (cached) return cached;

    const prompt = `Analyze this financial news for trading implications:

Title: ${data.title}
Content: ${data.content}
${data.symbol ? `Related Symbol: ${data.symbol}` : ''}

Provide analysis in JSON format:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "sentimentScore": -1 to 1,
  "confidence": 0 to 1,
  "summary": "one sentence summary",
  "keyPoints": ["point1", "point2"],
  "tradingSignals": ["signal1", "signal2"],
  "impactedSymbols": ["AAPL", "MSFT"]
}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a financial analyst. Respond only with valid JSON.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const result = await response.json();
      const content = JSON.parse(result.choices[0].message.content);

      const analysis: AIAnalysis = {
        id: `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sourceId: data.id,
        sentiment: content.sentiment || 'neutral',
        sentimentScore: content.sentimentScore || 0,
        confidence: content.confidence || 0.5,
        summary: content.summary || data.title,
        keyPoints: content.keyPoints || [],
        tradingSignals: content.tradingSignals || [],
        impactedSymbols: content.impactedSymbols || (data.symbol ? [data.symbol] : []),
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      };

      this.analysisCache.set(cacheKey, analysis);
      return analysis;

    } catch (error) {
      logger.error('AI analysis failed', error instanceof Error ? error : undefined);

      return {
        id: `analysis_${Date.now()}_fallback`,
        sourceId: data.id,
        sentiment: 'neutral',
        sentimentScore: 0,
        confidence: 0,
        summary: data.title,
        keyPoints: [],
        tradingSignals: [],
        impactedSymbols: data.symbol ? [data.symbol] : [],
        expiresAt: new Date(Date.now() + 600000),
        createdAt: new Date(),
      };
    }
  }

  async fetchAndAnalyze(query: string, symbols?: string[]): Promise<AIAnalysis[]> {
    const news = await this.fetchNews(query, symbols);
    const analyses: AIAnalysis[] = [];

    for (const item of news.slice(0, 10)) {
      const analysis = await this.analyzeWithAI(item);
      analyses.push(analysis);
    }

    return analyses.sort((a, b) => Math.abs(b.sentimentScore) - Math.abs(a.sentimentScore));
  }

  getAnalysisSummary(analyses: AIAnalysis[]): {
    overallSentiment: 'bullish' | 'bearish' | 'neutral';
    avgSentimentScore: number;
    avgConfidence: number;
    topSignals: string[];
    symbolsToWatch: string[];
  } {
    if (analyses.length === 0) {
      return {
        overallSentiment: 'neutral',
        avgSentimentScore: 0,
        avgConfidence: 0,
        topSignals: [],
        symbolsToWatch: [],
      };
    }

    const avgScore = analyses.reduce((sum, a) => sum + a.sentimentScore, 0) / analyses.length;
    const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;

    const allSignals = analyses.flatMap(a => a.tradingSignals);
    const signalCounts = new Map<string, number>();
    for (const signal of allSignals) {
      signalCounts.set(signal, (signalCounts.get(signal) || 0) + 1);
    }
    const topSignals = Array.from(signalCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([signal]) => signal);

    const allSymbols = analyses.flatMap(a => a.impactedSymbols);
    const symbolCounts = new Map<string, number>();
    for (const symbol of allSymbols) {
      symbolCounts.set(symbol, (symbolCounts.get(symbol) || 0) + 1);
    }
    const symbolsToWatch = Array.from(symbolCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symbol]) => symbol);

    return {
      overallSentiment: avgScore > 0.2 ? 'bullish' : avgScore < -0.2 ? 'bearish' : 'neutral',
      avgSentimentScore: avgScore,
      avgConfidence,
      topSignals,
      symbolsToWatch,
    };
  }

  getCacheStats(): {
    dataCacheSize: number;
    analysisCacheSize: number;
    dataCacheHitRate: number;
    analysisCacheHitRate: number;
  } {
    return {
      dataCacheSize: this.cache.size(),
      analysisCacheSize: this.analysisCache.size(),
      dataCacheHitRate: this.cache.getHitRate(),
      analysisCacheHitRate: this.analysisCache.getHitRate(),
    };
  }

  clearCaches(): void {
    this.cache.clear();
    this.analysisCache.clear();
    logger.info('Caches cleared');
  }
}

export function createDataScraper(): DataScraper {
  return new DataScraper();
}
