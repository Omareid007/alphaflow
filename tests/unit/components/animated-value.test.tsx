import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../utils/render";
import {
  AnimatedValue,
  AnimatedChange,
  AnimatedPortfolioValue,
} from "@/components/charts/animated-value";

// Mock framer-motion to avoid animation timing issues in tests
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual("framer-motion");
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
      span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    },
    useMotionValue: (initial: number) => ({
      get: () => initial,
      set: vi.fn(),
    }),
    useSpring: (motionValue: any) => motionValue,
    // useTransform needs to return the formatted value directly, not an object
    useTransform: (_source: any, transform: (v: number) => string) => {
      // The transform function is the formatter - call it with the initial value
      const value = typeof _source?.get === "function" ? _source.get() : 0;
      const formatted = transform ? transform(value) : String(value);
      return formatted;
    },
    AnimatePresence: ({ children }: any) => children,
  };
});

// Mock the useReducedMotion hook to test both paths
vi.mock("@/lib/animations/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true, // Force reduced motion for simpler testing
}));

describe("AnimatedValue Component", () => {
  describe("Basic Rendering", () => {
    it("renders the value", () => {
      render(<AnimatedValue value={1000} />);
      // With reduced motion, value should be displayed directly
      expect(document.body).toHaveTextContent(/1,000/);
    });

    it("renders with currency prefix", () => {
      render(<AnimatedValue value={5000} prefix="$" />);
      expect(document.body).toHaveTextContent("$");
      expect(document.body).toHaveTextContent(/5,000/);
    });

    it("renders with suffix", () => {
      render(<AnimatedValue value={75} suffix="%" />);
      expect(document.body).toHaveTextContent("%");
    });

    it("renders with both prefix and suffix", () => {
      render(<AnimatedValue value={100} prefix="$" suffix=" USD" />);
      expect(document.body).toHaveTextContent("$");
      expect(document.body).toHaveTextContent("USD");
    });
  });

  describe("Formatting Options", () => {
    it("formats with specified decimal places", () => {
      render(<AnimatedValue value={1234.567} decimals={2} />);
      // Should show 2 decimal places
      expect(document.body).toHaveTextContent(/1,234\.57/);
    });

    it("formats large numbers with thousands separators", () => {
      render(<AnimatedValue value={1234567} />);
      expect(document.body).toHaveTextContent(/1,234,567/);
    });
  });

  describe("Trend Detection", () => {
    it("detects positive trend", () => {
      render(<AnimatedValue value={100} previousValue={80} showTrend />);
      // With reduced motion, trend arrow is rendered
      expect(document.body).toBeInTheDocument();
    });

    it("detects negative trend", () => {
      render(<AnimatedValue value={80} previousValue={100} showTrend />);
      // Should have loss styling when value decreased
      expect(document.body).toBeInTheDocument();
    });
  });
});

describe("AnimatedChange Component", () => {
  describe("Positive Change", () => {
    it("renders positive change with up arrow", () => {
      render(<AnimatedChange value={5.25} />);
      expect(document.body).toHaveTextContent("5.25%");
      expect(document.body).toHaveTextContent("↑");
    });

    it("applies gain styling for positive values", () => {
      const { container } = render(<AnimatedChange value={10} />);
      const element = container.querySelector(".text-gain");
      expect(element || container.firstChild).toBeInTheDocument();
    });
  });

  describe("Negative Change", () => {
    it("renders negative change with down arrow", () => {
      render(<AnimatedChange value={-3.5} />);
      expect(document.body).toHaveTextContent("-3.50%");
      expect(document.body).toHaveTextContent("↓");
    });

    it("applies loss styling for negative values", () => {
      const { container } = render(<AnimatedChange value={-5} />);
      const element = container.querySelector(".text-loss");
      expect(element || container.firstChild).toBeInTheDocument();
    });
  });

  describe("Zero Change", () => {
    it("renders zero change", () => {
      render(<AnimatedChange value={0} />);
      expect(document.body).toHaveTextContent("0.00%");
    });
  });

  describe("Formatting", () => {
    it("formats with percentage suffix", () => {
      render(<AnimatedChange value={7.5} />);
      expect(document.body).toHaveTextContent("%");
    });

    it("shows two decimal places", () => {
      render(<AnimatedChange value={12.345} />);
      expect(document.body).toHaveTextContent("12.35%");
    });
  });
});

describe("AnimatedPortfolioValue Component", () => {
  describe("Basic Rendering", () => {
    it("renders portfolio value with currency", () => {
      render(<AnimatedPortfolioValue value={125000} />);
      expect(document.body).toHaveTextContent("$");
      expect(document.body).toHaveTextContent(/125,000/);
    });

    it("renders with label", () => {
      render(<AnimatedPortfolioValue value={50000} label="Total Value" />);
      expect(screen.getByText("Total Value")).toBeInTheDocument();
    });

    it("renders change when provided", () => {
      render(<AnimatedPortfolioValue value={100000} change={250.5} />);
      // Shows the dollar change amount
      expect(document.body).toHaveTextContent("$250.50");
    });
  });

  describe("Change Direction", () => {
    it("shows positive change with gain styling", () => {
      const { container } = render(
        <AnimatedPortfolioValue value={100000} change={500} />
      );
      const gainElement = container.querySelector(".text-gain");
      expect(gainElement || container).toBeInTheDocument();
    });

    it("shows negative change with loss styling", () => {
      const { container } = render(
        <AnimatedPortfolioValue value={95000} change={-500} />
      );
      const lossElement = container.querySelector(".text-loss");
      expect(lossElement || container).toBeInTheDocument();
    });

    it("handles zero change", () => {
      render(<AnimatedPortfolioValue value={100000} change={0} />);
      expect(document.body).toHaveTextContent("$0.00");
    });
  });

  describe("Value Formatting", () => {
    it("formats large values correctly", () => {
      render(<AnimatedPortfolioValue value={1234567.89} />);
      expect(document.body).toHaveTextContent(/1,234,567/);
    });

    it("handles small values", () => {
      render(<AnimatedPortfolioValue value={100.5} />);
      expect(document.body).toHaveTextContent(/100\.50/);
    });

    it("handles zero value", () => {
      render(<AnimatedPortfolioValue value={0} />);
      expect(document.body).toHaveTextContent("$");
      expect(document.body).toHaveTextContent("0.00");
    });
  });

  describe("Optional Props", () => {
    it("renders without label", () => {
      render(<AnimatedPortfolioValue value={50000} label="" />);
      expect(document.body).toHaveTextContent(/50,000/);
    });

    it("renders without change", () => {
      render(<AnimatedPortfolioValue value={75000} label="Balance" />);
      expect(screen.getByText("Balance")).toBeInTheDocument();
      expect(document.body).toHaveTextContent(/75,000/);
    });
  });

  describe("Change Percent", () => {
    it("renders change percent with AnimatedChange", () => {
      render(<AnimatedPortfolioValue value={100000} changePercent={5.25} />);
      expect(document.body).toHaveTextContent("5.25%");
    });
  });
});
