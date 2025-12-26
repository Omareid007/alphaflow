import { log } from "../utils/logger";
import { connectorMetricsService } from "./connector-metrics-service";

export type ChainType = "stock_prices" | "crypto_prices" | "news" | "fundamentals" | "macro";

export interface ConnectorConfig {
  name: string;
  priority: number;
  enabled: boolean;
  rateLimitPerMinute: number;
  isFree: boolean;
  tier: "primary" | "secondary" | "tertiary";
}

export interface ChainConfig {
  type: ChainType;
  connectors: ConnectorConfig[];
  retryDelayMs: number;
  maxRetries: number;
}

export interface ChainResult<T> {
  success: boolean;
  data: T | null;
  usedConnector: string;
  attemptedConnectors: string[];
  latencyMs: number;
  fromCache: boolean;
  error?: string;
}

const CONNECTOR_CHAINS: Record<ChainType, ChainConfig> = {
  stock_prices: {
    type: "stock_prices",
    connectors: [
      { name: "Alpaca", priority: 1, enabled: true, rateLimitPerMinute: 9999, isFree: true, tier: "primary" },
      { name: "Finnhub", priority: 2, enabled: true, rateLimitPerMinute: 60, isFree: true, tier: "secondary" },
      { name: "TwelveData", priority: 3, enabled: true, rateLimitPerMinute: 800, isFree: true, tier: "tertiary" },
    ],
    retryDelayMs: 100,
    maxRetries: 3,
  },
  crypto_prices: {
    type: "crypto_prices",
    connectors: [
      { name: "CoinGecko", priority: 1, enabled: true, rateLimitPerMinute: 50, isFree: true, tier: "primary" },
      { name: "CoinMarketCap", priority: 2, enabled: true, rateLimitPerMinute: 30, isFree: false, tier: "secondary" },
    ],
    retryDelayMs: 200,
    maxRetries: 2,
  },
  news: {
    type: "news",
    connectors: [
      { name: "NewsAPI", priority: 1, enabled: true, rateLimitPerMinute: 100, isFree: true, tier: "primary" },
      { name: "GDELT", priority: 2, enabled: true, rateLimitPerMinute: 9999, isFree: true, tier: "secondary" },
    ],
    retryDelayMs: 100,
    maxRetries: 2,
  },
  fundamentals: {
    type: "fundamentals",
    connectors: [
      { name: "Finnhub", priority: 1, enabled: true, rateLimitPerMinute: 60, isFree: true, tier: "primary" },
    ],
    retryDelayMs: 100,
    maxRetries: 2,
  },
  macro: {
    type: "macro",
    connectors: [
      { name: "FRED", priority: 1, enabled: true, rateLimitPerMinute: 9999, isFree: true, tier: "primary" },
    ],
    retryDelayMs: 100,
    maxRetries: 1,
  },
};

type ConnectorFetcher<T> = (connectorName: string) => Promise<T>;

class ConnectorChainService {
  private chainConfigs: Map<ChainType, ChainConfig>;
  private connectorHealth: Map<string, {
    consecutiveFailures: number;
    lastFailure: Date | null;
    isCircuitOpen: boolean;
  }>;

  private readonly CIRCUIT_BREAK_THRESHOLD = 5;
  private readonly CIRCUIT_RESET_MS = 60000;

  constructor() {
    this.chainConfigs = new Map(
      Object.entries(CONNECTOR_CHAINS).map(([key, config]) => [key as ChainType, config])
    );
    this.connectorHealth = new Map();
  }

