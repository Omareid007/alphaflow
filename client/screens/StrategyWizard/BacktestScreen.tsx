import React, { useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useWizard } from "./index";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "Backtest">;

export default function BacktestScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateBacktestResults } = useWizard();
  const [isRunning, setIsRunning] = useState(false);

  const handleRunBacktest = async () => {
    setIsRunning(true);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const mockResults = {
      hasRun: true,
      winRate: 58 + Math.random() * 15,
      totalReturn: 12 + Math.random() * 20,
      maxDrawdown: 8 + Math.random() * 7,
      sharpeRatio: 1.2 + Math.random() * 0.8,
      totalTrades: Math.floor(45 + Math.random() * 30),
    };
    updateBacktestResults(mockResults);
    setIsRunning(false);
  };

  const handleContinue = () => {
    navigation.navigate("Execution");
  };

  const results = data.backtestResults;

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatNumber = (value: number) => value.toFixed(2);

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Spacing.xl,
            paddingBottom: Spacing.xl,
          },
        ]}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>Backtest Strategy</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Test your strategy against historical data
          </ThemedText>
        </View>

        <Card elevation={1} style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Feather name="info" size={18} color={BrandColors.primaryLight} />
            <ThemedText style={styles.infoTitle}>About Backtesting</ThemedText>
          </View>
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            Backtesting simulates your strategy against historical market data to estimate 
            potential performance. Past results do not guarantee future returns.
          </ThemedText>
        </Card>

        {!results.hasRun ? (
          <Card elevation={2} style={styles.runCard}>
            <View style={styles.runContent}>
              <View
                style={[styles.runIconContainer, { backgroundColor: BrandColors.primaryLight + "20" }]}
              >
                <Feather name="play-circle" size={48} color={BrandColors.primaryLight} />
              </View>
              <ThemedText style={styles.runTitle}>Ready to Backtest</ThemedText>
              <ThemedText style={[styles.runDesc, { color: theme.textSecondary }]}>
                Run a simulation using the last 90 days of market data
              </ThemedText>
              <Button
                onPress={handleRunBacktest}
                disabled={isRunning}
                style={styles.runButton}
              >
                {isRunning ? (
                  <View style={styles.loadingContent}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <ThemedText style={styles.loadingText}>Running Backtest...</ThemedText>
                  </View>
                ) : (
                  "Run Backtest"
                )}
              </Button>
            </View>
          </Card>
        ) : (
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeader}>
              <Feather name="check-circle" size={20} color={BrandColors.success} />
              <ThemedText style={styles.resultsTitle}>Backtest Complete</ThemedText>
            </View>

            <View style={styles.metricsGrid}>
              <MetricCard
                label="Win Rate"
                value={formatPercent(results.winRate)}
                icon="target"
                isPositive={results.winRate > 50}
              />
              <MetricCard
                label="Total Return"
                value={formatPercent(results.totalReturn)}
                icon="trending-up"
                isPositive={results.totalReturn > 0}
              />
              <MetricCard
                label="Max Drawdown"
                value={formatPercent(results.maxDrawdown)}
                icon="trending-down"
                isPositive={results.maxDrawdown < 15}
              />
              <MetricCard
                label="Sharpe Ratio"
                value={formatNumber(results.sharpeRatio)}
                icon="bar-chart"
                isPositive={results.sharpeRatio > 1}
              />
            </View>

            <Card elevation={1} style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Total Trades
                </ThemedText>
                <ThemedText style={[styles.summaryValue, { fontFamily: Fonts?.mono }]}>
                  {results.totalTrades}
                </ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Test Period
                </ThemedText>
                <ThemedText style={[styles.summaryValue, { fontFamily: Fonts?.mono }]}>
                  90 days
                </ThemedText>
              </View>
            </Card>

            <Pressable
              onPress={handleRunBacktest}
              disabled={isRunning}
              style={[
                styles.rerunButton,
                {
                  backgroundColor: "transparent",
                  borderWidth: 1,
                  borderColor: BrandColors.primaryLight,
                  opacity: isRunning ? 0.5 : 1,
                },
              ]}
            >
              <ThemedText style={{ color: BrandColors.primaryLight, fontWeight: "600" }}>
                Run Again
              </ThemedText>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.backgroundRoot,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
      >
        <Button
          onPress={handleContinue}
          disabled={!results.hasRun}
          style={styles.continueButton}
        >
          Continue
        </Button>
      </View>
    </View>
  );
}

function MetricCard({
  label,
  value,
  icon,
  isPositive,
}: {
  label: string;
  value: string;
  icon: keyof typeof Feather.glyphMap;
  isPositive: boolean;
}) {
  const { theme } = useTheme();
  const color = isPositive ? BrandColors.success : BrandColors.error;

  return (
    <Card elevation={1} style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <Feather name={icon} size={16} color={color} />
        <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>
          {label}
        </ThemedText>
      </View>
      <ThemedText style={[styles.metricValue, { color, fontFamily: Fonts?.mono }]}>
        {value}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
  },
  infoCard: {
    marginBottom: Spacing.xl,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoTitle: {
    ...Typography.h4,
  },
  infoText: {
    ...Typography.body,
  },
  runCard: {
    alignItems: "center",
  },
  runContent: {
    alignItems: "center",
  },
  runIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  runTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  runDesc: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  runButton: {
    minWidth: 200,
  },
  loadingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  resultsContainer: {},
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  resultsTitle: {
    ...Typography.h3,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    padding: Spacing.md,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  metricLabel: {
    ...Typography.caption,
  },
  metricValue: {
    ...Typography.h2,
  },
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    ...Typography.body,
  },
  summaryValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: BrandColors.cardBorder,
    marginVertical: Spacing.md,
  },
  rerunButton: {
    alignSelf: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  continueButton: {
    width: "100%",
  },
});
