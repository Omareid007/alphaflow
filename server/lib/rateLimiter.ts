import Bottleneck from "bottleneck";
import { log } from "../utils/logger";

export interface ProviderLimits {
  maxPerSecond?: number;
  maxPerMinute?: number;
  maxPerHour?: number;
  maxPerDay?: number;
  maxConcurrent?: number;
  minTime?: number;
}

const PROVIDER_LIMITS: Record<string, ProviderLimits> = {
  "sec-edgar": { maxPerSecond: 10, maxConcurrent: 5, minTime: 100 },
  "alpha-vantage": {
    maxPerDay: 25,
    maxPerMinute: 5,
    maxConcurrent: 1,
    minTime: 12000,
  },
  yfinance: { maxPerHour: 2000, maxPerMinute: 60, maxConcurrent: 3 },
  "polygon-free": { maxPerMinute: 5, maxConcurrent: 1, minTime: 12000 },

  binance: { maxPerMinute: 1200, maxConcurrent: 10 },
  defillama: { maxPerMinute: 60, maxConcurrent: 5 },
  cryptocompare: { maxPerSecond: 50, maxPerDay: 200000, maxConcurrent: 10 },

  fred: { maxPerMinute: 120, maxConcurrent: 5 },

  reddit: { maxPerMinute: 100, maxConcurrent: 2 },
  stocktwits: { maxPerMinute: 200, maxConcurrent: 3 },

  "yahoo-scrape": { maxPerMinute: 60, maxConcurrent: 2, minTime: 1000 },

  "huggingface-inference": { maxPerMinute: 30, maxConcurrent: 2 },

  alpaca: { maxPerMinute: 180, maxConcurrent: 5, minTime: 333 },
  finnhub: { maxPerMinute: 50, maxConcurrent: 3, minTime: 1200 },
  coingecko: {
    maxPerMinute: 10,
    maxPerDay: 500,
    maxConcurrent: 2,
    minTime: 2100,
  },
  newsapi: { maxPerDay: 80, maxConcurrent: 1, minTime: 3000 },
  twelvedata: {
    maxPerMinute: 6,
    maxPerDay: 700,
    maxConcurrent: 2,
    minTime: 10000,
  },
  valyu: { maxPerDay: 100, maxConcurrent: 1, minTime: 5000 },
  jina: { maxPerMinute: 30, maxConcurrent: 3, minTime: 2000 },
  gdelt: { maxPerMinute: 60, maxConcurrent: 3 },

  openai: { maxPerMinute: 60, maxConcurrent: 5 },
  claude: { maxPerMinute: 50, maxConcurrent: 3 },
  openrouter: { maxPerMinute: 100, maxConcurrent: 5 },
  groq: { maxPerMinute: 30, maxConcurrent: 3 },
  together: { maxPerMinute: 60, maxConcurrent: 5 },
  deepseek: { maxPerMinute: 60, maxConcurrent: 3 },
};

const limiters: Map<string, Bottleneck> = new Map();
const secondLimiters: Map<string, Bottleneck> = new Map();
const hourlyLimiters: Map<string, Bottleneck> = new Map();
const dailyLimiters: Map<string, Bottleneck> = new Map();

