import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const killSwitchSchema = z.object({
  activate: z.boolean(),
  reason: z.string().optional(),
});

export const riskLimitsSchema = z.object({
  maxPositionSizePercent: z.number().min(1).max(100).optional(),
  maxTotalExposurePercent: z.number().min(1).max(300).optional(), // Allow up to 300% for margin accounts
  maxPositionsCount: z.number().min(1).max(100).optional(),
  dailyLossLimitPercent: z.number().min(0.1).max(100).optional(),
});

export const modeSchema = z.object({
  mode: z.enum(["autonomous", "semi-auto", "manual"]),
});

export const closePositionSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
});

export const executeTradesSchema = z.object({
  decisionIds: z.array(z.string()).min(1, "At least one decision ID required"),
});

export const executeTradeSchema = z
  .object({
    symbol: z.string().min(1, "Symbol is required"),
    side: z.enum(["buy", "sell"]),
    quantity: z.number().positive().optional(),
    notional: z.number().positive().optional(),
    orderType: z
      .enum(["market", "limit", "stop", "stop_limit", "trailing_stop"])
      .optional(),
    limitPrice: z.number().positive().optional(),
    stopPrice: z.number().positive().optional(),
    timeInForce: z.enum(["day", "gtc", "opg", "cls", "ioc", "fok"]).optional(),
    extendedHours: z.boolean().optional(),
    takeProfitPrice: z.number().positive().optional(),
    stopLossPrice: z.number().positive().optional(),
    trailPercent: z.number().positive().optional(),
  })
  .refine(
    (data) => data.quantity !== undefined || data.notional !== undefined,
    { message: "Either quantity or notional amount is required" }
  );

export const quickTradeSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  side: z.enum(["buy", "sell"]),
  amount: z.number().positive("Amount must be positive"),
  orderType: z.enum(["market", "limit"]).optional(),
  limitPrice: z.number().positive().optional(),
  extendedHours: z.boolean().optional(),
});

export const alpacaOrderSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  side: z.enum(["buy", "sell"]),
  qty: z.string().optional(),
  notional: z.string().optional(),
  type: z
    .enum(["market", "limit", "stop", "stop_limit", "trailing_stop"])
    .optional(),
  time_in_force: z.enum(["day", "gtc", "opg", "cls", "ioc", "fok"]).optional(),
  limit_price: z.string().optional(),
  stop_price: z.string().optional(),
  extended_hours: z.boolean().optional(),
  order_class: z.enum(["simple", "bracket", "oco", "oto"]).optional(),
  take_profit: z.object({ limit_price: z.string() }).optional(),
  stop_loss: z
    .object({
      stop_price: z.string(),
      limit_price: z.string().optional(),
    })
    .optional(),
  trail_percent: z.string().optional(),
  trail_price: z.string().optional(),
});

export const bracketOrderSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  qty: z.string().min(1, "Quantity is required"),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["market", "limit"]).optional(),
  time_in_force: z.enum(["day", "gtc"]).optional(),
  limit_price: z.string().optional(),
  take_profit_price: z.string().min(1, "Take profit price is required"),
  stop_loss_price: z.string().min(1, "Stop loss price is required"),
  stop_loss_limit_price: z.string().optional(),
});

export const trailingStopSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  qty: z.string().min(1, "Quantity is required"),
  side: z.enum(["buy", "sell"]),
  trail_percent: z.number().positive().optional(),
  trail_price: z.number().positive().optional(),
  time_in_force: z.enum(["day", "gtc"]).optional(),
});

export const closeAllPositionsSchema = z.object({
  cancelOrders: z.boolean().optional(),
});

export const symbolParamSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
});

export const searchAssetsSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  assetClass: z.enum(["us_equity", "crypto"]).optional(),
});

export const analyzeOpportunitySchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  marketData: z
    .object({
      symbol: z.string(),
      currentPrice: z.number().positive(),
      priceChange24h: z.number().optional(),
      priceChangePercent24h: z.number().optional(),
      high24h: z.number().optional(),
      low24h: z.number().optional(),
      volume: z.number().optional(),
      marketCap: z.number().optional(),
    })
    .optional(),
  newsContext: z
    .object({
      headlines: z
        .array(
          z.object({
            title: z.string(),
            source: z.string().optional(),
            publishedAt: z.string().optional(),
            sentiment: z.number().optional(),
          })
        )
        .optional(),
      overallSentiment: z.number().optional(),
    })
    .optional(),
  strategyContext: z
    .object({
      id: z.string().optional(),
      name: z.string().optional(),
      type: z.string().optional(),
      parameters: z.record(z.unknown()).optional(),
    })
    .optional(),
});

export const barsQuerySchema = z.object({
  timeframe: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  limit: z.string().optional(),
});

export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
});

export const tradesFilterSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0)),
  symbol: z.string().optional(),
  strategyId: z.string().optional(),
  pnlDirection: z.enum(["profit", "loss", "all"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const portfolioHistorySchema = z.object({
  period: z.enum(["1D", "1W", "1M", "3M", "1A", "all"]).optional(),
  timeframe: z.enum(["1Min", "5Min", "15Min", "1H", "1D"]).optional(),
});

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessage = result.error.errors
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join("; ");
  return { success: false, error: errorMessage };
}

export function safeParseNumber(
  value: string | number | undefined | null
): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "number" ? value : parseFloat(value);
  return isNaN(num) ? null : num;
}

export function normalizeNumericFields<T extends Record<string, unknown>>(
  obj: T,
  numericFields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of numericFields) {
    const value = result[field];
    if (value !== undefined && value !== null) {
      const num = safeParseNumber(value as string | number);
      if (num !== null) {
        (result as Record<string, unknown>)[field as string] = num;
      }
    }
  }
  return result;
}
