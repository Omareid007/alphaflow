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

      {/* Data metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Data visualization */}
      <ChartSkeleton height="h-96" />

      {/* Fundamentals data table */}
      <TableSkeleton rows={15} />
    </div>
  );
}
