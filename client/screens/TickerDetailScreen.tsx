import { View, StyleSheet, ActivityIndicator, Pressable, TextInput, RefreshControl, Alert, Platform } from "react-native";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { PriceChart } from "@/components/PriceChart";
import { apiRequest } from "@/lib/query-client";
import type { AiDecision } from "@shared/schema";
import type { DashboardStackParamList } from "@/navigation/DashboardStackNavigator";

interface SnapshotData {
  dailyBar?: { c: number; h: number; l: number; o: number; v: number };
  prevDailyBar?: { c: number };
  latestTrade?: { p: number; s: number; t: string };
  latestQuote?: { ap: number; bp: number; as: number; bs: number };
}

interface MarketContext {
  marketData?: {
    price?: number;
    change?: number;
    volume?: number;
    high?: number;
    low?: number;
  };
  riskLevel?: "low" | "medium" | "high";
  suggestedQuantity?: number;
  targetPrice?: number;
  stopLoss?: number;
}

export default function TickerDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const route = useRoute<RouteProp<DashboardStackParamList, "TickerDetail">>();
  const { symbol, assetType } = route.params;

  const [refreshing, setRefreshing] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");

  const { data: snapshot, isLoading: snapshotLoading, refetch: refetchSnapshot } = useQuery<Record<string, SnapshotData>>({
    queryKey: ["/api/alpaca/snapshots", [symbol]],
    queryFn: async () => {
      const params = new URLSearchParams({ symbols: symbol });
      const response = await apiRequest("GET", `/api/alpaca/snapshots?${params.toString()}`);
      return await response.json();
    },
    refetchInterval: 15000,
    enabled: assetType === "stock",
  });

  const { data: decisions, isLoading: decisionsLoading, refetch: refetchDecisions } = useQuery<AiDecision[]>({
    queryKey: [`/api/ai-decisions?symbol=${symbol}&limit=5`],
    refetchInterval: 30000,
  });

  const { data: account, isLoading: accountLoading } = useQuery<{ buying_power: string; cash: string }>({
    queryKey: ["/api/alpaca/account"],
  });

  const executeTrade = useMutation({
    mutationFn: async (params: { side: "buy" | "sell"; quantity: number; orderType: string; limitPrice?: number }) => {
      const body: Record<string, unknown> = {
        symbol,
        side: params.side,
        quantity: params.quantity,
        orderType: params.orderType,
      };
      if (params.orderType === "limit" && params.limitPrice) {
        body.limitPrice = params.limitPrice;
      }
      const response = await apiRequest("POST", "/api/alpaca/trade", body);
      return await response.json();
    },
    onSuccess: () => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/alpaca/positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/summary"] });
      Alert.alert("Order Placed", `Your ${orderType} order has been submitted successfully.`);
    },
    onError: (error: Error) => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert("Order Failed", error.message || "Failed to place order. Please try again.");
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchSnapshot(), refetchDecisions()]);
    setRefreshing(false);
  }, [refetchSnapshot, refetchDecisions]);

  const snapshotData = snapshot?.[symbol];
  const currentPrice = snapshotData?.dailyBar?.c ?? snapshotData?.latestTrade?.p ?? 0;
  const prevClose = snapshotData?.prevDailyBar?.c ?? currentPrice;
  const priceChange = currentPrice - prevClose;
  const priceChangePercent = prevClose > 0 ? (priceChange / prevClose) * 100 : 0;
  const high24h = snapshotData?.dailyBar?.h;
  const low24h = snapshotData?.dailyBar?.l;
  const volume = snapshotData?.dailyBar?.v;
  const bidPrice = snapshotData?.latestQuote?.bp;
  const askPrice = snapshotData?.latestQuote?.ap;

  const buyingPower = parseFloat(account?.buying_power || "0");
  const parsedQuantity = parseInt(quantity, 10) || 0;
  const parsedLimitPrice = parseFloat(limitPrice) || 0;
  const estimatedCost = parsedQuantity * (orderType === "limit" ? parsedLimitPrice : currentPrice);
  const canAfford = estimatedCost <= buyingPower && estimatedCost > 0;

  const handleTrade = (side: "buy" | "sell") => {
    if (parsedQuantity <= 0) {
      Alert.alert("Invalid Quantity", "Please enter a valid quantity greater than 0.");
      return;
    }
    if (orderType === "limit" && parsedLimitPrice <= 0) {
      Alert.alert("Invalid Price", "Please enter a valid limit price.");
      return;
    }
    if (side === "buy" && !canAfford) {
      Alert.alert("Insufficient Funds", "You do not have enough buying power for this order.");
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Alert.alert(
      `Confirm ${side.toUpperCase()} Order`,
      `${side === "buy" ? "Buy" : "Sell"} ${parsedQuantity} shares of ${symbol} at ${orderType === "market" ? "market price" : `$${parsedLimitPrice.toFixed(2)}`}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            executeTrade.mutate({
              side,
              quantity: parsedQuantity,
              orderType,
              limitPrice: orderType === "limit" ? parsedLimitPrice : undefined,
            });
          },
        },
      ]
    );
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return "-";
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatVolume = (vol: number | undefined) => {
    if (!vol) return "-";
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(2)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(2)}K`;
    return vol.toString();
  };

  const formatConfidence = (confidence: string | number | null | undefined) => {
    if (confidence === null || confidence === undefined) return "N/A";
    const value = typeof confidence === "number" ? confidence : parseFloat(confidence);
    if (isNaN(value)) return "N/A";
    return `${(value * 100).toFixed(0)}%`;
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

  const getActionColor = (action: string) => {
    switch (action) {
      case "buy": return BrandColors.success;
      case "sell": return BrandColors.error;
      default: return BrandColors.neutral;
    }
  };

  const parseMarketContext = (contextStr: string | null | undefined): MarketContext | null => {
    if (!contextStr) return null;
    try {
      return JSON.parse(contextStr) as MarketContext;
    } catch {
      return null;
    }
  };

  if (snapshotLoading && assetType === "stock") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primaryLight} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading market data...
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BrandColors.primaryLight} />
      }
    >
      <View style={styles.symbolHeader}>
        <ThemedText style={styles.symbolTitle}>{symbol}</ThemedText>
        <View style={[
          styles.typeBadge,
          { backgroundColor: assetType === "crypto" ? BrandColors.cryptoLayer : BrandColors.stockLayer }
        ]}>
          <ThemedText style={styles.typeBadgeText}>
            {assetType === "crypto" ? "CRYPTO" : "STOCK"}
          </ThemedText>
        </View>
      </View>

      <Card elevation={1} style={styles.priceCard}>
        <View style={styles.priceHeader}>
          <View>
            <ThemedText style={[styles.currentPrice, { fontFamily: Fonts?.mono }]}>
              {formatPrice(currentPrice)}
            </ThemedText>
            <View style={styles.priceChangeRow}>
              <Feather
                name={priceChange >= 0 ? "trending-up" : "trending-down"}
                size={16}
                color={priceChange >= 0 ? BrandColors.success : BrandColors.error}
              />
              <ThemedText style={[
                styles.priceChange,
                { fontFamily: Fonts?.mono, color: priceChange >= 0 ? BrandColors.success : BrandColors.error }
              ]}>
                {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)} ({priceChangePercent >= 0 ? "+" : ""}{priceChangePercent.toFixed(2)}%)
              </ThemedText>
            </View>
          </View>
          <View style={styles.bidAskContainer}>
            {bidPrice ? (
              <View style={styles.bidAskRow}>
                <ThemedText style={[styles.bidAskLabel, { color: theme.textSecondary }]}>Bid</ThemedText>
                <ThemedText style={[styles.bidAskValue, { fontFamily: Fonts?.mono }]}>{formatPrice(bidPrice)}</ThemedText>
              </View>
            ) : null}
            {askPrice ? (
              <View style={styles.bidAskRow}>
                <ThemedText style={[styles.bidAskLabel, { color: theme.textSecondary }]}>Ask</ThemedText>
                <ThemedText style={[styles.bidAskValue, { fontFamily: Fonts?.mono }]}>{formatPrice(askPrice)}</ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>High</ThemedText>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{formatPrice(high24h)}</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Low</ThemedText>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{formatPrice(low24h)}</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Volume</ThemedText>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{formatVolume(volume)}</ThemedText>
          </View>
        </View>
      </Card>

      <PriceChart assetId={symbol} assetType={assetType} height={350} showTimeRangeSelector />

      <Card elevation={1} style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Feather name="shopping-cart" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.orderTitle}>Place Order</ThemedText>
        </View>

        <View style={styles.orderTypeRow}>
          <Pressable
            style={[
              styles.orderTypeButton,
              orderType === "market" ? { backgroundColor: BrandColors.primaryLight } : { borderColor: theme.textSecondary, borderWidth: 1 }
            ]}
            onPress={() => setOrderType("market")}
          >
            <ThemedText style={[styles.orderTypeText, orderType === "market" && { color: "#FFFFFF" }]}>Market</ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.orderTypeButton,
              orderType === "limit" ? { backgroundColor: BrandColors.primaryLight } : { borderColor: theme.textSecondary, borderWidth: 1 }
            ]}
            onPress={() => setOrderType("limit")}
          >
            <ThemedText style={[styles.orderTypeText, orderType === "limit" && { color: "#FFFFFF" }]}>Limit</ThemedText>
          </Pressable>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>Quantity</ThemedText>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDark ? "#1E3A5F" : "#F3F4F6", color: theme.text, fontFamily: Fonts?.mono }]}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
          {orderType === "limit" ? (
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>Limit Price</ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: isDark ? "#1E3A5F" : "#F3F4F6", color: theme.text, fontFamily: Fonts?.mono }]}
                value={limitPrice}
                onChangeText={setLimitPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.orderSummary}>
          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Estimated Cost</ThemedText>
            <ThemedText style={[styles.summaryValue, { fontFamily: Fonts?.mono }]}>
              {formatPrice(estimatedCost)}
            </ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Buying Power</ThemedText>
            <ThemedText style={[styles.summaryValue, { fontFamily: Fonts?.mono }]}>
              {formatPrice(buyingPower)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.orderButtons}>
          <Pressable
            style={[styles.buyButton, (!canAfford || executeTrade.isPending) && styles.disabledButton]}
            onPress={() => handleTrade("buy")}
            disabled={!canAfford || executeTrade.isPending}
          >
            {executeTrade.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="arrow-up-circle" size={20} color="#FFFFFF" />
                <ThemedText style={styles.buttonText}>BUY</ThemedText>
              </>
            )}
          </Pressable>
          <Pressable
            style={[styles.sellButton, executeTrade.isPending && styles.disabledButton]}
            onPress={() => handleTrade("sell")}
            disabled={executeTrade.isPending}
          >
            {executeTrade.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="arrow-down-circle" size={20} color="#FFFFFF" />
                <ThemedText style={styles.buttonText}>SELL</ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </Card>

      {decisions && decisions.length > 0 ? (
        <Card elevation={1} style={styles.decisionsCard}>
          <View style={styles.decisionsHeader}>
            <Feather name="cpu" size={20} color={BrandColors.aiLayer} />
            <ThemedText style={styles.decisionsTitle}>Recent AI Analysis</ThemedText>
          </View>
          {decisions.map((decision, index) => {
            const context = parseMarketContext(decision.marketContext);
            return (
              <View
                key={decision.id}
                style={[
                  styles.decisionRow,
                  index < decisions.length - 1 && { borderBottomWidth: 1, borderBottomColor: BrandColors.cardBorder }
                ]}
              >
                <View style={styles.decisionInfo}>
                  <View style={styles.decisionHeader}>
                    <View style={[styles.actionBadge, { backgroundColor: getActionColor(decision.action) }]}>
                      <ThemedText style={styles.actionBadgeText}>{decision.action.toUpperCase()}</ThemedText>
                    </View>
                    <ThemedText style={[styles.confidenceText, { fontFamily: Fonts?.mono }]}>
                      {formatConfidence(decision.confidence)} confidence
                    </ThemedText>
                  </View>
                  {context?.targetPrice || context?.stopLoss ? (
                    <View style={styles.targetsRow}>
                      {context.targetPrice ? (
                        <View style={styles.targetItem}>
                          <Feather name="target" size={12} color={BrandColors.success} />
                          <ThemedText style={[styles.targetText, { color: theme.textSecondary }]}>
                            {formatPrice(context.targetPrice)}
                          </ThemedText>
                        </View>
                      ) : null}
                      {context.stopLoss ? (
                        <View style={styles.targetItem}>
                          <Feather name="shield" size={12} color={BrandColors.error} />
                          <ThemedText style={[styles.targetText, { color: theme.textSecondary }]}>
                            {formatPrice(context.stopLoss)}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  <ThemedText style={[styles.reasoningText, { color: theme.textSecondary }]} numberOfLines={2}>
                    {decision.reasoning || "No reasoning provided"}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.timeText, { color: theme.textSecondary }]}>
                  {formatTime(decision.createdAt)}
                </ThemedText>
              </View>
            );
          })}
        </Card>
      ) : decisionsLoading ? (
        <Card elevation={1} style={styles.decisionsCard}>
          <View style={styles.decisionsHeader}>
            <Feather name="cpu" size={20} color={BrandColors.aiLayer} />
            <ThemedText style={styles.decisionsTitle}>Recent AI Analysis</ThemedText>
          </View>
          <ActivityIndicator size="small" color={BrandColors.aiLayer} />
        </Card>
      ) : null}
    </KeyboardAwareScrollViewCompat>
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
  symbolHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  symbolTitle: {
    ...Typography.h1,
    fontWeight: "700",
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  typeBadgeText: {
    ...Typography.small,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  priceCard: {
    marginBottom: Spacing.md,
  },
  priceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  currentPrice: {
    ...Typography.h1,
    fontWeight: "700",
  },
  priceChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  priceChange: {
    ...Typography.body,
    fontWeight: "600",
  },
  bidAskContainer: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  bidAskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  bidAskLabel: {
    ...Typography.small,
  },
  bidAskValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  statValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  orderCard: {
    marginTop: Spacing.md,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  orderTitle: {
    ...Typography.h3,
    fontWeight: "600",
  },
  orderTypeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  orderTypeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  orderTypeText: {
    ...Typography.body,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  textInput: {
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  orderSummary: {
    padding: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
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
    ...Typography.body,
    fontWeight: "600",
  },
  orderButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  buyButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: BrandColors.success,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  sellButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: BrandColors.error,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    ...Typography.body,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  decisionsCard: {
    marginTop: Spacing.md,
  },
  decisionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  decisionsTitle: {
    ...Typography.h3,
    fontWeight: "600",
  },
  decisionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
  },
  decisionInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  decisionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  actionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  actionBadgeText: {
    ...Typography.small,
    fontWeight: "700",
    color: "#FFFFFF",
    fontSize: 10,
  },
  confidenceText: {
    ...Typography.small,
    fontWeight: "500",
  },
  targetsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  targetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  targetText: {
    ...Typography.small,
  },
  reasoningText: {
    ...Typography.body,
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  timeText: {
    ...Typography.small,
  },
});
