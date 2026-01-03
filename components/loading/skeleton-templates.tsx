/**
 * Reusable skeleton components for loading states
 * Used across all pages to provide consistent loading UX
 */

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/**
 * Metric Card Skeleton
 * Used for dashboard metrics/KPIs
 */
export function MetricCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-3">
        {/* Title */}
        <Skeleton className="h-4 w-24" />
        {/* Value */}
        <Skeleton className="h-8 w-32" />
        {/* Subtitle/Change */}
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/**
 * Strategy Card Skeleton
 * Used for strategy lists
 */
export function StrategyCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Table Skeleton
 * Used for data tables
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border bg-card">
      {/* Table Header */}
      <div className="border-b p-4">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      {/* Table Rows */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Chart Skeleton
 * Used for performance charts
 */
export function ChartSkeleton({ height = "h-80" }: { height?: string }) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-4">
        {/* Chart Title */}
        <Skeleton className="h-5 w-48" />
        {/* Chart Area */}
        <Skeleton className={cn("w-full", height)} />
        {/* Legend */}
        <div className="flex gap-4 justify-center">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

/**
 * Form Skeleton
 * Used for forms and wizards
 */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-6">
        {/* Form Title */}
        <Skeleton className="h-6 w-64" />
        {/* Form Fields */}
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        {/* Submit Button */}
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

/**
 * List Item Skeleton
 * Used for simple list items
 */
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

/**
 * Header Skeleton
 * Used for page headers
 */
export function HeaderSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}

/**
 * Tabs Skeleton
 * Used for tabbed interfaces
 */
export function TabsSkeleton({ tabs = 3 }: { tabs?: number }) {
  return (
    <div className="space-y-4">
      {/* Tab Headers */}
      <div className="flex gap-2 border-b">
        {Array.from({ length: tabs }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24" />
        ))}
      </div>
      {/* Tab Content */}
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
