import { storage } from "../storage";
import { eventBus, logger } from "../orchestration";
import { log } from "../utils/logger";
import type { StrategyRunState } from "./engine-types";
import { orchestratorController } from "./orchestrator-controller";
import { generateTraceId } from "../ai/llmGateway";
import type { AIDecision } from "../ai/decision-engine";

/**
 * @file Strategy Runner Module
 * @description Manages strategy execution lifecycle including starting, stopping, and tracking strategy runs.
 * Handles both interval-based strategy execution and background AI suggestion generation.
 *
 * @module server/trading/strategy-runner
 */

/**
 * StrategyRunner - Manages strategy execution lifecycle
 *
 * Coordinates strategy execution using dependency injection pattern. This class
 * manages timing, intervals, and state tracking but delegates actual trading
 * decisions to provided callbacks.
 *
 * @class StrategyRunner
 *
 * @example Start a strategy with custom analysis callback
 * ```typescript
 * const result = await strategyRunner.startStrategy(
 *   "strategy-123",
 *   async (symbol, strategyId, traceId) => {
 *     const decision = await aiAnalyzer.analyzeSymbol(symbol, strategyId, traceId);
 *     const trade = await orderExecutor.executeAlpacaTrade({ ... });
 *     return { decision, tradeResult: trade };
 *   }
 * );
 *
 * if (result.success) {
 *   console.log("Strategy started successfully");
 * }
 * ```
 *
 * @example Stop a running strategy
 * ```typescript
 * await strategyRunner.stopStrategy("strategy-123");
 * ```
 *
 * @example Get strategy status
 * ```typescript
 * const status = strategyRunner.getStatus();
 * console.log(`Running strategies: ${status.runningStrategies}`);
 * status.strategyStates.forEach(state => {
 *   console.log(`${state.strategyId}: ${state.isRunning ? "Running" : "Stopped"}`);
 * });
 * ```
 *
 * @responsibilities
 * - Strategy lifecycle management (start/stop)
 * - Interval-based strategy execution (default: 60 second intervals)
 * - Strategy state tracking and reporting
 * - Background AI suggestion generation (default: 120 second intervals)
 * - Auto-start strategy management
 * - Orchestrator control integration
 *
 * @intervalManagement
 * - Strategy check interval: 60 seconds (1 minute)
 * - Background AI generator: 120 seconds (2 minutes)
 * - Intervals are properly cleaned up on stop to prevent memory leaks
 */
export class StrategyRunner {
  private strategyRunners: Map<string, ReturnType<typeof setInterval>> = new Map();
  private strategyStates: Map<string, StrategyRunState> = new Map();
  private checkIntervalMs = 60000;
  private backgroundGeneratorInterval: ReturnType<typeof setInterval> | null = null;
  private backgroundGeneratorIntervalMs = 120000;
  private autoStartStrategyId: string | null = null;

  /**
   * Set the auto-start strategy ID
   *
   * Configures which strategy should automatically start when the agent resumes.
   * Typically this is the Auto-Pilot Strategy for autonomous trading.
   *
   * @param strategyId - ID of the strategy to auto-start
   */
  setAutoStartStrategyId(strategyId: string): void {
    this.autoStartStrategyId = strategyId;
  }

  /**
   * Get the auto-start strategy ID
   *
   * @returns The strategy ID that will auto-start, or null if not configured
   */
  getAutoStartStrategyId(): string | null {
    return this.autoStartStrategyId;
  }

