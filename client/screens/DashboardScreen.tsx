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
import { PriceChart } from "@/components/PriceChart";
import { apiRequest } from "@/lib/query-client";
import type { AgentStatus, Position, AiDecision } from "@shared/schema";

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
});
