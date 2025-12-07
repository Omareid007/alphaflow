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
import { useWizard } from "./index";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

const cryptoAssets = [
  { symbol: "BTC/USD", name: "Bitcoin", type: "crypto" },
  { symbol: "ETH/USD", name: "Ethereum", type: "crypto" },
  { symbol: "SOL/USD", name: "Solana", type: "crypto" },
  { symbol: "XRP/USD", name: "Ripple", type: "crypto" },
];

const stockAssets = [
  { symbol: "AAPL", name: "Apple Inc", type: "stock" },
  { symbol: "MSFT", name: "Microsoft", type: "stock" },
  { symbol: "GOOGL", name: "Alphabet", type: "stock" },
  { symbol: "TSLA", name: "Tesla", type: "stock" },
];

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "AssetSelection">;

export default function AssetSelectionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateData } = useWizard();
  const [selectedAssets, setSelectedAssets] = useState<string[]>(data.assets);

  const toggleAsset = (symbol: string) => {
    setSelectedAssets((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  };

  const handleContinue = () => {
    updateData({ assets: selectedAssets });
    navigation.navigate("Configuration");
  };

  const allAssets = [...cryptoAssets, ...stockAssets];

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
          <ThemedText style={styles.title}>Select Assets</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose which assets to trade with this strategy
          </ThemedText>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="dollar-sign" size={18} color={BrandColors.cryptoLayer} />
            <ThemedText style={styles.sectionTitle}>Crypto</ThemedText>
          </View>
          <View style={styles.assetGrid}>
            {cryptoAssets.map((asset) => (
              <AssetCard
                key={asset.symbol}
                asset={asset}
                selected={selectedAssets.includes(asset.symbol)}
                onPress={() => toggleAsset(asset.symbol)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="bar-chart-2" size={18} color={BrandColors.stockLayer} />
            <ThemedText style={styles.sectionTitle}>Stocks</ThemedText>
          </View>
          <View style={styles.assetGrid}>
            {stockAssets.map((asset) => (
              <AssetCard
                key={asset.symbol}
                asset={asset}
                selected={selectedAssets.includes(asset.symbol)}
                onPress={() => toggleAsset(asset.symbol)}
              />
            ))}
          </View>
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
        <ThemedText style={[styles.selectedCount, { color: theme.textSecondary }]}>
          {selectedAssets.length} asset{selectedAssets.length !== 1 ? "s" : ""} selected
        </ThemedText>
        <Button
          onPress={handleContinue}
          disabled={selectedAssets.length === 0}
          style={styles.continueButton}
        >
          Continue
        </Button>
      </View>
    </View>
  );
}

function AssetCard({
  asset,
  selected,
  onPress,
}: {
  asset: { symbol: string; name: string; type: string };
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const borderColor = asset.type === "crypto" ? BrandColors.cryptoLayer : BrandColors.stockLayer;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.assetCard,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: selected ? borderColor : BrandColors.cardBorder,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      <View style={styles.assetContent}>
        <ThemedText style={styles.assetSymbol}>{asset.symbol}</ThemedText>
        <ThemedText style={[styles.assetName, { color: theme.textSecondary }]}>
          {asset.name}
        </ThemedText>
      </View>
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: selected ? borderColor : "transparent",
            borderColor: selected ? borderColor : theme.textSecondary,
          },
        ]}
      >
        {selected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
      </View>
    </Pressable>
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
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
  },
  assetGrid: {
    gap: Spacing.sm,
  },
  assetCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  assetContent: {
    flex: 1,
  },
  assetSymbol: {
    ...Typography.h4,
    marginBottom: 2,
  },
  assetName: {
    ...Typography.caption,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  selectedCount: {
    ...Typography.caption,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  continueButton: {
    width: "100%",
  },
});
