import { useState } from "react";
import { View, FlatList, StyleSheet, ActivityIndicator, Pressable, Modal, TextInput, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
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

interface RunBacktestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { universe: string[]; startDate: string; endDate: string }) => void;
  isLoading: boolean;
}

const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "SPY", "QQQ", "TSLA", "NVDA"];

function RunBacktestModal({ visible, onClose, onSubmit, isLoading }: RunBacktestModalProps) {
  const { theme } = useTheme();
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(["AAPL"]);
  const [customSymbol, setCustomSymbol] = useState("");

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
    onSubmit({
      universe: selectedSymbols,
      startDate: defaultStartDate,
      endDate: defaultEndDate,
    });
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
            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>Select Symbols</ThemedText>
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

            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
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

  const { data, isLoading, error, refetch } = useQuery<BacktestsResponse>({
    queryKey: ["/api/backtests"],
    refetchInterval: 10000,
  });

  const runBacktestMutation = useMutation({
    mutationFn: async (params: { universe: string[]; startDate: string; endDate: string }) => {
      return apiRequest("POST", "/api/backtests/run", {
        universe: params.universe,
        startDate: params.startDate,
        endDate: params.endDate,
        strategyConfig: {
          type: "mean-reversion",
          lookbackPeriod: 20,
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

  const handleRunBacktest = (data: { universe: string[]; startDate: string; endDate: string }) => {
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

      <Pressable
        onPress={() => setShowModal(true)}
        style={[styles.fab, { backgroundColor: BrandColors.primaryLight }]}
        accessibilityLabel="Run new backtest"
        accessibilityRole="button"
      >
        <Feather name="play" size={24} color="#FFFFFF" />
      </Pressable>

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
  fab: {
    position: "absolute",
    bottom: 100,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
    maxHeight: "80%",
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
  sectionLabel: {
    ...Typography.caption,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  symbolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  symbolChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  symbolChipText: {
    ...Typography.small,
    fontWeight: "600",
  },
  customSymbolRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  customSymbolInput: {
    flex: 1,
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    ...Typography.body,
  },
  addButton: {
    width: Spacing.inputHeight,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  customSymbolsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  dateRangeInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: "transparent",
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
    marginTop: Spacing.sm,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    margin: Spacing.xl,
    marginTop: 0,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
  },
  submitButtonText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
