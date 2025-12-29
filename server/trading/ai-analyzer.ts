import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import {
  aiDecisionEngine,
  type MarketData,
  type AIDecision,
  type NewsContext,
} from "../ai/decision-engine";
import { generateTraceId } from "../ai/llmGateway";
import { newsapi } from "../connectors/newsapi";
import type { Strategy } from "@shared/schema";
import {
  fuseMarketData,
  type FusedMarketIntelligence,
} from "../ai/data-fusion-engine";
import {
  createEnhancedDecisionLog,
  type EnhancedDecisionLog,
} from "../ai/enhanced-decision-log";
import { huggingface } from "../connectors/huggingface";
import { valyu } from "../connectors/valyu";
import { gdelt } from "../connectors/gdelt";
import { log } from "../utils/logger";

/**
 * @file AI Analyzer Module
 * @description Handles AI-powered market analysis with multi-source data enrichment.
 * Integrates market data, news, sentiment, and fundamental analysis for comprehensive trading decisions.
 *
 * @module server/trading/ai-analyzer
 */

/**
 * AIAnalyzer - AI-powered market analysis and decision-making engine
 *
 * Orchestrates comprehensive market analysis by gathering data from multiple sources,
 * fusing intelligence, and generating AI trading decisions with full transparency.
 *
 * @class AIAnalyzer
 *
 * @example Analyze a symbol
 * ```typescript
 * const { decision, marketData, fusedIntelligence } = await aiAnalyzer.analyzeSymbol(
 *   "AAPL",
 *   "strategy-123",
 *   "trace-abc-def"
 * );
 *
 * console.log(`Decision: ${decision.action}`);
 * console.log(`Confidence: ${decision.confidence}%`);
 * console.log(`Reasoning: ${decision.reasoning}`);
 *
 * if (fusedIntelligence) {
 *   console.log(`Data sources: ${fusedIntelligence.dataQuality.sourceCount}`);
 *   console.log(`Signal agreement: ${fusedIntelligence.signalAgreement}`);
 * }
 * ```
 *
 * @example Link decision to trade
 * ```typescript
 * await aiAnalyzer.linkAiDecisionToTrade("AAPL", "strategy-123", "trade-456");
 * ```
 *
 * @responsibilities
 * - Symbol analysis with AI decision engine
 * - Multi-source data enrichment (news, sentiment, fundamentals)
 * - Market intelligence data fusion
 * - Enhanced decision logging for transparency
 * - AI decision to trade linkage
 *
 * @multiSourceEnrichment Data sources integrated:
 * 1. **Alpaca**: Real-time market data (price, volume, change)
 * 2. **NewsAPI**: Recent news headlines for sentiment analysis
 * 3. **GDELT**: Global news event sentiment (FREE, no API key)
 * 4. **Hugging Face**: FinBERT AI sentiment (optional, requires API key)
 * 5. **Valyu.ai**: Comprehensive fundamentals (optional, requires API key)
 *    - Financial ratios (P/E, debt/equity, revenue growth)
 *    - Cash flow analysis
 *    - Dividend data
 *    - Insider transaction sentiment
 *
 * @dataFusion When multiple data sources are available:
 * - Calculates signal agreement across sources
 * - Measures trend strength based on consensus
 * - Assesses data quality and completeness
 * - Identifies warnings and conflicts
 */
