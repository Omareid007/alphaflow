import OpenAI from "openai";
import { storage } from "../storage";
import { finnhub } from "../connectors/finnhub";
import { coingecko } from "../connectors/coingecko";
import { alpaca } from "../connectors/alpaca";
import { safeParseFloat } from "../utils/numeric";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export interface MarketConditionAnalysis {
  condition: "bullish" | "bearish" | "neutral" | "volatile" | "uncertain";
  confidenceScore: number;
  recommendedOrderLimit: number;
  reasoning: string;
  riskLevel: "low" | "medium" | "high";
  marketIndicators: {
    overallTrend: string;
    volatilityLevel: string;
    sentimentScore: number;
    majorMovers: string[];
  };
}

interface MarketSnapshot {
  stocks: Map<string, { price: number; change: number; changePercent: number }>;
  crypto: Map<string, { price: number; change: number; changePercent: number }>;
  portfolioValue: number;
  openPositions: number;
  dailyPnl: number;
}

const MIN_ORDER_LIMIT = 10;
const MAX_ORDER_LIMIT = 50;
const ANALYSIS_INTERVAL_MS = 5 * 60 * 1000;

class MarketConditionAnalyzer {
  private lastAnalysis: MarketConditionAnalysis | null = null;
  private lastAnalysisTime: Date | null = null;
  private isAnalyzing = false;
  private analysisTimer: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    console.log("[MarketAnalyzer] Initializing market condition analyzer...");
    await this.runAnalysis();
    this.startPeriodicAnalysis();
  }

  private startPeriodicAnalysis(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
    }

    this.analysisTimer = setInterval(() => {
      this.runAnalysis().catch(err => {
        console.error("[MarketAnalyzer] Periodic analysis error:", err);
      });
    }, ANALYSIS_INTERVAL_MS);

    console.log(`[MarketAnalyzer] Periodic analysis started (every ${ANALYSIS_INTERVAL_MS / 1000}s)`);
  }

  stop(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
  }

  async runAnalysis(): Promise<MarketConditionAnalysis> {
    if (this.isAnalyzing) {
      return this.lastAnalysis || this.getDefaultAnalysis();
    }

    this.isAnalyzing = true;

    try {
      console.log("[MarketAnalyzer] Running market condition analysis...");

      const snapshot = await this.fetchMarketSnapshot();
      const analysis = await this.analyzeWithAI(snapshot);

      this.lastAnalysis = analysis;
      this.lastAnalysisTime = new Date();

      await this.updateAgentOrderLimit(analysis);

      console.log(`[MarketAnalyzer] Analysis complete: ${analysis.condition}, order limit: ${analysis.recommendedOrderLimit}`);

      return analysis;
    } catch (error) {
      console.error("[MarketAnalyzer] Analysis failed:", error);
      return this.lastAnalysis || this.getDefaultAnalysis();
    } finally {
      this.isAnalyzing = false;
    }
  }

  private async fetchMarketSnapshot(): Promise<MarketSnapshot> {
    const snapshot: MarketSnapshot = {
      stocks: new Map(),
      crypto: new Map(),
      portfolioValue: 100000,
      openPositions: 0,
      dailyPnl: 0,
    };

    try {
      const watchlistStocks = ["AAPL", "GOOGL", "MSFT", "AMZN", "NVDA", "META", "TSLA", "JPM", "V"];
      const stockQuotes = await finnhub.getMultipleQuotes(watchlistStocks);

      for (const [symbol, quote] of stockQuotes.entries()) {
        if (quote.c > 0) {
          snapshot.stocks.set(symbol, {
            price: quote.c,
            change: quote.d,
            changePercent: quote.dp,
          });
        }
      }
    } catch (error) {
      console.error("[MarketAnalyzer] Failed to fetch stock data:", error);
    }

    try {
      const cryptoMarkets = await coingecko.getMarkets();
      const watchlistCrypto = ["btc", "eth", "sol"];
      const watchedCrypto = cryptoMarkets.filter(c =>
        watchlistCrypto.includes(c.symbol.toLowerCase())
      );

      for (const coin of watchedCrypto) {
        snapshot.crypto.set(coin.symbol.toUpperCase(), {
          price: coin.current_price,
          change: coin.price_change_24h || 0,
          changePercent: coin.price_change_percentage_24h || 0,
        });
      }
    } catch (error) {
      console.error("[MarketAnalyzer] Failed to fetch crypto data:", error);
    }

    try {
      const account = await alpaca.getAccount();
      snapshot.portfolioValue = safeParseFloat(account.portfolio_value);

      const positions = await alpaca.getPositions();
      snapshot.openPositions = positions.length;

      let totalPnl = 0;
      for (const pos of positions) {
        totalPnl += safeParseFloat(pos.unrealized_pl);
      }
      snapshot.dailyPnl = totalPnl;
    } catch (error) {
      console.error("[MarketAnalyzer] Failed to fetch portfolio data:", error);
    }

    return snapshot;
  }

  private async analyzeWithAI(snapshot: MarketSnapshot): Promise<MarketConditionAnalysis> {
    const stockSummary = Array.from(snapshot.stocks.entries())
      .map(([symbol, data]) => `${symbol}: $${data.price.toFixed(2)} (${data.changePercent >= 0 ? "+" : ""}${data.changePercent.toFixed(2)}%)`)
      .join(", ");

    const cryptoSummary = Array.from(snapshot.crypto.entries())
      .map(([symbol, data]) => `${symbol}: $${data.price.toFixed(2)} (${data.changePercent >= 0 ? "+" : ""}${data.changePercent.toFixed(2)}%)`)
      .join(", ");

    const avgStockChange = this.calculateAverageChange(snapshot.stocks);
    const avgCryptoChange = this.calculateAverageChange(snapshot.crypto);
    const volatility = this.calculateVolatility(snapshot.stocks, snapshot.crypto);

    const prompt = `You are an expert market analyst AI. Analyze the following market snapshot and determine the optimal trading aggressiveness.

CURRENT MARKET DATA:
Stocks: ${stockSummary || "No data"}
Crypto: ${cryptoSummary || "No data"}

MARKET METRICS:
- Average stock change: ${avgStockChange.toFixed(2)}%
- Average crypto change: ${avgCryptoChange.toFixed(2)}%
- Volatility indicator: ${volatility.toFixed(2)}

PORTFOLIO STATUS:
- Portfolio value: $${snapshot.portfolioValue.toFixed(2)}
- Open positions: ${snapshot.openPositions}
- Unrealized P&L: $${snapshot.dailyPnl.toFixed(2)}

TASK:
Determine the optimal number of active orders (between ${MIN_ORDER_LIMIT} and ${MAX_ORDER_LIMIT}) based on:
1. Market conditions - bullish markets allow more orders, bearish markets require caution
2. Volatility - high volatility means higher risk, reduce orders
3. Portfolio health - significant losses mean reduce exposure
4. Opportunity assessment - more opportunities = more orders

RESPOND WITH VALID JSON ONLY:
{
  "condition": "bullish" | "bearish" | "neutral" | "volatile" | "uncertain",
  "confidenceScore": 0.0-1.0,
  "recommendedOrderLimit": ${MIN_ORDER_LIMIT}-${MAX_ORDER_LIMIT},
  "reasoning": "brief explanation",
  "riskLevel": "low" | "medium" | "high",
  "marketIndicators": {
    "overallTrend": "up/down/sideways",
    "volatilityLevel": "low/medium/high",
    "sentimentScore": -1.0 to 1.0,
    "majorMovers": ["symbol1", "symbol2"]
  }
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a market analyst AI. Respond only with valid JSON. No markdown, no explanations outside the JSON."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty AI response");
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]) as MarketConditionAnalysis;

      parsed.recommendedOrderLimit = Math.max(
        MIN_ORDER_LIMIT,
        Math.min(MAX_ORDER_LIMIT, parsed.recommendedOrderLimit)
      );

      return parsed;
    } catch (error) {
      console.error("[MarketAnalyzer] AI analysis failed:", error);
      return this.calculateFallbackAnalysis(snapshot, avgStockChange, avgCryptoChange, volatility);
    }
  }

  private calculateAverageChange(data: Map<string, { changePercent: number }>): number {
    if (data.size === 0) return 0;
    let total = 0;
    for (const item of data.values()) {
      total += item.changePercent;
    }
    return total / data.size;
  }

  private calculateVolatility(
    stocks: Map<string, { changePercent: number }>,
    crypto: Map<string, { changePercent: number }>
  ): number {
    const allChanges: number[] = [];
    for (const item of stocks.values()) {
      allChanges.push(Math.abs(item.changePercent));
    }
    for (const item of crypto.values()) {
      allChanges.push(Math.abs(item.changePercent));
    }

    if (allChanges.length === 0) return 0;

    const avg = allChanges.reduce((a, b) => a + b, 0) / allChanges.length;
    const variance = allChanges.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / allChanges.length;
    return Math.sqrt(variance);
  }

  private calculateFallbackAnalysis(
    snapshot: MarketSnapshot,
    avgStockChange: number,
    avgCryptoChange: number,
    volatility: number
  ): MarketConditionAnalysis {
    const overallChange = (avgStockChange + avgCryptoChange) / 2;

    let condition: MarketConditionAnalysis["condition"] = "neutral";
    let riskLevel: MarketConditionAnalysis["riskLevel"] = "medium";
    let recommendedOrderLimit = 20;

    if (volatility > 3) {
      condition = "volatile";
      riskLevel = "high";
      recommendedOrderLimit = MIN_ORDER_LIMIT;
    } else if (overallChange > 1) {
      condition = "bullish";
      riskLevel = "low";
      recommendedOrderLimit = Math.min(MAX_ORDER_LIMIT, 35);
    } else if (overallChange < -1) {
      condition = "bearish";
      riskLevel = "high";
      recommendedOrderLimit = Math.min(15, MIN_ORDER_LIMIT + 5);
    } else {
      condition = "neutral";
      riskLevel = "medium";
      recommendedOrderLimit = 20;
    }

    if (snapshot.dailyPnl < -snapshot.portfolioValue * 0.02) {
      recommendedOrderLimit = Math.max(MIN_ORDER_LIMIT, recommendedOrderLimit - 10);
      riskLevel = "high";
    }

    const majorMovers = this.identifyMajorMovers(snapshot);

    return {
      condition,
      confidenceScore: 0.6,
      recommendedOrderLimit,
      reasoning: `Fallback analysis: ${condition} market with ${volatility.toFixed(1)}% volatility`,
      riskLevel,
      marketIndicators: {
        overallTrend: overallChange > 0.5 ? "up" : overallChange < -0.5 ? "down" : "sideways",
        volatilityLevel: volatility > 3 ? "high" : volatility > 1.5 ? "medium" : "low",
        sentimentScore: Math.max(-1, Math.min(1, overallChange / 5)),
        majorMovers,
      },
    };
  }

  private identifyMajorMovers(snapshot: MarketSnapshot): string[] {
    const allAssets: { symbol: string; change: number }[] = [];

    for (const [symbol, data] of snapshot.stocks.entries()) {
      allAssets.push({ symbol, change: Math.abs(data.changePercent) });
    }
    for (const [symbol, data] of snapshot.crypto.entries()) {
      allAssets.push({ symbol, change: Math.abs(data.changePercent) });
    }

    return allAssets
      .sort((a, b) => b.change - a.change)
      .slice(0, 3)
      .map(a => a.symbol);
  }

  private async updateAgentOrderLimit(analysis: MarketConditionAnalysis): Promise<void> {
    try {
      await storage.updateAgentStatus({
        dynamicOrderLimit: analysis.recommendedOrderLimit,
        marketCondition: analysis.condition,
        aiConfidenceScore: analysis.confidenceScore.toString(),
        lastMarketAnalysis: new Date(),
        maxPositionsCount: analysis.recommendedOrderLimit,
      });
    } catch (error) {
      console.error("[MarketAnalyzer] Failed to update agent status:", error);
    }
  }

  private getDefaultAnalysis(): MarketConditionAnalysis {
    return {
      condition: "neutral",
      confidenceScore: 0.5,
      recommendedOrderLimit: 15,
      reasoning: "Default conservative analysis - no market data available",
      riskLevel: "medium",
      marketIndicators: {
        overallTrend: "sideways",
        volatilityLevel: "medium",
        sentimentScore: 0,
        majorMovers: [],
      },
    };
  }

  getLastAnalysis(): MarketConditionAnalysis | null {
    return this.lastAnalysis;
  }

  getLastAnalysisTime(): Date | null {
    return this.lastAnalysisTime;
  }

  getCurrentOrderLimit(): number {
    return this.lastAnalysis?.recommendedOrderLimit || 15;
  }

  getStatus(): {
    isRunning: boolean;
    lastAnalysis: MarketConditionAnalysis | null;
    lastAnalysisTime: Date | null;
    currentOrderLimit: number;
  } {
    return {
      isRunning: !!this.analysisTimer,
      lastAnalysis: this.lastAnalysis,
      lastAnalysisTime: this.lastAnalysisTime,
      currentOrderLimit: this.getCurrentOrderLimit(),
    };
  }
}

export const marketConditionAnalyzer = new MarketConditionAnalyzer();
