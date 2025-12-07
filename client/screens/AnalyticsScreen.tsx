import { View, FlatList, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

function PerformanceMetrics() {
  const { theme } = useTheme();

  const metrics = [
    { label: "Total P&L", value: "$0.00", change: null },
    { label: "Win Rate", value: "0%", change: null },
    { label: "Total Trades", value: "0", change: null },
    { label: "Avg Trade", value: "$0.00", change: null },
  ];

  return (
    <View style={styles.metricsGrid}>
      {metrics.map((metric, index) => (
        <Card key={index} elevation={1} style={styles.metricCard}>
          <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>{metric.label}</ThemedText>
          <ThemedText style={[styles.metricValue, { fontFamily: Fonts?.mono }]}>{metric.value}</ThemedText>
        </Card>
      ))}
    </View>
  );
}

function EquityCurveCard() {
  const { theme } = useTheme();

  return (
    <Card elevation={1} style={styles.chartCard}>
      <View style={styles.cardHeader}>
        <Feather name="trending-up" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Equity Curve</ThemedText>
      </View>
      <View style={styles.chartPlaceholder}>
        <Feather name="bar-chart-2" size={48} color={theme.textSecondary} />
        <ThemedText style={[styles.placeholderText, { color: theme.textSecondary }]}>
          Chart will appear after trades
        </ThemedText>
      </View>
    </Card>
  );
}

function WinRateCard() {
  const { theme } = useTheme();
  const winRate = 0;

  return (
    <Card elevation={1} style={styles.winRateCard}>
      <View style={styles.cardHeader}>
        <Feather name="target" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Win Rate</ThemedText>
      </View>
      <View style={styles.winRateContent}>
        <View style={styles.circularProgress}>
          <ThemedText style={[styles.winRateValue, { fontFamily: Fonts?.mono }]}>{winRate}%</ThemedText>
        </View>
        <View style={styles.winRateStats}>
          <View style={styles.winRateStat}>
            <View style={[styles.winIndicator, { backgroundColor: BrandColors.success }]} />
            <ThemedText style={[styles.winRateLabel, { color: theme.textSecondary }]}>Wins: 0</ThemedText>
          </View>
          <View style={styles.winRateStat}>
            <View style={[styles.winIndicator, { backgroundColor: BrandColors.error }]} />
            <ThemedText style={[styles.winRateLabel, { color: theme.textSecondary }]}>Losses: 0</ThemedText>
          </View>
        </View>
      </View>
    </Card>
  );
}

function TradeLedger() {
  const { theme } = useTheme();

  return (
    <Card elevation={1} style={styles.ledgerCard}>
      <View style={styles.cardHeader}>
        <Feather name="list" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Trade History</ThemedText>
      </View>
      <View style={styles.emptyLedger}>
        <Feather name="file-text" size={32} color={theme.textSecondary} />
        <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
          No trades yet
        </ThemedText>
      </View>
    </Card>
  );
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const sections = [
    { key: "metrics", component: <PerformanceMetrics /> },
    { key: "equity", component: <EquityCurveCard /> },
    { key: "winrate", component: <WinRateCard /> },
    { key: "ledger", component: <TradeLedger /> },
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
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  metricCard: {
    width: "48%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  metricLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  metricValue: {
    ...Typography.h2,
  },
  chartCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h4,
  },
  chartPlaceholder: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  placeholderText: {
    ...Typography.caption,
  },
  winRateCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  winRateContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
  },
  circularProgress: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    borderColor: BrandColors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  winRateValue: {
    ...Typography.h2,
  },
  winRateStats: {
    gap: Spacing.sm,
  },
  winRateStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  winIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  winRateLabel: {
    ...Typography.body,
  },
  ledgerCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  emptyLedger: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.caption,
  },
});
