import { useState, useLayoutEffect } from "react";
import { View, FlatList, StyleSheet, ActivityIndicator, Pressable, Modal, TextInput, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight, HeaderButton } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { apiRequest } from "@/lib/query-client";
import type { AnalyticsStackParamList } from "@/navigation/AnalyticsStackNavigator";
import type { BacktestRun, BacktestStatus } from "@shared/types/backtesting";

interface BacktestsResponse {
  runs: BacktestRun[];
  limit: number;
  offset: number;
}

const STATUS_COLORS: Record<BacktestStatus, string> = {
  QUEUED: BrandColors.neutral,
  RUNNING: BrandColors.warning,
  DONE: BrandColors.success,
  FAILED: BrandColors.error,
};

const STATUS_ICONS: Record<BacktestStatus, keyof typeof Feather.glyphMap> = {
  QUEUED: "clock",
  RUNNING: "loader",
  DONE: "check-circle",
  FAILED: "x-circle",
};

type StrategyType = "ma-crossover" | "rsi-oscillator" | "buy-and-hold";

interface StrategyConfig {
  type: StrategyType;
  name: string;
  description: string;
  params: {
    fastPeriod?: number;
    slowPeriod?: number;
    rsiPeriod?: number;
    oversold?: number;
    overbought?: number;
    allocationPct: number;
  };
}

const STRATEGY_OPTIONS: Record<StrategyType, { name: string; description: string }> = {
  "ma-crossover": {
    name: "Moving Average Crossover",
    description: "Buys when fast moving average crosses above slow, sells on opposite",
  },
  "rsi-oscillator": {
    name: "RSI Oscillator",
    description: "Buys when RSI indicates oversold (<30), sells when overbought (>70)",
  },
  "buy-and-hold": {
    name: "Buy and Hold",
    description: "Simply buys at the start and holds throughout",
  },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "--";
  return value.toFixed(decimals);
}

function StatusBadge({ status }: { status: BacktestStatus }) {
  const color = STATUS_COLORS[status];
  const icon = STATUS_ICONS[status];
  return (
    <View style={[styles.statusBadge, { backgroundColor: color + "20" }]}>
      <Feather name={icon} size={12} color={color} />
      <ThemedText style={[styles.statusText, { color }]}>{status}</ThemedText>
    </View>
  );
}

function BacktestCard({ 
  run, 
  onPress 
}: { 
  run: BacktestRun; 
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const universeDisplay = run.universe.length <= 3 
    ? run.universe.join(", ") 
    : `${run.universe.slice(0, 3).join(", ")} +${run.universe.length - 3}`;
  const summary = run.resultsSummary;

  return (
    <Card elevation={1} style={styles.backtestCard} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.iconContainer, { backgroundColor: BrandColors.primaryLight + "20" }]}>
            <Feather name="trending-up" size={20} color={BrandColors.primaryLight} />
          </View>
          <View style={styles.cardTitleText}>
            <ThemedText style={styles.universeText}>{universeDisplay}</ThemedText>
            <ThemedText style={[styles.dateRangeText, { color: theme.textSecondary }]}>
              {formatDate(run.startDate)} - {formatDate(run.endDate)}
            </ThemedText>
          </View>
        </View>
        <StatusBadge status={run.status} />
      </View>

      {summary ? (
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>Return</ThemedText>
            <ThemedText style={[
              styles.metricValue,
              { fontFamily: Fonts?.mono },
              summary.totalReturnPct >= 0 ? { color: BrandColors.success } : { color: BrandColors.error }
            ]}>
              {formatPercent(summary.totalReturnPct)}
            </ThemedText>
          </View>
          <View style={styles.metricItem}>
            <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>Sharpe</ThemedText>
            <ThemedText style={[styles.metricValue, { fontFamily: Fonts?.mono }]}>
              {formatNumber(summary.sharpeRatio)}
            </ThemedText>
          </View>
          <View style={styles.metricItem}>
            <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>Win Rate</ThemedText>
            <ThemedText style={[styles.metricValue, { fontFamily: Fonts?.mono }]}>
              {formatNumber(summary.winRatePct, 1)}%
            </ThemedText>
          </View>
          <View style={styles.metricItem}>
            <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>Trades</ThemedText>
            <ThemedText style={[styles.metricValue, { fontFamily: Fonts?.mono }]}>
              {summary.totalTrades}
            </ThemedText>
          </View>
        </View>
      ) : null}

      {run.status === "FAILED" && run.errorMessage ? (
        <View style={[styles.errorContainer, { backgroundColor: BrandColors.error + "10" }]}>
          <Feather name="alert-circle" size={14} color={BrandColors.error} />
          <ThemedText style={[styles.errorText, { color: BrandColors.error }]} numberOfLines={2}>
            {run.errorMessage}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <ThemedText style={[styles.configHashText, { color: theme.textSecondary }]}>
          Config: {run.strategyConfigHash.slice(0, 8)}...
        </ThemedText>
        <ThemedText style={[styles.createdAtText, { color: theme.textSecondary }]}>
          {formatDate(run.createdAt)}
        </ThemedText>
      </View>
    </Card>
  );
}

interface BacktestParams {
  universe: string[];
  startDate: string;
  endDate: string;
  strategyType: StrategyType;
  strategyParams: {
    fastPeriod?: number;
    slowPeriod?: number;
    rsiPeriod?: number;
    oversold?: number;
    overbought?: number;
    allocationPct: number;
  };
}

interface RunBacktestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: BacktestParams) => void;
  isLoading: boolean;
}

