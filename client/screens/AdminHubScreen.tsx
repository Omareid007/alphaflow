import { View, ScrollView, StyleSheet, Pressable, TextInput, Switch, ActivityIndicator, RefreshControl, Platform, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography, Fonts } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type AdminSection = 
  | "overview" 
  | "budgets" 
  | "router" 
  | "orchestrator"
  | "orders"
  | "positions"
  | "universe" 
  | "fundamentals" 
  | "candidates" 
  | "enforcement" 
  | "allocation" 
  | "rebalancer" 
  | "observability"
  | "debate"
  | "competition"
  | "strategies"
  | "tools";

interface SidebarItem {
  id: AdminSection;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
}

const sidebarItems: SidebarItem[] = [
  { id: "overview", label: "Overview", icon: "home", description: "Dashboard overview" },
  { id: "budgets", label: "Providers & Budgets", icon: "activity", description: "API rate limits and cache" },
  { id: "router", label: "LLM Router", icon: "git-branch", description: "Model routing config" },
  { id: "orchestrator", label: "Orchestrator", icon: "cpu", description: "Strategy orchestration" },
  { id: "orders", label: "Orders", icon: "file-text", description: "Order lifecycle and fills" },
  { id: "positions", label: "Positions", icon: "briefcase", description: "Live broker positions" },
  { id: "universe", label: "Universe", icon: "globe", description: "Asset universe management" },
  { id: "fundamentals", label: "Fundamentals", icon: "bar-chart-2", description: "Fundamental data" },
  { id: "candidates", label: "Candidates", icon: "users", description: "Trading candidates" },
  { id: "enforcement", label: "Enforcement", icon: "shield", description: "Enforcement gate" },
  { id: "allocation", label: "Allocation", icon: "pie-chart", description: "Allocation policies" },
  { id: "rebalancer", label: "Rebalancer", icon: "refresh-cw", description: "Portfolio rebalancing" },
  { id: "observability", label: "Observability", icon: "search", description: "Traces and work queue" },
  { id: "debate", label: "AI Arena", icon: "message-circle", description: "Multi-role AI debates" },
  { id: "competition", label: "Competition", icon: "award", description: "Trader competitions" },
  { id: "strategies", label: "Strategies", icon: "layers", description: "Strategy versions" },
  { id: "tools", label: "Tools", icon: "tool", description: "Tool registry and audit" },
];

