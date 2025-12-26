/**
 * Shared Preset Framework - Central Registry
 *
 * Central registry for all strategy presets with management utilities.
 * Provides preset retrieval, validation, merging, and recommendation logic.
 *
 * @see /scale/replit-prompts/04-preset-framework.md
 */

import type {
  PresetName,
  StrategyType,
  StrategyPreset,
  PresetParameters,
  PresetOverrides,
  RiskParameters,
  ValidationResult,
  ParameterValidationRules,
  MarketConditions,
  VolatilityLevel,
  TrendDirection,
} from "./preset-types";

// ============================================================================
// BASE RISK PROFILES
// ============================================================================

/**
 * Standard risk profiles shared across all strategies
 */
export const BASE_RISK_PROFILES: Record<"conservative" | "moderate" | "aggressive", RiskParameters> = {
  conservative: {
    maxPositionSizePct: 0.05,
    maxTotalExposurePct: 0.30,
    stopLossPct: 0.02,
    takeProfitPct: 0.04,
    maxDailyLossPct: 0.03,
  },
  moderate: {
    maxPositionSizePct: 0.08,
    maxTotalExposurePct: 0.50,
    stopLossPct: 0.03,
    takeProfitPct: 0.06,
    maxDailyLossPct: 0.05,
  },
  aggressive: {
    maxPositionSizePct: 0.15,
    maxTotalExposurePct: 0.80,
    stopLossPct: 0.05,
    takeProfitPct: 0.10,
    maxDailyLossPct: 0.08,
  },
};

// ============================================================================
// MOMENTUM STRATEGY PRESETS
// ============================================================================

