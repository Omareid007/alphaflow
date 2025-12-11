/**
 * Hugging Face Connector - Financial sentiment analysis and signal enrichment
 * 
 * Uses specialized financial models:
 * - FinBERT (ProsusAI/finbert) - Financial text sentiment
 * - FinancialBERT - Pre-trained on financial corpora
 * - DeBERTa v3 - Fast financial news sentiment
 * 
 * These outputs serve as enrichment inputs to the LLM decision engine,
 * not as standalone trading signals.
 * 
 * @see docs/CONNECTORS_AND_INTEGRATIONS.md
 */

import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";

const HF_INFERENCE_URL = "https://api-inference.huggingface.co/models";

export type SentimentLabel = "positive" | "negative" | "neutral";

export interface SentimentResult {
  label: SentimentLabel;
  score: number;
}

export interface EnrichmentSignal {
  symbol?: string;
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  confidence: number;
  trendStrength?: number;
  volatilityIndicator?: number;
  model: string;
  timestamp: Date;
}

export interface NewsWithSentiment {
  headline: string;
  sentiment: SentimentResult;
  source?: string;
}

type RawSentimentResponse = Array<Array<{ label: string; score: number }>>;

class HuggingFaceConnector {
  private rawSentimentCache = new ApiCache<RawSentimentResponse>({
    freshDuration: 30 * 60 * 1000,
    staleDuration: 2 * 60 * 60 * 1000,
  });
  private enrichmentCache = new ApiCache<EnrichmentSignal>({
    freshDuration: 15 * 60 * 1000,
    staleDuration: 60 * 60 * 1000,
  });

  private lastRequestTime = 0;
  private minRequestInterval = 200;
  private rateLimitedUntil = 0;

  private getApiKey(): string | undefined {
    return process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY;
  }

  isAvailable(): boolean {
    return !!this.getApiKey();
  }

  private async throttle(): Promise<void> {
    const now = Date.now();

    if (now < this.rateLimitedUntil) {
      const waitTime = this.rateLimitedUntil - now;
      log.warn("HuggingFace", `Rate limited, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  private async callModel<T>(
    modelId: string,
    inputs: string | string[],
    cacheKey: string,
    cache: ApiCache<T>,
    retries = 3
  ): Promise<T> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      const stale = cache.getStale(cacheKey);
      if (stale) {
        log.debug("HuggingFace", `No API key, serving stale data for ${cacheKey}`);
        return stale;
      }
      throw new Error("HUGGINGFACE_API_KEY is not configured");
    }

    const cached = cache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    await this.throttle();

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(`${HF_INFERENCE_URL}/${modelId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ inputs }),
        });

