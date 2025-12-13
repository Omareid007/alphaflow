/**
 * AI Active Trader - Market Data Connector Manager
 * Manages multiple market data providers with failover and dual-run support
 */

import { createLogger } from '../shared/common/logger';
import { EventBusClient } from '../shared/events';
import {
  MarketDataConnector,
  ConnectorRegistration,
  ConnectorStatus,
  FailoverConfig,
  ConnectorPriority,
  MarketDataConnectorConfig,
  DEFAULT_FAILOVER_CONFIG,
} from './connector-interface';
import { MarketQuote, MarketBar, MarketNews, CompanyProfile, ConnectorType } from './types';

const logger = createLogger('connector-manager');

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

export interface DualRunConfig {
  enabled: boolean;
  comparisonMode: 'log' | 'strict' | 'silent';
  sampleRate: number;
}

export interface ConnectorManagerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  failovers: number;
  avgLatencyMs: number;
  connectorStats: Map<ConnectorType, {
    requests: number;
    successes: number;
    failures: number;
    avgLatencyMs: number;
  }>;
}

export class MarketDataConnectorManager {
  private connectors: Map<ConnectorType, ConnectorRegistration> = new Map();
  private circuitBreakers: Map<ConnectorType, CircuitBreakerState> = new Map();
  private failoverConfig: FailoverConfig;
  private dualRunConfig: DualRunConfig;
  private eventBus: EventBusClient | null = null;
  private metrics: ConnectorManagerMetrics;

  constructor(
    failoverConfig?: Partial<FailoverConfig>,
    dualRunConfig?: Partial<DualRunConfig>
  ) {
    this.failoverConfig = { ...DEFAULT_FAILOVER_CONFIG, ...failoverConfig };
    this.dualRunConfig = {
      enabled: false,
      comparisonMode: 'log',
      sampleRate: 0.1,
      ...dualRunConfig,
    };
    this.metrics = this.createEmptyMetrics();
  }

