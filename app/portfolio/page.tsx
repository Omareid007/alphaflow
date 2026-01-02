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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { useRealTimeTrading } from "@/lib/hooks/useRealTimeTrading";
import { ConnectionStatus } from "@/components/trading/ConnectionStatus";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useMemo, useCallback } from "react";
import {
  ChartSkeleton,
  BarChartSkeleton,
} from "@/components/portfolio/ChartSkeleton";

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

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string;
  change?: number;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p
              className={cn(
                "mt-2 text-3xl font-semibold",
                variantStyles[variant]
              )}
            >
              {value}
            </p>
            {change !== undefined && (
              <div className="mt-2 flex items-center gap-1">
                {change >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                <span
                  className={
                    change >= 0
                      ? "text-sm text-success"
                      : "text-sm text-destructive"
                  }
                >
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
            <Icon className="h-6 w-6 text-muted-foreground" />
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

  // Real-time SSE connection for live P&L updates
  const { isConnected, status } = useRealTimeTrading({
    enabled: !!user?.id,
    userId: user?.id,
    onPositionUpdate: handlePositionUpdate,
    onPriceUpdate: handlePriceUpdate,
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
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-1 text-muted-foreground">
            View your positions, allocations, and risk metrics
          </p>
        </div>
        {user?.id && (
          <ConnectionStatus userId={user.id} compact={false} showStats={true} />
        )}
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Equity"
          value={`$${portfolioSnapshot.totalEquity.toLocaleString()}`}
          change={portfolioSnapshot.dailyPlPct}
          icon={DollarSign}
        />
        <MetricCard
          title="Day P&L"
          value={`$${portfolioSnapshot.dailyPl.toLocaleString()}`}
          change={portfolioSnapshot.dailyPlPct}
          icon={TrendingUp}
          variant={portfolioSnapshot.dailyPl >= 0 ? "success" : "danger"}
        />
        <MetricCard
          title="Exposure"
          value={`${exposurePercent.toFixed(1)}%`}
          icon={PieIcon}
        />
        <MetricCard
          title="Drawdown"
          value={`${drawdownPercent.toFixed(1)}%`}
          icon={AlertTriangle}
          variant={drawdownPercent > 10 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationChart data={pieData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Position P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <PositionPnlChart data={pnlData} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cash & Exposure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Cash Available
                </span>
                <span className="font-medium">
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
                <span className="text-sm text-muted-foreground">Invested</span>
                <span className="font-medium">
                  ${exposedAmount.toLocaleString()}
                </span>
              </div>
              <Progress value={100 - cashPercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {(100 - cashPercent).toFixed(1)}% of portfolio
              </p>
            </div>
          </div>
          <div className="border-t pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Buying Power</span>
              <span className="font-medium">
                ${portfolioSnapshot.buyingPower.toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Strategies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeStrategies.length === 0 ? (
              <p className="text-muted-foreground">No active strategies</p>
            ) : (
              activeStrategies.map((strategy) => (
                <div
                  key={strategy.id}
                  className="flex items-center justify-between rounded-lg bg-secondary/50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{strategy.name}</p>
                        <Badge
                          variant={
                            strategy.mode === "live" ? "default" : "secondary"
                          }
                        >
                          {strategy.mode === "paper" ? "Paper" : "Live"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {strategy.type || "Custom Strategy"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {strategy.performanceSummary && (
                      <div className="text-right">
                        <p
                          className={cn(
                            "font-semibold",
                            (strategy.performanceSummary.totalReturn || 0) >= 0
                              ? "text-success"
                              : "text-destructive"
                          )}
                        >
                          {(strategy.performanceSummary.totalReturn || 0) >= 0
                            ? "+"
                            : ""}
                          {(
                            strategy.performanceSummary.totalReturn || 0
                          ).toFixed(2)}
                          %
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {strategy.performanceSummary.totalTrades || 0} trades
                        </p>
                      </div>
                    )}
                    <Link href={`/strategies/${strategy.id}`}>
                      <Button variant="outline" size="sm">
                        View Strategy
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
