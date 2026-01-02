"use client";

import * as React from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

interface SparklineDataPoint {
  value: number;
}

interface SparklineProps {
  data: number[] | SparklineDataPoint[];
  width?: number | string;
  height?: number;
  showArea?: boolean;
  strokeWidth?: number;
  className?: string;
  animate?: boolean;
  /** Override color (otherwise auto-detected from trend) */
  color?: "gain" | "loss" | "primary" | "muted";
}

/**
 * Mini sparkline chart for metric cards and compact displays
 * Automatically colors based on trend (first vs last value)
 */
export function Sparkline({
  data,
  width = "100%",
  height = 32,
  showArea = true,
  strokeWidth = 1.5,
  className,
  animate = true,
  color,
}: SparklineProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animate && !prefersReducedMotion;

  // Normalize data to array of objects
  const chartData = React.useMemo(() => {
    return data.map((point, index) => ({
      index,
      value: typeof point === "number" ? point : point.value,
    }));
  }, [data]);

  // Calculate trend
  const firstValue = chartData[0]?.value ?? 0;
  const lastValue = chartData[chartData.length - 1]?.value ?? 0;
  const isPositive = lastValue >= firstValue;

  // Determine color
  const resolvedColor = color ?? (isPositive ? "gain" : "loss");
  const colorMap = {
    gain: {
      stroke: "hsl(var(--gain))",
      fill: "hsl(var(--gain))",
    },
    loss: {
      stroke: "hsl(var(--loss))",
      fill: "hsl(var(--loss))",
    },
    primary: {
      stroke: "hsl(var(--primary))",
      fill: "hsl(var(--primary))",
    },
    muted: {
      stroke: "hsl(var(--muted-foreground))",
      fill: "hsl(var(--muted-foreground))",
    },
  };
  const colors = colorMap[resolvedColor];

  // Generate unique gradient ID
  const gradientId = React.useId().replace(/:/g, "");

  // Calculate Y domain with some padding
  const values = chartData.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = (maxValue - minValue) * 0.1 || 1;

  return (
    <motion.div
      className={cn("flex-shrink-0", className)}
      style={{ width, height }}
      initial={shouldAnimate ? { opacity: 0, scale: 0.95 } : undefined}
      animate={shouldAnimate ? { opacity: 1, scale: 1 } : undefined}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`sparkGradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.fill} stopOpacity={showArea ? 0.3 : 0} />
              <stop offset="100%" stopColor={colors.fill} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[minValue - padding, maxValue + padding]} hide />
          <Area
            type="monotone"
            dataKey="value"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            fill={`url(#sparkGradient-${gradientId})`}
            animationDuration={shouldAnimate ? 500 : 0}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

/**
 * Sparkline with value display for metric cards
 */
interface SparklineWithValueProps extends SparklineProps {
  value: number | string;
  label?: string;
  change?: number;
  changePercent?: number;
  formatValue?: (value: number | string) => string;
}

export function SparklineWithValue({
  value,
  label,
  change,
  changePercent,
  formatValue = (v) => String(v),
  data,
  ...sparklineProps
}: SparklineWithValueProps) {
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        {label && (
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        )}
        <p className="text-lg font-semibold tabular-nums truncate">
          {formatValue(value)}
        </p>
        {(change !== undefined || changePercent !== undefined) && (
          <p
            className={cn(
              "text-xs font-medium tabular-nums",
              isPositive ? "text-gain" : "text-loss"
            )}
          >
            {change !== undefined && (
              <span>
                {isPositive ? "+" : ""}
                {change.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            )}
            {changePercent !== undefined && (
              <span>
                {change !== undefined ? " " : ""}({isPositive ? "+" : ""}
                {changePercent.toFixed(2)}%)
              </span>
            )}
          </p>
        )}
      </div>
      <Sparkline data={data} width={80} height={32} {...sparklineProps} />
    </div>
  );
}

export default Sparkline;
