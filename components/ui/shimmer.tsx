"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

/**
 * Shimmer speed presets
 */
export type ShimmerSpeed = "slow" | "normal" | "fast";

const speedDurations: Record<ShimmerSpeed, number> = {
  slow: 2.5,
  normal: 1.5,
  fast: 0.8,
};

export interface ShimmerProps {
  /** CSS class name */
  className?: string;
  /** Width - can be a number (pixels) or string (e.g., "100%", "12rem") */
  width?: string | number;
  /** Height - can be a number (pixels) or string */
  height?: string | number;
  /** Border radius preset */
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  /** Animation speed */
  speed?: ShimmerSpeed;
  /** Enable animation (default: true) */
  animate?: boolean;
  /** Custom shimmer color (defaults to muted-foreground) */
  shimmerColor?: string;
  /** Base background color (defaults to muted) */
  baseColor?: string;
}

const roundedClasses = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

/**
 * Shimmer Component
 *
 * Skeleton loading placeholder with animated shimmer effect.
 * Uses Framer Motion for smooth animations.
 * Automatically respects user's prefers-reduced-motion setting.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Shimmer width={200} height={20} />
 *
 * // Full width with rounded corners
 * <Shimmer width="100%" height={40} rounded="lg" />
 *
 * // Custom speed
 * <Shimmer width={120} height={16} speed="fast" />
 * ```
 */
export function Shimmer({
  className,
  width,
  height,
  rounded = "md",
  speed = "normal",
  animate = true,
  shimmerColor,
  baseColor,
}: ShimmerProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animate && !prefersReducedMotion;
  const duration = speedDurations[speed];

  const style: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    backgroundColor: baseColor,
  };

  const shimmerGradient = shimmerColor
    ? `linear-gradient(90deg, transparent, ${shimmerColor}, transparent)`
    : "linear-gradient(90deg, transparent, hsl(var(--muted-foreground) / 0.1), transparent)";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted/50",
        roundedClasses[rounded],
        className
      )}
      style={style}
    >
      {shouldAnimate ? (
        <motion.div
          className="absolute inset-0"
          style={{ background: shimmerGradient }}
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{
            duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-muted-foreground/5" />
      )}
    </div>
  );
}

/**
 * ShimmerText Component
 *
 * Shimmer skeleton for text content with multiple lines.
 *
 * @example
 * ```tsx
 * <ShimmerText lines={3} />
 * <ShimmerText lines={2} lastLineWidth="60%" />
 * ```
 */
export interface ShimmerTextProps {
  /** Number of text lines to show */
  lines?: number;
  /** CSS class name */
  className?: string;
  /** Width of the last line */
  lastLineWidth?: string;
  /** Line height in pixels */
  lineHeight?: number;
  /** Gap between lines in pixels */
  gap?: number;
  /** Animation speed */
  speed?: ShimmerSpeed;
}

export function ShimmerText({
  lines = 3,
  className,
  lastLineWidth = "60%",
  lineHeight = 16,
  gap = 8,
  speed = "normal",
}: ShimmerTextProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={cn("flex flex-col", className)} style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer
          key={i}
          height={lineHeight}
          width={i === lines - 1 ? lastLineWidth : "100%"}
          rounded="sm"
          speed={speed}
          animate={!prefersReducedMotion}
        />
      ))}
    </div>
  );
}

/**
 * ShimmerCard Component
 *
 * Complete card skeleton with image, title, and text.
 *
 * @example
 * ```tsx
 * <ShimmerCard />
 * <ShimmerCard showImage={false} lines={3} />
 * ```
 */
export interface ShimmerCardProps {
  /** CSS class name */
  className?: string;
  /** Show image placeholder */
  showImage?: boolean;
  /** Image height */
  imageHeight?: number;
  /** Number of text lines */
  lines?: number;
  /** Animation speed */
  speed?: ShimmerSpeed;
}

export function ShimmerCard({
  className,
  showImage = true,
  imageHeight = 120,
  lines = 2,
  speed = "normal",
}: ShimmerCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 space-y-4", className)}>
      {showImage && (
        <Shimmer height={imageHeight} width="100%" rounded="lg" speed={speed} />
      )}
      <div className="space-y-3">
        <Shimmer height={20} width="70%" rounded="sm" speed={speed} />
        <ShimmerText lines={lines} speed={speed} />
      </div>
    </div>
  );
}

/**
 * ShimmerMetric Component
 *
 * Skeleton for metric/stat cards with label, value, and change.
 *
 * @example
 * ```tsx
 * <ShimmerMetric />
 * <ShimmerMetric showChange={false} />
 * ```
 */