export const MOMENTUM_PRESETS: Record<PresetName, StrategyPreset> = {
  conservative: {
    name: "conservative",
    displayName: "Conservative Momentum",
    description: "Lower sensitivity, longer lookback, smaller positions. Best for risk-averse traders.",
    riskLevel: 2,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.conservative,

      // Indicator parameters
      lookbackPeriod: 20,
      momentumThreshold: 0.03,
      rsiPeriod: 14,
      rsiOverbought: 75,
      rsiOversold: 25,

      // Position parameters
      allocationPct: 0.05,
      riskLimitPct: 0.03,

      // Position limits
      maxOpenPositions: 3,
      maxPositionsPerSymbol: 1,
      minPositionValue: 100,
      maxPositionValue: 5000,

      // Time filters
      tradingStartHour: 10,
      tradingEndHour: 15,
      tradingDays: ["tuesday", "wednesday", "thursday"],
      maxHoldingPeriodDays: 5,
    },
  },

  moderate: {
    name: "moderate",
    displayName: "Balanced Momentum",
    description: "Standard momentum settings for regular market conditions. Good balance of risk and reward.",
    riskLevel: 3,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.moderate,

      // Indicator parameters
      lookbackPeriod: 14,
      momentumThreshold: 0.02,
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,

      // Position parameters
      allocationPct: 0.08,
      riskLimitPct: 0.05,

      // Position limits
      maxOpenPositions: 5,
      maxPositionsPerSymbol: 1,
      minPositionValue: 100,
      maxPositionValue: 10000,

      // Time filters
      tradingStartHour: 9,
      tradingEndHour: 16,
      maxHoldingPeriodDays: 3,
    },
  },

  aggressive: {
    name: "aggressive",
    displayName: "Aggressive Momentum",
    description: "Higher sensitivity, faster reactions, larger positions. For experienced traders.",
    riskLevel: 4,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.aggressive,

      // Indicator parameters
      lookbackPeriod: 7,
      momentumThreshold: 0.015,
      rsiPeriod: 10,
      rsiOverbought: 65,
      rsiOversold: 35,

      // Position parameters
      allocationPct: 0.12,
      riskLimitPct: 0.08,

      // Position limits
      maxOpenPositions: 8,
      maxPositionsPerSymbol: 2,
      minPositionValue: 100,
      maxPositionValue: 15000,

      // Time filters
      tradingStartHour: 9,
      tradingEndHour: 16,
      maxHoldingPeriodDays: 2,
    },
  },

  scalper: {
    name: "scalper",
    displayName: "Momentum Scalper",
    description: "Very short-term momentum plays. High frequency, small profits per trade.",
    riskLevel: 5,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.aggressive,
      stopLossPct: 0.01,
      takeProfitPct: 0.02,

      // Indicator parameters
      lookbackPeriod: 5,
      momentumThreshold: 0.01,
      rsiPeriod: 7,
      rsiOverbought: 60,
      rsiOversold: 40,

      // Position parameters
      allocationPct: 0.06,
      riskLimitPct: 0.04,

      // Position limits
      maxOpenPositions: 10,
      maxPositionsPerSymbol: 3,
      minPositionValue: 100,
      maxPositionValue: 5000,

      // Time filters
      tradingStartHour: 9,
      tradingEndHour: 16,
      maxHoldingPeriodDays: 1,
      minHoldingPeriodMinutes: 5,
    },
  },

  swing: {
    name: "swing",
    displayName: "Swing Momentum",
    description: "Multi-day momentum trades. Captures larger trends with patience.",
    riskLevel: 3,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.moderate,
      stopLossPct: 0.04,
      takeProfitPct: 0.12,

      // Indicator parameters
      lookbackPeriod: 30,
      momentumThreshold: 0.04,
      rsiPeriod: 21,
      rsiOverbought: 75,
      rsiOversold: 25,

      // Position parameters
      allocationPct: 0.10,
      riskLimitPct: 0.06,

      // Position limits
      maxOpenPositions: 4,
      maxPositionsPerSymbol: 1,
      minPositionValue: 500,
      maxPositionValue: 20000,

      // Time filters
      maxHoldingPeriodDays: 10,
      minHoldingPeriodMinutes: 1440, // 1 day
    },
  },

  daytrader: {
    name: "daytrader",
    displayName: "Day Trading Momentum",
    description: "Intraday momentum with quick exits. No overnight positions.",
    riskLevel: 4,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.moderate,

      // Indicator parameters
      lookbackPeriod: 10,
      momentumThreshold: 0.015,
      rsiPeriod: 9,
      rsiOverbought: 70,
      rsiOversold: 30,

      // Position parameters
      allocationPct: 0.08,
      riskLimitPct: 0.05,

      // Position limits
      maxOpenPositions: 6,
      maxPositionsPerSymbol: 2,
      minPositionValue: 100,
      maxPositionValue: 10000,

      // Time filters
      tradingStartHour: 9,
      tradingEndHour: 16,
      maxHoldingPeriodDays: 1,
      minHoldingPeriodMinutes: 15,
    },
  },
};

// ============================================================================
// MA CROSSOVER STRATEGY PRESETS
// ============================================================================

