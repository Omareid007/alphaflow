import { View, FlatList, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

interface AnalyticsSummary {
  totalPnl: string;
  realizedPnl: string;
  unrealizedPnl: string;
  winRate: string;
  openPositions: number;
  isAgentRunning: boolean;
  dailyPnl: string;
  account: {
    equity: string;
    portfolioValue: string;
  };
}

interface AlpacaAccount {
  portfolio_value: string;
  equity: string;
  last_equity: string;
}

interface RecentActivity {
  id: string;
  type: "order" | "trade" | "decision";
  symbol: string;
  action: string;
  timestamp: string;
  value?: string;
}

function WelcomeCard() {
  const { theme } = useTheme();
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good Morning" : currentHour < 18 ? "Good Afternoon" : "Good Evening";

  return (
    <Card elevation={2} style={styles.welcomeCard}>
      <View style={styles.welcomeContent}>
        <View>
          <ThemedText style={styles.greetingText}>{greeting}</ThemedText>
          <ThemedText style={[styles.welcomeSubtext, { color: theme.textSecondary }]}>
            Welcome to your trading dashboard
          </ThemedText>
        </View>
        <Feather name="trending-up" size={40} color={BrandColors.primaryLight} />
      </View>
    </Card>
  );
}

function AccountSummaryCard() {
  const { theme } = useTheme();

  const { data: account, isLoading } = useQuery<AlpacaAccount>({
    queryKey: ["/api/alpaca/account"],
    refetchInterval: 10000,
  });

  const { data: analytics } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary"],
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <Card elevation={1} style={styles.summaryCard}>
        <ActivityIndicator size="small" color={BrandColors.primaryLight} />
      </Card>
    );
  }

  const portfolioValue = parseFloat(account?.portfolio_value || "0");
  const equity = parseFloat(account?.equity || "0");
  const lastEquity = parseFloat(account?.last_equity || "0");
  const dailyChange = equity - lastEquity;
  const dailyChangePercent = lastEquity > 0 ? ((dailyChange / lastEquity) * 100) : 0;

  const totalPnl = parseFloat(analytics?.totalPnl || "0");
  const realizedPnl = parseFloat(analytics?.realizedPnl || "0");
  const unrealizedPnl = parseFloat(analytics?.unrealizedPnl || "0");

  return (
    <Card elevation={1} style={styles.summaryCard}>
      <View style={styles.cardHeader}>
        <Feather name="pie-chart" size={20} color={BrandColors.success} />
        <ThemedText style={styles.cardTitle}>Portfolio Summary</ThemedText>
      </View>
      <View style={styles.summaryMainValue}>
        <ThemedText style={[styles.portfolioValue, { fontFamily: Fonts?.mono }]}>
          ${portfolioValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </ThemedText>
        <View style={styles.changeRow}>
          <ThemedText style={[
            styles.changeValue,
            {
              fontFamily: Fonts?.mono,
              color: dailyChange >= 0 ? BrandColors.success : BrandColors.error
            }
          ]}>
            {dailyChange >= 0 ? "+" : ""}${Math.abs(dailyChange).toFixed(2)} ({dailyChangePercent >= 0 ? "+" : ""}{dailyChangePercent.toFixed(2)}%)
          </ThemedText>
          <ThemedText style={[styles.changeLabel, { color: theme.textSecondary }]}>today</ThemedText>
        </View>
      </View>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total P&L</ThemedText>
          <ThemedText style={[
            styles.summaryValue,
            {
              fontFamily: Fonts?.mono,
              color: totalPnl >= 0 ? BrandColors.success : BrandColors.error
            }
          ]}>
            ${totalPnl.toFixed(2)}
          </ThemedText>
        </View>
        <View style={styles.summaryItem}>
          <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Realized</ThemedText>
          <ThemedText style={[
            styles.summaryValue,
            {
              fontFamily: Fonts?.mono,
              color: realizedPnl >= 0 ? BrandColors.success : BrandColors.error
            }
          ]}>
            ${realizedPnl.toFixed(2)}
          </ThemedText>
        </View>
        <View style={styles.summaryItem}>
          <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Unrealized</ThemedText>
          <ThemedText style={[
            styles.summaryValue,
            {
              fontFamily: Fonts?.mono,
              color: unrealizedPnl >= 0 ? BrandColors.success : BrandColors.error
            }
          ]}>
            ${unrealizedPnl.toFixed(2)}
          </ThemedText>
        </View>
        <View style={styles.summaryItem}>
          <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>Positions</ThemedText>
          <ThemedText style={[styles.summaryValue, { fontFamily: Fonts?.mono }]}>
            {analytics?.openPositions || 0}
          </ThemedText>
        </View>
      </View>
    </Card>
  );
}

