"use client";

import Link from "next/link";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

// Skeleton components for progressive loading
function MetricCardSkeleton() {
  return (
    <Card className="bg-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-8 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

function StrategyCardSkeleton() {
  return (
    <Card className="bg-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded bg-muted" />
            </div>
            <div className="mt-2 flex items-center gap-4">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AiEventCardSkeleton() {
  return (
    <div className="flex gap-3 py-3">
      <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      <div className="flex-1">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
}: {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
}) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <Card className="bg-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {value}
            </p>
            {change !== undefined && (
              <div className="mt-2 flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
                    isPositive ? "text-success" : "text-destructive"
                  )}
                >
                  {isPositive ? "+" : ""}
                  {change.toFixed(2)}%
                </span>
                {changeLabel && (
                  <span className="text-sm text-muted-foreground">
                    {changeLabel}
                  </span>
                )}
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

function StrategyCard({ strategy }: { strategy: any }) {
  const statusColors: Record<string, string> = {
    Draft: "bg-muted text-muted-foreground",
    Backtested: "bg-blue-500/10 text-blue-500",
    Deployed: "bg-success/10 text-success",
    Paused: "bg-warning/10 text-warning",
    Stopped: "bg-destructive/10 text-destructive",
  };

  return (
    <Card className="group transition-colors hover:bg-secondary/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h3 className="truncate font-medium">{strategy.name}</h3>
              <Badge
                variant="secondary"
                className={
                  statusColors[strategy.status] ||
                  "bg-muted text-muted-foreground"
                }
              >
                {strategy.status}
              </Badge>
            </div>
            {strategy.performanceSummary && (
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Return:{" "}
                  <span
                    className={
                      (strategy.performanceSummary.totalReturn || 0) >= 0
                        ? "text-success"
                        : "text-destructive"
                    }
                  >
                    {(strategy.performanceSummary.totalReturn || 0) >= 0
                      ? "+"
                      : ""}
                    {(strategy.performanceSummary.totalReturn || 0).toFixed(1)}%
                  </span>
                </span>
                {strategy.performanceSummary.sharpeRatio !== undefined && (
                  <span className="text-muted-foreground">
                    Sharpe: {strategy.performanceSummary.sharpeRatio.toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
          <Link href={`/strategies/${strategy.id}`}>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100"
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

  const typeColors: Record<string, string> = {
    signal: "text-primary",
    sentiment: "text-blue-400",
    news: "text-muted-foreground",
    risk: "text-warning",
    suggestion: "text-success",
  };

  const Icon = typeIcons[event.type] || Brain;

  return (
    <div className="flex gap-3 py-3">
      <div
        className={cn(
          "mt-0.5",
          typeColors[event.type] || "text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{event.title || event.headline}</p>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {event.description || event.explanation}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {new Date(event.createdAt || event.time).toLocaleString()}
          </span>
          {event.symbol && (
            <Badge variant="outline" className="text-xs">
              {event.symbol}
            </Badge>
          )}
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Overview of your trading performance
          </p>
        </div>
        <Link href="/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Strategy
          </Button>
        </Link>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {portfolioLoading && !portfolio ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Total Equity"
              value={
                portfolio?.totalEquity
                  ? `$${portfolio.totalEquity.toLocaleString()}`
                  : "Unavailable"
              }
              change={portfolio?.dailyPlPct}
              changeLabel="today"
              icon={TrendingUp}
            />
            <MetricCard
              title="Day P&L"
              value={
                portfolio?.dailyPl
                  ? `$${portfolio.dailyPl.toLocaleString()}`
                  : "Unavailable"
              }
              change={portfolio?.dailyPlPct}
              icon={Activity}
            />
            <MetricCard
              title="Active Strategies"
              value={activeStrategies.length.toString()}
              icon={Zap}
            />
            <MetricCard
              title="Buying Power"
              value={
                portfolio?.buyingPower
                  ? `$${portfolio.buyingPower.toLocaleString()}`
                  : "Unavailable"
              }
              icon={AlertTriangle}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Strategies</CardTitle>
              <Link href="/strategies">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {strategiesLoading && strategies.length === 0 ? (
                <>
                  <StrategyCardSkeleton />
                  <StrategyCardSkeleton />
                  <StrategyCardSkeleton />
                </>
              ) : strategiesError ? (
                <div className="py-8 text-center">
                  <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
                  <p className="mt-2 text-sm text-muted-foreground">
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
                  <p className="text-muted-foreground">No strategies yet</p>
                  <Link href="/create">
                    <Button variant="outline" className="mt-4">
                      Create your first strategy
                    </Button>
                  </Link>
                </div>
              ) : (
                strategies
                  .slice(0, 5)
                  .map((strategy) => (
                    <StrategyCard key={strategy.id} strategy={strategy} />
                  ))
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">AI Activity</CardTitle>
              <Link href="/ai">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {eventsLoading && events.length === 0 ? (
                <div className="divide-y divide-border">
                  <AiEventCardSkeleton />
                  <AiEventCardSkeleton />
                  <AiEventCardSkeleton />
                </div>
              ) : eventsError ? (
                <div className="py-8 text-center">
                  <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
                  <p className="mt-2 text-sm text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground">
                    No recent AI activity
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {events.slice(0, 5).map((event) => (
                    <AiEventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
