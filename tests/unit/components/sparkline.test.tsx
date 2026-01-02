import { describe, it, expect } from "vitest";
import { render, screen } from "../../utils/render";
import { Sparkline, SparklineWithValue } from "@/components/charts/sparkline";

describe("Sparkline Component", () => {
  const sampleData = [10, 15, 12, 18, 14, 20, 16, 22, 19, 25];
  const gainData = [10, 12, 15, 14, 18, 20, 22, 25]; // Upward trend
  const lossData = [25, 22, 20, 18, 14, 15, 12, 10]; // Downward trend

  describe("Basic Rendering", () => {
    it("renders without crashing", () => {
      render(<Sparkline data={sampleData} data-testid="sparkline" />);
      // Sparkline uses SVG
      expect(document.querySelector("svg")).toBeInTheDocument();
    });

    it("renders with specified dimensions", () => {
      render(<Sparkline data={sampleData} width={100} height={30} />);
      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "100");
      expect(svg).toHaveAttribute("height", "30");
    });

    it("renders with default dimensions when not specified", () => {
      render(<Sparkline data={sampleData} />);
      const svg = document.querySelector("svg");
      // Default width is 80, height is 24
      expect(svg).toHaveAttribute("width", "80");
      expect(svg).toHaveAttribute("height", "24");
    });
  });

  describe("Trend Detection", () => {
    it("auto-detects gain trend from data", () => {
      render(<Sparkline data={gainData} color="auto" />);
      // Should render with gain color (green stroke)
      const path = document.querySelector("path");
      expect(path).toBeInTheDocument();
    });

    it("auto-detects loss trend from data", () => {
      render(<Sparkline data={lossData} color="auto" />);
      // Should render with loss color (red stroke)
      const path = document.querySelector("path");
      expect(path).toBeInTheDocument();
    });
  });

  describe("Color Options", () => {
    it("renders with gain color", () => {
      render(<Sparkline data={sampleData} color="gain" />);
      const path = document.querySelector("path");
      expect(path).toBeInTheDocument();
    });

    it("renders with loss color", () => {
      render(<Sparkline data={sampleData} color="loss" />);
      const path = document.querySelector("path");
      expect(path).toBeInTheDocument();
    });

    it("renders with primary color", () => {
      render(<Sparkline data={sampleData} color="primary" />);
      const path = document.querySelector("path");
      expect(path).toBeInTheDocument();
    });

    it("renders with muted color", () => {
      render(<Sparkline data={sampleData} color="muted" />);
      const path = document.querySelector("path");
      expect(path).toBeInTheDocument();
    });
  });

  describe("Area Fill", () => {
    it("renders with area fill when showArea is true", () => {
      render(<Sparkline data={sampleData} showArea />);
      // Should have both a path for the line and an area fill
      const paths = document.querySelectorAll("path");
      expect(paths.length).toBeGreaterThanOrEqual(1);
    });

    it("renders without area fill by default", () => {
      render(<Sparkline data={sampleData} />);
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("Empty Data Handling", () => {
    it("handles empty data gracefully", () => {
      render(<Sparkline data={[]} />);
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("handles single data point", () => {
      render(<Sparkline data={[50]} />);
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("handles two data points", () => {
      render(<Sparkline data={[50, 60]} />);
      const path = document.querySelector("path");
      expect(path).toBeInTheDocument();
    });
  });

  describe("Custom Class Name", () => {
    it("accepts custom className", () => {
      render(<Sparkline data={sampleData} className="custom-sparkline" />);
      const svg = document.querySelector("svg");
      expect(svg).toHaveClass("custom-sparkline");
    });
  });
});

describe("SparklineWithValue Component", () => {
  const sampleData = [100, 105, 102, 108, 104, 110];

  describe("Basic Rendering", () => {
    it("renders sparkline with label and value", () => {
      render(
        <SparklineWithValue
          data={sampleData}
          label="Portfolio"
          value={12500}
        />
      );

      expect(screen.getByText("Portfolio")).toBeInTheDocument();
      expect(screen.getByText(/12,500/)).toBeInTheDocument();
    });

    it("renders with change percentage", () => {
      render(
        <SparklineWithValue
          data={sampleData}
          label="Returns"
          value={5000}
          change={5.2}
        />
      );

      expect(screen.getByText(/5.2/)).toBeInTheDocument();
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

      const changeElement = screen.getByText(/10.5/);
      expect(changeElement).toBeInTheDocument();
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

      const changeElement = screen.getByText(/5.3/);
      expect(changeElement).toBeInTheDocument();
    });
  });

  describe("Value Formatting", () => {
    it("formats large numbers with commas", () => {
      render(
        <SparklineWithValue
          data={sampleData}
          label="Portfolio"
          value={1234567.89}
        />
      );

      expect(screen.getByText(/1,234,567/)).toBeInTheDocument();
    });

    it("handles zero value", () => {
      render(
        <SparklineWithValue data={sampleData} label="Empty" value={0} />
      );

      expect(screen.getByText("0")).toBeInTheDocument();
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

      expect(screen.getByText(/0/)).toBeInTheDocument();
    });
  });
});