function AgentStatusCard() {
  const { theme } = useTheme();
  const navigation = useNavigation();

  const { data: analytics } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary"],
    refetchInterval: 5000,
  });

  const isRunning = analytics?.isAgentRunning ?? false;
  const winRate = parseFloat(analytics?.winRate || "0");

  return (
    <Pressable onPress={() => navigation.navigate("Auto" as never)}>
      <Card elevation={1} style={styles.agentCard}>
        <View style={styles.cardHeader}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isRunning ? BrandColors.success : theme.textSecondary }]} />
            <ThemedText style={styles.cardTitle}>Trading Agent</ThemedText>
          </View>
          <ThemedText style={[
            styles.statusText,
            { color: isRunning ? BrandColors.success : theme.textSecondary }
          ]}>
            {isRunning ? "Active" : "Inactive"}
          </ThemedText>
        </View>
        <View style={styles.agentStats}>
          <View style={styles.agentStat}>
            <ThemedText style={[styles.agentStatLabel, { color: theme.textSecondary }]}>Win Rate</ThemedText>
            <ThemedText style={[styles.agentStatValue, { fontFamily: Fonts?.mono }]}>{winRate.toFixed(1)}%</ThemedText>
          </View>
          <View style={styles.agentStat}>
            <ThemedText style={[styles.agentStatLabel, { color: theme.textSecondary }]}>Daily P&L</ThemedText>
            <ThemedText style={[
              styles.agentStatValue,
              {
                fontFamily: Fonts?.mono,
                color: parseFloat(analytics?.dailyPnl || "0") >= 0 ? BrandColors.success : BrandColors.error
              }
            ]}>
              ${analytics?.dailyPnl || "0.00"}
            </ThemedText>
          </View>
        </View>
        <View style={styles.viewMoreRow}>
          <ThemedText style={[styles.viewMoreText, { color: BrandColors.primaryLight }]}>View Details</ThemedText>
          <Feather name="chevron-right" size={16} color={BrandColors.primaryLight} />
        </View>
      </Card>
    </Pressable>
  );
}

function QuickActionsCard() {
  const { theme } = useTheme();
  const navigation = useNavigation();

  const actions = [
    {
      key: "strategies",
      icon: "layers",
      label: "Strategies",
      color: BrandColors.primaryLight,
      onPress: () => navigation.navigate("Strategies" as never),
    },
    {
      key: "analytics",
      icon: "bar-chart-2",
      label: "Analytics",
      color: BrandColors.success,
      onPress: () => navigation.navigate("Analytics" as never),
    },
    {
      key: "settings",
      icon: "settings",
      label: "Settings",
      color: BrandColors.neutral,
      onPress: () => navigation.navigate("Admin" as never),
    },
  ];

  return (
    <Card elevation={1} style={styles.actionsCard}>
      <View style={styles.cardHeader}>
        <Feather name="zap" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Quick Actions</ThemedText>
      </View>
      <View style={styles.actionsGrid}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            style={styles.actionButton}
            onPress={action.onPress}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: action.color + "20" }]}>
              <Feather name={action.icon as keyof typeof Feather.glyphMap} size={24} color={action.color} />
            </View>
            <ThemedText style={[styles.actionLabel, { color: theme.text }]}>{action.label}</ThemedText>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const sections = [
    { key: "welcome", component: <WelcomeCard /> },
    { key: "summary", component: <AccountSummaryCard /> },
    { key: "agent", component: <AgentStatusCard /> },
    { key: "actions", component: <QuickActionsCard /> },
  ];

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
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
  welcomeCard: {
    borderWidth: 1,
    borderColor: BrandColors.primaryLight,
    borderLeftWidth: 4,
  },
  welcomeContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greetingText: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  welcomeSubtext: {
    ...Typography.body,
  },
  summaryCard: {
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
  summaryMainValue: {
    marginBottom: Spacing.lg,
  },
  portfolioValue: {
    ...Typography.h1,
    fontSize: 32,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  changeValue: {
    ...Typography.body,
  },
  changeLabel: {
    ...Typography.small,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  summaryItem: {
    width: "48%",
    flexGrow: 1,
  },
  summaryLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  agentCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...Typography.caption,
    fontWeight: "600",
    marginLeft: "auto",
  },
  agentStats: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  agentStat: {
    flex: 1,
  },
  agentStatLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  agentStatValue: {
    ...Typography.h3,
  },
  viewMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: BrandColors.cardBorder,
  },
  viewMoreText: {
    ...Typography.body,
    fontWeight: "600",
  },
  actionsCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  actionsGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    ...Typography.body,
    fontWeight: "600",
  },
});
