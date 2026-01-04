/**
 * ConnectionStatus - Visual WebSocket Connection Indicator
 *
 * @module components/ui/ConnectionStatus
 * @description Displays real-time WebSocket connection status with visual indicator
 * and tooltip showing connection details. Designed for placement in app header/navbar.
 *
 * Features:
 * - Color-coded status indicator (green/yellow/red/gray)
 * - Pulse animation when connected (optional)
 * - Tooltip with connection details on hover
 * - Accessible (ARIA labels, keyboard navigation)
 * - Dark mode support
 * - Responsive sizing (sm/md/lg)
 * - Optional label text
 *
 * @see openspec/changes/realtime-portfolio-streaming/design.md
 * @see hooks/usePortfolioStream.ts - WebSocket connection hook
 *
 * @example In navigation header
 * ```tsx
 * <header className="flex items-center justify-between p-4">
 *   <Logo />
 *   <ConnectionStatus size="sm" />
 * </header>
 * ```
 *
 * @example With label text
 * ```tsx
 * <ConnectionStatus showLabel size="md" />
 * // Shows: ● Connected
 * ```
 */

"use client";

import * as React from "react";
import {
  usePortfolioStream,
  type ConnectionStatus as Status,
} from "@/hooks/usePortfolioStream";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================================
// STATUS CONFIGURATION
// ============================================================================

/**
 * Visual configuration for each connection status
 */
const STATUS_CONFIG: Record<
  Status,
  {
    color: string; // Dot color
    bgColor: string; // Background for larger sizes
    pulseColor: string; // Pulse animation color
    label: string; // Short label
    description: string; // Tooltip description
  }
> = {
  connected: {
    color: "bg-green-500",
    bgColor: "bg-green-500/20",
    pulseColor: "bg-green-400",
    label: "Connected",
    description: "Real-time updates active",
  },
  connecting: {
    color: "bg-yellow-500",
    bgColor: "bg-yellow-500/20",
    pulseColor: "bg-yellow-400",
    label: "Connecting",
    description: "Establishing connection...",
  },
  reconnecting: {
    color: "bg-yellow-500 animate-pulse",
    bgColor: "bg-yellow-500/20",
    pulseColor: "bg-yellow-400",
    label: "Reconnecting",
    description: "Connection lost, reconnecting...",
  },
  disconnected: {
    color: "bg-gray-400 dark:bg-gray-600",
    bgColor: "bg-gray-400/20",
    pulseColor: "bg-gray-300",
    label: "Offline",
    description: "Using cached data - real-time updates paused",
  },
  error: {
    color: "bg-red-500",
    bgColor: "bg-red-500/20",
    pulseColor: "bg-red-400",
    label: "Error",
    description: "Connection failed - using cached data",
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export interface ConnectionStatusProps {
  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show label text next to indicator
   * @default false
   */
  showLabel?: boolean;

  /**
   * Size variant
   * @default "sm"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Enable pulse animation when connected
   * @default true
   */
  enablePulse?: boolean;

  /**
   * Tooltip side
   * @default "bottom"
   */
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

export function ConnectionStatus({
  className,
  showLabel = false,
  size = "sm",
  enablePulse = true,
  tooltipSide = "bottom",
}: ConnectionStatusProps) {
  const { status, lastMessageTime, error } = usePortfolioStream({
    autoConnect: true,
  });

  const config = STATUS_CONFIG[status];

  // ============================================================================
  // SIZE CLASSES
  // ============================================================================

  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  };

  const labelSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Format time since last message for display
   */
  const formatLastUpdate = (): string => {
    if (!lastMessageTime) {
      return "No data received yet";
    }

    const seconds = Math.floor((Date.now() - lastMessageTime.getTime()) / 1000);

    if (seconds < 5) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m ago`;
  };

  /**
   * Get label text color based on status
   */
  const getLabelColor = (): string => {
    if (status === "connected") {
      return "text-green-600 dark:text-green-400";
    }
    if (status === "error") {
      return "text-red-600 dark:text-red-400";
    }
    if (status === "connecting" || status === "reconnecting") {
      return "text-yellow-600 dark:text-yellow-400";
    }
    return "text-muted-foreground";
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-2 cursor-default select-none",
              className
            )}
            role="status"
            aria-label={`Portfolio updates: ${config.label}`}
            aria-live="polite"
          >
            {/* Indicator dot with optional pulse */}
            <span className="relative flex items-center justify-center">
              {/* Pulse animation ring (only when connected and enabled) */}
              {enablePulse && status === "connected" && (
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                    config.pulseColor
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Solid status dot */}
              <span
                className={cn(
                  "relative inline-flex rounded-full",
                  sizeClasses[size],
                  config.color
                )}
                aria-hidden="true"
              />
            </span>

            {/* Optional label text */}
            {showLabel && (
              <span
                className={cn(
                  "font-medium",
                  labelSizeClasses[size],
                  getLabelColor()
                )}
              >
                {config.label}
              </span>
            )}
          </div>
        </TooltipTrigger>

        <TooltipContent side={tooltipSide} className="max-w-xs" sideOffset={8}>
          <div className="space-y-2">
            {/* Status header */}
            <div className="flex items-center gap-2">
              <span
                className={cn("inline-flex rounded-full h-2 w-2", config.color)}
                aria-hidden="true"
              />
              <span className="font-semibold">{config.label}</span>
            </div>

            {/* Status description */}
            <p className="text-xs text-muted-foreground">
              {config.description}
            </p>

            {/* Last update time (only when connected) */}
            {status === "connected" && lastMessageTime && (
              <div className="pt-1 border-t">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Last update:</span>{" "}
                  {formatLastUpdate()}
                </p>
              </div>
            )}

            {/* Error details (only when error state) */}
            {status === "error" && error && (
              <div className="pt-1 border-t">
                <p className="text-xs text-red-500 dark:text-red-400">
                  <span className="font-medium">Error:</span> {error.message}
                </p>
              </div>
            )}

            {/* Reconnecting progress */}
            {status === "reconnecting" && (
              <div className="pt-1 border-t">
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  Attempting to reconnect...
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ConnectionStatus;
