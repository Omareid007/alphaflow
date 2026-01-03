import {
  HeaderSkeleton,
  ChartSkeleton,
  TableSkeleton,
  TabsSkeleton,
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* Tabs (Market Data, Fundamentals, Technicals) */}
      <TabsSkeleton tabs={3} />

      {/* Chart area */}
      <ChartSkeleton height="h-96" />

      {/* Data table */}
      <TableSkeleton rows={12} />
    </div>
  );
}
