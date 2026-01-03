"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

/**
 * Direction presets for stagger animations
 */
export type StaggerDirection = "up" | "down" | "left" | "right" | "scale" | "fade";

/**
 * Speed presets for stagger timing
 */
export type StaggerSpeed = "fast" | "normal" | "slow";

const staggerTimings: Record<StaggerSpeed, { staggerChildren: number; delayChildren: number }> = {
  fast: { staggerChildren: 0.03, delayChildren: 0.02 },
  normal: { staggerChildren: 0.05, delayChildren: 0.05 },
  slow: { staggerChildren: 0.1, delayChildren: 0.1 },
};

const directionVariants: Record<StaggerDirection, { hidden: object; visible: object }> = {
  up: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  },
  down: {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
  },
  left: {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
  },
  right: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
};

export interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Delay between each child animation in seconds */
  staggerChildren?: number;
  /** Initial delay before starting animations in seconds */
  delayChildren?: number;
  /** Speed preset (overridden by staggerChildren/delayChildren) */
  speed?: StaggerSpeed;
  /** Direction of item entrance animation */
  direction?: StaggerDirection;
  /** HTML element to render as */
  as?: keyof JSX.IntrinsicElements;
  /** Animate when in viewport (scroll-triggered) */
  animateInView?: boolean;
  /** Viewport options for animateInView */
  viewportOnce?: boolean;
  /** Viewport amount for trigger (0-1) */
  viewportAmount?: number;
}

export interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
  /** Override direction for this specific item */
  direction?: StaggerDirection;
  /** Custom animation distance */
  distance?: number;
}

/**
 * StaggerContainer Component
 *
 * Container that animates its children with a staggered entrance effect.
 * Use with StaggerItem for list animations, card grids, or any sequential content.
 * Automatically respects user's prefers-reduced-motion setting.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <StaggerContainer>
 *   {items.map(item => (
 *     <StaggerItem key={item.id}>
 *       <Card>{item.content}</Card>
 *     </StaggerItem>
 *   ))}
 * </StaggerContainer>
 *
 * // With direction and speed
 * <StaggerContainer direction="left" speed="fast">
 *   <StaggerItem><Card /></StaggerItem>
 *   <StaggerItem><Card /></StaggerItem>
 * </StaggerContainer>
 *
 * // Animate when scrolled into view
 * <StaggerContainer animateInView viewportOnce>
 *   <StaggerItem><Card /></StaggerItem>
 * </StaggerContainer>
 *
 * // As a list element
 * <StaggerContainer as="ul">
 *   <StaggerItem as="li"><ListItem /></StaggerItem>
 * </StaggerContainer>
 * ```
 */
export function StaggerContainer({
  children,
  className,
  staggerChildren,
  delayChildren,
  speed = "normal",
  direction = "up",
  as = "div",
  animateInView = false,
  viewportOnce = true,
  viewportAmount = 0.2,
}: StaggerContainerProps) {
  const prefersReducedMotion = useReducedMotion();

  // Return non-animated version for reduced motion
  if (prefersReducedMotion) {
    const Component = as;
    return <Component className={className}>{children}</Component>;
  }

  const timing = staggerTimings[speed];
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerChildren ?? timing.staggerChildren,
        delayChildren: delayChildren ?? timing.delayChildren,
      },
    },
  };

  // Create MotionComponent dynamically
  const MotionComponent = motion[as as keyof typeof motion] as typeof motion.div;

  // Store direction in context for child items
  const contextValue = React.useMemo(() => ({ direction }), [direction]);

  const animateProps = animateInView
    ? {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: viewportOnce, amount: viewportAmount },
      }
    : {
        initial: "hidden",
        animate: "visible",
      };

  return (
    <StaggerContext.Provider value={contextValue}>
      <MotionComponent
        className={className}
        variants={containerVariants}
        {...animateProps}
      >
        {children}
      </MotionComponent>
    </StaggerContext.Provider>
  );
}

// Context to pass direction to children
const StaggerContext = React.createContext<{ direction: StaggerDirection }>({
  direction: "up",
});

/**
 * StaggerItem Component
 *
 * Individual item within a StaggerContainer.
 * Each item will animate in sequence based on the container's stagger timing.
 * Automatically respects user's prefers-reduced-motion setting.
 *
 * @example
 * ```tsx
 * <StaggerItem>
 *   <Card>Content here</Card>
 * </StaggerItem>
 *
 * // With custom direction
 * <StaggerItem direction="scale">
 *   <Card>Different animation</Card>
 * </StaggerItem>
 * ```
 */
export function StaggerItem({
  children,
  className,
  direction: itemDirection,
  distance,
}: StaggerItemProps & { as?: keyof JSX.IntrinsicElements }) {
  const prefersReducedMotion = useReducedMotion();
  const { direction: containerDirection } = React.useContext(StaggerContext);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const direction = itemDirection ?? containerDirection;
  const baseVariant = directionVariants[direction];

  // Apply custom distance if provided
  const variants: Variants = {
    hidden: {
      ...baseVariant.hidden,
      ...(distance !== undefined && direction === "up" && { y: distance }),
      ...(distance !== undefined && direction === "down" && { y: -distance }),
      ...(distance !== undefined && direction === "left" && { x: distance }),
      ...(distance !== undefined && direction === "right" && { x: -distance }),
    },
    visible: {
      ...baseVariant.visible,
      transition: {
        duration: 0.25,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}

/**
 * useStaggerItems Hook
 *
 * Utility hook for creating stagger delays manually.
 * Useful when you need more control over individual item timing.
 *
 * @example
 * ```tsx
 * const { getDelay } = useStaggerItems({ count: items.length });
 *
 * {items.map((item, index) => (
 *   <motion.div
 *     key={item.id}
 *     initial={{ opacity: 0 }}
 *     animate={{ opacity: 1 }}
 *     transition={{ delay: getDelay(index) }}
 *   >
 *     {item.content}
 *   </motion.div>
 * ))}
 * ```
 */
export function useStaggerItems({
  count,
  staggerDelay = 0.05,
  initialDelay = 0,
}: {
  count: number;
  staggerDelay?: number;
  initialDelay?: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  const getDelay = React.useCallback(
    (index: number) => {
      if (prefersReducedMotion) return 0;
      return initialDelay + index * staggerDelay;
    },
    [prefersReducedMotion, initialDelay, staggerDelay]
  );

  return {
    getDelay,
    totalDuration: initialDelay + count * staggerDelay,
    prefersReducedMotion,
  };
}

export default StaggerContainer;
