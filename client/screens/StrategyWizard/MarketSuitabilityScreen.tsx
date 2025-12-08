import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useWizard } from "./index";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "MarketSuitability">;

const marketConditions = [
  {
    id: "sideways",
    name: "Sideways / Ranging",
    description: "Price moves between clear support and resistance",
    icon: "minus" as const,
    suitable: ["range-trading"],
  },
  {
    id: "trending-up",
    name: "Uptrend",
    description: "Price making higher highs and higher lows",
    icon: "trending-up" as const,
    suitable: ["momentum", "breakout"],
  },
  {
    id: "trending-down",
    name: "Downtrend",
    description: "Price making lower highs and lower lows",
    icon: "trending-down" as const,
    suitable: ["momentum"],
  },
  {
    id: "volatile",
    name: "High Volatility",
    description: "Large price swings in short periods",
    icon: "activity" as const,
    suitable: ["mean-reversion"],
  },
];

export default function MarketSuitabilityScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateData } = useWizard();
  const [confirmed, setConfirmed] = useState(data.marketSuitabilityConfirmed);

  const handleContinue = () => {
    updateData({ marketSuitabilityConfirmed: true });
    navigation.navigate("AssetSelection");
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
          <ThemedText style={styles.title}>Market Suitability</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Understand which market conditions work best for your strategy
          </ThemedText>
        </View>

        <View style={styles.conditions}>
          {marketConditions.map((condition) => {
            const isSuitable = condition.suitable.includes(data.strategyType);
            return (
              <Card
                key={condition.id}
                elevation={1}
                style={{
                  ...styles.conditionCard,
                  borderColor: isSuitable ? BrandColors.success : BrandColors.cardBorder,
                  borderWidth: isSuitable ? 2 : 1,
                }}
              >
                <View style={styles.conditionContent}>
                  <View
                    style={[
                      styles.iconContainer,
                      {
                        backgroundColor: isSuitable
                          ? BrandColors.profitBackground
                          : theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <Feather
                      name={condition.icon}
                      size={24}
                      color={isSuitable ? BrandColors.success : theme.textSecondary}
                    />
                  </View>
                  <View style={styles.conditionInfo}>
                    <ThemedText style={styles.conditionName}>{condition.name}</ThemedText>
                    <ThemedText style={[styles.conditionDesc, { color: theme.textSecondary }]}>
                      {condition.description}
                    </ThemedText>
                  </View>
                  {isSuitable ? (
                    <View style={[styles.suitableBadge, { backgroundColor: BrandColors.profitBackground }]}>
                      <Feather name="check" size={14} color={BrandColors.success} />
                      <ThemedText style={[styles.suitableText, { color: BrandColors.success }]}>
                        Suitable
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>

        <Card elevation={1} style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <Feather name="info" size={18} color={BrandColors.primaryLight} />
            <ThemedText style={styles.tipTitle}>Pro Tip</ThemedText>
          </View>
          <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
            Your chosen strategy works best in sideways markets. The AI will analyze current market 
            conditions and adjust trade signals accordingly.
          </ThemedText>
        </Card>

        <Pressable
          style={styles.confirmContainer}
          onPress={() => setConfirmed(!confirmed)}
        >
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: confirmed ? BrandColors.primaryLight : "transparent",
                borderColor: confirmed ? BrandColors.primaryLight : theme.textSecondary,
              },
            ]}
          >
            {confirmed ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
          </View>
          <ThemedText style={[styles.confirmText, { color: theme.text }]}>
            I understand the market conditions suitable for this strategy
          </ThemedText>
        </Pressable>
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
          disabled={!confirmed}
          style={styles.continueButton}
        >
          Continue
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
  title: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
  },
  conditions: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  conditionCard: {
    padding: Spacing.md,
  },
  conditionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  conditionInfo: {
    flex: 1,
  },
  conditionName: {
    ...Typography.h4,
    marginBottom: 2,
  },
  conditionDesc: {
    ...Typography.caption,
  },
  suitableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  suitableText: {
    ...Typography.small,
    fontWeight: "600",
  },
  tipCard: {
    marginBottom: Spacing.lg,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipTitle: {
    ...Typography.h4,
  },
  tipText: {
    ...Typography.body,
  },
  confirmContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
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
