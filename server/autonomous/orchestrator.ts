/**
 * Autonomous Orchestrator - Thin Coordinator
 *
 * This is the central coordinator for autonomous trading. It owns the state
 * and coordinates between specialized managers:
 * - LifecycleManager: Health monitoring, auto-start, self-healing
 * - PositionManager: Opening, closing, and managing positions
 * - RebalancingManager: Portfolio rebalancing, buy-the-dip, pyramid-up
 *
 * The orchestrator focuses on:
 * - Running analysis cycles to generate trading signals
 * - Processing signals and delegating execution to managers
 * - Maintaining the core state (positions, PnL, errors)
 * - Providing the public API for external control
 */

import { aiDecisionEngine, AIDecision } from "../ai/decision-engine";
import { storage } from "../storage";
import type { Strategy } from "@shared/schema";
import { toDecimal } from "../utils/money";
import { marketConditionAnalyzer } from "../ai/market-condition-analyzer";
import { log } from "../utils/logger";
import { cancelExpiredOrders } from "../trading/order-execution-flow";
import { recordDecisionFeatures, runCalibrationAnalysis } from "../ai/learning-service";
import { candidatesService } from "../universe/candidatesService";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";
import { tradingSessionManager } from "../services/trading-session-manager";

// Types and constants from extracted modules
import {
  OrchestratorConfig,
  OrchestratorState,
  RiskLimits,
  PositionWithRules,
  ExecutionResult,
  DEFAULT_CONFIG,
  DEFAULT_RISK_LIMITS,
} from "./types";

// Utilities from extracted modules
import { getWatchlist } from "./watchlist-cache";
import { getAnalysisUniverseSymbols } from "./universe-builder";
import { fetchMarketData } from "./market-data-fetcher";
import { syncPositionsFromBroker } from "./position-sync";

// Managers from extracted modules
import { LifecycleManager, OrchestratorInterface } from "./lifecycle-manager";
import { PositionManager } from "./position-manager";
import { RebalancingManager, OrchestratorReference } from "./rebalancing-manager";

// Re-export types for backward compatibility
export type {
  OrchestratorConfig,
  OrchestratorState,
  RiskLimits,
  PositionWithRules,
  ExecutionResult,
} from "./types";

export type { UniverseSymbols } from "./universe-builder";

/**
 * AutonomousOrchestrator - Thin coordinator for autonomous trading
 *
 * This class:
 * - Owns the trading state (OrchestratorState)
 * - Coordinates analysis and position management cycles
 * - Delegates actual work to specialized managers
 * - Provides the public API for external control
 */
class AutonomousOrchestrator implements OrchestratorInterface {
  private state: OrchestratorState;
  private config: OrchestratorConfig;
  private riskLimits: RiskLimits;
  private analysisTimer: NodeJS.Timeout | null = null;
  private positionTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private lastCalibrationDate: string | null = null;
  private currentTraceId: string | null = null;
  private userId: string | null = null;

  // Managers - initialized in constructor
  private lifecycleManager: LifecycleManager;
  private positionManager: PositionManager;
  private rebalancingManager: RebalancingManager;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.riskLimits = { ...DEFAULT_RISK_LIMITS };
    this.state = {
      isRunning: false,
      mode: "autonomous",
      lastAnalysisTime: null,
      lastPositionCheckTime: null,
      activePositions: new Map(),
      pendingSignals: new Map(),
      executionHistory: [],
      dailyPnl: 0,
      dailyTradeCount: 0,
      errors: [],
    };

    // Initialize managers with references to this orchestrator
    this.lifecycleManager = new LifecycleManager(this);
    this.positionManager = new PositionManager(this.state, this.riskLimits, this.userId);

