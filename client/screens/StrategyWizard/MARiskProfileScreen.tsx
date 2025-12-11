import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useWizard } from "./context";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "MARiskProfile">;

interface Preset {
  id: string;
  name: string;
  description: string;
  fastPeriod: number;
  slowPeriod: number;
  allocationPct: number;
  riskLimitPct: number;
  icon: keyof typeof Feather.glyphMap;
  color: string;
}

const PRESETS: Preset[] = [
  {
    id: "conservative",
    name: "Conservative",
    description: "Lower risk with wider SMA gaps, smaller positions. Best for beginners.",
    fastPeriod: 10,
    slowPeriod: 30,
    allocationPct: 0.05,
    riskLimitPct: 0.05,
    icon: "shield",
    color: BrandColors.success,
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Classic 7/20 SMA crossover. Good balance of signals and reliability.",
    fastPeriod: 7,
    slowPeriod: 20,
    allocationPct: 0.10,
    riskLimitPct: 0.10,
    icon: "target",
    color: BrandColors.primaryLight,
  },
  {
    id: "aggressive",
    name: "Aggressive",
    description: "Faster signals with tighter SMAs. More trades, higher volatility.",
    fastPeriod: 5,
    slowPeriod: 15,
    allocationPct: 0.15,
    riskLimitPct: 0.15,
    icon: "zap",
    color: BrandColors.warning || "#F59E0B",
  },
];

export default function MARiskProfileScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateData } = useWizard();

  const selectedPresetId = data.movingAverageParams?.presetId || "";

  const handleSelectPreset = (preset: Preset) => {
    updateData({
      movingAverageParams: {
        presetId: preset.id,
        fastPeriod: preset.fastPeriod,
        slowPeriod: preset.slowPeriod,
        allocationPct: preset.allocationPct,
        riskLimitPct: preset.riskLimitPct,
      },
    });
  };

  const handleContinue = () => {
    navigation.navigate("MASummary");
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
              Step 2 of 3
            </ThemedText>
          </View>
          <ThemedText style={styles.title}>Choose Risk Profile</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Select a preset that matches your risk tolerance
          </ThemedText>
        </View>

        <View style={styles.presetsContainer}>
          {PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <Pressable
                key={preset.id}
                onPress={() => handleSelectPreset(preset)}
                style={({ pressed }) => [
                  styles.presetCard,
                  {
                    backgroundColor: isSelected
                      ? preset.color + "15"
                      : theme.backgroundDefault,
                    borderColor: isSelected ? preset.color : BrandColors.cardBorder,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={styles.presetHeader}>
                  <View style={[styles.presetIconContainer, { backgroundColor: preset.color + "20" }]}>
                    <Feather name={preset.icon} size={24} color={preset.color} />
                  </View>
                  {isSelected ? (
                    <Feather name="check-circle" size={24} color={preset.color} />
                  ) : null}
                </View>
                <ThemedText style={styles.presetName}>{preset.name}</ThemedText>
                <ThemedText style={[styles.presetDesc, { color: theme.textSecondary }]}>
                  {preset.description}
                </ThemedText>
                
                <View style={[styles.paramsDivider, { backgroundColor: BrandColors.cardBorder }]} />
                
                <View style={styles.paramsGrid}>
                  <View style={styles.paramItem}>
                    <ThemedText style={[styles.paramLabel, { color: theme.textSecondary }]}>
                      Fast/Slow SMA
                    </ThemedText>
                    <ThemedText style={[styles.paramValue, { fontFamily: Fonts?.mono }]}>
                      {preset.fastPeriod} / {preset.slowPeriod}
                    </ThemedText>
                  </View>
                  <View style={styles.paramItem}>
                    <ThemedText style={[styles.paramLabel, { color: theme.textSecondary }]}>
                      Allocation
                    </ThemedText>
                    <ThemedText style={[styles.paramValue, { fontFamily: Fonts?.mono }]}>
                      {(preset.allocationPct * 100).toFixed(0)}%
                    </ThemedText>
                  </View>
                  <View style={styles.paramItem}>
                    <ThemedText style={[styles.paramLabel, { color: theme.textSecondary }]}>
                      Risk Limit
                    </ThemedText>
                    <ThemedText style={[styles.paramValue, { fontFamily: Fonts?.mono }]}>
                      {(preset.riskLimitPct * 100).toFixed(0)}%
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
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
          disabled={!selectedPresetId}
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
  presetsContainer: {
    gap: Spacing.lg,
  },
  presetCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  presetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  presetIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  presetName: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  presetDesc: {
    ...Typography.body,
  },
  paramsDivider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  paramsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  paramItem: {},
  paramLabel: {
    ...Typography.small,
    marginBottom: 2,
  },
  paramValue: {
    ...Typography.body,
    fontWeight: "600",
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
