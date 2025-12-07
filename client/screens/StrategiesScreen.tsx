import { useState } from "react";
import { View, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { apiRequest } from "@/lib/query-client";
import type { Strategy } from "@shared/schema";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const strategyIcons: Record<string, keyof typeof Feather.glyphMap> = {
  "range-trading": "minus",
  "momentum": "trending-up",
  "mean-reversion": "refresh-cw",
  "breakout": "zap",
};

function getStrategyIcon(type: string): keyof typeof Feather.glyphMap {
  return strategyIcons[type] || "activity";
}

function getAssetTypes(assets: string[] | null): ("crypto" | "stock")[] {
  if (!assets || assets.length === 0) return ["crypto", "stock"];
  const types: ("crypto" | "stock")[] = [];
  const cryptoSymbols = ["BTC", "ETH", "SOL", "DOGE", "ADA", "XRP"];
  const hasCrypto = assets.some(a => cryptoSymbols.some(c => a.includes(c)));
  const hasStock = assets.some(a => !cryptoSymbols.some(c => a.includes(c)));
  if (hasCrypto) types.push("crypto");
  if (hasStock) types.push("stock");
  if (types.length === 0) return ["crypto", "stock"];
  return types;
}

function StrategyCard({ 
  strategy, 
  onToggle,
  isToggling,
}: { 
  strategy: Strategy; 
  onToggle: (strategy: Strategy) => void;
  isToggling: boolean;
}) {
  const { theme } = useTheme();
  const assetTypes = getAssetTypes(strategy.assets);

  return (
    <Card 
      elevation={1} 
      style={styles.strategyCard} 
      onPress={() => onToggle(strategy)}
    >
      <View style={styles.strategyHeader}>
        <View style={[styles.iconContainer, { backgroundColor: BrandColors.primaryLight + "20" }]}>
          <Feather name={getStrategyIcon(strategy.type)} size={24} color={BrandColors.primaryLight} />
        </View>
        <View style={styles.statusContainer}>
          {isToggling ? (
            <ActivityIndicator size="small" color={BrandColors.primaryLight} />
          ) : strategy.isActive ? (
            <View style={[styles.statusBadge, { backgroundColor: BrandColors.success + "20" }]}>
              <View style={[styles.statusDot, { backgroundColor: BrandColors.success }]} />
              <ThemedText style={[styles.statusText, { color: BrandColors.success }]}>Active</ThemedText>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText style={[styles.statusText, { color: theme.textSecondary }]}>Inactive</ThemedText>
            </View>
          )}
        </View>
      </View>
      <ThemedText style={styles.strategyName}>{strategy.name}</ThemedText>
      <ThemedText style={[styles.strategyDescription, { color: theme.textSecondary }]}>
        {strategy.description || "No description"}
      </ThemedText>
      <View style={styles.assetTags}>
        {assetTypes.map((type) => (
          <View
            key={type}
            style={[
              styles.assetTag,
              {
                borderColor: type === "crypto" ? BrandColors.cryptoLayer : BrandColors.stockLayer,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.assetTagText,
                { color: type === "crypto" ? BrandColors.cryptoLayer : BrandColors.stockLayer },
              ]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </ThemedText>
          </View>
        ))}
      </View>
    </Card>
  );
}

function EmptyStrategies() {
  const { theme } = useTheme();

  return (
    <Card elevation={1} style={styles.emptyCard}>
      <Feather name="layers" size={48} color={theme.textSecondary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
        No strategies configured
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Create your first trading strategy to get started
      </ThemedText>
    </Card>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { theme } = useTheme();

  return (
    <Card elevation={1} style={styles.errorCard}>
      <Feather name="alert-circle" size={32} color={BrandColors.error} />
      <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>
        {message}
      </ThemedText>
      {onRetry ? (
        <Card elevation={2} style={styles.retryButton} onPress={onRetry}>
          <ThemedText style={styles.retryText}>Try Again</ThemedText>
        </Card>
      ) : null}
    </Card>
  );
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function StrategiesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp>();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data: strategies, isLoading, error, refetch } = useQuery<Strategy[]>({
    queryKey: ["/api/strategies"],
    refetchInterval: 10000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (strategy: Strategy) => {
      setTogglingId(strategy.id);
      return apiRequest("PATCH", `/api/strategies/${strategy.id}`, { isActive: !strategy.isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
    },
    onSettled: () => {
      setTogglingId(null);
    },
  });

  const handleStrategyToggle = (strategy: Strategy) => {
    if (!toggleMutation.isPending) {
      toggleMutation.mutate(strategy);
    }
  };

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight + Spacing.xl }]}>
        <ErrorCard message="Failed to load strategies" onRetry={() => refetch()} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.md,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={strategies ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <StrategyCard 
          strategy={item} 
          onToggle={handleStrategyToggle}
          isToggling={togglingId === item.id}
        />
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextContainer}>
              <ThemedText style={styles.headerTitle}>Trading Strategies</ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                Configure and activate automated trading strategies
              </ThemedText>
            </View>
            <Button
              onPress={() => navigation.navigate("StrategyWizard")}
              style={styles.createButton}
            >
              <View style={styles.createButtonContent}>
                <Feather name="plus" size={18} color="#FFFFFF" />
              </View>
            </Button>
          </View>
          {toggleMutation.isError ? (
            <View style={styles.toggleError}>
              <Feather name="alert-triangle" size={14} color={BrandColors.error} />
              <ThemedText style={[styles.toggleErrorText, { color: BrandColors.error }]}>
                Failed to update strategy
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
              Loading strategies...
            </ThemedText>
          </View>
        ) : (
          <EmptyStrategies />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 0,
  },
  createButtonContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  strategyCard: {
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  strategyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  statusContainer: {},
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
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
  strategyName: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  strategyDescription: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  assetTags: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  assetTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  assetTagText: {
    ...Typography.small,
    fontWeight: "500",
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
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  errorCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: BrandColors.cardBorder,
  },
  errorText: {
    ...Typography.body,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: BrandColors.primaryLight,
  },
  retryText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  toggleError: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  toggleErrorText: {
    ...Typography.small,
  },
});
