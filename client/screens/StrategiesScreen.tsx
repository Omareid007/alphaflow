import { View, FlatList, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

interface Strategy {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  isActive: boolean;
  assetTypes: ("crypto" | "stock")[];
}

const strategies: Strategy[] = [
  {
    id: "range-trading",
    name: "Range Trading",
    description: "Buy at support, sell at resistance within defined price ranges",
    icon: "minus",
    isActive: true,
    assetTypes: ["crypto", "stock"],
  },
  {
    id: "momentum",
    name: "Momentum",
    description: "Follow strong price trends with volume confirmation",
    icon: "trending-up",
    isActive: false,
    assetTypes: ["crypto", "stock"],
  },
  {
    id: "mean-reversion",
    name: "Mean Reversion",
    description: "Trade price returns to moving average after deviation",
    icon: "refresh-cw",
    isActive: false,
    assetTypes: ["stock"],
  },
  {
    id: "breakout",
    name: "Breakout",
    description: "Enter trades when price breaks key support or resistance levels",
    icon: "zap",
    isActive: false,
    assetTypes: ["crypto"],
  },
];

function StrategyCard({ strategy, onPress }: { strategy: Strategy; onPress: () => void }) {
  const { theme } = useTheme();

  return (
    <Card elevation={1} style={styles.strategyCard} onPress={onPress}>
      <View style={styles.strategyHeader}>
        <View style={[styles.iconContainer, { backgroundColor: BrandColors.primaryLight + "20" }]}>
          <Feather name={strategy.icon} size={24} color={BrandColors.primaryLight} />
        </View>
        <View style={styles.statusContainer}>
          {strategy.isActive ? (
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
        {strategy.description}
      </ThemedText>
      <View style={styles.assetTags}>
        {strategy.assetTypes.map((type) => (
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

export default function StrategiesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const handleStrategyPress = (strategy: Strategy) => {
    console.log("Strategy pressed:", strategy.name);
  };

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
      data={strategies}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <StrategyCard strategy={item} onPress={() => handleStrategyPress(item)} />
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Trading Strategies</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Configure and activate automated trading strategies
          </ThemedText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body,
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
});
