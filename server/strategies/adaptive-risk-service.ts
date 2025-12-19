/**
 * Adaptive Risk Service
 * 
 * Automatically adjusts strategy risk profile based on real-time market intelligence.
 * Uses MarketIntelligenceScore from the Data Fusion Engine to select between presets.
 * 
 * Key principle: DETERMINISTIC selection based on market metrics with clear thresholds.
 * When adaptiveRiskEnabled=false, this service is a no-op (backward compatible).
 * 
 * Implements spec from docs/GOVERNANCE per Section 2.2 and 2.3.
 */

import { log } from "../utils/logger";
import { dataFusionEngine, type MarketIntelligenceScore } from "../fusion/data-fusion-engine";
import { 
  MovingAverageCrossoverConfig, 
  PresetId, 
  MOVING_AVERAGE_PRESETS,
  applyPresetToConfig 
} from "./moving-average-crossover";

/**
 * Market condition thresholds for preset selection.
 * As specified in GOVERNANCE Section 2.2.
 */
export const ADAPTIVE_THRESHOLDS = {
  conservative: {
    overall: -0.2,
    volatility: -0.4,
    sentiment: -0.3,
  },
  aggressive: {
    overall: 0.6,
    momentum: 0.4,
    volatility: 0.3,
    sentiment: 0,
  },
  dataQuality: {
    minimumSources: 2,
  },
};

export interface AdaptiveRiskDecision {
  newPresetId: PresetId;
  reason: string;
  confidence: number;
  factors: {
    overall: number;
    volatility: number;
    sentiment: number;
    momentum: number;
  };
}

const PRESET_ORDER: PresetId[] = ["conservative", "balanced", "aggressive"];

function getPresetIndex(preset: PresetId): number {
  return PRESET_ORDER.indexOf(preset);
}

function stepPreset(current: PresetId, direction: "conservative" | "aggressive" | "toward", basePresetId?: PresetId): PresetId {
  const currentIdx = getPresetIndex(current);
  
  if (direction === "conservative") {
    const newIdx = Math.max(0, currentIdx - 1);
    return PRESET_ORDER[newIdx];
  }
  
  if (direction === "aggressive") {
    const newIdx = Math.min(PRESET_ORDER.length - 1, currentIdx + 1);
    return PRESET_ORDER[newIdx];
  }
  
  if (direction === "toward" && basePresetId) {
    const baseIdx = getPresetIndex(basePresetId);
    if (currentIdx === baseIdx) return current;
    const step = currentIdx > baseIdx ? -1 : 1;
    return PRESET_ORDER[currentIdx + step];
  }
  
  return current;
}

/**
 * Deterministic preset selector based on market intelligence.
 * 
 * Selection logic per GOVERNANCE Section 2.2:
 * 1. Shift toward conservative when stressed:
 *    If any: overall <= -0.2, volatility <= -0.4, sentiment <= -0.3
 *    Then step one level more conservative.
 * 
 * 2. Shift toward aggressive when strong & calm:
 *    If ALL: overall >= 0.6, momentum >= 0.4, volatility >= 0.3, sentiment >= 0
 *    Then step one level more aggressive.
 * 
 * 3. Otherwise: Move one step toward basePresetId.
 * 
 * @param intelligence - MarketIntelligenceScore from data fusion engine
 * @param basePresetId - The user's preferred base preset
 * @param currentPresetId - The current active preset
 * @returns PresetId - The new preset to use
 */
export function choosePresetFromMarket(
  intelligence: MarketIntelligenceScore,
  basePresetId: PresetId,
  currentPresetId: PresetId
): PresetId {
  const { overall, components } = intelligence;
  const { volatility, sentiment, momentum } = components;
  
  const isStressed = 
    overall <= ADAPTIVE_THRESHOLDS.conservative.overall ||
    volatility <= ADAPTIVE_THRESHOLDS.conservative.volatility ||
    sentiment <= ADAPTIVE_THRESHOLDS.conservative.sentiment;
  
  if (isStressed) {
    return stepPreset(currentPresetId, "conservative");
  }
  
  const isStrong = 
    overall >= ADAPTIVE_THRESHOLDS.aggressive.overall &&
    momentum >= ADAPTIVE_THRESHOLDS.aggressive.momentum &&
    volatility >= ADAPTIVE_THRESHOLDS.aggressive.volatility &&
    sentiment >= ADAPTIVE_THRESHOLDS.aggressive.sentiment;
  
  if (isStrong) {
    return stepPreset(currentPresetId, "aggressive");
  }
  
  return stepPreset(currentPresetId, "toward", basePresetId);
}

export interface UpdateResult {
  updated: boolean;
  previousPreset: PresetId | undefined;
  newPreset: PresetId;
  reason: string;
  config: MovingAverageCrossoverConfig;
}

function shouldRunAdaptiveUpdate(config: MovingAverageCrossoverConfig): boolean {
  if (config.lastAdaptiveUpdateAt === null || config.lastAdaptiveUpdateAt === undefined) return true;
  
  const intervalMs = (config.adaptiveRiskIntervalMinutes || 15) * 60 * 1000;
  const lastUpdate = new Date(config.lastAdaptiveUpdateAt).getTime();
  const now = Date.now();
  
  return (now - lastUpdate) >= intervalMs;
}

