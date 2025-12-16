import { View, FlatList, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { getApiUrl } from "@/lib/query-client";

interface OrderFill {
  id: string;
  brokerFillId: string | null;
  qty: string;
  price: string;
  occurredAt: string;
}

interface OrderData {
  id: string;
  brokerOrderId: string;
  clientOrderId: string | null;
  symbol: string;
  side: "buy" | "sell";
  type: string;
  qty: string | null;
  status: string;
  submittedAt: string;
  updatedAt: string;
  filledAt: string | null;
  filledQty: string | null;
  filledAvgPrice: string | null;
  traceId: string | null;
  decisionId: string | null;
  fills?: OrderFill[];
}

interface OrdersResponse {
  orders: OrderData[];
  total: number;
  source: {
    type: string;
    timestamp: string;
  };
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "filled":
      return BrandColors.success;
    case "partially_filled":
      return BrandColors.warning;
    case "new":
    case "accepted":
    case "pending_new":
      return BrandColors.primaryLight;
    case "canceled":
    case "expired":
    case "done_for_day":
      return BrandColors.neutral;
    case "rejected":
      return BrandColors.error;
    default:
      return BrandColors.neutral;
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrderRow({ 
  order, 
  isExpanded, 
  onToggle 
}: { 
  order: OrderData; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  const isBuy = order.side === "buy";
  const hasFills = order.fills && order.fills.length > 0;
  
  const displayPrice = order.filledAvgPrice 
    ? `$${parseFloat(order.filledAvgPrice).toFixed(2)}`
    : "N/A";
  
  const displayQty = order.filledQty && parseFloat(order.filledQty) > 0
    ? `${order.filledQty}/${order.qty || "?"}`
    : order.qty || "N/A";

  return (
    <Pressable onPress={onToggle}>
      <Card elevation={1} style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderSymbolContainer}>
            <View style={[
              styles.sideIndicator,
              { backgroundColor: isBuy ? BrandColors.success : BrandColors.error }
            ]} />
            <View>
              <ThemedText style={styles.orderSymbol}>{order.symbol}</ThemedText>
              <ThemedText style={[styles.orderSide, { color: isBuy ? BrandColors.success : BrandColors.error }]}>
                {order.side.toUpperCase()} {order.type}
              </ThemedText>
            </View>
          </View>
          <View style={styles.orderStatus}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(order.status)}20`, borderColor: getStatusColor(order.status) }
            ]}>
              <ThemedText style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                {formatStatus(order.status)}
              </ThemedText>
            </View>
          </View>
        </View>
        
        <View style={styles.orderDetails}>
          <View style={styles.detailColumn}>
            <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Qty</ThemedText>
            <ThemedText style={[styles.detailValue, { fontFamily: Fonts?.mono }]}>{displayQty}</ThemedText>
          </View>
          <View style={styles.detailColumn}>
            <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Avg Price</ThemedText>
            <ThemedText style={[styles.detailValue, { fontFamily: Fonts?.mono }]}>{displayPrice}</ThemedText>
          </View>
          <View style={styles.detailColumn}>
            <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Submitted</ThemedText>
            <ThemedText style={[styles.detailValue, { fontSize: 11 }]}>{formatDate(order.submittedAt)}</ThemedText>
          </View>
          <View style={styles.expandIcon}>
            <Feather 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={18} 
              color={theme.textSecondary} 
            />
          </View>
        </View>

        {isExpanded ? (
          <View style={styles.expandedSection}>
            <View style={styles.expandedRow}>
              <ThemedText style={[styles.expandedLabel, { color: theme.textSecondary }]}>Broker Order ID</ThemedText>
              <ThemedText style={[styles.expandedValue, { fontFamily: Fonts?.mono, fontSize: 10 }]}>
                {order.brokerOrderId.slice(0, 18)}...
              </ThemedText>
            </View>
            {order.traceId ? (
              <View style={styles.expandedRow}>
                <ThemedText style={[styles.expandedLabel, { color: theme.textSecondary }]}>Trace ID</ThemedText>
                <ThemedText style={[styles.expandedValue, { fontFamily: Fonts?.mono, fontSize: 10 }]}>
                  {order.traceId.slice(0, 20)}...
                </ThemedText>
              </View>
            ) : null}
            {order.filledAt ? (
              <View style={styles.expandedRow}>
                <ThemedText style={[styles.expandedLabel, { color: theme.textSecondary }]}>Filled At</ThemedText>
                <ThemedText style={styles.expandedValue}>{formatDate(order.filledAt)}</ThemedText>
              </View>
            ) : null}
            {hasFills ? (
              <View style={styles.fillsSection}>
                <ThemedText style={[styles.fillsTitle, { color: theme.text }]}>
                  Fills ({order.fills!.length})
                </ThemedText>
                {order.fills!.map((fill) => (
                  <View key={fill.id} style={[styles.fillRow, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText style={[styles.fillQty, { fontFamily: Fonts?.mono }]}>
                      {fill.qty} @ ${parseFloat(fill.price).toFixed(2)}
                    </ThemedText>
                    <ThemedText style={[styles.fillTime, { color: theme.textSecondary, fontSize: 10 }]}>
                      {formatDate(fill.occurredAt)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

interface OrdersTableProps {
  limit?: number;
  showHeader?: boolean;
}

export function OrdersTable({ limit = 20, showHeader = true }: OrdersTableProps) {
  const { theme } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ordersPath = `/api/orders?limit=${limit}`;
  
  const { data, isLoading, error, refetch } = useQuery<OrdersResponse>({
    queryKey: [ordersPath],
    queryFn: async () => {
      const url = new URL(ordersPath, getApiUrl());
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status}`);
      return res.json();
    },
    refetchInterval: 15000,
  });

  const handleToggle = (orderId: string) => {
    setExpandedId(expandedId === orderId ? null : orderId);
  };

  const orders = data?.orders || [];

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primaryLight} />
        </View>
      );
    }

    if (error) {
      return (
        <Card elevation={1} style={styles.errorCard}>
          <Feather name="alert-circle" size={24} color={BrandColors.error} />
          <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
            Failed to load orders
          </ThemedText>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <ThemedText style={styles.retryText}>Retry</ThemedText>
          </Pressable>
        </Card>
      );
    }

    if (orders.length === 0) {
      return (
        <Card elevation={1} style={styles.emptyCard}>
          <Feather name="inbox" size={32} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No orders yet
          </ThemedText>
        </Card>
      );
    }

    return (
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OrderRow 
            order={item} 
            isExpanded={expandedId === item.id} 
            onToggle={() => handleToggle(item.id)} 
          />
        )}
        scrollEnabled={false}
        contentContainerStyle={styles.listContent}
      />
    );
  };

  return (
    <View style={styles.container}>
      {showHeader ? (
        <>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Feather name="list" size={20} color={BrandColors.primaryLight} />
              <ThemedText style={styles.headerTitle}>Broker Orders</ThemedText>
            </View>
            <View style={styles.orderBadge}>
              <ThemedText style={styles.orderBadgeText}>{data?.total ?? "-"}</ThemedText>
            </View>
          </View>
          <View style={styles.sourceRow}>
            <View style={[styles.sourceBadge, { backgroundColor: BrandColors.success + "20" }]}>
              <Feather name="check-circle" size={10} color={BrandColors.success} />
              <ThemedText style={[styles.sourceBadgeText, { color: BrandColors.success }]}>
                Source: Alpaca (Broker-synced)
              </ThemedText>
            </View>
            {data?.source?.timestamp ? (
              <ThemedText style={[styles.sourceTime, { color: theme.textSecondary }]}>
                Updated: {new Date(data.source.timestamp).toLocaleTimeString()}
              </ThemedText>
            ) : null}
          </View>
        </>
      ) : null}
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  orderBadge: {
    backgroundColor: BrandColors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.full,
  },
  orderBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    gap: Spacing.sm,
  },
  orderCard: {
    padding: Spacing.md,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  orderSymbolContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sideIndicator: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  orderSymbol: {
    fontSize: 16,
    fontWeight: "700",
  },
  orderSide: {
    fontSize: 11,
    fontWeight: "600",
  },
  orderStatus: {
    alignItems: "flex-end",
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  orderDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  detailColumn: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "500",
  },
  expandIcon: {
    padding: Spacing.xs,
  },
  expandedSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  expandedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  expandedLabel: {
    fontSize: 11,
  },
  expandedValue: {
    fontSize: 11,
    fontWeight: "500",
  },
  fillsSection: {
    marginTop: Spacing.sm,
  },
  fillsTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  fillRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  fillQty: {
    fontSize: 13,
    fontWeight: "500",
  },
  fillTime: {
    fontSize: 11,
  },
  errorCard: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.md,
  },
  errorText: {
    fontSize: 13,
  },
  retryButton: {
    backgroundColor: BrandColors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 13,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  sourceTime: {
    fontSize: 10,
  },
});
