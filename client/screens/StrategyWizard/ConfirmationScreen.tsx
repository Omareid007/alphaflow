import React, { useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useWizard } from "./index";
import { apiRequest } from "@/lib/query-client";

export default function ConfirmationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { data, resetWizard } = useWizard();
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const strategyData = {
        name: data.strategyName,
        type: data.strategyType,
        description: data.description,
        isActive: false,
        assets: data.assets,
        parameters: JSON.stringify(data.parameters),
      };
      return apiRequest("POST", "/api/strategies", strategyData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      resetWizard();
      navigation.getParent()?.goBack();
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create strategy");
    },
  });

  const handleCreate = () => {
    setError(null);
    createMutation.mutate();
  };

  const formatParamLabel = (key: string): string => {
    const labels: Record<string, string> = {
      supportLevel: "Support Level",
      resistanceLevel: "Resistance Level",
      positionSize: "Position Size",
      stopLossPercent: "Stop Loss",
      takeProfitPercent: "Take Profit",
      maxPositions: "Max Positions",
    };
    return labels[key] || key;
  };

  const formatParamValue = (key: string, value: string): string => {
    if (key === "positionSize") return `$${value}`;
    if (key.includes("Percent")) return `${value}%`;
    if (key.includes("Level")) return `$${value}`;
    return value;
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
          <View style={[styles.iconContainer, { backgroundColor: BrandColors.success + "20" }]}>
            <Feather name="check-circle" size={32} color={BrandColors.success} />
          </View>
          <ThemedText style={styles.title}>Review Strategy</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Confirm your strategy configuration
          </ThemedText>
        </View>

        <Card elevation={1} style={{ ...styles.summaryCard, borderColor: BrandColors.cardBorder }}>
          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Name
            </ThemedText>
            <ThemedText style={styles.summaryValue}>{data.strategyName}</ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Type
            </ThemedText>
            <ThemedText style={styles.summaryValue}>Range Trading</ThemedText>
          </View>

          <View style={styles.divider} />

          <ThemedText style={styles.sectionTitle}>Assets</ThemedText>
          <View style={styles.assetTags}>
            {data.assets.map((asset) => (
              <View
                key={asset}
                style={[styles.assetTag, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText style={styles.assetTagText}>{asset}</ThemedText>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <ThemedText style={styles.sectionTitle}>Parameters</ThemedText>
          {Object.entries(data.parameters).map(([key, value]) => (
            <View key={key} style={styles.paramRow}>
              <ThemedText style={[styles.paramLabel, { color: theme.textSecondary }]}>
                {formatParamLabel(key)}
              </ThemedText>
              <ThemedText style={styles.paramValue}>
                {formatParamValue(key, value)}
              </ThemedText>
            </View>
          ))}
        </Card>

        {error ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={16} color={BrandColors.error} />
            <ThemedText style={[styles.errorText, { color: BrandColors.error }]}>
              {error}
            </ThemedText>
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
            "Create Strategy"
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
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  summaryCard: {
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  summaryLabel: {
    ...Typography.body,
  },
  summaryValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: BrandColors.cardBorder,
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  assetTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  assetTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  assetTagText: {
    ...Typography.small,
    fontWeight: "500",
  },
  paramRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  paramLabel: {
    ...Typography.caption,
  },
  paramValue: {
    ...Typography.caption,
    fontWeight: "600",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
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
