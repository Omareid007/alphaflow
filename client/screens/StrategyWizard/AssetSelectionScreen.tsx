import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useWizard } from "./context";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

interface TopAsset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  tradable: boolean;
  fractionable: boolean;
  assetClass: "us_equity" | "crypto";
}

interface Asset {
  symbol: string;
  name: string;
  type: "crypto" | "stock" | "etf";
  price?: number;
  change24h?: number;
  volume?: number;
}

type TabType = "all" | "stocks" | "crypto" | "etfs";

type NavigationProp = NativeStackNavigationProp<StrategyWizardParamList, "AssetSelection">;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function AssetSelectionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateData } = useWizard();
  const [selectedAssets, setSelectedAssets] = useState<string[]>(data.assets);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: topStocks, isLoading: stocksLoading } = useQuery<TopAsset[]>({
    queryKey: ["/api/alpaca/top-stocks?limit=25"],
  });

  const { data: topCrypto, isLoading: cryptoLoading } = useQuery<TopAsset[]>({
    queryKey: ["/api/alpaca/top-crypto?limit=25"],
  });

  const { data: topETFs, isLoading: etfsLoading } = useQuery<TopAsset[]>({
    queryKey: ["/api/alpaca/top-etfs?limit=25"],
  });

  const stockAssets = useMemo((): Asset[] => {
    if (!topStocks) return [];
    return topStocks.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      type: "stock" as const,
      price: s.price,
      change24h: s.change,
      volume: s.volume,
    }));
  }, [topStocks]);

  const cryptoAssets = useMemo((): Asset[] => {
    if (!topCrypto) return [];
    return topCrypto.map((c) => ({
      symbol: c.symbol,
      name: c.name,
      type: "crypto" as const,
      price: c.price,
      change24h: c.change,
      volume: c.volume,
    }));
  }, [topCrypto]);

  const etfAssets = useMemo((): Asset[] => {
    if (!topETFs) return [];
    return topETFs.map((e) => ({
      symbol: e.symbol,
      name: e.name,
      type: "etf" as const,
      price: e.price,
      change24h: e.change,
      volume: e.volume,
    }));
  }, [topETFs]);

  const filteredAssets = useMemo(() => {
    let assets: Asset[] = [];
    
    if (activeTab === "stocks") {
      assets = stockAssets;
    } else if (activeTab === "crypto") {
      assets = cryptoAssets;
    } else if (activeTab === "etfs") {
      assets = etfAssets;
    } else {
      assets = [...stockAssets, ...cryptoAssets, ...etfAssets];
    }

    if (debouncedSearch.length >= 2) {
      const search = debouncedSearch.toLowerCase();
      return assets.filter(
        (a) =>
          a.symbol.toLowerCase().includes(search) ||
          a.name.toLowerCase().includes(search)
      );
    }

    return assets;
  }, [activeTab, stockAssets, cryptoAssets, etfAssets, debouncedSearch]);

  const toggleAsset = useCallback((symbol: string) => {
    setSelectedAssets((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  }, []);

  const handleContinue = () => {
    updateData({ assets: selectedAssets });
    navigation.navigate("TriggerConditions");
  };

  const isLoading = stocksLoading || cryptoLoading || etfsLoading;

  const tabs: { key: TabType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "stocks", label: "Stocks" },
    { key: "crypto", label: "Crypto" },
    { key: "etfs", label: "ETFs" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <View style={[styles.searchContainer, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="search" size={18} color={theme.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text, fontFamily: Fonts?.sans }]}
          placeholder="Search assets..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery("")} style={styles.clearButton}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key ? { backgroundColor: BrandColors.primaryLight } : undefined,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <ThemedText
              style={[
                styles.tabText,
                activeTab === tab.key ? styles.tabTextActive : { color: theme.textSecondary },
              ]}
            >
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BrandColors.primaryLight} />
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading assets from Alpaca...
            </ThemedText>
          </View>
        ) : (
          <>
            {filteredAssets.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="search" size={48} color={theme.textSecondary} />
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {debouncedSearch.length > 0
                    ? "No assets found for your search"
                    : "No assets available"}
                </ThemedText>
              </View>
            ) : null}

            {(activeTab === "all" || activeTab === "stocks") && stockAssets.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="bar-chart-2" size={18} color={BrandColors.stockLayer} />
                  <ThemedText style={styles.sectionTitle}>Stocks</ThemedText>
                  <ThemedText style={[styles.sectionCount, { color: theme.textSecondary }]}>
                    ({stockAssets.length})
                  </ThemedText>
                </View>
                <View style={styles.assetGrid}>
                  {(activeTab === "all" ? stockAssets.slice(0, 10) : stockAssets)
                    .filter((a) => {
                      if (debouncedSearch.length < 2) return true;
                      const search = debouncedSearch.toLowerCase();
                      return a.symbol.toLowerCase().includes(search) || a.name.toLowerCase().includes(search);
                    })
                    .map((asset) => (
                      <AssetCard
                        key={asset.symbol}
                        asset={asset}
                        selected={selectedAssets.includes(asset.symbol)}
                        onPress={() => toggleAsset(asset.symbol)}
                      />
                    ))}
                </View>
              </View>
            ) : null}

            {(activeTab === "all" || activeTab === "crypto") && cryptoAssets.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="dollar-sign" size={18} color={BrandColors.cryptoLayer} />
                  <ThemedText style={styles.sectionTitle}>Crypto</ThemedText>
                  <ThemedText style={[styles.sectionCount, { color: theme.textSecondary }]}>
                    ({cryptoAssets.length})
                  </ThemedText>
                </View>
                <View style={styles.assetGrid}>
                  {(activeTab === "all" ? cryptoAssets.slice(0, 10) : cryptoAssets)
                    .filter((a) => {
                      if (debouncedSearch.length < 2) return true;
                      const search = debouncedSearch.toLowerCase();
                      return a.symbol.toLowerCase().includes(search) || a.name.toLowerCase().includes(search);
                    })
                    .map((asset) => (
                      <AssetCard
                        key={asset.symbol}
                        asset={asset}
                        selected={selectedAssets.includes(asset.symbol)}
                        onPress={() => toggleAsset(asset.symbol)}
                      />
                    ))}
                </View>
              </View>
            ) : null}

            {(activeTab === "all" || activeTab === "etfs") && etfAssets.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="layers" size={18} color={BrandColors.primaryLight} />
                  <ThemedText style={styles.sectionTitle}>ETFs</ThemedText>
                  <ThemedText style={[styles.sectionCount, { color: theme.textSecondary }]}>
                    ({etfAssets.length})
                  </ThemedText>
                </View>
                <View style={styles.assetGrid}>
                  {(activeTab === "all" ? etfAssets.slice(0, 10) : etfAssets)
                    .filter((a) => {
                      if (debouncedSearch.length < 2) return true;
                      const search = debouncedSearch.toLowerCase();
                      return a.symbol.toLowerCase().includes(search) || a.name.toLowerCase().includes(search);
                    })
                    .map((asset) => (
                      <AssetCard
                        key={asset.symbol}
                        asset={asset}
                        selected={selectedAssets.includes(asset.symbol)}
                        onPress={() => toggleAsset(asset.symbol)}
                      />
                    ))}
                </View>
              </View>
            ) : null}
          </>
        )}
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
  asset: Asset;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  
  const getBorderColor = () => {
    if (asset.type === "crypto") return BrandColors.cryptoLayer;
    if (asset.type === "etf") return BrandColors.primaryLight;
    return BrandColors.stockLayer;
  };
  
  const borderColor = getBorderColor();

  const formatPrice = (price?: number) => {
    if (!price) return null;
    if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  const formatChange = (change?: number) => {
    if (change === undefined || change === null) return null;
    const prefix = change >= 0 ? "+" : "";
    return `${prefix}${change.toFixed(2)}%`;
  };

  const formatVolume = (volume?: number) => {
    if (!volume) return null;
    if (volume >= 1000000000) return `${(volume / 1000000000).toFixed(1)}B`;
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

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
        <View style={styles.assetMainInfo}>
          <View style={styles.symbolRow}>
            <ThemedText style={styles.assetSymbol}>{asset.symbol}</ThemedText>
            <View style={[styles.typeBadge, { backgroundColor: `${borderColor}20` }]}>
              <ThemedText style={[styles.typeBadgeText, { color: borderColor }]}>
                {asset.type.toUpperCase()}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.assetName, { color: theme.textSecondary }]} numberOfLines={1}>
            {asset.name}
          </ThemedText>
        </View>
        <View style={styles.assetPriceInfo}>
          {asset.price ? (
            <ThemedText style={[styles.assetPrice, { fontFamily: Fonts?.mono }]}>
              {formatPrice(asset.price)}
            </ThemedText>
          ) : null}
          {asset.change24h !== undefined ? (
            <ThemedText
              style={[
                styles.assetChange,
                {
                  color: asset.change24h >= 0 ? BrandColors.success : BrandColors.error,
                  fontFamily: Fonts?.mono,
                },
              ]}
            >
              {formatChange(asset.change24h)}
            </ThemedText>
          ) : null}
          {asset.volume ? (
            <ThemedText style={[styles.assetVolume, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>
              Vol: {formatVolume(asset.volume)}
            </ThemedText>
          ) : null}
        </View>
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
    paddingTop: Spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    height: "100%",
  },
  clearButton: {
    padding: Spacing.xs,
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  tab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  tabText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xl * 3,
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xl * 3,
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
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
  sectionCount: {
    ...Typography.caption,
  },
  assetGrid: {
    gap: Spacing.sm,
  },
  assetCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  assetContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginRight: Spacing.md,
  },
  assetMainInfo: {
    flex: 1,
  },
  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 2,
  },
  assetSymbol: {
    ...Typography.h4,
  },
  typeBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  assetName: {
    ...Typography.caption,
  },
  assetPriceInfo: {
    alignItems: "flex-end",
  },
  assetPrice: {
    ...Typography.body,
    fontWeight: "600",
  },
  assetChange: {
    ...Typography.small,
  },
  assetVolume: {
    fontSize: 10,
    marginTop: 2,
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
