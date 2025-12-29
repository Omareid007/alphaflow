import { z } from "zod";

export const AitradosBaseResponseSchema = z.object({
  status: z.string(),
  code: z.number(),
  message: z.string(),
  reference: z.unknown().nullable().optional(),
});

export const OhlcBarSchema = z.object({
  timestamp: z.number().optional(),
  datetime: z.string().optional(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().optional(),
  vwap: z.number().optional(),
});

export const OhlcLatestResponseSchema = AitradosBaseResponseSchema.extend({
  result: z
    .object({
      symbol: z.string().optional(),
      interval: z.string().optional(),
      data: z.array(OhlcBarSchema).optional(),
    })
    .optional(),
});

export const NewsItemSchema = z.object({
  sentiment_label: z.string().nullable().optional(),
  sentiment_score: z.number().nullable().optional(),
  asset_name: z.string().optional(),
  country_iso_code: z.string().optional(),
  symbol: z.string().optional(),
  link_type: z.string().optional(),
  published_date: z.string(),
  publisher: z.string(),
  title: z.string(),
  text_content: z.string().optional(),
  publisher_url: z.string().optional(),
});

export const NewsListResponseSchema = AitradosBaseResponseSchema.extend({
  result: z
    .object({
      next_page_key: z.string().optional(),
      next_page_url: z.string().optional(),
      count: z.number().optional(),
      data: z.array(NewsItemSchema).optional(),
    })
    .optional(),
});

export const EconomicEventSchema = z.object({
  event_id: z.string().optional(),
  event_name: z.string().optional(),
  country: z.string().optional(),
  country_iso_code: z.string().optional(),
  event_datetime: z.string().optional(),
  actual: z.number().nullable().optional(),
  forecast: z.number().nullable().optional(),
  previous: z.number().nullable().optional(),
  importance: z.string().optional(),
  impact: z.string().optional(),
  unit: z.string().optional(),
});

export const EconomicEventResponseSchema = AitradosBaseResponseSchema.extend({
  result: z
    .object({
      next_page_key: z.string().optional(),
      next_page_url: z.string().optional(),
      count: z.number().optional(),
      data: z.array(EconomicEventSchema).optional(),
    })
    .optional(),
});

export const AitradosErrorSchema = z.object({
  status: z.string(),
  code: z.number(),
  message: z.string(),
  detail: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
      })
    )
    .optional(),
});

export type OhlcBar = z.infer<typeof OhlcBarSchema>;
export type OhlcLatestResponse = z.infer<typeof OhlcLatestResponseSchema>;
export type NewsItem = z.infer<typeof NewsItemSchema>;
export type NewsListResponse = z.infer<typeof NewsListResponseSchema>;
export type EconomicEvent = z.infer<typeof EconomicEventSchema>;
export type EconomicEventResponse = z.infer<typeof EconomicEventResponseSchema>;
export type AitradosError = z.infer<typeof AitradosErrorSchema>;
