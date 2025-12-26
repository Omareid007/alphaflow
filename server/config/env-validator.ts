/**
 * Environment Variable Validation Module
 *
 * This module validates all required and optional environment variables
 * before the server starts, ensuring fail-fast behavior for missing
 * critical configuration.
 */

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'ALPACA_API_KEY',
  'ALPACA_SECRET_KEY',
] as const;

const OPTIONAL_ENV_VARS = [
  { key: 'FINNHUB_API_KEY', feature: 'Finnhub market data' },
  { key: 'OPENAI_API_KEY', feature: 'OpenAI AI decisions' },
  { key: 'NEWS_API_KEY', feature: 'News sentiment' },
  { key: 'COINMARKETCAP_API_KEY', feature: 'CoinMarketCap data' },
  { key: 'VALYU_API_KEY', feature: 'Fundamental data' },
  { key: 'FRED_API_KEY', feature: 'Macro indicators' },
  { key: 'HUGGINGFACE_API_KEY', feature: 'HuggingFace sentiment' },
] as const;

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  features: { name: string; enabled: boolean }[];
}

/**
 * Validates DATABASE_URL format
 * Must start with postgres:// or postgresql://
 * Supports various formats including cloud providers (Neon, Supabase, etc.)
 */
function validateDatabaseUrl(url: string): string | null {
  if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
    return 'DATABASE_URL must start with postgres:// or postgresql://';
  }

  // More flexible pattern that accepts:
  // - Optional port (many cloud providers don't use explicit port)
  // - Query parameters (?sslmode=require, ?pool=true, etc.)
  // - Various host formats (hostname, IP, socket)
  // Format: postgres://[user]:[password]@[host]/[database][?params]
  const pattern = /^postgres(ql)?:\/\/[^:]+:[^@]+@[^\/]+\/.+$/;
  if (!pattern.test(url)) {
    return 'DATABASE_URL appears to be malformed. Expected format: postgres://user:password@host/database';
  }

  return null;
}

/**
 * Validates API key minimum length
 * Most API keys are at least 16 characters
 */
function validateApiKeyLength(key: string, name: string, minLength = 16): string | null {
  if (key.length < minLength) {
    return `${name} appears too short (minimum ${minLength} characters expected)`;
  }
  return null;
}

/**
 * Validates ALPACA_TRADING_MODE if present
 * Must be either 'paper' or 'live'
 */
function validateTradingMode(mode: string): string | null {
  if (mode !== 'paper' && mode !== 'live') {
    return "ALPACA_TRADING_MODE must be either 'paper' or 'live'";
  }
  return null;
}

/**
 * Performs comprehensive environment variable validation
 * Checks required variables, optional variables, and format validation
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const features: { name: string; enabled: boolean }[] = [];

  // Validate required environment variables
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];

    if (!value) {
      errors.push(`Required environment variable ${varName} is not set`);
      continue;
    }

    // Format validation for specific variables
    if (varName === 'DATABASE_URL') {
      const error = validateDatabaseUrl(value);
      if (error) {
        errors.push(error);
      }
    }

    if (varName === 'ALPACA_API_KEY' || varName === 'ALPACA_SECRET_KEY') {
      const error = validateApiKeyLength(value, varName);
      if (error) {
        warnings.push(error);
      }
    }
  }

  // Validate optional environment variables
  for (const { key, feature } of OPTIONAL_ENV_VARS) {
    const value = process.env[key];

    if (!value) {
      features.push({ name: feature, enabled: false });
      warnings.push(`Optional environment variable ${key} is not set - ${feature} will be disabled`);
    } else {
      features.push({ name: feature, enabled: true });

      // Basic length validation for API keys
      const error = validateApiKeyLength(value, key, 10);
      if (error) {
        warnings.push(error);
      }
    }
  }

  // Validate ALPACA_TRADING_MODE if present
  const tradingMode = process.env.ALPACA_TRADING_MODE;
  if (tradingMode) {
    const error = validateTradingMode(tradingMode);
    if (error) {
      errors.push(error);
    }
  } else {
    warnings.push("ALPACA_TRADING_MODE not set - will default to 'paper' mode");
  }

  // Validate PORT if present
  const port = process.env.PORT;
  if (port) {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      errors.push(`PORT must be a valid number between 1 and 65535 (got: ${port})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    features,
  };
}

/**
 * Validates environment and reports results to console
 * Throws error if required variables are missing
 * This should be called at startup before initializing any services
 */
export function validateAndReportEnvironment(): void {
  console.log('[ENV] Validating environment variables...');

  const result = validateEnvironment();

  // Report enabled/disabled features
  console.log('\n[ENV] Feature Status:');
  console.log('━'.repeat(60));

  const enabledFeatures = result.features.filter(f => f.enabled);
  const disabledFeatures = result.features.filter(f => !f.enabled);

  if (enabledFeatures.length > 0) {
    console.log('  ✓ Enabled features:');
    enabledFeatures.forEach(f => {
      console.log(`    • ${f.name}`);
    });
  }

  if (disabledFeatures.length > 0) {
    console.log('  ✗ Disabled features:');
    disabledFeatures.forEach(f => {
      console.log(`    • ${f.name}`);
    });
  }

  console.log('━'.repeat(60));

  // Report warnings
  if (result.warnings.length > 0) {
    console.log('\n[ENV] Warnings:');
    result.warnings.forEach(warning => {
      console.warn(`  ⚠  ${warning}`);
    });
  }

  // Report errors and fail if any
  if (result.errors.length > 0) {
    console.error('\n[ENV] VALIDATION FAILED - Missing or invalid required environment variables:');
    console.error('━'.repeat(60));
    result.errors.forEach(error => {
      console.error(`  ✗ ${error}`);
    });
    console.error('━'.repeat(60));
    console.error('\n[ENV] Please set all required environment variables and restart the server.');
    console.error('[ENV] Server startup aborted.\n');

    throw new Error('Environment validation failed - missing or invalid required variables');
  }

  console.log('\n[ENV] ✓ Environment validation passed');
  console.log('[ENV] All required variables are set and valid\n');
}
