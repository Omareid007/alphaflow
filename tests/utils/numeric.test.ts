import { describe, it, expect } from "vitest";
import {
  safeParseFloat,
  safeParseInt,
  formatPrice,
  formatQuantity,
  formatPercent,
  calculatePnL,
  calculatePercentChange,
} from "../../server/utils/numeric";

describe("safeParseFloat", () => {
  it("returns the number when given a valid number", () => {
    expect(safeParseFloat(42.5)).toBe(42.5);
    expect(safeParseFloat(0)).toBe(0);
    expect(safeParseFloat(-10.5)).toBe(-10.5);
  });

  it("parses valid numeric strings", () => {
    expect(safeParseFloat("42.5")).toBe(42.5);
    expect(safeParseFloat("0")).toBe(0);
    expect(safeParseFloat("-10.5")).toBe(-10.5);
    expect(safeParseFloat("100.123456")).toBe(100.123456);
  });

  it("returns default value for null, undefined, or empty string", () => {
    expect(safeParseFloat(null)).toBe(0);
    expect(safeParseFloat(undefined)).toBe(0);
    expect(safeParseFloat("")).toBe(0);
  });

  it("returns custom default value when provided", () => {
    expect(safeParseFloat(null, 99)).toBe(99);
    expect(safeParseFloat(undefined, -1)).toBe(-1);
    expect(safeParseFloat("", 100)).toBe(100);
  });

  it("returns default for non-finite values", () => {
    expect(safeParseFloat(NaN)).toBe(0);
    expect(safeParseFloat(Infinity)).toBe(0);
    expect(safeParseFloat(-Infinity)).toBe(0);
    expect(safeParseFloat("NaN")).toBe(0);
    expect(safeParseFloat("Infinity")).toBe(0);
  });

  it("handles string with leading/trailing spaces", () => {
    expect(safeParseFloat("  42.5  ")).toBe(42.5);
  });
});

describe("safeParseInt", () => {
  it("returns the integer when given a valid integer", () => {
    expect(safeParseInt(42)).toBe(42);
    expect(safeParseInt(0)).toBe(0);
    expect(safeParseInt(-10)).toBe(-10);
  });

  it("floors decimal numbers", () => {
    expect(safeParseInt(42.9)).toBe(42);
    expect(safeParseInt(42.1)).toBe(42);
    expect(safeParseInt(-10.9)).toBe(-11);
  });

  it("parses valid numeric strings", () => {
    expect(safeParseInt("42")).toBe(42);
    expect(safeParseInt("0")).toBe(0);
    expect(safeParseInt("-10")).toBe(-10);
  });

  it("returns default value for null, undefined, or empty string", () => {
    expect(safeParseInt(null)).toBe(0);
    expect(safeParseInt(undefined)).toBe(0);
    expect(safeParseInt("")).toBe(0);
  });
});

describe("formatPrice", () => {
  it("formats prices with 2 decimal places by default", () => {
    expect(formatPrice(42.5)).toBe("42.50");
    expect(formatPrice(100)).toBe("100.00");
    expect(formatPrice(0.1)).toBe("0.10");
  });

  it("formats prices with custom decimal places", () => {
    expect(formatPrice(42.1234, 4)).toBe("42.1234");
    expect(formatPrice(100, 0)).toBe("100");
  });

  it('returns "0.00" for non-finite values', () => {
    expect(formatPrice(NaN)).toBe("0.00");
    expect(formatPrice(Infinity)).toBe("0.00");
  });
});

describe("formatQuantity", () => {
  it("formats integers without decimals", () => {
    expect(formatQuantity(10)).toBe("10");
    expect(formatQuantity(100)).toBe("100");
  });

  it("formats decimals with up to 4 decimal places", () => {
    expect(formatQuantity(10.5)).toBe("10.5");
    expect(formatQuantity(10.1234)).toBe("10.1234");
    expect(formatQuantity(10.12345678)).toBe("10.1235");
  });

  it("removes trailing zeros", () => {
    expect(formatQuantity(10.5)).toBe("10.5");
    expect(formatQuantity(10.1)).toBe("10.1");
  });

  it('returns "0" for non-finite values', () => {
    expect(formatQuantity(NaN)).toBe("0");
  });
});

describe("formatPercent", () => {
  it("formats percentages with 2 decimal places by default", () => {
    expect(formatPercent(42.5)).toBe("42.50%");
    expect(formatPercent(100)).toBe("100.00%");
    expect(formatPercent(-5.5)).toBe("-5.50%");
  });

  it('returns "0.00%" for non-finite values', () => {
    expect(formatPercent(NaN)).toBe("0.00%");
  });
});

