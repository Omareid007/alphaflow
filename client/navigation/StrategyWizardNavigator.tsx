import React from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import {
  WizardProvider,
  StrategyTypeScreen,
  AssetSelectionScreen,
  ConfigurationScreen,
  RiskDisclaimerScreen,
  ConfirmationScreen,
} from "@/screens/StrategyWizard";

export type StrategyWizardParamList = {
  StrategyType: undefined;
  AssetSelection: undefined;
  Configuration: undefined;
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
          options={{
            headerTitle: "New Strategy",
          }}
        />
        <Stack.Screen
          name="AssetSelection"
          component={AssetSelectionScreen}
          options={{
            headerTitle: "Select Assets",
          }}
        />
        <Stack.Screen
          name="Configuration"
          component={ConfigurationScreen}
          options={{
            headerTitle: "Configuration",
          }}
        />
        <Stack.Screen
          name="RiskDisclaimer"
          component={RiskDisclaimerScreen}
          options={{
            headerTitle: "Risk Disclaimer",
          }}
        />
        <Stack.Screen
          name="Confirmation"
          component={ConfirmationScreen}
          options={{
            headerTitle: "Confirm",
          }}
        />
      </Stack.Navigator>
    </WizardProvider>
  );
}
