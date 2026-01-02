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

      {/* System health metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Tabs (Metrics, Logs, Traces, Alerts) */}
      <TabsSkeleton tabs={4} />

      {/* Performance chart */}
      <ChartSkeleton />

      {/* Logs/events table */}
      <TableSkeleton rows={15} />
    </div>
  );
}
