import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import {
  WizardProvider,
  StrategyTypeScreen,
  StrategyUnderstandingScreen,
  MarketSuitabilityScreen,
  AssetSelectionScreen,
  TriggerConditionsScreen,
  ConfigurationScreen,
  AdaptiveSettingsScreen,
  CapitalAllocationScreen,
  ExposureSettingsScreen,
  ControlLimitsScreen,
  BacktestScreen,
  ExecutionScreen,
  RiskDisclaimerScreen,
  ConfirmationScreen,
} from "@/screens/StrategyWizard";

export type StrategyWizardParamList = {
  StrategyType: undefined;
  StrategyUnderstanding: undefined;
  MarketSuitability: undefined;
  AssetSelection: undefined;
  TriggerConditions: undefined;
  Configuration: undefined;
  AdaptiveSettings: undefined;
  CapitalAllocation: undefined;
  ExposureSettings: undefined;
  ControlLimits: undefined;
  Backtest: undefined;
  Execution: undefined;
  RiskDisclaimer: undefined;
  Confirmation: undefined;
};

const Stack = createNativeStackNavigator<StrategyWizardParamList>();

function CancelButton() {
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <HeaderButton
      onPress={() => navigation.getParent()?.goBack()}
      pressColor={theme.backgroundSecondary}
      pressOpacity={0.65}
    >
      <Feather name="x" size={22} color={theme.text} />
    </HeaderButton>
  );
}

export default function StrategyWizardNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <WizardProvider>
      <Stack.Navigator
        screenOptions={{
          ...screenOptions,
          headerLeft: () => <CancelButton />,
        }}
      >
        <Stack.Screen
          name="StrategyType"
          component={StrategyTypeScreen}
          options={{ headerTitle: "New Strategy" }}
        />
        <Stack.Screen
          name="StrategyUnderstanding"
          component={StrategyUnderstandingScreen}
          options={{ headerTitle: "Understanding" }}
        />
        <Stack.Screen
          name="MarketSuitability"
          component={MarketSuitabilityScreen}
          options={{ headerTitle: "Market Fit" }}
        />
        <Stack.Screen
          name="AssetSelection"
          component={AssetSelectionScreen}
          options={{ headerTitle: "Select Assets" }}
        />
        <Stack.Screen
          name="TriggerConditions"
          component={TriggerConditionsScreen}
          options={{ headerTitle: "Triggers" }}
        />
        <Stack.Screen
          name="Configuration"
          component={ConfigurationScreen}
          options={{ headerTitle: "Configuration" }}
        />
        <Stack.Screen
          name="AdaptiveSettings"
          component={AdaptiveSettingsScreen}
          options={{ headerTitle: "AI Settings" }}
        />
        <Stack.Screen
          name="CapitalAllocation"
          component={CapitalAllocationScreen}
          options={{ headerTitle: "Capital" }}
        />
        <Stack.Screen
          name="ExposureSettings"
          component={ExposureSettingsScreen}
          options={{ headerTitle: "Exposure" }}
        />
        <Stack.Screen
          name="ControlLimits"
          component={ControlLimitsScreen}
          options={{ headerTitle: "Limits" }}
        />
        <Stack.Screen
          name="Backtest"
          component={BacktestScreen}
          options={{ headerTitle: "Backtest" }}
        />
        <Stack.Screen
          name="Execution"
          component={ExecutionScreen}
          options={{ headerTitle: "Execution" }}
        />
        <Stack.Screen
          name="RiskDisclaimer"
          component={RiskDisclaimerScreen}
          options={{ headerTitle: "Risk Disclaimer" }}
        />
        <Stack.Screen
          name="Confirmation"
          component={ConfirmationScreen}
          options={{ headerTitle: "Confirm" }}
        />
      </Stack.Navigator>
    </WizardProvider>
  );
}
