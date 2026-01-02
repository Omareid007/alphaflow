/**
 * Guard Validator
 *
 * Validates signals against strategy guards before execution.
 * Part of the Strategy Signal Pipeline.
 *
 * Guards are safety constraints that must pass before a signal can be executed.
 * Examples: position limits, exposure limits, time-of-day restrictions, etc.
 */

import { log } from "../utils/logger";
import type { StrategyExecutionContext } from "./strategy-execution-context";

// ============================================================================
// TYPES
// ============================================================================

export type GuardType =
  | "max_positions"
  | "max_exposure"
  | "max_daily_trades"
  | "max_loss"
  | "time_restriction"
  | "volatility_check"
  | "liquidity_check"
  | "custom";

export interface StrategyGuard {
  id: string;
  type: GuardType;
  enabled: boolean;
  config: Record<string, unknown>;
  severity: "block" | "warn";
}

export interface GuardContext {
  strategyId: string;
  symbol: string;
  currentPositions: number;
  totalExposure: number;
  dailyTrades: number;
  dailyPnL: number;
  portfolioValue: number;
}

export interface GuardValidationResult {
  passed: boolean;
  allPassed: boolean;
  guardId?: string;
  guardType?: GuardType;
  reason?: string;
  severity?: "block" | "warn";
  violations: GuardViolation[];
  blockedBy?: string[];
}

export interface GuardViolation {
  guardId: string;
  guardType: GuardType;
  message: string;
  severity: "block" | "warn";
  currentValue?: number;
  limit?: number;
}

// ============================================================================
// VALIDATOR
// ============================================================================

export const guardValidator = {
  /**
   * Validate all guards for a signal
   */
  async validate(
    guards: StrategyGuard[],
    context: GuardContext | StrategyExecutionContext | Record<string, unknown>,
    symbol?: string,
    side?: "buy" | "sell"
  ): Promise<GuardValidationResult> {
    log.debug("GuardValidator", "Validating guards", {
      symbol,
      side,
      guardCount: guards.length,
    });

    // Build guard context from various context types
    const guardContext: GuardContext = this.buildGuardContext(context, symbol);

    const violations: GuardViolation[] = [];
    const blockedBy: string[] = [];

    for (const guard of guards) {
      if (!guard.enabled) continue;

      const result = await this.validateSingle(guard, guardContext);
      if (!result.passed) {
        violations.push({
          guardId: guard.id,
          guardType: guard.type,
          message: result.reason || "Guard validation failed",
          severity: guard.severity,
          currentValue: result.currentValue,
          limit: result.limit,
        });
        if (guard.severity === "block") {
          blockedBy.push(guard.id);
        }
      }
    }

    // Check if any blocking violations exist
    const hasBlockingViolation = violations.some((v) => v.severity === "block");

    return {
      passed: !hasBlockingViolation,
      allPassed: violations.length === 0,
      violations,
      blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
      reason: hasBlockingViolation
        ? `Blocked by ${violations.filter((v) => v.severity === "block").length} guard(s)`
        : undefined,
    };
  },

  /**
   * Build guard context from various input types
   */
  buildGuardContext(
    context: GuardContext | StrategyExecutionContext | Record<string, unknown>,
    symbol?: string
  ): GuardContext {
    // If it's already a GuardContext, return it
    if ("strategyId" in context && "currentPositions" in context) {
      return context as GuardContext;
    }

    // Otherwise, build a default context
    return {
      strategyId:
        ((context as Record<string, unknown>).strategyId as string) || "",
      symbol: symbol || "",
      currentPositions: 0,
      totalExposure: 0,
      dailyTrades: 0,
      dailyPnL: 0,
      portfolioValue: 100000, // Default value
    };
  },

  /**
   * Validate a single guard
   */
  async validateSingle(
    guard: StrategyGuard,
    context: GuardContext
  ): Promise<{
    passed: boolean;
    reason?: string;
    currentValue?: number;
    limit?: number;
  }> {
    try {
      switch (guard.type) {
        case "max_positions":
          return this.validateMaxPositions(guard, context);
        case "max_exposure":
          return this.validateMaxExposure(guard, context);
        case "max_daily_trades":
          return this.validateMaxDailyTrades(guard, context);
        case "max_loss":
          return this.validateMaxLoss(guard, context);
        case "time_restriction":
          return this.validateTimeRestriction(guard, context);
        default:
          return { passed: true };
      }
    } catch (error) {
      log.error("GuardValidator", "Guard validation error", { guard, error });
      return { passed: false, reason: String(error) };
    }
  },

  validateMaxPositions(
    guard: StrategyGuard,
    context: GuardContext
  ): {
    passed: boolean;
    reason?: string;
    currentValue?: number;
    limit?: number;
  } {
    const limit = (guard.config.limit as number) || 10;
    const passed = context.currentPositions < limit;
    return {
      passed,
      reason: passed ? undefined : `Max positions (${limit}) reached`,
      currentValue: context.currentPositions,
      limit,
    };
  },

  validateMaxExposure(
    guard: StrategyGuard,
    context: GuardContext
  ): {
    passed: boolean;
    reason?: string;
    currentValue?: number;
    limit?: number;
  } {
    const maxPercent = (guard.config.maxPercent as number) || 100;
    const exposurePercent =
      (context.totalExposure / context.portfolioValue) * 100;
    const passed = exposurePercent < maxPercent;
    return {
      passed,
      reason: passed ? undefined : `Max exposure (${maxPercent}%) exceeded`,
      currentValue: exposurePercent,
      limit: maxPercent,
    };
  },

  validateMaxDailyTrades(
    guard: StrategyGuard,
    context: GuardContext
  ): {
    passed: boolean;
    reason?: string;
    currentValue?: number;
    limit?: number;
  } {
    const limit = (guard.config.limit as number) || 50;
    const passed = context.dailyTrades < limit;
    return {
      passed,
      reason: passed ? undefined : `Max daily trades (${limit}) reached`,
      currentValue: context.dailyTrades,
      limit,
    };
  },

  validateMaxLoss(
    guard: StrategyGuard,
    context: GuardContext
  ): {
    passed: boolean;
    reason?: string;
    currentValue?: number;
    limit?: number;
  } {
    const maxLossPercent = (guard.config.maxLossPercent as number) || 5;
    const lossPercent =
      Math.abs(Math.min(0, context.dailyPnL) / context.portfolioValue) * 100;
    const passed = lossPercent < maxLossPercent;
    return {
      passed,
      reason: passed
        ? undefined
        : `Max daily loss (${maxLossPercent}%) exceeded`,
      currentValue: lossPercent,
      limit: maxLossPercent,
    };
  },

  validateTimeRestriction(
    guard: StrategyGuard,
    _context: GuardContext
  ): { passed: boolean; reason?: string } {
    const { startHour, endHour } = guard.config as {
      startHour?: number;
      endHour?: number;
    };
    if (startHour === undefined || endHour === undefined) {
      return { passed: true };
    }

    const now = new Date();
    const hour = now.getHours();
    const passed = hour >= startHour && hour < endHour;
    return {
      passed,
      reason: passed
        ? undefined
        : `Outside trading hours (${startHour}:00 - ${endHour}:00)`,
    };
  },
};
