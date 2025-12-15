import { View, FlatList, StyleSheet, Switch, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AdminStackParamList } from "@/navigation/AdminStackNavigator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

interface ConnectorStatus {
  name: string;
  provider: string;
  type: string;
  hasApiKey: boolean;
  status: "healthy" | "warning" | "error" | "offline" | "disabled" | "checking";
  lastSync: string | null;
  callsRemaining: number | null;
}

interface ApiKeyStatus {
  name: string;
  key: string;
  category: string;
  configured: boolean;
}

interface DataFusionStatus {
  intelligenceScore: number;
  activeSources: number;
  totalSources: number;
  dataSources: Array<{ name: string; provider: string; active: boolean }>;
  embeddingsCount: number;
  capabilities: {
    marketData: boolean;
    newsAnalysis: boolean;
    sentimentAnalysis: boolean;
    tradingCapability: boolean;
  };
}

function getStatusColor(status: ConnectorStatus["status"]) {
  switch (status) {
    case "healthy":
      return BrandColors.success;
    case "warning":
      return BrandColors.warning;
    case "error":
      return BrandColors.error;
    case "offline":
    case "disabled":
      return BrandColors.neutral;
    case "checking":
      return BrandColors.primaryLight;
  }
}

function getCategoryIcon(category: string): keyof typeof Feather.glyphMap {
  switch (category) {
    case "brokerage": return "briefcase";
    case "market_data": return "trending-up";
    case "crypto": return "dollar-sign";
    case "news": return "file-text";
    case "data": return "database";
    case "ai": return "cpu";
    default: return "key";
  }
}

function ConnectorHealthCard() {
  const { theme } = useTheme();
  const { data, isLoading } = useQuery<{ connectors: ConnectorStatus[] }>({
    queryKey: ["/api/admin/connectors-health"],
    refetchInterval: 30000,
  });

  const connectors = data?.connectors || [];

  return (
    <Card elevation={1} style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Feather name="database" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.sectionTitle}>Connector Health</ThemedText>
        {isLoading ? <ActivityIndicator size="small" color={BrandColors.primaryLight} /> : null}
      </View>
      {connectors.length === 0 && !isLoading ? (
        <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
          No connectors configured
        </ThemedText>
      ) : (
        connectors.map((connector, index) => (
          <View
            key={connector.name}
            style={[
              styles.connectorRow,
              index < connectors.length - 1 && { borderBottomWidth: 1, borderBottomColor: BrandColors.cardBorder },
            ]}
          >
            <View style={styles.connectorInfo}>
              <View style={styles.connectorNameRow}>
                <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(connector.status) }]} />
                <ThemedText style={styles.connectorName}>{connector.name}</ThemedText>
              </View>
              <ThemedText style={[styles.connectorSync, { color: theme.textSecondary }]}>
                {connector.lastSync || "Not connected"}
              </ThemedText>
            </View>
            {connector.callsRemaining !== null ? (
              <View style={styles.callsRemaining}>
                <ThemedText style={[styles.callsValue, { fontFamily: Fonts?.mono }]}>
                  {connector.callsRemaining}
                </ThemedText>
                <ThemedText style={[styles.callsLabel, { color: theme.textSecondary }]}>calls/min</ThemedText>
              </View>
            ) : null}
          </View>
        ))
      )}
    </Card>
  );
}

