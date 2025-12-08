import { storage } from "../storage";
import { alpaca, type AlpacaOrder, type AlpacaPosition, type CreateOrderParams } from "../connectors/alpaca";
import { aiDecisionEngine, type MarketData, type AIDecision, type NewsContext } from "../ai/decision-engine";
import { newsapi } from "../connectors/newsapi";
import type { Trade, Strategy } from "@shared/schema";

export interface AlpacaTradeRequest {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  strategyId?: string;
  notes?: string;
  orderType?: "market" | "limit";
  limitPrice?: number;
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
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    
    try {
      const strategies = await storage.getStrategies();
      const activeStrategies = strategies.filter(s => s.isActive);
      
      for (const strategy of activeStrategies) {
        if (!this.strategyRunners.has(strategy.id)) {
          console.log(`Resetting orphaned active strategy: ${strategy.name} (${strategy.id})`);
          await storage.toggleStrategy(strategy.id, false);
        }
      }
      
      const runningStrategies = strategies.filter(s => s.isActive);
      if (runningStrategies.length === 0) {
        await storage.updateAgentStatus({ isRunning: false });
      }
    } catch (error) {
      console.error("Failed to initialize trading engine:", error);
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

  async executeAlpacaTrade(request: AlpacaTradeRequest): Promise<AlpacaTradeResult> {
    try {
      const { symbol, side, quantity, strategyId, notes, orderType = "market", limitPrice } = request;

      if (quantity <= 0) {
        return { success: false, error: "Quantity must be greater than 0" };
      }

      const riskCheck = await this.checkRiskLimits(symbol, side, quantity);
      if (!riskCheck.allowed) {
        return { success: false, error: riskCheck.reason };
      }

      const orderParams: CreateOrderParams = {
        symbol: symbol.toUpperCase(),
        qty: quantity.toString(),
        side,
        type: orderType,
        time_in_force: "day",
      };

      if (orderType === "limit" && limitPrice) {
        orderParams.limit_price = limitPrice.toString();
      }

      const order = await alpaca.createOrder(orderParams);

      const filledPrice = order.filled_avg_price
        ? parseFloat(order.filled_avg_price)
        : limitPrice || 0;

      const trade = await storage.createTrade({
        symbol: symbol.toUpperCase(),
        side,
        quantity: quantity.toString(),
        price: filledPrice.toString(),
        strategyId: strategyId || null,
        status: order.status,
        notes: notes || `Alpaca Order ID: ${order.id}`,
        pnl: null,
      });

      await this.updateAgentStats();

      return { success: true, order, trade };
    } catch (error) {
      console.error("Alpaca trade execution error:", error);
      return { success: false, error: (error as Error).message };
    }
  }

  async closeAlpacaPosition(symbol: string, strategyId?: string): Promise<AlpacaTradeResult> {
    try {
      let position: AlpacaPosition | null = null;
      try {
        position = await alpaca.getPosition(symbol);
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
        order = await alpaca.closePosition(symbol);
      } catch (closeError) {
        const errorMsg = (closeError as Error).message?.toLowerCase() || "";
        if (errorMsg.includes("404") || errorMsg.includes("not found") || errorMsg.includes("position does not exist")) {
          return { success: true, error: `Position for ${symbol} was already closed` };
        }
        throw closeError;
      }

      const quantity = parseFloat(position.qty);
      const entryPrice = parseFloat(position.avg_entry_price);
      const exitPrice = parseFloat(order.filled_avg_price || position.current_price);
      const pnl = (exitPrice - entryPrice) * quantity;

      const trade = await storage.createTrade({
        symbol: symbol.toUpperCase(),
        side: "sell",
        quantity: quantity.toString(),
        price: exitPrice.toString(),
        strategyId: strategyId || null,
        status: "completed",
        notes: `Closed Alpaca position. Order ID: ${order.id}`,
        pnl: pnl.toString(),
      });

      await this.updateAgentStats();

      return { success: true, order, trade };
    } catch (error) {
      console.error("Close Alpaca position error:", error);
      return { success: false, error: (error as Error).message };
    }
  }

  async analyzeSymbol(
    symbol: string,
    strategyId?: string
  ): Promise<{ decision: AIDecision; marketData: MarketData }> {
    const marketData = await this.getMarketDataForSymbol(symbol);
    if (!marketData) {
      throw new Error(`Could not get market data for ${symbol}`);
    }

    let strategy: Strategy | undefined;
    let newsContext: NewsContext | undefined;

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
      }),
    });

    return { decision, marketData };
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

    const account = await alpaca.getAccount();
    const buyingPower = parseFloat(account.buying_power);
    const positionSizePercent = decision.suggestedQuantity || 0.05;
    const tradeValue = buyingPower * positionSizePercent;
    const quantity = Math.floor(tradeValue / marketData.currentPrice);

    if (quantity < 1) {
      return { decision };
    }

    const notes = `AI Decision: ${decision.action.toUpperCase()} with ${(decision.confidence * 100).toFixed(0)}% confidence. Risk: ${decision.riskLevel}. ${decision.reasoning}`;

    if (decision.action === "sell") {
      try {
        const position = await alpaca.getPosition(symbol);
        if (!position) {
          return { decision };
        }
        const tradeResult = await this.closeAlpacaPosition(symbol, strategyId);
        return { decision, tradeResult };
      } catch (posError) {
        const errorMsg = (posError as Error).message?.toLowerCase() || "";
        if (errorMsg.includes("404") || errorMsg.includes("not found") || errorMsg.includes("position does not exist")) {
          return { decision };
        }
        throw posError;
      }
    }

    const tradeResult = await this.executeAlpacaTrade({
      symbol,
      side: "buy",
      quantity,
      strategyId,
      notes,
    });

    return { decision, tradeResult };
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
        for (const asset of assets) {
          try {
            const result = await this.analyzeAndExecute(asset, strategyId);
            this.strategyStates.set(strategyId, {
              strategyId,
              isRunning: true,
              lastCheck: new Date(),
              lastDecision: result.decision,
            });
          } catch (assetError) {
            console.error(`Error analyzing ${asset}:`, assetError);
          }
        }

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

    return { success: true };
  }

  async stopStrategy(strategyId: string): Promise<{ success: boolean; error?: string }> {
    const interval = this.strategyRunners.get(strategyId);
    if (interval) {
      clearInterval(interval);
      this.strategyRunners.delete(strategyId);
    }

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

    return { success: true };
  }

  async stopAllStrategies(): Promise<void> {
    for (const [strategyId] of this.strategyRunners) {
      await this.stopStrategy(strategyId);
    }
    await storage.updateAgentStatus({ isRunning: false });
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
      const snapshots = await alpaca.getSnapshots([symbol.toUpperCase()]);
      const snapshot = snapshots[symbol.toUpperCase()];

      if (snapshot) {
        const currentPrice = snapshot.latestTrade?.p || snapshot.dailyBar?.c || 0;
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

        const snapshot = await alpaca.getSnapshots([symbol.toUpperCase()]);
        const price = snapshot[symbol.toUpperCase()]?.latestTrade?.p || 0;
        const tradeValue = quantity * price;

        const buyingPower = parseFloat(account.buying_power);
        const rawPercent = status?.maxPositionSizePercent;
        const parsedPercent = rawPercent ? parseFloat(rawPercent) : NaN;
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
        (sum, t) => sum + parseFloat(t.pnl || "0"),
        0
      );
      const winningTrades = closingTrades.filter((t) => parseFloat(t.pnl || "0") > 0);
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
}

export const alpacaTradingEngine = new AlpacaTradingEngine();
