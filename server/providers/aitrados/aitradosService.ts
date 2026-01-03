import {
  fetchOhlcLatest,
  fetchNewsList,
  fetchEconomicEvent,
  clearL1Caches,
  getL1CacheStats,
} from "./aitradosClient";
import type {
  OhlcLatestParams,
  NewsListParams,
  EconomicEventParams,
} from "./aitradosEndpoints";
import type {
  OhlcLatestResponse,
  NewsListResponse,
  EconomicEventResponse,
  NewsItem,
  EconomicEvent,
  OhlcBar,
} from "./aitradosSchemas";
import { log } from "../../utils/logger";

export function isAitradosEnabled(): boolean {
  return process.env.AITRADOS_ENABLED !== "false";
}

export function isAitradosConfigured(): boolean {
  return !!process.env.AITRADOS_API_KEY;
}

export interface NormalizedOhlcData {
  symbol: string;
  interval: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  source: "aitrados";
}

export interface NormalizedNewsData {
  id: string;
  headline: string;
  summary?: string;
  source: string;
  publishedAt: Date;
  symbols: string[];
  sentiment?: {
    score?: number | null;
    label?: "positive" | "negative" | "neutral" | null;
  };
  source_provider: "aitrados";
}

export interface NormalizedEconomicEvent {
  id: string;
  name: string;
  country: string;
  scheduledAt: Date;
  actual?: number | null;
  forecast?: number | null;
  previous?: number | null;
  importance?: "low" | "medium" | "high";
  source_provider: "aitrados";
}

function normalizeOhlc(
  response: OhlcLatestResponse,
  symbol: string,
  interval: string
): NormalizedOhlcData {
  const bar = response.result?.data?.[0];
  if (!bar) {
    return {
      symbol,
      interval,
      timestamp: Date.now(),
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      source: "aitrados",
    };
  }

  return {
    symbol: response.result?.symbol || symbol,
    interval: response.result?.interval || interval,
    timestamp:
      bar.timestamp ||
      (bar.datetime ? new Date(bar.datetime).getTime() : Date.now()),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    source: "aitrados",
  };
}

function normalizeNews(items: NewsItem[]): NormalizedNewsData[] {
  return items.map((item, index) => ({
    id: `aitrados-news-${index}-${Date.now()}`,
    headline: item.title,
    summary: item.text_content,
    source: item.publisher,
    publishedAt: new Date(item.published_date),
    symbols: item.symbol ? [item.symbol] : [],
    sentiment:
      item.sentiment_score !== null || item.sentiment_label !== null
        ? {
            score: item.sentiment_score,
            label: item.sentiment_label as
              | "positive"
              | "negative"
              | "neutral"
              | null,
          }
        : undefined,
    source_provider: "aitrados" as const,
  }));
}

function normalizeEconomicEvent(
  event: EconomicEvent,
  index: number
): NormalizedEconomicEvent {
  const importanceMap: Record<string, "low" | "medium" | "high"> = {
    low: "low",
    medium: "medium",
    high: "high",
  };

  return {
    id: event.event_id || `aitrados-event-${index}`,
    name: event.event_name || "Unknown Event",
    country: event.country || event.country_iso_code || "Unknown",
    scheduledAt: new Date(event.event_datetime || Date.now()),
    actual: event.actual,
    forecast: event.forecast,
    previous: event.previous,
    importance: event.importance
      ? importanceMap[event.importance.toLowerCase()]
      : undefined,
    source_provider: "aitrados" as const,
  };
}

export async function getLatestOhlc(
  symbol: string,
  interval: OhlcLatestParams["interval"] = "DAY",
  schemaAsset: OhlcLatestParams["schemaAsset"] = "stock"
): Promise<{
  raw: OhlcLatestResponse;
  normalized: NormalizedOhlcData;
  provenance: unknown;
}> {
  if (!isAitradosEnabled()) {
    throw new Error("AiTrados provider is disabled");
  }

  const result = await fetchOhlcLatest({
    schemaAsset,
    countrySymbol: symbol,
    interval,
  });

  return {
    raw: result.data,
    normalized: normalizeOhlc(result.data, symbol, interval),
    provenance: result.provenance,
  };
}

export async function getNewsList(params: NewsListParams = {}): Promise<{
  raw: NewsListResponse;
  normalized: NormalizedNewsData[];
  provenance: unknown;
}> {
  if (!isAitradosEnabled()) {
    throw new Error("AiTrados provider is disabled");
  }

  const result = await fetchNewsList({
    limit: params.limit || 20,
    ...params,
  });

  const items = result.data.result?.data || [];

  return {
    raw: result.data,
    normalized: normalizeNews(items),
    provenance: result.provenance,
  };
}

export async function getEconomicEvents(
  params: EconomicEventParams = {}
): Promise<{
  raw: EconomicEventResponse;
  normalized: NormalizedEconomicEvent[];
  provenance: unknown;
}> {
  if (!isAitradosEnabled()) {
    throw new Error("AiTrados provider is disabled");
  }

  const result = await fetchEconomicEvent(params);

  const events = result.data.result?.data || [];

  return {
    raw: result.data,
    normalized: events.map((e, i) => normalizeEconomicEvent(e, i)),
    provenance: result.provenance,
  };
}

export async function testConnection(): Promise<{
  success: boolean;
  latencyMs: number;
  error?: string;
}> {
  if (!isAitradosConfigured()) {
    return {
      success: false,
      latencyMs: 0,
      error: "AITRADOS_API_KEY is not configured",
    };
  }

  if (!isAitradosEnabled()) {
    return {
      success: false,
      latencyMs: 0,
      error: "AiTrados provider is disabled",
    };
  }

  const startTime = Date.now();

  try {
    await fetchNewsList({ limit: 1 });
    return {
      success: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getServiceStatus(): {
  enabled: boolean;
  configured: boolean;
  l1CacheStats: ReturnType<typeof getL1CacheStats>;
} {
  return {
    enabled: isAitradosEnabled(),
    configured: isAitradosConfigured(),
    l1CacheStats: getL1CacheStats(),
  };
}

export { clearL1Caches };
