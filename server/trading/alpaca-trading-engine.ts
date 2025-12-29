import { storage } from "../storage";
import { alpaca, type AlpacaOrder, type AlpacaPosition, type CreateOrderParams, type BracketOrderParams, type MarketStatus } from "../connectors/alpaca";
import { aiDecisionEngine, type MarketData, type AIDecision, type NewsContext } from "../ai/decision-engine";
import { generateTraceId } from "../ai/llmGateway";
import { newsapi } from "../connectors/newsapi";
import type { Trade, Strategy } from "@shared/schema";
import { eventBus, logger, type TradeExecutedEvent, type StrategySignalEvent, type PositionEvent } from "../orchestration";
import { safeParseFloat } from "../utils/numeric";
import { toDecimal, percentChange, priceWithBuffer, calculateWholeShares, formatPrice as formatMoneyPrice, positionValue, roundPrice, calculatePnL } from "../utils/money";
import { fuseMarketData, type FusedMarketIntelligence } from "../ai/data-fusion-engine";
import { createEnhancedDecisionLog, type EnhancedDecisionLog } from "../ai/enhanced-decision-log";
import { huggingface } from "../connectors/huggingface";
import { valyu } from "../connectors/valyu";
import { gdelt } from "../connectors/gdelt";
import { log } from "../utils/logger";
import { cacheQuickQuote, cacheTradability, cacheAccountSnapshot, getOrderCacheStats } from "../lib/order-execution-cache";
import { performanceTracker } from "../lib/performance-metrics";
import { tradabilityService } from "../services/tradability-service";

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
  /** 
   * SECURITY: Only the work queue processor should set this to true.
   * When orchestratorControlEnabled is true, trades are only allowed if this flag is true.
   * This prevents bypass attacks via notes manipulation.
   */
  authorizedByOrchestrator?: boolean;
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
  private strategyRunners: Map<string, ReturnType<typeof setInterval>> = new Map();
  private strategyStates: Map<string, StrategyRunState> = new Map();
  private checkIntervalMs = 60000;
  private backgroundGeneratorInterval: ReturnType<typeof setInterval> | null = null;
  private backgroundGeneratorIntervalMs = 120000;
  private initialized = false;
  private autoStartStrategyId: string | null = null;
  private orchestratorControlEnabled: boolean = true;

  enableOrchestratorControl(): void {
    this.orchestratorControlEnabled = true;
    log.info("AlpacaTradingEngine", "Orchestrator control ENABLED - autonomous trading disabled");
  }

  disableOrchestratorControl(): void {
    this.orchestratorControlEnabled = false;
    log.info("AlpacaTradingEngine", "Orchestrator control DISABLED - autonomous trading allowed");
  }

  isOrchestratorControlEnabled(): boolean {
    return this.orchestratorControlEnabled;
  }

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
        log.info("AlpacaTradingEngine", "Creating default Auto-Pilot Strategy...");
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
        log.info("AlpacaTradingEngine", "Created Auto-Pilot Strategy", { strategyId: autoPilotStrategy.id });
      }
      
      this.autoStartStrategyId = autoPilotStrategy.id;
      
      this.startBackgroundAIGenerator();
      
      await storage.updateAgentStatus({ 
        isRunning: true, 
        lastHeartbeat: new Date() 
      });
      
      log.info("AlpacaTradingEngine", "Trading agent initialized and active by default");

      this.warmupCaches().catch((err: Error) =>
        log.debug("AlpacaTradingEngine", "Cache warmup skipped", { error: err.message })
      );
      
      setTimeout(async () => {
        try {
          const isConnected = await this.isAlpacaConnected();
          if (isConnected) {
            log.info("AlpacaTradingEngine", "Alpaca connected, auto-starting all active strategies...");
            const allStrategies = await storage.getStrategies();
            const activeStrategies = allStrategies.filter(s => s.isActive);

            for (const strategy of activeStrategies) {
              if (!this.strategyRunners.has(strategy.id)) {
                log.info("AlpacaTradingEngine", "Auto-starting strategy", { strategyName: strategy.name });
                const result = await this.startStrategy(strategy.id);
                if (result.success) {
                  log.info("AlpacaTradingEngine", "Strategy started successfully", { strategyName: strategy.name });
                } else {
                  log.warn("AlpacaTradingEngine", "Could not start strategy", { strategyName: strategy.name, error: result.error });
                }
              }
            }

            if (activeStrategies.length === 0 && this.autoStartStrategyId) {
              log.info("AlpacaTradingEngine", "No active strategies found, starting Auto-Pilot Strategy...");
              const result = await this.startStrategy(this.autoStartStrategyId);
              if (result.success) {
                log.info("AlpacaTradingEngine", "Auto-Pilot Strategy started successfully");
              }
            }
          } else {
            log.info("AlpacaTradingEngine", "Alpaca not connected - running in AI suggestion mode only");
          }
        } catch (err) {
          log.error("AlpacaTradingEngine", "Error during auto-start", { error: (err as Error).message });
        }
      }, 5000);
      
    } catch (error) {
      log.error("AlpacaTradingEngine", "Failed to initialize trading engine", { error: (error as Error).message });
    }
  }

  private async warmupCaches(): Promise<void> {
    log.info("Cache", "Warming up order execution caches...");
    const startTime = Date.now();
    
    try {
      const account = await alpaca.getAccount();
      cacheAccountSnapshot({
        buyingPower: parseFloat(account.buying_power),
        cash: parseFloat(account.cash),
        equity: parseFloat(account.equity),
        timestamp: Date.now(),
      });
      
      const symbols = this.DEFAULT_WATCHLIST.slice(0, 10);
      const snapshots = await alpaca.getSnapshots(symbols);
      
      for (const symbol of symbols) {
        const snapshot = snapshots[symbol];
        if (snapshot?.latestTrade) {
          cacheQuickQuote({
            symbol,
            price: snapshot.latestTrade.p,
            bid: snapshot.latestQuote?.bp || snapshot.latestTrade.p,
            ask: snapshot.latestQuote?.ap || snapshot.latestTrade.p,
            spread: (snapshot.latestQuote?.ap || 0) - (snapshot.latestQuote?.bp || 0),
            timestamp: Date.now(),
          });
        }
      }
      
      const assets = await alpaca.getAssets();
      const relevantAssets = assets.filter(a => symbols.includes(a.symbol));
      for (const asset of relevantAssets) {
        cacheTradability({
          symbol: asset.symbol,
          tradable: asset.tradable,
          fractionable: asset.fractionable,
          shortable: asset.shortable,
          marginable: asset.marginable,
          timestamp: Date.now(),
        });
      }
      
      const elapsed = Date.now() - startTime;
      const stats = getOrderCacheStats();
      log.info("Cache", "Warmup complete", { elapsedMs: elapsed, quotes: stats.quotes, tradability: stats.tradability });
    } catch (error) {
      log.warn("Cache", "Warmup failed", { error: (error as Error).message });
    }
  }

  private startBackgroundAIGenerator(): void {
    if (this.backgroundGeneratorInterval) {
      clearInterval(this.backgroundGeneratorInterval);
    }

    log.info("AlpacaTradingEngine", "Starting background AI suggestion generator...");
    
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
        log.info("AlpacaTradingEngine", "Kill switch active - skipping background AI generation");
        return;
      }

      const batchTraceId = generateTraceId();
      log.info("AlpacaTradingEngine", "Generating background AI suggestions...", { batchTraceId });
      
      const symbolsToAnalyze = this.DEFAULT_WATCHLIST.slice(0, 5);
      
      for (const symbol of symbolsToAnalyze) {
        try {
          await this.analyzeSymbol(symbol, undefined, batchTraceId);
          log.debug("AlpacaTradingEngine", "Generated AI suggestion", { symbol });
        } catch (err) {
          log.debug("AlpacaTradingEngine", "Could not analyze symbol", { symbol, error: (err as Error).message });
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      await storage.updateAgentStatus({ lastHeartbeat: new Date() });
    } catch (error) {
      log.error("AlpacaTradingEngine", "Background AI generation error", { error: (error as Error).message });
    }
  }

  stopBackgroundGenerator(): void {
    if (this.backgroundGeneratorInterval) {
      clearInterval(this.backgroundGeneratorInterval);
      this.backgroundGeneratorInterval = null;
      log.info("AlpacaTradingEngine", "Background AI generator stopped");
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

    // Allow trading during pre-market (4AM-9:30AM) and after-hours (4PM-8PM)
    if (marketStatus.isExtendedHours ||
        marketStatus.session === "pre-market" ||
        marketStatus.session === "after-hours") {
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
        log.warn("Trading", `ORDER_BLOCKED: ${symbol} - Quantity must be greater than 0`, {
          symbol,
          side,
          quantity,
          reason: "INVALID_QUANTITY"
        });
        return { success: false, error: "Quantity must be greater than 0" };
      }

      // SECURITY: Orchestrator control check - only allow trades authorized by the orchestrator/work queue
      // This cannot be bypassed by manipulating notes strings
      if (this.orchestratorControlEnabled && !request.authorizedByOrchestrator) {
        log.warn("Trading", `ORDER_BLOCKED: ${symbol} - Orchestrator control active`, {
          symbol,
          side,
          quantity,
          reason: "ORCHESTRATOR_CONTROL_ACTIVE",
          orchestratorControlEnabled: this.orchestratorControlEnabled,
          authorizedByOrchestrator: request.authorizedByOrchestrator
        });
        return { success: false, error: "Orchestrator control active - direct trade execution blocked. Trades must go through the work queue." };
      }

      // LOSS PROTECTION: Block direct sell orders at a loss unless it's a stop-loss
      if (side === "sell") {
        const alpacaSymbolForCheck = this.normalizeSymbolForAlpaca(symbol, true);
        try {
          const position = await alpaca.getPosition(alpacaSymbolForCheck);
          if (position) {
            const entryPrice = safeParseFloat(position.avg_entry_price);
            const currentPrice = safeParseFloat(position.current_price);
            const isAtLoss = currentPrice < entryPrice;
            // Allow if notes indicate stop-loss or emergency
            const isStopLossOrEmergency = notes?.toLowerCase().includes('stop-loss') || 
                                           notes?.toLowerCase().includes('emergency') ||
                                           notes?.toLowerCase().includes('stop loss');
            if (isAtLoss && !isStopLossOrEmergency) {
              // Use Decimal.js for precise percentage calculation
              const lossPercentDecimal = percentChange(currentPrice, entryPrice).abs();
              const lossPercent = formatMoneyPrice(lossPercentDecimal, 2);
              log.warn("Trading", `ORDER_BLOCKED: ${symbol} - Loss protection active`, {
                symbol,
                side,
                quantity,
                reason: "LOSS_PROTECTION_ACTIVE",
                entryPrice,
                currentPrice,
                lossPercent: lossPercentDecimal.toNumber(),
                isStopLossOrEmergency
              });
              return {
                success: false,
                error: `Position at ${lossPercent}% loss - holding until stop-loss triggers or price recovers`
              };
            }
          }
        } catch (posError) {
          // Position not found is okay, proceed with the trade
        }
      }

      const riskCheck = await this.checkRiskLimits(symbol, side, quantity);
      if (!riskCheck.allowed) {
        log.warn("Trading", `ORDER_BLOCKED: ${symbol} - Risk limit exceeded`, {
          symbol,
          side,
          quantity,
          reason: "RISK_LIMIT_EXCEEDED",
          riskCheckReason: riskCheck.reason
        });
        return { success: false, error: riskCheck.reason };
      }

      const tradabilityCheck = await tradabilityService.validateSymbolTradable(symbol);
      if (!tradabilityCheck.tradable) {
        log.warn("Trading", `ORDER_BLOCKED: ${symbol} - Symbol not tradable`, {
          symbol,
          side,
          quantity,
          reason: "SYMBOL_NOT_TRADABLE",
          tradabilityReason: tradabilityCheck.reason
        });
        return { success: false, error: `Symbol ${symbol} is not tradable: ${tradabilityCheck.reason || 'Not found in broker universe'}` };
      }

      const alpacaSymbol = this.normalizeSymbolForAlpaca(symbol, true);
      const isCrypto = this.isCryptoSymbol(symbol);
      let order: AlpacaOrder;

      if (extendedHours && isCrypto) {
        log.warn("Trading", `ORDER_BLOCKED: ${symbol} - Extended hours not available for crypto`, {
          symbol, side, quantity, reason: "EXTENDED_HOURS_CRYPTO_NOT_SUPPORTED"
        });
        return { success: false, error: "Extended hours trading is not available for crypto" };
      }

      // FIXED: Extended hours allows both limit AND stop_limit orders per Alpaca API docs
      if (extendedHours && !["limit", "stop_limit"].includes(orderType)) {
        log.warn("Trading", `ORDER_BLOCKED: ${symbol} - Extended hours requires limit or stop_limit orders`, {
          symbol, side, quantity, orderType, reason: "EXTENDED_HOURS_REQUIRES_LIMIT_OR_STOP_LIMIT"
        });
        return { success: false, error: "Extended hours trading requires limit or stop_limit orders only" };
      }

      if (extendedHours && !limitPrice) {
        log.warn("Trading", `ORDER_BLOCKED: ${symbol} - Extended hours requires limit price`, {
          symbol, side, quantity, reason: "EXTENDED_HOURS_REQUIRES_LIMIT_PRICE"
        });
        return { success: false, error: "Extended hours trading requires a limit price" };
      }

      if (extendedHours && !Number.isInteger(quantity)) {
        log.warn("Trading", `ORDER_BLOCKED: ${symbol} - Extended hours requires whole shares`, {
          symbol, side, quantity, reason: "EXTENDED_HOURS_REQUIRES_WHOLE_SHARES"
        });
        return { success: false, error: "Extended hours trading requires whole share quantities (no fractional shares)" };
      }

      const shouldUseBracketOrder = useBracketOrder && 
        side === "buy" && 
        stopLossPrice && 
        takeProfitPrice && 
        !isCrypto &&
        !extendedHours;

      if (shouldUseBracketOrder) {
        // CRITICAL FIX: Bracket orders MUST use time_in_force: "day" per Alpaca API requirements
        // Using "gtc" will result in HTTP 422 rejection from the API
        const bracketParams: BracketOrderParams = {
          symbol: alpacaSymbol,
          qty: quantity.toString(),
          side,
          type: orderType === "limit" ? "limit" : "market",
          time_in_force: "day",  // FIXED: Was "gtc" which causes 422 rejection
          take_profit_price: takeProfitPrice.toFixed(2),
          stop_loss_price: stopLossPrice.toFixed(2),
        };

        if (orderType === "limit" && limitPrice) {
          bracketParams.limit_price = limitPrice.toString();
        }

        logger.info("Trading", `Creating bracket order for ${symbol}: Entry=${limitPrice || 'market'}, TP=$${takeProfitPrice.toFixed(2)}, SL=$${stopLossPrice.toFixed(2)}, TIF=day`);
        order = await alpaca.createBracketOrder(bracketParams);
        logger.info("Trading", `Bracket order submitted for ${symbol}`, { orderId: order.id, status: order.status });
      } else if (trailingStopPercent && side === "sell" && !isCrypto && !extendedHours) {
        log.info("Trading", "Creating trailing stop order", { symbol, trailingStopPercent });
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

        log.info("Trading", "Creating extended hours limit order", { symbol, side, quantity, limitPrice });
        order = await alpaca.createOrder(orderParams);
      } else {
        // CRITICAL FIX: Market orders CANNOT use GTC time_in_force
        // Market orders must use: day, ioc, fok, opg, or cls
        // For crypto with limit orders, GTC is valid; for market orders, use "day"
        const effectiveTif = (orderType === "market")
          ? "day"  // Market orders cannot be GTC
          : (isCrypto ? "gtc" : "day");  // Limit orders can use GTC for crypto

        const orderParams: CreateOrderParams = {
          symbol: alpacaSymbol,
          qty: quantity.toString(),
          side,
          type: orderType,
          time_in_force: effectiveTif,
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

      // AUTOMATED STOP-LOSS: Create stop-loss order after successful buy
      if (side === "buy" && order.status === "filled" && !shouldUseBracketOrder && !isCrypto && !extendedHours) {
        try {
          // Calculate stop-loss price (2% below entry for risk management)
          const entryPrice = filledPrice || limitPrice || 0;
          const stopLossPrice = entryPrice * 0.98; // 2% stop-loss

          logger.info("Trading", `Creating automated stop-loss for ${symbol}`, {
            entryPrice,
            stopLossPrice: stopLossPrice.toFixed(2),
            quantity,
          });

          // Create stop-loss order
          const stopLossOrder = await alpaca.createOrder({
            symbol: alpacaSymbol,
            qty: quantity.toString(),
            side: "sell",
            type: "stop",
            stop_price: stopLossPrice.toFixed(2),
            time_in_force: "gtc",
          });

          // Store stop-loss relationship in trade notes
          await storage.updateTrade(trade.id, {
            notes: `${tradeNotes} | Stop-Loss: Order ${stopLossOrder.id} @ $${stopLossPrice.toFixed(2)}`,
          });

          logger.info("Trading", `Automated stop-loss created for ${symbol}`, {
            stopLossOrderId: stopLossOrder.id,
            stopLossPrice: stopLossPrice.toFixed(2),
            tradeId: trade.id,
          });
        } catch (stopLossError) {
          // Log error but don't fail the main trade
          logger.error("Trading", `Failed to create automated stop-loss for ${symbol}`, {
            error: (stopLossError as Error).message,
            tradeId: trade.id,
          });
        }
      }

      return { success: true, order, trade };
    } catch (error) {
      const errorMsg = (error as Error).message;
      logger.error("Trading", `Trade execution FAILED for ${request.symbol}: ${errorMsg}`, { 
        symbol: request.symbol, 
        side: request.side, 
        quantity: request.quantity,
        orderType: request.orderType,
        useBracketOrder: request.useBracketOrder,
        error: errorMsg 
      });
      eventBus.emit("trade:error", { 
        symbol: request.symbol, 
        side: request.side, 
        quantity: request.quantity,
        message: errorMsg,
        orderType: request.orderType,
        useBracketOrder: request.useBracketOrder
      }, "alpaca-trading-engine");
      return { success: false, error: errorMsg };
    }
  }

  async closeAlpacaPosition(
    symbol: string, 
    strategyId?: string,
    options: { 
      isStopLossTriggered?: boolean; 
      isEmergencyStop?: boolean;
      /** SECURITY: Only the work queue processor should set this to true */
      authorizedByOrchestrator?: boolean;
    } = {}
  ): Promise<AlpacaTradeResult> {
    try {
      // SECURITY: Orchestrator control check - only allow position closes authorized by orchestrator/work queue
      // Exception: Emergency stops and stop-loss triggers are always allowed for safety
      if (this.orchestratorControlEnabled && !options.authorizedByOrchestrator && !options.isEmergencyStop) {
        log.warn("AlpacaTradingEngine", "Position close blocked - orchestrator has control", { symbol });
        return { success: false, error: "Orchestrator control active - direct position close blocked. Must go through work queue or be an emergency stop." };
      }

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

      // LOSS PROTECTION: Don't close positions at a loss unless stop-loss or emergency stop triggered
      const entryPrice = safeParseFloat(position.avg_entry_price);
      const currentPrice = safeParseFloat(position.current_price);
      const isAtLoss = currentPrice < entryPrice;
      const isProtectedClose = options.isStopLossTriggered || options.isEmergencyStop;
      
      if (isAtLoss && !isProtectedClose) {
        // Use Decimal.js for precise percentage calculation
        const lossPercentDecimal = percentChange(currentPrice, entryPrice).abs();
        const lossPercent = formatMoneyPrice(lossPercentDecimal, 2);
        log.warn("LossProtection", "Blocking close at loss - waiting for stop-loss or price recovery", { symbol, lossPercent: lossPercentDecimal.toNumber() });
        return {
          success: false,
          error: `Position at ${lossPercent}% loss - holding until stop-loss triggers or price recovers`
        };
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
      log.error("AlpacaTradingEngine", "Close Alpaca position error", { symbol, error: (error as Error).message });
      eventBus.emit("trade:error", { message: (error as Error).message }, "alpaca-trading-engine");
      return { success: false, error: (error as Error).message };
    }
  }

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
      log.debug("AlpacaTradingEngine", "Could not fetch news", { symbol, error: (e as Error).message });
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
   * Gather enrichment data from optional sources (Hugging Face, Valyu.ai, GDELT)
   * Returns empty arrays if API keys aren't configured
   */
  private async gatherEnrichmentData(
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

  async analyzeAndExecute(
    symbol: string,
    strategyId?: string,
    traceId?: string
  ): Promise<{ decision: AIDecision; tradeResult?: AlpacaTradeResult }> {
    const effectiveTraceId = traceId || generateTraceId();
    const { decision, marketData } = await this.analyzeSymbol(symbol, strategyId, effectiveTraceId);

    if (this.orchestratorControlEnabled) {
      log.info("AlpacaTradingEngine", "Analysis complete - orchestrator has control, skipping autonomous execution", {
        symbol,
        action: decision.action,
        confidence: `${(decision.confidence * 100).toFixed(0)}%`
      });
      return { decision };
    }

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
      log.warn("AlpacaTradingEngine", "Skipping trade: invalid price data", { symbol, currentPrice: marketData.currentPrice });
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
      log.warn("AlpacaTradingEngine", "Skipping trade: invalid buying power", { symbol, buyingPower });
      return { decision };
    }

    // OLD CONSERVATIVE POSITION SIZE (commented for rollback):
    // const positionSizePercent = decision.suggestedQuantity || 0.05;

    // AGGRESSIVE POSITION SIZE - Increased from 5% to 10% for larger positions
    const positionSizePercent = decision.suggestedQuantity || 0.10;  // AGGRESSIVE: Default 10% position size
    // Use Decimal.js for precise position sizing calculation
    const tradeValue = toDecimal(buyingPower).times(positionSizePercent);
    const quantity = calculateWholeShares(tradeValue, marketData.currentPrice).toNumber();

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
    
    // Check for existing open orders for this symbol (wash trade prevention)
    // If there are any sell orders (from bracket orders), skip the buy to avoid wash trade error
    try {
      const alpacaSymbolCheck = this.isCryptoSymbol(symbol)
        ? this.normalizeCryptoSymbol(symbol)
        : this.normalizeSymbolForAlpaca(symbol);
      const openOrders = await alpaca.getOrders("open");
      const symbolSellOrders = openOrders.filter(
        o => o.symbol === alpacaSymbolCheck && o.side === "sell"
      );
      if (symbolSellOrders.length > 0) {
        log.info("Trading", "Skipping buy: existing sell orders would trigger wash trade", { symbol, pendingSellOrders: symbolSellOrders.length });
        return { decision };
      }
    } catch (err) {
      log.warn("Trading", "Could not check open orders, proceeding with caution", { symbol, error: (err as Error).message });
    }
    
    // Check if we're in extended hours and need to use limit orders
    const marketStatus = await this.getMarketStatus();
    const isExtendedHoursSession = marketStatus.isExtendedHours && !marketStatus.isOpen;
    const isCrypto = this.isCryptoSymbol(symbol);
    
    // During extended hours: use limit orders, no bracket orders
    // During regular hours: use market orders with brackets
    const useBracketOrder = !isCrypto && !isExtendedHoursSession;
    const useExtendedHours = isExtendedHoursSession && !isCrypto;
    
    // For extended hours, set limit price slightly above current for buys (0.5% buffer)
    // Note: This function only handles BUY orders (side is hardcoded below)
    // SELL orders go through closeAlpacaPosition() which uses Alpaca's closePosition API
    // Use Decimal.js for precise price buffer calculation, rounded to 2 decimals
    const limitPrice = useExtendedHours
      ? priceWithBuffer(marketData.currentPrice, 0.005, 1).toDecimalPlaces(2).toNumber()
      : undefined;

    const tradeResult = await this.executeAlpacaTrade({
      symbol,
      side: "buy",
      quantity,
      strategyId,
      notes,
      stopLossPrice: useBracketOrder ? stopLossPrice : undefined,
      takeProfitPrice: useBracketOrder ? takeProfitPrice : undefined,
      useBracketOrder,
      extendedHours: useExtendedHours,
      orderType: useExtendedHours ? "limit" : "market",
      limitPrice,
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
        log.debug("AlpacaTradingEngine", "Linked AI decision to trade", { decisionId: latestDecision.id, tradeId });
      }
    } catch (error) {
      log.error("AlpacaTradingEngine", "Failed to link AI decision to trade", { error: (error as Error).message });
    }
  }

  async startStrategy(strategyId: string): Promise<{ success: boolean; error?: string }> {
    const strategy = await storage.getStrategy(strategyId);
    if (!strategy) {
      return { success: false, error: "Strategy not found" };
    }

    if (!strategy.assets || strategy.assets.length === 0) {
      return {
        success: false,
        error: "Strategy has no assets configured. Please add at least one symbol/asset to trade before starting the strategy."
      };
    }

    const isConnected = await this.isAlpacaConnected();
    if (!isConnected) {
      return { success: false, error: "Alpaca API not connected" };
    }

    const agentStatus = await storage.getAgentStatus();
    if (agentStatus?.killSwitchActive) {
      return { success: false, error: "Kill switch is active - trading disabled" };
    }

    if (this.strategyRunners.has(strategyId)) {
      return { success: false, error: "Strategy is already running" };
    }

    if (this.orchestratorControlEnabled) {
      log.info("AlpacaTradingEngine", "Strategy start skipped - orchestrator has control", { strategyId });
      return { success: false, error: "Orchestrator has control - autonomous strategy execution disabled. Use orchestrator for trade execution." };
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
        const runTraceId = generateTraceId();
        
        for (const asset of assets) {
          try {
            const result = await this.analyzeAndExecute(asset, strategyId, runTraceId);
            lastSuccessfulDecision = result.decision;
          } catch (assetError) {
            const errorMsg = (assetError as Error).message || String(assetError);
            log.error("AlpacaTradingEngine", "Error analyzing asset", { asset, error: errorMsg });
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
        log.error("AlpacaTradingEngine", "Strategy run error", { strategyId, error: (error as Error).message });
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
    log.info("AlpacaTradingEngine", "Resuming trading agent...");
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
          log.warn("AlpacaTradingEngine", "No valid price sources for symbol", {
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

      log.warn("AlpacaTradingEngine", "No snapshot data returned", { symbol });
      return null;
    } catch (error) {
      log.error("AlpacaTradingEngine", "Failed to get market data", { symbol, error: (error as Error).message });
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
          log.warn("AlpacaTradingEngine", "Risk check: invalid price", { symbol, price });
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
        log.error("AlpacaTradingEngine", "Risk check error", { error: (error as Error).message });
        return { allowed: false, reason: "Could not verify risk limits" };
      }
    }

    return { allowed: true };
  }

  private async updateAgentStats(): Promise<void> {
    try {
      const trades = await storage.getTrades(undefined, 1000);
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
      log.error("AlpacaTradingEngine", "Failed to update agent stats", { error: (error as Error).message });
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

    // FIX: Status-aware stale thresholds
    // Pending/new orders should timeout faster (10 min) as they may be stuck
    // Other orders (accepted, held, pending_cancel) get standard timeout
    const PENDING_ORDER_MAX_AGE_MINUTES = 10;
    const DEFAULT_ORDER_MAX_AGE_MINUTES = maxAgeMinutes;

    try {
      const openOrders = await alpaca.getOrders("open", 100);
      const now = new Date();

      for (const order of openOrders) {
        const createdAt = new Date(order.created_at);
        const ageMs = now.getTime() - createdAt.getTime();
        const ageMinutes = ageMs / 60000;

        // Skip filled orders
        if (order.status === "filled" || order.status === "partially_filled") {
          continue;
        }

        // Use shorter timeout for stuck pending orders
        const isPendingOrder = order.status === "pending" ||
                              order.status === "new" ||
                              order.status === "pending_new";
        const effectiveMaxAgeMinutes = isPendingOrder
          ? PENDING_ORDER_MAX_AGE_MINUTES
          : DEFAULT_ORDER_MAX_AGE_MINUTES;

        if (ageMinutes > effectiveMaxAgeMinutes) {
          try {
            await alpaca.cancelOrder(order.id);
            cancelled.push(order.id);
            log.info("Reconciliation", "Cancelled stale order", {
              orderId: order.id,
              symbol: order.symbol,
              status: order.status,
              ageMinutes: Math.round(ageMinutes),
              thresholdMinutes: effectiveMaxAgeMinutes
            });
          } catch (err) {
            errors.push({ orderId: order.id, error: (err as Error).message });
          }
        }
      }

      log.info("Reconciliation", "Stale order cancellation complete", { cancelled: cancelled.length, errors: errors.length });
    } catch (err) {
      log.error("Reconciliation", "Failed to cancel stale orders", { error: (err as Error).message });
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
        log.info("Reconciliation", "No open orders to cancel");
        return { cancelled: 0, ordersCancelledBefore: 0, remainingAfter: 0 };
      }

      await alpaca.cancelAllOrders();

      await new Promise(resolve => setTimeout(resolve, 500));
      const ordersAfter = await alpaca.getOrders("open", 100);
      const countAfter = ordersAfter.length;
      const actualCancelled = countBefore - countAfter;

      log.info("Reconciliation", "Cancelled all orders", { cancelled: actualCancelled, before: countBefore, remaining: countAfter });
      return {
        cancelled: actualCancelled,
        ordersCancelledBefore: countBefore,
        remainingAfter: countAfter
      };
    } catch (err) {
      log.error("Reconciliation", "Failed to cancel all orders", { error: (err as Error).message });
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

    log.info("Reconciliation", "Position reconciliation complete", { discrepancies: discrepancies.length });

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

  async syncPositionsFromAlpaca(userId?: string): Promise<{
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

      // If no userId provided, get admin user's positions (system-level sync)
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const adminUser = await storage.getUserByUsername("admintest");
        if (!adminUser) {
          throw new Error("No admin user found for system-level position sync");
        }
        effectiveUserId = adminUser.id;
        log.info("Sync", "Using admin user for system-level sync", { username: adminUser.username });
      }

      const dbPositions = await storage.getPositions(effectiveUserId);

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
              userId: effectiveUserId,
              symbol: alpacaPos.symbol,
              side: alpacaPos.side,
              quantity: alpacaPos.qty,
              entryPrice: alpacaPos.avg_entry_price,
              currentPrice: alpacaPos.current_price,
              unrealizedPnl: alpacaPos.unrealized_pl,
              strategyId: null,
            });
            created.push(symbol);
            log.info("Sync", "Created position", { symbol, userId: effectiveUserId });
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
            log.info("Sync", "Removed stale position", { symbol });
          } catch (err) {
            errors.push({ symbol, error: (err as Error).message });
          }
        }
      }

      log.info("Sync", "Position sync completed", { created: created.length, updated: updated.length, removed: removed.length });
    } catch (err) {
      log.error("Sync", "Failed to sync positions", { error: (err as Error).message });
      throw err;
    }

    return { created, updated, removed, errors };
  }

  async closeAllPositions(options: {
    /** SECURITY: Only the work queue processor or emergency actions should set this to true */
    authorizedByOrchestrator?: boolean;
    isEmergencyStop?: boolean;
  } = {}): Promise<{
    closed: Array<{ symbol: string; qty: string; pnl: string }>;
    tradesCreated: number;
    errors: Array<{ symbol: string; error: string }>;
  }> {
    // SECURITY: Orchestrator control check - only allow close-all if authorized or emergency
    if (this.orchestratorControlEnabled && !options.authorizedByOrchestrator && !options.isEmergencyStop) {
      log.warn("AlpacaTradingEngine", "Close all positions blocked - orchestrator has control");
      return {
        closed: [],
        tradesCreated: 0,
        errors: [{ symbol: "ALL", error: "Orchestrator control active - close all blocked. Use emergency stop or go through orchestrator." }],
      };
    }

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
          log.info("Reconciliation", "Closed position", { symbol: position.symbol, side: position.side, qty, pnl: realizedPnl.toFixed(2) });
        } catch (err) {
          errors.push({ symbol: position.symbol, error: (err as Error).message });
        }
      }

      await this.syncPositionsFromAlpaca();
      await this.updateAgentStats();
      log.info("Reconciliation", "Close all positions complete", { closed: closed.length, tradesCreated, errors: errors.length });
    } catch (err) {
      log.error("Reconciliation", "Failed to close all positions", { error: (err as Error).message });
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
      // Use Decimal.js for precise portfolio allocation calculations
      const targetValue = toDecimal(target.targetPercent).dividedBy(100).times(portfolioValue);
      const current = currentMap.get(symbol);
      const currentValue = current?.currentValue || 0;
      const currentPercent = current?.currentPercent || 0;
      const currentPrice = current?.price || 0;

      const valueDiff = targetValue.minus(currentValue);

      if (valueDiff.abs().lessThan(10)) continue;

      if (valueDiff.isPositive() && currentPrice > 0) {
        const buyQuantity = calculateWholeShares(valueDiff, currentPrice).toNumber();
        if (buyQuantity >= 1) {
          const estimatedValue = positionValue(buyQuantity, currentPrice).toNumber();
          proposedTrades.push({
            symbol,
            side: "buy",
            quantity: buyQuantity,
            estimatedValue,
            currentPercent,
            targetPercent: target.targetPercent,
            reason: `Increase allocation from ${currentPercent.toFixed(1)}% to ${target.targetPercent}%`,
          });
          estimatedCashChange -= estimatedValue;
        }
      } else if (valueDiff.isNegative() && currentPrice > 0 && current) {
        const maxSellQty = calculateWholeShares(valueDiff.abs(), currentPrice).toNumber();
        const sellQuantity = Math.min(maxSellQty, current.quantity);
        if (sellQuantity >= 1) {
          const estimatedValue = positionValue(sellQuantity, currentPrice).toNumber();
          proposedTrades.push({
            symbol,
            side: "sell",
            quantity: sellQuantity,
            estimatedValue,
            currentPercent,
            targetPercent: target.targetPercent,
            reason: `Decrease allocation from ${currentPercent.toFixed(1)}% to ${target.targetPercent}%`,
          });
          estimatedCashChange += estimatedValue;
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
      // Use Decimal.js for precise rebalance calculations
      const targetValue = toDecimal(safeParseFloat(target.targetPercent)).dividedBy(100).times(refreshedPortfolioValue);
      const current = refreshedPositionMap.get(symbol);
      const currentValue = current ? safeParseFloat(current.currentValue) : 0;
      const currentPrice = current ? safeParseFloat(current.price) : 0;

      const valueDiff = targetValue.minus(currentValue);

      if (valueDiff.lessThanOrEqualTo(10) || currentPrice <= 0) continue;

      const maxBuyValue = toDecimal(availableCash).times(0.95).toNumber();
      const maxBuyValueCapped = Math.min(valueDiff.toNumber(), maxBuyValue);
      const buyQuantity = calculateWholeShares(maxBuyValueCapped, currentPrice).toNumber();

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
