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

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "StrategyUnderstanding">;

const strategyDetails: Record<string, { title: string; points: string[]; risks: string[] }> = {
  "range-trading": {
    title: "Range Trading",
    points: [
      "Identifies support and resistance levels",
      "Buys near support, sells near resistance",
      "Works best in sideways/consolidating markets",
      "Requires clear price boundaries",
      "Uses stop-loss to limit downside risk",
    ],
    risks: [
      "Breakouts can cause significant losses",
      "Market conditions can change quickly",
      "False signals in trending markets",
      "Requires active monitoring",
    ],
  },
  momentum: {
    title: "Momentum Trading",
    points: [
      "Follows strong price movements",
      "Buys when prices are rising, sells when falling",
      "Uses technical indicators to confirm trends",
    ],
    risks: ["Trend reversals can be sudden", "Higher volatility exposure"],
  },
  "mean-reversion": {
    title: "Mean Reversion",
    points: [
      "Trades reversals to average price",
      "Buys oversold, sells overbought conditions",
    ],
    risks: ["Prices can stay extreme longer than expected"],
  },
  breakout: {
    title: "Breakout Trading",
    points: [
      "Enters when price breaks key levels",
      "Uses volume to confirm breakouts",
    ],
    risks: ["False breakouts are common"],
  },
};

export default function StrategyUnderstandingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateData } = useWizard();
  const [acknowledged, setAcknowledged] = useState(data.strategyUnderstandingConfirmed);

  const details = strategyDetails[data.strategyType] || strategyDetails["range-trading"];

  const handleContinue = () => {
    updateData({ strategyUnderstandingConfirmed: true });
    navigation.navigate("MarketSuitability");
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
          <ThemedText style={styles.title}>Understand Your Strategy</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Please review how {details.title} works before proceeding
          </ThemedText>
        </View>

        <Card elevation={1} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="info" size={20} color={BrandColors.primaryLight} />
            <ThemedText style={styles.sectionTitle}>How It Works</ThemedText>
          </View>
          {details.points.map((point, index) => (
            <View key={index} style={styles.bulletItem}>
              <Feather name="check-circle" size={16} color={BrandColors.success} />
              <ThemedText style={[styles.bulletText, { color: theme.text }]}>
                {point}
              </ThemedText>
            </View>
          ))}
        </Card>

        <Card elevation={1} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="alert-triangle" size={20} color={BrandColors.warning} />
            <ThemedText style={styles.sectionTitle}>Key Risks</ThemedText>
          </View>
          {details.risks.map((risk, index) => (
            <View key={index} style={styles.bulletItem}>
              <Feather name="alert-circle" size={16} color={BrandColors.error} />
              <ThemedText style={[styles.bulletText, { color: theme.text }]}>
                {risk}
              </ThemedText>
            </View>
          ))}
        </Card>

        <Pressable
          style={styles.acknowledgementContainer}
          onPress={() => setAcknowledged(!acknowledged)}
        >
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: acknowledged ? BrandColors.primaryLight : "transparent",
                borderColor: acknowledged ? BrandColors.primaryLight : theme.textSecondary,
              },
            ]}
          >
            {acknowledged ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
          </View>
          <ThemedText style={[styles.acknowledgementText, { color: theme.text }]}>
            I understand how this strategy works and the associated risks
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
          disabled={!acknowledged}
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
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  bulletText: {
    ...Typography.body,
    flex: 1,
  },
  acknowledgementContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  acknowledgementText: {
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
