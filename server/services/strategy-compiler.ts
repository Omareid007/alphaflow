import { storage } from "../storage";
import { workQueue } from "../lib/work-queue";
import { log } from "../utils/logger";
import type {
  StrategySpec,
  Trigger,
  Guard,
  Action,
  RiskConfig,
} from "../../shared/strategy-spec";
import { validateStrategySpec } from "../../shared/strategy-spec";

interface CompiledStrategy {
  id: string;
  strategyVersionId: string;
  spec: StrategySpec;
  isActive: boolean;
  lastEvaluatedAt: Date | null;
  stats: StrategyStats;
}

interface StrategyStats {
  ordersToday: number;
  notionalToday: number;
  triggerCountToday: Map<string, number>;
  lastOrderAt: Date | null;
  dailyLossAmount: number;
  isKillSwitchActive: boolean;
}

interface TriggerContext {
  symbol: string;
  price: number;
  volume: number;
  indicators?: Record<string, number>;
  sentiment?: number;
  timestamp: Date;
}

interface EvaluationResult {
  triggered: boolean;
  triggerId: string | null;
  blockedBy: string | null;
  actions: Action[];
  warnings: string[];
}

class StrategyCompiler {
  private compiledStrategies: Map<string, CompiledStrategy> = new Map();
  private dailyResetTime: Date | null = null;

  async loadActiveStrategies(): Promise<void> {
    try {
      const versions = await storage.getActiveStrategyVersions();
      log.info(
        "StrategyCompiler",
        `Loading ${versions.length} active strategy versions`
      );

      for (const version of versions) {
        const validation = validateStrategySpec(version.spec);
        if (validation.valid && validation.spec) {
          this.compiledStrategies.set(version.id, {
            id: version.id,
            strategyVersionId: version.id,
            spec: validation.spec,
            isActive: true,
            lastEvaluatedAt: null,
            stats: this.createEmptyStats(),
          });
          log.info(
            "StrategyCompiler",
            `Loaded strategy: ${validation.spec.name} (v${version.version})`
          );
        } else {
          log.warn(
            "StrategyCompiler",
            `Invalid spec for version ${version.id}: ${validation.errors?.join(", ")}`
          );
        }
      }
    } catch (err) {
      log.error("StrategyCompiler", "Failed to load active strategies", {
        error: err,
      });
    }
  }

  private createEmptyStats(): StrategyStats {
    return {
      ordersToday: 0,
      notionalToday: 0,
      triggerCountToday: new Map(),
      lastOrderAt: null,
      dailyLossAmount: 0,
      isKillSwitchActive: false,
    };
  }

  private checkDailyReset(): void {
    const now = new Date();
    const todayReset = new Date(now);
    todayReset.setHours(0, 0, 0, 0);

    if (!this.dailyResetTime || this.dailyResetTime < todayReset) {
      log.info("StrategyCompiler", "Resetting daily stats");
      for (const strategy of this.compiledStrategies.values()) {
        strategy.stats = this.createEmptyStats();
      }
      this.dailyResetTime = todayReset;
    }
  }

  evaluateTrigger(
    trigger: Trigger,
    context: TriggerContext,
    stats: StrategyStats
  ): boolean {
    if (trigger.cooldownMinutes > 0 && stats.lastOrderAt) {
      const cooldownMs = trigger.cooldownMinutes * 60 * 1000;
      const timeSinceLastOrder = Date.now() - stats.lastOrderAt.getTime();
      if (timeSinceLastOrder < cooldownMs) {
        log.debug(
          "StrategyCompiler",
          `Trigger ${trigger.id} in cooldown (${Math.ceil((cooldownMs - timeSinceLastOrder) / 60000)}m remaining)`
        );
        return false;
      }
    }

    const triggerCount = stats.triggerCountToday.get(trigger.id) || 0;
    if (triggerCount >= trigger.maxTriggersPerDay) {
      log.debug(
        "StrategyCompiler",
        `Trigger ${trigger.id} hit daily limit (${trigger.maxTriggersPerDay})`
      );
      return false;
    }

    const now = new Date();
    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      now.getDay()
    ] as "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
    if (!trigger.enabledDays.includes(dayName)) {
      log.debug(
        "StrategyCompiler",
        `Trigger ${trigger.id} not enabled on ${dayName}`
      );
      return false;
    }

    if (trigger.activeHours) {
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      if (
        currentTime < trigger.activeHours.start ||
        currentTime > trigger.activeHours.end
      ) {
        log.debug(
          "StrategyCompiler",
          `Trigger ${trigger.id} outside active hours`
        );
        return false;
      }
    }

