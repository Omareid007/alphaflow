import { log } from "../utils/logger";
import { connectorFetch, buildCacheKey } from "../lib/connectorClient";
import { getProviderStatus } from "../lib/callExternal";

const NEWSAPI_BASE_URL = "https://newsapi.org/v2";

export interface NewsArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

export interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsArticle[];
}

export interface NewsSource {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  language: string;
  country: string;
}

export interface NewsSourcesResponse {
  status: string;
  sources: NewsSource[];
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class NewsAPIConnector {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cacheDuration = 60 * 60 * 1000; // 60 minutes fresh cache (L1 hot cache)
  private staleCacheDuration = 24 * 60 * 60 * 1000; // 24 hours stale data

  private getApiKey(): string | undefined {
    return process.env.NEWS_API_KEY;
  }

  private getCached<T>(key: string, allowStale = false): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    const maxAge = allowStale ? this.staleCacheDuration : this.cacheDuration;

    if (age < maxAge) {
      return entry.data;
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private async fetchWithRetry<T>(
    url: string,
    endpoint: string,
    cacheKey: string
  ): Promise<T> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("NEWS_API_KEY is not configured");
    }

    const staleData = this.getCached<T>(cacheKey, true);

    const separator = url.includes("?") ? "&" : "?";
    const fullUrl = `${url}${separator}apiKey=${apiKey}`;

    try {
      const result = await connectorFetch<T>(fullUrl, {
        provider: "newsapi",
        endpoint: endpoint,
        cacheKey: buildCacheKey("newsapi", cacheKey),
        headers: { Accept: "application/json" },
      });

      log.debug("NewsAPI", `Fetched ${endpoint}`, {
        cacheStatus: result.provenance.cacheStatus,
        budgetRemaining: result.provenance.budgetRemaining,
      });

      return result.data;
    } catch (error) {
      if (staleData) {
        log.debug(
          "NewsAPI",
          `Returning L1 stale data for ${cacheKey} after error`
        );
        return staleData;
      }
      throw error;
    }
  }

  async getTopHeadlines(
    category:
      | "business"
      | "entertainment"
      | "general"
      | "health"
      | "science"
      | "sports"
      | "technology" = "business",
    country = "us",
    pageSize = 20
  ): Promise<NewsArticle[]> {
    const cacheKey = `headlines_${category}_${country}_${pageSize}`;
    const cached = this.getCached<NewsArticle[]>(cacheKey);
    if (cached) {
      log.debug("NewsAPI", `L1 cache hit for ${cacheKey}`);
      return cached;
    }

    try {
      const url = `${NEWSAPI_BASE_URL}/top-headlines?category=${category}&country=${country}&pageSize=${pageSize}`;
      const response = await this.fetchWithRetry<NewsAPIResponse>(
        url,
        "/top-headlines",
        cacheKey
      );

      if (response.status !== "ok") {
        throw new Error("NewsAPI returned error status");
      }

      this.setCache(cacheKey, response.articles);
      return response.articles;
    } catch (error) {
      const stale = this.getCached<NewsArticle[]>(cacheKey, true);
      if (stale) {
        log.debug(
          "NewsAPI",
          "getTopHeadlines returning stale data due to error"
        );
        return stale;
      }
      throw error;
    }
  }

  async searchNews(
    query: string,
    sortBy: "relevancy" | "popularity" | "publishedAt" = "publishedAt",
    pageSize = 20,
    language = "en"
  ): Promise<NewsArticle[]> {
    const cacheKey = `search_${query}_${sortBy}_${pageSize}_${language}`;
    const cached = this.getCached<NewsArticle[]>(cacheKey);
    if (cached) {
      log.debug("NewsAPI", `L1 cache hit for ${cacheKey}`);
      return cached;
    }

    try {
      const url = `${NEWSAPI_BASE_URL}/everything?q=${encodeURIComponent(query)}&sortBy=${sortBy}&pageSize=${pageSize}&language=${language}`;
      const response = await this.fetchWithRetry<NewsAPIResponse>(
        url,
        "/everything",
        cacheKey
      );

      if (response.status !== "ok") {
        throw new Error("NewsAPI returned error status");
      }

      this.setCache(cacheKey, response.articles);
      return response.articles;
    } catch (error) {
      const stale = this.getCached<NewsArticle[]>(cacheKey, true);
      if (stale) {
        log.debug("NewsAPI", "searchNews returning stale data due to error");
        return stale;
      }
      throw error;
    }
  }

  async getMarketNews(pageSize = 20): Promise<NewsArticle[]> {
    return this.searchNews(
      "stock market OR cryptocurrency OR trading OR investing OR finance",
      "publishedAt",
      pageSize
    );
  }

  async getCryptoNews(pageSize = 20): Promise<NewsArticle[]> {
    return this.searchNews(
      "bitcoin OR ethereum OR cryptocurrency OR crypto trading",
      "publishedAt",
      pageSize
    );
  }

  async getStockNews(symbol: string, pageSize = 10): Promise<NewsArticle[]> {
    return this.searchNews(symbol, "relevancy", pageSize);
  }

  async getSources(
    category = "business",
    language = "en"
  ): Promise<NewsSource[]> {
    const cacheKey = `sources_${category}_${language}`;
    const cached = this.getCached<NewsSource[]>(cacheKey);
    if (cached) {
      log.debug("NewsAPI", `L1 cache hit for ${cacheKey}`);
      return cached;
    }

    try {
      const url = `${NEWSAPI_BASE_URL}/top-headlines/sources?category=${category}&language=${language}`;
      const response = await this.fetchWithRetry<NewsSourcesResponse>(
        url,
        "/sources",
        cacheKey
      );

      if (response.status !== "ok") {
        throw new Error("NewsAPI returned error status");
      }

      this.setCache(cacheKey, response.sources);
      return response.sources;
    } catch (error) {
      const stale = this.getCached<NewsSource[]>(cacheKey, true);
      if (stale) {
        log.debug("NewsAPI", "getSources returning stale data due to error");
        return stale;
      }
      throw error;
    }
  }

  async getConnectionStatus(): Promise<{
    connected: boolean;
    hasApiKey: boolean;
    cacheSize: number;
    budgetStatus: {
      allowed: boolean;
      currentCount: number;
      limit: number;
      windowType: string;
    };
  }> {
    const hasApiKey = !!this.getApiKey();
    const providerStatus = await getProviderStatus("newsapi");

    return {
      connected:
        hasApiKey &&
        providerStatus.enabled &&
        providerStatus.budgetStatus.allowed,
      hasApiKey,
      cacheSize: this.cache.size,
      budgetStatus: providerStatus.budgetStatus,
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const newsapi = new NewsAPIConnector();
