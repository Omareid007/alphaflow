import React from "react";
import { View, StyleSheet, TextInput, Switch } from "react-native";
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
import { useWizard } from "./context";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "ExposureSettings">;

export default function ExposureSettingsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateExposureSettings } = useWizard();

  const handleContinue = () => {
    navigation.navigate("ControlLimits");
  };

  const isValid = () => {
    const maxSize = parseFloat(data.exposureSettings.maxPositionSize);
    const maxPercent = parseFloat(data.exposureSettings.maxPositionPercent);
    return maxSize > 0 && maxPercent > 0 && maxPercent <= 100;
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
          <ThemedText style={styles.title}>Position Exposure</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Set limits for individual position sizes
          </ThemedText>
        </View>

        <View style={styles.fieldsContainer}>
          <View style={styles.fieldContainer}>
            <ThemedText style={styles.fieldLabel}>Maximum Position Size</ThemedText>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.paramInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: BrandColors.cardBorder,
                    fontFamily: Fonts?.mono,
                  },
                ]}
                value={data.exposureSettings.maxPositionSize}
                onChangeText={(text) => updateExposureSettings({ maxPositionSize: text })}
                placeholder="500"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />
              <View style={[styles.suffix, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={[styles.suffixText, { color: theme.textSecondary }]}>
                  USD
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.helpText, { color: theme.textSecondary }]}>
              Maximum amount to invest in a single position
            </ThemedText>
          </View>

          <View style={styles.fieldContainer}>
            <ThemedText style={styles.fieldLabel}>Maximum Position %</ThemedText>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.paramInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: BrandColors.cardBorder,
                    fontFamily: Fonts?.mono,
                  },
                ]}
                value={data.exposureSettings.maxPositionPercent}
                onChangeText={(text) => updateExposureSettings({ maxPositionPercent: text })}
                placeholder="10"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />
              <View style={[styles.suffix, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={[styles.suffixText, { color: theme.textSecondary }]}>
                  %
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.helpText, { color: theme.textSecondary }]}>
              Maximum % of portfolio for any single position
            </ThemedText>
          </View>
        </View>

        <Card elevation={1} style={styles.pyramidingCard}>
          <View style={styles.pyramidingHeader}>
            <View style={styles.pyramidingInfo}>
              <View
                style={[styles.iconContainer, { backgroundColor: BrandColors.primaryLight + "20" }]}
              >
                <Feather name="layers" size={20} color={BrandColors.primaryLight} />
              </View>
              <View style={styles.pyramidingText}>
                <ThemedText style={styles.pyramidingTitle}>Enable Pyramiding</ThemedText>
                <ThemedText style={[styles.pyramidingDesc, { color: theme.textSecondary }]}>
                  Add to winning positions as they move in your favor
                </ThemedText>
              </View>
            </View>
            <Switch
              value={data.exposureSettings.pyramidingEnabled}
              onValueChange={(value) => updateExposureSettings({ pyramidingEnabled: value })}
              trackColor={{ false: theme.backgroundSecondary, true: BrandColors.primaryLight }}
              thumbColor="#FFFFFF"
            />
          </View>

          {data.exposureSettings.pyramidingEnabled ? (
            <View style={styles.pyramidingLevels}>
              <ThemedText style={styles.fieldLabel}>Maximum Pyramid Levels</ThemedText>
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.paramInput,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                      borderColor: BrandColors.cardBorder,
                      fontFamily: Fonts?.mono,
                    },
                  ]}
                  value={data.exposureSettings.maxPyramidLevels}
                  onChangeText={(text) => updateExposureSettings({ maxPyramidLevels: text })}
                  placeholder="3"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
              <ThemedText style={[styles.helpText, { color: theme.textSecondary }]}>
                Number of times to add to a winning position
              </ThemedText>
            </View>
          ) : null}
        </Card>

        <Card elevation={1} style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <Feather name="info" size={18} color={BrandColors.primaryLight} />
            <ThemedText style={styles.tipTitle}>About Position Sizing</ThemedText>
          </View>
          <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
            Limiting individual position sizes helps diversify risk. We recommend no more than 
            10% of your portfolio in any single position.
          </ThemedText>
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
        <Button onPress={handleContinue} disabled={!isValid()} style={styles.continueButton}>
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
  fieldsContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  fieldContainer: {},
  fieldLabel: {
    ...Typography.caption,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  textInput: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    ...Typography.body,
  },
  paramInput: {
    flex: 1,
  },
  suffix: {
    paddingHorizontal: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderTopRightRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
    marginLeft: -BorderRadius.sm,
  },
  suffixText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  helpText: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  pyramidingCard: {
    marginBottom: Spacing.xl,
  },
  pyramidingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pyramidingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  pyramidingText: {
    flex: 1,
  },
  pyramidingTitle: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: 2,
  },
  pyramidingDesc: {
    ...Typography.caption,
  },
  pyramidingLevels: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  tipCard: {},
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
