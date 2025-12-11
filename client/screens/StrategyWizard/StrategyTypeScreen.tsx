import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useWizard } from "./context";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

const strategies = [
  {
    id: "moving-average-crossover",
    name: "Moving Average Crossover",
    description: "Buy when fast SMA crosses above slow SMA. Classic trend-following strategy with ~21% annual returns in backtests.",
    icon: "activity" as const,
    available: true,
    featured: true,
  },
  {
    id: "range-trading",
    name: "Range Trading",
    description: "Trade between support and resistance levels. Best for sideways markets.",
    icon: "minus" as const,
    available: true,
    featured: false,
  },
  {
    id: "momentum",
    name: "Momentum",
    description: "Follow strong price movements. Buy high, sell higher.",
    icon: "trending-up" as const,
    available: false,
    featured: false,
  },
  {
    id: "mean-reversion",
    name: "Mean Reversion",
    description: "Trade reversals when price deviates from average.",
    icon: "refresh-cw" as const,
    available: false,
    featured: false,
  },
  {
    id: "breakout",
    name: "Breakout",
    description: "Enter when price breaks key levels with volume.",
    icon: "zap" as const,
    available: false,
    featured: false,
  },
];

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "StrategyType">;

export default function StrategyTypeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { updateData } = useWizard();

  const handleSelectStrategy = (strategyId: string) => {
    const strategy = strategies.find((s) => s.id === strategyId);
    if (strategy && strategy.available) {
      updateData({
        strategyType: strategyId,
        strategyName: `My ${strategy.name}`,
        description: strategy.description,
      });
      if (strategyId === "moving-average-crossover") {
        navigation.navigate("MAAssetSelection");
      } else {
        navigation.navigate("StrategyUnderstanding");
      }
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View style={styles.header}>
        <ThemedText style={styles.title}>Choose Strategy</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Select a trading strategy to configure
        </ThemedText>
      </View>

      <View style={styles.grid}>
        {strategies.map((strategy) => (
          <Card
            key={strategy.id}
            elevation={1}
            style={{
              ...styles.strategyCard,
              borderColor: BrandColors.cardBorder,
              opacity: strategy.available ? 1 : 0.5,
            }}
            onPress={() => handleSelectStrategy(strategy.id)}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: BrandColors.primaryLight + "20" },
              ]}
            >
              <Feather
                name={strategy.icon}
                size={28}
                color={BrandColors.primaryLight}
              />
            </View>
            <ThemedText style={styles.strategyName}>{strategy.name}</ThemedText>
            <ThemedText style={[styles.strategyDesc, { color: theme.textSecondary }]}>
              {strategy.description}
            </ThemedText>
            {strategy.available ? null : (
              <View style={[styles.comingSoonBadge, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={[styles.comingSoonText, { color: theme.textSecondary }]}>
                  Coming Soon
                </ThemedText>
              </View>
            )}
          </Card>
        ))}
      </View>
    </ScrollView>
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
  grid: {
    gap: Spacing.md,
  },
  strategyCard: {
    borderWidth: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  strategyName: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  strategyDesc: {
    ...Typography.body,
  },
  comingSoonBadge: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  comingSoonText: {
    ...Typography.small,
    fontWeight: "500",
  },
});
