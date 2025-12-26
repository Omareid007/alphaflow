/**
 * Centralized Configuration Module
 * Single source of truth for all configuration values
 * Validates and type-checks environment variables at startup
 */

import { log } from "../utils/logger";
import {
  getEnvString,
  getEnvStringOptional,
  getEnvBool,
  getEnvNumber,
} from "./env-helpers";

/**
 * Centralized application configuration
 * All configuration values should be accessed through this object
 */
export const config = {
  // Environment
  env: getEnvString('NODE_ENV', 'development') as 'development' | 'production' | 'test',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',

  // Server
  server: {
    port: getEnvNumber('PORT', 5000),
    host: getEnvString('HOST', '0.0.0.0'),
  },

  // Database
  database: {
    url: getEnvString('DATABASE_URL'),
  },

  // Alpaca Trading API
  alpaca: {
    apiKey: getEnvString('ALPACA_API_KEY'),
    apiSecret: getEnvString('ALPACA_SECRET_KEY'),
    baseUrl: getEnvStringOptional('ALPACA_BASE_URL', 'https://paper-api.alpaca.markets'),
    dataUrl: getEnvStringOptional('ALPACA_DATA_URL', 'https://data.alpaca.markets'),
    isPaper: getEnvBool('ALPACA_PAPER', true),
  },

  // External APIs
  apis: {
    finnhub: {
      apiKey: getEnvStringOptional('FINNHUB_API_KEY'),
      enabled: !!process.env.FINNHUB_API_KEY,
    },
    newsapi: {
      apiKey: getEnvStringOptional('NEWS_API_KEY'),
      enabled: !!process.env.NEWS_API_KEY,
    },
    fred: {
      apiKey: getEnvStringOptional('FRED_API_KEY'),
      enabled: !!process.env.FRED_API_KEY,
    },
  },

  // AI/LLM APIs
  llm: {
    openai: {
      apiKey: getEnvStringOptional('OPENAI_API_KEY'),
      enabled: !!process.env.OPENAI_API_KEY,
    },
    anthropic: {
      apiKey: getEnvStringOptional('ANTHROPIC_API_KEY'),
      enabled: !!process.env.ANTHROPIC_API_KEY,
    },
  },

  // Feature Flags
  features: {
    enableMockData: getEnvBool('ENABLE_MOCK_DATA', false),
    enableDebugLogging: getEnvBool('ENABLE_DEBUG_LOGGING', false),
  },

  // Session
  session: {
    secret: getEnvString('SESSION_SECRET', 'default-secret-change-in-production'),
    maxAge: getEnvNumber('SESSION_MAX_AGE', 7 * 24 * 60 * 60 * 1000),
  },
} as const;

/**
 * Validate configuration at startup
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.database.url || config.database.url === 'your-database-url') {
    errors.push('DATABASE_URL is not configured');
  }

  if (!config.alpaca.apiKey || config.alpaca.apiKey === 'your-api-key') {
    errors.push('ALPACA_API_KEY is not configured');
  }

  if (config.isProduction && config.session.secret === 'default-secret-change-in-production') {
    errors.push('SESSION_SECRET must be set in production');
  }

  if (errors.length > 0) {
    log.error("Config", "Configuration validation failed", { errors });
    throw new Error(`Configuration validation failed with ${errors.length} error(s)`);
  }

  log.info("Config", "Configuration validated successfully");
}