describe("calculatePnL", () => {
  describe("long positions", () => {
    it("calculates profit when exit price > entry price", () => {
      expect(calculatePnL(100, 110, 10, "long")).toBe(100);
      expect(calculatePnL(150, 155, 10, "long")).toBe(50);
    });

    it("calculates loss when exit price < entry price", () => {
      expect(calculatePnL(100, 90, 10, "long")).toBe(-100);
      expect(calculatePnL(150, 145, 10, "long")).toBe(-50);
    });

    it("returns 0 when prices are equal", () => {
      expect(calculatePnL(100, 100, 10, "long")).toBe(0);
    });

    it("handles fractional quantities", () => {
      expect(calculatePnL(100, 110, 0.5, "long")).toBe(5);
      expect(calculatePnL(50000, 55000, 0.1, "long")).toBe(500);
    });

    it("defaults to long if side not specified", () => {
      expect(calculatePnL(100, 110, 10)).toBe(100);
    });
  });

  describe("short positions", () => {
    it("calculates profit when exit price < entry price", () => {
      expect(calculatePnL(100, 90, 10, "short")).toBe(100);
      expect(calculatePnL(150, 145, 10, "short")).toBe(50);
    });

    it("calculates loss when exit price > entry price", () => {
      expect(calculatePnL(100, 110, 10, "short")).toBe(-100);
      expect(calculatePnL(150, 155, 10, "short")).toBe(-50);
    });
  });

  describe("edge cases", () => {
    it("returns 0 for non-finite entry price", () => {
      expect(calculatePnL(NaN, 100, 10)).toBe(0);
      expect(calculatePnL(Infinity, 100, 10)).toBe(0);
    });

    it("returns 0 for non-finite exit price", () => {
      expect(calculatePnL(100, NaN, 10)).toBe(0);
      expect(calculatePnL(100, Infinity, 10)).toBe(0);
    });

    it("returns 0 for non-finite quantity", () => {
      expect(calculatePnL(100, 110, NaN)).toBe(0);
      expect(calculatePnL(100, 110, Infinity)).toBe(0);
    });

    it("handles zero values", () => {
      expect(calculatePnL(0, 100, 10)).toBe(1000);
      expect(calculatePnL(100, 0, 10)).toBe(-1000);
      expect(calculatePnL(100, 110, 0)).toBe(0);
    });
  });

  describe("real-world examples from docs", () => {
    it("Example 1: AAPL trade with profit", () => {
      const entryPrice = 150;
      const exitPrice = 155;
      const quantity = 10;
      const pnl = calculatePnL(entryPrice, exitPrice, quantity, "long");
      expect(pnl).toBe(50);
    });

    it("Example 2: NVDA trade with loss", () => {
      const entryPrice = 500;
      const exitPrice = 475;
      const quantity = 5;
      const pnl = calculatePnL(entryPrice, exitPrice, quantity, "long");
      expect(pnl).toBe(-125);
    });

    it("Example 3: BTC crypto trade", () => {
      const entryPrice = 50000;
      const exitPrice = 52000;
      const quantity = 0.1;
      const pnl = calculatePnL(entryPrice, exitPrice, quantity, "long");
      expect(pnl).toBe(200);
    });
  });
});

describe("calculatePercentChange", () => {
  it("calculates positive percent change", () => {
    expect(calculatePercentChange(110, 100)).toBe(10);
    expect(calculatePercentChange(150, 100)).toBe(50);
  });

  it("calculates negative percent change", () => {
    expect(calculatePercentChange(90, 100)).toBe(-10);
    expect(calculatePercentChange(50, 100)).toBe(-50);
  });

  it("returns 0 when prices are equal", () => {
    expect(calculatePercentChange(100, 100)).toBe(0);
  });

  it("returns 0 for division by zero", () => {
    expect(calculatePercentChange(100, 0)).toBe(0);
  });

  it("returns 0 for non-finite values", () => {
    expect(calculatePercentChange(NaN, 100)).toBe(0);
    expect(calculatePercentChange(100, NaN)).toBe(0);
  });

  it("handles large numbers", () => {
    expect(calculatePercentChange(1100, 1000)).toBe(10);
    expect(calculatePercentChange(100000, 50000)).toBe(100);
  });
});
