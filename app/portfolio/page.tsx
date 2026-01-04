"use client";

import dynamic from "next/dynamic";
import {
  usePortfolioSnapshot,
  usePositions,
  useStrategies,
  useTrades,
  type Position,
  type Trade,
  type Strategy,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart as PieIcon,
  AlertTriangle,
  Wallet,
  Target,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { useRealTimeTrading } from "@/lib/hooks/useRealTimeTrading";
import { ConnectionStatus } from "@/components/trading/ConnectionStatus";
import { ConnectionStatus as PortfolioStreamStatus } from "@/components/ui/ConnectionStatus";
import { useRealtimePositions } from "@/hooks/useRealtimePositions";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { useRealtimeAccount } from "@/hooks/useRealtimeAccount";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useMemo, useCallback, useState } from "react";
import {
  ChartSkeleton,
  BarChartSkeleton,
} from "@/components/portfolio/ChartSkeleton";

// Robinhood-style components
import { HeroChart } from "@/components/charts/hero-chart";
import {
  AnimatedPortfolioValue,
  AnimatedChange,
} from "@/components/charts/animated-value";
import { Sparkline } from "@/components/charts/sparkline";
import { StaggerList, StaggerItem } from "@/lib/animations/stagger";
import { MetricCardShimmer, ChartShimmer } from "@/lib/animations/shimmer";
import { PageTransition } from "@/lib/animations/page-transitions";

// Lazy load heavy chart components to reduce initial bundle size (~15-20% reduction)
// recharts is a large library (~40KB gzipped) that doesn't need to block initial render
const AllocationChart = dynamic(
  () =>
    import("@/components/portfolio/PortfolioCharts").then(
      (mod) => mod.AllocationChart
    ),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
);

const PositionPnlChart = dynamic(
  () =>
    import("@/components/portfolio/PortfolioCharts").then(
      (mod) => mod.PositionPnlChart
    ),
  {
    ssr: false,
    loading: () => <BarChartSkeleton />,
  }
);

