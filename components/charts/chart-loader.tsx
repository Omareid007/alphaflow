"use client";

/**
 * Dynamic Chart Loader Wrapper
 *
 * Provides dynamic imports for all Recharts-based chart components
 * to reduce initial bundle size. Recharts is ~40KB gzipped and doesn't
 * need to block initial page load.
 *
 * Benefits:
 * - Reduces First Load JS by ~15-20% for pages with charts
 * - Improves Time to Interactive (TTI) for dashboard/portfolio pages
 * - Maintains SSR where needed via ssr flag
 * - Provides consistent loading states across all charts
 */

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Loading component for chart skeletons
function ChartLoadingSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <Skeleton className="h-full w-full rounded-lg" />
    </div>
  );
}

// Dynamically import BacktestChart (used in wizard, backtests page)
export const BacktestChart = dynamic(() => import("./backtest-chart"), {
  ssr: false, // Wizard and backtests don't need SSR
  loading: () => <ChartLoadingSkeleton height={256} />,
});

// Dynamically import HeroChart (used in portfolio, home)
// Keep SSR enabled for portfolio page (needs SEO/initial render)
export const HeroChart = dynamic(
  () => import("./hero-chart").then((mod) => ({ default: mod.HeroChart })),
  {
    ssr: true, // Portfolio needs SSR for initial render
    loading: () => <ChartLoadingSkeleton height={300} />,
  }
);

// Dynamically import Sparkline (lightweight, but still reduces bundle)
export const Sparkline = dynamic(
  () => import("./sparkline").then((mod) => ({ default: mod.Sparkline })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-6 w-16" />,
  }
);

// Dynamically import PerformanceCharts (heavy Recharts usage in wizard)
export const PerformanceCharts = dynamic(
  () =>
    import("../wizard/PerformanceCharts").then((mod) => ({
      default: mod.PerformanceCharts,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <ChartLoadingSkeleton height={320} />
      </div>
    ),
  }
);

// Dynamically import Portfolio Charts (AllocationChart, PositionPnlChart)
export const AllocationChart = dynamic(
  () =>
    import("../portfolio/PortfolioCharts").then((mod) => ({
      default: mod.AllocationChart,
    })),
  {
    ssr: false,
    loading: () => <ChartLoadingSkeleton height={300} />,
  }
);

export const PositionPnlChart = dynamic(
  () =>
    import("../portfolio/PortfolioCharts").then((mod) => ({
      default: mod.PositionPnlChart,
    })),
  {
    ssr: false,
    loading: () => <ChartLoadingSkeleton height={300} />,
  }
);

// Export loading skeleton for use in other components
export { ChartLoadingSkeleton };
