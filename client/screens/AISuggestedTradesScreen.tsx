import { View, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { apiRequest } from "@/lib/query-client";
import type { AiDecision } from "@shared/schema";
import type { DashboardStackParamList } from "@/navigation/DashboardStackNavigator";

interface MarketContext {
  marketData?: {
    price?: number;
    change?: number;
    volume?: number;
    high?: number;
    low?: number;
  };
  newsContext?: {
    headlines?: string[];
    sentiment?: string;
  };
  riskLevel?: "low" | "medium" | "high";
  suggestedQuantity?: number;
  targetPrice?: number;
  stopLoss?: number;
}

export default function AISuggestedTradesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<DashboardStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);

  const { data: decisions, isLoading, error, refetch } = useQuery<AiDecision[]>({
    queryKey: ["/api/ai-decisions?limit=50"],
    refetchInterval: 30000,
  });

  const { data: aiStatus } = useQuery<{ available: boolean; model: string; provider: string }>({
    queryKey: ["/api/ai/status"],
  });

  const decisionSymbols = decisions?.map(d => d.symbol).filter(Boolean).slice(0, 20) || [];
  
  const { data: liveSnapshots } = useQuery<Record<string, { 
    dailyBar?: { c: number; v: number }; 
    prevDailyBar?: { c: number };
    latestTrade?: { p: number };
  }>>({
    queryKey: ["/api/alpaca/snapshots", decisionSymbols],
    queryFn: async ({ queryKey }) => {
      const symbols = queryKey[1] as string[];
      if (!symbols || symbols.length === 0) return {};
      const params = new URLSearchParams({ symbols: symbols.join(",") });
      const response = await apiRequest("GET", `/api/alpaca/snapshots?${params.toString()}`);
      return await response.json();
    },
    enabled: decisionSymbols.length > 0,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getLiveData = (symbol: string): { price?: number; change?: number } | undefined => {
    const snapshot = liveSnapshots?.[symbol];
    if (!snapshot) return undefined;
    const price = snapshot.dailyBar?.c ?? snapshot.latestTrade?.p;
    const prevClose = snapshot.prevDailyBar?.c;
    const change = price && prevClose ? ((price - prevClose) / prevClose) * 100 : undefined;
    return { price, change };
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "buy":
        return BrandColors.success;
      case "sell":
        return BrandColors.error;
      default:
        return BrandColors.neutral;
    }
  };

  const getRiskColor = (risk: string | undefined) => {
    switch (risk) {
      case "low":
        return BrandColors.success;
      case "medium":
        return BrandColors.warning;
      case "high":
        return BrandColors.error;
      default:
        return BrandColors.neutral;
    }
  };

  const formatConfidence = (confidence: string | number | null | undefined) => {
    if (confidence === null || confidence === undefined) return "N/A";
    const value = typeof confidence === "number" ? confidence : parseFloat(confidence);
    if (isNaN(value)) return "N/A";
    return `${(value * 100).toFixed(0)}%`;
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return "-";
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTime = (dateStr: string | Date) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const parseMarketContext = (contextStr: string | null | undefined): MarketContext | null => {
    if (!contextStr) return null;
    try {
      return JSON.parse(contextStr) as MarketContext;
    } catch {
      return null;
    }
  };

  const getConfidenceColor = (confidence: string | number | null | undefined) => {
    if (confidence === null || confidence === undefined) return BrandColors.neutral;
    const value = typeof confidence === "number" ? confidence : parseFloat(confidence);
    if (isNaN(value)) return BrandColors.neutral;
    if (value >= 0.7) return BrandColors.success;
    if (value >= 0.4) return BrandColors.warning;
    return BrandColors.error;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.aiLayer} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading AI suggestions...
          </ThemedText>
        </View>
      </View>
    );
  }

  if (!aiStatus?.available) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <View style={styles.emptyContainer}>
          <Feather name="alert-circle" size={48} color={BrandColors.warning} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>AI Engine Not Configured</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Configure the OpenAI API key to enable AI-powered trade suggestions
          </ThemedText>
        </View>
      </View>
    );
  }

  if (error || !decisions) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <View style={styles.emptyContainer}>
          <Feather name="alert-circle" size={48} color={BrandColors.error} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>Failed to Load</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Unable to fetch AI trade suggestions
          </ThemedText>
          <Pressable style={styles.retryButton} onPress={() => refetch()}>
            <ThemedText style={styles.retryText}>Try Again</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (decisions.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <View style={styles.emptyContainer}>
          <Feather name="zap" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No Suggestions Yet</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Start the trading agent to begin analyzing opportunities
          </ThemedText>
        </View>
      </View>
    );
  }

  const renderItem = ({ item: decision, index }: { item: AiDecision; index: number }) => {
    const context = parseMarketContext(decision.marketContext);
    const liveData = getLiveData(decision.symbol);
    const currentPrice = liveData?.price ?? context?.marketData?.price;
    const priceChange = liveData?.change ?? context?.marketData?.change;

    return (
      <Pressable
        onPress={() => navigation.navigate("TickerDetail", { symbol: decision.symbol, assetType: "stock" })}
      >
        <Card elevation={1} style={styles.suggestionCard}>
        <View style={styles.suggestionHeader}>
          <View style={styles.symbolRow}>
            <ThemedText style={styles.symbol}>{decision.symbol}</ThemedText>
            <View style={[styles.actionBadge, { backgroundColor: getActionColor(decision.action) }]}>
              <ThemedText style={styles.actionText}>{decision.action.toUpperCase()}</ThemedText>
            </View>
            {context?.riskLevel ? (
              <View style={[styles.riskBadge, { borderColor: getRiskColor(context.riskLevel) }]}>
                <ThemedText style={[styles.riskText, { color: getRiskColor(context.riskLevel) }]}>
                  {context.riskLevel.toUpperCase()} RISK
                </ThemedText>
              </View>
            ) : null}
          </View>
          <View style={styles.confidenceContainer}>
            <ThemedText style={[styles.confidenceLabel, { color: theme.textSecondary }]}>Confidence</ThemedText>
            <ThemedText style={[styles.confidenceValue, { fontFamily: Fonts?.mono, color: getConfidenceColor(decision.confidence) }]}>
              {formatConfidence(decision.confidence)}
            </ThemedText>
          </View>
        </View>

        {currentPrice ? (
          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>Current Price</ThemedText>
              <View style={styles.priceValues}>
                <ThemedText style={[styles.priceValue, { fontFamily: Fonts?.mono }]}>
                  {formatPrice(currentPrice)}
                </ThemedText>
                {priceChange !== undefined ? (
                  <ThemedText style={[
                    styles.priceChange,
                    { fontFamily: Fonts?.mono, color: priceChange >= 0 ? BrandColors.success : BrandColors.error }
                  ]}>
                    {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                  </ThemedText>
                ) : null}
              </View>
            </View>
            {context?.targetPrice ? (
              <View style={styles.priceRow}>
                <View style={styles.targetRow}>
                  <Feather name="target" size={14} color={BrandColors.success} />
                  <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>Target</ThemedText>
                </View>
                <ThemedText style={[styles.priceValue, { fontFamily: Fonts?.mono, color: BrandColors.success }]}>
                  {formatPrice(context.targetPrice)}
                </ThemedText>
              </View>
            ) : null}
            {context?.stopLoss ? (
              <View style={styles.priceRow}>
                <View style={styles.targetRow}>
                  <Feather name="shield" size={14} color={BrandColors.error} />
                  <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>Stop Loss</ThemedText>
                </View>
                <ThemedText style={[styles.priceValue, { fontFamily: Fonts?.mono, color: BrandColors.error }]}>
                  {formatPrice(context.stopLoss)}
                </ThemedText>
              </View>
            ) : null}
            {context?.suggestedQuantity ? (
              <View style={styles.priceRow}>
                <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>Suggested Qty</ThemedText>
                <ThemedText style={[styles.priceValue, { fontFamily: Fonts?.mono }]}>
                  {context.suggestedQuantity}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.reasoningSection}>
          <ThemedText style={[styles.reasoningLabel, { color: theme.textSecondary }]}>Analysis</ThemedText>
          <ThemedText style={[styles.reasoning, { color: theme.text }]}>
            {decision.reasoning || "No reasoning provided"}
          </ThemedText>
        </View>

        <View style={styles.footer}>
          <ThemedText style={[styles.timestamp, { color: theme.textSecondary }]}>
            {formatTime(decision.createdAt)}
          </ThemedText>
          {decision.strategyId ? (
            <View style={styles.strategyBadge}>
              <Feather name="layers" size={12} color={BrandColors.primaryLight} />
              <ThemedText style={[styles.strategyText, { color: BrandColors.primaryLight }]}>Strategy-linked</ThemedText>
            </View>
          ) : null}
        </View>
      </Card>
      </Pressable>
    );
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.md,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={decisions}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BrandColors.aiLayer} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <View style={[styles.liveDot, { backgroundColor: BrandColors.aiLayer }]} />
            <ThemedText style={[styles.headerText, { color: BrandColors.aiLayer }]}>
              AI-Powered Analysis
            </ThemedText>
          </View>
          <ThemedText style={[styles.headerCount, { color: theme.textSecondary }]}>
            {decisions.length} suggestions
          </ThemedText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h3,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  retryButton: {
    marginTop: Spacing.lg,
    backgroundColor: BrandColors.aiLayer,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  retryText: {
    ...Typography.body,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerText: {
    ...Typography.body,
    fontWeight: "600",
  },
  headerCount: {
    ...Typography.small,
  },
  suggestionCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  suggestionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  symbol: {
    ...Typography.h3,
    fontWeight: "700",
  },
  actionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  actionText: {
    ...Typography.small,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  riskBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  riskText: {
    ...Typography.small,
    fontWeight: "600",
    fontSize: 10,
  },
  confidenceContainer: {
    alignItems: "flex-end",
  },
  confidenceLabel: {
    ...Typography.small,
    marginBottom: 2,
  },
  confidenceValue: {
    ...Typography.h4,
    fontWeight: "700",
  },
  priceSection: {
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    ...Typography.body,
  },
  priceValues: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  priceValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  priceChange: {
    ...Typography.small,
    fontWeight: "600",
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  reasoningSection: {
    marginBottom: Spacing.md,
  },
  reasoningLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  reasoning: {
    ...Typography.body,
    lineHeight: 22,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  timestamp: {
    ...Typography.small,
  },
  strategyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  strategyText: {
    ...Typography.small,
    fontWeight: "500",
  },
});
