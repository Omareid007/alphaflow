import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AutoScreen from "@/screens/AutoScreen";
import TickerDetailScreen from "@/screens/TickerDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type AutoStackParamList = {
  AutoMain: undefined;
  TickerDetail: { symbol: string; assetType?: "stock" | "crypto" | "etf" };
};

const Stack = createNativeStackNavigator<AutoStackParamList>();

export default function AutoStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="AutoMain"
        component={AutoScreen}
        options={{
          headerTitle: "Auto Trading",
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
