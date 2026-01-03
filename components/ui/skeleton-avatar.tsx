"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

export interface SkeletonAvatarProps {
  /** Size of the avatar skeleton */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  /** Custom size in pixels (overrides size prop) */
  customSize?: number;
  /** Show shimmer animation */
  animate?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Show status indicator placeholder */
  showStatus?: boolean;
  /** Status indicator position */
  statusPosition?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
}

const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
  "2xl": 80,
};

const statusSizeMap = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  "2xl": 16,
};

const statusPositionMap = {
  "top-right": "-top-0.5 -right-0.5",
  "bottom-right": "-bottom-0.5 -right-0.5",
  "top-left": "-top-0.5 -left-0.5",
  "bottom-left": "-bottom-0.5 -left-0.5",
};

/**
 * SkeletonAvatar Component
 *
 * Avatar-shaped skeleton loading placeholder with optional shimmer animation.
 * Supports various sizes and optional status indicator placeholder.
 * Respects user's prefers-reduced-motion preference.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SkeletonAvatar />
 *
 * // With size
 * <SkeletonAvatar size="lg" />
 *
 * // With status indicator
 * <SkeletonAvatar size="md" showStatus statusPosition="bottom-right" />
 *
 * // Custom size
 * <SkeletonAvatar customSize={56} />
 * ```
 */
export function SkeletonAvatar({
  size = "md",
  customSize,
  animate = true,
  className,
  showStatus = false,
  statusPosition = "bottom-right",
}: SkeletonAvatarProps) {
  const prefersReducedMotion = useReducedMotion();
  const pixelSize = customSize ?? sizeMap[size];
  const statusSize = statusSizeMap[size];
  const shouldAnimate = animate && !prefersReducedMotion;

  return (
    <div className={cn("relative inline-flex", className)}>
      {/* Main avatar skeleton */}
      <div
        className="relative overflow-hidden rounded-full bg-muted"
        style={{
          width: pixelSize,
          height: pixelSize,
        }}
      >
        {shouldAnimate && (
          <motion.div
            className="absolute inset-0 -translate-x-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, hsl(var(--muted-foreground) / 0.1), transparent)",
            }}
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}
        {!shouldAnimate && prefersReducedMotion && (
          <div className="absolute inset-0 animate-pulse bg-muted-foreground/5" />
        )}
      </div>

      {/* Status indicator placeholder */}
      {showStatus && (
        <div
          className={cn(
            "absolute rounded-full bg-muted border-2 border-background",
            statusPositionMap[statusPosition]
          )}
          style={{
            width: statusSize,
            height: statusSize,
          }}
        >
          {shouldAnimate && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, hsl(var(--muted-foreground) / 0.15), transparent)",
              }}
              animate={{
                x: ["-100%", "100%"],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "linear",
                delay: 0.2,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * SkeletonAvatarGroup Component
 *
 * Displays a group of overlapping skeleton avatars (like team member avatars).
 *
 * @example
 * ```tsx
 * <SkeletonAvatarGroup count={4} size="sm" />
 * ```
 */
export interface SkeletonAvatarGroupProps {
  /** Number of avatars to show */
  count?: number;
  /** Size of each avatar */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Maximum avatars to show before +N indicator */
  max?: number;
  /** Additional CSS classes */
  className?: string;
}

export function SkeletonAvatarGroup({
  count = 3,
  size = "sm",
  max = 4,
  className,
}: SkeletonAvatarGroupProps) {
  const prefersReducedMotion = useReducedMotion();
  const displayCount = Math.min(count, max);
  const remaining = count - displayCount;
  const pixelSize = sizeMap[size];
  const overlap = pixelSize * 0.3;

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex -space-x-2">
        {Array.from({ length: displayCount }).map((_, index) => (
          <motion.div
            key={index}
            initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: prefersReducedMotion ? 0 : index * 0.05,
              duration: 0.2,
            }}
            style={{
              marginLeft: index > 0 ? -overlap : 0,
              zIndex: displayCount - index,
            }}
          >
            <SkeletonAvatar
              size={size}
              className="ring-2 ring-background"
            />
          </motion.div>
        ))}
      </div>

      {/* Remaining count placeholder */}
      {remaining > 0 && (
        <div
          className="relative overflow-hidden rounded-full bg-muted flex items-center justify-center ring-2 ring-background"
          style={{
            width: pixelSize,
            height: pixelSize,
            marginLeft: -overlap,
          }}
        >
          <div
            className="w-1/2 h-2 bg-muted-foreground/20 rounded"
          />
        </div>
      )}
    </div>
  );
}

export default SkeletonAvatar;
