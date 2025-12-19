import { eventBus, type TradingEvent, type MarketDataEvent, type StrategySignalEvent, type TradeExecutedEvent, type PositionEvent } from "./events";
import { logger } from "./logger";
import { storage } from "../storage";

export interface CoordinatorConfig {
  heartbeatIntervalMs: number;
  autoReconcileEnabled: boolean;
  reconcileIntervalMs: number;
  maxConcurrentStrategies: number;
  emergencyStopLossPercent: number;
}

export interface SystemStatus {
  isRunning: boolean;
  activeStrategies: number;
  openPositions: number;
  totalTrades24h: number;
  lastHeartbeat: Date | null;
  errors: number;
  warnings: number;
  uptime: number;
}

class TradingCoordinator {
  private config: CoordinatorConfig;
  private startTime: Date;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconcileInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private activeStrategies: Set<string> = new Set();
  private errorCount = 0;
  private warningCount = 0;
  private tradeCount24h = 0;

  constructor() {
    this.config = {
      heartbeatIntervalMs: 30000,
      autoReconcileEnabled: true,
      reconcileIntervalMs: 300000,
      maxConcurrentStrategies: 10,
      emergencyStopLossPercent: 10,
    };
    this.startTime = new Date();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.subscribe<StrategySignalEvent>("strategy:signal", (event) => {
      this.handleStrategySignal(event);
    });

    eventBus.subscribe<TradeExecutedEvent>("trade:executed", (event) => {
      this.handleTradeExecuted(event);
    });

    eventBus.subscribe<{ message: string; details?: Record<string, unknown> }>("trade:error", (event) => {
      this.handleTradeError(event);
    });

    eventBus.subscribe("system:error", () => {
      this.errorCount++;
    });

    eventBus.subscribe("system:warning", () => {
      this.warningCount++;
    });

    eventBus.subscribe("strategy:started", (event: TradingEvent<{ strategyId: string }>) => {
      this.activeStrategies.add(event.data.strategyId);
      logger.strategy(event.data.strategyId, "Started");
    });

    eventBus.subscribe("strategy:stopped", (event: TradingEvent<{ strategyId: string }>) => {
      this.activeStrategies.delete(event.data.strategyId);
      logger.strategy(event.data.strategyId, "Stopped");
    });
  }

  private handleStrategySignal(event: TradingEvent<StrategySignalEvent>): void {
    const { strategyName, symbol, signal, confidence, reason } = event.data;
    logger.strategy(strategyName, `Signal: ${signal.toUpperCase()} ${symbol}`, {
      confidence,
      reason,
    });
  }

  private handleTradeExecuted(event: TradingEvent<TradeExecutedEvent>): void {
    const { symbol, side, quantity, price, status } = event.data;
    this.tradeCount24h++;
    logger.trade(`${side.toUpperCase()} ${quantity} ${symbol} @ $${price}`, {
      status,
      tradeId: event.data.tradeId,
      orderId: event.data.orderId,
    });
  }

  private handleTradeError(event: TradingEvent<{ message: string; details?: Record<string, unknown> }>): void {
    this.errorCount++;
    logger.error("TRADE", event.data.message, event.data.details);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("COORDINATOR", "Coordinator is already running");
      return;
    }

    logger.info("COORDINATOR", "Starting trading coordinator...");
    this.isRunning = true;
    this.startTime = new Date();

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatIntervalMs);

    if (this.config.autoReconcileEnabled) {
      this.reconcileInterval = setInterval(() => {
        this.reconcilePositions();
      }, this.config.reconcileIntervalMs);
    }

    await storage.updateAgentStatus({
      isRunning: true,
      lastHeartbeat: new Date(),
    });

    eventBus.emit("system:heartbeat", { status: "started" }, "coordinator");
    logger.info("COORDINATOR", "Trading coordinator started successfully");
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn("COORDINATOR", "Coordinator is not running");
      return;
    }

    logger.info("COORDINATOR", "Stopping trading coordinator...");

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconcileInterval) {
      clearInterval(this.reconcileInterval);
      this.reconcileInterval = null;
    }

    this.isRunning = false;

    await storage.updateAgentStatus({
      isRunning: false,
      lastHeartbeat: new Date(),
    });

    eventBus.emit("system:heartbeat", { status: "stopped" }, "coordinator");
    logger.info("COORDINATOR", "Trading coordinator stopped");
  }

  private sendHeartbeat(): void {
    eventBus.emit("system:heartbeat", {
      status: "running",
      activeStrategies: this.activeStrategies.size,
      uptime: Date.now() - this.startTime.getTime(),
    }, "coordinator");

    storage.updateAgentStatus({ lastHeartbeat: new Date() }).catch((err) => {
      logger.error("COORDINATOR", "Failed to update heartbeat in database", { error: String(err) });
    });
  }

  private async reconcilePositions(): Promise<void> {
    logger.info("COORDINATOR", "Starting position reconciliation...");
    try {
      eventBus.emit("system:heartbeat", { status: "reconciling" }, "coordinator");
      logger.info("COORDINATOR", "Position reconciliation completed");
    } catch (error) {
      logger.error("COORDINATOR", "Position reconciliation failed", { error: String(error) });
    }
  }

  emitMarketData(data: MarketDataEvent): void {
    eventBus.emit("market:data:update", data, "market-connector");
  }

  emitStrategySignal(signal: StrategySignalEvent): void {
    eventBus.emit("strategy:signal", signal, signal.strategyName);
  }

  emitTradeExecuted(trade: TradeExecutedEvent): void {
    eventBus.emit("trade:executed", trade, "trading-engine");
  }

  emitPositionUpdate(position: PositionEvent): void {
    eventBus.emit("position:updated", position, "position-manager");
  }

  registerStrategy(strategyId: string): boolean {
    if (this.activeStrategies.size >= this.config.maxConcurrentStrategies) {
      logger.warn("COORDINATOR", `Max concurrent strategies (${this.config.maxConcurrentStrategies}) reached`);
      return false;
    }

    this.activeStrategies.add(strategyId);
    eventBus.emit("strategy:started", { strategyId }, "coordinator");
    return true;
  }

  unregisterStrategy(strategyId: string): void {
    this.activeStrategies.delete(strategyId);
    eventBus.emit("strategy:stopped", { strategyId }, "coordinator");
  }

  getStatus(): SystemStatus {
    return {
      isRunning: this.isRunning,
      activeStrategies: this.activeStrategies.size,
      openPositions: 0,
      totalTrades24h: this.tradeCount24h,
      lastHeartbeat: this.isRunning ? new Date() : null,
      errors: this.errorCount,
      warnings: this.warningCount,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  updateConfig(updates: Partial<CoordinatorConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info("COORDINATOR", "Configuration updated", { config: this.config });
  }

  getConfig(): CoordinatorConfig {
    return { ...this.config };
  }

  resetStats(): void {
    this.errorCount = 0;
    this.warningCount = 0;
    this.tradeCount24h = 0;
    logger.info("COORDINATOR", "Statistics reset");
  }

  async triggerReconcileNow(): Promise<{ success: boolean; message: string }> {
    if (!this.isRunning) {
      return { success: false, message: "Coordinator is not running" };
    }
    logger.info("COORDINATOR", "Manual reconciliation triggered");
    await this.reconcilePositions();
    return { success: true, message: "Reconciliation triggered" };
  }

  getActiveStrategies(): string[] {
    return Array.from(this.activeStrategies);
  }
}

export const coordinator = new TradingCoordinator();
