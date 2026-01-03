import {
  HeaderSkeleton,
  MetricCardSkeleton,
  TableSkeleton,
  TabsSkeleton,
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* Universe metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Tabs (All, Active, Watchlist) */}
      <TabsSkeleton tabs={3} />

      {/* Symbols table */}
      <TableSkeleton rows={20} />
    </div>
  );
}
