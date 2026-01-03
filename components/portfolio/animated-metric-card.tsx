"use client";

import * as React from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";
import {
  AnimatedCounter,
  AnimatedCurrency,
  AnimatedPercentage,
} from "@/components/ui/animated-counter";

/**
 * Format types for metric display
 */
export type MetricFormat = "currency" | "percentage" | "number";

/**
 * Trend direction for value changes
 */
export type TrendDirection = "up" | "down" | "neutral";

export interface AnimatedMetricCardProps {
  /** Display label for the metric */
  label: string;
  /** Current value to display */
  value: number;
  /** Previous value for trend calculation */
  previousValue?: number;
  /** Format type for value display */
  format?: MetricFormat;
  /** Optional icon to display */
  icon?: LucideIcon;
  /** Currency code (for currency format) */
  currency?: string;
  /** Decimal places for display */
  decimals?: number;
  /** Show trend arrow and change indicator */
  showTrend?: boolean;
  /** Show percentage change alongside trend */
  showChangePercent?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /**
   * Accessible description for screen readers (WCAG 2.1 AA)
   * If not provided, a default description will be generated
   */
  ariaLabel?: string;
}

const sizeClasses = {
  sm: {
    container: "p-3",
    label: "text-xs",
    value: "text-lg font-bold",
    trend: "text-xs gap-0.5",
    icon: "h-4 w-4",
    trendIcon: "h-3 w-3",
  },
  md: {
    container: "p-4",
    label: "text-sm",
    value: "text-2xl font-bold",
    trend: "text-sm gap-1",
    icon: "h-5 w-5",
    trendIcon: "h-4 w-4",
  },
  lg: {
    container: "p-6",
    label: "text-base",
    value: "text-3xl font-bold",
    trend: "text-base gap-1.5",
    icon: "h-6 w-6",
    trendIcon: "h-5 w-5",
  },
};

/**
 * Animation variants for card entrance
 */
const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
    },
  },
};

/**
 * Animation variants for trend arrow
 */
const trendVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -10,
    scale: 0.5,
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
      delay: 0.2,
    },
  },
  exit: {
    opacity: 0,
    x: 10,
    scale: 0.5,
  },
};

/**
 * Calculate trend direction and percentage change
 */
function calculateTrend(
  current: number,
  previous?: number
): { direction: TrendDirection; changePercent: number; changeValue: number } {
  if (previous === undefined || previous === 0) {
    return { direction: "neutral", changePercent: 0, changeValue: 0 };
  }

  const changeValue = current - previous;
  const changePercent = ((current - previous) / Math.abs(previous)) * 100;

  if (changeValue > 0) {
    return { direction: "up", changePercent, changeValue };
  } else if (changeValue < 0) {
    return {
      direction: "down",
      changePercent: Math.abs(changePercent),
      changeValue,
    };
  }

  return { direction: "neutral", changePercent: 0, changeValue: 0 };
}

/**
 * Get trend icon and color based on direction
 */
function getTrendConfig(direction: TrendDirection): {
  Icon: LucideIcon;
  colorClass: string;
  bgClass: string;
} {
  switch (direction) {
    case "up":
      return {
        Icon: TrendingUp,
        colorClass: "text-gain",
        bgClass: "bg-gain/10",
      };
    case "down":
      return {
        Icon: TrendingDown,
        colorClass: "text-loss",
        bgClass: "bg-loss/10",
      };
    default:
      return {
        Icon: Minus,
        colorClass: "text-muted-foreground",
        bgClass: "bg-muted/50",
      };
  }
}

/**
 * AnimatedMetricCard Component
 *
 * Display portfolio metrics with animated value changes and trend indicators.
 * Uses AnimatedCounter for smooth number transitions.
 * Respects user's prefers-reduced-motion accessibility setting.
 *
 * @example
 * ```tsx
 * // Basic currency metric
 * <AnimatedMetricCard
 *   label="Portfolio Value"
 *   value={125000}
 *   previousValue={120000}
 *   format="currency"
 *   showTrend
 * />
 *
 * // Percentage metric with icon
 * <AnimatedMetricCard
 *   label="Daily Return"
 *   value={2.45}
 *   previousValue={1.8}
 *   format="percentage"
 *   icon={TrendingUp}
 *   showChangePercent
 * />
 *
 * // Number metric
 * <AnimatedMetricCard
 *   label="Open Positions"
 *   value={12}
 *   format="number"
 *   size="lg"
 * />
 * ```
 */
