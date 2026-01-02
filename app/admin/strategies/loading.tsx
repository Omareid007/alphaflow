import {
  HeaderSkeleton,
  MetricCardSkeleton,
  StrategyCardSkeleton,
  TabsSkeleton
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* Strategy metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Tabs (All Users, Top Performing, Paused) */}
      <TabsSkeleton tabs={3} />

      {/* Strategies list */}
      <div className="space-y-4">
        <StrategyCardSkeleton />
        <StrategyCardSkeleton />
        <StrategyCardSkeleton />
        <StrategyCardSkeleton />
        <StrategyCardSkeleton />
      </div>
    </div>
  );
}
