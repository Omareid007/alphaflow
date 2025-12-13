/**
 * AI Active Trader - Market Data Connector Interface
 * Unified interface for all market data providers
 */

import { MarketQuote, MarketBar, MarketNews, CompanyProfile, ConnectorType } from './types';

export interface MarketDataConnectorConfig {
  enabled: boolean;
  priority: number;
  rateLimit?: {
    requestsPerMinute: number;
    burstLimit: number;
  };
  timeout?: number;
  retries?: number;
}

export interface ConnectorStatus {
  type: ConnectorType;
  available: boolean;
  healthy: boolean;
  lastError?: string;
  lastSuccessAt?: string;
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
}

export interface MarketDataConnector {
  readonly type: ConnectorType;
  
  isAvailable(): boolean;
  
  getStatus(): ConnectorStatus;
  
  getQuote(symbol: string): Promise<MarketQuote>;
  
  getBars(
    symbol: string,
    timeframe?: MarketBar['timeframe'],
    from?: Date,
    to?: Date
  ): Promise<MarketBar[]>;
  
  getNews(symbol?: string, limit?: number): Promise<MarketNews[]>;
  
  getProfile(symbol: string): Promise<CompanyProfile | null>;
  
  searchSymbols?(query: string, limit?: number): Promise<{ symbol: string; name: string }[]>;
}

export type ConnectorPriority = 'primary' | 'secondary' | 'fallback';

export interface ConnectorRegistration {
  connector: MarketDataConnector;
  priority: ConnectorPriority;
  config: MarketDataConnectorConfig;
}

export interface FailoverConfig {
  maxRetries: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
}

export const DEFAULT_FAILOVER_CONFIG: FailoverConfig = {
  maxRetries: 2,
  retryDelayMs: 500,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 60000,
};
