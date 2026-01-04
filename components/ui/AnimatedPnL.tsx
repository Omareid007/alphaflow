/**
 * AnimatedPnL - Animated P&L Value with Flash and Shake Effects
 *
 * @module components/ui/AnimatedPnL
 * @description Displays P&L values with visual animations on change:
 * - GREEN flash + scale up on profit increase
 * - RED flash + shake on loss increase
 * - Respects prefers-reduced-motion for accessibility
 *
 * Features:
 * - Detects value changes and animates accordingly
 * - Green background flash + scale up (1.05x) for gains
 * - Red background flash + shake animation for losses
 * - Smooth transitions with Framer Motion
 * - Accessibility: Skip animations if prefers-reduced-motion
 * - Screen reader announcements for significant changes
 * - Dark mode support
 *
 * @see openspec/changes/realtime-portfolio-streaming/design.md
 * @see hooks/useRealtimePositions.ts - Triggers P&L updates
 *
 * @example Basic usage
 * ```tsx
 * <AnimatedPnL
 *   value={position.unrealizedPl}
 *   showSign
 *   showPercent
 *   percentValue={position.unrealizedPlPct}
 * />
 * ```
 *
 * @example With custom formatting
 * ```tsx
 * <AnimatedPnL
 *   value={1234.56}
 *   formatter={(v) => `$${v.toLocaleString()}`}
 *   className="text-lg font-bold"
 * />
 * ```
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface AnimatedPnLProps {
  /**
   * P&L value to display (can be positive or negative)
   */
  value: number;

  /**
   * Optional percentage value to display alongside
   */
  percentValue?: number;

  /**
   * Show +/- sign before value
   * @default true
   */
  showSign?: boolean;

  /**
   * Show percentage in parentheses
   * @default false
   */
  showPercent?: boolean;

  /**
   * Custom formatter for the value
   * @default (v) => v.toFixed(2)
   */
  formatter?: (value: number) => string;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Size variant
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Enable animations (can be disabled for testing)
   * @default true
   */
  enableAnimations?: boolean;

  /**
   * Minimum change threshold to trigger animation (in absolute value)
   * @default 0.01
   */
  animationThreshold?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * AnimatedPnL Component
 *
 * Animates P&L value changes with green flash (profit increase) or red shake (loss increase).
 *
 * @param props - Component props
 */
export function AnimatedPnL({
  value,
  percentValue,
  showSign = true,
  showPercent = false,
  formatter = (v: number) => v.toFixed(2),
  className,
  size = "md",
  enableAnimations = true,
  animationThreshold = 0.01,
}: AnimatedPnLProps) {
  const prefersReducedMotion = useReducedMotion();

  // Track previous value to detect changes
  const prevValue = useRef<number>(value);
  const [animationType, setAnimationType] = useState<
    "increase" | "decrease" | null
  >(null);

  // Detect value changes and trigger animations
  useEffect(() => {
    const change = value - prevValue.current;
    const absChange = Math.abs(change);

    if (absChange >= animationThreshold) {
      // Determine animation type based on change direction
      setAnimationType(change > 0 ? "increase" : "decrease");

      // Clear animation after it completes
      const timer = setTimeout(() => setAnimationType(null), 600);

      // Update previous value
      prevValue.current = value;

      return () => clearTimeout(timer);
    }
  }, [value, animationThreshold]);

  // ============================================================================
  // SIZE CLASSES
  // ============================================================================

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  // ============================================================================
  // COLOR CLASSES
  // ============================================================================

  const colorClass = cn(
    value >= 0
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400",
    sizeClasses[size]
  );

  // ============================================================================
  // FORMATTED VALUE
  // ============================================================================

  const formattedValue = `${showSign && value >= 0 ? "+" : ""}${formatter(value)}`;
  const formattedPercent =
    percentValue !== undefined
      ? ` (${percentValue >= 0 ? "+" : ""}${percentValue.toFixed(2)}%)`
      : "";

  // ============================================================================
  // RENDER
  // ============================================================================

  // If reduced motion or animations disabled, just show value with color
  if (prefersReducedMotion || !enableAnimations) {
    return (
      <span
        className={cn(colorClass, className, "font-mono tabular-nums")}
        aria-label={`Profit/Loss: ${formattedValue}${formattedPercent}`}
      >
        {formattedValue}
        {showPercent && formattedPercent}
      </span>
    );
  }

  // ============================================================================
  // ANIMATION VARIANTS
  // ============================================================================

  const increaseAnimation = {
    scale: [1, 1.05, 1],
    backgroundColor: [
      "transparent",
      "rgba(34, 197, 94, 0.2)", // green-500 with 20% opacity
      "transparent",
    ],
  };

  const decreaseAnimation = {
    x: [0, -3, 3, -3, 3, 0], // Shake left-right
    backgroundColor: [
      "transparent",
      "rgba(239, 68, 68, 0.2)", // red-500 with 20% opacity
      "transparent",
    ],
  };

  return (
    <motion.span
      className={cn(
        colorClass,
        className,
        "font-mono tabular-nums inline-block px-1 rounded"
      )}
      animate={
        animationType === "increase"
          ? increaseAnimation
          : animationType === "decrease"
            ? decreaseAnimation
            : {}
      }
      transition={{ duration: 0.5, ease: "easeOut" }}
      aria-label={`Profit/Loss: ${formattedValue}${formattedPercent}`}
      aria-live="polite"
    >
      {formattedValue}
      {showPercent && (
        <span className="text-xs ml-1 opacity-80">{formattedPercent}</span>
      )}

      {/* Screen reader announcement for significant changes */}
      {animationType && Math.abs(value - prevValue.current) > 100 && (
        <span className="sr-only">
          P&L {animationType === "increase" ? "increased" : "decreased"} to{" "}
          {formattedValue}
        </span>
      )}
    </motion.span>
  );
}

export default AnimatedPnL;
