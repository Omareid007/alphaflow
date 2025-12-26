"use client";

import { BacktestRun } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricsGrid } from "./MetricsGrid";
import { PerformanceCharts } from "./PerformanceCharts";
import { AIInterpretation } from "./AIInterpretation";
import { BacktestActions } from "./BacktestActions";

interface BacktestResultsProps {
  backtest: BacktestRun;
  onApplySuggestions: () => void;
  onRunAgain: () => void;
  onDeploy: (mode: "paper" | "live") => void;
}

export function BacktestResults({
  backtest,
  onApplySuggestions,
  onRunAgain,
  onDeploy
}: BacktestResultsProps) {
  const { metrics, chartSeries, interpretation } = backtest;

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
          />
        </CardContent>
      </Card>
    </div>
  );
}
