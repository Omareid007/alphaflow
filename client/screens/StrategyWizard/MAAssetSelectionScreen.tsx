import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useWizard } from "./index";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "MAAssetSelection">;

const SUPPORTED_SYMBOLS = [
  { symbol: "BTC/USD", name: "Bitcoin", description: "24/7 crypto trading" },
  { symbol: "ETH/USD", name: "Ethereum", description: "24/7 crypto trading" },
  { symbol: "SOL/USD", name: "Solana", description: "24/7 crypto trading" },
  { symbol: "SPY", name: "S&P 500 ETF", description: "Broad US market exposure" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", description: "Tech-heavy index" },
  { symbol: "AAPL", name: "Apple Inc.", description: "Consumer technology" },
  { symbol: "MSFT", name: "Microsoft Corp.", description: "Enterprise software" },
  { symbol: "GOOGL", name: "Alphabet Inc.", description: "Search & advertising" },
  { symbol: "AMZN", name: "Amazon.com", description: "E-commerce & cloud" },
  { symbol: "NVDA", name: "NVIDIA Corp.", description: "AI & graphics chips" },
  { symbol: "META", name: "Meta Platforms", description: "Social media" },
  { symbol: "TSLA", name: "Tesla Inc.", description: "Electric vehicles" },
  { symbol: "JPM", name: "JPMorgan Chase", description: "Banking & finance" },
];

export default function MAAssetSelectionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateData } = useWizard();

  const selectedSymbol = data.assets[0] || "";

  const handleSelectSymbol = (symbol: string) => {
    updateData({ assets: [symbol] });
  };

  const handleContinue = () => {
    navigation.navigate("MARiskProfile");
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
              Step 1 of 3
            </ThemedText>
          </View>
          <ThemedText style={styles.title}>Select Asset</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose which stock or ETF to trade with the Moving Average strategy
          </ThemedText>
        </View>

        <View style={styles.symbolsGrid}>
          {SUPPORTED_SYMBOLS.map((item) => {
            const isSelected = selectedSymbol === item.symbol;
            return (
              <Pressable
                key={item.symbol}
                onPress={() => handleSelectSymbol(item.symbol)}
                style={({ pressed }) => [
                  styles.symbolCard,
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
                <View style={styles.symbolHeader}>
                  <ThemedText style={[styles.symbolTicker, { fontFamily: Fonts?.mono }]}>
                    {item.symbol}
                  </ThemedText>
                  {isSelected ? (
                    <Feather name="check-circle" size={20} color={BrandColors.primaryLight} />
                  ) : null}
                </View>
                <ThemedText style={styles.symbolName}>{item.name}</ThemedText>
                <ThemedText style={[styles.symbolDesc, { color: theme.textSecondary }]}>
                  {item.description}
                </ThemedText>
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
          disabled={!selectedSymbol}
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
  symbolsGrid: {
    gap: Spacing.md,
  },
  symbolCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  symbolHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  symbolTicker: {
    ...Typography.h3,
    fontWeight: "700",
  },
  symbolName: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  symbolDesc: {
    ...Typography.small,
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
