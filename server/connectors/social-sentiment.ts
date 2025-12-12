import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";

const STOCKTWITS_BASE_URL = "https://api.stocktwits.com/api/2";

export interface StockTwitsSentiment {
  symbol: string;
  bullish: number;
  bearish: number;
  total: number;
  change: number;
  sentiment: "bullish" | "bearish" | "neutral";
}

export interface StockTwitsMessage {
  id: number;
  body: string;
  created_at: string;
  user: {
    id: number;
    username: string;
    name: string;
    avatar_url: string;
    followers: number;
    following: number;
  };
  sentiment?: {
    basic: "Bullish" | "Bearish";
  };
  entities?: {
    sentiment?: {
      basic: "Bullish" | "Bearish";
    };
  };
  likes: {
    total: number;
  };
}

export interface StockTwitsStream {
  symbol: {
    id: number;
    symbol: string;
    title: string;
    has_pricing: boolean;
  };
  messages: StockTwitsMessage[];
  cursor: {
    more: boolean;
    since: number;
    max: number;
  };
}

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  subreddit: string;
  url: string;
  permalink: string;
}

export interface SocialSentimentAggregate {
  symbol: string;
  timestamp: Date;
  sources: {
    stocktwits?: StockTwitsSentiment;
    reddit?: {
      mentions: number;
      avgScore: number;
      avgUpvoteRatio: number;
      recentPosts: RedditPost[];
    };
  };
  overallSentiment: "bullish" | "bearish" | "neutral";
  confidenceScore: number;
  buzzScore: number;
}

class SocialSentimentClient {
  private cache: ApiCache<unknown>;
  private rateLimitDelay = 3000;
  private lastStockTwitsRequest = 0;
  private lastRedditRequest = 0;

  constructor() {
    this.cache = new ApiCache({ freshDuration: 120000, staleDuration: 600000 });
  }

