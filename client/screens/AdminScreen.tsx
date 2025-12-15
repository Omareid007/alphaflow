import { View, FlatList, StyleSheet, Switch, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AdminStackParamList } from "@/navigation/AdminStackNavigator";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

interface ConnectorStatus {
  name: string;
  status: "healthy" | "warning" | "error" | "offline";
  lastSync: string;
  callsRemaining?: number;
}

const connectors: ConnectorStatus[] = [
  { name: "Finnhub", status: "healthy", lastSync: "Just now", callsRemaining: 58 },
  { name: "CoinGecko", status: "healthy", lastSync: "2 min ago", callsRemaining: 28 },
  { name: "GDELT News", status: "healthy", lastSync: "5 min ago" },
  { name: "Alpaca Paper", status: "offline", lastSync: "Not connected" },
];

function getStatusColor(status: ConnectorStatus["status"]) {
  switch (status) {
    case "healthy":
      return BrandColors.success;
    case "warning":
      return BrandColors.warning;
    case "error":
      return BrandColors.error;
    case "offline":
      return BrandColors.neutral;
  }
}

function ConnectorHealthCard() {
  const { theme } = useTheme();

  return (
    <Card elevation={1} style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Feather name="database" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.sectionTitle}>Connector Health</ThemedText>
      </View>
      {connectors.map((connector, index) => (
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
              {connector.lastSync}
            </ThemedText>
          </View>
          {connector.callsRemaining !== undefined ? (
            <View style={styles.callsRemaining}>
              <ThemedText style={[styles.callsValue, { fontFamily: Fonts?.mono }]}>
                {connector.callsRemaining}
              </ThemedText>
              <ThemedText style={[styles.callsLabel, { color: theme.textSecondary }]}>calls/min</ThemedText>
            </View>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

function DataFusionCard() {
  const { theme } = useTheme();
  const fusionScore = 0.72;

  return (
    <Card elevation={1} style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Feather name="layers" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.sectionTitle}>Data Fusion Engine</ThemedText>
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
            <ThemedText style={[styles.fusionStatValue, { fontFamily: Fonts?.mono }]}>3</ThemedText>
            <ThemedText style={[styles.fusionStatLabel, { color: theme.textSecondary }]}>Active Sources</ThemedText>
          </View>
          <View style={styles.fusionStat}>
            <ThemedText style={[styles.fusionStatValue, { fontFamily: Fonts?.mono }]}>0</ThemedText>
            <ThemedText style={[styles.fusionStatLabel, { color: theme.textSecondary }]}>Embeddings</ThemedText>
          </View>
        </View>
      </View>
    </Card>
  );
}

function AIConfigCard() {
  const { theme } = useTheme();
  const [autoTrade, setAutoTrade] = useState(false);
  const [riskMode, setRiskMode] = useState(false);

  return (
    <Card elevation={1} style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Feather name="cpu" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.sectionTitle}>AI Configuration</ThemedText>
      </View>
      <View style={styles.configRow}>
        <View style={styles.configInfo}>
          <ThemedText style={styles.configLabel}>Auto-Execute Trades</ThemedText>
          <ThemedText style={[styles.configDescription, { color: theme.textSecondary }]}>
            Automatically execute AI-recommended trades
          </ThemedText>
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
            Higher confidence threshold for trades
          </ThemedText>
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

  const apiKeys = [
    { name: "Alpaca API", configured: false },
    { name: "Finnhub API", configured: false },
    { name: "CoinGecko API", configured: false },
  ];

  return (
    <Card elevation={1} style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Feather name="key" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.sectionTitle}>API Keys</ThemedText>
      </View>
      {apiKeys.map((key, index) => (
        <View
          key={key.name}
          style={[
            styles.apiKeyRow,
            index < apiKeys.length - 1 && { borderBottomWidth: 1, borderBottomColor: BrandColors.cardBorder },
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
              {key.configured ? "Configured" : "Required"}
            </ThemedText>
          </View>
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
  configRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  },
  apiKeyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
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
