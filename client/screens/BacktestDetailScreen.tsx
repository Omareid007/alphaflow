import { View, ScrollView, StyleSheet, ActivityIndicator, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import type { AnalyticsStackParamList } from "@/navigation/AnalyticsStackNavigator";
import type { BacktestRun, BacktestTradeEvent, BacktestEquityPoint, BacktestStatus } from "@shared/types/backtesting";

type BacktestDetailRouteProp = RouteProp<AnalyticsStackParamList, "BacktestDetail">;

interface EquityCurveResponse {
  points: BacktestEquityPoint[];
}

interface TradesResponse {
  trades: BacktestTradeEvent[];
}

const STATUS_COLORS: Record<BacktestStatus, string> = {
  QUEUED: BrandColors.neutral,
  RUNNING: BrandColors.warning,
  DONE: BrandColors.success,
  FAILED: BrandColors.error,
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    hour: "2-digit", 
    minute: "2-digit" 
  });
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "--";
  return value.toFixed(decimals);
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: BacktestStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: color + "20" }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <ThemedText style={[styles.statusText, { color }]}>{status}</ThemedText>
    </View>
  );
}

function MetricCard({ label, value, isPositive, suffix }: { 
  label: string; 
  value: string; 
  isPositive?: boolean | null;
  suffix?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.metricCard}>
      <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
      <ThemedText style={[
        styles.metricValue,
        { fontFamily: Fonts?.mono },
        isPositive === true && { color: BrandColors.success },
        isPositive === false && { color: BrandColors.error },
      ]}>
        {value}{suffix ?? ""}
      </ThemedText>
    </View>
  );
}

