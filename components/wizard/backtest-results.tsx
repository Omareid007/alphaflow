"use client";

import {
  BacktestRun,
  BacktestMetrics,
  BacktestChartSeries,
  Interpretation,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import { MetricsGrid } from "./MetricsGrid";
import { AIInterpretation } from "./AIInterpretation";
import { BacktestActions } from "./BacktestActions";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically load heavy Recharts component to reduce bundle size
const PerformanceCharts = dynamic(() => import("./PerformanceCharts"), {
  ssr: false, // Wizard doesn't need SSR
  loading: () => (
    <div className="h-80">
      <Skeleton className="h-full w-full rounded-lg" />
    </div>
  ),
});

// API response shape (different from lib/types BacktestRun)
interface ApiBacktestRun {
  id: string;
  status: string;
  strategyId: string;
  resultsSummary?: {
    sharpeRatio?: number;
    maxDrawdownPct?: number;
    totalReturnPct?: number;
    winRatePct?: number;
    totalTrades?: number;
    profitFactor?: number;
    cagr?: number;
    avgWinPct?: number;
    avgLossPct?: number;
    sortinoRatio?: number;
  };
  // Also accept the lib/types format
  metrics?: BacktestMetrics;
  chartSeries?: BacktestChartSeries;
  interpretation?: Interpretation | string;
}

interface BacktestResultsProps {
  backtest: BacktestRun | ApiBacktestRun;
  onApplySuggestions: () => void;
  onRunAgain: () => void;
  onDeploy: (mode: "paper" | "live") => void;
}

// Transform API response to expected metrics format
function transformToMetrics(
  backtest: BacktestRun | ApiBacktestRun
): BacktestMetrics {
  // If already has metrics in expected format, use it
  if ("metrics" in backtest && backtest.metrics) {
    return backtest.metrics;
  }

  // Transform from API resultsSummary format
  const summary = (backtest as ApiBacktestRun).resultsSummary || {};
  return {
    sharpe: summary.sharpeRatio ?? 0,
    maxDrawdown: summary.maxDrawdownPct ?? 0,
    cagr: summary.cagr ?? 0,
    volatility: 0, // Not provided by API
    winRate: summary.winRatePct ?? 0,
    exposure: 0, // Not provided by API
    totalTrades: summary.totalTrades ?? 0,
    profitFactor: summary.profitFactor ?? 0,
    avgWin: summary.avgWinPct ?? 0,
    avgLoss: summary.avgLossPct ?? 0,
  };
}

export function BacktestResults({
  backtest,
  onApplySuggestions,
  onRunAgain,
  onDeploy,
}: BacktestResultsProps) {
  // Transform metrics from API format if needed
  const metrics = transformToMetrics(backtest);
  const chartSeries = ("chartSeries" in backtest
    ? backtest.chartSeries
    : undefined) || {
    equityCurve: [],
    drawdown: [],
    returns: [],
  };
  const interpretation = ("interpretation" in backtest
    ? backtest.interpretation
    : undefined) || {
    summary: "Backtest completed successfully.",
    strengths: [],
    risks: [],
    suggestedEdits: [],
  };

  const isGoodPerformance = metrics.sharpe > 1 && metrics.maxDrawdown < 20;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Backtest Results</CardTitle>
            <Badge
              variant={isGoodPerformance ? "default" : "secondary"}
              className={isGoodPerformance ? "bg-success" : ""}
            >
              {isGoodPerformance ? "Strong Performance" : "Review Recommended"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <MetricsGrid metrics={metrics} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance Charts</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceCharts chartSeries={chartSeries} metrics={metrics} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Interpretation</CardTitle>
        </CardHeader>
        <CardContent>
          <AIInterpretation
            interpretation={interpretation}
            onApplySuggestions={onApplySuggestions}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <BacktestActions onRunAgain={onRunAgain} onDeploy={onDeploy} />
        </CardContent>
      </Card>
    </div>
  );
}
