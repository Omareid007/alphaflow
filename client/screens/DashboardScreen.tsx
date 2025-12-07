import { View, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

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
});