const DEFAULT_SYMBOLS = ["AAPL", "GOOGL", "MSFT", "NVDA", "TSLA", "AMZN", "SPY", "QQQ", "META"];

function RunBacktestModal({ visible, onClose, onSubmit, isLoading }: RunBacktestModalProps) {
  const { theme } = useTheme();
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(["AAPL", "SPY"]);
  const [customSymbol, setCustomSymbol] = useState("");
  const [strategyType, setStrategyType] = useState<StrategyType>("ma-crossover");
  const [fastPeriod, setFastPeriod] = useState("10");
  const [slowPeriod, setSlowPeriod] = useState("20");
  const [rsiPeriod, setRsiPeriod] = useState("14");
  const [oversold, setOversold] = useState("30");
  const [overbought, setOverbought] = useState("70");
  const [allocationPct, setAllocationPct] = useState("10");

  const today = new Date();
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const defaultStartDate = ninetyDaysAgo.toISOString().split("T")[0];
  const defaultEndDate = today.toISOString().split("T")[0];

  const toggleSymbol = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      if (selectedSymbols.length > 1) {
        setSelectedSymbols(selectedSymbols.filter(s => s !== symbol));
      }
    } else {
      setSelectedSymbols([...selectedSymbols, symbol]);
    }
  };

  const addCustomSymbol = () => {
    const symbol = customSymbol.toUpperCase().trim();
    if (symbol && !selectedSymbols.includes(symbol)) {
      setSelectedSymbols([...selectedSymbols, symbol]);
      setCustomSymbol("");
    }
  };

  const handleSubmit = () => {
    const params: BacktestParams = {
      universe: selectedSymbols,
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      strategyType,
      strategyParams: {
        allocationPct: parseFloat(allocationPct) || 10,
      },
    };

    if (strategyType === "ma-crossover") {
      params.strategyParams.fastPeriod = parseInt(fastPeriod) || 10;
      params.strategyParams.slowPeriod = parseInt(slowPeriod) || 20;
    } else if (strategyType === "rsi-oscillator") {
      params.strategyParams.rsiPeriod = parseInt(rsiPeriod) || 14;
      params.strategyParams.oversold = parseInt(oversold) || 30;
      params.strategyParams.overbought = parseInt(overbought) || 70;
    }

    onSubmit(params);
  };

  const renderStrategyParams = () => {
    if (strategyType === "ma-crossover") {
      return (
        <View style={styles.paramsContainer}>
          <View style={styles.paramRow}>
            <View style={styles.paramItem}>
              <ThemedText style={[styles.paramLabel, { color: theme.textSecondary }]}>Fast Period</ThemedText>
              <TextInput
                style={[styles.paramInput, { 
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: BrandColors.cardBorder,
                }]}
                value={fastPeriod}
                onChangeText={setFastPeriod}
                keyboardType="numeric"
                placeholder="10"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
            <View style={styles.paramItem}>
              <ThemedText style={[styles.paramLabel, { color: theme.textSecondary }]}>Slow Period</ThemedText>
              <TextInput
                style={[styles.paramInput, { 
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: BrandColors.cardBorder,
                }]}
                value={slowPeriod}
                onChangeText={setSlowPeriod}
                keyboardType="numeric"
                placeholder="20"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>
        </View>
      );
    }

    if (strategyType === "rsi-oscillator") {
      return (
        <View style={styles.paramsContainer}>
          <View style={styles.paramRow}>
            <View style={styles.paramItem}>
              <ThemedText style={[styles.paramLabel, { color: theme.textSecondary }]}>RSI Period</ThemedText>
              <TextInput
                style={[styles.paramInput, { 
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: BrandColors.cardBorder,
                }]}
                value={rsiPeriod}
                onChangeText={setRsiPeriod}
                keyboardType="numeric"
                placeholder="14"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>
          <View style={styles.paramRow}>
            <View style={styles.paramItem}>
              <ThemedText style={[styles.paramLabel, { color: theme.textSecondary }]}>Oversold</ThemedText>
              <TextInput
                style={[styles.paramInput, { 
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: BrandColors.cardBorder,
                }]}
                value={oversold}
                onChangeText={setOversold}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
            <View style={styles.paramItem}>
              <ThemedText style={[styles.paramLabel, { color: theme.textSecondary }]}>Overbought</ThemedText>
              <TextInput
                style={[styles.paramInput, { 
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: BrandColors.cardBorder,
                }]}
                value={overbought}
                onChangeText={setOverbought}
                keyboardType="numeric"
                placeholder="70"
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Run Backtest</ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={[styles.explanationCard, { backgroundColor: BrandColors.primaryLight + "15" }]}>
              <Feather name="info" size={16} color={BrandColors.primaryLight} />
              <ThemedText style={[styles.explanationText, { color: theme.text }]}>
                Run a backtest to see how a strategy would have performed using historical data
              </ThemedText>
            </View>

            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              Select Symbols ({selectedSymbols.length} selected)
            </ThemedText>
            <View style={styles.symbolsGrid}>
              {DEFAULT_SYMBOLS.map((symbol) => (
                <Pressable
                  key={symbol}
                  onPress={() => toggleSymbol(symbol)}
                  style={[
                    styles.symbolChip,
                    {
                      backgroundColor: selectedSymbols.includes(symbol) 
                        ? BrandColors.primaryLight 
                        : theme.backgroundSecondary,
                      borderColor: selectedSymbols.includes(symbol) 
                        ? BrandColors.primaryLight 
                        : BrandColors.cardBorder,
                    },
                  ]}
                >
                  <ThemedText style={[
                    styles.symbolChipText,
                    { color: selectedSymbols.includes(symbol) ? "#FFFFFF" : theme.text }
                  ]}>
                    {symbol}
                  </ThemedText>
                  {selectedSymbols.includes(symbol) ? (
                    <Feather name="check" size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />
                  ) : null}
                </Pressable>
              ))}
            </View>

            <View style={styles.customSymbolRow}>
              <TextInput
                style={[styles.customSymbolInput, { 
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: BrandColors.cardBorder,
                }]}
                placeholder="Add custom symbol..."
                placeholderTextColor={theme.textSecondary}
                value={customSymbol}
                onChangeText={setCustomSymbol}
                autoCapitalize="characters"
                onSubmitEditing={addCustomSymbol}
              />
              <Pressable 
                onPress={addCustomSymbol} 
                style={[styles.addButton, { backgroundColor: BrandColors.primaryLight }]}
              >
                <Feather name="plus" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            {selectedSymbols.filter(s => !DEFAULT_SYMBOLS.includes(s)).length > 0 ? (
              <View style={styles.customSymbolsRow}>
                {selectedSymbols.filter(s => !DEFAULT_SYMBOLS.includes(s)).map((symbol) => (
                  <Pressable
                    key={symbol}
                    onPress={() => toggleSymbol(symbol)}
                    style={[styles.symbolChip, { 
                      backgroundColor: BrandColors.primaryLight,
                      borderColor: BrandColors.primaryLight,
                    }]}
                  >
                    <ThemedText style={[styles.symbolChipText, { color: "#FFFFFF" }]}>
                      {symbol}
                    </ThemedText>
                    <Feather name="x" size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: Spacing.xl }]}>
              Strategy Type
            </ThemedText>
            {(Object.keys(STRATEGY_OPTIONS) as StrategyType[]).map((type) => (
              <Pressable
                key={type}
                onPress={() => setStrategyType(type)}
                style={[
                  styles.strategyOption,
                  {
                    backgroundColor: strategyType === type 
                      ? BrandColors.primaryLight + "15" 
                      : theme.backgroundSecondary,
                    borderColor: strategyType === type 
                      ? BrandColors.primaryLight 
                      : BrandColors.cardBorder,
                  },
                ]}
              >
                <View style={styles.strategyOptionHeader}>
                  <View style={[
                    styles.radioOuter,
                    { borderColor: strategyType === type ? BrandColors.primaryLight : theme.textSecondary }
                  ]}>
                    {strategyType === type ? (
                      <View style={[styles.radioInner, { backgroundColor: BrandColors.primaryLight }]} />
                    ) : null}
                  </View>
                  <ThemedText style={[styles.strategyName, { color: theme.text }]}>
                    {STRATEGY_OPTIONS[type].name}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.strategyDescription, { color: theme.textSecondary }]}>
                  {STRATEGY_OPTIONS[type].description}
                </ThemedText>
              </Pressable>
            ))}

            {renderStrategyParams()}

            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: Spacing.xl }]}>
              Allocation
            </ThemedText>
            <View style={styles.allocationRow}>
              <TextInput
                style={[styles.allocationInput, { 
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: BrandColors.cardBorder,
                }]}
                value={allocationPct}
                onChangeText={setAllocationPct}
                keyboardType="numeric"
                placeholder="10"
                placeholderTextColor={theme.textSecondary}
              />
              <ThemedText style={[styles.allocationSuffix, { color: theme.textSecondary }]}>
                % per position
              </ThemedText>
            </View>

            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: Spacing.xl }]}>
              Date Range
            </ThemedText>
            <View style={styles.dateRangeInfo}>
              <View style={styles.dateItem}>
                <ThemedText style={[styles.dateLabel, { color: theme.textSecondary }]}>Start</ThemedText>
                <ThemedText style={[styles.dateValue, { fontFamily: Fonts?.mono }]}>{defaultStartDate}</ThemedText>
              </View>
              <Feather name="arrow-right" size={16} color={theme.textSecondary} />
              <View style={styles.dateItem}>
                <ThemedText style={[styles.dateLabel, { color: theme.textSecondary }]}>End</ThemedText>
                <ThemedText style={[styles.dateValue, { fontFamily: Fonts?.mono }]}>{defaultEndDate}</ThemedText>
              </View>
            </View>

            <ThemedText style={[styles.dateHint, { color: theme.textSecondary }]}>
              Last 90 days of historical data
            </ThemedText>

            <View style={[styles.warningCard, { backgroundColor: BrandColors.warning + "15" }]}>
              <Feather name="alert-triangle" size={14} color={BrandColors.warning} />
              <ThemedText style={[styles.warningText, { color: theme.textSecondary }]}>
                Survivorship bias warning: Backtests only include currently listed stocks and may overstate historical performance.
              </ThemedText>
            </View>
          </ScrollView>

          <Pressable 
            onPress={handleSubmit} 
            disabled={isLoading || selectedSymbols.length === 0}
            style={[
              styles.submitButton, 
              { backgroundColor: BrandColors.primaryLight },
              (isLoading || selectedSymbols.length === 0) && { opacity: 0.5 }
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="play" size={18} color="#FFFFFF" />
                <ThemedText style={styles.submitButtonText}>Run Backtest</ThemedText>
              </>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EmptyBacktests() {
  const { theme } = useTheme();
  return (
    <Card elevation={1} style={styles.emptyCard}>
      <Feather name="bar-chart" size={48} color={theme.textSecondary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
        No backtests yet
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Run your first backtest to see historical performance
      </ThemedText>
    </Card>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { theme } = useTheme();
  return (
    <Card elevation={1} style={styles.errorCard}>
      <Feather name="alert-circle" size={32} color={BrandColors.error} />
      <ThemedText style={[styles.errorCardText, { color: theme.textSecondary }]}>
        {message}
      </ThemedText>
      {onRetry ? (
        <Pressable onPress={onRetry} style={[styles.retryButton, { backgroundColor: BrandColors.primaryLight }]}>
          <ThemedText style={styles.retryText}>Try Again</ThemedText>
        </Pressable>
      ) : null}
    </Card>
  );
}

type NavigationProp = NativeStackNavigationProp<AnalyticsStackParamList>;

export default function BacktestsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp>();
  const [showModal, setShowModal] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton onPress={() => setShowModal(true)}>
          <Feather name="plus" size={24} color={BrandColors.primaryLight} />
        </HeaderButton>
      ),
    });
  }, [navigation]);

  const { data, isLoading, error, refetch } = useQuery<BacktestsResponse>({
    queryKey: ["/api/backtests"],
    refetchInterval: 10000,
  });

  const runBacktestMutation = useMutation({
    mutationFn: async (params: BacktestParams) => {
      return apiRequest("POST", "/api/backtests/run", {
        universe: params.universe,
        startDate: params.startDate,
        endDate: params.endDate,
        strategyConfig: {
          type: params.strategyType,
          ...params.strategyParams,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backtests"] });
      setShowModal(false);
    },
  });

  const handleBacktestPress = (run: BacktestRun) => {
    navigation.navigate("BacktestDetail", { id: run.id });
  };

  const handleRunBacktest = (data: BacktestParams) => {
    runBacktestMutation.mutate(data);
  };

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight + Spacing.xl }]}>
        <ErrorCard message="Failed to load backtests" onRetry={() => refetch()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          gap: Spacing.md,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={data?.runs ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BacktestCard run={item} onPress={() => handleBacktestPress(item)} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <ThemedText style={styles.headerTitle}>Backtests</ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                Test strategies against historical data
              </ThemedText>
            </View>
            {runBacktestMutation.isError ? (
              <View style={styles.mutationError}>
                <Feather name="alert-triangle" size={14} color={BrandColors.error} />
                <ThemedText style={[styles.mutationErrorText, { color: BrandColors.error }]}>
                  Failed to start backtest
                </ThemedText>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BrandColors.primaryLight} />
              <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
                Loading backtests...
              </ThemedText>
            </View>
          ) : (
            <EmptyBacktests />
          )
        }
      />

      <RunBacktestModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleRunBacktest}
        isLoading={runBacktestMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.md,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  headerTitle: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body,
  },
  backtestCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  cardTitleText: {
    flex: 1,
  },
  universeText: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  dateRangeText: {
    ...Typography.small,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  statusText: {
    ...Typography.small,
    fontWeight: "600",
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  metricItem: {
    alignItems: "center",
  },
  metricLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  metricValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.small,
    flex: 1,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  configHashText: {
    ...Typography.small,
  },
  createdAtText: {
    ...Typography.small,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  emptyTitle: {
    ...Typography.h4,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  errorCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  errorCardText: {
    ...Typography.body,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  retryText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  mutationError: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  mutationErrorText: {
    ...Typography.small,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "85%",
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.cardBorder,
  },
  modalTitle: {
    ...Typography.h3,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalBody: {
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  explanationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  explanationText: {
    ...Typography.caption,
    flex: 1,
  },
  sectionLabel: {
    ...Typography.caption,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  symbolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  symbolChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    minWidth: 60,
    justifyContent: "center",
  },
  symbolChipText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  customSymbolRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  customSymbolInput: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  customSymbolsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  strategyOption: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  strategyOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  strategyName: {
    ...Typography.body,
    fontWeight: "600",
  },
  strategyDescription: {
    ...Typography.small,
    marginLeft: 28,
  },
  paramsContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: "transparent",
    borderRadius: BorderRadius.sm,
  },
  paramRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  paramItem: {
    flex: 1,
  },
  paramLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  paramInput: {
    height: 44,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    textAlign: "center",
  },
  allocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  allocationInput: {
    width: 80,
    height: 44,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    textAlign: "center",
  },
  allocationSuffix: {
    ...Typography.body,
  },
  dateRangeInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  dateItem: {
    alignItems: "center",
  },
  dateLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  dateValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  dateHint: {
    ...Typography.small,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  warningText: {
    ...Typography.small,
    flex: 1,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    margin: Spacing.xl,
    marginTop: 0,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  submitButtonText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
