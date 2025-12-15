import { View, FlatList, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

interface ModelConfig {
  provider: string;
  model: string;
  costPer1kTokens?: number;
}

interface RoleConfig {
  role: string;
  description: string;
  fallbackChain: ModelConfig[];
  maxTokens?: number;
  temperature?: number;
  enableCitations?: boolean;
}

interface LlmCall {
  id: string;
  role: string;
  provider: string;
  model: string;
  status: string;
  estimatedCost: string | null;
  latencyMs: number | null;
  createdAt: string;
}

interface CallStats {
  total: number;
  totalCost: number;
  byRole: Record<string, { count: number; totalCost: number; avgLatency: number }>;
  byProvider: Record<string, { count: number; totalCost: number; successRate: number }>;
}

const roleIcons: Record<string, keyof typeof Feather.glyphMap> = {
  market_news_summarizer: "file-text",
  technical_analyst: "trending-up",
  risk_manager: "shield",
  execution_planner: "play-circle",
  post_trade_reporter: "bar-chart-2",
};

const roleDisplayNames: Record<string, string> = {
  market_news_summarizer: "News Summarizer",
  technical_analyst: "Technical Analyst",
  risk_manager: "Risk Manager",
  execution_planner: "Execution Planner",
  post_trade_reporter: "Post-Trade Reporter",
};

function RoleConfigCard({ config }: { config: RoleConfig }) {
  const { theme } = useTheme();
  const icon = roleIcons[config.role] || "cpu";
  const displayName = roleDisplayNames[config.role] || config.role;

  return (
    <Card elevation={1} style={styles.roleCard}>
      <View style={styles.roleHeader}>
        <View style={styles.roleIconContainer}>
          <Feather name={icon} size={20} color={BrandColors.primaryLight} />
        </View>
        <View style={styles.roleInfo}>
          <ThemedText style={styles.roleName}>{displayName}</ThemedText>
          <ThemedText style={[styles.roleDescription, { color: theme.textSecondary }]}>
            {config.description}
          </ThemedText>
        </View>
      </View>
      <View style={styles.fallbackChain}>
        <ThemedText style={[styles.chainLabel, { color: theme.textSecondary }]}>
          Fallback Chain:
        </ThemedText>
        {config.fallbackChain.map((model, index) => (
          <View key={`${model.provider}-${model.model}`} style={styles.modelRow}>
            <View style={[styles.priorityBadge, { backgroundColor: index === 0 ? BrandColors.success : BrandColors.neutral }]}>
              <ThemedText style={styles.priorityText}>{index + 1}</ThemedText>
            </View>
            <View style={styles.modelInfo}>
              <ThemedText style={[styles.providerName, { fontFamily: Fonts?.mono }]}>
                {model.provider}
              </ThemedText>
              <ThemedText style={[styles.modelName, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>
                {model.model}
              </ThemedText>
            </View>
            {model.costPer1kTokens ? (
              <ThemedText style={[styles.costBadge, { color: theme.textSecondary }]}>
                ${model.costPer1kTokens.toFixed(5)}/1k
              </ThemedText>
            ) : null}
          </View>
        ))}
      </View>
      <View style={styles.configParams}>
        {config.maxTokens ? (
          <View style={styles.paramBadge}>
            <ThemedText style={[styles.paramText, { color: theme.textSecondary }]}>
              Max: {config.maxTokens} tokens
            </ThemedText>
          </View>
        ) : null}
        {config.temperature !== undefined ? (
          <View style={styles.paramBadge}>
            <ThemedText style={[styles.paramText, { color: theme.textSecondary }]}>
              Temp: {config.temperature}
            </ThemedText>
          </View>
        ) : null}
        {config.enableCitations ? (
          <View style={[styles.paramBadge, { backgroundColor: BrandColors.aiLayer + "20" }]}>
            <Feather name="book-open" size={12} color={BrandColors.aiLayer} />
            <ThemedText style={[styles.paramText, { color: BrandColors.aiLayer, marginLeft: 4 }]}>
              Citations
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function StatsCard({ stats }: { stats: CallStats }) {
  const { theme } = useTheme();

  return (
    <Card elevation={1} style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Feather name="activity" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.sectionTitle}>Call Statistics</ThemedText>
      </View>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>
            {stats.total}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            Total Calls
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono, color: BrandColors.success }]}>
            ${stats.totalCost.toFixed(4)}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            Total Cost
          </ThemedText>
        </View>
      </View>
      <View style={styles.breakdownSection}>
        <ThemedText style={[styles.breakdownTitle, { color: theme.textSecondary }]}>
          By Provider
        </ThemedText>
        {Object.entries(stats.byProvider).map(([provider, data]) => (
          <View key={provider} style={styles.breakdownRow}>
            <ThemedText style={[styles.breakdownName, { fontFamily: Fonts?.mono }]}>
              {provider}
            </ThemedText>
            <View style={styles.breakdownStats}>
              <ThemedText style={[styles.breakdownValue, { fontFamily: Fonts?.mono }]}>
                {data.count} calls
              </ThemedText>
              <View style={[styles.successBadge, { backgroundColor: data.successRate > 90 ? BrandColors.success + "20" : BrandColors.warning + "20" }]}>
                <ThemedText style={[styles.successText, { color: data.successRate > 90 ? BrandColors.success : BrandColors.warning }]}>
                  {data.successRate.toFixed(0)}%
                </ThemedText>
              </View>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function RecentCallsCard({ calls }: { calls: LlmCall[] }) {
  const { theme } = useTheme();

  return (
    <Card elevation={1} style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Feather name="clock" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.sectionTitle}>Recent Calls</ThemedText>
      </View>
      {calls.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="inbox" size={32} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No LLM calls recorded yet
          </ThemedText>
        </View>
      ) : (
        calls.slice(0, 10).map((call, index) => (
          <View
            key={call.id}
            style={[
              styles.callRow,
              index < calls.length - 1 && { borderBottomWidth: 1, borderBottomColor: BrandColors.cardBorder },
            ]}
          >
            <View style={styles.callInfo}>
              <View style={styles.callHeader}>
                <View style={[styles.statusDot, { backgroundColor: call.status === "success" ? BrandColors.success : BrandColors.error }]} />
                <ThemedText style={[styles.callRole, { fontFamily: Fonts?.mono }]}>
                  {roleDisplayNames[call.role] || call.role}
                </ThemedText>
              </View>
              <ThemedText style={[styles.callProvider, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>
                {call.provider}/{call.model}
              </ThemedText>
            </View>
            <View style={styles.callMeta}>
              {call.latencyMs ? (
                <ThemedText style={[styles.callLatency, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>
                  {call.latencyMs}ms
                </ThemedText>
              ) : null}
              {call.estimatedCost ? (
                <ThemedText style={[styles.callCost, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>
                  ${parseFloat(call.estimatedCost).toFixed(5)}
                </ThemedText>
              ) : null}
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

export default function ModelRouterScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const { data: configsData, refetch: refetchConfigs } = useQuery<{ configs: RoleConfig[]; availableProviders: string[] }>({
    queryKey: ["/api/admin/model-router/configs"],
  });

  const { data: statsData, refetch: refetchStats } = useQuery<CallStats>({
    queryKey: ["/api/admin/model-router/stats"],
  });

  const { data: callsData, refetch: refetchCalls } = useQuery<{ calls: LlmCall[]; count: number }>({
    queryKey: ["/api/admin/model-router/calls"],
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchConfigs(), refetchStats(), refetchCalls()]);
    setRefreshing(false);
  }, [refetchConfigs, refetchStats, refetchCalls]);

  const configs = configsData?.configs || [];
  const stats = statsData || { total: 0, totalCost: 0, byRole: {}, byProvider: {} };
  const calls = callsData?.calls || [];
  const availableProviders = configsData?.availableProviders || [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Card elevation={1} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Feather name="zap" size={20} color={BrandColors.success} />
          <ThemedText style={styles.sectionTitle}>Active Providers</ThemedText>
        </View>
        <View style={styles.providersRow}>
          {availableProviders.length > 0 ? (
            availableProviders.map((provider) => (
              <View key={provider} style={[styles.providerChip, { backgroundColor: BrandColors.success + "20" }]}>
                <View style={[styles.providerDot, { backgroundColor: BrandColors.success }]} />
                <ThemedText style={[styles.providerChipText, { fontFamily: Fonts?.mono }]}>
                  {provider}
                </ThemedText>
              </View>
            ))
          ) : (
            <ThemedText style={[styles.noProviders, { color: theme.textSecondary }]}>
              No providers available
            </ThemedText>
          )}
        </View>
      </Card>

      <StatsCard stats={stats} />

      <View style={styles.sectionHeader}>
        <Feather name="settings" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.sectionTitle}>Role Configurations</ThemedText>
      </View>

      {configs.map((config) => (
        <RoleConfigCard key={config.role} config={config} />
      ))}

      <RecentCallsCard calls={calls} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
  },
  roleCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  roleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  roleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BrandColors.primaryLight + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  roleDescription: {
    ...Typography.small,
  },
  fallbackChain: {
    marginBottom: Spacing.lg,
  },
  chainLabel: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  priorityBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  priorityText: {
    ...Typography.small,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modelInfo: {
    flex: 1,
  },
  providerName: {
    ...Typography.body,
    fontWeight: "500",
  },
  modelName: {
    ...Typography.small,
  },
  costBadge: {
    ...Typography.small,
  },
  configParams: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  paramBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: BrandColors.cardBorder,
    borderRadius: BorderRadius.xs,
  },
  paramText: {
    ...Typography.small,
  },
  statsGrid: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flex: 1,
  },
  statValue: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    ...Typography.small,
  },
  breakdownSection: {
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
    paddingTop: Spacing.lg,
  },
  breakdownTitle: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  breakdownName: {
    ...Typography.body,
    fontWeight: "500",
  },
  breakdownStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  breakdownValue: {
    ...Typography.small,
  },
  successBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  successText: {
    ...Typography.small,
    fontWeight: "600",
  },
  callRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  callInfo: {},
  callHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  callRole: {
    ...Typography.body,
    fontWeight: "500",
  },
  callProvider: {
    ...Typography.small,
    marginLeft: Spacing.lg,
  },
  callMeta: {
    alignItems: "flex-end",
  },
  callLatency: {
    ...Typography.small,
  },
  callCost: {
    ...Typography.small,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
  },
  providersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  providerChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  providerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  providerChipText: {
    ...Typography.small,
    fontWeight: "500",
  },
  noProviders: {
    ...Typography.body,
  },
});
