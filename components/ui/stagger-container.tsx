"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  staggerContainerVariants,
  staggerItemVariants,
  createStagger,
} from "@/lib/animations/presets";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

export interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Delay between each child animation in seconds (default: 0.05) */
  staggerChildren?: number;
  /** Initial delay before starting animations in seconds (default: 0.05) */
  delayChildren?: number;
}

export interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * StaggerContainer Component
 *
 * Container that animates its children with a staggered entrance effect.
 * Use with StaggerItem for list animations, card grids, or any sequential content.
 *
 * @example
 * ```tsx
 * <StaggerContainer>
 *   {items.map(item => (
 *     <StaggerItem key={item.id}>
 *       <Card>{item.content}</Card>
 *     </StaggerItem>
 *   ))}
 * </StaggerContainer>
 * ```
 */
export function StaggerContainer({
  children,
  className,
  staggerChildren = 0.05,
  delayChildren = 0.05,
}: StaggerContainerProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  // Use custom stagger timing if provided
  const variants =
    staggerChildren !== 0.05 || delayChildren !== 0.05
      ? createStagger(staggerChildren, delayChildren)
      : staggerContainerVariants;

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerItem Component
 *
 * Individual item within a StaggerContainer.
 * Each item will animate in sequence based on the container's stagger timing.
 *
 * @example
 * ```tsx
 * <StaggerItem>
 *   <Card>Content here</Card>
 * </StaggerItem>
 * ```
 */
export function StaggerItem({ children, className }: StaggerItemProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} variants={staggerItemVariants}>
      {children}
    </motion.div>
  );
}
