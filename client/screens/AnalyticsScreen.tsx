import { View, FlatList, StyleSheet, ActivityIndicator, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EquityCurveCard } from "@/components/EquityCurveCard";
import type { Trade, Strategy, AiDecision } from "@shared/schema";

interface EnrichedTrade extends Trade {
  aiDecision?: AiDecision | null;
  strategyName?: string | null;
}

interface TradesResponse {
  trades: EnrichedTrade[];
  total: number;
}

interface MarketData {
  symbol?: string;
  currentPrice?: number;
  priceChange24h?: number;
  priceChangePercent24h?: number;
  high24h?: number;
  low24h?: number;
  volume?: number;
}

interface MarketContext {
  marketData?: MarketData;
  riskLevel?: string;
  suggestedQuantity?: number;
  targetPrice?: number;
  stopLoss?: number;
}

const parseMarketContext = (contextStr: string | null | undefined): MarketContext | null => {
  if (!contextStr) return null;
  try {
    return JSON.parse(contextStr) as MarketContext;
  } catch {
    return null;
  }
};

const formatVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(2)}M`;
  } else if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`;
  }
  return volume.toString();
};

const getRiskLevelColor = (risk: string): string => {
  switch (risk?.toLowerCase()) {
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

interface AnalyticsSummary {
  totalPnl: string;
  realizedPnl: string;
  winRate: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  openPositions: number;
  unrealizedPnl: string;
  isAgentRunning: boolean;
}

function PerformanceMetrics() {
  const { theme } = useTheme();

  const { data: summary, isLoading, error } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary"],
    refetchInterval: 10000,
  });

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    const formatted = Math.abs(num).toFixed(2);
    return num >= 0 ? `$${formatted}` : `-$${formatted}`;
  };

  if (isLoading) {
    return (
      <View style={styles.metricsGrid}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} elevation={1} style={styles.metricCard}>
            <ActivityIndicator size="small" color={BrandColors.primaryLight} />
          </Card>
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <Card elevation={1} style={styles.errorCard}>
        <Feather name="alert-circle" size={24} color={BrandColors.error} />
        <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
          Unable to load metrics
        </ThemedText>
      </Card>
    );
  }

  const totalPnl = parseFloat(summary?.totalPnl ?? "0");
  const realizedPnl = parseFloat(summary?.realizedPnl ?? "0");
  const unrealizedPnl = parseFloat(summary?.unrealizedPnl ?? "0");
  const winRate = parseFloat(summary?.winRate ?? "0");

  const metrics = [
    { 
      label: "Total P&L", 
      value: formatCurrency(totalPnl), 
      isPositive: totalPnl >= 0,
      subtitle: null
    },
    { 
      label: "Realized", 
      value: formatCurrency(realizedPnl), 
      isPositive: realizedPnl >= 0,
      subtitle: "Closed trades"
    },
    { 
      label: "Unrealized", 
      value: formatCurrency(unrealizedPnl), 
      isPositive: unrealizedPnl >= 0,
      subtitle: "Open positions"
    },
    { 
      label: "Win Rate", 
      value: `${winRate.toFixed(1)}%`, 
      isPositive: null,
      subtitle: null
    },
  ];

  return (
    <View style={styles.metricsGrid}>
      {metrics.map((metric, index) => (
        <Card key={index} elevation={1} style={styles.metricCard}>
          <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>{metric.label}</ThemedText>
          <ThemedText 
            style={[
              styles.metricValue, 
              { fontFamily: Fonts?.mono },
              metric.isPositive === true && { color: BrandColors.success },
              metric.isPositive === false && { color: BrandColors.error },
            ]}
          >
            {metric.value}
          </ThemedText>
          {metric.subtitle ? (
            <ThemedText style={[styles.metricSubtitle, { color: theme.textSecondary, opacity: 0.7 }]}>
              {metric.subtitle}
            </ThemedText>
          ) : null}
        </Card>
      ))}
    </View>
  );
}


