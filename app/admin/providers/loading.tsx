import {
  HeaderSkeleton,
  MetricCardSkeleton,
  TableSkeleton,
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* Provider metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Providers table */}
      <TableSkeleton rows={8} />
    </div>
  );
}
