import { useEffect, useState, useCallback, useRef, RefObject } from "react";

/**
 * Scroll progress tracking result
 */
export interface ScrollProgress {
  /** Scroll progress from 0 to 1 */
  progress: number;
  /** Whether the page is currently being scrolled */
  isScrolling: boolean;
  /** Current vertical scroll position in pixels */
  scrollY: number;
}

interface UseScrollProgressOptions {
  /** Optional element ref for scoped scroll tracking. If not provided, tracks window scroll */
  element?: RefObject<HTMLElement>;
  /** Throttle delay in milliseconds (default: 16ms for ~60fps) */
  throttleMs?: number;
  /** Callback when scrolling stops (debounced) */
  onScrollEnd?: () => void;
  /** Debounce delay for scroll end detection in milliseconds (default: 150ms) */
  debounceMs?: number;
}

/**
 * Hook to track scroll progress on the page or within a specific element
 *
 * @example
 * ```tsx
 * // Track page scroll
 * const { progress, isScrolling, scrollY } = useScrollProgress();
 *
 * // Track scroll within a specific element
 * const ref = useRef<HTMLDivElement>(null);
 * const { progress } = useScrollProgress({ element: ref });
 *
 * // With scroll end callback
 * const { progress } = useScrollProgress({
 *   onScrollEnd: () => console.log('Scrolling stopped'),
 *   debounceMs: 200
 * });
 * ```
 *
 * @param options - Configuration options
 * @returns Scroll progress state
 */
export function useScrollProgress(
  options: UseScrollProgressOptions = {}
): ScrollProgress {
  const { element, throttleMs = 16, onScrollEnd, debounceMs = 150 } = options;

  const [state, setState] = useState<ScrollProgress>({
    progress: 0,
    isScrolling: false,
    scrollY: 0,
  });

  const scrollEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  /**
   * Calculate scroll progress for the target element or window
   */
  const calculateProgress = useCallback((): ScrollProgress => {
    if (typeof window === "undefined") {
      return { progress: 0, isScrolling: false, scrollY: 0 };
    }

    let scrollY: number;
    let scrollHeight: number;
    let clientHeight: number;

    if (element?.current) {
      // Scoped scroll tracking within element
      const el = element.current;
      scrollY = el.scrollTop;
      scrollHeight = el.scrollHeight;
      clientHeight = el.clientHeight;
    } else {
      // Global window scroll tracking
      scrollY = window.scrollY || window.pageYOffset;
      scrollHeight = document.documentElement.scrollHeight;
      clientHeight = window.innerHeight;
    }

    // Calculate progress (0 to 1)
    const maxScroll = scrollHeight - clientHeight;
    const progress = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0;

    return {
      progress,
      isScrolling: true,
      scrollY,
    };
  }, [element]);

  /**
   * Throttled scroll handler using requestAnimationFrame
   */
  const handleScroll = useCallback(() => {
    const now = Date.now();

    // Throttle using timestamp comparison
    if (now - lastScrollTimeRef.current < throttleMs) {
      return;
    }

    lastScrollTimeRef.current = now;

    // Cancel any pending RAF to avoid duplicate updates
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    // Use RAF for smooth updates synchronized with browser repaints
    rafRef.current = requestAnimationFrame(() => {
      const newState = calculateProgress();
      setState(newState);

      // Clear existing scroll end timeout
      if (scrollEndTimeoutRef.current !== null) {
        clearTimeout(scrollEndTimeoutRef.current);
      }

      // Set new scroll end timeout (debounced)
      scrollEndTimeoutRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, isScrolling: false }));
        onScrollEnd?.();
      }, debounceMs);
    });
  }, [calculateProgress, throttleMs, debounceMs, onScrollEnd]);

  useEffect(() => {
    // Skip in SSR
    if (typeof window === "undefined") {
      return;
    }

    // Calculate initial scroll position
    const initialState = calculateProgress();
    setState({ ...initialState, isScrolling: false });

    // Determine scroll target
    const scrollTarget = element?.current || window;

    // Add scroll event listener
    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });

    // Cleanup
    return () => {
      scrollTarget.removeEventListener("scroll", handleScroll);

      // Clear any pending timeouts/RAF
      if (scrollEndTimeoutRef.current !== null) {
        clearTimeout(scrollEndTimeoutRef.current);
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [element, handleScroll, calculateProgress]);

  return state;
}
