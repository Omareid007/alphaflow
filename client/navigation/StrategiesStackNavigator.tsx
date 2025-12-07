import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import StrategiesScreen from "@/screens/StrategiesScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type StrategiesStackParamList = {
  Strategies: undefined;
};

const Stack = createNativeStackNavigator<StrategiesStackParamList>();

export default function StrategiesStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Strategies"
        component={StrategiesScreen}
        options={{
          headerTitle: "Strategies",
        }}
      />
    </Stack.Navigator>
  );
}
