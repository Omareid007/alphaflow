import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { aiDecisionEngine, type MarketData, type AIDecision, type NewsContext } from "../ai/decision-engine";
import { generateTraceId } from "../ai/llmGateway";
import { newsapi } from "../connectors/newsapi";
import type { Strategy } from "@shared/schema";
import { fuseMarketData, type FusedMarketIntelligence } from "../ai/data-fusion-engine";
import { createEnhancedDecisionLog, type EnhancedDecisionLog } from "../ai/enhanced-decision-log";
import { huggingface } from "../connectors/huggingface";
import { valyu } from "../connectors/valyu";
import { gdelt } from "../connectors/gdelt";
import { log } from "../utils/logger";

/**
 * AIAnalyzer - Handles AI-powered market analysis and decision-making
 *
 * Responsibilities:
 * - Analyzing symbols with AI decision engine
 * - Gathering enrichment data from multiple sources (news, sentiment, fundamentals)
 * - Fusing market intelligence from various data providers
 * - Creating enhanced decision logs for transparency
 * - Linking AI decisions to executed trades
 */
export class AIAnalyzer {
  /**
   * Normalize crypto symbols to slash format (e.g., BTC/USD)
   */
  private normalizeCryptoSymbol(symbol: string): string {
    const upperSymbol = symbol.toUpperCase();
    if (upperSymbol.includes("/")) {
      return upperSymbol;
    }
    if (upperSymbol === "BTCUSD") return "BTC/USD";
    if (upperSymbol === "ETHUSD") return "ETH/USD";
    if (upperSymbol === "SOLUSD") return "SOL/USD";
    if (upperSymbol.endsWith("USD") && upperSymbol.length > 3) {
      const base = upperSymbol.slice(0, -3);
      return `${base}/USD`;
    }
    return upperSymbol;
  }

  /**
   * Check if a symbol is a crypto symbol
   */
  private isCryptoSymbol(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase();
    // Common crypto pairs on Alpaca
    const cryptoPairs = [
      "BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD", "SHIB/USD", "AVAX/USD",
      "DOT/USD", "LINK/USD", "UNI/USD", "AAVE/USD", "LTC/USD", "BCH/USD",
      "BTCUSD", "ETHUSD", "SOLUSD", "DOGEUSD", "SHIBUSD", "AVAXUSD",
      "DOTUSD", "LINKUSD", "UNIUSD", "AAVEUSD", "LTCUSD", "BCHUSD"
    ];
    // Check if it's a known crypto pair or contains a slash (crypto format)
    return cryptoPairs.includes(upperSymbol) ||
           (symbol.includes("/") && upperSymbol.endsWith("USD"));
  }

  /**
   * Normalize symbol for Alpaca API calls
   */
  private normalizeSymbolForAlpaca(symbol: string, forOrder: boolean = false): string {
    // For crypto orders, Alpaca requires the slash format (e.g., BTC/USD)
    // For stock orders and position lookups, use uppercase without slash
    if (forOrder && this.isCryptoSymbol(symbol)) {
      return this.normalizeCryptoSymbol(symbol);
    }
    return symbol.replace("/", "").toUpperCase();
  }

