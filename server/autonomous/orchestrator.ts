import { alpaca, CreateOrderParams } from "../connectors/alpaca";
import { aiDecisionEngine, AIDecision, MarketData } from "../ai/decision-engine";
import { finnhub } from "../connectors/finnhub";
import { coingecko } from "../connectors/coingecko";
import { storage } from "../storage";
import type { Strategy } from "@shared/schema";

export interface OrchestratorConfig {
  analysisIntervalMs: number;
  positionCheckIntervalMs: number;
  enabled: boolean;
}

export interface PositionWithRules {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  trailingStopPercent?: number;
  maxHoldingPeriodMs?: number;
  openedAt: Date;
  strategyId?: string;
}

export interface RiskLimits {
  maxPositionSizePercent: number;
  maxTotalExposurePercent: number;
  maxPositionsCount: number;
  dailyLossLimitPercent: number;
  killSwitchActive: boolean;
}

export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  error?: string;
  action: "buy" | "sell" | "hold" | "skip";
  reason: string;
  symbol: string;
  quantity?: number;
  price?: number;
}

export interface OrchestratorState {
  isRunning: boolean;
  mode: "autonomous" | "semi-auto" | "manual";
  lastAnalysisTime: Date | null;
  lastPositionCheckTime: Date | null;
  activePositions: Map<string, PositionWithRules>;
  pendingSignals: Map<string, AIDecision>;
  executionHistory: ExecutionResult[];
  dailyPnl: number;
  dailyTradeCount: number;
  errors: string[];
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  analysisIntervalMs: 60000,
  positionCheckIntervalMs: 30000,
  enabled: true,
};

const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionSizePercent: 10,
  maxTotalExposurePercent: 50,
  maxPositionsCount: 10,
  dailyLossLimitPercent: 5,
  killSwitchActive: false,
};

const WATCHLIST = {
  stocks: ["AAPL", "GOOGL", "MSFT", "AMZN", "NVDA", "META", "TSLA"],
  crypto: ["BTC", "ETH", "SOL"],
};

function isCryptoSymbol(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase();
  // Check bare tickers
  if (WATCHLIST.crypto.includes(upperSymbol)) return true;
  // Check USD pairs (e.g., BTC/USD, BTCUSD)
  const cryptoPairs = WATCHLIST.crypto.flatMap(c => [`${c}/USD`, `${c}USD`]);
  return cryptoPairs.includes(upperSymbol) || 
         (symbol.includes("/") && upperSymbol.endsWith("USD"));
}

function normalizeCryptoSymbol(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();
  // Already in correct format
  if (upperSymbol.includes("/")) return upperSymbol;
  // Bare ticker (BTC -> BTC/USD)
  if (WATCHLIST.crypto.includes(upperSymbol)) return `${upperSymbol}/USD`;
  // BTCUSD format -> BTC/USD
  if (upperSymbol.endsWith("USD") && upperSymbol.length > 3) {
    const base = upperSymbol.slice(0, -3);
    return `${base}/USD`;
  }
  return upperSymbol;
}

