import { View, FlatList, StyleSheet, ActivityIndicator, Image, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import type { AgentStatus, Position } from "@shared/schema";

interface AnalyticsSummary {
  totalTrades: number;
  totalPnl: string;
  winRate: string;
  winningTrades: number;
  losingTrades: number;
  openPositions: number;
  unrealizedPnl: string;
  isAgentRunning: boolean;
}

interface CryptoMarketData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  image: string;
}

function AgentStatusCard() {
  const { theme } = useTheme();

  const { data: agentStatus, isLoading } = useQuery<AgentStatus>({
    queryKey: ["/api/agent/status"],
    refetchInterval: 5000,
  });

  const { data: analytics } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary"],
    refetchInterval: 10000,
  });

  const isRunning = agentStatus?.isRunning ?? false;
  const totalPnl = parseFloat(analytics?.totalPnl || "0");

  if (isLoading) {
    return (
      <Card elevation={1} style={styles.agentCard}>
        <ActivityIndicator size="small" color={BrandColors.primaryLight} />
      </Card>
    );
  }

  return (
    <Card elevation={1} style={styles.agentCard}>
      <View style={styles.agentHeader}>
        <View style={styles.agentTitleRow}>
          <View style={[styles.statusDot, { backgroundColor: isRunning ? BrandColors.success : theme.textSecondary }]} />
          <ThemedText style={styles.agentTitle}>Trading Agent</ThemedText>
        </View>
        <ThemedText style={[styles.agentStatus, { color: isRunning ? BrandColors.success : theme.textSecondary }]}>
          {isRunning ? "Running" : "Stopped"}
        </ThemedText>
      </View>
      <View style={styles.agentStats}>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Active Positions</ThemedText>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>
            {analytics?.openPositions ?? 0}
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Total P&L</ThemedText>
          <ThemedText style={[
            styles.statValue, 
            { 
              fontFamily: Fonts?.mono, 
              color: totalPnl > 0 ? BrandColors.success : totalPnl < 0 ? BrandColors.error : BrandColors.neutral 
            }
          ]}>
            ${analytics?.totalPnl ?? "0.00"}
          </ThemedText>
        </View>
      </View>
    </Card>
  );
}

function MarketIntelligenceCard() {
  const { theme } = useTheme();
  const score = 0.65;

  return (
    <Card elevation={1} style={styles.intelligenceCard}>
      <View style={styles.cardHeader}>
        <Feather name="activity" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Market Intelligence</ThemedText>
      </View>
      <View style={styles.scoreContainer}>
        <View style={styles.scoreBar}>
          <View style={[styles.scoreFill, { width: `${score * 100}%`, backgroundColor: score < 0.3 ? BrandColors.error : score < 0.7 ? BrandColors.warning : BrandColors.success }]} />
        </View>
        <ThemedText style={[styles.scoreText, { fontFamily: Fonts?.mono }]}>{(score * 100).toFixed(0)}%</ThemedText>
      </View>
      <ThemedText style={[styles.intelligenceNote, { color: theme.textSecondary }]}>
        Data quality: Good | Sources: 3 active
      </ThemedText>
    </Card>
  );
}

