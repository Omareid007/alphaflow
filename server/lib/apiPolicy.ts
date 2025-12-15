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

const providerPolicies: Record<string, ProviderPolicy> = {
  alpaca: {
    provider: "alpaca",
    maxRequestsPerMinute: 180,
    minRequestIntervalMs: 333,
    cacheFreshDurationMs: 30 * 1000,
    cacheStaleDurationMs: 60 * 60 * 1000,
    priority: 10,
    enabled: true,
  },
  finnhub: {
    provider: "finnhub",
    maxRequestsPerMinute: 50,
    minRequestIntervalMs: 1200,
    cacheFreshDurationMs: 60 * 1000,
    cacheStaleDurationMs: 30 * 60 * 1000,
    priority: 8,
    enabled: true,
  },
  coingecko: {
    provider: "coingecko",
    maxRequestsPerMinute: 10,
    maxRequestsPerDay: 500,
    minRequestIntervalMs: 2100,
    cacheFreshDurationMs: 60 * 1000,
    cacheStaleDurationMs: 30 * 60 * 1000,
    priority: 6,
    enabled: true,
  },
  coinmarketcap: {
    provider: "coinmarketcap",
    maxRequestsPerMinute: 20,
    maxRequestsPerDay: 300,
    minRequestIntervalMs: 1000,
    cacheFreshDurationMs: 5 * 60 * 1000,
    cacheStaleDurationMs: 60 * 60 * 1000,
    priority: 6,
    enabled: true,
  },
  newsapi: {
    provider: "newsapi",
    maxRequestsPerDay: 80,
    minRequestIntervalMs: 3000,
    cacheFreshDurationMs: 60 * 60 * 1000,
    cacheStaleDurationMs: 24 * 60 * 60 * 1000,
    priority: 4,
    enabled: true,
  },
  polygon: {
    provider: "polygon",
    maxRequestsPerMinute: 4,
    minRequestIntervalMs: 15000,
    cacheFreshDurationMs: 60 * 1000,
    cacheStaleDurationMs: 60 * 60 * 1000,
    priority: 5,
    enabled: true,
  },
  twelvedata: {
    provider: "twelvedata",
    maxRequestsPerMinute: 6,
    maxRequestsPerDay: 700,
    minRequestIntervalMs: 10000,
    cacheFreshDurationMs: 60 * 1000,
    cacheStaleDurationMs: 5 * 60 * 1000,
    priority: 5,
    enabled: true,
  },
  valyu: {
    provider: "valyu",
    maxRequestsPerWeek: 1,
    minRequestIntervalMs: 60000,
    cacheFreshDurationMs: 7 * 24 * 60 * 60 * 1000,
    cacheStaleDurationMs: 90 * 24 * 60 * 60 * 1000,
    priority: 2,
    enabled: true,
  },
  huggingface: {
    provider: "huggingface",
    maxRequestsPerMinute: 30,
    maxRequestsPerDay: 1000,
    minRequestIntervalMs: 200,
    cacheFreshDurationMs: 30 * 60 * 1000,
    cacheStaleDurationMs: 2 * 60 * 60 * 1000,
    priority: 7,
    enabled: true,
  },
  gdelt: {
    provider: "gdelt",
    maxRequestsPerMinute: 60,
    minRequestIntervalMs: 500,
    cacheFreshDurationMs: 10 * 60 * 1000,
    cacheStaleDurationMs: 30 * 60 * 1000,
    priority: 5,
    enabled: true,
  },
  openai: {
    provider: "openai",
    maxRequestsPerMinute: 60,
    maxTokensPerMinute: 90000,
    maxTokensPerDay: 1000000,
    minRequestIntervalMs: 100,
    cacheFreshDurationMs: 60 * 60 * 1000,
    cacheStaleDurationMs: 24 * 60 * 60 * 1000,
    priority: 9,
    enabled: true,
  },
  groq: {
    provider: "groq",
    maxRequestsPerMinute: 30,
    maxTokensPerMinute: 30000,
    maxTokensPerDay: 500000,
    minRequestIntervalMs: 200,
    cacheFreshDurationMs: 60 * 60 * 1000,
    cacheStaleDurationMs: 24 * 60 * 60 * 1000,
    priority: 8,
    enabled: true,
  },
  together: {
    provider: "together",
    maxRequestsPerMinute: 60,
    maxTokensPerMinute: 60000,
    maxTokensPerDay: 800000,
    minRequestIntervalMs: 100,
    cacheFreshDurationMs: 60 * 60 * 1000,
    cacheStaleDurationMs: 24 * 60 * 60 * 1000,
    priority: 8,
    enabled: true,
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
