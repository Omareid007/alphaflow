import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
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
  const adaptiveRiskEnabled = data.movingAverageParams?.adaptiveRiskEnabled || false;
  const adaptiveRiskIntervalMinutes = data.movingAverageParams?.adaptiveRiskIntervalMinutes || 15;

  const intervalOptions = [
    { value: 5, label: "5 min" },
    { value: 10, label: "10 min" },
    { value: 15, label: "15 min" },
    { value: 30, label: "30 min" },
    { value: 60, label: "60 min" },
  ];

  const handleSelectPreset = (preset: Preset) => {
    const presetId = preset.id as "conservative" | "balanced" | "aggressive";
    updateData({
      movingAverageParams: {
        ...data.movingAverageParams,
        presetId: preset.id,
        fastPeriod: preset.fastPeriod,
        slowPeriod: preset.slowPeriod,
        allocationPct: preset.allocationPct,
        riskLimitPct: preset.riskLimitPct,
        basePresetId: presetId,
      },
    });
  };

  const handleToggleAdaptiveRisk = (value: boolean) => {
    updateData({
      movingAverageParams: {
        fastPeriod: data.movingAverageParams?.fastPeriod ?? 7,
        slowPeriod: data.movingAverageParams?.slowPeriod ?? 20,
        allocationPct: data.movingAverageParams?.allocationPct ?? 0.10,
        riskLimitPct: data.movingAverageParams?.riskLimitPct ?? 0.10,
        ...data.movingAverageParams,
        adaptiveRiskEnabled: value,
      },
    });
  };

  const handleIntervalChange = (interval: number) => {
    updateData({
      movingAverageParams: {
        fastPeriod: data.movingAverageParams?.fastPeriod ?? 7,
        slowPeriod: data.movingAverageParams?.slowPeriod ?? 20,
        allocationPct: data.movingAverageParams?.allocationPct ?? 0.10,
        riskLimitPct: data.movingAverageParams?.riskLimitPct ?? 0.10,
        ...data.movingAverageParams,
        adaptiveRiskIntervalMinutes: interval,
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

        <Card elevation={1} style={styles.adaptiveCard}>
          <View style={styles.adaptiveHeader}>
            <View style={styles.adaptiveInfo}>
              <View style={[styles.adaptiveIconContainer, { backgroundColor: BrandColors.primaryLight + "20" }]}>
                <Feather name="sliders" size={20} color={BrandColors.primaryLight} />
              </View>
              <View style={styles.adaptiveTextContainer}>
                <ThemedText style={styles.adaptiveTitle}>Adaptive Risk Mode</ThemedText>
                <ThemedText style={[styles.adaptiveDesc, { color: theme.textSecondary }]}>
                  Auto-adjusts risk based on market conditions
                </ThemedText>
              </View>
            </View>
            <Switch
              value={adaptiveRiskEnabled}
              onValueChange={handleToggleAdaptiveRisk}
              trackColor={{ false: theme.backgroundSecondary, true: BrandColors.primaryLight + "60" }}
              thumbColor={adaptiveRiskEnabled ? BrandColors.primaryLight : theme.textSecondary}
            />
          </View>
          {adaptiveRiskEnabled ? (
            <View style={styles.adaptiveDetails}>
              <View style={[styles.adaptiveDivider, { backgroundColor: BrandColors.cardBorder }]} />
              
              <View style={styles.adaptiveIntervalSection}>
                <ThemedText style={[styles.intervalLabel, { color: theme.textSecondary }]}>
                  Check Interval
                </ThemedText>
                <View style={styles.intervalButtons}>
                  {intervalOptions.map((option) => {
                    const isSelected = adaptiveRiskIntervalMinutes === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => handleIntervalChange(option.value)}
                        style={[
                          styles.intervalButton,
                          {
                            backgroundColor: isSelected
                              ? BrandColors.primaryLight + "20"
                              : theme.backgroundSecondary,
                            borderColor: isSelected ? BrandColors.primaryLight : "transparent",
                          },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.intervalButtonText,
                            { color: isSelected ? BrandColors.primaryLight : theme.textSecondary },
                          ]}
                        >
                          {option.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              
              <View style={styles.adaptiveBaseInfo}>
                <ThemedText style={[styles.basePresetLabel, { color: theme.textSecondary }]}>
                  Base Preset
                </ThemedText>
                <ThemedText style={styles.basePresetValue}>
                  {PRESETS.find(p => p.id === selectedPresetId)?.name || "Balanced"}
                </ThemedText>
              </View>
              
              <View style={styles.adaptiveNote}>
                <Feather name="info" size={14} color={theme.textSecondary} style={{ marginRight: Spacing.xs }} />
                <ThemedText style={[styles.adaptiveNoteText, { color: theme.textSecondary }]}>
                  The system will shift between presets based on market volatility, trend strength, and sentiment every {adaptiveRiskIntervalMinutes} minutes.
                </ThemedText>
              </View>
            </View>
          ) : null}
        </Card>
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
  adaptiveCard: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
  },
  adaptiveHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  adaptiveInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  adaptiveIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  adaptiveTextContainer: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  adaptiveTitle: {
    ...Typography.body,
    fontWeight: "600",
  },
  adaptiveDesc: {
    ...Typography.small,
    marginTop: 2,
  },
  adaptiveDetails: {},
  adaptiveDivider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  adaptiveNote: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  adaptiveNoteText: {
    ...Typography.small,
    flex: 1,
    lineHeight: 18,
  },
  adaptiveIntervalSection: {
    marginBottom: Spacing.md,
  },
  intervalLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  intervalButtons: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  intervalButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  intervalButtonText: {
    ...Typography.small,
    fontWeight: "500",
  },
  adaptiveBaseInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  basePresetLabel: {
    ...Typography.small,
  },
  basePresetValue: {
    ...Typography.body,
    fontWeight: "600",
  },
});
