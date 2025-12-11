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
import { useWizard } from "./context";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "RiskDisclaimer">;

const disclaimerPoints = [
  "This is a paper trading simulation only. No real money is at risk.",
  "Past performance does not guarantee future results.",
  "Automated trading strategies can experience rapid losses.",
  "You are responsible for monitoring your strategy performance.",
  "Market conditions can change rapidly and unexpectedly.",
];

export default function RiskDisclaimerScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateData } = useWizard();
  const [acknowledged, setAcknowledged] = useState(data.riskAcknowledged);

  const handleContinue = () => {
    updateData({ riskAcknowledged: true });
    navigation.navigate("Confirmation");
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
          <View style={[styles.iconContainer, { backgroundColor: BrandColors.warning + "20" }]}>
            <Feather name="alert-triangle" size={32} color={BrandColors.warning} />
          </View>
          <ThemedText style={styles.title}>Risk Disclaimer</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Please read and acknowledge before proceeding
          </ThemedText>
        </View>

        <Card elevation={1} style={{ ...styles.disclaimerCard, borderColor: BrandColors.cardBorder }}>
          {disclaimerPoints.map((point, index) => (
            <View key={index} style={styles.bulletPoint}>
              <View style={[styles.bullet, { backgroundColor: BrandColors.warning }]} />
              <ThemedText style={[styles.bulletText, { color: theme.text }]}>
                {point}
              </ThemedText>
            </View>
          ))}
        </Card>

        <Pressable
          onPress={() => setAcknowledged(!acknowledged)}
          style={styles.checkboxRow}
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
            {acknowledged ? <Feather name="check" size={16} color="#FFFFFF" /> : null}
          </View>
          <ThemedText style={styles.checkboxLabel}>
            I understand and acknowledge the risks associated with automated trading
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
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  disclaimerCard: {
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  bulletPoint: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  bulletText: {
    ...Typography.body,
    flex: 1,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
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
