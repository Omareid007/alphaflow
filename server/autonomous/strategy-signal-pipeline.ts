/**
 * Strategy Signal Pipeline
 *
 * Orchestrates the complete signal-to-order flow for autonomous strategies:
 * 1. Evaluate triggers to determine if strategy should act
 * 2. Generate signals based on strategy logic
 * 3. Validate signals against guards
 * 4. Execute approved signals as orders
 *
 * This pipeline supports three execution modes:
 * - manual: Signals generated, user must approve
 * - semi_auto: Signals generated and queued, user reviews before execution
 * - full_auto: Signals automatically executed without user intervention
 */

import { log } from "../utils/logger";
import { storage } from "../storage";
import {
  setHashField,
  getHashField,
  getAllHashFields,
  deleteHashField,
  isRedisAvailable,
} from "../lib/redis-cache";
import {
  parseStrategyContext,
  type StrategyExecutionContext,
} from "./strategy-execution-context";
import {
  triggerEvaluator,
  type StrategyTrigger,
  type TriggerEvaluationResult,
  type TriggerContext,
} from "./trigger-evaluator";
import {
  guardValidator,
  type StrategyGuard,
  type GuardValidationResult,
} from "./guard-validator";
import {
  actionExecutor,
  type ActionSignal,
  type ActionResult,
  type ExecutionOptions,
} from "./action-executor";
import type { Strategy } from "@shared/schema";
import { alpacaClient } from "../connectors/alpaca";
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateSMA,
  calculateEMA,
} from "../../scripts/shared/technical-indicators";

// ============================================================================
// TYPES
// ============================================================================

export type ExecutionMode = "manual" | "semi_auto" | "full_auto";

export interface PipelineConfig {
  executionMode: ExecutionMode;
  triggers: StrategyTrigger[];
  guards: StrategyGuard[];
  symbols: string[];
}

export interface SignalGenerationRequest {
  strategyId: string;
  symbol: string;
  context: StrategyExecutionContext;
}

export interface PendingSignal {
  id: string;
  strategyId: string;
  signal: ActionSignal;
  generatedAt: Date;
  expiresAt: Date;
  status: "pending" | "approved" | "rejected" | "expired";
  triggerResult?: TriggerEvaluationResult;
  guardResult?: GuardValidationResult;
}

export interface PipelineResult {
  strategyId: string;
  triggered: boolean;
  signalsGenerated: number;
  signalsExecuted: number;
  signalsPending: number;
  signalsBlocked: number;
  results: ActionResult[];
  pendingSignals?: PendingSignal[];
  errors?: string[];
}

export interface PipelineStatistics {
  totalRuns: number;
  successfulRuns: number;
  signalsGenerated: number;
  signalsExecuted: number;
  signalsBlocked: number;
  averageExecutionTime: number;
}

// ============================================================================
// SIGNAL PIPELINE
// ============================================================================

class StrategySignalPipeline {
  // TE-005 FIX: Removed in-memory Map, now using Redis hash for persistence
  private readonly PENDING_SIGNALS_HASH = "pending_signals";

  private runHistory: Array<{
    timestamp: Date;
    strategyId: string;
    result: PipelineResult;
    durationMs: number;
  }> = [];

  private readonly MAX_HISTORY_SIZE = 500;
  private readonly SIGNAL_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Run the signal pipeline for a strategy
   */
  async run(
    strategyId: string,
    options: ExecutionOptions = {}
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // 1. Load strategy and check state
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return this.errorResult(strategyId, "Strategy not found");
      }

      if (!this.isStrategyActive(strategy)) {
        return this.errorResult(
          strategyId,
          `Strategy is not active (status: ${strategy.status})`
        );
      }

      // 2. Parse execution context and config
      const context = parseStrategyContext(strategy);
      const config = this.extractPipelineConfig(strategy);

      log.info("SignalPipeline", "Running pipeline", {
        strategyId,
        executionMode: config.executionMode,
        symbols: config.symbols.length,
        triggers: config.triggers.length,
        guards: config.guards.length,
      });

