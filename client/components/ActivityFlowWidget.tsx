import { View, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

interface AgentActivity {
  id: string;
  type: "analysis" | "decision" | "trade" | "error" | "health" | "data_fetch";
  symbol?: string;
  action?: string;
  message: string;
  timestamp: string;
  status: "success" | "pending" | "error";
}

interface OrchestratorStatus {
  isRunning: boolean;
  currentPhase: string;
  lastCycleTime: string;
  cycleCount: number;
  activeSymbols: string[];
}

interface ActivityFlowWidgetProps {
  agentStatus?: {
    isRunning: boolean;
    totalTrades: number;
    totalPnl: string;
    lastHeartbeat: string;
    errorMessage: string | null;
  };
}

const nodeConfig: Record<string, { icon: "activity" | "cpu" | "trending-up" | "alert-circle" | "heart" | "download"; color: string }> = {
  analysis: { icon: "activity", color: BrandColors.primaryLight },
  decision: { icon: "cpu", color: BrandColors.aiLayer },
  trade: { icon: "trending-up", color: BrandColors.success },
  error: { icon: "alert-circle", color: BrandColors.error },
  health: { icon: "heart", color: BrandColors.success },
  data_fetch: { icon: "download", color: BrandColors.warning },
};

export function ActivityFlowWidget({ agentStatus }: ActivityFlowWidgetProps) {
  const { theme } = useTheme();

  const { data: recentDecisions, isLoading: isLoadingDecisions } = useQuery<any[]>({
    queryKey: ["/api/ai/decisions", { limit: 5 }],
    refetchInterval: 10000,
  });

  const { data: recentTrades, isLoading: isLoadingTrades } = useQuery<any[]>({
    queryKey: ["/api/trades", { limit: 5 }],
    refetchInterval: 10000,
  });

  const activities: AgentActivity[] = [];

  if (agentStatus?.isRunning) {
    activities.push({
      id: "heartbeat",
      type: "health",
      message: "Agent running",
      timestamp: agentStatus.lastHeartbeat || new Date().toISOString(),
      status: "success",
    });
  }

  if (recentDecisions && recentDecisions.length > 0) {
    recentDecisions.slice(0, 3).forEach((decision, idx) => {
      activities.push({
        id: `decision-${idx}`,
        type: "decision",
        symbol: decision.symbol,
        action: decision.action,
        message: `${decision.action} ${decision.symbol} (${Math.round((decision.confidence || 0) * 100)}%)`,
        timestamp: decision.timestamp || decision.createdAt,
        status: "success",
      });
    });
  }

  if (recentTrades && recentTrades.length > 0) {
    recentTrades.slice(0, 3).forEach((trade, idx) => {
      activities.push({
        id: `trade-${idx}`,
        type: "trade",
        symbol: trade.symbol,
        action: trade.side,
        message: `${trade.side.toUpperCase()} ${trade.quantity} ${trade.symbol} @ $${trade.price}`,
        timestamp: trade.executedAt || trade.createdAt,
        status: trade.status === "filled" ? "success" : trade.status === "rejected" ? "error" : "pending",
      });
    });
  }

  if (agentStatus?.errorMessage) {
    activities.push({
      id: "error",
      type: "error",
      message: agentStatus.errorMessage.slice(0, 50),
      timestamp: new Date().toISOString(),
      status: "error",
    });
  }

  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  };

  const isLoading = isLoadingDecisions || isLoadingTrades;

  return (
    <Card elevation={1} style={styles.card}>
      <View style={styles.header}>
        <Feather name="git-branch" size={20} color={BrandColors.success} />
        <ThemedText style={styles.title}>Activity Flow</ThemedText>
        <View style={[styles.statusBadge, { backgroundColor: agentStatus?.isRunning ? BrandColors.success + "20" : BrandColors.error + "20" }]}>
          <View style={[styles.statusDot, { backgroundColor: agentStatus?.isRunning ? BrandColors.success : BrandColors.error }]} />
          <ThemedText style={[styles.statusText, { color: agentStatus?.isRunning ? BrandColors.success : BrandColors.error }]}>
            {agentStatus?.isRunning ? "Active" : "Stopped"}
          </ThemedText>
        </View>
      </View>

      <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
        Real-time orchestrator activity
      </ThemedText>

      {isLoading && activities.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={BrandColors.primaryLight} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading activity...
          </ThemedText>
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="inbox" size={24} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No recent activity
          </ThemedText>
        </View>
      ) : (
        <ScrollView style={styles.activityList} showsVerticalScrollIndicator={false}>
          {activities.slice(0, 6).map((activity, index) => {
            const config = nodeConfig[activity.type] || nodeConfig.analysis;
            const isLast = index === activities.length - 1 || index === 5;
            
            return (
              <View key={activity.id} style={styles.activityItem}>
                <View style={styles.nodeColumn}>
                  <View style={[styles.node, { backgroundColor: config.color + "20", borderColor: config.color }]}>
                    <Feather name={config.icon} size={12} color={config.color} />
                  </View>
                  {!isLast ? (
                    <View style={[styles.connector, { backgroundColor: theme.textSecondary + "30" }]} />
                  ) : null}
                </View>
                
                <View style={styles.activityContent}>
                  <View style={styles.activityHeader}>
                    <ThemedText style={styles.activityMessage} numberOfLines={1}>
                      {activity.message}
                    </ThemedText>
                    <View style={[
                      styles.miniStatus,
                      { backgroundColor: activity.status === "success" ? BrandColors.success + "20" : activity.status === "error" ? BrandColors.error + "20" : BrandColors.warning + "20" }
                    ]}>
                      <Feather
                        name={activity.status === "success" ? "check" : activity.status === "error" ? "x" : "clock"}
                        size={10}
                        color={activity.status === "success" ? BrandColors.success : activity.status === "error" ? BrandColors.error : BrandColors.warning}
                      />
                    </View>
                  </View>
                  <ThemedText style={[styles.activityTime, { color: theme.textSecondary }]}>
                    {formatTime(activity.timestamp)}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {agentStatus ? (
        <View style={[styles.statsRow, { borderTopColor: theme.textSecondary + "20" }]}>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.primaryLight }]}>
              {agentStatus.totalTrades}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Trades</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.textSecondary + "30" }]} />
          <View style={styles.stat}>
            <ThemedText style={[
              styles.statValue,
              { color: parseFloat(agentStatus.totalPnl) >= 0 ? BrandColors.success : BrandColors.error }
            ]}>
              ${parseFloat(agentStatus.totalPnl || "0").toFixed(2)}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Total P&L</ThemedText>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.h4,
    flex: 1,
  },
  subtitle: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...Typography.small,
    fontWeight: "600",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    ...Typography.caption,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    ...Typography.caption,
  },
  activityList: {
    maxHeight: 200,
  },
  activityItem: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  nodeColumn: {
    alignItems: "center",
    width: 28,
  },
  node: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginVertical: 2,
  },
  activityContent: {
    flex: 1,
    paddingBottom: Spacing.md,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  activityMessage: {
    ...Typography.caption,
    fontWeight: "500",
    flex: 1,
  },
  miniStatus: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTime: {
    ...Typography.small,
    fontSize: 10,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    ...Typography.h4,
  },
  statLabel: {
    ...Typography.small,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
});
