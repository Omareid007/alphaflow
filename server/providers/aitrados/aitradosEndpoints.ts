export type OhlcInterval = "1min" | "5min" | "15min" | "30min" | "1hour" | "4hour" | "1day" | "1week";
export type SchemaAsset = "us_equity" | "crypto" | "forex" | "commodity" | "index";

export interface OhlcLatestParams {
  schemaAsset: SchemaAsset;
  countrySymbol: string;
  interval: OhlcInterval;
}

export interface NewsListParams {
  symbols?: string[];
  limit?: number;
  pageToken?: string;
  from?: string;
  to?: string;
  sources?: string[];
}

export interface EconomicEventParams {
  eventId?: string;
  country?: string;
  from?: string;
  to?: string;
  importance?: "low" | "medium" | "high";
}

function getBaseUrl(): string {
  return process.env.AITRADOS_BASE_URL || "https://api.aitrados.com";
}

export function buildOhlcLatestUrl(params: OhlcLatestParams): string {
  const base = getBaseUrl();
  return `${base}/api/v2/${params.schemaAsset}/bars/${params.countrySymbol}/${params.interval}/latest`;
}

export function buildNewsListUrl(params: NewsListParams = {}): string {
  const base = getBaseUrl();
  const url = new URL(`${base}/api/v2/news/list`);
  
  if (params.symbols?.length) {
    url.searchParams.set("symbols", params.symbols.join(","));
  }
  if (params.limit) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params.pageToken) {
    url.searchParams.set("pageToken", params.pageToken);
  }
  if (params.from) {
    url.searchParams.set("from", params.from);
  }
  if (params.to) {
    url.searchParams.set("to", params.to);
  }
  if (params.sources?.length) {
    url.searchParams.set("sources", params.sources.join(","));
  }
  
  return url.toString();
}

export function buildEconomicEventUrl(params: EconomicEventParams = {}): string {
  const base = getBaseUrl();
  const url = new URL(`${base}/api/v2/economic_calendar/event`);
  
  if (params.eventId) {
    url.searchParams.set("eventId", params.eventId);
  }
  if (params.country) {
    url.searchParams.set("country", params.country);
  }
  if (params.from) {
    url.searchParams.set("from", params.from);
  }
  if (params.to) {
    url.searchParams.set("to", params.to);
  }
  if (params.importance) {
    url.searchParams.set("importance", params.importance);
  }
  
  return url.toString();
}

export function buildCacheKey(endpointClass: string, ...parts: (string | number | undefined)[]): string {
  const filteredParts = parts.filter((p) => p !== undefined && p !== null);
  return `aitrados:${endpointClass}:${filteredParts.join(":")}`;
}
