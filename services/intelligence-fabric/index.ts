/**
 * AI Active Trader - Intelligence Fabric
 * Central AI/data hub for RAG cache, vector store, prompt registry, and model routing.
 * Minimizes storage by storing only AI summaries and analysis, not raw data.
 */

import { createLogger } from '../shared/common';
import { RAGCache, createRAGCache } from './rag-cache';
import { VectorStore, createVectorStore } from './vector-store';
import { PromptRegistry, createPromptRegistry } from './prompt-registry';

const logger = createLogger('intelligence-fabric');

export interface IntelligenceFabricConfig {
  ragCacheMaxSize: number;
  ragCacheTTLMs: number;
  vectorStoreDimensions: number;
  enableSemanticSearch: boolean;
  summarizationModel: string;
}

const DEFAULT_CONFIG: IntelligenceFabricConfig = {
  ragCacheMaxSize: 10000,
  ragCacheTTLMs: 3600000,
  vectorStoreDimensions: 1536,
  enableSemanticSearch: true,
  summarizationModel: 'gpt-4o-mini',
};

export interface AnalysisResult {
  id: string;
  type: 'market' | 'news' | 'technical' | 'fundamental' | 'sentiment';
  symbol?: string;
  summary: string;
  keyInsights: string[];
  confidence: number;
  actionableSignals: string[];
  timestamp: Date;
  expiresAt: Date;
  metadata: Record<string, unknown>;
}

export interface DataIngestionRequest {
  source: string;
  type: 'document' | 'table' | 'timeseries' | 'news' | 'report';
  rawData: unknown;
  symbol?: string;
  analysisPrompt?: string;
}

export class IntelligenceFabric {
  private config: IntelligenceFabricConfig;
  private ragCache: RAGCache;
  private vectorStore: VectorStore;
  private promptRegistry: PromptRegistry;
  private analysisStore: Map<string, AnalysisResult> = new Map();

  constructor(config: Partial<IntelligenceFabricConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ragCache = createRAGCache({
      maxSize: this.config.ragCacheMaxSize,
      ttlMs: this.config.ragCacheTTLMs,
    });
    this.vectorStore = createVectorStore({
      dimensions: this.config.vectorStoreDimensions,
    });
    this.promptRegistry = createPromptRegistry();
    logger.info('Intelligence Fabric initialized', { config: this.config });
  }

  async ingestAndAnalyze(request: DataIngestionRequest): Promise<AnalysisResult> {
    const startTime = Date.now();

    const cacheKey = this.generateCacheKey(request);
    const cached = this.ragCache.get(cacheKey);
    if (cached) {
      logger.debug('Cache hit for analysis', { cacheKey });
      return cached as AnalysisResult;
    }

    const prompt = request.analysisPrompt || this.promptRegistry.getPrompt(request.type);
    const summary = await this.summarizeWithAI(request.rawData, prompt);

    const result: AnalysisResult = {
      id: `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: this.mapToAnalysisType(request.type),
      symbol: request.symbol,
      summary: summary.text,
      keyInsights: summary.insights,
      confidence: summary.confidence,
      actionableSignals: summary.signals,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + this.config.ragCacheTTLMs),
      metadata: {
        source: request.source,
        processingTimeMs: Date.now() - startTime,
        inputType: request.type,
      },
    };

    this.ragCache.set(cacheKey, result);
    this.analysisStore.set(result.id, result);

    if (this.config.enableSemanticSearch) {
      await this.vectorStore.upsert(result.id, summary.text, {
        type: result.type,
        symbol: request.symbol,
      });
    }

    logger.info('Analysis completed', {
      id: result.id,
      type: result.type,
      processingTimeMs: Date.now() - startTime,
    });

    return result;
  }

  async semanticSearch(query: string, limit = 10): Promise<AnalysisResult[]> {
    if (!this.config.enableSemanticSearch) {
      logger.warn('Semantic search is disabled');
      return [];
    }

    const results = await this.vectorStore.search(query, limit);
    return results
      .map((result: { id: string; text: string; score: number; metadata: Record<string, unknown> }) => this.analysisStore.get(result.id))
      .filter((result): result is AnalysisResult => result !== undefined);
  }

  getAnalysis(id: string): AnalysisResult | undefined {
    return this.analysisStore.get(id);
  }

  getRecentAnalyses(type?: AnalysisResult['type'], limit = 20): AnalysisResult[] {
    let analyses = Array.from(this.analysisStore.values());

    if (type) {
      analyses = analyses.filter(a => a.type === type);
    }

    return analyses
      .filter(a => a.expiresAt > new Date())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getSymbolAnalyses(symbol: string): AnalysisResult[] {
    return Array.from(this.analysisStore.values())
      .filter(a => a.symbol === symbol && a.expiresAt > new Date())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private generateCacheKey(request: DataIngestionRequest): string {
    const dataHash = this.hashData(request.rawData);
    return `${request.source}:${request.type}:${request.symbol || 'global'}:${dataHash}`;
  }

  private hashData(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private mapToAnalysisType(inputType: string): AnalysisResult['type'] {
    const mapping: Record<string, AnalysisResult['type']> = {
      document: 'fundamental',
      table: 'technical',
      timeseries: 'technical',
      news: 'news',
      report: 'fundamental',
    };
    return mapping[inputType] || 'market';
  }

  private async summarizeWithAI(
    data: unknown,
    prompt: string
  ): Promise<{
    text: string;
    insights: string[];
    confidence: number;
    signals: string[];
  }> {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const truncatedData = dataStr.length > 8000 ? dataStr.slice(0, 8000) + '...' : dataStr;

    const fullPrompt = `${prompt}\n\nData to analyze:\n${truncatedData}\n\nProvide your analysis in JSON format with fields: summary (string), keyInsights (array of strings), confidence (0-1), actionableSignals (array of strings)`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.summarizationModel,
          messages: [
            { role: 'system', content: 'You are a financial analyst AI. Provide concise, actionable analysis.' },
            { role: 'user', content: fullPrompt },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      const content = JSON.parse(result.choices[0].message.content);

      return {
        text: content.summary || 'Analysis completed',
        insights: content.keyInsights || [],
        confidence: content.confidence || 0.5,
        signals: content.actionableSignals || [],
      };
    } catch (error) {
      logger.error('AI summarization failed', error instanceof Error ? error : undefined);
      return {
        text: 'Analysis unavailable',
        insights: [],
        confidence: 0,
        signals: [],
      };
    }
  }

  cleanupExpired(): number {
    let cleaned = 0;
    const now = new Date();

    for (const [id, analysis] of this.analysisStore) {
      if (analysis.expiresAt < now) {
        this.analysisStore.delete(id);
        this.vectorStore.delete(id);
        cleaned++;
      }
    }

    this.ragCache.cleanup();
    logger.info('Cleanup completed', { removed: cleaned });
    return cleaned;
  }

  getStats(): {
    analysisCount: number;
    cacheHitRate: number;
    vectorStoreSize: number;
  } {
    return {
      analysisCount: this.analysisStore.size,
      cacheHitRate: this.ragCache.getHitRate(),
      vectorStoreSize: this.vectorStore.size(),
    };
  }
}

export function createIntelligenceFabric(config?: Partial<IntelligenceFabricConfig>): IntelligenceFabric {
  return new IntelligenceFabric(config);
}

export { RAGCache, VectorStore, PromptRegistry };
