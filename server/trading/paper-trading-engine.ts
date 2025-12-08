import { storage } from "../storage";
import { aiDecisionEngine, type MarketData, type AIDecision } from "../ai/decision-engine";
import { coingecko } from "../connectors/coingecko";
import { finnhub } from "../connectors/finnhub";
import type { Trade, Position } from "@shared/schema";

export interface TradeRequest {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  strategyId?: string;
  notes?: string;
}

export interface TradeResult {
  success: boolean;
  trade?: Trade;
  position?: Position;
  pnl?: number;
  error?: string;
}

export interface ClosePositionResult {
  success: boolean;
  trade?: Trade;
  pnl?: number;
  error?: string;
}

export interface PositionWithPnL extends Position {
  currentPrice: string | null;
  unrealizedPnl: string | null;
  pnlPercent: number;
}

export interface PortfolioSummary {
  cashBalance: number;
  positionsValue: number;
  totalEquity: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  positions: PositionWithPnL[];
  winRate: number;
  totalTrades: number;
}

const DEFAULT_CASH_BALANCE = 100000;

export class PaperTradingEngine {
  async getCashBalance(): Promise<number> {
    const status = await storage.getAgentStatus();
    if (!status || status.cashBalance === null || status.cashBalance === undefined) {
      await storage.updateAgentStatus({
        isRunning: false,
        totalTrades: 0,
        totalPnl: "0",
        cashBalance: DEFAULT_CASH_BALANCE.toString(),
      });
      return DEFAULT_CASH_BALANCE;
    }
    return parseFloat(status.cashBalance);
  }

  private async setCashBalance(newBalance: number): Promise<void> {
    await storage.updateAgentStatus({
      cashBalance: newBalance.toString(),
      lastHeartbeat: new Date(),
    });
  }

  async executeTrade(request: TradeRequest): Promise<TradeResult> {
    try {
      const { symbol, side, quantity, price, strategyId, notes } = request;

      if (quantity <= 0) {
        return { success: false, error: "Quantity must be greater than 0" };
      }

      if (price <= 0) {
        return { success: false, error: "Price must be greater than 0" };
      }

      const tradeValue = quantity * price;
      const currentCash = await this.getCashBalance();

      const existingPositions = await storage.getPositions();
      const existingLongPosition = existingPositions.find(
        (p) => p.symbol.toLowerCase() === symbol.toLowerCase() && p.side === "long"
      );

      let trade: Trade;
      let position: Position | undefined;
      let realizedPnl: number | undefined;

      if (side === "buy") {
        if (tradeValue > currentCash) {
          return { success: false, error: "Insufficient cash for this trade" };
        }

        const riskCheck = await this.checkRiskLimits(tradeValue);
        if (!riskCheck.allowed) {
          return { success: false, error: riskCheck.reason };
        }

        trade = await storage.createTrade({
          symbol,
          side: "buy",
          quantity: quantity.toString(),
          price: price.toString(),
          strategyId: strategyId || null,
          status: "completed",
          notes: notes || null,
          pnl: null,
        });

        if (existingLongPosition) {
          const existingQty = parseFloat(existingLongPosition.quantity);
          const existingCost = existingQty * parseFloat(existingLongPosition.entryPrice);
          const newCost = quantity * price;
          const totalQty = existingQty + quantity;
          const avgPrice = (existingCost + newCost) / totalQty;

          position = await storage.updatePosition(existingLongPosition.id, {
            quantity: totalQty.toString(),
            entryPrice: avgPrice.toString(),
            currentPrice: price.toString(),
            unrealizedPnl: "0",
          });
        } else {
          position = await storage.createPosition({
            symbol,
            quantity: quantity.toString(),
            entryPrice: price.toString(),
            currentPrice: price.toString(),
            unrealizedPnl: "0",
            side: "long",
            strategyId: strategyId || null,
          });
        }

        await this.setCashBalance(currentCash - tradeValue);
      } else {
        if (!existingLongPosition) {
          return { success: false, error: `No long position to sell for ${symbol}` };
        }

        const existingQty = parseFloat(existingLongPosition.quantity);
        
        if (quantity > existingQty) {
          return { success: false, error: `Cannot sell more than owned (${existingQty} ${symbol})` };
        }

        const entryPrice = parseFloat(existingLongPosition.entryPrice);
        realizedPnl = (price - entryPrice) * quantity;
        const remainingQty = existingQty - quantity;

        trade = await storage.createTrade({
          symbol,
          side: "sell",
          quantity: quantity.toString(),
          price: price.toString(),
          strategyId: strategyId || null,
          status: "completed",
          notes: notes || null,
          pnl: realizedPnl.toString(),
        });

        if (remainingQty <= 0.00001) {
          await storage.deletePosition(existingLongPosition.id);
          position = undefined;
        } else {
          position = await storage.updatePosition(existingLongPosition.id, {
            quantity: remainingQty.toString(),
            currentPrice: price.toString(),
          });
        }

        await this.setCashBalance(currentCash + tradeValue);
      }

      await this.updateAgentStats();

      return { success: true, trade, position, pnl: realizedPnl };
    } catch (error) {
      console.error("Trade execution error:", error);
      return { success: false, error: (error as Error).message };
    }
  }