export class AIAnalyzer {
  /**
   * Normalize crypto symbols to slash format
   *
   * Converts crypto symbols to Alpaca's required slash format (e.g., "BTCUSD" -> "BTC/USD")
   *
   * @private
   * @param symbol - Symbol to normalize
   * @returns Normalized crypto symbol with slash format
   *
   * @example
   * ```typescript
   * normalizeCryptoSymbol("BTCUSD") // returns "BTC/USD"
   * normalizeCryptoSymbol("BTC/USD") // returns "BTC/USD"
   * normalizeCryptoSymbol("SOLUSD") // returns "SOL/USD"
   * ```
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
   *
   * Determines if a symbol represents a cryptocurrency pair based on known
   * crypto pairs and slash format detection.
   *
   * @private
   * @param symbol - Symbol to check
   * @returns True if symbol is a cryptocurrency pair
   *
   * @example
   * ```typescript
   * isCryptoSymbol("BTC/USD") // returns true
   * isCryptoSymbol("BTCUSD") // returns true
   * isCryptoSymbol("AAPL") // returns false
   * ```
   */
  private isCryptoSymbol(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase();
    // Common crypto pairs on Alpaca
    const cryptoPairs = [
      "BTC/USD",
      "ETH/USD",
      "SOL/USD",
      "DOGE/USD",
      "SHIB/USD",
      "AVAX/USD",
      "DOT/USD",
      "LINK/USD",
      "UNI/USD",
      "AAVE/USD",
      "LTC/USD",
      "BCH/USD",
      "BTCUSD",
      "ETHUSD",
      "SOLUSD",
      "DOGEUSD",
      "SHIBUSD",
      "AVAXUSD",
      "DOTUSD",
      "LINKUSD",
      "UNIUSD",
      "AAVEUSD",
      "LTCUSD",
      "BCHUSD",
    ];
    // Check if it's a known crypto pair or contains a slash (crypto format)
    return (
      cryptoPairs.includes(upperSymbol) ||
      (symbol.includes("/") && upperSymbol.endsWith("USD"))
    );
  }

  /**
   * Normalize symbol for Alpaca API calls
   *
   * Handles different symbol format requirements for crypto vs stocks
   * and for orders vs lookups.
   *
   * @private
   * @param symbol - Symbol to normalize
   * @param forOrder - If true, use format required for orders (default: false)
   * @returns Normalized symbol for Alpaca API
   *
   * @example
   * ```typescript
   * // For crypto orders - use slash format
   * normalizeSymbolForAlpaca("BTC/USD", true) // returns "BTC/USD"
   *
   * // For stock lookups - remove slashes
   * normalizeSymbolForAlpaca("AAPL", false) // returns "AAPL"
   * normalizeSymbolForAlpaca("BTC/USD", false) // returns "BTCUSD"
   * ```
   */
  private normalizeSymbolForAlpaca(
    symbol: string,
    forOrder: boolean = false
  ): string {
    // For crypto orders, Alpaca requires the slash format (e.g., BTC/USD)
    // For stock orders and position lookups, use uppercase without slash
    if (forOrder && this.isCryptoSymbol(symbol)) {
      return this.normalizeCryptoSymbol(symbol);
    }
    return symbol.replace("/", "").toUpperCase();
  }

