import {
  HeaderSkeleton,
  MetricCardSkeleton,
  TableSkeleton,
  ChartSkeleton
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* AI model metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Performance comparison chart */}
      <ChartSkeleton />

      {/* Model leaderboard table */}
      <TableSkeleton rows={10} />
    </div>
  );
}
