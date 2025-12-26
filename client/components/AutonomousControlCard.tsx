import { View, StyleSheet, ActivityIndicator, Pressable, Switch, Alert, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { apiRequest } from "@/lib/query-client";

function showConfirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: onConfirm },
    ]);
  }
}

interface AutonomousState {
  isRunning: boolean;
  mode: "autonomous" | "semi-auto" | "manual";
  lastAnalysisTime: string | null;
  lastPositionCheckTime: string | null;
  dailyPnl: number;
  dailyTradeCount: number;
  errors: string[];
  riskLimits: {
    maxPositionSizePercent: number;
    maxTotalExposurePercent: number;
    maxPositionsCount: number;
    dailyLossLimitPercent: number;
    killSwitchActive: boolean;
  };
  activePositions: Array<{
    symbol: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
  }>;
  executionHistory: Array<{
    success: boolean;
    action: string;
    symbol: string;
    reason: string;
  }>;
}

export function AutonomousControlCard() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [showRiskSettings, setShowRiskSettings] = useState(false);

  const { data: state, isLoading, error } = useQuery<AutonomousState>({
    queryKey: ["/api/autonomous/state"],
    refetchInterval: 5000,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/autonomous/start");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous/state"] });
    },
    onError: (err) => {
      Alert.alert("Error", String(err));
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/autonomous/stop");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous/state"] });
    },
  });

  const killSwitchMutation = useMutation({
    mutationFn: async (activate: boolean) => {
      const response = await apiRequest("POST", "/api/autonomous/kill-switch", {
        activate,
        reason: activate ? "Manual kill switch activation" : undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous/state"] });
    },
  });

  const handleToggleAutonomous = () => {
    if (state?.isRunning) {
      showConfirm(
        "Stop Autonomous Trading",
        "Are you sure you want to stop the autonomous trading agent?",
        () => stopMutation.mutate()
      );
    } else {
      showConfirm(
        "Start Autonomous Trading",
        "This will enable fully autonomous trading. The AI will analyze markets and execute trades automatically based on your risk settings.\n\nAre you sure?",
        () => startMutation.mutate()
      );
    }
  };

  const handleKillSwitch = () => {
    const isActive = state?.riskLimits?.killSwitchActive;
    if (!isActive) {
      showConfirm(
        "EMERGENCY KILL SWITCH",
        "This will immediately stop all autonomous trading and prevent any new trades.\n\nActivate kill switch?",
        () => killSwitchMutation.mutate(true)
      );
    } else {
      killSwitchMutation.mutate(false);
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "autonomous":
        return BrandColors.success;
      case "semi-auto":
        return BrandColors.warning;
      default:
        return BrandColors.neutral;
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  if (isLoading) {
    return (
      <Card elevation={2} style={styles.card}>
        <View style={styles.cardHeader}>
          <Feather name="cpu" size={20} color={BrandColors.aiLayer} />
          <ThemedText style={styles.cardTitle}>Autonomous Trading</ThemedText>
        </View>
        <ActivityIndicator size="small" color={BrandColors.aiLayer} />
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation={2} style={styles.card}>
        <View style={styles.cardHeader}>
          <Feather name="cpu" size={20} color={BrandColors.aiLayer} />
          <ThemedText style={styles.cardTitle}>Autonomous Trading</ThemedText>
        </View>
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={20} color={BrandColors.error} />
          <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
            Failed to load autonomous state
          </ThemedText>
        </View>
      </Card>
    );
  }

  const isRunning = state?.isRunning ?? false;
  const killSwitchActive = state?.riskLimits?.killSwitchActive ?? false;
  const mode = state?.mode ?? "manual";

  return (
    <Card elevation={2} style={styles.card}>
      <View style={styles.cardHeader}>
        <Feather name="cpu" size={20} color={BrandColors.aiLayer} />
        <ThemedText style={styles.cardTitle}>Autonomous Trading</ThemedText>
        <View style={[styles.modeBadge, { backgroundColor: getModeColor(mode) }]}>
          <ThemedText style={styles.modeText}>{mode.toUpperCase()}</ThemedText>
        </View>
      </View>

      {killSwitchActive ? (
        <View style={styles.killSwitchBanner}>
          <Feather name="alert-octagon" size={24} color="#FFFFFF" />
          <ThemedText style={styles.killSwitchText}>KILL SWITCH ACTIVE</ThemedText>
          <Pressable 
            style={styles.deactivateButton} 
            onPress={handleKillSwitch}
          >
            <ThemedText style={styles.deactivateButtonText}>Deactivate</ThemedText>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.controlRow}>
        <View style={styles.controlInfo}>
          <ThemedText style={styles.controlLabel}>AI Autonomous Mode</ThemedText>
          <ThemedText style={[styles.controlDescription, { color: theme.textSecondary }]}>
            {isRunning 
              ? "AI is actively analyzing and trading" 
              : "AI trading is paused"}
          </ThemedText>
        </View>
        <Switch
          value={isRunning}
          onValueChange={handleToggleAutonomous}
          trackColor={{ false: BrandColors.cardBorder, true: BrandColors.success }}
          thumbColor={isRunning ? "#FFFFFF" : theme.textSecondary}
          disabled={killSwitchActive || startMutation.isPending || stopMutation.isPending}
        />
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Positions</ThemedText>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>
            {state?.activePositions?.length ?? 0}
          </ThemedText>
        </View>
        <View style={styles.statBox}>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Daily Trades</ThemedText>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>
            {state?.dailyTradeCount ?? 0}
          </ThemedText>
        </View>
        <View style={styles.statBox}>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Daily P&L</ThemedText>
          <ThemedText style={[
            styles.statValue, 
            { 
              fontFamily: Fonts?.mono,
              color: (state?.dailyPnl ?? 0) >= 0 ? BrandColors.success : BrandColors.error 
            }
          ]}>
            ${(state?.dailyPnl ?? 0).toFixed(2)}
          </ThemedText>
        </View>
        <View style={styles.statBox}>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Last Analysis</ThemedText>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono, fontSize: 12 }]}>
            {formatTime(state?.lastAnalysisTime ?? null)}
          </ThemedText>
        </View>
      </View>

      <Pressable 
        style={styles.riskSettingsToggle}
        onPress={() => setShowRiskSettings(!showRiskSettings)}
      >
        <Feather name="shield" size={16} color={BrandColors.primaryLight} />
        <ThemedText style={[styles.riskSettingsLabel, { color: BrandColors.primaryLight }]}>
          Risk Controls
        </ThemedText>
        <Feather 
          name={showRiskSettings ? "chevron-up" : "chevron-down"} 
          size={16} 
          color={BrandColors.primaryLight} 
        />
      </Pressable>

      {showRiskSettings ? (
        <View style={styles.riskSettings}>
          <View style={styles.riskRow}>
            <ThemedText style={[styles.riskLabel, { color: theme.textSecondary }]}>
              Max Position Size
            </ThemedText>
            <ThemedText style={[styles.riskValue, { fontFamily: Fonts?.mono }]}>
              {state?.riskLimits?.maxPositionSizePercent ?? 10}%
            </ThemedText>
          </View>
          <View style={styles.riskRow}>
            <ThemedText style={[styles.riskLabel, { color: theme.textSecondary }]}>
              Max Total Exposure
            </ThemedText>
            <ThemedText style={[styles.riskValue, { fontFamily: Fonts?.mono }]}>
              {state?.riskLimits?.maxTotalExposurePercent ?? 50}%
            </ThemedText>
          </View>
          <View style={styles.riskRow}>
            <ThemedText style={[styles.riskLabel, { color: theme.textSecondary }]}>
              Max Positions
            </ThemedText>
            <ThemedText style={[styles.riskValue, { fontFamily: Fonts?.mono }]}>
              {state?.riskLimits?.maxPositionsCount ?? 10}
            </ThemedText>
          </View>
          <View style={styles.riskRow}>
            <ThemedText style={[styles.riskLabel, { color: theme.textSecondary }]}>
              Daily Loss Limit
            </ThemedText>
            <ThemedText style={[styles.riskValue, { fontFamily: Fonts?.mono }]}>
              {state?.riskLimits?.dailyLossLimitPercent ?? 5}%
            </ThemedText>
          </View>
        </View>
      ) : null}

      {!killSwitchActive ? (
        <Pressable 
          style={styles.killSwitchButton}
          onPress={handleKillSwitch}
        >
          <Feather name="alert-octagon" size={16} color={BrandColors.error} />
          <ThemedText style={[styles.killSwitchButtonText, { color: BrandColors.error }]}>
            Emergency Kill Switch
          </ThemedText>
        </Pressable>
      ) : null}

      {state?.errors && state.errors.length > 0 ? (
        <View style={styles.errorsContainer}>
          <ThemedText style={[styles.errorsTitle, { color: BrandColors.error }]}>
            Recent Errors
          </ThemedText>
          {state.errors.slice(-3).map((err, i) => (
            <ThemedText key={i} style={[styles.errorItem, { color: theme.textSecondary }]}>
              {err}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: 600,
    flex: 1,
  },
  modeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  modeText: {
    fontSize: 10,
    fontWeight: 700,
    color: "#FFFFFF",
  },
  killSwitchBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: BrandColors.error,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  killSwitchText: {
    flex: 1,
    color: "#FFFFFF",
    fontWeight: 700,
    fontSize: Typography.body.fontSize,
  },
  deactivateButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  deactivateButtonText: {
    color: "#FFFFFF",
    fontWeight: 600,
    fontSize: Typography.small.fontSize,
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.cardBorder,
  },
  controlInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  controlLabel: {
    fontSize: Typography.body.fontSize,
    fontWeight: 500,
  },
  controlDescription: {
    fontSize: Typography.small.fontSize,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  statBox: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: Typography.body.fontSize,
    fontWeight: 600,
    marginTop: 2,
  },
  riskSettingsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  riskSettingsLabel: {
    flex: 1,
    fontSize: Typography.small.fontSize,
    fontWeight: 500,
  },
  riskSettings: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  riskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  riskLabel: {
    fontSize: Typography.small.fontSize,
  },
  riskValue: {
    fontSize: Typography.small.fontSize,
    fontWeight: 600,
  },
  killSwitchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: BrandColors.error,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  killSwitchButtonText: {
    fontSize: Typography.small.fontSize,
    fontWeight: 600,
  },
  errorsContainer: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: BorderRadius.sm,
  },
  errorsTitle: {
    fontSize: Typography.small.fontSize,
    fontWeight: 600,
    marginBottom: Spacing.xs,
  },
  errorItem: {
    fontSize: 11,
    marginBottom: 2,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  errorText: {
    fontSize: Typography.small.fontSize,
  },
});
