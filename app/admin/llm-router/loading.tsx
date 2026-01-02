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

      {/* LLM router metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Usage chart */}
      <ChartSkeleton />

      {/* Request routing table */}
      <TableSkeleton rows={12} />
    </div>
  );
}
