import React from "react";
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

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "Execution">;

export default function ExecutionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateData } = useWizard();

  const handleContinue = () => {
    navigation.navigate("RiskDisclaimer");
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
          <ThemedText style={styles.title}>Execution Mode</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose how you want to run this strategy
          </ThemedText>
        </View>

        <View style={styles.options}>
          <Pressable
            onPress={() => updateData({ executionMode: "virtual" })}
            style={({ pressed }) => [
              styles.optionCard,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: data.executionMode === "virtual" ? BrandColors.success : BrandColors.cardBorder,
                borderWidth: data.executionMode === "virtual" ? 2 : 1,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={styles.optionContent}>
              <View
                style={[
                  styles.optionIcon,
                  {
                    backgroundColor: data.executionMode === "virtual"
                      ? BrandColors.profitBackground
                      : theme.backgroundSecondary,
                  },
                ]}
              >
                <Feather
                  name="play-circle"
                  size={32}
                  color={data.executionMode === "virtual" ? BrandColors.success : theme.textSecondary}
                />
              </View>
              <View style={styles.optionInfo}>
                <View style={styles.optionTitleRow}>
                  <ThemedText style={styles.optionTitle}>Paper Trading</ThemedText>
                  <View style={[styles.recommendedBadge, { backgroundColor: BrandColors.profitBackground }]}>
                    <ThemedText style={[styles.recommendedText, { color: BrandColors.success }]}>
                      Recommended
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.optionDesc, { color: theme.textSecondary }]}>
                  Simulate trades with virtual money. Perfect for testing your strategy without risk.
                </ThemedText>
                <View style={styles.optionFeatures}>
                  <View style={styles.featureItem}>
                    <Feather name="check" size={14} color={BrandColors.success} />
                    <ThemedText style={[styles.featureText, { color: theme.textSecondary }]}>
                      No real money at risk
                    </ThemedText>
                  </View>
                  <View style={styles.featureItem}>
                    <Feather name="check" size={14} color={BrandColors.success} />
                    <ThemedText style={[styles.featureText, { color: theme.textSecondary }]}>
                      Real market data
                    </ThemedText>
                  </View>
                  <View style={styles.featureItem}>
                    <Feather name="check" size={14} color={BrandColors.success} />
                    <ThemedText style={[styles.featureText, { color: theme.textSecondary }]}>
                      Full strategy execution
                    </ThemedText>
                  </View>
                </View>
              </View>
              <View
                style={[
                  styles.radio,
                  {
                    backgroundColor: data.executionMode === "virtual" ? BrandColors.success : "transparent",
                    borderColor: data.executionMode === "virtual" ? BrandColors.success : theme.textSecondary,
                  },
                ]}
              >
                {data.executionMode === "virtual" ? (
                  <Feather name="check" size={14} color="#FFFFFF" />
                ) : null}
              </View>
            </View>
          </Pressable>

          <Pressable
            onPress={() => updateData({ executionMode: "real" })}
            style={({ pressed }) => [
              styles.optionCard,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: data.executionMode === "real" ? BrandColors.warning : BrandColors.cardBorder,
                borderWidth: data.executionMode === "real" ? 2 : 1,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={styles.optionContent}>
              <View
                style={[
                  styles.optionIcon,
                  {
                    backgroundColor: data.executionMode === "real"
                      ? BrandColors.warning + "20"
                      : theme.backgroundSecondary,
                  },
                ]}
              >
                <Feather
                  name="zap"
                  size={32}
                  color={data.executionMode === "real" ? BrandColors.warning : theme.textSecondary}
                />
              </View>
              <View style={styles.optionInfo}>
                <View style={styles.optionTitleRow}>
                  <ThemedText style={styles.optionTitle}>Live Trading</ThemedText>
                  <View style={[styles.comingSoonBadge, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText style={[styles.comingSoonText, { color: theme.textSecondary }]}>
                      Coming Soon
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.optionDesc, { color: theme.textSecondary }]}>
                  Execute real trades with actual money through your connected brokerage account.
                </ThemedText>
                <View style={styles.optionFeatures}>
                  <View style={styles.featureItem}>
                    <Feather name="alert-triangle" size={14} color={BrandColors.warning} />
                    <ThemedText style={[styles.featureText, { color: theme.textSecondary }]}>
                      Real money at risk
                    </ThemedText>
                  </View>
                  <View style={styles.featureItem}>
                    <Feather name="link" size={14} color={theme.textSecondary} />
                    <ThemedText style={[styles.featureText, { color: theme.textSecondary }]}>
                      Requires brokerage connection
                    </ThemedText>
                  </View>
                </View>
              </View>
              <View
                style={[
                  styles.radio,
                  {
                    backgroundColor: data.executionMode === "real" ? BrandColors.warning : "transparent",
                    borderColor: data.executionMode === "real" ? BrandColors.warning : theme.textSecondary,
                  },
                ]}
              >
                {data.executionMode === "real" ? (
                  <Feather name="check" size={14} color="#FFFFFF" />
                ) : null}
              </View>
            </View>
          </Pressable>
        </View>

        {data.executionMode === "real" ? (
          <Card elevation={1} style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <Feather name="alert-triangle" size={20} color={BrandColors.warning} />
              <ThemedText style={styles.warningTitle}>Not Available Yet</ThemedText>
            </View>
            <ThemedText style={[styles.warningText, { color: theme.textSecondary }]}>
              Live trading is not yet available. Please use paper trading to test your strategy. 
              Live trading with real money will be available in a future update.
            </ThemedText>
          </Card>
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
          onPress={handleContinue}
          disabled={data.executionMode === "real"}
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
  options: {
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  optionCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  optionInfo: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
    flexWrap: "wrap",
  },
  optionTitle: {
    ...Typography.h3,
  },
  recommendedBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  recommendedText: {
    ...Typography.small,
    fontWeight: "600",
  },
  comingSoonBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  comingSoonText: {
    ...Typography.small,
    fontWeight: "500",
  },
  optionDesc: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  optionFeatures: {
    gap: Spacing.xs,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  featureText: {
    ...Typography.caption,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  warningCard: {
    backgroundColor: BrandColors.warning + "10",
    borderColor: BrandColors.warning,
    borderWidth: 1,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  warningTitle: {
    ...Typography.h4,
    color: BrandColors.warning,
  },
  warningText: {
    ...Typography.body,
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
