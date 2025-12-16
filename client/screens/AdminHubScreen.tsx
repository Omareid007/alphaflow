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
  | "universe" 
  | "fundamentals" 
  | "candidates" 
  | "enforcement" 
  | "allocation" 
  | "rebalancer" 
  | "observability";

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
  { id: "universe", label: "Universe", icon: "globe", description: "Asset universe management" },
  { id: "fundamentals", label: "Fundamentals", icon: "bar-chart-2", description: "Fundamental data" },
  { id: "candidates", label: "Candidates", icon: "users", description: "Trading candidates" },
  { id: "enforcement", label: "Enforcement", icon: "shield", description: "Enforcement gate" },
  { id: "allocation", label: "Allocation", icon: "pie-chart", description: "Allocation policies" },
  { id: "rebalancer", label: "Rebalancer", icon: "refresh-cw", description: "Portfolio rebalancing" },
  { id: "observability", label: "Observability", icon: "search", description: "Traces and work queue" },
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
      return apiRequest("/api/admin/ai-config", {
        method: "PUT",
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
      });
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

  const { data: configsData, refetch } = useQuery<{ configs: any[]; availableProviders: string[] }>({
    queryKey: ["/api/admin/model-router/configs"],
  });

  const { data: statsData } = useQuery<any>({
    queryKey: ["/api/admin/model-router/stats"],
  });

  const { data: callsData } = useQuery<{ calls: any[]; count: number }>({
    queryKey: ["/api/admin/model-router/calls"],
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

      {configs.map((config) => (
        <Card key={config.role} elevation={1} style={styles.moduleCard}>
          <View style={styles.cardHeader}>
            <Feather name="settings" size={18} color={BrandColors.primaryLight} />
            <ThemedText style={styles.cardTitle}>{roleNames[config.role] || config.role}</ThemedText>
          </View>
          <ThemedText style={[styles.configDesc, { color: theme.textSecondary, marginBottom: Spacing.md }]}>{config.description}</ThemedText>
          <ThemedText style={[styles.budgetLabel, { color: theme.textSecondary }]}>Fallback Chain:</ThemedText>
          {config.fallbackChain?.map((m: any, i: number) => (
            <View key={`${m.provider}-${m.model}`} style={styles.fallbackRow}>
              <View style={[styles.priorityBadge, { backgroundColor: i === 0 ? BrandColors.success : BrandColors.neutral }]}>
                <ThemedText style={styles.priorityText}>{i + 1}</ThemedText>
              </View>
              <View style={styles.fallbackInfo}>
                <ThemedText style={[styles.listRowText, { fontFamily: Fonts?.mono }]}>{m.provider}</ThemedText>
                <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>{m.model}</ThemedText>
              </View>
              {m.costPer1kTokens && (
                <ThemedText style={[styles.listRowMeta, { color: theme.textSecondary }]}>${m.costPer1kTokens.toFixed(5)}/1k</ThemedText>
              )}
            </View>
          ))}
        </Card>
      ))}

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

function ObservabilityModule() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [traceId, setTraceId] = useState("");
  const [traceResult, setTraceResult] = useState<any>(null);

  const { data: workItems, isLoading: loadingItems, refetch } = useQuery<{ items: any[]; counts: Record<string, number> }>({
    queryKey: ["/api/admin/work-items"],
  });

  const traceMutation = useMutation({
    mutationFn: async (id: string) => {
      const url = new URL(`/api/admin/trace/${id}`, getApiUrl());
      const res = await fetch(url.toString(), { credentials: "include" });
      return res.json();
    },
    onSuccess: (data) => setTraceResult(data),
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", "/api/admin/work-items/retry", { id });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/work-items"] }),
  });

  const counts = workItems?.counts || {};
  const items = workItems?.items || [];

  return (
    <ScrollView contentContainerStyle={styles.moduleContent} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
      <ThemedText style={styles.moduleTitle}>Observability</ThemedText>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="search" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>TraceId Explorer</ThemedText>
        </View>
        <TextInput
          style={[styles.searchInput, { color: theme.text, backgroundColor: theme.backgroundSecondary, borderColor: BrandColors.cardBorder }]}
          placeholder="Enter traceId to explore..."
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
              <ThemedText style={styles.actionButtonText}>Search Trace</ThemedText>
            </>
          )}
        </Pressable>
        {traceResult && (
          <View style={styles.resultBox}>
            <ThemedText style={styles.listRowText}>Trace: {traceResult.traceId}</ThemedText>
            <View style={styles.traceStats}>
              <View style={styles.traceStat}>
                <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{traceResult.aiDecisions?.length || 0}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>AI Decisions</ThemedText>
              </View>
              <View style={styles.traceStat}>
                <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{traceResult.trades?.length || 0}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Trades</ThemedText>
              </View>
              <View style={styles.traceStat}>
                <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{traceResult.llmCalls?.length || 0}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>LLM Calls</ThemedText>
              </View>
              <View style={styles.traceStat}>
                <ThemedText style={[styles.statValue, { fontFamily: Fonts?.mono }]}>{traceResult.workItems?.length || 0}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Work Items</ThemedText>
              </View>
            </View>
          </View>
        )}
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="inbox" size={20} color={BrandColors.primaryLight} />
          <ThemedText style={styles.cardTitle}>Work Queue Health</ThemedText>
          {loadingItems && <ActivityIndicator size="small" color={BrandColors.primaryLight} />}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.warning, fontFamily: Fonts?.mono }]}>{counts.PENDING || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.primaryLight, fontFamily: Fonts?.mono }]}>{counts.RUNNING || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Running</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.success, fontFamily: Fonts?.mono }]}>{counts.SUCCEEDED || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Succeeded</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.error, fontFamily: Fonts?.mono }]}>{counts.FAILED || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Failed</ThemedText>
          </View>
          <View style={styles.stat}>
            <ThemedText style={[styles.statValue, { color: BrandColors.error, fontFamily: Fonts?.mono }]}>{counts.DEAD_LETTER || 0}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Dead Letter</ThemedText>
          </View>
        </View>
      </Card>

      <Card elevation={1} style={styles.moduleCard}>
        <View style={styles.cardHeader}>
          <Feather name="alert-octagon" size={20} color={BrandColors.error} />
          <ThemedText style={styles.cardTitle}>Dead Letters & Failed Items</ThemedText>
        </View>
        {items.filter((i: any) => i.status === "DEAD_LETTER" || i.status === "FAILED").length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No dead letters or failed items</ThemedText>
        ) : items.filter((i: any) => i.status === "DEAD_LETTER" || i.status === "FAILED").slice(0, 10).map((item: any, i: number) => (
          <View key={item.id} style={[styles.listRow, styles.listRowBorder]}>
            <View style={styles.listRowLeft}>
              <View style={[styles.statusDot, { backgroundColor: item.status === "DEAD_LETTER" ? BrandColors.error : BrandColors.warning }]} />
              <View>
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
          <View key={item.id} style={[styles.listRow, i < items.length - 1 && styles.listRowBorder]}>
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
      case "universe": return <UniverseModule />;
      case "fundamentals": return <FundamentalsModule />;
      case "candidates": return <CandidatesModule />;
      case "enforcement": return <EnforcementModule />;
      case "allocation": return <AllocationModule />;
      case "rebalancer": return <RebalancerModule />;
      case "observability": return <ObservabilityModule />;
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
  stat: { alignItems: "center" },
  statValue: { ...Typography.h3 },
  statLabel: { ...Typography.small },
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
  smallButton: { padding: Spacing.sm, borderRadius: BorderRadius.xs },
  smallButtonText: { ...Typography.small, color: "#fff", fontWeight: "600" },
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
});
