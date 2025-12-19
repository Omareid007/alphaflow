/**
 * Crypto Trading Configuration
 *
 * Provides comprehensive configuration and utilities for cryptocurrency trading,
 * including expanded asset support, crypto-specific parameters, categorization,
 * and helper functions for volatility-adjusted position sizing.
 */

// ============================================================================
// SUPPORTED CRYPTO ASSETS
// ============================================================================

export const SUPPORTED_CRYPTO = [
  // Major cryptocurrencies (large cap, high liquidity)
  'BTC/USD',
  'ETH/USD',
  'SOL/USD',

  // DeFi tokens (decentralized finance)
  'AVAX/USD',
  'LINK/USD',
  'UNI/USD',
  'AAVE/USD',
  'MKR/USD',

  // Layer 2 scaling solutions
  'MATIC/USD',
  'ARB/USD',
  'OP/USD',

  // Meme coins (high volatility, speculative)
  'DOGE/USD',
  'SHIB/USD',

  // Other established cryptocurrencies
  'DOT/USD',
  'ATOM/USD',
  'LTC/USD',
  'BCH/USD',
  'XLM/USD',
] as const;

// Stablecoins to exclude from trading (pegged to USD)
export const STABLECOINS = [
  'USDC/USD',
  'USDT/USD',
  'DAI/USD',
  'BUSD/USD',
  'USDD/USD',
] as const;

export type SupportedCrypto = typeof SUPPORTED_CRYPTO[number];
export type Stablecoin = typeof STABLECOINS[number];

// ============================================================================
// CRYPTO CATEGORIZATION
// ============================================================================

export type CryptoCategory = 'large_cap' | 'mid_cap' | 'small_cap' | 'meme';

export interface CryptoCategoryConfig {
  category: CryptoCategory;
  description: string;
  volatilityMultiplier: number;
  maxPositionSizePercent: number;
  minConfidenceThreshold: number;
}

export const CRYPTO_CATEGORIES: Record<CryptoCategory, CryptoCategoryConfig> = {
  large_cap: {
    category: 'large_cap',
    description: 'Major cryptocurrencies with high market cap and liquidity',
    volatilityMultiplier: 1.0,
    maxPositionSizePercent: 15,
    minConfidenceThreshold: 0.6,
  },
  mid_cap: {
    category: 'mid_cap',
    description: 'Established projects with medium market cap',
    volatilityMultiplier: 1.5,
    maxPositionSizePercent: 10,
    minConfidenceThreshold: 0.65,
  },
  small_cap: {
    category: 'small_cap',
    description: 'Smaller projects with higher risk/reward',
    volatilityMultiplier: 2.0,
    maxPositionSizePercent: 5,
    minConfidenceThreshold: 0.7,
  },
  meme: {
    category: 'meme',
    description: 'Meme coins with extreme volatility and speculative nature',
    volatilityMultiplier: 3.0,
    maxPositionSizePercent: 3,
    minConfidenceThreshold: 0.75,
  },
};

// Symbol to category mapping
export const CRYPTO_CATEGORY_MAP: Record<string, CryptoCategory> = {
  // Large cap
  'BTC/USD': 'large_cap',
  'ETH/USD': 'large_cap',

  // Mid cap
  'SOL/USD': 'mid_cap',
  'AVAX/USD': 'mid_cap',
  'LINK/USD': 'mid_cap',
  'UNI/USD': 'mid_cap',
  'AAVE/USD': 'mid_cap',
  'MATIC/USD': 'mid_cap',
  'DOT/USD': 'mid_cap',
  'ATOM/USD': 'mid_cap',

  // Small cap
  'MKR/USD': 'small_cap',
  'ARB/USD': 'small_cap',
  'OP/USD': 'small_cap',
  'LTC/USD': 'small_cap',
  'BCH/USD': 'small_cap',
  'XLM/USD': 'small_cap',

  // Meme coins
  'DOGE/USD': 'meme',
  'SHIB/USD': 'meme',
};

// ============================================================================
// CRYPTO-SPECIFIC TRADING PARAMETERS
// ============================================================================

export interface CryptoTradingParameters {
  // Trading hours
  tradingHours: '24/7';
  allowExtendedHours: boolean;

