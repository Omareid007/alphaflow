import React, { useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useWizard, AIValidationResult } from "./context";
import { apiRequest } from "@/lib/query-client";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "Backtest">;

export default function BacktestScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateBacktestResults, updateData } = useWizard();
  const [isRunning, setIsRunning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const handleRunBacktest = async () => {
    if (!data.strategyType) {
      Alert.alert("Validation Error", "Please select a strategy type before running backtest");
      return;
    }
    
    setIsRunning(true);
    try {
      const symbol = data.assets[0] || "SPY";
      
      let parameters: Record<string, unknown> = {};
      if (data.strategyType === "moving-average-crossover") {
        const maParams = data.movingAverageParams;
        parameters = {
          fastPeriod: maParams?.fastPeriod ?? 7,
          slowPeriod: maParams?.slowPeriod ?? 20,
          allocationPct: maParams?.allocationPct ?? 0.10,
          riskLimitPct: maParams?.riskLimitPct ?? 0.10,
        };
      } else if (data.strategyType === "mean-reversion" || data.strategyType === "range-trading") {
        parameters = {
          lookbackPeriod: 20,
          deviationThreshold: 2.0,
          maxHoldingPeriod: 10,
        };
      } else if (data.strategyType === "momentum" || data.strategyType === "momentum-breakout") {
        parameters = {
          lookbackPeriod: 14,
          rsiPeriod: 14,
          momentumThreshold: 0.02,
        };
      }
      
      const response = await apiRequest(
        "POST",
        "/api/strategies/backtest",
        {
          strategyType: data.strategyType,
          symbol,
          parameters,
          lookbackDays: 90,
        }
      );
      const result = (await response.json()) as {
        metrics: {
          winRatePct?: number;
          totalReturnPct?: number;
          maxDrawdownPct?: number;
          sharpeRatio?: number;
          sortinoRatio?: number;
          totalTrades?: number;
          annualReturnPct?: number;
          avgWinPct?: number;
          avgLossPct?: number;
          profitFactor?: number;
        };
      };
      const metrics = result.metrics || {};
      updateBacktestResults({
        hasRun: true,
        winRate: metrics.winRatePct ?? 0,
        totalReturn: metrics.totalReturnPct ?? 0,
        maxDrawdown: metrics.maxDrawdownPct ?? 0,
        sharpeRatio: metrics.sharpeRatio ?? 0,
        totalTrades: metrics.totalTrades ?? 0,
        annualReturn: metrics.annualReturnPct ?? 0,
        sortinoRatio: metrics.sortinoRatio ?? 0,
        avgWin: metrics.avgWinPct ?? 0,
        avgLoss: metrics.avgLossPct ?? 0,
        profitFactor: metrics.profitFactor ?? 0,
      });
    } catch (error) {
      Alert.alert("Backtest Failed", (error as Error).message || "Unable to run backtest");
    } finally {
      setIsRunning(false);
    }
  };

  const handleAIValidation = async () => {
    if (data.strategyType !== "moving-average-crossover") return;
    setIsValidating(true);
    try {
      const maParams = data.movingAverageParams;
      const response = await apiRequest(
        "POST",
        "/api/strategies/moving-average/ai-validate",
        {
          fastPeriod: maParams?.fastPeriod ?? 7,
          slowPeriod: maParams?.slowPeriod ?? 20,
          allocationPct: maParams?.allocationPct ?? 0.10,
          riskLimitPct: maParams?.riskLimitPct ?? 0.10,
        }
      );
      const result = (await response.json()) as AIValidationResult;
      updateData({ aiValidation: result });
    } catch (error) {
      Alert.alert("AI Validation Failed", (error as Error).message || "Unable to validate strategy");
    } finally {
      setIsValidating(false);
    }
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

            {data.strategyType === "moving-average-crossover" ? (
              <View style={styles.aiSection}>
                <View style={styles.aiHeader}>
                  <Feather name="cpu" size={20} color={BrandColors.primaryLight} />
                  <ThemedText style={styles.aiTitle}>AI Strategy Review</ThemedText>
                </View>
                
                {data.aiValidation ? (
                  <AIValidationDisplay validation={data.aiValidation} />
                ) : (
                  <Card elevation={1} style={styles.aiPromptCard}>
                    <ThemedText style={[styles.aiPromptText, { color: theme.textSecondary }]}>
                      Get AI-powered feedback on your strategy configuration
                    </ThemedText>
                    <Pressable
                      onPress={handleAIValidation}
                      disabled={isValidating}
                      style={[
                        styles.aiButton,
                        {
                          backgroundColor: BrandColors.primaryLight,
                          opacity: isValidating ? 0.7 : 1,
                        },
                      ]}
                    >
                      {isValidating ? (
                        <View style={styles.loadingContent}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <ThemedText style={styles.loadingText}>Analyzing...</ThemedText>
                        </View>
                      ) : (
                        <ThemedText style={styles.aiButtonText}>Get AI Feedback</ThemedText>
                      )}
                    </Pressable>
                  </Card>
                )}
              </View>
            ) : null}
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
          disabled={isRunning}
          style={styles.continueButton}
        >
          {results.hasRun ? "Continue" : "Skip Backtest"}
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

function AIValidationDisplay({ validation }: { validation: AIValidationResult }) {
  const { theme } = useTheme();

  const getSuitabilityColor = () => {
    switch (validation.suitability) {
      case "retail_friendly":
        return BrandColors.success;
      case "borderline":
        return BrandColors.warning || "#F59E0B";
      case "advanced_only":
        return BrandColors.error;
      default:
        return theme.textSecondary;
    }
  };

  const getSuitabilityLabel = () => {
    switch (validation.suitability) {
      case "retail_friendly":
        return "Beginner Friendly";
      case "borderline":
        return "Moderate Risk";
      case "advanced_only":
        return "Advanced Only";
      default:
        return "Unknown";
    }
  };

  return (
    <Card elevation={1} style={styles.aiResultCard}>
      <View style={styles.aiResultHeader}>
        <View
          style={[
            styles.suitabilityBadge,
            { backgroundColor: getSuitabilityColor() + "20" },
          ]}
        >
          <ThemedText style={[styles.suitabilityText, { color: getSuitabilityColor() }]}>
            {getSuitabilityLabel()}
          </ThemedText>
        </View>
        <ThemedText style={[styles.confidenceText, { color: theme.textSecondary }]}>
          {Math.round(validation.confidence * 100)}% confidence
        </ThemedText>
      </View>

      <ThemedText style={styles.aiSummary}>{validation.summary}</ThemedText>

      <View style={styles.aiRiskSection}>
        <ThemedText style={[styles.aiRiskLabel, { color: theme.textSecondary }]}>
          Risk Assessment
        </ThemedText>
        <ThemedText style={styles.aiRiskText}>{validation.riskAssessment}</ThemedText>
      </View>

      {validation.parameterFeedback.length > 0 ? (
        <View style={styles.aiFeedbackSection}>
          <ThemedText style={[styles.aiFeedbackLabel, { color: theme.textSecondary }]}>
            Suggestions
          </ThemedText>
          {validation.parameterFeedback.map((item, index) => (
            <View key={index} style={styles.aiFeedbackItem}>
              <Feather name="check" size={14} color={BrandColors.primaryLight} />
              <ThemedText style={styles.aiFeedbackText}>{item}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}
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
  aiSection: {
    marginTop: Spacing.xl,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  aiTitle: {
    ...Typography.h4,
  },
  aiPromptCard: {
    alignItems: "center",
  },
  aiPromptText: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  aiButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  aiButtonText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  aiResultCard: {},
  aiResultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  suitabilityBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  suitabilityText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  confidenceText: {
    ...Typography.caption,
  },
  aiSummary: {
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  aiRiskSection: {
    marginBottom: Spacing.md,
  },
  aiRiskLabel: {
    ...Typography.caption,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  aiRiskText: {
    ...Typography.body,
  },
  aiFeedbackSection: {
    marginTop: Spacing.sm,
  },
  aiFeedbackLabel: {
    ...Typography.caption,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  aiFeedbackItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  aiFeedbackText: {
    ...Typography.body,
    flex: 1,
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