  /**
   * Get market data for a symbol from Alpaca
   */
  async getMarketDataForSymbol(symbol: string): Promise<MarketData | null> {
    try {
      const isCrypto = this.isCryptoSymbol(symbol);
      const lookupSymbol = isCrypto
        ? this.normalizeCryptoSymbol(symbol)
        : this.normalizeSymbolForAlpaca(symbol);

      const snapshots = isCrypto
        ? await alpaca.getCryptoSnapshots([lookupSymbol])
        : await alpaca.getSnapshots([lookupSymbol]);
      const snapshot = snapshots[lookupSymbol];

      if (snapshot) {
        const currentPrice = snapshot.latestTrade?.p || snapshot.dailyBar?.c || snapshot.prevDailyBar?.c || 0;

        if (!currentPrice || currentPrice <= 0) {
          log.warn("AIAnalyzer", "No valid price sources for symbol", {
            symbol,
            latestTrade: snapshot.latestTrade?.p,
            dailyBarClose: snapshot.dailyBar?.c,
            prevDailyBarClose: snapshot.prevDailyBar?.c
          });
          return null;
        }

        const prevClose = snapshot.prevDailyBar?.c || currentPrice;
        const priceChange = currentPrice - prevClose;
        const priceChangePercent = prevClose > 0 ? (priceChange / prevClose) * 100 : 0;

        return {
          symbol: symbol.toUpperCase(),
          currentPrice,
          priceChange24h: priceChange,
          priceChangePercent24h: priceChangePercent,
          high24h: snapshot.dailyBar?.h,
          low24h: snapshot.dailyBar?.l,
          volume: snapshot.dailyBar?.v,
        };
      }

      log.warn("AIAnalyzer", "No snapshot data returned", { symbol });
      return null;
    } catch (error) {
      log.error("AIAnalyzer", "Failed to get market data", { symbol, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Analyze sentiment from news headlines
   */
  analyzeSentiment(headlines: string[]): "bullish" | "bearish" | "neutral" {
    const bullishWords = ["surge", "rally", "gain", "rise", "up", "growth", "positive", "beat", "record", "high"];
    const bearishWords = ["drop", "fall", "decline", "down", "loss", "negative", "miss", "crash", "low", "sell"];

    let score = 0;
    const text = headlines.join(" ").toLowerCase();

    for (const word of bullishWords) {
      if (text.includes(word)) score++;
    }
    for (const word of bearishWords) {
      if (text.includes(word)) score--;
    }

    if (score > 1) return "bullish";
    if (score < -1) return "bearish";
    return "neutral";
  }

  /**
   * Gather enrichment data from optional sources (Hugging Face, Valyu.ai, GDELT)
   * Returns empty arrays if API keys aren't configured
   */
  async gatherEnrichmentData(
    symbol: string,
    marketData: MarketData,
    newsContext?: NewsContext
  ): Promise<{
    hasEnrichment: boolean;
    sentimentData: Array<{ source: string; symbol?: string; sentiment: "positive" | "negative" | "neutral"; score: number; confidence: number; headlines?: string[]; timestamp: Date }>;
    fundamentalData: Array<{
      source: string;
      symbol: string;
      peRatio?: number;
      revenueGrowth?: number;
      debtToEquity?: number;
      freeCashFlow?: number;
      dividendYield?: number;
      insiderSentiment?: "bullish" | "bearish" | "neutral";
      timestamp: Date
    }>;
  }> {
    const sentimentData: Array<{ source: string; symbol?: string; sentiment: "positive" | "negative" | "neutral"; score: number; confidence: number; headlines?: string[]; timestamp: Date }> = [];
    const fundamentalData: Array<{
      source: string;
      symbol: string;
      peRatio?: number;
      revenueGrowth?: number;
      debtToEquity?: number;
      freeCashFlow?: number;
      dividendYield?: number;
      insiderSentiment?: "bullish" | "bearish" | "neutral";
      timestamp: Date
    }> = [];

    const enrichmentPromises: Promise<void>[] = [];

    // Try Hugging Face sentiment enrichment if we have headlines
    if (newsContext?.headlines && newsContext.headlines.length > 0 && huggingface.isAvailable()) {
      enrichmentPromises.push(
        (async () => {
          try {
            const signal = await huggingface.generateEnrichmentSignal(
              symbol,
              newsContext.headlines!,
              marketData.priceChangePercent24h
            );
            if (signal) {
              const sentiment: "positive" | "negative" | "neutral" =
                signal.sentimentScore > 0.2 ? "positive" : signal.sentimentScore < -0.2 ? "negative" : "neutral";
              sentimentData.push({
                source: "huggingface_finbert",
                symbol,
                sentiment,
                score: signal.sentimentScore,
                confidence: signal.confidence,
                timestamp: new Date(),
              });
            }
          } catch (e) {
            log.debug("AI", `HuggingFace enrichment skipped for ${symbol}`, { reason: (e as Error).message });
          }
        })()
      );
    }

    // Try GDELT for real-time global news sentiment (FREE, no API key needed)
    const isCrypto = this.isCryptoSymbol(symbol);
    enrichmentPromises.push(
      (async () => {
        try {
          const gdeltSentiment = isCrypto
            ? await gdelt.getCryptoSentiment(symbol.replace(/USD$|USDT$|\/USD$/i, ""))
            : await gdelt.analyzeSymbolSentiment(symbol);

          if (gdeltSentiment && gdeltSentiment.articleCount > 0) {
            const sentiment: "positive" | "negative" | "neutral" =
              gdeltSentiment.sentiment === "bullish" ? "positive" :
              gdeltSentiment.sentiment === "bearish" ? "negative" : "neutral";

            sentimentData.push({
              source: "gdelt",
              symbol,
              sentiment,
              score: gdeltSentiment.averageTone / 10,
              confidence: Math.min(0.9, gdeltSentiment.articleCount / 50),
              headlines: gdeltSentiment.topHeadlines,
              timestamp: new Date(),
            });

            if (gdeltSentiment.volumeSpike) {
              log.info("GDELT", `Breaking news detected for ${symbol}`, {
                articleCount: gdeltSentiment.articleCount,
                sentiment: gdeltSentiment.sentiment,
              });
            }
          }
        } catch (e) {
          log.debug("AI", `GDELT enrichment skipped for ${symbol}`, { reason: (e as Error).message });
        }
      })()
    );

    // Try Valyu.ai comprehensive fundamentals for stocks (not crypto)
    if (!isCrypto && valyu.isAvailable()) {
      enrichmentPromises.push(
        (async () => {
          try {
            const [ratios, cashFlow, dividends, insiderData] = await Promise.all([
              valyu.getFinancialRatios(symbol),
              valyu.getCashFlow(symbol).catch(() => null),
              valyu.getDividends(symbol).catch(() => null),
              valyu.getInsiderTransactions(symbol).catch(() => null),
            ]);

            if (ratios || cashFlow || dividends || insiderData) {
              fundamentalData.push({
                source: "valyu",
                symbol,
                peRatio: ratios?.peRatio,
                revenueGrowth: ratios?.revenueGrowth,
                debtToEquity: ratios?.debtToEquity,
                freeCashFlow: cashFlow?.freeCashFlow,
                dividendYield: dividends?.dividendYield,
                insiderSentiment: insiderData?.netInsiderSentiment,
                timestamp: new Date(),
              });

              if (insiderData?.netInsiderSentiment === "bearish") {
                log.warn("Valyu", `Insider selling detected for ${symbol}`, {
                  sentiment: insiderData.netInsiderSentiment,
                  sellValue: insiderData.totalSellValue,
                });
              }
            }
          } catch (e) {
            log.debug("AI", `Valyu.ai enrichment skipped for ${symbol}`, { reason: (e as Error).message });
          }
        })()
      );
    }

    await Promise.allSettled(enrichmentPromises);

    return {
      hasEnrichment: sentimentData.length > 0 || fundamentalData.length > 0,
      sentimentData,
      fundamentalData,
    };
  }

  /**
   * Analyze a symbol with AI decision engine
   * Gathers market data, news, sentiment, and fundamental data
   * Returns AI decision with full transparency via enhanced decision log
   */
  async analyzeSymbol(
    symbol: string,
    strategyId?: string,
    traceId?: string
  ): Promise<{ decision: AIDecision; marketData: MarketData; fusedIntelligence?: FusedMarketIntelligence; enhancedLog?: EnhancedDecisionLog }> {
    const effectiveTraceId = traceId || generateTraceId();
    const marketData = await this.getMarketDataForSymbol(symbol);
    if (!marketData) {
      throw new Error(`Could not get market data for ${symbol}`);
    }

    let strategy: Strategy | undefined;
    let newsContext: NewsContext | undefined;
    let fusedIntelligence: FusedMarketIntelligence | undefined;

    if (strategyId) {
      strategy = await storage.getStrategy(strategyId);
    }

    try {
      const newsArticles = await newsapi.getStockNews(symbol, 5);
      if (newsArticles.length > 0) {
        newsContext = {
          headlines: newsArticles.map((a) => a.title),
          sentiment: this.analyzeSentiment(newsArticles.map((a) => a.title)),
          summary: `Recent news about ${symbol}`,
        };
      }
    } catch (e) {
      log.debug("AIAnalyzer", "Could not fetch news", { symbol, error: (e as Error).message });
    }

    // Gather enrichment data from optional sources
    const enrichmentData = await this.gatherEnrichmentData(symbol, marketData, newsContext);

    // Fuse data from multiple sources if we have enrichment
    if (enrichmentData.hasEnrichment) {
      try {
        fusedIntelligence = fuseMarketData({
          symbol,
          assetType: this.isCryptoSymbol(symbol) ? "crypto" : "stock",
          marketData: [{
            source: "alpaca",
            symbol,
            price: marketData.currentPrice,
            priceChange: marketData.priceChange24h,
            priceChangePercent: marketData.priceChangePercent24h,
            volume: marketData.volume,
            timestamp: new Date(),
            reliability: 0.95,
          }],
          sentimentData: enrichmentData.sentimentData,
          fundamentalData: enrichmentData.fundamentalData,
        });
        log.info("AI", `Fused intelligence for ${symbol}`, {
          signalAgreement: fusedIntelligence.signalAgreement,
          trendStrength: fusedIntelligence.trendStrength,
          dataQuality: fusedIntelligence.dataQuality.completeness,
        });
      } catch (e) {
        log.warn("AI", `Data fusion failed for ${symbol}`, { error: (e as Error).message });
      }
    }

    const strategyContext = strategy
      ? {
          id: strategy.id,
          name: strategy.name,
          type: strategy.type,
          parameters: strategy.parameters ? JSON.parse(strategy.parameters) : undefined,
        }
      : undefined;

    const decision = await aiDecisionEngine.analyzeOpportunity(
      symbol,
      marketData,
      newsContext,
      strategyContext,
      { traceId: effectiveTraceId }
    );

    // Create enhanced decision log with full transparency
    const enhancedLog = createEnhancedDecisionLog(
      decision,
      marketData,
      newsContext,
      strategyContext,
      fusedIntelligence,
      { provider: "openai", model: "gpt-4o-mini" }
    );

    await storage.createAiDecision({
      strategyId: strategyId || null,
      symbol,
      action: decision.action,
      confidence: decision.confidence.toString(),
      reasoning: decision.reasoning,
      traceId: effectiveTraceId,
      marketContext: JSON.stringify({
        marketData,
        newsContext,
        riskLevel: decision.riskLevel,
        suggestedQuantity: decision.suggestedQuantity,
        targetPrice: decision.targetPrice,
        stopLoss: decision.stopLoss,
        fusedIntelligence: fusedIntelligence ? {
          signalAgreement: fusedIntelligence.signalAgreement,
          trendStrength: fusedIntelligence.trendStrength,
          dataQuality: fusedIntelligence.dataQuality,
          warnings: fusedIntelligence.warnings,
        } : undefined,
        enhancedLogId: enhancedLog.id,
      }),
    });

    return { decision, marketData, fusedIntelligence, enhancedLog };
  }

  /**
   * Link an AI decision to an executed trade
   * Used for tracking which AI decisions resulted in actual trades
   */
  async linkAiDecisionToTrade(symbol: string, strategyId: string | undefined, tradeId: string): Promise<void> {
    try {
      const latestDecision = await storage.getLatestAiDecisionForSymbol(symbol, strategyId);
      if (latestDecision && !latestDecision.executedTradeId) {
        await storage.updateAiDecision(latestDecision.id, { executedTradeId: tradeId });
        log.debug("AIAnalyzer", "Linked AI decision to trade", { decisionId: latestDecision.id, tradeId });
      }
    } catch (error) {
      log.error("AIAnalyzer", "Failed to link AI decision to trade", { error: (error as Error).message });
    }
  }
}

export const aiAnalyzer = new AIAnalyzer();
