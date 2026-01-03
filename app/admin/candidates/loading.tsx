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

      {/* Candidate metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Tabs (All, Pending, Approved, Rejected) */}
      <TabsSkeleton tabs={4} />

      {/* Candidates table */}
      <TableSkeleton rows={12} />
    </div>
  );
}
