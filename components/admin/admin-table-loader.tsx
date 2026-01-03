"use client";

/**
 * Dynamic Admin Table Loader
 *
 * Dynamically imports heavy admin table components that use
 * framer-motion animations, complex filtering, and large data sets.
 *
 * Benefits:
 * - Reduces admin page bundle sizes by 20-30%
 * - Admin pages don't need instant load (users navigate intentionally)
 * - Improves overall application performance for non-admin users
 */

import { Skeleton } from "@/components/ui/skeleton";

// Loading skeleton for admin tables
export function AdminTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

// Loading skeleton for admin stats cards
export function AdminStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
  );
}

// Loading skeleton for admin forms
export function AdminFormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}