  /**
   * Get market data for a symbol from Alpaca
   *
   * Fetches real-time market data including price, volume, and 24-hour changes.
   * Handles both stocks and crypto with appropriate API endpoints.
   *
   * @param symbol - Stock symbol or crypto pair
   * @returns Promise resolving to market data or null if unavailable
   *
   * @example
   * ```typescript
   * const data = await aiAnalyzer.getMarketDataForSymbol("AAPL");
   * if (data) {
   *   console.log(`Price: $${data.currentPrice}`);
   *   console.log(`Change: ${data.priceChangePercent24h.toFixed(2)}%`);
   *   console.log(`Volume: ${data.volume}`);
   * }
   * ```
   *
   * @note Returns null if no valid price data is available
   * @note Handles crypto vs stock snapshot endpoints automatically
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
        const currentPrice =
          snapshot.latestTrade?.p ||
          snapshot.dailyBar?.c ||
          snapshot.prevDailyBar?.c ||
          0;

        if (!currentPrice || currentPrice <= 0) {
          log.warn("AIAnalyzer", "No valid price sources for symbol", {
            symbol,
            latestTrade: snapshot.latestTrade?.p,
            dailyBarClose: snapshot.dailyBar?.c,
            prevDailyBarClose: snapshot.prevDailyBar?.c,
          });
          return null;
        }

        const prevClose = snapshot.prevDailyBar?.c || currentPrice;
        const priceChange = currentPrice - prevClose;
        const priceChangePercent =
          prevClose > 0 ? (priceChange / prevClose) * 100 : 0;

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
      log.error("AIAnalyzer", "Failed to get market data", {
        symbol,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Analyze sentiment from news headlines
   *
   * Simple keyword-based sentiment analysis of news headlines.
   * Counts bullish vs bearish keywords to determine overall sentiment.
   *
   * @param headlines - Array of news headline strings
   * @returns Sentiment classification: "bullish", "bearish", or "neutral"
   *
   * @example
   * ```typescript
   * const headlines = [
   *   "Stock surges to record high on strong earnings",
   *   "Company announces major growth initiative"
   * ];
   * const sentiment = aiAnalyzer.analyzeSentiment(headlines);
   * console.log(sentiment); // "bullish"
   * ```
   *
   * @note This is a simple keyword-based approach
   * @note For advanced sentiment, use Hugging Face FinBERT integration
   */
  analyzeSentiment(headlines: string[]): "bullish" | "bearish" | "neutral" {
    const bullishWords = [
      "surge",
      "rally",
      "gain",
      "rise",
      "up",
      "growth",
      "positive",
      "beat",
      "record",
      "high",
    ];
    const bearishWords = [
      "drop",
      "fall",
      "decline",
      "down",
      "loss",
      "negative",
      "miss",
      "crash",
      "low",
      "sell",
    ];

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
   * Gather enrichment data from multiple optional sources
   *
   * Collects sentiment and fundamental data from various providers to enrich
   * AI decision-making. All sources are optional - returns empty arrays if
   * API keys aren't configured.
   *
   * @param symbol - Stock symbol or crypto pair to analyze
   * @param marketData - Current market data for the symbol
   * @param newsContext - Optional news context with headlines
   *
   * @returns Promise resolving to enrichment data from available sources
   *
   * @example
   * ```typescript
   * const enrichment = await aiAnalyzer.gatherEnrichmentData(
   *   "AAPL",
   *   marketData,
   *   newsContext
   * );
   *
   * if (enrichment.hasEnrichment) {
   *   console.log(`Sentiment sources: ${enrichment.sentimentData.length}`);
   *   console.log(`Fundamental sources: ${enrichment.fundamentalData.length}`);
   *
   *   enrichment.sentimentData.forEach(s => {
   *     console.log(`${s.source}: ${s.sentiment} (${s.score.toFixed(2)})`);
   *   });
   * }
   * ```
   *
   * @enrichmentSources Three primary enrichment sources:
   * 1. **GDELT** (FREE, no API key needed):
   *    - Real-time global news sentiment
   *    - Article volume spike detection
   *    - Works for both stocks and crypto
   *
   * 2. **Hugging Face FinBERT** (optional, requires API key):
   *    - Advanced AI sentiment analysis
   *    - Analyzes news headlines with financial context
   *    - Provides confidence scores
   *
   * 3. **Valyu.ai** (optional, requires API key, stocks only):
   *    - Financial ratios (P/E, debt/equity, revenue growth)
   *    - Free cash flow analysis
   *    - Dividend yield data
   *    - Insider transaction sentiment
   *
   * @note Runs all enrichment sources in parallel for performance
   * @note Gracefully handles missing API keys - logs debug message and continues
   * @note Crypto symbols skip Valyu.ai (stocks only)
   */
  async gatherEnrichmentData(
    symbol: string,
    marketData: MarketData,
    newsContext?: NewsContext
  ): Promise<{
    hasEnrichment: boolean;
    sentimentData: Array<{
      source: string;
      symbol?: string;
      sentiment: "positive" | "negative" | "neutral";
      score: number;
      confidence: number;
      headlines?: string[];
      timestamp: Date;
    }>;
    fundamentalData: Array<{
      source: string;
      symbol: string;
      peRatio?: number;
      revenueGrowth?: number;
      debtToEquity?: number;
      freeCashFlow?: number;
      dividendYield?: number;
      insiderSentiment?: "bullish" | "bearish" | "neutral";
      timestamp: Date;
    }>;
  }> {
    const sentimentData: Array<{
      source: string;
      symbol?: string;
      sentiment: "positive" | "negative" | "neutral";
      score: number;
      confidence: number;
      headlines?: string[];
      timestamp: Date;
    }> = [];
    const fundamentalData: Array<{
      source: string;
      symbol: string;
      peRatio?: number;
      revenueGrowth?: number;
      debtToEquity?: number;
      freeCashFlow?: number;
      dividendYield?: number;
      insiderSentiment?: "bullish" | "bearish" | "neutral";
      timestamp: Date;
    }> = [];

    const enrichmentPromises: Promise<void>[] = [];

    // Try Hugging Face sentiment enrichment if we have headlines
    if (
      newsContext?.headlines &&
      newsContext.headlines.length > 0 &&
      huggingface.isAvailable()
    ) {
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
                signal.sentimentScore > 0.2
                  ? "positive"
                  : signal.sentimentScore < -0.2
                    ? "negative"
                    : "neutral";
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
            log.debug("AI", `HuggingFace enrichment skipped for ${symbol}`, {
              reason: (e as Error).message,
            });
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
            ? await gdelt.getCryptoSentiment(
                symbol.replace(/USD$|USDT$|\/USD$/i, "")
              )
            : await gdelt.analyzeSymbolSentiment(symbol);

          if (gdeltSentiment && gdeltSentiment.articleCount > 0) {
            const sentiment: "positive" | "negative" | "neutral" =
              gdeltSentiment.sentiment === "bullish"
                ? "positive"
                : gdeltSentiment.sentiment === "bearish"
                  ? "negative"
                  : "neutral";

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
          log.debug("AI", `GDELT enrichment skipped for ${symbol}`, {
            reason: (e as Error).message,
          });
        }
      })()
    );