      // 3. Evaluate triggers
      const triggerContext: TriggerContext = {
        strategyId,
        symbols: config.symbols,
      };

      let anyTriggered = false;
      const triggerResults: TriggerEvaluationResult[] = [];

      for (const trigger of config.triggers) {
        const result = await triggerEvaluator.evaluate(trigger, triggerContext);
        triggerResults.push(result);
        if (result.triggered) {
          anyTriggered = true;
        }
      }

      // If no triggers fired and not in manual mode, skip
      if (!anyTriggered && config.executionMode !== "manual") {
        return {
          strategyId,
          triggered: false,
          signalsGenerated: 0,
          signalsExecuted: 0,
          signalsPending: 0,
          signalsBlocked: 0,
          results: [],
        };
      }

      // 4. Generate signals for each symbol
      const signals: ActionSignal[] = [];
      for (const symbol of config.symbols) {
        const signal = await this.generateSignal({
          strategyId,
          symbol,
          context,
        });
        if (signal) {
          signals.push(signal);
        }
      }

      if (signals.length === 0) {
        return {
          strategyId,
          triggered: anyTriggered,
          signalsGenerated: 0,
          signalsExecuted: 0,
          signalsPending: 0,
          signalsBlocked: 0,
          results: [],
        };
      }

      // 5. Validate signals against guards and execute
      const results: ActionResult[] = [];
      const pendingSignals: PendingSignal[] = [];
      let signalsBlocked = 0;

      for (const signal of signals) {
        // Validate guards
        const guardResult = await guardValidator.validate(
          config.guards,
          context,
          signal.symbol,
          signal.action === "buy" ? "buy" : "sell"
        );

        if (!guardResult.allPassed) {
          log.info("SignalPipeline", "Signal blocked by guards", {
            strategyId,
            symbol: signal.symbol,
            blockedBy: guardResult.blockedBy,
          });
          signalsBlocked++;
          continue;
        }

        // Handle based on execution mode
        switch (config.executionMode) {
          case "manual": {
            // Queue signal for user approval
            const pending = await this.queueSignal(
              strategyId,
              signal,
              triggerResults[0],
              guardResult
            );
            pendingSignals.push(pending);
            break;
          }

          case "semi_auto": {
            // Queue signal but mark as approved for later execution
            const pending = await this.queueSignal(
              strategyId,
              signal,
              triggerResults[0],
              guardResult
            );
            pendingSignals.push(pending);
            break;
          }

          case "full_auto": {
            // Execute immediately
            const result = await actionExecutor.execute(signal, options);
            results.push(result);
            break;
          }
        }
      }

      const pipelineResult: PipelineResult = {
        strategyId,
        triggered: anyTriggered,
        signalsGenerated: signals.length,
        signalsExecuted: results.length,
        signalsPending: pendingSignals.length,
        signalsBlocked,
        results,
        pendingSignals: pendingSignals.length > 0 ? pendingSignals : undefined,
        errors: errors.length > 0 ? errors : undefined,
      };

      // Record run history
      this.recordRun(strategyId, pipelineResult, Date.now() - startTime);