function DataFusionCard() {
  const { theme } = useTheme();
  const { data, isLoading } = useQuery<DataFusionStatus>({
    queryKey: ["/api/admin/data-fusion-status"],
    refetchInterval: 30000,
  });

  const fusionScore = data?.intelligenceScore || 0;
  const activeSources = data?.activeSources || 0;
  const totalSources = data?.totalSources || 7;
  const dataSources = data?.dataSources || [];
  const capabilities = data?.capabilities || { marketData: false, newsAnalysis: false, sentimentAnalysis: false, tradingCapability: false };

  return (
    <Card elevation={1} style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Feather name="layers" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.sectionTitle}>Data Fusion Engine</ThemedText>
        {isLoading ? <ActivityIndicator size="small" color={BrandColors.primaryLight} /> : null}
      </View>
      <View style={styles.fusionContent}>
        <View style={styles.fusionMetric}>
          <ThemedText style={[styles.fusionLabel, { color: theme.textSecondary }]}>Intelligence Score</ThemedText>
          <View style={styles.fusionScoreRow}>
            <View style={styles.fusionBar}>
              <View
                style={[
                  styles.fusionFill,
                  {
                    width: `${fusionScore * 100}%`,
                    backgroundColor:
                      fusionScore < 0.3 ? BrandColors.error : fusionScore < 0.7 ? BrandColors.warning : BrandColors.success,
                  },
                ]}
              />
            </View>
            <ThemedText style={[styles.fusionValue, { fontFamily: Fonts?.mono }]}>
              {(fusionScore * 100).toFixed(0)}%
            </ThemedText>
          </View>
        </View>
        <View style={styles.fusionStats}>
          <View style={styles.fusionStat}>
            <ThemedText style={[styles.fusionStatValue, { fontFamily: Fonts?.mono }]}>{activeSources}</ThemedText>
            <ThemedText style={[styles.fusionStatLabel, { color: theme.textSecondary }]}>Active Sources</ThemedText>
          </View>
          <View style={styles.fusionStat}>
            <ThemedText style={[styles.fusionStatValue, { fontFamily: Fonts?.mono }]}>{totalSources}</ThemedText>
            <ThemedText style={[styles.fusionStatLabel, { color: theme.textSecondary }]}>Total Sources</ThemedText>
          </View>
        </View>
        <View style={styles.capabilitiesSection}>
          <ThemedText style={[styles.capabilitiesTitle, { color: theme.textSecondary }]}>Capabilities</ThemedText>
          <View style={styles.capabilitiesGrid}>
            <View style={styles.capabilityItem}>
              <View style={[styles.capabilityDot, { backgroundColor: capabilities.marketData ? BrandColors.success : BrandColors.neutral }]} />
              <ThemedText style={[styles.capabilityText, { color: capabilities.marketData ? theme.text : theme.textSecondary }]}>
                Market Data
              </ThemedText>
            </View>
            <View style={styles.capabilityItem}>
              <View style={[styles.capabilityDot, { backgroundColor: capabilities.newsAnalysis ? BrandColors.success : BrandColors.neutral }]} />
              <ThemedText style={[styles.capabilityText, { color: capabilities.newsAnalysis ? theme.text : theme.textSecondary }]}>
                News Analysis
              </ThemedText>
            </View>
            <View style={styles.capabilityItem}>
              <View style={[styles.capabilityDot, { backgroundColor: capabilities.sentimentAnalysis ? BrandColors.success : BrandColors.neutral }]} />
              <ThemedText style={[styles.capabilityText, { color: capabilities.sentimentAnalysis ? theme.text : theme.textSecondary }]}>
                Sentiment
              </ThemedText>
            </View>
            <View style={styles.capabilityItem}>
              <View style={[styles.capabilityDot, { backgroundColor: capabilities.tradingCapability ? BrandColors.success : BrandColors.neutral }]} />
              <ThemedText style={[styles.capabilityText, { color: capabilities.tradingCapability ? theme.text : theme.textSecondary }]}>
                Trading
              </ThemedText>
            </View>
          </View>
        </View>
        <View style={styles.dataSourcesList}>
          <ThemedText style={[styles.dataSourcesTitle, { color: theme.textSecondary }]}>Data Sources</ThemedText>
          {dataSources.map((source) => (
            <View key={source.provider} style={styles.dataSourceRow}>
              <View style={[styles.dataSourceDot, { backgroundColor: source.active ? BrandColors.success : BrandColors.neutral }]} />
              <ThemedText style={[styles.dataSourceName, { color: source.active ? theme.text : theme.textSecondary }]}>
                {source.name}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

function AIConfigCard() {
  const { theme } = useTheme();
  const [autoTrade, setAutoTrade] = useState(false);
  const [riskMode, setRiskMode] = useState(false);
  const [showExplanations, setShowExplanations] = useState(true);

  return (
    <Card elevation={1} style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Feather name="cpu" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.sectionTitle}>AI Configuration</ThemedText>
      </View>
      
      {showExplanations ? (
        <View style={[styles.explanationBox, { backgroundColor: BrandColors.aiLayer + "15" }]}>
          <Feather name="info" size={16} color={BrandColors.aiLayer} />
          <ThemedText style={[styles.explanationText, { color: theme.textSecondary }]}>
            These settings control how the AI makes trading decisions. Auto-Execute allows the AI to place trades automatically without your approval. Conservative Mode requires higher confidence before recommending trades.
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.configRow}>
        <View style={styles.configInfo}>
          <ThemedText style={styles.configLabel}>Auto-Execute Trades</ThemedText>
          <ThemedText style={[styles.configDescription, { color: theme.textSecondary }]}>
            When enabled, the AI will automatically execute trades it recommends without waiting for your approval. Trades follow your strategy rules and risk limits.
          </ThemedText>
          {autoTrade ? (
            <View style={[styles.warningBadge, { backgroundColor: BrandColors.warning + "20" }]}>
              <Feather name="alert-triangle" size={12} color={BrandColors.warning} />
              <ThemedText style={[styles.warningText, { color: BrandColors.warning }]}>
                Trades will execute automatically
              </ThemedText>
            </View>
          ) : null}
        </View>
        <Switch
          value={autoTrade}
          onValueChange={setAutoTrade}
          trackColor={{ false: BrandColors.cardBorder, true: BrandColors.primaryLight }}
        />
      </View>
      <View style={[styles.configRow, { borderTopWidth: 1, borderTopColor: BrandColors.cardBorder }]}>
        <View style={styles.configInfo}>
          <ThemedText style={styles.configLabel}>Conservative Mode</ThemedText>
          <ThemedText style={[styles.configDescription, { color: theme.textSecondary }]}>
            Raises the confidence threshold from 70% to 85% before making trade recommendations. Best for volatile markets or when you want fewer, higher-quality signals.
          </ThemedText>
          {riskMode ? (
            <View style={[styles.infoBadge, { backgroundColor: BrandColors.success + "20" }]}>
              <Feather name="shield" size={12} color={BrandColors.success} />
              <ThemedText style={[styles.infoText, { color: BrandColors.success }]}>
                85% confidence required
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.infoBadge, { backgroundColor: BrandColors.neutral + "30" }]}>
              <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
                70% confidence threshold
              </ThemedText>
            </View>
          )}
        </View>
        <Switch
          value={riskMode}
          onValueChange={setRiskMode}
          trackColor={{ false: BrandColors.cardBorder, true: BrandColors.primaryLight }}
        />
      </View>
    </Card>
  );
}

function APIKeysCard() {
  const { theme } = useTheme();
  const { data, isLoading } = useQuery<{ apiKeys: ApiKeyStatus[]; summary: { total: number; configured: number; missing: number } }>({
    queryKey: ["/api/admin/api-keys-status"],
    refetchInterval: 60000,
  });

  const apiKeys = data?.apiKeys || [];
  const summary = data?.summary || { total: 0, configured: 0, missing: 0 };

  const groupedKeys = apiKeys.reduce((acc, key) => {
    if (!acc[key.category]) acc[key.category] = [];
    acc[key.category].push(key);
    return acc;
  }, {} as Record<string, ApiKeyStatus[]>);

  const categoryLabels: Record<string, string> = {
    brokerage: "Brokerage",
    market_data: "Market Data",
    crypto: "Cryptocurrency",
    news: "News",
    data: "Data Enrichment",
    ai: "AI/LLM Providers",
  };

  return (
    <Card elevation={1} style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Feather name="key" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.sectionTitle}>API Keys</ThemedText>
        {isLoading ? <ActivityIndicator size="small" color={BrandColors.primaryLight} /> : null}
      </View>
      
      <View style={styles.apiSummary}>
        <View style={styles.apiSummaryItem}>
          <ThemedText style={[styles.apiSummaryValue, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>
            {summary.configured}
          </ThemedText>
          <ThemedText style={[styles.apiSummaryLabel, { color: theme.textSecondary }]}>Configured</ThemedText>
        </View>
        <View style={styles.apiSummaryItem}>
          <ThemedText style={[styles.apiSummaryValue, { color: BrandColors.warning, fontFamily: Fonts?.mono }]}>
            {summary.missing}
          </ThemedText>
          <ThemedText style={[styles.apiSummaryLabel, { color: theme.textSecondary }]}>Missing</ThemedText>
        </View>
        <View style={styles.apiSummaryItem}>
          <ThemedText style={[styles.apiSummaryValue, { fontFamily: Fonts?.mono }]}>
            {summary.total}
          </ThemedText>
          <ThemedText style={[styles.apiSummaryLabel, { color: theme.textSecondary }]}>Total</ThemedText>
        </View>
      </View>

      {Object.entries(groupedKeys).map(([category, keys]) => (
        <View key={category} style={styles.apiCategory}>
          <View style={styles.apiCategoryHeader}>
            <Feather name={getCategoryIcon(category)} size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.apiCategoryTitle, { color: theme.textSecondary }]}>
              {categoryLabels[category] || category}
            </ThemedText>
          </View>
          {keys.map((key, index) => (
            <View
              key={key.key}
              style={[
                styles.apiKeyRow,
                index < keys.length - 1 && { borderBottomWidth: 1, borderBottomColor: BrandColors.cardBorder },
              ]}
            >
              <ThemedText style={styles.apiKeyName}>{key.name}</ThemedText>
              <View style={styles.apiKeyStatus}>
                {key.configured ? (
                  <Feather name="check-circle" size={18} color={BrandColors.success} />
                ) : (
                  <Feather name="alert-circle" size={18} color={BrandColors.warning} />
                )}
                <ThemedText
                  style={[styles.apiKeyStatusText, { color: key.configured ? BrandColors.success : BrandColors.warning }]}
                >
                  {key.configured ? "Active" : "Required"}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      ))}
    </Card>
  );
}

function ApiBudgetNavCard() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();

  return (
    <Pressable onPress={() => navigation.navigate("ApiBudget")}>
      <Card elevation={1} style={styles.sectionCard}>
        <View style={styles.navCardContent}>
          <View style={styles.navCardLeft}>
            <View style={styles.sectionHeader}>
              <Feather name="activity" size={20} color={BrandColors.primaryLight} />
              <ThemedText style={styles.sectionTitle}>API Budgets & Cache</ThemedText>
            </View>
            <ThemedText style={[styles.navCardDescription, { color: theme.textSecondary }]}>
              Monitor rate limits, budget usage, and cache status for all providers
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={24} color={theme.textSecondary} />
        </View>
      </Card>
    </Pressable>
  );
}

function ModelRouterNavCard() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();

  return (
    <Pressable onPress={() => navigation.navigate("ModelRouter")}>
      <Card elevation={1} style={styles.sectionCard}>
        <View style={styles.navCardContent}>
          <View style={styles.navCardLeft}>
            <View style={styles.sectionHeader}>
              <Feather name="git-branch" size={20} color={BrandColors.aiLayer} />
              <ThemedText style={styles.sectionTitle}>LLM Model Router</ThemedText>
            </View>
            <ThemedText style={[styles.navCardDescription, { color: theme.textSecondary }]}>
              Role-based routing, fallback chains, cost tracking, and call logs
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={24} color={theme.textSecondary} />
        </View>
      </Card>
    </Pressable>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/admin/connectors-health"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys-status"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/data-fusion-status"] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const sections = [
    { key: "budget", component: <ApiBudgetNavCard /> },
    { key: "modelRouter", component: <ModelRouterNavCard /> },
    { key: "connectors", component: <ConnectorHealthCard /> },
    { key: "fusion", component: <DataFusionCard /> },
    { key: "ai", component: <AIConfigCard /> },
    { key: "keys", component: <APIKeysCard /> },
  ];

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={sections}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) => item.component}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
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
    flex: 1,
  },
  connectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  connectorInfo: {},
  connectorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectorName: {
    ...Typography.body,
    fontWeight: "500",
  },
  connectorSync: {
    ...Typography.small,
    marginLeft: Spacing.lg,
  },
  callsRemaining: {
    alignItems: "flex-end",
  },
  callsValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  callsLabel: {
    ...Typography.small,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
  fusionContent: {
    gap: Spacing.lg,
  },
  fusionMetric: {},
  fusionLabel: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  fusionScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  fusionBar: {
    flex: 1,
    height: 8,
    backgroundColor: BrandColors.cardBorder,
    borderRadius: 4,
    overflow: "hidden",
  },
  fusionFill: {
    height: "100%",
    borderRadius: 4,
  },
  fusionValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  fusionStats: {
    flexDirection: "row",
    gap: Spacing.xl,
  },
  fusionStat: {},
  fusionStatValue: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  fusionStatLabel: {
    ...Typography.small,
  },
  capabilitiesSection: {
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
    paddingTop: Spacing.lg,
  },
  capabilitiesTitle: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  capabilitiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  capabilityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: BrandColors.cardBorder,
    borderRadius: BorderRadius.xs,
  },
  capabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  capabilityText: {
    ...Typography.small,
  },
  dataSourcesList: {
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
    paddingTop: Spacing.lg,
  },
  dataSourcesTitle: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  dataSourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  dataSourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dataSourceName: {
    ...Typography.small,
  },
  configRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: Spacing.md,
  },
  configInfo: {
    flex: 1,
    marginRight: Spacing.lg,
  },
  configLabel: {
    ...Typography.body,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  configDescription: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  explanationBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  explanationText: {
    ...Typography.small,
    flex: 1,
  },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    alignSelf: "flex-start",
  },
  warningText: {
    ...Typography.small,
    fontWeight: "500",
  },
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    alignSelf: "flex-start",
  },
  infoText: {
    ...Typography.small,
    fontWeight: "500",
  },
  apiSummary: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.cardBorder,
  },
  apiSummaryItem: {
    alignItems: "center",
  },
  apiSummaryValue: {
    ...Typography.h3,
  },
  apiSummaryLabel: {
    ...Typography.small,
  },
  apiCategory: {
    marginBottom: Spacing.md,
  },
  apiCategoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  apiCategoryTitle: {
    ...Typography.small,
    fontWeight: "500",
  },
  apiKeyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.lg,
  },
  apiKeyName: {
    ...Typography.body,
  },
  apiKeyStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  apiKeyStatusText: {
    ...Typography.small,
    fontWeight: "500",
  },
  navCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navCardLeft: {
    flex: 1,
  },
  navCardDescription: {
    ...Typography.small,
  },
});
