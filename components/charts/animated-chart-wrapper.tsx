"use client";

import * as React from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { AlertCircle, RefreshCw, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";
import { ShimmerChart } from "@/components/ui/shimmer";
import { Button } from "@/components/ui/button";

export interface AnimatedChartWrapperProps {
  /** Chart component(s) to render */
  children: React.ReactNode;
  /** Loading state - shows ShimmerChart skeleton */
  isLoading?: boolean;
  /** Error state - shows error UI */
  error?: Error | string | null;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Height of the chart container */
  height?: number | string;
  /** Animate when scrolled into view */
  animateOnScroll?: boolean;
  /** Viewport amount for scroll trigger (0-1) */
  viewportAmount?: number;
  /** Only animate once when scrolling into view */
  animateOnce?: boolean;
  /** Chart name for error display */
  chartName?: string;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Delay before showing content (for coordinated animations) */
  delay?: number;
  /**
   * Accessible label describing chart data (WCAG 2.1 AA)
   * Required for screen reader users to understand chart content
   */
  ariaLabel?: string;
}

/**
 * Animation variants for chart entrance
 */
const chartVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 25,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.15,
    },
  },
};

/**
 * Animation variants for loading state
 */
const loadingVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

/**
 * Animation variants for error state
 */
const errorVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
  },
};

/**
 * Default error display component
 */
