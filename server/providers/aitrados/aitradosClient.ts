import { connectorFetch } from "../../lib/connectorClient";
import { ApiCache } from "../../lib/api-cache";
import { log } from "../../utils/logger";
import { 
  OhlcLatestResponseSchema,
  NewsListResponseSchema,
  EconomicEventResponseSchema,
  type OhlcLatestResponse,
  type NewsListResponse,
  type EconomicEventResponse,
} from "./aitradosSchemas";
import {
  buildOhlcLatestUrl,
  buildNewsListUrl,
  buildEconomicEventUrl,
  buildCacheKey,
  type OhlcLatestParams,
  type NewsListParams,
  type EconomicEventParams,
} from "./aitradosEndpoints";

const ohlcCache = new ApiCache<OhlcLatestResponse>({
  freshDuration: 60 * 1000,
  staleDuration: 15 * 60 * 1000,
});

const newsCache = new ApiCache<NewsListResponse>({
  freshDuration: 5 * 60 * 1000,
  staleDuration: 30 * 60 * 1000,
});

const econCache = new ApiCache<EconomicEventResponse>({
  freshDuration: 10 * 60 * 1000,
  staleDuration: 60 * 60 * 1000,
});

function getApiKey(): string | undefined {
  return process.env.AITRADOS_API_KEY;
}

function isEnabled(): boolean {
  return process.env.AITRADOS_ENABLED !== "false";
}

export interface AitradosClientResult<T> {
  data: T;
  provenance: {
    provider: string;
    endpointClass: "ohlc" | "news" | "econ";
    cacheStatus: "fresh" | "stale" | "miss";
    budgetRemaining: number;
    latencyMs: number;
    usedFallback: boolean;
    timestamp: number;
  };
}

async function aitradosFetch<T>(
  url: string,
  options: {
    endpoint: string;
    cacheKey: string;
    endpointClass: "ohlc" | "news" | "econ";
    l1Cache?: ApiCache<T>;
  }
): Promise<AitradosClientResult<T>> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("AITRADOS_API_KEY is not configured");
  }

  if (!isEnabled()) {
    throw new Error("AiTrados provider is disabled");
  }

  const providerName = `aitrados_${options.endpointClass}`;

  if (options.l1Cache) {
    const l1Cached = options.l1Cache.get(options.cacheKey);
    if (l1Cached?.isFresh) {
      log.debug("AitradosClient", `L1 cache HIT for ${options.cacheKey}`);
      return {
        data: l1Cached.data,
        provenance: {
          provider: providerName,
          endpointClass: options.endpointClass,
          cacheStatus: "fresh",
          budgetRemaining: Infinity,
          latencyMs: 0,
          usedFallback: false,
          timestamp: Date.now(),
        },
      };
    }
  }

  const result = await connectorFetch<T>(url, {
    provider: providerName,
    endpoint: options.endpoint,
    cacheKey: options.cacheKey,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "application/json",
    },
  });

  if (options.l1Cache && result.provenance.cacheStatus === "miss") {
    options.l1Cache.set(options.cacheKey, result.data);
  }

  return {
    data: result.data,
    provenance: {
      provider: result.provenance.provider,
      endpointClass: options.endpointClass,
      cacheStatus: result.provenance.cacheStatus,
      budgetRemaining: result.provenance.budgetRemaining,
      latencyMs: result.provenance.latencyMs,
      usedFallback: result.provenance.usedFallback,
      timestamp: result.provenance.timestamp,
    },
  };
}

export async function fetchOhlcLatest(
  params: OhlcLatestParams
): Promise<AitradosClientResult<OhlcLatestResponse>> {
  const url = buildOhlcLatestUrl(params);
  const cacheKey = buildCacheKey("ohlc", params.schemaAsset, params.countrySymbol, params.interval, "latest");
  
  const result = await aitradosFetch<OhlcLatestResponse>(url, {
    endpoint: `/ohlc/${params.countrySymbol}/${params.interval}/latest`,
    cacheKey,
    endpointClass: "ohlc",
    l1Cache: ohlcCache,
  });

  const parsed = OhlcLatestResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    log.warn("AitradosClient", `Invalid OHLC response for ${params.countrySymbol}`, {
      errors: parsed.error.errors.slice(0, 3),
    });
  }

  return result;
}

export async function fetchNewsList(
  params: NewsListParams = {}
): Promise<AitradosClientResult<NewsListResponse>> {
  const url = buildNewsListUrl(params);
  const symbolsKey = params.symbols?.join("-") || "all";
  const cacheKey = buildCacheKey("news", symbolsKey, params.limit?.toString() || "20");
  
  const result = await aitradosFetch<NewsListResponse>(url, {
    endpoint: "/news/list",
    cacheKey,
    endpointClass: "news",
    l1Cache: newsCache,
  });

  const parsed = NewsListResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    log.warn("AitradosClient", `Invalid news response`, {
      errors: parsed.error.errors.slice(0, 3),
    });
  }

  return result;
}

export async function fetchEconomicEvent(
  params: EconomicEventParams = {}
): Promise<AitradosClientResult<EconomicEventResponse>> {
  const url = buildEconomicEventUrl(params);
  const cacheKey = buildCacheKey("econ", params.eventId || "list", params.country || "all");
  
  const result = await aitradosFetch<EconomicEventResponse>(url, {
    endpoint: "/economic_calendar/event",
    cacheKey,
    endpointClass: "econ",
    l1Cache: econCache,
  });

  const parsed = EconomicEventResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    log.warn("AitradosClient", `Invalid economic event response`, {
      errors: parsed.error.errors.slice(0, 3),
    });
  }

  return result;
}

export function clearL1Caches(): void {
  ohlcCache.clear();
  newsCache.clear();
  econCache.clear();
  log.info("AitradosClient", "L1 caches cleared");
}

export function getL1CacheStats(): {
  ohlc: { size: number };
  news: { size: number };
  econ: { size: number };
} {
  return {
    ohlc: { size: ohlcCache.size() },
    news: { size: newsCache.size() },
    econ: { size: econCache.size() },
  };
}
