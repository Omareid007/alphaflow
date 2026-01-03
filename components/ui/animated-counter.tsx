"use client";

import * as React from "react";
import { motion, useSpring, useTransform, type MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

/**
 * Spring animation presets for different counter feels
 */
const springPresets = {
  snappy: { stiffness: 150, damping: 25, mass: 0.5 },
  smooth: { stiffness: 100, damping: 30, mass: 0.8 },
  gentle: { stiffness: 50, damping: 20, mass: 1 },
  bouncy: { stiffness: 200, damping: 15, mass: 0.8 },
};

export type CounterSpringPreset = keyof typeof springPresets;

export interface AnimatedCounterProps {
  /** The numeric value to display */
  value: number;
  /** Custom format function for the display value */
  format?: (value: number) => string;
  /** CSS class name */
  className?: string;
  /** Decimal places to round to (default: 0) */
  decimals?: number;
  /** Spring animation preset */
  spring?: CounterSpringPreset;
  /** Custom spring configuration */
  customSpring?: { stiffness: number; damping: number; mass?: number };
  /** Show plus sign for positive numbers */
  showPlusSign?: boolean;
  /** Color based on positive/negative value */
  colorize?: boolean;
  /** CSS class for positive values */
  positiveClassName?: string;
  /** CSS class for negative values */
  negativeClassName?: string;
  /** Prefix to display before the value */
  prefix?: string;
  /** Suffix to display after the value */
  suffix?: string;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
}

/**
 * AnimatedCounter Component
 *
 * Smoothly animates number changes with spring physics.
 * Perfect for displaying portfolio values, profit/loss, or any numeric data.
 * Automatically respects user's prefers-reduced-motion setting.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <AnimatedCounter value={portfolioValue} decimals={2} />
 *
 * // Currency format
 * <AnimatedCounter
 *   value={totalValue}
 *   format={(n) => formatCurrency(n)}
 * />
 *
 * // With color for gain/loss
 * <AnimatedCounter
 *   value={profitLoss}
 *   colorize
 *   showPlusSign
 *   decimals={2}
 *   prefix="$"
 * />
 *
 * // Custom spring animation
 * <AnimatedCounter
 *   value={shares}
 *   spring="bouncy"
 *   suffix=" shares"
 * />
 * ```
 */
export function AnimatedCounter({
  value,
  format,
  className,
  decimals = 0,
  spring = "smooth",
  customSpring,
  showPlusSign = false,
  colorize = false,
  positiveClassName = "text-gain",
  negativeClassName = "text-loss",
  prefix = "",
  suffix = "",
  onAnimationComplete,
}: AnimatedCounterProps) {
  const prefersReducedMotion = useReducedMotion();
  const springConfig = customSpring ?? springPresets[spring];

  // Spring animation for smooth number transitions
  const springValue = useSpring(value, springConfig);

  // Format the animated value
  const display = useTransform(springValue, (current) => {
    const rounded =
      decimals > 0
        ? current.toFixed(decimals)
        : Math.round(current).toString();

    if (format) {
      return format(parseFloat(rounded));
    }

    const numValue = parseFloat(rounded);
    const sign = showPlusSign && numValue > 0 ? "+" : "";
    const formatted = numValue.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    return `${prefix}${sign}${formatted}${suffix}`;
  });

  // Update spring value when value prop changes
  React.useEffect(() => {
    if (prefersReducedMotion) {
      springValue.jump(value);
    } else {
      springValue.set(value);
    }
  }, [springValue, value, prefersReducedMotion]);

  // Handle animation complete callback
  React.useEffect(() => {
    if (!onAnimationComplete) return;

    const unsubscribe = springValue.on("animationComplete", onAnimationComplete);
    return () => unsubscribe();
  }, [springValue, onAnimationComplete]);

  // Determine color class based on value
  const colorClass = colorize
    ? value > 0
      ? positiveClassName
      : value < 0
      ? negativeClassName
      : ""
    : "";

  // If reduced motion, just display the value directly
  if (prefersReducedMotion) {
    const formattedValue = format
      ? format(value)
      : (() => {
          const sign = showPlusSign && value > 0 ? "+" : "";
          const formatted =
            decimals > 0
              ? value.toLocaleString("en-US", {
                  minimumFractionDigits: decimals,
                  maximumFractionDigits: decimals,
                })
              : Math.round(value).toLocaleString("en-US");
          return `${prefix}${sign}${formatted}${suffix}`;
        })();

    return <span className={cn(className, colorClass)}>{formattedValue}</span>;
  }

  return (
    <motion.span className={cn(className, colorClass)}>
      {display}
    </motion.span>
  );
}

/**
 * AnimatedCurrency Component
 *
 * Pre-configured AnimatedCounter for currency display.
 * Supports multiple currencies and automatic formatting.
 *
 * @example
 * ```tsx
 * <AnimatedCurrency value={1234.56} currency="USD" />
 * <AnimatedCurrency value={totalPnL} currency="USD" colorize showPlusSign />
 * ```
 */
export interface AnimatedCurrencyProps extends Omit<AnimatedCounterProps, "format" | "decimals" | "prefix" | "suffix"> {
  /** ISO 4217 currency code */
  currency?: string;
  /** Locale for formatting */
  locale?: string;
  /** Show cents/decimals */
  showCents?: boolean;
}

export function AnimatedCurrency({
  value,
  currency = "USD",
  locale = "en-US",
  showCents = true,
  ...props
}: AnimatedCurrencyProps) {
  const formatCurrency = React.useCallback(
    (num: number) => {
      const sign = props.showPlusSign && num > 0 ? "+" : "";
      const formatted = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: showCents ? 2 : 0,
        maximumFractionDigits: showCents ? 2 : 0,
      }).format(Math.abs(num));

      return num < 0 ? `-${formatted}` : `${sign}${formatted}`;
    },
    [currency, locale, showCents, props.showPlusSign]
  );

  return (
    <AnimatedCounter
      value={value}
      format={formatCurrency}
      decimals={showCents ? 2 : 0}
      {...props}
    />
  );
}

