import { useEffect, useRef } from "react";
import { View, StyleSheet, Platform, ActivityIndicator, Dimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { BrandColors, BorderRadius, Spacing, Typography, Fonts } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";

interface PortfolioHistory {
  timestamp: number[];
  equity: number[];
  profit_loss: number[];
  profit_loss_pct: number[];
  base_value: number;
  timeframe: string;
}

interface EquityCurveCardProps {
  height?: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercentage(value: number): string {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function WebChart({ 
  chartData, 
  height, 
  isPositive, 
  isDark 
}: { 
  chartData: { time: number; value: number }[]; 
  height: number; 
  isPositive: boolean; 
  isDark: boolean;
}) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<unknown>(null);

  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) {
      return;
    }

    let cleanupFn: (() => void) | undefined;

    const initChart = async () => {
      try {
        const lc = await import("lightweight-charts");
        const { createChart, ColorType, LineStyle, AreaSeries } = lc;

        if (chartRef.current) {
          (chartRef.current as { remove: () => void }).remove();
        }

        const container = chartContainerRef.current;
        if (!container) return;

        const width = container.clientWidth || Dimensions.get("window").width - Spacing.lg * 2;

        const chart = createChart(container, {
          width,
          height: height - 100,
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: isDark ? "#9BA1A6" : "#6B7280",
            fontFamily: Fonts?.mono || "monospace",
          },
          grid: {
            vertLines: { color: isDark ? "#1E3A5F" : "#E5E7EB", style: LineStyle.Dotted },
            horzLines: { color: isDark ? "#1E3A5F" : "#E5E7EB", style: LineStyle.Dotted },
          },
          rightPriceScale: {
            borderColor: isDark ? "#1E3A5F" : "#E5E7EB",
            scaleMargins: { top: 0.1, bottom: 0.1 },
          },
          timeScale: {
            borderColor: isDark ? "#1E3A5F" : "#E5E7EB",
            timeVisible: true,
            secondsVisible: false,
          },
          crosshair: {
            vertLine: { color: BrandColors.primaryLight, width: 1, style: LineStyle.Dashed },
            horzLine: { color: BrandColors.primaryLight, width: 1, style: LineStyle.Dashed },
          },
          handleScroll: { mouseWheel: true, pressedMouseMove: true },
          handleScale: { mouseWheel: true, pinch: true },
        });

        const lineColor = isPositive ? BrandColors.success : BrandColors.error;
        const areaTopColor = isPositive ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)";
        const areaBottomColor = isPositive ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)";

        const lineSeries = chart.addSeries(AreaSeries, {
          lineColor,
          topColor: areaTopColor,
          bottomColor: areaBottomColor,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lineSeries.setData(chartData as any);

        chart.timeScale().fitContent();
        chartRef.current = chart;

        const handleResize = () => {
          if (container && chartRef.current) {
            (chartRef.current as { applyOptions: (opts: { width: number }) => void }).applyOptions({
              width: container.clientWidth,
            });
          }
        };

        window.addEventListener("resize", handleResize);

        cleanupFn = () => {
          window.removeEventListener("resize", handleResize);
        };
      } catch (err) {
        console.error("Failed to initialize equity curve chart:", err);
      }
    };

    initChart();

    return () => {
      if (cleanupFn) cleanupFn();
      if (chartRef.current) {
        (chartRef.current as { remove: () => void }).remove();
        chartRef.current = null;
      }
    };
  }, [chartData, isDark, height, isPositive]);

  return (
    <div 
      ref={chartContainerRef} 
      style={{ width: "100%", height: height - 100 }} 
    />
  );
}

