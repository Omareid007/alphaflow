import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { aiDecisionEngine, type AIDecision } from "../ai/decision-engine";
import { generateTraceId } from "../ai/llmGateway";
import type { Strategy } from "@shared/schema";
import { eventBus, logger } from "../orchestration";
import { log } from "../utils/logger";
import { cacheQuickQuote, cacheTradability, cacheAccountSnapshot } from "../lib/order-execution-cache";
import { getOrderCacheStats } from "../lib/order-execution-cache";

// Import types from extracted modules
import type {
  AlpacaTradeRequest,
  AlpacaTradeResult,
  TargetAllocation,
  CurrentAllocation,
  RebalanceTrade,
  RebalancePreview,
  RebalanceResult,
  StrategyRunState
} from "./engine-types";

// Import utilities from extracted modules
import { isCryptoSymbol, normalizeSymbolForAlpaca, normalizeCryptoSymbol, getDefaultWatchlist } from "./symbol-normalizer";
import * as brokerConnection from "./broker-connection";

// Import coordinators from extracted modules
import { orchestratorController } from "./orchestrator-controller";
import { aiAnalyzer } from "./ai-analyzer";
import { orderExecutor } from "./order-executor";
import { positionManager } from "./position-manager";
import { strategyRunner } from "./strategy-runner";
import { portfolioRebalancer } from "./portfolio-rebalancer";

/**
 * AlpacaTradingEngine - Thin coordinator for trading operations
 *
 * This class delegates to specialized modules for:
 * - Orchestrator control (orchestrator-controller)
 * - Symbol normalization (symbol-normalizer)
 * - Broker connectivity (broker-connection)
 * - Order execution (order-executor)
 * - Position management (position-manager)
 * - Strategy execution (strategy-runner)
 * - Portfolio rebalancing (portfolio-rebalancer)
 * - AI analysis (ai-analyzer)
 */
class AlpacaTradingEngine {
  private backgroundGeneratorInterval: ReturnType<typeof setInterval> | null = null;
  private backgroundGeneratorIntervalMs = 120000;
  private initialized = false;
  private autoStartStrategyId: string | null = null;

  // ============================================================================
  // ORCHESTRATOR CONTROL (delegates to orchestrator-controller)
  // ============================================================================

  enableOrchestratorControl(): void {
    orchestratorController.enableOrchestratorControl();
  }

  disableOrchestratorControl(): void {
    orchestratorController.disableOrchestratorControl();
  }

  isOrchestratorControlEnabled(): boolean {
    return orchestratorController.isOrchestratorControlEnabled();
  }

  // ============================================================================
  // INITIALIZATION & BACKGROUND GENERATOR
  // ============================================================================

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
          assets: getDefaultWatchlist(),
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

