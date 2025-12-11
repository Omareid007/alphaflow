import React from "react";
import { View, StyleSheet, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useWizard, AdaptiveSettings } from "./context";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "AdaptiveSettings">;

const settingsConfig: {
  key: keyof AdaptiveSettings;
  name: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  {
    key: "useMarketSentiment",
    name: "Market Sentiment Analysis",
    description: "Use overall market sentiment to filter trade signals",
    icon: "trending-up",
  },
  {
    key: "useNewsAnalysis",
    name: "News Impact Analysis",
    description: "Factor in breaking news and headlines for each asset",
    icon: "file-text",
  },
  {
    key: "useTechnicalIndicators",
    name: "Technical Indicators",
    description: "Use RSI, MACD, and other indicators for confirmation",
    icon: "activity",
  },
  {
    key: "volatilityAdjustment",
    name: "Volatility Adjustment",
    description: "Automatically adjust position sizes based on volatility",
    icon: "sliders",
  },
];

export default function AdaptiveSettingsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateAdaptiveSettings } = useWizard();

  const handleContinue = () => {
    navigation.navigate("CapitalAllocation");
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
          <ThemedText style={styles.title}>Adaptive Settings</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Configure how the AI adapts to market conditions
          </ThemedText>
        </View>

        <Card elevation={1} style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Feather name="cpu" size={20} color={BrandColors.primaryLight} />
            <ThemedText style={styles.infoTitle}>AI-Powered Adaptation</ThemedText>
          </View>
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            These settings control how the AI trading agent adapts its decisions based on 
            real-time market data, news, and technical analysis.
          </ThemedText>
        </Card>

        <View style={styles.settings}>
          {settingsConfig.map((setting) => (
            <View
              key={setting.key}
              style={[
                styles.settingCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: BrandColors.cardBorder,
                },
              ]}
            >
              <View style={styles.settingContent}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: BrandColors.primaryLight + "20" },
                  ]}
                >
                  <Feather name={setting.icon} size={20} color={BrandColors.primaryLight} />
                </View>
                <View style={styles.settingInfo}>
                  <ThemedText style={styles.settingName}>{setting.name}</ThemedText>
                  <ThemedText style={[styles.settingDesc, { color: theme.textSecondary }]}>
                    {setting.description}
                  </ThemedText>
                </View>
                <Switch
                  value={data.adaptiveSettings[setting.key]}
                  onValueChange={(value) => updateAdaptiveSettings({ [setting.key]: value })}
                  trackColor={{ false: theme.backgroundSecondary, true: BrandColors.primaryLight }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          ))}
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
        <Button onPress={handleContinue} style={styles.continueButton}>
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
  infoCard: {
    marginBottom: Spacing.xl,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoTitle: {
    ...Typography.h4,
  },
  infoText: {
    ...Typography.body,
  },
  settings: {
    gap: Spacing.md,
  },
  settingCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  settingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  settingInfo: {
    flex: 1,
  },
  settingName: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: 2,
  },
  settingDesc: {
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
