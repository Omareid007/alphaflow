import { Strategy } from "@/lib/api/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PerformanceMetricsGridProps {
  performanceSummary: Strategy["performanceSummary"];
}

export function PerformanceMetricsGrid({
  performanceSummary,
}: PerformanceMetricsGridProps) {
  if (!performanceSummary) return null;

  const totalReturn = performanceSummary.totalReturn ?? 0;
  const sharpeRatio = performanceSummary.sharpeRatio ?? 0;
  const maxDrawdown = performanceSummary.maxDrawdown ?? 0;
  const winRate = performanceSummary.winRate ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Total Return</p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold",
              totalReturn >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {totalReturn >= 0 ? "+" : ""}
            {totalReturn.toFixed(1)}%
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
          <p className="mt-1 text-2xl font-semibold">
            {sharpeRatio.toFixed(2)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Max Drawdown</p>
          <p className="mt-1 text-2xl font-semibold text-warning">
            -{maxDrawdown.toFixed(1)}%
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Win Rate</p>
          <p className="mt-1 text-2xl font-semibold">{winRate.toFixed(0)}%</p>
        </CardContent>
      </Card>
    </div>
  );
}
