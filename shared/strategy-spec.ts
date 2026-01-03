import { z } from "zod";

export const TriggerConditionSchema = z.object({
  type: z.enum([
    "price",
    "indicator",
    "time",
    "volume",
    "news_sentiment",
    "ai_signal",
  ]),
  field: z.string(),
  operator: z.enum([
    "gt",
    "gte",
    "lt",
    "lte",
    "eq",
    "neq",
    "crosses_above",
    "crosses_below",
  ]),
  value: z.union([z.number(), z.string()]),
  timeframe: z.enum(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]).optional(),
  lookback: z.number().optional(),
});

export const TriggerSchema = z.object({
  id: z.string(),
  name: z.string(),
  conditions: z.array(TriggerConditionSchema),
  logic: z.enum(["AND", "OR"]).default("AND"),
  cooldownMinutes: z.number().min(0).default(60),
  maxTriggersPerDay: z.number().min(1).default(10),
  activeHours: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      timezone: z.string().default("America/New_York"),
    })
    .optional(),
  enabledDays: z
    .array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]))
    .default(["Mon", "Tue", "Wed", "Thu", "Fri"]),
});

export const GuardSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    "max_position_size",
    "max_portfolio_exposure",
    "daily_loss_limit",
    "max_orders_per_day",
    "max_notional_per_order",
    "min_cash_reserve",
    "volatility_threshold",
    "correlation_limit",
    "blackout_period",
    "ai_confidence_threshold",
  ]),
  value: z.union([z.number(), z.string()]),
  action: z
    .enum(["block", "warn", "reduce_size", "require_approval"])
    .default("block"),
  message: z.string().optional(),
});

export const ActionSchema = z.object({
  id: z.string(),
  type: z.enum([
    "market_buy",
    "market_sell",
    "limit_buy",
    "limit_sell",
    "stop_loss",
    "take_profit",
    "close_position",
    "scale_in",
    "scale_out",
    "rebalance",
    "notify",
    "ai_debate",
  ]),
  symbol: z.string().optional(),
  symbolSource: z
    .enum(["static", "universe", "trigger_context"])
    .default("static"),
  sizeType: z
    .enum(["shares", "dollars", "percent_portfolio", "percent_position"])
    .default("dollars"),
  size: z.number(),
  limitPrice: z.number().optional(),
  offsetPercent: z.number().optional(),
  timeInForce: z.enum(["day", "gtc", "ioc", "fok"]).default("day"),
  requireConfirmation: z.boolean().default(false),
});

export const RiskConfigSchema = z.object({
  maxOrdersPerDay: z.number().min(1).default(20),
  maxNotionalPerOrder: z.number().min(1).default(10000),
  maxTotalNotionalPerDay: z.number().min(1).default(50000),
  maxPositionPercent: z.number().min(0.01).max(1).default(0.1),
  maxPortfolioExposurePercent: z.number().min(0.01).max(1).default(0.8),
  dailyLossLimitPercent: z.number().min(0.001).max(0.5).default(0.03),
  cooldownBetweenOrdersMs: z.number().min(0).default(30000),
  requireAiDebate: z.boolean().default(false),
  minAiConfidence: z.number().min(0).max(1).default(0.6),
  killSwitchEnabled: z.boolean().default(true),
});

export const UniverseConfigSchema = z.object({
  source: z
    .enum(["static", "dynamic", "alpaca_universe"])
    .default("alpaca_universe"),
  staticSymbols: z.array(z.string()).optional(),
  filters: z
    .object({
      minMarketCap: z.number().optional(),
      maxMarketCap: z.number().optional(),
      minAvgVolume: z.number().optional(),
      sectors: z.array(z.string()).optional(),
      excludeSymbols: z.array(z.string()).optional(),
      liquidityTier: z.array(z.enum(["high", "medium", "low"])).optional(),
    })
    .optional(),
  maxSymbols: z.number().min(1).default(50),
});

