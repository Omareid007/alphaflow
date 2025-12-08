import { View, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useState } from "react";

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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { data: connectorsStatus, isLoading: isLoadingConnectors, refetch: refetchConnectors } = useQuery<ConnectorsStatus>({
    queryKey: ["/api/connectors/status"],
    refetchInterval: 30000,
  });

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
});