        if (response.status === 429) {
          this.rateLimitedUntil = Date.now() + Math.pow(2, i + 1) * 1000;

          const stale = cache.getStale(cacheKey);
          if (stale) {
            log.debug("HuggingFace", `Rate limited, serving stale data for ${cacheKey}`);
            return stale;
          }

          const waitTime = Math.pow(2, i) * 1000;
          log.warn("HuggingFace", `Rate limited, waiting ${waitTime}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (response.status === 503) {
          const waitTime = 5000 * (i + 1);
          log.warn("HuggingFace", `Model loading, waiting ${waitTime}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HuggingFace API error: ${response.status}`);
        }

        const data = (await response.json()) as T;
        cache.set(cacheKey, data);
        return data;
      } catch (error) {
        const stale = cache.getStale(cacheKey);
        if (stale && i === retries - 1) {
          log.debug("HuggingFace", `Error fetching, serving stale data for ${cacheKey}`);
          return stale;
        }
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    throw new Error("Failed to call HuggingFace after retries");
  }

  async analyzeSentiment(
    text: string,
    model: "finbert" | "financialbert" | "deberta" = "finbert"
  ): Promise<SentimentResult[]> {
    const modelIds: Record<string, string> = {
      finbert: "ProsusAI/finbert",
      financialbert: "ahmedrachid/FinancialBERT-Sentiment-Analysis",
      deberta: "mrm8488/deberta-v3-ft-financial-news-sentiment-analysis",
    };

    const modelId = modelIds[model];
    const cacheKey = `sentiment_${model}_${text.substring(0, 50)}`;

    const result = await this.callModel<RawSentimentResponse>(
      modelId,
      text,
      cacheKey,
      this.rawSentimentCache
    );

    if (!result || !result[0]) {
      return [{ label: "neutral", score: 0.5 }];
    }

    return result[0].map((r) => ({
      label: this.normalizeSentimentLabel(r.label),
      score: r.score,
    }));
  }

  private normalizeSentimentLabel(label: string): SentimentLabel {
    const lower = label.toLowerCase();
    if (lower.includes("positive") || lower === "pos" || lower === "bullish") {
      return "positive";
    }
    if (lower.includes("negative") || lower === "neg" || lower === "bearish") {
      return "negative";
    }
    return "neutral";
  }

  async analyzeNewsHeadlines(
    headlines: string[]
  ): Promise<NewsWithSentiment[]> {
    const results: NewsWithSentiment[] = [];

    for (const headline of headlines.slice(0, 10)) {
      try {
        const sentiment = await this.analyzeSentiment(headline);
        const topSentiment = sentiment.reduce((a, b) =>
          a.score > b.score ? a : b
        );
        results.push({
          headline,
          sentiment: topSentiment,
        });
      } catch (error) {
        log.warn("HuggingFace", `Failed to analyze headline: ${headline.substring(0, 30)}...`);
        results.push({
          headline,
          sentiment: { label: "neutral", score: 0.5 },
        });
      }
    }

    return results;
  }

  async generateEnrichmentSignal(
    symbol: string,
    newsHeadlines: string[],
    priceChange?: number
  ): Promise<EnrichmentSignal> {
    const cacheKey = `enrichment_${symbol}_${Date.now() % (15 * 60 * 1000)}`;
    const cached = this.enrichmentCache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const sentimentResults = await this.analyzeNewsHeadlines(newsHeadlines);

    let positiveCount = 0;
    let negativeCount = 0;
    let totalScore = 0;
    let totalConfidence = 0;

    for (const result of sentimentResults) {
      if (result.sentiment.label === "positive") {
        positiveCount++;
        totalScore += result.sentiment.score;
      } else if (result.sentiment.label === "negative") {
        negativeCount++;
        totalScore -= result.sentiment.score;
      }
      totalConfidence += result.sentiment.score;
    }

    const netSentiment = sentimentResults.length > 0 
      ? totalScore / sentimentResults.length 
      : 0;

    const avgConfidence = sentimentResults.length > 0
      ? totalConfidence / sentimentResults.length
      : 0.5;

    let overallLabel: SentimentLabel = "neutral";
    if (netSentiment > 0.2) overallLabel = "positive";
    else if (netSentiment < -0.2) overallLabel = "negative";

    let trendStrength: number | undefined;
    if (priceChange !== undefined) {
      const priceDirection = priceChange > 0 ? 1 : priceChange < 0 ? -1 : 0;
      const sentimentDirection = netSentiment > 0 ? 1 : netSentiment < 0 ? -1 : 0;
      
      if (priceDirection === sentimentDirection) {
        trendStrength = Math.abs(netSentiment) * avgConfidence;
      } else {
        trendStrength = -Math.abs(netSentiment) * avgConfidence;
      }
    }

    const signal: EnrichmentSignal = {
      symbol,
      sentimentScore: netSentiment,
      sentimentLabel: overallLabel,
      confidence: avgConfidence,
      trendStrength,
      model: "finbert",
      timestamp: new Date(),
    };

    this.enrichmentCache.set(cacheKey, signal);

    log.info("HuggingFace", "Generated enrichment signal", {
      symbol,
      sentimentLabel: overallLabel,
      sentimentScore: netSentiment.toFixed(3),
      confidence: avgConfidence.toFixed(3),
      headlinesAnalyzed: sentimentResults.length,
    });

    return signal;
  }

  async batchAnalyzeSymbols(
    symbolsWithNews: Map<string, string[]>
  ): Promise<Map<string, EnrichmentSignal>> {
    const results = new Map<string, EnrichmentSignal>();

    for (const [symbol, headlines] of symbolsWithNews) {
      try {
        const signal = await this.generateEnrichmentSignal(symbol, headlines);
        results.set(symbol, signal);
      } catch (error) {
        log.warn("HuggingFace", `Failed to analyze ${symbol}: ${String(error)}`);
      }
    }

    return results;
  }

  getConnectionStatus(): { connected: boolean; hasApiKey: boolean; cacheSize: number } {
    return {
      connected: this.isAvailable(),
      hasApiKey: this.isAvailable(),
      cacheSize: this.rawSentimentCache.size() + this.enrichmentCache.size(),
    };
  }

  clearCache(): void {
    this.rawSentimentCache.clear();
    this.enrichmentCache.clear();
  }
}

export const huggingface = new HuggingFaceConnector();
