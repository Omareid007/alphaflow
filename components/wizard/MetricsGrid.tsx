"use client";

import { BacktestMetrics } from "@/lib/types";
import { MetricTile } from "./MetricTile";

interface MetricsGridProps {
  metrics: BacktestMetrics;
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
      <MetricTile
        label="CAGR"
        value={metrics.cagr}
        format="percent"
        good={metrics.cagr > 0}
      />
      <MetricTile label="Sharpe" value={metrics.sharpe} format="ratio" />
      <MetricTile
        label="Max Drawdown"
        value={metrics.maxDrawdown}
        format="percent"
        good={metrics.maxDrawdown < 20}
      />
      <MetricTile
        label="Volatility"
        value={metrics.volatility}
        format="percent"
      />
      <MetricTile label="Win Rate" value={metrics.winRate} format="percent" />
      <MetricTile label="Total Trades" value={metrics.totalTrades} />
    </div>
  );
}
