"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  useScroll,
  useTransform,
  useMotionValue,
  type MotionValue,
} from "framer-motion";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Options for the useScrollProgress hook
 */
export interface UseScrollProgressOptions {
  /**
   * Target element ref (defaults to window/document)
   * When provided, tracks scroll within that element
   */
  target?: React.RefObject<HTMLElement>;

  /**
   * Container element for scroll tracking
   * Used with Framer Motion's useScroll container option
   */
  container?: React.RefObject<HTMLElement>;

  /**
   * Offset from start/end for tracking (in pixels or viewport units)
   * @default 0
   */
  offset?: number;

  /**
   * Enable smoothing for the progress value
   * When true, uses spring physics for smoother value changes
   * @default false
   */
  smooth?: boolean;

  /**
   * Axis to track scroll progress on
   * @default 'y'
   */
  axis?: "x" | "y";

  /**
   * Custom scroll offsets for Framer Motion's useScroll
   * Accepts Framer Motion's ScrollOffset format
   * @example ["start end", "end start"] or [[0, 0], [1, 1]]
   * @see https://www.framer.com/motion/use-scroll/#scroll-offsets
   */
  scrollOffset?: Parameters<typeof useScroll>[0] extends { offset?: infer T }
    ? T
    : never;
}

/**
 * Return type for the useScrollProgress hook
 */
export interface UseScrollProgressReturn {
  /**
   * Current scroll progress from 0 to 1
   * This is a static number value (updates on scroll)
   */
  progress: number;

  /**
   * Framer Motion MotionValue for scroll progress (0-1)
   * Use this for direct binding to motion components for optimal performance
   *
   * @example
   * <motion.div style={{ opacity: scrollProgress }} />
   */
  scrollProgress: MotionValue<number>;

  /**
   * Raw scroll position MotionValue (in pixels)
   * Useful for custom transformations
   */
  scrollPosition: MotionValue<number>;

  /**
   * Whether the target element is currently in view
   * For window scrolling, this is always true
   */
  isInView: boolean;

  /**
   * Current scroll direction
   * 'none' when not scrolling or at initial position
   */
  direction: "up" | "down" | "left" | "right" | "none";

  /**
   * Whether the user is currently scrolling
   */
  isScrolling: boolean;
}

// Legacy export for backward compatibility
export interface ScrollProgress {
  progress: number;
  isScrolling: boolean;
  scrollY: number;
}

