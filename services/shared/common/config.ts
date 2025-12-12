/**
 * AI Active Trader - Configuration Loader
 * Centralized configuration management for all services
 */

export interface ServiceConfig {
  serviceName: string;
  port: number;
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  
  nats: {
    url: string;
    enabled: boolean;
  };
  
  database: {
    url: string;
    poolSize: number;
  };
  
  telemetry: {
    enabled: boolean;
    endpoint: string;
    serviceName: string;
  };
}

export interface ConfigSchema<T> {
  key: string;
  envVar: string;
  defaultValue: T;
  required?: boolean;
  transform?: (value: string) => T;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value !== undefined) return value;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing required environment variable: ${key}`);
}

function getEnvVarOptional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvVarInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) throw new Error(`Invalid integer for ${key}: ${value}`);
  return parsed;
}

function getEnvVarBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export function loadServiceConfig(serviceName: string): ServiceConfig {
  const environment = getEnvVarOptional('NODE_ENV', 'development') as ServiceConfig['environment'];
  
  return {
    serviceName,
    port: getEnvVarInt(`${serviceName.toUpperCase().replace(/-/g, '_')}_PORT`, 3000),
    environment,
    logLevel: getEnvVarOptional('LOG_LEVEL', 'info') as ServiceConfig['logLevel'],
    
    nats: {
      url: getEnvVarOptional('NATS_URL', 'nats://localhost:4222'),
      enabled: getEnvVarBool('NATS_ENABLED', false),
    },
    
    database: {
      url: getEnvVarOptional('DATABASE_URL', ''),
      poolSize: getEnvVarInt('DB_POOL_SIZE', 10),
    },
    
    telemetry: {
      enabled: getEnvVarBool('OTEL_ENABLED', false),
      endpoint: getEnvVarOptional('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318'),
      serviceName,
    },
  };
}

export function validateConfig(config: ServiceConfig): void {
  const errors: string[] = [];
  
  if (!config.serviceName) {
    errors.push('serviceName is required');
  }
  
  if (config.port < 1 || config.port > 65535) {
    errors.push('port must be between 1 and 65535');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

export { getEnvVar, getEnvVarOptional, getEnvVarInt, getEnvVarBool };
