"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStrategies, usePortfolioSnapshot, useAiEvents } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowRight,
  Activity,
  AlertTriangle,
  Brain,
  Zap,
  Wallet,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

// New Robinhood-style components
import { HeroChart } from "@/components/charts/hero-chart";
import {
  AnimatedPortfolioValue,
  AnimatedChange,
} from "@/components/charts/animated-value";
import { Sparkline } from "@/components/charts/sparkline";
import { StaggerList, StaggerItem } from "@/lib/animations/stagger";
import { MetricCardShimmer, ChartShimmer } from "@/lib/animations/shimmer";
import { PageTransition } from "@/lib/animations/page-transitions";

// Generate mock sparkline data based on a base value
function generateSparklineData(
  baseValue: number,
  volatility = 0.02,
  points = 20
): number[] {
  const data: number[] = [baseValue];
  for (let i = 1; i < points; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility * baseValue;
    data.push(Math.max(0, data[i - 1] + change));
  }
  return data;
}

// Generate mock portfolio history for hero chart
function generatePortfolioHistory(currentValue: number, days = 30) {
  const data = [];
  let value = currentValue * 0.95; // Start 5% lower
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
  changeLabel,
  icon: Icon,
  sparklineData,
}: {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  sparklineData?: number[];
}) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <Card variant="elevated" hover="lift" className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">
              {value}
            </p>
            {change !== undefined && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <AnimatedChange value={change} size="sm" />
                {changeLabel && (
                  <span className="text-xs text-muted-foreground">
                    {changeLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
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

function StrategyCard({ strategy }: { strategy: any }) {
  const statusVariant: Record<
    string,
    "default" | "secondary" | "gain" | "loss" | "gain-subtle" | "loss-subtle"
  > = {
    Draft: "secondary",
    Backtested: "secondary",
    Deployed: "gain",
    live: "gain",
    paper: "gain-subtle",
    Paused: "secondary",
    Stopped: "loss-subtle",
  };

  const returnValue = strategy.performanceSummary?.totalReturn || 0;
  const isPositive = returnValue >= 0;

  return (
    <Card variant="ghost" hover="lift" className="group">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-medium">{strategy.name}</h3>
              <Badge
                variant={statusVariant[strategy.status] || "secondary"}
                size="sm"
              >
                {strategy.status}
              </Badge>
            </div>
            {strategy.performanceSummary && (
              <div className="mt-2 flex items-center gap-3 text-sm">
                <Badge
                  variant={isPositive ? "gain-subtle" : "loss-subtle"}
                  size="sm"
                >
                  {isPositive ? "+" : ""}
                  {returnValue.toFixed(1)}%
                </Badge>
                {strategy.performanceSummary.sharpeRatio !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    Sharpe {strategy.performanceSummary.sharpeRatio.toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
          <Link href={`/strategies/${strategy.id}`}>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function AiEventCard({ event }: { event: any }) {
  const typeIcons: Record<string, React.ElementType> = {
    signal: Zap,
    sentiment: Activity,
    news: Brain,
    risk: AlertTriangle,
    suggestion: Brain,
  };

  const typeBadgeVariant: Record<
    string,
    "default" | "secondary" | "gain" | "loss" | "glass"
  > = {
    signal: "gain",
    sentiment: "glass",
    news: "secondary",
    risk: "loss",
    suggestion: "gain",
  };

  const Icon = typeIcons[event.type] || Brain;

  return (
    <div className="flex gap-3 py-3 group">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50 group-hover:bg-secondary transition-colors">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">
            {event.title || event.headline}
          </p>
          {event.symbol && (
            <Badge variant="glass" size="sm">
              {event.symbol}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {event.description || event.explanation}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Badge
            variant={typeBadgeVariant[event.type] || "secondary"}
            size="sm"
          >
            {event.type}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(event.createdAt || event.time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  // Use React Query hooks for real API data
  const {
    data: portfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio,
  } = usePortfolioSnapshot();

  const {
    data: strategies = [],
    isLoading: strategiesLoading,
    error: strategiesError,
    refetch: refetchStrategies,
  } = useStrategies();

  const {
    data: events = [],
    isLoading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useAiEvents({ limit: 10 });

  const hasError = portfolioError || strategiesError || eventsError;
  const activeStrategies = strategies.filter(
    (s: any) => s.status === "live" || s.status === "paper"
  );

  // Memoized chart and sparkline data
  const portfolioChartData = useMemo(() => {
    if (!portfolio?.totalEquity) return [];
    return generatePortfolioHistory(portfolio.totalEquity, 30);
  }, [portfolio?.totalEquity]);

  const equitySparkline = useMemo(() => {
    if (!portfolio?.totalEquity) return undefined;
    return generateSparklineData(portfolio.totalEquity, 0.01);
  }, [portfolio?.totalEquity]);

  const plSparkline = useMemo(() => {
    if (!portfolio?.dailyPl) return undefined;
    // For P&L, simulate intraday movement
    const base = Math.abs(portfolio.dailyPl);
    return generateSparklineData(base, 0.15);
  }, [portfolio?.dailyPl]);

  const buyingPowerSparkline = useMemo(() => {
    if (!portfolio?.buyingPower) return undefined;
    return generateSparklineData(portfolio.buyingPower, 0.005);
  }, [portfolio?.buyingPower]);

  // Handle critical errors (all data failed to load)
  if (
    hasError &&
    !portfolio &&
    strategies.length === 0 &&
    events.length === 0
  ) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Overview of your trading performance
          </p>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-8">
          <div className="flex flex-col items-center text-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h3 className="mt-4 text-lg font-semibold">
              Unable to load dashboard
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {portfolioError instanceof Error
                ? portfolioError.message
                : strategiesError instanceof Error
                  ? strategiesError.message
                  : eventsError instanceof Error
                    ? eventsError.message
                    : "Could not connect to the server. Please check if the backend is running."}
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => {
                  refetchPortfolio();
                  refetchStrategies();
                  refetchEvents();
                }}
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
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
                {portfolioLoading && !portfolio ? (
                  <div className="space-y-2">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-10 w-48 animate-pulse rounded bg-muted" />
                  </div>
                ) : (
                  <AnimatedPortfolioValue
                    value={portfolio?.totalEquity ?? 0}
                    change={portfolio?.dailyPl}
                    changePercent={portfolio?.dailyPlPct}
                    label="Total Portfolio Value"
                  />
                )}
              </div>
              <Link href="/create">
                <Button variant="gain" size="pill">
                  <Plus className="mr-2 h-4 w-4" />
                  New Strategy
                </Button>
              </Link>
            </div>
          </div>

          {/* Hero Chart */}
          {portfolioLoading && !portfolio ? (
            <div className="h-48 px-6 pb-4">
              <ChartShimmer height={160} className="border-0 bg-transparent" />
            </div>
          ) : portfolioChartData.length > 0 ? (
            <HeroChart
              data={portfolioChartData}
              height={180}
              showTooltip
              showReferenceLine
              className="px-0"
            />
          ) : null}
        </div>

        {portfolioError && (
          <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <p className="text-sm text-warning">
                Unable to load portfolio data. Some information may be
                unavailable.
              </p>
            </div>
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {portfolioLoading && !portfolio ? (
            <>
              <MetricCardShimmer />
              <MetricCardShimmer />
              <MetricCardShimmer />
              <MetricCardShimmer />
            </>
          ) : (
            <>
              <MetricCard
                title="Day P&L"
                value={
                  portfolio?.dailyPl
                    ? `${portfolio.dailyPl >= 0 ? "+" : ""}$${Math.abs(portfolio.dailyPl).toLocaleString()}`
                    : "—"
                }
                change={portfolio?.dailyPlPct}
                icon={
                  portfolio?.dailyPl && portfolio.dailyPl >= 0
                    ? TrendingUp
                    : TrendingDown
                }
                sparklineData={plSparkline}
              />
              <MetricCard
                title="Buying Power"
                value={
                  portfolio?.buyingPower
                    ? `$${portfolio.buyingPower.toLocaleString()}`
                    : "—"
                }
                icon={Wallet}
                sparklineData={buyingPowerSparkline}
              />
              <MetricCard
                title="Active Strategies"
                value={activeStrategies.length.toString()}
                icon={Target}
              />
              <MetricCard
                title="Cash Available"
                value={
                  portfolio?.cash ? `$${portfolio.cash.toLocaleString()}` : "—"
                }
                icon={Activity}
                sparklineData={equitySparkline}
              />
            </>
          )}
        </div>

        {/* Strategies & AI Activity Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Strategies Section */}
          <div className="lg:col-span-2">
            <Card variant="glass">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-lg font-semibold">
                  Strategies
                </CardTitle>
                <Link href="/strategies">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-primary"
                  >
                    View All
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="pt-0">
                {strategiesLoading && strategies.length === 0 ? (
                  <div className="space-y-2">
                    <MetricCardShimmer />
                    <MetricCardShimmer />
                    <MetricCardShimmer />
                  </div>
                ) : strategiesError ? (
                  <div className="py-8 text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
                      <AlertTriangle className="h-6 w-6 text-warning" />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Unable to load strategies
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => refetchStrategies()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : strategies.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Target className="h-6 w-6 text-primary" />
                    </div>
                    <p className="mt-3 text-muted-foreground">
                      No strategies yet
                    </p>
                    <Link href="/create">
                      <Button variant="gain" size="pill" className="mt-4">
                        Create your first strategy
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <StaggerList className="space-y-2">
                    {strategies.slice(0, 5).map((strategy) => (
                      <StaggerItem key={strategy.id}>
                        <StrategyCard strategy={strategy} />
                      </StaggerItem>
                    ))}
                  </StaggerList>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Activity Section */}
          <div>
            <Card variant="glass">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-lg font-semibold">
                  AI Activity
                </CardTitle>
                <Link href="/ai">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-primary"
                  >
                    View All
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="pt-0">
                {eventsLoading && events.length === 0 ? (
                  <div className="space-y-3">
                    <MetricCardShimmer />
                    <MetricCardShimmer />
                    <MetricCardShimmer />
                  </div>
                ) : eventsError ? (
                  <div className="py-8 text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
                      <AlertTriangle className="h-6 w-6 text-warning" />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Unable to load AI activity
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => refetchEvents()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : events.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Brain className="h-6 w-6 text-primary" />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      No recent AI activity
                    </p>
                  </div>
                ) : (
                  <StaggerList className="divide-y divide-border/50">
                    {events.slice(0, 5).map((event) => (
                      <StaggerItem key={event.id}>
                        <AiEventCard event={event} />
                      </StaggerItem>
                    ))}
                  </StaggerList>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
