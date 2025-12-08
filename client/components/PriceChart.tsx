import { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Platform, ActivityIndicator, Dimensions, Pressable, ViewStyle } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { BrandColors, BorderRadius, Spacing, Typography, Fonts } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";

interface CryptoChartData {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

interface StockCandleData {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  t: number[];
  v: number[];
  s: string;
}

interface PriceChartProps {
  assetId: string;
  assetType: "crypto" | "stock";
  height?: number;
  showTimeRangeSelector?: boolean;
}

type TimeRange = "1D" | "7D" | "30D" | "90D" | "1Y";

const timeRangeConfigs: Record<TimeRange, { days: string; resolution: string; label: string }> = {
  "1D": { days: "1", resolution: "15", label: "1D" },
  "7D": { days: "7", resolution: "60", label: "7D" },
  "30D": { days: "30", resolution: "D", label: "1M" },
  "90D": { days: "90", resolution: "D", label: "3M" },
  "1Y": { days: "365", resolution: "W", label: "1Y" },
};

function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price >= 1) {
    return price.toFixed(2);
  }
  if (price >= 0.01) {
    return price.toFixed(4);
  }
  return price.toFixed(6);
}

function formatChange(current: number, previous: number): { value: string; isPositive: boolean } {
  if (previous === 0) return { value: "+0.00%", isPositive: true };
  const change = ((current - previous) / previous) * 100;
  const isPositive = change >= 0;
  const prefix = isPositive ? "+" : "";
  return { value: `${prefix}${change.toFixed(2)}%`, isPositive };
}

export function PriceChart({
  assetId,
  assetType,
  height = 300,
  showTimeRangeSelector = true,
}: PriceChartProps) {
  const { theme, isDark } = useTheme();
  const [selectedRange, setSelectedRange] = useState<TimeRange>("7D");
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<unknown>(null);

  const config = timeRangeConfigs[selectedRange];

  const { data: cryptoData, isLoading: cryptoLoading, error: cryptoError } = useQuery<CryptoChartData>({
    queryKey: [`/api/crypto/chart/${assetId}?days=${config.days}`],
    enabled: assetType === "crypto",
    refetchInterval: 60000,
  });

  const { data: stockData, isLoading: stockLoading, error: stockError } = useQuery<StockCandleData>({
    queryKey: [`/api/stock/candles/${assetId}?resolution=${config.resolution}`],
    enabled: assetType === "stock",
    refetchInterval: 60000,
  });

  const isLoading = assetType === "crypto" ? cryptoLoading : stockLoading;
  const error = assetType === "crypto" ? cryptoError : stockError;

  const chartData = assetType === "crypto"
    ? cryptoData?.prices?.map(([time, value]) => ({
        time: Math.floor(time / 1000),
        value,
      })) || []
    : stockData?.t?.map((time, index) => ({
        time,
        open: stockData.o[index],
        high: stockData.h[index],
        low: stockData.l[index],
        close: stockData.c[index],
        value: stockData.c[index],
      })) || [];

  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
  const previousPrice = chartData.length > 1 ? chartData[0].value : currentPrice;
  const priceChange = formatChange(currentPrice, previousPrice);

  useEffect(() => {
    if (Platform.OS !== "web" || !chartContainerRef.current || chartData.length === 0) {
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
          height: height - 80,
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

        const isPositive = currentPrice >= previousPrice;
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

        const lineData = chartData.map(point => ({
          time: point.time,
          value: point.value,
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lineSeries.setData(lineData as any);

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
        console.error("Failed to initialize chart:", err);
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
  }, [chartData, isDark, height, currentPrice, previousPrice]);

  const containerStyle: ViewStyle = { ...styles.container, height };

  if (isLoading) {
    return (
      <Card elevation={1} style={containerStyle}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primaryLight} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading chart data...
          </ThemedText>
        </View>
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation={1} style={containerStyle}>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={32} color={BrandColors.warning} />
          <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
            Unable to load chart data
          </ThemedText>
        </View>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card elevation={1} style={containerStyle}>
        <View style={styles.errorContainer}>
          <Feather name="bar-chart-2" size={32} color={theme.textSecondary} />
          <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
            No chart data available
          </ThemedText>
        </View>
      </Card>
    );
  }

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.priceContainer}>
        <ThemedText style={[styles.currentPrice, { fontFamily: Fonts?.mono }]}>
          ${formatPrice(currentPrice)}
        </ThemedText>
        <View style={[
          styles.changeBadge,
          { backgroundColor: priceChange.isPositive ? BrandColors.profitBackground : BrandColors.lossBackground }
        ]}>
          <Feather
            name={priceChange.isPositive ? "trending-up" : "trending-down"}
            size={14}
            color={priceChange.isPositive ? BrandColors.success : BrandColors.error}
          />
          <ThemedText style={[
            styles.changeText,
            { color: priceChange.isPositive ? BrandColors.success : BrandColors.error, fontFamily: Fonts?.mono }
          ]}>
            {priceChange.value}
          </ThemedText>
        </View>
      </View>
      {showTimeRangeSelector ? (
        <View style={styles.timeRangeContainer}>
          {(Object.keys(timeRangeConfigs) as TimeRange[]).map((range) => (
            <Pressable
              key={range}
              style={[
                styles.timeRangeButton,
                selectedRange === range ? { backgroundColor: BrandColors.primaryLight } : undefined,
              ]}
              onPress={() => setSelectedRange(range)}
            >
              <ThemedText style={[
                styles.timeRangeText,
                selectedRange === range ? styles.timeRangeTextActive : undefined,
              ]}>
                {timeRangeConfigs[range].label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  if (Platform.OS !== "web") {
    return (
      <Card elevation={1} style={containerStyle}>
        {renderHeader()}
        <View style={styles.nativeContainer}>
          <Feather name="bar-chart-2" size={48} color={BrandColors.primaryLight} />
          <ThemedText style={[styles.nativeText, { color: theme.textPrimary }]}>
            Interactive Charts
          </ThemedText>
          <ThemedText style={[styles.nativeSubtext, { color: theme.textSecondary }]}>
            View detailed charts in the web version for full technical analysis capabilities
          </ThemedText>
        </View>
      </Card>
    );
  }

  return (
    <Card elevation={1} style={styles.container}>
      {renderHeader()}
      <View
        ref={chartContainerRef as unknown as React.Ref<View>}
        style={[styles.chartContainer, { height: height - 80 }]}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.caption,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  errorText: {
    ...Typography.body,
    textAlign: "center",
  },
  nativeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  nativeText: {
    ...Typography.body,
    textAlign: "center",
  },
  nativeSubtext: {
    ...Typography.small,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  currentPrice: {
    ...Typography.h2,
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  changeText: {
    ...Typography.small,
    fontWeight: "600",
  },
  timeRangeContainer: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  timeRangeButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  timeRangeText: {
    ...Typography.small,
    fontWeight: "500",
  },
  timeRangeTextActive: {
    color: "#FFFFFF",
  },
  chartContainer: {
    width: "100%",
  },
});