/**
 * AnimatedPercentage Component
 *
 * Pre-configured AnimatedCounter for percentage display.
 *
 * @example
 * ```tsx
 * <AnimatedPercentage value={12.5} />
 * <AnimatedPercentage value={changePercent} colorize showPlusSign />
 * ```
 */
export interface AnimatedPercentageProps extends Omit<AnimatedCounterProps, "format" | "suffix"> {
  /** Decimal places for percentage (default: 2) */
  decimals?: number;
}

export function AnimatedPercentage({
  value,
  decimals = 2,
  showPlusSign = false,
  ...props
}: AnimatedPercentageProps) {
  const formatPercentage = React.useCallback(
    (num: number) => {
      const sign = showPlusSign && num > 0 ? "+" : "";
      return `${sign}${num.toFixed(decimals)}%`;
    },
    [decimals, showPlusSign]
  );

  return (
    <AnimatedCounter
      value={value}
      format={formatPercentage}
      decimals={decimals}
      showPlusSign={showPlusSign}
      {...props}
    />
  );
}

/**
 * useAnimatedValue Hook
 *
 * Low-level hook for creating animated values.
 * Useful for custom animations beyond simple counters.
 *
 * @example
 * ```tsx
 * const { motionValue, display } = useAnimatedValue({
 *   value: 1000,
 *   format: (n) => `${n.toFixed(0)} points`,
 * });
 * ```
 */
export function useAnimatedValue({
  value,
  format,
  decimals = 0,
  spring = "smooth",
  customSpring,
}: {
  value: number;
  format?: (value: number) => string;
  decimals?: number;
  spring?: CounterSpringPreset;
  customSpring?: { stiffness: number; damping: number; mass?: number };
}): {
  motionValue: MotionValue<number>;
  display: MotionValue<string>;
  prefersReducedMotion: boolean;
} {
  const prefersReducedMotion = useReducedMotion();
  const springConfig = customSpring ?? springPresets[spring];

  const motionValue = useSpring(value, springConfig);

  const display = useTransform(motionValue, (current) => {
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
    if (prefersReducedMotion) {
      motionValue.jump(value);
    } else {
      motionValue.set(value);
    }
  }, [motionValue, value, prefersReducedMotion]);

  return { motionValue, display, prefersReducedMotion };
}

export default AnimatedCounter;