class AutonomousOrchestrator {
  private state: OrchestratorState;
  private config: OrchestratorConfig;
  private riskLimits: RiskLimits;
  private analysisTimer: NodeJS.Timeout | null = null;
  private positionTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.riskLimits = { ...DEFAULT_RISK_LIMITS };
    this.state = {
      isRunning: false,
      mode: "manual",
      lastAnalysisTime: null,
      lastPositionCheckTime: null,
      activePositions: new Map(),
      pendingSignals: new Map(),
      executionHistory: [],
      dailyPnl: 0,
      dailyTradeCount: 0,
      errors: [],
    };
  }

  async initialize(): Promise<void> {
    await this.loadRiskLimitsFromDB();
    await this.syncPositionsFromBroker();
    console.log("[Orchestrator] Initialized with risk limits:", this.riskLimits);
  }

  private async loadRiskLimitsFromDB(): Promise<void> {
    try {
      const agentStatus = await storage.getAgentStatus();
      if (agentStatus) {
        this.riskLimits = {
          maxPositionSizePercent: Number(agentStatus.maxPositionSizePercent) || 10,
          maxTotalExposurePercent: Number(agentStatus.maxTotalExposurePercent) || 50,
          maxPositionsCount: agentStatus.maxPositionsCount || 10,
          dailyLossLimitPercent: Number(agentStatus.dailyLossLimitPercent) || 5,
          killSwitchActive: agentStatus.killSwitchActive || false,
        };
        this.state.mode = agentStatus.isRunning ? "autonomous" : "manual";
      }
    } catch (error) {
      console.error("[Orchestrator] Failed to load risk limits:", error);
    }
  }

  async syncPositionsFromBroker(): Promise<void> {
    try {
      const positions = await alpaca.getPositions();
      const existingPositions = new Map(this.state.activePositions);
      this.state.activePositions.clear();

      for (const pos of positions) {
        const entryPrice = parseFloat(pos.avg_entry_price);
        const currentPrice = parseFloat(pos.current_price);
        
        const existingPos = existingPositions.get(pos.symbol);
        
        let stopLossPrice = existingPos?.stopLossPrice;
        let takeProfitPrice = existingPos?.takeProfitPrice;
        let trailingStopPercent = existingPos?.trailingStopPercent;
        
        if (!stopLossPrice && entryPrice > 0) {
          stopLossPrice = entryPrice * 0.95;
        }
        if (!takeProfitPrice && entryPrice > 0) {
          takeProfitPrice = entryPrice * 1.10;
        }
        
        if (existingPos?.trailingStopPercent && currentPrice > entryPrice) {
          const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
          if (profitPercent > 5) {
            const newStopLoss = currentPrice * (1 - existingPos.trailingStopPercent / 100);
            if (!stopLossPrice || newStopLoss > stopLossPrice) {
              stopLossPrice = newStopLoss;
              console.log(`[Orchestrator] Trailing stop updated for ${pos.symbol}: $${stopLossPrice.toFixed(2)}`);
            }
          }
        }

        const positionWithRules: PositionWithRules = {
          symbol: pos.symbol,
          quantity: parseFloat(pos.qty),
          entryPrice,
          currentPrice,
          unrealizedPnl: parseFloat(pos.unrealized_pl),
          unrealizedPnlPercent: parseFloat(pos.unrealized_plpc) * 100,
          openedAt: existingPos?.openedAt || new Date(),
          stopLossPrice,
          takeProfitPrice,
          trailingStopPercent,
          strategyId: existingPos?.strategyId,
        };

        this.state.activePositions.set(pos.symbol, positionWithRules);
      }

      console.log(`[Orchestrator] Synced ${positions.length} positions from broker`);
    } catch (error) {
      console.error("[Orchestrator] Failed to sync positions:", error);
      this.state.errors.push(`Position sync failed: ${error}`);
    }
  }

  async start(): Promise<void> {
    if (this.state.isRunning) {
      console.log("[Orchestrator] Already running");
      return;
    }

    await this.initialize();

    if (this.riskLimits.killSwitchActive) {
      console.log("[Orchestrator] Kill switch is active - cannot start");
      throw new Error("Kill switch is active. Disable it to start autonomous trading.");
    }

    this.state.isRunning = true;
    this.state.mode = "autonomous";
    this.state.errors = [];

    await storage.updateAgentStatus({ isRunning: true });

    this.analysisTimer = setInterval(() => {
      this.runAnalysisCycle().catch((err) => {
        console.error("[Orchestrator] Analysis cycle error:", err);
        this.state.errors.push(`Analysis error: ${err.message}`);
      });
    }, this.config.analysisIntervalMs);

    this.positionTimer = setInterval(() => {
      this.runPositionManagementCycle().catch((err) => {
        console.error("[Orchestrator] Position management error:", err);
        this.state.errors.push(`Position mgmt error: ${err.message}`);
      });
    }, this.config.positionCheckIntervalMs);

    await this.runAnalysisCycle();
    await this.runPositionManagementCycle();

    console.log("[Orchestrator] Started autonomous trading mode");
  }

  async stop(): Promise<void> {
    if (!this.state.isRunning) {
      console.log("[Orchestrator] Not running");
      return;
    }

    this.state.isRunning = false;
    this.state.mode = "manual";

    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }

    if (this.positionTimer) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }

    await storage.updateAgentStatus({ isRunning: false });

    console.log("[Orchestrator] Stopped autonomous trading mode");
  }

  async activateKillSwitch(reason: string): Promise<void> {
    console.log(`[Orchestrator] KILL SWITCH ACTIVATED: ${reason}`);

    this.riskLimits.killSwitchActive = true;
    await this.stop();

    await storage.updateAgentStatus({ killSwitchActive: true });

    this.state.errors.push(`Kill switch activated: ${reason}`);
  }

  async deactivateKillSwitch(): Promise<void> {
    this.riskLimits.killSwitchActive = false;
    await storage.updateAgentStatus({ killSwitchActive: false });
    console.log("[Orchestrator] Kill switch deactivated");
  }

  private async runAnalysisCycle(): Promise<void> {
    if (this.isProcessing || !this.state.isRunning) return;
    this.isProcessing = true;

    try {
      console.log("[Orchestrator] Running analysis cycle...");
      this.state.lastAnalysisTime = new Date();

      await this.loadRiskLimitsFromDB();

      if (this.riskLimits.killSwitchActive) {
        console.log("[Orchestrator] Kill switch active - skipping analysis");
        return;
      }

      if (this.checkDailyLossLimit()) {
        await this.activateKillSwitch("Daily loss limit exceeded");
        return;
      }

      const marketData = await this.fetchMarketData();

      const allStrategies = await storage.getStrategies();
      const activeStrategies = allStrategies.filter((s: Strategy) => s.isActive);

      for (const [symbol, data] of marketData.entries()) {
        const strategy = activeStrategies.find((s: Strategy) =>
          s.assets?.includes(symbol)
        ) || activeStrategies[0];

        try {
          const decision = await aiDecisionEngine.analyzeOpportunity(
            symbol,
            data,
            undefined,
            strategy
              ? {
                  id: strategy.id,
                  name: strategy.name,
                  type: strategy.type,
                  parameters: strategy.parameters ? JSON.parse(strategy.parameters) : undefined,
                }
              : undefined
          );

          if (decision.confidence >= 0.7 && decision.action !== "hold") {
            this.state.pendingSignals.set(symbol, decision);

            await storage.createAiDecision({
              strategyId: strategy?.id || null,
              symbol,
              action: decision.action,
              confidence: decision.confidence.toString(),
              reasoning: decision.reasoning,
              marketContext: JSON.stringify(data),
            });
          }
        } catch (error) {
          console.error(`[Orchestrator] Analysis failed for ${symbol}:`, error);
        }
      }

      await this.processSignals();
    } finally {
      this.isProcessing = false;
    }
  }

  private async fetchMarketData(): Promise<Map<string, MarketData>> {
    const marketData = new Map<string, MarketData>();

    try {
      const stockPrices = await finnhub.getMultipleQuotes(WATCHLIST.stocks);
      for (const [symbol, quote] of stockPrices.entries()) {
        if (quote.c > 0) {
          marketData.set(symbol, {
            symbol,
            currentPrice: quote.c,
            priceChange24h: quote.d,
            priceChangePercent24h: quote.dp,
            high24h: quote.h,
            low24h: quote.l,
          });
        }
      }
    } catch (error) {
      console.error("[Orchestrator] Failed to fetch stock data:", error);
    }

    try {
      const cryptoPrices = await coingecko.getMarkets();
      const watchedCrypto = cryptoPrices.filter((c) =>
        WATCHLIST.crypto.includes(c.symbol.toUpperCase())
      );
      for (const price of watchedCrypto) {
        marketData.set(price.symbol.toUpperCase(), {
          symbol: price.symbol.toUpperCase(),
          currentPrice: price.current_price,
          priceChange24h: price.price_change_24h || 0,
          priceChangePercent24h: price.price_change_percentage_24h || 0,
          high24h: price.high_24h,
          low24h: price.low_24h,
          volume: price.total_volume,
          marketCap: price.market_cap,
        });
      }
    } catch (error) {
      console.error("[Orchestrator] Failed to fetch crypto data:", error);
    }

    return marketData;
  }

  private async processSignals(): Promise<void> {
    for (const [symbol, decision] of this.state.pendingSignals.entries()) {
      const result = await this.executeSignal(symbol, decision);
      this.state.executionHistory.push(result);

      if (this.state.executionHistory.length > 100) {
        this.state.executionHistory = this.state.executionHistory.slice(-100);
      }
    }

    this.state.pendingSignals.clear();
  }

  private async executeSignal(
    symbol: string,
    decision: AIDecision
  ): Promise<ExecutionResult> {
    const positionCount = this.state.activePositions.size;
    if (
      decision.action === "buy" &&
      positionCount >= this.riskLimits.maxPositionsCount
    ) {
      return {
        success: false,
        action: "skip",
        reason: `Max positions limit reached (${positionCount}/${this.riskLimits.maxPositionsCount})`,
        symbol,
      };
    }

    const existingPosition = this.state.activePositions.get(symbol);

    if (decision.action === "buy" && existingPosition) {
      if (decision.confidence >= 0.85) {
        return await this.reinforcePosition(symbol, decision, existingPosition);
      }
      return {
        success: false,
        action: "skip",
        reason: "Already have position, confidence not high enough to reinforce",
        symbol,
      };
    }

    if (decision.action === "sell" && !existingPosition) {
      return {
        success: false,
        action: "skip",
        reason: "No position to sell",
        symbol,
      };
    }

    if (decision.action === "buy") {
      return await this.openPosition(symbol, decision);
    }

    if (decision.action === "sell" && existingPosition) {
      return await this.closePosition(symbol, decision, existingPosition);
    }

    return {
      success: true,
      action: "hold",
      reason: decision.reasoning,
      symbol,
    };
  }

  private async openPosition(
    symbol: string,
    decision: AIDecision
  ): Promise<ExecutionResult> {
    try {
      const account = await alpaca.getAccount();
      const portfolioValue = parseFloat(account.portfolio_value);
      const buyingPower = parseFloat(account.buying_power);

      const positionSizePercent = Math.min(
        (decision.suggestedQuantity || 0.05) * 100,
        this.riskLimits.maxPositionSizePercent
      );
      const positionValue = portfolioValue * (positionSizePercent / 100);

      const totalExposure = this.calculateTotalExposure(portfolioValue);
      if (
        totalExposure + positionSizePercent >
        this.riskLimits.maxTotalExposurePercent
      ) {
        return {
          success: false,
          action: "skip",
          reason: `Would exceed max exposure (${totalExposure.toFixed(1)}% + ${positionSizePercent.toFixed(1)}% > ${this.riskLimits.maxTotalExposurePercent}%)`,
          symbol,
        };
      }

      if (positionValue > buyingPower) {
        return {
          success: false,
          action: "skip",
          reason: `Insufficient buying power ($${buyingPower.toFixed(2)} < $${positionValue.toFixed(2)})`,
          symbol,
        };
      }

      const isCrypto = isCryptoSymbol(symbol);
      const orderParams: CreateOrderParams = {
        symbol: isCrypto ? normalizeCryptoSymbol(symbol) : symbol,
        notional: positionValue.toFixed(2),
        side: "buy",
        type: "market",
        time_in_force: isCrypto ? "gtc" : "day",
      };

      const order = await alpaca.createOrder(orderParams);

      await storage.createTrade({
        symbol,
        side: "buy",
        quantity: order.qty || order.filled_qty,
        price: order.filled_avg_price || "0",
        status: "completed",
        notes: `AI autonomous: ${decision.reasoning}`,
      });

      this.state.dailyTradeCount++;

      const positionWithRules: PositionWithRules = {
        symbol,
        quantity: parseFloat(order.qty || order.filled_qty || "0"),
        entryPrice: parseFloat(order.filled_avg_price || "0"),
        currentPrice: parseFloat(order.filled_avg_price || "0"),
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        openedAt: new Date(),
        stopLossPrice: decision.stopLoss,
        takeProfitPrice: decision.targetPrice,
      };

      this.state.activePositions.set(symbol, positionWithRules);

      console.log(`[Orchestrator] Opened position: ${symbol} $${positionValue.toFixed(2)}`);

      return {
        success: true,
        orderId: order.id,
        action: "buy",
        reason: decision.reasoning,
        symbol,
        quantity: positionWithRules.quantity,
        price: positionWithRules.entryPrice,
      };
    } catch (error) {
      console.error(`[Orchestrator] Failed to open position ${symbol}:`, error);
      return {
        success: false,
        action: "buy",
        reason: `Order failed: ${error}`,
        symbol,
        error: String(error),
      };
    }
  }

  private async closePosition(
    symbol: string,
    decision: AIDecision,
    position: PositionWithRules,
    partialPercent: number = 100
  ): Promise<ExecutionResult> {
    try {
      const isCrypto = isCryptoSymbol(symbol);
      const brokerSymbol = isCrypto ? normalizeCryptoSymbol(symbol) : symbol;

      let order;
      if (partialPercent >= 100) {
        order = await alpaca.closePosition(brokerSymbol);
      } else {
        const closeQty = (position.quantity * partialPercent) / 100;
        order = await alpaca.createOrder({
          symbol: brokerSymbol,
          qty: closeQty.toString(),
          side: "sell",
          type: "market",
          time_in_force: isCrypto ? "gtc" : "day",
        });
      }

      const pnl =
        (parseFloat(order.filled_avg_price || position.currentPrice.toString()) -
          position.entryPrice) *
        parseFloat(order.filled_qty || position.quantity.toString());

      await storage.createTrade({
        symbol,
        side: "sell",
        quantity: order.filled_qty || position.quantity.toString(),
        price: order.filled_avg_price || position.currentPrice.toString(),
        pnl: pnl.toString(),
        status: "completed",
        notes: `AI autonomous: ${decision.reasoning}`,
      });

      this.state.dailyPnl += pnl;
      this.state.dailyTradeCount++;

      if (partialPercent >= 100) {
        this.state.activePositions.delete(symbol);
      } else {
        const remaining = position.quantity * (1 - partialPercent / 100);
        position.quantity = remaining;
        this.state.activePositions.set(symbol, position);
      }

      console.log(`[Orchestrator] Closed ${partialPercent}% of ${symbol}, P&L: $${pnl.toFixed(2)}`);

      return {
        success: true,
        orderId: order.id,
        action: "sell",
        reason: decision.reasoning,
        symbol,
        quantity: parseFloat(order.filled_qty || position.quantity.toString()),
        price: parseFloat(order.filled_avg_price || position.currentPrice.toString()),
      };
    } catch (error) {
      console.error(`[Orchestrator] Failed to close position ${symbol}:`, error);
      return {
        success: false,
        action: "sell",
        reason: `Close failed: ${error}`,
        symbol,
        error: String(error),
      };
    }
  }

  private async reinforcePosition(
    symbol: string,
    decision: AIDecision,
    existingPosition: PositionWithRules
  ): Promise<ExecutionResult> {
    console.log(`[Orchestrator] Reinforcing position: ${symbol}`);

    const reinforceDecision: AIDecision = {
      ...decision,
      suggestedQuantity: (decision.suggestedQuantity || 0.05) * 0.5,
    };

    return await this.openPosition(symbol, reinforceDecision);
  }

  private async runPositionManagementCycle(): Promise<void> {
    if (!this.state.isRunning) return;

    try {
      this.state.lastPositionCheckTime = new Date();

      await this.syncPositionsFromBroker();

      for (const [symbol, position] of this.state.activePositions.entries()) {
        await this.checkPositionRules(symbol, position);
      }

      await this.rebalancePositions();
    } catch (error) {
      console.error("[Orchestrator] Position management cycle error:", error);
    }
  }

  private async checkPositionRules(
    symbol: string,
    position: PositionWithRules
  ): Promise<void> {
    if (position.stopLossPrice && position.currentPrice <= position.stopLossPrice) {
      console.log(`[Orchestrator] Stop-loss triggered for ${symbol}`);
      await this.closePosition(
        symbol,
        {
          action: "sell",
          confidence: 1,
          reasoning: `Stop-loss triggered at $${position.stopLossPrice}`,
          riskLevel: "high",
        },
        position
      );
      return;
    }

    if (position.takeProfitPrice && position.currentPrice >= position.takeProfitPrice) {
      console.log(`[Orchestrator] Take-profit triggered for ${symbol}`);

      const pnlPercent = position.unrealizedPnlPercent;
      if (pnlPercent > 15) {
        await this.closePosition(
          symbol,
          {
            action: "sell",
            confidence: 1,
            reasoning: `Take-profit fully triggered at $${position.takeProfitPrice}`,
            riskLevel: "low",
          },
          position,
          100
        );
      } else if (pnlPercent > 10) {
        await this.closePosition(
          symbol,
          {
            action: "sell",
            confidence: 0.9,
            reasoning: `Partial take-profit at $${position.currentPrice}`,
            riskLevel: "low",
          },
          position,
          50
        );
      }
      return;
    }

    if (position.unrealizedPnlPercent <= -8) {
      console.log(`[Orchestrator] Emergency stop for ${symbol} at ${position.unrealizedPnlPercent.toFixed(1)}% loss`);
      await this.closePosition(
        symbol,
        {
          action: "sell",
          confidence: 1,
          reasoning: `Emergency stop: ${position.unrealizedPnlPercent.toFixed(1)}% loss`,
          riskLevel: "high",
        },
        position
      );
    }
  }

  private calculateTotalExposure(portfolioValue: number): number {
    let totalValue = 0;
    for (const position of this.state.activePositions.values()) {
      totalValue += position.currentPrice * position.quantity;
    }
    return (totalValue / portfolioValue) * 100;
  }

  private checkDailyLossLimit(): boolean {
    const lossPercent = Math.abs(
      Math.min(0, this.state.dailyPnl) / 100000
    ) * 100;
    return lossPercent >= this.riskLimits.dailyLossLimitPercent;
  }

  getState(): OrchestratorState {
    return { ...this.state };
  }

  getRiskLimits(): RiskLimits {
    return { ...this.riskLimits };
  }

  async updateRiskLimits(limits: Partial<RiskLimits>): Promise<void> {
    this.riskLimits = { ...this.riskLimits, ...limits };

    await storage.updateAgentStatus({
      maxPositionSizePercent: limits.maxPositionSizePercent?.toString(),
      maxTotalExposurePercent: limits.maxTotalExposurePercent?.toString(),
      maxPositionsCount: limits.maxPositionsCount,
      dailyLossLimitPercent: limits.dailyLossLimitPercent?.toString(),
      killSwitchActive: limits.killSwitchActive,
    });

    console.log("[Orchestrator] Updated risk limits:", this.riskLimits);
  }

  async setMode(mode: "autonomous" | "semi-auto" | "manual"): Promise<void> {
    if (mode === "autonomous" && !this.state.isRunning) {
      await this.start();
    } else if (mode === "manual" && this.state.isRunning) {
      await this.stop();
    }
    this.state.mode = mode;
  }

  getMode(): string {
    return this.state.mode;
  }

  resetDailyStats(): void {
    this.state.dailyPnl = 0;
    this.state.dailyTradeCount = 0;
    console.log("[Orchestrator] Reset daily stats");
  }

  async rebalancePositions(): Promise<void> {
    try {
      const account = await alpaca.getAccount();
      const portfolioValue = parseFloat(account.portfolio_value);
      
      if (portfolioValue <= 0) {
        console.log("[Orchestrator] Cannot rebalance: invalid portfolio value");
        return;
      }

      const targetAllocationPercent = this.riskLimits.maxPositionSizePercent;
      const rebalanceThresholdPercent = 2;

      for (const [symbol, position] of this.state.activePositions.entries()) {
        const positionValue = position.currentPrice * position.quantity;
        const currentAllocationPercent = (positionValue / portfolioValue) * 100;
        const drift = currentAllocationPercent - targetAllocationPercent;

        if (Math.abs(drift) > rebalanceThresholdPercent) {
          console.log(`[Orchestrator] Position ${symbol} drifted by ${drift.toFixed(2)}%`);

          if (drift > rebalanceThresholdPercent) {
            const excessValue = positionValue - (portfolioValue * targetAllocationPercent / 100);
            const sharesToSell = Math.floor(excessValue / position.currentPrice);
            
            if (sharesToSell > 0 && sharesToSell < position.quantity) {
              console.log(`[Orchestrator] Rebalancing: Selling ${sharesToSell} shares of ${symbol}`);
              await this.closePosition(
                symbol,
                {
                  action: "sell",
                  confidence: 0.8,
                  reasoning: `Rebalancing: Position overweight by ${drift.toFixed(1)}%`,
                  riskLevel: "low",
                },
                position,
                (sharesToSell / position.quantity) * 100
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("[Orchestrator] Rebalancing error:", error);
      this.state.errors.push(`Rebalancing failed: ${error}`);
    }
  }

  async adjustStopLossTakeProfit(
    symbol: string,
    newStopLoss?: number,
    newTakeProfit?: number,
    trailingStopPercent?: number
  ): Promise<boolean> {
    const position = this.state.activePositions.get(symbol);
    if (!position) {
      console.log(`[Orchestrator] Cannot adjust SL/TP: Position ${symbol} not found`);
      return false;
    }

    if (newStopLoss !== undefined) {
      if (newStopLoss >= position.currentPrice) {
        console.log(`[Orchestrator] Invalid stop loss: $${newStopLoss} >= current price $${position.currentPrice}`);
        return false;
      }
      position.stopLossPrice = newStopLoss;
    }

    if (newTakeProfit !== undefined) {
      if (newTakeProfit <= position.currentPrice) {
        console.log(`[Orchestrator] Invalid take profit: $${newTakeProfit} <= current price $${position.currentPrice}`);
        return false;
      }
      position.takeProfitPrice = newTakeProfit;
    }

    if (trailingStopPercent !== undefined) {
      if (trailingStopPercent <= 0 || trailingStopPercent >= 100) {
        console.log(`[Orchestrator] Invalid trailing stop percent: ${trailingStopPercent}`);
        return false;
      }
      position.trailingStopPercent = trailingStopPercent;
    }

    this.state.activePositions.set(symbol, position);
    console.log(`[Orchestrator] Updated ${symbol} - SL: $${position.stopLossPrice?.toFixed(2)}, TP: $${position.takeProfitPrice?.toFixed(2)}, Trail: ${position.trailingStopPercent || 'N/A'}%`);
    return true;
  }

  async applyTrailingStopToAllPositions(trailPercent: number = 5): Promise<void> {
    for (const [symbol, position] of this.state.activePositions.entries()) {
      if (position.unrealizedPnlPercent > 0) {
        position.trailingStopPercent = trailPercent;
        this.state.activePositions.set(symbol, position);
        console.log(`[Orchestrator] Applied ${trailPercent}% trailing stop to ${symbol}`);
      }
    }
  }
}

export const orchestrator = new AutonomousOrchestrator();
