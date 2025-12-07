import React, { createContext, useContext, useState, ReactNode } from "react";

export interface RangeParameters {
  supportLevel: string;
  resistanceLevel: string;
  positionSize: string;
  stopLossPercent: string;
  takeProfitPercent: string;
  maxPositions: string;
}

export interface WizardData {
  strategyType: string;
  strategyName: string;
  description: string;
  assets: string[];
  parameters: RangeParameters;
  riskAcknowledged: boolean;
}

const defaultWizardData: WizardData = {
  strategyType: "",
  strategyName: "",
  description: "",
  assets: [],
  parameters: {
    supportLevel: "",
    resistanceLevel: "",
    positionSize: "100",
    stopLossPercent: "2",
    takeProfitPercent: "3",
    maxPositions: "3",
  },
  riskAcknowledged: false,
};

interface WizardContextType {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  updateParameters: (updates: Partial<RangeParameters>) => void;
  resetWizard: () => void;
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

  const resetWizard = () => {
    setData(defaultWizardData);
  };

  return (
    <WizardContext.Provider value={{ data, updateData, updateParameters, resetWizard }}>
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

export { default as StrategyTypeScreen } from "./StrategyTypeScreen";
export { default as AssetSelectionScreen } from "./AssetSelectionScreen";
export { default as ConfigurationScreen } from "./ConfigurationScreen";
export { default as RiskDisclaimerScreen } from "./RiskDisclaimerScreen";
export { default as ConfirmationScreen } from "./ConfirmationScreen";
