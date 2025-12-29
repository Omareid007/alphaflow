import { storage } from "../storage";
import { eventBus, logger } from "../orchestration";
import { log } from "../utils/logger";
import type { StrategyRunState } from "./engine-types";
import { orchestratorController } from "./orchestrator-controller";
import { generateTraceId } from "../ai/llmGateway";
import type { AIDecision } from "../ai/decision-engine";

/**
 * StrategyRunner: Manages strategy execution lifecycle
 *
 * Responsibilities:
 * - Starting/stopping strategies
 * - Running strategies on intervals
 * - Tracking strategy state
 * - Background AI suggestion generation
 *
 * Note: This class coordinates strategy execution but delegates actual
 * analysis/trading to a callback (dependency injection pattern).
 */
export class StrategyRunner {
  private strategyRunners: Map<string, ReturnType<typeof setInterval>> = new Map();
  private strategyStates: Map<string, StrategyRunState> = new Map();
  private checkIntervalMs = 60000;
  private backgroundGeneratorInterval: ReturnType<typeof setInterval> | null = null;
  private backgroundGeneratorIntervalMs = 120000;
  private autoStartStrategyId: string | null = null;

  /**
   * Set the auto-start strategy ID (typically the Auto-Pilot Strategy)
   */
  setAutoStartStrategyId(strategyId: string): void {
    this.autoStartStrategyId = strategyId;
  }

  /**
   * Get the auto-start strategy ID
   */
  getAutoStartStrategyId(): string | null {
    return this.autoStartStrategyId;
  }

  /**
   * Start a strategy - analyzes assets on an interval
   *
   * @param strategyId - ID of the strategy to start
   * @param analyzeAndExecuteCallback - Callback to analyze and execute trades for a symbol
   * @returns Success result with optional error
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
   * @param strategyId - ID of the strategy to stop
   * @returns Success result with optional error
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
   */
  async stopAllStrategies(): Promise<void> {
    for (const [strategyId] of this.strategyRunners) {
      await this.stopStrategy(strategyId);
    }
    this.stopBackgroundGenerator();
    await storage.updateAgentStatus({ isRunning: false });
  }

  /**
   * Resume the trading agent - restarts background generator and auto-start strategy
   *
   * @param isAlpacaConnectedCallback - Callback to check if Alpaca is connected
   * @param backgroundGeneratorCallback - Callback for background AI generation
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
   * @param strategyId - ID of the strategy
   * @returns Strategy state or undefined if not found
   */
  getStrategyState(strategyId: string): StrategyRunState | undefined {
    return this.strategyStates.get(strategyId);
  }

  /**
   * Get all strategy states
   *
   * @returns Array of all strategy states
   */
  getAllStrategyStates(): StrategyRunState[] {
    return Array.from(this.strategyStates.values());
  }

  /**
   * Get count of currently running strategies
   *
   * @returns Number of running strategies
   */
  getRunningStrategiesCount(): number {
    return this.strategyRunners.size;
  }

  /**
   * Get overall status of the strategy runner
   *
   * @returns Status object with running strategies and states
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
   * @param backgroundGeneratorCallback - Callback for generating background AI suggestions
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