function SidebarNav({ 
  activeSection, 
  onSelect,
  collapsed 
}: { 
  activeSection: AdminSection; 
  onSelect: (section: AdminSection) => void;
  collapsed: boolean;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.sidebarHeader}>
        {!collapsed && (
          <ThemedText style={styles.sidebarTitle}>Admin Hub</ThemedText>
        )}
      </View>
      <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
        {sidebarItems.map((item) => (
          <Pressable
            key={item.id}
            style={[
              styles.sidebarItem,
              activeSection === item.id && { backgroundColor: BrandColors.primaryLight + "20" },
            ]}
            onPress={() => {
              onSelect(item.id);
              if (Platform.OS !== "web") Haptics.selectionAsync();
            }}
          >
            <Feather 
              name={item.icon} 
              size={20} 
              color={activeSection === item.id ? BrandColors.primaryLight : theme.textSecondary} 
            />
            {!collapsed && (
              <ThemedText 
                style={[
                  styles.sidebarLabel,
                  activeSection === item.id && { color: BrandColors.primaryLight, fontWeight: "600" }
                ]}
              >
                {item.label}
              </ThemedText>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function OverviewModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: connectors, isLoading: loadingConnectors } = useQuery<{ connectors: any[] }>({
    queryKey: ["/api/admin/connectors-health"],
  });

  const { data: fusion, isLoading: loadingFusion } = useQuery<any>({
    queryKey: ["/api/admin/data-fusion-status"],
  });

  const { data: aiConfig, isLoading: loadingAi } = useQuery<any>({
    queryKey: ["/api/admin/ai-config"],
  });

  const { data: apiKeys, isLoading: loadingKeys } = useQuery<{ apiKeys: any[]; summary: any }>({
    queryKey: ["/api/admin/api-keys-status"],
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/admin/connectors-health"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/data-fusion-status"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-config"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys-status"] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const configMutation = useMutation({
    mutationFn: async (updates: any) => {
      return apiRequest("PUT", "/api/admin/ai-config", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-config"] });
    },
  });

  const connectorsList = connectors?.connectors || [];
  const fusionScore = fusion?.intelligenceScore || 0;
  const summary = apiKeys?.summary || { total: 0, configured: 0, missing: 0 };

  return (
    <ScrollView
      contentContainerStyle={styles.moduleContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ThemedText style={styles.moduleTitle}>Dashboard Overview</ThemedText>
      
      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="database" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Connector Health</ThemedText>
          {loadingConnectors && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        {connectorsList.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No connectors configured</ThemedText>
        ) : (
          connectorsList.map((c: any, i: number) => (
            <View key={c.name} style={[styles.listRow, i < connectorsList.length - 1 && styles.listRowBorder]}>
              <View style={styles.listRowLeft}>
                <View style={[styles.statusDot, { backgroundColor: c.status === "healthy" ? BrandColors.success : c.status === "warning" ? BrandColors.warning : BrandColors.error }]} />
                <ThemedText style={styles.listRowText}>{c.name}</ThemedText>
              </View>
              <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>
                {c.callsRemaining !== null ? `${c.callsRemaining} calls/min` : c.lastSync || "Not connected"}
              </ThemedText>
            </View>
          ))
        )}
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="layers" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Data Fusion Engine</ThemedText>
          {loadingFusion && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        <View style={styles.fusionRow}>
          <ThemedText style={[styles.fusionLabel, { color: theme.textSecondary }]}>Intelligence Score</ThemedText>
          <View style={styles.fusionBarRow}>
            <View style={styles.fusionBar}>
              <View style={[styles.fusionFill, { 
                width: `${fusionScore * 100}%`, 
                backgroundColor: fusionScore < 0.3 ? BrandColors.error : fusionScore < 0.7 ? BrandColors.warning : BrandColors.success 
              }]} />
            </View>
            <ThemedText style={[styles.fusionValue, { fontFamily: Fonts?.mono }]}>{(fusionScore * 100).toFixed(0)}%</ThemedText>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{fusion?.activeSources || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Active Sources</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{fusion?.totalSources || 7}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Total Sources</ThemedText>
          </View>
        </View>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="cpu" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>AI Configuration</ThemedText>
          {(loadingAi || configMutation.isPending) && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        <View style={styles.configRow}>
          <View style={styles.configInfo}>
            <ThemedText style={styles.configLabel}>Auto-Execute Trades</ThemedText>
            <ThemedText style={[styles.configDesc, { color: theme.textSecondary }]}>Execute trades automatically</ThemedText>
          </View>
          <Switch
            value={aiConfig?.autoExecuteTrades ?? false}
            onValueChange={(v) => configMutation.mutate({ autoExecuteTrades: v })}
            trackColor={{ false: BrandColors.cardBorder, true: BrandColors.primaryLight }}
          />
        </View>
        <View style={[styles.configRow, styles.listRowBorder]}>
          <View style={styles.configInfo}>
            <ThemedText style={styles.configLabel}>Conservative Mode</ThemedText>
            <ThemedText style={[styles.configDesc, { color: theme.textSecondary }]}>85% confidence threshold</ThemedText>
          </View>
          <Switch
            value={aiConfig?.conservativeMode ?? false}
            onValueChange={(v) => configMutation.mutate({ conservativeMode: v })}
            trackColor={{ false: BrandColors.cardBorder, true: BrandColors.primaryLight }}
          />
        </View>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="key" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>API Keys</ThemedText>
          {loadingKeys && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>{summary.configured}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Configured</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.warning, fontFamily: Fonts?.mono }]}>{summary.missing}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Missing</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{summary.total}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Total</ThemedText>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

function BudgetsModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<{ providers: Record<string, any> }>({
    queryKey: ["/api/admin/provider-status"],
  });

  const { data: valyuBudget } = useQuery<any>({
    queryKey: ["/api/admin/valyu-budget"],
  });

  const { data: cacheData, refetch: refetchCache } = useQuery<{ stats: any; entries: any[] }>({
    queryKey: ["/api/admin/api-cache"],
  });

  const purgeMutation = useMutation({
    mutationFn: async ({ provider, expiredOnly }: { provider?: string; expiredOnly?: boolean }) => {
      const res = await apiRequest("POST", "/api/admin/api-cache/purge", { provider, expiredOnly });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-cache"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/provider-status"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ provider, enabled }: { provider: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/provider/${provider}/toggle`, { enabled });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/provider-status"] }),
  });

  const refreshMutation = useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      const res = await apiRequest("POST", `/api/admin/provider/${provider}/force-refresh`, { confirmValyu: provider.toLowerCase() === "valyu" });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/provider-status"] }),
  });

  const providers = data?.providers ? Object.entries(data.providers) : [];

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
      <ThemedText style={styles.moduleTitle}>Providers & Budgets</ThemedText>

      {valyuBudget?.statuses && valyuBudget.statuses.length > 0 && (
        <Card elevation={1} style={styles.moduleCard}>
          <View style={styles.cardHeader}>
            <Feather name="database" size={20} color={BrandColors.primaryLight} />
            <ThemedText style={styles.cardTitle}>Valyu Retrieval Budgets</ThemedText>
          </View>
          {valyuBudget.statuses.map((s: any) => {
            const pct = s.limit > 0 ? Math.min((s.used / s.limit) * 100, 100) : 0;
            return (
              <View key={s.tier} style={styles.budgetRow}>
                <View style={styles.budgetLabelRow}>
                  <ThemedText style={[styles.budgetLabel, { color: theme.textSecondary }]}>{s.tier}</ThemedText>
                  <ThemedText style={[styles.budgetValue, { fontFamily: Fonts?.mono }]}>{s.used}/{s.limit}</ThemedText>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct > 90 ? BrandColors.error : pct > 70 ? BrandColors.warning : BrandColors.success }]} />
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {cacheData?.stats && (
        <Card elevation={1} style={styles.moduleCard}>
          <View style={styles.cardHeader}>
            <Feather name="hard-drive" size={20} color={BrandColors.primaryLight} />
            <ThemedText style={styles.cardTitle}>Cache Statistics</ThemedText>
            <Pressable
              style={[styles.smallButton, purgeMutation.isPending && styles.actionButtonDisabled]}
              onPress={() => purgeMutation.mutate({ expiredOnly: true })}
              disabled={purgeMutation.isPending}
            >
              {purgeMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
                <ThemedText style={styles.smallButtonText}>Purge Expired</ThemedText>
              )}
            </Pressable>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{cacheData.stats.totalEntries || 0}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Entries</ThemedText>
            </View>
            <View style={styles.stat}>
              <ThemedText style={[styles.statValue, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>{cacheData.stats.hits || 0}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Hits</ThemedText>
            </View>
            <View style={styles.stat}>
              <ThemedText style={[styles.statValue, { color: BrandColors.warning, fontFamily: Fonts?.mono }]}>{cacheData.stats.misses || 0}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Misses</ThemedText>
            </View>
            <View style={styles.stat}>
              <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>
                {cacheData.stats.hits + cacheData.stats.misses > 0 
                  ? `${Math.round((cacheData.stats.hits / (cacheData.stats.hits + cacheData.stats.misses)) * 100)}%` 
                  : "N/A"}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Hit Rate</ThemedText>
            </View>
          </View>
          {Object.entries(cacheData.stats.byProvider || {}).map(([provider, pStats]: [string, any]) => (
            <View key={provider} style={[styles.listRow, styles.listRowBorder]}>
              <ThemedText style={[styles.listRowText, { fontFamily: Fonts?.mono }]}>{provider}</ThemedText>
              <View style={styles.listRowRight}>
                <ThemedText style={[styles.listRowMeta, { fontFamily: Fonts?.mono }]}>{pStats.entries} entries</ThemedText>
                <Pressable
                  style={styles.tinyButton}
                  onPress={() => purgeMutation.mutate({ provider })}
                >
                  <Feather name="trash-2" size={12} color={BrandColors.error} />
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
      )}

      {isLoading ? (
        <ActivityIndicator size="large" color={BrandColors.primaryLight} />
      ) : (
        providers.map(([name, status]) => {
          const usagePercent = status.budgetStatus.limit > 0 ? Math.min((status.budgetStatus.currentCount / status.budgetStatus.limit) * 100, 100) : 0;
          const remaining = Math.max(0, status.budgetStatus.limit - status.budgetStatus.currentCount);
          return (
            <Card key={name} elevation={1} style={styles.moduleCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.statusDot, { backgroundColor: !status.enabled ? BrandColors.neutral : !status.budgetStatus.allowed ? BrandColors.error : usagePercent > 90 ? BrandColors.warning : BrandColors.success }]} />
                <ThemedText style={styles.cardTitle}>{name}</ThemedText>
                <Switch
                  value={status.enabled}
                  onValueChange={(v) => toggleMutation.mutate({ provider: name, enabled: v })}
                  trackColor={{ false: BrandColors.cardBorder, true: BrandColors.primaryLight }}
                />
              </View>
              <View style={styles.budgetRow}>
                <View style={styles.budgetLabelRow}>
                  <ThemedText style={[styles.budgetLabel, { color: theme.textSecondary }]}>Budget Usage</ThemedText>
                  <ThemedText style={[styles.budgetValue, { fontFamily: Fonts?.mono }]}>{status.budgetStatus.currentCount}/{status.budgetStatus.limit}</ThemedText>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${usagePercent}%`, backgroundColor: usagePercent > 90 ? BrandColors.error : usagePercent > 70 ? BrandColors.warning : BrandColors.success }]} />
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono, color: remaining > 0 ? BrandColors.success : BrandColors.error }]}>{remaining}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Remaining</ThemedText>
                </View>
                <View style={styles.stat}>
                  <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{Math.round(status.policy.cacheFreshDurationMs / 60000)}m</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Cache TTL</ThemedText>
                </View>
              </View>
              <Pressable
                style={[styles.actionButton, !status.enabled && styles.actionButtonDisabled]}
                onPress={() => refreshMutation.mutate({ provider: name })}
                disabled={!status.enabled || refreshMutation.isPending}
              >
                {refreshMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Feather name="refresh-cw" size={14} color="#fff" />
                    <ThemedText style={styles.actionButtonText}>Force Refresh</ThemedText>
                  </>
                )}
              </Pressable>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

function RouterModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editingChain, setEditingChain] = useState<any[]>([]);

  const { data: configsData, refetch } = useQuery<{ configs: any[]; availableProviders: string[] }>({
    queryKey: ["/api/admin/model-router/configs"],
  });

  const { data: statsData } = useQuery<any>({
    queryKey: ["/api/admin/model-router/stats"],
  });

  const { data: callsData } = useQuery<{ calls: any[]; count: number }>({
    queryKey: ["/api/admin/model-router/calls"],
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ role, fallbackChain }: { role: string; fallbackChain: any[] }) => {
      const res = await apiRequest("PUT", `/api/admin/model-router/configs/${role}`, { fallbackChain });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/model-router/configs"] });
      setEditingRole(null);
      setEditingChain([]);
    },
  });

  const configs = configsData?.configs || [];
  const stats = statsData || { total: 0, totalCost: 0, byRole: {}, byProvider: {} };
  const calls = callsData?.calls || [];
  const providers = configsData?.availableProviders || [];

  const roleNames: Record<string, string> = {
    market_news_summarizer: "News Summarizer",
    technical_analyst: "Technical Analyst",
    risk_manager: "Risk Manager",
    execution_planner: "Execution Planner",
    post_trade_reporter: "Post-Trade Reporter",
  };

  const startEditing = (config: any) => {
    setEditingRole(config.role);
    setEditingChain(JSON.parse(JSON.stringify(config.fallbackChain || [])));
  };

  const cancelEditing = () => {
    setEditingRole(null);
    setEditingChain([]);
    refetch();
  };

  const moveUp = (index: number) => {
    if (index > 0) {
      const newChain = [...editingChain];
      [newChain[index - 1], newChain[index]] = [newChain[index], newChain[index - 1]];
      setEditingChain(newChain);
    }
  };

  const moveDown = (index: number) => {
    if (index < editingChain.length - 1) {
      const newChain = [...editingChain];
      [newChain[index], newChain[index + 1]] = [newChain[index + 1], newChain[index]];
      setEditingChain(newChain);
    }
  };

  const saveChanges = () => {
    if (editingRole) {
      updateConfigMutation.mutate({ role: editingRole, fallbackChain: editingChain });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
      <ThemedText style={styles.moduleTitle}>LLM Model Router</ThemedText>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="zap" size={20} color={BrandColors.success} />
          <ThemedText style={styles.cardTitle}>Active Providers</ThemedText>
        </View>
        <View style={styles.chipsRow}>
          {providers.length > 0 ? providers.map((p) => (
            <View key={p} style={[styles.chip, { backgroundColor: BrandColors.success + "20" }]}>
              <View style={[styles.chipDot, { backgroundColor: BrandColors.success }]} />
              <ThemedText style={[styles.chipText, { fontFamily: Fonts?.mono }]}>{p}</ThemedText>
            </View>
          )) : (
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No providers available</ThemedText>
          )}
        </View>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="activity" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Call Statistics</ThemedText>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{stats.total}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Total Calls</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>${stats.totalCost.toFixed(4)}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Total Cost</ThemedText>
          </View>
        </View>
        {Object.entries(stats.byProvider || {}).map(([provider, data]: [string, any]) => (
          <View key={provider} style={[styles.listRow, styles.listRowBorder]}>
            <ThemedText style={[styles.listRowText, { fontFamily: Fonts?.mono }]}>{provider}</ThemedText>
            <View style={styles.listRowRight}>
              <ThemedText style={[styles.listRowMeta, { fontFamily: Fonts?.mono }]}>{data.count} calls</ThemedText>
              <View style={[styles.badge, { backgroundColor: data.successRate > 90 ? BrandColors.success + "20" : BrandColors.warning + "20" }]}>
                <ThemedText style={[styles.badgeText, { color: data.successRate > 90 ? BrandColors.success : BrandColors.warning }]}>{data.successRate?.toFixed(0) || 0}%</ThemedText>
              </View>
            </View>
          </View>
        ))}
      </Card>

      {configs.map((config) => {
        const isEditing = editingRole === config.role;
        const chain = isEditing ? editingChain : config.fallbackChain || [];
        
        return (
          <Card key={config.role} elevation={1} style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <Feather name="settings" size={18} color={BrandColors.primaryLight} />
              <ThemedText style={styles.cardTitle}>{roleNames[config.role] || config.role}</ThemedText>
              {!isEditing ? (
                <Pressable style={styles.editButton} onPress={() => startEditing(config)}>
                  <Feather name="edit-2" size={14} color={BrandColors.primaryLight} />
                </Pressable>
              ) : null}
            </View>
            <ThemedText style={[styles.configDesc, { color: theme.textSecondary, marginBottom: Spacing.md }]}>{config.description}</ThemedText>
            <ThemedText style={[styles.budgetLabel, { color: theme.textSecondary }]}>Fallback Chain{isEditing ? " (reorder with arrows)" : ""}:</ThemedText>
            {chain.map((m: any, i: number) => (
              <View key={`${m.provider}-${m.model}-${i}`} style={styles.fallbackRow}>
                <View style={[styles.priorityBadge, { backgroundColor: i === 0 ? BrandColors.success : BrandColors.neutral }]}>
                  <ThemedText style={styles.priorityText}>{i + 1}</ThemedText>
                </View>
                <View style={styles.fallbackInfo}>
                  <ThemedText style={[styles.listRowText, { fontFamily: Fonts?.mono }]}>{m.provider}</ThemedText>
                  <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>{m.model}</ThemedText>
                </View>
                {isEditing ? (
                  <View style={styles.reorderButtons}>
                    <Pressable style={styles.reorderButton} onPress={() => moveUp(i)} disabled={i === 0}>
                      <Feather name="chevron-up" size={16} color={i === 0 ? BrandColors.neutral : BrandColors.primaryLight} />
                    </Pressable>
                    <Pressable style={styles.reorderButton} onPress={() => moveDown(i)} disabled={i === chain.length - 1}>
                      <Feather name="chevron-down" size={16} color={i === chain.length - 1 ? BrandColors.neutral : BrandColors.primaryLight} />
                    </Pressable>
                  </View>
                ) : m.costPer1kTokens ? (
                  <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>${m.costPer1kTokens.toFixed(5)}/1k</ThemedText>
                ) : null}
              </View>
            ))}
            {isEditing && (
              <View style={styles.editActions}>
                <Pressable style={styles.cancelButton} onPress={cancelEditing}>
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </Pressable>
                <Pressable 
                  style={[styles.saveButton, updateConfigMutation.isPending && styles.actionButtonDisabled]} 
                  onPress={saveChanges}
                  disabled={updateConfigMutation.isPending}
                >
                  {updateConfigMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
                  )}
                </Pressable>
              </View>
            )}
          </Card>
        );
      })}

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="clock" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Recent Calls</ThemedText>
        </View>
        {calls.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No LLM calls recorded yet</ThemedText>
        ) : calls.slice(0, 10).map((call, i) => (
          <View key={call.id} style={[styles.listRow, i < calls.length - 1 && styles.listRowBorder]}>
            <View style={styles.listRowLeft}>
              <View style={[styles.statusDot, { backgroundColor: call.status === "success" ? BrandColors.success : BrandColors.error }]} />
              <View>
                <ThemedText style={[styles.listRowText, { fontFamily: Fonts?.mono }]}>{roleNames[call.role] || call.role}</ThemedText>
                <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>{call.provider}/{call.model}</ThemedText>
              </View>
            </View>
            <View style={styles.listRowRight}>
              {call.latencyMs && <ThemedText style={[styles.listRowMeta, { fontFamily: Fonts?.mono }]}>{call.latencyMs}ms</ThemedText>}
              {call.estimatedCost && <ThemedText style={[styles.listRowMeta, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>${parseFloat(call.estimatedCost).toFixed(5)}</ThemedText>}
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function UniverseModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "tradable" | "excluded">("all");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const { data: stats, isLoading: loadingStats } = useQuery<any>({
    queryKey: ["/api/admin/universe/stats"],
  });

  const { data: assets, isLoading: loadingAssets, refetch } = useQuery<{ assets: any[]; total: number }>({
    queryKey: ["/api/admin/universe/assets", { tradableOnly: filter === "tradable", excludedOnly: filter === "excluded", search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter === "tradable") params.set("tradableOnly", "true");
      if (filter === "excluded") params.set("excludedOnly", "true");
      if (searchQuery) params.set("search", searchQuery);
      params.set("limit", "100");
      const url = new URL(`/api/admin/universe/assets?${params}`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: "include" });
      return res.json();
    },
  });

  const { data: assetDetail } = useQuery<any>({
    queryKey: ["/api/admin/universe/assets", selectedSymbol],
    enabled: !!selectedSymbol,
    queryFn: async () => {
      const url = new URL(`/api/admin/universe/assets/${selectedSymbol}`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: "include" });
      return res.json();
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const traceId = `univ-${Date.now().toString(36)}`;
      const res = await apiRequest("POST", "/api/admin/universe/refresh", { traceId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/universe/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/universe/assets"] });
    },
  });

  const excludeMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await apiRequest("POST", `/api/admin/universe/exclude/${symbol}`, { reason: "Admin excluded" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/universe/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/universe/stats"] });
    },
  });

  const assetList = assets?.assets || [];

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
      <ThemedText style={styles.moduleTitle}>Universe Management</ThemedText>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="globe" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Universe Stats</ThemedText>
          {loadingStats && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{stats?.totalAssets || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Total Assets</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>{stats?.tradableCount || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Tradable</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.error, fontFamily: Fonts?.mono }]}>{stats?.excludedCount || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Excluded</ThemedText>
          </View>
        </View>
        <Pressable 
          style={styles.actionButton}
          onPress={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          {refreshMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Feather name="refresh-cw" size={14} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Refresh Universe from Alpaca</ThemedText>
            </>
          )}
        </Pressable>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="search" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Search & Filter</ThemedText>
        </View>
        <TextInput
          style={[styles.searchInput, { color: theme.text, backgroundColor: theme.backgroundSecondary, borderColor: BrandColors.cardBorder }]}
          placeholder="Search by symbol..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={styles.filterRow}>
          {(["all", "tradable", "excluded"] as const).map((f) => (
            <Pressable
              key={f}
              style={[styles.filterButton, filter === f && { backgroundColor: BrandColors.primaryLight }]}
              onPress={() => setFilter(f)}
            >
              <ThemedText style={[styles.filterButtonText, filter === f && { color: "#fff" }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="list" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Assets ({assets?.total || 0})</ThemedText>
          {loadingAssets && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        {assetList.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No assets found</ThemedText>
        ) : assetList.slice(0, 50).map((asset: any, i: number) => (
          <Pressable 
            key={asset.symbol} 
            style={[styles.listRow, i < assetList.length - 1 && styles.listRowBorder]}
            onPress={() => setSelectedSymbol(asset.symbol)}
          >
            <View style={styles.listRowLeft}>
              <View style={[styles.statusDot, { backgroundColor: asset.tradable ? BrandColors.success : BrandColors.error }]} />
              <View>
                <ThemedText style={[styles.listRowText, { fontFamily: Fonts?.mono }]}>{asset.symbol}</ThemedText>
                <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]} numberOfLines={1}>{asset.name}</ThemedText>
              </View>
            </View>
            <View style={styles.listRowRight}>
              <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>{asset.exchange}</ThemedText>
              {asset.tradable && !asset.excluded && (
                <Pressable 
                  style={styles.excludeButton}
                  onPress={() => excludeMutation.mutate(asset.symbol)}
                >
                  <Feather name="x-circle" size={16} color={BrandColors.error} />
                </Pressable>
              )}
            </View>
          </Pressable>
        ))}
      </Card>

      {selectedSymbol && assetDetail && (
        <Card elevation={2} style={[styles.moduleCard, { borderColor: BrandColors.primaryLight, borderWidth: 2 }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{selectedSymbol} Details</ThemedText>
            <Pressable onPress={() => setSelectedSymbol(null)}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Name</ThemedText>
              <ThemedText style={styles.detailValue}>{assetDetail.asset?.name || "N/A"}</ThemedText>
            </View>
            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Exchange</ThemedText>
              <ThemedText style={styles.detailValue}>{assetDetail.asset?.exchange || "N/A"}</ThemedText>
            </View>
            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Tradable</ThemedText>
              <ThemedText style={[styles.detailValue, { color: assetDetail.asset?.tradable ? BrandColors.success : BrandColors.error }]}>
                {assetDetail.asset?.tradable ? "Yes" : "No"}
              </ThemedText>
            </View>
            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Asset Class</ThemedText>
              <ThemedText style={styles.detailValue}>{assetDetail.asset?.assetClass || "N/A"}</ThemedText>
            </View>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

function FundamentalsModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [symbols, setSymbols] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const { data: stats, isLoading: loadingStats } = useQuery<any>({
    queryKey: ["/api/admin/fundamentals/stats"],
  });

  const { data: topScores, isLoading: loadingTop, refetch } = useQuery<{ scores: any[] }>({
    queryKey: ["/api/admin/fundamentals/top/scores"],
    queryFn: async () => {
      const url = new URL("/api/admin/fundamentals/top/scores?limit=20", getApiUrl());
      const res = await fetch(url.toString(), { credentials: "include" });
      return res.json();
    },
  });

  const { data: symbolData } = useQuery<any>({
    queryKey: ["/api/admin/fundamentals", selectedSymbol],
    enabled: !!selectedSymbol,
    queryFn: async () => {
      const url = new URL(`/api/admin/fundamentals/${selectedSymbol}`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: "include" });
      return res.json();
    },
  });

  const fetchMutation = useMutation({
    mutationFn: async (symbolsArray: string[]) => {
      const res = await apiRequest("POST", "/api/admin/fundamentals/fetch", { symbols: symbolsArray });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fundamentals/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fundamentals/top/scores"] });
    },
  });

  const scores = topScores?.scores || [];

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
      <ThemedText style={styles.moduleTitle}>Fundamentals</ThemedText>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="bar-chart-2" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Fundamentals Stats</ThemedText>
          {loadingStats && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{stats?.totalSymbols || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Symbols</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{stats?.avgScore?.toFixed(2) || "N/A"}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Avg Score</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString() : "N/A"}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Last Updated</ThemedText>
          </View>
        </View>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="download" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Fetch Fundamentals</ThemedText>
        </View>
        <TextInput
          style={[styles.searchInput, { color: theme.text, backgroundColor: theme.backgroundSecondary, borderColor: BrandColors.cardBorder }]}
          placeholder="Enter symbols (comma separated): AAPL, MSFT, GOOGL"
          placeholderTextColor={theme.textSecondary}
          value={symbols}
          onChangeText={setSymbols}
        />
        <Pressable 
          style={styles.actionButton}
          onPress={() => {
            const arr = symbols.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
            if (arr.length > 0) fetchMutation.mutate(arr);
          }}
          disabled={fetchMutation.isPending || !symbols.trim()}
        >
          {fetchMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Feather name="download" size={14} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Fetch Fundamentals</ThemedText>
            </>
          )}
        </Pressable>
        {fetchMutation.data && (
          <ThemedText style={[styles.resultText, { color: BrandColors.success }]}>
            Fetched {fetchMutation.data.fetched || 0} symbols successfully
          </ThemedText>
        )}
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="award" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Top Scores</ThemedText>
          {loadingTop && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        {scores.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No fundamental scores available</ThemedText>
        ) : scores.map((s: any, i: number) => (
          <Pressable 
            key={s.symbol} 
            style={[styles.listRow, i < scores.length - 1 && styles.listRowBorder]}
            onPress={() => setSelectedSymbol(s.symbol)}
          >
            <View style={styles.listRowLeft}>
              <View style={[styles.rankBadge, { backgroundColor: i < 3 ? BrandColors.warning : BrandColors.neutral }]}>
                <ThemedText style={styles.rankText}>#{i + 1}</ThemedText>
              </View>
              <ThemedText style={[styles.listRowText, { fontFamily: Fonts?.mono }]}>{s.symbol}</ThemedText>
            </View>
            <ThemedText style={[styles.listRowMeta, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>
              {(s.score * 100).toFixed(1)}%
            </ThemedText>
          </Pressable>
        ))}
      </Card>

      {selectedSymbol && symbolData && (
        <Card elevation={2} style={[styles.moduleCard, { borderColor: BrandColors.primaryLight, borderWidth: 2 }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{selectedSymbol} Fundamentals</ThemedText>
            <Pressable onPress={() => setSelectedSymbol(null)}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.detailGrid}>
            {Object.entries(symbolData.fundamentals || {}).slice(0, 8).map(([key, value]: [string, any]) => (
              <View key={key} style={styles.detailItem}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>{key}</ThemedText>
                <ThemedText style={[styles.detailValue, { fontFamily: Fonts?.mono }]}>{typeof value === "number" ? value.toFixed(2) : String(value)}</ThemedText>
              </View>
            ))}
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

function CandidatesModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: stats, isLoading: loadingStats } = useQuery<any>({
    queryKey: ["/api/admin/candidates/stats"],
  });

  const { data: candidates, isLoading: loadingCandidates, refetch } = useQuery<{ candidates: any[] }>({
    queryKey: ["/api/admin/candidates", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const url = new URL(`/api/admin/candidates?${params}`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: "include" });
      return res.json();
    },
  });

  const { data: approved } = useQuery<{ approved: any[] }>({
    queryKey: ["/api/admin/candidates/approved/list"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/candidates/generate", { minLiquidityTier: 1, minScore: 0.5, limit: 20 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/candidates/stats"] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await apiRequest("POST", `/api/admin/candidates/${symbol}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/candidates/approved/list"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await apiRequest("POST", `/api/admin/candidates/${symbol}/reject`, {});
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/candidates"] }),
  });

  const candidateList = candidates?.candidates || [];
  const approvedList = approved?.approved || [];

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
      <ThemedText style={styles.moduleTitle}>Candidates & Approval</ThemedText>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="users" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Candidates Stats</ThemedText>
          {loadingStats && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{stats?.totalCandidates || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Total</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>{stats?.approved || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Approved</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.warning, fontFamily: Fonts?.mono }]}>{stats?.pending || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.error, fontFamily: Fonts?.mono }]}>{stats?.rejected || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Rejected</ThemedText>
          </View>
        </View>
        <Pressable 
          style={styles.actionButton}
          onPress={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Feather name="plus" size={14} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Generate Candidates</ThemedText>
            </>
          )}
        </Pressable>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="filter" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Filter</ThemedText>
        </View>
        <View style={styles.filterRow}>
          {["all", "pending", "approved", "rejected"].map((f) => (
            <Pressable
              key={f}
              style={[styles.filterButton, statusFilter === f && { backgroundColor: BrandColors.primaryLight }]}
              onPress={() => setStatusFilter(f)}
            >
              <ThemedText style={[styles.filterButtonText, statusFilter === f && { color: "#fff" }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="list" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Candidates</ThemedText>
          {loadingCandidates && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        {candidateList.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No candidates found</ThemedText>
        ) : candidateList.slice(0, 30).map((c: any, i: number) => (
          <View key={c.symbol} style={[styles.listRow, i < candidateList.length - 1 && styles.listRowBorder]}>
            <View style={styles.listRowLeft}>
              <View style={[styles.statusDot, { backgroundColor: c.status === "approved" ? BrandColors.success : c.status === "rejected" ? BrandColors.error : BrandColors.warning }]} />
              <View>
                <ThemedText style={[styles.listRowText, { fontFamily: Fonts?.mono }]}>{c.symbol}</ThemedText>
                <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>Score: {(c.score * 100).toFixed(1)}%</ThemedText>
              </View>
            </View>
            {c.status === "pending" && (
              <View style={styles.actionButtons}>
                <Pressable style={[styles.smallButton, { backgroundColor: BrandColors.success }]} onPress={() => approveMutation.mutate(c.symbol)}>
                  <Feather name="check" size={14} color="#fff" />
                </Pressable>
                <Pressable style={[styles.smallButton, { backgroundColor: BrandColors.error }]} onPress={() => rejectMutation.mutate(c.symbol)}>
                  <Feather name="x" size={14} color="#fff" />
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="check-circle" size={20} color={BrandColors.success} />
          <ThemedText style={styles.cardTitle}>Approved List ({approvedList.length})</ThemedText>
        </View>
        <View style={styles.chipsRow}>
          {approvedList.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No approved candidates</ThemedText>
          ) : approvedList.map((a: any) => (
            <View key={a.symbol} style={[styles.chip, { backgroundColor: BrandColors.success + "20" }]}>
              <ThemedText style={[styles.chipText, { fontFamily: Fonts?.mono }]}>{a.symbol}</ThemedText>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

function EnforcementModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [symbols, setSymbols] = useState("");
  const [checkResult, setCheckResult] = useState<any>(null);

  const { data: stats, isLoading: loadingStats, refetch } = useQuery<any>({
    queryKey: ["/api/admin/enforcement/stats"],
  });

  const checkMutation = useMutation({
    mutationFn: async (symbolsArray: string[]) => {
      const res = await apiRequest("POST", "/api/admin/enforcement/check", { symbols: symbolsArray });
      return res.json();
    },
    onSuccess: (data) => setCheckResult(data),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/enforcement/reset-stats", {});
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/enforcement/stats"] }),
  });

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
      <ThemedText style={styles.moduleTitle}>Enforcement Gate</ThemedText>

      <Card elevation={1} style={[styles.moduleCard, { backgroundColor: BrandColors.warning + "10" }]}>
        <View style={styles.cardHeader}>
          <Feather name="alert-triangle" size={20} color={BrandColors.warning} />
          <ThemedText style={[styles.cardTitle, { color: BrandColors.warning }]}>About Enforcement</ThemedText>
        </View>
        <ThemedText style={[styles.configDesc, { color: theme.textSecondary }]}>
          The enforcement gate blocks unapproved symbols from being traded. Orders for symbols not in the approved candidates list will be rejected by the work queue order submit path.
        </ThemedText>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="shield" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Enforcement Stats</ThemedText>
          {loadingStats && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{stats?.totalChecks || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Total Checks</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>{stats?.allowed || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Allowed</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.error, fontFamily: Fonts?.mono }]}>{stats?.blocked || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Blocked</ThemedText>
          </View>
        </View>
        <Pressable 
          style={[styles.actionButton, { backgroundColor: BrandColors.warning }]}
          onPress={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
        >
          {resetMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Feather name="rotate-ccw" size={14} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Reset Stats</ThemedText>
            </>
          )}
        </Pressable>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="check-square" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Check Symbol(s)</ThemedText>
        </View>
        <TextInput
          style={[styles.searchInput, { color: theme.text, backgroundColor: theme.backgroundSecondary, borderColor: BrandColors.cardBorder }]}
          placeholder="Enter symbols: AAPL, MSFT"
          placeholderTextColor={theme.textSecondary}
          value={symbols}
          onChangeText={setSymbols}
        />
        <Pressable 
          style={styles.actionButton}
          onPress={() => {
            const arr = symbols.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
            if (arr.length > 0) checkMutation.mutate(arr);
          }}
          disabled={checkMutation.isPending || !symbols.trim()}
        >
          {checkMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Feather name="shield" size={14} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Check Enforcement</ThemedText>
            </>
          )}
        </Pressable>
        {checkResult && (
          <View style={styles.resultBox}>
            {checkResult.results?.map((r: any) => (
              <View key={r.symbol} style={styles.resultRow}>
                <ThemedText style={[styles.listRowText, { fontFamily: Fonts?.mono }]}>{r.symbol}</ThemedText>
                <View style={[styles.badge, { backgroundColor: r.allowed ? BrandColors.success + "20" : BrandColors.error + "20" }]}>
                  <ThemedText style={[styles.badgeText, { color: r.allowed ? BrandColors.success : BrandColors.error }]}>
                    {r.allowed ? "Allowed" : "Blocked"}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

function AllocationModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);

  const { data: stats, isLoading: loadingStats } = useQuery<any>({
    queryKey: ["/api/admin/allocation/stats"],
  });

  const { data: policies, isLoading: loadingPolicies, refetch } = useQuery<{ policies: any[] }>({
    queryKey: ["/api/admin/allocation/policies"],
  });

  const { data: activePolicy } = useQuery<any>({
    queryKey: ["/api/admin/allocation/policies/active"],
  });

  const { data: runs } = useQuery<{ runs: any[] }>({
    queryKey: ["/api/admin/allocation/runs"],
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/allocation/analyze", {});
      return res.json();
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/allocation/policies/${id}/activate`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allocation/policies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/allocation/policies/active"] });
    },
  });

  const policyList = policies?.policies || [];
  const runList = runs?.runs || [];

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
      <ThemedText style={styles.moduleTitle}>Allocation Policies</ThemedText>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="pie-chart" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Allocation Stats</ThemedText>
          {loadingStats && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{stats?.totalPolicies || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Policies</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{stats?.totalRuns || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Runs</ThemedText>
          </View>
        </View>
        <Pressable 
          style={styles.actionButton}
          onPress={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
        >
          {analyzeMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Feather name="bar-chart" size={14} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Analyze Allocation</ThemedText>
            </>
          )}
        </Pressable>
        {analyzeMutation.data && (
          <View style={styles.resultBox}>
            <ThemedText style={[styles.resultText, { color: BrandColors.success }]}>
              Analysis complete. Drift: {(analyzeMutation.data.analysis?.maxDrift * 100 || 0).toFixed(2)}%
            </ThemedText>
          </View>
        )}
      </Card>

      {activePolicy?.policy && (
        <Card elevation={1} style={[styles.moduleCard, { borderColor: BrandColors.success, borderWidth: 2 }]}>
          <View style={styles.cardHeader}>
            <Feather name="check-circle" size={20} color={BrandColors.success} />
            <ThemedText style={styles.cardTitle}>Active Policy</ThemedText>
          </View>
          <ThemedText style={styles.listRowText}>{activePolicy.policy.name}</ThemedText>
          <ThemedText style={[styles.configDesc, { color: theme.textSecondary }]}>{activePolicy.policy.description || "No description"}</ThemedText>
        </Card>
      )}

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="list" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Policies</ThemedText>
          {loadingPolicies && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        {policyList.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No policies configured</ThemedText>
        ) : policyList.map((p: any, i: number) => (
          <Pressable key={p.id} style={[styles.listRow, i < policyList.length - 1 && styles.listRowBorder]} onPress={() => setSelectedPolicy(p)}>
            <View style={styles.listRowLeft}>
              <View style={[styles.statusDot, { backgroundColor: p.isActive ? BrandColors.success : BrandColors.neutral }]} />
              <ThemedText style={styles.listRowText}>{p.name}</ThemedText>
            </View>
            {!p.isActive && (
              <Pressable style={[styles.smallButton, { backgroundColor: BrandColors.primaryLight }]} onPress={() => activateMutation.mutate(p.id)}>
                <ThemedText style={styles.smallButtonText}>Activate</ThemedText>
              </Pressable>
            )}
          </Pressable>
        ))}
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="clock" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Recent Runs</ThemedText>
        </View>
        {runList.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No allocation runs yet</ThemedText>
        ) : runList.slice(0, 10).map((r: any, i: number) => (
          <View key={r.id} style={[styles.listRow, i < runList.length - 1 && styles.listRowBorder]}>
            <View style={styles.listRowLeft}>
              <View style={[styles.statusDot, { backgroundColor: r.status === "completed" ? BrandColors.success : r.status === "failed" ? BrandColors.error : BrandColors.warning }]} />
              <View>
                <ThemedText style={[styles.listRowText, { fontFamily: Fonts?.mono }]}>{r.id.slice(0, 8)}</ThemedText>
                <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>{new Date(r.createdAt).toLocaleString()}</ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>{r.status}</ThemedText>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function RebalancerModule() {
  const { theme } = useTheme();
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [executeResult, setExecuteResult] = useState<any>(null);
  const [profitResult, setProfitResult] = useState<any>(null);

  const { data: stats, isLoading: loadingStats, refetch } = useQuery<any>({
    queryKey: ["/api/admin/rebalancer/stats"],
  });

  const dryRunMutation = useMutation({
    mutationFn: async () => {
      const traceId = `rebal-dry-${Date.now().toString(36)}`;
      const res = await apiRequest("POST", "/api/admin/rebalancer/dry-run", { traceId });
      return res.json();
    },
    onSuccess: (data) => setDryRunResult(data),
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const traceId = `rebal-exec-${Date.now().toString(36)}`;
      const res = await apiRequest("POST", "/api/admin/rebalancer/execute", { traceId, confirm: true });
      return res.json();
    },
    onSuccess: (data) => setExecuteResult(data),
  });

  const profitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/rebalancer/profit-taking/analyze", {});
      return res.json();
    },
    onSuccess: (data) => setProfitResult(data),
  });

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
      <ThemedText style={styles.moduleTitle}>Rebalancer</ThemedText>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="refresh-cw" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Rebalancer Stats</ThemedText>
          {loadingStats && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{stats?.totalRuns || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Total Runs</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{stats?.lastRun ? new Date(stats.lastRun).toLocaleDateString() : "Never"}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Last Run</ThemedText>
          </View>
        </View>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="play" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Dry Run</ThemedText>
        </View>
        <ThemedText style={[styles.configDesc, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
          Preview what trades would be made to rebalance the portfolio without executing them.
        </ThemedText>
        <Pressable 
          style={styles.actionButton}
          onPress={() => dryRunMutation.mutate()}
          disabled={dryRunMutation.isPending}
        >
          {dryRunMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Feather name="eye" size={14} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Run Dry Run</ThemedText>
            </>
          )}
        </Pressable>
        {dryRunResult && (
          <View style={styles.resultBox}>
            <ThemedText style={[styles.resultText, { color: BrandColors.success }]}>
              Dry run complete. {dryRunResult.trades?.length || 0} trades proposed.
            </ThemedText>
            {dryRunResult.trades?.slice(0, 5).map((t: any, i: number) => (
              <ThemedText key={i} style={[styles.listRowMeta, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>
                {t.side} {t.qty} {t.symbol}
              </ThemedText>
            ))}
          </View>
        )}
      </Card>

      <Card elevation={1} style={[styles.moduleCard, { borderColor: BrandColors.error, borderWidth: 1 }]}>
        <View style={styles.cardHeader}>
          <Feather name="alert-circle" size={20} color={BrandColors.error} />
          <ThemedText style={[styles.cardTitle, { color: BrandColors.error }]}>Execute Rebalance</ThemedText>
        </View>
        <ThemedText style={[styles.configDesc, { color: BrandColors.error, marginBottom: Spacing.md }]}>
          WARNING: This will execute real trades to rebalance the portfolio. Make sure you have run a dry run first.
        </ThemedText>
        <Pressable 
          style={[styles.actionButton, { backgroundColor: BrandColors.error }]}
          onPress={() => executeMutation.mutate()}
          disabled={executeMutation.isPending}
        >
          {executeMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Feather name="zap" size={14} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Execute Rebalance</ThemedText>
            </>
          )}
        </Pressable>
        {executeResult && (
          <View style={styles.resultBox}>
            <ThemedText style={[styles.resultText, { color: executeResult.success ? BrandColors.success : BrandColors.error }]}>
              {executeResult.success ? `Executed ${executeResult.tradesExecuted || 0} trades` : "Execution failed"}
            </ThemedText>
          </View>
        )}
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="trending-up" size={20} color={BrandColors.success} />
          <ThemedText style={styles.cardTitle}>Profit Taking Analysis</ThemedText>
        </View>
        <Pressable 
          style={[styles.actionButton, { backgroundColor: BrandColors.success }]}
          onPress={() => profitMutation.mutate()}
          disabled={profitMutation.isPending}
        >
          {profitMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Feather name="dollar-sign" size={14} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Analyze Profit Taking</ThemedText>
            </>
          )}
        </Pressable>
        {profitResult && (
          <View style={styles.resultBox}>
            <ThemedText style={[styles.resultText, { color: BrandColors.success }]}>
              {profitResult.opportunities?.length || 0} profit-taking opportunities found
            </ThemedText>
            {profitResult.opportunities?.slice(0, 5).map((o: any, i: number) => (
              <ThemedText key={i} style={[styles.listRowMeta, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>
                {o.symbol}: +{(o.unrealizedPnlPct * 100).toFixed(1)}%
              </ThemedText>
            ))}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

interface TraceTimelineEvent {
  id: string;
  type: "decision" | "trade" | "order" | "fill" | "llm_call";
  timestamp: Date;
  symbol?: string;
  title: string;
  subtitle: string;
  status: "success" | "pending" | "error" | "info";
  metadata: Record<string, any>;
}

function TraceTimelineView({ 
  traceId, 
  setTraceId, 
  traceResult, 
  traceMutation 
}: { 
  traceId: string; 
  setTraceId: (s: string) => void; 
  traceResult: any; 
  traceMutation: any;
}) {
  const { theme } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const buildTimeline = (): TraceTimelineEvent[] => {
    if (!traceResult) return [];
    const events: TraceTimelineEvent[] = [];

    (traceResult.aiDecisions || []).forEach((d: any) => {
      events.push({
        id: `decision-${d.id}`,
        type: "decision",
        timestamp: new Date(d.createdAt),
        symbol: d.symbol,
        title: `AI Decision: ${d.action?.toUpperCase()} ${d.symbol}`,
        subtitle: `Confidence: ${((d.confidence || 0) * 100).toFixed(0)}% | ${d.reasoning?.substring(0, 60) || "No reasoning"}...`,
        status: d.status === "rejected" ? "error" : "info",
        metadata: { ...d, entityType: "AI Decision (Internal)" },
      });
    });

    (traceResult.llmCalls || []).forEach((l: any) => {
      events.push({
        id: `llm-${l.id}`,
        type: "llm_call",
        timestamp: new Date(l.createdAt),
        symbol: undefined,
        title: `LLM Call: ${l.role || "unknown"}`,
        subtitle: `${l.provider}/${l.model} | ${l.tokensUsed || 0} tokens | $${(l.estimatedCost || 0).toFixed(4)}`,
        status: l.status === "success" ? "success" : l.status === "error" ? "error" : "pending",
        metadata: { ...l, entityType: "LLM Call" },
      });
    });

    (traceResult.trades || []).forEach((t: any) => {
      events.push({
        id: `trade-${t.id}`,
        type: "trade",
        timestamp: new Date(t.executedAt || t.createdAt),
        symbol: t.symbol,
        title: `Trade Intent: ${t.side?.toUpperCase()} ${t.quantity} ${t.symbol}`,
        subtitle: `Target: $${t.price || "N/A"} | Intent Status: ${t.status}`,
        status: t.status === "rejected" ? "error" : "pending",
        metadata: { ...t, entityType: "Trade Intent (Internal)" },
      });
    });

    (traceResult.orders || []).forEach((o: any) => {
      const statusColor = ["filled", "accepted"].includes(o.status) ? "success" 
        : ["rejected", "canceled", "expired"].includes(o.status) ? "error" 
        : "pending";
      events.push({
        id: `order-${o.id}`,
        type: "order",
        timestamp: new Date(o.submittedAt || o.createdAt),
        symbol: o.symbol,
        title: `Broker Order: ${o.side?.toUpperCase()} ${o.qty || o.notional} ${o.symbol}`,
        subtitle: `Status: ${o.status?.toUpperCase()} | Broker ID: ${o.brokerOrderId?.substring(0, 8)}...`,
        status: statusColor,
        metadata: { ...o, entityType: "Broker Order" },
      });
    });

    (traceResult.fills || []).forEach((f: any) => {
      events.push({
        id: `fill-${f.id}`,
        type: "fill",
        timestamp: new Date(f.occurredAt || f.createdAt),
        symbol: f.symbol,
        title: `Fill: ${f.side?.toUpperCase()} ${f.qty} ${f.symbol}`,
        subtitle: `Price: $${f.price} | Broker Order: ${f.brokerOrderId?.substring(0, 8)}...`,
        status: "success",
        metadata: { ...f, entityType: "Fill Execution" },
      });
    });

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  };

  const timeline = buildTimeline();
  const getTypeIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "decision": return "cpu";
      case "llm_call": return "message-circle";
      case "trade": return "trending-up";
      case "order": return "file-text";
      case "fill": return "check-circle";
      default: return "circle";
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "success": return BrandColors.success;
      case "error": return BrandColors.error;
      case "pending": return BrandColors.warning;
      default: return BrandColors.neutral;
    }
  };

  return (
    <>
      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="git-commit" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Trace Timeline Explorer</ThemedText>
        </View>
        <TextInput
          style={[styles.searchInput, { color: theme.text, backgroundColor: theme.backgroundSecondary, borderColor: BrandColors.cardBorder }]}
          placeholder="Enter traceId (e.g., cyc-abc123 or run-xyz456)..."
          placeholderTextColor={theme.textSecondary}
          value={traceId}
          onChangeText={setTraceId}
        />
        <Pressable 
          style={styles.actionButton}
          onPress={() => traceId.trim() && traceMutation.mutate(traceId.trim())}
          disabled={traceMutation.isPending || !traceId.trim()}
        >
          {traceMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Feather name="search" size={14} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Explore Trace</ThemedText>
            </>
          )}
        </Pressable>
      </Card>

      {traceResult && (
        <>
          <Card elevation={1} style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <Feather name="activity" size={20} color={BrandColors.primaryLight} />
              <ThemedText style={styles.cardTitle}>Trace Summary: {traceResult.traceId}</ThemedText>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { color: BrandColors.primaryLight, fontFamily: Fonts?.mono }]}>
                  {traceResult.aiDecisions?.length || 0}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Decisions</ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { color: BrandColors.warning, fontFamily: Fonts?.mono }]}>
                  {traceResult.orders?.length || 0}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Orders</ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>
                  {traceResult.fills?.length || 0}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Fills</ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { color: theme.text, fontFamily: Fonts?.mono }]}>
                  {traceResult.llmCalls?.length || 0}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>LLM Calls</ThemedText>
              </View>
            </View>
            <View style={[styles.badge, { backgroundColor: BrandColors.primaryLight, alignSelf: "flex-start", marginTop: Spacing.sm }]}>
              <ThemedText style={[styles.badgeText, { color: "#fff" }]}>Source: DB (broker-synced)</ThemedText>
            </View>
          </Card>

          <Card elevation={1} style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <Feather name="git-branch" size={20} color={BrandColors.primaryLight} />
              <ThemedText style={styles.cardTitle}>Event Timeline ({timeline.length} events)</ThemedText>
            </View>
            {timeline.length === 0 ? (
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No events found for this trace</ThemedText>
            ) : (
              timeline.map((event, index) => (
                <Pressable 
                  key={event.id} 
                  onPress={() => setExpandedId(expandedId === event.id ? null : event.id)}
                  style={[styles.timelineItem, index > 0 ? styles.listRowBorder : null]}
                >
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineIcon, { backgroundColor: getStatusColor(event.status) + "20" }]}>
                      <Feather name={getTypeIcon(event.type)} size={14} color={getStatusColor(event.status)} />
                    </View>
                    {index < timeline.length - 1 && <View style={[styles.timelineLine, { backgroundColor: theme.textSecondary + "40" }]} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                      <ThemedText style={[styles.listRowText, { flex: 1 }]} numberOfLines={1}>{event.title}</ThemedText>
                      <View style={[styles.badge, { backgroundColor: getStatusColor(event.status) }]}>
                        <ThemedText style={[styles.badgeText, { color: "#fff", fontSize: 10 }]}>{event.type.toUpperCase()}</ThemedText>
                      </View>
                    </View>
                    <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]} numberOfLines={1}>{event.subtitle}</ThemedText>
                    <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, fontSize: 10, fontFamily: Fonts?.mono }]}>
                      {event.timestamp.toLocaleString()}
                    </ThemedText>
                    {expandedId === event.id && (
                      <View style={[styles.expandedMetadata, { backgroundColor: theme.backgroundSecondary }]}>
                        <ThemedText style={[styles.listRowText, { marginBottom: Spacing.xs }]}>{event.metadata.entityType} Details</ThemedText>
                        {Object.entries(event.metadata).filter(([k]) => !["entityType", "rawJson"].includes(k)).map(([key, value]) => (
                          <View key={key} style={styles.metadataRow}>
                            <ThemedText style={[styles.metadataKey, { color: theme.textSecondary }]}>{key}:</ThemedText>
                            <ThemedText style={[styles.metadataValue, { color: theme.text, fontFamily: Fonts?.mono }]} numberOfLines={2}>
                              {typeof value === "object" ? JSON.stringify(value).substring(0, 80) : String(value).substring(0, 80)}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </Pressable>
              ))
            )}
          </Card>
        </>
      )}
    </>
  );
}

type ObsTab = "health" | "traces" | "queue" | "alerts";

function ObservabilityModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ObsTab>("health");
  const [traceId, setTraceId] = useState("");
  const [traceResult, setTraceResult] = useState<any>(null);

  const { data: health, isLoading: loadingHealth, refetch: refetchHealth } = useQuery<any>({
    queryKey: ["/api/admin/observability/health"],
    queryFn: async () => {
      const res = await fetch(new URL("/api/admin/observability/health", getApiUrl()).toString(), { credentials: "include" });
      return res.json();
    },
  });

  const { data: workItems, isLoading: loadingItems, refetch: refetchItems } = useQuery<{ items: any[] }>({
    queryKey: ["/api/admin/observability/work-queue/items"],
    queryFn: async () => {
      const res = await fetch(new URL("/api/admin/observability/work-queue/items?limit=50", getApiUrl()).toString(), { credentials: "include" });
      return res.json();
    },
  });

  const { data: alertRulesData, isLoading: loadingRules, refetch: refetchRules } = useQuery<{ rules: any[] }>({
    queryKey: ["/api/admin/observability/alerts/rules"],
    queryFn: async () => {
      const res = await fetch(new URL("/api/admin/observability/alerts/rules", getApiUrl()).toString(), { credentials: "include" });
      return res.json();
    },
  });

  const { data: alertEventsData, isLoading: loadingEvents, refetch: refetchEvents } = useQuery<{ events: any[] }>({
    queryKey: ["/api/admin/observability/alerts/events"],
    queryFn: async () => {
      const res = await fetch(new URL("/api/admin/observability/alerts/events?limit=20", getApiUrl()).toString(), { credentials: "include" });
      return res.json();
    },
  });

  const traceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(new URL(`/api/admin/observability/trace/${id}`, getApiUrl()).toString(), { credentials: "include" });
      return res.json();
    },
    onSuccess: (data) => setTraceResult(data),
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/observability/work-queue/items/${id}/retry`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/observability/work-queue/items"] }),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest("POST", `/api/admin/observability/alerts/rules/${id}/toggle`, { enabled });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/observability/alerts/rules"] }),
  });

  const queue = health?.queue || {};
  const orchestrator = health?.orchestrator || {};
  const llm = health?.llm || {};
  const items = workItems?.items || [];
  const alertRules = alertRulesData?.rules || [];
  const alertEvents = alertEventsData?.events || [];

  const tabs: { id: ObsTab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { id: "health", label: "Health", icon: "heart" },
    { id: "traces", label: "Traces", icon: "search" },
    { id: "queue", label: "Queue", icon: "inbox" },
    { id: "alerts", label: "Alerts", icon: "bell" },
  ];

  const onRefresh = useCallback(() => {
    refetchHealth();
    refetchItems();
    refetchRules();
    refetchEvents();
  }, [refetchHealth, refetchItems, refetchRules, refetchEvents]);

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}>
      <ThemedText style={styles.moduleTitle}>Observability</ThemedText>

      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Feather name={tab.icon} size={16} color={activeTab === tab.id ? BrandColors.primaryLight : theme.textSecondary} />
            <ThemedText style={[styles.tabLabel, activeTab === tab.id && { color: BrandColors.primaryLight }]}>{tab.label}</ThemedText>
          </Pressable>
        ))}
      </View>

      {activeTab === "health" && (
        <>
          <Card elevation={1} style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <Feather name="activity" size={20} color={BrandColors.primaryLight} />
              <ThemedText style={styles.cardTitle}>System Health</ThemedText>
              {loadingHealth && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
            </View>
            <View style={styles.healthGrid}>
              <View style={styles.healthItem}>
                <View style={[styles.healthIndicator, { backgroundColor: orchestrator.isRunning ? BrandColors.success : BrandColors.error }]} />
                <ThemedText style={styles.healthLabel}>Orchestrator</ThemedText>
                <ThemedText style={[styles.healthValue, { color: theme.textSecondary }]}>
                  {orchestrator.isRunning ? "Running" : "Stopped"}
                </ThemedText>
              </View>
              <View style={styles.healthItem}>
                <View style={[styles.healthIndicator, { backgroundColor: orchestrator.killSwitchActive ? BrandColors.error : BrandColors.success }]} />
                <ThemedText style={styles.healthLabel}>Kill Switch</ThemedText>
                <ThemedText style={[styles.healthValue, { color: theme.textSecondary }]}>
                  {orchestrator.killSwitchActive ? "Active" : "Off"}
                </ThemedText>
              </View>
              <View style={styles.healthItem}>
                <View style={[styles.healthIndicator, { backgroundColor: (queue.deadLetter || 0) > 0 ? BrandColors.error : BrandColors.success }]} />
                <ThemedText style={styles.healthLabel}>Dead Letters</ThemedText>
                <ThemedText style={[styles.healthValue, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>{queue.deadLetter || 0}</ThemedText>
              </View>
              <View style={styles.healthItem}>
                <View style={[styles.healthIndicator, { backgroundColor: BrandColors.primaryLight }]} />
                <ThemedText style={styles.healthLabel}>Pending Jobs</ThemedText>
                <ThemedText style={[styles.healthValue, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>{queue.pending || 0}</ThemedText>
              </View>
            </View>
          </Card>

          <Card elevation={1} style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <Feather name="cpu" size={20} color={BrandColors.primaryLight} />
              <ThemedText style={styles.cardTitle}>LLM Performance</ThemedText>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{llm.lastHour?.calls || 0}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Calls/1h</ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { color: BrandColors.error, fontFamily: Fonts?.mono }]}>{llm.lastHour?.errors || 0}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Errors/1h</ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{llm.lastHour?.errorRate || "0%"}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Error Rate</ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{llm.last24Hours?.calls || 0}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Calls/24h</ThemedText>
              </View>
            </View>
          </Card>

          <Card elevation={1} style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <Feather name="clock" size={20} color={BrandColors.primaryLight} />
              <ThemedText style={styles.cardTitle}>Orchestrator Status</ThemedText>
            </View>
            <View style={styles.listRow}>
              <ThemedText style={styles.listRowText}>Last Heartbeat</ThemedText>
              <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>
                {orchestrator.lastHeartbeat ? new Date(orchestrator.lastHeartbeat).toLocaleString() : "Never"}
              </ThemedText>
            </View>
            <View style={[styles.listRow, styles.listRowBorder]}>
              <ThemedText style={styles.listRowText}>Minutes Since Heartbeat</ThemedText>
              <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>
                {orchestrator.minutesSinceHeartbeat ?? "N/A"}
              </ThemedText>
            </View>
            <View style={[styles.listRow, styles.listRowBorder]}>
              <ThemedText style={styles.listRowText}>Market Condition</ThemedText>
              <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>{orchestrator.marketCondition || "Unknown"}</ThemedText>
            </View>
            <View style={[styles.listRow, styles.listRowBorder]}>
              <ThemedText style={styles.listRowText}>Dynamic Order Limit</ThemedText>
              <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>{orchestrator.dynamicOrderLimit || "N/A"}</ThemedText>
            </View>
          </Card>
        </>
      )}

      {activeTab === "traces" && (
        <TraceTimelineView 
          traceId={traceId} 
          setTraceId={setTraceId}
          traceResult={traceResult}
          traceMutation={traceMutation}
        />
      )}

      {activeTab === "queue" && (
        <>
          <Card elevation={1} style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <Feather name="inbox" size={20} color={BrandColors.primaryLight} />
              <ThemedText style={styles.cardTitle}>Work Queue Status</ThemedText>
              {loadingItems && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { color: BrandColors.warning, fontFamily: Fonts?.mono }]}>{queue.pending || 0}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { color: BrandColors.primaryLight, fontFamily: Fonts?.mono }]}>{queue.running || 0}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Running</ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>{queue.succeeded || 0}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Succeeded</ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { color: BrandColors.error, fontFamily: Fonts?.mono }]}>{queue.deadLetter || 0}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Dead Letter</ThemedText>
              </View>
            </View>
          </Card>

          <Card elevation={1} style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <Feather name="alert-octagon" size={20} color={BrandColors.error} />
              <ThemedText style={styles.cardTitle}>Dead Letters & Failed</ThemedText>
            </View>
            {items.filter((i: any) => i.status === "DEAD_LETTER" || i.status === "FAILED").length === 0 ? (
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No dead letters or failed items</ThemedText>
            ) : items.filter((i: any) => i.status === "DEAD_LETTER" || i.status === "FAILED").slice(0, 10).map((item: any) => (
              <View key={item.id} style={[styles.listRow, styles.listRowBorder]}>
                <View style={styles.listRowLeft}>
                  <View style={[styles.statusDot, { backgroundColor: item.status === "DEAD_LETTER" ? BrandColors.error : BrandColors.warning }]} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.listRowText, { fontFamily: Fonts?.mono }]}>{item.type} - {item.symbol || "N/A"}</ThemedText>
                    <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]} numberOfLines={1}>{item.lastError || "No error"}</ThemedText>
                  </View>
                </View>
                <Pressable 
                  style={[styles.smallButton, { backgroundColor: BrandColors.primaryLight }]}
                  onPress={() => retryMutation.mutate(item.id)}
                >
                  <Feather name="refresh-cw" size={12} color="#fff" />
                </Pressable>
              </View>
            ))}
          </Card>

          <Card elevation={1} style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <Feather name="clock" size={20} color={BrandColors.primaryLight} />
              <ThemedText style={styles.cardTitle}>Recent Work Items</ThemedText>
            </View>
            {items.slice(0, 15).map((item: any, i: number) => (
              <View key={item.id} style={[styles.listRow, i < Math.min(items.length, 15) - 1 && styles.listRowBorder]}>
                <View style={styles.listRowLeft}>
                  <View style={[styles.statusDot, { 
                    backgroundColor: item.status === "SUCCEEDED" ? BrandColors.success : 
                      item.status === "FAILED" || item.status === "DEAD_LETTER" ? BrandColors.error : 
                      item.status === "RUNNING" ? BrandColors.primaryLight : BrandColors.warning 
                  }]} />
                  <View>
                    <ThemedText style={[styles.listRowText, { fontFamily: Fonts?.mono }]}>{item.type}</ThemedText>
                    <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>{item.symbol || "N/A"} - {item.status}</ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>
                  {new Date(item.createdAt).toLocaleTimeString()}
                </ThemedText>
              </View>
            ))}
          </Card>
        </>
      )}

      {activeTab === "alerts" && (
        <>
          <Card elevation={1} style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <Feather name="bell" size={20} color={BrandColors.primaryLight} />
              <ThemedText style={styles.cardTitle}>Alert Rules</ThemedText>
              {loadingRules && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
            </View>
            {alertRules.length === 0 ? (
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No alert rules configured</ThemedText>
            ) : alertRules.map((rule: any) => (
              <View key={rule.id} style={[styles.listRow, styles.listRowBorder]}>
                <View style={styles.listRowLeft}>
                  <View style={[styles.statusDot, { backgroundColor: rule.enabled ? BrandColors.success : BrandColors.neutral }]} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.listRowText}>{rule.name}</ThemedText>
                    <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                      {rule.ruleType} | threshold: {rule.threshold}
                    </ThemedText>
                  </View>
                </View>
                <Switch
                  value={rule.enabled}
                  onValueChange={(enabled) => toggleRuleMutation.mutate({ id: rule.id, enabled })}
                  trackColor={{ false: theme.backgroundSecondary, true: BrandColors.primaryLight }}
                />
              </View>
            ))}
          </Card>

          <Card elevation={1} style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <Feather name="alert-triangle" size={20} color={BrandColors.warning} />
              <ThemedText style={styles.cardTitle}>Recent Alert Events</ThemedText>
              {loadingEvents && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
            </View>
            {alertEvents.length === 0 ? (
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No recent alert events</ThemedText>
            ) : alertEvents.slice(0, 10).map((event: any) => (
              <View key={event.id} style={[styles.listRow, styles.listRowBorder]}>
                <View style={styles.listRowLeft}>
                  <View style={[styles.statusDot, { backgroundColor: BrandColors.warning }]} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.listRowText}>{event.ruleName}</ThemedText>
                    <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                      Value: {event.triggeredValue} (threshold: {event.threshold})
                    </ThemedText>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>
                    {new Date(event.createdAt).toLocaleString()}
                  </ThemedText>
                  {event.webhookSent && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="check" size={10} color={BrandColors.success} />
                      <ThemedText style={[styles.listRowMeta, { color: BrandColors.success }]}>Webhook sent</ThemedText>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function OrchestratorModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<{
    status: { isRunning: boolean; lastCycleAt: string | null; cycleCount: number; errorCount: number };
    config: { cycleIntervalMs: number; maxSymbolsPerCycle: number; enableAutoTrading: boolean };
    activeStrategies: string[];
  }>({
    queryKey: ["/api/admin/orchestrator/status"],
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const clearMessages = () => {
    setTimeout(() => { setActionError(null); setActionSuccess(null); }, 3000);
  };

  const pauseMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/orchestrator/pause"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestrator/status"] });
      setActionSuccess("Orchestrator paused");
      clearMessages();
    },
    onError: (err: Error) => { setActionError(err.message || "Failed to pause"); clearMessages(); },
  });

  const resumeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/orchestrator/resume"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestrator/status"] });
      setActionSuccess("Orchestrator resumed");
      clearMessages();
    },
    onError: (err: Error) => { setActionError(err.message || "Failed to resume"); clearMessages(); },
  });

  const runNowMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/orchestrator/run-now"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestrator/status"] });
      setActionSuccess("Reconciliation triggered");
      clearMessages();
    },
    onError: (err: Error) => { setActionError(err.message || "Failed to trigger"); clearMessages(); },
  });

  const resetStatsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/orchestrator/reset-stats"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestrator/status"] });
      setActionSuccess("Statistics reset");
      clearMessages();
    },
    onError: (err: Error) => { setActionError(err.message || "Failed to reset"); clearMessages(); },
  });

  const status = data?.status;
  const config = data?.config;
  const activeStrategies = data?.activeStrategies || [];

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} />}>
      <ThemedText style={styles.moduleTitle}>Orchestrator Control</ThemedText>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="cpu" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Status</ThemedText>
          {isLoading && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
          <View style={[
            styles.statusDot,
            { backgroundColor: status?.isRunning ? BrandColors.success : BrandColors.neutral, marginLeft: "auto" }
          ]} />
          <ThemedText style={{ color: status?.isRunning ? BrandColors.success : BrandColors.neutral, fontWeight: "600" }}>
            {status?.isRunning ? "Running" : "Paused"}
          </ThemedText>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: BrandColors.cardBorder + "30" }]}>
            <ThemedText style={[styles.statValue, { color: BrandColors.primaryLight }]}>{status?.cycleCount ?? "-"}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Cycles</ThemedText>
          </View>
          <View style={[styles.statBox, { backgroundColor: BrandColors.cardBorder + "30" }]}>
            <ThemedText style={[styles.statValue, { color: BrandColors.error }]}>{status?.errorCount ?? "-"}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Errors</ThemedText>
          </View>
          <View style={[styles.statBox, { backgroundColor: BrandColors.cardBorder + "30" }]}>
            <ThemedText style={[styles.statValue, { color: BrandColors.success }]}>{activeStrategies.length}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Strategies</ThemedText>
          </View>
        </View>

        {status?.lastCycleAt && (
          <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, marginTop: Spacing.md }]}>
            Last cycle: {new Date(status.lastCycleAt).toLocaleString()}
          </ThemedText>
        )}
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="play-circle" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Controls</ThemedText>
        </View>
        {actionError && (
          <View style={[styles.errorBox, { marginTop: 0, marginBottom: Spacing.md }]}>
            <Feather name="alert-circle" size={16} color={BrandColors.error} />
            <ThemedText style={{ color: BrandColors.error, marginLeft: Spacing.sm, flex: 1 }}>{actionError}</ThemedText>
          </View>
        )}
        {actionSuccess && (
          <View style={[styles.errorBox, { marginTop: 0, marginBottom: Spacing.md, backgroundColor: BrandColors.success + "10" }]}>
            <Feather name="check-circle" size={16} color={BrandColors.success} />
            <ThemedText style={{ color: BrandColors.success, marginLeft: Spacing.sm, flex: 1 }}>{actionSuccess}</ThemedText>
          </View>
        )}
        <View style={styles.actionButtons}>
          {status?.isRunning ? (
            <Pressable 
              style={[styles.actionButton, { backgroundColor: BrandColors.warning }]}
              onPress={() => pauseMutation.mutate()}
              disabled={pauseMutation.isPending}
            >
              {pauseMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="pause" size={16} color="#fff" />
                  <ThemedText style={styles.actionButtonText}>Pause</ThemedText>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable 
              style={[styles.actionButton, { backgroundColor: BrandColors.success }]}
              onPress={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending}
            >
              {resumeMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="play" size={16} color="#fff" />
                  <ThemedText style={styles.actionButtonText}>Resume</ThemedText>
                </>
              )}
            </Pressable>
          )}
          <Pressable 
            style={[styles.actionButton, { backgroundColor: BrandColors.primaryLight }]}
            onPress={() => runNowMutation.mutate()}
            disabled={runNowMutation.isPending}
          >
            {runNowMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="zap" size={16} color="#fff" />
                <ThemedText style={styles.actionButtonText}>Run Now</ThemedText>
              </>
            )}
          </Pressable>
          <Pressable 
            style={[styles.actionButton, { backgroundColor: BrandColors.neutral }]}
            onPress={() => resetStatsMutation.mutate()}
            disabled={resetStatsMutation.isPending}
          >
            {resetStatsMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="rotate-ccw" size={16} color="#fff" />
                <ThemedText style={styles.actionButtonText}>Reset Stats</ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="settings" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Configuration</ThemedText>
        </View>
        <View style={[styles.listRow, styles.listRowBorder]}>
          <ThemedText style={styles.listRowText}>Cycle Interval</ThemedText>
          <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
            {config?.cycleIntervalMs ? formatDuration(config.cycleIntervalMs) : "-"}
          </ThemedText>
        </View>
        <View style={[styles.listRow, styles.listRowBorder]}>
          <ThemedText style={styles.listRowText}>Max Symbols/Cycle</ThemedText>
          <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
            {config?.maxSymbolsPerCycle ?? "-"}
          </ThemedText>
        </View>
        <View style={[styles.listRow, styles.listRowBorder]}>
          <ThemedText style={styles.listRowText}>Auto Trading</ThemedText>
          <View style={[
            styles.badge,
            { backgroundColor: config?.enableAutoTrading ? BrandColors.success + "20" : BrandColors.neutral + "20" }
          ]}>
            <ThemedText style={{ color: config?.enableAutoTrading ? BrandColors.success : BrandColors.neutral, fontSize: 12 }}>
              {config?.enableAutoTrading ? "Enabled" : "Disabled"}
            </ThemedText>
          </View>
        </View>
      </Card>

      {activeStrategies.length > 0 && (
        <Card elevation={1} style={styles.moduleCard}>
          <View style={styles.cardHeader}>
            <Feather name="trending-up" size={20} color={BrandColors.primaryLight} />
            <ThemedText style={styles.cardTitle}>Active Strategies</ThemedText>
            <View style={[styles.badge, { backgroundColor: BrandColors.success }]}>
              <ThemedText style={[styles.badgeText, { color: "#fff" }]}>{activeStrategies.length}</ThemedText>
            </View>
          </View>
          {activeStrategies.map((strategy, index) => (
            <View key={index} style={[styles.listRow, styles.listRowBorder]}>
              <View style={[styles.statusDot, { backgroundColor: BrandColors.success }]} />
              <ThemedText style={styles.listRowText}>{strategy}</ThemedText>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

function PositionsModule() {
  const { theme } = useTheme();

  const { data, isLoading, error, refetch } = useQuery<{
    positions: Array<{
      symbol: string;
      qty: string;
      side: string;
      marketValue: string;
      costBasis: string;
      unrealizedPl: string;
      unrealizedPlpc: string;
      currentPrice: string;
      avgEntryPrice: string;
    }>;
    _source: { freshness: string; fetchedAt: string };
  }>({
    queryKey: ["/api/positions"],
    queryFn: async () => {
      const res = await fetch(new URL("/api/positions", getApiUrl()).toString(), { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch positions: ${res.status}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const positions = data?.positions || [];
  const source = data?._source;

  const totalMarketValue = positions.reduce((sum, p) => sum + parseFloat(p.marketValue || "0"), 0);
  const totalUnrealizedPl = positions.reduce((sum, p) => sum + parseFloat(p.unrealizedPl || "0"), 0);

  const formatCurrency = (value: number): string => {
    return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
  };

  const formatPercent = (value: string): string => {
    const num = parseFloat(value || "0") * 100;
    return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
  };

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} />}>
      <ThemedText style={styles.moduleTitle}>Broker Positions</ThemedText>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="briefcase" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Portfolio Summary</ThemedText>
          {isLoading && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
          {source && (
            <View style={[styles.badge, { backgroundColor: source.freshness === "live" ? BrandColors.success : BrandColors.warning, marginLeft: "auto" }]}>
              <ThemedText style={[styles.badgeText, { color: "#fff" }]}>{source.freshness.toUpperCase()}</ThemedText>
            </View>
          )}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color={BrandColors.error} />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <ThemedText style={{ color: BrandColors.error, fontWeight: "500" }}>
                Broker connection unavailable
              </ThemedText>
              <ThemedText style={{ color: BrandColors.error, fontSize: 12 }}>
                Live position data cannot be retrieved. Pull to retry.
              </ThemedText>
            </View>
          </View>
        ) : source?.freshness !== "live" && source ? (
          <>
            <View style={[styles.errorBox, { backgroundColor: BrandColors.warning + "10" }]}>
              <Feather name="alert-triangle" size={16} color={BrandColors.warning} />
              <ThemedText style={{ color: BrandColors.warning, marginLeft: Spacing.sm }}>
                Showing cached data - broker sync may be delayed
              </ThemedText>
            </View>
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: BrandColors.cardBorder + "30" }]}>
                <ThemedText style={[styles.statValue, { color: BrandColors.primaryLight }]}>{positions.length}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Positions</ThemedText>
              </View>
              <View style={[styles.statBox, { backgroundColor: BrandColors.cardBorder + "30" }]}>
                <ThemedText style={[styles.statValue, { color: BrandColors.primaryLight }]}>
                  {formatCurrency(totalMarketValue)}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Market Value</ThemedText>
              </View>
              <View style={[styles.statBox, { backgroundColor: BrandColors.cardBorder + "30" }]}>
                <ThemedText style={[styles.statValue, { color: totalUnrealizedPl >= 0 ? BrandColors.success : BrandColors.error }]}>
                  {totalUnrealizedPl >= 0 ? "+" : ""}{formatCurrency(totalUnrealizedPl)}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Unrealized P/L</ThemedText>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: BrandColors.cardBorder + "30" }]}>
              <ThemedText style={[styles.statValue, { color: BrandColors.primaryLight }]}>{positions.length}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Positions</ThemedText>
            </View>
            <View style={[styles.statBox, { backgroundColor: BrandColors.cardBorder + "30" }]}>
              <ThemedText style={[styles.statValue, { color: BrandColors.primaryLight }]}>
                {formatCurrency(totalMarketValue)}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Market Value</ThemedText>
            </View>
            <View style={[styles.statBox, { backgroundColor: BrandColors.cardBorder + "30" }]}>
              <ThemedText style={[styles.statValue, { color: totalUnrealizedPl >= 0 ? BrandColors.success : BrandColors.error }]}>
                {totalUnrealizedPl >= 0 ? "+" : ""}{formatCurrency(totalUnrealizedPl)}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Unrealized P/L</ThemedText>
            </View>
          </View>
        )}
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="list" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Position Details</ThemedText>
        </View>

        {positions.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            {error ? "Unable to load positions" : "No open positions"}
          </ThemedText>
        ) : (
          positions.map((position) => {
            const unrealizedPl = parseFloat(position.unrealizedPl || "0");
            const plColor = unrealizedPl >= 0 ? BrandColors.success : BrandColors.error;
            
            return (
              <View key={position.symbol} style={[styles.listRow, styles.listRowBorder, { flexDirection: "column", alignItems: "stretch" }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                    <View style={[
                      styles.sideIndicator,
                      { backgroundColor: position.side === "long" ? BrandColors.success : BrandColors.error }
                    ]} />
                    <ThemedText style={[styles.listRowText, { fontWeight: "600" }]}>{position.symbol}</ThemedText>
                    <View style={[styles.badge, { backgroundColor: position.side === "long" ? BrandColors.success + "20" : BrandColors.error + "20" }]}>
                      <ThemedText style={{ color: position.side === "long" ? BrandColors.success : BrandColors.error, fontSize: 10, fontWeight: "600" }}>
                        {position.side.toUpperCase()}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.listRowText, { color: plColor, fontWeight: "600" }]}>
                    {unrealizedPl >= 0 ? "+" : ""}{formatCurrency(unrealizedPl)}
                  </ThemedText>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.sm }}>
                  <View>
                    <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                      Qty: {parseFloat(position.qty).toFixed(2)}
                    </ThemedText>
                    <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                      Avg Entry: ${parseFloat(position.avgEntryPrice || "0").toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                      Current: ${parseFloat(position.currentPrice || "0").toFixed(2)}
                    </ThemedText>
                    <ThemedText style={[styles.listRowMeta, { color: plColor }]}>
                      {formatPercent(position.unrealizedPlpc)}
                    </ThemedText>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </Card>

      {source && (
        <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }]}>
          Last updated: {new Date(source.fetchedAt).toLocaleString()}
        </ThemedText>
      )}
    </ScrollView>
  );
}

function OrdersModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ordersPath = `/api/orders?limit=50${statusFilter ? `&status=${statusFilter}` : ""}`;
  
  const { data, isLoading, refetch } = useQuery<{ orders: any[]; total: number; source: any }>({
    queryKey: [ordersPath],
    queryFn: async () => {
      const res = await fetch(new URL(ordersPath, getApiUrl()).toString(), { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status}`);
      return res.json();
    },
    refetchInterval: 15000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/orders/sync");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ordersPath] });
    },
  });

  const statusFilters = ["all", "new", "filled", "partially_filled", "canceled", "rejected"];
  const orders = data?.orders || [];

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case "filled": return BrandColors.success;
      case "partially_filled": return BrandColors.warning;
      case "new": case "accepted": case "pending_new": return BrandColors.primaryLight;
      case "canceled": case "expired": return BrandColors.neutral;
      case "rejected": return BrandColors.error;
      default: return BrandColors.neutral;
    }
  };

  const formatStatus = (status: string): string => status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} />}>
      <ThemedText style={styles.moduleTitle}>Orders & Fills</ThemedText>

      <View style={[styles.badge, { backgroundColor: BrandColors.success + "20", borderWidth: 1, borderColor: BrandColors.success, flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignSelf: "flex-start", marginBottom: Spacing.md }]}>
        <Feather name="check-circle" size={14} color={BrandColors.success} />
        <ThemedText style={[styles.badgeText, { color: BrandColors.success }]}>Source of Truth: Alpaca</ThemedText>
      </View>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="file-text" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Order Lifecycle</ThemedText>
          <Pressable 
            style={[styles.smallButton, { backgroundColor: BrandColors.primaryLight }]}
            onPress={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.smallButtonText}>Sync</ThemedText>
            )}
          </Pressable>
        </View>
        <View style={styles.filterRow}>
          {statusFilters.map((filter) => (
            <Pressable
              key={filter}
              style={[
                styles.filterButton,
                (filter === "all" && !statusFilter) || statusFilter === filter
                  ? { backgroundColor: BrandColors.primaryLight + "30" }
                  : {}
              ]}
              onPress={() => setStatusFilter(filter === "all" ? null : filter)}
            >
              <ThemedText style={styles.filterButtonText}>
                {filter.charAt(0).toUpperCase() + filter.slice(1).replace(/_/g, " ")}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="list" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Order Ledger</ThemedText>
          <View style={[styles.badge, { backgroundColor: BrandColors.primaryLight }]}>
            <ThemedText style={[styles.badgeText, { color: "#fff" }]}>{data?.total ?? "-"}</ThemedText>
          </View>
          {isLoading && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        {orders.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No orders found</ThemedText>
        ) : orders.map((order: any) => (
          <Pressable key={order.id} onPress={() => setExpandedId(expandedId === order.id ? null : order.id)}>
            <View style={[styles.listRow, styles.listRowBorder]}>
              <View style={styles.listRowLeft}>
                <View style={[
                  styles.sideIndicator,
                  { backgroundColor: order.side === "buy" ? BrandColors.success : BrandColors.error }
                ]} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                    <ThemedText style={styles.listRowText}>{order.symbol}</ThemedText>
                    <View style={[
                      styles.badge,
                      { backgroundColor: getStatusColor(order.status) + "20", borderWidth: 1, borderColor: getStatusColor(order.status) }
                    ]}>
                      <ThemedText style={[styles.badgeText, { color: getStatusColor(order.status) }]}>
                        {formatStatus(order.status)}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                    {order.side.toUpperCase()} {order.type} | Qty: {order.filledQty || 0}/{order.qty || "?"}
                    {order.filledAvgPrice ? ` @ $${parseFloat(order.filledAvgPrice).toFixed(2)}` : ""}
                  </ThemedText>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                  {new Date(order.submittedAt).toLocaleString()}
                </ThemedText>
                <Feather name={expandedId === order.id ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
              </View>
            </View>
            {expandedId === order.id ? (
              <View style={[styles.expandedSection, { backgroundColor: theme.backgroundSecondary }]}>
                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Broker Order ID</ThemedText>
                    <ThemedText style={[styles.detailValue, { fontFamily: Fonts?.mono, fontSize: 10 }]}>
                      {order.brokerOrderId?.slice(0, 20)}...
                    </ThemedText>
                  </View>
                  {order.traceId ? (
                    <View style={styles.detailItem}>
                      <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Trace ID</ThemedText>
                      <ThemedText style={[styles.detailValue, { fontFamily: Fonts?.mono, fontSize: 10 }]}>
                        {order.traceId?.slice(0, 20)}...
                      </ThemedText>
                    </View>
                  ) : null}
                  {order.decisionId ? (
                    <View style={styles.detailItem}>
                      <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Decision ID</ThemedText>
                      <ThemedText style={[styles.detailValue, { fontFamily: Fonts?.mono, fontSize: 10 }]}>
                        {order.decisionId?.slice(0, 20)}...
                      </ThemedText>
                    </View>
                  ) : null}
                  {order.filledAt ? (
                    <View style={styles.detailItem}>
                      <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Filled At</ThemedText>
                      <ThemedText style={styles.detailValue}>{new Date(order.filledAt).toLocaleString()}</ThemedText>
                    </View>
                  ) : null}
                </View>
                {order.fills && order.fills.length > 0 ? (
                  <View style={{ marginTop: Spacing.md }}>
                    <ThemedText style={[styles.listRowText, { marginBottom: Spacing.xs }]}>
                      Fills ({order.fills.length})
                    </ThemedText>
                    {order.fills.map((fill: any) => (
                      <View key={fill.id} style={[styles.fillRow, { backgroundColor: theme.backgroundDefault }]}>
                        <ThemedText style={[styles.fillQty, { fontFamily: Fonts?.mono }]}>
                          {fill.qty} @ ${parseFloat(fill.price).toFixed(2)}
                        </ThemedText>
                        <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                          {new Date(fill.occurredAt).toLocaleTimeString()}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}

type ArenaTab = "overview" | "runs" | "profiles" | "leaderboard";

function ArenaModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ArenaTab>("overview");
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [symbolInput, setSymbolInput] = useState("AAPL");

  const { data: statsData, isLoading: loadingStats, refetch: refetchStats } = useQuery<{
    runsToday: number;
    costToday: number;
    costWeek: number;
    escalationsToday: number;
    activeProfiles: number;
  }>({
    queryKey: ["/api/arena/stats"],
  });

  const { data: runsData, isLoading: loadingRuns, refetch: refetchRuns } = useQuery<{
    runs: any[];
    costToday: number;
    count: number;
  }>({
    queryKey: ["/api/arena/runs"],
  });

  const { data: runDetail } = useQuery<{
    run: any;
    decisions: any[];
    outcomeLinks: any[];
    costBreakdown: { total: number; byAgent: any[] };
  }>({
    queryKey: ["/api/arena/runs", selectedRun] as const,
    queryFn: async ({ queryKey }) => {
      const [, runId] = queryKey;
      if (!runId) throw new Error("No run ID provided");
      const res = await fetch(new URL(`/api/arena/runs/${runId}`, getApiUrl()).toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch run details");
      return res.json();
    },
    enabled: !!selectedRun,
  });

  const { data: profilesData, isLoading: loadingProfiles, refetch: refetchProfiles } = useQuery<{
    profiles: any[];
    count: number;
  }>({
    queryKey: ["/api/arena/profiles"],
  });

  const { data: leaderboardData, isLoading: loadingLeaderboard, refetch: refetchLeaderboard } = useQuery<{
    window: string;
    leaderboard: any[];
    generatedAt: string;
  }>({
    queryKey: ["/api/arena/leaderboard"],
  });

  const runArenaMutation = useMutation({
    mutationFn: async (symbols: string[]) => {
      return apiRequest("POST", "/api/arena/run", { symbols, triggeredBy: "admin_manual" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/arena/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/arena/stats"] });
    },
  });

  const refetchAll = () => {
    refetchStats();
    refetchRuns();
    refetchProfiles();
    refetchLeaderboard();
  };

  const stats = statsData || { runsToday: 0, costToday: 0, costWeek: 0, escalationsToday: 0, activeProfiles: 0 };
  const runs = runsData?.runs || [];
  const profiles = profilesData?.profiles || [];
  const leaderboard = leaderboardData?.leaderboard || [];

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "completed": return BrandColors.success;
      case "running": return BrandColors.warning;
      case "failed": return BrandColors.error;
      default: return BrandColors.neutral;
    }
  };

  const getActionColor = (action: string): string => {
    switch (action) {
      case "buy": case "scale_in": return BrandColors.success;
      case "sell": case "scale_out": return BrandColors.error;
      case "hold": return BrandColors.warning;
      case "no_trade": return BrandColors.neutral;
      default: return BrandColors.neutral;
    }
  };

  const getModeColor = (mode: string): string => {
    switch (mode) {
      case "cheap_first": return BrandColors.primaryLight;
      case "escalation_only": return BrandColors.warning;
      case "always": return BrandColors.success;
      default: return BrandColors.neutral;
    }
  };

  const tabs: { id: ArenaTab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { id: "overview", label: "Overview", icon: "home" },
    { id: "runs", label: "Runs", icon: "play" },
    { id: "profiles", label: "Agents", icon: "users" },
    { id: "leaderboard", label: "Leaderboard", icon: "award" },
  ];

  const renderOverview = () => (
    <>
      <View style={styles.statsGrid}>
        <Card elevation={1} style={[styles.statCard, { flex: 1 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
            <View style={[styles.iconBadge, { backgroundColor: BrandColors.primaryLight + "20" }]}>
              <Feather name="play" size={16} color={BrandColors.primaryLight} />
            </View>
            <View>
              <ThemedText style={[styles.statValue, { color: BrandColors.primaryLight }]}>{stats.runsToday}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Runs Today</ThemedText>
            </View>
          </View>
        </Card>
        <Card elevation={1} style={[styles.statCard, { flex: 1 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
            <View style={[styles.iconBadge, { backgroundColor: BrandColors.warning + "20" }]}>
              <Feather name="trending-up" size={16} color={BrandColors.warning} />
            </View>
            <View>
              <ThemedText style={[styles.statValue, { color: BrandColors.warning }]}>{stats.escalationsToday}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Escalations</ThemedText>
            </View>
          </View>
        </Card>
      </View>

      <View style={styles.statsGrid}>
        <Card elevation={1} style={[styles.statCard, { flex: 1 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
            <View style={[styles.iconBadge, { backgroundColor: BrandColors.success + "20" }]}>
              <Feather name="dollar-sign" size={16} color={BrandColors.success} />
            </View>
            <View>
              <ThemedText style={[styles.statValue, { color: BrandColors.success }]}>${stats.costToday.toFixed(4)}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Cost Today</ThemedText>
            </View>
          </View>
        </Card>
        <Card elevation={1} style={[styles.statCard, { flex: 1 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
            <View style={[styles.iconBadge, { backgroundColor: BrandColors.neutral + "20" }]}>
              <Feather name="users" size={16} color={BrandColors.neutral} />
            </View>
            <View>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>{stats.activeProfiles}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Active Agents</ThemedText>
            </View>
          </View>
        </Card>
      </View>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="play-circle" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Quick Run</ThemedText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
          <TextInput
            style={[styles.textInput, { flex: 1, backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: BrandColors.cardBorder }]}
            value={symbolInput}
            onChangeText={setSymbolInput}
            placeholder="Enter symbols (comma-separated)"
            placeholderTextColor={theme.textSecondary}
          />
          <Pressable
            style={[styles.primaryButton, { backgroundColor: BrandColors.primaryLight }]}
            onPress={() => {
              const symbols = symbolInput.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
              if (symbols.length > 0) runArenaMutation.mutate(symbols);
            }}
            disabled={runArenaMutation.isPending}
          >
            {runArenaMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="play" size={16} color="#fff" />
            )}
          </Pressable>
        </View>
        {runArenaMutation.isSuccess && (
          <ThemedText style={[styles.successText, { color: BrandColors.success, marginTop: Spacing.sm }]}>
            Arena run started successfully
          </ThemedText>
        )}
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="clock" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Recent Runs</ThemedText>
          {loadingRuns && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        {runs.slice(0, 5).map((run: any) => (
          <View key={run.id} style={[styles.listRow, styles.listRowBorder]}>
            <View style={styles.listRowLeft}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(run.status) }]} />
              <View>
                <ThemedText style={styles.listRowText}>{(run.symbols || []).join(", ")}</ThemedText>
                <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                  {run.consensusDecision?.toUpperCase() || "pending"} - {new Date(run.createdAt).toLocaleTimeString()}
                </ThemedText>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
              {run.escalationTriggered && (
                <View style={[styles.badge, { backgroundColor: BrandColors.warning + "20" }]}>
                  <ThemedText style={[styles.badgeText, { color: BrandColors.warning }]}>ESC</ThemedText>
                </View>
              )}
              <View style={[styles.badge, { backgroundColor: getActionColor(run.consensusDecision) + "20" }]}>
                <ThemedText style={[styles.badgeText, { color: getActionColor(run.consensusDecision) }]}>
                  ${parseFloat(run.totalCostUsd || "0").toFixed(4)}
                </ThemedText>
              </View>
            </View>
          </View>
        ))}
      </Card>
    </>
  );

  const renderRuns = () => (
    <>
      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="list" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Arena Runs</ThemedText>
          {loadingRuns && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>

        {runs.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No arena runs yet</ThemedText>
        ) : (
          runs.map((run: any) => (
            <Pressable
              key={run.id}
              style={[styles.listRow, styles.listRowBorder]}
              onPress={() => setSelectedRun(selectedRun === run.id ? null : run.id)}
            >
              <View style={styles.listRowLeft}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(run.status) }]} />
                <View>
                  <ThemedText style={styles.listRowText}>{(run.symbols || []).join(", ")}</ThemedText>
                  <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                    {run.mode} - {new Date(run.createdAt).toLocaleString()}
                  </ThemedText>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
                {run.escalationTriggered && (
                  <View style={[styles.badge, { backgroundColor: BrandColors.warning + "20" }]}>
                    <Feather name="trending-up" size={12} color={BrandColors.warning} />
                  </View>
                )}
                <View style={[styles.badge, { backgroundColor: getActionColor(run.consensusDecision) + "20" }]}>
                  <ThemedText style={[styles.badgeText, { color: getActionColor(run.consensusDecision) }]}>
                    {run.consensusDecision?.toUpperCase() || "N/A"}
                  </ThemedText>
                </View>
                <Feather name={selectedRun === run.id ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
              </View>
            </Pressable>
          ))
        )}
      </Card>

      {selectedRun && runDetail && (
        <>
          <Card elevation={1} style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <Feather name="info" size={20} color={BrandColors.primaryLight} />
              <ThemedText style={styles.cardTitle}>Run Details</ThemedText>
            </View>
            <View style={[styles.resultBox, { marginBottom: Spacing.md }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                <Feather name="target" size={18} color={getActionColor(runDetail.run.consensusDecision)} />
                <ThemedText style={[styles.resultText, { color: getActionColor(runDetail.run.consensusDecision) }]}>
                  Consensus: {runDetail.run.consensusDecision?.toUpperCase()}
                </ThemedText>
                <View style={[styles.badge, { backgroundColor: BrandColors.success + "20", marginLeft: "auto" }]}>
                  <ThemedText style={[styles.badgeText, { color: BrandColors.success }]}>
                    {Math.round(parseFloat(runDetail.run.consensusConfidence || "0") * 100)}%
                  </ThemedText>
                </View>
              </View>
              {runDetail.run.escalationTriggered && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.sm }}>
                  <Feather name="alert-triangle" size={14} color={BrandColors.warning} />
                  <ThemedText style={[styles.listRowMeta, { color: BrandColors.warning }]}>
                    Escalation: {runDetail.run.escalationReason}
                  </ThemedText>
                </View>
              )}
              {runDetail.run.riskVeto && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.sm }}>
                  <Feather name="shield" size={14} color={BrandColors.error} />
                  <ThemedText style={[styles.listRowMeta, { color: BrandColors.error }]}>
                    Risk Veto: {runDetail.run.riskVetoReason}
                  </ThemedText>
                </View>
              )}
            </View>

            <ThemedText style={[styles.cardSubtitle, { marginTop: Spacing.sm }]}>Cost Breakdown</ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs }}>
              {runDetail.costBreakdown.byAgent.map((agent: any, idx: number) => (
                <View key={idx} style={[styles.chip, { backgroundColor: theme.backgroundDefault }]}>
                  <ThemedText style={[styles.chipText, { color: theme.text }]}>
                    {agent.agent}: ${agent.cost.toFixed(4)}
                  </ThemedText>
                </View>
              ))}
            </View>
          </Card>

          <Card elevation={1} style={styles.moduleCard}>
            <View style={styles.cardHeader}>
              <Feather name="users" size={20} color={BrandColors.primaryLight} />
              <ThemedText style={styles.cardTitle}>Agent Decisions ({runDetail.decisions.length})</ThemedText>
            </View>

            {runDetail.decisions.map((decision: any, idx: number) => (
              <View key={idx} style={[styles.listRow, styles.listRowBorder, { flexDirection: "column", alignItems: "flex-start" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm, width: "100%" }}>
                  <View style={[styles.badge, { backgroundColor: getActionColor(decision.action) + "20" }]}>
                    <ThemedText style={[styles.badgeText, { color: getActionColor(decision.action) }]}>
                      {decision.role?.replace("_", " ").toUpperCase()}
                    </ThemedText>
                  </View>
                  {decision.wasEscalation && (
                    <View style={[styles.badge, { backgroundColor: BrandColors.warning + "20" }]}>
                      <Feather name="zap" size={10} color={BrandColors.warning} />
                    </View>
                  )}
                  <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
                    <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                      {decision.modelUsed?.split("/").pop() || "unknown"}
                    </ThemedText>
                    <View style={[styles.badge, { backgroundColor: getActionColor(decision.action) + "20" }]}>
                      <ThemedText style={[styles.badgeText, { color: getActionColor(decision.action) }]}>
                        {decision.action?.toUpperCase()} {Math.round(parseFloat(decision.confidence || "0") * 100)}%
                      </ThemedText>
                    </View>
                  </View>
                </View>
                <ThemedText style={[styles.listRowMeta, { color: theme.text }]} numberOfLines={3}>
                  {decision.rationale || "No rationale provided"}
                </ThemedText>
                {decision.keySignals && decision.keySignals.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.xs }}>
                    {decision.keySignals.slice(0, 3).map((signal: string, i: number) => (
                      <View key={i} style={[styles.chip, { backgroundColor: theme.backgroundDefault }]}>
                        <ThemedText style={[styles.chipText, { color: theme.textSecondary }]}>{signal}</ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </Card>

          {runDetail.outcomeLinks.length > 0 && (
            <Card elevation={1} style={styles.moduleCard}>
              <View style={styles.cardHeader}>
                <Feather name="link" size={20} color={BrandColors.primaryLight} />
                <ThemedText style={styles.cardTitle}>Outcome Links</ThemedText>
              </View>
              {runDetail.outcomeLinks.map((link: any, idx: number) => (
                <View key={idx} style={[styles.listRow, styles.listRowBorder]}>
                  <View style={styles.listRowLeft}>
                    <View style={[styles.statusDot, { backgroundColor: link.pnlUsd ? (parseFloat(link.pnlUsd) >= 0 ? BrandColors.success : BrandColors.error) : BrandColors.neutral }]} />
                    <View>
                      <ThemedText style={styles.listRowText}>
                        {link.orderId ? `Order: ${link.orderId.slice(0, 8)}...` : "Pending order"}
                      </ThemedText>
                      <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                        {link.fillId ? `Fill: ${link.fillId.slice(0, 8)}...` : "Awaiting fill"}
                      </ThemedText>
                    </View>
                  </View>
                  {link.pnlUsd && (
                    <View style={[styles.badge, { backgroundColor: (parseFloat(link.pnlUsd) >= 0 ? BrandColors.success : BrandColors.error) + "20" }]}>
                      <ThemedText style={[styles.badgeText, { color: parseFloat(link.pnlUsd) >= 0 ? BrandColors.success : BrandColors.error }]}>
                        {parseFloat(link.pnlUsd) >= 0 ? "+" : ""}${parseFloat(link.pnlUsd).toFixed(2)}
                      </ThemedText>
                    </View>
                  )}
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </>
  );

  const renderProfiles = () => (
    <Card elevation={1} style={styles.moduleCard}>
      <View style={styles.cardHeader}>
        <Feather name="users" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Agent Profiles</ThemedText>
        {loadingProfiles && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
      </View>

      {profiles.length === 0 ? (
        <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No agent profiles configured</ThemedText>
      ) : (
        profiles.map((profile: any) => (
          <View key={profile.id} style={[styles.listRow, styles.listRowBorder, { flexDirection: "column", alignItems: "flex-start" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, width: "100%", marginBottom: Spacing.sm }}>
              <View style={[styles.priorityBadge, { backgroundColor: getModeColor(profile.mode) }]}>
                <Feather name="user" size={14} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.listRowText}>{profile.name}</ThemedText>
                <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                  {profile.role?.replace("_", " ")} | {profile.provider}/{profile.model?.split("/").pop()}
                </ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: profile.status === "active" ? BrandColors.success + "20" : BrandColors.neutral + "20" }]}>
                <ThemedText style={[styles.badgeText, { color: profile.status === "active" ? BrandColors.success : BrandColors.neutral }]}>
                  {profile.status?.toUpperCase()}
                </ThemedText>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs }}>
              <View style={[styles.chip, { backgroundColor: getModeColor(profile.mode) + "20" }]}>
                <ThemedText style={[styles.chipText, { color: getModeColor(profile.mode) }]}>
                  {profile.mode?.replace("_", " ")}
                </ThemedText>
              </View>
              <View style={[styles.chip, { backgroundColor: theme.backgroundDefault }]}>
                <ThemedText style={[styles.chipText, { color: theme.textSecondary }]}>
                  temp: {profile.temperature || 0.7}
                </ThemedText>
              </View>
              {profile.totalCostUsd && parseFloat(profile.totalCostUsd) > 0 && (
                <View style={[styles.chip, { backgroundColor: theme.backgroundDefault }]}>
                  <ThemedText style={[styles.chipText, { color: theme.textSecondary }]}>
                    total: ${parseFloat(profile.totalCostUsd).toFixed(4)}
                  </ThemedText>
                </View>
              )}
              {profile.runsCount > 0 && (
                <View style={[styles.chip, { backgroundColor: theme.backgroundDefault }]}>
                  <ThemedText style={[styles.chipText, { color: theme.textSecondary }]}>
                    {profile.runsCount} runs
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        ))
      )}
    </Card>
  );

  const renderLeaderboard = () => (
    <Card elevation={1} style={styles.moduleCard}>
      <View style={styles.cardHeader}>
        <Feather name="award" size={20} color={BrandColors.primaryLight} />
        <ThemedText style={styles.cardTitle}>Agent Leaderboard (30 days)</ThemedText>
        {loadingLeaderboard && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
      </View>

      {leaderboard.length === 0 ? (
        <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No leaderboard data yet</ThemedText>
      ) : (
        leaderboard.map((entry: any, idx: number) => (
          <View key={entry.agentProfileId} style={[styles.listRow, styles.listRowBorder]}>
            <View style={styles.listRowLeft}>
              <View style={[styles.priorityBadge, { 
                backgroundColor: idx === 0 ? "#FFD700" : idx === 1 ? "#C0C0C0" : idx === 2 ? "#CD7F32" : BrandColors.neutral 
              }]}>
                <ThemedText style={{ color: "#fff", fontWeight: "bold", fontSize: 12 }}>#{idx + 1}</ThemedText>
              </View>
              <View>
                <ThemedText style={styles.listRowText}>{entry.agentName || "Unknown"}</ThemedText>
                <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                  {entry.totalRuns} runs | {entry.successfulTrades || 0} trades
                </ThemedText>
              </View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {entry.totalPnl !== undefined && (
                <View style={[styles.badge, { backgroundColor: (entry.totalPnl >= 0 ? BrandColors.success : BrandColors.error) + "20" }]}>
                  <ThemedText style={[styles.badgeText, { color: entry.totalPnl >= 0 ? BrandColors.success : BrandColors.error }]}>
                    {entry.totalPnl >= 0 ? "+" : ""}${entry.totalPnl.toFixed(2)}
                  </ThemedText>
                </View>
              )}
              <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
                Win: {Math.round((entry.winRate || 0) * 100)}%
              </ThemedText>
            </View>
          </View>
        ))
      )}
    </Card>
  );

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={loadingStats} onRefresh={refetchAll} />}>
      <ThemedText style={styles.moduleTitle}>AI Arena</ThemedText>

      <View style={{ flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.md }}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[
              styles.tabButton,
              { backgroundColor: activeTab === tab.id ? BrandColors.primaryLight : theme.backgroundDefault },
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Feather name={tab.icon} size={14} color={activeTab === tab.id ? "#fff" : theme.textSecondary} />
            <ThemedText style={[styles.tabButtonText, { color: activeTab === tab.id ? "#fff" : theme.textSecondary }]}>
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {activeTab === "overview" && renderOverview()}
      {activeTab === "runs" && renderRuns()}
      {activeTab === "profiles" && renderProfiles()}
      {activeTab === "leaderboard" && renderLeaderboard()}
    </ScrollView>
  );
}

function DebateModule() {
  return <ArenaModule />;
}

function CompetitionModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const { data: tradersData, isLoading: loadingTraders, refetch: refetchTraders } = useQuery<{ traders: any[] }>({
    queryKey: ["/api/competition/traders"],
    queryFn: async () => {
      const res = await fetch(new URL("/api/competition/traders", getApiUrl()).toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch traders");
      return res.json();
    },
  });

  const { data: runsData, isLoading: loadingRuns, refetch: refetchRuns } = useQuery<{ runs: any[] }>({
    queryKey: ["/api/competition/runs"],
    queryFn: async () => {
      const res = await fetch(new URL("/api/competition/runs", getApiUrl()).toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch runs");
      return res.json();
    },
  });

  const traders = tradersData?.traders || [];
  const runs = runsData?.runs || [];

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "completed": return BrandColors.success;
      case "running": return BrandColors.warning;
      case "failed": return BrandColors.error;
      default: return BrandColors.neutral;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={() => { refetchTraders(); refetchRuns(); }} />}>
      <ThemedText style={styles.moduleTitle}>Competition Mode</ThemedText>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="users" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Trader Profiles</ThemedText>
          {loadingTraders && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>

        {traders.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No trader profiles yet</ThemedText>
        ) : (
          traders.map((trader: any) => (
            <View key={trader.id} style={[styles.listRow, styles.listRowBorder]}>
              <View style={styles.listRowLeft}>
                <View style={[styles.priorityBadge, { backgroundColor: BrandColors.primaryLight }]}>
                  <Feather name="user" size={14} color="#fff" />
                </View>
                <View>
                  <ThemedText style={styles.listRowText}>{trader.name}</ThemedText>
                  <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                    Risk: {trader.riskPreset || "standard"} | Model: {trader.modelProfile || "default"}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.badge, { backgroundColor: trader.isActive ? BrandColors.success + "20" : BrandColors.neutral + "20" }]}>
                <ThemedText style={[styles.badgeText, { color: trader.isActive ? BrandColors.success : BrandColors.neutral }]}>
                  {trader.isActive ? "ACTIVE" : "INACTIVE"}
                </ThemedText>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="award" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Competition Runs</ThemedText>
          {loadingRuns && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>

        {runs.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No competition runs yet</ThemedText>
        ) : (
          runs.slice(0, 10).map((run: any) => (
            <View key={run.id} style={[styles.listRow, styles.listRowBorder]}>
              <View style={styles.listRowLeft}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(run.status) }]} />
                <View>
                  <ThemedText style={styles.listRowText}>{run.name || `Run ${run.id.slice(0, 8)}`}</ThemedText>
                  <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                    {run.mode} | {new Date(run.startedAt).toLocaleDateString()}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.badge, { backgroundColor: getStatusColor(run.status) + "20" }]}>
                <ThemedText style={[styles.badgeText, { color: getStatusColor(run.status) }]}>
                  {run.status?.toUpperCase()}
                </ThemedText>
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function StrategiesModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<{ versions: any[] }>({
    queryKey: ["/api/strategies/versions"],
    queryFn: async () => {
      const res = await fetch(new URL("/api/strategies/versions", getApiUrl()).toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch strategy versions");
      return res.json();
    },
  });

  const activateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PUT", `/api/strategies/versions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies/versions"] });
    },
  });

  const versions = data?.versions || [];

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "active": return BrandColors.success;
      case "draft": return BrandColors.warning;
      case "archived": return BrandColors.neutral;
      default: return BrandColors.neutral;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} />}>
      <ThemedText style={styles.moduleTitle}>Strategy Studio</ThemedText>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="layers" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Strategy Versions</ThemedText>
          {isLoading && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>

        {versions.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No strategies created yet. Use the Strategy Wizard to create one.</ThemedText>
        ) : (
          versions.map((version: any) => (
            <View key={version.id} style={[styles.listRow, styles.listRowBorder]}>
              <View style={styles.listRowLeft}>
                <View style={[styles.rankBadge, { backgroundColor: BrandColors.primaryLight }]}>
                  <ThemedText style={styles.rankText}>v{version.versionNumber}</ThemedText>
                </View>
                <View>
                  <ThemedText style={styles.listRowText}>{version.name || `Strategy ${version.strategyId?.slice(0, 8)}`}</ThemedText>
                  <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                    Created: {new Date(version.createdAt).toLocaleDateString()}
                  </ThemedText>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                <Pressable
                  style={[styles.tinyButton, { backgroundColor: version.status === "active" ? BrandColors.neutral + "20" : BrandColors.success + "20" }]}
                  onPress={() => activateMutation.mutate({ id: version.id, status: version.status === "active" ? "archived" : "active" })}
                  disabled={activateMutation.isPending}
                >
                  <ThemedText style={[styles.chipText, { color: version.status === "active" ? BrandColors.neutral : BrandColors.success }]}>
                    {version.status === "active" ? "Archive" : "Activate"}
                  </ThemedText>
                </Pressable>
                <View style={[styles.badge, { backgroundColor: getStatusColor(version.status) + "20" }]}>
                  <ThemedText style={[styles.badgeText, { color: getStatusColor(version.status) }]}>
                    {version.status?.toUpperCase()}
                  </ThemedText>
                </View>
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function ToolsModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [testParams, setTestParams] = useState<string>("{}");

  const { data: toolsData, isLoading: loadingTools, refetch: refetchTools } = useQuery<{ tools: any[] }>({
    queryKey: ["/api/tools"],
    queryFn: async () => {
      const res = await fetch(new URL("/api/tools", getApiUrl()).toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tools");
      return res.json();
    },
  });

  const { data: invocationsData, isLoading: loadingInvocations, refetch: refetchInvocations } = useQuery<{ invocations: any[]; total: number }>({
    queryKey: ["/api/tools/invocations"],
    queryFn: async () => {
      const res = await fetch(new URL("/api/tools/invocations?limit=20", getApiUrl()).toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch invocations");
      return res.json();
    },
  });

  const invokeMutation = useMutation({
    mutationFn: async ({ toolName, params }: { toolName: string; params: any }) => {
      return apiRequest("POST", "/api/tools/invoke", { toolName, params });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tools/invocations"] });
    },
  });

  const tools = toolsData?.tools || [];
  const invocations = invocationsData?.invocations || [];

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "success": return BrandColors.success;
      case "pending": return BrandColors.warning;
      case "error": return BrandColors.error;
      default: return BrandColors.neutral;
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case "broker": return BrandColors.primaryLight;
      case "market_data": return BrandColors.success;
      case "analysis": return BrandColors.warning;
      default: return BrandColors.neutral;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={() => { refetchTools(); refetchInvocations(); }} />}>
      <ThemedText style={styles.moduleTitle}>Tool Registry</ThemedText>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="tool" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Registered Tools ({tools.length})</ThemedText>
          {loadingTools && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>

        {tools.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No tools registered</ThemedText>
        ) : (
          tools.map((tool: any) => (
            <Pressable
              key={tool.name}
              style={[styles.listRow, styles.listRowBorder]}
              onPress={() => setSelectedTool(selectedTool === tool.name ? null : tool.name)}
            >
              <View style={styles.listRowLeft}>
                <View style={[styles.badge, { backgroundColor: getCategoryColor(tool.category) + "20" }]}>
                  <ThemedText style={[styles.badgeText, { color: getCategoryColor(tool.category) }]}>
                    {tool.category?.toUpperCase()}
                  </ThemedText>
                </View>
                <View>
                  <ThemedText style={styles.listRowText}>{tool.name}</ThemedText>
                  <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {tool.description}
                  </ThemedText>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                {tool.cacheable && (
                  <View style={[styles.chip, { backgroundColor: BrandColors.success + "20" }]}>
                    <Feather name="database" size={10} color={BrandColors.success} />
                    <ThemedText style={[styles.chipText, { color: BrandColors.success }]}>Cacheable</ThemedText>
                  </View>
                )}
                <Feather name={selectedTool === tool.name ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
              </View>
            </Pressable>
          ))
        )}
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="clock" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Recent Invocations</ThemedText>
          {loadingInvocations && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>

        {invocations.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No tool invocations yet</ThemedText>
        ) : (
          invocations.map((inv: any) => (
            <View key={inv.id} style={[styles.listRow, styles.listRowBorder]}>
              <View style={styles.listRowLeft}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(inv.status) }]} />
                <View>
                  <ThemedText style={styles.listRowText}>{inv.toolName}</ThemedText>
                  <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>
                    {inv.callerRole || "system"} | {inv.latencyMs ? `${inv.latencyMs}ms` : "pending"}
                  </ThemedText>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <View style={[styles.badge, { backgroundColor: getStatusColor(inv.status) + "20" }]}>
                  <ThemedText style={[styles.badgeText, { color: getStatusColor(inv.status) }]}>
                    {inv.status?.toUpperCase()}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, marginTop: 2 }]}>
                  {new Date(inv.invokedAt).toLocaleTimeString()}
                </ThemedText>
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

export default function AdminHubScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const { width } = Dimensions.get("window");
  const isWide = width > 768;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!isWide);

  const renderModule = useCallback(() => {
    switch (activeSection) {
      case "overview": return <OverviewModule />;
      case "budgets": return <BudgetsModule />;
      case "router": return <RouterModule />;
      case "orchestrator": return <OrchestratorModule />;
      case "orders": return <OrdersModule />;
      case "positions": return <PositionsModule />;
      case "universe": return <UniverseModule />;
      case "fundamentals": return <FundamentalsModule />;
      case "candidates": return <CandidatesModule />;
      case "enforcement": return <EnforcementModule />;
      case "allocation": return <AllocationModule />;
      case "rebalancer": return <RebalancerModule />;
      case "observability": return <ObservabilityModule />;
      case "debate": return <DebateModule />;
      case "competition": return <CompetitionModule />;
      case "strategies": return <StrategiesModule />;
      case "tools": return <ToolsModule />;
      default: return <OverviewModule />;
    }
  }, [activeSection]);

  const currentItem = sidebarItems.find(i => i.id === activeSection);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
      <View style={[styles.topBar, { backgroundColor: theme.backgroundDefault, borderBottomColor: BrandColors.cardBorder }]}>
        <Pressable style={styles.menuButton} onPress={() => setSidebarCollapsed(!sidebarCollapsed)}>
          <Feather name={sidebarCollapsed ? "menu" : "x"} size={24} color={theme.text} />
        </Pressable>
        <View style={styles.topBarTitle}>
          <Feather name={currentItem?.icon || "home"} size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.topBarTitleText}>{currentItem?.label || "Admin"}</ThemedText>
        </View>
        <View style={styles.topBarActions}>
          <Pressable style={styles.topBarButton}>
            <Feather name="refresh-cw" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>
      
      <View style={styles.mainLayout}>
        {!sidebarCollapsed && (
          <SidebarNav 
            activeSection={activeSection} 
            onSelect={(section) => {
              setActiveSection(section);
              if (!isWide) setSidebarCollapsed(true);
            }}
            collapsed={false}
          />
        )}
        <View style={[styles.content, { paddingBottom: insets.bottom }]}>
          {renderModule()}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  menuButton: { padding: Spacing.sm, marginRight: Spacing.sm },
  topBarTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  topBarTitleText: { ...Typography.h3 },
  topBarActions: { flexDirection: "row", gap: Spacing.sm },
  topBarButton: { padding: Spacing.sm },
  mainLayout: { flex: 1, flexDirection: "row" },
  sidebar: { width: 220, borderRightWidth: 1, borderRightColor: BrandColors.cardBorder },
  sidebarCollapsed: { width: 60 },
  sidebarHeader: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: BrandColors.cardBorder },
  sidebarTitle: { ...Typography.h4 },
  sidebarScroll: { flex: 1 },
  sidebarItem: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  sidebarLabel: { ...Typography.body },
  content: { flex: 1 },
  moduleContent: { padding: Spacing.lg, gap: Spacing.lg },
  moduleTitle: { ...Typography.h2, marginBottom: Spacing.sm },
  moduleCard: { borderWidth: 1, borderColor: BrandColors.cardBorder },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.lg },
  cardTitle: { ...Typography.h4, flex: 1 },
  emptyText: { ...Typography.body, textAlign: "center", paddingVertical: Spacing.lg },
  listRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.md },
  listRowBorder: { borderTopWidth: 1, borderTopColor: BrandColors.cardBorder },
  listRowLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1 },
  listRowRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  listRowText: { ...Typography.body, fontWeight: "500" },
  listRowMeta: { ...Typography.small },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statsRow: { flexDirection: "row", justifyContent: "space-around", gap: Spacing.md },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md, marginTop: Spacing.md },
  statBox: { flex: 1, minWidth: 100, alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.sm },
  stat: { alignItems: "center" },
  statValue: { ...Typography.h3 },
  statLabel: { ...Typography.small },
  errorBox: { flexDirection: "row", alignItems: "center", padding: Spacing.md, backgroundColor: BrandColors.error + "10", borderRadius: BorderRadius.sm, marginTop: Spacing.md },
  fusionRow: { marginBottom: Spacing.md },
  fusionLabel: { ...Typography.small, marginBottom: Spacing.xs },
  fusionBarRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  fusionBar: { flex: 1, height: 8, backgroundColor: BrandColors.cardBorder, borderRadius: 4, overflow: "hidden" },
  fusionFill: { height: "100%", borderRadius: 4 },
  fusionValue: { ...Typography.body, fontWeight: "600" },
  configRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.md },
  configInfo: { flex: 1, marginRight: Spacing.md },
  configLabel: { ...Typography.body, fontWeight: "500" },
  configDesc: { ...Typography.small, marginTop: Spacing.xs },
  budgetRow: { marginBottom: Spacing.md },
  budgetLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.xs },
  budgetLabel: { ...Typography.small },
  budgetValue: { ...Typography.small },
  progressBar: { height: 6, backgroundColor: BrandColors.cardBorder, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  actionButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, backgroundColor: BrandColors.primaryLight, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.sm, marginTop: Spacing.md },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { ...Typography.body, color: "#fff", fontWeight: "600" },
  actionButtons: { flexDirection: "row", gap: Spacing.sm },
  smallButton: { padding: Spacing.sm, borderRadius: BorderRadius.xs, backgroundColor: BrandColors.primaryLight },
  smallButtonText: { ...Typography.small, color: "#fff", fontWeight: "600" },
  tinyButton: { padding: Spacing.xs, borderRadius: BorderRadius.xs },
  editButton: { padding: Spacing.xs, marginLeft: "auto" },
  reorderButtons: { flexDirection: "row", gap: Spacing.xs },
  reorderButton: { padding: Spacing.xs },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: Spacing.md, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: BrandColors.cardBorder },
  cancelButton: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
  cancelButtonText: { ...Typography.body, color: BrandColors.neutral },
  saveButton: { backgroundColor: BrandColors.success, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.sm },
  saveButtonText: { ...Typography.body, color: "#fff", fontWeight: "600" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, gap: Spacing.xs },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { ...Typography.small, fontWeight: "500" },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.xs },
  badgeText: { ...Typography.small, fontWeight: "600" },
  searchInput: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, ...Typography.body, marginBottom: Spacing.md },
  filterRow: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap" },
  filterButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: BrandColors.cardBorder },
  filterButtonText: { ...Typography.small, fontWeight: "500" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  detailItem: { width: "45%", marginBottom: Spacing.sm },
  detailLabel: { ...Typography.small, marginBottom: Spacing.xs },
  detailValue: { ...Typography.body, fontWeight: "500" },
  resultBox: { marginTop: Spacing.md, padding: Spacing.md, backgroundColor: BrandColors.cardBorder + "50", borderRadius: BorderRadius.sm },
  resultText: { ...Typography.body, fontWeight: "500" },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm },
  fallbackRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm },
  fallbackInfo: { flex: 1 },
  priorityBadge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  priorityText: { ...Typography.small, color: "#fff", fontWeight: "600" },
  rankBadge: { width: 28, height: 20, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  rankText: { ...Typography.small, color: "#fff", fontWeight: "600" },
  excludeButton: { padding: Spacing.sm },
  traceStats: { flexDirection: "row", justifyContent: "space-around", marginTop: Spacing.md },
  traceStat: { alignItems: "center" },
  tabRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  tabButton: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: BrandColors.cardBorder + "50" },
  tabButtonActive: { backgroundColor: BrandColors.primaryLight + "20" },
  tabButtonText: { ...Typography.small, fontWeight: "500" },
  tabLabel: { ...Typography.small, fontWeight: "500" },
  statCard: { padding: Spacing.md },
  iconBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  textInput: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, ...Typography.body },
  primaryButton: { padding: Spacing.md, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center" },
  successText: { ...Typography.small },
  cardSubtitle: { ...Typography.body, fontWeight: "600", marginBottom: Spacing.sm },
  healthGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.lg },
  healthItem: { width: "45%", alignItems: "center", gap: Spacing.xs },
  healthIndicator: { width: 12, height: 12, borderRadius: 6, marginBottom: Spacing.xs },
  healthLabel: { ...Typography.small, fontWeight: "500" },
  healthValue: { ...Typography.small },
  sideIndicator: { width: 4, height: 36, borderRadius: 2 },
  expandedSection: { padding: Spacing.md, borderRadius: BorderRadius.sm, marginTop: Spacing.sm },
  fillRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.sm, borderRadius: BorderRadius.sm, marginBottom: Spacing.xs },
  fillQty: { ...Typography.body, fontWeight: "500" },
  timelineItem: { flexDirection: "row", paddingVertical: Spacing.md },
  timelineLeft: { width: 40, alignItems: "center" },
  timelineIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  timelineLine: { width: 2, flex: 1, marginTop: Spacing.xs },
  timelineContent: { flex: 1, paddingLeft: Spacing.md },
  timelineHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
  expandedMetadata: { marginTop: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.sm },
  metadataRow: { flexDirection: "row", marginBottom: Spacing.xs },
  metadataKey: { width: 100, ...Typography.small },
  metadataValue: { flex: 1, ...Typography.small },
});
