/**
 * Centralized Configuration Module
 * Single source of truth for all configuration values
 * Validates and type-checks environment variables at startup
 */

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvVarOptional(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${value}`);
  }
  return parsed;
}

/**
 * Centralized application configuration
 * All configuration values should be accessed through this object
 */
export const config = {
  // Environment
  env: getEnvVar('NODE_ENV', 'development') as 'development' | 'production' | 'test',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',

  // Server
  server: {
    port: getEnvNumber('PORT', 5000),
    host: getEnvVar('HOST', '0.0.0.0'),
  },

  // Database
  database: {
    url: getEnvVar('DATABASE_URL'),
  },

  // Alpaca Trading API
  alpaca: {
    apiKey: getEnvVar('ALPACA_API_KEY'),
    apiSecret: getEnvVar('ALPACA_SECRET_KEY'),
    baseUrl: getEnvVarOptional('ALPACA_BASE_URL', 'https://paper-api.alpaca.markets'),
    dataUrl: getEnvVarOptional('ALPACA_DATA_URL', 'https://data.alpaca.markets'),
    isPaper: getEnvBool('ALPACA_PAPER', true),
  },

  // External APIs
  apis: {
    finnhub: {
      apiKey: getEnvVarOptional('FINNHUB_API_KEY'),
      enabled: !!process.env.FINNHUB_API_KEY,
    },
    newsapi: {
      apiKey: getEnvVarOptional('NEWS_API_KEY'),
      enabled: !!process.env.NEWS_API_KEY,
    },
    fred: {
      apiKey: getEnvVarOptional('FRED_API_KEY'),
      enabled: !!process.env.FRED_API_KEY,
    },
  },

  // AI/LLM APIs
  llm: {
    openai: {
      apiKey: getEnvVarOptional('OPENAI_API_KEY'),
      enabled: !!process.env.OPENAI_API_KEY,
    },
    anthropic: {
      apiKey: getEnvVarOptional('ANTHROPIC_API_KEY'),
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
    secret: getEnvVar('SESSION_SECRET', 'default-secret-change-in-production'),
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
    console.error('❌ Configuration validation failed:');
    errors.forEach(error => console.error(`   - ${error}`));
    throw new Error(`Configuration validation failed with ${errors.length} error(s)`);
  }

  console.log('✓ Configuration validated successfully');
}
