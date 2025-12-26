/**
 * GDELT Connector - Real-time Global News Events
 * 
 * FREE API providing:
 * - Global news monitoring in 100+ languages
 * - Updates every 15 minutes
 * - Sentiment/tone analysis
 * - Article volume tracking (breaking news detection)
 * - Geographic event tracking
 * 
 * Use cases for trading:
 * - Breaking news detection via volume spikes
 * - Sentiment tracking for stocks/crypto
 * - Geopolitical risk monitoring
 * - Supply chain disruption alerts
 * 
 * @see https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 */

import { ApiCache } from "../lib/api-cache";
import { connectorFetch, buildCacheKey } from "../lib/connectorClient";
import { log } from "../utils/logger";

const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";

export interface GdeltArticle {
  url: string;
  title: string;
  domain: string;
  language: string;
  seenDate: string;
  socialImage?: string;
  tone?: number;
}

export interface GdeltTimelinePoint {
  date: string;
  value: number;
}

export interface GdeltToneTimeline {
  date: string;
  tone: number;
  positiveScore: number;
  negativeScore: number;
}

export interface GdeltSearchResponse {
  articles: GdeltArticle[];
  totalResults: number;
}

export interface GdeltVolumeResponse {
  timeline: GdeltTimelinePoint[];
  query: string;
}

export interface GdeltToneResponse {
  timeline: GdeltToneTimeline[];
  query: string;
  averageTone: number;
}

export interface GdeltSentimentAnalysis {
  symbol: string;
  query: string;
  articleCount: number;
  averageTone: number;
  sentiment: "bullish" | "bearish" | "neutral";
  volumeSpike: boolean;
  recentVolume: number;
  baselineVolume: number;
  topHeadlines: string[];
  timestamp: Date;
}

export interface GdeltBreakingNewsAlert {
  query: string;
  isBreaking: boolean;
  volumeIncrease: number;
  toneShift: number;
  relevantArticles: GdeltArticle[];
}

type GdeltTimespan = "15min" | "30min" | "1hour" | "3hours" | "6hours" | "12hours" | "24hours" | "3days" | "7days";
type GdeltMode = "ArtList" | "TimelineVol" | "TimelineTone" | "TimelineVolRaw";
type GdeltTheme = 
  | "ECON_INFLATION" 
  | "ECON_RECESSION" 
  | "ECON_INTEREST_RATE" 
  | "ECON_UNEMPLOYMENT"
  | "EPU_ECONOMY"
  | "CRISISLEX_C03_WELLBEING_HEALTH"
  | "WB_2024_DIGITAL_CURRENCIES";

interface GdeltSearchOptions {
  timespan?: GdeltTimespan;
  mode?: GdeltMode;
  theme?: GdeltTheme;
  sourceLang?: string;
  sourceCountry?: string;
  maxRecords?: number;
}

interface GdeltRawArticle {
  url?: string;
  title?: string;
  domain?: string;
  language?: string;
  seendate?: string;
  socialimage?: string;
  tone?: string | number;
}

interface GdeltRawArticlesResponse {
  articles?: GdeltRawArticle[];
}

interface GdeltRawTimelinePoint {
  date?: string;
  value?: string | number;
}

interface GdeltRawTimelineResponse {
  timeline?: GdeltRawTimelinePoint[];
}

interface GdeltRawTonePoint {
  date?: string;
  tone?: string | number;
  tonescore?: string | number;
  negtonescore?: string | number;
}

interface GdeltRawToneResponse {
  timeline?: GdeltRawTonePoint[];
}

class GdeltConnector {
  private articleCache = new ApiCache<GdeltSearchResponse>({
    freshDuration: 10 * 60 * 1000,
    staleDuration: 30 * 60 * 1000,
  });

  private volumeCache = new ApiCache<GdeltVolumeResponse>({
    freshDuration: 5 * 60 * 1000,
    staleDuration: 15 * 60 * 1000,
  });

  private toneCache = new ApiCache<GdeltToneResponse>({
    freshDuration: 5 * 60 * 1000,
    staleDuration: 15 * 60 * 1000,
  });

