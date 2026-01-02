import {
  HeaderSkeleton,
  TableSkeleton,
  ChartSkeleton
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* Backtest results chart */}
      <ChartSkeleton />

      {/* Backtest runs table */}
      <TableSkeleton rows={10} />
    </div>
  );
}
