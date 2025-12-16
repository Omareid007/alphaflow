import { log } from "../utils/logger";

export type WindowType = "minute" | "hour" | "day" | "week";

export interface ProviderPolicy {
  provider: string;
  maxRequestsPerMinute?: number;
  maxRequestsPerHour?: number;
  maxRequestsPerDay?: number;
  maxRequestsPerWeek?: number;
  maxTokensPerMinute?: number;
  maxTokensPerDay?: number;
  minRequestIntervalMs: number;
  cacheFreshDurationMs: number;
  cacheStaleDurationMs: number;
  priority: number;
  enabled: boolean;
}

const defaultPolicy: Omit<ProviderPolicy, "provider"> = {
  minRequestIntervalMs: 1000,
  cacheFreshDurationMs: 60 * 1000,
  cacheStaleDurationMs: 30 * 60 * 1000,
  priority: 5,
  enabled: true,
};

function envInt(key: string, defaultVal: number): number {
  const val = process.env[key];
  if (val !== undefined) {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return defaultVal;
}

function envBool(key: string, defaultVal: boolean): boolean {
  const val = process.env[key];
  if (val === "true" || val === "1") return true;
  if (val === "false" || val === "0") return false;
  return defaultVal;
}

const providerPolicies: Record<string, ProviderPolicy> = {
  alpaca: {
    provider: "alpaca",
    maxRequestsPerMinute: envInt("ALPACA_RATE_LIMIT_PER_MIN", 180),
    minRequestIntervalMs: envInt("ALPACA_MIN_INTERVAL_MS", 333),
    cacheFreshDurationMs: envInt("ALPACA_CACHE_FRESH_MS", 30 * 1000),
    cacheStaleDurationMs: envInt("ALPACA_CACHE_STALE_MS", 60 * 60 * 1000),
    priority: 10,
    enabled: envBool("ALPACA_ENABLED", true),
  },
  finnhub: {
    provider: "finnhub",
    maxRequestsPerMinute: envInt("FINNHUB_RATE_LIMIT_PER_MIN", 50),
    minRequestIntervalMs: envInt("FINNHUB_MIN_INTERVAL_MS", 1200),
    cacheFreshDurationMs: envInt("FINNHUB_CACHE_FRESH_MS", 60 * 1000),
    cacheStaleDurationMs: envInt("FINNHUB_CACHE_STALE_MS", 30 * 60 * 1000),
    priority: 8,
    enabled: envBool("FINNHUB_ENABLED", true),
  },
  coingecko: {
    provider: "coingecko",
    maxRequestsPerMinute: envInt("COINGECKO_RATE_LIMIT_PER_MIN", 10),
    maxRequestsPerDay: envInt("COINGECKO_RATE_LIMIT_PER_DAY", 500),
    minRequestIntervalMs: envInt("COINGECKO_MIN_INTERVAL_MS", 2100),
    cacheFreshDurationMs: envInt("COINGECKO_CACHE_FRESH_MS", 60 * 1000),
    cacheStaleDurationMs: envInt("COINGECKO_CACHE_STALE_MS", 30 * 60 * 1000),
    priority: 6,
    enabled: envBool("COINGECKO_ENABLED", true),
  },
  coinmarketcap: {
    provider: "coinmarketcap",
    maxRequestsPerMinute: envInt("COINMARKETCAP_RATE_LIMIT_PER_MIN", 30),
    maxRequestsPerDay: envInt("COINMARKETCAP_RATE_LIMIT_PER_DAY", 300),
    minRequestIntervalMs: envInt("COINMARKETCAP_MIN_INTERVAL_MS", 1000),
    cacheFreshDurationMs: envInt("COINMARKETCAP_CACHE_FRESH_MS", 5 * 60 * 1000),
    cacheStaleDurationMs: envInt("COINMARKETCAP_CACHE_STALE_MS", 60 * 60 * 1000),
    priority: 6,
    enabled: envBool("COINMARKETCAP_ENABLED", true),
  },
  newsapi: {
    provider: "newsapi",
    maxRequestsPerDay: envInt("NEWSAPI_RATE_LIMIT_PER_DAY", 100),
    minRequestIntervalMs: envInt("NEWSAPI_MIN_INTERVAL_MS", 3000),
    cacheFreshDurationMs: envInt("NEWSAPI_CACHE_FRESH_MS", 60 * 60 * 1000),
    cacheStaleDurationMs: envInt("NEWSAPI_CACHE_STALE_MS", 24 * 60 * 60 * 1000),
    priority: 4,
    enabled: envBool("NEWSAPI_ENABLED", true),
  },
  polygon: {
    provider: "polygon",
    maxRequestsPerMinute: envInt("POLYGON_RATE_LIMIT_PER_MIN", 5),
    minRequestIntervalMs: envInt("POLYGON_MIN_INTERVAL_MS", 12000),
    cacheFreshDurationMs: envInt("POLYGON_CACHE_FRESH_MS", 60 * 1000),
    cacheStaleDurationMs: envInt("POLYGON_CACHE_STALE_MS", 60 * 60 * 1000),
    priority: 5,
    enabled: envBool("POLYGON_ENABLED", true),
  },
  twelvedata: {
    provider: "twelvedata",
    maxRequestsPerMinute: envInt("TWELVEDATA_RATE_LIMIT_PER_MIN", 6),
    maxRequestsPerDay: envInt("TWELVEDATA_RATE_LIMIT_PER_DAY", 700),
    minRequestIntervalMs: envInt("TWELVEDATA_MIN_INTERVAL_MS", 10000),
    cacheFreshDurationMs: envInt("TWELVEDATA_CACHE_FRESH_MS", 60 * 1000),
    cacheStaleDurationMs: envInt("TWELVEDATA_CACHE_STALE_MS", 5 * 60 * 1000),
    priority: 5,
    enabled: envBool("TWELVEDATA_ENABLED", true),
  },
  valyu: {
    provider: "valyu",
    maxRequestsPerWeek: envInt("VALYU_RATE_LIMIT_PER_WEEK", 100),
    minRequestIntervalMs: envInt("VALYU_MIN_INTERVAL_MS", 5000),
    cacheFreshDurationMs: envInt("VALYU_CACHE_FRESH_MS", 7 * 24 * 60 * 60 * 1000),
    cacheStaleDurationMs: envInt("VALYU_CACHE_STALE_MS", 90 * 24 * 60 * 60 * 1000),
    priority: 2,
    enabled: envBool("VALYU_ENABLED", true),
  },
  huggingface: {
    provider: "huggingface",
    maxRequestsPerMinute: envInt("HUGGINGFACE_RATE_LIMIT_PER_MIN", 30),
    maxRequestsPerDay: envInt("HUGGINGFACE_RATE_LIMIT_PER_DAY", 1000),
    minRequestIntervalMs: envInt("HUGGINGFACE_MIN_INTERVAL_MS", 200),
    cacheFreshDurationMs: envInt("HUGGINGFACE_CACHE_FRESH_MS", 30 * 60 * 1000),
    cacheStaleDurationMs: envInt("HUGGINGFACE_CACHE_STALE_MS", 2 * 60 * 60 * 1000),
    priority: 7,
    enabled: envBool("HUGGINGFACE_ENABLED", true),
  },
  gdelt: {
    provider: "gdelt",
    maxRequestsPerMinute: envInt("GDELT_RATE_LIMIT_PER_MIN", 60),
    minRequestIntervalMs: envInt("GDELT_MIN_INTERVAL_MS", 500),
    cacheFreshDurationMs: envInt("GDELT_CACHE_FRESH_MS", 10 * 60 * 1000),
    cacheStaleDurationMs: envInt("GDELT_CACHE_STALE_MS", 30 * 60 * 1000),
    priority: 5,
    enabled: envBool("GDELT_ENABLED", true),
  },
  openai: {
    provider: "openai",
    maxRequestsPerMinute: envInt("OPENAI_RATE_LIMIT_PER_MIN", 60),
    maxTokensPerMinute: envInt("OPENAI_TOKENS_PER_MIN", 90000),
    maxTokensPerDay: envInt("OPENAI_TOKENS_PER_DAY", 1000000),
    minRequestIntervalMs: envInt("OPENAI_MIN_INTERVAL_MS", 100),
    cacheFreshDurationMs: envInt("OPENAI_CACHE_FRESH_MS", 60 * 60 * 1000),
    cacheStaleDurationMs: envInt("OPENAI_CACHE_STALE_MS", 24 * 60 * 60 * 1000),
    priority: 9,
    enabled: envBool("OPENAI_ENABLED", true),
  },
  groq: {
    provider: "groq",
    maxRequestsPerMinute: envInt("GROQ_RATE_LIMIT_PER_MIN", 30),
    maxTokensPerMinute: envInt("GROQ_TOKENS_PER_MIN", 30000),
    maxTokensPerDay: envInt("GROQ_TOKENS_PER_DAY", 500000),
    minRequestIntervalMs: envInt("GROQ_MIN_INTERVAL_MS", 200),
    cacheFreshDurationMs: envInt("GROQ_CACHE_FRESH_MS", 60 * 60 * 1000),
    cacheStaleDurationMs: envInt("GROQ_CACHE_STALE_MS", 24 * 60 * 60 * 1000),
    priority: 8,
    enabled: envBool("GROQ_ENABLED", true),
  },
  together: {
    provider: "together",
    maxRequestsPerMinute: envInt("TOGETHER_RATE_LIMIT_PER_MIN", 60),
    maxTokensPerMinute: envInt("TOGETHER_TOKENS_PER_MIN", 60000),
    maxTokensPerDay: envInt("TOGETHER_TOKENS_PER_DAY", 800000),
    minRequestIntervalMs: envInt("TOGETHER_MIN_INTERVAL_MS", 100),
    cacheFreshDurationMs: envInt("TOGETHER_CACHE_FRESH_MS", 60 * 60 * 1000),
    cacheStaleDurationMs: envInt("TOGETHER_CACHE_STALE_MS", 24 * 60 * 60 * 1000),
    priority: 8,
    enabled: envBool("TOGETHER_ENABLED", true),
  },
  stocktwits: {
    provider: "stocktwits",
    maxRequestsPerHour: envInt("STOCKTWITS_RATE_LIMIT_PER_HOUR", 200),
    minRequestIntervalMs: envInt("STOCKTWITS_MIN_INTERVAL_MS", 3000),
    cacheFreshDurationMs: envInt("STOCKTWITS_CACHE_FRESH_MS", 5 * 60 * 1000),
    cacheStaleDurationMs: envInt("STOCKTWITS_CACHE_STALE_MS", 15 * 60 * 1000),
    priority: 4,
    enabled: envBool("STOCKTWITS_ENABLED", true),
  },
  reddit: {
    provider: "reddit",
    maxRequestsPerMinute: envInt("REDDIT_RATE_LIMIT_PER_MIN", 60),
    minRequestIntervalMs: envInt("REDDIT_MIN_INTERVAL_MS", 1000),
    cacheFreshDurationMs: envInt("REDDIT_CACHE_FRESH_MS", 5 * 60 * 1000),
    cacheStaleDurationMs: envInt("REDDIT_CACHE_STALE_MS", 30 * 60 * 1000),
    priority: 3,
    enabled: envBool("REDDIT_ENABLED", true),
  },
  aitrados_ohlc: {
    provider: "aitrados_ohlc",
    maxRequestsPerHour: envInt("AITRADOS_OHLC_RATE_LIMIT_PER_HOUR", 100),
    maxRequestsPerDay: envInt("AITRADOS_OHLC_RATE_LIMIT_PER_DAY", 1000),
    minRequestIntervalMs: envInt("AITRADOS_OHLC_MIN_INTERVAL_MS", 500),
    cacheFreshDurationMs: envInt("AITRADOS_OHLC_CACHE_FRESH_MS", 60 * 1000),
    cacheStaleDurationMs: envInt("AITRADOS_OHLC_CACHE_STALE_MS", 15 * 60 * 1000),
    priority: 6,
    enabled: envBool("AITRADOS_ENABLED", true),
  },
  aitrados_news: {
    provider: "aitrados_news",
    maxRequestsPerHour: envInt("AITRADOS_NEWS_RATE_LIMIT_PER_HOUR", 50),
    maxRequestsPerDay: envInt("AITRADOS_NEWS_RATE_LIMIT_PER_DAY", 500),
    minRequestIntervalMs: envInt("AITRADOS_NEWS_MIN_INTERVAL_MS", 1000),
    cacheFreshDurationMs: envInt("AITRADOS_NEWS_CACHE_FRESH_MS", 5 * 60 * 1000),
    cacheStaleDurationMs: envInt("AITRADOS_NEWS_CACHE_STALE_MS", 30 * 60 * 1000),
    priority: 5,
    enabled: envBool("AITRADOS_ENABLED", true),
  },
  aitrados_econ: {
    provider: "aitrados_econ",
    maxRequestsPerHour: envInt("AITRADOS_ECON_RATE_LIMIT_PER_HOUR", 30),
    maxRequestsPerDay: envInt("AITRADOS_ECON_RATE_LIMIT_PER_DAY", 200),
    minRequestIntervalMs: envInt("AITRADOS_ECON_MIN_INTERVAL_MS", 2000),
    cacheFreshDurationMs: envInt("AITRADOS_ECON_CACHE_FRESH_MS", 10 * 60 * 1000),
    cacheStaleDurationMs: envInt("AITRADOS_ECON_CACHE_STALE_MS", 60 * 60 * 1000),
    priority: 5,
    enabled: envBool("AITRADOS_ENABLED", true),
  },
};

export function getProviderPolicy(provider: string): ProviderPolicy {
  const policy = providerPolicies[provider.toLowerCase()];
  if (policy) return policy;
  
  log.debug("ApiPolicy", `No policy found for provider ${provider}, using defaults`);
  return { ...defaultPolicy, provider };
}

export function getAllProviderPolicies(): ProviderPolicy[] {
  return Object.values(providerPolicies);
}

export function updateProviderPolicy(provider: string, updates: Partial<ProviderPolicy>): void {
  const existing = providerPolicies[provider.toLowerCase()];
  if (existing) {
    providerPolicies[provider.toLowerCase()] = { ...existing, ...updates };
    log.info("ApiPolicy", `Updated policy for ${provider}`, updates);
  } else {
    providerPolicies[provider.toLowerCase()] = { ...defaultPolicy, provider, ...updates };
    log.info("ApiPolicy", `Created new policy for ${provider}`, updates);
  }
}

export function disableProvider(provider: string): void {
  updateProviderPolicy(provider, { enabled: false });
}

export function enableProvider(provider: string): void {
  updateProviderPolicy(provider, { enabled: true });
}

export function getWindowDurationMs(windowType: WindowType): number {
  switch (windowType) {
    case "minute": return 60 * 1000;
    case "hour": return 60 * 60 * 1000;
    case "day": return 24 * 60 * 60 * 1000;
    case "week": return 7 * 24 * 60 * 60 * 1000;
  }
}

export function getWindowBoundaries(windowType: WindowType): { start: Date; end: Date } {
  const now = new Date();
  const durationMs = getWindowDurationMs(windowType);
  
  let start: Date;
  switch (windowType) {
    case "minute":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);
      break;
    case "hour":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
      break;
    case "day":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      break;
    case "week":
      const dayOfWeek = now.getDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
      break;
  }
  
  return { start, end: new Date(start.getTime() + durationMs) };
}

export function getLimitForWindow(policy: ProviderPolicy, windowType: WindowType): number | undefined {
  switch (windowType) {
    case "minute": return policy.maxRequestsPerMinute;
    case "hour": return policy.maxRequestsPerHour;
    case "day": return policy.maxRequestsPerDay;
    case "week": return policy.maxRequestsPerWeek;
  }
}
