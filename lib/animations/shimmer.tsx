"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ShimmerProps {
  className?: string;
  /** Width - can be a number (pixels) or string (e.g., "100%", "12rem") */
  width?: number | string;
  /** Height - can be a number (pixels) or string */
  height?: number | string;
  /** Border radius */
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

/**
 * Shimmer loading placeholder with animated gradient
 */
export function Shimmer({
  className,
  width,
  height,
  rounded = "md",
}: ShimmerProps) {
  const roundedClasses = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted/50",
        roundedClasses[rounded],
        className
      )}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer"
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(var(--muted-foreground) / 0.1), transparent)",
        }}
      />
    </div>
  );
}

/**
 * Text shimmer - for loading text content
 */
interface TextShimmerProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

export function TextShimmer({
  lines = 3,
  className,
  lastLineWidth = "60%",
}: TextShimmerProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer
          key={i}
          height={16}
          width={i === lines - 1 ? lastLineWidth : "100%"}
          rounded="sm"
        />
      ))}
    </div>
  );
}

/**
 * Card shimmer - for loading card content
 */
interface CardShimmerProps {
  className?: string;
  showImage?: boolean;
  lines?: number;
}

export function CardShimmer({
  className,
  showImage = true,
  lines = 2,
}: CardShimmerProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 space-y-4", className)}>
      {showImage && <Shimmer height={120} width="100%" rounded="lg" />}
      <div className="space-y-2">
        <Shimmer height={20} width="70%" rounded="sm" />
        <TextShimmer lines={lines} />
      </div>
    </div>
  );
}

/**
 * Metric card shimmer
 */
export function MetricCardShimmer({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-6", className)}>
      <Shimmer height={14} width="40%" rounded="sm" className="mb-3" />
      <Shimmer height={32} width="60%" rounded="md" className="mb-2" />
      <Shimmer height={16} width="30%" rounded="sm" />
    </div>
  );
}

/**
 * Table row shimmer
 */
interface TableRowShimmerProps {
  columns?: number;
  rows?: number;
  className?: string;
}

export function TableRowShimmer({
  columns = 5,
  rows = 5,
  className,
}: TableRowShimmerProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Shimmer
            key={`header-${i}`}
            height={16}
            width={i === 0 ? "30%" : "15%"}
            rounded="sm"
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={`row-${rowIdx}`} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Shimmer
              key={`cell-${rowIdx}-${colIdx}`}
              height={20}
              width={colIdx === 0 ? "30%" : "15%"}
              rounded="sm"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Avatar shimmer
 */
interface AvatarShimmerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function AvatarShimmer({ size = "md", className }: AvatarShimmerProps) {
  const sizes = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  };

  return (
    <Shimmer
      width={sizes[size]}
      height={sizes[size]}
      rounded="full"
      className={className}
    />
  );
}

/**
 * Chart shimmer
 */
export function ChartShimmer({
  height = 300,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="flex justify-between mb-4">
        <Shimmer height={24} width="30%" rounded="sm" />
        <Shimmer height={24} width="20%" rounded="sm" />
      </div>
      <div className="relative" style={{ height }}>
        <svg
          className="w-full h-full"
          viewBox="0 0 400 200"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="shimmerGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="0.3">
                <animate
                  attributeName="offset"
                  values="-1; 2"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="50%" stopColor="hsl(var(--muted))" stopOpacity="0.5">
                <animate
                  attributeName="offset"
                  values="-0.5; 2.5"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0.3">
                <animate
                  attributeName="offset"
                  values="0; 3"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </stop>
            </linearGradient>
          </defs>
          <path
            d="M0,100 Q50,80 100,90 T200,70 T300,85 T400,60 L400,200 L0,200 Z"
            fill="url(#shimmerGradient)"
          />
        </svg>
      </div>
    </div>
  );
}

export default Shimmer;
