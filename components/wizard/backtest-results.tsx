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
  onSave?: () => void;
}

// Transform API response to expected metrics format
function transformToMetrics(
  backtest: BacktestRun | ApiBacktestRun
): BacktestMetrics {
  // If already has metrics in expected format, use it
  if ("metrics" in backtest && backtest.metrics) {
    return backtest.metrics;
  }

  // Transform from API resultsSummary format or results format
  const apiBacktest = backtest as ApiBacktestRun;
  const summary = apiBacktest.resultsSummary || {};

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

// Generate AI interpretation based on metrics
function generateInterpretation(metrics: BacktestMetrics): Interpretation {
  const strengths: string[] = [];
  const risks: string[] = [];

  // Analyze Sharpe ratio
  if (metrics.sharpe > 1) {
    strengths.push(
      `Strong risk-adjusted returns with Sharpe ratio of ${metrics.sharpe.toFixed(2)}`
    );
  } else if (metrics.sharpe > 0.5) {
    strengths.push(
      `Decent risk-adjusted returns with Sharpe ratio of ${metrics.sharpe.toFixed(2)}`
    );
  } else {
    risks.push(
      `Low Sharpe ratio (${metrics.sharpe.toFixed(2)}) indicates inadequate risk compensation`
    );
  }

  // Analyze max drawdown
  if (Math.abs(metrics.maxDrawdown) < 10) {
    strengths.push(
      `Conservative drawdown of ${Math.abs(metrics.maxDrawdown).toFixed(1)}% shows good risk management`
    );
  } else if (Math.abs(metrics.maxDrawdown) < 20) {
    strengths.push(
      `Manageable maximum drawdown of ${Math.abs(metrics.maxDrawdown).toFixed(1)}%`
    );
  } else {
    risks.push(
      `Maximum drawdown of ${Math.abs(metrics.maxDrawdown).toFixed(1)}% indicates significant volatility`
    );
  }

  // Analyze win rate
  if (metrics.winRate > 55) {
    strengths.push(
      `Win rate of ${metrics.winRate.toFixed(1)}% shows consistent profitability`
    );
  } else if (metrics.winRate > 45) {
    risks.push(
      `Win rate of ${metrics.winRate.toFixed(1)}% is only slightly above break-even`
    );
  } else {
    risks.push(
      `Low win rate of ${metrics.winRate.toFixed(1)}% requires large average wins to be profitable`
    );
  }

  // Analyze profit factor
  if (metrics.profitFactor > 1.5) {
    strengths.push(
      `Excellent profit factor of ${metrics.profitFactor.toFixed(2)} shows strong profitability relative to losses`
    );
  } else if (metrics.profitFactor > 1) {
    strengths.push(
      `Profit factor of ${metrics.profitFactor.toFixed(2)} indicates profitable strategy`
    );
  } else {
    risks.push(
      `Profit factor below 1.0 indicates the strategy is not profitable`
    );
  }

  // Analyze trade count
  if (metrics.totalTrades < 5) {
    risks.push(
      `Only ${metrics.totalTrades} trades in backtest is insufficient for statistical significance`
    );
  } else if (metrics.totalTrades < 20) {
    risks.push(
      `Limited trade count (${metrics.totalTrades}) may not be statistically reliable`
    );
  } else {
    strengths.push(
      `${metrics.totalTrades} trades provide reasonable statistical sample size`
    );
  }

  // If no strengths, add a generic positive message
  if (strengths.length === 0) {
    strengths.push("Strategy completed backtest successfully");
  }

  return {
    summary: `Backtest analysis: Sharpe ${metrics.sharpe.toFixed(2)}, Max Drawdown ${Math.abs(metrics.maxDrawdown).toFixed(1)}%, Win Rate ${metrics.winRate.toFixed(1)}%`,
    strengths,
    risks,
    suggestedEdits: [],
  };
}

// Transform API response to expected chart series format
function transformToChartSeries(
  backtest: BacktestRun | ApiBacktestRun
): BacktestChartSeries {
  // If already has chartSeries in expected format, use it
  if ("chartSeries" in backtest && backtest.chartSeries) {
    return backtest.chartSeries;
  }

  // Transform from API results format (has equityCurve array)
  const apiBacktest = backtest as ApiBacktestRun;
  const results = (apiBacktest as any).results;

  if (results && results.equityCurve) {
    // Transform equityCurve from { date, equity } to { date, value }
    const equityCurve = results.equityCurve.map((point: any) => ({
      date: point.date || point.ts || new Date().toISOString(),
      value:
        typeof point.equity === "number"
          ? point.equity
          : parseFloat(point.equity) || 0,
    }));

    // Generate drawdown series from equity curve
    const drawdown = equityCurve.map((point: any, idx: number) => {
      const maxEquity = Math.max(
        ...equityCurve.slice(0, idx + 1).map((p: any) => p.value)
      );
      const dd =
        maxEquity > 0 ? ((point.value - maxEquity) / maxEquity) * 100 : 0;
      return {
        date: point.date,
        value: dd,
      };
    });

    // Generate returns series (daily returns)
    const returns = equityCurve.map((point: any, idx: number) => {
      if (idx === 0) {
        return {
          date: point.date,
          value: 0,
        };
      }
      const prevValue = equityCurve[idx - 1].value;
      const dailyReturn =
        prevValue > 0 ? ((point.value - prevValue) / prevValue) * 100 : 0;
      return {
        date: point.date,
        value: dailyReturn,
      };
    });

    return { equityCurve, drawdown, returns };
  }

  // Fallback to empty chart series
  return {
    equityCurve: [],
    drawdown: [],
    returns: [],
  };
}

export function BacktestResults({
  backtest,
  onApplySuggestions,
  onRunAgain,
  onDeploy,
  onSave,
}: BacktestResultsProps) {
  // Transform metrics from API format if needed
  const metrics = transformToMetrics(backtest);
  // Transform chart series - handles both API and internal formats
  const chartSeries = transformToChartSeries(backtest);

  // Get interpretation from backtest or generate one based on metrics
  let interpretation: Interpretation;
  if ("interpretation" in backtest && backtest.interpretation) {
    const raw = backtest.interpretation;
    // If it's a string, normalize it; otherwise use as-is
    interpretation =
      typeof raw === "string"
        ? { summary: raw, strengths: [], risks: [], suggestedEdits: [] }
        : raw;
  } else {
    // Generate interpretation from metrics if not provided
    interpretation = generateInterpretation(metrics);
  }

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
          <BacktestActions
            onRunAgain={onRunAgain}
            onDeploy={onDeploy}
            onSave={onSave}
          />
        </CardContent>
      </Card>
    </div>
  );
}