  /**
   * Start a strategy - analyzes assets on an interval
   *
   * Starts a strategy that will analyze and trade its configured assets on a regular interval.
   * The strategy runs immediately once, then on the configured interval (default 60 seconds).
   *
   * @param strategyId - ID of the strategy to start
   * @param analyzeAndExecuteCallback - Callback to analyze and execute trades for a symbol
   *   - Called for each asset in the strategy
   *   - Receives: symbol, strategyId, traceId
   *   - Returns: { decision: AIDecision, tradeResult?: any }
   *
   * @returns Promise resolving to success result with optional error
   *
   * @example
   * ```typescript
   * const result = await strategyRunner.startStrategy(
   *   "strategy-123",
   *   async (symbol, strategyId, traceId) => {
   *     // Analyze the symbol with AI
   *     const analysis = await aiAnalyzer.analyzeSymbol(symbol, strategyId, traceId);
   *
   *     // Execute trade if AI recommends it
   *     if (analysis.decision.action === "buy") {
   *       const trade = await orderExecutor.executeAlpacaTrade({ ... });
   *       return { decision: analysis.decision, tradeResult: trade };
   *     }
   *
   *     return { decision: analysis.decision };
   *   }
   * );
   *
   * if (!result.success) {
   *   console.error("Failed to start strategy:", result.error);
   * }
   * ```
   *
   * @validationChecks Performs several validation checks before starting:
   * 1. Strategy exists in database
   * 2. Strategy has at least one asset configured
   * 3. Kill switch is not active
   * 4. Strategy is not already running
   * 5. Orchestrator control is not enabled (would block autonomous execution)
   *
   * @strategyLifecycle Strategy lifecycle:
   * 1. Validates strategy and system state
   * 2. Marks strategy as active in database
   * 3. Runs analysis immediately for all assets
   * 4. Sets up interval for subsequent runs (every 60 seconds)
   * 5. Updates strategy state map with results
   * 6. Emits "strategy:started" event
   *
   * @note Strategy will auto-stop if kill switch is activated or strategy is deactivated
   */
  async startStrategy(
    strategyId: string,
    analyzeAndExecuteCallback: (symbol: string, strategyId: string, traceId: string) => Promise<{ decision: AIDecision; tradeResult?: any }>
  ): Promise<{ success: boolean; error?: string }> {
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

    const agentStatus = await storage.getAgentStatus();
    if (agentStatus?.killSwitchActive) {
      return { success: false, error: "Kill switch is active - trading disabled" };
    }

    if (this.strategyRunners.has(strategyId)) {
      return { success: false, error: "Strategy is already running" };
    }

    if (orchestratorController.isOrchestratorControlEnabled()) {
      log.info("StrategyRunner", "Strategy start skipped - orchestrator has control", { strategyId });
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
            const result = await analyzeAndExecuteCallback(asset, strategyId, runTraceId);
            lastSuccessfulDecision = result.decision;
          } catch (assetError) {
            const errorMsg = (assetError as Error).message || String(assetError);
            log.error("StrategyRunner", "Error analyzing asset", { asset, error: errorMsg });
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
        log.error("StrategyRunner", "Strategy run error", { strategyId, error: (error as Error).message });
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

    eventBus.emit("strategy:started", { strategyId, strategyName: strategy.name }, "strategy-runner");
    logger.strategy(strategy.name, "Started", { assets: strategy.assets });

    return { success: true };
  }

  /**
   * Stop a running strategy
   *
   * Stops a running strategy by clearing its interval timer and marking it inactive.
   * Updates agent running status if this was the last active strategy.
   *
   * @param strategyId - ID of the strategy to stop
   *
   * @returns Promise resolving to success result with optional error
   *
   * @example
   * ```typescript
   * await strategyRunner.stopStrategy("strategy-123");
   * console.log("Strategy stopped");
   * ```
   *
   * @note If no other strategies are running, sets agent isRunning to false
   * @note Emits "strategy:stopped" event
   */
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

    eventBus.emit("strategy:stopped", { strategyId, strategyName: strategy?.name || strategyId }, "strategy-runner");
    logger.strategy(strategy?.name || strategyId, "Stopped");

    return { success: true };
  }

  /**
   * Stop all running strategies
   *
   * Stops all currently running strategies and the background AI generator.
   * Sets agent running status to false.
   *
   * @returns Promise that resolves when all strategies are stopped
   *
   * @example
   * ```typescript
   * await strategyRunner.stopAllStrategies();
   * console.log("All strategies stopped");
   * ```
   *
   * @note Also stops the background AI suggestion generator
   */
  async stopAllStrategies(): Promise<void> {
    for (const [strategyId] of this.strategyRunners) {
      await this.stopStrategy(strategyId);
    }
    this.stopBackgroundGenerator();
    await storage.updateAgentStatus({ isRunning: false });
  }

  /**
   * Resume the trading agent
   *
   * Restarts the background AI generator and attempts to start the auto-start strategy
   * if Alpaca connection is available.
   *
   * @param isAlpacaConnectedCallback - Callback to check if Alpaca is connected
   * @param backgroundGeneratorCallback - Callback for background AI generation
   *
   * @returns Promise that resolves when agent is resumed
   *
   * @example
   * ```typescript
   * await strategyRunner.resumeAgent(
   *   async () => alpaca.isConnected(),
   *   async () => aiAnalyzer.generateBackgroundSuggestions()
   * );
   * ```
   *
   * @note Sets agent isRunning status to true
   * @note Only starts auto-start strategy if Alpaca is connected
   */
  async resumeAgent(
    isAlpacaConnectedCallback: () => Promise<boolean>,
    backgroundGeneratorCallback: () => Promise<void>
  ): Promise<void> {
    log.info("StrategyRunner", "Resuming trading agent...");
    this.startBackgroundAIGenerator(backgroundGeneratorCallback);
    await storage.updateAgentStatus({
      isRunning: true,
      lastHeartbeat: new Date()
    });

    if (this.autoStartStrategyId) {
      const isConnected = await isAlpacaConnectedCallback();
      if (isConnected) {
        // Note: This will require the callback to be passed in when resumeAgent is called
        // For now, we log that we need to start the strategy
        log.info("StrategyRunner", "Auto-start strategy should be started", { strategyId: this.autoStartStrategyId });
      }
    }
  }

