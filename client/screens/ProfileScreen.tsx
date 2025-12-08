import { View, StyleSheet, Pressable, ActivityIndicator, Switch, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useState } from "react";
import { apiRequest } from "@/lib/query-client";

interface ConnectorStatus {
  provider?: string;
  connected?: boolean;
  available?: boolean;
  model?: string;
  lastChecked?: string;
  hasApiKey?: boolean;
  cacheSize?: number;
}

interface ConnectorsStatus {
  crypto: ConnectorStatus;
  stock: ConnectorStatus;
  ai: ConnectorStatus;
  fusion: ConnectorStatus;
}

interface RiskSettings {
  killSwitchActive: boolean;
  maxPositionSizePercent: string;
  maxTotalExposurePercent: string;
  maxPositionsCount: number;
  dailyLossLimitPercent: string;
}

function ConnectorHealthCard({ 
  connectors, 
  isLoading, 
  onRefresh 
}: { 
  connectors: ConnectorsStatus | undefined;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const { theme } = useTheme();

  const isConnected = (status: ConnectorStatus | undefined): boolean => {
    if (!status) return false;
    if (typeof status.connected === 'boolean') return status.connected;
    if (typeof status.available === 'boolean') return status.available;
    return false;
  };

  const getStatusColor = (status: ConnectorStatus | undefined): string => {
    if (!status) return BrandColors.neutral;
    return isConnected(status) ? BrandColors.success : BrandColors.error;
  };

  const getStatusIcon = (status: ConnectorStatus | undefined): "check-circle" | "x-circle" | "loader" => {
    if (!status) return "loader";
    return isConnected(status) ? "check-circle" : "x-circle";
  };

  const getStatusLabel = (status: ConnectorStatus | undefined): string => {
    if (!status) return "Unknown";
    return isConnected(status) ? "Connected" : "Disconnected";
  };

  const formatTime = (isoString: string | undefined): string => {
    if (!isoString) return "Never";
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const connectorItems = [
    {
      key: "crypto",
      name: connectors?.crypto?.provider || "Crypto Data",
      icon: "trending-up" as const,
      status: connectors?.crypto,
      color: BrandColors.cryptoLayer,
    },
    {
      key: "stock",
      name: connectors?.stock?.provider || "Stock Data",
      icon: "bar-chart-2" as const,
      status: connectors?.stock,
      color: BrandColors.stockLayer,
    },
    {
      key: "ai",
      name: connectors?.ai?.model || "AI Engine",
      icon: "cpu" as const,
      status: connectors?.ai,
      color: BrandColors.aiLayer,
    },
    {
      key: "fusion",
      name: "Data Fusion",
      icon: "git-merge" as const,
      status: connectors?.fusion,
      color: BrandColors.primaryLight,
    },
  ];

  return (
    <Card elevation={1} style={styles.settingsCard}>
      <View style={styles.settingsHeader}>
        <Feather name="activity" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.settingsTitle}>Connector Health</ThemedText>
        <Pressable 
          onPress={onRefresh} 
          disabled={isLoading}
          style={styles.refreshButton}
        >
          <Feather 
            name="refresh-cw" 
            size={18} 
            color={isLoading ? theme.textSecondary : BrandColors.primaryLight} 
          />
        </Pressable>
      </View>

      {isLoading && !connectors ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={BrandColors.primaryLight} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Checking connectors...
          </ThemedText>
        </View>
      ) : (
        connectorItems.map((item, index) => (
          <View 
            key={item.key}
            style={[
              styles.connectorItem, 
              { borderBottomColor: theme.textSecondary + "20" },
              index === connectorItems.length - 1 && { borderBottomWidth: 0 }
            ]}
          >
            <View style={[styles.connectorIcon, { backgroundColor: item.color + "15" }]}>
              <Feather name={item.icon} size={18} color={item.color} />
            </View>
            <View style={styles.connectorInfo}>
              <ThemedText style={styles.connectorName}>{item.name}</ThemedText>
              <ThemedText style={[styles.connectorTime, { color: theme.textSecondary }]}>
                Last checked: {formatTime(item.status?.lastChecked)}
              </ThemedText>
            </View>
            <View style={styles.statusBadge}>
              <Feather 
                name={getStatusIcon(item.status)} 
                size={16} 
                color={getStatusColor(item.status)} 
              />
              <ThemedText 
                style={[
                  styles.statusText, 
                  { color: getStatusColor(item.status) }
                ]}
              >
                {getStatusLabel(item.status)}
              </ThemedText>
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

function RiskManagementCard({
  settings,
  isLoading,
  onToggleKillSwitch,
  onCloseAllPositions,
  isTogglingKillSwitch,
  isClosingPositions,
}: {
  settings: RiskSettings | undefined;
  isLoading: boolean;
  onToggleKillSwitch: (activate: boolean) => void;
  onCloseAllPositions: () => void;
  isTogglingKillSwitch: boolean;
  isClosingPositions: boolean;
}) {
  const { theme } = useTheme();
  const killSwitchActive = settings?.killSwitchActive ?? false;

  const riskItems = [
    {
      label: "Max Position Size",
      value: `${settings?.maxPositionSizePercent ?? "10"}%`,
      icon: "percent" as const,
    },
    {
      label: "Max Portfolio Exposure",
      value: `${settings?.maxTotalExposurePercent ?? "50"}%`,
      icon: "pie-chart" as const,
    },
    {
      label: "Max Open Positions",
      value: `${settings?.maxPositionsCount ?? 10}`,
      icon: "layers" as const,
    },
    {
      label: "Daily Loss Limit",
      value: `${settings?.dailyLossLimitPercent ?? "5"}%`,
      icon: "trending-down" as const,
    },
  ];

  return (
    <Card elevation={1} style={styles.settingsCard}>
      <View style={styles.settingsHeader}>
        <Feather name="shield" size={20} color={BrandColors.error} />
        <ThemedText style={styles.settingsTitle}>Risk Management</ThemedText>
      </View>

      <View style={[styles.killSwitchContainer, { 
        backgroundColor: killSwitchActive ? BrandColors.error + "15" : theme.backgroundRoot,
        borderColor: killSwitchActive ? BrandColors.error : theme.textSecondary + "30",
      }]}>
        <View style={styles.killSwitchInfo}>
          <Feather 
            name="power" 
            size={24} 
            color={killSwitchActive ? BrandColors.error : BrandColors.success} 
          />
          <View style={styles.killSwitchText}>
            <ThemedText style={[styles.killSwitchLabel, { 
              color: killSwitchActive ? BrandColors.error : theme.text 
            }]}>
              Kill Switch
            </ThemedText>
            <ThemedText style={[styles.killSwitchStatus, { color: theme.textSecondary }]}>
              {killSwitchActive ? "Trading halted" : "Trading enabled"}
            </ThemedText>
          </View>
        </View>
        <Switch
          value={killSwitchActive}
          onValueChange={onToggleKillSwitch}
          disabled={isTogglingKillSwitch}
          trackColor={{ false: theme.textSecondary + "40", true: BrandColors.error + "60" }}
          thumbColor={killSwitchActive ? BrandColors.error : BrandColors.success}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={BrandColors.primaryLight} />
        </View>
      ) : (
        riskItems.map((item, index) => (
          <View
            key={item.label}
            style={[
              styles.riskItem,
              { borderBottomColor: theme.textSecondary + "20" },
              index === riskItems.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            <View style={[styles.riskIcon, { backgroundColor: BrandColors.warning + "15" }]}>
              <Feather name={item.icon} size={16} color={BrandColors.warning} />
            </View>
            <ThemedText style={styles.riskLabel}>{item.label}</ThemedText>
            <ThemedText style={[styles.riskValue, { color: theme.textSecondary }]}>
              {item.value}
            </ThemedText>
          </View>
        ))
      )}

      <Pressable
        style={[styles.closeAllButton, { 
          backgroundColor: BrandColors.error + "15",
          opacity: isClosingPositions ? 0.6 : 1,
        }]}
        onPress={onCloseAllPositions}
        disabled={isClosingPositions}
      >
        {isClosingPositions ? (
          <ActivityIndicator size="small" color={BrandColors.error} />
        ) : (
          <>
            <Feather name="x-circle" size={18} color={BrandColors.error} />
            <ThemedText style={[styles.closeAllText, { color: BrandColors.error }]}>
              Close All Positions
            </ThemedText>
          </>
        )}
      </Pressable>
    </Card>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const queryClient = useQueryClient();

  const { data: connectorsStatus, isLoading: isLoadingConnectors, refetch: refetchConnectors } = useQuery<ConnectorsStatus>({
    queryKey: ["/api/connectors/status"],
    refetchInterval: 30000,
  });

  const { data: riskSettings, isLoading: isLoadingRisk } = useQuery<RiskSettings>({
    queryKey: ["/api/risk/settings"],
    refetchInterval: 10000,
  });

  const killSwitchMutation = useMutation({
    mutationFn: async (activate: boolean) => {
      const response = await apiRequest("POST", "/api/risk/kill-switch", { activate });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/status"] });
    },
  });

  const closeAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/risk/close-all", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/portfolio"] });
      Alert.alert(
        "Positions Closed",
        `Closed ${data.closedCount} position(s) with total P&L: $${data.totalPnl.toFixed(2)}`
      );
    },
    onError: () => {
      Alert.alert("Error", "Failed to close positions");
    },
  });

  const handleToggleKillSwitch = (activate: boolean) => {
    if (activate) {
      Alert.alert(
        "Activate Kill Switch",
        "This will immediately halt all trading. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Activate", 
            style: "destructive",
            onPress: () => killSwitchMutation.mutate(true),
          },
        ]
      );
    } else {
      killSwitchMutation.mutate(false);
    }
  };

  const handleCloseAllPositions = () => {
    Alert.alert(
      "Close All Positions",
      "This will close all open positions at current market prices. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Close All", 
          style: "destructive",
          onPress: () => closeAllMutation.mutate(),
        },
      ]
    );
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Card elevation={1} style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: BrandColors.primaryLight + "20" }]}>
          <Feather name="user" size={40} color={BrandColors.primaryLight} />
        </View>
        <ThemedText style={styles.username}>{user?.username ?? "User"}</ThemedText>
        <ThemedText style={[styles.userId, { color: theme.textSecondary }]}>
          Paper Trading Account
        </ThemedText>
      </Card>

      <ConnectorHealthCard 
        connectors={connectorsStatus}
        isLoading={isLoadingConnectors}
        onRefresh={() => refetchConnectors()}
      />

      <RiskManagementCard
        settings={riskSettings}
        isLoading={isLoadingRisk}
        onToggleKillSwitch={handleToggleKillSwitch}
        onCloseAllPositions={handleCloseAllPositions}
        isTogglingKillSwitch={killSwitchMutation.isPending}
        isClosingPositions={closeAllMutation.isPending}
      />

      <Card elevation={1} style={styles.settingsCard}>
        <View style={styles.settingsHeader}>
          <Feather name="settings" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.settingsTitle}>Account Settings</ThemedText>
        </View>
        
        <View style={[styles.settingItem, { borderBottomColor: theme.textSecondary + "20" }]}>
          <Feather name="bell" size={20} color={theme.textSecondary} />
          <ThemedText style={styles.settingText}>Notifications</ThemedText>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>

        <View style={[styles.settingItem, { borderBottomColor: theme.textSecondary + "20" }]}>
          <Feather name="shield" size={20} color={theme.textSecondary} />
          <ThemedText style={styles.settingText}>Security</ThemedText>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>

        <View style={styles.settingItem}>
          <Feather name="help-circle" size={20} color={theme.textSecondary} />
          <ThemedText style={styles.settingText}>Help & Support</ThemedText>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>
      </Card>

      <Pressable
        style={[styles.logoutButton, { backgroundColor: BrandColors.error + "15" }]}
        onPress={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? (
          <ActivityIndicator size="small" color={BrandColors.error} />
        ) : (
          <>
            <Feather name="log-out" size={20} color={BrandColors.error} />
            <ThemedText style={[styles.logoutText, { color: BrandColors.error }]}>Sign Out</ThemedText>
          </>
        )}
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  username: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  userId: {
    ...Typography.caption,
  },
  settingsCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  settingsTitle: {
    ...Typography.h4,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  settingText: {
    ...Typography.body,
    flex: 1,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  logoutText: {
    ...Typography.body,
    fontWeight: "600",
  },
  refreshButton: {
    marginLeft: "auto",
    padding: Spacing.xs,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    ...Typography.caption,
  },
  connectorItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  connectorIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  connectorInfo: {
    flex: 1,
  },
  connectorName: {
    ...Typography.body,
    fontWeight: "500",
  },
  connectorTime: {
    ...Typography.small,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statusText: {
    ...Typography.small,
    fontWeight: "500",
  },
  killSwitchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  killSwitchInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  killSwitchText: {
    gap: 2,
  },
  killSwitchLabel: {
    ...Typography.body,
    fontWeight: "600",
  },
  killSwitchStatus: {
    ...Typography.small,
  },
  riskItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  riskIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  riskLabel: {
    ...Typography.body,
    flex: 1,
  },
  riskValue: {
    ...Typography.body,
    fontWeight: "500",
  },
  closeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  closeAllText: {
    ...Typography.body,
    fontWeight: "600",
  },
});
