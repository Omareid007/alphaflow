/**
 * Animation Library - Robinhood-style animations for AlphaFlow
 *
 * @module lib/animations
 */

// Hooks
export { useReducedMotion } from "./hooks/useReducedMotion";
export { useScrollProgress } from "./hooks/useScrollProgress";
export type {
  ScrollProgress,
  UseScrollProgressOptions,
  UseScrollProgressReturn,
} from "./hooks/useScrollProgress";

// Confetti
export { Confetti, useConfetti } from "./confetti";

// Stagger animations
export {
  StaggerList,
  StaggerItem,
  AnimateOnScroll,
  // Variants
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  slideInUp,
  staggerContainer,
  staggerContainerFast,
  staggerContainerSlow,
  staggerItem,
} from "./stagger";

// Shimmer loading effects
export {
  Shimmer,
  TextShimmer,
  CardShimmer,
  MetricCardShimmer,
  TableRowShimmer,
  AvatarShimmer,
  ChartShimmer,
} from "./shimmer";

// Page transitions
export {
  PageTransition,
  RouteTransition,
  SectionTransition,
  HeroTransition,
  ModalTransition,
  ScrollParallax,
  ScrollReveal,
  pageVariants,
} from "./page-transitions";
