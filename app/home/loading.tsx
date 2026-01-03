import {
  MetricCardSkeleton,
  StrategyCardSkeleton,
  ChartSkeleton,
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Metrics row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Performance chart */}
      <ChartSkeleton />

      {/* Active strategies section */}
      <div className="space-y-4">
        <StrategyCardSkeleton />
        <StrategyCardSkeleton />
        <StrategyCardSkeleton />
      </div>
    </div>
  );
}
