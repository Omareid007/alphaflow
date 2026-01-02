import {
  MetricCardSkeleton,
  ChartSkeleton,
  TableSkeleton
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* System metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* System activity chart */}
      <ChartSkeleton />

      {/* Recent activity table */}
      <TableSkeleton rows={10} />
    </div>
  );
}