    // Try Valyu.ai comprehensive fundamentals for stocks (not crypto)
    if (!isCrypto && valyu.isAvailable()) {
      enrichmentPromises.push(
        (async () => {
          try {
            const [ratios, cashFlow, dividends, insiderData] =
              await Promise.all([
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
            log.debug("AI", `Valyu.ai enrichment skipped for ${symbol}`, {
              reason: (e as Error).message,
            });
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
   *
   * Orchestrates comprehensive market analysis by gathering multi-source data,
   * fusing intelligence, generating AI decision, and creating full transparency logs.
   *
   * This is the main entry point for AI-powered trading analysis.
   *
   * @param symbol - Stock symbol or crypto pair to analyze
   * @param strategyId - Optional strategy ID for context and tracking
   * @param traceId - Optional trace ID for request tracking (auto-generated if not provided)
   *
   * @returns Promise resolving to complete analysis package
   * @returns result.decision - AI trading decision (buy/sell/hold with confidence)
   * @returns result.marketData - Real-time market data from Alpaca
   * @returns result.fusedIntelligence - Fused data from multiple sources (if available)
   * @returns result.enhancedLog - Full transparency log of decision process
   *
   * @example
   * ```typescript
   * const analysis = await aiAnalyzer.analyzeSymbol("AAPL", "strategy-123");
   *
   * console.log(`Decision: ${analysis.decision.action}`);
   * console.log(`Confidence: ${analysis.decision.confidence}%`);
   * console.log(`Reasoning: ${analysis.decision.reasoning}`);
   *
   * if (analysis.decision.action === "buy") {
   *   console.log(`Suggested quantity: ${analysis.decision.suggestedQuantity}`);
   *   console.log(`Target price: $${analysis.decision.targetPrice}`);
   *   console.log(`Stop loss: $${analysis.decision.stopLoss}`);
   * }
   *
   * if (analysis.fusedIntelligence) {
   *   console.log(`Data quality: ${analysis.fusedIntelligence.dataQuality.completeness}%`);
   *   console.log(`Signal agreement: ${analysis.fusedIntelligence.signalAgreement}`);
   * }
   * ```
   *
   * @analysisProcess Complete analysis workflow:
   * 1. **Market Data**: Fetch real-time price, volume, change from Alpaca
   * 2. **News Context**: Gather recent headlines from NewsAPI
   * 3. **Enrichment**: Collect sentiment/fundamentals from GDELT, Hugging Face, Valyu.ai
   * 4. **Data Fusion**: Combine multi-source intelligence with consensus analysis
   * 5. **AI Decision**: Generate trading decision with GPT-4o-mini
   * 6. **Transparency Log**: Create enhanced decision log for full auditability
   * 7. **Database Record**: Store AI decision with all context
   *
   * @throws Error if market data cannot be retrieved
   *
   * @note Creates AI decision record in database with full context
   * @note Enhanced log includes all data sources, reasoning, and metadata
   */
  async analyzeSymbol(
    symbol: string,
    strategyId?: string,
    traceId?: string
  ): Promise<{
    decision: AIDecision;
    marketData: MarketData;
    fusedIntelligence?: FusedMarketIntelligence;
    enhancedLog?: EnhancedDecisionLog;
  }> {
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
      log.debug("AIAnalyzer", "Could not fetch news", {
        symbol,
        error: (e as Error).message,
      });
    }

    // Gather enrichment data from optional sources
    const enrichmentData = await this.gatherEnrichmentData(
      symbol,
      marketData,
      newsContext
    );

    // Fuse data from multiple sources if we have enrichment
    if (enrichmentData.hasEnrichment) {
      try {
        fusedIntelligence = fuseMarketData({
          symbol,
          assetType: this.isCryptoSymbol(symbol) ? "crypto" : "stock",
          marketData: [
            {
              source: "alpaca",
              symbol,
              price: marketData.currentPrice,
              priceChange: marketData.priceChange24h,
              priceChangePercent: marketData.priceChangePercent24h,
              volume: marketData.volume,
              timestamp: new Date(),
              reliability: 0.95,
            },
          ],
          sentimentData: enrichmentData.sentimentData,
          fundamentalData: enrichmentData.fundamentalData,
        });
        log.info("AI", `Fused intelligence for ${symbol}`, {
          signalAgreement: fusedIntelligence.signalAgreement,
          trendStrength: fusedIntelligence.trendStrength,
          dataQuality: fusedIntelligence.dataQuality.completeness,
        });
      } catch (e) {
        log.warn("AI", `Data fusion failed for ${symbol}`, {
          error: (e as Error).message,
        });
      }
    }

    const strategyContext = strategy
      ? {
          id: strategy.id,
          name: strategy.name,
          type: strategy.type,
          parameters: strategy.parameters
            ? JSON.parse(strategy.parameters)
            : undefined,
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
        fusedIntelligence: fusedIntelligence
          ? {
              signalAgreement: fusedIntelligence.signalAgreement,
              trendStrength: fusedIntelligence.trendStrength,
              dataQuality: fusedIntelligence.dataQuality,
              warnings: fusedIntelligence.warnings,
            }
          : undefined,
        enhancedLogId: enhancedLog.id,
      }),
    });

    return { decision, marketData, fusedIntelligence, enhancedLog };
  }

  /**
   * Link an AI decision to an executed trade
   *
   * Creates a linkage between an AI decision and the trade that resulted from it.
   * This enables tracking of which AI recommendations were actually executed.
   *
   * @param symbol - Symbol that was traded
   * @param strategyId - Optional strategy ID to match decision
   * @param tradeId - ID of the executed trade to link
   *
   * @returns Promise that resolves when link is created
   *
   * @example
   * ```typescript
   * // After executing a trade based on AI decision
   * const tradeResult = await orderExecutor.executeAlpacaTrade({ ... });
   * if (tradeResult.success && tradeResult.trade) {
   *   await aiAnalyzer.linkAiDecisionToTrade(
   *     "AAPL",
   *     "strategy-123",
   *     tradeResult.trade.id
   *   );
   * }
   * ```
   *
   * @note Only links to the most recent AI decision for the symbol/strategy
   * @note Skips if decision already has an associated trade
   * @note Errors are logged but don't throw
   */
  async linkAiDecisionToTrade(
    symbol: string,
    strategyId: string | undefined,
    tradeId: string
  ): Promise<void> {
    try {
      const latestDecision = await storage.getLatestAiDecisionForSymbol(
        symbol,
        strategyId
      );
      if (latestDecision && !latestDecision.executedTradeId) {
        await storage.updateAiDecision(latestDecision.id, {
          executedTradeId: tradeId,
        });
        log.debug("AIAnalyzer", "Linked AI decision to trade", {
          decisionId: latestDecision.id,
          tradeId,
        });
      }
    } catch (error) {
      log.error("AIAnalyzer", "Failed to link AI decision to trade", {
        error: (error as Error).message,
      });
    }
  }
}

export const aiAnalyzer = new AIAnalyzer();
