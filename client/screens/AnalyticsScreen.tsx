import { View, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import type { Trade } from "@shared/schema";

interface AnalyticsSummary {
  totalPnl: string;
  winRate: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  openPositions: number;
  unrealizedPnl: string;
  isAgentRunning: boolean;
}

function PerformanceMetrics() {
  const { theme } = useTheme();

  const { data: summary, isLoading, error } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary"],
    refetchInterval: 10000,
  });

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    const formatted = Math.abs(num).toFixed(2);
    return num >= 0 ? `$${formatted}` : `-$${formatted}`;
  };

  if (isLoading) {
    return (
      <View style={styles.metricsGrid}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} elevation={1} style={styles.metricCard}>
            <ActivityIndicator size="small" color={BrandColors.primaryLight} />
          </Card>
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <Card elevation={1} style={styles.errorCard}>
        <Feather name="alert-circle" size={24} color={BrandColors.error} />
        <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
          Unable to load metrics
        </ThemedText>
      </Card>
    );
  }

  const totalPnl = parseFloat(summary?.totalPnl ?? "0");
  const winRate = parseFloat(summary?.winRate ?? "0");
  const avgTrade = summary?.totalTrades && summary.totalTrades > 0 
    ? totalPnl / summary.totalTrades 
    : 0;

  const metrics = [
    { 
      label: "Total P&L", 
      value: formatCurrency(totalPnl), 
      isPositive: totalPnl >= 0 
    },
    { 
      label: "Win Rate", 
      value: `${winRate.toFixed(1)}%`, 
      isPositive: null 
    },
    { 
      label: "Total Trades", 
      value: String(summary?.totalTrades ?? 0), 
      isPositive: null 
    },
    { 
      label: "Avg Trade", 
      value: formatCurrency(avgTrade), 
      isPositive: avgTrade >= 0 
    },
  ];

  return (
    <View style={styles.metricsGrid}>
      {metrics.map((metric, index) => (
        <Card key={index} elevation={1} style={styles.metricCard}>
          <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>{metric.label}</ThemedText>
          <ThemedText 
            style={[
              styles.metricValue, 
              { fontFamily: Fonts?.mono },
              metric.isPositive === true && { color: BrandColors.success },
              metric.isPositive === false && { color: BrandColors.error },
            ]}
          >
            {metric.value}
          </ThemedText>
        </Card>
      ))}
    </View>
  );
}

function EquityCurveCard() {
  const { theme } = useTheme();

  const { data: trades } = useQuery<Trade[]>({
    queryKey: ["/api/trades"],
    refetchInterval: 10000,
  });

  const hasTrades = trades && trades.length > 0;

  return (
    <Card elevation={1} style={styles.chartCard}>
      <View style={styles.cardHeader}>
        <Feather name="trending-up" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Equity Curve</ThemedText>
      </View>
      <View style={styles.chartPlaceholder}>
        <Feather name="bar-chart-2" size={48} color={theme.textSecondary} />
        <ThemedText style={[styles.placeholderText, { color: theme.textSecondary }]}>
          {hasTrades ? "Chart coming soon" : "Chart will appear after trades"}
        </ThemedText>
      </View>
    </Card>
  );
}

function WinRateCard() {
  const { theme } = useTheme();

  const { data: summary } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary"],
    refetchInterval: 10000,
  });

  const winRate = parseFloat(summary?.winRate ?? "0");
  const winCount = summary?.winningTrades ?? 0;
  const lossCount = summary?.losingTrades ?? 0;

  return (
    <Card elevation={1} style={styles.winRateCard}>
      <View style={styles.cardHeader}>
        <Feather name="target" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Win Rate</ThemedText>
      </View>
      <View style={styles.winRateContent}>
        <View style={[
          styles.circularProgress,
          winRate > 50 && { borderColor: BrandColors.success },
          winRate > 0 && winRate <= 50 && { borderColor: BrandColors.warning },
        ]}>
          <ThemedText style={[styles.winRateValue, { fontFamily: Fonts?.mono }]}>{winRate.toFixed(0)}%</ThemedText>
        </View>
        <View style={styles.winRateStats}>
          <View style={styles.winRateStat}>
            <View style={[styles.winIndicator, { backgroundColor: BrandColors.success }]} />
            <ThemedText style={[styles.winRateLabel, { color: theme.textSecondary }]}>Wins: {winCount}</ThemedText>
          </View>
          <View style={styles.winRateStat}>
            <View style={[styles.winIndicator, { backgroundColor: BrandColors.error }]} />
            <ThemedText style={[styles.winRateLabel, { color: theme.textSecondary }]}>Losses: {lossCount}</ThemedText>
          </View>
        </View>
      </View>
    </Card>
  );
}

function TradeLedger() {
  const { theme } = useTheme();

  const { data: trades, isLoading } = useQuery<Trade[]>({
    queryKey: ["/api/trades"],
    refetchInterval: 10000,
  });

  const recentTrades = trades?.slice(0, 5) ?? [];

  const formatCurrency = (value: string | number | null) => {
    if (value === null) return "$0.00";
    const num = typeof value === "string" ? parseFloat(value) : value;
    const formatted = Math.abs(num).toFixed(2);
    return num >= 0 ? `$${formatted}` : `-$${formatted}`;
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Card elevation={1} style={styles.ledgerCard}>
      <View style={styles.cardHeader}>
        <Feather name="list" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Trade History</ThemedText>
      </View>
      {isLoading ? (
        <View style={styles.emptyLedger}>
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>Loading...</ThemedText>
        </View>
      ) : recentTrades.length === 0 ? (
        <View style={styles.emptyLedger}>
          <Feather name="file-text" size={32} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No trades yet
          </ThemedText>
        </View>
      ) : (
        <View style={styles.tradeList}>
          {recentTrades.map((trade) => {
            const pnl = trade.pnl ? parseFloat(trade.pnl) : 0;
            const isProfit = pnl >= 0;
            return (
              <View key={trade.id} style={styles.tradeRow}>
                <View style={styles.tradeInfo}>
                  <View style={styles.tradeSymbolRow}>
                    <Feather 
                      name={trade.side === "buy" ? "arrow-up-circle" : "arrow-down-circle"} 
                      size={16} 
                      color={trade.side === "buy" ? BrandColors.success : BrandColors.error} 
                    />
                    <ThemedText style={styles.tradeSymbol}>{trade.symbol}</ThemedText>
                  </View>
                  <ThemedText style={[styles.tradeDate, { color: theme.textSecondary }]}>
                    {formatDate(trade.executedAt)}
                  </ThemedText>
                </View>
                <View style={styles.tradePnl}>
                  <ThemedText 
                    style={[
                      styles.tradePnlValue, 
                      { color: isProfit ? BrandColors.success : BrandColors.error, fontFamily: Fonts?.mono }
                    ]}
                  >
                    {formatCurrency(trade.pnl)}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      )}
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
  tradeList: {
    gap: Spacing.sm,
  },
  tradeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.cardBorder,
  },
  tradeInfo: {
    gap: Spacing.xs,
  },
  tradeSymbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  tradeSymbol: {
    ...Typography.body,
    fontWeight: "600",
  },
  tradeDate: {
    ...Typography.small,
  },
  tradePnl: {
    alignItems: "flex-end",
  },
  tradePnlValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  errorCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  errorText: {
    ...Typography.body,
    textAlign: "center",
  },
});