export function AnimatedMetricCard({
  label,
  value,
  previousValue,
  format = "number",
  icon: UserIcon,
  currency = "USD",
  decimals = 2,
  showTrend = true,
  showChangePercent = true,
  className,
  size = "md",
  ariaLabel,
}: AnimatedMetricCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const sizeConfig = sizeClasses[size];

  // Calculate trend
  const { direction, changePercent, changeValue } = calculateTrend(
    value,
    previousValue
  );
  const trendConfig = getTrendConfig(direction);
  const TrendIcon = trendConfig.Icon;

  // Determine if we should show trend
  const shouldShowTrend = showTrend && previousValue !== undefined;

  // Generate accessible description
  const generateAriaLabel = (): string => {
    if (ariaLabel) return ariaLabel;

    let valueText = "";
    switch (format) {
      case "currency":
        valueText = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
        }).format(value);
        break;
      case "percentage":
        valueText = `${value.toFixed(decimals)}%`;
        break;
      default:
        valueText = value.toFixed(decimals);
    }

    let trendText = "";
    if (shouldShowTrend && direction !== "neutral") {
      trendText = `, ${direction === "up" ? "up" : "down"} ${changePercent.toFixed(1)}% from previous value`;
    }

    return `${label}: ${valueText}${trendText}`;
  };

  /**
   * Render the value based on format type
   */
  const renderValue = () => {
    const commonProps = {
      className: cn(sizeConfig.value, "tracking-tight"),
      colorize: false,
    };

    switch (format) {
      case "currency":
        return (
          <AnimatedCurrency
            value={value}
            currency={currency}
            showCents={decimals > 0}
            {...commonProps}
          />
        );
      case "percentage":
        return (
          <AnimatedPercentage
            value={value}
            decimals={decimals}
            showPlusSign={value > 0}
            {...commonProps}
          />
        );
      default:
        return (
          <AnimatedCounter value={value} decimals={decimals} {...commonProps} />
        );
    }
  };

  /**
   * Render the trend indicator
   */
  const renderTrend = () => {
    if (!shouldShowTrend) return null;

    const trendContent = (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-1.5 py-0.5",
          sizeConfig.trend,
          trendConfig.bgClass,
          trendConfig.colorClass
        )}
      >
        <TrendIcon className={sizeConfig.trendIcon} />
        {showChangePercent && direction !== "neutral" && (
          <span className="font-medium">
            {direction === "down" ? "-" : "+"}
            {changePercent.toFixed(1)}%
          </span>
        )}
      </span>
    );

    if (prefersReducedMotion) {
      return trendContent;
    }

    return (
      <AnimatePresence mode="wait">
        <motion.span
          key={`${direction}-${changePercent.toFixed(1)}`}
          variants={trendVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {trendContent}
        </motion.span>
      </AnimatePresence>
    );
  };

  // Non-animated version for reduced motion preference
  if (prefersReducedMotion) {
    return (
      <div
        className={cn(
          "rounded-xl border bg-card",
          sizeConfig.container,
          className
        )}
        role="region"
        aria-label={generateAriaLabel()}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={cn(sizeConfig.label, "text-muted-foreground")}>
            {label}
          </span>
          {UserIcon && (
            <UserIcon
              className={cn(sizeConfig.icon, "text-muted-foreground")}
              aria-hidden="true"
            />
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="flex-1">{renderValue()}</div>
          {renderTrend()}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={cn(
        "rounded-xl border bg-card transition-shadow duration-normal hover:shadow-card-hover",
        sizeConfig.container,
        className
      )}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      role="region"
      aria-label={generateAriaLabel()}
    >
      {/* Header with label and icon */}
      <motion.div
        className="flex items-center justify-between mb-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <span className={cn(sizeConfig.label, "text-muted-foreground")}>
          {label}
        </span>
        {UserIcon && (
          <motion.span
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
          >
            <UserIcon
              className={cn(sizeConfig.icon, "text-muted-foreground")}
              aria-hidden="true"
            />
          </motion.span>
        )}
      </motion.div>

      {/* Value and trend */}
      <div className="flex items-end justify-between gap-2">
        <div className="flex-1">{renderValue()}</div>
        {renderTrend()}
      </div>

      {/* Change value (optional detail) */}
      {shouldShowTrend && changeValue !== 0 && (
        <motion.div
          className={cn("mt-1.5 text-xs", trendConfig.colorClass)}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {format === "currency" ? (
            <span>
              {changeValue > 0 ? "+" : ""}
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency,
              }).format(changeValue)}
            </span>
          ) : format === "percentage" ? (
            <span>
              {changeValue > 0 ? "+" : ""}
              {changeValue.toFixed(decimals)}pp
            </span>
          ) : (
            <span>
              {changeValue > 0 ? "+" : ""}
              {changeValue.toFixed(decimals)}
            </span>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * AnimatedMetricCardGrid Component
 *
 * Grid layout for multiple metric cards with staggered animation.
 *
 * @example
 * ```tsx
 * <AnimatedMetricCardGrid>
 *   <AnimatedMetricCard label="Value" value={100000} format="currency" />
 *   <AnimatedMetricCard label="Return" value={5.2} format="percentage" />
 *   <AnimatedMetricCard label="Positions" value={8} format="number" />
 * </AnimatedMetricCardGrid>
 * ```
 */
export interface AnimatedMetricCardGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}

const gridContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

export function AnimatedMetricCardGrid({
  children,
  className,
  columns = 3,
}: AnimatedMetricCardGridProps) {
  const prefersReducedMotion = useReducedMotion();

  const gridColsClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  if (prefersReducedMotion) {
    return (
      <div className={cn("grid gap-4", gridColsClass[columns], className)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={cn("grid gap-4", gridColsClass[columns], className)}
      variants={gridContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export default AnimatedMetricCard;
