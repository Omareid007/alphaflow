import { Strategy } from "@/lib/api/hooks";
import { Card, CardContent } from "@/components/ui/card";
import {
  AnimatedValue,
  AnimatedChange,
} from "@/components/charts/animated-value";
import { Sparkline } from "@/components/charts/sparkline";
import { TrendingUp, Activity, TrendingDown, Target } from "lucide-react";
import { StaggerList, StaggerItem } from "@/lib/animations/stagger";

interface PerformanceMetricsGridProps {
  performanceSummary: Strategy["performanceSummary"];
}

// Generate mock sparkline data based on metric type
function generateSparklineData(
  value: number,
  isPositive: boolean,
  points = 15
): number[] {
  const data: number[] = [];
  let current = isPositive ? value * 0.85 : value * 1.15;
  for (let i = 0; i < points; i++) {
    const trend = isPositive ? 0.02 : -0.02;
    const noise = (Math.random() - 0.5) * Math.abs(value) * 0.1;
    current = current * (1 + trend) + noise;
    data.push(Math.max(0, current));
  }
  // End at approximately the target value
  data[data.length - 1] = value;
  return data;
}

export function PerformanceMetricsGrid({
  performanceSummary,
}: PerformanceMetricsGridProps) {
  if (!performanceSummary) return null;

  const totalReturn = performanceSummary.totalReturn ?? 0;
  const sharpeRatio = performanceSummary.sharpeRatio ?? 0;
  const maxDrawdown = performanceSummary.maxDrawdown ?? 0;
  const winRate = performanceSummary.winRate ?? 0;

  const metrics = [
    {
      title: "Total Return",
      value: totalReturn,
      format: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
      isPositive: totalReturn >= 0,
      icon: TrendingUp,
      iconColor: totalReturn >= 0 ? "text-gain" : "text-loss",
      bgColor: totalReturn >= 0 ? "bg-gain/10" : "bg-loss/10",
    },
    {
      title: "Sharpe Ratio",
      value: sharpeRatio,
      format: (v: number) => v.toFixed(2),
      isPositive: sharpeRatio >= 1,
      icon: Activity,
      iconColor:
        sharpeRatio >= 1
          ? "text-gain"
          : sharpeRatio >= 0.5
            ? "text-warning"
            : "text-loss",
      bgColor:
        sharpeRatio >= 1
          ? "bg-gain/10"
          : sharpeRatio >= 0.5
            ? "bg-warning/10"
            : "bg-loss/10",
    },
    {
      title: "Max Drawdown",
      value: maxDrawdown,
      format: (v: number) => `-${v.toFixed(1)}%`,
      isPositive: maxDrawdown < 15,
      icon: TrendingDown,
      iconColor:
        maxDrawdown < 10
          ? "text-gain"
          : maxDrawdown < 20
            ? "text-warning"
            : "text-loss",
      bgColor:
        maxDrawdown < 10
          ? "bg-gain/10"
          : maxDrawdown < 20
            ? "bg-warning/10"
            : "bg-loss/10",
    },
    {
      title: "Win Rate",
      value: winRate,
      format: (v: number) => `${v.toFixed(0)}%`,
      isPositive: winRate >= 50,
      icon: Target,
      iconColor:
        winRate >= 55
          ? "text-gain"
          : winRate >= 45
            ? "text-warning"
            : "text-loss",
      bgColor:
        winRate >= 55
          ? "bg-gain/10"
          : winRate >= 45
            ? "bg-warning/10"
            : "bg-loss/10",
    },
  ];

  return (
    <StaggerList className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        const sparklineData = generateSparklineData(
          metric.value,
          metric.isPositive
        );

        return (
          <StaggerItem key={metric.title} index={index}>
            <Card variant="elevated" hover="lift" className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {metric.title}
                    </p>
                    <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">
                      <AnimatedValue
                        value={metric.value}
                        format={metric.format}
                        className={
                          metric.isPositive
                            ? "text-gain"
                            : metric.title === "Max Drawdown"
                              ? "text-warning"
                              : ""
                        }
                      />
                    </div>
                    {/* Show change indicator for return */}
                    {metric.title === "Total Return" && (
                      <div className="mt-1.5">
                        <AnimatedChange value={totalReturn} size="sm" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.bgColor}`}
                    >
                      <Icon className={`h-5 w-5 ${metric.iconColor}`} />
                    </div>
                    <Sparkline
                      data={sparklineData}
                      width={64}
                      height={24}
                      strokeWidth={1.5}
                      showArea={false}
                      color={
                        metric.isPositive
                          ? "gain"
                          : metric.title === "Max Drawdown"
                            ? "loss"
                            : "muted"
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        );
      })}
    </StaggerList>
  );
}
