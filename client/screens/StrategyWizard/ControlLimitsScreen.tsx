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
import { useWizard, ControlLimits } from "./context";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "ControlLimits">;

interface FieldConfig {
  key: keyof Omit<ControlLimits, "tradingHoursOnly">;
  label: string;
  placeholder: string;
  suffix: string;
  helpText: string;
  icon: keyof typeof Feather.glyphMap;
}

const fields: FieldConfig[] = [
  {
    key: "maxDailyLoss",
    label: "Maximum Daily Loss",
    placeholder: "500",
    suffix: "USD",
    helpText: "Stop trading for the day if loss exceeds this amount",
    icon: "shield-off",
  },
  {
    key: "maxDailyTrades",
    label: "Maximum Daily Trades",
    placeholder: "10",
    suffix: "trades",
    helpText: "Limit the number of trades per day",
    icon: "repeat",
  },
  {
    key: "maxDrawdown",
    label: "Maximum Drawdown",
    placeholder: "15",
    suffix: "%",
    helpText: "Pause strategy if total drawdown exceeds this %",
    icon: "trending-down",
  },
  {
    key: "cooldownPeriod",
    label: "Cooldown Period",
    placeholder: "5",
    suffix: "min",
    helpText: "Wait time between consecutive trades",
    icon: "clock",
  },
];

export default function ControlLimitsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateControlLimits } = useWizard();

  const handleContinue = () => {
    navigation.navigate("Backtest");
  };

  const isValid = () => {
    const dailyLoss = parseFloat(data.controlLimits.maxDailyLoss);
    const dailyTrades = parseFloat(data.controlLimits.maxDailyTrades);
    const drawdown = parseFloat(data.controlLimits.maxDrawdown);
    return dailyLoss > 0 && dailyTrades > 0 && drawdown > 0;
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
          <ThemedText style={styles.title}>Control Limits</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Set safety limits to protect your capital
          </ThemedText>
        </View>

        <View style={styles.fieldsContainer}>
          {fields.map((field) => (
            <View
              key={field.key}
              style={[
                styles.fieldCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: BrandColors.cardBorder,
                },
              ]}
            >
              <View style={styles.fieldHeader}>
                <View style={[styles.iconContainer, { backgroundColor: BrandColors.warning + "20" }]}>
                  <Feather name={field.icon} size={18} color={BrandColors.warning} />
                </View>
                <ThemedText style={styles.fieldLabel}>{field.label}</ThemedText>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.paramInput,
                    {
                      backgroundColor: theme.backgroundRoot,
                      color: theme.text,
                      borderColor: BrandColors.cardBorder,
                      fontFamily: Fonts?.mono,
                    },
                  ]}
                  value={data.controlLimits[field.key]}
                  onChangeText={(text) => updateControlLimits({ [field.key]: text })}
                  placeholder={field.placeholder}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                />
                <View style={[styles.suffix, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText style={[styles.suffixText, { color: theme.textSecondary }]}>
                    {field.suffix}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.helpText, { color: theme.textSecondary }]}>
                {field.helpText}
              </ThemedText>
            </View>
          ))}
        </View>

        <Card elevation={1} style={styles.tradingHoursCard}>
          <View style={styles.tradingHoursContent}>
            <View style={styles.tradingHoursInfo}>
              <View
                style={[styles.iconContainer, { backgroundColor: BrandColors.primaryLight + "20" }]}
              >
                <Feather name="sun" size={20} color={BrandColors.primaryLight} />
              </View>
              <View style={styles.tradingHoursText}>
                <ThemedText style={styles.tradingHoursTitle}>Trading Hours Only</ThemedText>
                <ThemedText style={[styles.tradingHoursDesc, { color: theme.textSecondary }]}>
                  Only execute trades during regular market hours (9:30 AM - 4:00 PM ET)
                </ThemedText>
              </View>
            </View>
            <Switch
              value={data.controlLimits.tradingHoursOnly}
              onValueChange={(value) => updateControlLimits({ tradingHoursOnly: value })}
              trackColor={{ false: theme.backgroundSecondary, true: BrandColors.primaryLight }}
              thumbColor="#FFFFFF"
            />
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
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  fieldCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    ...Typography.body,
    fontWeight: "600",
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
    marginTop: Spacing.sm,
  },
  tradingHoursCard: {},
  tradingHoursContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tradingHoursInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  tradingHoursText: {
    flex: 1,
  },
  tradingHoursTitle: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: 2,
  },
  tradingHoursDesc: {
    ...Typography.caption,
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
