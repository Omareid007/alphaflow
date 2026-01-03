import {
  HeaderSkeleton,
  MetricCardSkeleton,
  ChartSkeleton,
  TableSkeleton,
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* Competition metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Leaderboard chart */}
      <ChartSkeleton />

      {/* Participants table */}
      <TableSkeleton rows={15} />
    </div>
  );
}