  async closePosition(positionId: string, currentPrice?: number): Promise<ClosePositionResult> {
    try {
      const position = await storage.getPosition(positionId);
      if (!position) {
        return { success: false, error: "Position not found" };
      }

      const quantity = parseFloat(position.quantity);
      const entryPrice = parseFloat(position.entryPrice);
      const exitPrice = currentPrice || await this.getCurrentPrice(position.symbol);

      if (!exitPrice) {
        return { success: false, error: "Could not determine exit price" };
      }

      const realizedPnl = (exitPrice - entryPrice) * quantity;
      const tradeValue = quantity * exitPrice;
      const currentCash = await this.getCashBalance();

      const trade = await storage.createTrade({
        symbol: position.symbol,
        side: "sell",
        quantity: position.quantity,
        price: exitPrice.toString(),
        strategyId: position.strategyId,
        status: "completed",
        notes: `Closed long position`,
        pnl: realizedPnl.toString(),
      });

      await storage.deletePosition(positionId);
      await this.setCashBalance(currentCash + tradeValue);
      await this.updateAgentStats();

      return { success: true, trade, pnl: realizedPnl };
    } catch (error) {
      console.error("Close position error:", error);
      return { success: false, error: (error as Error).message };
    }
  }

  async updatePositionPrices(): Promise<void> {
    try {
      const positions = await storage.getPositions();
      
      for (const position of positions) {
        const currentPrice = await this.getCurrentPrice(position.symbol);
        if (currentPrice) {
          const quantity = parseFloat(position.quantity);
          const entryPrice = parseFloat(position.entryPrice);
          const unrealizedPnl = (currentPrice - entryPrice) * quantity;

          await storage.updatePosition(position.id, {
            currentPrice: currentPrice.toString(),
            unrealizedPnl: unrealizedPnl.toString(),
          });
        }
      }
    } catch (error) {
      console.error("Update position prices error:", error);
    }
  }

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    await this.updatePositionPrices();
    
    const positions = await storage.getPositions();
    const trades = await storage.getTrades(1000);
    const cashBalance = await this.getCashBalance();

    let positionsValue = 0;
    let totalUnrealizedPnl = 0;

    const positionsWithPnl: PositionWithPnL[] = positions.map((p) => {
      const quantity = parseFloat(p.quantity);
      const entryPrice = parseFloat(p.entryPrice);
      const currentPrice = parseFloat(p.currentPrice || p.entryPrice);
      const unrealizedPnl = parseFloat(p.unrealizedPnl || "0");

      const value = quantity * currentPrice;
      const cost = quantity * entryPrice;
      const pnlPercent = cost > 0 ? ((value - cost) / cost) * 100 : 0;

      positionsValue += value;
      totalUnrealizedPnl += unrealizedPnl;

      return {
        ...p,
        pnlPercent,
      };
    });

    const closingTrades = trades.filter((t) => t.pnl !== null && t.pnl !== "0");
    const totalRealizedPnl = closingTrades.reduce(
      (sum, t) => sum + parseFloat(t.pnl || "0"),
      0
    );

    const winningTrades = closingTrades.filter((t) => parseFloat(t.pnl || "0") > 0);
    const winRate = closingTrades.length > 0
      ? (winningTrades.length / closingTrades.length) * 100
      : 0;

    const totalEquity = cashBalance + positionsValue;

