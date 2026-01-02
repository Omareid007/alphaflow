import {
  HeaderSkeleton,
  MetricCardSkeleton,
  TableSkeleton,
  TabsSkeleton
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* Order metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Tabs (All, Pending, Filled, Cancelled) */}
      <TabsSkeleton tabs={4} />

      {/* Orders table */}
      <TableSkeleton rows={15} />
    </div>
  );
}
