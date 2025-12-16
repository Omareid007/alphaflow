import { z } from "zod";

export const OhlcBarSchema = z.object({
  timestamp: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().optional(),
  vwap: z.number().optional(),
});

export const OhlcLatestResponseSchema = z.object({
  symbol: z.string(),
  interval: z.string(),
  bar: OhlcBarSchema,
  source: z.string().optional(),
  asOfTimestamp: z.number().optional(),
});

export const NewsItemSchema = z.object({
  id: z.string(),
  headline: z.string(),
  summary: z.string().optional(),
  source: z.string(),
  url: z.string().optional(),
  publishedAt: z.string(),
  symbols: z.array(z.string()).optional(),
  sentiment: z.object({
    score: z.number().optional(),
    label: z.enum(["positive", "negative", "neutral"]).optional(),
  }).optional(),
  categories: z.array(z.string()).optional(),
});

export const NewsListResponseSchema = z.object({
  items: z.array(NewsItemSchema),
  totalCount: z.number().optional(),
  nextPageToken: z.string().optional(),
});

export const EconomicEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  currency: z.string().optional(),
  scheduledAt: z.string(),
  actual: z.number().nullable().optional(),
  forecast: z.number().nullable().optional(),
  previous: z.number().nullable().optional(),
  importance: z.enum(["low", "medium", "high"]).optional(),
  unit: z.string().optional(),
});

export const EconomicEventResponseSchema = z.object({
  event: EconomicEventSchema.optional(),
  events: z.array(EconomicEventSchema).optional(),
});

export const AitradosErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type OhlcBar = z.infer<typeof OhlcBarSchema>;
export type OhlcLatestResponse = z.infer<typeof OhlcLatestResponseSchema>;
export type NewsItem = z.infer<typeof NewsItemSchema>;
export type NewsListResponse = z.infer<typeof NewsListResponseSchema>;
export type EconomicEvent = z.infer<typeof EconomicEventSchema>;
export type EconomicEventResponse = z.infer<typeof EconomicEventResponseSchema>;
export type AitradosError = z.infer<typeof AitradosErrorSchema>;
