import React, { useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useWizard, AIValidationResult } from "./context";
import { apiRequest } from "@/lib/query-client";
import type { Strategy } from "@shared/schema";

const PRESET_NAMES: Record<string, string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  aggressive: "Aggressive",
};

export default function MASummaryScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { data, updateData, resetWizard } = useWizard();
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = data.movingAverageParams;
  const symbol = data.assets[0] || "SPY";
  const presetName = PRESET_NAMES[params?.presetId || "balanced"] || "Custom";

  const handleAIValidation = async () => {
    setIsValidating(true);
    setError(null);
    try {
      const configResponse = await apiRequest("POST", "/api/strategy-config", {
        symbol,
        presetId: params?.presetId,
        fastPeriod: params?.fastPeriod,
        slowPeriod: params?.slowPeriod,
        allocationPct: params?.allocationPct,
        riskLimitPct: params?.riskLimitPct,
      });
      const normalizedConfig = await configResponse.json();

      const validateResponse = await apiRequest("POST", "/api/strategy-validate", {
        config: normalizedConfig,
      });
      const result = (await validateResponse.json()) as AIValidationResult;
      updateData({ aiValidation: result });
    } catch (err) {
      setError((err as Error).message || "Failed to validate strategy");
    } finally {
      setIsValidating(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const allParameters = {
        ...data.parameters,
        movingAverageParams: data.movingAverageParams,
        aiValidation: data.aiValidation,
      };

      const strategyData = {
        name: data.strategyName || `MA Crossover - ${symbol}`,
        type: "moving-average-crossover",
        description: `Moving Average Crossover strategy for ${symbol} using ${presetName} preset`,
        isActive: true,
        assets: [symbol],
        parameters: JSON.stringify(allParameters),
      };

      const response = await apiRequest("POST", "/api/strategies", strategyData);
      const createdStrategy: Strategy = await response.json();

      await apiRequest("POST", `/api/strategies/${createdStrategy.id}/start`);

      return createdStrategy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/status"] });
      resetWizard();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Main" }],
        })
      );
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create strategy");
    },
  });

  const handleCreate = () => {
    setError(null);
    createMutation.mutate();
  };

  const getSuitabilityColor = (suitability: string) => {
    switch (suitability) {
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

  const getSuitabilityLabel = (suitability: string) => {
    switch (suitability) {
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
          <View style={styles.stepIndicator}>
            <ThemedText style={[styles.stepText, { color: BrandColors.primaryLight }]}>
              Step 3 of 3
            </ThemedText>
          </View>
          <ThemedText style={styles.title}>Review Strategy</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Confirm your configuration and run AI validation
          </ThemedText>
        </View>

        <Card elevation={1} style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Feather name="activity" size={24} color={BrandColors.primaryLight} />
            <ThemedText style={styles.strategyName}>Moving Average Crossover (SMA)</ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: BrandColors.cardBorder }]} />

          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Symbol
            </ThemedText>
            <ThemedText style={[styles.summaryValue, { fontFamily: Fonts?.mono }]}>
              {symbol}
            </ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Risk Profile
            </ThemedText>
            <ThemedText style={styles.summaryValue}>{presetName}</ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Adaptive Risk
            </ThemedText>
            <View style={styles.adaptiveStatusContainer}>
              {params?.adaptiveRiskEnabled ? (
                <>
                  <View style={[styles.adaptiveStatusDot, { backgroundColor: BrandColors.success }]} />
                  <ThemedText style={[styles.summaryValue, { color: BrandColors.success }]}>
                    Enabled ({params?.adaptiveRiskIntervalMinutes || 15}min)
                  </ThemedText>
                </>
              ) : (
                <ThemedText style={[styles.summaryValue, { color: theme.textSecondary }]}>
                  Disabled
                </ThemedText>
              )}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: BrandColors.cardBorder }]} />

          <ThemedText style={styles.paramsTitle}>Parameters</ThemedText>
          <View style={styles.paramsGrid}>
            <View style={styles.paramItem}>
              <ThemedText style={[styles.paramLabel, { color: theme.textSecondary }]}>
                Fast SMA
              </ThemedText>
              <ThemedText style={[styles.paramValue, { fontFamily: Fonts?.mono }]}>
                {params?.fastPeriod || 7} days
              </ThemedText>
            </View>
            <View style={styles.paramItem}>
              <ThemedText style={[styles.paramLabel, { color: theme.textSecondary }]}>
                Slow SMA
              </ThemedText>
              <ThemedText style={[styles.paramValue, { fontFamily: Fonts?.mono }]}>
                {params?.slowPeriod || 20} days
              </ThemedText>
            </View>
            <View style={styles.paramItem}>
              <ThemedText style={[styles.paramLabel, { color: theme.textSecondary }]}>
                Allocation
              </ThemedText>
              <ThemedText style={[styles.paramValue, { fontFamily: Fonts?.mono }]}>
                {((params?.allocationPct || 0.1) * 100).toFixed(0)}%
              </ThemedText>
            </View>
            <View style={styles.paramItem}>
              <ThemedText style={[styles.paramLabel, { color: theme.textSecondary }]}>
                Risk Limit
              </ThemedText>
              <ThemedText style={[styles.paramValue, { fontFamily: Fonts?.mono }]}>
                {((params?.riskLimitPct || 0.1) * 100).toFixed(0)}%
              </ThemedText>
            </View>
          </View>
        </Card>

        <View style={styles.aiSection}>
          <View style={styles.aiHeader}>
            <Feather name="cpu" size={20} color={BrandColors.primaryLight} />
            <ThemedText style={styles.aiTitle}>AI Strategy Check</ThemedText>
          </View>

          {data.aiValidation ? (
            <Card elevation={1} style={styles.aiResultCard}>
              <View style={styles.aiResultHeader}>
                <View
                  style={[
                    styles.suitabilityBadge,
                    { backgroundColor: getSuitabilityColor(data.aiValidation.suitability) + "20" },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.suitabilityText,
                      { color: getSuitabilityColor(data.aiValidation.suitability) },
                    ]}
                  >
                    {getSuitabilityLabel(data.aiValidation.suitability)}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.confidenceText, { color: theme.textSecondary }]}>
                  Confidence: {Math.round(data.aiValidation.confidence * 100)}%
                </ThemedText>
              </View>

              <ThemedText style={styles.aiSummary}>{data.aiValidation.summary}</ThemedText>

              <View style={styles.aiRiskSection}>
                <ThemedText style={[styles.aiRiskLabel, { color: theme.textSecondary }]}>
                  Risk Assessment
                </ThemedText>
                <ThemedText style={styles.aiRiskText}>{data.aiValidation.riskAssessment}</ThemedText>
              </View>

              {data.aiValidation.parameterFeedback.length > 0 ? (
                <View style={styles.aiFeedbackSection}>
                  <ThemedText style={[styles.aiFeedbackLabel, { color: theme.textSecondary }]}>
                    Feedback
                  </ThemedText>
                  {data.aiValidation.parameterFeedback.map((item, index) => (
                    <View key={index} style={styles.aiFeedbackItem}>
                      <Feather name="check" size={14} color={BrandColors.primaryLight} />
                      <ThemedText style={styles.aiFeedbackText}>{item}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          ) : (
            <Card elevation={1} style={styles.aiPromptCard}>
              <ThemedText style={[styles.aiPromptText, { color: theme.textSecondary }]}>
                Get AI-powered feedback on your strategy configuration before activating
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
                  <ThemedText style={styles.aiButtonText}>Run AI Strategy Check</ThemedText>
                )}
              </Pressable>
            </Card>
          )}
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={16} color={BrandColors.error} />
            <ThemedText style={[styles.errorText, { color: BrandColors.error }]}>{error}</ThemedText>
          </View>
        ) : null}
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
          onPress={handleCreate}
          disabled={createMutation.isPending}
          style={styles.createButton}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            "Create & Activate Strategy"
          )}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  stepIndicator: {
    marginBottom: Spacing.sm,
  },
  stepText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
  },
  summaryCard: {
    marginBottom: Spacing.xl,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  strategyName: {
    ...Typography.h3,
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.body,
  },
  summaryValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  adaptiveStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  adaptiveStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  paramsTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  paramsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  paramItem: {
    width: "50%",
    marginBottom: Spacing.sm,
  },
  paramLabel: {
    ...Typography.small,
    marginBottom: 2,
  },
  paramValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  aiSection: {
    marginBottom: Spacing.lg,
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
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  errorText: {
    ...Typography.caption,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  createButton: {
    width: "100%",
  },
});
