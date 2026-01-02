/**
 * Chart Components - Robinhood-style chart components for trading UI
 *
 * @module components/charts
 */

// Hero Chart - Full-width gradient chart for portfolio/stock display
export { HeroChart } from "./hero-chart";
export type { HeroChartDataPoint } from "./hero-chart";

// Sparkline - Mini charts for metric cards and compact displays
export { Sparkline, SparklineWithValue } from "./sparkline";

// Animated Values - Value transitions with counting animations
export {
  AnimatedValue,
  AnimatedChange,
  AnimatedPortfolioValue,
} from "./animated-value";

// Touch Chart Tooltip - Touch-friendly tooltip with gesture support
export {
  TouchChartTooltip,
  useTouchChart,
} from "./touch-chart-tooltip";
