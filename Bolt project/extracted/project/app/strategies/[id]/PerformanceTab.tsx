import Link from "next/link";
import { BacktestRun } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

interface PerformanceTabProps {
  backtest: BacktestRun | null | undefined;
  strategyId: string;
}

export function PerformanceTab({ backtest, strategyId }: PerformanceTabProps) {
  if (!backtest) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No backtest data available</p>
          <Link href={`/strategies/${strategyId}/edit`}>
            <Button className="mt-4">Run Backtest</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Show loading state while backtest is running
  if (backtest.status === "running" || backtest.status === "pending") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">
            Backtest {backtest.status}...
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show error state if backtest failed
  if (backtest.status === "failed") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive">Backtest failed</p>
          <Link href={`/strategies/${strategyId}/edit`}>
            <Button className="mt-4" variant="outline">Try Again</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Show results if backtest completed
  if (!backtest.results?.equityCurve) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No equity curve data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Equity Curve</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={backtest.results.equityCurve}>
              <defs>
                <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={d => new Date(d).toLocaleDateString("en-US", { month: "short" })}
              />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                      <p className="text-sm text-muted-foreground">
                        {new Date(payload[0].payload.date).toLocaleDateString()}
                      </p>
                      <p className="text-lg font-semibold">
                        ${payload[0].value?.toLocaleString()}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#eqGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