  private createEmptyMetrics(): ConnectorManagerMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      failovers: 0,
      avgLatencyMs: 0,
      connectorStats: new Map(),
    };
  }

  setEventBus(eventBus: EventBusClient): void {
    this.eventBus = eventBus;
  }

  registerConnector(
    connector: MarketDataConnector,
    priority: ConnectorPriority,
    config?: Partial<MarketDataConnectorConfig>
  ): void {
    const fullConfig: MarketDataConnectorConfig = {
      enabled: true,
      priority: priority === 'primary' ? 1 : priority === 'secondary' ? 2 : 3,
      timeout: 10000,
      retries: 2,
      ...config,
    };

    this.connectors.set(connector.type, { connector, priority, config: fullConfig });
    this.circuitBreakers.set(connector.type, { failures: 0, lastFailure: 0, isOpen: false });
    this.metrics.connectorStats.set(connector.type, {
      requests: 0,
      successes: 0,
      failures: 0,
      avgLatencyMs: 0,
    });

    logger.info('Connector registered', { type: connector.type, priority });
  }

  unregisterConnector(type: ConnectorType): void {
    this.connectors.delete(type);
    this.circuitBreakers.delete(type);
    logger.info('Connector unregistered', { type });
  }

  getConnectorStatus(): ConnectorStatus[] {
    return Array.from(this.connectors.values()).map(reg => reg.connector.getStatus());
  }

  getMetrics(): ConnectorManagerMetrics {
    return { ...this.metrics, connectorStats: new Map(this.metrics.connectorStats) };
  }

  updateDualRunConfig(config: Partial<DualRunConfig>): void {
    this.dualRunConfig = { ...this.dualRunConfig, ...config };
    logger.info('Dual-run config updated', { config: this.dualRunConfig });
  }

  private getSortedConnectors(): ConnectorRegistration[] {
    return Array.from(this.connectors.values())
      .filter(reg => reg.config.enabled && reg.connector.isAvailable())
      .filter(reg => !this.isCircuitBreakerOpen(reg.connector.type))
      .sort((a, b) => a.config.priority - b.config.priority);
  }

  private isCircuitBreakerOpen(type: ConnectorType): boolean {
    const state = this.circuitBreakers.get(type);
    if (!state) return false;

    if (state.isOpen) {
      const timeSinceLastFailure = Date.now() - state.lastFailure;
      if (timeSinceLastFailure > this.failoverConfig.circuitBreakerResetMs) {
        state.isOpen = false;
        state.failures = 0;
        logger.info('Circuit breaker reset', { type });
        return false;
      }
      return true;
    }
    return false;
  }

  private recordSuccess(type: ConnectorType, latencyMs: number): void {
    const state = this.circuitBreakers.get(type);
    if (state) {
      state.failures = 0;
    }

    const stats = this.metrics.connectorStats.get(type);
    if (stats) {
      stats.requests++;
      stats.successes++;
      stats.avgLatencyMs = (stats.avgLatencyMs * (stats.successes - 1) + latencyMs) / stats.successes;
    }

    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
  }

  private recordFailure(type: ConnectorType, error: Error): void {
    const state = this.circuitBreakers.get(type);
    if (state) {
      state.failures++;
      state.lastFailure = Date.now();
      if (state.failures >= this.failoverConfig.circuitBreakerThreshold) {
        state.isOpen = true;
        logger.warn('Circuit breaker opened', { type, failures: state.failures });
      }
    }

    const stats = this.metrics.connectorStats.get(type);
    if (stats) {
      stats.requests++;
      stats.failures++;
    }

    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
  }

  private async executeWithFailover<T>(
    operation: string,
    executor: (connector: MarketDataConnector) => Promise<T>
  ): Promise<T> {
    const connectors = this.getSortedConnectors();
    
    if (connectors.length === 0) {
      throw new Error(`No available connectors for ${operation}`);
    }

    let lastError: Error | null = null;

    for (const registration of connectors) {
      const startTime = Date.now();
      
      try {
        const result = await executor(registration.connector);
        const latencyMs = Date.now() - startTime;
        this.recordSuccess(registration.connector.type, latencyMs);
        
        if (this.dualRunConfig.enabled && this.shouldRunDual()) {
          this.executeDualRun(operation, executor, registration.connector.type, result).catch(err => {
            logger.warn('Dual-run comparison failed', { error: err instanceof Error ? err.message : String(err) });
          });
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.recordFailure(registration.connector.type, lastError);
        this.metrics.failovers++;
        
        logger.warn('Connector failed, trying next', {
          operation,
          type: registration.connector.type,
          error: lastError.message,
        });
      }
    }

    throw lastError || new Error(`All connectors failed for ${operation}`);
  }

  private shouldRunDual(): boolean {
    return Math.random() < this.dualRunConfig.sampleRate;
  }

  private async executeDualRun<T>(
    operation: string,
    executor: (connector: MarketDataConnector) => Promise<T>,
    primaryType: ConnectorType,
    primaryResult: T
  ): Promise<void> {
    const otherConnectors = this.getSortedConnectors()
      .filter(reg => reg.connector.type !== primaryType);

    for (const registration of otherConnectors) {
      try {
        const secondaryResult = await executor(registration.connector);
        const match = this.compareResults(primaryResult, secondaryResult);

        if (!match && this.dualRunConfig.comparisonMode !== 'silent') {
          logger.warn('Dual-run mismatch detected', {
            operation,
            primaryType,
            secondaryType: registration.connector.type,
          });

        }
      } catch (error) {
        logger.debug('Dual-run secondary connector failed', {
          type: registration.connector.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private compareResults<T>(a: T, b: T): boolean {
    if (a === null || b === null) return a === b;
    if (typeof a !== 'object' || typeof b !== 'object') return a === b;
    
    const normalize = (obj: any): any => {
      const copy = { ...obj };
      delete copy.timestamp;
      delete copy.source;
      delete copy.connectorSource;
      return copy;
    };
    
    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    return this.executeWithFailover('getQuote', connector => connector.getQuote(symbol));
  }

  async getBars(
    symbol: string,
    timeframe?: MarketBar['timeframe'],
    from?: Date,
    to?: Date
  ): Promise<MarketBar[]> {
    return this.executeWithFailover('getBars', connector => 
      connector.getBars(symbol, timeframe, from, to)
    );
  }

  async getNews(symbol?: string, limit?: number): Promise<MarketNews[]> {
    return this.executeWithFailover('getNews', connector => 
      connector.getNews(symbol, limit)
    );
  }

  async getProfile(symbol: string): Promise<CompanyProfile | null> {
    return this.executeWithFailover('getProfile', connector => 
      connector.getProfile(symbol)
    );
  }

  async searchSymbols(query: string, limit?: number): Promise<{ symbol: string; name: string }[]> {
    return this.executeWithFailover('searchSymbols', async connector => {
      if (connector.searchSymbols) {
        return connector.searchSymbols(query, limit);
      }
      return [];
    });
  }
}

export function createConnectorManager(
  failoverConfig?: Partial<FailoverConfig>,
  dualRunConfig?: Partial<DualRunConfig>
): MarketDataConnectorManager {
  return new MarketDataConnectorManager(failoverConfig, dualRunConfig);
}
