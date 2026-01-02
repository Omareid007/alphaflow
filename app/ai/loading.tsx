import {
  HeaderSkeleton,
  ListItemSkeleton,
  MetricCardSkeleton
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* AI analysis metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* AI insights list */}
      <div className="space-y-4">
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
      </div>
    </div>
  );
}
