import React, { useState } from "react";
import { View, StyleSheet, TextInput, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useWizard, MovingAverageParameters } from "./index";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "MAConfiguration">;

interface Preset {
  id: string;
  name: string;
  description: string;
  fastPeriod: number;
  slowPeriod: number;
  allocationPct: number;
  riskLimitPct: number;
}

const PRESETS: Preset[] = [
  {
    id: "conservative",
    name: "Conservative",
    description: "Slower signals, fewer trades, lower risk",
    fastPeriod: 10,
    slowPeriod: 30,
    allocationPct: 0.05,
    riskLimitPct: 0.05,
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Standard 7/20 SMA crossover",
    fastPeriod: 7,
    slowPeriod: 20,
    allocationPct: 0.10,
    riskLimitPct: 0.10,
  },
  {
    id: "aggressive",
    name: "Aggressive",
    description: "Quick signals, more trades, higher risk",
    fastPeriod: 5,
    slowPeriod: 15,
    allocationPct: 0.15,
    riskLimitPct: 0.15,
  },
];

export default function MAConfigurationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateData } = useWizard();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const params = data.movingAverageParams || {
    fastPeriod: 7,
    slowPeriod: 20,
    allocationPct: 0.10,
    riskLimitPct: 0.10,
    presetId: "balanced",
  };

  const updateParams = (updates: Partial<MovingAverageParameters>) => {
    updateData({
      movingAverageParams: { ...params, ...updates },
    });
  };

  const handlePresetSelect = (preset: Preset) => {
    updateParams({
      presetId: preset.id,
      fastPeriod: preset.fastPeriod,
      slowPeriod: preset.slowPeriod,
      allocationPct: preset.allocationPct,
      riskLimitPct: preset.riskLimitPct,
    });
  };

  const handleContinue = () => {
    navigation.navigate("AdaptiveSettings");
  };

  const isValid = () => {
    return (
      params.fastPeriod > 0 &&
      params.slowPeriod > params.fastPeriod &&
      params.allocationPct > 0 &&
      params.allocationPct <= 1 &&
      params.riskLimitPct > 0 &&
      params.riskLimitPct <= 1
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Spacing.xl,
            paddingBottom: Spacing.xl,
          },
        ]}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>Configure Strategy</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose a preset or customize your moving average parameters
          </ThemedText>
        </View>

        <View style={styles.nameSection}>
          <ThemedText style={styles.fieldLabel}>Strategy Name</ThemedText>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: BrandColors.cardBorder,
              },
            ]}
            value={data.strategyName}
            onChangeText={(text) => updateData({ strategyName: text })}
            placeholder="My MA Crossover Strategy"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Select Preset</ThemedText>
          <View style={styles.presetsContainer}>
            {PRESETS.map((preset) => {
              const isSelected = params.presetId === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => handlePresetSelect(preset)}
                  style={({ pressed }) => [
                    styles.presetCard,
                    {
                      backgroundColor: isSelected
                        ? BrandColors.primaryLight + "15"
                        : theme.backgroundDefault,
                      borderColor: isSelected
                        ? BrandColors.primaryLight
                        : BrandColors.cardBorder,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={styles.presetHeader}>
                    <ThemedText style={styles.presetName}>{preset.name}</ThemedText>
                    {isSelected ? (
                      <Feather name="check-circle" size={20} color={BrandColors.primaryLight} />
                    ) : null}
                  </View>
                  <ThemedText style={[styles.presetDesc, { color: theme.textSecondary }]}>
                    {preset.description}
                  </ThemedText>
                  <View style={styles.presetDetails}>
                    <View style={styles.presetDetail}>
                      <ThemedText style={[styles.presetDetailLabel, { color: theme.textSecondary }]}>
                        Fast SMA
                      </ThemedText>
                      <ThemedText style={[styles.presetDetailValue, { fontFamily: Fonts?.mono }]}>
                        {preset.fastPeriod}
                      </ThemedText>
                    </View>
                    <View style={styles.presetDetail}>
                      <ThemedText style={[styles.presetDetailLabel, { color: theme.textSecondary }]}>
                        Slow SMA
                      </ThemedText>
                      <ThemedText style={[styles.presetDetailValue, { fontFamily: Fonts?.mono }]}>
                        {preset.slowPeriod}
                      </ThemedText>
                    </View>
                    <View style={styles.presetDetail}>
                      <ThemedText style={[styles.presetDetailLabel, { color: theme.textSecondary }]}>
                        Allocation
                      </ThemedText>
                      <ThemedText style={[styles.presetDetailValue, { fontFamily: Fonts?.mono }]}>
                        {(preset.allocationPct * 100).toFixed(0)}%
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => setShowAdvanced(!showAdvanced)}
          style={styles.advancedToggle}
        >
          <ThemedText style={[styles.advancedToggleText, { color: BrandColors.primaryLight }]}>
            {showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
          </ThemedText>
          <Feather
            name={showAdvanced ? "chevron-up" : "chevron-down"}
            size={20}
            color={BrandColors.primaryLight}
          />
        </Pressable>

        {showAdvanced ? (
          <Card elevation={1} style={styles.advancedCard}>
            <ThemedText style={styles.advancedTitle}>Advanced Settings</ThemedText>
            <ThemedText style={[styles.advancedDesc, { color: theme.textSecondary }]}>
              Fine-tune your strategy parameters
            </ThemedText>

            <View style={styles.advancedFields}>
              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <ThemedText style={styles.fieldLabel}>Fast Period</ThemedText>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.backgroundRoot,
                        color: theme.text,
                        borderColor: BrandColors.cardBorder,
                      },
                    ]}
                    value={String(params.fastPeriod)}
                    onChangeText={(text) => {
                      const val = parseInt(text, 10);
                      if (!isNaN(val) && val > 0) {
                        updateParams({ fastPeriod: val, presetId: undefined });
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="7"
                    placeholderTextColor={theme.textSecondary}
                  />
                  <ThemedText style={[styles.helpText, { color: theme.textSecondary }]}>
                    Days for fast moving average
                  </ThemedText>
                </View>
                <View style={styles.fieldHalf}>
                  <ThemedText style={styles.fieldLabel}>Slow Period</ThemedText>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.backgroundRoot,
                        color: theme.text,
                        borderColor: BrandColors.cardBorder,
                      },
                    ]}
                    value={String(params.slowPeriod)}
                    onChangeText={(text) => {
                      const val = parseInt(text, 10);
                      if (!isNaN(val) && val > 0) {
                        updateParams({ slowPeriod: val, presetId: undefined });
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="20"
                    placeholderTextColor={theme.textSecondary}
                  />
                  <ThemedText style={[styles.helpText, { color: theme.textSecondary }]}>
                    Days for slow moving average
                  </ThemedText>
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <ThemedText style={styles.fieldLabel}>Allocation %</ThemedText>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.backgroundRoot,
                        color: theme.text,
                        borderColor: BrandColors.cardBorder,
                      },
                    ]}
                    value={String((params.allocationPct * 100).toFixed(0))}
                    onChangeText={(text) => {
                      const val = parseFloat(text);
                      if (!isNaN(val) && val > 0 && val <= 100) {
                        updateParams({ allocationPct: val / 100, presetId: undefined });
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="10"
                    placeholderTextColor={theme.textSecondary}
                  />
                  <ThemedText style={[styles.helpText, { color: theme.textSecondary }]}>
                    % of portfolio per trade
                  </ThemedText>
                </View>
                <View style={styles.fieldHalf}>
                  <ThemedText style={styles.fieldLabel}>Risk Limit %</ThemedText>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.backgroundRoot,
                        color: theme.text,
                        borderColor: BrandColors.cardBorder,
                      },
                    ]}
                    value={String((params.riskLimitPct * 100).toFixed(0))}
                    onChangeText={(text) => {
                      const val = parseFloat(text);
                      if (!isNaN(val) && val > 0 && val <= 100) {
                        updateParams({ riskLimitPct: val / 100, presetId: undefined });
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="10"
                    placeholderTextColor={theme.textSecondary}
                  />
                  <ThemedText style={[styles.helpText, { color: theme.textSecondary }]}>
                    Max loss per trade
                  </ThemedText>
                </View>
              </View>
            </View>
          </Card>
        ) : null}

        <Card elevation={1} style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Feather name="info" size={18} color={BrandColors.primaryLight} />
            <ThemedText style={styles.summaryTitle}>Current Configuration</ThemedText>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Fast SMA
              </ThemedText>
              <ThemedText style={[styles.summaryValue, { fontFamily: Fonts?.mono }]}>
                {params.fastPeriod} days
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Slow SMA
              </ThemedText>
              <ThemedText style={[styles.summaryValue, { fontFamily: Fonts?.mono }]}>
                {params.slowPeriod} days
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Allocation
              </ThemedText>
              <ThemedText style={[styles.summaryValue, { fontFamily: Fonts?.mono }]}>
                {(params.allocationPct * 100).toFixed(0)}%
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Risk Limit
              </ThemedText>
              <ThemedText style={[styles.summaryValue, { fontFamily: Fonts?.mono }]}>
                {(params.riskLimitPct * 100).toFixed(0)}%
              </ThemedText>
            </View>
          </View>
        </Card>
      </KeyboardAwareScrollViewCompat>

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
          disabled={!isValid()}
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
  nameSection: {
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  presetsContainer: {
    gap: Spacing.md,
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
    marginBottom: Spacing.xs,
  },
  presetName: {
    ...Typography.h4,
    fontWeight: "600",
  },
  presetDesc: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  presetDetails: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  presetDetail: {},
  presetDetailLabel: {
    ...Typography.small,
    marginBottom: 2,
  },
  presetDetailValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  advancedToggleText: {
    ...Typography.body,
    fontWeight: "600",
  },
  advancedCard: {
    marginBottom: Spacing.lg,
  },
  advancedTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  advancedDesc: {
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  advancedFields: {
    gap: Spacing.lg,
  },
  fieldRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    ...Typography.caption,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  textInput: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    ...Typography.body,
  },
  helpText: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    ...Typography.h4,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  summaryItem: {
    width: "50%",
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.small,
    marginBottom: 2,
  },
  summaryValue: {
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
