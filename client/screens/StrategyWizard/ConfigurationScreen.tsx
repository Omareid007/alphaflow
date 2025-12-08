import React from "react";
import { View, StyleSheet, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useWizard, RangeParameters } from "./index";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "Configuration">;

interface FieldConfig {
  key: keyof RangeParameters;
  label: string;
  placeholder: string;
  suffix?: string;
  keyboardType: "numeric" | "decimal-pad";
  helpText?: string;
}

const fields: FieldConfig[] = [
  {
    key: "supportLevel",
    label: "Support Level",
    placeholder: "e.g. 40000",
    keyboardType: "decimal-pad",
    helpText: "Price at which to buy (lower bound)",
  },
  {
    key: "resistanceLevel",
    label: "Resistance Level",
    placeholder: "e.g. 45000",
    keyboardType: "decimal-pad",
    helpText: "Price at which to sell (upper bound)",
  },
  {
    key: "positionSize",
    label: "Position Size",
    placeholder: "100",
    suffix: "USD",
    keyboardType: "decimal-pad",
    helpText: "Amount to invest per trade",
  },
  {
    key: "stopLossPercent",
    label: "Stop Loss",
    placeholder: "2",
    suffix: "%",
    keyboardType: "decimal-pad",
    helpText: "Maximum loss before exit",
  },
  {
    key: "takeProfitPercent",
    label: "Take Profit",
    placeholder: "3",
    suffix: "%",
    keyboardType: "decimal-pad",
    helpText: "Target profit per trade",
  },
  {
    key: "maxPositions",
    label: "Max Positions",
    placeholder: "3",
    keyboardType: "numeric",
    helpText: "Maximum concurrent open positions",
  },
];

export default function ConfigurationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateData, updateParameters } = useWizard();

  const handleContinue = () => {
    navigation.navigate("AdaptiveSettings");
  };

  const isValid = () => {
    const params = data.parameters;
    const support = parseFloat(params.supportLevel);
    const resistance = parseFloat(params.resistanceLevel);
    const positionSize = parseFloat(params.positionSize);
    
    return (
      params.supportLevel.length > 0 &&
      params.resistanceLevel.length > 0 &&
      !isNaN(support) &&
      !isNaN(resistance) &&
      support < resistance &&
      positionSize > 0
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
            Set your range trading parameters
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
            placeholder="My Range Trading Strategy"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

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
                    },
                  ]}
                  value={data.parameters[field.key]}
                  onChangeText={(text) => updateParameters({ [field.key]: text })}
                  placeholder={field.placeholder}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType={field.keyboardType}
                />
                {field.suffix ? (
                  <View style={[styles.suffix, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText style={[styles.suffixText, { color: theme.textSecondary }]}>
                      {field.suffix}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              {field.helpText ? (
                <ThemedText style={[styles.helpText, { color: theme.textSecondary }]}>
                  {field.helpText}
                </ThemedText>
              ) : null}
            </View>
          ))}
        </View>
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
  fieldsContainer: {
    gap: Spacing.lg,
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
