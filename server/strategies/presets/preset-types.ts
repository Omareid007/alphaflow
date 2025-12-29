/**
 * Shared Preset Framework - Type Definitions
 *
 * Defines the standard preset levels and type system for all trading strategies.
 * This framework eliminates duplicate preset logic across strategy files.
 *
 * @see /scale/replit-prompts/04-preset-framework.md
 */

// ============================================================================
// CORE PRESET TYPES
// ============================================================================

/**
 * Standard preset levels used across all strategies
 */
export type PresetName =
  | "conservative" // Low risk, fewer trades, longer holds
  | "moderate" // Balanced approach, standard parameters
  | "aggressive" // Higher risk, more trades, faster signals
  | "scalper" // High frequency, small profits, quick exits
  | "swing" // Multi-day holds, trend-based
  | "daytrader"; // Intraday only, no overnight positions

/**
 * Strategy types that support the preset framework
 */
export type StrategyType = "momentum" | "maCrossover" | "meanReversion";

/**
 * Risk level classification (1=lowest, 5=highest)
 */
export type RiskLevel = 1 | 2 | 3 | 4 | 5;

// ============================================================================
// BASE PRESET INTERFACE
// ============================================================================

/**
 * Base preset configuration that all strategy presets must implement
 */
export interface BasePreset {
  name: PresetName;
  displayName: string;
  description: string;
  riskLevel: RiskLevel;
}

/**
 * Complete strategy preset with all parameters
 */
export interface StrategyPreset extends BasePreset {
  parameters: PresetParameters;
}

// ============================================================================
// PARAMETER TYPES
// ============================================================================

/**
 * Base risk parameters shared across all strategies
 */
export interface RiskParameters {
  // Position sizing
  maxPositionSizePct: number; // Max % of portfolio per position
  maxTotalExposurePct: number; // Max % of portfolio in all positions

  // Risk management
  stopLossPct: number; // Stop loss as % of entry price
  takeProfitPct: number; // Take profit as % of entry price
  maxDailyLossPct: number; // Max % loss allowed per day
}

/**
 * Indicator-specific parameters
 */
export interface IndicatorParameters {
  // RSI settings
  rsiPeriod?: number;
  rsiOverbought?: number;
  rsiOversold?: number;

  // Moving Average settings
  fastMaPeriod?: number;
  slowMaPeriod?: number;

  // Momentum settings
  lookbackPeriod?: number;
  momentumThreshold?: number;

  // Mean reversion settings
  deviationThreshold?: number;
  meanPeriod?: number;
}

/**
 * Time-based filters
 */
export interface TimeFilters {
  // Trading hours (in ET timezone)
  tradingStartHour?: number; // 0-23
  tradingEndHour?: number; // 0-23

  // Day restrictions
  tradingDays?: ("monday" | "tuesday" | "wednesday" | "thursday" | "friday")[];

  // Session preferences
  preferredSessions?: ("premarket" | "market" | "afterhours")[];

  // Holding period
  maxHoldingPeriodDays?: number;
  minHoldingPeriodMinutes?: number;
}

/**
 * Position management settings
 */
export interface PositionLimits {
  maxOpenPositions: number; // Max concurrent positions
  maxPositionsPerSymbol: number; // Max positions in same symbol
  minPositionValue: number; // Min $ value per position
  maxPositionValue: number; // Max $ value per position
}

/**
 * Combined preset parameters
 */
export interface PresetParameters
  extends RiskParameters, IndicatorParameters, TimeFilters, PositionLimits {
  // Strategy-specific allocation
  allocationPct: number; // % of portfolio allocated to this strategy
  riskLimitPct: number; // Max risk per trade as % of portfolio
}

// ============================================================================
// PRESET OVERRIDE SUPPORT
// ============================================================================

/**
 * Partial parameters for strategy-specific overrides
 */
export type PresetOverrides = Partial<PresetParameters>;

/**
 * Configuration for applying a preset to a strategy
 */
export interface PresetConfig {
  strategyType: StrategyType;
  presetName: PresetName;
  overrides?: PresetOverrides;
}

// ============================================================================
// PRESET METADATA
// ============================================================================

/**
 * Additional metadata about a preset
 */
export interface PresetMetadata {
  // Performance characteristics
  expectedWinRate?: number; // Expected win rate (0-1)
  expectedSharpe?: number; // Expected Sharpe ratio
  expectedMaxDrawdown?: number; // Expected max drawdown %

  // Trade characteristics
  avgTradesPerDay?: number; // Average trades per day
  avgHoldingPeriod?: number; // Average holding period in hours

  // Market suitability
  bestMarkets?: ("trending" | "ranging" | "volatile" | "calm")[];
  worstMarkets?: ("trending" | "ranging" | "volatile" | "calm")[];

  // Experience level
  recommendedFor?: ("beginner" | "intermediate" | "advanced")[];
}

/**
 * Full preset with metadata
 */
export interface PresetWithMetadata extends StrategyPreset {
  metadata?: PresetMetadata;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Parameter bounds for validation
 */
export interface ParameterBounds {
  min: number;
  max: number;
  default: number;
  step?: number; // Optional step for UI sliders
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Parameter validation rules
 */
export type ParameterValidationRules = {
  [K in keyof PresetParameters]?: ParameterBounds;
};

// ============================================================================
// MARKET CONDITION TYPES
// ============================================================================

/**
 * Market volatility level
 */
export type VolatilityLevel = "low" | "medium" | "high";

/**
 * Market trend direction
 */
export type TrendDirection = "bullish" | "bearish" | "sideways";

/**
 * Market conditions for preset recommendation
 */
export interface MarketConditions {
  volatility: VolatilityLevel;
  trend: TrendDirection;
  volume?: "low" | "medium" | "high";
}

// All types are already exported via 'export type' or 'export interface' above
// No need for re-exports
