import React from "react";
import { View, StyleSheet, TextInput } from "react-native";
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
import { useWizard, CapitalAllocation } from "./context";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "CapitalAllocation">;

interface FieldConfig {
  key: keyof CapitalAllocation;
  label: string;
  placeholder: string;
  suffix: string;
  helpText: string;
}

const fields: FieldConfig[] = [
  {
    key: "totalCapital",
    label: "Total Trading Capital",
    placeholder: "10000",
    suffix: "USD",
    helpText: "The total amount you want to allocate to this strategy",
  },
  {
    key: "maxAllocationPercent",
    label: "Maximum Allocation",
    placeholder: "50",
    suffix: "%",
    helpText: "Maximum % of capital that can be invested at any time",
  },
  {
    key: "reservePercent",
    label: "Cash Reserve",
    placeholder: "20",
    suffix: "%",
    helpText: "% of capital to keep as cash reserve for opportunities",
  },
];

export default function CapitalAllocationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateCapitalAllocation } = useWizard();

  const handleContinue = () => {
    navigation.navigate("ExposureSettings");
  };

  const calculateAvailable = () => {
    const total = parseFloat(data.capitalAllocation.totalCapital) || 0;
    const maxAlloc = parseFloat(data.capitalAllocation.maxAllocationPercent) || 0;
    const reserve = parseFloat(data.capitalAllocation.reservePercent) || 0;
    const available = total * ((maxAlloc - reserve) / 100);
    return available > 0 ? available : 0;
  };

  const isValid = () => {
    const total = parseFloat(data.capitalAllocation.totalCapital);
    const maxAlloc = parseFloat(data.capitalAllocation.maxAllocationPercent);
    const reserve = parseFloat(data.capitalAllocation.reservePercent);
    return total > 0 && maxAlloc > 0 && reserve >= 0 && maxAlloc > reserve;
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
          <ThemedText style={styles.title}>Capital Allocation</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Define how much capital to allocate to this strategy
          </ThemedText>
        </View>

        <Card elevation={2} style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              Available for Trading
            </ThemedText>
            <ThemedText style={[styles.summaryValue, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>
              ${calculateAvailable().toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </ThemedText>
          </View>
        </Card>

        <View style={styles.fieldsContainer}>
          {fields.map((field) => (
            <View key={field.key} style={styles.fieldContainer}>
              <ThemedText style={styles.fieldLabel}>{field.label}</ThemedText>
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
                  value={data.capitalAllocation[field.key]}
                  onChangeText={(text) => updateCapitalAllocation({ [field.key]: text })}
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

        <Card elevation={1} style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <Feather name="shield" size={18} color={BrandColors.warning} />
            <ThemedText style={styles.tipTitle}>Risk Management Tip</ThemedText>
          </View>
          <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
            We recommend keeping at least 20% as cash reserve to take advantage of 
            unexpected opportunities and reduce risk exposure.
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
  summaryCard: {
    marginBottom: Spacing.xl,
    backgroundColor: BrandColors.primary + "10",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    ...Typography.body,
  },
  summaryValue: {
    ...Typography.h2,
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