export function getLimiter(provider: string): Bottleneck {
  if (limiters.has(provider)) {
    return limiters.get(provider)!;
  }

  const limits = PROVIDER_LIMITS[provider] || {
    maxPerMinute: 60,
    maxConcurrent: 5,
  };

  const limiter = new Bottleneck({
    maxConcurrent: limits.maxConcurrent || 5,
    minTime: limits.minTime || 0,
    reservoir: limits.maxPerMinute,
    reservoirRefreshAmount: limits.maxPerMinute,
    reservoirRefreshInterval: 60 * 1000,
  });

  if (limits.maxPerSecond) {
    const secondLimiter = new Bottleneck({
      reservoir: limits.maxPerSecond,
      reservoirRefreshAmount: limits.maxPerSecond,
      reservoirRefreshInterval: 1000,
    });
    secondLimiters.set(provider, secondLimiter);
    limiter.chain(secondLimiter);
    log.debug(
      "RateLimiter",
      `[${provider}] Per-second limiter: ${limits.maxPerSecond}/s`
    );
  }

  if (limits.maxPerHour) {
    const hourlyLimiter = new Bottleneck({
      reservoir: limits.maxPerHour,
      reservoirRefreshAmount: limits.maxPerHour,
      reservoirRefreshInterval: 60 * 60 * 1000,
    });
    hourlyLimiters.set(provider, hourlyLimiter);
    limiter.chain(hourlyLimiter);
    log.debug(
      "RateLimiter",
      `[${provider}] Per-hour limiter: ${limits.maxPerHour}/h`
    );
  }

  if (limits.maxPerDay) {
    const dailyLimiter = new Bottleneck({
      reservoir: limits.maxPerDay,
      reservoirRefreshAmount: limits.maxPerDay,
      reservoirRefreshInterval: 24 * 60 * 60 * 1000,
    });
    dailyLimiters.set(provider, dailyLimiter);
    limiter.chain(dailyLimiter);
    log.debug(
      "RateLimiter",
      `[${provider}] Per-day limiter: ${limits.maxPerDay}/d`
    );
  }

  limiter.on("failed", (error, jobInfo) => {
    log.warn(
      "RateLimiter",
      `[${provider}] Job failed: ${(error as Error).message}`
    );
    if (jobInfo.retryCount < 3) {
      return 1000 * Math.pow(2, jobInfo.retryCount);
    }
    return undefined;
  });

  limiter.on("depleted", () => {
    log.debug(
      "RateLimiter",
      `[${provider}] Rate limit depleted, requests queued`
    );
  });

  limiters.set(provider, limiter);
  return limiter;
}

export function wrapWithLimiter<T>(
  provider: string,
  fn: () => Promise<T>
): Promise<T> {
  return getLimiter(provider).schedule(fn);
}

export interface ProviderStatus {
  running: number;
  queued: number;
  reservoir: number | null;
  secondReservoir: number | null;
  hourlyReservoir: number | null;
  dailyReservoir: number | null;
}

export async function getProviderStatus(
  provider: string
): Promise<ProviderStatus> {
  const limiter = limiters.get(provider);
  const secondLimiter = secondLimiters.get(provider);
  const hourlyLimiter = hourlyLimiters.get(provider);
  const dailyLimiter = dailyLimiters.get(provider);

  if (!limiter) {
    return {
      running: 0,
      queued: 0,
      reservoir: null,
      secondReservoir: null,
      hourlyReservoir: null,
      dailyReservoir: null,
    };
  }

  const counts = limiter.counts();
  const [reservoir, secondReservoir, hourlyReservoir, dailyReservoir] =
    await Promise.all([
      limiter.currentReservoir(),
      secondLimiter?.currentReservoir() ?? Promise.resolve(null),
      hourlyLimiter?.currentReservoir() ?? Promise.resolve(null),
      dailyLimiter?.currentReservoir() ?? Promise.resolve(null),
    ]);

  return {
    running: counts.RUNNING,
    queued: counts.QUEUED,
    reservoir,
    secondReservoir,
    hourlyReservoir,
    dailyReservoir,
  };
}

export async function getAllProviderStatus(): Promise<
  Record<string, ProviderStatus>
> {
  const status: Record<string, ProviderStatus> = {};
  const providers = Object.keys(PROVIDER_LIMITS);
  const results = await Promise.all(providers.map((p) => getProviderStatus(p)));
  providers.forEach((p, i) => {
    status[p] = results[i];
  });
  return status;
}

export function getProviderLimits(
  provider: string
): ProviderLimits | undefined {
  return PROVIDER_LIMITS[provider];
}

export function isProviderConfigured(provider: string): boolean {
  return provider in PROVIDER_LIMITS;
}

export function addProviderLimits(
  provider: string,
  limits: ProviderLimits
): void {
  PROVIDER_LIMITS[provider] = limits;
  limiters.delete(provider);
  secondLimiters.delete(provider);
  hourlyLimiters.delete(provider);
  dailyLimiters.delete(provider);
}
