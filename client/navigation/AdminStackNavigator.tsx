import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AdminScreen from "@/screens/AdminScreen";
import ApiBudgetScreen from "@/screens/ApiBudgetScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type AdminStackParamList = {
  Admin: undefined;
  ApiBudget: undefined;
};

const Stack = createNativeStackNavigator<AdminStackParamList>();

export default function AdminStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Admin"
        component={AdminScreen}
        options={{
          headerTitle: "Admin",
        }}
      />
      <Stack.Screen
        name="ApiBudget"
        component={ApiBudgetScreen}
        options={{
          headerTitle: "API Budgets",
        }}
      />
    </Stack.Navigator>
  );
}