function WinRateCard() {
  const { theme } = useTheme();

  const { data: summary } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary"],
    refetchInterval: 10000,
  });

  const winRate = parseFloat(summary?.winRate ?? "0");
  const winCount = summary?.winningTrades ?? 0;
  const lossCount = summary?.losingTrades ?? 0;

  return (
    <Card elevation={1} style={styles.winRateCard}>
      <View style={styles.cardHeader}>
        <Feather name="target" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Win Rate</ThemedText>
      </View>
      <View style={styles.winRateContent}>
        <View style={[
          styles.circularProgress,
          winRate > 50 && { borderColor: BrandColors.success },
          winRate > 0 && winRate <= 50 && { borderColor: BrandColors.warning },
        ]}>
          <ThemedText style={[styles.winRateValue, { fontFamily: Fonts?.mono }]}>{winRate.toFixed(0)}%</ThemedText>
        </View>
        <View style={styles.winRateStats}>
          <View style={styles.winRateStat}>
            <View style={[styles.winIndicator, { backgroundColor: BrandColors.success }]} />
            <ThemedText style={[styles.winRateLabel, { color: theme.textSecondary }]}>Wins: {winCount}</ThemedText>
          </View>
          <View style={styles.winRateStat}>
            <View style={[styles.winIndicator, { backgroundColor: BrandColors.error }]} />
            <ThemedText style={[styles.winRateLabel, { color: theme.textSecondary }]}>Losses: {lossCount}</ThemedText>
          </View>
        </View>
      </View>
    </Card>
  );
}

type PnlFilter = 'all' | 'profit' | 'loss';