    return {
      cashBalance,
      positionsValue,
      totalEquity,
      totalUnrealizedPnl,
      totalRealizedPnl,
      positions: positionsWithPnl,
      winRate,
      totalTrades: trades.length,
    };
  }

  async executeFromAIDecision(
    symbol: string,
    decision: AIDecision,
    marketData: MarketData,
    strategyId?: string
  ): Promise<TradeResult> {
    if (decision.action === "hold") {
      return { success: true, error: "AI recommends holding - no trade executed" };
    }

    const cashBalance = await this.getCashBalance();
    const positionSize = decision.suggestedQuantity || 0.05;
    const tradeValue = cashBalance * positionSize;
    const quantity = tradeValue / marketData.currentPrice;

    const side = decision.action === "buy" ? "buy" : "sell";

    const notes = `AI Decision: ${decision.action.toUpperCase()} with ${(decision.confidence * 100).toFixed(0)}% confidence. Risk: ${decision.riskLevel}. ${decision.reasoning}`;

    return this.executeTrade({
      symbol,
      side,
      quantity,
      price: marketData.currentPrice,
      strategyId,
      notes,
    });
  }

  async analyzeAndExecute(
    symbol: string,
    strategyId?: string
  ): Promise<{ decision: AIDecision; tradeResult?: TradeResult }> {
    const marketData = await this.getMarketDataForSymbol(symbol);
    if (!marketData) {
      throw new Error(`Could not get market data for ${symbol}`);
    }

    let strategy;
    if (strategyId) {
      strategy = await storage.getStrategy(strategyId);
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
      undefined,
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
        riskLevel: decision.riskLevel,
        suggestedQuantity: decision.suggestedQuantity,
        targetPrice: decision.targetPrice,
        stopLoss: decision.stopLoss,
      }),
    });

    const agentStatus = await storage.getAgentStatus();
    if (!agentStatus?.isRunning) {
      return { decision };
    }

    const tradeResult = await this.executeFromAIDecision(
      symbol,
      decision,
      marketData,
      strategyId
    );

    return { decision, tradeResult };
  }

  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const upperSymbol = symbol.toUpperCase();
      
      if (this.isStockSymbol(upperSymbol)) {
        const quote = await finnhub.getQuote(upperSymbol);
        return quote.c || null;
      }

      const lowerSymbol = symbol.toLowerCase();
      const prices = await coingecko.getSimplePrice([lowerSymbol]);
      return prices[lowerSymbol]?.usd || null;
    } catch (error) {
      console.error(`Failed to get price for ${symbol}:`, error);
      return null;
    }
  }

  private async getMarketDataForSymbol(symbol: string): Promise<MarketData | null> {
    try {
      const upperSymbol = symbol.toUpperCase();
      
      if (this.isStockSymbol(upperSymbol)) {
        const quote = await finnhub.getQuote(upperSymbol);
        return {
          symbol: upperSymbol,
          currentPrice: quote.c,
          priceChange24h: quote.d,
          priceChangePercent24h: quote.dp,
          high24h: quote.h,
          low24h: quote.l,
        };
      }

      const lowerSymbol = symbol.toLowerCase();
      const markets = await coingecko.getMarkets("usd", 250, 1, "market_cap_desc");
      const coin = markets.find((m) => m.id === lowerSymbol || m.symbol === lowerSymbol);
      
      if (coin) {
        return {
          symbol: coin.symbol.toUpperCase(),
          currentPrice: coin.current_price,
          priceChange24h: coin.price_change_24h,
          priceChangePercent24h: coin.price_change_percentage_24h,
          high24h: coin.high_24h,
          low24h: coin.low_24h,
          volume: coin.total_volume,
          marketCap: coin.market_cap,
        };
      }

      return null;
    } catch (error) {
      console.error(`Failed to get market data for ${symbol}:`, error);
      return null;
    }
  }

  private isStockSymbol(symbol: string): boolean {
    const stockSymbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA", "JPM", "V", "JNJ"];
    return stockSymbols.includes(symbol) || /^[A-Z]{1,5}$/.test(symbol);
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

  async resetPortfolio(): Promise<void> {
    const positions = await storage.getPositions();
    for (const position of positions) {
      await storage.deletePosition(position.id);
    }
    
    await storage.updateAgentStatus({
      totalTrades: 0,
      totalPnl: "0",
      cashBalance: DEFAULT_CASH_BALANCE.toString(),
      winRate: "0",
      lastHeartbeat: new Date(),
    });
  }

  async closeAllPositions(): Promise<{ success: boolean; closedCount: number; totalPnl: number; errors: string[] }> {
    const positions = await storage.getPositions();
    let closedCount = 0;
    let totalPnl = 0;
    const errors: string[] = [];

    for (const position of positions) {
      const result = await this.closePosition(position.id);
      if (result.success) {
        closedCount++;
        totalPnl += result.pnl || 0;
      } else {
        errors.push(`Failed to close ${position.symbol}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      closedCount,
      totalPnl,
      errors,
    };
  }

  async checkRiskLimits(tradeValue: number): Promise<{ allowed: boolean; reason?: string }> {
    const status = await storage.getAgentStatus();
    
    if (status?.killSwitchActive) {
      return { allowed: false, reason: "Kill switch is active - trading halted" };
    }

    const positions = await storage.getPositions();
    const maxPositions = status?.maxPositionsCount ?? 10;
    if (positions.length >= maxPositions) {
      return { allowed: false, reason: `Maximum positions limit reached (${maxPositions})` };
    }

    const cashBalance = await this.getCashBalance();
    const maxPositionSizePercent = parseFloat(status?.maxPositionSizePercent ?? "10") / 100;
    const maxTradeValue = cashBalance * maxPositionSizePercent;
    if (tradeValue > maxTradeValue) {
      return { 
        allowed: false, 
        reason: `Trade exceeds max position size (${(maxPositionSizePercent * 100).toFixed(0)}% = $${maxTradeValue.toFixed(2)})` 
      };
    }

    let positionsValue = 0;
    for (const p of positions) {
      const qty = parseFloat(p.quantity);
      const price = parseFloat(p.currentPrice || p.entryPrice);
      positionsValue += qty * price;
    }
    const maxExposurePercent = parseFloat(status?.maxTotalExposurePercent ?? "50") / 100;
    const totalEquity = cashBalance + positionsValue;
    
    if (totalEquity > 0) {
      const newExposure = (positionsValue + tradeValue) / totalEquity;
      if (newExposure > maxExposurePercent) {
        return { 
          allowed: false, 
          reason: `Trade would exceed max exposure (${(maxExposurePercent * 100).toFixed(0)}% of portfolio)` 
        };
      }
    }

    const dailyLossCheck = await this.checkDailyLossLimit();
    if (!dailyLossCheck.allowed) {
      return dailyLossCheck;
    }

    return { allowed: true };
  }

  private async checkDailyLossLimit(): Promise<{ allowed: boolean; reason?: string }> {
    const status = await storage.getAgentStatus();
    const dailyLossLimitPercent = parseFloat(status?.dailyLossLimitPercent ?? "5") / 100;
    
    const trades = await storage.getTrades(1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysTrades = trades.filter((t) => {
      const tradeDate = new Date(t.executedAt);
      return tradeDate >= today;
    });
    
    const todaysLoss = todaysTrades.reduce((sum, t) => {
      const pnl = parseFloat(t.pnl || "0");
      return pnl < 0 ? sum + Math.abs(pnl) : sum;
    }, 0);
    
    const cashBalance = await this.getCashBalance();
    const positions = await storage.getPositions();
    let positionsValue = 0;
    for (const p of positions) {
      const qty = parseFloat(p.quantity);
      const price = parseFloat(p.currentPrice || p.entryPrice);
      positionsValue += qty * price;
    }
    const totalEquity = cashBalance + positionsValue;
    
    if (totalEquity > 0) {
      const dailyLossPercent = todaysLoss / totalEquity;
      if (dailyLossPercent >= dailyLossLimitPercent) {
        return { 
          allowed: false, 
          reason: `Daily loss limit reached (${(dailyLossLimitPercent * 100).toFixed(0)}% = $${(totalEquity * dailyLossLimitPercent).toFixed(2)})` 
        };
      }
    }
    
    return { allowed: true };
  }

  async getRiskSettings(): Promise<{
    killSwitchActive: boolean;
    maxPositionSizePercent: number;
    maxTotalExposurePercent: number;
    maxPositionsCount: number;
    dailyLossLimitPercent: number;
  }> {
    const status = await storage.getAgentStatus();
    return {
      killSwitchActive: status?.killSwitchActive ?? false,
      maxPositionSizePercent: parseFloat(status?.maxPositionSizePercent ?? "10"),
      maxTotalExposurePercent: parseFloat(status?.maxTotalExposurePercent ?? "50"),
      maxPositionsCount: status?.maxPositionsCount ?? 10,
      dailyLossLimitPercent: parseFloat(status?.dailyLossLimitPercent ?? "5"),
    };
  }
}

export const paperTradingEngine = new PaperTradingEngine();
