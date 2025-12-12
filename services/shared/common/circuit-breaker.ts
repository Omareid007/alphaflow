/**
 * AI Active Trader - Circuit Breaker Pattern
 * Prevents cascade failures by tracking failures and opening circuit when threshold is exceeded.
 * Based on Netflix Hystrix / Resilience4j patterns.
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenRequests: number;
  onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;
  onFailure?: (name: string, error: Error) => void;
  onSuccess?: (name: string) => void;
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime: number;
  totalRequests: number;
  consecutiveSuccesses: number;
  halfOpenAttempts: number;
}

const DEFAULT_CONFIG: Partial<CircuitBreakerConfig> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  halfOpenRequests: 3,
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private config: CircuitBreakerConfig;
  private stats: CircuitStats = {
    failures: 0,
    successes: 0,
    lastFailureTime: 0,
    totalRequests: 0,
    consecutiveSuccesses: 0,
    halfOpenAttempts: 0,
  };

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config } as CircuitBreakerConfig;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        throw new CircuitOpenError(this.config.name, this.getTimeUntilReset());
      }
    }

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.stats.halfOpenAttempts >= this.config.halfOpenRequests) {
        throw new CircuitOpenError(this.config.name, this.getTimeUntilReset());
      }
      this.stats.halfOpenAttempts++;
    }

    this.stats.totalRequests++;

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private recordSuccess(): void {
    this.stats.successes++;
    this.stats.consecutiveSuccesses++;
    this.config.onSuccess?.(this.config.name);

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.stats.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.stats.failures = Math.max(0, this.stats.failures - 1);
    }
  }

  private recordFailure(error: Error): void {
    this.stats.failures++;
    this.stats.consecutiveSuccesses = 0;
    this.stats.lastFailureTime = Date.now();
    this.config.onFailure?.(this.config.name, error);

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED && this.stats.failures >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.CLOSED) {
      this.stats.failures = 0;
      this.stats.consecutiveSuccesses = 0;
      this.stats.halfOpenAttempts = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.stats.halfOpenAttempts = 0;
      this.stats.consecutiveSuccesses = 0;
    }

    this.config.onStateChange?.(this.config.name, oldState, newState);
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.stats.lastFailureTime >= this.config.timeout;
  }

  private getTimeUntilReset(): number {
    return Math.max(0, this.config.timeout - (Date.now() - this.stats.lastFailureTime));
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): Readonly<CircuitStats & { state: CircuitState }> {
    return { ...this.stats, state: this.state };
  }

  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.stats = {
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      totalRequests: 0,
      consecutiveSuccesses: 0,
      halfOpenAttempts: 0,
    };
  }

  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
    this.stats.lastFailureTime = Date.now();
  }

  forceClosed(): void {
    this.transitionTo(CircuitState.CLOSED);
  }
}

export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly timeUntilReset: number
  ) {
    super(`Circuit breaker '${circuitName}' is open. Retry in ${Math.ceil(timeUntilReset / 1000)}s`);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private breakers: Map<string, CircuitBreaker> = new Map();

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  getOrCreate(config: Partial<CircuitBreakerConfig> & { name: string }): CircuitBreaker {
    let breaker = this.breakers.get(config.name);
    if (!breaker) {
      breaker = new CircuitBreaker(config);
      this.breakers.set(config.name, breaker);
    }
    return breaker;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getAllStats(): Record<string, ReturnType<CircuitBreaker['getStats']>> {
    const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}
