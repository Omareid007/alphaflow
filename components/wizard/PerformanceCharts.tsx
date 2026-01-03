"use client";

import { BacktestMetrics, BacktestChartSeries } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";

interface PerformanceChartsProps {
  chartSeries: BacktestChartSeries;
  metrics: BacktestMetrics;
}

// Named export for direct use
export function PerformanceCharts({
  chartSeries,
  metrics,
}: PerformanceChartsProps) {
  return (
    <Tabs defaultValue="equity">
      <TabsList>
        <TabsTrigger value="equity">Equity Curve</TabsTrigger>
        <TabsTrigger value="drawdown">Drawdown</TabsTrigger>
        <TabsTrigger value="returns">Returns</TabsTrigger>
      </TabsList>

      <TabsContent value="equity" className="mt-4">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartSeries.equityCurve}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) =>
                  new Date(d).toLocaleDateString("en-US", { month: "short" })
                }
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                domain={["dataMin - 5000", "dataMax + 5000"]}
              />
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
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#equityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      <TabsContent value="drawdown" className="mt-4">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartSeries.drawdown}>
              <defs>
                <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--destructive))"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--destructive))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) =>
                  new Date(d).toLocaleDateString("en-US", { month: "short" })
                }
              />
              <YAxis
                tickFormatter={(v) => `${v}%`}
                domain={["dataMin - 5", 0]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                      <p className="text-sm text-muted-foreground">
                        {new Date(payload[0].payload.date).toLocaleDateString()}
                      </p>
                      <p className="text-lg font-semibold text-destructive">
                        {Number(payload[0].value).toFixed(2)}%
                      </p>
                    </div>
                  );
                }}
              />
              <ReferenceLine
                y={-metrics.maxDrawdown}
                stroke="hsl(var(--destructive))"
                strokeDasharray="5 5"
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                fill="url(#ddGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      <TabsContent value="returns" className="mt-4">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartSeries.returns.filter((_, i) => i % 5 === 0)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) =>
                  new Date(d).toLocaleDateString("en-US", { month: "short" })
                }
              />
              <YAxis tickFormatter={(v) => `${v}%`} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const value = Number(payload[0].value);
                  return (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                      <p className="text-sm text-muted-foreground">
                        {new Date(payload[0].payload.date).toLocaleDateString()}
                      </p>
                      <p
                        className={cn(
                          "text-lg font-semibold",
                          value >= 0 ? "text-success" : "text-destructive"
                        )}
                      >
                        {value >= 0 ? "+" : ""}
                        {value.toFixed(2)}%
                      </p>
                    </div>
                  );
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar
                dataKey="value"
                fill="hsl(var(--primary))"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// Default export for dynamic imports
export default PerformanceCharts;
