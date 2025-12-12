import { useState } from "react";
import { View, FlatList, StyleSheet, ActivityIndicator, Pressable, Modal, Platform } from "react-native";
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

interface ConfirmationModalProps {
  visible: boolean;
  strategy: Strategy | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function ConfirmationModal({ visible, strategy, onConfirm, onCancel, isLoading }: ConfirmationModalProps) {
  const { theme } = useTheme();
  
  if (!strategy) return null;
  
  const isActive = strategy.isActive;
  const title = isActive ? "Pause Strategy?" : "Activate Strategy?";
  const message = isActive 
    ? `Are you sure you want to pause "${strategy.name}"? This will stop automated trading for this strategy.`
    : `Are you sure you want to activate "${strategy.name}"? This will start automated trading.`;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.modalOverlay} onPress={onCancel}>
        <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundPrimary }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.modalIconContainer, { backgroundColor: isActive ? BrandColors.warning + "20" : BrandColors.success + "20" }]}>
            <Feather 
              name={isActive ? "pause-circle" : "play-circle"} 
              size={32} 
              color={isActive ? BrandColors.warning : BrandColors.success} 
            />
          </View>
          <ThemedText style={styles.modalTitle}>{title}</ThemedText>
          <ThemedText style={[styles.modalMessage, { color: theme.textSecondary }]}>{message}</ThemedText>
          <View style={styles.modalButtons}>
            <Pressable 
              style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={onCancel}
              disabled={isLoading}
            >
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </Pressable>
            <Pressable 
              style={[styles.modalButton, styles.confirmButton, { backgroundColor: isActive ? BrandColors.warning : BrandColors.success }]}
              onPress={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.confirmButtonText}>
                  {isActive ? "Pause" : "Activate"}
                </ThemedText>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

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

function getAdaptiveRiskFromParams(parameters: string | null): boolean {
  if (!parameters) return false;
  try {
    const parsed = JSON.parse(parameters);
    return parsed?.movingAverageParams?.adaptiveRiskEnabled === true;
  } catch {
    return false;
  }
}

type PresetId = "conservative" | "balanced" | "aggressive";

interface AdaptiveRiskInfo {
  enabled: boolean;
  currentPreset: PresetId;
  basePreset: PresetId;
}

function getAdaptiveRiskInfo(parameters: string | null): AdaptiveRiskInfo {
  const defaultInfo: AdaptiveRiskInfo = { 
    enabled: false, 
    currentPreset: "balanced", 
    basePreset: "balanced" 
  };
  
  if (!parameters) return defaultInfo;
  try {
    const parsed = JSON.parse(parameters);
    const maParams = parsed?.movingAverageParams;
    if (!maParams?.adaptiveRiskEnabled) return defaultInfo;
    
    return {
      enabled: true,
      currentPreset: (maParams.currentPresetId || maParams.basePresetId || "balanced") as PresetId,
      basePreset: (maParams.basePresetId || "balanced") as PresetId,
    };
  } catch {
    return defaultInfo;
  }
}

const PRESET_COLORS: Record<PresetId, string> = {
  conservative: "#3B82F6",
  balanced: "#8B5CF6",
  aggressive: "#F59E0B",
};

const PRESET_LABELS: Record<PresetId, string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  aggressive: "Aggressive",
};

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
  const hasAdaptiveRisk = getAdaptiveRiskFromParams(strategy.parameters);
  const adaptiveInfo = getAdaptiveRiskInfo(strategy.parameters);

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
          {adaptiveInfo.enabled ? (
            <View style={[styles.statusBadge, { backgroundColor: PRESET_COLORS[adaptiveInfo.currentPreset] + "20", marginRight: 8 }]}>
              <View style={[styles.statusDot, { backgroundColor: PRESET_COLORS[adaptiveInfo.currentPreset] }]} />
              <ThemedText style={[styles.statusText, { color: PRESET_COLORS[adaptiveInfo.currentPreset] }]}>
                {PRESET_LABELS[adaptiveInfo.currentPreset]}
              </ThemedText>
            </View>
          ) : null}
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
        {hasAdaptiveRisk ? (
          <View style={[styles.assetTag, { borderColor: BrandColors.primaryLight }]}>
            <Feather name="sliders" size={10} color={BrandColors.primaryLight} style={{ marginRight: 4 }} />
            <ThemedText style={[styles.assetTagText, { color: BrandColors.primaryLight }]}>
              Adaptive
            </ThemedText>
          </View>
        ) : null}
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
  const [confirmStrategy, setConfirmStrategy] = useState<Strategy | null>(null);

  const { data: strategies, isLoading, error, refetch } = useQuery<Strategy[]>({
    queryKey: ["/api/strategies"],
    refetchInterval: 10000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (strategy: Strategy) => {
      setTogglingId(strategy.id);
      if (strategy.isActive) {
        await apiRequest("POST", `/api/strategies/${strategy.id}/stop`);
      } else {
        await apiRequest("POST", `/api/strategies/${strategy.id}/start`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/status"] });
      setConfirmStrategy(null);
    },
    onSettled: () => {
      setTogglingId(null);
    },
  });

  const handleStrategyPress = (strategy: Strategy) => {
    setConfirmStrategy(strategy);
  };

  const handleConfirmToggle = () => {
    if (confirmStrategy && !toggleMutation.isPending) {
      toggleMutation.mutate(confirmStrategy);
    }
  };

  const handleCancelToggle = () => {
    setConfirmStrategy(null);
  };

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight + Spacing.xl }]}>
        <ErrorCard message="Failed to load strategies" onRetry={() => refetch()} />
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
        data={strategies ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StrategyCard 
            strategy={item} 
            onToggle={handleStrategyPress}
            isToggling={togglingId === item.id}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <ThemedText style={styles.headerTitle}>Trading Strategies</ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                Configure and activate automated trading strategies
              </ThemedText>
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
      <ConfirmationModal
        visible={confirmStrategy !== null}
        strategy={confirmStrategy}
        onConfirm={handleConfirmToggle}
        onCancel={handleCancelToggle}
        isLoading={toggleMutation.isPending}
      />
      <Pressable
        onPress={() => navigation.navigate("StrategyWizard")}
        style={[styles.fab, { top: headerHeight + Spacing.lg, right: Spacing.lg, backgroundColor: theme.link }]}
        accessibilityLabel="Create new strategy"
        accessibilityRole="button"
        testID="create-strategy-fab"
      >
        <Feather name="plus" size={20} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.md,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    zIndex: 10,
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
    zIndex: 20,
    elevation: 5,
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
  fab: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.25)" } as any)
      : {
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }),
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
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h3,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  modalMessage: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {},
  confirmButton: {},
  cancelButtonText: {
    ...Typography.body,
    fontWeight: "600",
  },
  confirmButtonText: {
    ...Typography.body,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
