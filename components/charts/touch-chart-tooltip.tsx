"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

interface TouchChartTooltipProps {
  active?: boolean;
  x?: number;
  y?: number;
  value?: number;
  label?: string;
  change?: number;
  changePercent?: number;
  containerRef?: React.RefObject<HTMLDivElement>;
  className?: string;
}

/**
 * Touch-friendly chart tooltip that follows cursor/touch position
 * Robinhood-style floating tooltip with glassmorphism
 */
export function TouchChartTooltip({
  active,
  x = 0,
  y = 0,
  value,
  label,
  change,
  changePercent,
  containerRef,
  className,
}: TouchChartTooltipProps) {
  const prefersReducedMotion = useReducedMotion();
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  // Calculate position to keep tooltip within bounds
  React.useEffect(() => {
    if (!active || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const container = containerRef?.current;
    const tooltipRect = tooltip.getBoundingClientRect();

    let newX = x;
    let newY = y - tooltipRect.height - 16; // Position above cursor

    // Keep within container bounds
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const relativeX = x - containerRect.left;
      const relativeY = y - containerRect.top;

      // Horizontal bounds
      if (relativeX + tooltipRect.width / 2 > containerRect.width) {
        newX = containerRect.right - tooltipRect.width / 2 - 8;
      } else if (relativeX - tooltipRect.width / 2 < 0) {
        newX = containerRect.left + tooltipRect.width / 2 + 8;
      }

      // If tooltip would go above container, show below cursor
      if (relativeY - tooltipRect.height - 16 < 0) {
        newY = y + 16;
      }
    }

    setPosition({ x: newX, y: newY });
  }, [active, x, y, containerRef]);

  const isPositive = (change ?? 0) >= 0;

  return (
    <AnimatePresence>
      {active && value !== undefined && (
        <motion.div
          ref={tooltipRef}
          className={cn(
            "fixed z-50 pointer-events-none",
            "glass rounded-xl border border-white/10 px-4 py-3 shadow-2xl",
            "min-w-[140px] text-center",
            className
          )}
          style={{
            left: position.x,
            top: position.y,
            transform: "translate(-50%, 0)",
          }}
          initial={
            prefersReducedMotion
              ? { opacity: 1 }
              : { opacity: 0, y: 10, scale: 0.95 }
          }
          animate={
            prefersReducedMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0, scale: 1 }
          }
          exit={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 10, scale: 0.95 }
          }
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Tooltip arrow */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-card/80 rotate-45 border-b border-r border-white/10"
            style={{ bottom: -6 }}
          />

          {label && (
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
          )}

          <p className="text-xl font-bold tabular-nums">
            ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>

          {(change !== undefined || changePercent !== undefined) && (
            <p
              className={cn(
                "text-sm font-medium tabular-nums mt-1",
                isPositive ? "text-gain" : "text-loss"
              )}
            >
              {change !== undefined && (
                <span>
                  {isPositive ? "+" : ""}$
                  {Math.abs(change).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              )}
              {changePercent !== undefined && (
                <span className="ml-1">
                  ({isPositive ? "+" : ""}
                  {changePercent.toFixed(2)}%)
                </span>
              )}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook for handling touch/mouse interactions on charts
 */
interface UseTouchChartOptions {
  data: Array<{ value: number; [key: string]: unknown }>;
  containerRef: React.RefObject<HTMLDivElement>;
  referenceValue?: number;
}

interface TouchState {
  active: boolean;
  index: number;
  x: number;
  y: number;
  value: number;
  change: number;
  changePercent: number;
}

export function useTouchChart({
  data,
  containerRef,
  referenceValue,
}: UseTouchChartOptions) {
  const [touchState, setTouchState] = React.useState<TouchState>({
    active: false,
    index: 0,
    x: 0,
    y: 0,
    value: 0,
    change: 0,
    changePercent: 0,
  });

  const refValue = referenceValue ?? data[0]?.value ?? 0;

  const handleInteraction = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current || !data.length) return;

      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, relativeX / rect.width));
      const index = Math.round(percentage * (data.length - 1));
      const dataPoint = data[index];

      if (dataPoint) {
        const value = dataPoint.value;
        const change = value - refValue;
        const changePercent = refValue !== 0 ? (change / refValue) * 100 : 0;

        setTouchState({
          active: true,
          index,
          x: clientX,
          y: clientY,
          value,
          change,
          changePercent,
        });
      }
    },
    [data, containerRef, refValue]
  );

  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleInteraction(touch.clientX, touch.clientY);
    },
    [handleInteraction]
  );

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleInteraction(touch.clientX, touch.clientY);
    },
    [handleInteraction]
  );

  const handleTouchEnd = React.useCallback(() => {
    setTouchState((prev) => ({ ...prev, active: false }));
  }, []);

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      handleInteraction(e.clientX, e.clientY);
    },
    [handleInteraction]
  );

  const handleMouseLeave = React.useCallback(() => {
    setTouchState((prev) => ({ ...prev, active: false }));
  }, []);

  return {
    touchState,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
  };
}

export default TouchChartTooltip;
