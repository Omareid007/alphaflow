"use client";

import * as React from "react";
import { motion, useSpring, useTransform, MotionValue } from "framer-motion";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

export interface AnimatedCounterProps {
  value: number;
  /** Format function for the display value (default: locale string with commas) */
  format?: (value: number) => string;
  /** CSS class name */
  className?: string;
  /** Decimal places to round to (default: 0) */
  decimals?: number;
}

/**
 * AnimatedCounter Component
 *
 * Smoothly animates number changes with spring physics.
 * Perfect for displaying portfolio values, profit/loss, or any numeric data.
 *
 * @example
 * ```tsx
 * <AnimatedCounter value={portfolioValue} decimals={2} />
 * <AnimatedCounter
 *   value={shares}
 *   format={(n) => `${n} shares`}
 * />
 * ```
 */
export function AnimatedCounter({
  value,
  format,
  className,
  decimals = 0,
}: AnimatedCounterProps) {
  const prefersReducedMotion = useReducedMotion();

  // Spring animation for smooth number transitions
  const spring = useSpring(value, {
    stiffness: 100,
    damping: 30,
    mass: 0.8,
  });

  // Format the animated value
  const display = useTransform(spring, (current) => {
    const rounded =
      decimals > 0
        ? current.toFixed(decimals)
        : Math.round(current).toString();

    if (format) {
      return format(parseFloat(rounded));
    }

    return parseFloat(rounded).toLocaleString();
  });

  React.useEffect(() => {
    // Skip animation if user prefers reduced motion
    if (prefersReducedMotion) {
      spring.jump(value);
    } else {
      spring.set(value);
    }
  }, [spring, value, prefersReducedMotion]);

  // If reduced motion, just display the value directly
  if (prefersReducedMotion) {
    const formattedValue = format
      ? format(value)
      : decimals > 0
      ? value.toFixed(decimals)
      : Math.round(value).toLocaleString();

    return <span className={className}>{formattedValue}</span>;
  }

  return <motion.span className={className}>{display}</motion.span>;
}