export const MA_CROSSOVER_PRESETS: Record<PresetName, StrategyPreset> = {
  conservative: {
    name: "conservative",
    displayName: "Conservative Crossover",
    description: "Slower MAs, fewer false signals. Best for trending markets.",
    riskLevel: 2,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.conservative,

      // Indicator parameters
      fastMaPeriod: 10,
      slowMaPeriod: 30,

      // Position parameters
      allocationPct: 0.08,
      riskLimitPct: 0.05,

      // Position limits
      maxOpenPositions: 3,
      maxPositionsPerSymbol: 1,
      minPositionValue: 100,
      maxPositionValue: 8000,

      // Time filters
      tradingStartHour: 10,
      tradingEndHour: 15,
      maxHoldingPeriodDays: 10,
    },
  },

  moderate: {
    name: "moderate",
    displayName: "Balanced Crossover",
    description: "Standard 7/20 crossover. Good balance of signals and reliability.",
    riskLevel: 3,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.moderate,

      // Indicator parameters
      fastMaPeriod: 7,
      slowMaPeriod: 20,

      // Position parameters
      allocationPct: 0.10,
      riskLimitPct: 0.08,

      // Position limits
      maxOpenPositions: 5,
      maxPositionsPerSymbol: 1,
      minPositionValue: 100,
      maxPositionValue: 10000,

      // Time filters
      tradingStartHour: 9,
      tradingEndHour: 16,
      maxHoldingPeriodDays: 7,
    },
  },

  aggressive: {
    name: "aggressive",
    displayName: "Fast Crossover",
    description: "Quick moving averages, more signals. Higher trade frequency.",
    riskLevel: 4,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.aggressive,

      // Indicator parameters
      fastMaPeriod: 5,
      slowMaPeriod: 13,

      // Position parameters
      allocationPct: 0.15,
      riskLimitPct: 0.12,

      // Position limits
      maxOpenPositions: 8,
      maxPositionsPerSymbol: 2,
      minPositionValue: 100,
      maxPositionValue: 15000,

      // Time filters
      tradingStartHour: 9,
      tradingEndHour: 16,
      maxHoldingPeriodDays: 5,
    },
  },

  scalper: {
    name: "scalper",
    displayName: "Crossover Scalper",
    description: "Ultra-fast MAs for quick trades. Very short holding periods.",
    riskLevel: 5,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.aggressive,
      stopLossPct: 0.01,
      takeProfitPct: 0.02,

      // Indicator parameters
      fastMaPeriod: 3,
      slowMaPeriod: 8,

      // Position parameters
      allocationPct: 0.06,
      riskLimitPct: 0.05,

      // Position limits
      maxOpenPositions: 10,
      maxPositionsPerSymbol: 3,
      minPositionValue: 100,
      maxPositionValue: 5000,

      // Time filters
      tradingStartHour: 9,
      tradingEndHour: 16,
      maxHoldingPeriodDays: 1,
      minHoldingPeriodMinutes: 5,
    },
  },

  swing: {
    name: "swing",
    displayName: "Swing Crossover",
    description: "Longer-term crossover signals. Captures major trend changes.",
    riskLevel: 2,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.conservative,
      stopLossPct: 0.04,
      takeProfitPct: 0.12,

      // Indicator parameters
      fastMaPeriod: 20,
      slowMaPeriod: 50,

      // Position parameters
      allocationPct: 0.12,
      riskLimitPct: 0.10,

      // Position limits
      maxOpenPositions: 4,
      maxPositionsPerSymbol: 1,
      minPositionValue: 500,
      maxPositionValue: 20000,

      // Time filters
      maxHoldingPeriodDays: 15,
      minHoldingPeriodMinutes: 1440,
    },
  },

  daytrader: {
    name: "daytrader",
    displayName: "Day Trading Crossover",
    description: "Balanced for intraday trading. No overnight exposure.",
    riskLevel: 3,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.moderate,

      // Indicator parameters
      fastMaPeriod: 7,
      slowMaPeriod: 15,

      // Position parameters
      allocationPct: 0.10,
      riskLimitPct: 0.08,

      // Position limits
      maxOpenPositions: 6,
      maxPositionsPerSymbol: 2,
      minPositionValue: 100,
      maxPositionValue: 10000,

      // Time filters
      tradingStartHour: 9,
      tradingEndHour: 16,
      maxHoldingPeriodDays: 1,
      minHoldingPeriodMinutes: 30,
    },
  },
};

// ============================================================================
// MEAN REVERSION STRATEGY PRESETS
// ============================================================================

