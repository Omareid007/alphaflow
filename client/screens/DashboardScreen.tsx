import { View, FlatList, StyleSheet, ActivityIndicator, Image, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { PriceChart } from "@/components/PriceChart";
import { EquityCurveCard } from "@/components/EquityCurveCard";
import { AutonomousControlCard } from "@/components/AutonomousControlCard";
import { apiRequest } from "@/lib/query-client";
import type { AiDecision } from "@shared/schema";
import type { DashboardStackParamList } from "@/navigation/DashboardStackNavigator";

interface AnalyticsSummary {
  totalTrades: number;
  closedTradesCount: number;
  totalPnl: string;
  realizedPnl: string;
  winRate: string;
  winningTrades: number;
  losingTrades: number;
  openPositions: number;
  unrealizedPnl: string;
  isAgentRunning: boolean;
  dailyPnl: string;
  dailyTradeCount: number;
  dailyWinningTrades: number;
  dailyLosingTrades: number;
  dailyRealizedPnl: string;
  account: {
    equity: string;
    cash: string;
    buyingPower: string;
    lastEquity: string;
    portfolioValue: string;
  };
  riskControls: {
    maxPositionSizePercent: number;
    maxTotalExposurePercent: number;
    maxPositionsCount: number;
    dailyLossLimitPercent: number;
    killSwitchActive: boolean;
  };
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

interface AlpacaPosition {
  symbol: string;
  qty: string;
  qty_available: string;
  avg_entry_price: string;
  current_price: string;
  unrealized_pl: string;
  side: string;
  asset_class: string;
  market_value: string;
  cost_basis: string;
  unrealized_plpc: string;
  change_today: string;
}

function AgentStatusCard() {
  const { theme } = useTheme();

  const { data: analytics, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary"],
    refetchInterval: 5000,
  });

  const isRunning = analytics?.isAgentRunning ?? false;
  const totalPnl = parseFloat(analytics?.totalPnl || "0");
  const dailyPnl = parseFloat(analytics?.dailyPnl || "0");

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
          <ThemedText style={styles.statLabel}>Positions</ThemedText>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>
            {analytics?.openPositions ?? 0}
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText style={styles.statLabel}>Daily P/L</ThemedText>
          <ThemedText style={[
            styles.statValue, 
            { 
              fontFamily: Fonts?.mono, 
              color: dailyPnl > 0 ? BrandColors.success : dailyPnl < 0 ? BrandColors.error : BrandColors.neutral 
            }
          ]}>
            ${analytics?.dailyPnl ?? "0.00"}
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

interface AlpacaAccount {
  portfolio_value: string;
  equity: string;
  buying_power: string;
  cash: string;
  long_market_value: string;
  last_equity: string;
}

function AccountBalanceCard() {
  const { theme } = useTheme();

  const { data: account, isLoading } = useQuery<AlpacaAccount>({
    queryKey: ["/api/alpaca/account"],
    refetchInterval: 10000,
  });

  const portfolioValue = parseFloat(account?.portfolio_value || "0");
  const equity = parseFloat(account?.equity || "0");
  const buyingPower = parseFloat(account?.buying_power || "0");
  const cash = parseFloat(account?.cash || "0");
  const lastEquity = parseFloat(account?.last_equity || "0");
  const dailyChange = equity - lastEquity;
  const dailyChangePercent = lastEquity > 0 ? ((dailyChange / lastEquity) * 100) : 0;

  const formatCurrency = (value: number) => {
    return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
  };

  if (isLoading) {
    return (
      <Card elevation={2} style={styles.accountCard}>
        <ActivityIndicator size="small" color={BrandColors.primaryLight} />
      </Card>
    );
  }

  return (
    <Card elevation={2} style={styles.accountCard}>
      <View style={styles.cardHeader}>
        <Feather name="dollar-sign" size={20} color={BrandColors.success} />
        <ThemedText style={styles.cardTitle}>Account Balance</ThemedText>
      </View>
      <View style={styles.accountMainValue}>
        <ThemedText style={[styles.accountPortfolioValue, { fontFamily: Fonts?.mono }]}>
          {formatCurrency(portfolioValue)}
        </ThemedText>
        <View style={styles.accountChangeRow}>
          <ThemedText style={[
            styles.accountChange,
            { 
              fontFamily: Fonts?.mono,
              color: dailyChange >= 0 ? BrandColors.success : BrandColors.error 
            }
          ]}>
            {dailyChange >= 0 ? "+" : ""}{formatCurrency(dailyChange)} ({dailyChangePercent >= 0 ? "+" : ""}{dailyChangePercent.toFixed(2)}%)
          </ThemedText>
          <ThemedText style={[styles.accountChangeLabel, { color: theme.textSecondary }]}>today</ThemedText>
        </View>
      </View>
      <View style={styles.accountStats}>
        <View style={styles.accountStatItem}>
          <ThemedText style={[styles.accountStatLabel, { color: theme.textSecondary }]}>Buying Power</ThemedText>
          <ThemedText style={[styles.accountStatValue, { fontFamily: Fonts?.mono }]}>
            {formatCurrency(buyingPower)}
          </ThemedText>
        </View>
        <View style={styles.accountStatItem}>
          <ThemedText style={[styles.accountStatLabel, { color: theme.textSecondary }]}>Cash</ThemedText>
          <ThemedText style={[styles.accountStatValue, { fontFamily: Fonts?.mono }]}>
            {formatCurrency(cash)}
          </ThemedText>
        </View>
        <View style={styles.accountStatItem}>
          <ThemedText style={[styles.accountStatLabel, { color: theme.textSecondary }]}>Equity</ThemedText>
          <ThemedText style={[styles.accountStatValue, { fontFamily: Fonts?.mono }]}>
            {formatCurrency(equity)}
          </ThemedText>
        </View>
      </View>
    </Card>
  );
}

interface MarketIntelligenceData {
  overall: number;
  components: {
    momentum: number;
    volatility: number;
    sentiment: number;
    volume: number;
  };
  signals: {
    type: "bullish" | "bearish" | "neutral";
    source: string;
    message: string;
    strength: number;
    timestamp: string;
  }[];
  dataQuality: "excellent" | "good" | "fair" | "poor";
  activeSources: number;
  totalSources: number;
  lastUpdated: string;
}

function MarketIntelligenceCard() {
  const { theme } = useTheme();

  const { data: intelligence, isLoading, error } = useQuery<MarketIntelligenceData>({
    queryKey: ["/api/fusion/intelligence"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card elevation={1} style={styles.intelligenceCard}>
        <View style={styles.cardHeader}>
          <Feather name="activity" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Market Intelligence</ThemedText>
        </View>
        <ActivityIndicator size="small" color={BrandColors.primaryLight} />
      </Card>
    );
  }

  if (error || !intelligence) {
    return (
      <Card elevation={1} style={styles.intelligenceCard}>
        <View style={styles.cardHeader}>
          <Feather name="activity" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Market Intelligence</ThemedText>
        </View>
        <View style={styles.intelligenceError}>
          <Feather name="alert-circle" size={24} color={BrandColors.warning} />
          <ThemedText style={[styles.intelligenceErrorText, { color: theme.textSecondary }]}>
            Unable to calculate intelligence score
          </ThemedText>
        </View>
      </Card>
    );
  }

  const score = intelligence.overall;
  const getScoreColor = (s: number) => {
    if (s < 0.3) return BrandColors.error;
    if (s < 0.7) return BrandColors.warning;
    return BrandColors.success;
  };

  const getSignalIcon = (type: string) => {
    switch (type) {
      case "bullish":
        return "trending-up";
      case "bearish":
        return "trending-down";
      default:
        return "minus";
    }
  };

  const getSignalColor = (type: string) => {
    switch (type) {
      case "bullish":
        return BrandColors.success;
      case "bearish":
        return BrandColors.error;
      default:
        return BrandColors.neutral;
    }
  };

  return (
    <Card elevation={1} style={styles.intelligenceCard}>
      <View style={styles.cardHeader}>
        <Feather name="activity" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Market Intelligence</ThemedText>
        <View style={styles.liveIndicator}>
          <View style={[styles.liveDot, { backgroundColor: BrandColors.primaryLight }]} />
          <ThemedText style={[styles.liveText, { color: BrandColors.primaryLight }]}>LIVE</ThemedText>
        </View>
      </View>
      <View style={styles.scoreContainer}>
        <View style={styles.scoreBar}>
          <View style={[styles.scoreFill, { width: `${score * 100}%`, backgroundColor: getScoreColor(score) }]} />
        </View>
        <ThemedText style={[styles.scoreText, { fontFamily: Fonts?.mono }]}>{(score * 100).toFixed(0)}%</ThemedText>
      </View>
      <View style={styles.intelligenceComponents}>
        <View style={styles.componentRow}>
          <ThemedText style={[styles.componentLabel, { color: theme.textSecondary }]}>Momentum</ThemedText>
          <ThemedText style={[styles.componentValue, { fontFamily: Fonts?.mono }]}>
            {(intelligence.components.momentum * 100).toFixed(0)}%
          </ThemedText>
        </View>
        <View style={styles.componentRow}>
          <ThemedText style={[styles.componentLabel, { color: theme.textSecondary }]}>Volatility</ThemedText>
          <ThemedText style={[styles.componentValue, { fontFamily: Fonts?.mono }]}>
            {(intelligence.components.volatility * 100).toFixed(0)}%
          </ThemedText>
        </View>
        <View style={styles.componentRow}>
          <ThemedText style={[styles.componentLabel, { color: theme.textSecondary }]}>Sentiment</ThemedText>
          <ThemedText style={[styles.componentValue, { fontFamily: Fonts?.mono }]}>
            {(intelligence.components.sentiment * 100).toFixed(0)}%
          </ThemedText>
        </View>
        <View style={styles.componentRow}>
          <ThemedText style={[styles.componentLabel, { color: theme.textSecondary }]}>Volume</ThemedText>
          <ThemedText style={[styles.componentValue, { fontFamily: Fonts?.mono }]}>
            {(intelligence.components.volume * 100).toFixed(0)}%
          </ThemedText>
        </View>
      </View>
      {intelligence.signals.length > 0 ? (
        <View style={styles.signalsContainer}>
          {intelligence.signals.slice(0, 4).map((signal, index) => (
            <View key={index} style={styles.signalRow}>
              <Feather 
                name={getSignalIcon(signal.type) as keyof typeof Feather.glyphMap} 
                size={14} 
                color={getSignalColor(signal.type)} 
              />
              <ThemedText 
                style={[styles.signalText, { color: theme.textSecondary }]} 
                numberOfLines={1}
              >
                {signal.message}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
      <ThemedText style={[styles.intelligenceNote, { color: theme.textSecondary }]}>
        Data quality: {intelligence.dataQuality.charAt(0).toUpperCase() + intelligence.dataQuality.slice(1)} | Sources: {intelligence.activeSources} active
      </ThemedText>
    </Card>
  );
}

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

function AIDecisionsCard() {
  const { theme } = useTheme();

  const { data: decisions, isLoading, error } = useQuery<AiDecision[]>({
    queryKey: ["/api/ai-decisions?limit=5"],
    refetchInterval: 30000,
  });

  const { data: aiStatus } = useQuery<{ available: boolean; model: string; provider: string }>({
    queryKey: ["/api/ai/status"],
  });

  const decisionSymbols = decisions?.map(d => d.symbol).filter(Boolean).slice(0, 5) || [];
  
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


  if (isLoading) {
    return (
      <Card elevation={1} style={styles.aiCard}>
        <View style={styles.cardHeader}>
          <Feather name="cpu" size={20} color={BrandColors.aiLayer} />
          <ThemedText style={styles.cardTitle}>AI Decisions</ThemedText>
        </View>
        <ActivityIndicator size="small" color={BrandColors.primaryLight} />
      </Card>
    );
  }

  if (!aiStatus?.available) {
    return (
      <Card elevation={1} style={styles.aiCard}>
        <View style={styles.cardHeader}>
          <Feather name="cpu" size={20} color={BrandColors.aiLayer} />
          <ThemedText style={styles.cardTitle}>AI Decisions</ThemedText>
        </View>
        <View style={styles.aiStatusRow}>
          <Feather name="alert-circle" size={20} color={BrandColors.warning} />
          <ThemedText style={[styles.aiStatusText, { color: theme.textSecondary }]}>
            AI engine not configured
          </ThemedText>
        </View>
      </Card>
    );
  }

  if (error || !decisions) {
    return (
      <Card elevation={1} style={styles.aiCard}>
        <View style={styles.cardHeader}>
          <Feather name="cpu" size={20} color={BrandColors.aiLayer} />
          <ThemedText style={styles.cardTitle}>AI Decisions</ThemedText>
        </View>
        <View style={styles.aiStatusRow}>
          <Feather name="alert-circle" size={20} color={BrandColors.error} />
          <ThemedText style={[styles.aiStatusText, { color: theme.textSecondary }]}>
            Failed to load decisions
          </ThemedText>
        </View>
      </Card>
    );
  }

  if (decisions.length === 0) {
    return (
      <Card elevation={1} style={styles.aiCard}>
        <View style={styles.cardHeader}>
          <Feather name="cpu" size={20} color={BrandColors.aiLayer} />
          <ThemedText style={styles.cardTitle}>AI Decisions</ThemedText>
          <View style={styles.aiActiveIndicator}>
            <View style={[styles.liveDot, { backgroundColor: BrandColors.aiLayer }]} />
            <ThemedText style={[styles.liveText, { color: BrandColors.aiLayer }]}>READY</ThemedText>
          </View>
        </View>
        <View style={styles.aiEmptyState}>
          <Feather name="zap" size={32} color={theme.textSecondary} />
          <ThemedText style={[styles.aiEmptyText, { color: theme.textSecondary }]}>
            No AI decisions yet
          </ThemedText>
          <ThemedText style={[styles.aiEmptySubtext, { color: theme.textSecondary }]}>
            Start the agent to analyze opportunities
          </ThemedText>
        </View>
      </Card>
    );
  }

  return (
    <Card elevation={1} style={styles.aiCard}>
      <View style={styles.cardHeader}>
        <Feather name="cpu" size={20} color={BrandColors.aiLayer} />
        <ThemedText style={styles.cardTitle}>AI Decisions</ThemedText>
        <View style={styles.aiActiveIndicator}>
          <View style={[styles.liveDot, { backgroundColor: BrandColors.aiLayer }]} />
          <ThemedText style={[styles.liveText, { color: BrandColors.aiLayer }]}>ACTIVE</ThemedText>
        </View>
      </View>
      {decisions.map((decision, index) => {
        const context = parseMarketContext(decision.marketContext);
        const liveData = getLiveData(decision.symbol);
        const currentPrice = liveData?.price ?? context?.marketData?.price;
        const priceChange = liveData?.change ?? context?.marketData?.change;

        return (
          <View
            key={decision.id}
            style={[
              styles.aiDecisionRow,
              index < decisions.length - 1 && { borderBottomWidth: 1, borderBottomColor: BrandColors.cardBorder }
            ]}
          >
            <View style={styles.aiDecisionInfo}>
              <View style={styles.aiDecisionHeader}>
                <ThemedText style={styles.aiSymbol}>{decision.symbol}</ThemedText>
                <View style={[styles.aiActionBadge, { backgroundColor: getActionColor(decision.action) }]}>
                  <ThemedText style={styles.aiActionText}>{decision.action.toUpperCase()}</ThemedText>
                </View>
                {context?.riskLevel ? (
                  <View style={[styles.aiRiskBadge, { borderColor: getRiskColor(context.riskLevel) }]}>
                    <ThemedText style={[styles.aiRiskText, { color: getRiskColor(context.riskLevel) }]}>
                      {context.riskLevel.toUpperCase()}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              {currentPrice ? (
                <View style={styles.aiPriceRow}>
                  <ThemedText style={[styles.aiCurrentPrice, { fontFamily: Fonts?.mono }]}>
                    {formatPrice(currentPrice)}
                  </ThemedText>
                  {priceChange !== undefined ? (
                    <ThemedText style={[
                      styles.aiPriceChange,
                      { 
                        fontFamily: Fonts?.mono,
                        color: priceChange >= 0 ? BrandColors.success : BrandColors.error 
                      }
                    ]}>
                      {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}
              {context?.targetPrice || context?.stopLoss ? (
                <View style={styles.aiTargetsRow}>
                  {context.targetPrice ? (
                    <View style={styles.aiTargetItem}>
                      <Feather name="target" size={12} color={BrandColors.success} />
                      <ThemedText style={[styles.aiTargetText, { color: theme.textSecondary }]}>
                        Target: {formatPrice(context.targetPrice)}
                      </ThemedText>
                    </View>
                  ) : null}
                  {context.stopLoss ? (
                    <View style={styles.aiTargetItem}>
                      <Feather name="shield" size={12} color={BrandColors.error} />
                      <ThemedText style={[styles.aiTargetText, { color: theme.textSecondary }]}>
                        Stop: {formatPrice(context.stopLoss)}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <ThemedText style={[styles.aiReasoning, { color: theme.textSecondary }]} numberOfLines={2}>
                {decision.reasoning || "No reasoning provided"}
              </ThemedText>
            </View>
            <View style={styles.aiDecisionMeta}>
              <ThemedText style={[styles.aiConfidence, { fontFamily: Fonts?.mono }]}>
                {formatConfidence(decision.confidence)}
              </ThemedText>
              <ThemedText style={[styles.aiTime, { color: theme.textSecondary }]}>
                {formatTime(decision.createdAt)}
              </ThemedText>
              {context?.suggestedQuantity ? (
                <ThemedText style={[styles.aiQty, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>
                  Qty: {context.suggestedQuantity}
                </ThemedText>
              ) : null}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function AISuggestedTradesCard() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<DashboardStackParamList>>();

  const { data: decisions, isLoading } = useQuery<AiDecision[]>({
    queryKey: ["/api/ai-decisions?limit=3"],
    refetchInterval: 30000,
  });

  const { data: aiStatus } = useQuery<{ available: boolean; model: string; provider: string }>({
    queryKey: ["/api/ai/status"],
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case "buy": return BrandColors.success;
      case "sell": return BrandColors.error;
      default: return BrandColors.neutral;
    }
  };

  const formatConfidence = (confidence: string | number | null | undefined) => {
    if (confidence === null || confidence === undefined) return "N/A";
    const value = typeof confidence === "number" ? confidence : parseFloat(confidence);
    if (isNaN(value)) return "N/A";
    return `${(value * 100).toFixed(0)}%`;
  };

  const handleViewAll = () => {
    navigation.navigate("AISuggestedTrades");
  };

  if (isLoading) {
    return (
      <Card elevation={1} style={styles.suggestionsCard}>
        <View style={styles.cardHeader}>
          <Feather name="zap" size={20} color={BrandColors.aiLayer} />
          <ThemedText style={styles.cardTitle}>AI Suggested Trades</ThemedText>
        </View>
        <ActivityIndicator size="small" color={BrandColors.aiLayer} />
      </Card>
    );
  }

  if (!aiStatus?.available) {
    return (
      <Card elevation={1} style={styles.suggestionsCard}>
        <View style={styles.cardHeader}>
          <Feather name="zap" size={20} color={BrandColors.aiLayer} />
          <ThemedText style={styles.cardTitle}>AI Suggested Trades</ThemedText>
        </View>
        <View style={styles.aiStatusRow}>
          <Feather name="alert-circle" size={20} color={BrandColors.warning} />
          <ThemedText style={[styles.aiStatusText, { color: theme.textSecondary }]}>
            AI engine not configured
          </ThemedText>
        </View>
      </Card>
    );
  }

  if (!decisions || decisions.length === 0) {
    return (
      <Card elevation={1} style={styles.suggestionsCard}>
        <View style={styles.cardHeader}>
          <Feather name="zap" size={20} color={BrandColors.aiLayer} />
          <ThemedText style={styles.cardTitle}>AI Suggested Trades</ThemedText>
        </View>
        <View style={styles.aiEmptyState}>
          <Feather name="cpu" size={32} color={theme.textSecondary} />
          <ThemedText style={[styles.aiEmptyText, { color: theme.textSecondary }]}>
            No trade suggestions yet
          </ThemedText>
        </View>
        <Pressable style={styles.viewAllButton} onPress={handleViewAll}>
          <ThemedText style={[styles.viewAllText, { color: BrandColors.aiLayer }]}>View All Suggestions</ThemedText>
          <Feather name="chevron-right" size={16} color={BrandColors.aiLayer} />
        </Pressable>
      </Card>
    );
  }

  return (
    <Card elevation={1} style={styles.suggestionsCard}>
      <View style={styles.cardHeader}>
        <Feather name="zap" size={20} color={BrandColors.aiLayer} />
        <ThemedText style={styles.cardTitle}>AI Suggested Trades</ThemedText>
        <View style={styles.aiActiveIndicator}>
          <View style={[styles.liveDot, { backgroundColor: BrandColors.aiLayer }]} />
          <ThemedText style={[styles.liveText, { color: BrandColors.aiLayer }]}>LIVE</ThemedText>
        </View>
      </View>
      {decisions.slice(0, 3).map((decision, index) => (
        <View
          key={decision.id}
          style={[
            styles.suggestionRow,
            index < Math.min(decisions.length, 3) - 1 && { borderBottomWidth: 1, borderBottomColor: BrandColors.cardBorder }
          ]}
        >
          <View style={styles.suggestionInfo}>
            <View style={styles.suggestionHeader}>
              <ThemedText style={styles.suggestionSymbol}>{decision.symbol}</ThemedText>
              <View style={[styles.suggestionActionBadge, { backgroundColor: getActionColor(decision.action) }]}>
                <ThemedText style={styles.suggestionActionText}>{decision.action.toUpperCase()}</ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.suggestionReasoning, { color: theme.textSecondary }]} numberOfLines={1}>
              {decision.reasoning || "Analysis pending"}
            </ThemedText>
          </View>
          <ThemedText style={[styles.suggestionConfidence, { fontFamily: Fonts?.mono }]}>
            {formatConfidence(decision.confidence)}
          </ThemedText>
        </View>
      ))}
      <Pressable style={styles.viewAllButton} onPress={handleViewAll}>
        <ThemedText style={[styles.viewAllText, { color: BrandColors.aiLayer }]}>View All Suggestions</ThemedText>
        <Feather name="chevron-right" size={16} color={BrandColors.aiLayer} />
      </Pressable>
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

interface UAEStock {
  symbol: string;
  name: string;
  nameArabic?: string;
  exchange: "ADX" | "DFM";
  sector: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  currency: string;
  lastUpdated: string;
}

interface UAEMarketSummary {
  exchange: "ADX" | "DFM";
  indexName: string;
  indexValue: number;
  change: number;
  changePercent: number;
  tradingValue: number;
  tradingVolume: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  lastUpdated: string;
}

interface UAEConnectionStatus {
  connected: boolean;
  dataSource: "mock" | "live";
  cacheSize: number;
  apiConfigured: boolean;
  isMockData: boolean;
}

function UAEMarketsCard() {
  const { theme } = useTheme();

  const { data: stocks, isLoading: stocksLoading, error: stocksError } = useQuery<UAEStock[]>({
    queryKey: ["/api/uae/stocks"],
    refetchInterval: 60000,
  });

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<UAEMarketSummary[]>({
    queryKey: ["/api/uae/summary"],
    refetchInterval: 60000,
  });

  const { data: status } = useQuery<UAEConnectionStatus>({
    queryKey: ["/api/uae/status"],
    refetchInterval: 120000,
  });

  const isLoading = stocksLoading || summaryLoading;
  const hasError = stocksError || summaryError;

  const formatPrice = (price: number): string => {
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatChange = (change: number): string => {
    const prefix = change >= 0 ? "+" : "";
    return `${prefix}${change.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <Card elevation={1} style={styles.uaeCard}>
        <View style={styles.cardHeader}>
          <Feather name="globe" size={20} color={BrandColors.uaeLayer} />
          <ThemedText style={styles.cardTitle}>UAE Markets</ThemedText>
        </View>
        <ActivityIndicator size="small" color={BrandColors.primaryLight} />
      </Card>
    );
  }

  if (hasError || !stocks || stocks.length === 0) {
    return (
      <Card elevation={1} style={styles.uaeCard}>
        <View style={styles.cardHeader}>
          <Feather name="globe" size={20} color={BrandColors.uaeLayer} />
          <ThemedText style={styles.cardTitle}>UAE Markets</ThemedText>
          <View style={styles.uaeBetaIndicator}>
            <ThemedText style={[styles.uaeBetaText, { color: BrandColors.warning }]}>BETA</ThemedText>
          </View>
        </View>
        <View style={styles.uaeError}>
          <Feather name="alert-circle" size={24} color={BrandColors.warning} />
          <ThemedText style={[styles.uaeErrorText, { color: theme.textSecondary }]}>
            UAE market data unavailable
          </ThemedText>
          <ThemedText style={[styles.uaeNoteText, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
            This feature uses sample data. Live API integration coming soon.
          </ThemedText>
        </View>
      </Card>
    );
  }

  return (
    <Card elevation={1} style={styles.uaeCard}>
      <View style={styles.cardHeader}>
        <Feather name="globe" size={20} color={BrandColors.uaeLayer} />
        <ThemedText style={styles.cardTitle}>UAE Markets</ThemedText>
        <View style={styles.uaeBetaIndicator}>
          <ThemedText style={[styles.uaeBetaText, { color: BrandColors.warning }]}>BETA</ThemedText>
        </View>
      </View>
      {summary ? (
        <View style={styles.uaeSummaryRow}>
          {summary.map((market) => (
            <View key={market.exchange} style={styles.uaeIndexItem}>
              <ThemedText style={[styles.uaeIndexName, { color: theme.textSecondary }]}>{market.exchange}</ThemedText>
              <ThemedText style={[styles.uaeIndexValue, { fontFamily: Fonts?.mono }]}>
                {formatPrice(market.indexValue)}
              </ThemedText>
              <ThemedText style={[
                styles.uaeIndexChange,
                { 
                  fontFamily: Fonts?.mono,
                  color: market.changePercent >= 0 ? BrandColors.success : BrandColors.error
                }
              ]}>
                {formatChange(market.changePercent)}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
      {stocks.slice(0, 5).map((stock, index) => (
        <View
          key={stock.symbol}
          style={[
            styles.uaeStockRow,
            index < Math.min(stocks.length, 5) - 1 && { borderBottomWidth: 1, borderBottomColor: BrandColors.cardBorder }
          ]}
        >
          <View style={styles.uaeStockInfo}>
            <View style={styles.uaeStockHeader}>
              <ThemedText style={styles.uaeStockSymbol}>{stock.symbol}</ThemedText>
              <View style={[styles.uaeExchangeBadge, { backgroundColor: stock.exchange === "ADX" ? BrandColors.uaeLayer : BrandColors.primaryLight }]}>
                <ThemedText style={styles.uaeExchangeText}>{stock.exchange}</ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.uaeStockName, { color: theme.textSecondary }]} numberOfLines={1}>
              {stock.name}
            </ThemedText>
          </View>
          <View style={styles.uaeStockPriceInfo}>
            <ThemedText style={[styles.uaeStockPrice, { fontFamily: Fonts?.mono }]}>
              {stock.currency} {formatPrice(stock.currentPrice)}
            </ThemedText>
            <ThemedText style={[
              styles.uaeStockChange,
              { 
                fontFamily: Fonts?.mono,
                color: stock.changePercent >= 0 ? BrandColors.success : BrandColors.error
              }
            ]}>
              {formatChange(stock.changePercent)}
            </ThemedText>
          </View>
        </View>
      ))}
      <View style={styles.uaeNote}>
        <Feather name="info" size={12} color={theme.textSecondary} />
        <ThemedText style={[styles.uaeNoteText, { color: theme.textSecondary }]}>
          {status?.isMockData 
            ? "Sample data for demonstration. Live ADX/DFM API integration coming soon."
            : "Live market data from UAE exchanges"
          }
        </ThemedText>
      </View>
    </Card>
  );
}

const CRYPTO_TICKERS = ["BTC", "ETH", "SOL", "XRP", "DOGE", "LTC", "ADA", "AVAX", "DOT", "MATIC", "LINK", "UNI", "SHIB", "ATOM"];
const CRYPTO_NAMES = ["BITCOIN", "ETHEREUM", "SOLANA", "RIPPLE", "DOGECOIN", "LITECOIN", "CARDANO", "AVALANCHE", "POLKADOT", "POLYGON", "CHAINLINK", "UNISWAP"];

function isCryptoSymbol(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  if (CRYPTO_NAMES.includes(upper)) return true;
  for (const ticker of CRYPTO_TICKERS) {
    if (upper === ticker || upper.startsWith(ticker + "/") || upper.includes("/" + ticker)) return true;
  }
  if (upper.endsWith("USD") || upper.endsWith("USDT") || upper.endsWith("USDC")) {
    const base = upper.replace(/(USD[TC]?)$/, "");
    if (CRYPTO_TICKERS.includes(base)) return true;
  }
  return false;
}

function LayerStatusCard({ layer, color }: { layer: string; color: string }) {
  const { theme } = useTheme();

  const { data: positions } = useQuery<AlpacaPosition[]>({
    queryKey: ["/api/alpaca/positions"],
    refetchInterval: 10000,
  });

  const layerPositions = positions?.filter(p => {
    const isCryptoLayer = layer === "Crypto";
    const symbolIsCrypto = p.asset_class === "crypto" || isCryptoSymbol(p.symbol);
    if (isCryptoLayer) {
      return symbolIsCrypto;
    }
    return !symbolIsCrypto;
  }) || [];

  const layerPnl = layerPositions.reduce((sum, p) => sum + parseFloat(p.unrealized_pl || "0"), 0);

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

  const { data: positions, isLoading } = useQuery<AlpacaPosition[]>({
    queryKey: ["/api/alpaca/positions"],
    refetchInterval: 10000,
  });

  const { data: aiDecisions } = useQuery<AiDecision[]>({
    queryKey: ["/api/ai-decisions?limit=100"],
    refetchInterval: 30000,
  });

  const aiSymbols = new Set(
    aiDecisions?.filter(d => d.action === "buy" && (d as any).status === "executed").map(d => d.symbol) || []
  );

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
        const pnl = parseFloat(position.unrealized_pl || "0");
        const isCrypto = position.asset_class === "crypto" || isCryptoSymbol(position.symbol);
        return (
          <View
            key={position.symbol}
            style={[
              styles.positionRow,
              index < positions.length - 1 && { borderBottomWidth: 1, borderBottomColor: BrandColors.cardBorder }
            ]}
          >
            <View style={styles.positionInfo}>
              <View style={styles.positionSymbolRow}>
                <View style={[styles.assetTypeIndicator, { backgroundColor: isCrypto ? BrandColors.cryptoLayer : BrandColors.stockLayer }]} />
                <ThemedText style={styles.positionSymbol}>{position.symbol}</ThemedText>
                {aiSymbols.has(position.symbol) ? (
                  <View style={[styles.positionAiBadge, { backgroundColor: BrandColors.aiLayer + "30" }]}>
                    <Feather name="cpu" size={10} color={BrandColors.aiLayer} style={{ marginRight: 3 }} />
                    <ThemedText style={[styles.positionAiBadgeText, { color: BrandColors.aiLayer }]}>AI</ThemedText>
                  </View>
                ) : null}
                <ThemedText style={[styles.positionSide, { color: position.side === "long" ? BrandColors.success : BrandColors.error }]}>
                  {position.side.toUpperCase()}
                </ThemedText>
              </View>
              <ThemedText style={[styles.positionDetails, { color: theme.textSecondary }]}>
                {position.qty}{position.qty_available && position.qty_available !== position.qty ? ` (${position.qty_available} avail)` : ""} @ ${parseFloat(position.avg_entry_price).toFixed(2)}
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
    { key: "account", component: <AccountBalanceCard /> },
    { key: "agent", component: <AgentStatusCard /> },
    { key: "autonomous", component: <AutonomousControlCard /> },
    { key: "equityCurve", component: <EquityCurveCard /> },
    { key: "suggestions", component: <AISuggestedTradesCard /> },
    { key: "ai", component: <AIDecisionsCard /> },
    { key: "btcChart", component: (
      <View>
        <View style={styles.chartHeader}>
          <Feather name="activity" size={20} color={BrandColors.cryptoLayer} />
          <ThemedText style={styles.chartTitle}>Bitcoin Price</ThemedText>
        </View>
        <PriceChart assetId="bitcoin" assetType="crypto" height={280} />
      </View>
    )},
    { key: "crypto", component: <CryptoMarketsCard /> },
    { key: "stock", component: <StockMarketsCard /> },
    { key: "uae", component: <UAEMarketsCard /> },
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
  accountCard: {
    borderWidth: 1,
    borderColor: BrandColors.success,
    borderLeftWidth: 4,
  },
  accountMainValue: {
    marginBottom: Spacing.lg,
  },
  accountPortfolioValue: {
    ...Typography.h1,
    fontSize: 32,
  },
  accountChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  accountChange: {
    ...Typography.body,
  },
  accountChangeLabel: {
    ...Typography.small,
  },
  accountStats: {
    flexDirection: "row",
    gap: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  accountStatItem: {
    flex: 1,
  },
  accountStatLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  accountStatValue: {
    ...Typography.body,
    fontWeight: "600",
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
  intelligenceError: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  intelligenceErrorText: {
    ...Typography.caption,
  },
  intelligenceComponents: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  componentRow: {
    flex: 1,
  },
  componentLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  componentValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  signalsContainer: {
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  signalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  signalText: {
    ...Typography.small,
    flex: 1,
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
  positionAiBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  positionAiBadgeText: {
    fontSize: 10,
    fontWeight: "600",
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
  aiCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  suggestionsCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  suggestionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  suggestionInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  suggestionSymbol: {
    ...Typography.body,
    fontWeight: "600",
  },
  suggestionActionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  suggestionActionText: {
    ...Typography.small,
    fontWeight: "600",
    color: "#FFFFFF",
    fontSize: 10,
  },
  suggestionReasoning: {
    ...Typography.small,
  },
  suggestionConfidence: {
    ...Typography.body,
    fontWeight: "600",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  viewAllText: {
    ...Typography.body,
    fontWeight: "600",
  },
  aiStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  aiStatusText: {
    ...Typography.caption,
  },
  aiActiveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginLeft: "auto",
  },
  aiEmptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  aiEmptyText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  aiEmptySubtext: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  aiDecisionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: Spacing.md,
  },
  aiDecisionInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  aiDecisionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  aiSymbol: {
    ...Typography.body,
    fontWeight: "600",
  },
  aiActionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  aiActionText: {
    ...Typography.small,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  aiReasoning: {
    ...Typography.small,
  },
  aiDecisionMeta: {
    alignItems: "flex-end",
  },
  aiConfidence: {
    ...Typography.body,
    fontWeight: "600",
  },
  aiTime: {
    ...Typography.small,
  },
  aiRiskBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  aiRiskText: {
    ...Typography.small,
    fontWeight: "600",
    fontSize: 10,
  },
  aiPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  aiCurrentPrice: {
    ...Typography.body,
    fontWeight: "600",
  },
  aiPriceChange: {
    ...Typography.small,
    fontWeight: "500",
  },
  aiTargetsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  aiTargetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  aiTargetText: {
    ...Typography.small,
    fontSize: 11,
  },
  aiQty: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  chartTitle: {
    ...Typography.h4,
  },
  uaeCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  uaeError: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  uaeErrorText: {
    ...Typography.caption,
  },
  uaeBetaIndicator: {
    marginLeft: "auto",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: BrandColors.warning,
  },
  uaeBetaText: {
    ...Typography.small,
    fontWeight: "600",
    fontSize: 10,
  },
  uaeSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.cardBorder,
  },
  uaeIndexItem: {
    alignItems: "center",
  },
  uaeIndexName: {
    ...Typography.small,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  uaeIndexValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  uaeIndexChange: {
    ...Typography.small,
    fontWeight: "500",
  },
  uaeStockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  uaeStockInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  uaeStockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  uaeStockSymbol: {
    ...Typography.body,
    fontWeight: "600",
  },
  uaeExchangeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  uaeExchangeText: {
    ...Typography.small,
    fontWeight: "600",
    color: "#FFFFFF",
    fontSize: 10,
  },
  uaeStockName: {
    ...Typography.small,
  },
  uaeStockPriceInfo: {
    alignItems: "flex-end",
  },
  uaeStockPrice: {
    ...Typography.body,
    fontWeight: "600",
  },
  uaeStockChange: {
    ...Typography.small,
    fontWeight: "500",
  },
  uaeNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  uaeNoteText: {
    ...Typography.small,
    fontSize: 11,
  },
});
