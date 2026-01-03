"use client";

import { Component, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  height?: number | string;
  className?: string;
  chartName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically for chart components
 * Shows a trading-themed fallback UI when charts fail to render
 */
export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error(
      `[ChartErrorBoundary] ${this.props.chartName || "Chart"} failed:`,
      error.message
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            "w-full flex flex-col items-center justify-center gap-3",
            "bg-muted/30 rounded-xl border border-dashed border-muted-foreground/20",
            this.props.className
          )}
          style={{ height: this.props.height || 200 }}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <TrendingUp className="h-5 w-5 opacity-50" />
          </div>
          <p className="text-sm text-muted-foreground text-center px-4">
            {this.props.chartName
              ? `${this.props.chartName} unavailable`
              : "Chart unavailable"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={this.handleRetry}
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap any chart component with error boundary
 */
export function withChartErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  chartName?: string
) {
  return function ChartWithErrorBoundary(
    props: P & { height?: number | string; className?: string }
  ) {
    return (
      <ChartErrorBoundary
        height={props.height}
        className={props.className}
        chartName={chartName}
      >
        <WrappedComponent {...props} />
      </ChartErrorBoundary>
    );
  };
}

export default ChartErrorBoundary;
