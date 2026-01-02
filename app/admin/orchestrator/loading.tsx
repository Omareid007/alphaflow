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

      {/* Orchestrator metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Execution timeline chart */}
      <ChartSkeleton />

      {/* Active jobs table */}
      <TableSkeleton rows={12} />
    </div>
  );
}