function DefaultErrorDisplay({
  error,
  chartName,
  onRetry,
  height,
}: {
  error: Error | string;
  chartName?: string;
  onRetry?: () => void;
  height?: number | string;
}) {
  const errorMessage = typeof error === "string" ? error : error.message;

  return (
    <div
      className={cn(
        "w-full flex flex-col items-center justify-center gap-3",
        "bg-muted/30 rounded-xl border border-dashed border-muted-foreground/20"
      )}
      style={{ height: height || 300 }}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-5 w-5" />
        <TrendingUp className="h-5 w-5 opacity-50" />
      </div>
      <div className="text-center px-4">
        <p className="text-sm font-medium text-muted-foreground">
          {chartName ? `${chartName} unavailable` : "Chart unavailable"}
        </p>
        {errorMessage && (
          <p className="mt-1 text-xs text-muted-foreground/70 max-w-xs">
            {errorMessage}
          </p>
        )}
      </div>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="text-xs">
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * AnimatedChartWrapper Component
 *
 * Wrapper for Recharts and other chart libraries with entrance animations,
 * loading states, and error handling.
 * Respects user's prefers-reduced-motion accessibility setting.
 *
 * @example
 * ```tsx
 * // Basic usage with loading and error states
 * <AnimatedChartWrapper
 *   isLoading={isLoading}
 *   error={error}
 *   onRetry={refetch}
 * >
 *   <ResponsiveContainer width="100%" height={300}>
 *     <LineChart data={data}>
 *       <Line type="monotone" dataKey="value" />
 *     </LineChart>
 *   </ResponsiveContainer>
 * </AnimatedChartWrapper>
 *
 * // With scroll-triggered animation
 * <AnimatedChartWrapper animateOnScroll viewportAmount={0.3}>
 *   <AreaChart data={data}>...</AreaChart>
 * </AnimatedChartWrapper>
 *
 * // Custom loading component
 * <AnimatedChartWrapper
 *   isLoading={isLoading}
 *   loadingComponent={<CustomSkeleton />}
 * >
 *   <BarChart data={data}>...</BarChart>
 * </AnimatedChartWrapper>
 * ```
 */
export function AnimatedChartWrapper({
  children,
  isLoading = false,
  error = null,
  onRetry,
  className,
  height = 300,
  animateOnScroll = false,
  viewportAmount = 0.2,
  animateOnce = true,
  chartName,
  loadingComponent,
  errorComponent,
  delay = 0,
  ariaLabel,
}: AnimatedChartWrapperProps) {
  const prefersReducedMotion = useReducedMotion();

  // Convert height to style value
  const heightStyle = typeof height === "number" ? `${height}px` : height;

  // Determine current state
  const hasError = error !== null && error !== undefined;
  const showContent = !isLoading && !hasError;

  // Generate accessible label
  const generateAriaLabel = (): string => {
    if (ariaLabel) return ariaLabel;
    if (chartName) return `${chartName} chart`;
    return "Data visualization chart";
  };

  // Prepare animation props based on scroll trigger
  const animationProps = animateOnScroll
    ? {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: animateOnce, amount: viewportAmount },
      }
    : {
        initial: "hidden",
        animate: "visible",
      };

  // Add delay to variants if specified
  const delayedChartVariants: Variants = {
    ...chartVariants,
    visible: {
      ...chartVariants.visible,
      transition: {
        ...(typeof chartVariants.visible === "object" &&
        "transition" in chartVariants.visible
          ? chartVariants.visible.transition
          : {}),
        delay,
      },
    },
  };

  // Render loading state
  const renderLoading = () => {
    if (loadingComponent) {
      return loadingComponent;
    }

    return (
      <ShimmerChart
        height={typeof height === "number" ? height : 300}
        showHeader={false}
        className="border-none"
      />
    );
  };

  // Render error state
  const renderError = () => {
    if (errorComponent) {
      return errorComponent;
    }

    return (
      <DefaultErrorDisplay
        error={error!}
        chartName={chartName}
        onRetry={onRetry}
        height={height}
      />
    );
  };

  // For reduced motion, render without animations
  if (prefersReducedMotion) {
    return (
      <div
        className={cn("relative overflow-hidden", className)}
        style={{ minHeight: heightStyle }}
        role="img"
        aria-label={generateAriaLabel()}
      >
        {isLoading && renderLoading()}
        {hasError && renderError()}
        {showContent && children}
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ minHeight: heightStyle }}
      role="img"
      aria-label={generateAriaLabel()}
    >
      <AnimatePresence mode="wait">
        {/* Loading State */}
        {isLoading && (
          <motion.div
            key="loading"
            variants={loadingVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0"
          >
            {renderLoading()}
          </motion.div>
        )}

        {/* Error State */}
        {hasError && !isLoading && (
          <motion.div
            key="error"
            variants={errorVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0"
          >
            {renderError()}
          </motion.div>
        )}

        {/* Content */}
        {showContent && (
          <motion.div
            key="content"
            variants={delayedChartVariants}
            {...animationProps}
            exit="exit"
            className="w-full h-full"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * useChartAnimation Hook
 *
 * Provides animation controls for charts that need programmatic control.
 *
 * @example
 * ```tsx
 * const { controls, animate, reset } = useChartAnimation();
 *
 * // Trigger animation
 * <motion.div animate={controls}>
 *   <Chart />
 * </motion.div>
 *
 * // Call animate() to start animation
 * useEffect(() => {
 *   if (data.length > 0) animate();
 * }, [data, animate]);
 * ```
 */
export function useChartAnimation() {
  const prefersReducedMotion = useReducedMotion();
  const [isAnimated, setIsAnimated] = React.useState(false);

  const animate = React.useCallback(() => {
    if (prefersReducedMotion) {
      setIsAnimated(true);
      return;
    }
    setIsAnimated(true);
  }, [prefersReducedMotion]);

  const reset = React.useCallback(() => {
    setIsAnimated(false);
  }, []);

  const getVariant = React.useCallback(() => {
    if (prefersReducedMotion) return "visible";
    return isAnimated ? "visible" : "hidden";
  }, [prefersReducedMotion, isAnimated]);

  return {
    isAnimated,
    animate,
    reset,
    getVariant,
    prefersReducedMotion,
    variants: chartVariants,
  };
}

/**
 * withChartAnimation HOC
 *
 * Higher-order component to add animation wrapper to any chart component.
 *
 * @example
 * ```tsx
 * const AnimatedLineChart = withChartAnimation(LineChart, 'Line Chart');
 *
 * <AnimatedLineChart
 *   isLoading={isLoading}
 *   error={error}
 *   data={data}
 * />
 * ```
 */
export function withChartAnimation<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  chartName?: string
) {
  return function ChartWithAnimation(
    props: P & Omit<AnimatedChartWrapperProps, "children">
  ) {
    const {
      isLoading,
      error,
      onRetry,
      className,
      height,
      animateOnScroll,
      viewportAmount,
      animateOnce,
      loadingComponent,
      errorComponent,
      delay,
      ...chartProps
    } = props as AnimatedChartWrapperProps & P;

    return (
      <AnimatedChartWrapper
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        className={className}
        height={height}
        animateOnScroll={animateOnScroll}
        viewportAmount={viewportAmount}
        animateOnce={animateOnce}
        chartName={chartName}
        loadingComponent={loadingComponent}
        errorComponent={errorComponent}
        delay={delay}
      >
        <WrappedComponent {...(chartProps as P)} />
      </AnimatedChartWrapper>
    );
  };
}

export default AnimatedChartWrapper;
