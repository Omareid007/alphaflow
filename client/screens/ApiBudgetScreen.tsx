import { View, FlatList, StyleSheet, Switch, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { apiRequest } from "@/lib/query-client";

interface ProviderStatus {
  enabled: boolean;
  budgetStatus: {
    allowed: boolean;
    currentCount: number;
    limit: number;
    windowType: string;
  };
  lastCallTime: number | null;
  policy: {
    maxRequestsPerMinute?: number;
    maxRequestsPerDay?: number;
    maxRequestsPerWeek?: number;
    cacheFreshDurationMs: number;
  };
}

interface ProvidersResponse {
  providers: Record<string, ProviderStatus>;
}

interface ValyuBudgetStatus {
  tier: "web" | "finance" | "proprietary";
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
  lastCallTime: number | null;
}

interface ValyuBudgetResponse {
  statuses: ValyuBudgetStatus[];
  config: {
    webRetrievalsPerMonth: number;
    financeRetrievalsPerMonth: number;
    proprietaryRetrievalsPerMonth: number;
  };
}

function getStatusColor(status: ProviderStatus): string {
  if (!status.enabled) return BrandColors.neutral;
  if (!status.budgetStatus.allowed) return BrandColors.error;
  const usageRatio = status.budgetStatus.currentCount / status.budgetStatus.limit;
  if (usageRatio > 0.9) return BrandColors.warning;
  return BrandColors.success;
}

function getUsagePercentage(status: ProviderStatus): number {
  if (status.budgetStatus.limit === 0) return 0;
  return Math.min((status.budgetStatus.currentCount / status.budgetStatus.limit) * 100, 100);
}

function formatLastCall(timestamp: number | null): string {
  if (!timestamp) return "Never";
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  return `${Math.floor(diff / 86400000)} days ago`;
}

function formatCacheDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
  return `${Math.round(ms / 86400000)}d`;
}

function getWindowLabel(status: ProviderStatus): string {
  const policy = status.policy;
  if (policy.maxRequestsPerMinute) return "/min";
  if (policy.maxRequestsPerDay) return "/day";
  if (policy.maxRequestsPerWeek) return "/week";
  return "";
}