function CryptoMarketsCard() {
  const { theme } = useTheme();

  const { data: cryptoMarkets, isLoading, error } = useQuery<CryptoMarketData[]>({
    queryKey: ["/api/crypto/markets?per_page=5"],
    refetchInterval: 60000,
  });

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (price >= 1) {
      return price.toFixed(2);
    }
    return price.toFixed(4);
  };

  const formatChange = (change: number): string => {
    const prefix = change >= 0 ? "+" : "";
    return `${prefix}${change.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <Card elevation={1} style={styles.cryptoCard}>
        <View style={styles.cardHeader}>
          <Feather name="trending-up" size={20} color={BrandColors.cryptoLayer} />
          <ThemedText style={styles.cardTitle}>Crypto Markets</ThemedText>
        </View>
        <ActivityIndicator size="small" color={BrandColors.primaryLight} />
      </Card>
    );
  }

  if (error || !cryptoMarkets) {
    return (
      <Card elevation={1} style={styles.cryptoCard}>
        <View style={styles.cardHeader}>
          <Feather name="trending-up" size={20} color={BrandColors.cryptoLayer} />
          <ThemedText style={styles.cardTitle}>Crypto Markets</ThemedText>
        </View>
        <View style={styles.cryptoError}>
          <Feather name="alert-circle" size={24} color={BrandColors.warning} />
          <ThemedText style={[styles.cryptoErrorText, { color: theme.textSecondary }]}>
            Unable to load market data
          </ThemedText>
        </View>
      </Card>
    );
  }

  return (
    <Card elevation={1} style={styles.cryptoCard}>
      <View style={styles.cardHeader}>
        <Feather name="trending-up" size={20} color={BrandColors.cryptoLayer} />
        <ThemedText style={styles.cardTitle}>Crypto Markets</ThemedText>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <ThemedText style={styles.liveText}>LIVE</ThemedText>
        </View>
      </View>
      {cryptoMarkets.map((coin, index) => (
        <View
          key={coin.id}
          style={[
            styles.cryptoRow,
            index < cryptoMarkets.length - 1 && { borderBottomWidth: 1, borderBottomColor: BrandColors.cardBorder }
          ]}
        >
          <View style={styles.cryptoInfo}>
            <Image source={{ uri: coin.image }} style={styles.cryptoIcon} />
            <View>
              <ThemedText style={styles.cryptoSymbol}>{coin.symbol.toUpperCase()}</ThemedText>
              <ThemedText style={[styles.cryptoName, { color: theme.textSecondary }]}>{coin.name}</ThemedText>
            </View>
          </View>
          <View style={styles.cryptoPriceInfo}>
            <ThemedText style={[styles.cryptoPrice, { fontFamily: Fonts?.mono }]}>
              ${formatPrice(coin.current_price)}
            </ThemedText>
            <ThemedText style={[
              styles.cryptoChange,
              { 
                fontFamily: Fonts?.mono,
                color: coin.price_change_percentage_24h >= 0 ? BrandColors.success : BrandColors.error
              }
            ]}>
              {formatChange(coin.price_change_percentage_24h)}
            </ThemedText>
          </View>
        </View>
      ))}
    </Card>
  );
}

interface StockQuoteData {
  [symbol: string]: {
    c: number;
    d: number;
    dp: number;
    h: number;
    l: number;
    o: number;
    pc: number;
    t: number;
  };
}

function StockMarketsCard() {
  const { theme } = useTheme();

  const { data: stockQuotes, isLoading, error } = useQuery<StockQuoteData>({
    queryKey: ["/api/stock/quotes?symbols=AAPL,GOOGL,MSFT,AMZN,TSLA"],
    refetchInterval: 60000,
  });

  const formatPrice = (price: number): string => {
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatChange = (change: number): string => {
    const prefix = change >= 0 ? "+" : "";
    return `${prefix}${change.toFixed(2)}%`;
  };

  const stockSymbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"];
  const stockNames: Record<string, string> = {
    AAPL: "Apple Inc.",
    GOOGL: "Alphabet Inc.",
    MSFT: "Microsoft Corp.",
    AMZN: "Amazon.com Inc.",
    TSLA: "Tesla Inc.",
  };

  if (isLoading) {
    return (
      <Card elevation={1} style={styles.stockCard}>
        <View style={styles.cardHeader}>
          <Feather name="bar-chart-2" size={20} color={BrandColors.stockLayer} />
          <ThemedText style={styles.cardTitle}>Stock Markets</ThemedText>
        </View>
        <ActivityIndicator size="small" color={BrandColors.primaryLight} />
      </Card>
    );
  }

  if (error || !stockQuotes || Object.keys(stockQuotes).length === 0) {
    return (
      <Card elevation={1} style={styles.stockCard}>
        <View style={styles.cardHeader}>
          <Feather name="bar-chart-2" size={20} color={BrandColors.stockLayer} />
          <ThemedText style={styles.cardTitle}>Stock Markets</ThemedText>
        </View>
        <View style={styles.stockError}>
          <Feather name="alert-circle" size={24} color={BrandColors.warning} />
          <ThemedText style={[styles.stockErrorText, { color: theme.textSecondary }]}>
            Stock data unavailable (API key required)
          </ThemedText>
        </View>
      </Card>
    );
  }

  return (
    <Card elevation={1} style={styles.stockCard}>
      <View style={styles.cardHeader}>
        <Feather name="bar-chart-2" size={20} color={BrandColors.stockLayer} />
        <ThemedText style={styles.cardTitle}>Stock Markets</ThemedText>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <ThemedText style={styles.liveText}>LIVE</ThemedText>
        </View>
      </View>
      {stockSymbols.map((symbol, index) => {
        const quote = stockQuotes[symbol];
        if (!quote || quote.c === 0) return null;
        return (
          <View
            key={symbol}
            style={[
              styles.stockRow,
              index < stockSymbols.length - 1 && { borderBottomWidth: 1, borderBottomColor: BrandColors.cardBorder }
            ]}
          >
            <View style={styles.stockInfo}>
              <View style={styles.stockIconContainer}>
                <ThemedText style={styles.stockIconText}>{symbol.charAt(0)}</ThemedText>
              </View>
              <View>
                <ThemedText style={styles.stockSymbol}>{symbol}</ThemedText>
                <ThemedText style={[styles.stockName, { color: theme.textSecondary }]}>{stockNames[symbol]}</ThemedText>
              </View>
            </View>
            <View style={styles.stockPriceInfo}>
              <ThemedText style={[styles.stockPrice, { fontFamily: Fonts?.mono }]}>
                ${formatPrice(quote.c)}
              </ThemedText>
              <ThemedText style={[
                styles.stockChange,
                { 
                  fontFamily: Fonts?.mono,
                  color: quote.dp >= 0 ? BrandColors.success : BrandColors.error
                }
              ]}>
                {formatChange(quote.dp)}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function LayerStatusCard({ layer, color }: { layer: string; color: string }) {
  const { theme } = useTheme();

  const { data: positions } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
    refetchInterval: 10000,
  });

  const layerPositions = positions?.filter(p => {
    const isCrypto = layer === "Crypto";
    const symbol = p.symbol.toUpperCase();
    if (isCrypto) {
      return symbol.includes("BTC") || symbol.includes("ETH") || symbol.includes("USD");
    }
    return !symbol.includes("BTC") && !symbol.includes("ETH");
  }) || [];

  const layerPnl = layerPositions.reduce((sum, p) => sum + parseFloat(p.unrealizedPnl || "0"), 0);

  return (
    <Card elevation={1} style={styles.layerCard}>
      <View style={styles.layerHeader}>
        <View style={[styles.layerIndicator, { backgroundColor: color }]} />
        <ThemedText style={styles.layerTitle}>{layer} Layer</ThemedText>
      </View>
      <View style={styles.layerStats}>
        <View style={styles.layerStat}>
          <ThemedText style={[styles.layerStatLabel, { color: theme.textSecondary }]}>Positions</ThemedText>
          <ThemedText style={[styles.layerStatValue, { fontFamily: Fonts?.mono }]}>{layerPositions.length}</ThemedText>
        </View>
        <View style={styles.layerStat}>
          <ThemedText style={[styles.layerStatLabel, { color: theme.textSecondary }]}>P&L</ThemedText>
          <ThemedText style={[
            styles.layerStatValue, 
            { 
              fontFamily: Fonts?.mono,
              color: layerPnl > 0 ? BrandColors.success : layerPnl < 0 ? BrandColors.error : undefined
            }
          ]}>
            ${layerPnl.toFixed(2)}
          </ThemedText>
        </View>
      </View>
    </Card>
  );
}

function PositionsList() {
  const { theme } = useTheme();

  const { data: positions, isLoading } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <Card elevation={1} style={styles.positionsCard}>
        <View style={styles.cardHeader}>
          <Feather name="briefcase" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Open Positions</ThemedText>
        </View>
        <ActivityIndicator size="small" color={BrandColors.primaryLight} />
      </Card>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="inbox" size={48} color={theme.textSecondary} />
        <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>No Open Positions</ThemedText>
        <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          Start the trading agent to begin automated trading
        </ThemedText>
      </View>
    );
  }

  return (
    <Card elevation={1} style={styles.positionsCard}>
      <View style={styles.cardHeader}>
        <Feather name="briefcase" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Open Positions ({positions.length})</ThemedText>
      </View>
      {positions.map((position, index) => {
        const pnl = parseFloat(position.unrealizedPnl || "0");
        const isCrypto = position.symbol.includes("BTC") || position.symbol.includes("ETH");
        return (
          <View
            key={position.id}
            style={[
              styles.positionRow,
              index < positions.length - 1 && { borderBottomWidth: 1, borderBottomColor: BrandColors.cardBorder }
            ]}
          >
            <View style={styles.positionInfo}>
              <View style={styles.positionSymbolRow}>
                <View style={[styles.assetTypeIndicator, { backgroundColor: isCrypto ? BrandColors.cryptoLayer : BrandColors.stockLayer }]} />
                <ThemedText style={styles.positionSymbol}>{position.symbol}</ThemedText>
                <ThemedText style={[styles.positionSide, { color: position.side === "long" ? BrandColors.success : BrandColors.error }]}>
                  {position.side.toUpperCase()}
                </ThemedText>
              </View>
              <ThemedText style={[styles.positionDetails, { color: theme.textSecondary }]}>
                {position.quantity} @ ${parseFloat(position.entryPrice).toFixed(2)}
              </ThemedText>
            </View>
            <View style={styles.positionPnl}>
              <ThemedText style={[
                styles.pnlValue, 
                { 
                  fontFamily: Fonts?.mono,
                  color: pnl > 0 ? BrandColors.success : pnl < 0 ? BrandColors.error : theme.text
                }
              ]}>
                {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const sections = [
    { key: "agent", component: <AgentStatusCard /> },
    { key: "crypto", component: <CryptoMarketsCard /> },
    { key: "stock", component: <StockMarketsCard /> },
    { key: "intelligence", component: <MarketIntelligenceCard /> },
    { key: "layers", component: (
      <View style={styles.layersRow}>
        <LayerStatusCard layer="Crypto" color={BrandColors.cryptoLayer} />
        <LayerStatusCard layer="Stock" color={BrandColors.stockLayer} />
      </View>
    )},
    { key: "positions", component: <PositionsList /> },
  ];

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl + Spacing.fabSize + Spacing.lg,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={sections}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) => item.component}
    />
  );
}

const styles = StyleSheet.create({
  agentCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  agentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  agentTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  agentTitle: {
    ...Typography.h3,
  },
  agentStatus: {
    ...Typography.caption,
    fontWeight: "600",
  },
  agentStats: {
    flexDirection: "row",
    gap: Spacing.xl,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    ...Typography.small,
    opacity: 0.7,
    marginBottom: Spacing.xs,
  },
  statValue: {
    ...Typography.h2,
  },
  intelligenceCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h4,
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  scoreBar: {
    flex: 1,
    height: 8,
    backgroundColor: BrandColors.cardBorder,
    borderRadius: 4,
    overflow: "hidden",
  },
  scoreFill: {
    height: "100%",
    borderRadius: 4,
  },
  scoreText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  intelligenceNote: {
    ...Typography.small,
  },
  layersRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  layerCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  layerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  layerIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  layerTitle: {
    ...Typography.h4,
  },
  layerStats: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  layerStat: {},
  layerStatLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  layerStatValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyTitle: {
    ...Typography.h4,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    ...Typography.caption,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  positionsCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  positionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  positionInfo: {},
  positionSymbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  assetTypeIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  positionSymbol: {
    ...Typography.body,
    fontWeight: "600",
  },
  positionSide: {
    ...Typography.small,
    fontWeight: "500",
  },
  positionDetails: {
    ...Typography.small,
    marginLeft: Spacing.md,
  },
  positionPnl: {
    alignItems: "flex-end",
  },
  pnlValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  cryptoCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  cryptoError: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  cryptoErrorText: {
    ...Typography.caption,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginLeft: "auto",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BrandColors.success,
  },
  liveText: {
    ...Typography.small,
    color: BrandColors.success,
    fontWeight: "600",
  },
  cryptoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  cryptoInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  cryptoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  cryptoSymbol: {
    ...Typography.body,
    fontWeight: "600",
  },
  cryptoName: {
    ...Typography.small,
  },
  cryptoPriceInfo: {
    alignItems: "flex-end",
  },
  cryptoPrice: {
    ...Typography.body,
    fontWeight: "600",
  },
  cryptoChange: {
    ...Typography.small,
    fontWeight: "500",
  },
  stockCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  stockError: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  stockErrorText: {
    ...Typography.caption,
  },
  stockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  stockInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  stockIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.stockLayer,
    justifyContent: "center",
    alignItems: "center",
  },
  stockIconText: {
    ...Typography.body,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stockSymbol: {
    ...Typography.body,
    fontWeight: "600",
  },
  stockName: {
    ...Typography.small,
  },
  stockPriceInfo: {
    alignItems: "flex-end",
  },
  stockPrice: {
    ...Typography.body,
    fontWeight: "600",
  },
  stockChange: {
    ...Typography.small,
    fontWeight: "500",
  },
});