export const MEAN_REVERSION_PRESETS: Record<PresetName, StrategyPreset> = {
  conservative: {
    name: "conservative",
    displayName: "Conservative Reversion",
    description: "Higher deviation threshold, smaller positions. High probability trades.",
    riskLevel: 2,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.conservative,

      // Indicator parameters
      meanPeriod: 20,
      deviationThreshold: 2.5,

      // Position parameters
      allocationPct: 0.03,
      riskLimitPct: 0.02,

      // Position limits
      maxOpenPositions: 3,
      maxPositionsPerSymbol: 1,
      minPositionValue: 100,
      maxPositionValue: 3000,

      // Time filters
      tradingStartHour: 10,
      tradingEndHour: 15,
      maxHoldingPeriodDays: 5,
    },
  },

  moderate: {
    name: "moderate",
    displayName: "Balanced Reversion",
    description: "Standard mean reversion settings. Classic 2 std dev bands.",
    riskLevel: 3,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.moderate,

      // Indicator parameters
      meanPeriod: 14,
      deviationThreshold: 2.0,

      // Position parameters
      allocationPct: 0.05,
      riskLimitPct: 0.03,

      // Position limits
      maxOpenPositions: 5,
      maxPositionsPerSymbol: 1,
      minPositionValue: 100,
      maxPositionValue: 5000,

      // Time filters
      tradingStartHour: 9,
      tradingEndHour: 16,
      maxHoldingPeriodDays: 3,
    },
  },

  aggressive: {
    name: "aggressive",
    displayName: "Aggressive Reversion",
    description: "Lower threshold, faster entries. Higher trade frequency.",
    riskLevel: 4,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.aggressive,

      // Indicator parameters
      meanPeriod: 10,
      deviationThreshold: 1.5,

      // Position parameters
      allocationPct: 0.08,
      riskLimitPct: 0.05,

      // Position limits
      maxOpenPositions: 8,
      maxPositionsPerSymbol: 2,
      minPositionValue: 100,
      maxPositionValue: 8000,

      // Time filters
      tradingStartHour: 9,
      tradingEndHour: 16,
      maxHoldingPeriodDays: 2,
    },
  },

  scalper: {
    name: "scalper",
    displayName: "Reversion Scalper",
    description: "Quick reversion trades. Tight deviation bands.",
    riskLevel: 5,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.aggressive,
      stopLossPct: 0.01,
      takeProfitPct: 0.015,

      // Indicator parameters
      meanPeriod: 7,
      deviationThreshold: 1.2,

      // Position parameters
      allocationPct: 0.04,
      riskLimitPct: 0.03,

      // Position limits
      maxOpenPositions: 10,
      maxPositionsPerSymbol: 3,
      minPositionValue: 100,
      maxPositionValue: 4000,

      // Time filters
      tradingStartHour: 9,
      tradingEndHour: 16,
      maxHoldingPeriodDays: 1,
      minHoldingPeriodMinutes: 5,
    },
  },

  swing: {
    name: "swing",
    displayName: "Swing Reversion",
    description: "Multi-day mean reversion. Patience for larger reversions.",
    riskLevel: 2,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.conservative,
      stopLossPct: 0.04,
      takeProfitPct: 0.08,

      // Indicator parameters
      meanPeriod: 30,
      deviationThreshold: 2.5,

      // Position parameters
      allocationPct: 0.06,
      riskLimitPct: 0.04,

      // Position limits
      maxOpenPositions: 4,
      maxPositionsPerSymbol: 1,
      minPositionValue: 500,
      maxPositionValue: 10000,

      // Time filters
      maxHoldingPeriodDays: 7,
      minHoldingPeriodMinutes: 1440,
    },
  },

  daytrader: {
    name: "daytrader",
    displayName: "Day Trading Reversion",
    description: "Intraday mean reversion. No overnight risk.",
    riskLevel: 3,
    parameters: {
      // Risk parameters
      ...BASE_RISK_PROFILES.moderate,

      // Indicator parameters
      meanPeriod: 10,
      deviationThreshold: 1.8,

      // Position parameters
      allocationPct: 0.05,
      riskLimitPct: 0.03,

      // Position limits
      maxOpenPositions: 6,
      maxPositionsPerSymbol: 2,
      minPositionValue: 100,
      maxPositionValue: 5000,

      // Time filters
      tradingStartHour: 9,
      tradingEndHour: 16,
      maxHoldingPeriodDays: 1,
      minHoldingPeriodMinutes: 30,
    },
  },
};