  async executeChain<T>(
    chainType: ChainType,
    fetchers: Map<string, ConnectorFetcher<T>>,
    endpoint: string
  ): Promise<ChainResult<T>> {
    const config = this.chainConfigs.get(chainType);
    if (!config) {
      return {
        success: false,
        data: null,
        usedConnector: "none",
        attemptedConnectors: [],
        latencyMs: 0,
        fromCache: false,
        error: `Unknown chain type: ${chainType}`,
      };
    }

    const startTime = Date.now();
    const attemptedConnectors: string[] = [];
    let lastError: string | undefined;

    const sortedConnectors = [...config.connectors]
      .filter((c) => c.enabled && !this.isCircuitOpen(c.name))
      .sort((a, b) => a.priority - b.priority);

    for (const connector of sortedConnectors) {
      const fetcher = fetchers.get(connector.name);
      if (!fetcher) {
        continue;
      }

      attemptedConnectors.push(connector.name);
      const connectorStartTime = Date.now();

      try {
        const data = await fetcher(connector.name);
        const latencyMs = Date.now() - connectorStartTime;

        this.recordSuccess(connector.name);
        connectorMetricsService.recordEvent({
          connector: connector.name,
          endpoint,
          success: true,
          latencyMs,
          cacheHit: false,
          rateLimited: false,
          usedFallback: attemptedConnectors.length > 1,
        });

        return {
          success: true,
          data,
          usedConnector: connector.name,
          attemptedConnectors,
          latencyMs: Date.now() - startTime,
          fromCache: false,
        };
      } catch (error) {
        const latencyMs = Date.now() - connectorStartTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        lastError = errorMessage;

        const isRateLimited = errorMessage.toLowerCase().includes("rate limit") ||
                             errorMessage.includes("429");

        this.recordFailure(connector.name);
        connectorMetricsService.recordEvent({
          connector: connector.name,
          endpoint,
          success: false,
          latencyMs,
          cacheHit: false,
          rateLimited: isRateLimited,
          usedFallback: attemptedConnectors.length > 1,
          error: errorMessage,
        });

        log.warn("ConnectorChainService", `${connector.name} failed for ${chainType}`, {
          error: errorMessage,
          attemptedConnectors,
        });

        await this.delay(config.retryDelayMs);
      }
    }

    return {
      success: false,
      data: null,
      usedConnector: "none",
      attemptedConnectors,
      latencyMs: Date.now() - startTime,
      fromCache: false,
      error: lastError || "All connectors failed",
    };
  }

  private isCircuitOpen(connectorName: string): boolean {
    const health = this.connectorHealth.get(connectorName);
    if (!health || !health.isCircuitOpen) {
      return false;
    }

    if (health.lastFailure && Date.now() - health.lastFailure.getTime() > this.CIRCUIT_RESET_MS) {
      health.isCircuitOpen = false;
      health.consecutiveFailures = 0;
      return false;
    }

    return true;
  }

  private recordSuccess(connectorName: string): void {
    const health = this.connectorHealth.get(connectorName) || {
      consecutiveFailures: 0,
      lastFailure: null,
      isCircuitOpen: false,
    };
    health.consecutiveFailures = 0;
    health.isCircuitOpen = false;
    this.connectorHealth.set(connectorName, health);
  }

  private recordFailure(connectorName: string): void {
    const health = this.connectorHealth.get(connectorName) || {
      consecutiveFailures: 0,
      lastFailure: null,
      isCircuitOpen: false,
    };
    health.consecutiveFailures++;
    health.lastFailure = new Date();

    if (health.consecutiveFailures >= this.CIRCUIT_BREAK_THRESHOLD) {
      health.isCircuitOpen = true;
      log.warn("ConnectorChainService", `Circuit breaker opened for ${connectorName}`);
    }

    this.connectorHealth.set(connectorName, health);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getChainConfig(chainType: ChainType): ChainConfig | undefined {
    return this.chainConfigs.get(chainType);
  }

  getAllChains(): ChainConfig[] {
    return Array.from(this.chainConfigs.values());
  }

  getConnectorHealth(): Map<string, {
    consecutiveFailures: number;
    lastFailure: Date | null;
    isCircuitOpen: boolean;
  }> {
    return new Map(this.connectorHealth);
  }

  updateConnectorStatus(connectorName: string, enabled: boolean): void {
    for (const config of this.chainConfigs.values()) {
      const connector = config.connectors.find((c) => c.name === connectorName);
      if (connector) {
        connector.enabled = enabled;
      }
    }
  }

  resetCircuitBreaker(connectorName: string): void {
    const health = this.connectorHealth.get(connectorName);
    if (health) {
      health.isCircuitOpen = false;
      health.consecutiveFailures = 0;
      log.info("ConnectorChainService", `Circuit breaker reset for ${connectorName}`);
    }
  }

  getStatus(): {
    chains: { type: ChainType; activeConnectors: number; totalConnectors: number }[];
    circuitBreakers: { connector: string; isOpen: boolean; failures: number }[];
  } {
    const chains = Array.from(this.chainConfigs.entries()).map(([type, config]) => ({
      type,
      activeConnectors: config.connectors.filter((c) => c.enabled && !this.isCircuitOpen(c.name)).length,
      totalConnectors: config.connectors.length,
    }));

    const circuitBreakers = Array.from(this.connectorHealth.entries()).map(([connector, health]) => ({
      connector,
      isOpen: health.isCircuitOpen,
      failures: health.consecutiveFailures,
    }));

    return { chains, circuitBreakers };
  }
}

export const connectorChainService = new ConnectorChainService();
