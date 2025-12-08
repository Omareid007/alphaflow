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
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useWizard } from "./index";
import type { StrategyWizardParamList } from "@/navigation/StrategyWizardNavigator";

interface AlpacaAsset {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  asset_class: string;
  tradable: boolean;
}

interface CryptoListing {
  id: number;
  name: string;
  symbol: string;
  quote: {
    USD: {
      price: number;
      percent_change_24h: number;
      market_cap: number;
    };
  };
}

interface Asset {
  symbol: string;
  name: string;
  type: "crypto" | "stock";
  price?: number;
  change24h?: number;
}

const popularCryptoSymbols = ["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK", "MATIC"];
const popularStockSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "WMT"];

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
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data, updateData } = useWizard();
  const [selectedAssets, setSelectedAssets] = useState<string[]>(data.assets);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "crypto" | "stock">("all");

  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: cryptoListings, isLoading: cryptoLoading } = useQuery<{ data: CryptoListing[] }>({
    queryKey: ["/api/cmc/listings?limit=20"],
  });

  const { data: alpacaAssets, isLoading: stockLoading } = useQuery<AlpacaAsset[]>({
    queryKey: ["/api/alpaca/assets"],
  });

  const { data: searchedStocks, isLoading: searchingStocks } = useQuery<AlpacaAsset[]>({
    queryKey: [`/api/alpaca/assets/search?query=${debouncedSearch}`],
    enabled: debouncedSearch.length >= 2,
  });

  const { data: searchedCrypto, isLoading: searchingCrypto } = useQuery<{ data: CryptoListing[] }>({
    queryKey: [`/api/cmc/search?query=${debouncedSearch}`],
    enabled: debouncedSearch.length >= 2,
  });

  const cryptoAssets = useMemo((): Asset[] => {
    if (debouncedSearch.length >= 2 && searchedCrypto?.data) {
      return searchedCrypto.data.slice(0, 15).map((c) => ({
        symbol: `${c.symbol}/USD`,
        name: c.name,
        type: "crypto" as const,
        price: c.quote?.USD?.price,
        change24h: c.quote?.USD?.percent_change_24h,
      }));
    }
    if (!cryptoListings?.data) return [];
    return cryptoListings.data
      .filter((c) => popularCryptoSymbols.includes(c.symbol) || cryptoListings.data.indexOf(c) < 15)
      .slice(0, 15)
      .map((c) => ({
        symbol: `${c.symbol}/USD`,
        name: c.name,
        type: "crypto" as const,
        price: c.quote?.USD?.price,
        change24h: c.quote?.USD?.percent_change_24h,
      }));
  }, [cryptoListings, searchedCrypto, debouncedSearch]);

  const stockAssets = useMemo((): Asset[] => {
    if (debouncedSearch.length >= 2 && searchedStocks) {
      return searchedStocks.slice(0, 15).map((s) => ({
        symbol: s.symbol,
        name: s.name,
        type: "stock" as const,
      }));
    }
    if (!alpacaAssets) return [];
    const popular = alpacaAssets.filter((a) => popularStockSymbols.includes(a.symbol));
    const others = alpacaAssets
      .filter((a) => !popularStockSymbols.includes(a.symbol) && a.tradable)
      .slice(0, 15 - popular.length);
    return [...popular, ...others].map((s) => ({
      symbol: s.symbol,
      name: s.name,
      type: "stock" as const,
    }));
  }, [alpacaAssets, searchedStocks, debouncedSearch]);

  const filteredAssets = useMemo(() => {
    if (activeTab === "crypto") return cryptoAssets;
    if (activeTab === "stock") return stockAssets;
    return [...cryptoAssets, ...stockAssets];
  }, [activeTab, cryptoAssets, stockAssets]);

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

  const isLoading = cryptoLoading || stockLoading;
  const isSearching = searchingStocks || searchingCrypto;

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
        {(["all", "crypto", "stock"] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tab,
              activeTab === tab ? { backgroundColor: BrandColors.primaryLight } : undefined,
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <ThemedText
              style={[
                styles.tabText,
                activeTab === tab ? styles.tabTextActive : { color: theme.textSecondary },
              ]}
            >
              {tab === "all" ? "All" : tab === "crypto" ? "Crypto" : "Stocks"}
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
              Loading assets...
            </ThemedText>
          </View>
        ) : (
          <>
            {isSearching ? (
              <View style={styles.searchingIndicator}>
                <ActivityIndicator size="small" color={BrandColors.primaryLight} />
                <ThemedText style={[styles.searchingText, { color: theme.textSecondary }]}>
                  Searching...
                </ThemedText>
              </View>
            ) : null}

            {filteredAssets.length === 0 && !isSearching ? (
              <View style={styles.emptyContainer}>
                <Feather name="search" size={48} color={theme.textSecondary} />
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {debouncedSearch.length > 0
                    ? "No assets found for your search"
                    : "No assets available"}
                </ThemedText>
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
            ) : null}

            {(activeTab === "all" || activeTab === "stock") && stockAssets.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="bar-chart-2" size={18} color={BrandColors.stockLayer} />
                  <ThemedText style={styles.sectionTitle}>Stocks</ThemedText>
                  <ThemedText style={[styles.sectionCount, { color: theme.textSecondary }]}>
                    ({stockAssets.length})
                  </ThemedText>
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
  const borderColor = asset.type === "crypto" ? BrandColors.cryptoLayer : BrandColors.stockLayer;

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
          <ThemedText style={styles.assetSymbol}>{asset.symbol}</ThemedText>
          <ThemedText style={[styles.assetName, { color: theme.textSecondary }]} numberOfLines={1}>
            {asset.name}
          </ThemedText>
        </View>
        {asset.price ? (
          <View style={styles.assetPriceInfo}>
            <ThemedText style={[styles.assetPrice, { fontFamily: Fonts?.mono }]}>
              {formatPrice(asset.price)}
            </ThemedText>
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
          </View>
        ) : null}
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
  searchingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  searchingText: {
    ...Typography.caption,
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
  assetSymbol: {
    ...Typography.h4,
    marginBottom: 2,
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
