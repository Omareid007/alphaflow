import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AnalyticsScreen from "@/screens/AnalyticsScreen";
import BacktestsScreen from "@/screens/BacktestsScreen";
import BacktestDetailScreen from "@/screens/BacktestDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type AnalyticsStackParamList = {
  Analytics: undefined;
  Backtests: undefined;
  BacktestDetail: { id: string };
};

const Stack = createNativeStackNavigator<AnalyticsStackParamList>();

export default function AnalyticsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          headerTitle: "Analytics",
        }}
      />
      <Stack.Screen
        name="Backtests"
        component={BacktestsScreen}
        options={{
          headerTitle: "Backtests",
        }}
      />
      <Stack.Screen
        name="BacktestDetail"
        component={BacktestDetailScreen}
        options={{
          headerTitle: "Backtest Details",
        }}
      />
    </Stack.Navigator>
  );
}
