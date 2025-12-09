import { 
  View, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  Pressable, 
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useMemo, useEffect } from "react";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { apiRequest } from "@/lib/query-client";
import type { AiDecision } from "@shared/schema";
import type { AutoStackParamList } from "@/navigation/AutoStackNavigator";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
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

interface AutonomousState {
  isRunning: boolean;
  mode: "autonomous" | "semi-auto" | "manual";
  lastAnalysisTime: string | null;
  lastPositionCheckTime: string | null;
  dailyPnl: number;
  dailyTradeCount: number;
  errors: string[];
  riskLimits: {
    maxPositionSizePercent: number;
    maxTotalExposurePercent: number;
    maxPositionsCount: number;
    dailyLossLimitPercent: number;
    killSwitchActive: boolean;
  };
  activePositions: Array<{
    symbol: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
  }>;
  executionHistory: Array<{
    success: boolean;
    action: string;
    symbol: string;
    reason: string;
  }>;
}

interface TopAsset {
  symbol: string;
  name: string;
  price?: number;
  change?: number;
  volume?: number;
}

export default function AutoScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<AutoStackParamList>>();
  
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDecisions, setSelectedDecisions] = useState<Set<string>>(new Set());
  const [showRiskSettings, setShowRiskSettings] = useState(false);
  const [showPositionActions, setShowPositionActions] = useState<string | null>(null);
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: autonomousState, isLoading: stateLoading } = useQuery<AutonomousState>({
    queryKey: ["/api/autonomous/state"],
    refetchInterval: 5000,
  });

  const { data: decisions, isLoading: decisionsLoading, refetch } = useQuery<AiDecision[]>({
    queryKey: ["/api/ai-decisions?limit=50"],
    refetchInterval: 30000,
  });

  const { data: aiStatus } = useQuery<{ available: boolean; model: string; provider: string }>({
    queryKey: ["/api/ai/status"],
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<TopAsset[]>({
    queryKey: ["/api/alpaca/top-stocks", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (debouncedSearch.length >= 2) {
        params.append("search", debouncedSearch.toUpperCase());
      }
      const response = await apiRequest("GET", `/api/alpaca/top-stocks?${params.toString()}`);
      return await response.json();
    },
    enabled: debouncedSearch.length >= 2,
  });

  const decisionSymbols = useMemo(() => 
    [...new Set(decisions?.map(d => d.symbol).filter(Boolean).slice(0, 20) || [])],
    [decisions]
  );
  
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

  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/autonomous/start");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous/state"] });
    },
    onError: (err) => {
      Alert.alert("Error", String(err));
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/autonomous/stop");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous/state"] });
    },
  });

  const killSwitchMutation = useMutation({
    mutationFn: async (activate: boolean) => {
      const response = await apiRequest("POST", "/api/autonomous/kill-switch", {
        activate,
        reason: activate ? "Manual kill switch activation" : undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous/state"] });
    },
  });

  const closePositionMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const response = await apiRequest("POST", "/api/autonomous/close-position", { symbol });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous/state"] });
      setShowPositionActions(null);
    },
    onError: (err) => {
      Alert.alert("Error", `Failed to close position: ${String(err)}`);
    },
  });

  const executeTradesMutation = useMutation({
    mutationFn: async (decisionIds: string[]) => {
      const response = await apiRequest("POST", "/api/autonomous/execute-trades", { decisionIds });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous/state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-decisions?limit=50"] });
      setSelectedDecisions(new Set());
      Alert.alert("Success", "Trades submitted for execution");
    },
    onError: (err) => {
      Alert.alert("Error", `Failed to execute trades: ${String(err)}`);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["/api/autonomous/state"] }),
    ]);
    setRefreshing(false);
  }, [refetch, queryClient]);

  const handleToggleAutonomous = () => {
    if (autonomousState?.isRunning) {
      Alert.alert(
        "Pause Auto Trading",
        "Are you sure you want to pause the autonomous trading bot?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Pause", style: "destructive", onPress: () => stopMutation.mutate() },
        ]
      );
    } else {
      Alert.alert(
        "Start Auto Trading",
        "This will enable fully autonomous trading. The AI will analyze markets and execute trades automatically.\n\nAre you sure?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Start", onPress: () => startMutation.mutate() },
        ]
      );
    }
  };

  const handleKillSwitch = () => {
    const isActive = autonomousState?.riskLimits?.killSwitchActive;
    if (!isActive) {
      Alert.alert(
        "EMERGENCY STOP",
        "This will immediately stop all trading and close all positions.\n\nActivate emergency stop?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "STOP ALL", style: "destructive", onPress: () => killSwitchMutation.mutate(true) },
        ]
      );
    } else {
      killSwitchMutation.mutate(false);
    }
  };

  const handleClosePosition = (symbol: string) => {
    Alert.alert(
      "Close Position",
      `Are you sure you want to close your ${symbol} position?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Close", 
          style: "destructive", 
          onPress: () => closePositionMutation.mutate(symbol) 
        },
      ]
    );
  };

  const handleSelectDecision = (decisionId: string) => {
    setSelectedDecisions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(decisionId)) {
        newSet.delete(decisionId);
      } else {
        newSet.add(decisionId);
      }
      return newSet;
    });
  };

  const handleExecuteSelected = () => {
    if (selectedDecisions.size === 0) return;
    
    Alert.alert(
      "Execute Trades",
      `Execute ${selectedDecisions.size} selected trade(s)?\n\nThis will start auto-trading these positions.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Execute", 
          onPress: () => executeTradesMutation.mutate(Array.from(selectedDecisions)) 
        },
      ]
    );
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

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "autonomous":
        return BrandColors.success;
      case "semi-auto":
        return BrandColors.warning;
      default:
        return BrandColors.neutral;
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
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

  const uniqueDecisions = useMemo(() => {
    if (!decisions) return [];
    const seen = new Set<string>();
    return decisions.filter(d => {
      const key = `${d.symbol}-${d.action}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [decisions]);

  const filteredDecisions = useMemo(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) return uniqueDecisions;
    const search = debouncedSearch.toLowerCase();
    return uniqueDecisions.filter(
      d => d.symbol.toLowerCase().includes(search)
    );
  }, [uniqueDecisions, debouncedSearch]);

  const isRunning = autonomousState?.isRunning ?? false;
  const killSwitchActive = autonomousState?.riskLimits?.killSwitchActive ?? false;
  const mode = autonomousState?.mode ?? "manual";
  const activePositions = autonomousState?.activePositions ?? [];

  const renderAutonomousControl = () => (
    <Card elevation={2} style={styles.controlCard}>
      <View style={styles.cardHeader}>
        <Feather name="cpu" size={20} color={BrandColors.aiLayer} />
        <ThemedText style={styles.cardTitle}>Auto Trading Bot</ThemedText>
        <View style={[styles.modeBadge, { backgroundColor: getModeColor(mode) }]}>
          <ThemedText style={styles.modeText}>{mode.toUpperCase()}</ThemedText>
        </View>
      </View>

      {killSwitchActive ? (
        <View style={styles.killSwitchBanner}>
          <Feather name="alert-octagon" size={24} color={"#FFFFFF"} />
          <ThemedText style={styles.killSwitchText}>EMERGENCY STOP ACTIVE</ThemedText>
          <Pressable 
            style={styles.deactivateButton} 
            onPress={handleKillSwitch}
          >
            <ThemedText style={styles.deactivateButtonText}>Resume</ThemedText>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.controlRow}>
        <View style={styles.controlInfo}>
          <ThemedText style={styles.controlLabel}>AI Auto Trading</ThemedText>
          <ThemedText style={[styles.controlDescription, { color: theme.textSecondary }]}>
            {isRunning 
              ? "Bot is actively trading" 
              : "Bot is paused"}
          </ThemedText>
        </View>
        <Switch
          value={isRunning}
          onValueChange={handleToggleAutonomous}
          trackColor={{ false: BrandColors.cardBorder, true: BrandColors.success }}
          thumbColor={isRunning ? "#FFFFFF" : theme.textSecondary}
          disabled={killSwitchActive || startMutation.isPending || stopMutation.isPending}
        />
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Positions</ThemedText>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>
            {activePositions.length}
          </ThemedText>
        </View>
        <View style={styles.statBox}>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Daily Trades</ThemedText>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>
            {autonomousState?.dailyTradeCount ?? 0}
          </ThemedText>
        </View>
        <View style={styles.statBox}>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Daily P/L</ThemedText>
          <ThemedText style={[
            styles.statValue, 
            { 
              fontFamily: Fonts?.mono,
              color: (autonomousState?.dailyPnl ?? 0) >= 0 ? BrandColors.success : BrandColors.error 
            }
          ]}>
            ${(autonomousState?.dailyPnl ?? 0).toFixed(2)}
          </ThemedText>
        </View>
        <View style={styles.statBox}>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Last Check</ThemedText>
          <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono, fontSize: 12 }]}>
            {formatTime(autonomousState?.lastAnalysisTime ?? null)}
          </ThemedText>
        </View>
      </View>

      <Pressable 
        style={styles.riskSettingsToggle}
        onPress={() => setShowRiskSettings(!showRiskSettings)}
      >
        <Feather name="shield" size={16} color={BrandColors.primaryLight} />
        <ThemedText style={[styles.riskSettingsLabel, { color: BrandColors.primaryLight }]}>
          Risk Controls
        </ThemedText>
        <Feather 
          name={showRiskSettings ? "chevron-up" : "chevron-down"} 
          size={16} 
          color={BrandColors.primaryLight} 
        />
      </Pressable>

      {showRiskSettings ? (
        <View style={styles.riskSettings}>
          <View style={styles.riskRow}>
            <ThemedText style={[styles.riskLabel, { color: theme.textSecondary }]}>
              Max Position Size
            </ThemedText>
            <ThemedText style={[styles.riskValue, { fontFamily: Fonts?.mono }]}>
              {autonomousState?.riskLimits?.maxPositionSizePercent ?? 10}%
            </ThemedText>
          </View>
          <View style={styles.riskRow}>
            <ThemedText style={[styles.riskLabel, { color: theme.textSecondary }]}>
              Max Total Exposure
            </ThemedText>
            <ThemedText style={[styles.riskValue, { fontFamily: Fonts?.mono }]}>
              {autonomousState?.riskLimits?.maxTotalExposurePercent ?? 50}%
            </ThemedText>
          </View>
          <View style={styles.riskRow}>
            <ThemedText style={[styles.riskLabel, { color: theme.textSecondary }]}>
              Max Positions
            </ThemedText>
            <ThemedText style={[styles.riskValue, { fontFamily: Fonts?.mono }]}>
              {autonomousState?.riskLimits?.maxPositionsCount ?? 10}
            </ThemedText>
          </View>
          <View style={styles.riskRow}>
            <ThemedText style={[styles.riskLabel, { color: theme.textSecondary }]}>
              Daily Loss Limit
            </ThemedText>
            <ThemedText style={[styles.riskValue, { fontFamily: Fonts?.mono }]}>
              {autonomousState?.riskLimits?.dailyLossLimitPercent ?? 5}%
            </ThemedText>
          </View>
        </View>
      ) : null}

      {!killSwitchActive ? (
        <Pressable 
          style={styles.emergencyButton}
          onPress={handleKillSwitch}
        >
          <Feather name="alert-octagon" size={16} color={BrandColors.error} />
          <ThemedText style={[styles.emergencyButtonText, { color: BrandColors.error }]}>
            Emergency Stop
          </ThemedText>
        </Pressable>
      ) : null}
    </Card>
  );

  const renderActivePositions = () => {
    if (activePositions.length === 0) return null;

    return (
      <Card elevation={1} style={styles.positionsCard}>
        <View style={styles.positionsHeader}>
          <Feather name="briefcase" size={18} color={BrandColors.primaryLight} />
          <ThemedText style={styles.positionsTitle}>Active Positions</ThemedText>
          <ThemedText style={[styles.positionsCount, { color: theme.textSecondary }]}>
            {activePositions.length}
          </ThemedText>
        </View>

        {activePositions.map((position, index) => (
          <View key={position.symbol} style={[
            styles.positionRow,
            index < activePositions.length - 1 && styles.positionRowBorder
          ]}>
            <View style={styles.positionInfo}>
              <ThemedText style={styles.positionSymbol}>{position.symbol}</ThemedText>
              <ThemedText style={[styles.positionDetails, { color: theme.textSecondary }]}>
                {position.quantity} shares @ {formatPrice(position.entryPrice)}
              </ThemedText>
            </View>
            <View style={styles.positionPnl}>
              <ThemedText style={[
                styles.positionPnlValue,
                { 
                  fontFamily: Fonts?.mono,
                  color: position.unrealizedPnl >= 0 ? BrandColors.success : BrandColors.error 
                }
              ]}>
                {position.unrealizedPnl >= 0 ? "+" : ""}${position.unrealizedPnl.toFixed(2)}
              </ThemedText>
              <ThemedText style={[
                styles.positionPnlPercent,
                { 
                  fontFamily: Fonts?.mono,
                  color: position.unrealizedPnlPercent >= 0 ? BrandColors.success : BrandColors.error 
                }
              ]}>
                ({position.unrealizedPnlPercent >= 0 ? "+" : ""}{position.unrealizedPnlPercent.toFixed(2)}%)
              </ThemedText>
            </View>
            <Pressable 
              style={styles.positionCloseButton}
              onPress={() => handleClosePosition(position.symbol)}
            >
              <Feather name="x" size={18} color={BrandColors.error} />
            </Pressable>
          </View>
        ))}
      </Card>
    );
  };

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search stocks..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const renderDecision = ({ item: decision }: { item: AiDecision }) => {
    const context = parseMarketContext(decision.marketContext);
    const liveData = getLiveData(decision.symbol);
    const currentPrice = liveData?.price ?? context?.marketData?.price;
    const priceChange = liveData?.change ?? context?.marketData?.change;
    const isSelected = selectedDecisions.has(decision.id);

    return (
      <Pressable
        onPress={() => handleSelectDecision(decision.id)}
        onLongPress={() => navigation.navigate("TickerDetail", { symbol: decision.symbol, assetType: "stock" })}
      >
        <Card elevation={1} style={[
          styles.suggestionCard,
          isSelected && styles.suggestionCardSelected
        ]}>
          <View style={styles.suggestionHeader}>
            <View style={styles.symbolRow}>
              <View style={[
                styles.checkbox,
                isSelected && styles.checkboxSelected,
                { borderColor: isSelected ? BrandColors.success : BrandColors.cardBorder }
              ]}>
                {isSelected ? (
                  <Feather name="check" size={14} color={"#FFFFFF"} />
                ) : null}
              </View>
              <ThemedText style={styles.symbol}>{decision.symbol}</ThemedText>
              <View style={[styles.actionBadge, { backgroundColor: getActionColor(decision.action) }]}>
                <ThemedText style={styles.actionText}>{decision.action.toUpperCase()}</ThemedText>
              </View>
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
                <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>Current</ThemedText>
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
                    <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>Stop</ThemedText>
                  </View>
                  <ThemedText style={[styles.priceValue, { fontFamily: Fonts?.mono, color: BrandColors.error }]}>
                    {formatPrice(context.stopLoss)}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          <ThemedText 
            style={[styles.reasoning, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {decision.reasoning || "AI analysis pending..."}
          </ThemedText>
        </Card>
      </Pressable>
    );
  };

  const renderHeader = () => (
    <View>
      {renderAutonomousControl()}
      {renderActivePositions()}
      {renderSearchBar()}
      
      <View style={styles.suggestionsHeader}>
        <View style={styles.suggestionsHeaderLeft}>
          <View style={[styles.liveDot, { backgroundColor: BrandColors.aiLayer }]} />
          <ThemedText style={[styles.suggestionsTitle, { color: BrandColors.aiLayer }]}>
            AI Suggested Trades
          </ThemedText>
        </View>
        <ThemedText style={[styles.suggestionsCount, { color: theme.textSecondary }]}>
          {filteredDecisions.length} suggestions
        </ThemedText>
      </View>

      {selectedDecisions.size > 0 ? (
        <Pressable 
          style={styles.executeButton}
          onPress={handleExecuteSelected}
          disabled={executeTradesMutation.isPending}
        >
          {executeTradesMutation.isPending ? (
            <ActivityIndicator size="small" color={"#FFFFFF"} />
          ) : (
            <>
              <Feather name="zap" size={18} color={"#FFFFFF"} />
              <ThemedText style={styles.executeButtonText}>
                Execute {selectedDecisions.size} Trade{selectedDecisions.size > 1 ? "s" : ""}
              </ThemedText>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );

  const renderEmpty = () => {
    if (!aiStatus?.available) {
      return (
        <View style={styles.emptyContainer}>
          <Feather name="alert-circle" size={48} color={BrandColors.warning} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>AI Not Configured</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Configure OpenAI API to enable AI-powered trade suggestions
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Feather name="zap" size={48} color={theme.textSecondary} />
        <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No Suggestions Yet</ThemedText>
        <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          Start the trading bot to begin analyzing opportunities
        </ThemedText>
      </View>
    );
  };

  if (stateLoading && decisionsLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.aiLayer} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading auto trading...
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={filteredDecisions}
      keyExtractor={(item) => item.id}
      renderItem={renderDecision}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmpty}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BrandColors.aiLayer} />
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
  controlCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
    flex: 1,
  },
  modeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  modeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  killSwitchBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: BrandColors.error,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  killSwitchText: {
    flex: 1,
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: Typography.body.fontSize,
  },
  deactivateButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  deactivateButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: Typography.small.fontSize,
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.cardBorder,
  },
  controlInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  controlLabel: {
    fontSize: Typography.body.fontSize,
    fontWeight: "500",
  },
  controlDescription: {
    fontSize: Typography.small.fontSize,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  statBox: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
    marginTop: 2,
  },
  riskSettingsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  riskSettingsLabel: {
    flex: 1,
    fontSize: Typography.small.fontSize,
    fontWeight: "500",
  },
  riskSettings: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  riskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  riskLabel: {
    fontSize: Typography.small.fontSize,
  },
  riskValue: {
    fontSize: Typography.small.fontSize,
    fontWeight: "600",
  },
  emergencyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: BrandColors.error,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  emergencyButtonText: {
    fontSize: Typography.small.fontSize,
    fontWeight: "600",
  },
  positionsCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  positionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  positionsTitle: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
    flex: 1,
  },
  positionsCount: {
    fontSize: Typography.small.fontSize,
  },
  positionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  positionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.cardBorder,
  },
  positionInfo: {
    flex: 1,
  },
  positionSymbol: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
  },
  positionDetails: {
    fontSize: Typography.small.fontSize,
    marginTop: 2,
  },
  positionPnl: {
    alignItems: "flex-end",
    marginRight: Spacing.md,
  },
  positionPnlValue: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
  },
  positionPnlPercent: {
    fontSize: Typography.small.fontSize,
  },
  positionCloseButton: {
    padding: Spacing.xs,
    borderWidth: 1,
    borderColor: BrandColors.error,
    borderRadius: BorderRadius.sm,
  },
  searchContainer: {
    marginBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.body.fontSize,
    paddingVertical: Spacing.xs,
  },
  suggestionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  suggestionsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  suggestionsTitle: {
    ...Typography.body,
    fontWeight: "600",
  },
  suggestionsCount: {
    ...Typography.small,
  },
  executeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: BrandColors.success,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  executeButtonText: {
    color: "#FFFFFF",
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
  },
  suggestionCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  suggestionCardSelected: {
    borderColor: BrandColors.success,
    borderWidth: 2,
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
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: BrandColors.success,
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
  reasoning: {
    ...Typography.body,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h3,
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