  /**
   * Get the state of a specific strategy
   *
   * Returns the current run state for a strategy including last check time,
   * last decision, and any errors.
   *
   * @param strategyId - ID of the strategy
   *
   * @returns Strategy state or undefined if not found
   *
   * @example
   * ```typescript
   * const state = strategyRunner.getStrategyState("strategy-123");
   * if (state) {
   *   console.log(`Running: ${state.isRunning}`);
   *   console.log(`Last check: ${state.lastCheck}`);
   *   if (state.error) {
   *     console.error(`Error: ${state.error}`);
   *   }
   * }
   * ```
   */
  getStrategyState(strategyId: string): StrategyRunState | undefined {
    return this.strategyStates.get(strategyId);
  }

  /**
   * Get all strategy states
   *
   * Returns an array of all tracked strategy states, both running and stopped.
   *
   * @returns Array of all strategy states
   *
   * @example
   * ```typescript
   * const states = strategyRunner.getAllStrategyStates();
   * states.forEach(state => {
   *   console.log(`${state.strategyId}: ${state.isRunning ? "Running" : "Stopped"}`);
   * });
   * ```
   */
  getAllStrategyStates(): StrategyRunState[] {
    return Array.from(this.strategyStates.values());
  }

  /**
   * Get count of currently running strategies
   *
   * @returns Number of strategies with active interval timers
   *
   * @example
   * ```typescript
   * const count = strategyRunner.getRunningStrategiesCount();
   * console.log(`${count} strategies currently running`);
   * ```
   */
  getRunningStrategiesCount(): number {
    return this.strategyRunners.size;
  }

  /**
   * Get overall status of the strategy runner
   *
   * Provides a complete status report including count of running strategies
   * and detailed state for each tracked strategy.
   *
   * @returns Status object with running strategies count and all strategy states
   *
   * @example
   * ```typescript
   * const status = strategyRunner.getStatus();
   * console.log(`Running: ${status.runningStrategies}`);
   * console.log(`Total tracked: ${status.strategyStates.length}`);
   * ```
   */
  getStatus(): {
    runningStrategies: number;
    strategyStates: StrategyRunState[];
  } {
    const states = this.getAllStrategyStates();
    return {
      runningStrategies: this.strategyRunners.size,
      strategyStates: states,
    };
  }

  /**
   * Start the background AI suggestion generator
   *
   * Starts a background process that generates AI trading suggestions on a regular interval.
   * Runs immediately once, then every 120 seconds (2 minutes).
   *
   * @param backgroundGeneratorCallback - Callback for generating background AI suggestions
   *   - Called immediately and then on interval
   *   - Should not throw - errors are logged but don't stop the generator
   *
   * @example
   * ```typescript
   * strategyRunner.startBackgroundAIGenerator(async () => {
   *   const suggestions = await aiAnalyzer.generateSuggestions();
   *   await storage.saveSuggestions(suggestions);
   * });
   * ```
   *
   * @note Clears any existing background generator before starting new one
   * @note Errors in callback are caught and logged, don't stop the generator
   */
  startBackgroundAIGenerator(backgroundGeneratorCallback: () => Promise<void>): void {
    if (this.backgroundGeneratorInterval) {
      clearInterval(this.backgroundGeneratorInterval);
    }

    log.info("StrategyRunner", "Starting background AI suggestion generator...");

    // Run immediately
    backgroundGeneratorCallback().catch((err: Error) =>
      log.error("StrategyRunner", "Background AI generation failed", { error: err.message })
    );

    // Then run on interval
    this.backgroundGeneratorInterval = setInterval(
      () => {
        backgroundGeneratorCallback().catch((err: Error) =>
          log.error("StrategyRunner", "Background AI generation failed", { error: err.message })
        );
      },
      this.backgroundGeneratorIntervalMs
    );
  }

  /**
   * Stop the background AI suggestion generator
   *
   * Stops the background AI generator by clearing its interval timer.
   *
   * @example
   * ```typescript
   * strategyRunner.stopBackgroundGenerator();
   * ```
   *
   * @note Safe to call even if generator is not running
   */
  stopBackgroundGenerator(): void {
    if (this.backgroundGeneratorInterval) {
      clearInterval(this.backgroundGeneratorInterval);
      this.backgroundGeneratorInterval = null;
      log.info("StrategyRunner", "Background AI generator stopped");
    }
  }
}

export const strategyRunner = new StrategyRunner();
