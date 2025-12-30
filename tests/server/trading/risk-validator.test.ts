/**
 * Risk Validator Tests
 *
 * Comprehensive tests for pre-trade risk validation, position limits,
 * and loss protection mechanisms.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before importing the module
vi.mock("../../../server/storage", () => ({
  storage: {
    getAgentStatus: vi.fn(),
  },
}));

vi.mock("../../../server/connectors/alpaca", () => ({
  alpaca: {
    getAccount: vi.fn(),
    getPositions: vi.fn(),
    getSnapshots: vi.fn(),
    getPosition: vi.fn(),
  },
}));

vi.mock("../../../server/utils/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  checkRiskLimits,
  checkLossProtection,
  calculateLossPercentage,
  checkSellLossProtection,
} from "../../../server/trading/risk-validator";
import { storage } from "../../../server/storage";
import { alpaca } from "../../../server/connectors/alpaca";

// Helper for symbol normalization
const normalizeSymbol = (symbol: string) => symbol.toUpperCase();
const normalizeSymbolForOrder = (symbol: string, _forOrder: boolean) =>
  symbol.toUpperCase();

describe("Risk Validator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // checkRiskLimits Tests
  // ===========================================================================
  describe("checkRiskLimits", () => {
    describe("Kill Switch", () => {
      it("blocks trading when kill switch is active from storage", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: true,
          maxPositionsCount: 10,
        });

        const result = await checkRiskLimits(
          "buy",
          "AAPL",
          1000,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Kill switch is active");
      });

      it("blocks trading when kill switch is passed as parameter", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
          maxPositionsCount: 10,
        });

        const result = await checkRiskLimits(
          "buy",
          "AAPL",
          1000,
          true,
          normalizeSymbol
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Kill switch is active");
      });

      it("allows trading when kill switch is inactive", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
          maxPositionsCount: 10,
        });
        vi.mocked(alpaca.getAccount).mockResolvedValue({
          buying_power: "100000",
        } as never);
        vi.mocked(alpaca.getPositions).mockResolvedValue([]);
        vi.mocked(alpaca.getSnapshots).mockResolvedValue({
          AAPL: { latestTrade: { p: 150 } },
        } as never);

        const result = await checkRiskLimits(
          "buy",
          "AAPL",
          1000,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(true);
      });
    });

    describe("Position Limits", () => {
      it("blocks buy when at maximum positions", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
          maxPositionsCount: 5,
        });
        vi.mocked(alpaca.getAccount).mockResolvedValue({
          buying_power: "100000",
        } as never);
        // 5 existing positions - at max
        vi.mocked(alpaca.getPositions).mockResolvedValue([
          { symbol: "AAPL" },
          { symbol: "MSFT" },
          { symbol: "GOOGL" },
          { symbol: "AMZN" },
          { symbol: "TSLA" },
        ] as never);

        const result = await checkRiskLimits(
          "buy",
          "NVDA",
          1000,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Maximum positions limit reached (5)");
      });

      it("allows buy when under maximum positions", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
          maxPositionsCount: 10,
        });
        vi.mocked(alpaca.getAccount).mockResolvedValue({
          buying_power: "100000",
        } as never);
        vi.mocked(alpaca.getPositions).mockResolvedValue([
          { symbol: "AAPL" },
          { symbol: "MSFT" },
        ] as never);
        vi.mocked(alpaca.getSnapshots).mockResolvedValue({
          NVDA: { latestTrade: { p: 500 } },
        } as never);

        const result = await checkRiskLimits(
          "buy",
          "NVDA",
          2500,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(true);
      });

      it("uses default max positions (10) when not set", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
          // maxPositionsCount not set
        });
        vi.mocked(alpaca.getAccount).mockResolvedValue({
          buying_power: "100000",
        } as never);
        // 10 positions - should hit default limit
        vi.mocked(alpaca.getPositions).mockResolvedValue(
          Array.from({ length: 10 }, (_, i) => ({ symbol: `SYM${i}` })) as never
        );

        const result = await checkRiskLimits(
          "buy",
          "NEW",
          1000,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Maximum positions limit reached (10)");
      });
    });

    describe("Position Size Limits", () => {
      it("blocks trade exceeding max position size percentage", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
          maxPositionsCount: 10,
          maxPositionSizePercent: "5", // 5% max
        });
        vi.mocked(alpaca.getAccount).mockResolvedValue({
          buying_power: "100000", // $100k buying power
        } as never);
        vi.mocked(alpaca.getPositions).mockResolvedValue([]);
        vi.mocked(alpaca.getSnapshots).mockResolvedValue({
          AAPL: { latestTrade: { p: 150 } },
        } as never);

        // Try to trade $6,000 (6% of $100k, exceeds 5% limit)
        const result = await checkRiskLimits(
          "buy",
          "AAPL",
          6000,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Trade exceeds max position size");
        expect(result.reason).toContain("5%");
      });

      it("allows trade within max position size percentage", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
          maxPositionsCount: 10,
          maxPositionSizePercent: "10", // 10% max
        });
        vi.mocked(alpaca.getAccount).mockResolvedValue({
          buying_power: "100000",
        } as never);
        vi.mocked(alpaca.getPositions).mockResolvedValue([]);
        vi.mocked(alpaca.getSnapshots).mockResolvedValue({
          AAPL: { latestTrade: { p: 150 } },
        } as never);

        // Trade $5,000 (5% of $100k, under 10% limit)
        const result = await checkRiskLimits(
          "buy",
          "AAPL",
          5000,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(true);
      });

      it("uses default 10% when maxPositionSizePercent not set", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
          maxPositionsCount: 10,
          // maxPositionSizePercent not set
        });
        vi.mocked(alpaca.getAccount).mockResolvedValue({
          buying_power: "100000",
        } as never);
        vi.mocked(alpaca.getPositions).mockResolvedValue([]);
        vi.mocked(alpaca.getSnapshots).mockResolvedValue({
          AAPL: { latestTrade: { p: 150 } },
        } as never);

        // Trade $9,000 (9% of $100k, under default 10% limit)
        const result = await checkRiskLimits(
          "buy",
          "AAPL",
          9000,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(true);
      });
    });

    describe("Price Validation", () => {
      it("blocks trade when no price data available", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
          maxPositionsCount: 10,
        });
        vi.mocked(alpaca.getAccount).mockResolvedValue({
          buying_power: "100000",
        } as never);
        vi.mocked(alpaca.getPositions).mockResolvedValue([]);
        vi.mocked(alpaca.getSnapshots).mockResolvedValue({
          AAPL: {}, // No price data
        } as never);

        const result = await checkRiskLimits(
          "buy",
          "AAPL",
          1000,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("no valid price data");
      });

      it("blocks trade when price is zero", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
          maxPositionsCount: 10,
        });
        vi.mocked(alpaca.getAccount).mockResolvedValue({
          buying_power: "100000",
        } as never);
        vi.mocked(alpaca.getPositions).mockResolvedValue([]);
        vi.mocked(alpaca.getSnapshots).mockResolvedValue({
          AAPL: { latestTrade: { p: 0 } },
        } as never);

        const result = await checkRiskLimits(
          "buy",
          "AAPL",
          1000,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("no valid price data");
      });

      it("uses dailyBar price when latestTrade unavailable", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
          maxPositionsCount: 10,
          maxPositionSizePercent: "50",
        });
        vi.mocked(alpaca.getAccount).mockResolvedValue({
          buying_power: "100000",
        } as never);
        vi.mocked(alpaca.getPositions).mockResolvedValue([]);
        vi.mocked(alpaca.getSnapshots).mockResolvedValue({
          AAPL: { dailyBar: { c: 150 } }, // Only dailyBar available
        } as never);

        const result = await checkRiskLimits(
          "buy",
          "AAPL",
          5000,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(true);
      });

      it("uses prevDailyBar price as fallback", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
          maxPositionsCount: 10,
          maxPositionSizePercent: "50",
        });
        vi.mocked(alpaca.getAccount).mockResolvedValue({
          buying_power: "100000",
        } as never);
        vi.mocked(alpaca.getPositions).mockResolvedValue([]);
        vi.mocked(alpaca.getSnapshots).mockResolvedValue({
          AAPL: { prevDailyBar: { c: 145 } }, // Only prevDailyBar available
        } as never);

        const result = await checkRiskLimits(
          "buy",
          "AAPL",
          5000,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(true);
      });
    });

    describe("Sell Orders", () => {
      it("allows sell orders without position/size checks", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
        });

        const result = await checkRiskLimits(
          "sell",
          "AAPL",
          1000,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(true);
        // Should not call getAccount or getPositions for sell
        expect(alpaca.getAccount).not.toHaveBeenCalled();
        expect(alpaca.getPositions).not.toHaveBeenCalled();
      });
    });

    describe("Error Handling", () => {
      it("blocks trade when Alpaca API fails", async () => {
        vi.mocked(storage.getAgentStatus).mockResolvedValue({
          killSwitchActive: false,
          maxPositionsCount: 10,
        });
        vi.mocked(alpaca.getAccount).mockRejectedValue(new Error("API error"));

        const result = await checkRiskLimits(
          "buy",
          "AAPL",
          1000,
          false,
          normalizeSymbol
        );

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Could not verify risk limits");
      });
    });
  });

  // ===========================================================================
  // checkLossProtection Tests
  // ===========================================================================
  describe("checkLossProtection", () => {
    it("always allows buy orders", () => {
      const result = checkLossProtection("buy", "Any notes");
      expect(result.allowed).toBe(true);
    });

    it("allows sell with stop-loss in notes", () => {
      const result = checkLossProtection("sell", "Stop-loss triggered at -5%");
      expect(result.allowed).toBe(true);
    });

    it("allows sell with stop loss (space) in notes", () => {
      const result = checkLossProtection("sell", "stop loss order executed");
      expect(result.allowed).toBe(true);
    });

    it("allows sell with emergency in notes", () => {
      const result = checkLossProtection("sell", "Emergency liquidation");
      expect(result.allowed).toBe(true);
    });

    it("allows sell when isStopLossTriggered flag is true", () => {
      const result = checkLossProtection("sell", "Regular sell", true, false);
      expect(result.allowed).toBe(true);
    });

    it("allows sell when isEmergencyStop flag is true", () => {
      const result = checkLossProtection("sell", "Regular sell", false, true);
      expect(result.allowed).toBe(true);
    });

    it("allows regular sell orders (caller should verify loss)", () => {
      const result = checkLossProtection("sell", "Taking profits");
      expect(result.allowed).toBe(true);
    });

    it("handles undefined notes", () => {
      const result = checkLossProtection("sell", undefined);
      expect(result.allowed).toBe(true);
    });
  });

  // ===========================================================================
  // calculateLossPercentage Tests
  // ===========================================================================
  describe("calculateLossPercentage", () => {
    it("returns loss percentage for position at loss", async () => {
      vi.mocked(alpaca.getPosition).mockResolvedValue({
        symbol: "AAPL",
        avg_entry_price: "100.00",
        current_price: "90.00", // 10% loss
      } as never);

      const result = await calculateLossPercentage(
        "AAPL",
        0,
        normalizeSymbolForOrder
      );

      expect(result).toBeCloseTo(10, 1);
    });

    it("returns profit percentage as absolute value", async () => {
      vi.mocked(alpaca.getPosition).mockResolvedValue({
        symbol: "AAPL",
        avg_entry_price: "100.00",
        current_price: "110.00", // 10% profit
      } as never);

      const result = await calculateLossPercentage(
        "AAPL",
        0,
        normalizeSymbolForOrder
      );

      expect(result).toBeCloseTo(10, 1);
    });

    it("uses provided currentPrice over position price", async () => {
      vi.mocked(alpaca.getPosition).mockResolvedValue({
        symbol: "AAPL",
        avg_entry_price: "100.00",
        current_price: "95.00",
      } as never);

      const result = await calculateLossPercentage(
        "AAPL",
        85.0,
        normalizeSymbolForOrder
      );

      expect(result).toBeCloseTo(15, 1); // 85 vs 100 = 15% loss
    });

    it("returns null when position not found", async () => {
      vi.mocked(alpaca.getPosition).mockResolvedValue(null as never);

      const result = await calculateLossPercentage(
        "AAPL",
        150,
        normalizeSymbolForOrder
      );

      expect(result).toBeNull();
    });

    it("returns null when entry price is invalid", async () => {
      vi.mocked(alpaca.getPosition).mockResolvedValue({
        symbol: "AAPL",
        avg_entry_price: "0",
        current_price: "150.00",
      } as never);

      const result = await calculateLossPercentage(
        "AAPL",
        0,
        normalizeSymbolForOrder
      );

      expect(result).toBeNull();
    });

    it("returns null on API error", async () => {
      vi.mocked(alpaca.getPosition).mockRejectedValue(new Error("API error"));

      const result = await calculateLossPercentage(
        "AAPL",
        150,
        normalizeSymbolForOrder
      );

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // checkSellLossProtection Tests
  // ===========================================================================
  describe("checkSellLossProtection", () => {
    it("allows sell when no position exists", async () => {
      vi.mocked(alpaca.getPosition).mockResolvedValue(null as never);

      const result = await checkSellLossProtection(
        "AAPL",
        "Sell order",
        normalizeSymbolForOrder
      );

      expect(result.allowed).toBe(true);
    });

    it("allows sell for profitable position", async () => {
      vi.mocked(alpaca.getPosition).mockResolvedValue({
        symbol: "AAPL",
        avg_entry_price: "100.00",
        current_price: "110.00", // Profitable
      } as never);

      const result = await checkSellLossProtection(
        "AAPL",
        "Taking profits",
        normalizeSymbolForOrder
      );

      expect(result.allowed).toBe(true);
    });

    it("blocks sell for position at loss without authorization", async () => {
      vi.mocked(alpaca.getPosition).mockResolvedValue({
        symbol: "AAPL",
        avg_entry_price: "100.00",
        current_price: "90.00", // 10% loss
      } as never);

      const result = await checkSellLossProtection(
        "AAPL",
        "Regular sell",
        normalizeSymbolForOrder
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("loss");
      expect(result.reason).toContain("stop-loss");
    });

    it("allows sell at loss with stop-loss in notes", async () => {
      vi.mocked(alpaca.getPosition).mockResolvedValue({
        symbol: "AAPL",
        avg_entry_price: "100.00",
        current_price: "90.00",
      } as never);

      const result = await checkSellLossProtection(
        "AAPL",
        "Stop-loss triggered",
        normalizeSymbolForOrder
      );

      expect(result.allowed).toBe(true);
    });

    it("allows sell at loss with emergency in notes", async () => {
      vi.mocked(alpaca.getPosition).mockResolvedValue({
        symbol: "AAPL",
        avg_entry_price: "100.00",
        current_price: "90.00",
      } as never);

      const result = await checkSellLossProtection(
        "AAPL",
        "Emergency liquidation",
        normalizeSymbolForOrder
      );

      expect(result.allowed).toBe(true);
    });

    it("allows sell at loss with isStopLossTriggered flag", async () => {
      vi.mocked(alpaca.getPosition).mockResolvedValue({
        symbol: "AAPL",
        avg_entry_price: "100.00",
        current_price: "90.00",
      } as never);

      const result = await checkSellLossProtection(
        "AAPL",
        "Regular sell",
        normalizeSymbolForOrder,
        true, // isStopLossTriggered
        false
      );

      expect(result.allowed).toBe(true);
    });

    it("allows sell at loss with isEmergencyStop flag", async () => {
      vi.mocked(alpaca.getPosition).mockResolvedValue({
        symbol: "AAPL",
        avg_entry_price: "100.00",
        current_price: "90.00",
      } as never);

      const result = await checkSellLossProtection(
        "AAPL",
        "Regular sell",
        normalizeSymbolForOrder,
        false,
        true // isEmergencyStop
      );

      expect(result.allowed).toBe(true);
    });

    it("allows sell on API error (fail-safe)", async () => {
      vi.mocked(alpaca.getPosition).mockRejectedValue(new Error("API error"));

      const result = await checkSellLossProtection(
        "AAPL",
        "Sell order",
        normalizeSymbolForOrder
      );

      expect(result.allowed).toBe(true);
    });

    it("handles break-even position (current = entry)", async () => {
      vi.mocked(alpaca.getPosition).mockResolvedValue({
        symbol: "AAPL",
        avg_entry_price: "100.00",
        current_price: "100.00", // Break-even
      } as never);

      const result = await checkSellLossProtection(
        "AAPL",
        "Close position",
        normalizeSymbolForOrder
      );

      expect(result.allowed).toBe(true);
    });
  });
});
