import React, { useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, Modal, Pressable } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { BrandColors, BorderRadius, Spacing, Typography } from "@/constants/theme";
import DashboardStackNavigator from "@/navigation/DashboardStackNavigator";
import AnalyticsStackNavigator from "@/navigation/AnalyticsStackNavigator";
import StrategiesStackNavigator from "@/navigation/StrategiesStackNavigator";
import AutoStackNavigator from "@/navigation/AutoStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { apiRequest } from "@/lib/query-client";
import type { AgentStatus } from "@shared/schema";

export type MainTabParamList = {
  DashboardTab: undefined;
  AnalyticsTab: undefined;
  StrategiesTab: undefined;
  AutoTab: undefined;
  ProfileTab: undefined;
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
        name="AutoTab"
        component={AutoStackNavigator}
        options={{
          title: "Auto",
          tabBarIcon: ({ color, size }) => (
            <Feather name="cpu" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function MainTabNavigator() {
  const queryClient = useQueryClient();
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);
  const { theme } = useTheme();

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
    if (isRunning) {
      setShowStopConfirmation(true);
    } else {
      toggleMutation.mutate();
    }
  };

  const handleConfirmStop = () => {
    setShowStopConfirmation(false);
    toggleMutation.mutate();
  };

  const handleCancelStop = () => {
    setShowStopConfirmation(false);
  };

  return (
    <View style={styles.container}>
      <MainTabContent />
      <FloatingActionButton
        isRunning={isRunning}
        hasError={hasError}
        onPress={handleToggleAgent}
      />
      <Modal
        visible={showStopConfirmation}
        transparent
        animationType="fade"
        onRequestClose={handleCancelStop}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalIconContainer}>
              <Feather name="alert-triangle" size={40} color={BrandColors.warning} />
            </View>
            <ThemedText style={styles.modalTitle}>Stop Trading Agent?</ThemedText>
            <ThemedText style={[styles.modalMessage, { color: theme.textSecondary }]}>
              You are about to stop the trading agent. This will pause all automated trading.
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton, { borderColor: theme.textSecondary }]}
                onPress={handleCancelStop}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmStop}
              >
                <ThemedText style={styles.confirmButtonText}>Stop Agent</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  modalIconContainer: {
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  modalMessage: {
    fontSize: Typography.body.fontSize,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {
    backgroundColor: BrandColors.error,
  },
  cancelButtonText: {
    fontSize: Typography.body.fontSize,
    fontWeight: "500",
  },
  confirmButtonText: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
