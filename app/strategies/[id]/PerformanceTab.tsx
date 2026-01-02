"use client";

import { useState } from "react";
import Link from "next/link";
import { BacktestRun } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HeroChart } from "@/components/charts/hero-chart";
import { ChartShimmer } from "@/lib/animations/shimmer";
import { Maximize2, Minimize2, TrendingUp, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PerformanceTabProps {
  backtest: BacktestRun | null | undefined;
  strategyId: string;
}

export function PerformanceTab({ backtest, strategyId }: PerformanceTabProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!backtest) {
    return (
      <Card variant="glass">
        <CardContent className="py-16 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-medium text-muted-foreground mb-2">
            No backtest data available
          </p>
          <p className="text-sm text-muted-foreground/70 mb-6">
            Run a backtest to see your strategy performance
          </p>
          <Link href={`/strategies/${strategyId}/edit`}>
            <Button variant="gain" size="lg" className="rounded-xl">
              Run Backtest
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Show loading state while backtest is running
  if (backtest.status === "running" || backtest.status === "pending") {
    return (
      <Card variant="glass">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <p className="text-lg font-medium text-muted-foreground mb-2">
              Backtest {backtest.status}...
            </p>
            <p className="text-sm text-muted-foreground/70">
              This may take a few moments
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state if backtest failed
  if (backtest.status === "failed") {
    return (
      <Card variant="glass" className="border-destructive/20">
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <p className="text-lg font-medium text-destructive mb-2">
            Backtest failed
          </p>
          <p className="text-sm text-muted-foreground/70 mb-6">
            There was an error running your backtest
          </p>
          <Link href={`/strategies/${strategyId}/edit`}>
            <Button variant="outline" className="rounded-xl">
              Try Again
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Show results if backtest completed
  if (!backtest.results?.equityCurve) {
    return (
      <Card variant="glass">
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-muted-foreground mb-2">
            No equity curve data available
          </p>
          <p className="text-sm text-muted-foreground/70">
            The backtest completed but no chart data was generated
          </p>
        </CardContent>
      </Card>
    );
  }

  // Transform equity curve data for HeroChart
  const chartData = backtest.results.equityCurve.map((point) => ({
    time: new Date(point.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    value: point.equity,
  }));

  // Calculate performance trend
  const startValue = chartData[0]?.value || 0;
  const endValue = chartData[chartData.length - 1]?.value || 0;
  const isPositiveTrend = endValue >= startValue;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isExpanded ? "expanded" : "normal"}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        <Card variant="glass" className="overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  isPositiveTrend ? "bg-gain/10" : "bg-loss/10"
                }`}
              >
                <TrendingUp
                  className={`h-5 w-5 ${isPositiveTrend ? "text-gain" : "text-loss"}`}
                />
              </div>
              <div>
                <CardTitle className="text-lg">Equity Curve</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {chartData.length} data points
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="rounded-xl"
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <HeroChart
              data={chartData}
              height={isExpanded ? 400 : 280}
              showAxis={true}
              showGrid={true}
              showTooltip={true}
              showReferenceLine={true}
              referenceValue={startValue}
              className="px-0"
            />
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
