/**
 * Framer Motion Animation Presets
 *
 * Centralized animation configurations for consistent UX across the platform.
 * All animations respect user's prefers-reduced-motion setting.
 */

import { Variants, Transition } from "framer-motion";

// ============================================================================
// TRANSITION PRESETS
// ============================================================================

export const transitions = {
  // Quick interactions (buttons, hovers)
  fast: {
    type: "spring" as const,
    stiffness: 400,
    damping: 30,
    mass: 0.5,
  },

  // Standard UI transitions (modals, dropdowns)
  smooth: {
    type: "spring" as const,
    stiffness: 300,
    damping: 25,
    mass: 0.8,
  },

  // Slow, deliberate (page transitions)
  gentle: {
    type: "spring" as const,
    stiffness: 200,
    damping: 20,
    mass: 1,
  },

  // Elastic bounce effect
  bouncy: {
    type: "spring" as const,
    stiffness: 500,
    damping: 15,
    mass: 1,
  },

  // Easing-based (for simple animations)
  ease: {
    duration: 0.2,
    ease: [0.4, 0.0, 0.2, 1] as [number, number, number, number],
  },
} satisfies Record<string, Transition>;

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

/**
 * Fade in/out
 */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Slide from bottom (mobile sheet style)
 */
export const slideUpVariants: Variants = {
  hidden: { y: "100%", opacity: 0 },
  visible: { y: 0, opacity: 1 },
  exit: { y: "100%", opacity: 0 },
};

/**
 * Slide from top (notifications)
 */
export const slideDownVariants: Variants = {
  hidden: { y: "-100%", opacity: 0 },
  visible: { y: 0, opacity: 1 },
  exit: { y: "-100%", opacity: 0 },
};

/**
 * Slide from right (drawer/sidebar)
 */
export const slideLeftVariants: Variants = {
  hidden: { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1 },
  exit: { x: "100%", opacity: 0 },
};

/**
 * Scale up (modals, dialogs)
 */
export const scaleVariants: Variants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: { scale: 1, opacity: 1 },
  exit: { scale: 0.9, opacity: 0 },
};

/**
 * Page transitions (subtle up movement)
 */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

/**
 * Stagger children (list items)
 */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Card hover effect (subtle lift + shadow)
 */
export const cardHoverVariants = {
  initial: { scale: 1, y: 0 },
  hover: {
    scale: 1.02,
    y: -4,
    transition: transitions.fast,
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 },
  },
};

/**
 * Button press effect
 */
export const buttonPressVariants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.02,
    transition: transitions.fast,
  },
  tap: {
    scale: 0.95,
    transition: { duration: 0.1 },
  },
};

// ============================================================================
// SPRING PRESETS (for manual use)
// ============================================================================

export const springs = {
  // Snappy response
  snappy: {
    type: "spring" as const,
    stiffness: 500,
    damping: 30,
  },

  // Smooth animation
  smooth: {
    type: "spring" as const,
    stiffness: 300,
    damping: 25,
  },

  // Gentle animation
  gentle: {
    type: "spring" as const,
    stiffness: 200,
    damping: 20,
  },

  // Bouncy animation
  bouncy: {
    type: "spring" as const,
    stiffness: 400,
    damping: 12,
  },
};

// ============================================================================
// GESTURE CONFIGURATIONS
// ============================================================================

export const gestures = {
  // Drag constraints
  dragConstraints: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Whilehover for cards
  cardHover: {
    scale: 1.02,
    y: -4,
    transition: transitions.fast,
  },

  // Whiletap for buttons
  buttonTap: {
    scale: 0.95,
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get animation preset based on user's motion preference
 */
export function getMotionPreset(
  variant: "page" | "fade" | "slide" | "scale" | "stagger",
  prefersReducedMotion: boolean = false
): Variants {
  if (prefersReducedMotion) {
    // Return immediate transitions if user prefers reduced motion
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.01 } },
      exit: { opacity: 0, transition: { duration: 0.01 } },
    };
  }

  switch (variant) {
    case "page":
      return pageVariants;
    case "fade":
      return fadeVariants;
    case "slide":
      return slideUpVariants;
    case "scale":
      return scaleVariants;
    case "stagger":
      return staggerContainerVariants;
    default:
      return fadeVariants;
  }
}

/**
 * Create a custom stagger configuration
 */
export function createStagger(
  staggerChildren: number = 0.05,
  delayChildren: number = 0
): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren,
        delayChildren,
      },
    },
  };
}
