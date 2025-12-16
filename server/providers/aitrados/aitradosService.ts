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
    score?: number;
    label?: "positive" | "negative" | "neutral";
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

function normalizeOhlc(response: OhlcLatestResponse): NormalizedOhlcData {
  return {
    symbol: response.symbol,
    interval: response.interval,
    timestamp: response.bar.timestamp,
    open: response.bar.open,
    high: response.bar.high,
    low: response.bar.low,
    close: response.bar.close,
    volume: response.bar.volume,
    source: "aitrados",
  };
}

function normalizeNews(items: NewsItem[]): NormalizedNewsData[] {
  return items.map(item => ({
    id: item.id,
    headline: item.headline,
    summary: item.summary,
    source: item.source,
    publishedAt: new Date(item.publishedAt),
    symbols: item.symbols || [],
    sentiment: item.sentiment,
    source_provider: "aitrados" as const,
  }));
}

function normalizeEconomicEvent(event: EconomicEvent): NormalizedEconomicEvent {
  return {
    id: event.id,
    name: event.name,
    country: event.country,
    scheduledAt: new Date(event.scheduledAt),
    actual: event.actual,
    forecast: event.forecast,
    previous: event.previous,
    importance: event.importance,
    source_provider: "aitrados" as const,
  };
}

export async function getLatestOhlc(
  symbol: string,
  interval: OhlcLatestParams["interval"] = "1day",
  schemaAsset: OhlcLatestParams["schemaAsset"] = "us_equity"
): Promise<{ raw: OhlcLatestResponse; normalized: NormalizedOhlcData; provenance: unknown }> {
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
    normalized: normalizeOhlc(result.data),
    provenance: result.provenance,
  };
}

export async function getNewsList(
  params: NewsListParams = {}
): Promise<{ raw: NewsListResponse; normalized: NormalizedNewsData[]; provenance: unknown }> {
  if (!isAitradosEnabled()) {
    throw new Error("AiTrados provider is disabled");
  }

  const result = await fetchNewsList({
    limit: params.limit || 20,
    ...params,
  });

  return {
    raw: result.data,
    normalized: normalizeNews(result.data.items || []),
    provenance: result.provenance,
  };
}

export async function getEconomicEvents(
  params: EconomicEventParams = {}
): Promise<{ raw: EconomicEventResponse; normalized: NormalizedEconomicEvent[]; provenance: unknown }> {
  if (!isAitradosEnabled()) {
    throw new Error("AiTrados provider is disabled");
  }

  const result = await fetchEconomicEvent(params);

  const events = result.data.events || (result.data.event ? [result.data.event] : []);
  
  return {
    raw: result.data,
    normalized: events.map(normalizeEconomicEvent),
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