// ============================================================================
// STRATEGY PRESET REGISTRY
// ============================================================================

/**
 * Central registry mapping strategy types to their presets
 */
const STRATEGY_PRESETS: Record<StrategyType, Record<PresetName, StrategyPreset>> = {
  momentum: MOMENTUM_PRESETS,
  maCrossover: MA_CROSSOVER_PRESETS,
  meanReversion: MEAN_REVERSION_PRESETS,
};

// ============================================================================
// PRESET FRAMEWORK CLASS
// ============================================================================

/**
 * Central preset management framework
 */
export class PresetFramework {
  /**
   * Get preset for a specific strategy and preset name
   */
  static getPreset(strategy: StrategyType, presetName: PresetName): StrategyPreset {
    const presets = STRATEGY_PRESETS[strategy];
    if (!presets) {
      throw new Error(`Unknown strategy type: ${strategy}`);
    }

    const preset = presets[presetName];
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName} for strategy: ${strategy}`);
    }

    return preset;
  }

  /**
   * Get all presets for a strategy
   */
  static getPresetsForStrategy(strategy: StrategyType): StrategyPreset[] {
    const presets = STRATEGY_PRESETS[strategy];
    if (!presets) {
      throw new Error(`Unknown strategy type: ${strategy}`);
    }

    return Object.values(presets);
  }

  /**
   * Get preset by risk level
   */
  static getPresetByRiskLevel(strategy: StrategyType, riskLevel: number): StrategyPreset {
    const presets = this.getPresetsForStrategy(strategy);
    const matching = presets.find((p) => p.riskLevel === riskLevel);

    // Default to moderate if no exact match
    return matching || presets.find((p) => p.name === "moderate")!;
  }

  /**
   * Merge preset with custom overrides
   */
  static mergeWithOverrides(
    strategy: StrategyType,
    presetName: PresetName,
    overrides: PresetOverrides
  ): PresetParameters {
    const preset = this.getPreset(strategy, presetName);
    return {
      ...preset.parameters,
      ...overrides,
    };
  }

  /**
   * Get preset parameters as a flat object (for backward compatibility)
   */
  static getParameters(strategy: StrategyType, presetName: PresetName): PresetParameters {
    const preset = this.getPreset(strategy, presetName);
    return preset.parameters;
  }

  /**
   * Validate parameters against preset constraints
   */
  static validateParameters(
    strategy: StrategyType,
    parameters: Partial<PresetParameters>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Common validations
    if (parameters.allocationPct !== undefined) {
      if (parameters.allocationPct < 0.01 || parameters.allocationPct > 0.25) {
        errors.push("allocationPct must be between 1% and 25%");
      }
    }

    if (parameters.riskLimitPct !== undefined) {
      if (parameters.riskLimitPct < 0.01 || parameters.riskLimitPct > 0.15) {
        errors.push("riskLimitPct must be between 1% and 15%");
      }
    }

    if (parameters.maxPositionSizePct !== undefined) {
      if (parameters.maxPositionSizePct < 0.01 || parameters.maxPositionSizePct > 0.25) {
        errors.push("maxPositionSizePct must be between 1% and 25%");
      }
    }

    if (parameters.stopLossPct !== undefined) {
      if (parameters.stopLossPct < 0.005 || parameters.stopLossPct > 0.20) {
        errors.push("stopLossPct must be between 0.5% and 20%");
      }
    }

    if (parameters.takeProfitPct !== undefined) {
      if (parameters.takeProfitPct < 0.01 || parameters.takeProfitPct > 0.50) {
        errors.push("takeProfitPct must be between 1% and 50%");
      }
    }

    // Strategy-specific validations
    if (strategy === "maCrossover") {
      if (
        parameters.fastMaPeriod !== undefined &&
        parameters.slowMaPeriod !== undefined &&
        parameters.fastMaPeriod >= parameters.slowMaPeriod
      ) {
        errors.push("fastMaPeriod must be less than slowMaPeriod");
      }
    }

    if (strategy === "meanReversion") {
      if (parameters.deviationThreshold !== undefined) {
        if (parameters.deviationThreshold < 1.0 || parameters.deviationThreshold > 4.0) {
          errors.push("deviationThreshold must be between 1.0 and 4.0");
        }
      }
    }

    if (strategy === "momentum") {
      if (parameters.momentumThreshold !== undefined) {
        if (parameters.momentumThreshold < 0.005 || parameters.momentumThreshold > 0.10) {
          errors.push("momentumThreshold must be between 0.5% and 10%");
        }
      }

      if (parameters.rsiOverbought !== undefined && parameters.rsiOversold !== undefined) {
        if (parameters.rsiOversold >= parameters.rsiOverbought) {
          errors.push("rsiOversold must be less than rsiOverbought");
        }
      }
    }

    // Warnings for potentially risky settings
    if (parameters.maxOpenPositions !== undefined && parameters.maxOpenPositions > 10) {
      warnings.push("More than 10 open positions may be difficult to manage");
    }

    if (parameters.maxTotalExposurePct !== undefined && parameters.maxTotalExposurePct > 0.75) {
      warnings.push("Total exposure above 75% is considered very aggressive");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get recommended preset based on market conditions
   */
  static getRecommendedPreset(
    strategy: StrategyType,
    conditions: MarketConditions
  ): PresetName {
    const { volatility, trend } = conditions;

    // High volatility -> conservative approach
    if (volatility === "high") {
      return "conservative";
    }

    // Strategy-specific recommendations
    if (strategy === "meanReversion") {
      // Mean reversion works best in ranging markets
      if (trend === "sideways") {
        return volatility === "low" ? "aggressive" : "moderate";
      }
      return "conservative";
    }

    if (strategy === "momentum") {
      // Momentum works best in trending markets
      if (trend === "bullish" || trend === "bearish") {
        return volatility === "low" ? "aggressive" : "moderate";
      }
      return "conservative";
    }

    if (strategy === "maCrossover") {
      // MA crossover is versatile but needs clear trends
      if (trend === "sideways") {
        return "conservative";
      }
      return volatility === "low" ? "moderate" : "conservative";
    }

    // Default to moderate
    return "moderate";
  }

  /**
   * List all available preset names
   */
  static getAvailablePresets(): PresetName[] {
    return ["conservative", "moderate", "aggressive", "scalper", "swing", "daytrader"];
  }

  /**
   * List all supported strategy types
   */
  static getSupportedStrategies(): StrategyType[] {
    return Object.keys(STRATEGY_PRESETS) as StrategyType[];
  }

  /**
   * Get human-readable description of a preset
   */
  static getPresetDescription(strategy: StrategyType, presetName: PresetName): string {
    const preset = this.getPreset(strategy, presetName);
    return `${preset.displayName}: ${preset.description} (Risk Level: ${preset.riskLevel}/5)`;
  }

  /**
   * Compare two presets and return differences
   */
  static comparePresets(
    strategy: StrategyType,
    preset1: PresetName,
    preset2: PresetName
  ): Partial<PresetParameters> {
    const p1 = this.getPreset(strategy, preset1).parameters;
    const p2 = this.getPreset(strategy, preset2).parameters;

    const differences: Record<string, any> = {};

    for (const key in p1) {
      const typedKey = key as keyof PresetParameters;
      if (p1[typedKey] !== p2[typedKey]) {
        differences[key] = p2[typedKey];
      }
    }

    return differences as Partial<PresetParameters>;
  }
}

// PresetFramework is the main export
// Individual preset collections are already exported above
export default PresetFramework;