export function EquityCurveCard({ height = 280 }: EquityCurveCardProps) {
  const { theme, isDark } = useTheme();

  const { data: portfolioHistory, isLoading, error } = useQuery<PortfolioHistory>({
    queryKey: ["/api/alpaca/portfolio-history?period=1M&timeframe=1D"],
    refetchInterval: 60000,
  });

  const chartData = portfolioHistory?.timestamp?.map((time, index) => ({
    time: time,
    value: portfolioHistory.equity[index],
  })) || [];

  const hasData = chartData.length > 0;
  const currentEquity = hasData ? chartData[chartData.length - 1].value : 0;
  const baseValue = portfolioHistory?.base_value || currentEquity;
  const totalPnL = currentEquity - baseValue;
  const totalPnLPct = baseValue > 0 ? ((currentEquity - baseValue) / baseValue) * 100 : 0;
  const isPositive = totalPnL >= 0;
  const isWeb = Platform.OS === "web";

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.headerLeft}>
        <Feather name="trending-up" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.title}>Portfolio Equity</ThemedText>
      </View>
      {hasData && !isLoading && !error ? (
        <View style={styles.liveIndicator}>
          <View style={[styles.liveDot, { backgroundColor: BrandColors.primaryLight }]} />
          <ThemedText style={[styles.liveText, { color: BrandColors.primaryLight }]}>LIVE</ThemedText>
        </View>
      ) : null}
    </View>
  );

  const renderStats = () => {
    if (!hasData) return null;
    
    return (
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Total Equity</ThemedText>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>
            ${formatCurrency(currentEquity)}
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>P&L (30D)</ThemedText>
          <View style={styles.pnlContainer}>
            <ThemedText style={[
              styles.statValue,
              { fontFamily: Fonts?.mono, color: isPositive ? BrandColors.success : BrandColors.error }
            ]}>
              {isPositive ? "+" : ""}${formatCurrency(Math.abs(totalPnL))}
            </ThemedText>
            <View style={[
              styles.changeBadge,
              { backgroundColor: isPositive ? BrandColors.profitBackground : BrandColors.lossBackground }
            ]}>
              <Feather
                name={isPositive ? "trending-up" : "trending-down"}
                size={12}
                color={isPositive ? BrandColors.success : BrandColors.error}
              />
              <ThemedText style={[
                styles.changeText,
                { color: isPositive ? BrandColors.success : BrandColors.error, fontFamily: Fonts?.mono }
              ]}>
                {formatPercentage(totalPnLPct)}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={BrandColors.primaryLight} />
          <ThemedText style={[styles.statusText, { color: theme.textSecondary }]}>
            Loading portfolio history...
          </ThemedText>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Feather name="alert-circle" size={32} color={BrandColors.warning} />
          <ThemedText style={[styles.statusText, { color: theme.textSecondary }]}>
            Unable to load portfolio history
          </ThemedText>
        </View>
      );
    }

    if (!hasData) {
      return (
        <View style={styles.centerContainer}>
          <Feather name="bar-chart-2" size={32} color={theme.textSecondary} />
          <ThemedText style={[styles.statusText, { color: theme.textSecondary }]}>
            No portfolio history available
          </ThemedText>
          <ThemedText style={[styles.statusSubtext, { color: theme.textSecondary }]}>
            Start trading to see your equity curve
          </ThemedText>
        </View>
      );
    }

    if (!isWeb) {
      return (
        <View style={styles.centerContainer}>
          <Feather name="bar-chart-2" size={48} color={BrandColors.primaryLight} />
          <ThemedText style={[styles.statusText, { color: theme.text }]}>
            Equity Curve
          </ThemedText>
          <ThemedText style={[styles.statusSubtext, { color: theme.textSecondary }]}>
            View detailed charts in the web version
          </ThemedText>
        </View>
      );
    }

    return (
      <WebChart 
        chartData={chartData} 
        height={height} 
        isPositive={isPositive} 
        isDark={isDark} 
      />
    );
  };

  return (
    <Card elevation={1} style={{ ...styles.container, height }}>
      {renderHeader()}
      {renderStats()}
      {renderContent()}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  title: {
    ...Typography.h4,
    fontWeight: "600",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    ...Typography.small,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  statItem: {
    gap: Spacing.xs,
  },
  statLabel: {
    ...Typography.small,
  },
  statValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  pnlContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  changeText: {
    ...Typography.small,
    fontWeight: "600",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusText: {
    ...Typography.body,
    textAlign: "center",
  },
  statusSubtext: {
    ...Typography.small,
    textAlign: "center",
  },
});
