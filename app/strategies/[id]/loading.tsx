import {
  HeaderSkeleton,
  MetricCardSkeleton,
  ChartSkeleton,
  TableSkeleton,
  TabsSkeleton,
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Strategy header */}
      <HeaderSkeleton />

      {/* Performance metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Tabs (Overview, Positions, Orders, Config) */}
      <TabsSkeleton tabs={4} />

      {/* Performance chart */}
      <ChartSkeleton />

      {/* Positions/Orders table */}
      <TableSkeleton rows={10} />
    </div>
  );
}
