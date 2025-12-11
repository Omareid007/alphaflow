import { storage } from "../storage";
import { alpaca, type AlpacaOrder, type AlpacaPosition, type CreateOrderParams, type BracketOrderParams, type MarketStatus } from "../connectors/alpaca";
import { aiDecisionEngine, type MarketData, type AIDecision, type NewsContext } from "../ai/decision-engine";
import { newsapi } from "../connectors/newsapi";
import type { Trade, Strategy } from "@shared/schema";
import { eventBus, logger, type TradeExecutedEvent, type StrategySignalEvent, type PositionEvent } from "../orchestration";
import { safeParseFloat, formatPrice, calculatePnL } from "../utils/numeric";
import { fuseMarketData, type FusedMarketIntelligence } from "../ai/data-fusion-engine";
import { createEnhancedDecisionLog, type EnhancedDecisionLog } from "../ai/enhanced-decision-log";
import { huggingface } from "../connectors/huggingface";
import { valyu } from "../connectors/valyu";
import { log } from "../utils/logger";

export interface AlpacaTradeRequest {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  strategyId?: string;
  notes?: string;
  orderType?: "market" | "limit";
  limitPrice?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  useBracketOrder?: boolean;
  trailingStopPercent?: number;
  extendedHours?: boolean;
}

export interface TargetAllocation {
  symbol: string;
  targetPercent: number;
}

export interface CurrentAllocation {
  symbol: string;
  currentPercent: number;
  currentValue: number;
  quantity: number;
  price: number;
}

export interface RebalanceTrade {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  estimatedValue: number;
  currentPercent: number;
  targetPercent: number;
  reason: string;
}

export interface RebalancePreview {
  currentAllocations: CurrentAllocation[];
  targetAllocations: TargetAllocation[];
  proposedTrades: RebalanceTrade[];
  portfolioValue: number;
  cashAvailable: number;
  cashAfterRebalance: number;
  estimatedTradingCost: number;
}

export interface RebalanceResult {
  success: boolean;
  tradesExecuted: Array<{
    symbol: string;
    side: string;
    quantity: number;
    status: string;
    orderId?: string;
    error?: string;
  }>;
  errors: string[];
  portfolioValueBefore: number;
  portfolioValueAfter: number;
}

export interface AlpacaTradeResult {
  success: boolean;
  order?: AlpacaOrder;
  trade?: Trade;
  error?: string;
}

export interface StrategyRunState {
  strategyId: string;
  isRunning: boolean;
  lastCheck?: Date;
  lastDecision?: AIDecision;
  error?: string;
}

class AlpacaTradingEngine {
  private strategyRunners: Map<string, NodeJS.Timeout> = new Map();
  private strategyStates: Map<string, StrategyRunState> = new Map();
  private checkIntervalMs = 60000;
  private backgroundGeneratorInterval: NodeJS.Timeout | null = null;
  private backgroundGeneratorIntervalMs = 120000;
  private initialized = false;
  private autoStartStrategyId: string | null = null;

  private readonly DEFAULT_WATCHLIST = [
    "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "UNH",
    "BTC/USD", "ETH/USD", "SOL/USD"
  ];

