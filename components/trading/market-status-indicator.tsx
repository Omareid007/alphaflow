"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  useMarketStatus,
  formatTimeUntil,
} from "@/lib/api/hooks/useMarketStatus";

/**
 * Market session display configuration
 */
interface SessionConfig {
  label: string;
  dotColor: string;
  description: string;
}

const SESSION_CONFIG: Record<string, SessionConfig> = {
  regular: {
    label: "Open",
    dotColor: "bg-white",
    description: "Market is open",
  },
  "pre-market": {
    label: "Pre-Market",
    dotColor: "bg-yellow-400",
    description: "Pre-market trading",
  },
  "after-hours": {
    label: "After Hours",
    dotColor: "bg-yellow-400",
    description: "After-hours trading",
  },
  closed: {
    label: "Closed",
    dotColor: "bg-neutral-900 dark:bg-neutral-100",
    description: "Market is closed",
  },
};

export interface MarketStatusIndicatorProps {
  /** Show the time until next open/close */
  showTimeUntil?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode - only shows the dot */
  compact?: boolean;
}

/**
 * Robinhood-inspired market status indicator
 *
 * Displays a simple dot + text showing current market state:
 * - White dot: Market open (regular hours)
 * - Yellow dot: Pre-market or After-hours
 * - Black/White dot: Market closed
 *
 * @example
 * ```tsx
 * // Full display with time until next event
 * <MarketStatusIndicator showTimeUntil />
 *
 * // Compact mode (just the dot)
 * <MarketStatusIndicator compact />
 * ```
 */
export function MarketStatusIndicator({
  showTimeUntil = false,
  className,
  compact = false,
}: MarketStatusIndicatorProps) {
  const { data: status, isLoading, error } = useMarketStatus();

  const config = useMemo(() => {
    if (!status) return SESSION_CONFIG.closed;
    return SESSION_CONFIG[status.session] || SESSION_CONFIG.closed;
  }, [status]);

  const timeUntilText = useMemo(() => {
    if (!status || !showTimeUntil) return null;

    if (status.session === "regular") {
      // Market is open, show time until close
      return `Closes in ${formatTimeUntil(status.nextClose)}`;
    } else {
      // Market is closed/extended hours, show time until open
      return `Opens ${formatTimeUntil(status.nextOpen)}`;
    }
  }, [status, showTimeUntil]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-2 w-2 rounded-full bg-muted-foreground/30 animate-pulse" />
        {!compact && (
          <span className="text-xs text-muted-foreground">Loading...</span>
        )}
      </div>
    );
  }

  // Error state - show closed as fallback
  if (error || !status) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div
          className="h-2 w-2 rounded-full bg-neutral-900 dark:bg-neutral-100"
          title="Unable to fetch market status"
        />
        {!compact && (
          <span className="text-xs text-muted-foreground">Offline</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      title={config.description}
    >
      {/* Status Dot with pulse animation for open market */}
      <div className="relative flex items-center justify-center">
        <div
          className={cn(
            "h-2 w-2 rounded-full transition-colors duration-500",
            config.dotColor
          )}
        />
        {/* Pulse ring animation when market is open */}
        {status.session === "regular" && (
          <div
            className={cn(
              "absolute h-2 w-2 rounded-full animate-ping opacity-75",
              config.dotColor
            )}
          />
        )}
      </div>

      {/* Status Text */}
      {!compact && (
        <div className="flex flex-col">
          <span className="text-xs font-medium leading-none">
            {config.label}
          </span>
          {timeUntilText && (
            <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              {timeUntilText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Minimal market status dot without text
 *
 * Use this when you only need the visual indicator
 */
export function MarketStatusDot({ className }: { className?: string }) {
  return <MarketStatusIndicator compact className={className} />;
}
