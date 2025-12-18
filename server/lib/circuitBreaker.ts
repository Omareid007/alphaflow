import CircuitBreaker from 'opossum';
import { log } from '../utils/logger';

interface BreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
}

const DEFAULT_OPTIONS: BreakerOptions = {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 5,
};

const breakers: Map<string, CircuitBreaker<any[], any>> = new Map();

export type BreakerState = 'open' | 'closed' | 'halfOpen';

export interface BreakerStats {
  name: string;
  state: BreakerState;
  failures: number;
  successes: number;
  fallbacks: number;
  rejects: number;
  timeouts: number;
  cacheHits: number;
  cacheMisses: number;
  latencyMean: number;
  percentiles: { [key: string]: number };
}

export function getBreaker<T extends any[], R>(
  name: string,
  fn: (...args: T) => Promise<R>,
  options?: BreakerOptions,
  fallback?: (...args: T) => R | Promise<R>
): CircuitBreaker<T, R> {
  const key = name;
  
  if (breakers.has(key)) {
    return breakers.get(key)! as CircuitBreaker<T, R>;
  }

  const breaker = new CircuitBreaker(fn, {
    ...DEFAULT_OPTIONS,
    ...options,
    name,
  });

  if (fallback) {
    breaker.fallback(fallback);
  }

  breaker.on('open', () => {
    log.warn('CircuitBreaker', `[${name}] OPEN - failing fast`);
  });

  breaker.on('halfOpen', () => {
    log.info('CircuitBreaker', `[${name}] HALF-OPEN - testing`);
  });

  breaker.on('close', () => {
    log.info('CircuitBreaker', `[${name}] CLOSED - recovered`);
  });

  breaker.on('fallback', () => {
    log.debug('CircuitBreaker', `[${name}] Using fallback`);
  });

  breaker.on('timeout', () => {
    log.warn('CircuitBreaker', `[${name}] Request timed out`);
  });

  breakers.set(key, breaker);
  return breaker;
}

export function getBreakerStats(name: string): BreakerStats | null {
  const breaker = breakers.get(name);
  if (!breaker) return null;
  
  const stats = breaker.stats;
  
  let state: BreakerState = 'closed';
  if (breaker.opened) {
    state = 'open';
  } else if (breaker.halfOpen) {
    state = 'halfOpen';
  }
  
  return {
    name,
    state,
    failures: stats.failures,
    successes: stats.successes,
    fallbacks: stats.fallbacks,
    rejects: stats.rejects,
    timeouts: stats.timeouts,
    cacheHits: stats.cacheHits,
    cacheMisses: stats.cacheMisses,
    latencyMean: stats.latencyMean,
    percentiles: stats.percentiles,
  };
}

export function getAllBreakerStats(): Record<string, BreakerStats | null> {
  const stats: Record<string, BreakerStats | null> = {};
  for (const name of breakers.keys()) {
    stats[name] = getBreakerStats(name);
  }
  return stats;
}

export function resetBreaker(name: string): boolean {
  const breaker = breakers.get(name);
  if (breaker) {
    breaker.close();
    return true;
  }
  return false;
}

export function resetAllBreakers(): void {
  for (const breaker of breakers.values()) {
    breaker.close();
  }
}

export function isCircuitOpen(name: string): boolean {
  const breaker = breakers.get(name);
  if (!breaker) return false;
  return breaker.opened;
}

export function removeBreaker(name: string): boolean {
  const breaker = breakers.get(name);
  if (breaker) {
    breaker.shutdown();
    breakers.delete(name);
    return true;
  }
  return false;
}

export function withCircuitBreaker<T extends any[], R>(
  name: string,
  fn: (...args: T) => Promise<R>,
  options?: BreakerOptions,
  fallback?: (...args: T) => R | Promise<R>
): (...args: T) => Promise<R> {
  const breaker = getBreaker(name, fn, options, fallback);
  return (...args: T) => breaker.fire(...args);
}
