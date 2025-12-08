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
  private cacheDuration = 5 * 60 * 1000;
  private lastRequestTime = 0;
  private minRequestInterval = 1000;

  private getApiKey(): string | undefined {
    return process.env.NEWS_API_KEY;
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

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (entry && Date.now() - entry.timestamp < this.cacheDuration) {
      return entry.data;
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private async fetchWithRetry<T>(url: string, retries = 3): Promise<T> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("NEWS_API_KEY is not configured");
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
          const waitTime = Math.pow(2, i) * 1000;
          console.log(`NewsAPI rate limited, waiting ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`NewsAPI error: ${response.status}`);
        }

        return response.json() as Promise<T>;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

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

    const url = `${NEWSAPI_BASE_URL}/top-headlines?category=${category}&country=${country}&pageSize=${pageSize}`;
    const response = await this.fetchWithRetry<NewsAPIResponse>(url);

    if (response.status !== "ok") {
      throw new Error("NewsAPI returned error status");
    }

    this.setCache(cacheKey, response.articles);
    return response.articles;
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

    const url = `${NEWSAPI_BASE_URL}/everything?q=${encodeURIComponent(query)}&sortBy=${sortBy}&pageSize=${pageSize}&language=${language}`;
    const response = await this.fetchWithRetry<NewsAPIResponse>(url);

    if (response.status !== "ok") {
      throw new Error("NewsAPI returned error status");
    }

    this.setCache(cacheKey, response.articles);
    return response.articles;
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

    const url = `${NEWSAPI_BASE_URL}/top-headlines/sources?category=${category}&language=${language}`;
    const response = await this.fetchWithRetry<NewsSourcesResponse>(url);

    if (response.status !== "ok") {
      throw new Error("NewsAPI returned error status");
    }

    this.setCache(cacheKey, response.sources);
    return response.sources;
  }

  getConnectionStatus(): { connected: boolean; hasApiKey: boolean; cacheSize: number } {
    return {
      connected: !!this.getApiKey(),
      hasApiKey: !!this.getApiKey(),
      cacheSize: this.cache.size,
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const newsapi = new NewsAPIConnector();
