import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardStackNavigator from "@/navigation/DashboardStackNavigator";
import AnalyticsStackNavigator from "@/navigation/AnalyticsStackNavigator";
import StrategiesStackNavigator from "@/navigation/StrategiesStackNavigator";
import AdminStackNavigator from "@/navigation/AdminStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { apiRequest } from "@/lib/query-client";
import type { AgentStatus } from "@shared/schema";

export type MainTabParamList = {
  DashboardTab: undefined;
  AnalyticsTab: undefined;
  StrategiesTab: undefined;
  AdminTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabContent() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="DashboardTab"
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStackNavigator}
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AnalyticsTab"
        component={AnalyticsStackNavigator}
        options={{
          title: "Analytics",
          tabBarIcon: ({ color, size }) => (
            <Feather name="bar-chart-2" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="StrategiesTab"
        component={StrategiesStackNavigator}
        options={{
          title: "Strategies",
          tabBarIcon: ({ color, size }) => (
            <Feather name="layers" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AdminTab"
        component={AdminStackNavigator}
        options={{
          title: "Admin",
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function MainTabNavigator() {
  const queryClient = useQueryClient();

  const { data: agentStatus, isError } = useQuery<AgentStatus>({
    queryKey: ["/api/agent/status"],
    refetchInterval: 5000,
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/agent/toggle");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/status"] });
    },
  });

  const isRunning = agentStatus?.isRunning ?? false;
  const hasError = isError || toggleMutation.isError;

  const handleToggleAgent = () => {
    toggleMutation.mutate();
  };

  return (
    <View style={styles.container}>
      <MainTabContent />
      <FloatingActionButton
        isRunning={isRunning}
        hasError={hasError}
        onPress={handleToggleAgent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