  // Position sizing
  basePositionSizePercent: number;
  useVolatilityAdjustment: boolean;

  // Risk management
  defaultStopLossPercent: number;
  defaultTakeProfitPercent: number;
  maxDrawdownPercent: number;

  // Correlation analysis
  useCorrelationMatrix: boolean;
  maxCorrelatedPositions: number;
  correlationThreshold: number;

  // Order execution
  preferredOrderType: 'market' | 'limit';
  slippageTolerance: number;

  // Diversification
  maxCryptoPositions: number;
  maxPerCategoryPercent: Record<CryptoCategory, number>;
}

export const DEFAULT_CRYPTO_PARAMETERS: CryptoTradingParameters = {
  // 24/7 trading
  tradingHours: '24/7',
  allowExtendedHours: false, // N/A for crypto

  // Position sizing - more conservative than stocks due to volatility
  basePositionSizePercent: 8, // 8% base (vs 10% for stocks)
  useVolatilityAdjustment: true,

  // Risk management - wider stops due to volatility
  defaultStopLossPercent: 8, // 8% stop loss (vs 5% for stocks)
  defaultTakeProfitPercent: 15, // 15% take profit (vs 10% for stocks)
  maxDrawdownPercent: 20,

  // Correlation analysis
  useCorrelationMatrix: true,
  maxCorrelatedPositions: 3,
  correlationThreshold: 0.7, // 70% correlation considered high

  // Order execution
  preferredOrderType: 'market', // Crypto markets move fast
  slippageTolerance: 0.5, // 0.5% slippage tolerance

  // Diversification
  maxCryptoPositions: 8,
  maxPerCategoryPercent: {
    large_cap: 40,  // Max 40% in large cap
    mid_cap: 40,    // Max 40% in mid cap
    small_cap: 15,  // Max 15% in small cap
    meme: 5,        // Max 5% in meme coins
  },
};

// ============================================================================
// CRYPTO CORRELATION MATRIX
// ============================================================================

/**
 * Correlation matrix for major crypto pairs
 * Values range from -1 (inverse correlation) to 1 (perfect correlation)
 * Based on historical price movements
 */