function EquityCurveChart({ points }: { points: BacktestEquityPoint[] }) {
  const { theme } = useTheme();
  const width = Dimensions.get("window").width - Spacing.lg * 4;
  const height = 180;
  const padding = 10;

  if (points.length < 2) {
    return (
      <View style={[styles.chartContainer, { height, justifyContent: "center", alignItems: "center" }]}>
        <ThemedText style={{ color: theme.textSecondary }}>Not enough data points</ThemedText>
      </View>
    );
  }

  const equities = points.map(p => p.equity);
  const minEquity = Math.min(...equities);
  const maxEquity = Math.max(...equities);
  const range = maxEquity - minEquity || 1;

  const scaleX = (index: number) => padding + (index / (points.length - 1)) * (width - padding * 2);
  const scaleY = (value: number) => height - padding - ((value - minEquity) / range) * (height - padding * 2);

  const pathData = points.map((p, i) => {
    const x = scaleX(i);
    const y = scaleY(p.equity);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(" ");

  const startEquity = points[0].equity;
  const endEquity = points[points.length - 1].equity;
  const isPositive = endEquity >= startEquity;
  const lineColor = isPositive ? BrandColors.success : BrandColors.error;

  return (
    <View style={[styles.chartContainer, { height }]}>
      <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        <path
          d={pathData}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <View style={styles.chartLabels}>
        <ThemedText style={[styles.chartLabel, { color: theme.textSecondary }]}>
          {formatCurrency(maxEquity)}
        </ThemedText>
        <ThemedText style={[styles.chartLabel, { color: theme.textSecondary }]}>
          {formatCurrency(minEquity)}
        </ThemedText>
      </View>
    </View>
  );
}

function TradeRow({ trade }: { trade: BacktestTradeEvent }) {
  const { theme } = useTheme();
  const isBuy = trade.side === "buy";

  return (
    <View style={[styles.tradeRow, { borderBottomColor: BrandColors.cardBorder }]}>
      <View style={styles.tradeIcon}>
        <Feather 
          name={isBuy ? "arrow-up-circle" : "arrow-down-circle"} 
          size={18} 
          color={isBuy ? BrandColors.success : BrandColors.error} 
        />
      </View>
      <View style={styles.tradeInfo}>
        <View style={styles.tradeHeaderRow}>
          <ThemedText style={styles.tradeSymbol}>{trade.symbol}</ThemedText>
          <ThemedText style={[styles.tradeSide, { color: isBuy ? BrandColors.success : BrandColors.error }]}>
            {trade.side.toUpperCase()}
          </ThemedText>
        </View>
        <ThemedText style={[styles.tradeDetails, { color: theme.textSecondary }]}>
          {trade.qty} @ {formatCurrency(trade.price)}
        </ThemedText>
        <ThemedText style={[styles.tradeTime, { color: theme.textSecondary }]}>
          {formatDateTime(trade.ts)}
        </ThemedText>
      </View>
      <View style={styles.tradeMeta}>
        <ThemedText style={[styles.tradeFees, { color: theme.textSecondary }]}>
          Fee: {formatCurrency(trade.fees)}
        </ThemedText>
        <ThemedText style={[styles.tradeReason, { color: theme.textSecondary }]} numberOfLines={1}>
          {trade.reason}
        </ThemedText>
      </View>
    </View>
  );
}

function ErrorCard({ message }: { message: string }) {
  const { theme } = useTheme();
  return (
    <Card elevation={1} style={styles.errorCard}>
      <Feather name="alert-circle" size={32} color={BrandColors.error} />
      <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
        {message}
      </ThemedText>
    </Card>
  );
}

export default function BacktestDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<BacktestDetailRouteProp>();
  const { id } = route.params;

  const { data: run, isLoading: runLoading, error: runError } = useQuery<BacktestRun>({
    queryKey: ["/api/backtests", id],
  });

  const { data: equityCurve, isLoading: curveLoading } = useQuery<EquityCurveResponse>({
    queryKey: ["/api/backtests", id, "equity-curve"],
    enabled: !!run && run.status === "DONE",
  });

  const { data: tradesData, isLoading: tradesLoading } = useQuery<TradesResponse>({
    queryKey: ["/api/backtests", id, "trades"],
    enabled: !!run && run.status === "DONE",
  });

  if (runLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: headerHeight + Spacing.xl, backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.primaryLight} />
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading backtest...
        </ThemedText>
      </View>
    );
  }

  if (runError || !run) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight + Spacing.xl, backgroundColor: theme.backgroundRoot }]}>
        <ErrorCard message="Failed to load backtest" />
      </View>
    );
  }

  const summary = run.resultsSummary;
  const universeDisplay = run.universe.join(", ");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Card elevation={1} style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryTitleRow}>
            <ThemedText style={styles.universeTitle}>{universeDisplay}</ThemedText>
            <StatusBadge status={run.status} />
          </View>
          <ThemedText style={[styles.dateRange, { color: theme.textSecondary }]}>
            {formatDate(run.startDate)} - {formatDate(run.endDate)}
          </ThemedText>
        </View>

        {run.status === "FAILED" && run.errorMessage ? (
          <View style={[styles.errorBanner, { backgroundColor: BrandColors.error + "10" }]}>
            <Feather name="alert-circle" size={16} color={BrandColors.error} />
            <ThemedText style={[styles.errorBannerText, { color: BrandColors.error }]}>
              {run.errorMessage}
            </ThemedText>
          </View>
        ) : null}

        {summary ? (
          <View style={styles.metricsGrid}>
            <MetricCard 
              label="Total Return" 
              value={formatPercent(summary.totalReturnPct)} 
              isPositive={summary.totalReturnPct >= 0} 
            />
            <MetricCard 
              label="CAGR" 
              value={formatPercent(summary.cagr)} 
              isPositive={summary.cagr !== null ? summary.cagr >= 0 : null} 
            />
            <MetricCard 
              label="Max Drawdown" 
              value={formatPercent(-Math.abs(summary.maxDrawdownPct))} 
              isPositive={false} 
            />
            <MetricCard 
              label="Sharpe Ratio" 
              value={formatNumber(summary.sharpeRatio)} 
              isPositive={summary.sharpeRatio !== null ? summary.sharpeRatio >= 0 : null} 
            />
            <MetricCard 
              label="Sortino Ratio" 
              value={formatNumber(summary.sortinoRatio)} 
              isPositive={summary.sortinoRatio !== null ? summary.sortinoRatio >= 0 : null} 
            />
            <MetricCard 
              label="Win Rate" 
              value={formatNumber(summary.winRatePct, 1)} 
              suffix="%" 
            />
            <MetricCard 
              label="Total Trades" 
              value={summary.totalTrades.toString()} 
            />
            <MetricCard 
              label="Profit Factor" 
              value={formatNumber(summary.profitFactor)} 
              isPositive={summary.profitFactor !== null ? summary.profitFactor >= 1 : null} 
            />
            <MetricCard 
              label="Avg Win" 
              value={formatPercent(summary.avgWinPct)} 
              isPositive={true} 
            />
            <MetricCard 
              label="Avg Loss" 
              value={formatPercent(-Math.abs(summary.avgLossPct))} 
              isPositive={false} 
            />
          </View>
        ) : null}

        <View style={styles.configSection}>
          <View style={styles.configRow}>
            <ThemedText style={[styles.configLabel, { color: theme.textSecondary }]}>Initial Cash</ThemedText>
            <ThemedText style={[styles.configValue, { fontFamily: Fonts?.mono }]}>
              {formatCurrency(run.initialCash)}
            </ThemedText>
          </View>
          <View style={styles.configRow}>
            <ThemedText style={[styles.configLabel, { color: theme.textSecondary }]}>Timeframe</ThemedText>
            <ThemedText style={[styles.configValue, { fontFamily: Fonts?.mono }]}>{run.timeframe}</ThemedText>
          </View>
          <View style={styles.configRow}>
            <ThemedText style={[styles.configLabel, { color: theme.textSecondary }]}>Config Hash</ThemedText>
            <ThemedText style={[styles.configValue, { fontFamily: Fonts?.mono }]}>{run.strategyConfigHash.slice(0, 12)}...</ThemedText>
          </View>
          {run.runtimeMs ? (
            <View style={styles.configRow}>
              <ThemedText style={[styles.configLabel, { color: theme.textSecondary }]}>Runtime</ThemedText>
              <ThemedText style={[styles.configValue, { fontFamily: Fonts?.mono }]}>{(run.runtimeMs / 1000).toFixed(2)}s</ThemedText>
            </View>
          ) : null}
        </View>
      </Card>

      {run.status === "DONE" ? (
        <>
          <Card elevation={1} style={styles.chartCard}>
            <View style={styles.sectionHeader}>
              <Feather name="trending-up" size={18} color={BrandColors.primaryLight} />
              <ThemedText style={styles.sectionTitle}>Equity Curve</ThemedText>
            </View>
            {curveLoading ? (
              <View style={styles.chartLoadingContainer}>
                <ActivityIndicator size="small" color={BrandColors.primaryLight} />
              </View>
            ) : equityCurve?.points && equityCurve.points.length > 0 ? (
              <EquityCurveChart points={equityCurve.points} />
            ) : (
              <View style={styles.noDataContainer}>
                <ThemedText style={{ color: theme.textSecondary }}>No equity data available</ThemedText>
              </View>
            )}
          </Card>

          <Card elevation={1} style={styles.tradesCard}>
            <View style={styles.sectionHeader}>
              <Feather name="list" size={18} color={BrandColors.primaryLight} />
              <ThemedText style={styles.sectionTitle}>Trades</ThemedText>
              {tradesData?.trades ? (
                <View style={styles.tradeBadge}>
                  <ThemedText style={styles.tradeBadgeText}>{tradesData.trades.length}</ThemedText>
                </View>
              ) : null}
            </View>
            {tradesLoading ? (
              <View style={styles.tradesLoadingContainer}>
                <ActivityIndicator size="small" color={BrandColors.primaryLight} />
              </View>
            ) : tradesData?.trades && tradesData.trades.length > 0 ? (
              <View style={styles.tradesList}>
                {tradesData.trades.slice(0, 50).map((trade) => (
                  <TradeRow key={trade.id} trade={trade} />
                ))}
                {tradesData.trades.length > 50 ? (
                  <ThemedText style={[styles.moreTradesText, { color: theme.textSecondary }]}>
                    + {tradesData.trades.length - 50} more trades
                  </ThemedText>
                ) : null}
              </View>
            ) : (
              <View style={styles.noDataContainer}>
                <ThemedText style={{ color: theme.textSecondary }}>No trades executed</ThemedText>
              </View>
            )}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
  },
  summaryCard: {
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  summaryHeader: {
    marginBottom: Spacing.lg,
  },
  summaryTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  universeTitle: {
    ...Typography.h3,
    flex: 1,
    marginRight: Spacing.md,
  },
  dateRange: {
    ...Typography.caption,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...Typography.small,
    fontWeight: "600",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  errorBannerText: {
    ...Typography.caption,
    flex: 1,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  metricCard: {
    width: "48%",
    backgroundColor: "transparent",
    paddingVertical: Spacing.sm,
  },
  metricLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  metricValue: {
    ...Typography.h4,
  },
  configSection: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  configRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  configLabel: {
    ...Typography.caption,
  },
  configValue: {
    ...Typography.caption,
  },
  chartCard: {
    marginBottom: Spacing.lg,
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
  chartContainer: {
    position: "relative",
  },
  chartLabels: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  chartLabel: {
    ...Typography.small,
    textAlign: "right",
  },
  chartLoadingContainer: {
    height: 180,
    justifyContent: "center",
    alignItems: "center",
  },
  noDataContainer: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  tradesCard: {
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  tradeBadge: {
    backgroundColor: BrandColors.primaryLight + "20",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  tradeBadgeText: {
    ...Typography.small,
    color: BrandColors.primaryLight,
    fontWeight: "600",
  },
  tradesLoadingContainer: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  tradesList: {
    marginTop: Spacing.sm,
  },
  tradeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  tradeIcon: {
    marginRight: Spacing.md,
    paddingTop: 2,
  },
  tradeInfo: {
    flex: 1,
  },
  tradeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  tradeSymbol: {
    ...Typography.body,
    fontWeight: "600",
  },
  tradeSide: {
    ...Typography.small,
    fontWeight: "600",
  },
  tradeDetails: {
    ...Typography.caption,
    marginBottom: Spacing.xs,
  },
  tradeTime: {
    ...Typography.small,
  },
  tradeMeta: {
    alignItems: "flex-end",
  },
  tradeFees: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  tradeReason: {
    ...Typography.small,
    maxWidth: 100,
    textAlign: "right",
  },
  moreTradesText: {
    ...Typography.caption,
    textAlign: "center",
    paddingVertical: Spacing.md,
  },
  errorCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  errorText: {
    ...Typography.body,
    textAlign: "center",
  },
});
