"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

interface LoadingDotsProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-1 w-1",
  md: "h-1.5 w-1.5",
  lg: "h-2 w-2",
};

/**
 * LoadingDots - Animated loading indicator with 3 bouncing dots
 * Modern alternative to spinner for inline loading states
 *
 * @example
 * <Button disabled={isLoading}>
 *   {isLoading ? <LoadingDots /> : "Submit"}
 * </Button>
 */
export function LoadingDots({ className, size = "md" }: LoadingDotsProps) {
  const prefersReducedMotion = useReducedMotion();

  const dotClassName = cn("rounded-full bg-current", sizeMap[size], className);

  if (prefersReducedMotion) {
    return (
      <div className="flex items-center gap-1">
        <div className={dotClassName} />
        <div className={dotClassName} />
        <div className={dotClassName} />
      </div>
    );
  }

  const bounceTransition = {
    duration: 0.6,
    repeat: Infinity,
    ease: "easeInOut" as const,
  };

  return (
    <div className="flex items-center gap-1">
      <motion.div
        className={dotClassName}
        animate={{ y: [0, -8, 0] }}
        transition={{ ...bounceTransition, delay: 0 }}
      />
      <motion.div
        className={dotClassName}
        animate={{ y: [0, -8, 0] }}
        transition={{ ...bounceTransition, delay: 0.2 }}
      />
      <motion.div
        className={dotClassName}
        animate={{ y: [0, -8, 0] }}
        transition={{ ...bounceTransition, delay: 0.4 }}
      />
    </div>
  );
}
