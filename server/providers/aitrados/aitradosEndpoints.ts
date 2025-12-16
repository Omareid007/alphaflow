export type OhlcInterval = "1M" | "3M" | "5M" | "10M" | "15M" | "30M" | "60M" | "120M" | "240M" | "DAY" | "WEEK" | "MON";
export type SchemaAsset = "stock" | "crypto" | "forex" | "future" | "option";

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
  return process.env.AITRADOS_BASE_URL || "https://default.dataset-api.aitrados.com";
}

function getApiKey(): string {
  return process.env.AITRADOS_API_KEY || "";
}

export function buildOhlcLatestUrl(params: OhlcLatestParams): string {
  const base = getBaseUrl();
  const url = new URL(`${base}/api/v2/${params.schemaAsset}/bars/${params.countrySymbol}/${params.interval}/latest`);
  url.searchParams.set("secret_key", getApiKey());
  return url.toString();
}

export function buildNewsListUrl(params: NewsListParams = {}): string {
  const base = getBaseUrl();
  const url = new URL(`${base}/api/v2/news/list`);
  
  url.searchParams.set("secret_key", getApiKey());
  
  const now = new Date();
  const fromDate = params.from || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const toDate = params.to || now.toISOString().split("T")[0];
  url.searchParams.set("from_date", fromDate);
  url.searchParams.set("to_date", toDate);
  
  if (params.symbols?.length) {
    url.searchParams.set("symbols", params.symbols.join(","));
  }
  if (params.limit) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params.pageToken) {
    url.searchParams.set("page_token", params.pageToken);
  }
  if (params.sources?.length) {
    url.searchParams.set("sources", params.sources.join(","));
  }
  
  return url.toString();
}

export function buildEconomicEventUrl(params: EconomicEventParams = {}): string {
  const base = getBaseUrl();
  const url = new URL(`${base}/api/v2/economic_calendar/event`);
  
  url.searchParams.set("secret_key", getApiKey());
  
  const now = new Date();
  const fromDate = params.from || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const toDate = params.to || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  url.searchParams.set("from_date", fromDate);
  url.searchParams.set("to_date", toDate);
  
  if (params.eventId) {
    url.searchParams.set("event_id", params.eventId);
  }
  if (params.country) {
    url.searchParams.set("country", params.country);
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