function FilterChip({ 
  label, 
  isActive, 
  onPress 
}: { 
  label: string; 
  isActive: boolean; 
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        { 
          backgroundColor: isActive ? BrandColors.primaryLight : theme.backgroundRoot,
          borderColor: isActive ? BrandColors.primaryLight : BrandColors.cardBorder,
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
    </Pressable>
  );
}

function FormattedMarketContext({ contextStr }: { contextStr: string }) {
  const { theme } = useTheme();
  const context = parseMarketContext(contextStr);
  
  if (!context) {
    return null;
  }

  const marketData = context.marketData;
  const priceChange = marketData?.priceChange24h ?? 0;
  const priceChangePercent = marketData?.priceChangePercent24h ?? 0;
  const isPricePositive = priceChange >= 0;

  return (
    <View style={styles.marketContextContainer}>
      <View style={styles.marketContextHeader}>
        <Feather name="bar-chart-2" size={14} color={BrandColors.primaryLight} />
        <ThemedText style={[styles.marketContextTitle, { color: theme.text }]}>
          Market Context
        </ThemedText>
      </View>
      
      {marketData ? (
        <View style={styles.marketDataGrid}>
          <View style={styles.marketDataRow}>
            <View style={styles.marketDataItem}>
              <ThemedText style={[styles.marketDataLabel, { color: theme.textSecondary }]}>
                Current Price
              </ThemedText>
              <ThemedText style={[styles.marketDataValue, { color: theme.text, fontFamily: Fonts?.mono }]}>
                ${marketData.currentPrice?.toFixed(2) ?? "N/A"}
              </ThemedText>
            </View>
            <View style={styles.marketDataItem}>
              <ThemedText style={[styles.marketDataLabel, { color: theme.textSecondary }]}>
                24h Change
              </ThemedText>
              <ThemedText style={[
                styles.marketDataValue, 
                { color: isPricePositive ? BrandColors.success : BrandColors.error, fontFamily: Fonts?.mono }
              ]}>
                {isPricePositive ? "+" : ""}{priceChange.toFixed(2)} ({isPricePositive ? "+" : ""}{priceChangePercent.toFixed(2)}%)
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.marketDataRow}>
            <View style={styles.marketDataItem}>
              <ThemedText style={[styles.marketDataLabel, { color: theme.textSecondary }]}>
                24h High
              </ThemedText>
              <ThemedText style={[styles.marketDataValue, { color: theme.text, fontFamily: Fonts?.mono }]}>
                ${marketData.high24h?.toFixed(2) ?? "N/A"}
              </ThemedText>
            </View>
            <View style={styles.marketDataItem}>
              <ThemedText style={[styles.marketDataLabel, { color: theme.textSecondary }]}>
                24h Low
              </ThemedText>
              <ThemedText style={[styles.marketDataValue, { color: theme.text, fontFamily: Fonts?.mono }]}>
                ${marketData.low24h?.toFixed(2) ?? "N/A"}
              </ThemedText>
            </View>
          </View>

          {marketData.volume ? (
            <View style={styles.marketDataRow}>
              <View style={styles.marketDataItem}>
                <ThemedText style={[styles.marketDataLabel, { color: theme.textSecondary }]}>
                  Volume
                </ThemedText>
                <ThemedText style={[styles.marketDataValue, { color: theme.text, fontFamily: Fonts?.mono }]}>
                  {formatVolume(marketData.volume)}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.tradeParamsGrid}>
        {context.riskLevel ? (
          <View style={styles.tradeParamItem}>
            <ThemedText style={[styles.marketDataLabel, { color: theme.textSecondary }]}>
              Risk Level
            </ThemedText>
            <View style={[styles.riskBadge, { backgroundColor: getRiskLevelColor(context.riskLevel) + "20" }]}>
              <ThemedText style={[styles.riskBadgeText, { color: getRiskLevelColor(context.riskLevel) }]}>
                {context.riskLevel.toUpperCase()}
              </ThemedText>
            </View>
          </View>
        ) : null}
        
        {context.targetPrice ? (
          <View style={styles.tradeParamItem}>
            <ThemedText style={[styles.marketDataLabel, { color: theme.textSecondary }]}>
              Target Price
            </ThemedText>
            <ThemedText style={[styles.marketDataValue, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>
              ${context.targetPrice.toFixed(2)}
            </ThemedText>
          </View>
        ) : null}
        
        {context.stopLoss ? (
          <View style={styles.tradeParamItem}>
            <ThemedText style={[styles.marketDataLabel, { color: theme.textSecondary }]}>
              Stop Loss
            </ThemedText>
            <ThemedText style={[styles.marketDataValue, { color: BrandColors.error, fontFamily: Fonts?.mono }]}>
              ${context.stopLoss.toFixed(2)}
            </ThemedText>
          </View>
        ) : null}

        {context.suggestedQuantity ? (
          <View style={styles.tradeParamItem}>
            <ThemedText style={[styles.marketDataLabel, { color: theme.textSecondary }]}>
              Suggested Qty
            </ThemedText>
            <ThemedText style={[styles.marketDataValue, { color: theme.text, fontFamily: Fonts?.mono }]}>
              {context.suggestedQuantity}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function TradeCard({ 
  trade, 
  isExpanded, 
  onToggle 
}: { 
  trade: EnrichedTrade; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  const pnl = trade.pnl ? parseFloat(trade.pnl) : 0;
  const isProfit = pnl >= 0;

  const formatCurrency = (value: string | number | null) => {
    if (value === null) return "$0.00";
    const num = typeof value === "string" ? parseFloat(value) : value;
    const formatted = Math.abs(num).toFixed(2);
    return num >= 0 ? `$${formatted}` : `-$${formatted}`;
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  return (
    <Pressable onPress={onToggle}>
      <View style={[styles.tradeCard, { borderColor: BrandColors.cardBorder }]}>
        <View style={styles.tradeRow}>
          <View style={styles.tradeInfo}>
            <View style={styles.tradeSymbolRow}>
              <Feather 
                name={trade.side === "buy" ? "arrow-up-circle" : "arrow-down-circle"} 
                size={18} 
                color={trade.side === "buy" ? BrandColors.success : BrandColors.error} 
              />
              <ThemedText style={styles.tradeSymbol}>{trade.symbol}</ThemedText>
              {trade.aiDecision ? (
                <View style={[styles.aiBadge, { backgroundColor: BrandColors.aiLayer + "30" }]}>
                  <Feather name="cpu" size={10} color={BrandColors.aiLayer} style={{ marginRight: 3 }} />
                  <ThemedText style={[styles.aiBadgeText, { color: BrandColors.aiLayer }]}>
                    AI
                  </ThemedText>
                </View>
              ) : null}
              {trade.strategyName ? (
                <View style={[styles.strategyBadge, { backgroundColor: BrandColors.primaryLight + "20" }]}>
                  <ThemedText style={[styles.strategyBadgeText, { color: BrandColors.primaryLight }]}>
                    {trade.strategyName}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <View style={styles.tradeMetaRow}>
              <ThemedText style={[styles.tradeDate, { color: theme.textSecondary }]}>
                {formatDate(trade.executedAt)}
              </ThemedText>
              <ThemedText style={[styles.tradeQuantity, { color: theme.textSecondary }]}>
                {trade.quantity} @ ${parseFloat(trade.price).toFixed(2)}
              </ThemedText>
            </View>
          </View>
          <View style={styles.tradePnlContainer}>
            <ThemedText 
              style={[
                styles.tradePnlValue, 
                { color: isProfit ? BrandColors.success : BrandColors.error, fontFamily: Fonts?.mono }
              ]}
            >
              {formatCurrency(trade.pnl)}
            </ThemedText>
            <Feather 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={theme.textSecondary} 
            />
          </View>
        </View>
        
        {isExpanded ? (
          <View style={[styles.tradeDetails, { borderTopColor: BrandColors.cardBorder }]}>
            {trade.aiDecision ? (
              <>
                <View style={styles.detailRow}>
                  <View style={styles.detailLabelRow}>
                    <Feather name="cpu" size={14} color={BrandColors.primaryLight} />
                    <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                      AI Decision
                    </ThemedText>
                  </View>
                  <View style={styles.confidenceBadge}>
                    <ThemedText style={styles.confidenceText}>
                      {trade.aiDecision.confidence 
                        ? `${(parseFloat(trade.aiDecision.confidence) * 100).toFixed(0)}%` 
                        : "N/A"} confidence
                    </ThemedText>
                  </View>
                </View>
                {trade.aiDecision.reasoning ? (
                  <View style={styles.reasoningContainer}>
                    <ThemedText style={[styles.reasoningText, { color: theme.text }]}>
                      {trade.aiDecision.reasoning}
                    </ThemedText>
                  </View>
                ) : null}
                {trade.aiDecision.marketContext ? (
                  <FormattedMarketContext contextStr={trade.aiDecision.marketContext} />
                ) : null}
              </>
            ) : (
              <View style={styles.noAiDecision}>
                <Feather name="info" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.noAiText, { color: theme.textSecondary }]}>
                  No AI decision data available
                </ThemedText>
              </View>
            )}
            {trade.notes ? (
              <View style={styles.notesContainer}>
                <ThemedText style={[styles.notesLabel, { color: theme.textSecondary }]}>
                  Notes
                </ThemedText>
                <ThemedText style={[styles.notesText, { color: theme.text }]}>
                  {trade.notes}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function TradeLedger() {
  const { theme } = useTheme();
  const [pnlFilter, setPnlFilter] = useState<PnlFilter>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const queryPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', String(pageSize));
    params.set('offset', String(page * pageSize));
    if (pnlFilter !== 'all') {
      params.set('pnlDirection', pnlFilter);
    }
    if (selectedSymbol) {
      params.set('symbol', selectedSymbol);
    }
    return `/api/trades/enriched?${params.toString()}`;
  }, [pnlFilter, selectedSymbol, page]);

  const { data: tradesData, isLoading } = useQuery<TradesResponse>({
    queryKey: [queryPath],
    refetchInterval: 15000,
  });

  const { data: symbols } = useQuery<string[]>({
    queryKey: ["/api/trades/symbols"],
  });

  const { data: strategies } = useQuery<Strategy[]>({
    queryKey: ["/api/strategies"],
  });

  const trades = tradesData?.trades ?? [];
  const total = tradesData?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleToggleExpand = (tradeId: string) => {
    setExpandedTradeId(expandedTradeId === tradeId ? null : tradeId);
  };

  const handlePnlFilter = (filter: PnlFilter) => {
    setPnlFilter(filter);
    setPage(0);
  };

  const handleSymbolFilter = (symbol: string | null) => {
    setSelectedSymbol(symbol);
    setPage(0);
  };

  return (
    <Card elevation={1} style={styles.ledgerCard}>
      <View style={styles.cardHeader}>
        <Feather name="list" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Trade Ledger</ThemedText>
        <View style={styles.tradeBadge}>
          <ThemedText style={styles.tradeBadgeText}>{total}</ThemedText>
        </View>
      </View>
      
      <View style={styles.filtersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip 
            label="All" 
            isActive={pnlFilter === 'all'} 
            onPress={() => handlePnlFilter('all')} 
          />
          <FilterChip 
            label="Profits" 
            isActive={pnlFilter === 'profit'} 
            onPress={() => handlePnlFilter('profit')} 
          />
          <FilterChip 
            label="Losses" 
            isActive={pnlFilter === 'loss'} 
            onPress={() => handlePnlFilter('loss')} 
          />
          {selectedSymbol ? (
            <FilterChip 
              label={`${selectedSymbol} x`} 
              isActive={true} 
              onPress={() => handleSymbolFilter(null)} 
            />
          ) : null}
        </ScrollView>
        
        {symbols && symbols.length > 0 && !selectedSymbol ? (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.symbolRow}
          >
            {symbols.slice(0, 6).map((symbol) => (
              <Pressable 
                key={symbol}
                onPress={() => handleSymbolFilter(symbol)}
                style={[styles.symbolChip, { borderColor: BrandColors.cardBorder }]}
              >
                <ThemedText style={[styles.symbolChipText, { color: theme.textSecondary }]}>
                  {symbol}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.emptyLedger}>
          <ActivityIndicator size="small" color={BrandColors.primaryLight} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            Loading trades...
          </ThemedText>
        </View>
      ) : trades.length === 0 ? (
        <View style={styles.emptyLedger}>
          <Feather name="file-text" size={32} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            {pnlFilter !== 'all' || selectedSymbol 
              ? "No trades match your filters" 
              : "No trades yet"}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.tradeList}>
          {trades.map((trade) => (
            <TradeCard
              key={trade.id}
              trade={trade}
              isExpanded={expandedTradeId === trade.id}
              onToggle={() => handleToggleExpand(trade.id)}
            />
          ))}
          
          {totalPages > 1 ? (
            <View style={styles.paginationContainer}>
              <Pressable
                onPress={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                style={[
                  styles.paginationButton,
                  { opacity: page === 0 ? 0.5 : 1 }
                ]}
              >
                <Feather name="chevron-left" size={20} color={theme.text} />
              </Pressable>
              <ThemedText style={[styles.paginationText, { color: theme.textSecondary }]}>
                {page + 1} / {totalPages}
              </ThemedText>
              <Pressable
                onPress={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                style={[
                  styles.paginationButton,
                  { opacity: page >= totalPages - 1 ? 0.5 : 1 }
                ]}
              >
                <Feather name="chevron-right" size={20} color={theme.text} />
              </Pressable>
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const sections = [
    { key: "metrics", component: <PerformanceMetrics /> },
    { key: "equity", component: <EquityCurveCard /> },
    { key: "winrate", component: <WinRateCard /> },
    { key: "ledger", component: <TradeLedger /> },
  ];

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
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
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  metricCard: {
    width: "48%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  metricLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  metricValue: {
    ...Typography.h2,
  },
  metricSubtitle: {
    ...Typography.caption,
    marginTop: 2,
  },
  chartCard: {
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
  chartPlaceholder: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  placeholderText: {
    ...Typography.caption,
  },
  winRateCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  winRateContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
  },
  circularProgress: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    borderColor: BrandColors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  winRateValue: {
    ...Typography.h2,
  },
  winRateStats: {
    gap: Spacing.sm,
  },
  winRateStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  winIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  winRateLabel: {
    ...Typography.body,
  },
  ledgerCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  emptyLedger: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.caption,
  },
  tradeList: {
    gap: Spacing.sm,
  },
  tradeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.cardBorder,
  },
  tradeInfo: {
    gap: Spacing.xs,
  },
  tradeSymbolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  tradeSymbol: {
    ...Typography.body,
    fontWeight: "600",
  },
  tradeDate: {
    ...Typography.small,
  },
  tradePnl: {
    alignItems: "flex-end",
  },
  tradePnlValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  tradePnlContainer: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  tradeCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  tradeMetaRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  tradeQuantity: {
    ...Typography.small,
  },
  tradeDetails: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  detailLabel: {
    ...Typography.small,
  },
  confidenceBadge: {
    backgroundColor: BrandColors.success + "20",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  confidenceText: {
    ...Typography.small,
    color: BrandColors.success,
    fontWeight: "600",
  },
  reasoningContainer: {
    backgroundColor: BrandColors.primaryLight + "10",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  reasoningText: {
    ...Typography.small,
    lineHeight: 20,
  },
  contextContainer: {
    gap: Spacing.xs,
  },
  contextLabel: {
    ...Typography.small,
    fontWeight: "600",
  },
  contextText: {
    ...Typography.small,
    lineHeight: 18,
  },
  marketContextContainer: {
    marginTop: Spacing.sm,
  },
  marketContextHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  marketContextTitle: {
    ...Typography.small,
    fontWeight: "600",
    marginLeft: Spacing.xs,
  },
  marketDataGrid: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  marketDataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  marketDataItem: {
    flex: 1,
  },
  marketDataLabel: {
    ...Typography.small,
    fontSize: 11,
    marginBottom: 2,
  },
  marketDataValue: {
    ...Typography.small,
    fontWeight: "600",
  },
  tradeParamsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tradeParamItem: {
    width: "50%",
    marginBottom: Spacing.sm,
  },
  riskBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: 2,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  noAiDecision: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  noAiText: {
    ...Typography.small,
  },
  notesContainer: {
    gap: Spacing.xs,
  },
  notesLabel: {
    ...Typography.small,
    fontWeight: "600",
  },
  notesText: {
    ...Typography.small,
  },
  strategyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  strategyBadgeText: {
    ...Typography.small,
    fontWeight: "500",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  filtersContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  filterChipText: {
    ...Typography.small,
    fontWeight: "500",
  },
  symbolRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  symbolChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  symbolChipText: {
    ...Typography.small,
  },
  tradeBadge: {
    backgroundColor: BrandColors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginLeft: "auto",
  },
  tradeBadgeText: {
    ...Typography.small,
    color: "#fff",
    fontWeight: "600",
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  paginationButton: {
    padding: Spacing.sm,
  },
  paginationText: {
    ...Typography.body,
  },
  errorCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  errorText: {
    ...Typography.body,
    textAlign: "center",
  },
});