/**
 * Updates strategy risk profile if adaptive mode is enabled and market conditions warrant a change.
 * 
 * Per GOVERNANCE Section 2.3:
 * - If adaptiveRiskEnabled !== true → return unchanged.
 * - If lastAdaptiveUpdateAt is within adaptiveRiskIntervalMinutes → return unchanged.
 * - Fetch intelligence via Data Fusion Engine using existing connectors.
 * - If dataQuality === "poor" or activeSources < 2 → force preset = basePresetId.
 * - Compute newPresetId = choosePresetFromMarket(...).
 * - If preset changed, update config values from preset.
 * 
 * No DB writes inside this function.
 * 
 * @param config - Current strategy configuration
 * @returns UpdateResult indicating whether and how the config was updated
 */
export async function updateStrategyRiskIfNeeded(
  config: MovingAverageCrossoverConfig
): Promise<UpdateResult> {
  if (!config.adaptiveRiskEnabled) {
    return {
      updated: false,
      previousPreset: config.currentPresetId,
      newPreset: config.currentPresetId || "balanced",
      reason: "Adaptive risk mode disabled",
      config,
    };
  }

  if (!shouldRunAdaptiveUpdate(config)) {
    const currentPreset = config.currentPresetId || config.basePresetId || "balanced";
    return {
      updated: false,
      previousPreset: currentPreset,
      newPreset: currentPreset,
      reason: "Adaptive update interval not reached",
      config,
    };
  }

  const intelligence = await dataFusionEngine.getMarketIntelligence();
  
  const currentPreset = config.currentPresetId || config.basePresetId || "balanced";
  const basePreset = config.basePresetId || "balanced";
  
  const configWithTimestamp = {
    ...config,
    lastAdaptiveUpdateAt: new Date().toISOString(),
  };

  if (intelligence.dataQuality === "poor" || intelligence.activeSources < ADAPTIVE_THRESHOLDS.dataQuality.minimumSources) {
    if (currentPreset !== basePreset) {
      const reason = intelligence.dataQuality === "poor" 
        ? "Data quality is poor. Reverting to base preset."
        : `Only ${intelligence.activeSources} data sources active. Reverting to base preset.`;
      
      const updatedConfig = applyPresetToConfig(configWithTimestamp, basePreset, reason);
      
      log.info("AdaptiveRisk", `Preset change: ${currentPreset} -> ${basePreset}`, {
        symbol: config.symbol,
        reason,
        dataQuality: intelligence.dataQuality,
        activeSources: intelligence.activeSources,
      });
      
      return {
        updated: true,
        previousPreset: currentPreset,
        newPreset: basePreset,
        reason,
        config: updatedConfig,
      };
    }
    
    return {
      updated: true,
      previousPreset: currentPreset,
      newPreset: currentPreset,
      reason: "Insufficient data quality. Maintaining base preset.",
      config: configWithTimestamp,
    };
  }
  
  const newPreset = choosePresetFromMarket(intelligence, basePreset, currentPreset);

  if (newPreset === currentPreset) {
    return {
      updated: true,
      previousPreset: currentPreset,
      newPreset: currentPreset,
      reason: `Maintaining ${currentPreset} preset after evaluation`,
      config: configWithTimestamp,
    };
  }

  const reasons: string[] = [];
  if (newPreset === "conservative") {
    const { overall, components } = intelligence;
    if (overall <= ADAPTIVE_THRESHOLDS.conservative.overall) reasons.push(`overall=${overall.toFixed(2)}`);
    if (components.volatility <= ADAPTIVE_THRESHOLDS.conservative.volatility) reasons.push(`volatility=${components.volatility.toFixed(2)}`);
    if (components.sentiment <= ADAPTIVE_THRESHOLDS.conservative.sentiment) reasons.push(`sentiment=${components.sentiment.toFixed(2)}`);
  } else if (newPreset === "aggressive") {
    reasons.push("Strong market conditions");
  } else {
    reasons.push("Moving toward base preset");
  }
  
  const reason = `Market conditions: ${reasons.join(", ")}`;
  const updatedConfig = applyPresetToConfig(configWithTimestamp, newPreset, reason);

  log.info("AdaptiveRisk", `Preset change: ${currentPreset} -> ${newPreset}`, {
    symbol: config.symbol,
    reason,
    overall: intelligence.overall,
    components: intelligence.components,
  });

  return {
    updated: true,
    previousPreset: currentPreset,
    newPreset,
    reason,
    config: updatedConfig,
  };
}

/**
 * Gets human-readable description of current adaptive risk state
 */
export function getAdaptiveRiskStatus(config: MovingAverageCrossoverConfig): {
  enabled: boolean;
  mode: string;
  currentPreset: string;
  basePreset: string;
  lastUpdate: string | null;
} {
  if (!config.adaptiveRiskEnabled) {
    const preset = config.currentPresetId || config.basePresetId || "balanced";
    return {
      enabled: false,
      mode: "Fixed",
      currentPreset: preset.charAt(0).toUpperCase() + preset.slice(1),
      basePreset: preset.charAt(0).toUpperCase() + preset.slice(1),
      lastUpdate: null,
    };
  }

  const current = config.currentPresetId || config.basePresetId || "balanced";
  const base = config.basePresetId || "balanced";

  return {
    enabled: true,
    mode: "Adaptive",
    currentPreset: current.charAt(0).toUpperCase() + current.slice(1),
    basePreset: base.charAt(0).toUpperCase() + base.slice(1),
    lastUpdate: config.lastAdaptiveUpdateAt || null,
  };
}