    const conditionResults = trigger.conditions.map((cond) => {
      let fieldValue: number;

      switch (cond.type) {
        case "price":
          fieldValue = context.price;
          break;
        case "volume":
          fieldValue = context.volume;
          break;
        case "indicator":
          fieldValue = context.indicators?.[cond.field] || 0;
          break;
        case "news_sentiment":
          fieldValue = context.sentiment || 0;
          break;
        default:
          return false;
      }

      const targetValue =
        typeof cond.value === "number" ? cond.value : parseFloat(cond.value);

      switch (cond.operator) {
        case "gt":
          return fieldValue > targetValue;
        case "gte":
          return fieldValue >= targetValue;
        case "lt":
          return fieldValue < targetValue;
        case "lte":
          return fieldValue <= targetValue;
        case "eq":
          return fieldValue === targetValue;
        case "neq":
          return fieldValue !== targetValue;
        default:
          return false;
      }
    });

    if (trigger.logic === "AND") {
      return conditionResults.every((r) => r);
    } else {
      return conditionResults.some((r) => r);
    }
  }

  evaluateGuards(
    guards: Guard[],
    risk: RiskConfig,
    context: TriggerContext,
    stats: StrategyStats
  ): { passed: boolean; blockedBy: string | null; warnings: string[] } {
    const warnings: string[] = [];

    if (risk.killSwitchEnabled && stats.isKillSwitchActive) {
      return {
        passed: false,
        blockedBy: "kill_switch",
        warnings: ["Kill switch is active"],
      };
    }

    if (stats.ordersToday >= risk.maxOrdersPerDay) {
      return {
        passed: false,
        blockedBy: "max_orders_per_day",
        warnings: [`Daily order limit reached (${risk.maxOrdersPerDay})`],
      };
    }

    if (stats.dailyLossAmount >= risk.dailyLossLimitPercent * 100000) {
      return {
        passed: false,
        blockedBy: "daily_loss_limit",
        warnings: [`Daily loss limit reached`],
      };
    }

    if (stats.lastOrderAt) {
      const timeSinceLastOrder = Date.now() - stats.lastOrderAt.getTime();
      if (timeSinceLastOrder < risk.cooldownBetweenOrdersMs) {
        return {
          passed: false,
          blockedBy: "cooldown",
          warnings: [
            `Cooldown active (${Math.ceil((risk.cooldownBetweenOrdersMs - timeSinceLastOrder) / 1000)}s remaining)`,
          ],
        };
      }
    }

    for (const guard of guards) {
      const guardValue =
        typeof guard.value === "number" ? guard.value : parseFloat(guard.value);

      switch (guard.type) {
        case "max_position_size":
          break;
        case "max_notional_per_order":
          if (guardValue < risk.maxNotionalPerOrder) {
            if (guard.action === "block") {
              return {
                passed: false,
                blockedBy: guard.id,
                warnings: [guard.message || "Guard blocked"],
              };
            }
            warnings.push(guard.message || `Guard warning: ${guard.name}`);
          }
          break;
        case "volatility_threshold":
          break;
        case "ai_confidence_threshold":
          break;
      }
    }

    return { passed: true, blockedBy: null, warnings };
  }

  async evaluateStrategy(
    strategyId: string,
    context: TriggerContext
  ): Promise<EvaluationResult> {
    this.checkDailyReset();

    const strategy = this.compiledStrategies.get(strategyId);
    if (!strategy || !strategy.isActive) {
      return {
        triggered: false,
        triggerId: null,
        blockedBy: "not_active",
        actions: [],
        warnings: [],
      };
    }

    const spec = strategy.spec;

    for (const trigger of spec.triggers) {
      if (this.evaluateTrigger(trigger, context, strategy.stats)) {
        const guardResult = this.evaluateGuards(
          spec.guards,
          spec.risk,
          context,
          strategy.stats
        );

        if (!guardResult.passed) {
          log.info(
            "StrategyCompiler",
            `Strategy ${spec.name} trigger ${trigger.id} blocked by ${guardResult.blockedBy}`
          );
          return {
            triggered: true,
            triggerId: trigger.id,
            blockedBy: guardResult.blockedBy,
            actions: [],
            warnings: guardResult.warnings,
          };
        }

        strategy.lastEvaluatedAt = new Date();
        const currentCount =
          strategy.stats.triggerCountToday.get(trigger.id) || 0;
        strategy.stats.triggerCountToday.set(trigger.id, currentCount + 1);

        log.info(
          "StrategyCompiler",
          `Strategy ${spec.name} trigger ${trigger.id} fired, returning ${spec.actions.length} actions`
        );
        return {
          triggered: true,
          triggerId: trigger.id,
          blockedBy: null,
          actions: spec.actions,
          warnings: guardResult.warnings,
        };
      }
    }

    return {
      triggered: false,
      triggerId: null,
      blockedBy: null,
      actions: [],
      warnings: [],
    };
  }

  async executeActions(
    strategyId: string,
    actions: Action[],
    context: TriggerContext
  ): Promise<{ success: boolean; orderIds: string[]; errors: string[] }> {
    const strategy = this.compiledStrategies.get(strategyId);
    if (!strategy) {
      return { success: false, orderIds: [], errors: ["Strategy not found"] };
    }

    const spec = strategy.spec;
    const orderIds: string[] = [];
    const errors: string[] = [];

    for (const action of actions) {
      try {
        if (action.requireConfirmation) {
          log.info(
            "StrategyCompiler",
            `Action ${action.id} requires confirmation, skipping auto-execution`
          );
          continue;
        }

        const symbol =
          action.symbolSource === "trigger_context"
            ? context.symbol
            : action.symbol;
        if (!symbol) {
          errors.push(`Action ${action.id}: No symbol specified`);
          continue;
        }

        let notional = action.size;
        if (action.sizeType === "percent_portfolio") {
          notional = 100000 * (action.size / 100);
        }

        if (notional > spec.risk.maxNotionalPerOrder) {
          notional = spec.risk.maxNotionalPerOrder;
          log.warn(
            "StrategyCompiler",
            `Action ${action.id} size capped to max notional ${notional}`
          );
        }

        if (
          strategy.stats.notionalToday + notional >
          spec.risk.maxTotalNotionalPerDay
        ) {
          errors.push(`Action ${action.id}: Would exceed daily notional limit`);
          continue;
        }

        if (action.type === "notify") {
          log.info(
            "StrategyCompiler",
            `Notification action for ${symbol}: ${action.type}`
          );
          continue;
        }

        if (action.type === "ai_debate") {
          const traceId = `debate-${Date.now()}`;
          const workItem = await workQueue.enqueue({
            type: "AI_DEBATE",
            payload: JSON.stringify({
              symbols: [symbol],
              triggeredBy: `strategy:${strategyId}`,
              traceId,
            }),
            idempotencyKey: `AI_DEBATE:${strategyId}:${symbol}:${Date.now()}`,
          });
          orderIds.push(workItem.id);
          continue;
        }

        const side = action.type.includes("buy") ? "buy" : "sell";
        const orderType = action.type.includes("limit") ? "limit" : "market";
        const orderTraceId = `strategy-${strategyId}-${Date.now()}`;

        const workItem = await workQueue.enqueue({
          type: "ORDER_SUBMIT",
          symbol,
          payload: JSON.stringify({
            symbol,
            side,
            type: orderType,
            notional: notional.toString(),
            timeInForce: action.timeInForce,
            limitPrice: action.limitPrice?.toString(),
            strategyVersionId: strategyId,
            traceId: orderTraceId,
          }),
          idempotencyKey: `ORDER:${strategyId}:${symbol}:${side}:${Date.now()}`,
        });

        orderIds.push(workItem.id);
        strategy.stats.ordersToday++;
        strategy.stats.notionalToday += notional;
        strategy.stats.lastOrderAt = new Date();

        log.info(
          "StrategyCompiler",
          `Enqueued order for ${symbol}: ${side} ${orderType} $${notional}`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Action ${action.id}: ${message}`);
        log.error("StrategyCompiler", `Failed to execute action ${action.id}`, {
          error: err,
        });
      }
    }

    return { success: errors.length === 0, orderIds, errors };
  }

  activateKillSwitch(strategyId?: string): void {
    if (strategyId) {
      const strategy = this.compiledStrategies.get(strategyId);
      if (strategy) {
        strategy.stats.isKillSwitchActive = true;
        log.warn(
          "StrategyCompiler",
          `Kill switch activated for strategy ${strategyId}`
        );
      }
    } else {
      for (const strategy of this.compiledStrategies.values()) {
        strategy.stats.isKillSwitchActive = true;
      }
      log.warn("StrategyCompiler", "Kill switch activated for ALL strategies");
    }
  }

  deactivateKillSwitch(strategyId?: string): void {
    if (strategyId) {
      const strategy = this.compiledStrategies.get(strategyId);
      if (strategy) {
        strategy.stats.isKillSwitchActive = false;
        log.info(
          "StrategyCompiler",
          `Kill switch deactivated for strategy ${strategyId}`
        );
      }
    } else {
      for (const strategy of this.compiledStrategies.values()) {
        strategy.stats.isKillSwitchActive = false;
      }
      log.info(
        "StrategyCompiler",
        "Kill switch deactivated for ALL strategies"
      );
    }
  }

  getStrategyStats(strategyId: string): StrategyStats | null {
    return this.compiledStrategies.get(strategyId)?.stats || null;
  }

  getAllStats(): Record<string, { name: string; stats: StrategyStats }> {
    const result: Record<string, { name: string; stats: StrategyStats }> = {};
    for (const [id, strategy] of this.compiledStrategies.entries()) {
      result[id] = { name: strategy.spec.name, stats: strategy.stats };
    }
    return result;
  }
}

export const strategyCompiler = new StrategyCompiler();