  private normalizeSymbolForAlpaca(symbol: string, forOrder: boolean = false): string {
    // For crypto orders, Alpaca requires the slash format (e.g., BTC/USD)
    // For stock orders and position lookups, use uppercase without slash
    if (forOrder && this.isCryptoSymbol(symbol)) {
      return this.normalizeCryptoSymbol(symbol);
    }
    return symbol.replace("/", "").toUpperCase();
  }

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

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    
    try {
      const strategies = await storage.getStrategies();
      
      let autoPilotStrategy = strategies.find(s => s.name === "Auto-Pilot Strategy");
      
      if (!autoPilotStrategy) {
        console.log("Creating default Auto-Pilot Strategy...");
        autoPilotStrategy = await storage.createStrategy({
          name: "Auto-Pilot Strategy",
          type: "momentum",
          description: "Default AI-powered trading strategy that automatically analyzes market opportunities",
          isActive: true,
          assets: this.DEFAULT_WATCHLIST,
          parameters: JSON.stringify({
            riskLevel: "medium",
            maxPositionSize: 0.05,
            confidenceThreshold: 0.6,
            autoExecute: true
          }),
        });
        console.log(`Created Auto-Pilot Strategy with ID: ${autoPilotStrategy.id}`);
      }
      
      this.autoStartStrategyId = autoPilotStrategy.id;
      
      this.startBackgroundAIGenerator();
      
      await storage.updateAgentStatus({ 
        isRunning: true, 
        lastHeartbeat: new Date() 
      });
      
      console.log("Trading agent initialized and active by default");
      
      setTimeout(async () => {
        try {
          const isConnected = await this.isAlpacaConnected();
          if (isConnected) {
            console.log("Alpaca connected, auto-starting all active strategies...");
            const allStrategies = await storage.getStrategies();
            const activeStrategies = allStrategies.filter(s => s.isActive);
            
            for (const strategy of activeStrategies) {
              if (!this.strategyRunners.has(strategy.id)) {
                console.log(`Auto-starting strategy: ${strategy.name}`);
                const result = await this.startStrategy(strategy.id);
                if (result.success) {
                  console.log(`Strategy "${strategy.name}" started successfully`);
                } else {
                  console.log(`Could not start strategy "${strategy.name}": ${result.error}`);
                }
              }
            }
            
            if (activeStrategies.length === 0 && this.autoStartStrategyId) {
              console.log("No active strategies found, starting Auto-Pilot Strategy...");
              const result = await this.startStrategy(this.autoStartStrategyId);
              if (result.success) {
                console.log("Auto-Pilot Strategy started successfully");
              }
            }
          } else {
            console.log("Alpaca not connected - running in AI suggestion mode only");
          }
        } catch (err) {
          console.error("Error during auto-start:", err);
        }
      }, 5000);
      
    } catch (error) {
      console.error("Failed to initialize trading engine:", error);
    }
  }

  private startBackgroundAIGenerator(): void {
    if (this.backgroundGeneratorInterval) {
      clearInterval(this.backgroundGeneratorInterval);
    }

    console.log("Starting background AI suggestion generator...");
    
    this.generateBackgroundAISuggestions();
    
    this.backgroundGeneratorInterval = setInterval(
      () => this.generateBackgroundAISuggestions(),
      this.backgroundGeneratorIntervalMs
    );
  }

  private async generateBackgroundAISuggestions(): Promise<void> {
    try {
      const agentStatus = await storage.getAgentStatus();
      if (agentStatus?.killSwitchActive) {
        console.log("Kill switch active - skipping background AI generation");
        return;
      }

      console.log("Generating background AI suggestions...");
      
      const symbolsToAnalyze = this.DEFAULT_WATCHLIST.slice(0, 5);
      
      for (const symbol of symbolsToAnalyze) {
        try {
          await this.analyzeSymbol(symbol);
          console.log(`Generated AI suggestion for ${symbol}`);
        } catch (err) {
          console.log(`Could not analyze ${symbol}:`, (err as Error).message);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      await storage.updateAgentStatus({ lastHeartbeat: new Date() });
    } catch (error) {
      console.error("Background AI generation error:", error);
    }
  }

  stopBackgroundGenerator(): void {
    if (this.backgroundGeneratorInterval) {
      clearInterval(this.backgroundGeneratorInterval);
      this.backgroundGeneratorInterval = null;
      console.log("Background AI generator stopped");
    }
  }

  async isAlpacaConnected(): Promise<boolean> {
    try {
      const status = alpaca.getConnectionStatus();
      if (!status.hasCredentials) return false;
      await alpaca.getAccount();
      return true;
    } catch {
      return false;
    }
  }

  async getAlpacaAccount() {
    return await alpaca.getAccount();
  }

  async getAlpacaPositions(): Promise<AlpacaPosition[]> {
    return await alpaca.getPositions();
  }

  async getMarketStatus(): Promise<MarketStatus> {
    return await alpaca.getMarketStatus();
  }

  async getClock() {
    return await alpaca.getClock();
  }

  async canTradeExtendedHours(symbol: string): Promise<{ allowed: boolean; reason?: string }> {
    if (this.isCryptoSymbol(symbol)) {
      return { allowed: false, reason: "Extended hours trading is not available for crypto" };
    }
    
    const marketStatus = await this.getMarketStatus();
    if (marketStatus.session === "regular") {
      return { allowed: true };
    }
    
    if (marketStatus.isExtendedHours) {
      return { allowed: true };
    }
    
    return { allowed: false, reason: "Market is closed and not in extended hours session (4AM-8PM ET on weekdays)" };
  }

  async executeAlpacaTrade(request: AlpacaTradeRequest): Promise<AlpacaTradeResult> {
    try {
      const { 
        symbol, side, quantity, strategyId, notes, 
        orderType = "market", limitPrice,
        stopLossPrice, takeProfitPrice, useBracketOrder, trailingStopPercent,
        extendedHours = false
      } = request;

      if (quantity <= 0) {
        return { success: false, error: "Quantity must be greater than 0" };
      }

      const riskCheck = await this.checkRiskLimits(symbol, side, quantity);
      if (!riskCheck.allowed) {
        return { success: false, error: riskCheck.reason };
      }

      const alpacaSymbol = this.normalizeSymbolForAlpaca(symbol, true);
      const isCrypto = this.isCryptoSymbol(symbol);
      let order: AlpacaOrder;

      if (extendedHours && isCrypto) {
        return { success: false, error: "Extended hours trading is not available for crypto" };
      }

      if (extendedHours && orderType !== "limit") {
        return { success: false, error: "Extended hours trading requires limit orders only" };
      }

      if (extendedHours && !limitPrice) {
        return { success: false, error: "Extended hours trading requires a limit price" };
      }

      if (extendedHours && !Number.isInteger(quantity)) {
        return { success: false, error: "Extended hours trading requires whole share quantities (no fractional shares)" };
      }

      const shouldUseBracketOrder = useBracketOrder && 
        side === "buy" && 
        stopLossPrice && 
        takeProfitPrice && 
        !isCrypto &&
        !extendedHours;

      if (shouldUseBracketOrder) {
        const bracketParams: BracketOrderParams = {
          symbol: alpacaSymbol,
          qty: quantity.toString(),
          side,
          type: orderType === "limit" ? "limit" : "market",
          time_in_force: "gtc",
          take_profit_price: takeProfitPrice.toFixed(2),
          stop_loss_price: stopLossPrice.toFixed(2),
        };

        if (orderType === "limit" && limitPrice) {
          bracketParams.limit_price = limitPrice.toString();
        }

        console.log(`[Trading] Creating bracket order for ${symbol}: Entry=${limitPrice || 'market'}, TP=$${takeProfitPrice.toFixed(2)}, SL=$${stopLossPrice.toFixed(2)}`);
        order = await alpaca.createBracketOrder(bracketParams);
      } else if (trailingStopPercent && side === "sell" && !isCrypto && !extendedHours) {
        console.log(`[Trading] Creating trailing stop order for ${symbol}: trail=${trailingStopPercent}%`);
        order = await alpaca.createTrailingStopOrder({
          symbol: alpacaSymbol,
          qty: quantity.toString(),
          side,
          trail_percent: trailingStopPercent,
          time_in_force: "gtc",
        });
      } else if (extendedHours) {
        const orderParams: CreateOrderParams = {
          symbol: alpacaSymbol,
          qty: quantity.toString(),
          side,
          type: "limit",
          time_in_force: "day",
          limit_price: limitPrice!.toString(),
          extended_hours: true,
        };

        console.log(`[Trading] Creating extended hours limit order for ${symbol}: ${side} ${quantity} @ $${limitPrice}`);
        order = await alpaca.createOrder(orderParams);
      } else {
        const orderParams: CreateOrderParams = {
          symbol: alpacaSymbol,
          qty: quantity.toString(),
          side,
          type: orderType,
          time_in_force: isCrypto ? "gtc" : "day",
        };

        if (orderType === "limit" && limitPrice) {
          orderParams.limit_price = limitPrice.toString();
        }

        order = await alpaca.createOrder(orderParams);
      }

      const filledPrice = order.filled_avg_price
        ? safeParseFloat(order.filled_avg_price)
        : limitPrice || 0;

      let tradeNotes = notes || `Alpaca Order ID: ${order.id}`;
      if (shouldUseBracketOrder) {
        tradeNotes += ` | Bracket: SL=$${stopLossPrice?.toFixed(2)}, TP=$${takeProfitPrice?.toFixed(2)}`;
      }

      const trade = await storage.createTrade({
        symbol: symbol.toUpperCase(),
        side,
        quantity: quantity.toString(),
        price: filledPrice.toString(),
        strategyId: strategyId || null,
        status: order.status,
        notes: tradeNotes,
        pnl: null,
      });

      await this.updateAgentStats();

      const tradeEvent: TradeExecutedEvent = {
        tradeId: trade.id,
        orderId: order.id,
        symbol: symbol.toUpperCase(),
        side,
        quantity,
        price: filledPrice,
        status: order.status,
        strategyId,
      };
      eventBus.emit("trade:executed", tradeEvent, "alpaca-trading-engine");
      logger.trade(`Executed ${side} ${quantity} ${symbol} @ $${filledPrice}`, { orderId: order.id, status: order.status });

      return { success: true, order, trade };
    } catch (error) {
      console.error("Alpaca trade execution error:", error);
      eventBus.emit("trade:error", { message: (error as Error).message }, "alpaca-trading-engine");
      return { success: false, error: (error as Error).message };
    }
  }

  async closeAlpacaPosition(symbol: string, strategyId?: string): Promise<AlpacaTradeResult> {
    try {
      // For crypto, use slash format; for stocks, use standard format
      const alpacaSymbol = this.isCryptoSymbol(symbol) 
        ? this.normalizeCryptoSymbol(symbol) 
        : this.normalizeSymbolForAlpaca(symbol);
      let position: AlpacaPosition | null = null;
      try {
        position = await alpaca.getPosition(alpacaSymbol);
      } catch (posError) {
        const errorMsg = (posError as Error).message?.toLowerCase() || "";
        if (errorMsg.includes("404") || errorMsg.includes("not found") || errorMsg.includes("position does not exist")) {
          return { success: true, error: `Position for ${symbol} already closed or does not exist` };
        }
        throw posError;
      }

      if (!position) {
        return { success: true, error: `No position found for ${symbol} - may already be closed` };
      }

      let order: AlpacaOrder;
      try {
        order = await alpaca.closePosition(alpacaSymbol);
      } catch (closeError) {
        const errorMsg = (closeError as Error).message?.toLowerCase() || "";
        if (errorMsg.includes("404") || errorMsg.includes("not found") || errorMsg.includes("position does not exist")) {
          return { success: true, error: `Position for ${symbol} was already closed` };
        }
        throw closeError;
      }

      const quantity = safeParseFloat(position.qty);
      const entryPrice = safeParseFloat(position.avg_entry_price);
      const exitPrice = safeParseFloat(order.filled_avg_price || position.current_price);
      const isShort = position.side === "short";
      const pnl = calculatePnL(entryPrice, exitPrice, quantity, isShort ? "short" : "long");
      // Closing a long = sell; closing a short = buy
      const tradeSide = isShort ? "buy" : "sell";

      const trade = await storage.createTrade({
        symbol: symbol.toUpperCase(),
        side: tradeSide,
        quantity: quantity.toString(),
        price: exitPrice.toString(),
        strategyId: strategyId || null,
        status: "completed",
        notes: `Closed Alpaca ${position.side} position. Order ID: ${order.id}`,
        pnl: pnl.toString(),
      });

      await this.updateAgentStats();

      const positionEvent: PositionEvent = {
        symbol: symbol.toUpperCase(),
        quantity: 0,
        entryPrice,
        currentPrice: exitPrice,
        unrealizedPnl: 0,
        side: isShort ? "short" : "long",
      };
      eventBus.emit("position:closed", positionEvent, "alpaca-trading-engine");
      logger.trade(`Closed ${position.side} position ${symbol}`, { pnl, exitPrice });

      return { success: true, order, trade };
    } catch (error) {
      console.error("Close Alpaca position error:", error);
      eventBus.emit("trade:error", { message: (error as Error).message }, "alpaca-trading-engine");
      return { success: false, error: (error as Error).message };
    }
  }

  async analyzeSymbol(
    symbol: string,
    strategyId?: string
  ): Promise<{ decision: AIDecision; marketData: MarketData; fusedIntelligence?: FusedMarketIntelligence; enhancedLog?: EnhancedDecisionLog }> {
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
      console.log(`Could not fetch news for ${symbol}:`, e);
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
      strategyContext
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
   * Gather enrichment data from optional sources (Hugging Face, Valyu.ai)
   * Returns empty arrays if API keys aren't configured
   */
  private async gatherEnrichmentData(
    symbol: string,
    marketData: MarketData,
    newsContext?: NewsContext
  ): Promise<{
    hasEnrichment: boolean;
    sentimentData: Array<{ source: string; symbol?: string; sentiment: "positive" | "negative" | "neutral"; score: number; confidence: number; timestamp: Date }>;
    fundamentalData: Array<{ source: string; symbol: string; peRatio?: number; revenueGrowth?: number; timestamp: Date }>;
  }> {
    const sentimentData: Array<{ source: string; symbol?: string; sentiment: "positive" | "negative" | "neutral"; score: number; confidence: number; timestamp: Date }> = [];
    const fundamentalData: Array<{ source: string; symbol: string; peRatio?: number; revenueGrowth?: number; timestamp: Date }> = [];

    // Try Hugging Face sentiment enrichment if we have headlines
    if (newsContext?.headlines && newsContext.headlines.length > 0 && huggingface.isAvailable()) {
      try {
        const signal = await huggingface.generateEnrichmentSignal(
          symbol,
          newsContext.headlines,
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
    }

    // Try Valyu.ai fundamentals for stocks (not crypto)
    if (!this.isCryptoSymbol(symbol) && valyu.isAvailable()) {
      try {
        const ratios = await valyu.getFinancialRatios(symbol);
        if (ratios) {
          fundamentalData.push({
            source: "valyu",
            symbol,
            peRatio: ratios.peRatio,
            revenueGrowth: ratios.revenueGrowth,
            timestamp: new Date(),
          });
        }
      } catch (e) {
        log.debug("AI", `Valyu.ai enrichment skipped for ${symbol}`, { reason: (e as Error).message });
      }
    }

    return {
      hasEnrichment: sentimentData.length > 0 || fundamentalData.length > 0,
      sentimentData,
      fundamentalData,
    };
  }

  async analyzeAndExecute(
    symbol: string,
    strategyId?: string
  ): Promise<{ decision: AIDecision; tradeResult?: AlpacaTradeResult }> {
    const { decision, marketData } = await this.analyzeSymbol(symbol, strategyId);

    const agentStatus = await storage.getAgentStatus();
    if (!agentStatus?.isRunning) {
      return { decision };
    }

    if (decision.action === "hold") {
      return { decision };
    }

    if (decision.confidence < 0.6) {
      return { decision };
    }

    if (!marketData.currentPrice || marketData.currentPrice <= 0 || !Number.isFinite(marketData.currentPrice)) {
      console.warn(`Skipping trade for ${symbol}: invalid price data (currentPrice=${marketData.currentPrice})`);
      this.strategyStates.set(strategyId || symbol, {
        strategyId: strategyId || symbol,
        isRunning: true,
        lastCheck: new Date(),
        error: `Invalid price data for ${symbol} - market data unavailable`,
      });
      return { decision };
    }

    const account = await alpaca.getAccount();
    const buyingPower = safeParseFloat(account.buying_power);
    if (!Number.isFinite(buyingPower) || buyingPower <= 0) {
      console.warn(`Skipping trade for ${symbol}: invalid buying power (${buyingPower})`);
      return { decision };
    }

    const positionSizePercent = decision.suggestedQuantity || 0.05;
    const tradeValue = buyingPower * positionSizePercent;
    const quantity = Math.floor(tradeValue / marketData.currentPrice);

    if (!Number.isFinite(quantity) || quantity < 1) {
      return { decision };
    }

    const notes = `AI Decision: ${decision.action.toUpperCase()} with ${(decision.confidence * 100).toFixed(0)}% confidence. Risk: ${decision.riskLevel}. ${decision.reasoning}`;

    if (decision.action === "sell") {
      try {
        // For crypto, use slash format; for stocks, use standard format
        const alpacaSellSymbol = this.isCryptoSymbol(symbol) 
          ? this.normalizeCryptoSymbol(symbol) 
          : this.normalizeSymbolForAlpaca(symbol);
        const position = await alpaca.getPosition(alpacaSellSymbol);
        if (!position) {
          return { decision };
        }
        const tradeResult = await this.closeAlpacaPosition(symbol, strategyId);
        
        // Link AI decision to executed trade
        if (tradeResult.success && tradeResult.trade) {
          await this.linkAiDecisionToTrade(symbol, strategyId, tradeResult.trade.id);
        }
        
        return { decision, tradeResult };
      } catch (posError) {
        const errorMsg = (posError as Error).message?.toLowerCase() || "";
        if (errorMsg.includes("404") || errorMsg.includes("not found") || errorMsg.includes("position does not exist")) {
          return { decision };
        }
        throw posError;
      }
    }

    const stopLossPrice = decision.stopLoss || (marketData.currentPrice * 0.95);
    const takeProfitPrice = decision.targetPrice || (marketData.currentPrice * 1.10);
    const useBracketOrder = !this.isCryptoSymbol(symbol);

    const tradeResult = await this.executeAlpacaTrade({
      symbol,
      side: "buy",
      quantity,
      strategyId,
      notes,
      stopLossPrice,
      takeProfitPrice,
      useBracketOrder,
    });

    // Link AI decision to executed trade
    if (tradeResult.success && tradeResult.trade) {
      await this.linkAiDecisionToTrade(symbol, strategyId, tradeResult.trade.id);
    }

    return { decision, tradeResult };
  }

  private async linkAiDecisionToTrade(symbol: string, strategyId: string | undefined, tradeId: string): Promise<void> {
    try {
      const latestDecision = await storage.getLatestAiDecisionForSymbol(symbol, strategyId);
      if (latestDecision && !latestDecision.executedTradeId) {
        await storage.updateAiDecision(latestDecision.id, { executedTradeId: tradeId });
        console.log(`Linked AI decision ${latestDecision.id} to trade ${tradeId}`);
      }
    } catch (error) {
      console.error(`Failed to link AI decision to trade: ${error}`);
    }
  }

  async startStrategy(strategyId: string): Promise<{ success: boolean; error?: string }> {
    const strategy = await storage.getStrategy(strategyId);
    if (!strategy) {
      return { success: false, error: "Strategy not found" };
    }

    if (!strategy.assets || strategy.assets.length === 0) {
      return { success: false, error: "Strategy has no assets configured" };
    }

    const isConnected = await this.isAlpacaConnected();
    if (!isConnected) {
      return { success: false, error: "Alpaca API not connected" };
    }

    if (this.strategyRunners.has(strategyId)) {
      return { success: false, error: "Strategy is already running" };
    }

    await storage.toggleStrategy(strategyId, true);
    await storage.updateAgentStatus({ isRunning: true, lastHeartbeat: new Date() });

    const runStrategy = async () => {
      try {
        const currentStrategy = await storage.getStrategy(strategyId);
        if (!currentStrategy || !currentStrategy.isActive) {
          this.stopStrategy(strategyId);
          return;
        }

        const agentStatus = await storage.getAgentStatus();
        if (agentStatus?.killSwitchActive) {
          this.stopStrategy(strategyId);
          return;
        }

        const assets = currentStrategy.assets || [];
        let lastSuccessfulDecision: AIDecision | undefined;
        let lastError: string | undefined;
        
        for (const asset of assets) {
          try {
            const result = await this.analyzeAndExecute(asset, strategyId);
            lastSuccessfulDecision = result.decision;
          } catch (assetError) {
            const errorMsg = (assetError as Error).message || String(assetError);
            console.error(`Error analyzing ${asset}:`, errorMsg);
            lastError = `${asset}: ${errorMsg}`;
          }
        }

        this.strategyStates.set(strategyId, {
          strategyId,
          isRunning: true,
          lastCheck: new Date(),
          lastDecision: lastSuccessfulDecision,
          error: lastError,
        });

        await storage.updateAgentStatus({ lastHeartbeat: new Date() });
      } catch (error) {
        console.error(`Strategy ${strategyId} run error:`, error);
        this.strategyStates.set(strategyId, {
          strategyId,
          isRunning: true,
          lastCheck: new Date(),
          error: (error as Error).message,
        });
      }
    };

    await runStrategy();

    const interval = setInterval(runStrategy, this.checkIntervalMs);
    this.strategyRunners.set(strategyId, interval);
    this.strategyStates.set(strategyId, {
      strategyId,
      isRunning: true,
      lastCheck: new Date(),
    });

    eventBus.emit("strategy:started", { strategyId, strategyName: strategy.name }, "alpaca-trading-engine");
    logger.strategy(strategy.name, "Started", { assets: strategy.assets });

    return { success: true };
  }

  async stopStrategy(strategyId: string): Promise<{ success: boolean; error?: string }> {
    const interval = this.strategyRunners.get(strategyId);
    if (interval) {
      clearInterval(interval);
      this.strategyRunners.delete(strategyId);
    }

    const strategy = await storage.getStrategy(strategyId);
    await storage.toggleStrategy(strategyId, false);
    this.strategyStates.set(strategyId, {
      strategyId,
      isRunning: false,
      lastCheck: new Date(),
    });

    const runningStrategies = await storage.getStrategies();
    const anyActive = runningStrategies.some((s) => s.isActive);
    if (!anyActive) {
      await storage.updateAgentStatus({ isRunning: false });
    }

    eventBus.emit("strategy:stopped", { strategyId, strategyName: strategy?.name || strategyId }, "alpaca-trading-engine");
    logger.strategy(strategy?.name || strategyId, "Stopped");

    return { success: true };
  }

  async stopAllStrategies(): Promise<void> {
    for (const [strategyId] of this.strategyRunners) {
      await this.stopStrategy(strategyId);
    }
    this.stopBackgroundGenerator();
    await storage.updateAgentStatus({ isRunning: false });
  }

  async resumeAgent(): Promise<void> {
    console.log("Resuming trading agent...");
    this.startBackgroundAIGenerator();
    await storage.updateAgentStatus({ 
      isRunning: true, 
      lastHeartbeat: new Date() 
    });
    
    if (this.autoStartStrategyId) {
      const isConnected = await this.isAlpacaConnected();
      if (isConnected) {
        await this.startStrategy(this.autoStartStrategyId);
      }
    }
  }

  getStrategyState(strategyId: string): StrategyRunState | undefined {
    return this.strategyStates.get(strategyId);
  }

  getAllStrategyStates(): StrategyRunState[] {
    return Array.from(this.strategyStates.values());
  }

  getRunningStrategiesCount(): number {
    return this.strategyRunners.size;
  }

  private async getMarketDataForSymbol(symbol: string): Promise<MarketData | null> {
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
          console.warn(`No valid price sources for ${symbol}: latestTrade=${snapshot.latestTrade?.p}, dailyBar.c=${snapshot.dailyBar?.c}, prevDailyBar.c=${snapshot.prevDailyBar?.c}`);
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

      console.warn(`No snapshot data returned for ${symbol}`);
      return null;
    } catch (error) {
      console.error(`Failed to get market data for ${symbol}:`, error);
      return null;
    }
  }

  private analyzeSentiment(headlines: string[]): "bullish" | "bearish" | "neutral" {
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

  private async checkRiskLimits(
    symbol: string,
    side: "buy" | "sell",
    quantity: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const status = await storage.getAgentStatus();

    if (status?.killSwitchActive) {
      return { allowed: false, reason: "Kill switch is active - trading halted" };
    }

    if (side === "buy") {
      try {
        const account = await alpaca.getAccount();
        const positions = await alpaca.getPositions();
        const maxPositions = status?.maxPositionsCount ?? 10;

        if (positions.length >= maxPositions) {
          return { allowed: false, reason: `Maximum positions limit reached (${maxPositions})` };
        }

        const riskSymbol = this.normalizeSymbolForAlpaca(symbol);
        const snapshot = await alpaca.getSnapshots([riskSymbol]);
        const snapshotData = snapshot[riskSymbol];
        const price = snapshotData?.latestTrade?.p || snapshotData?.dailyBar?.c || snapshotData?.prevDailyBar?.c || 0;
        
        if (!price || price <= 0 || !Number.isFinite(price)) {
          console.warn(`Risk check: invalid price for ${symbol} (price=${price})`);
          return { allowed: false, reason: `Cannot verify trade value - no valid price data for ${symbol}` };
        }
        
        const tradeValue = quantity * price;
        if (!Number.isFinite(tradeValue)) {
          return { allowed: false, reason: `Invalid trade value calculation for ${symbol}` };
        }

        const buyingPower = safeParseFloat(account.buying_power);
        const rawPercent = status?.maxPositionSizePercent;
        const parsedPercent = rawPercent ? safeParseFloat(rawPercent) : NaN;
        const maxPositionSizePercent = (isNaN(parsedPercent) || parsedPercent <= 0) ? 10 : parsedPercent;
        const maxPositionSizeDecimal = maxPositionSizePercent / 100;
        const maxTradeValue = buyingPower * maxPositionSizeDecimal;

        if (tradeValue > maxTradeValue) {
          return {
            allowed: false,
            reason: `Trade exceeds max position size (${maxPositionSizePercent.toFixed(0)}% = $${maxTradeValue.toFixed(2)})`,
          };
        }
      } catch (error) {
        console.error("Risk check error:", error);
        return { allowed: false, reason: "Could not verify risk limits" };
      }
    }

    return { allowed: true };
  }

  private async updateAgentStats(): Promise<void> {
    try {
      const trades = await storage.getTrades(1000);
      const closingTrades = trades.filter((t) => t.pnl !== null && t.pnl !== "0");
      const totalRealizedPnl = closingTrades.reduce(
        (sum, t) => sum + safeParseFloat(t.pnl, 0),
        0
      );
      const winningTrades = closingTrades.filter((t) => safeParseFloat(t.pnl, 0) > 0);
      const winRate = closingTrades.length > 0
        ? (winningTrades.length / closingTrades.length) * 100
        : 0;

      await storage.updateAgentStatus({
        totalTrades: trades.length,
        totalPnl: totalRealizedPnl.toString(),
        winRate: winRate.toString(),
        lastHeartbeat: new Date(),
      });
    } catch (error) {
      console.error("Failed to update agent stats:", error);
    }
  }

  getStatus(): {
    alpacaConnected: boolean;
    runningStrategies: number;
    strategyStates: StrategyRunState[];
  } {
    const states = this.getAllStrategyStates();
    return {
      alpacaConnected: alpaca.getConnectionStatus().hasCredentials,
      runningStrategies: this.strategyRunners.size,
      strategyStates: states,
    };
  }

  async cancelStaleOrders(maxAgeMinutes: number = 60): Promise<{
    cancelled: string[];
    errors: Array<{ orderId: string; error: string }>;
  }> {
    const cancelled: string[] = [];
    const errors: Array<{ orderId: string; error: string }> = [];

    try {
      const openOrders = await alpaca.getOrders("open", 100);
      const now = new Date();
      const maxAgeMs = maxAgeMinutes * 60 * 1000;

      for (const order of openOrders) {
        const createdAt = new Date(order.created_at);
        const ageMs = now.getTime() - createdAt.getTime();

        if (ageMs > maxAgeMs && order.status !== "filled" && order.status !== "partially_filled") {
          try {
            await alpaca.cancelOrder(order.id);
            cancelled.push(order.id);
            console.log(`[Reconciliation] Cancelled stale order ${order.id} for ${order.symbol} (age: ${Math.round(ageMs / 60000)} minutes)`);
          } catch (err) {
            errors.push({ orderId: order.id, error: (err as Error).message });
          }
        }
      }

      console.log(`[Reconciliation] Cancelled ${cancelled.length} stale orders, ${errors.length} errors`);
    } catch (err) {
      console.error("[Reconciliation] Failed to cancel stale orders:", err);
      throw err;
    }

    return { cancelled, errors };
  }

  async cancelAllOpenOrders(): Promise<{
    cancelled: number;
    ordersCancelledBefore: number;
    remainingAfter: number;
    error?: string;
  }> {
    try {
      const ordersBefore = await alpaca.getOrders("open", 100);
      const countBefore = ordersBefore.length;
      
      if (countBefore === 0) {
        console.log("[Reconciliation] No open orders to cancel");
        return { cancelled: 0, ordersCancelledBefore: 0, remainingAfter: 0 };
      }
      
      await alpaca.cancelAllOrders();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      const ordersAfter = await alpaca.getOrders("open", 100);
      const countAfter = ordersAfter.length;
      const actualCancelled = countBefore - countAfter;
      
      console.log(`[Reconciliation] Cancelled ${actualCancelled} orders (before: ${countBefore}, remaining: ${countAfter})`);
      return { 
        cancelled: actualCancelled, 
        ordersCancelledBefore: countBefore, 
        remainingAfter: countAfter 
      };
    } catch (err) {
      console.error("[Reconciliation] Failed to cancel all orders:", err);
      return { cancelled: 0, ordersCancelledBefore: 0, remainingAfter: 0, error: (err as Error).message };
    }
  }

  async reconcilePositions(): Promise<{
    alpacaPositions: Array<{ symbol: string; qty: string; side: string; marketValue: string; unrealizedPnl: string }>;
    dbPositions: Array<{ id: string; symbol: string; quantity: string }>;
    discrepancies: Array<{ symbol: string; alpacaQty: string; dbQty: string; action: string }>;
    synced: boolean;
  }> {
    const alpacaPositions = await alpaca.getPositions();
    const dbPositions = await storage.getPositions();

    const alpacaMap = new Map(
      alpacaPositions.map(p => [p.symbol.toUpperCase(), p])
    );
    const dbMap = new Map(
      dbPositions.map(p => [p.symbol.toUpperCase(), p])
    );

    const discrepancies: Array<{ symbol: string; alpacaQty: string; dbQty: string; action: string }> = [];

    for (const [symbol, alpacaPos] of alpacaMap) {
      const dbPos = dbMap.get(symbol);
      if (!dbPos) {
        discrepancies.push({
          symbol,
          alpacaQty: alpacaPos.qty,
          dbQty: "0",
          action: "create_in_db",
        });
      } else if (alpacaPos.qty !== dbPos.quantity) {
        discrepancies.push({
          symbol,
          alpacaQty: alpacaPos.qty,
          dbQty: dbPos.quantity,
          action: "update_db_quantity",
        });
      }
    }

    for (const [symbol, dbPos] of dbMap) {
      if (!alpacaMap.has(symbol)) {
        discrepancies.push({
          symbol,
          alpacaQty: "0",
          dbQty: dbPos.quantity,
          action: "remove_from_db",
        });
      }
    }

    console.log(`[Reconciliation] Found ${discrepancies.length} discrepancies between Alpaca and DB`);

    return {
      alpacaPositions: alpacaPositions.map(p => ({
        symbol: p.symbol,
        qty: p.qty,
        side: p.side,
        marketValue: p.market_value,
        unrealizedPnl: p.unrealized_pl,
      })),
      dbPositions: dbPositions.map(p => ({
        id: p.id,
        symbol: p.symbol,
        quantity: p.quantity,
      })),
      discrepancies,
      synced: discrepancies.length === 0,
    };
  }

  async syncPositionsFromAlpaca(): Promise<{
    created: string[];
    updated: string[];
    removed: string[];
    errors: Array<{ symbol: string; error: string }>;
  }> {
    const created: string[] = [];
    const updated: string[] = [];
    const removed: string[] = [];
    const errors: Array<{ symbol: string; error: string }> = [];

    try {
      const alpacaPositions = await alpaca.getPositions();
      const dbPositions = await storage.getPositions();

      const alpacaMap = new Map(
        alpacaPositions.map(p => [p.symbol.toUpperCase(), p])
      );
      const dbMap = new Map(
        dbPositions.map(p => [p.symbol.toUpperCase(), p])
      );

      for (const [symbol, alpacaPos] of alpacaMap) {
        try {
          const dbPos = dbMap.get(symbol);
          if (!dbPos) {
            await storage.createPosition({
              symbol: alpacaPos.symbol,
              side: alpacaPos.side,
              quantity: alpacaPos.qty,
              entryPrice: alpacaPos.avg_entry_price,
              currentPrice: alpacaPos.current_price,
              unrealizedPnl: alpacaPos.unrealized_pl,
              strategyId: null,
            });
            created.push(symbol);
            console.log(`[Sync] Created position for ${symbol}`);
          } else {
            await storage.updatePosition(dbPos.id, {
              quantity: alpacaPos.qty,
              currentPrice: alpacaPos.current_price,
              unrealizedPnl: alpacaPos.unrealized_pl,
            });
            updated.push(symbol);
          }
        } catch (err) {
          errors.push({ symbol, error: (err as Error).message });
        }
      }

      for (const [symbol, dbPos] of dbMap) {
        if (!alpacaMap.has(symbol)) {
          try {
            await storage.deletePosition(dbPos.id);
            removed.push(symbol);
            console.log(`[Sync] Removed stale position for ${symbol}`);
          } catch (err) {
            errors.push({ symbol, error: (err as Error).message });
          }
        }
      }

      console.log(`[Sync] Completed: ${created.length} created, ${updated.length} updated, ${removed.length} removed`);
    } catch (err) {
      console.error("[Sync] Failed to sync positions:", err);
      throw err;
    }

    return { created, updated, removed, errors };
  }

  async closeAllPositions(): Promise<{
    closed: Array<{ symbol: string; qty: string; pnl: string }>;
    tradesCreated: number;
    errors: Array<{ symbol: string; error: string }>;
  }> {
    const closed: Array<{ symbol: string; qty: string; pnl: string }> = [];
    const errors: Array<{ symbol: string; error: string }> = [];
    let tradesCreated = 0;

    try {
      const positions = await alpaca.getPositions();
      
      for (const position of positions) {
        try {
          const qty = safeParseFloat(position.qty);
          const entryPrice = safeParseFloat(position.avg_entry_price);
          const currentPrice = safeParseFloat(position.current_price);
          const isShort = position.side === "short";
          
          const order = await alpaca.closePosition(position.symbol);
          
          const exitPrice = order.filled_avg_price 
            ? safeParseFloat(order.filled_avg_price) 
            : currentPrice;
          const realizedPnl = calculatePnL(entryPrice, exitPrice, qty, isShort ? "short" : "long");
          // Closing a long = sell; closing a short = buy
          const tradeSide = isShort ? "buy" : "sell";
          
          await storage.createTrade({
            symbol: position.symbol,
            side: tradeSide,
            quantity: position.qty,
            price: exitPrice.toString(),
            strategyId: null,
            status: "completed",
            notes: `Closed all positions (${position.side}). Order ID: ${order.id}. Entry: $${entryPrice.toFixed(2)}, Exit: $${exitPrice.toFixed(2)}`,
            pnl: realizedPnl.toString(),
          });
          tradesCreated++;
          
          closed.push({ 
            symbol: position.symbol, 
            qty: position.qty, 
            pnl: realizedPnl.toFixed(2) 
          });
          console.log(`[Reconciliation] Closed ${position.side} position for ${position.symbol}: qty=${qty}, PnL=$${realizedPnl.toFixed(2)}`);
        } catch (err) {
          errors.push({ symbol: position.symbol, error: (err as Error).message });
        }
      }

      await this.syncPositionsFromAlpaca();
      await this.updateAgentStats();
      console.log(`[Reconciliation] Closed ${closed.length} positions, created ${tradesCreated} trades, ${errors.length} errors`);
    } catch (err) {
      console.error("[Reconciliation] Failed to close all positions:", err);
      throw err;
    }

    return { closed, tradesCreated, errors };
  }

  async getOpenOrders(): Promise<AlpacaOrder[]> {
    return await alpaca.getOrders("open", 100);
  }

  async getOrderDetails(orderId: string): Promise<AlpacaOrder> {
    return await alpaca.getOrder(orderId);
  }

  async getCurrentAllocations(): Promise<{
    allocations: CurrentAllocation[];
    portfolioValue: number;
    cashBalance: number;
  }> {
    const account = await alpaca.getAccount();
    const positions = await alpaca.getPositions();
    
    const cashBalance = safeParseFloat(account.cash);
    let positionsValue = 0;
    
    const allocations: CurrentAllocation[] = [];
    
    for (const position of positions) {
      const marketValue = safeParseFloat(position.market_value);
      const quantity = safeParseFloat(position.qty);
      const price = safeParseFloat(position.current_price);
      
      positionsValue += marketValue;
      
      allocations.push({
        symbol: position.symbol.toUpperCase(),
        currentPercent: 0,
        currentValue: marketValue,
        quantity,
        price,
      });
    }
    
    const portfolioValue = cashBalance + positionsValue;
    
    for (const allocation of allocations) {
      allocation.currentPercent = portfolioValue > 0 
        ? (allocation.currentValue / portfolioValue) * 100 
        : 0;
    }
    
    allocations.push({
      symbol: "CASH",
      currentPercent: portfolioValue > 0 ? (cashBalance / portfolioValue) * 100 : 100,
      currentValue: cashBalance,
      quantity: cashBalance,
      price: 1,
    });
    
    return { allocations, portfolioValue, cashBalance };
  }

  async previewRebalance(targetAllocations: TargetAllocation[]): Promise<RebalancePreview> {
    const { allocations: currentAllocations, portfolioValue, cashBalance } = 
      await this.getCurrentAllocations();
    
    const totalTargetPercent = targetAllocations.reduce((sum, t) => sum + t.targetPercent, 0);
    if (totalTargetPercent > 100) {
      throw new Error(`Target allocations sum to ${totalTargetPercent}%, must be <= 100%`);
    }
    
    const proposedTrades: RebalanceTrade[] = [];
    let estimatedCashChange = 0;
    
    const currentMap = new Map(
      currentAllocations
        .filter(a => a.symbol !== "CASH")
        .map(a => [a.symbol, a])
    );
    
    for (const target of targetAllocations) {
      if (target.symbol === "CASH") continue;
      
      const symbol = target.symbol.toUpperCase();
      const targetValue = (target.targetPercent / 100) * portfolioValue;
      const current = currentMap.get(symbol);
      const currentValue = current?.currentValue || 0;
      const currentPercent = current?.currentPercent || 0;
      const currentPrice = current?.price || 0;
      
      const valueDiff = targetValue - currentValue;
      
      if (Math.abs(valueDiff) < 10) continue;
      
      if (valueDiff > 0 && currentPrice > 0) {
        const buyQuantity = Math.floor(valueDiff / currentPrice);
        if (buyQuantity >= 1) {
          proposedTrades.push({
            symbol,
            side: "buy",
            quantity: buyQuantity,
            estimatedValue: buyQuantity * currentPrice,
            currentPercent,
            targetPercent: target.targetPercent,
            reason: `Increase allocation from ${currentPercent.toFixed(1)}% to ${target.targetPercent}%`,
          });
          estimatedCashChange -= buyQuantity * currentPrice;
        }
      } else if (valueDiff < 0 && currentPrice > 0 && current) {
        const sellQuantity = Math.min(
          Math.floor(Math.abs(valueDiff) / currentPrice),
          current.quantity
        );
        if (sellQuantity >= 1) {
          proposedTrades.push({
            symbol,
            side: "sell",
            quantity: sellQuantity,
            estimatedValue: sellQuantity * currentPrice,
            currentPercent,
            targetPercent: target.targetPercent,
            reason: `Decrease allocation from ${currentPercent.toFixed(1)}% to ${target.targetPercent}%`,
          });
          estimatedCashChange += sellQuantity * currentPrice;
        }
      }
    }
    
    for (const [symbol, current] of currentMap) {
      const hasTarget = targetAllocations.some(
        t => t.symbol.toUpperCase() === symbol
      );
      if (!hasTarget && current.quantity > 0) {
        proposedTrades.push({
          symbol,
          side: "sell",
          quantity: current.quantity,
          estimatedValue: current.currentValue,
          currentPercent: current.currentPercent,
          targetPercent: 0,
          reason: `Close position - not in target allocation`,
        });
        estimatedCashChange += current.currentValue;
      }
    }
    
    proposedTrades.sort((a, b) => {
      if (a.side === "sell" && b.side === "buy") return -1;
      if (a.side === "buy" && b.side === "sell") return 1;
      return b.estimatedValue - a.estimatedValue;
    });
    
    const estimatedTradingCost = proposedTrades.length * 0.01;
    
    return {
      currentAllocations,
      targetAllocations,
      proposedTrades,
      portfolioValue,
      cashAvailable: cashBalance,
      cashAfterRebalance: cashBalance + estimatedCashChange,
      estimatedTradingCost,
    };
  }

  async executeRebalance(
    targetAllocations: TargetAllocation[],
    dryRun: boolean = false
  ): Promise<RebalanceResult> {
    const preview = await this.previewRebalance(targetAllocations);
    const portfolioValueBefore = safeParseFloat(preview.portfolioValue);
    
    if (dryRun) {
      return {
        success: true,
        tradesExecuted: preview.proposedTrades.map(t => ({
          symbol: t.symbol,
          side: t.side,
          quantity: Math.floor(safeParseFloat(t.quantity)),
          status: "dry_run",
        })),
        errors: [],
        portfolioValueBefore,
        portfolioValueAfter: portfolioValueBefore,
      };
    }
    
    const tradesExecuted: RebalanceResult["tradesExecuted"] = [];
    const errors: string[] = [];
    
    const sellTrades = preview.proposedTrades.filter(t => t.side === "sell");
    
    for (const trade of sellTrades) {
      try {
        const quantity = Math.floor(safeParseFloat(trade.quantity));
        if (quantity < 1) continue;
        
        const result = await this.executeAlpacaTrade({
          symbol: trade.symbol,
          side: "sell",
          quantity,
          notes: `Rebalance: ${trade.reason}`,
        });
        
        tradesExecuted.push({
          symbol: trade.symbol,
          side: "sell",
          quantity,
          status: result.success ? "executed" : "failed",
          orderId: result.order?.id,
          error: result.error,
        });
        
        if (!result.success) {
          errors.push(`${trade.symbol} sell failed: ${result.error}`);
        }
      } catch (err) {
        const errorMsg = (err as Error).message;
        errors.push(`${trade.symbol} sell error: ${errorMsg}`);
        tradesExecuted.push({
          symbol: trade.symbol,
          side: "sell",
          quantity: Math.floor(safeParseFloat(trade.quantity)),
          status: "error",
          error: errorMsg,
        });
      }
    }
    
    if (sellTrades.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    const { allocations: refreshedAllocations, portfolioValue: refreshedPortfolioValue, cashBalance: availableCash } = 
      await this.getCurrentAllocations();
    
    const refreshedPositionMap = new Map(
      refreshedAllocations
        .filter(a => a.symbol !== "CASH")
        .map(a => [a.symbol, a])
    );
    
    for (const target of targetAllocations) {
      if (target.symbol === "CASH") continue;
      
      const symbol = target.symbol.toUpperCase();
      const targetValue = (safeParseFloat(target.targetPercent) / 100) * refreshedPortfolioValue;
      const current = refreshedPositionMap.get(symbol);
      const currentValue = current ? safeParseFloat(current.currentValue) : 0;
      const currentPrice = current ? safeParseFloat(current.price) : 0;
      
      const valueDiff = targetValue - currentValue;
      
      if (valueDiff <= 10 || currentPrice <= 0) continue;
      
      const maxBuyValue = Math.min(valueDiff, availableCash * 0.95);
      const buyQuantity = Math.floor(maxBuyValue / currentPrice);
      
      if (buyQuantity < 1) continue;
      
      try {
        const result = await this.executeAlpacaTrade({
          symbol,
          side: "buy",
          quantity: buyQuantity,
          notes: `Rebalance: Increase allocation to ${target.targetPercent}%`,
        });
        
        tradesExecuted.push({
          symbol,
          side: "buy",
          quantity: buyQuantity,
          status: result.success ? "executed" : "failed",
          orderId: result.order?.id,
          error: result.error,
        });
        
        if (!result.success) {
          errors.push(`${symbol} buy failed: ${result.error}`);
        }
      } catch (err) {
        const errorMsg = (err as Error).message;
        errors.push(`${symbol} buy error: ${errorMsg}`);
        tradesExecuted.push({
          symbol,
          side: "buy",
          quantity: buyQuantity,
          status: "error",
          error: errorMsg,
        });
      }
    }
    
    await this.syncPositionsFromAlpaca();
    await this.updateAgentStats();
    
    const finalAccount = await alpaca.getAccount();
    const finalPositions = await alpaca.getPositions();
    const cashAfter = safeParseFloat(finalAccount.cash);
    const positionsValueAfter = finalPositions.reduce(
      (sum, p) => sum + safeParseFloat(p.market_value), 0
    );
    const portfolioValueAfter = cashAfter + positionsValueAfter;
    
    logger.trade(`Rebalance complete: ${tradesExecuted.length} trades, ${errors.length} errors`, {
      tradesExecuted: tradesExecuted.length,
      errors: errors.length,
      portfolioValueBefore,
      portfolioValueAfter,
    });
    
    eventBus.emit("portfolio:rebalanced", {
      tradesExecuted: tradesExecuted.length,
      errors: errors.length,
      portfolioValueBefore,
      portfolioValueAfter,
    }, "alpaca-trading-engine");
    
    return {
      success: errors.length === 0,
      tradesExecuted,
      errors,
      portfolioValueBefore,
      portfolioValueAfter,
    };
  }

  async getRebalanceSuggestions(): Promise<{
    currentAllocations: CurrentAllocation[];
    suggestedAllocations: TargetAllocation[];
    reasoning: string;
  }> {
    const { allocations: currentAllocations, portfolioValue } = 
      await this.getCurrentAllocations();
    
    const nonCashAllocations = currentAllocations.filter(a => a.symbol !== "CASH");
    
    if (nonCashAllocations.length === 0) {
      return {
        currentAllocations,
        suggestedAllocations: this.DEFAULT_WATCHLIST.slice(0, 5).map((symbol, i) => ({
          symbol,
          targetPercent: 15,
        })),
        reasoning: "No current positions. Suggesting equal-weight allocation across top 5 watchlist stocks (15% each, 25% cash reserve).",
      };
    }
    
    const symbolCount = nonCashAllocations.length;
    const equalWeight = Math.floor(80 / symbolCount);
    
    const suggestedAllocations: TargetAllocation[] = nonCashAllocations.map(a => ({
      symbol: a.symbol,
      targetPercent: equalWeight,
    }));
    
    const allocatedPercent = suggestedAllocations.reduce((sum, a) => sum + a.targetPercent, 0);
    if (allocatedPercent < 80 && suggestedAllocations.length > 0) {
      suggestedAllocations[0].targetPercent += (80 - allocatedPercent);
    }
    
    return {
      currentAllocations,
      suggestedAllocations,
      reasoning: `Suggesting equal-weight rebalancing across ${symbolCount} positions (~${equalWeight}% each) with 20% cash reserve for risk management.`,
    };
  }
}

export const alpacaTradingEngine = new AlpacaTradingEngine();
