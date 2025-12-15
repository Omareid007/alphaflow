import { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, ScrollView, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import type { TimelineEvent, TimelineResponse } from "@shared/types/ui-contracts";

interface ActivityFlowWidgetProps {
  agentStatus?: {
    isRunning: boolean;
    totalTrades: number;
    totalPnl: string;
    lastHeartbeat: string;
    errorMessage: string | null;
  };
}

const categoryConfig: Record<string, { icon: "activity" | "cpu" | "trending-up" | "alert-circle" | "heart" | "download" | "shield" | "package"; color: string; label: string }> = {
  decision: { icon: "cpu", color: BrandColors.aiLayer, label: "Decision" },
  order: { icon: "package", color: BrandColors.primaryLight, label: "Order" },
  fill: { icon: "trending-up", color: BrandColors.success, label: "Fill" },
  position: { icon: "activity", color: BrandColors.primaryLight, label: "Position" },
  risk: { icon: "shield", color: BrandColors.warning, label: "Risk" },
  system: { icon: "alert-circle", color: BrandColors.error, label: "System" },
  data_fetch: { icon: "download", color: BrandColors.warning, label: "Data" },
};

const statusColors: Record<string, string> = {
  success: BrandColors.success,
  pending: BrandColors.warning,
  warning: BrandColors.warning,
  error: BrandColors.error,
  info: BrandColors.neutral,
};

export function ActivityFlowWidget({ agentStatus }: ActivityFlowWidgetProps) {
  const { theme } = useTheme();
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  const { data: timelineData, isLoading } = useQuery<TimelineResponse>({
    queryKey: ["/api/activity/timeline?limit=10"],
    refetchInterval: 10000,
  });

  const events = timelineData?.events || [];
  const alpacaStatus = timelineData?.meta?.alpacaStatus || "unavailable";

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

  const getStatusIcon = (status: string): "check" | "x" | "clock" | "info" => {
    switch (status) {
      case "success": return "check";
      case "error": return "x";
      case "pending": return "clock";
      default: return "info";
    }
  };

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

      <View style={styles.subtitleRow}>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Real-time orchestrator activity
        </ThemedText>
        <View style={[
          styles.alpacaBadge, 
          { backgroundColor: alpacaStatus === "live" ? BrandColors.success + "20" : BrandColors.warning + "20" }
        ]}>
          <ThemedText style={[
            styles.alpacaBadgeText, 
            { color: alpacaStatus === "live" ? BrandColors.success : BrandColors.warning }
          ]}>
            {alpacaStatus === "live" ? "Broker Live" : "Broker Offline"}
          </ThemedText>
        </View>
      </View>

      {isLoading && events.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={BrandColors.primaryLight} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading activity...
          </ThemedText>
        </View>
      ) : events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="inbox" size={24} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No recent activity
          </ThemedText>
        </View>
      ) : (
        <ScrollView style={styles.activityList} showsVerticalScrollIndicator={false}>
          {events.slice(0, 6).map((event, index) => {
            const config = categoryConfig[event.category] || categoryConfig.decision;
            const isLast = index === events.length - 1 || index === 5;
            const statusColor = statusColors[event.status] || BrandColors.neutral;
            
            return (
              <Pressable 
                key={event.id} 
                style={styles.activityItem}
                onPress={() => setSelectedEvent(event)}
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
                      {event.title}
                    </ThemedText>
                    <Feather name="chevron-right" size={14} color={theme.textSecondary} style={styles.activityChevron} />
                    <View style={[
                      styles.miniStatus,
                      { backgroundColor: statusColor + "20" }
                    ]}>
                      <Feather
                        name={getStatusIcon(event.status)}
                        size={10}
                        color={statusColor}
                      />
                    </View>
                  </View>
                  <View style={styles.activityMeta}>
                    <ThemedText style={[styles.activityTime, { color: theme.textSecondary }]}>
                      {formatTime(event.ts)}
                    </ThemedText>
                    {event.provenance?.provider ? (
                      <View style={[styles.providerBadge, { backgroundColor: theme.textSecondary + "15" }]}>
                        <ThemedText style={[styles.providerText, { color: theme.textSecondary }]}>
                          {event.provenance.provider}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
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
        visible={selectedEvent !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={styles.modalBackdrop}
            onPress={() => setSelectedEvent(null)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundSecondary }]}>
            {selectedEvent ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={[
                    styles.modalIcon,
                    { backgroundColor: (categoryConfig[selectedEvent.category]?.color || BrandColors.primaryLight) + "20" }
                  ]}>
                    <Feather 
                      name={categoryConfig[selectedEvent.category]?.icon || "activity"} 
                      size={20} 
                      color={categoryConfig[selectedEvent.category]?.color || BrandColors.primaryLight} 
                    />
                  </View>
                  <ThemedText style={styles.modalTitle}>
                    {categoryConfig[selectedEvent.category]?.label || "Event"} Details
                  </ThemedText>
                  <Pressable onPress={() => setSelectedEvent(null)} style={styles.modalClose}>
                    <Feather name="x" size={20} color={theme.textSecondary} />
                  </Pressable>
                </View>

                <View style={[styles.modalDivider, { backgroundColor: theme.textSecondary + "20" }]} />

                <View style={styles.modalBody}>
                  <View style={styles.modalRow}>
                    <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Title</ThemedText>
                    <ThemedText style={styles.modalValue}>{selectedEvent.title}</ThemedText>
                  </View>

                  {selectedEvent.subtitle ? (
                    <View style={styles.modalRow}>
                      <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Details</ThemedText>
                      <ThemedText style={styles.modalValue}>{selectedEvent.subtitle}</ThemedText>
                    </View>
                  ) : null}
                  
                  {selectedEvent.entityLinks?.symbol ? (
                    <View style={styles.modalRow}>
                      <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Symbol</ThemedText>
                      <ThemedText style={[styles.modalValue, { color: BrandColors.primaryLight }]}>
                        {selectedEvent.entityLinks.symbol}
                      </ThemedText>
                    </View>
                  ) : null}

                  <View style={styles.modalRow}>
                    <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Status</ThemedText>
                    <View style={[
                      styles.modalStatusBadge,
                      { backgroundColor: (statusColors[selectedEvent.status] || BrandColors.neutral) + "20" }
                    ]}>
                      <ThemedText style={[
                        styles.modalStatusText,
                        { color: statusColors[selectedEvent.status] || BrandColors.neutral }
                      ]}>
                        {selectedEvent.status.toUpperCase()}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.modalRow}>
                    <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Source</ThemedText>
                    <ThemedText style={[styles.modalValue, { color: theme.textSecondary }]}>
                      {selectedEvent.provenance?.provider || "Unknown"}
                    </ThemedText>
                  </View>

                  {selectedEvent.provenance?.cacheStatus && selectedEvent.provenance.cacheStatus !== "unknown" ? (
                    <View style={styles.modalRow}>
                      <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Cache</ThemedText>
                      <View style={[
                        styles.cacheBadge,
                        { backgroundColor: selectedEvent.provenance.cacheStatus === "fresh" ? BrandColors.success + "20" : BrandColors.warning + "20" }
                      ]}>
                        <ThemedText style={[
                          styles.cacheText,
                          { color: selectedEvent.provenance.cacheStatus === "fresh" ? BrandColors.success : BrandColors.warning }
                        ]}>
                          {selectedEvent.provenance.cacheStatus.toUpperCase()}
                        </ThemedText>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.modalRow}>
                    <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Timestamp</ThemedText>
                    <ThemedText style={[styles.modalValue, { color: theme.textSecondary }]}>
                      {new Date(selectedEvent.ts).toLocaleString()}
                    </ThemedText>
                  </View>

                  {selectedEvent.entityLinks?.brokerOrderId ? (
                    <View style={styles.modalRow}>
                      <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Order ID</ThemedText>
                      <ThemedText style={[styles.modalValue, { color: theme.textSecondary, fontSize: 11 }]} numberOfLines={1}>
                        {selectedEvent.entityLinks.brokerOrderId}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>

                <Pressable 
                  style={[styles.modalButton, { backgroundColor: BrandColors.primaryLight + "15" }]}
                  onPress={() => setSelectedEvent(null)}
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
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  subtitle: {
    ...Typography.small,
  },
  alpacaBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  alpacaBadgeText: {
    fontSize: 9,
    fontWeight: "600",
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
  activityMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: 2,
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
  providerBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  providerText: {
    fontSize: 8,
    fontWeight: "500",
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
  cacheBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  cacheText: {
    fontSize: 10,
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
