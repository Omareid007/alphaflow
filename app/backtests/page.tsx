"use client";

import { useState } from "react";
import Link from "next/link";
import { useBacktests, type BacktestRun, useStrategies } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { Eye, TrendingUp, TrendingDown, Calendar, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BacktestsPage() {
  const { data: backtestsData = [], isLoading: loading, error } = useBacktests();
  const { data: strategies = [] } = useStrategies();
  const [selectedBacktest, setSelectedBacktest] = useState<BacktestRun | null>(null);

  // Ensure backtests is always an array (defensive programming)
  const backtests = Array.isArray(backtestsData) ? backtestsData : [];

  // Helper to get strategy name from ID
  const getStrategyName = (strategyId: string) => {
    const strategy = strategies.find((s) => s.id === strategyId);
    return strategy?.name || "Unknown Strategy";
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Backtest Archive</h1>
          <p className="mt-1 text-muted-foreground">
            Review historical backtests and compare performance
          </p>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <p className="text-destructive font-medium">Failed to load backtests</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Backtest Archive</h1>
        <p className="mt-1 text-muted-foreground">
          Review historical backtests and compare performance
        </p>
      </div>

      {backtests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No backtests run yet</p>
            <Link href="/create">
              <Button className="mt-4">Create a strategy and run a backtest</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">CAGR</TableHead>
                  <TableHead className="text-right">Sharpe</TableHead>
                  <TableHead className="text-right">Max DD</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backtests.map(bt => {
                  const results = bt.results;
                  if (!results || bt.status !== 'completed') return null;

                  return (
                    <TableRow key={bt.id}>
                      <TableCell className="font-medium">{getStrategyName(bt.strategyId)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(bt.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={results.annualizedReturn >= 0 ? "text-success" : "text-destructive"}>
                          {results.annualizedReturn >= 0 ? "+" : ""}{results.annualizedReturn.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{results.sharpeRatio.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-warning">
                        -{results.maxDrawdown.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">{results.winRate.toFixed(0)}%</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedBacktest(bt)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedBacktest} onOpenChange={() => setSelectedBacktest(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedBacktest && getStrategyName(selectedBacktest.strategyId)} - Backtest Results</DialogTitle>
          </DialogHeader>
          {selectedBacktest && selectedBacktest.results && (
            <Tabs defaultValue="chart">
              <TabsList>
                <TabsTrigger value="chart">Performance</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
                {selectedBacktest.interpretation && (
                  <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="chart" className="mt-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedBacktest.results.equityCurve}>
                      <defs>
                        <linearGradient id="modalGradient" x1="0" y1="0" x2="0" y2="1">
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
                            <div className="rounded-lg border border-border bg-card p-2 shadow-lg">
                              <p className="font-medium">${payload[0].value?.toLocaleString()}</p>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="equity"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#modalGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="metrics" className="mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-secondary p-4">
                    <p className="text-sm text-muted-foreground">Annualized Return</p>
                    <p className="text-xl font-semibold">{selectedBacktest.results.annualizedReturn.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-4">
                    <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                    <p className="text-xl font-semibold">{selectedBacktest.results.sharpeRatio.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-4">
                    <p className="text-sm text-muted-foreground">Max Drawdown</p>
                    <p className="text-xl font-semibold">{selectedBacktest.results.maxDrawdown.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-4">
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                    <p className="text-xl font-semibold">{selectedBacktest.results.winRate.toFixed(0)}%</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-4">
                    <p className="text-sm text-muted-foreground">Total Trades</p>
                    <p className="text-xl font-semibold">{selectedBacktest.results.totalTrades}</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-4">
                    <p className="text-sm text-muted-foreground">Profit Factor</p>
                    <p className="text-xl font-semibold">{selectedBacktest.results.profitFactor.toFixed(2)}</p>
                  </div>
                </div>
              </TabsContent>

              {selectedBacktest.interpretation && (
                <TabsContent value="analysis" className="mt-4 space-y-4">
                  <p className="text-muted-foreground">{selectedBacktest.interpretation}</p>
                </TabsContent>
              )}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
