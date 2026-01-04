/**
 * StalenessWarning - Data Staleness Warning Component
 *
 * @module components/ui/StalenessWarning
 * @description Warning banner or inline indicator when portfolio data becomes stale.
 * Auto-hides when fresh data arrives. Provides refresh button for manual updates.
 *
 * Features:
 * - Banner variant for page-level warnings
 * - Inline variant for per-position warnings
 * - Auto-updates age text every second
 * - Auto-hides when data becomes fresh
 * - Refresh button with loading state
 * - LastUpdatedTimestamp helper component
 * - Dark mode support
 *
 * @see openspec/changes/realtime-portfolio-streaming/design.md
 * @see hooks/useRealtimePositions.ts - Provides staleness detection
 *
 * @example Banner warning at page level
 * ```tsx
 * const { lastUpdateTime, hasStaleData } = useRealtimePositions();
 *
 * <StalenessWarning
 *   lastUpdate={lastUpdateTime}
 *   threshold={60000}
 *   onRefresh={() => refetch()}
 * />
 * ```
 *
 * @example Inline per-position warning
 * ```tsx
 * const { positionUpdateTimes } = useRealtimePositions();
 * const lastUpdate = positionUpdateTimes.get(position.symbol);
 *
 * <StalenessWarning
 *   lastUpdate={lastUpdate}
 *   variant="inline"
 *   threshold={30000}
 *   showRefreshButton={false}
 * />
 * ```
 */

"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

/**
 * StalenessWarning component props
 */
export interface StalenessWarningProps {
  /**
   * Last update timestamp
   * null indicates no data received yet
   */
  lastUpdate: Date | null;

  /**
   * Threshold to show warning in milliseconds
   * @default 60000 (1 minute)
   */
  threshold?: number;

  /**
   * Callback to refresh data manually
   */
  onRefresh?: () => void | Promise<void>;

  /**
   * Show refresh button
   * @default true
   */
  showRefreshButton?: boolean;

  /**
   * Custom warning message
   */
  message?: string;

  /**
   * Display variant
   * - banner: Full-width alert banner
   * - inline: Compact inline warning
   * @default "banner"
   */
  variant?: "banner" | "inline";

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * LastUpdatedTimestamp component props
 */
export interface LastUpdatedTimestampProps {
  /**
   * Last update timestamp
   */
  lastUpdate: Date | null;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show icon
   * @default true
   */
  showIcon?: boolean;
}

// ============================================================================
// STALENESS WARNING COMPONENT
// ============================================================================

/**
 * StalenessWarning - Warning when data becomes stale
 *
 * Shows a warning banner or inline indicator when data hasn't been updated
 * in the specified threshold time. Auto-hides when fresh data arrives.
 *
 * @param props - Component props
 */
export function StalenessWarning({
  lastUpdate,
  threshold = 60000,
  onRefresh,
  showRefreshButton = true,
  message,
  variant = "banner",
  className,
}: StalenessWarningProps) {
  const [isStale, setIsStale] = useState(false);
  const [ageText, setAgeText] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ============================================================================
  // STALENESS DETECTION
  // ============================================================================

  /**
   * Check staleness and update age text every second
   */
  useEffect(() => {
    const checkStaleness = () => {
      if (!lastUpdate) {
        setIsStale(true);
        setAgeText("never");
        return;
      }

      const age = Date.now() - lastUpdate.getTime();
      const isDataStale = age > threshold;
      setIsStale(isDataStale);

      // Format age text
      const seconds = Math.floor(age / 1000);
      if (seconds < 60) {
        setAgeText(`${seconds}s ago`);
      } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        setAgeText(`${minutes}m ago`);
      } else {
        const hours = Math.floor(seconds / 3600);
        const remainingMinutes = Math.floor((seconds % 3600) / 60);
        setAgeText(`${hours}h ${remainingMinutes}m ago`);
      }
    };

    // Initial check
    checkStaleness();

    // Update every second
    const interval = setInterval(checkStaleness, 1000);

    return () => clearInterval(interval);
  }, [lastUpdate, threshold]);

  // ============================================================================
  // REFRESH HANDLER
  // ============================================================================

  /**
   * Handle refresh button click
   */
  const handleRefresh = async () => {
    if (!onRefresh) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // Don't render if data is fresh
  if (!isStale) return null;

  const defaultMessage = lastUpdate
    ? `Portfolio data may be outdated. Last updated ${ageText}.`
    : "Unable to connect to real-time updates. Showing cached data.";

  // ============================================================================
  // INLINE VARIANT
  // ============================================================================

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        <span>Updated {ageText}</span>
        {showRefreshButton && onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="hover:text-yellow-700 dark:hover:text-yellow-300 transition-colors disabled:opacity-50"
            aria-label="Refresh data"
          >
            <RefreshCw
              className={cn("h-3 w-3", isRefreshing && "animate-spin")}
              aria-hidden="true"
            />
          </button>
        )}
      </span>
    );
  }

  // ============================================================================
  // BANNER VARIANT
  // ============================================================================

  return (
    <Alert
      variant="default"
      className={cn("border-yellow-500/50 bg-yellow-500/10", className)}
      role="alert"
      aria-live="assertive"
    >
      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      <AlertTitle className="text-yellow-700 dark:text-yellow-400">
        Data May Be Outdated
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-yellow-600 dark:text-yellow-400/90">
          {message || defaultMessage}
        </span>
        {showRefreshButton && onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="ml-auto shrink-0 border-yellow-500/50 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20"
          >
            <RefreshCw
              className={cn("h-3 w-3 mr-1.5", isRefreshing && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// ============================================================================
// LAST UPDATED TIMESTAMP COMPONENT
// ============================================================================

/**
 * LastUpdatedTimestamp - Compact timestamp display
 *
 * Shows "Last updated: Xs ago" with auto-refresh every second.
 *
 * @param props - Component props
 *
 * @example
 * ```tsx
 * const { lastUpdateTime } = useRealtimePositions();
 * <LastUpdatedTimestamp lastUpdate={lastUpdateTime} />
 * // Shows: 🕒 2m ago
 * ```
 */
export function LastUpdatedTimestamp({
  lastUpdate,
  className,
  showIcon = true,
}: LastUpdatedTimestampProps) {
  const [ageText, setAgeText] = useState("--");

  /**
   * Update age text every second
   */
  useEffect(() => {
    const updateAge = () => {
      if (!lastUpdate) {
        setAgeText("--");
        return;
      }

      const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);

      if (seconds < 5) {
        setAgeText("just now");
      } else if (seconds < 60) {
        setAgeText(`${seconds}s ago`);
      } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        setAgeText(`${minutes}m ago`);
      } else {
        const hours = Math.floor(seconds / 3600);
        const remainingMinutes = Math.floor((seconds % 3600) / 60);
        if (remainingMinutes > 0) {
          setAgeText(`${hours}h ${remainingMinutes}m ago`);
        } else {
          setAgeText(`${hours}h ago`);
        }
      }
    };

    // Initial update
    updateAge();

    // Refresh every second
    const interval = setInterval(updateAge, 1000);

    return () => clearInterval(interval);
  }, [lastUpdate]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={`Last updated: ${ageText}`}
    >
      {showIcon && <Clock className="h-3 w-3" aria-hidden="true" />}
      <span>{ageText}</span>
    </span>
  );
}

export default StalenessWarning;
