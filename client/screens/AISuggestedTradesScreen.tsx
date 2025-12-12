import { View, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl, ScrollView, LayoutAnimation, Platform, UIManager } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useMemo, useEffect } from "react";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { apiRequest } from "@/lib/query-client";
import type { AiDecision } from "@shared/schema";
import type { DashboardStackParamList } from "@/navigation/DashboardStackNavigator";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type StatusFilter = "all" | "executed" | "pending" | "skipped" | "suggested";
type ViewMode = "list" | "grouped";
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

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

interface SymbolGroup {
  symbol: string;
  decisions: AiDecision[];
  latestAction: string;
  latestStatus: string | null;
  totalCount: number;
}

function FilterChip({ 
  label, 
  isActive, 
  onPress,
  count,
}: { 
  label: string; 
  isActive: boolean; 
  onPress: () => void;
  count?: number;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        { 
          backgroundColor: isActive ? BrandColors.aiLayer : theme.backgroundSecondary,
          borderColor: isActive ? BrandColors.aiLayer : BrandColors.cardBorder,
        },
      ]}
    >
      <ThemedText 
        style={[
          styles.filterChipText, 
          { color: isActive ? "#fff" : theme.text }
        ]}
      >
        {label}
      </ThemedText>
      {count !== undefined && count > 0 ? (
        <View style={[styles.filterChipBadge, { backgroundColor: isActive ? "rgba(255,255,255,0.3)" : BrandColors.cardBorder }]}>
          <ThemedText style={[styles.filterChipBadgeText, { color: isActive ? "#fff" : theme.textSecondary }]}>
            {count}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function AISuggestedTradesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<DashboardStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list" as ViewMode);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(0);
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());
  const [showPageSizeMenu, setShowPageSizeMenu] = useState(false);

  interface HistoryResponse {
    decisions: AiDecision[];
    total: number;
    hasMore: boolean;
    pendingAnalysis: Array<{ symbol: string; startedAt: Date; status: string }>;
  }

  const { data: historyData, isLoading, error, refetch } = useQuery<HistoryResponse>({
    queryKey: ["/api/ai-decisions/history?limit=200"],
    refetchInterval: 10000,
  });

  const allDecisions = historyData?.decisions ?? [];
  const pendingAnalysis = historyData?.pendingAnalysis ?? [];

  const normalizeStatus = (status: string | null | undefined): string => {
    if (!status) return "suggested";
    const s = status.toLowerCase();
    if (s === "executed" || s === "filled") return "executed";
    if (s === "pending" || s === "pending_execution") return "pending";
    if (s === "skipped") return "skipped";
    return "suggested";
  };

  const statusCounts = useMemo(() => {
    const counts = { all: 0, executed: 0, pending: 0, skipped: 0, suggested: 0 };
    allDecisions.forEach((d) => {
      counts.all++;
      const normalized = normalizeStatus((d as any).status);
      counts[normalized as keyof typeof counts]++;
    });
    return counts;
  }, [allDecisions]);

  const filteredDecisions = useMemo(() => {
    if (statusFilter === "all") return allDecisions;
    return allDecisions.filter((d) => normalizeStatus((d as any).status) === statusFilter);
  }, [allDecisions, statusFilter]);

  const paginatedDecisions = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredDecisions.slice(start, start + pageSize);
  }, [filteredDecisions, currentPage, pageSize]);

  const symbolGroups = useMemo((): SymbolGroup[] => {
    const groups: Record<string, AiDecision[]> = {};
    filteredDecisions.forEach((d) => {
      if (!groups[d.symbol]) groups[d.symbol] = [];
      groups[d.symbol].push(d);
    });
    return Object.entries(groups)
      .map(([symbol, decisions]) => ({
        symbol,
        decisions: decisions.slice(0, 4),
        latestAction: decisions[0]?.action || "hold",
        latestStatus: (decisions[0] as any)?.status || null,
        totalCount: decisions.length,
      }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [filteredDecisions]);

  const paginatedGroups = useMemo(() => {
    const start = currentPage * pageSize;
    return symbolGroups.slice(start, start + pageSize);
  }, [symbolGroups, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    const itemCount = viewMode === "grouped" ? symbolGroups.length : filteredDecisions.length;
    return Math.max(1, Math.ceil(itemCount / pageSize));
  }, [viewMode, symbolGroups.length, filteredDecisions.length, pageSize]);

  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [currentPage, totalPages]);

  const decisions = viewMode === "list" ? paginatedDecisions : [];

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

  const handleStatusFilter = (filter: StatusFilter) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStatusFilter(filter);
    setCurrentPage(0);
  };

  const handleViewModeToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewMode(viewMode === "list" ? "grouped" : "list");
    setCurrentPage(0);
  };

  const handlePageChange = (direction: "prev" | "next") => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (direction === "prev" && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    } else if (direction === "next" && currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageSizeChange = (size: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPageSize(size);
    setCurrentPage(0);
    setShowPageSizeMenu(false);
  };

  const toggleSymbolExpand = (symbol: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

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

  const getStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case "executed":
      case "filled":
        return BrandColors.success;
      case "pending":
      case "pending_execution":
        return BrandColors.warning;
      case "skipped":
        return BrandColors.error;
      case "analyzing":
        return BrandColors.aiLayer;
      default:
        return BrandColors.neutral;
    }
  };

  const getStatusLabel = (status: string | null | undefined) => {
    switch (status) {
      case "executed":
      case "filled":
        return "FILLED";
      case "pending":
      case "pending_execution":
        return "PENDING";
      case "skipped":
        return "SKIPPED";
      case "analyzing":
        return "ANALYZING";
      default:
        return "SUGGESTED";
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

  const renderGroupedItem = ({ item: group }: { item: SymbolGroup }) => {
    const isExpanded = expandedSymbols.has(group.symbol);
    const liveData = getLiveData(group.symbol);
    
    return (
      <Card elevation={1} style={styles.groupCard}>
        <Pressable onPress={() => toggleSymbolExpand(group.symbol)}>
          <View style={styles.groupHeader}>
            <View style={styles.groupTitleRow}>
              <ThemedText style={styles.groupSymbol}>{group.symbol}</ThemedText>
              <View style={[styles.actionBadge, { backgroundColor: getActionColor(group.latestAction) }]}>
                <ThemedText style={styles.actionText}>{group.latestAction.toUpperCase()}</ThemedText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(group.latestStatus) }]}>
                <ThemedText style={styles.statusText}>{getStatusLabel(group.latestStatus)}</ThemedText>
              </View>
            </View>
            <View style={styles.groupMeta}>
              <View style={styles.tradeCountBadge}>
                <ThemedText style={styles.tradeCountText}>{group.totalCount} trades</ThemedText>
              </View>
              {liveData?.price ? (
                <ThemedText style={[styles.groupPrice, { fontFamily: Fonts?.mono }]}>
                  ${liveData.price.toFixed(2)}
                </ThemedText>
              ) : null}
              <Feather 
                name={isExpanded ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={theme.textSecondary} 
              />
            </View>
          </View>
        </Pressable>
        
        {isExpanded ? (
          <View style={styles.groupLegs}>
            <ThemedText style={[styles.legsTitle, { color: theme.textSecondary }]}>
              Last {group.decisions.length} trades
            </ThemedText>
            {group.decisions.map((decision, index) => (
              <Pressable
                key={decision.id}
                onPress={() => navigation.navigate("TickerDetail", { symbol: decision.symbol, assetType: "stock" })}
              >
                <View style={[styles.legItem, { borderTopColor: BrandColors.cardBorder }]}>
                  <View style={styles.legInfo}>
                    <View style={[styles.legActionDot, { backgroundColor: getActionColor(decision.action) }]} />
                    <ThemedText style={[styles.legAction, { color: getActionColor(decision.action) }]}>
                      {decision.action.toUpperCase()}
                    </ThemedText>
                    <View style={[styles.legStatusBadge, { backgroundColor: getStatusColor((decision as any).status) + "30" }]}>
                      <ThemedText style={[styles.legStatusText, { color: getStatusColor((decision as any).status) }]}>
                        {getStatusLabel((decision as any).status)}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.legDetails}>
                    <ThemedText style={[styles.legConfidence, { fontFamily: Fonts?.mono, color: getConfidenceColor(decision.confidence) }]}>
                      {formatConfidence(decision.confidence)}
                    </ThemedText>
                    <ThemedText style={[styles.legTime, { color: theme.textSecondary }]}>
                      {formatTime(decision.createdAt)}
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Card>
    );
  };

  if (filteredDecisions.length === 0 && !isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <View style={styles.emptyContainer}>
          <Feather name="zap" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No Suggestions Found</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            {statusFilter !== "all" 
              ? `No ${statusFilter} trades found. Try a different filter.`
              : "Start the trading agent to begin analyzing opportunities"
            }
          </ThemedText>
          {statusFilter !== "all" ? (
            <Pressable style={styles.retryButton} onPress={() => handleStatusFilter("all")}>
              <ThemedText style={styles.retryText}>Show All</ThemedText>
            </Pressable>
          ) : null}
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
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor((decision as any).status) }]}>
              <ThemedText style={styles.statusText}>{getStatusLabel((decision as any).status)}</ThemedText>
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

        {(decision as any).skipReason ? (
          <View style={styles.skipReasonSection}>
            <ThemedText style={[styles.skipReasonLabel, { color: BrandColors.error }]}>Skip Reason</ThemedText>
            <ThemedText style={[styles.skipReasonText, { color: theme.textSecondary }]}>
              {(decision as any).skipReason}
            </ThemedText>
          </View>
        ) : null}

        {(decision as any).filledPrice && parseFloat((decision as any).filledPrice) > 0 ? (
          <View style={styles.filledPriceSection}>
            <View style={styles.priceRow}>
              <View style={styles.targetRow}>
                <Feather name="check-circle" size={14} color={BrandColors.success} />
                <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>Filled At</ThemedText>
              </View>
              <ThemedText style={[styles.priceValue, { fontFamily: Fonts?.mono, color: BrandColors.success }]}>
                {formatPrice(parseFloat((decision as any).filledPrice))}
              </ThemedText>
            </View>
          </View>
        ) : null}

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

  if (viewMode === "grouped") {
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
        data={paginatedGroups}
        keyExtractor={(item) => item.symbol}
        renderItem={renderGroupedItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BrandColors.aiLayer} />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerInfo}>
                <View style={[styles.liveDot, { backgroundColor: BrandColors.aiLayer }]} />
                <ThemedText style={[styles.headerText, { color: BrandColors.aiLayer }]}>
                  AI-Powered Analysis (Grouped)
                </ThemedText>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  onPress={handleViewModeToggle}
                  style={[styles.viewModeButton, { backgroundColor: theme.backgroundSecondary }]}
                >
                  <Feather name="list" size={16} color={BrandColors.aiLayer} />
                </Pressable>
              </View>
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.filterScrollView}
              contentContainerStyle={styles.filterContainer}
            >
              <FilterChip label="All" isActive={statusFilter === "all"} onPress={() => handleStatusFilter("all")} count={statusCounts.all} />
              <FilterChip label="Executed" isActive={statusFilter === "executed"} onPress={() => handleStatusFilter("executed")} count={statusCounts.executed} />
              <FilterChip label="Pending" isActive={statusFilter === "pending"} onPress={() => handleStatusFilter("pending")} count={statusCounts.pending} />
              <FilterChip label="Skipped" isActive={statusFilter === "skipped"} onPress={() => handleStatusFilter("skipped")} count={statusCounts.skipped} />
              <FilterChip label="Suggested" isActive={statusFilter === "suggested"} onPress={() => handleStatusFilter("suggested")} count={statusCounts.suggested} />
            </ScrollView>

            <View style={styles.paginationHeader}>
              <View style={styles.pageInfo}>
                <ThemedText style={[styles.pageInfoText, { color: theme.textSecondary }]}>
                  {symbolGroups.length} symbols
                </ThemedText>
                <Pressable 
                  onPress={() => setShowPageSizeMenu(!showPageSizeMenu)}
                  style={[styles.pageSizeButton, { backgroundColor: theme.backgroundSecondary }]}
                >
                  <ThemedText style={[styles.pageSizeText, { color: theme.text }]}>{pageSize} per page</ThemedText>
                  <Feather name="chevron-down" size={14} color={theme.textSecondary} />
                </Pressable>
              </View>
              {totalPages > 1 ? (
                <View style={styles.paginationControls}>
                  <Pressable onPress={() => handlePageChange("prev")} disabled={currentPage === 0} style={[styles.pageButton, { backgroundColor: theme.backgroundSecondary }, currentPage === 0 && styles.pageButtonDisabled]}>
                    <Feather name="chevron-left" size={18} color={currentPage === 0 ? theme.textSecondary : theme.text} />
                  </Pressable>
                  <ThemedText style={[styles.pageNumber, { color: theme.text }]}>{currentPage + 1} / {totalPages}</ThemedText>
                  <Pressable onPress={() => handlePageChange("next")} disabled={currentPage >= totalPages - 1} style={[styles.pageButton, { backgroundColor: theme.backgroundSecondary }, currentPage >= totalPages - 1 && styles.pageButtonDisabled]}>
                    <Feather name="chevron-right" size={18} color={currentPage >= totalPages - 1 ? theme.textSecondary : theme.text} />
                  </Pressable>
                </View>
              ) : null}
            </View>

            {showPageSizeMenu ? (
              <View style={[styles.pageSizeMenu, { backgroundColor: theme.backgroundSecondary }]}>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <Pressable key={size} onPress={() => handlePageSizeChange(size)} style={[styles.pageSizeOption, pageSize === size && { backgroundColor: BrandColors.aiLayer + "20" }]}>
                    <ThemedText style={[styles.pageSizeOptionText, { color: pageSize === size ? BrandColors.aiLayer : theme.text }]}>{size} items</ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        }
      />
    );
  }

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
      data={paginatedDecisions}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BrandColors.aiLayer} />
      }
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <View style={[styles.liveDot, { backgroundColor: BrandColors.aiLayer }]} />
              <ThemedText style={[styles.headerText, { color: BrandColors.aiLayer }]}>
                AI-Powered Analysis
              </ThemedText>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={handleViewModeToggle}
                style={[styles.viewModeButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather 
                  name={viewMode === "list" ? "grid" : "list"} 
                  size={16} 
                  color={BrandColors.aiLayer} 
                />
              </Pressable>
            </View>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
            contentContainerStyle={styles.filterContainer}
          >
            <FilterChip 
              label="All" 
              isActive={statusFilter === "all"} 
              onPress={() => handleStatusFilter("all")} 
              count={statusCounts.all}
            />
            <FilterChip 
              label="Executed" 
              isActive={statusFilter === "executed"} 
              onPress={() => handleStatusFilter("executed")} 
              count={statusCounts.executed}
            />
            <FilterChip 
              label="Pending" 
              isActive={statusFilter === "pending"} 
              onPress={() => handleStatusFilter("pending")} 
              count={statusCounts.pending}
            />
            <FilterChip 
              label="Skipped" 
              isActive={statusFilter === "skipped"} 
              onPress={() => handleStatusFilter("skipped")} 
              count={statusCounts.skipped}
            />
            <FilterChip 
              label="Suggested" 
              isActive={statusFilter === "suggested"} 
              onPress={() => handleStatusFilter("suggested")} 
              count={statusCounts.suggested}
            />
          </ScrollView>

          <View style={styles.paginationHeader}>
            <View style={styles.pageInfo}>
              <ThemedText style={[styles.pageInfoText, { color: theme.textSecondary }]}>
                {filteredDecisions.length} decisions
              </ThemedText>
              <Pressable 
                onPress={() => setShowPageSizeMenu(!showPageSizeMenu)}
                style={[styles.pageSizeButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText style={[styles.pageSizeText, { color: theme.text }]}>
                  {pageSize} per page
                </ThemedText>
                <Feather name="chevron-down" size={14} color={theme.textSecondary} />
              </Pressable>
            </View>
            {totalPages > 1 ? (
              <View style={styles.paginationControls}>
                <Pressable
                  onPress={() => handlePageChange("prev")}
                  disabled={currentPage === 0}
                  style={[
                    styles.pageButton, 
                    { backgroundColor: theme.backgroundSecondary },
                    currentPage === 0 && styles.pageButtonDisabled
                  ]}
                >
                  <Feather name="chevron-left" size={18} color={currentPage === 0 ? theme.textSecondary : theme.text} />
                </Pressable>
                <ThemedText style={[styles.pageNumber, { color: theme.text }]}>
                  {currentPage + 1} / {totalPages}
                </ThemedText>
                <Pressable
                  onPress={() => handlePageChange("next")}
                  disabled={currentPage >= totalPages - 1}
                  style={[
                    styles.pageButton, 
                    { backgroundColor: theme.backgroundSecondary },
                    currentPage >= totalPages - 1 && styles.pageButtonDisabled
                  ]}
                >
                  <Feather name="chevron-right" size={18} color={currentPage >= totalPages - 1 ? theme.textSecondary : theme.text} />
                </Pressable>
              </View>
            ) : null}
          </View>

          {showPageSizeMenu ? (
            <View style={[styles.pageSizeMenu, { backgroundColor: theme.backgroundSecondary }]}>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <Pressable
                  key={size}
                  onPress={() => handlePageSizeChange(size)}
                  style={[
                    styles.pageSizeOption,
                    pageSize === size && { backgroundColor: BrandColors.aiLayer + "20" }
                  ]}
                >
                  <ThemedText style={[
                    styles.pageSizeOptionText,
                    { color: pageSize === size ? BrandColors.aiLayer : theme.text }
                  ]}>
                    {size} items
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}
          
          {pendingAnalysis.length > 0 ? (
            <Card elevation={1} style={styles.pendingCard}>
              <View style={styles.pendingHeader}>
                <ActivityIndicator size="small" color={BrandColors.aiLayer} />
                <ThemedText style={[styles.pendingTitle, { color: BrandColors.aiLayer }]}>
                  Currently Analyzing
                </ThemedText>
              </View>
              <View style={styles.pendingList}>
                {pendingAnalysis.map((item, index) => (
                  <View key={`${item.symbol}-${index}`} style={styles.pendingItem}>
                    <View style={styles.pendingSymbolRow}>
                      <Feather name="search" size={14} color={BrandColors.aiLayer} />
                      <ThemedText style={styles.pendingSymbol}>{item.symbol}</ThemedText>
                    </View>
                    <ThemedText style={[styles.pendingStatus, { color: theme.textSecondary }]}>
                      {item.status}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
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
  pendingCard: {
    borderWidth: 1,
    borderColor: BrandColors.aiLayer,
    marginBottom: Spacing.lg,
  },
  pendingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  pendingTitle: {
    ...Typography.body,
    fontWeight: "600",
  },
  pendingList: {
    gap: Spacing.sm,
  },
  pendingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.cardBorder,
  },
  pendingSymbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  pendingSymbol: {
    ...Typography.body,
    fontWeight: "600",
  },
  pendingStatus: {
    ...Typography.small,
    textTransform: "capitalize",
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
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    ...Typography.small,
    fontWeight: "600",
    color: "#FFFFFF",
    fontSize: 10,
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
  skipReasonSection: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  skipReasonLabel: {
    ...Typography.small,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  skipReasonText: {
    ...Typography.body,
    lineHeight: 20,
  },
  filledPriceSection: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
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
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  filterChipText: {
    ...Typography.small,
    fontWeight: "600",
  },
  filterChipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
  },
  filterChipBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  filterScrollView: {
    marginBottom: Spacing.md,
  },
  filterContainer: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  viewModeButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  paginationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  pageInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  pageInfoText: {
    ...Typography.small,
  },
  pageSizeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  pageSizeText: {
    ...Typography.small,
  },
  paginationControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  pageButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageNumber: {
    ...Typography.small,
    fontWeight: "600",
    minWidth: 60,
    textAlign: "center",
  },
  pageSizeMenu: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  pageSizeOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  pageSizeOptionText: {
    ...Typography.body,
  },
  groupCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
    overflow: "hidden",
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  groupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
    flex: 1,
  },
  groupSymbol: {
    ...Typography.h4,
    fontWeight: "700",
  },
  groupMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  tradeCountBadge: {
    backgroundColor: "rgba(128,128,128,0.2)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  tradeCountText: {
    ...Typography.small,
    fontWeight: "600",
    fontSize: 10,
  },
  groupPrice: {
    ...Typography.body,
    fontWeight: "600",
  },
  groupLegs: {
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  legsTitle: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  legItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  legInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  legActionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legAction: {
    ...Typography.small,
    fontWeight: "700",
  },
  legStatusBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  legStatusText: {
    fontSize: 9,
    fontWeight: "600",
  },
  legDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  legConfidence: {
    ...Typography.small,
    fontWeight: "600",
  },
  legTime: {
    ...Typography.small,
    fontSize: 10,
  },
});
