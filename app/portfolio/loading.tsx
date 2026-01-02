import {
  MetricCardSkeleton,
  ChartSkeleton,
  TableSkeleton,
  TabsSkeleton
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Portfolio metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Portfolio value chart */}
      <ChartSkeleton />

      {/* Tabs (Positions, Orders, History) */}
      <TabsSkeleton tabs={3} />

      {/* Positions table */}
      <TableSkeleton rows={8} />
    </div>
  );
}