  private sentimentCache = new ApiCache<GdeltSentimentAnalysis>({
    freshDuration: 10 * 60 * 1000,
    staleDuration: 30 * 60 * 1000,
  });

  isAvailable(): boolean {
    return true;
  }

  private buildUrl(query: string, options: GdeltSearchOptions = {}): string {
    const params = new URLSearchParams({
      query: query,
      mode: options.mode || "ArtList",
      format: "json",
      timespan: options.timespan || "24hours",
      maxrecords: String(options.maxRecords || 75),
    });

    if (options.theme) {
      params.set("theme", options.theme);
    }
    if (options.sourceLang) {
      params.set("sourcelang", options.sourceLang);
    }
    if (options.sourceCountry) {
      params.set("sourcecountry", options.sourceCountry);
    }

    return `${GDELT_DOC_API}?${params.toString()}`;
  }

  async searchArticles(
    query: string,
    options: GdeltSearchOptions = {}
  ): Promise<GdeltSearchResponse> {
    const l1CacheKey = `articles_${query}_${JSON.stringify(options)}`;
    const cached = this.articleCache.get(l1CacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const url = this.buildUrl(query, { ...options, mode: "ArtList" });
    const cacheKey = buildCacheKey("gdelt", "articles", query, options.timespan || "24hours");

    try {
      const response = await connectorFetch<GdeltRawArticlesResponse>(url, {
        provider: "gdelt",
        endpoint: "searchArticles",
        cacheKey,
        headers: { Accept: "application/json" },
      });

      const data = response.data;
      const result: GdeltSearchResponse = {
        articles: (data.articles || []).map((a) => ({
          url: a.url || "",
          title: a.title || "",
          domain: a.domain || "",
          language: a.language || "",
          seenDate: a.seendate || "",
          socialImage: a.socialimage,
          tone: a.tone ? parseFloat(String(a.tone)) : undefined,
        })),
        totalResults: data.articles?.length || 0,
      };

      this.articleCache.set(l1CacheKey, result);
      log.info("GDELT", "Articles fetched", { query, count: result.totalResults });
      return result;
    } catch (error) {
      log.error("GDELT", "Failed to fetch articles", { query, error: String(error) });
      const stale = this.articleCache.getStale(l1CacheKey);
      if (stale) return stale;
      return { articles: [], totalResults: 0 };
    }
  }

  async getVolumeTimeline(
    query: string,
    timespan: GdeltTimespan = "24hours"
  ): Promise<GdeltVolumeResponse> {
    const l1CacheKey = `volume_${query}_${timespan}`;
    const cached = this.volumeCache.get(l1CacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const url = this.buildUrl(query, { mode: "TimelineVol", timespan });
    const cacheKey = buildCacheKey("gdelt", "volume", query, timespan);

    try {
      const response = await connectorFetch<GdeltRawTimelineResponse>(url, {
        provider: "gdelt",
        endpoint: "getVolumeTimeline",
        cacheKey,
        headers: { Accept: "application/json" },
      });

      const data = response.data;
      const result: GdeltVolumeResponse = {
        timeline: (data.timeline || []).map((t) => ({
          date: t.date || "",
          value: parseFloat(String(t.value || 0)),
        })),
        query,
      };

      this.volumeCache.set(l1CacheKey, result);
      log.info("GDELT", "Volume timeline fetched", { query, points: result.timeline.length });
      return result;
    } catch (error) {
      log.error("GDELT", "Failed to fetch volume", { query, error: String(error) });
      const stale = this.volumeCache.getStale(l1CacheKey);
      if (stale) return stale;
      return { timeline: [], query };
    }
  }

  async getToneTimeline(
    query: string,
    timespan: GdeltTimespan = "24hours"
  ): Promise<GdeltToneResponse> {
    const l1CacheKey = `tone_${query}_${timespan}`;
    const cached = this.toneCache.get(l1CacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const url = this.buildUrl(query, { mode: "TimelineTone", timespan });
    const cacheKey = buildCacheKey("gdelt", "tone", query, timespan);

    try {
      const response = await connectorFetch<GdeltRawToneResponse>(url, {
        provider: "gdelt",
        endpoint: "getToneTimeline",
        cacheKey,
        headers: { Accept: "application/json" },
      });

      const data = response.data;
      const timeline: GdeltToneTimeline[] = (data.timeline || []).map((t) => ({
        date: t.date || "",
        tone: parseFloat(String(t.tone || 0)),
        positiveScore: parseFloat(String(t.tonescore || 0)),
        negativeScore: parseFloat(String(t.negtonescore || 0)),
      }));

      const avgTone = timeline.length > 0
        ? timeline.reduce((sum, t) => sum + t.tone, 0) / timeline.length
        : 0;

      const result: GdeltToneResponse = {
        timeline,
        query,
        averageTone: avgTone,
      };

      this.toneCache.set(l1CacheKey, result);
      log.info("GDELT", "Tone timeline fetched", { query, avgTone: avgTone.toFixed(2) });
      return result;
    } catch (error) {
      log.error("GDELT", "Failed to fetch tone", { query, error: String(error) });
      const stale = this.toneCache.getStale(l1CacheKey);
      if (stale) return stale;
      return { timeline: [], query, averageTone: 0 };
    }
  }

  async analyzeSymbolSentiment(
    symbol: string,
    companyName?: string
  ): Promise<GdeltSentimentAnalysis> {
    const query = companyName 
      ? `${symbol} OR "${companyName}" stock`
      : `${symbol} stock`;

    const l1CacheKey = `sentiment_${symbol}`;
    const cached = this.sentimentCache.get(l1CacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const [articles, volume24h, volume3h, tone] = await Promise.all([
      this.searchArticles(query, { timespan: "24hours", maxRecords: 50 }),
      this.getVolumeTimeline(query, "24hours"),
      this.getVolumeTimeline(query, "3hours"),
      this.getToneTimeline(query, "24hours"),
    ]);

    const recentVolume = volume3h.timeline.length > 0
      ? volume3h.timeline.slice(-3).reduce((sum, t) => sum + t.value, 0) / 3
      : 0;

    const baselineVolume = volume24h.timeline.length > 0
      ? volume24h.timeline.reduce((sum, t) => sum + t.value, 0) / volume24h.timeline.length
      : 0;

    const volumeSpike = baselineVolume > 0 && recentVolume > baselineVolume * 2;

    let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
    if (tone.averageTone > 3) {
      sentiment = "bullish";
    } else if (tone.averageTone < -3) {
      sentiment = "bearish";
    }

    const result: GdeltSentimentAnalysis = {
      symbol,
      query,
      articleCount: articles.totalResults,
      averageTone: tone.averageTone,
      sentiment,
      volumeSpike,
      recentVolume,
      baselineVolume,
      topHeadlines: articles.articles.slice(0, 5).map((a) => a.title),
      timestamp: new Date(),
    };

    this.sentimentCache.set(l1CacheKey, result);
    log.info("GDELT", "Symbol sentiment analyzed", {
      symbol,
      sentiment,
      articleCount: articles.totalResults,
      volumeSpike,
    });

    return result;
  }

  async detectBreakingNews(
    keywords: string[],
    threshold: number = 2.0
  ): Promise<GdeltBreakingNewsAlert[]> {
    const alerts: GdeltBreakingNewsAlert[] = [];

    for (const keyword of keywords) {
      const [volume3h, volume24h, articles] = await Promise.all([
        this.getVolumeTimeline(keyword, "3hours"),
        this.getVolumeTimeline(keyword, "24hours"),
        this.searchArticles(keyword, { timespan: "3hours", maxRecords: 10 }),
      ]);

      const recentVolume = volume3h.timeline.length > 0
        ? volume3h.timeline.slice(-2).reduce((sum, t) => sum + t.value, 0) / 2
        : 0;

      const baselineVolume = volume24h.timeline.length > 6
        ? volume24h.timeline.slice(0, -6).reduce((sum, t) => sum + t.value, 0) / (volume24h.timeline.length - 6)
        : 0;

      const volumeIncrease = baselineVolume > 0 ? recentVolume / baselineVolume : 0;
      const isBreaking = volumeIncrease >= threshold;

      alerts.push({
        query: keyword,
        isBreaking,
        volumeIncrease,
        toneShift: 0,
        relevantArticles: articles.articles.slice(0, 5),
      });
    }

    const breakingAlerts = alerts.filter((a) => a.isBreaking);
    if (breakingAlerts.length > 0) {
      log.warn("GDELT", "Breaking news detected", {
        keywords: breakingAlerts.map((a) => a.query),
      });
    }

    return alerts;
  }

  async getEconomicSentiment(): Promise<{
    inflation: GdeltToneResponse;
    recession: GdeltToneResponse;
    interestRates: GdeltToneResponse;
    overall: "bullish" | "bearish" | "neutral";
  }> {
    const [inflation, recession, interestRates] = await Promise.all([
      this.getToneTimeline("inflation economy", "24hours"),
      this.getToneTimeline("recession economic downturn", "24hours"),
      this.getToneTimeline("Federal Reserve interest rate", "24hours"),
    ]);

    const avgTone = (inflation.averageTone + recession.averageTone + interestRates.averageTone) / 3;

    let overall: "bullish" | "bearish" | "neutral" = "neutral";
    if (avgTone > 2) {
      overall = "bullish";
    } else if (avgTone < -2) {
      overall = "bearish";
    }

    return { inflation, recession, interestRates, overall };
  }

  async getCryptoSentiment(cryptoName: string): Promise<GdeltSentimentAnalysis> {
    const cryptoNameMap: Record<string, string> = {
      BTC: "Bitcoin",
      ETH: "Ethereum", 
      SOL: "Solana",
      XRP: "Ripple",
      DOGE: "Dogecoin",
      ADA: "Cardano",
      DOT: "Polkadot",
      LINK: "Chainlink",
      AVAX: "Avalanche",
      MATIC: "Polygon",
      LTC: "Litecoin",
      SHIB: "Shiba",
    };
    
    const fullName = cryptoNameMap[cryptoName.toUpperCase()] || cryptoName;
    const query = `${fullName} cryptocurrency`;
    
    const l1CacheKey = `crypto_sentiment_${cryptoName}`;
    const cached = this.sentimentCache.get(l1CacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const [articles, volume, tone] = await Promise.all([
      this.searchArticles(query, { timespan: "24hours", maxRecords: 50 }),
      this.getVolumeTimeline(query, "24hours"),
      this.getToneTimeline(query, "24hours"),
    ]);

    const recentVolume = volume.timeline.length > 0
      ? volume.timeline.slice(-3).reduce((sum, t) => sum + t.value, 0) / 3
      : 0;

    const baselineVolume = volume.timeline.length > 0
      ? volume.timeline.reduce((sum, t) => sum + t.value, 0) / volume.timeline.length
      : 0;

    let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
    if (tone.averageTone > 2) {
      sentiment = "bullish";
    } else if (tone.averageTone < -2) {
      sentiment = "bearish";
    }

    const result: GdeltSentimentAnalysis = {
      symbol: cryptoName.toUpperCase(),
      query,
      articleCount: articles.totalResults,
      averageTone: tone.averageTone,
      sentiment,
      volumeSpike: recentVolume > baselineVolume * 2,
      recentVolume,
      baselineVolume,
      topHeadlines: articles.articles.slice(0, 5).map((a) => a.title),
      timestamp: new Date(),
    };

    this.sentimentCache.set(l1CacheKey, result);
    return result;
  }

  getConnectionStatus(): { connected: boolean; cacheSize: number; lastRequest: Date | null } {
    return {
      connected: true,
      cacheSize:
        this.articleCache.size() +
        this.volumeCache.size() +
        this.toneCache.size() +
        this.sentimentCache.size(),
      lastRequest: null,
    };
  }

  clearCache(): void {
    this.articleCache.clear();
    this.volumeCache.clear();
    this.toneCache.clear();
    this.sentimentCache.clear();
  }
}

export const gdelt = new GdeltConnector();
