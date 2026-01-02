import {
  HeaderSkeleton,
  MetricCardSkeleton,
  ChartSkeleton,
  TableSkeleton,
  TabsSkeleton
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* Rebalancer metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Tabs (Current, History, Schedule) */}
      <TabsSkeleton tabs={3} />

      {/* Target vs actual allocation chart */}
      <ChartSkeleton />

      {/* Rebalancing actions table */}
      <TableSkeleton rows={10} />
    </div>
  );
}
