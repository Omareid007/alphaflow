/**
 * LiveBadge - Data Freshness Indicator
 *
 * @module components/ui/LiveBadge
 * @description Visual badge showing data freshness for real-time updates.
 * Automatically updates every second to reflect current staleness level.
 *
 * Freshness Levels:
 * - Live (green): Updated < 5 seconds ago
 * - Delayed (yellow): Updated 5-30 seconds ago
 * - Stale (red): Updated > 30 seconds ago
 * - Offline (gray): No update timestamp available
 *
 * Features:
 * - Auto-refreshing (recalculates freshness every second)
 * - Pulsing animation for "Live" status
 * - Color-coded for quick visual recognition
 * - Dark mode support
 * - Configurable thresholds
 * - Size variants (sm/md)
 *
 * @see openspec/changes/realtime-portfolio-streaming/design.md
 * @see hooks/useRealtimePositions.ts - Provides lastUpdate timestamps
 *
 * @example Per-position freshness
 * ```tsx
 * const { positionUpdateTimes } = useRealtimePositions();
 * const lastUpdate = positionUpdateTimes.get(position.symbol);
 *
 * <LiveBadge lastUpdate={lastUpdate} size="sm" />
 * ```
 *
 * @example Global portfolio freshness
 * ```tsx
 * const { lastUpdateTime } = useRealtimePositions();
 *
 * <LiveBadge lastUpdate={lastUpdateTime} showLabel size="md" />
 * ```
 */

"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Data freshness level
 */
export type FreshnessLevel = "live" | "delayed" | "stale" | "offline";

/**
 * LiveBadge component props
 */
export interface LiveBadgeProps {
  /**
   * Last update timestamp
   * null indicates no data received yet
   */
  lastUpdate: Date | null;

  /**
   * Threshold for "live" status in milliseconds
   * @default 5000 (5 seconds)
   */
  liveThreshold?: number;

  /**
   * Threshold for "delayed" status in milliseconds
   * @default 30000 (30 seconds)
   */
  delayedThreshold?: number;

  /**
   * Show text label (e.g., "Live", "Delayed")
   * @default true
   */
  showLabel?: boolean;

  /**
   * Size variant
   * @default "sm"
   */
  size?: "sm" | "md";

  /**
   * Additional CSS classes
   */
  className?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Visual configuration for each freshness level
 */
const FRESHNESS_CONFIG: Record<
  FreshnessLevel,
  {
    label: string;
    dotColor: string;
    bgColor: string;
  }
> = {
  live: {
    label: "Live",
    dotColor: "bg-green-500",
    bgColor:
      "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
  },
  delayed: {
    label: "Delayed",
    dotColor: "bg-yellow-500",
    bgColor:
      "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  },
  stale: {
    label: "Stale",
    dotColor: "bg-red-500",
    bgColor: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  },
  offline: {
    label: "Offline",
    dotColor: "bg-gray-400 dark:bg-gray-600",
    bgColor:
      "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30",
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * LiveBadge - Data freshness indicator with auto-refresh
 *
 * @param props - Component props
 */
export function LiveBadge({
  lastUpdate,
  liveThreshold = 5000,
  delayedThreshold = 30000,
  showLabel = true,
  size = "sm",
  className,
}: LiveBadgeProps) {
  const [freshness, setFreshness] = useState<FreshnessLevel>("offline");

  // ============================================================================
  // FRESHNESS CALCULATION
  // ============================================================================

  /**
   * Calculate current freshness level based on last update time
   */
  const calculateFreshness = (): FreshnessLevel => {
    if (!lastUpdate) return "offline";

    const age = Date.now() - lastUpdate.getTime();

    if (age < liveThreshold) return "live";
    if (age < delayedThreshold) return "delayed";
    return "stale";
  };

  /**
   * Auto-refresh freshness calculation every second
   */
  useEffect(() => {
    // Initial calculation
    setFreshness(calculateFreshness());

    // Update every second to transition from live → delayed → stale
    const interval = setInterval(() => {
      setFreshness(calculateFreshness());
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdate, liveThreshold, delayedThreshold]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // STYLING
  // ============================================================================

  const config = FRESHNESS_CONFIG[freshness];

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-1 gap-1.5",
  };

  const dotSizeClasses = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium uppercase tracking-wide",
        sizeClasses[size],
        config.bgColor,
        className
      )}
      role="status"
      aria-label={`Data status: ${config.label}`}
    >
      {/* Pulsing dot (only for live status) */}
      <span className="relative flex items-center justify-center">
        {freshness === "live" && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              config.dotColor
            )}
            aria-hidden="true"
          />
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full",
            dotSizeClasses[size],
            config.dotColor
          )}
          aria-hidden="true"
        />
      </span>

      {/* Label text */}
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export default LiveBadge;
