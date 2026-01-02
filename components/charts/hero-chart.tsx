"use client";

import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

export interface HeroChartDataPoint {
  time: string | number;
  value: number;
  label?: string;
}

interface HeroChartProps {
  data: HeroChartDataPoint[];
  height?: number | string;
  showAxis?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  showReferenceLine?: boolean;
  referenceValue?: number;
  className?: string;
  gradientId?: string;
  animate?: boolean;
}

/**
 * Robinhood-style hero chart with gradient fill based on trend
 * Full-width, immersive chart for portfolio/stock display
 */
export function HeroChart({
  data,
  height = 300,
  showAxis = false,
  showGrid = false,
  showTooltip = true,
  showReferenceLine = true,
  referenceValue,
  className,
  gradientId,
  animate = true,
}: HeroChartProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animate && !prefersReducedMotion;

  // Calculate trend based on first and last values
  const firstValue = data[0]?.value ?? 0;
  const lastValue = data[data.length - 1]?.value ?? 0;
  const isPositive = lastValue >= firstValue;
  const refValue = referenceValue ?? firstValue;

  // Generate unique gradient ID
  const uniqueGradientId = gradientId || React.useId().replace(/:/g, "");
  const areaGradientId = `heroGradient-${uniqueGradientId}`;
  const lineGradientId = `heroLine-${uniqueGradientId}`;

  // Colors based on trend
  const colors = {
    stroke: isPositive ? "hsl(var(--gain))" : "hsl(var(--loss))",
    fill: isPositive ? "hsl(var(--gain))" : "hsl(var(--loss))",
    reference: "hsl(var(--muted-foreground))",
  };

  return (
    <motion.div
      className={cn("w-full relative", className)}
      style={{ height }}
      initial={shouldAnimate ? { opacity: 0 } : undefined}
      animate={shouldAnimate ? { opacity: 1 } : undefined}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Gradient background overlay */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none",
          isPositive ? "bg-gradient-to-t from-gain/5 to-transparent" : "bg-gradient-to-t from-loss/5 to-transparent"
        )}
      />

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            {/* Area fill gradient */}
            <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.fill} stopOpacity={0.3} />
              <stop offset="50%" stopColor={colors.fill} stopOpacity={0.1} />
              <stop offset="100%" stopColor={colors.fill} stopOpacity={0} />
            </linearGradient>
            {/* Line gradient for glow effect */}
            <linearGradient id={lineGradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={colors.stroke} stopOpacity={0.5} />
              <stop offset="50%" stopColor={colors.stroke} stopOpacity={1} />
              <stop offset="100%" stopColor={colors.stroke} stopOpacity={1} />
            </linearGradient>
          </defs>

          {showAxis && (
            <>
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickMargin={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
                width={60}
              />
            </>
          )}

          {showReferenceLine && (
            <ReferenceLine
              y={refValue}
              stroke={colors.reference}
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
          )}

          {showTooltip && (
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const value = payload[0].value as number;
                const change = value - refValue;
                const changePercent = ((change / refValue) * 100).toFixed(2);
                const isUp = change >= 0;

                return (
                  <div className="glass rounded-lg border border-white/10 px-3 py-2 shadow-xl">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-semibold tabular-nums">
                      ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p
                      className={cn(
                        "text-sm font-medium tabular-nums",
                        isUp ? "text-gain" : "text-loss"
                      )}
                    >
                      {isUp ? "+" : ""}
                      {change.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({isUp ? "+" : ""}{changePercent}%)
                    </p>
                  </div>
                );
              }}
              cursor={{
                stroke: colors.stroke,
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />
          )}

          <Area
            type="monotone"
            dataKey="value"
            stroke={`url(#${lineGradientId})`}
            strokeWidth={2}
            fill={`url(#${areaGradientId})`}
            animationDuration={shouldAnimate ? 1000 : 0}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export default HeroChart;