function ProviderCard({
  name,
  status,
  onToggle,
  onForceRefresh,
  isToggling,
  isRefreshing,
}: {
  name: string;
  status: ProviderStatus;
  onToggle: (enabled: boolean) => void;
  onForceRefresh: () => void;
  isToggling: boolean;
  isRefreshing: boolean;
}) {
  const { theme } = useTheme();
  const usagePercent = getUsagePercentage(status);
  const statusColor = getStatusColor(status);
  const remaining = Math.max(0, status.budgetStatus.limit - status.budgetStatus.currentCount);

  return (
    <Card elevation={1} style={styles.providerCard}>
      <View style={styles.providerHeader}>
        <View style={styles.providerNameRow}>
          <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
          <ThemedText style={styles.providerName}>{name}</ThemedText>
        </View>
        {isToggling ? (
          <ActivityIndicator size="small" color={BrandColors.primaryLight} />
        ) : (
          <Switch
            value={status.enabled}
            onValueChange={onToggle}
            trackColor={{ false: BrandColors.cardBorder, true: BrandColors.primaryLight }}
          />
        )}
      </View>

      <View style={styles.budgetSection}>
        <View style={styles.budgetLabelRow}>
          <ThemedText style={[styles.budgetLabel, { color: theme.textSecondary }]}>Budget Usage</ThemedText>
          <ThemedText style={[styles.budgetValue, { fontFamily: Fonts?.mono }]}>
            {status.budgetStatus.currentCount}/{status.budgetStatus.limit}
            <ThemedText style={[styles.windowLabel, { color: theme.textSecondary }]}>
              {getWindowLabel(status)}
            </ThemedText>
          </ThemedText>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${usagePercent}%`,
                backgroundColor: usagePercent > 90 ? BrandColors.error : usagePercent > 70 ? BrandColors.warning : BrandColors.success,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono, color: remaining > 0 ? BrandColors.success : BrandColors.error }]}>
            {remaining}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Remaining</ThemedText>
        </View>
        <View style={styles.stat}>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>
            {formatCacheDuration(status.policy.cacheFreshDurationMs)}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Cache TTL</ThemedText>
        </View>
        <View style={styles.stat}>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>
            {formatLastCall(status.lastCallTime)}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Last Call</ThemedText>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.refreshButton,
          { backgroundColor: pressed ? BrandColors.primaryDark : BrandColors.primaryLight },
          !status.enabled && styles.refreshButtonDisabled,
        ]}
        onPress={onForceRefresh}
        disabled={!status.enabled || isRefreshing}
      >
        {isRefreshing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Feather name="refresh-cw" size={14} color="#fff" />
            <ThemedText style={styles.refreshButtonText}>Force Refresh</ThemedText>
          </>
        )}
      </Pressable>
    </Card>
  );
}

export default function ApiBudgetScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);
  const [refreshingProvider, setRefreshingProvider] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<ProvidersResponse>({
    queryKey: ["/api/admin/provider-status"],
    refetchInterval: 30000,
  });

  const { data: valyuBudget } = useQuery<ValyuBudgetResponse>({
    queryKey: ["/api/admin/valyu-budget"],
    refetchInterval: 30000,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ provider, enabled }: { provider: string; enabled: boolean }) => {
      setTogglingProvider(provider);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const response = await apiRequest("PATCH", `/api/admin/provider/${provider}/toggle`, { enabled });
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/provider-status"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `${variables.provider} ${variables.enabled ? "enabled" : "disabled"}`);
    },
    onError: (error, variables) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", `Failed to toggle ${variables.provider}: ${error.message}`);
    },
    onSettled: () => {
      setTogglingProvider(null);
    },
  });

  const forceRefreshMutation = useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      setRefreshingProvider(provider);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const response = await apiRequest("POST", `/api/admin/provider/${provider}/force-refresh`, {
        confirmValyu: provider.toLowerCase() === "valyu",
      });
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/provider-status"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `Cache refreshed for ${variables.provider}`);
    },
    onError: (error, variables) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", `Failed to refresh ${variables.provider}: ${error.message}`);
    },
    onSettled: () => {
      setRefreshingProvider(null);
    },
  });

  const handleToggle = useCallback(
    (provider: string, enabled: boolean) => {
      toggleMutation.mutate({ provider, enabled });
    },
    [toggleMutation]
  );

  const handleForceRefresh = useCallback(
    (provider: string) => {
      forceRefreshMutation.mutate({ provider });
    },
    [forceRefreshMutation]
  );

  const providers = data?.providers
    ? Object.entries(data.providers).map(([name, status]) => ({
        name,
        status,
      }))
    : [];

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.primaryLight} />
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>Loading provider status...</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <Feather name="alert-circle" size={48} color={BrandColors.error} />
        <ThemedText style={[styles.errorText, { color: BrandColors.error }]}>Failed to load provider status</ThemedText>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.md,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={providers}
      keyExtractor={(item) => item.name}
      renderItem={({ item }) => (
        <ProviderCard
          name={item.name}
          status={item.status}
          onToggle={(enabled) => handleToggle(item.name, enabled)}
          onForceRefresh={() => handleForceRefresh(item.name)}
          isToggling={togglingProvider === item.name}
          isRefreshing={refreshingProvider === item.name}
        />
      )}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} tintColor={BrandColors.primaryLight} />
      }
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <Feather name="activity" size={24} color={BrandColors.primaryLight} />
            <ThemedText style={styles.headerTitle}>API Budget Manager</ThemedText>
          </View>
          {valyuBudget?.statuses && valyuBudget.statuses.length > 0 ? (
            <Card elevation={1} style={[styles.providerCard, { marginBottom: Spacing.lg }]}>
              <View style={styles.providerHeader}>
                <View style={styles.providerNameRow}>
                  <Feather name="database" size={16} color={BrandColors.primaryLight} />
                  <ThemedText style={styles.providerName}>Valyu Retrieval Budgets</ThemedText>
                </View>
                <ThemedText style={[styles.budgetLabel, { color: theme.textSecondary }]}>
                  Monthly
                </ThemedText>
              </View>
              {valyuBudget.statuses.map((status) => {
                const usagePercent = status.limit > 0 
                  ? Math.min((status.used / status.limit) * 100, 100) 
                  : 0;
                const tierLabel = status.tier === "web" 
                  ? "Web" 
                  : status.tier === "finance" 
                    ? "Finance (valyu/*)" 
                    : "Proprietary";
                return (
                  <View key={status.tier} style={styles.budgetSection}>
                    <View style={styles.budgetLabelRow}>
                      <ThemedText style={[styles.budgetLabel, { color: theme.textSecondary }]}>
                        {tierLabel}
                      </ThemedText>
                      <ThemedText style={[styles.budgetValue, { fontFamily: Fonts?.mono }]}>
                        {status.used}/{status.limit}
                      </ThemedText>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${usagePercent}%`,
                            backgroundColor: usagePercent > 90 
                              ? BrandColors.error 
                              : usagePercent > 70 
                                ? BrandColors.warning 
                                : BrandColors.success,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.statsRow}>
                      <View style={styles.stat}>
                        <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono, color: status.remaining > 0 ? BrandColors.success : BrandColors.error }]}>
                          {status.remaining}
                        </ThemedText>
                        <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Remaining</ThemedText>
                      </View>
                      <View style={styles.stat}>
                        <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>
                          {formatLastCall(status.lastCallTime)}
                        </ThemedText>
                        <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Last Call</ThemedText>
                      </View>
                    </View>
                  </View>
                );
              })}
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
                Resets: {valyuBudget.statuses[0]?.resetDate 
                  ? new Date(valyuBudget.statuses[0].resetDate).toLocaleDateString() 
                  : "N/A"}
              </ThemedText>
            </Card>
          ) : null}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  errorText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  retryButton: {
    backgroundColor: BrandColors.primaryLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    marginTop: Spacing.md,
  },
  retryButtonText: {
    ...Typography.body,
    color: "#fff",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    ...Typography.h3,
  },
  providerCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
    gap: Spacing.md,
  },
  providerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  providerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  providerName: {
    ...Typography.body,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  budgetSection: {
    gap: Spacing.xs,
  },
  budgetLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  budgetLabel: {
    ...Typography.small,
  },
  budgetValue: {
    ...Typography.small,
  },
  windowLabel: {
    ...Typography.small,
  },
  progressBar: {
    height: 6,
    backgroundColor: BrandColors.cardBorder,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  statLabel: {
    ...Typography.small,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
  refreshButtonText: {
    ...Typography.small,
    color: "#fff",
    fontWeight: "600",
  },
});