// Generate mock portfolio history for hero chart
function generatePortfolioHistory(currentValue: number, days = 30) {
  const data = [];
  let value = currentValue * 0.95;
  const dailyReturn = (currentValue - value) / days;

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    const noise = (Math.random() - 0.5) * currentValue * 0.01;
    value += dailyReturn + noise;
    data.push({
      time: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value: Math.max(0, value),
    });
  }
  return data;
}

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  variant = "default",
  sparklineData,
}: {
  title: string;
  value: string;
  change?: number;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
  sparklineData?: number[];
}) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-gain",
    warning: "text-warning",
    danger: "text-loss",
  };

  return (
    <Card variant="elevated" hover="lift" className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p
              className={cn(
                "mt-1.5 text-2xl font-bold tracking-tight tabular-nums",
                variantStyles[variant]
              )}
            >
              {value}
            </p>
            {change !== undefined && (
              <div className="mt-1.5">
                <AnimatedChange value={change} size="sm" />
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                variant === "success"
                  ? "bg-gain/10"
                  : variant === "danger"
                    ? "bg-loss/10"
                    : variant === "warning"
                      ? "bg-warning/10"
                      : "bg-primary/10"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  variant === "success"
                    ? "text-gain"
                    : variant === "danger"
                      ? "text-loss"
                      : variant === "warning"
                        ? "text-warning"
                        : "text-primary"
                )}
              />
            </div>
            {sparklineData && (
              <Sparkline
                data={sparklineData}
                width={64}
                height={24}
                strokeWidth={1.5}
                showArea={false}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PortfolioPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const lastPnlRef = useRef<number | null>(null);

  // Fetch portfolio snapshot with 30s auto-refresh
  const {
    data: portfolioSnapshot,
    isLoading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio,
  } = usePortfolioSnapshot();

  // Fetch positions with 30s auto-refresh
  const {
    data: positions,
    isLoading: positionsLoading,
    error: positionsError,
    refetch: refetchPositions,
  } = usePositions();

  // Fetch strategies for active strategies section
  const {
    data: strategies = [],
    isLoading: strategiesLoading,
    error: strategiesError,
    refetch: refetchStrategies,
  } = useStrategies();

  // Memoized event handlers to prevent unnecessary re-renders
  const handlePositionUpdate = useCallback(
    (data: { totalPnL?: number }) => {
      // Invalidate queries to trigger refetch with new data
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["portfolioSnapshot"] });

      // Show toast notification for significant P&L changes
      const newPnl = data.totalPnL || 0;
      if (lastPnlRef.current !== null) {
        const pnlChange = Math.abs(newPnl - lastPnlRef.current);
        if (pnlChange > 100) {
          // Notify on >$100 change
          toast({
            title: "Position Updated",
            description: `P&L ${newPnl >= 0 ? "+" : ""}$${newPnl.toFixed(2)}`,
            variant: newPnl >= 0 ? "default" : "destructive",
          });
        }
      }
      lastPnlRef.current = newPnl;
    },
    [queryClient, toast]
  );

  const handlePriceUpdate = useCallback(() => {
    // Invalidate queries for real-time price updates
    queryClient.invalidateQueries({ queryKey: ["positions"] });
  }, [queryClient]);

  // Real-time SSE connection for live P&L updates (existing)
  const { isConnected, status } = useRealTimeTrading({
    enabled: !!user?.id,
    userId: user?.id,
    onPositionUpdate: handlePositionUpdate,
    onPriceUpdate: handlePriceUpdate,
  });

  // NEW: Real-time WebSocket portfolio streaming (Task 3.1)
  const {
    connectionStatus: positionsStreamStatus,
    hasStaleData: positionsHaveStaleData,
  } = useRealtimePositions({
    enabled: !!user?.id,
    onPositionUpdate: (position) => {
      console.log(
        "[Realtime] Position updated:",
        position.symbol,
        position.unrealizedPnl
      );
    },
  });

  const { isConnected: ordersStreamConnected } = useRealtimeOrders({
    enabled: !!user?.id,
    onOrderFilled: (order) => {
      toast({
        title: "Order Filled",
        description: `${order.side.toUpperCase()} ${order.filledQty} ${order.symbol} @ $${order.filledAvgPrice}`,
        variant: "default",
      });
    },
  });

  const { isConnected: accountStreamConnected } = useRealtimeAccount({
    enabled: !!user?.id,
    onAccountUpdate: (account) => {
      console.log("[Realtime] Account updated: equity =", account.equity);
    },
  });

  const isLoading = portfolioLoading || positionsLoading || strategiesLoading;
  const hasError = portfolioError || positionsError || strategiesError;

  // Memoized retry handler (must be before early returns)
  const handleRetryAll = useCallback(() => {
    refetchPortfolio();
    refetchPositions();
    refetchStrategies();
  }, [refetchPortfolio, refetchPositions, refetchStrategies]);

  // Memoized filtered strategies (must be before early returns)
  const activeStrategies = useMemo(
    () => strategies.filter((s) => s.status === "live" || s.status === "paper"),
    [strategies]
  );

  // Memoized chart data - uses fallbacks when data not available
  const portfolioValue = portfolioSnapshot?.portfolioValue ?? 0;
  const portfolioCash = portfolioSnapshot?.cash ?? 0;
  const dailyPlPct = portfolioSnapshot?.dailyPlPct ?? 0;

  const pieData = useMemo(
    () =>
      portfolioValue > 0
        ? (positions || []).map((p) => ({
            name: p.symbol,
            value: (p.marketValue / portfolioValue) * 100,
          }))
        : [],
    [positions, portfolioValue]
  );

  const pnlData = useMemo(
    () =>
      (positions || []).map((p) => ({
        symbol: p.symbol,
        pnl: p.unrealizedPl,
        pnlPercent: p.unrealizedPlPct,
      })),
    [positions]
  );

  // Memoized computed metrics
  const { exposedAmount, cashPercent, exposurePercent, drawdownPercent } =
    useMemo(() => {
      const exposed = portfolioValue - portfolioCash;
      const cashPct =
        portfolioValue > 0 ? (portfolioCash / portfolioValue) * 100 : 0;
      const exposurePct =
        portfolioValue > 0 ? (exposed / portfolioValue) * 100 : 0;
      const drawdownPct = Math.abs(Math.min(0, dailyPlPct));

      return {
        exposedAmount: exposed,
        cashPercent: cashPct,
        exposurePercent: exposurePct,
        drawdownPercent: drawdownPct,
      };
    }, [portfolioValue, portfolioCash, dailyPlPct]);

  // Memoized chart history (must be before early returns per React hooks rules)
  const portfolioChartData = useMemo(() => {
    if (!portfolioSnapshot?.totalEquity) return [];
    return generatePortfolioHistory(portfolioSnapshot.totalEquity, 30);
  }, [portfolioSnapshot?.totalEquity]);

  // Full-screen chart state (must be before early returns per React hooks rules)
  const [isChartExpanded, setIsChartExpanded] = useState(false);

  if (
    isLoading &&
    !portfolioSnapshot &&
    !positions &&
    strategies.length === 0
  ) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-1 text-muted-foreground">
            View your positions, allocations, and risk metrics
          </p>
        </div>
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Loading portfolio...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (
    (portfolioError || !portfolioSnapshot) &&
    !positions &&
    strategies.length === 0
  ) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-1 text-muted-foreground">
            View your positions, allocations, and risk metrics
          </p>
        </div>
        <ErrorState
          title="Unable to load portfolio data"
          error={portfolioError || positionsError}
          onRetry={handleRetryAll}
        />
      </div>
    );
  }

  // Show partial data with warnings if some APIs failed
  if (!portfolioSnapshot) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-1 text-muted-foreground">
            View your positions, allocations, and risk metrics
          </p>
        </div>
        <Card className="border-warning/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
              <AlertTriangle className="h-8 w-8 text-warning" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">
              Portfolio data unavailable
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Unable to retrieve your portfolio snapshot. Some data may be
              incomplete.
            </p>
            <Button
              onClick={() => refetchPortfolio()}
              variant="outline"
              className="mt-6"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Hero Section with Portfolio Chart */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card to-card/50 border">
          <div className="absolute inset-0 bg-grid-white/[0.02]" />
          <div className="relative p-6 pb-0">
            <div className="flex items-start justify-between mb-4">
              <div>
                <AnimatedPortfolioValue
                  value={portfolioSnapshot.totalEquity}
                  change={portfolioSnapshot.dailyPl}
                  changePercent={portfolioSnapshot.dailyPlPct}
                  label="Total Portfolio Value"
                />
              </div>
              <div className="flex items-center gap-2">
                {user?.id && (
                  <ConnectionStatus
                    userId={user.id}
                    compact
                    showStats={false}
                  />
                )}
                {/* NEW: Portfolio WebSocket streaming status (Task 3.1) */}
                <PortfolioStreamStatus showLabel={false} size="sm" />
                {positionsHaveStaleData && (
                  <span className="text-xs text-yellow-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Data may be outdated
                  </span>
                )}
                <Button
                  variant="glass"
                  size="icon"
                  onClick={() => setIsChartExpanded(!isChartExpanded)}
                  className="h-9 w-9"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Hero Chart */}
          <HeroChart
            data={portfolioChartData}
            height={isChartExpanded ? 350 : 200}
            showTooltip
            showReferenceLine
            showAxis={isChartExpanded}
            className="px-0"
          />
        </div>

        {(positionsError || strategiesError) && (
          <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <div className="text-sm">
                <p className="font-medium text-warning">
                  Some data could not be loaded
                </p>
                <p className="text-warning/80">
                  {positionsError && "Unable to load positions. "}
                  {strategiesError && "Unable to load strategies. "}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Day P&L"
            value={`${portfolioSnapshot.dailyPl >= 0 ? "+" : ""}$${Math.abs(portfolioSnapshot.dailyPl).toLocaleString()}`}
            change={portfolioSnapshot.dailyPlPct}
            icon={portfolioSnapshot.dailyPl >= 0 ? TrendingUp : TrendingDown}
            variant={portfolioSnapshot.dailyPl >= 0 ? "success" : "danger"}
          />
          <MetricCard
            title="Exposure"
            value={`${exposurePercent.toFixed(1)}%`}
            icon={PieIcon}
          />
          <MetricCard
            title="Cash Available"
            value={`$${portfolioSnapshot.cash.toLocaleString()}`}
            icon={Wallet}
          />
          <MetricCard
            title="Drawdown"
            value={`${drawdownPercent.toFixed(1)}%`}
            icon={AlertTriangle}
            variant={drawdownPercent > 10 ? "warning" : "default"}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card variant="glass">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">
                Asset Allocation
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <AllocationChart data={pieData} />
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">
                Position P&L
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <PositionPnlChart data={pnlData} />
            </CardContent>
          </Card>
        </div>

        {/* Cash & Exposure Card */}
        <Card variant="glass">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">
              Cash & Exposure
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Cash Available
                  </span>
                  <span className="font-semibold tabular-nums">
                    ${portfolioSnapshot.cash.toLocaleString()}
                  </span>
                </div>
                <Progress value={cashPercent} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {cashPercent.toFixed(1)}% of portfolio
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Invested
                  </span>
                  <span className="font-semibold tabular-nums">
                    ${exposedAmount.toLocaleString()}
                  </span>
                </div>
                <Progress value={100 - cashPercent} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {(100 - cashPercent).toFixed(1)}% of portfolio
                </p>
              </div>
            </div>
            <div className="border-t border-border/50 pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Buying Power</span>
                <span className="font-semibold tabular-nums text-primary">
                  ${portfolioSnapshot.buyingPower.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Strategies Card */}
        <Card variant="glass">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">
              Active Strategies
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {activeStrategies.length === 0 ? (
              <div className="py-8 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <p className="mt-3 text-muted-foreground">
                  No active strategies
                </p>
                <Link href="/strategies">
                  <Button variant="gain" size="pill" className="mt-4">
                    View All Strategies
                  </Button>
                </Link>
              </div>
            ) : (
              <StaggerList className="space-y-3">
                {activeStrategies.map((strategy) => (
                  <StaggerItem key={strategy.id}>
                    <Card variant="ghost" hover="lift" className="group">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">
                                {strategy.name}
                              </p>
                              <Badge
                                variant={
                                  strategy.mode === "live"
                                    ? "gain"
                                    : "gain-subtle"
                                }
                                size="sm"
                              >
                                {strategy.mode === "paper" ? "Paper" : "Live"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {strategy.type || "Custom Strategy"}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            {strategy.performanceSummary && (
                              <div className="text-right">
                                <Badge
                                  variant={
                                    (strategy.performanceSummary.totalReturn ||
                                      0) >= 0
                                      ? "gain-subtle"
                                      : "loss-subtle"
                                  }
                                  size="sm"
                                >
                                  {(strategy.performanceSummary.totalReturn ||
                                    0) >= 0
                                    ? "+"
                                    : ""}
                                  {(
                                    strategy.performanceSummary.totalReturn || 0
                                  ).toFixed(2)}
                                  %
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {strategy.performanceSummary.totalTrades || 0}{" "}
                                  trades
                                </p>
                              </div>
                            )}
                            <Link href={`/strategies/${strategy.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                View
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
