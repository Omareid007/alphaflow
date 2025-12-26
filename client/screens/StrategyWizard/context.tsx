import React, { createContext, useContext, useState, ReactNode } from "react";

export interface RangeParameters {
  supportLevel: string;
  resistanceLevel: string;
  positionSize: string;
  stopLossPercent: string;
  takeProfitPercent: string;
  maxPositions: string;
}

export interface MovingAverageParameters {
  fastPeriod: number;
  slowPeriod: number;
  allocationPct: number;
  riskLimitPct: number;
  presetId?: string;
  adaptiveRiskEnabled?: boolean;
  basePresetId?: "conservative" | "balanced" | "aggressive";
  adaptiveRiskIntervalMinutes?: number;
}

export interface AdaptiveSettings {
  useMarketSentiment: boolean;
  useNewsAnalysis: boolean;
  useTechnicalIndicators: boolean;
  volatilityAdjustment: boolean;
}

export interface CapitalAllocation {
  totalCapital: string;
  maxAllocationPercent: string;
  reservePercent: string;
}

export interface ExposureSettings {
  maxPositionSize: string;
  maxPositionPercent: string;
  pyramidingEnabled: boolean;
  maxPyramidLevels: string;
}

export interface ControlLimits {
  maxDailyLoss: string;
  maxDailyTrades: string;
  maxDrawdown: string;
  cooldownPeriod: string;
  tradingHoursOnly: boolean;
}

export interface BacktestResults {
  hasRun: boolean;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  annualReturn?: number;
  sortinoRatio?: number;
  avgWin?: number;
  avgLoss?: number;
  profitFactor?: number;
}

export interface AIValidationResult {
  summary: string;
  riskAssessment: string;
  parameterFeedback: string[];
  suitability: "retail_friendly" | "borderline" | "advanced_only";
  confidence: number;
}

export interface WizardData {
  strategyType: string;
  strategyName: string;
  description: string;
  assets: string[];
  parameters: RangeParameters;
  movingAverageParams?: MovingAverageParameters;
  adaptiveSettings: AdaptiveSettings;
  capitalAllocation: CapitalAllocation;
  exposureSettings: ExposureSettings;
  controlLimits: ControlLimits;
  backtestResults: BacktestResults;
  aiValidation?: AIValidationResult;
  riskAcknowledged: boolean;
  strategyUnderstandingConfirmed: boolean;
  marketSuitabilityConfirmed: boolean;
  executionMode: "virtual" | "real";
  triggerConditions: string[];
}

const defaultWizardData: WizardData = {
  strategyType: "moving-average-crossover",
  strategyName: "My SMA Crossover Strategy",
  description: "Automated trading strategy using Simple Moving Average crossover signals. Buys when the fast SMA crosses above the slow SMA, and sells when it crosses below.",
  assets: ["SPY"],
  parameters: {
    supportLevel: "420",
    resistanceLevel: "480",
    positionSize: "100",
    stopLossPercent: "2",
    takeProfitPercent: "3",
    maxPositions: "3",
  },
  movingAverageParams: {
    fastPeriod: 7,
    slowPeriod: 20,
    allocationPct: 0.10,
    riskLimitPct: 0.10,
    presetId: "balanced",
    adaptiveRiskEnabled: false,
    basePresetId: "balanced",
  },
  adaptiveSettings: {
    useMarketSentiment: true,
    useNewsAnalysis: true,
    useTechnicalIndicators: true,
    volatilityAdjustment: false,
  },
  capitalAllocation: {
    totalCapital: "10000",
    maxAllocationPercent: "50",
    reservePercent: "20",
  },
  exposureSettings: {
    maxPositionSize: "500",
    maxPositionPercent: "10",
    pyramidingEnabled: false,
    maxPyramidLevels: "3",
  },
  controlLimits: {
    maxDailyLoss: "500",
    maxDailyTrades: "10",
    maxDrawdown: "15",
    cooldownPeriod: "5",
    tradingHoursOnly: true,
  },
  backtestResults: {
    hasRun: false,
    winRate: 0,
    totalReturn: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    totalTrades: 0,
  },
  riskAcknowledged: false,
  strategyUnderstandingConfirmed: false,
  marketSuitabilityConfirmed: false,
  executionMode: "virtual",
  triggerConditions: [],
};

interface WizardContextType {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  updateParameters: (updates: Partial<RangeParameters>) => void;
  updateAdaptiveSettings: (updates: Partial<AdaptiveSettings>) => void;
  updateCapitalAllocation: (updates: Partial<CapitalAllocation>) => void;
  updateExposureSettings: (updates: Partial<ExposureSettings>) => void;
  updateControlLimits: (updates: Partial<ControlLimits>) => void;
  updateBacktestResults: (updates: Partial<BacktestResults>) => void;
  resetWizard: () => void;
  currentStep: number;
  totalSteps: number;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WizardData>(defaultWizardData);

  const updateData = (updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const updateParameters = (updates: Partial<RangeParameters>) => {
    setData((prev) => ({
      ...prev,
      parameters: { ...prev.parameters, ...updates },
    }));
  };

  const updateAdaptiveSettings = (updates: Partial<AdaptiveSettings>) => {
    setData((prev) => ({
      ...prev,
      adaptiveSettings: { ...prev.adaptiveSettings, ...updates },
    }));
  };

  const updateCapitalAllocation = (updates: Partial<CapitalAllocation>) => {
    setData((prev) => ({
      ...prev,
      capitalAllocation: { ...prev.capitalAllocation, ...updates },
    }));
  };

  const updateExposureSettings = (updates: Partial<ExposureSettings>) => {
    setData((prev) => ({
      ...prev,
      exposureSettings: { ...prev.exposureSettings, ...updates },
    }));
  };

  const updateControlLimits = (updates: Partial<ControlLimits>) => {
    setData((prev) => ({
      ...prev,
      controlLimits: { ...prev.controlLimits, ...updates },
    }));
  };

  const updateBacktestResults = (updates: Partial<BacktestResults>) => {
    setData((prev) => ({
      ...prev,
      backtestResults: { ...prev.backtestResults, ...updates },
    }));
  };

  const resetWizard = () => {
    setData(defaultWizardData);
  };

  return (
    <WizardContext.Provider
      value={{
        data,
        updateData,
        updateParameters,
        updateAdaptiveSettings,
        updateCapitalAllocation,
        updateExposureSettings,
        updateControlLimits,
        updateBacktestResults,
        resetWizard,
        currentStep: 0,
        totalSteps: 11,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizard must be used within a WizardProvider");
  }
  return context;
}
