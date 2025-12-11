import { log } from "../utils/logger";

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
  private cacheDuration = 60 * 60 * 1000; // 60 minutes fresh cache
  private staleCacheDuration = 24 * 60 * 60 * 1000; // 24 hours stale data (handles NewsAPI 100 req/day limit)
  private lastRequestTime = 0;
  private minRequestInterval = 3000; // 3 seconds between requests (increased from 2)
  private rateLimitedUntil = 0;
  private consecutiveRateLimitErrors = 0;
  private circuitOpen = false;
  private circuitOpenUntil = 0;
  private readonly CIRCUIT_OPEN_DURATION = 15 * 60 * 1000; // 15 minutes

  private getApiKey(): string | undefined {
    return process.env.NEWS_API_KEY;
  }

  private isRateLimited(): boolean {
    return Date.now() < this.rateLimitedUntil;
  }

  private isCircuitOpen(): boolean {
    if (this.circuitOpen && Date.now() >= this.circuitOpenUntil) {
      this.circuitOpen = false;
      log.info("NewsAPI", "Circuit breaker closed, resuming requests");
    }
    return this.circuitOpen;
  }

  private openCircuit(reason: string): void {
    this.circuitOpen = true;
    this.circuitOpenUntil = Date.now() + this.CIRCUIT_OPEN_DURATION;
    log.warn("NewsAPI", `Circuit breaker opened: ${reason}`, {
      reopenAt: new Date(this.circuitOpenUntil).toISOString(),
    });
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
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

  private addJitter(baseDelay: number): number {
    return baseDelay + Math.random() * baseDelay * 0.25;
  }

  private async fetchWithRetry<T>(url: string, cacheKey: string, retries = 2): Promise<T> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("NEWS_API_KEY is not configured");
    }

    const staleData = this.getCached<T>(cacheKey, true);

    // Circuit breaker check - return stale data if open
    if (this.isCircuitOpen()) {
      if (staleData) {
        log.debug("NewsAPI", `Circuit open, returning cached data for ${cacheKey}`);
        return staleData;
      }
      throw new Error("NewsAPI circuit breaker is open");
    }

    // If rate limited, return stale data immediately without making request
    if (this.isRateLimited()) {
      if (staleData) {
        log.debug("NewsAPI", `Rate limited, returning cached data for ${cacheKey}`);
        return staleData;
      }
      const remainingSecs = Math.ceil((this.rateLimitedUntil - Date.now()) / 1000);
      throw new Error(`NewsAPI rate limited for ${remainingSecs} more seconds`);
    }

    await this.throttle();

    const separator = url.includes("?") ? "&" : "?";
    const fullUrl = `${url}${separator}apiKey=${apiKey}`;

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(fullUrl, {
          headers: {
            Accept: "application/json",
          },
        });

        if (response.status === 429) {
          this.consecutiveRateLimitErrors++;
          // Exponential backoff: 8, 16, 32 minutes based on consecutive rate limit errors
          const backoffMinutes = Math.min(Math.pow(2, this.consecutiveRateLimitErrors + 2), 60);
          const backoffTime = this.addJitter(backoffMinutes * 60 * 1000);
          this.rateLimitedUntil = Date.now() + backoffTime;
          log.warn("NewsAPI", `Rate limited (429), backing off for ${Math.ceil(backoffTime / 60000)} minutes`);
          
          // Open circuit after 2 consecutive rate limits
          if (this.consecutiveRateLimitErrors >= 2) {
            this.openCircuit("Multiple consecutive rate limits");
          }
          
          if (staleData) {
            log.debug("NewsAPI", "Returning cached data due to rate limit");
            return staleData;
          }
          
          // Wait briefly and retry if no stale data
          await new Promise((resolve) => setTimeout(resolve, this.addJitter(2000)));
          continue;
        }

        if (response.status === 426) {
          log.warn("NewsAPI", "Free tier limitation hit (426)");
          this.openCircuit("Free tier limitation");
          if (staleData) return staleData;
          throw new Error("NewsAPI free tier limitation");
        }

        if (!response.ok) {
          throw new Error(`NewsAPI error: ${response.status}`);
        }

        // Success - reset rate limit counter and close circuit
        this.consecutiveRateLimitErrors = 0;
        if (this.circuitOpen) {
          this.circuitOpen = false;
          log.info("NewsAPI", "Circuit breaker closed after successful request");
        }
        return response.json() as Promise<T>;
      } catch (error) {
        log.debug("NewsAPI", `Fetch attempt ${i + 1} failed`, { error: (error as Error).message });
        
        if (i === retries - 1) {
          if (staleData) {
            log.debug("NewsAPI", `Returning cached data after ${retries} failed attempts`);
            return staleData;
          }
          throw error;
        }
        
        const waitTime = this.addJitter(Math.pow(2, i) * 1000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    if (staleData) return staleData;
    throw new Error("Failed to fetch from NewsAPI after retries");
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
    if (cached) return cached;

    try {
      const url = `${NEWSAPI_BASE_URL}/top-headlines?category=${category}&country=${country}&pageSize=${pageSize}`;
      const response = await this.fetchWithRetry<NewsAPIResponse>(url, cacheKey);

      if (response.status !== "ok") {
        throw new Error("NewsAPI returned error status");
      }

      this.setCache(cacheKey, response.articles);
      return response.articles;
    } catch (error) {
      const stale = this.getCached<NewsArticle[]>(cacheKey, true);
      if (stale) {
        log.debug("NewsAPI", "getTopHeadlines returning stale data due to error");
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
    if (cached) return cached;

    try {
      const url = `${NEWSAPI_BASE_URL}/everything?q=${encodeURIComponent(query)}&sortBy=${sortBy}&pageSize=${pageSize}&language=${language}`;
      const response = await this.fetchWithRetry<NewsAPIResponse>(url, cacheKey);

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
    if (cached) return cached;

    try {
      const url = `${NEWSAPI_BASE_URL}/top-headlines/sources?category=${category}&language=${language}`;
      const response = await this.fetchWithRetry<NewsSourcesResponse>(url, cacheKey);

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

  getConnectionStatus(): { 
    connected: boolean; 
    hasApiKey: boolean; 
    cacheSize: number;
    isRateLimited: boolean;
    rateLimitExpiresIn: number;
    isCircuitOpen: boolean;
    circuitOpenExpiresIn: number;
  } {
    const now = Date.now();
    return {
      connected: !!this.getApiKey() && !this.isCircuitOpen(),
      hasApiKey: !!this.getApiKey(),
      cacheSize: this.cache.size,
      isRateLimited: this.isRateLimited(),
      rateLimitExpiresIn: Math.max(0, Math.ceil((this.rateLimitedUntil - now) / 1000)),
      isCircuitOpen: this.isCircuitOpen(),
      circuitOpenExpiresIn: Math.max(0, Math.ceil((this.circuitOpenUntil - now) / 1000)),
    };
  }

  clearCache(): void {
    this.cache.clear();
  }

  resetRateLimit(): void {
    this.rateLimitedUntil = 0;
    this.consecutiveRateLimitErrors = 0;
    this.circuitOpen = false;
    this.circuitOpenUntil = 0;
    log.info("NewsAPI", "Rate limit and circuit breaker reset");
  }
}

export const newsapi = new NewsAPIConnector();
