import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AdminHubScreen from "@/screens/AdminHubScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type AdminStackParamList = {
  AdminHub: undefined;
};

const Stack = createNativeStackNavigator<AdminStackParamList>();

export default function AdminStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="AdminHub"
        component={AdminHubScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