      // Auto-start active strategies after 5 seconds
      setTimeout(async () => {
        try {
          const isConnected = await brokerConnection.isAlpacaConnected();
          if (isConnected) {
            log.info("AlpacaTradingEngine", "Alpaca connected, auto-starting all active strategies...");
            const allStrategies = await storage.getStrategies();
            const activeStrategies = allStrategies.filter(s => s.isActive);

            for (const strategy of activeStrategies) {
              if (!strategyRunner.getStrategyState(strategy.id)?.isRunning) {
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

      const symbols = getDefaultWatchlist().slice(0, 10);
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

      const symbolsToAnalyze = getDefaultWatchlist().slice(0, 5);

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

  // ============================================================================
  // BROKER CONNECTION (delegates to broker-connection)
  // ============================================================================

  async isAlpacaConnected(): Promise<boolean> {
    return brokerConnection.isAlpacaConnected();
  }

  async getAlpacaAccount() {
    return brokerConnection.getAlpacaAccount();
  }

  async getAlpacaPositions() {
    return brokerConnection.getAlpacaPositions();
  }

  async getMarketStatus() {
    return brokerConnection.getMarketStatus();
  }

  async getClock() {
    return brokerConnection.getClock();
  }

  async canTradeExtendedHours(symbol: string) {
    return brokerConnection.canTradeExtendedHours(symbol, isCryptoSymbol);
  }

  // ============================================================================
  // ORDER EXECUTION (delegates to order-executor)
  // ============================================================================

  async executeAlpacaTrade(request: AlpacaTradeRequest): Promise<AlpacaTradeResult> {
    return orderExecutor.executeAlpacaTrade(request);
  }

  // ============================================================================
  // POSITION MANAGEMENT (delegates to position-manager)
  // ============================================================================

  async closeAlpacaPosition(
    symbol: string,
    strategyId?: string,
    options: {
      isStopLossTriggered?: boolean;
      isEmergencyStop?: boolean;
      authorizedByOrchestrator?: boolean;
    } = {}
  ): Promise<AlpacaTradeResult> {
    return positionManager.closeAlpacaPosition(symbol, strategyId, options);
  }

  async reconcilePositions() {
    return positionManager.reconcilePositions();
  }

  async syncPositionsFromAlpaca(userId?: string) {
    return positionManager.syncPositionsFromAlpaca(userId);
  }

  async closeAllPositions(options: {
    authorizedByOrchestrator?: boolean;
    isEmergencyStop?: boolean;
  } = {}) {
    return positionManager.closeAllPositions(options);
  }

  async getOpenOrders() {
    return await alpaca.getOrders("open", 100);
  }

  async getOrderDetails(orderId: string) {
    return await alpaca.getOrder(orderId);
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
            log.info("AlpacaTradingEngine", `Cancelled stale ${order.status} order`, {
              orderId: order.id,
              symbol: order.symbol,
              ageMinutes: Math.round(ageMinutes),
              threshold: effectiveMaxAgeMinutes
            });
          } catch (err) {
            errors.push({ orderId: order.id, error: (err as Error).message });
          }
        }
      }

      log.info("AlpacaTradingEngine", "Stale order cancellation complete", {
        cancelled: cancelled.length,
        errors: errors.length
      });
    } catch (err) {
      log.error("AlpacaTradingEngine", "Failed to cancel stale orders", {
        error: (err as Error).message
      });
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
        log.info("AlpacaTradingEngine", "No open orders to cancel");
        return { cancelled: 0, ordersCancelledBefore: 0, remainingAfter: 0 };
      }

      await alpaca.cancelAllOrders();

      const ordersAfter = await alpaca.getOrders("open", 100);
      const countAfter = ordersAfter.length;
      const cancelledCount = countBefore - countAfter;

      log.info("AlpacaTradingEngine", "Cancelled all open orders", {
        before: countBefore,
        after: countAfter,
        cancelled: cancelledCount
      });

      return {
        cancelled: cancelledCount,
        ordersCancelledBefore: countBefore,
        remainingAfter: countAfter,
      };
    } catch (err) {
      log.error("AlpacaTradingEngine", "Failed to cancel all orders", {
        error: (err as Error).message
      });
      return {
        cancelled: 0,
        ordersCancelledBefore: 0,
        remainingAfter: 0,
        error: (err as Error).message,
      };
    }
  }

  // ============================================================================
  // AI ANALYSIS (delegates to ai-analyzer)
  // ============================================================================

  async analyzeSymbol(
    symbol: string,
    strategyId?: string,
    traceId?: string
  ) {
    return aiAnalyzer.analyzeSymbol(symbol, strategyId, traceId);
  }

  async analyzeAndExecute(
    symbol: string,
    strategyId?: string,
    traceId?: string
  ): Promise<{ decision: AIDecision; tradeResult?: AlpacaTradeResult }> {
    const effectiveTraceId = traceId || generateTraceId();
    const { decision } = await aiAnalyzer.analyzeSymbol(symbol, strategyId, effectiveTraceId);

    // Check orchestrator control before executing
    if (orchestratorController.isOrchestratorControlEnabled()) {
      log.info("AlpacaTradingEngine", "Analysis complete - orchestrator has control, skipping autonomous execution", {
        symbol,
        action: decision.action,
        confidence: `${(decision.confidence * 100).toFixed(0)}%`
      });
      return { decision };
    }

    // Check if agent is running
    const agentStatus = await storage.getAgentStatus();
    if (!agentStatus?.isRunning) {
      return { decision };
    }

    // Only proceed with execution if confidence is high enough
    if (decision.action === "hold" || decision.confidence < 0.6) {
      return { decision };
    }

    // Execute the trade based on AI decision
    try {
      const tradeRequest: AlpacaTradeRequest = {
        symbol,
        side: decision.action === "buy" ? "buy" : "sell",
        quantity: decision.suggestedQuantity || 1,
        strategyId,
        notes: `AI Decision: ${decision.reasoning}`,
      };

      const tradeResult = await orderExecutor.executeAlpacaTrade(tradeRequest);

      if (tradeResult.success && tradeResult.trade) {
        await aiAnalyzer.linkAiDecisionToTrade(symbol, strategyId, tradeResult.trade.id);
      }

      return { decision, tradeResult };
    } catch (error) {
      log.error("AlpacaTradingEngine", "Trade execution failed", {
        symbol,
        error: (error as Error).message
      });
      return {
        decision,
        tradeResult: {
          success: false,
          error: (error as Error).message
        }
      };
    }
  }

  // ============================================================================
  // STRATEGY MANAGEMENT (delegates to strategy-runner)
  // ============================================================================

  async startStrategy(strategyId: string): Promise<{ success: boolean; error?: string }> {
    // Check orchestrator control before starting strategy
    if (orchestratorController.isOrchestratorControlEnabled()) {
      log.info("AlpacaTradingEngine", "Strategy start skipped - orchestrator has control", { strategyId });
      return { success: false, error: "Orchestrator has control - autonomous strategy execution disabled. Use orchestrator for trade execution." };
    }

    const result = await strategyRunner.startStrategy(
      strategyId,
      (symbol, strategyId, traceId) => this.analyzeAndExecute(symbol, strategyId, traceId)
    );

    if (result.success) {
      const strategy = await storage.getStrategy(strategyId);
      eventBus.emit("strategy:started", { strategyId, strategyName: strategy?.name || strategyId }, "alpaca-trading-engine");
      if (strategy) {
        logger.strategy(strategy.name, "Started", { assets: strategy.assets });
      }
    }

    return result;
  }

  async stopStrategy(strategyId: string): Promise<{ success: boolean; error?: string }> {
    const result = await strategyRunner.stopStrategy(strategyId);

    const strategy = await storage.getStrategy(strategyId);
    eventBus.emit("strategy:stopped", { strategyId, strategyName: strategy?.name || strategyId }, "alpaca-trading-engine");
    logger.strategy(strategy?.name || strategyId, "Stopped");

    return result;
  }

  async stopAllStrategies(): Promise<void> {
    await strategyRunner.stopAllStrategies();
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
      const isConnected = await brokerConnection.isAlpacaConnected();
      if (isConnected) {
        await this.startStrategy(this.autoStartStrategyId);
      }
    }
  }

