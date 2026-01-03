"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import { useReducedMotion } from "./hooks/useReducedMotion";

/**
 * Preset animation variants for common patterns
 */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

export const slideInUp: Variants = {
  hidden: { y: "100%" },
  visible: { y: 0 },
};

/**
 * Container variants for staggered children
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

/**
 * Child item variants
 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

interface StaggerListProps {
  children: React.ReactNode;
  className?: string;
  speed?: "fast" | "normal" | "slow";
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Wrapper component for staggered list animations
 */
export function StaggerList({
  children,
  className,
  speed = "normal",
  as = "div",
}: StaggerListProps) {
  const prefersReducedMotion = useReducedMotion();
  const MotionComponent = motion[
    as as keyof typeof motion
  ] as typeof motion.div;

  const containerVariant = {
    fast: staggerContainerFast,
    normal: staggerContainer,
    slow: staggerContainerSlow,
  }[speed];

  if (prefersReducedMotion) {
    const Component = as;
    return <Component className={className}>{children}</Component>;
  }

  return (
    <MotionComponent
      className={className}
      variants={containerVariant}
      initial="hidden"
      animate="visible"
    >
      {children}
    </MotionComponent>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  variant?: Variants;
}

/**
 * Individual item in a stagger list
 */
export function StaggerItem({
  children,
  className,
  as = "div",
  variant = staggerItem,
}: StaggerItemProps) {
  const prefersReducedMotion = useReducedMotion();
  const MotionComponent = motion[
    as as keyof typeof motion
  ] as typeof motion.div;

  if (prefersReducedMotion) {
    const Component = as;
    return <Component className={className}>{children}</Component>;
  }

  return (
    <MotionComponent className={className} variants={variant}>
      {children}
    </MotionComponent>
  );
}

interface AnimateOnScrollProps {
  children: React.ReactNode;
  className?: string;
  variant?: Variants;
  once?: boolean;
  amount?: number | "some" | "all";
}

/**
 * Animate element when it enters the viewport
 */
export function AnimateOnScroll({
  children,
  className,
  variant = fadeInUp,
  once = true,
  amount = 0.3,
}: AnimateOnScrollProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={variant}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default StaggerList;
