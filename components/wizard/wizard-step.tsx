"use client";

import { ReactNode } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface WizardStepProps {
  /**
   * Step content
   */
  children: ReactNode;

  /**
   * Unique key for the step (used for AnimatePresence transitions)
   */
  stepKey: string | number;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Custom animation direction
   * @default "forward"
   */
  direction?: "forward" | "backward";
}

/**
 * Animated wrapper for individual wizard steps
 * Handles enter/exit animations with reduced motion support
 */
export function WizardStep({
  children,
  stepKey,
  className,
  direction = "forward",
}: WizardStepProps) {
  const prefersReducedMotion = useReducedMotion();

  // Animation variants
  const variants: Variants = prefersReducedMotion
    ? {
        enter: { opacity: 1 },
        exit: { opacity: 0 },
        initial: { opacity: 0 },
      }
    : {
        enter: {
          x: 0,
          opacity: 1,
          transition: {
            duration: 0.3,
            ease: [0.4, 0.0, 0.2, 1], // Custom easing
          },
        },
        exit: {
          x: direction === "forward" ? -20 : 20,
          opacity: 0,
          transition: {
            duration: 0.2,
            ease: [0.4, 0.0, 0.2, 1],
          },
        },
        initial: {
          x: direction === "forward" ? 20 : -20,
          opacity: 0,
        },
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        variants={variants}
        initial="initial"
        animate="enter"
        exit="exit"
        className={cn("w-full", className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