export const CRYPTO_CORRELATION_MATRIX: Record<string, Record<string, number>> = {
  'BTC/USD': {
    'BTC/USD': 1.0,
    'ETH/USD': 0.85,
    'SOL/USD': 0.75,
    'AVAX/USD': 0.70,
    'LINK/USD': 0.65,
    'UNI/USD': 0.68,
    'AAVE/USD': 0.67,
    'MATIC/USD': 0.72,
    'DOT/USD': 0.68,
    'ATOM/USD': 0.66,
    'DOGE/USD': 0.55,
    'SHIB/USD': 0.50,
    'LTC/USD': 0.78,
    'BCH/USD': 0.76,
  },
  'ETH/USD': {
    'BTC/USD': 0.85,
    'ETH/USD': 1.0,
    'SOL/USD': 0.78,
    'AVAX/USD': 0.73,
    'LINK/USD': 0.72,
    'UNI/USD': 0.80,
    'AAVE/USD': 0.82,
    'MATIC/USD': 0.76,
    'DOT/USD': 0.70,
    'ATOM/USD': 0.68,
    'DOGE/USD': 0.52,
    'SHIB/USD': 0.48,
    'LTC/USD': 0.73,
    'BCH/USD': 0.71,
  },
  'SOL/USD': {
    'BTC/USD': 0.75,
    'ETH/USD': 0.78,
    'SOL/USD': 1.0,
    'AVAX/USD': 0.82,
    'LINK/USD': 0.70,
    'UNI/USD': 0.75,
    'AAVE/USD': 0.74,
    'MATIC/USD': 0.79,
    'DOT/USD': 0.76,
    'ATOM/USD': 0.74,
    'DOGE/USD': 0.48,
    'SHIB/USD': 0.45,
    'LTC/USD': 0.68,
    'BCH/USD': 0.66,
  },
  // DeFi tokens tend to correlate with ETH
  'AVAX/USD': { 'BTC/USD': 0.70, 'ETH/USD': 0.73, 'SOL/USD': 0.82 },
  'LINK/USD': { 'BTC/USD': 0.65, 'ETH/USD': 0.72, 'SOL/USD': 0.70 },
  'UNI/USD': { 'BTC/USD': 0.68, 'ETH/USD': 0.80, 'SOL/USD': 0.75 },
  'AAVE/USD': { 'BTC/USD': 0.67, 'ETH/USD': 0.82, 'SOL/USD': 0.74 },
  'MATIC/USD': { 'BTC/USD': 0.72, 'ETH/USD': 0.76, 'SOL/USD': 0.79 },
  'DOT/USD': { 'BTC/USD': 0.68, 'ETH/USD': 0.70, 'SOL/USD': 0.76 },
  'ATOM/USD': { 'BTC/USD': 0.66, 'ETH/USD': 0.68, 'SOL/USD': 0.74 },

  // Meme coins have lower correlation
  'DOGE/USD': { 'BTC/USD': 0.55, 'ETH/USD': 0.52, 'SOL/USD': 0.48, 'SHIB/USD': 0.65 },
  'SHIB/USD': { 'BTC/USD': 0.50, 'ETH/USD': 0.48, 'SOL/USD': 0.45, 'DOGE/USD': 0.65 },

  // Legacy coins correlate strongly with BTC
  'LTC/USD': { 'BTC/USD': 0.78, 'ETH/USD': 0.73, 'BCH/USD': 0.85 },
  'BCH/USD': { 'BTC/USD': 0.76, 'ETH/USD': 0.71, 'LTC/USD': 0.85 },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if a symbol is a cryptocurrency pair
 */
export function isCryptoSymbol(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase();

  // Check if it's in our supported list
  if (SUPPORTED_CRYPTO.includes(upperSymbol as SupportedCrypto)) {
    return true;
  }

  // Check if it's a stablecoin
  if (STABLECOINS.includes(upperSymbol as Stablecoin)) {
    return true;
  }

  // Check format patterns
  const hasSlash = upperSymbol.includes('/');
  const endsWithUSD = upperSymbol.endsWith('USD');

  // Common crypto patterns: XXX/USD or XXXUSD
  if (hasSlash && endsWithUSD) {
    return true;
  }

  // Without slash: must be at least 6 chars (BTCUSD)
  if (!hasSlash && endsWithUSD && upperSymbol.length >= 6) {
    return true;
  }

  return false;
}

/**
 * Checks if a symbol is a stablecoin (should not be traded)
 */
export function isStablecoin(symbol: string): boolean {
  const normalized = normalizeCryptoSymbol(symbol);
  return STABLECOINS.includes(normalized as Stablecoin);
}

/**
 * Gets the category for a cryptocurrency
 */
export function getCryptoCategory(symbol: string): CryptoCategory {
  const normalized = normalizeCryptoSymbol(symbol);
  return CRYPTO_CATEGORY_MAP[normalized] || 'small_cap'; // Default to small_cap for unknown
}

/**
 * Gets the volatility multiplier for a cryptocurrency
 * Used to adjust position sizing based on asset volatility
 */
export function getCryptoVolatilityMultiplier(symbol: string): number {
  const category = getCryptoCategory(symbol);
  return CRYPTO_CATEGORIES[category].volatilityMultiplier;
}

/**
 * Gets the maximum position size percentage for a cryptocurrency
 */
export function getMaxPositionSizePercent(symbol: string): number {
  const category = getCryptoCategory(symbol);
  return CRYPTO_CATEGORIES[category].maxPositionSizePercent;
}

/**
 * Gets the minimum confidence threshold for trading a cryptocurrency
 */
export function getMinConfidenceThreshold(symbol: string): number {
  const category = getCryptoCategory(symbol);
  return CRYPTO_CATEGORIES[category].minConfidenceThreshold;
}

/**
 * Normalizes a crypto symbol to the standard slash format (e.g., BTC/USD)
 */
export function normalizeCryptoSymbol(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();

  // Already in correct format
  if (upperSymbol.includes('/')) {
    return upperSymbol;
  }

  // Common known conversions
  const knownConversions: Record<string, string> = {
    'BTCUSD': 'BTC/USD',
    'ETHUSD': 'ETH/USD',
    'SOLUSD': 'SOL/USD',
    'AVAXUSD': 'AVAX/USD',
    'LINKUSD': 'LINK/USD',
    'UNIUSD': 'UNI/USD',
    'AAVEUSD': 'AAVE/USD',
    'MKRUSD': 'MKR/USD',
    'MATICUSD': 'MATIC/USD',
    'ARBUSD': 'ARB/USD',
    'OPUSD': 'OP/USD',
    'DOGEUSD': 'DOGE/USD',
    'SHIBUSD': 'SHIB/USD',
    'DOTUSD': 'DOT/USD',
    'ATOMUSD': 'ATOM/USD',
    'LTCUSD': 'LTC/USD',
    'BCHUSD': 'BCH/USD',
    'XLMUSD': 'XLM/USD',
    'USDCUSD': 'USDC/USD',
    'USDTUSD': 'USDT/USD',
    'DAIUSD': 'DAI/USD',
  };

  if (knownConversions[upperSymbol]) {
    return knownConversions[upperSymbol];
  }

  // Pattern-based conversion: XXXUSD -> XXX/USD
  if (upperSymbol.endsWith('USD') && upperSymbol.length > 3) {
    const base = upperSymbol.slice(0, -3);
    return `${base}/USD`;
  }

  return upperSymbol;
}

/**
 * Calculates adjusted position size for a crypto asset based on volatility
 */
export function calculateCryptoPositionSize(
  basePositionSizePercent: number,
  symbol: string,
  accountValue: number
): { positionSizePercent: number; positionSizeDollar: number; reason: string } {
  const category = getCryptoCategory(symbol);
  const config = CRYPTO_CATEGORIES[category];
  const volatilityMultiplier = config.volatilityMultiplier;

  // Adjust position size inversely to volatility
  // Higher volatility = smaller position
  const adjustedPercent = Math.min(
    basePositionSizePercent / volatilityMultiplier,
    config.maxPositionSizePercent
  );

  const positionSizeDollar = (adjustedPercent / 100) * accountValue;

  return {
    positionSizePercent: adjustedPercent,
    positionSizeDollar,
    reason: `${category} crypto with ${volatilityMultiplier}x volatility, max ${config.maxPositionSizePercent}%`,
  };
}

/**
 * Gets correlation between two crypto symbols
 */
export function getCryptoCorrelation(symbol1: string, symbol2: string): number {
  const normalized1 = normalizeCryptoSymbol(symbol1);
  const normalized2 = normalizeCryptoSymbol(symbol2);

  // Same symbol = perfect correlation
  if (normalized1 === normalized2) {
    return 1.0;
  }

  // Check correlation matrix
  const correlations1 = CRYPTO_CORRELATION_MATRIX[normalized1];
  if (correlations1 && correlations1[normalized2] !== undefined) {
    return correlations1[normalized2];
  }

  // Check reverse
  const correlations2 = CRYPTO_CORRELATION_MATRIX[normalized2];
  if (correlations2 && correlations2[normalized1] !== undefined) {
    return correlations2[normalized1];
  }

  // Default moderate correlation for unknown pairs
  return 0.6;
}

/**
 * Checks if adding a position would exceed correlation limits
 */
export function checkCorrelationRisk(
  newSymbol: string,
  existingPositions: Array<{ symbol: string; value: number }>,
  parameters: CryptoTradingParameters = DEFAULT_CRYPTO_PARAMETERS
): { allowed: boolean; reason?: string; correlatedWith?: string[] } {
  if (!parameters.useCorrelationMatrix) {
    return { allowed: true };
  }

  const newSymbolNormalized = normalizeCryptoSymbol(newSymbol);
  const correlatedPositions: string[] = [];

  for (const position of existingPositions) {
    const correlation = getCryptoCorrelation(newSymbolNormalized, position.symbol);

    if (correlation >= parameters.correlationThreshold) {
      correlatedPositions.push(position.symbol);
    }
  }

  if (correlatedPositions.length >= parameters.maxCorrelatedPositions) {
    return {
      allowed: false,
      reason: `Too many correlated positions (${correlatedPositions.length}). Max: ${parameters.maxCorrelatedPositions}`,
      correlatedWith: correlatedPositions,
    };
  }

  return { allowed: true, correlatedWith: correlatedPositions };
}

/**
 * Validates if a crypto symbol is tradable (not a stablecoin)
 */
export function validateCryptoTradable(symbol: string): { tradable: boolean; reason?: string } {
  const normalized = normalizeCryptoSymbol(symbol);

  if (isStablecoin(normalized)) {
    return {
      tradable: false,
      reason: `${normalized} is a stablecoin - not suitable for trading`,
    };
  }

  if (!isCryptoSymbol(normalized)) {
    return {
      tradable: false,
      reason: `${symbol} is not recognized as a cryptocurrency`,
    };
  }

  return { tradable: true };
}

/**
 * Gets recommended stop loss percentage for a crypto asset
 */
export function getRecommendedStopLoss(symbol: string): number {
  const category = getCryptoCategory(symbol);
  const baseStopLoss = DEFAULT_CRYPTO_PARAMETERS.defaultStopLossPercent;
  const multiplier = CRYPTO_CATEGORIES[category].volatilityMultiplier;

  // Higher volatility = wider stop loss to avoid getting stopped out by normal volatility
  return baseStopLoss * Math.sqrt(multiplier);
}

/**
 * Gets recommended take profit percentage for a crypto asset
 */
export function getRecommendedTakeProfit(symbol: string): number {
  const category = getCryptoCategory(symbol);
  const baseTakeProfit = DEFAULT_CRYPTO_PARAMETERS.defaultTakeProfitPercent;
  const multiplier = CRYPTO_CATEGORIES[category].volatilityMultiplier;

  // Higher volatility = higher take profit target
  return baseTakeProfit * multiplier;
}

/**
 * Checks if crypto markets are open (always true - 24/7)
 */
export function areCryptoMarketsOpen(): boolean {
  return true; // Crypto markets are always open
}

/**
 * Gets all crypto symbols by category
 */
export function getCryptosByCategory(category: CryptoCategory): string[] {
  return Object.entries(CRYPTO_CATEGORY_MAP)
    .filter(([_, cat]) => cat === category)
    .map(([symbol]) => symbol);
}

/**
 * Gets trading statistics for a category
 */
export function getCategoryStats(category: CryptoCategory): {
  category: CryptoCategory;
  symbolCount: number;
  symbols: string[];
  avgVolatility: number;
  maxPositionSize: number;
  minConfidence: number;
} {
  const symbols = getCryptosByCategory(category);
  const config = CRYPTO_CATEGORIES[category];

  return {
    category,
    symbolCount: symbols.length,
    symbols,
    avgVolatility: config.volatilityMultiplier,
    maxPositionSize: config.maxPositionSizePercent,
    minConfidence: config.minConfidenceThreshold,
  };
}

/**
 * Gets all supported crypto symbols (excluding stablecoins)
 */
export function getAllTradableCryptos(): string[] {
  return [...SUPPORTED_CRYPTO];
}

/**
 * Gets comprehensive crypto info for a symbol
 */
export function getCryptoInfo(symbol: string): {
  symbol: string;
  normalized: string;
  isStablecoin: boolean;
  isTradable: boolean;
  category: CryptoCategory;
  volatilityMultiplier: number;
  maxPositionSize: number;
  minConfidence: number;
  recommendedStopLoss: number;
  recommendedTakeProfit: number;
} {
  const normalized = normalizeCryptoSymbol(symbol);
  const stablecoin = isStablecoin(normalized);
  const category = getCryptoCategory(normalized);
  const config = CRYPTO_CATEGORIES[category];

  return {
    symbol,
    normalized,
    isStablecoin: stablecoin,
    isTradable: !stablecoin,
    category,
    volatilityMultiplier: config.volatilityMultiplier,
    maxPositionSize: config.maxPositionSizePercent,
    minConfidence: config.minConfidenceThreshold,
    recommendedStopLoss: getRecommendedStopLoss(normalized),
    recommendedTakeProfit: getRecommendedTakeProfit(normalized),
  };
}
