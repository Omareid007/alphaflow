"use client";

import * as React from "react";
import {
  motion,
  AnimatePresence,
  type Variants,
  type Transition,
} from "framer-motion";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

/**
 * Animation variant presets for page transitions
 */
export const pageTransitionVariants: Record<string, Variants> = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  slideDown: {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  slideLeft: {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  slideRight: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  scaleUp: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.1 },
  },
  blur: {
    hidden: { opacity: 0, filter: "blur(10px)" },
    visible: { opacity: 1, filter: "blur(0px)" },
    exit: { opacity: 0, filter: "blur(10px)" },
  },
  none: {
    hidden: {},
    visible: {},
    exit: {},
  },
};

/**
 * Transition presets for different animation feels
 */
export const transitionPresets: Record<string, Transition> = {
  fast: {
    type: "spring",
    stiffness: 400,
    damping: 30,
    mass: 0.5,
  },
  smooth: {
    type: "spring",
    stiffness: 300,
    damping: 25,
    mass: 0.8,
  },
  gentle: {
    type: "spring",
    stiffness: 200,
    damping: 20,
    mass: 1,
  },
  snappy: {
    duration: 0.2,
    ease: [0.16, 1, 0.3, 1],
  },
  easeOut: {
    duration: 0.3,
    ease: [0.16, 1, 0.3, 1],
  },
};

export type PageTransitionVariant = keyof typeof pageTransitionVariants;
export type TransitionPreset = keyof typeof transitionPresets;

export interface PageTransitionProps {
  children: React.ReactNode;
  /** CSS class name */
  className?: string;
  /** Animation variant to use */
  variant?: PageTransitionVariant;
  /** Transition timing preset */
  transition?: TransitionPreset;
  /** Custom transition override */
  customTransition?: Transition;
  /** Delay before animation starts (seconds) */
  delay?: number;
  /** Enable exit animations (requires AnimatePresence parent) */
  enableExit?: boolean;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
}

/**
 * PageTransition Component
 *
 * Wraps page content with smooth enter/exit animations.
 * Automatically respects user's prefers-reduced-motion setting.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <PageTransition>
 *   <YourPageContent />
 * </PageTransition>
 *
 * // With slide animation
 * <PageTransition variant="slideUp" transition="smooth">
 *   <YourPageContent />
 * </PageTransition>
 *
 * // With delay
 * <PageTransition delay={0.2}>
 *   <DelayedContent />
 * </PageTransition>
 *
 * // With exit animations (wrap parent in AnimatePresence)
 * <AnimatePresence mode="wait">
 *   <PageTransition key={pathname} enableExit>
 *     <RouteContent />
 *   </PageTransition>
 * </AnimatePresence>
 * ```
 */
export function PageTransition({
  children,
  className,
  variant = "slideUp",
  transition = "gentle",
  customTransition,
  delay = 0,
  enableExit = false,
  onAnimationComplete,
}: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  // Return static content for reduced motion
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const selectedVariants = pageTransitionVariants[variant];
  const selectedTransition = customTransition ?? transitionPresets[transition];
  const transitionWithDelay = {
    ...selectedTransition,
    delay,
  };

  const motionProps = enableExit
    ? {
        initial: "hidden",
        animate: "visible",
        exit: "exit",
      }
    : {
        initial: "hidden",
        animate: "visible",
      };

  return (
    <motion.div
      className={className}
      variants={selectedVariants}
      transition={transitionWithDelay}
      onAnimationComplete={onAnimationComplete}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}

/**
 * PageTransitionPresence Component
 *
 * Wrapper component that combines AnimatePresence with PageTransition
 * for easy route-based animations.
 *
 * @example
 * ```tsx
 * <PageTransitionPresence pathname={pathname}>
 *   <PageContent />
 * </PageTransitionPresence>
 * ```
 */
export interface PageTransitionPresenceProps extends Omit<
  PageTransitionProps,
  "enableExit"
> {
  /** Unique key for the page (typically pathname) */
  pageKey: string;
  /** AnimatePresence mode */
  mode?: "wait" | "sync" | "popLayout";
}

export function PageTransitionPresence({
  children,
  pageKey,
  mode = "wait",
  ...props
}: PageTransitionPresenceProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={props.className}>{children}</div>;
  }

  return (
    <AnimatePresence mode={mode}>
      <PageTransition key={pageKey} enableExit {...props}>
        {children}
      </PageTransition>
    </AnimatePresence>
  );
}

/**
 * SectionTransition Component
 *
 * Lighter-weight transition for individual sections within a page.
 *
 * @example
 * ```tsx
 * <SectionTransition delay={0.1}>
 *   <Section />
 * </SectionTransition>
 * ```
 */
export interface SectionTransitionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variant?: "fade" | "slideUp" | "scale";
}

export function SectionTransition({
  children,
  className,
  delay = 0,
  variant = "slideUp",
}: SectionTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const variants: Variants = {
    hidden: {
      opacity: 0,
      ...(variant === "slideUp" && { y: 12 }),
      ...(variant === "scale" && { scale: 0.98 }),
    },
    visible: {
      opacity: 1,
      ...(variant === "slideUp" && { y: 0 }),
      ...(variant === "scale" && { scale: 1 }),
    },
  };

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="visible"
      transition={{
        duration: 0.35,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
