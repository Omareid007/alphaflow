"use client";

import { cn } from "@/lib/utils";

interface ShimmerProps {
  className?: string;
  width?: string;
  height?: string;
}

/**
 * Shimmer - CSS-based shimmer effect for skeleton screens
 * Lightweight alternative to Framer Motion for loading states
 *
 * @example
 * <Shimmer width="200px" height="20px" className="rounded" />
 */
export function Shimmer({ className, width, height }: ShimmerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        "before:absolute before:inset-0",
        "before:-translate-x-full",
        "before:animate-[shimmer_2s_infinite]",
        "before:bg-gradient-to-r",
        "before:from-transparent before:via-white/20 before:to-transparent",
        className
      )}
      style={{ width, height }}
    />
  );
}

// Add this to your globals.css:
/*
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
*/
