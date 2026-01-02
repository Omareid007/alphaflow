"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton placeholder for pie chart component
 * Displays a circular skeleton to match the pie chart shape
 */
export function ChartSkeleton() {
  return (
    <div className="h-72 flex items-center justify-center">
      <div className="w-full h-full flex flex-col items-center justify-center gap-4">
        <Skeleton className="h-40 w-40 rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton placeholder for bar chart component
 * Displays horizontal bars to match the bar chart layout
 */
export function BarChartSkeleton() {
  return (
    <div className="h-72 flex items-center justify-center">
      <div className="w-full h-full flex flex-col justify-center gap-3 px-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-6 flex-1 max-w-[60%]" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-6 flex-1 max-w-[45%]" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-6 flex-1 max-w-[75%]" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-6 flex-1 max-w-[30%]" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-6 flex-1 max-w-[55%]" />
        </div>
      </div>
    </div>
  );
}
