"use client";

import { motion, type Variants } from "framer-motion";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface LoadingDotsProps {
  /**
   * Size of the dots
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Color variant
   * @default "primary"
   */
  variant?: "primary" | "muted" | "white";
}

/**
 * Animated loading dots indicator
 * Shows three dots with a wave animation
 */
export function LoadingDots({
  size = "md",
  className,
  variant = "primary",
}: LoadingDotsProps) {
  const prefersReducedMotion = useReducedMotion();

  const sizeClasses = {
    sm: "h-1 w-1",
    md: "h-2 w-2",
    lg: "h-3 w-3",
  };

  const variantClasses = {
    primary: "bg-primary",
    muted: "bg-muted-foreground",
    white: "bg-white",
  };

  const dotVariants: Variants = prefersReducedMotion
    ? {
        loading: {
          opacity: [0.3, 1, 0.3],
          transition: {
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
          },
        },
      }
    : {
        loading: {
          y: [0, -8, 0],
          transition: {
            duration: 0.6,
            repeat: Infinity,
            ease: "easeInOut",
          },
        },
      };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={cn(
            "rounded-full",
            sizeClasses[size],
            variantClasses[variant]
          )}
          variants={dotVariants}
          animate="loading"
          transition={{
            delay: index * 0.15,
          }}
        />
      ))}
    </div>
  );
}