export const SignalsConfigSchema = z.object({
  technicalIndicators: z
    .array(
      z.object({
        name: z.string(),
        params: z.record(z.any()),
        weight: z.number().min(0).max(1).default(1),
      })
    )
    .optional(),
  sentimentSources: z
    .array(z.enum(["news", "social", "earnings", "insider"]))
    .optional(),
  fundamentalFactors: z.array(z.string()).optional(),
  customSignals: z
    .array(
      z.object({
        name: z.string(),
        expression: z.string(),
      })
    )
    .optional(),
});

export const LLMPolicySchema = z.object({
  role: z.string().default("execution_planner"),
  modelPreference: z.array(z.string()).optional(),
  maxTokens: z.number().default(2000),
  temperature: z.number().min(0).max(2).default(0.3),
  cacheableDurationMs: z.number().default(300000),
  requiredForExecution: z.boolean().default(false),
});

export const StrategySpecSchema = z.object({
  version: z.literal("1.0"),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.enum(["manual", "semi_auto", "full_auto"]).default("semi_auto"),

  triggers: z.array(TriggerSchema).min(1),
  guards: z.array(GuardSchema).default([]),
  actions: z.array(ActionSchema).min(1),

  risk: RiskConfigSchema.default({}),
  universe: UniverseConfigSchema.default({}),
  signals: SignalsConfigSchema.default({}),
  llmPolicy: LLMPolicySchema.optional(),

  schedule: z
    .object({
      enabled: z.boolean().default(true),
      intervalMs: z.number().min(60000).default(300000),
      marketHoursOnly: z.boolean().default(true),
    })
    .default({}),

  metadata: z
    .object({
      tags: z.array(z.string()).optional(),
      author: z.string().optional(),
      createdAt: z.string().optional(),
      lastModified: z.string().optional(),
    })
    .optional(),
});

export type TriggerCondition = z.infer<typeof TriggerConditionSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type Guard = z.infer<typeof GuardSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type RiskConfig = z.infer<typeof RiskConfigSchema>;
export type UniverseConfig = z.infer<typeof UniverseConfigSchema>;
export type SignalsConfig = z.infer<typeof SignalsConfigSchema>;
export type LLMPolicy = z.infer<typeof LLMPolicySchema>;
export type StrategySpec = z.infer<typeof StrategySpecSchema>;

export function validateStrategySpec(spec: unknown): {
  valid: boolean;
  spec?: StrategySpec;
  errors?: string[];
} {
  const result = StrategySpecSchema.safeParse(spec);
  if (result.success) {
    return { valid: true, spec: result.data };
  }
  return {
    valid: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}

export function createDefaultStrategySpec(name: string): StrategySpec {
  return {
    version: "1.0",
    name,
    type: "semi_auto",
    triggers: [
      {
        id: "default-trigger",
        name: "Price Alert",
        conditions: [
          {
            type: "price",
            field: "price",
            operator: "gt",
            value: 0,
          },
        ],
        logic: "AND",
        cooldownMinutes: 60,
        maxTriggersPerDay: 10,
        enabledDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      },
    ],
    guards: [],
    actions: [
      {
        id: "default-action",
        type: "notify",
        symbolSource: "trigger_context",
        sizeType: "dollars",
        size: 1000,
        timeInForce: "day",
        requireConfirmation: true,
      },
    ],
    risk: {
      maxOrdersPerDay: 20,
      maxNotionalPerOrder: 10000,
      maxTotalNotionalPerDay: 50000,
      maxPositionPercent: 0.1,
      maxPortfolioExposurePercent: 0.8,
      dailyLossLimitPercent: 0.03,
      cooldownBetweenOrdersMs: 30000,
      requireAiDebate: false,
      minAiConfidence: 0.6,
      killSwitchEnabled: true,
    },
    universe: {
      source: "alpaca_universe",
      maxSymbols: 50,
    },
    signals: {},
    schedule: {
      enabled: true,
      intervalMs: 300000,
      marketHoursOnly: true,
    },
  };
}
