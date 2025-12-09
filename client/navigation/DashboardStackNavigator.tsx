import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DashboardScreen from "@/screens/DashboardScreen";
import AISuggestedTradesScreen from "@/screens/AISuggestedTradesScreen";
import TickerDetailScreen from "@/screens/TickerDetailScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type DashboardStackParamList = {
  Dashboard: undefined;
  AISuggestedTrades: undefined;
  TickerDetail: { symbol: string; assetType: "crypto" | "stock" };
};

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export default function DashboardStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerTitle: () => <HeaderTitle title="AI Active Trader" />,
        }}
      />
      <Stack.Screen
        name="AISuggestedTrades"
        component={AISuggestedTradesScreen}
        options={{
          headerTitle: "AI Suggested Trades",
        }}
      />
      <Stack.Screen
        name="TickerDetail"
        component={TickerDetailScreen}
        options={({ route }) => ({
          headerTitle: route.params.symbol,
        })}
      />
    </Stack.Navigator>
  );
}