export interface ShimmerMetricProps {
  className?: string;
  showChange?: boolean;
  speed?: ShimmerSpeed;
}

export function ShimmerMetric({
  className,
  showChange = true,
  speed = "normal",
}: ShimmerMetricProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-6", className)}>
      <Shimmer
        height={14}
        width="40%"
        rounded="sm"
        speed={speed}
        className="mb-3"
      />
      <Shimmer
        height={32}
        width="60%"
        rounded="md"
        speed={speed}
        className="mb-2"
      />
      {showChange && (
        <Shimmer height={16} width="30%" rounded="sm" speed={speed} />
      )}
    </div>
  );
}

/**
 * ShimmerTable Component
 *
 * Skeleton for table rows with header.
 *
 * @example
 * ```tsx
 * <ShimmerTable />
 * <ShimmerTable columns={4} rows={10} />
 * ```
 */
export interface ShimmerTableProps {
  className?: string;
  columns?: number;
  rows?: number;
  showHeader?: boolean;
  speed?: ShimmerSpeed;
}

export function ShimmerTable({
  className,
  columns = 5,
  rows = 5,
  showHeader = true,
  speed = "normal",
}: ShimmerTableProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex gap-4 pb-2 border-b">
          {Array.from({ length: columns }).map((_, i) => (
            <Shimmer
              key={`header-${i}`}
              height={16}
              width={i === 0 ? "30%" : "15%"}
              rounded="sm"
              speed={speed}
            />
          ))}
        </div>
      )}
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={`row-${rowIdx}`} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Shimmer
              key={`cell-${rowIdx}-${colIdx}`}
              height={20}
              width={colIdx === 0 ? "30%" : "15%"}
              rounded="sm"
              speed={speed}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * ShimmerChart Component
 *
 * Skeleton for chart areas with animated wave pattern.
 *
 * @example
 * ```tsx
 * <ShimmerChart />
 * <ShimmerChart height={400} />
 * ```
 */
export interface ShimmerChartProps {
  className?: string;
  height?: number;
  showHeader?: boolean;
  speed?: ShimmerSpeed;
}

export function ShimmerChart({
  className,
  height = 300,
  showHeader = true,
  speed = "normal",
}: ShimmerChartProps) {
  const prefersReducedMotion = useReducedMotion();
  const duration = speedDurations[speed];

  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      {showHeader && (
        <div className="flex justify-between mb-4">
          <Shimmer height={24} width="30%" rounded="sm" speed={speed} />
          <Shimmer height={24} width="20%" rounded="sm" speed={speed} />
        </div>
      )}
      <div className="relative overflow-hidden rounded-lg" style={{ height }}>
        <svg
          className="w-full h-full"
          viewBox="0 0 400 200"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient
              id="chartShimmerGradient"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop
                offset="0%"
                stopColor="hsl(var(--muted))"
                stopOpacity="0.3"
              />
              <stop
                offset="50%"
                stopColor="hsl(var(--muted))"
                stopOpacity="0.5"
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--muted))"
                stopOpacity="0.3"
              />
            </linearGradient>
          </defs>
          {prefersReducedMotion ? (
            <path
              d="M0,100 Q50,80 100,90 T200,70 T300,85 T400,60 L400,200 L0,200 Z"
              fill="hsl(var(--muted) / 0.3)"
            />
          ) : (
            <motion.path
              d="M0,100 Q50,80 100,90 T200,70 T300,85 T400,60 L400,200 L0,200 Z"
              fill="url(#chartShimmerGradient)"
              initial={{ opacity: 0.3 }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{
                duration: duration * 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}
        </svg>
      </div>
    </div>
  );
}

/**
 * ShimmerList Component
 *
 * Skeleton for list items with avatar and text.
 *
 * @example
 * ```tsx
 * <ShimmerList />
 * <ShimmerList count={10} showAvatar={false} />
 * ```
 */
export interface ShimmerListProps {
  className?: string;
  count?: number;
  showAvatar?: boolean;
  avatarSize?: number;
  speed?: ShimmerSpeed;
}

export function ShimmerList({
  className,
  count = 5,
  showAvatar = true,
  avatarSize = 40,
  speed = "normal",
}: ShimmerListProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          {showAvatar && (
            <Shimmer
              width={avatarSize}
              height={avatarSize}
              rounded="full"
              speed={speed}
            />
          )}
          <div className="flex-1 space-y-2">
            <Shimmer height={16} width="60%" rounded="sm" speed={speed} />
            <Shimmer height={12} width="40%" rounded="sm" speed={speed} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Shimmer;