      return pipelineResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error("SignalPipeline", "Pipeline error", {
        strategyId,
        error: errorMessage,
      });
      return this.errorResult(strategyId, errorMessage);
    }
  }

  /**
   * Generate a trading signal for a symbol using real market data and technical indicators
   */
  private async generateSignal(
    request: SignalGenerationRequest
  ): Promise<ActionSignal | null> {
    const { strategyId, symbol, context } = request;

    try {
      // 1. Fetch market data for the symbol (last 100 bars for indicators)
      log.debug("SignalPipeline", "Fetching market data", {
        strategyId,
        symbol,
      });

      const barsResponse = await alpacaClient.getBars(
        [symbol],
        "1Day",
        undefined,
        undefined,
        100
      );

      const bars = barsResponse.bars[symbol];
      if (!bars || bars.length < 20) {
        log.debug(
          "SignalPipeline",
          "Insufficient market data for signal generation",
          {
            symbol,
            bars: bars?.length || 0,
          }
        );
        return null;
      }

      // Extract close prices for indicator calculations
      const closePrices = bars.map((bar: { c: string | number }) =>
        parseFloat(String(bar.c))
      );
      const currentPrice = closePrices[closePrices.length - 1];

      // 2. Parse strategy config to get indicator settings
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return null;
      }

      const config = strategy.config as Record<string, unknown> | null;
      const signalsConfig = config?.signals as
        | Record<string, unknown>
        | undefined;
      const technicalIndicators = signalsConfig?.technicalIndicators as
        | Array<{
            name: string;
            params: Record<string, unknown>;
            weight: number;
          }>
        | undefined;

      // 3. Calculate indicators and generate composite signal score
      let signalScore = 0;
      let totalWeight = 0;
      const reasoning: string[] = [];

      // Default to RSI and MACD if no indicators configured
      const indicators =
        technicalIndicators && technicalIndicators.length > 0
          ? technicalIndicators
          : [
              { name: "RSI", params: { period: 14 }, weight: 1 },
              {
                name: "MACD",
                params: { fast: 12, slow: 26, signal: 9 },
                weight: 1,
              },
            ];

      for (const indicator of indicators) {
        const { name, params, weight } = indicator;

        switch (name.toUpperCase()) {
          case "RSI": {
            const period = (params.period as number) || 14;
            const rsiValues = calculateRSI(closePrices, period);
            const currentRSI = rsiValues[rsiValues.length - 1];

            if (currentRSI !== null) {
              if (currentRSI < 30) {
                // Oversold - buy signal
                signalScore += weight;
                reasoning.push(
                  `RSI(${period})=${currentRSI.toFixed(2)} < 30 (oversold)`
                );
              } else if (currentRSI > 70) {
                // Overbought - sell signal
                signalScore -= weight;
                reasoning.push(
                  `RSI(${period})=${currentRSI.toFixed(2)} > 70 (overbought)`
                );
              } else {
                reasoning.push(
                  `RSI(${period})=${currentRSI.toFixed(2)} (neutral)`
                );
              }
              totalWeight += weight;
            }
            break;
          }

          case "MACD": {
            const fast = (params.fast as number) || 12;
            const slow = (params.slow as number) || 26;
            const signal = (params.signal as number) || 9;

            const macdResult = calculateMACD(closePrices, fast, slow, signal);
            const currentMACD = macdResult.line[macdResult.line.length - 1];
            const currentSignal =
              macdResult.signal[macdResult.signal.length - 1];

            if (currentMACD !== null && currentSignal !== null) {
              const histogram = currentMACD - currentSignal;

              if (histogram > 0) {
                // MACD above signal - bullish
                signalScore += weight * 0.5;
                reasoning.push(
                  `MACD(${fast},${slow},${signal}) bullish crossover`
                );
              } else if (histogram < 0) {
                // MACD below signal - bearish
                signalScore -= weight * 0.5;
                reasoning.push(
                  `MACD(${fast},${slow},${signal}) bearish crossover`
                );
              }
              totalWeight += weight;
            }
            break;
          }

          case "SMA": {
            const period = (params.period as number) || 20;
            const smaValues = calculateSMA(closePrices, period);
            const currentSMA = smaValues[smaValues.length - 1];

            if (currentSMA !== null) {
              if (currentPrice > currentSMA) {
                // Price above SMA - bullish
                signalScore += weight * 0.3;
                reasoning.push(
                  `Price $${currentPrice.toFixed(2)} > SMA(${period}) $${currentSMA.toFixed(2)}`
                );
              } else {
                // Price below SMA - bearish
                signalScore -= weight * 0.3;
                reasoning.push(
                  `Price $${currentPrice.toFixed(2)} < SMA(${period}) $${currentSMA.toFixed(2)}`
                );
              }
              totalWeight += weight;
            }
            break;
          }

          case "BOLLINGER": {
            const period = (params.period as number) || 20;
            const stdDev = (params.stdDev as number) || 2;

            const bbResult = calculateBollingerBands(
              closePrices,
              period,
              stdDev
            );
            const currentUpper = bbResult.upper[bbResult.upper.length - 1];
            const currentLower = bbResult.lower[bbResult.lower.length - 1];

            if (currentUpper !== null && currentLower !== null) {
              if (currentPrice < currentLower) {
                // Price below lower band - oversold
                signalScore += weight;
                reasoning.push(
                  `Price $${currentPrice.toFixed(2)} below lower BB $${currentLower.toFixed(2)}`
                );
              } else if (currentPrice > currentUpper) {
                // Price above upper band - overbought
                signalScore -= weight;
                reasoning.push(
                  `Price $${currentPrice.toFixed(2)} above upper BB $${currentUpper.toFixed(2)}`
                );
              }
              totalWeight += weight;
            }
            break;
          }

          default:
            log.warn("SignalPipeline", "Unknown indicator", { name });
        }
      }

      // 4. Generate signal if score threshold is met
      if (totalWeight === 0) {
        log.debug("SignalPipeline", "No valid indicators calculated", {
          symbol,
        });
        return null;
      }

      const normalizedScore = signalScore / totalWeight;
      const confidence = Math.min(Math.abs(normalizedScore), 1);

      // Signal threshold: require normalized score > 0.5 for action
      if (Math.abs(normalizedScore) < 0.5) {
        log.debug("SignalPipeline", "Signal below threshold", {
          symbol,
          normalizedScore: normalizedScore.toFixed(2),
          threshold: 0.5,
        });
        return null;
      }

      // 5. Determine action type and create signal
      const actionType: "buy" | "sell" = normalizedScore > 0 ? "buy" : "sell";

      // Calculate stop loss and take profit based on volatility
      const recentPrices = closePrices.slice(-20);
      const avgPrice =
        recentPrices.reduce((sum: number, p: number) => sum + p, 0) /
        recentPrices.length;
      const variance =
        recentPrices.reduce(
          (sum: number, p: number) => sum + Math.pow(p - avgPrice, 2),
          0
        ) / recentPrices.length;
      const volatility = Math.sqrt(variance);

      const stopLoss =
        actionType === "buy"
          ? currentPrice - 2 * volatility
          : currentPrice + 2 * volatility;

      const takeProfit =
        actionType === "buy"
          ? currentPrice + 3 * volatility
          : currentPrice - 3 * volatility;

      const signal: ActionSignal = {
        id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        strategyId,
        symbol,
        action: actionType,
        quantity: 1, // Default quantity, should be determined by position sizing
        orderType: "market",
        timeInForce: "day",
        confidence,
        reason: reasoning.join("; "),
        metadata: {
          targetPrice: currentPrice,
          stopLoss: Math.max(stopLoss, 0.01),
          takeProfit: Math.max(takeProfit, 0.01),
        },
      };

      log.info("SignalPipeline", "Signal generated", {
        strategyId,
        symbol,
        action: actionType,
        confidence: confidence.toFixed(2),
        normalizedScore: normalizedScore.toFixed(2),
        currentPrice,
      });

      return signal;
    } catch (error) {
      log.error("SignalPipeline", "Error generating signal", {
        strategyId,
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Queue a signal for user review
   * TE-005 FIX: Persists to Redis hash instead of in-memory Map
   */
  private async queueSignal(
    strategyId: string,
    signal: ActionSignal,
    triggerResult?: TriggerEvaluationResult,
    guardResult?: GuardValidationResult
  ): Promise<PendingSignal> {
    const id = `sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    const pending: PendingSignal = {
      id,
      strategyId,
      signal,
      generatedAt: now,
      expiresAt: new Date(now.getTime() + this.SIGNAL_EXPIRY_MS),
      status: "pending",
      triggerResult,
      guardResult,
    };

    // TE-005 FIX: Store in Redis hash for persistence across restarts
    if (isRedisAvailable()) {
      await setHashField(
        this.PENDING_SIGNALS_HASH,
        id,
        pending,
        this.SIGNAL_EXPIRY_MS / 1000 // TTL in seconds
      );
      log.debug("SignalPipeline", "Signal queued in Redis", {
        id,
        strategyId,
        symbol: signal.symbol,
      });
    } else {
      log.warn("SignalPipeline", "Redis unavailable - signal not persisted", {
        id,
        strategyId,
      });
    }

    return pending;
  }

  /**
   * Approve a pending signal for execution
   * TE-005 FIX: Loads from Redis hash instead of in-memory Map
   */
  async approveSignal(
    signalId: string,
    options: ExecutionOptions = {}
  ): Promise<ActionResult | null> {
    // TE-005 FIX: Load from Redis hash
    const pending = await getHashField<PendingSignal>(
      this.PENDING_SIGNALS_HASH,
      signalId
    );

    if (!pending) {
      log.debug("SignalPipeline", "Signal not found", { signalId });
      return null;
    }

    if (pending.status !== "pending") {
      log.warn("SignalPipeline", "Signal not in pending state", {
        signalId,
        status: pending.status,
      });
      return null;
    }

    // Check expiry
    const expiresAt = new Date(pending.expiresAt);
    if (new Date() > expiresAt) {
      pending.status = "expired";
      await setHashField(this.PENDING_SIGNALS_HASH, signalId, pending);
      return null;
    }

    // Get strategy context
    const strategy = await storage.getStrategy(pending.strategyId);
    if (!strategy) {
      return null;
    }

    const context = parseStrategyContext(strategy);

    // Execute the signal
    const result = await actionExecutor.execute(pending.signal, options);

    // Update status in Redis
    pending.status = result.success ? "approved" : "rejected";
    await setHashField(this.PENDING_SIGNALS_HASH, signalId, pending);

    return result;
  }

  /**
   * Reject a pending signal
   * TE-005 FIX: Updates Redis hash instead of in-memory Map
   */
  async rejectSignal(signalId: string): Promise<boolean> {
    // TE-005 FIX: Load from Redis hash
    const pending = await getHashField<PendingSignal>(
      this.PENDING_SIGNALS_HASH,
      signalId
    );

    if (!pending || pending.status !== "pending") {
      return false;
    }

    // Update status in Redis
    pending.status = "rejected";
    await setHashField(this.PENDING_SIGNALS_HASH, signalId, pending);

    log.info("SignalPipeline", "Signal rejected", {
      signalId,
      strategyId: pending.strategyId,
      symbol: pending.signal.symbol,
    });

    return true;
  }

  /**
   * Get pending signals for a strategy
   * TE-005 FIX: Loads from Redis hash instead of in-memory Map
   */
  async getPendingSignals(strategyId: string): Promise<PendingSignal[]> {
    // TE-005 FIX: Load all signals from Redis hash
    const allSignals = await getAllHashFields<PendingSignal>(
      this.PENDING_SIGNALS_HASH
    );

    const now = new Date();
    const pending: PendingSignal[] = [];

    for (const [id, signal] of allSignals) {
      if (signal.strategyId !== strategyId) continue;
      if (signal.status !== "pending") continue;

      // Check and update expiry
      const expiresAt = new Date(signal.expiresAt);
      if (now > expiresAt) {
        signal.status = "expired";
        await setHashField(this.PENDING_SIGNALS_HASH, id, signal);
        continue;
      }

      pending.push(signal);
    }

    return pending;
  }

  /**
   * Get all pending signals (for admin view)
   * TE-005 FIX: Loads from Redis hash instead of in-memory Map
   */
  async getAllPendingSignals(): Promise<PendingSignal[]> {
    // TE-005 FIX: Load all signals from Redis hash
    const allSignals = await getAllHashFields<PendingSignal>(
      this.PENDING_SIGNALS_HASH
    );

    const now = new Date();
    const pending: PendingSignal[] = [];

    for (const [id, signal] of allSignals) {
      if (signal.status !== "pending") continue;

      const expiresAt = new Date(signal.expiresAt);
      if (now > expiresAt) {
        signal.status = "expired";
        await setHashField(this.PENDING_SIGNALS_HASH, id, signal);
        continue;
      }

      pending.push(signal);
    }

    return pending;
  }

  /**
   * Check if a strategy is in an active state
   */
  private isStrategyActive(strategy: Strategy): boolean {
    return strategy.status === "paper" || strategy.status === "live";
  }

  /**
   * Extract pipeline configuration from strategy
   */
  private extractPipelineConfig(strategy: Strategy): PipelineConfig {
    const config = strategy.config as Record<string, unknown> | null;

    // Default execution mode: manual
    const executionMode: ExecutionMode =
      (config?.executionMode as ExecutionMode) || "manual";

    // Default triggers: every 5 minutes during market hours
    const triggers: StrategyTrigger[] =
      (config?.triggers as StrategyTrigger[]) || [
        {
          type: "schedule",
          schedule: {
            frequency: "minute",
            interval: 5,
            marketOnly: true,
          },
        },
      ];

    // Default guards
    const guards: StrategyGuard[] =
      (config?.guards as StrategyGuard[]) ||
      guardValidator.constructor.prototype.constructor.createDefaultGuards?.() ||
      [];

    // Symbols from strategy config
    const symbols: string[] =
      (config?.symbols as string[]) ||
      (config?.includeSymbols as string[]) ||
      [];

    return {
      executionMode,
      triggers,
      guards,
      symbols,
    };
  }

  /**
   * Create error result
   */
  private errorResult(strategyId: string, error: string): PipelineResult {
    return {
      strategyId,
      triggered: false,
      signalsGenerated: 0,
      signalsExecuted: 0,
      signalsPending: 0,
      signalsBlocked: 0,
      results: [],
      errors: [error],
    };
  }

  /**
   * Record pipeline run in history
   */
  private recordRun(
    strategyId: string,
    result: PipelineResult,
    durationMs: number
  ): void {
    this.runHistory.push({
      timestamp: new Date(),
      strategyId,
      result,
      durationMs,
    });

    // Trim history
    if (this.runHistory.length > this.MAX_HISTORY_SIZE) {
      this.runHistory = this.runHistory.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  /**
   * Get pipeline statistics for a strategy
   */
  getStatistics(strategyId: string): PipelineStatistics {
    const history = this.runHistory.filter((r) => r.strategyId === strategyId);
    const successful = history.filter((r) => r.result.signalsExecuted > 0);

    return {
      totalRuns: history.length,
      successfulRuns: successful.length,
      signalsGenerated: history.reduce(
        (sum, r) => sum + r.result.signalsGenerated,
        0
      ),
      signalsExecuted: history.reduce(
        (sum, r) => sum + r.result.signalsExecuted,
        0
      ),
      signalsBlocked: history.reduce(
        (sum, r) => sum + r.result.signalsBlocked,
        0
      ),
      averageExecutionTime:
        history.length > 0
          ? history.reduce((sum, r) => sum + r.durationMs, 0) / history.length
          : 0,
    };
  }

  /**
   * Clean up expired signals and old history
   * TE-005 FIX: Cleans up Redis hash instead of in-memory Map
   */
  async cleanup(): Promise<void> {
    const now = new Date();

    // TE-005 FIX: Load all signals from Redis hash
    const allSignals = await getAllHashFields<PendingSignal>(
      this.PENDING_SIGNALS_HASH
    );

    let expiredCount = 0;
    let deletedCount = 0;

    for (const [id, signal] of allSignals) {
      const expiresAt = new Date(signal.expiresAt);
      const generatedAt = new Date(signal.generatedAt);

      // Mark expired signals
      if (signal.status === "pending" && now > expiresAt) {
        signal.status = "expired";
        await setHashField(this.PENDING_SIGNALS_HASH, id, signal);
        expiredCount++;
      }

      // Remove old non-pending signals (older than 24 hours)
      if (signal.status !== "pending") {
        const age = now.getTime() - generatedAt.getTime();
        if (age > 24 * 60 * 60 * 1000) {
          await deleteHashField(this.PENDING_SIGNALS_HASH, id);
          deletedCount++;
        }
      }
    }

    if (expiredCount > 0 || deletedCount > 0) {
      log.info("SignalPipeline", "Cleanup completed", {
        expired: expiredCount,
        deleted: deletedCount,
      });
    }
  }
}

// Export singleton
export const strategySignalPipeline = new StrategySignalPipeline();
