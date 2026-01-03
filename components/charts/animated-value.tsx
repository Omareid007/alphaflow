"use client";

import * as React from "react";
import { motion, useSpring, useTransform, useMotionValue } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

interface AnimatedValueProps {
  value: number;
  /** Previous value for change detection */
  previousValue?: number;
  /** Format function for display */
  format?: (value: number) => string;
  /** Duration of animation in seconds */
  duration?: number;
  /** Show flash animation on change */
  flash?: boolean;
  /** CSS class for the value */
  className?: string;
  /** Show trend indicator arrow */
  showTrend?: boolean;
  /** Decimal places for formatting */
  decimals?: number;
  /** Prefix (e.g., "$") */
  prefix?: string;
  /** Suffix (e.g., "%") */
  suffix?: string;
}

/**
 * Animated number that counts up/down with optional flash effect
 * Robinhood-style value change animations
 */
export function AnimatedValue({
  value,
  previousValue,
  format,
  duration = 0.5,
  flash = true,
  className,
  showTrend = false,
  decimals = 2,
  prefix = "",
  suffix = "",
}: AnimatedValueProps) {
  const prefersReducedMotion = useReducedMotion();
  const [flashDirection, setFlashDirection] = React.useState<
    "up" | "down" | null
  >(null);
  const prevValueRef = React.useRef(previousValue ?? value);

  // Spring animation for smooth counting
  const motionValue = useMotionValue(prevValueRef.current);
  const springValue = useSpring(motionValue, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Transform to formatted string
  const displayValue = useTransform(springValue, (latest) => {
    if (format) return format(latest);
    return `${prefix}${latest.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;
  });

  // Update animation when value changes
  React.useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;

    if (!prefersReducedMotion) {
      motionValue.set(value);
    }

    // Trigger flash effect
    if (flash && prev !== value) {
      setFlashDirection(value > prev ? "up" : "down");
      const timer = setTimeout(() => setFlashDirection(null), 500);
      return () => clearTimeout(timer);
    }
  }, [value, flash, prefersReducedMotion, motionValue]);

  // Calculate trend
  const trend =
    value > prevValueRef.current
      ? "up"
      : value < prevValueRef.current
        ? "down"
        : "neutral";

  // For reduced motion, just show the value
  if (prefersReducedMotion) {
    const formattedValue = format
      ? format(value)
      : `${prefix}${value.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}${suffix}`;

    return (
      <span
        className={cn(
          "tabular-nums",
          trend === "up" && "text-gain",
          trend === "down" && "text-loss",
          className
        )}
      >
        {showTrend && trend !== "neutral" && (
          <span className="mr-1">{trend === "up" ? "▲" : "▼"}</span>
        )}
        {formattedValue}
      </span>
    );
  }

  return (
    <motion.span
      className={cn(
        "tabular-nums inline-flex items-center",
        flashDirection === "up" && "animate-pulse-gain",
        flashDirection === "down" && "animate-pulse-loss",
        className
      )}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {showTrend && trend !== "neutral" && (
        <motion.span
          className={cn("mr-1", trend === "up" ? "text-gain" : "text-loss")}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          {trend === "up" ? "▲" : "▼"}
        </motion.span>
      )}
      <motion.span>{displayValue}</motion.span>
    </motion.span>
  );
}

/**
 * Animated percentage change badge
 */
interface AnimatedChangeProps {
  value: number;
  showSign?: boolean;
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function AnimatedChange({
  value,
  showSign = true,
  className,
  size = "default",
}: AnimatedChangeProps) {
  const prefersReducedMotion = useReducedMotion();
  const isPositive = value >= 0;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    default: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const formattedValue = `${showSign && isPositive ? "+" : ""}${value.toFixed(2)}%`;

  return (
    <motion.span
      className={cn(
        "inline-flex items-center rounded-full font-medium tabular-nums",
        isPositive ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss",
        sizeClasses[size],
        className
      )}
      initial={prefersReducedMotion ? undefined : { scale: 0.8, opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <motion.span
        className="mr-1"
        initial={
          prefersReducedMotion ? undefined : { rotate: isPositive ? -90 : 90 }
        }
        animate={prefersReducedMotion ? undefined : { rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {isPositive ? "↑" : "↓"}
      </motion.span>
      {formattedValue}
    </motion.span>
  );
}

/**
 * Large animated portfolio value display
 */
interface AnimatedPortfolioValueProps {
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  label?: string;
  className?: string;
}

export function AnimatedPortfolioValue({
  value,
  previousValue,
  change,
  changePercent,
  label = "Portfolio Value",
  className,
}: AnimatedPortfolioValueProps) {
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className={cn("space-y-1", className)}>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
      <AnimatedValue
        value={value}
        previousValue={previousValue}
        prefix="$"
        decimals={2}
        className="text-3xl md:text-4xl font-bold"
        flash
      />
      {(change !== undefined || changePercent !== undefined) && (
        <div className="flex items-center gap-2">
          {change !== undefined && (
            <span
              className={cn(
                "text-sm font-medium tabular-nums",
                isPositive ? "text-gain" : "text-loss"
              )}
            >
              {isPositive ? "+" : ""}$
              {Math.abs(change).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          )}
          {changePercent !== undefined && (
            <AnimatedChange value={changePercent} size="sm" />
          )}
          <span className="text-xs text-muted-foreground">Today</span>
        </div>
      )}
    </div>
  );
}

export default AnimatedValue;