  getStrategyState(strategyId: string): StrategyRunState | undefined {
    return strategyRunner.getStrategyState(strategyId);
  }

  getAllStrategyStates(): StrategyRunState[] {
    return strategyRunner.getAllStrategyStates();
  }

  getRunningStrategiesCount(): number {
    return strategyRunner.getRunningStrategiesCount();
  }

  // ============================================================================
  // PORTFOLIO REBALANCING (delegates to portfolio-rebalancer)
  // ============================================================================

  async getCurrentAllocations() {
    return positionManager.getCurrentAllocations();
  }

  async previewRebalance(targetAllocations: TargetAllocation[]): Promise<RebalancePreview> {
    return portfolioRebalancer.previewRebalance(
      targetAllocations,
      () => positionManager.getCurrentAllocations()
    );
  }

  async executeRebalance(
    targetAllocations: TargetAllocation[],
    dryRun: boolean = false
  ): Promise<RebalanceResult> {
    return portfolioRebalancer.executeRebalance(
      targetAllocations,
      dryRun,
      () => positionManager.getCurrentAllocations(),
      (req) => orderExecutor.executeAlpacaTrade(req)
    );
  }

  async getRebalanceSuggestions() {
    return portfolioRebalancer.getRebalanceSuggestions(
      () => positionManager.getCurrentAllocations(),
      () => getDefaultWatchlist()
    );
  }

  // ============================================================================
  // STATUS & UTILITIES
  // ============================================================================

  getStatus(): {
    alpacaConnected: boolean;
    runningStrategies: number;
    strategyStates: StrategyRunState[];
  } {
    const states = this.getAllStrategyStates();
    return {
      alpacaConnected: alpaca.getConnectionStatus().hasCredentials,
      runningStrategies: this.getRunningStrategiesCount(),
      strategyStates: states,
    };
  }
}

export const alpacaTradingEngine = new AlpacaTradingEngine();

// Re-export types for backward compatibility
export type {
  AlpacaTradeRequest,
  AlpacaTradeResult,
  TargetAllocation,
  CurrentAllocation,
  RebalanceTrade,
  RebalancePreview,
  RebalanceResult,
  StrategyRunState
};
