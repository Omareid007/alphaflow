import { coingecko, type CoinPrice, type GlobalMarketData } from "../connectors/coingecko";
import { finnhub, type StockQuote, type MarketNews } from "../connectors/finnhub";
import { log } from "../utils/logger";

export interface MarketIntelligenceScore {
  overall: number;
  components: {
    momentum: number;
    volatility: number;
    sentiment: number;
    volume: number;
  };
  signals: MarketSignal[];
  dataQuality: "excellent" | "good" | "fair" | "poor";
  activeSources: number;
  totalSources: number;
  lastUpdated: string;
}

export interface MarketSignal {
  type: "bullish" | "bearish" | "neutral";
  source: string;
  message: string;
  strength: number;
  timestamp: string;
}

export interface FusedMarketData {
  crypto: {
    topCoins: CoinPrice[];
    globalData: GlobalMarketData["data"] | null;
    marketCapChange24h: number;
    dominanceBTC: number;
    totalMarketCap: number;
  };
  stocks: {
    quotes: Record<string, StockQuote>;
    news: MarketNews[];
    avgChange: number;
    marketSentiment: "bullish" | "bearish" | "neutral";
  };
  intelligence: MarketIntelligenceScore;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class DataFusionEngine {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cacheDuration = 30 * 1000;
  private lastFusionTime = 0;

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

  async getMarketIntelligence(): Promise<MarketIntelligenceScore> {
    const cacheKey = "market_intelligence";
    const cached = this.getCached<MarketIntelligenceScore>(cacheKey);
    if (cached) return cached;

    const signals: MarketSignal[] = [];
    let activeSources = 0;
    const totalSources = 4;

    let cryptoMomentum = 0.5;
    let cryptoVolatility = 0.5;
    let cryptoSentiment = 0.5;
    let cryptoVolume = 0.5;

    let stockMomentum = 0.5;
    let stockSentiment = 0.5;

    let hasCryptoData = false;
    let hasStockData = false;
    let hasNewsData = false;
    let hasGlobalData = false;

    try {
      const cryptoMarkets = await coingecko.getMarkets("usd", 20, 1, "market_cap_desc");
      if (cryptoMarkets && cryptoMarkets.length > 0) {
        hasCryptoData = true;
        activeSources++;

        const avgChange = cryptoMarkets.reduce((sum, c) => sum + (c.price_change_percentage_24h || 0), 0) / cryptoMarkets.length;
        const positiveCoins = cryptoMarkets.filter(c => (c.price_change_percentage_24h || 0) > 0).length;
        const marketBreadth = positiveCoins / cryptoMarkets.length;

        cryptoMomentum = this.normalizeScore((avgChange + 10) / 20);
        cryptoSentiment = marketBreadth;

        const volatility = cryptoMarkets.reduce((sum, c) => {
          const range = c.high_24h && c.low_24h ? (c.high_24h - c.low_24h) / c.low_24h : 0;
          return sum + range;
        }, 0) / cryptoMarkets.length;
        cryptoVolatility = this.normalizeScore(1 - volatility * 5);

        const avgVolume = cryptoMarkets.reduce((sum, c) => sum + (c.total_volume || 0), 0) / cryptoMarkets.length;
        const avgMarketCap = cryptoMarkets.reduce((sum, c) => sum + (c.market_cap || 0), 0) / cryptoMarkets.length;
        const volumeRatio = avgVolume / avgMarketCap;
        cryptoVolume = this.normalizeScore(volumeRatio * 10);

        if (avgChange > 5) {
          signals.push({
            type: "bullish",
            source: "CoinGecko",
            message: `Crypto market up ${avgChange.toFixed(1)}% in 24h`,
            strength: Math.min(avgChange / 10, 1),
            timestamp: new Date().toISOString(),
          });
        } else if (avgChange < -5) {
          signals.push({
            type: "bearish",
            source: "CoinGecko",
            message: `Crypto market down ${Math.abs(avgChange).toFixed(1)}% in 24h`,
            strength: Math.min(Math.abs(avgChange) / 10, 1),
            timestamp: new Date().toISOString(),
          });
        }

        if (marketBreadth > 0.7) {
          signals.push({
            type: "bullish",
            source: "CoinGecko",
            message: `${(marketBreadth * 100).toFixed(0)}% of top 20 coins are positive`,
            strength: marketBreadth,
            timestamp: new Date().toISOString(),
          });
        } else if (marketBreadth < 0.3) {
          signals.push({
            type: "bearish",
            source: "CoinGecko",
            message: `Only ${(marketBreadth * 100).toFixed(0)}% of top 20 coins are positive`,
            strength: 1 - marketBreadth,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      log.error("DataFusion", "Failed to fetch crypto data for fusion", { error: error instanceof Error ? error.message : String(error) });
    }

    try {
      const globalData = await coingecko.getGlobalData();
      if (globalData?.data) {
        hasGlobalData = true;
        activeSources++;

        const mcChange = globalData.data.market_cap_change_percentage_24h_usd;
        if (mcChange > 3) {
          signals.push({
            type: "bullish",
            source: "CoinGecko Global",
            message: `Total crypto market cap up ${mcChange.toFixed(1)}%`,
            strength: Math.min(mcChange / 10, 1),
            timestamp: new Date().toISOString(),
          });
        } else if (mcChange < -3) {
          signals.push({
            type: "bearish",
            source: "CoinGecko Global",
            message: `Total crypto market cap down ${Math.abs(mcChange).toFixed(1)}%`,
            strength: Math.min(Math.abs(mcChange) / 10, 1),
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      log.error("DataFusion", "Failed to fetch global data for fusion", { error: error instanceof Error ? error.message : String(error) });
    }

    try {
      const stockSymbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"];
      const quotes = await finnhub.getMultipleQuotes(stockSymbols);
      if (quotes.size > 0) {
        const changes: number[] = [];
        quotes.forEach((quote) => {
          if (quote.dp !== undefined && !isNaN(quote.dp)) {
            changes.push(quote.dp);
          }
        });

        if (changes.length > 0) {
          hasStockData = true;
          activeSources++;

          const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;
          if (!isNaN(avgChange)) {
            const positiveStocks = changes.filter(c => c > 0).length;
            const stockBreadth = positiveStocks / changes.length;

            stockMomentum = this.normalizeScore((avgChange + 5) / 10);
            stockSentiment = isNaN(stockBreadth) ? 0.5 : stockBreadth;

            if (avgChange > 2) {
              signals.push({
                type: "bullish",
                source: "Finnhub",
                message: `Tech stocks up ${avgChange.toFixed(1)}% average`,
                strength: Math.min(avgChange / 5, 1),
                timestamp: new Date().toISOString(),
              });
            } else if (avgChange < -2) {
              signals.push({
                type: "bearish",
                source: "Finnhub",
                message: `Tech stocks down ${Math.abs(avgChange).toFixed(1)}% average`,
                strength: Math.min(Math.abs(avgChange) / 5, 1),
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (error) {
      log.error("DataFusion", "Failed to fetch stock data for fusion", { error: error instanceof Error ? error.message : String(error) });
    }

    try {
      const news = await finnhub.getMarketNews("general");
      if (news && news.length > 0) {
        hasNewsData = true;
        activeSources++;

        const recentNews = news.slice(0, 10);
        const sentimentKeywords = {
          bullish: ["surge", "rally", "gains", "bullish", "record", "soar", "jump", "breakthrough", "growth", "strong"],
          bearish: ["crash", "plunge", "bearish", "decline", "fall", "drop", "slump", "weak", "fear", "concern"],
        };

        let bullishCount = 0;
        let bearishCount = 0;

        recentNews.forEach((article) => {
          const text = (article.headline + " " + article.summary).toLowerCase();
          sentimentKeywords.bullish.forEach((kw) => {
            if (text.includes(kw)) bullishCount++;
          });
          sentimentKeywords.bearish.forEach((kw) => {
            if (text.includes(kw)) bearishCount++;
          });
        });

        if (bullishCount > bearishCount + 3) {
          signals.push({
            type: "bullish",
            source: "Finnhub News",
            message: `News sentiment is predominantly positive`,
            strength: Math.min((bullishCount - bearishCount) / 10, 1),
            timestamp: new Date().toISOString(),
          });
        } else if (bearishCount > bullishCount + 3) {
          signals.push({
            type: "bearish",
            source: "Finnhub News",
            message: `News sentiment is predominantly negative`,
            strength: Math.min((bearishCount - bullishCount) / 10, 1),
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      log.error("DataFusion", "Failed to fetch news for fusion", { error: error instanceof Error ? error.message : String(error) });
    }

    const momentumScore = hasCryptoData && hasStockData
      ? (cryptoMomentum * 0.5 + stockMomentum * 0.5)
      : hasCryptoData ? cryptoMomentum : hasStockData ? stockMomentum : 0.5;

    const volatilityScore = hasCryptoData ? cryptoVolatility : 0.5;
    const volumeScore = hasCryptoData ? cryptoVolume : 0.5;

    const sentimentScore = hasCryptoData && hasStockData
      ? (cryptoSentiment * 0.5 + stockSentiment * 0.5)
      : hasCryptoData ? cryptoSentiment : hasStockData ? stockSentiment : 0.5;

    const weights = { momentum: 0.35, volatility: 0.15, sentiment: 0.35, volume: 0.15 };
    const overall = 
      momentumScore * weights.momentum +
      volatilityScore * weights.volatility +
      sentimentScore * weights.sentiment +
      volumeScore * weights.volume;

    let dataQuality: "excellent" | "good" | "fair" | "poor";
    if (activeSources >= 4) dataQuality = "excellent";
    else if (activeSources >= 3) dataQuality = "good";
    else if (activeSources >= 2) dataQuality = "fair";
    else dataQuality = "poor";

    const result: MarketIntelligenceScore = {
      overall: this.normalizeScore(overall),
      components: {
        momentum: this.normalizeScore(momentumScore),
        volatility: this.normalizeScore(volatilityScore),
        sentiment: this.normalizeScore(sentimentScore),
        volume: this.normalizeScore(volumeScore),
      },
      signals: signals.slice(0, 5),
      dataQuality,
      activeSources,
      totalSources,
      lastUpdated: new Date().toISOString(),
    };

    this.setCache(cacheKey, result);
    this.lastFusionTime = Date.now();
    return result;
  }

  async getFusedMarketData(): Promise<FusedMarketData> {
    const cacheKey = "fused_market_data";
    const cached = this.getCached<FusedMarketData>(cacheKey);
    if (cached) return cached;

    let topCoins: CoinPrice[] = [];
    let globalData: GlobalMarketData["data"] | null = null;
    let marketCapChange24h = 0;
    let dominanceBTC = 0;
    let totalMarketCap = 0;

    try {
      topCoins = await coingecko.getMarkets("usd", 10, 1, "market_cap_desc");
    } catch (error) {
      log.error("DataFusion", "Failed to fetch top coins", { error: error instanceof Error ? error.message : String(error) });
    }

    try {
      const global = await coingecko.getGlobalData();
      if (global?.data) {
        globalData = global.data;
        marketCapChange24h = global.data.market_cap_change_percentage_24h_usd || 0;
        dominanceBTC = global.data.market_cap_percentage?.btc || 0;
        totalMarketCap = global.data.total_market_cap?.usd || 0;
      }
    } catch (error) {
      log.error("DataFusion", "Failed to fetch global data", { error: error instanceof Error ? error.message : String(error) });
    }

    let stockQuotes: Record<string, StockQuote> = {};
    let stockNews: MarketNews[] = [];
    let stockAvgChange = 0;
    let stockMarketSentiment: "bullish" | "bearish" | "neutral" = "neutral";

    try {
      const quotesMap = await finnhub.getMultipleQuotes(["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"]);
      const changes: number[] = [];
      quotesMap.forEach((quote, symbol) => {
        stockQuotes[symbol] = quote;
        if (quote.dp !== undefined && !isNaN(quote.dp)) {
          changes.push(quote.dp);
        }
      });
      if (changes.length > 0) {
        const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;
        stockAvgChange = isNaN(avgChange) ? 0 : avgChange;
        stockMarketSentiment = stockAvgChange > 1 ? "bullish" : stockAvgChange < -1 ? "bearish" : "neutral";
      }
    } catch (error) {
      log.error("DataFusion", "Failed to fetch stock quotes", { error: error instanceof Error ? error.message : String(error) });
    }

    try {
      stockNews = await finnhub.getMarketNews("general");
    } catch (error) {
      log.error("DataFusion", "Failed to fetch stock news", { error: error instanceof Error ? error.message : String(error) });
    }

    const intelligence = await this.getMarketIntelligence();

    const result: FusedMarketData = {
      crypto: {
        topCoins,
        globalData,
        marketCapChange24h,
        dominanceBTC,
        totalMarketCap,
      },
      stocks: {
        quotes: stockQuotes,
        news: stockNews.slice(0, 10),
        avgChange: stockAvgChange,
        marketSentiment: stockMarketSentiment,
      },
      intelligence,
    };

    this.setCache(cacheKey, result);
    return result;
  }

  private normalizeScore(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  getStatus(): { available: boolean; lastFusionTime: number; cacheSize: number } {
    return {
      available: true,
      lastFusionTime: this.lastFusionTime,
      cacheSize: this.cache.size,
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const dataFusionEngine = new DataFusionEngine();
