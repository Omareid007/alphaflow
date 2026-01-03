"use client";

import * as React from "react";
import { motion, type Transition, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

/**
 * Animation style presets for loading dots
 */
export type LoadingDotsAnimation = "bounce" | "pulse" | "wave" | "fade";

/**
 * Color presets for loading dots
 */
export type LoadingDotsColor =
  | "default"
  | "primary"
  | "muted"
  | "gain"
  | "loss"
  | "inherit";

const sizeMap = {
  xs: { dot: "h-0.5 w-0.5", gap: "gap-0.5", bounceHeight: -4 },
  sm: { dot: "h-1 w-1", gap: "gap-0.5", bounceHeight: -6 },
  md: { dot: "h-1.5 w-1.5", gap: "gap-1", bounceHeight: -8 },
  lg: { dot: "h-2 w-2", gap: "gap-1", bounceHeight: -10 },
  xl: { dot: "h-2.5 w-2.5", gap: "gap-1.5", bounceHeight: -12 },
};

const colorMap: Record<LoadingDotsColor, string> = {
  default: "bg-current",
  primary: "bg-primary",
  muted: "bg-muted-foreground",
  gain: "bg-gain",
  loss: "bg-loss",
  inherit: "bg-current",
};

export interface LoadingDotsProps {
  /** CSS class name */
  className?: string;
  /** Size of the dots */
  size?: keyof typeof sizeMap;
  /** Color variant */
  color?: LoadingDotsColor;
  /** Animation style */
  animation?: LoadingDotsAnimation;
  /** Number of dots (default: 3) */
  count?: number;
  /** Animation duration in seconds */
  duration?: number;
  /** Delay between each dot animation */
  staggerDelay?: number;
  /** Accessible label for screen readers */
  label?: string;
}

/**
 * LoadingDots Component
 *
 * Animated loading indicator with bouncing, pulsing, or waving dots.
 * Modern alternative to spinner for inline loading states.
 * Automatically respects user's prefers-reduced-motion setting.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <LoadingDots />
 *
 * // In a button
 * <Button disabled={isLoading}>
 *   {isLoading ? <LoadingDots size="sm" /> : "Submit"}
 * </Button>
 *
 * // With different animation
 * <LoadingDots animation="wave" color="primary" />
 *
 * // Custom count and timing
 * <LoadingDots count={5} duration={0.8} staggerDelay={0.15} />
 * ```
 */
export function LoadingDots({
  className,
  size = "md",
  color = "default",
  animation = "bounce",
  count = 3,
  duration = 0.6,
  staggerDelay = 0.15,
  label = "Loading",
}: LoadingDotsProps) {
  const prefersReducedMotion = useReducedMotion();
  const { dot, gap, bounceHeight } = sizeMap[size];
  const colorClass = colorMap[color];

  // Base dot style
  const dotClassName = cn("rounded-full", dot, colorClass, className);

  // Create array of dot indices
  const dots = React.useMemo(() => Array.from({ length: count }), [count]);

  // Static version for reduced motion
  if (prefersReducedMotion) {
    return (
      <div
        className={cn("inline-flex items-center", gap)}
        role="status"
        aria-label={label}
      >
        {dots.map((_, i) => (
          <div key={i} className={cn(dotClassName, "opacity-60")} />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  // Get animation variants based on style
  const getAnimationProps = (index: number) => {
    const delay = index * staggerDelay;

    switch (animation) {
      case "bounce":
        return {
          animate: { y: [0, bounceHeight, 0] },
          transition: {
            duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay,
          } as Transition,
        };

      case "pulse":
        return {
          animate: { scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] },
          transition: {
            duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay,
          } as Transition,
        };

      case "wave":
        return {
          animate: {
            y: [0, bounceHeight * 0.5, 0, bounceHeight * 0.5 * -1, 0],
          },
          transition: {
            duration: duration * 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay,
          } as Transition,
        };

      case "fade":
        return {
          animate: { opacity: [0.3, 1, 0.3] },
          transition: {
            duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay,
          } as Transition,
        };

      default:
        return {
          animate: { y: [0, bounceHeight, 0] },
          transition: {
            duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay,
          } as Transition,
        };
    }
  };

  return (
    <div
      className={cn("inline-flex items-center", gap)}
      role="status"
      aria-label={label}
    >
      {dots.map((_, index) => {
        const { animate, transition } = getAnimationProps(index);
        return (
          <motion.div
            key={index}
            className={dotClassName}
            animate={animate}
            transition={transition}
          />
        );
      })}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * LoadingSpinner Component
 *
 * Classic spinning loading indicator using Framer Motion.
 * Respects reduced motion preferences.
 *
 * @example
 * ```tsx
 * <LoadingSpinner />
 * <LoadingSpinner size="lg" color="primary" />
 * ```
 */
export interface LoadingSpinnerProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  color?: LoadingDotsColor;
  strokeWidth?: number;
  label?: string;
}

const spinnerSizeMap = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export function LoadingSpinner({
  className,
  size = "md",
  color = "default",
  strokeWidth = 2,
  label = "Loading",
}: LoadingSpinnerProps) {
  const prefersReducedMotion = useReducedMotion();
  const pixelSize = spinnerSizeMap[size];
  const colorClass =
    color === "default" || color === "inherit"
      ? "stroke-current"
      : `stroke-${color === "primary" ? "primary" : color}`;

  const radius = (pixelSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  if (prefersReducedMotion) {
    return (
      <div
        role="status"
        aria-label={label}
        className={cn("inline-flex", className)}
      >
        <svg
          width={pixelSize}
          height={pixelSize}
          viewBox={`0 0 ${pixelSize} ${pixelSize}`}
          className="opacity-50"
        >
          <circle
            cx={pixelSize / 2}
            cy={pixelSize / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className={colorClass}
            strokeDasharray={`${circumference * 0.25} ${circumference * 0.75}`}
          />
        </svg>
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={label}
      className={cn("inline-flex", className)}
    >
      <motion.svg
        width={pixelSize}
        height={pixelSize}
        viewBox={`0 0 ${pixelSize} ${pixelSize}`}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <circle
          cx={pixelSize / 2}
          cy={pixelSize / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={colorClass}
          strokeDasharray={`${circumference * 0.25} ${circumference * 0.75}`}
          strokeLinecap="round"
        />
      </motion.svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * LoadingBar Component
 *
 * Horizontal loading bar with animated progress.
 *
 * @example
 * ```tsx
 * <LoadingBar />
 * <LoadingBar color="primary" />
 * ```
 */
export interface LoadingBarProps {
  className?: string;
  color?: LoadingDotsColor;
  height?: number;
  label?: string;
}

export function LoadingBar({
  className,
  color = "primary",
  height = 3,
  label = "Loading",
}: LoadingBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const colorClass = colorMap[color];

  if (prefersReducedMotion) {
    return (
      <div
        role="status"
        aria-label={label}
        className={cn(
          "w-full overflow-hidden rounded-full bg-muted",
          className
        )}
        style={{ height }}
      >
        <div
          className={cn("h-full w-1/3 rounded-full", colorClass)}
          style={{ opacity: 0.7 }}
        />
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={label}
      className={cn("w-full overflow-hidden rounded-full bg-muted", className)}
      style={{ height }}
    >
      <motion.div
        className={cn("h-full rounded-full", colorClass)}
        initial={{ width: "0%", x: "0%" }}
        animate={{
          width: ["0%", "40%", "0%"],
          x: ["0%", "80%", "100%"],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default LoadingDots;