/**
 * useScrollProgress Hook
 *
 * Track scroll progress for scroll-linked animations.
 * Returns values 0-1 representing scroll position.
 *
 * Uses Framer Motion's useScroll and useTransform for optimal performance
 * with hardware-accelerated animations. Respects prefers-reduced-motion
 * accessibility setting.
 *
 * @param options - Configuration options
 * @returns Object containing progress values and scroll state
 *
 * @example
 * // Basic window scroll tracking
 * ```tsx
 * function ScrollProgressBar() {
 *   const { scrollProgress } = useScrollProgress();
 *
 *   return (
 *     <motion.div
 *       className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left"
 *       style={{ scaleX: scrollProgress }}
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * // Track scroll within a container element
 * ```tsx
 * function ScrollableContainer() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const { progress, isInView, direction } = useScrollProgress({
 *     target: containerRef,
 *   });
 *
 *   return (
 *     <div ref={containerRef} className="overflow-auto h-96">
 *       <div>Scroll progress: {(progress * 100).toFixed(0)}%</div>
 *       <div>Direction: {direction}</div>
 *       {/* Long content... *\/}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * // Parallax effect with scroll progress
 * ```tsx
 * function ParallaxHero() {
 *   const { scrollProgress } = useScrollProgress();
 *   const y = useTransform(scrollProgress, [0, 1], [0, -200]);
 *   const opacity = useTransform(scrollProgress, [0, 0.5], [1, 0]);
 *
 *   return (
 *     <motion.div style={{ y, opacity }} className="hero-background" />
 *   );
 * }
 * ```
 *
 * @example
 * // Scroll-linked color transition
 * ```tsx
 * function ColorTransition() {
 *   const { scrollProgress } = useScrollProgress();
 *   const backgroundColor = useTransform(
 *     scrollProgress,
 *     [0, 0.5, 1],
 *     ['#00D395', '#1DB954', '#00A67E']
 *   );
 *
 *   return <motion.div style={{ backgroundColor }} />;
 * }
 * ```
 *
 * @example
 * // Horizontal scroll tracking
 * ```tsx
 * function HorizontalScroller() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const { progress } = useScrollProgress({
 *     target: containerRef,
 *     axis: 'x',
 *   });
 *
 *   return (
 *     <div ref={containerRef} className="overflow-x-auto flex">
 *       <div>Horizontal progress: {progress}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useScrollProgress(
  options: UseScrollProgressOptions = {}
): UseScrollProgressReturn {
  const {
    target,
    container,
    offset = 0,
    smooth = false,
    axis = "y",
    scrollOffset,
  } = options;

  // Check for reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  // Track scroll state
  const [isInView, setIsInView] = useState(true);
  const [direction, setDirection] = useState<
    "up" | "down" | "left" | "right" | "none"
  >("none");
  const [isScrolling, setIsScrolling] = useState(false);
  const [progressValue, setProgressValue] = useState(0);

  // Store previous scroll position to determine direction
  const prevScrollRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Framer Motion scroll hooks
  const scrollOptions = useMemo(() => {
    const opts: Parameters<typeof useScroll>[0] = {};

    if (target?.current) {
      // Track scroll of a specific element
      opts.target = target;
    }

    if (container?.current) {
      opts.container = container;
    }

    if (scrollOffset) {
      opts.offset = scrollOffset;
    }

    return opts;
  }, [target, container, scrollOffset]);

  const { scrollX, scrollY, scrollXProgress, scrollYProgress } =
    useScroll(scrollOptions);

  // Select appropriate scroll values based on axis
  const scrollPosition = axis === "x" ? scrollX : scrollY;
  const rawScrollProgress = axis === "x" ? scrollXProgress : scrollYProgress;

  // Create a static motion value for reduced motion fallback
  const staticMotionValue = useMotionValue(0);

  // Apply offset transformation if needed
  const scrollProgress = useTransform(rawScrollProgress, (value) => {
    if (prefersReducedMotion) {
      return 0;
    }

    // Apply offset if specified
    if (offset > 0) {
      const adjusted = Math.max(0, value - offset / 100);
      return Math.min(1, adjusted / (1 - offset / 100));
    }

    return value;
  });

  // Update progress value for static access
  useEffect(() => {
    const unsubscribe = scrollProgress.on("change", (value) => {
      setProgressValue(value);
    });

    return () => unsubscribe();
  }, [scrollProgress]);

  // Track scroll direction and scrolling state
  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const unsubscribe = scrollPosition.on("change", (currentScroll) => {
      const prevScroll = prevScrollRef.current;

      // Determine direction
      if (currentScroll > prevScroll) {
        setDirection(axis === "x" ? "right" : "down");
      } else if (currentScroll < prevScroll) {
        setDirection(axis === "x" ? "left" : "up");
      }

      prevScrollRef.current = currentScroll;

      // Mark as scrolling
      setIsScrolling(true);

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set scrolling to false after a delay
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
        setDirection("none");
      }, 150);
    });

    return () => {
      unsubscribe();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [scrollPosition, axis, prefersReducedMotion]);

  // Track element visibility using IntersectionObserver
  useEffect(() => {
    if (!target?.current || typeof window === "undefined") {
      // Window scrolling - always in view
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(target.current);

    return () => {
      observer.disconnect();
    };
  }, [target]);

  // Return static values if user prefers reduced motion
  if (prefersReducedMotion) {
    return {
      progress: 0,
      scrollProgress: staticMotionValue,
      scrollPosition: staticMotionValue,
      isInView: true,
      direction: "none",
      isScrolling: false,
    };
  }

  return {
    progress: progressValue,
    scrollProgress,
    scrollPosition,
    isInView,
    direction,
    isScrolling,
  };
}

export default useScrollProgress;
