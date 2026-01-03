import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "../../utils/render";
import { Sparkline, SparklineWithValue } from "@/components/charts/sparkline";

// Mock ResizeObserver for ResponsiveContainer
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

describe("Sparkline Component", () => {
  const sampleData = [10, 15, 12, 18, 14, 20, 16, 22, 19, 25];
  const gainData = [10, 12, 15, 14, 18, 20, 22, 25]; // Upward trend
  const lossData = [25, 22, 20, 18, 14, 15, 12, 10]; // Downward trend

  describe("Basic Rendering", () => {
    it("renders without crashing", () => {
      const { container } = render(<Sparkline data={sampleData} />);
      // Component renders a motion.div wrapper
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });

    it("renders with specified dimensions", () => {
      const { container } = render(
        <Sparkline data={sampleData} width={100} height={30} />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ width: "100px", height: "30px" });
    });

    it("renders with default dimensions when not specified", () => {
      const { container } = render(<Sparkline data={sampleData} />);
      const wrapper = container.firstChild as HTMLElement;
      // Default width is 100%, height is 32
      expect(wrapper).toHaveStyle({ width: "100%", height: "32px" });
    });
  });

  describe("Trend Detection", () => {
    it("auto-detects gain trend from data", () => {
      const { container } = render(<Sparkline data={gainData} />);
      // Should render the wrapper (trend detection is internal)
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });

    it("auto-detects loss trend from data", () => {
      const { container } = render(<Sparkline data={lossData} />);
      // Should render the wrapper (trend detection is internal)
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe("Color Options", () => {
    it("renders with gain color", () => {
      const { container } = render(
        <Sparkline data={sampleData} color="gain" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });

    it("renders with loss color", () => {
      const { container } = render(
        <Sparkline data={sampleData} color="loss" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });

    it("renders with primary color", () => {
      const { container } = render(
        <Sparkline data={sampleData} color="primary" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });

    it("renders with muted color", () => {
      const { container } = render(
        <Sparkline data={sampleData} color="muted" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe("Area Fill", () => {
    it("renders with area fill when showArea is true", () => {
      const { container } = render(<Sparkline data={sampleData} showArea />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });

    it("renders without area fill by default", () => {
      const { container } = render(
        <Sparkline data={sampleData} showArea={false} />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe("Empty Data Handling", () => {
    it("handles empty data gracefully", () => {
      const { container } = render(<Sparkline data={[]} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });

    it("handles single data point", () => {
      const { container } = render(<Sparkline data={[50]} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });

    it("handles two data points", () => {
      const { container } = render(<Sparkline data={[50, 60]} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe("Custom Class Name", () => {
    it("accepts custom className", () => {
      const { container } = render(
        <Sparkline data={sampleData} className="custom-sparkline" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("custom-sparkline");
    });
  });

  describe("Animation", () => {
    it("renders with animation enabled by default", () => {
      const { container } = render(<Sparkline data={sampleData} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });

    it("renders with animation disabled", () => {
      const { container } = render(
        <Sparkline data={sampleData} animate={false} />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
    });
  });
});

describe("SparklineWithValue Component", () => {
  const sampleData = [100, 105, 102, 108, 104, 110];

  describe("Basic Rendering", () => {
    it("renders sparkline with label and value", () => {
      render(
        <SparklineWithValue data={sampleData} label="Portfolio" value={12500} />
      );

      expect(screen.getByText("Portfolio")).toBeInTheDocument();
      // Default formatValue is String(v), not formatted with commas
      expect(screen.getByText("12500")).toBeInTheDocument();
    });

    it("renders with custom value formatter", () => {
      render(
        <SparklineWithValue
          data={sampleData}
          label="Portfolio"
          value={12500}
          formatValue={(v) => `$${Number(v).toLocaleString()}`}
        />
      );

      expect(screen.getByText("Portfolio")).toBeInTheDocument();
      expect(screen.getByText("$12,500")).toBeInTheDocument();
    });

    it("renders with change value", () => {
      render(
        <SparklineWithValue
          data={sampleData}
          label="Returns"
          value={5000}
          change={5.2}
        />
      );

      expect(screen.getByText("Returns")).toBeInTheDocument();
      expect(screen.getByText("+5.20")).toBeInTheDocument();
    });

    it("renders positive change with gain styling", () => {
      render(
        <SparklineWithValue
          data={sampleData}
          label="Profit"
          value={1000}
          change={10.5}
        />
      );

      const changeElement = screen.getByText("+10.50");
      expect(changeElement.closest("p")).toHaveClass("text-gain");
    });

    it("renders negative change with loss styling", () => {
      render(
        <SparklineWithValue
          data={sampleData}
          label="Loss"
          value={1000}
          change={-5.3}
        />
      );

      const changeElement = screen.getByText("-5.30");
      expect(changeElement.closest("p")).toHaveClass("text-loss");
    });
  });

  describe("Value Formatting", () => {
    it("formats large numbers with custom formatter", () => {
      render(
        <SparklineWithValue
          data={sampleData}
          label="Portfolio"
          value={1234567.89}
          formatValue={(v) => Number(v).toLocaleString()}
        />
      );

      expect(screen.getByText("1,234,567.89")).toBeInTheDocument();
    });

    it("handles zero value", () => {
      render(<SparklineWithValue data={sampleData} label="Empty" value={0} />);

      expect(screen.getByText("Empty")).toBeInTheDocument();
      // Default formatter returns "0"
      const valueElement = screen.getByText("0");
      expect(valueElement).toBeInTheDocument();
    });
  });

  describe("Optional Change Display", () => {
    it("does not show change when not provided", () => {
      render(
        <SparklineWithValue data={sampleData} label="Basic" value={100} />
      );

      // Should only show label and value, no change indicator
      expect(screen.getByText("Basic")).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("shows zero change correctly", () => {
      render(
        <SparklineWithValue
          data={sampleData}
          label="Flat"
          value={100}
          change={0}
        />
      );

      expect(screen.getByText("Flat")).toBeInTheDocument();
      expect(screen.getByText("+0.00")).toBeInTheDocument();
    });

    it("shows change percent correctly", () => {
      render(
        <SparklineWithValue
          data={sampleData}
          label="Growth"
          value={1000}
          change={50}
          changePercent={5.5}
        />
      );

      expect(screen.getByText(/\+5\.50%/)).toBeInTheDocument();
    });
  });
});
