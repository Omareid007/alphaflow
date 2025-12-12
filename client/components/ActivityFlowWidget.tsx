import { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, ScrollView, Modal } from "react-native";
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
  const [selectedActivity, setSelectedActivity] = useState<AgentActivity | null>(null);

  const { data: recentDecisions, isLoading: isLoadingDecisions } = useQuery<any[]>({
    queryKey: ["/api/ai-decisions?limit=5"],
    refetchInterval: 10000,
  });

  const { data: recentTrades, isLoading: isLoadingTrades } = useQuery<any[]>({
    queryKey: ["/api/trades?limit=5"],
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
              <Pressable 
                key={activity.id} 
                style={styles.activityItem}
                onPress={() => setSelectedActivity(activity)}
              >
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
                    <Feather name="chevron-right" size={14} color={theme.textSecondary} style={styles.activityChevron} />
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
              </Pressable>
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

      <Modal
        visible={selectedActivity !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedActivity(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={styles.modalBackdrop}
            onPress={() => setSelectedActivity(null)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundSecondary }]}>
            {selectedActivity ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={[
                    styles.modalIcon,
                    { backgroundColor: (nodeConfig[selectedActivity.type]?.color || BrandColors.primaryLight) + "20" }
                  ]}>
                    <Feather 
                      name={nodeConfig[selectedActivity.type]?.icon || "activity"} 
                      size={20} 
                      color={nodeConfig[selectedActivity.type]?.color || BrandColors.primaryLight} 
                    />
                  </View>
                  <ThemedText style={styles.modalTitle}>
                    {selectedActivity.type.charAt(0).toUpperCase() + selectedActivity.type.slice(1)} Details
                  </ThemedText>
                  <Pressable onPress={() => setSelectedActivity(null)} style={styles.modalClose}>
                    <Feather name="x" size={20} color={theme.textSecondary} />
                  </Pressable>
                </View>

                <View style={[styles.modalDivider, { backgroundColor: theme.textSecondary + "20" }]} />

                <View style={styles.modalBody}>
                  {selectedActivity.symbol ? (
                    <View style={styles.modalRow}>
                      <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Symbol</ThemedText>
                      <ThemedText style={styles.modalValue}>{selectedActivity.symbol}</ThemedText>
                    </View>
                  ) : null}
                  
                  {selectedActivity.action ? (
                    <View style={styles.modalRow}>
                      <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Action</ThemedText>
                      <ThemedText style={[
                        styles.modalValue,
                        { color: selectedActivity.action.toLowerCase() === "buy" ? BrandColors.success : selectedActivity.action.toLowerCase() === "sell" ? BrandColors.error : theme.text }
                      ]}>
                        {selectedActivity.action.toUpperCase()}
                      </ThemedText>
                    </View>
                  ) : null}

                  <View style={styles.modalRow}>
                    <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Message</ThemedText>
                    <ThemedText style={styles.modalValue}>{selectedActivity.message}</ThemedText>
                  </View>

                  <View style={styles.modalRow}>
                    <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Status</ThemedText>
                    <View style={[
                      styles.modalStatusBadge,
                      { backgroundColor: selectedActivity.status === "success" ? BrandColors.success + "20" : selectedActivity.status === "error" ? BrandColors.error + "20" : BrandColors.warning + "20" }
                    ]}>
                      <ThemedText style={[
                        styles.modalStatusText,
                        { color: selectedActivity.status === "success" ? BrandColors.success : selectedActivity.status === "error" ? BrandColors.error : BrandColors.warning }
                      ]}>
                        {selectedActivity.status.toUpperCase()}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.modalRow}>
                    <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Timestamp</ThemedText>
                    <ThemedText style={[styles.modalValue, { color: theme.textSecondary }]}>
                      {new Date(selectedActivity.timestamp).toLocaleString()}
                    </ThemedText>
                  </View>
                </View>

                <Pressable 
                  style={[styles.modalButton, { backgroundColor: BrandColors.primaryLight + "15" }]}
                  onPress={() => setSelectedActivity(null)}
                >
                  <ThemedText style={[styles.modalButtonText, { color: BrandColors.primaryLight }]}>
                    Close
                  </ThemedText>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
  activityChevron: {
    marginLeft: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    ...Typography.h4,
    flex: 1,
  },
  modalClose: {
    padding: Spacing.xs,
  },
  modalDivider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  modalBody: {
    gap: Spacing.sm,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  modalLabel: {
    ...Typography.caption,
  },
  modalValue: {
    ...Typography.body,
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
    marginLeft: Spacing.md,
  },
  modalStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  modalStatusText: {
    ...Typography.small,
    fontWeight: "600",
  },
  modalButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
  },
  modalButtonText: {
    ...Typography.body,
    fontWeight: "600",
  },
});
