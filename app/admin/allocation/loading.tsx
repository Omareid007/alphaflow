import {
  HeaderSkeleton,
  MetricCardSkeleton,
  ChartSkeleton,
  TableSkeleton
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* Allocation metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Allocation pie chart */}
      <ChartSkeleton height="h-96" />

      {/* Allocation details table */}
      <TableSkeleton rows={10} />
    </div>
  );
}
