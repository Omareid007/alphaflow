"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { pageVariants, transitions } from "@/lib/animations/presets";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

export interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageTransition Component
 *
 * Wraps page content with smooth enter/exit animations.
 * Automatically respects user's prefers-reduced-motion setting.
 *
 * @example
 * ```tsx
 * <PageTransition>
 *   <YourPageContent />
 * </PageTransition>
 * ```
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={pageVariants}
      transition={transitions.gentle}
    >
      {children}
    </motion.div>
  );
}