    // Create orchestrator reference for rebalancing manager
    const orchestratorRef: OrchestratorReference = {
      state: this.state,
      currentTraceId: this.currentTraceId,
      syncPositionsFromBroker: () => this.syncPositionsFromBroker(),
      closePosition: (symbol, decision, position, partialPercent) =>
        this.positionManager.closePosition(symbol, decision, position, partialPercent),
    };
    this.rebalancingManager = new RebalancingManager(orchestratorRef, this.riskLimits);
  }

  // ============================================================================
  // ORCHESTRATOR INTERFACE (for LifecycleManager)
  // ============================================================================

  getState(): OrchestratorState {
    return { ...this.state };
  }

  setState(updates: Partial<OrchestratorState>): void {
    Object.assign(this.state, updates);
  }

  setUserId(userId: string): void {
    this.userId = userId;
    this.positionManager.setUserId(userId);
  }

  // ============================================================================
  // LIFECYCLE DELEGATION
  // ============================================================================

  async autoStart(): Promise<void> {
    return this.lifecycleManager.autoStart();
  }

  async setAutoStartEnabled(enabled: boolean): Promise<void> {
    return this.lifecycleManager.setAutoStartEnabled(enabled);
  }

  isAutoStartEnabledFlag(): boolean {
    return this.lifecycleManager.isAutoStartEnabledFlag();
  }

  getHealthStatus(): {
    isHealthy: boolean;
    lastHeartbeat: Date | null;
    consecutiveErrors: number;
    autoStartEnabled: boolean;
    marketCondition: string | null;
    dynamicOrderLimit: number;
  } {
    return this.lifecycleManager.getHealthStatus();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<void> {
    await this.loadRiskLimitsFromDB();
    await this.syncPositionsFromBroker();

    // Bootstrap universe candidates if empty
    const watchlist = await getWatchlist();
    const allSymbols = [...watchlist.stocks, ...watchlist.crypto.map(c => `${c}/USD`)];
    await candidatesService.ensureWatchlistApproved(allSymbols, "orchestrator-init");

    log.info("Orchestrator", "Initialized with risk limits", { ...this.riskLimits });
  }

  private async loadRiskLimitsFromDB(): Promise<void> {
    try {
      const agentStatus = await storage.getAgentStatus();
      const dynamicLimit = marketConditionAnalyzer.getCurrentOrderLimit();

      if (agentStatus) {
        this.riskLimits = {
          maxPositionSizePercent: Number(agentStatus.maxPositionSizePercent) || 10,
          maxTotalExposurePercent: Number(agentStatus.maxTotalExposurePercent) || 50,
          maxPositionsCount: Number(agentStatus.maxPositionsCount) || agentStatus.dynamicOrderLimit || dynamicLimit || 10,
          dailyLossLimitPercent: Number(agentStatus.dailyLossLimitPercent) || 5,
          killSwitchActive: agentStatus.killSwitchActive || false,
        };
        // Update managers with new risk limits
        this.positionManager.updateRiskLimits(this.riskLimits);
        log.info("Orchestrator", "Loaded risk limits from DB", {
          maxPositionSizePercent: this.riskLimits.maxPositionSizePercent,
          maxTotalExposurePercent: this.riskLimits.maxTotalExposurePercent,
          maxPositionsCount: this.riskLimits.maxPositionsCount,
          dailyLossLimitPercent: this.riskLimits.dailyLossLimitPercent,
        });
      }
    } catch (error) {
      log.error("Orchestrator", "Failed to load risk limits", { error: String(error) });
    }
  }

  // ============================================================================
  // POSITION SYNC (delegates to extracted module)
  // ============================================================================

  async syncPositionsFromBroker(): Promise<void> {
    await syncPositionsFromBroker(this.state, this.userId);
  }

  // ============================================================================
  // START/STOP CONTROL
  // ============================================================================

  async start(): Promise<void> {
    if (this.state.isRunning) {
      log.info("Orchestrator", "Already running");
      return;
    }

    await this.initialize();

    if (this.riskLimits.killSwitchActive) {
      log.warn("Orchestrator", "Kill switch is active - cannot start");
      throw new Error("Kill switch is active. Disable it to start autonomous trading.");
    }

    alpacaTradingEngine.enableOrchestratorControl();
    log.info("Orchestrator", "Enabled orchestrator control over AlpacaTradingEngine");

    this.state.isRunning = true;
    this.state.mode = "autonomous";
    this.state.errors = [];

    await storage.updateAgentStatus({ isRunning: true });

    this.analysisTimer = setInterval(() => {
      this.runAnalysisCycle().catch((err) => {
        log.error("Orchestrator", "Analysis cycle error", { error: String(err) });
        this.state.errors.push(`Analysis error: ${err.message}`);
      });
    }, this.config.analysisIntervalMs) as unknown as NodeJS.Timeout;

    this.positionTimer = setInterval(() => {
      this.runPositionManagementCycle().catch((err) => {
        log.error("Orchestrator", "Position management error", { error: String(err) });
        this.state.errors.push(`Position mgmt error: ${err.message}`);
      });
    }, this.config.positionCheckIntervalMs) as unknown as NodeJS.Timeout;

    await this.runAnalysisCycle();
    await this.runPositionManagementCycle();

    log.info("Orchestrator", "Started autonomous trading mode");
  }

  async stop(preserveAutoStart = false): Promise<void> {
    if (!this.state.isRunning) {
      log.info("Orchestrator", "Not running");
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

    this.lifecycleManager.stopHeartbeat();
    marketConditionAnalyzer.stop();

    alpacaTradingEngine.disableOrchestratorControl();
    log.info("Orchestrator", "Disabled orchestrator control - AlpacaTradingEngine can now trade autonomously");

    await storage.updateAgentStatus({ isRunning: false });

    log.info("Orchestrator", "Stopped autonomous trading mode");
  }

  // ============================================================================
  // KILL SWITCH
  // ============================================================================

  async activateKillSwitch(reason: string): Promise<void> {
    log.warn("Orchestrator", `KILL SWITCH ACTIVATED: ${reason}`);

    this.riskLimits.killSwitchActive = true;
    await this.stop();

    await storage.updateAgentStatus({ killSwitchActive: true });

    this.state.errors.push(`Kill switch activated: ${reason}`);
  }

  async deactivateKillSwitch(): Promise<void> {
    this.riskLimits.killSwitchActive = false;
    await storage.updateAgentStatus({ killSwitchActive: false });
    log.info("Orchestrator", "Kill switch deactivated");
  }

  // ============================================================================
  // ANALYSIS CYCLE
  // ============================================================================

  private async runAnalysisCycle(): Promise<void> {
    if (this.isProcessing || !this.state.isRunning) return;
    this.isProcessing = true;
    const cycleId = log.generateCycleId();
    log.setCycleId(cycleId);
    this.currentTraceId = cycleId;
    this.positionManager.setTraceId(cycleId);

    try {
      // Log market session info at cycle start
      const allSessions = tradingSessionManager.getAllSessionInfo();
      log.info("Orchestrator", "Running analysis cycle...", {
        cycleId,
        traceId: cycleId,
        marketSessions: {
          usEquities: allSessions.US_EQUITIES.session,
          crypto: allSessions.CRYPTO.session,
          usEquitiesOpen: allSessions.US_EQUITIES.isOpen,
          nextOpen: allSessions.US_EQUITIES.nextOpen?.toISOString(),
        }
      });
      this.state.lastAnalysisTime = new Date();

      await this.loadRiskLimitsFromDB();

      if (this.riskLimits.killSwitchActive) {
        log.info("Orchestrator", "Kill switch active - skipping analysis");
        return;
      }

      const canceledOrderCount = await cancelExpiredOrders();
      if (canceledOrderCount > 0) {
        log.info("Orchestrator", `Analysis cycle: cleaned up ${canceledOrderCount} stale pending orders`);
      }

      // Daily calibration check
      const today = new Date().toISOString().split("T")[0];
      if (this.lastCalibrationDate !== today) {
        this.lastCalibrationDate = today;
        runCalibrationAnalysis(30).catch(err =>
          log.error("Orchestrator", `Calibration failed: ${err}`)
        );
        log.info("Orchestrator", "Daily AI calibration triggered");
      }

      if (this.checkDailyLossLimit()) {
        await this.activateKillSwitch("Daily loss limit exceeded");
        return;
      }

      // Fetch market data using extracted module
      const universe = await getAnalysisUniverseSymbols();
      const marketData = await fetchMarketData(universe);

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
              : undefined,
            { traceId: this.currentTraceId || undefined }
          );

          if (decision.confidence >= 0.7 && decision.action !== "hold" && this.userId) {
            const aiDecision = await storage.createAiDecision({
              userId: this.userId,
              strategyId: strategy?.id || null,
              symbol,
              action: decision.action,
              confidence: decision.confidence.toString(),
              reasoning: decision.reasoning,
              marketContext: JSON.stringify(data),
              status: "pending",
              traceId: this.currentTraceId,
            });

            recordDecisionFeatures(aiDecision.id, symbol, {
              volatility: data.priceChangePercent24h ? Math.abs(data.priceChangePercent24h) / 10 : undefined,
              priceChangePercent: data.priceChangePercent24h,
              marketCondition: this.state.mode,
            }).catch(err => log.error("Orchestrator", `Failed to record features: ${err}`));

            // AUTO-APPROVE: Dynamically approve symbols with high-confidence buy signals
            if (decision.action === "buy" && decision.confidence >= 0.7) {
              this.autoApproveSymbol(symbol).catch(err =>
                log.warn("Orchestrator", `Auto-approve failed for ${symbol}: ${err}`)
              );
            }

            this.state.pendingSignals.set(symbol, { ...decision, aiDecisionId: aiDecision.id });
          }
        } catch (error) {
          log.error("Orchestrator", `Analysis failed for ${symbol}`, { error: String(error) });
        }
      }

      await this.processSignals();
    } finally {
      this.isProcessing = false;
    }
  }

  private async autoApproveSymbol(symbol: string): Promise<void> {
    try {
      const upperSymbol = symbol.toUpperCase();
      const existing = await candidatesService.getCandidateBySymbol(upperSymbol);

      if (existing?.status === "APPROVED") {
        return;
      }

      if (existing) {
        await candidatesService.approveCandidate(upperSymbol, "ai-auto-approve");
        log.info("Orchestrator", `AUTO-APPROVED: ${upperSymbol} (was ${existing.status})`);
      } else {
        await candidatesService.ensureWatchlistApproved([upperSymbol], "ai-signal");
        await candidatesService.approveCandidate(upperSymbol, "ai-auto-approve");
        log.info("Orchestrator", `AUTO-APPROVED: ${upperSymbol} (new candidate)`);
      }
    } catch (error) {
      log.warn("Orchestrator", `Failed to auto-approve ${symbol}`, { error: String(error) });
    }
  }

  // ============================================================================
  // SIGNAL PROCESSING
  // ============================================================================

  private async processSignals(): Promise<void> {
    for (const [symbol, decision] of this.state.pendingSignals.entries()) {
      let result: ExecutionResult;
      try {
        result = await this.executeSignal(symbol, decision);
      } catch (error) {
        result = {
          success: false,
          action: "skip",
          reason: `Execution error: ${String(error)}`,
          symbol,
        };
        log.error("Orchestrator", `Error executing signal for ${symbol}`, { error: String(error) });
      }

      this.state.executionHistory.push(result);

      if (decision.aiDecisionId) {
        try {
          if (result.success && result.action !== "hold" && result.action !== "skip") {
            await storage.updateAiDecision(decision.aiDecisionId, {
              status: "executed",
              filledPrice: result.price?.toString(),
              filledAt: new Date(),
            });
          } else if (result.action === "hold") {
            await storage.updateAiDecision(decision.aiDecisionId, {
              status: "skipped",
              skipReason: "Hold action - no trade executed",
            });
          } else {
            await storage.updateAiDecision(decision.aiDecisionId, {
              status: "skipped",
              skipReason: result.reason || "Trade not executed",
            });
          }
        } catch (e) {
          log.error("Orchestrator", `Failed to update AI decision status for ${decision.aiDecisionId}`, { error: String(e) });
        }
      }

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
      // Reinforcement threshold: 50% confidence
      if (decision.confidence >= 0.50) {
        log.info("Orchestrator", `Reinforcing position: ${symbol} (confidence: ${(decision.confidence * 100).toFixed(1)}%)`);
        return await this.positionManager.reinforcePosition(symbol, decision, existingPosition);
      }
      return {
        success: false,
        action: "skip",
        reason: `Already have position, confidence ${(decision.confidence * 100).toFixed(1)}% below 50% threshold`,
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
      return await this.positionManager.openPosition(symbol, decision);
    }

    if (decision.action === "sell" && existingPosition) {
      return await this.positionManager.closePosition(symbol, decision, existingPosition);
    }

    return {
      success: true,
      action: "hold",
      reason: decision.reasoning,
      symbol,
    };
  }

  // ============================================================================
  // POSITION MANAGEMENT CYCLE
  // ============================================================================

  private async runPositionManagementCycle(): Promise<void> {
    if (!this.state.isRunning) return;

    try {
      this.state.lastPositionCheckTime = new Date();

      await this.syncPositionsFromBroker();

      // Check position rules for all active positions
      for (const [symbol, position] of this.state.activePositions.entries()) {
        await this.positionManager.checkPositionRules(symbol, position);
      }

      // Delegate rebalancing to RebalancingManager
      await this.rebalancingManager.rebalancePositions();
    } catch (error) {
      log.error("Orchestrator", "Position management cycle error", { error: String(error) });
    }
  }

  // ============================================================================
  // RISK CHECKS
  // ============================================================================

  private checkDailyLossLimit(): boolean {
    const portfolioValue = this.state.portfolioValue || 100000;
    const dailyLoss = Math.min(0, this.state.dailyPnl);
    const lossPercent = toDecimal(dailyLoss).abs().dividedBy(toDecimal(portfolioValue)).times(100).toNumber();
    return lossPercent >= this.riskLimits.dailyLossLimitPercent;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  getPendingAnalysis(): { symbol: string; startedAt: Date; status: string }[] {
    const pending: { symbol: string; startedAt: Date; status: string }[] = [];

    for (const [symbol] of this.state.pendingSignals.entries()) {
      pending.push({
        symbol,
        startedAt: new Date(),
        status: "pending_execution",
      });
    }

    return pending;
  }

  getRiskLimits(): RiskLimits {
    return { ...this.riskLimits };
  }

  async updateRiskLimits(limits: Partial<RiskLimits>): Promise<void> {
    this.riskLimits = { ...this.riskLimits, ...limits };
    this.positionManager.updateRiskLimits(this.riskLimits);

    await storage.updateAgentStatus({
      maxPositionSizePercent: limits.maxPositionSizePercent?.toString(),
      maxTotalExposurePercent: limits.maxTotalExposurePercent?.toString(),
      maxPositionsCount: limits.maxPositionsCount,
      dailyLossLimitPercent: limits.dailyLossLimitPercent?.toString(),
      killSwitchActive: limits.killSwitchActive,
    });

    log.info("Orchestrator", "Updated risk limits", { ...this.riskLimits });
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
    log.info("Orchestrator", "Reset daily stats");
  }

  // Delegate to PositionManager
  async adjustStopLossTakeProfit(
    symbol: string,
    newStopLoss?: number,
    newTakeProfit?: number,
    trailingStopPercent?: number
  ): Promise<boolean> {
    return this.positionManager.adjustStopLossTakeProfit(
      symbol,
      newStopLoss,
      newTakeProfit,
      trailingStopPercent
    );
  }

  async applyTrailingStopToAllPositions(trailPercent: number = 5): Promise<void> {
    return this.positionManager.applyTrailingStopToAllPositions(trailPercent);
  }

  // Delegate to RebalancingManager
  async rebalancePositions(): Promise<void> {
    return this.rebalancingManager.rebalancePositions();
  }
}

export const orchestrator = new AutonomousOrchestrator();