  private async rateLimitedFetch(url: string, lastRequestTime: number): Promise<{ response: Response | null; newTime: number }> {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest));
    }
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AI-Active-Trader/1.0',
        },
      });
      return { response, newTime: Date.now() };
    } catch (error) {
      log.error("SocialSentiment", `Fetch error: ${error}`);
      return { response: null, newTime: Date.now() };
    }
  }

  async getStockTwitsStream(symbol: string, limit = 30): Promise<StockTwitsStream | null> {
    const cacheKey = `stocktwits:stream:${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.data !== null) return cached.data as StockTwitsStream;

    const url = `${STOCKTWITS_BASE_URL}/streams/symbol/${symbol}.json?limit=${limit}`;
    
    const { response, newTime } = await this.rateLimitedFetch(url, this.lastStockTwitsRequest);
    this.lastStockTwitsRequest = newTime;
    
    if (!response?.ok) {
      log.warn("SocialSentiment", `StockTwits stream failed for ${symbol}`);
      return null;
    }

    try {
      const data = await response.json();
      if (data.response?.status !== 200) {
        log.warn("SocialSentiment", `StockTwits API error: ${data.errors?.[0]?.message}`);
        return null;
      }
      
      this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      log.error("SocialSentiment", `StockTwits parse error: ${error}`);
      return null;
    }
  }

  async getStockTwitsSentiment(symbol: string): Promise<StockTwitsSentiment | null> {
    const stream = await this.getStockTwitsStream(symbol, 100);
    if (!stream?.messages) return null;

    let bullish = 0;
    let bearish = 0;

    for (const message of stream.messages) {
      const sentiment = message.sentiment?.basic || message.entities?.sentiment?.basic;
      if (sentiment === "Bullish") bullish++;
      else if (sentiment === "Bearish") bearish++;
    }

    const total = bullish + bearish;
    if (total === 0) {
      return {
        symbol,
        bullish: 0,
        bearish: 0,
        total: stream.messages.length,
        change: 0,
        sentiment: "neutral",
      };
    }

    const bullishRatio = bullish / total;
    let sentiment: "bullish" | "bearish" | "neutral";
    
    if (bullishRatio > 0.6) sentiment = "bullish";
    else if (bullishRatio < 0.4) sentiment = "bearish";
    else sentiment = "neutral";

    return {
      symbol,
      bullish,
      bearish,
      total: stream.messages.length,
      change: 0,
      sentiment,
    };
  }

  async getRedditPosts(subreddit: string, query: string, limit = 25): Promise<RedditPost[]> {
    const cacheKey = `reddit:${subreddit}:${query}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
      return cached.data as RedditPost[];
    }

    const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&sort=new&limit=${limit}`;
    
    const { response, newTime } = await this.rateLimitedFetch(url, this.lastRedditRequest);
    this.lastRedditRequest = newTime;
    
    if (!response?.ok) {
      log.warn("SocialSentiment", `Reddit search failed for ${query} in r/${subreddit}`);
      return [];
    }

    try {
      const data = await response.json();
      const posts: RedditPost[] = data.data?.children?.map((child: any) => ({
        id: child.data.id,
        title: child.data.title,
        selftext: child.data.selftext,
        author: child.data.author,
        score: child.data.score,
        upvote_ratio: child.data.upvote_ratio,
        num_comments: child.data.num_comments,
        created_utc: child.data.created_utc,
        subreddit: child.data.subreddit,
        url: child.data.url,
        permalink: `https://reddit.com${child.data.permalink}`,
      })) || [];
      
      if (posts.length > 0) {
        this.cache.set(cacheKey, posts);
      }
      return posts;
    } catch (error) {
      log.error("SocialSentiment", `Reddit parse error: ${error}`);
      return [];
    }
  }

  async getRedditSentimentForSymbol(symbol: string): Promise<{
    mentions: number;
    avgScore: number;
    avgUpvoteRatio: number;
    recentPosts: RedditPost[];
  } | null> {
    const subreddits = ['wallstreetbets', 'stocks', 'investing', 'options'];
    const allPosts: RedditPost[] = [];

    for (const subreddit of subreddits) {
      const posts = await this.getRedditPosts(subreddit, symbol, 10);
      allPosts.push(...posts);
    }

    if (allPosts.length === 0) return null;

    const last24h = Date.now() / 1000 - 86400;
    const recentPosts = allPosts.filter(p => p.created_utc > last24h);
    
    const avgScore = allPosts.reduce((sum, p) => sum + p.score, 0) / allPosts.length;
    const avgUpvoteRatio = allPosts.reduce((sum, p) => sum + p.upvote_ratio, 0) / allPosts.length;

    return {
      mentions: allPosts.length,
      avgScore: Math.round(avgScore),
      avgUpvoteRatio: Math.round(avgUpvoteRatio * 100) / 100,
      recentPosts: recentPosts.slice(0, 5),
    };
  }

  async getAggregateSentiment(symbol: string): Promise<SocialSentimentAggregate> {
    const [stockTwits, reddit] = await Promise.all([
      this.getStockTwitsSentiment(symbol).catch(() => null),
      this.getRedditSentimentForSymbol(symbol).catch(() => null),
    ]);

    let buzzScore = 0;
    let sentimentScore = 0;
    let sentimentWeight = 0;

    if (stockTwits) {
      buzzScore += stockTwits.total * 2;
      if (stockTwits.sentiment === "bullish") {
        sentimentScore += 1;
        sentimentWeight += 1;
      } else if (stockTwits.sentiment === "bearish") {
        sentimentScore -= 1;
        sentimentWeight += 1;
      }
    }

    if (reddit) {
      buzzScore += reddit.mentions * 5;
      if (reddit.avgUpvoteRatio > 0.7) {
        sentimentScore += (reddit.avgUpvoteRatio - 0.5) * 2;
        sentimentWeight += 1;
      }
    }

    const normalizedSentiment = sentimentWeight > 0 ? sentimentScore / sentimentWeight : 0;
    
    let overallSentiment: "bullish" | "bearish" | "neutral";
    if (normalizedSentiment > 0.3) overallSentiment = "bullish";
    else if (normalizedSentiment < -0.3) overallSentiment = "bearish";
    else overallSentiment = "neutral";

    const confidenceScore = Math.min(100, Math.round(
      (buzzScore / 100) * 50 + 
      Math.abs(normalizedSentiment) * 50
    ));

    return {
      symbol,
      timestamp: new Date(),
      sources: {
        stocktwits: stockTwits || undefined,
        reddit: reddit || undefined,
      },
      overallSentiment,
      confidenceScore,
      buzzScore: Math.min(100, Math.round(buzzScore / 10)),
    };
  }

  async getTrendingSymbols(): Promise<string[]> {
    const cacheKey = "stocktwits:trending";
    const cached = this.cache.get(cacheKey);
    if (cached) return cached.data as string[];

    const url = `${STOCKTWITS_BASE_URL}/trending/symbols.json`;
    
    const { response, newTime } = await this.rateLimitedFetch(url, this.lastStockTwitsRequest);
    this.lastStockTwitsRequest = newTime;
    
    if (!response?.ok) {
      log.warn("SocialSentiment", "Failed to fetch trending symbols");
      return [];
    }

    try {
      const data = await response.json();
      const symbols = data.symbols?.map((s: any) => s.symbol) || [];
      this.cache.set(cacheKey, symbols);
      return symbols;
    } catch (error) {
      log.error("SocialSentiment", `Trending parse error: ${error}`);
      return [];
    }
  }
}

export const socialSentiment = new SocialSentimentClient();
