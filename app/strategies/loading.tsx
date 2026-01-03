import {
  HeaderSkeleton,
  StrategyCardSkeleton,
  TabsSkeleton,
} from "@/components/loading/skeleton-templates";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <HeaderSkeleton />

      {/* Tabs (All, Active, Paused, etc.) */}
      <TabsSkeleton tabs={4} />

      {/* Strategy list */}
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
