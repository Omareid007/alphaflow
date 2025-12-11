import { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, LayoutAnimation, Platform, UIManager } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ConnectorData {
  id: string;
  name: string;
  category: string;
  description: string;
  connected: boolean;
  hasApiKey: boolean;
  cacheSize?: number;
  circuitBreakerOpen?: boolean;
  rateLimitedUntil?: number | null;
  model?: string;
  lastChecked: string;
}

interface DataFunnelsWidgetProps {
  connectors: ConnectorData[] | undefined;
  isLoading: boolean;
  onRefresh: () => void;
}

const categoryConfig: Record<string, { label: string; icon: "server" | "database" | "radio" | "zap" | "cpu"; color: string }> = {
  broker: { label: "Trading", icon: "zap", color: BrandColors.success },
  market_data: { label: "Market Data", icon: "database", color: BrandColors.primaryLight },
  news: { label: "News", icon: "radio", color: BrandColors.warning },
  enrichment: { label: "Enrichment", icon: "server", color: BrandColors.aiLayer },
  ai: { label: "AI", icon: "cpu", color: BrandColors.cryptoLayer },
};

export function DataFunnelsWidget({ connectors, isLoading, onRefresh }: DataFunnelsWidgetProps) {
  const { theme } = useTheme();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    broker: true,
    market_data: true,
    news: true,
    enrichment: true,
    ai: true,
  });

  const toggleCategory = (category: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const groupedConnectors = (connectors || []).reduce((acc, connector) => {
    const category = connector.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(connector);
    return acc;
  }, {} as Record<string, ConnectorData[]>);

  const getStatusInfo = (connector: ConnectorData): { color: string; label: string; icon: "check-circle" | "x-circle" | "alert-circle" } => {
    if (connector.circuitBreakerOpen) {
      return { color: BrandColors.error, label: "Rate Limited", icon: "alert-circle" };
    }
    if (!connector.hasApiKey) {
      return { color: BrandColors.neutral, label: "No API Key", icon: "x-circle" };
    }
    if (connector.connected) {
      return { color: BrandColors.success, label: "Connected", icon: "check-circle" };
    }
    return { color: BrandColors.error, label: "Disconnected", icon: "x-circle" };
  };

  const categories = Object.keys(groupedConnectors).sort((a, b) => {
    const order = ["broker", "market_data", "news", "enrichment", "ai"];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <Card elevation={1} style={styles.card}>
      <View style={styles.header}>
        <Feather name="git-merge" size={20} color={BrandColors.aiLayer} />
        <ThemedText style={styles.title}>Data Funnels</ThemedText>
        <Pressable onPress={onRefresh} disabled={isLoading} style={styles.refreshButton}>
          <Feather
            name="refresh-cw"
            size={18}
            color={isLoading ? theme.textSecondary : BrandColors.primaryLight}
          />
        </Pressable>
      </View>

      <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
        Data sources feeding into AI decision engine
      </ThemedText>

      {isLoading && !connectors ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={BrandColors.primaryLight} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading data sources...
          </ThemedText>
        </View>
      ) : (
        <View style={styles.funnelContainer}>
          {categories.map((category, catIndex) => {
            const config = categoryConfig[category] || { label: category, icon: "server" as const, color: BrandColors.neutral };
            const categoryConnectors = groupedConnectors[category];
            const connectedCount = categoryConnectors.filter(c => c.connected).length;
            
            const isExpanded = expandedCategories[category] !== false;
            
            return (
              <View key={category} style={styles.categorySection}>
                <Pressable 
                  onPress={() => toggleCategory(category)}
                  style={[styles.categoryHeader, { backgroundColor: config.color + "15" }]}
                >
                  <Feather name={config.icon} size={14} color={config.color} />
                  <ThemedText style={[styles.categoryLabel, { color: config.color }]}>
                    {config.label}
                  </ThemedText>
                  <View style={[styles.countBadge, { backgroundColor: config.color + "20" }]}>
                    <ThemedText style={[styles.countText, { color: config.color }]}>
                      {connectedCount}/{categoryConnectors.length}
                    </ThemedText>
                  </View>
                  <Feather 
                    name={isExpanded ? "chevron-down" : "chevron-right"} 
                    size={16} 
                    color={config.color} 
                  />
                </Pressable>
                
                {isExpanded ? categoryConnectors.map((connector, idx) => {
                  const status = getStatusInfo(connector);
                  return (
                    <View
                      key={connector.id}
                      style={[
                        styles.connectorRow,
                        { borderLeftColor: status.color },
                        idx === categoryConnectors.length - 1 && styles.lastConnectorRow,
                      ]}
                    >
                      <View style={styles.connectorInfo}>
                        <ThemedText style={styles.connectorName}>{connector.name}</ThemedText>
                        <ThemedText style={[styles.connectorDesc, { color: theme.textSecondary }]}>
                          {connector.description}
                        </ThemedText>
                      </View>
                      <View style={styles.statusContainer}>
                        <Feather name={status.icon} size={14} color={status.color} />
                        {connector.cacheSize !== undefined && connector.cacheSize > 0 ? (
                          <ThemedText style={[styles.cacheText, { color: theme.textSecondary }]}>
                            {connector.cacheSize}
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>
                  );
                }) : null}
                
                {catIndex < categories.length - 1 ? (
                  <View style={styles.flowArrow}>
                    <Feather name="chevron-down" size={16} color={theme.textSecondary} />
                  </View>
                ) : null}
              </View>
            );
          })}
          
          <View style={[styles.fusionTarget, { borderColor: BrandColors.success }]}>
            <Feather name="cpu" size={18} color={BrandColors.success} />
            <ThemedText style={[styles.fusionLabel, { color: BrandColors.success }]}>
              AI Decision Engine
            </ThemedText>
          </View>
        </View>
      )}
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
  refreshButton: {
    padding: Spacing.xs,
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
  funnelContainer: {
    gap: Spacing.sm,
  },
  categorySection: {
    gap: Spacing.xs,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  categoryLabel: {
    ...Typography.small,
    fontWeight: "600",
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  countText: {
    ...Typography.small,
    fontWeight: "600",
    fontSize: 10,
  },
  connectorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginLeft: Spacing.md,
    borderLeftWidth: 2,
  },
  lastConnectorRow: {
    borderBottomLeftRadius: BorderRadius.xs,
  },
  connectorInfo: {
    flex: 1,
  },
  connectorName: {
    ...Typography.caption,
    fontWeight: "500",
  },
  connectorDesc: {
    ...Typography.small,
    fontSize: 10,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  cacheText: {
    ...Typography.small,
    fontSize: 10,
  },
  flowArrow: {
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  fusionTarget: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  fusionLabel: {
    ...Typography.body,
    fontWeight: "600",
  },
});
