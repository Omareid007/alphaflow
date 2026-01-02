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

      {/* Enforcement metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Tabs (All, Violations, Warnings, Banned) */}
      <TabsSkeleton tabs={4} />

      {/* Enforcement actions table */}
      <TableSkeleton rows={12} />
    </div>
  );
}
