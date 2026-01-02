/**
 * Trigger Evaluator
 *
 * Evaluates strategy triggers to determine if strategy should act.
 * Part of the Strategy Signal Pipeline.
 *
 * TODO: Implement full trigger evaluation logic
 */

import { log } from "../utils/logger";

// ============================================================================
// TYPES
// ============================================================================

export type TriggerType =
  | "price_cross"
  | "indicator_threshold"
  | "time_based"
  | "volume_spike"
  | "news_event"
  | "custom";

export interface StrategyTrigger {
  id: string;
  type: TriggerType;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface TriggerContext {
  strategyId: string;
  symbols: string[];
  symbol?: string;
  currentPrice?: number;
  indicators?: Record<string, number>;
  volume?: number;
  timestamp?: Date;
}

export interface TriggerEvaluationResult {
  triggered: boolean;
  triggerId?: string;
  triggerType?: TriggerType;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// EVALUATOR
// ============================================================================

export const triggerEvaluator = {
  /**
   * Evaluate a trigger for a strategy context
   */
  async evaluate(
    trigger: StrategyTrigger,
    context: TriggerContext
  ): Promise<TriggerEvaluationResult> {
    log.debug("TriggerEvaluator", "Evaluating trigger", {
      strategyId: context.strategyId,
      triggerId: trigger.id,
      triggerType: trigger.type,
    });

    if (!trigger.enabled) {
      return {
        triggered: false,
        reason: "Trigger is disabled",
      };
    }

    return await this.evaluateSingle(trigger, context);
  },

  /**
   * Evaluate all triggers for a strategy context (returns first match)
   */
  async evaluateAll(
    triggers: StrategyTrigger[],
    context: TriggerContext
  ): Promise<TriggerEvaluationResult> {
    log.debug("TriggerEvaluator", "Evaluating triggers", {
      strategyId: context.strategyId,
      triggerCount: triggers.length,
    });

    // Find first enabled trigger that matches
    for (const trigger of triggers) {
      if (!trigger.enabled) continue;

      const result = await this.evaluateSingle(trigger, context);
      if (result.triggered) {
        return result;
      }
    }

    return {
      triggered: false,
      reason: "No triggers matched",
    };
  },

  /**
   * Evaluate a single trigger
   */
  async evaluateSingle(
    trigger: StrategyTrigger,
    context: TriggerContext
  ): Promise<TriggerEvaluationResult> {
    try {
      switch (trigger.type) {
        case "price_cross":
          return this.evaluatePriceCross(trigger, context);
        case "indicator_threshold":
          return this.evaluateIndicatorThreshold(trigger, context);
        case "volume_spike":
          return this.evaluateVolumeSpike(trigger, context);
        case "time_based":
          return this.evaluateTimeBased(trigger, context);
        default:
          return {
            triggered: false,
            reason: `Unknown trigger type: ${trigger.type}`,
          };
      }
    } catch (error) {
      log.error("TriggerEvaluator", "Trigger evaluation failed", {
        trigger,
        error,
      });
      return { triggered: false, reason: String(error) };
    }
  },

  evaluatePriceCross(
    trigger: StrategyTrigger,
    context: TriggerContext
  ): TriggerEvaluationResult {
    const { threshold, direction } = trigger.config as {
      threshold?: number;
      direction?: "above" | "below";
    };
    if (!threshold)
      return { triggered: false, reason: "No threshold configured" };
    if (context.currentPrice === undefined)
      return { triggered: false, reason: "No current price available" };

    const triggered =
      direction === "above"
        ? context.currentPrice > threshold
        : context.currentPrice < threshold;

    return {
      triggered,
      triggerId: trigger.id,
      triggerType: trigger.type,
      reason: triggered ? `Price ${direction} ${threshold}` : undefined,
      metadata: { price: context.currentPrice, threshold },
    };
  },

  evaluateIndicatorThreshold(
    trigger: StrategyTrigger,
    context: TriggerContext
  ): TriggerEvaluationResult {
    const { indicator, threshold, condition } = trigger.config as {
      indicator?: string;
      threshold?: number;
      condition?: "gt" | "lt" | "eq";
    };
    if (!indicator || threshold === undefined) {
      return {
        triggered: false,
        reason: "Indicator or threshold not configured",
      };
    }
    if (!context.indicators) {
      return { triggered: false, reason: "No indicators available" };
    }

    const value = context.indicators[indicator];
    if (value === undefined) {
      return {
        triggered: false,
        reason: `Indicator ${indicator} not available`,
      };
    }

    let triggered = false;
    switch (condition) {
      case "gt":
        triggered = value > threshold;
        break;
      case "lt":
        triggered = value < threshold;
        break;
      case "eq":
        triggered = Math.abs(value - threshold) < 0.001;
        break;
    }

    return {
      triggered,
      triggerId: trigger.id,
      triggerType: trigger.type,
      reason: triggered ? `${indicator} ${condition} ${threshold}` : undefined,
      metadata: { indicator, value, threshold },
    };
  },

  evaluateVolumeSpike(
    trigger: StrategyTrigger,
    context: TriggerContext
  ): TriggerEvaluationResult {
    const { multiplier } = trigger.config as { multiplier?: number };
    // Stub: would need average volume to compare
    return {
      triggered: false,
      triggerId: trigger.id,
      triggerType: trigger.type,
      reason: "Volume spike evaluation not yet implemented",
    };
  },

  evaluateTimeBased(
    trigger: StrategyTrigger,
    context: TriggerContext
  ): TriggerEvaluationResult {
    const { hour, minute } = trigger.config as {
      hour?: number;
      minute?: number;
    };
    const now = new Date();
    const triggered =
      now.getHours() === hour &&
      (minute === undefined || now.getMinutes() === minute);

    return {
      triggered,
      triggerId: trigger.id,
      triggerType: trigger.type,
      reason: triggered
        ? `Time trigger at ${hour}:${minute || "00"}`
        : undefined,
    };
  },
};
