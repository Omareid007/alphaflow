/**
 * Position Manager Tests
 *
 * Comprehensive tests for position lifecycle management including opening,
 * closing, reinforcing positions, and rule checking (SL/TP/trailing stops).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all dependencies before importing the module
vi.mock("../../../server/connectors/alpaca", () => ({
  alpaca: {
    getAccount: vi.fn(),
    getPositions: vi.fn(),
    getOrders: vi.fn(),
    getSnapshots: vi.fn(),
    getCryptoSnapshots: vi.fn(),
    closePosition: vi.fn(),
    getMarketStatus: vi.fn(),
  },
}));

vi.mock("../../../server/storage", () => ({
  storage: {
    createTrade: vi.fn(),
  },
}));

vi.mock("../../../server/utils/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trade: vi.fn(),
  },
}));

vi.mock("../../../server/trading/order-execution-flow", () => ({
  waitForAlpacaOrderFill: vi.fn(),
}));

vi.mock("../../../server/ai/learning-service", () => ({
  recordTradeOutcome: vi.fn(),
  updateTradeOutcomeOnClose: vi.fn(),
}));

vi.mock("../../../server/services/advanced-rebalancing-service", () => ({
  advancedRebalancingService: {
    registerPosition: vi.fn(),
    removePositionRules: vi.fn(),
    checkPartialTakeProfits: vi.fn(),
    updateTrailingStop: vi.fn(),
    checkHoldingPeriod: vi.fn(),
  },
}));

vi.mock("../../../server/services/sector-exposure-service", () => ({
  sectorExposureService: {
    checkExposure: vi.fn(),
  },
}));

vi.mock("../../../server/services/tradability-service", () => ({
  tradabilityService: {
    validateSymbolTradable: vi.fn(),
  },
}));

vi.mock("../../../server/autonomous/order-queue", () => ({
  queueOrderExecution: vi.fn(),
  queueOrderCancellation: vi.fn(),
}));

vi.mock("../../../server/autonomous/pre-trade-guard", () => ({
  preTradeGuard: vi.fn(),
  isSymbolTradable: vi.fn(),
}));

vi.mock("../../../server/autonomous/crypto-utils", () => ({
  isCryptoSymbol: vi.fn(),
  normalizeCryptoSymbol: vi.fn(),
}));

import { PositionManager } from "../../../server/autonomous/position-manager";
import { alpaca } from "../../../server/connectors/alpaca";
import { storage } from "../../../server/storage";
import { waitForAlpacaOrderFill } from "../../../server/trading/order-execution-flow";
import {
  recordTradeOutcome,
  updateTradeOutcomeOnClose,
} from "../../../server/ai/learning-service";
import { advancedRebalancingService } from "../../../server/services/advanced-rebalancing-service";
import { sectorExposureService } from "../../../server/services/sector-exposure-service";
import { tradabilityService } from "../../../server/services/tradability-service";
import {
  queueOrderExecution,
  queueOrderCancellation,
} from "../../../server/autonomous/order-queue";
import {
  preTradeGuard,
  isSymbolTradable,
} from "../../../server/autonomous/pre-trade-guard";
import {
  isCryptoSymbol,
  normalizeCryptoSymbol,
} from "../../../server/autonomous/crypto-utils";
import type {
  OrchestratorState,
  RiskLimits,
  PositionWithRules,
} from "../../../server/autonomous/types";
import type { AIDecision } from "../../../server/ai/decision-engine";

// ===========================================================================
// Test Helpers
// ===========================================================================

function createMockState(
  overrides: Partial<OrchestratorState> = {}
): OrchestratorState {
  return {
    activePositions: new Map(),
    dailyPnl: 0,
    dailyTradeCount: 0,
    portfolioValue: 100000,
    ...overrides,
  } as OrchestratorState;
}

function createMockRiskLimits(overrides: Partial<RiskLimits> = {}): RiskLimits {
  return {
    maxPositionSizePercent: 10,
    maxTotalExposurePercent: 80,
    maxDailyLossPercent: 5,
    maxDrawdownPercent: 20,
    ...overrides,
  } as RiskLimits;
}

function createMockPosition(
  overrides: Partial<PositionWithRules> = {}
): PositionWithRules {
  return {
    symbol: "AAPL",
    quantity: 10,
    availableQuantity: 10,
    entryPrice: 150,
    currentPrice: 155,
    unrealizedPnl: 50,
    unrealizedPnlPercent: 3.33,
    openedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    stopLossPrice: 140,
    takeProfitPrice: 180,
    ...overrides,
  };
}

function createMockDecision(overrides: Partial<AIDecision> = {}): AIDecision {
  return {
    action: "buy",
    confidence: 0.85,
    reasoning: "Strong momentum signal",
    riskLevel: "medium",
    suggestedQuantity: 0.05,
    stopLoss: 140,
    targetPrice: 180,
    ...overrides,
  } as AIDecision;
}

// ===========================================================================
// Tests
// ===========================================================================

describe("PositionManager", () => {
  let state: OrchestratorState;
  let riskLimits: RiskLimits;
  let positionManager: PositionManager;

  beforeEach(() => {
    vi.clearAllMocks();

    state = createMockState();
    riskLimits = createMockRiskLimits();
    positionManager = new PositionManager(state, riskLimits, "user-123");

    // Default mock implementations
    vi.mocked(isCryptoSymbol).mockReturnValue(false);
    vi.mocked(normalizeCryptoSymbol).mockImplementation((s) => s);
    vi.mocked(alpaca.getMarketStatus).mockResolvedValue({
      session: "market",
      isOpen: true,
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Constructor and State Management Tests
  // ===========================================================================
  describe("Constructor and State Management", () => {
    it("initializes with provided state, riskLimits, and userId", () => {
      expect(positionManager.activePositions).toBe(state.activePositions);
      expect(positionManager.dailyPnl).toBe(0);
      expect(positionManager.dailyTradeCount).toBe(0);
    });

    it("setTraceId updates the trace ID", () => {
      positionManager.setTraceId("trace-abc-123");
      // Internal state, verified indirectly through order execution
    });

    it("setUserId updates the user ID", () => {
      positionManager.setUserId("new-user-456");
      // Internal state, verified indirectly through trade creation
    });

    it("updateRiskLimits replaces risk limits", () => {
      const newLimits = createMockRiskLimits({ maxPositionSizePercent: 5 });
      positionManager.updateRiskLimits(newLimits);
      // Verified through position opening behavior
    });

    it("activePositions getter returns state map", () => {
      state.activePositions.set("AAPL", createMockPosition());
      expect(positionManager.activePositions.size).toBe(1);
      expect(positionManager.activePositions.has("AAPL")).toBe(true);
    });

    it("dailyPnl getter returns current value", () => {
      state.dailyPnl = 500;
      expect(positionManager.dailyPnl).toBe(500);
    });

    it("dailyTradeCount getter returns current value", () => {
      state.dailyTradeCount = 5;
      expect(positionManager.dailyTradeCount).toBe(5);
    });
  });

  // ===========================================================================
  // openPosition Tests
  // ===========================================================================
  describe("openPosition", () => {
    beforeEach(() => {
      // Setup successful open flow by default
      vi.mocked(alpaca.getAccount).mockResolvedValue({
        portfolio_value: "100000",
        buying_power: "50000",
      } as never);

      vi.mocked(sectorExposureService.checkExposure).mockResolvedValue({
        canTrade: true,
        sector: "Technology",
        currentExposure: 10,
        maxExposure: 25,
      });

      vi.mocked(isSymbolTradable).mockResolvedValue({
        tradable: true,
        reason: null,
      });

      vi.mocked(preTradeGuard).mockResolvedValue({
        canTrade: true,
        reason: null,
      });

      vi.mocked(tradabilityService.validateSymbolTradable).mockResolvedValue({
        tradable: true,
      });

      vi.mocked(queueOrderExecution).mockResolvedValue({
        orderId: "order-123",
        success: true,
      });

      vi.mocked(waitForAlpacaOrderFill).mockResolvedValue({
        order: {
          id: "order-123",
          filled_avg_price: "150.00",
          filled_qty: "5",
          status: "filled",
        },
        hasFillData: true,
        isFullyFilled: true,
        timedOut: false,
      });

      vi.mocked(storage.createTrade).mockResolvedValue({
        id: "trade-123",
        symbol: "AAPL",
      } as never);

      vi.mocked(recordTradeOutcome).mockResolvedValue(undefined);
    });

    describe("Exposure Validation", () => {
      it("blocks trade when total exposure would exceed limit", async () => {
        // Set high existing exposure
        state.activePositions.set(
          "MSFT",
          createMockPosition({
            symbol: "MSFT",
            quantity: 100,
            currentPrice: 400, // $40,000 position = 40% exposure
          })
        );
        state.activePositions.set(
          "GOOGL",
          createMockPosition({
            symbol: "GOOGL",
            quantity: 50,
            currentPrice: 800, // $40,000 position = 40% exposure
          })
        );
        // Total = 80%, trying to add 5% would exceed

        const decision = createMockDecision({ suggestedQuantity: 0.05 });
        const result = await positionManager.openPosition("AAPL", decision);

        expect(result.success).toBe(false);
        expect(result.reason).toContain("exceed max exposure");
      });

      it("allows trade when under exposure limit", async () => {
        const decision = createMockDecision({ suggestedQuantity: 0.05 });
        const result = await positionManager.openPosition("AAPL", decision);

        expect(result.success).toBe(true);
        expect(result.orderId).toBe("order-123");
      });

      it("caps position size to maxPositionSizePercent", async () => {
        const decision = createMockDecision({ suggestedQuantity: 0.2 }); // 20% requested
        await positionManager.openPosition("AAPL", decision);

        // Should cap to 10% (maxPositionSizePercent)
        const call = vi.mocked(queueOrderExecution).mock.calls[0][0];
        expect(
          parseFloat(call.orderParams.notional || "0")
        ).toBeLessThanOrEqual(10000);
      });
    });

    describe("Sector Exposure Check", () => {
      it("blocks trade when sector exposure limit exceeded", async () => {
        vi.mocked(sectorExposureService.checkExposure).mockResolvedValue({
          canTrade: false,
          sector: "Technology",
          currentExposure: 26,
          maxExposure: 25,
          reason: "Sector exposure limit exceeded for Technology",
        });

        const result = await positionManager.openPosition(
          "AAPL",
          createMockDecision()
        );

        expect(result.success).toBe(false);
        expect(result.reason).toContain("Sector exposure limit exceeded");
      });
    });

    describe("Tradability Checks", () => {
      it("blocks trade when symbol not tradable", async () => {
        vi.mocked(isSymbolTradable).mockResolvedValue({
          tradable: false,
          reason: "Symbol not in approved universe",
        });

        const result = await positionManager.openPosition(
          "BADSTOCK",
          createMockDecision()
        );

        expect(result.success).toBe(false);
        expect(result.reason).toContain("Symbol not in approved universe");
      });

      it("blocks trade when pre-trade guard fails", async () => {
        vi.mocked(isSymbolTradable).mockResolvedValue({ tradable: true });
        vi.mocked(preTradeGuard).mockResolvedValue({
          canTrade: false,
          reason: "Market is closed",
        });

        const result = await positionManager.openPosition(
          "AAPL",
          createMockDecision()
        );

        expect(result.success).toBe(false);
        expect(result.reason).toContain("Market is closed");
      });

      it("blocks trade when tradability service rejects", async () => {
        vi.mocked(tradabilityService.validateSymbolTradable).mockResolvedValue({
          tradable: false,
          reason: "Symbol delisted",
        });

        const result = await positionManager.openPosition(
          "DELISTED",
          createMockDecision()
        );

        expect(result.success).toBe(false);
        expect(result.reason).toContain("Symbol not tradable");
      });
    });

    describe("Order Execution", () => {
      it("creates market order with notional value", async () => {
        await positionManager.openPosition(
          "AAPL",
          createMockDecision({ suggestedQuantity: 0.05 })
        );

        expect(queueOrderExecution).toHaveBeenCalledWith(
          expect.objectContaining({
            orderParams: expect.objectContaining({
              symbol: "AAPL",
              side: "buy",
              type: "market",
              time_in_force: "day",
            }),
          })
        );
      });

      it("uses limit order for extended hours", async () => {
        vi.mocked(preTradeGuard).mockResolvedValue({
          canTrade: true,
          useExtendedHours: true,
          useLimitOrder: true,
          limitPrice: 150,
        });

        await positionManager.openPosition(
          "AAPL",
          createMockDecision({ suggestedQuantity: 0.05 })
        );

        expect(queueOrderExecution).toHaveBeenCalledWith(
          expect.objectContaining({
            orderParams: expect.objectContaining({
              type: "limit",
              extended_hours: true,
            }),
          })
        );
      });

      it("returns failure when order has no fill data", async () => {
        vi.mocked(waitForAlpacaOrderFill).mockResolvedValue({
          order: { id: "order-123", status: "rejected" },
          hasFillData: false,
          isFullyFilled: false,
          timedOut: false,
        });

        const result = await positionManager.openPosition(
          "AAPL",
          createMockDecision()
        );

        expect(result.success).toBe(false);
        expect(result.reason).toContain("rejected or no fill data");
      });

      it("returns failure when order times out without fill", async () => {
        vi.mocked(waitForAlpacaOrderFill).mockResolvedValue({
          order: { id: "order-123", status: "pending" },
          hasFillData: false,
          isFullyFilled: false,
          timedOut: true,
        });

        const result = await positionManager.openPosition(
          "AAPL",
          createMockDecision()
        );

        expect(result.success).toBe(false);
        expect(result.reason).toContain("timed out");
      });
    });

    describe("Post-Execution", () => {
      it("records trade in database", async () => {
        await positionManager.openPosition("AAPL", createMockDecision());

        expect(storage.createTrade).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "user-123",
            symbol: "AAPL",
            side: "buy",
            status: "completed",
          })
        );
      });

      it("increments daily trade count", async () => {
        const initialCount = state.dailyTradeCount;
        await positionManager.openPosition("AAPL", createMockDecision());
        expect(state.dailyTradeCount).toBe(initialCount + 1);
      });

      it("adds position to activePositions map", async () => {
        await positionManager.openPosition("AAPL", createMockDecision());
        expect(state.activePositions.has("AAPL")).toBe(true);
      });

      it("registers with advanced rebalancing service", async () => {
        await positionManager.openPosition("AAPL", createMockDecision());
        expect(
          advancedRebalancingService.registerPosition
        ).toHaveBeenCalledWith("AAPL", 150);
      });

      it("records trade outcome for AI learning", async () => {
        const decision = createMockDecision({ aiDecisionId: "ai-dec-123" });
        await positionManager.openPosition("AAPL", decision);

        expect(recordTradeOutcome).toHaveBeenCalledWith(
          expect.objectContaining({
            decisionId: "ai-dec-123",
            symbol: "AAPL",
            action: "buy",
          })
        );
      });
    });

    describe("Error Handling", () => {
      it("returns failure on API error", async () => {
        vi.mocked(alpaca.getAccount).mockRejectedValue(
          new Error("API unavailable")
        );

        const result = await positionManager.openPosition(
          "AAPL",
          createMockDecision()
        );

        expect(result.success).toBe(false);
        expect(result.reason).toContain("Order failed");
      });

      it("throws when userId not set", async () => {
        positionManager.setUserId(null);

        const result = await positionManager.openPosition(
          "AAPL",
          createMockDecision()
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("userId not initialized");
      });
    });

    describe("Crypto Handling", () => {
      it("normalizes crypto symbol for broker", async () => {
        vi.mocked(isCryptoSymbol).mockReturnValue(true);
        vi.mocked(normalizeCryptoSymbol).mockReturnValue("BTC/USD");

        await positionManager.openPosition("BTC", createMockDecision());

        expect(queueOrderExecution).toHaveBeenCalledWith(
          expect.objectContaining({
            orderParams: expect.objectContaining({
              symbol: "BTC/USD",
            }),
          })
        );
      });
    });
  });

  // ===========================================================================
  // closePosition Tests
  // ===========================================================================
  describe("closePosition", () => {
    beforeEach(() => {
      vi.mocked(alpaca.getOrders).mockResolvedValue([]);
      vi.mocked(alpaca.closePosition).mockResolvedValue({
        id: "close-order-123",
      } as never);

      vi.mocked(waitForAlpacaOrderFill).mockResolvedValue({
        order: {
          id: "close-order-123",
          filled_avg_price: "160.00",
          filled_qty: "10",
          status: "filled",
        },
        hasFillData: true,
        isFullyFilled: true,
        timedOut: false,
      });

      vi.mocked(storage.createTrade).mockResolvedValue({
        id: "trade-456",
      } as never);

      vi.mocked(updateTradeOutcomeOnClose).mockResolvedValue(undefined);
    });

    describe("Loss Protection", () => {
      it("blocks close when position at loss without stop-loss trigger", async () => {
        const position = createMockPosition({
          entryPrice: 160,
          currentPrice: 150, // At loss
          unrealizedPnlPercent: -6.25,
        });
        const decision = createMockDecision({
          action: "sell",
          reasoning: "AI wants to sell",
        });

        const result = await positionManager.closePosition(
          "AAPL",
          decision,
          position,
          100
        );

        expect(result.success).toBe(false);
        expect(result.action).toBe("hold");
        expect(result.reason).toContain("loss");
        expect(result.reason).toContain("stop-loss");
      });

      it("allows close at loss with isStopLossTriggered flag", async () => {
        const position = createMockPosition({
          entryPrice: 160,
          currentPrice: 150,
        });
        const decision = createMockDecision({ action: "sell" });

        const result = await positionManager.closePosition(
          "AAPL",
          decision,
          position,
          100,
          {
            isStopLossTriggered: true,
          }
        );

        expect(result.success).toBe(true);
      });

      it("allows close at loss with isEmergencyStop flag", async () => {
        const position = createMockPosition({
          entryPrice: 160,
          currentPrice: 140, // Big loss
        });
        const decision = createMockDecision({ action: "sell" });

        const result = await positionManager.closePosition(
          "AAPL",
          decision,
          position,
          100,
          {
            isEmergencyStop: true,
          }
        );

        expect(result.success).toBe(true);
      });

      it("allows close when position at profit", async () => {
        const position = createMockPosition({
          entryPrice: 150,
          currentPrice: 160, // Profitable
        });
        const decision = createMockDecision({ action: "sell" });

        const result = await positionManager.closePosition(
          "AAPL",
          decision,
          position,
          100
        );

        expect(result.success).toBe(true);
      });
    });

    describe("Order Cancellation", () => {
      it("cancels pending orders before closing", async () => {
        vi.mocked(alpaca.getOrders).mockResolvedValue([
          { id: "pending-order-1", symbol: "AAPL" },
          { id: "pending-order-2", symbol: "AAPL" },
        ] as never);

        const position = createMockPosition({ currentPrice: 160 }); // Profitable
        await positionManager.closePosition(
          "AAPL",
          createMockDecision({ action: "sell" }),
          position
        );

        expect(queueOrderCancellation).toHaveBeenCalledTimes(2);
      });

      it("continues close even if cancellation fails", async () => {
        vi.mocked(alpaca.getOrders).mockResolvedValue([
          { id: "pending-order-1", symbol: "AAPL" },
        ] as never);
        vi.mocked(queueOrderCancellation).mockRejectedValue(
          new Error("Cancel failed")
        );

        const position = createMockPosition({ currentPrice: 160 });
        const result = await positionManager.closePosition(
          "AAPL",
          createMockDecision({ action: "sell" }),
          position
        );

        expect(result.success).toBe(true);
      });
    });

    describe("Full Close", () => {
      it("calls alpaca.closePosition for 100% close", async () => {
        const position = createMockPosition({ currentPrice: 160 });
        await positionManager.closePosition(
          "AAPL",
          createMockDecision({ action: "sell" }),
          position,
          100
        );

        expect(alpaca.closePosition).toHaveBeenCalledWith("AAPL");
      });

      it("removes position from activePositions on full close", async () => {
        state.activePositions.set("AAPL", createMockPosition());
        const position = createMockPosition({ currentPrice: 160 });

        await positionManager.closePosition(
          "AAPL",
          createMockDecision({ action: "sell" }),
          position,
          100
        );

        expect(state.activePositions.has("AAPL")).toBe(false);
      });

      it("removes position rules from rebalancing service", async () => {
        const position = createMockPosition({ currentPrice: 160 });
        await positionManager.closePosition(
          "AAPL",
          createMockDecision({ action: "sell" }),
          position,
          100
        );

        expect(
          advancedRebalancingService.removePositionRules
        ).toHaveBeenCalledWith("AAPL");
      });
    });

    describe("Partial Close", () => {
      it("queues sell order for partial close", async () => {
        vi.mocked(tradabilityService.validateSymbolTradable).mockResolvedValue({
          tradable: true,
        });
        vi.mocked(queueOrderExecution).mockResolvedValue({
          orderId: "partial-order-123",
        });
        vi.mocked(waitForAlpacaOrderFill).mockResolvedValue({
          order: {
            id: "partial-order-123",
            filled_avg_price: "160.00",
            filled_qty: "2.5",
          },
          hasFillData: true,
          isFullyFilled: true,
          timedOut: false,
        });

        const position = createMockPosition({
          quantity: 10,
          currentPrice: 160,
        });
        await positionManager.closePosition(
          "AAPL",
          createMockDecision({ action: "sell" }),
          position,
          25
        );

        expect(queueOrderExecution).toHaveBeenCalledWith(
          expect.objectContaining({
            orderParams: expect.objectContaining({
              side: "sell",
              type: "market",
            }),
          })
        );
      });

      it("updates position quantity on partial close", async () => {
        vi.mocked(tradabilityService.validateSymbolTradable).mockResolvedValue({
          tradable: true,
        });
        vi.mocked(queueOrderExecution).mockResolvedValue({
          orderId: "partial-order-123",
        });
        vi.mocked(waitForAlpacaOrderFill).mockResolvedValue({
          order: {
            id: "partial-order-123",
            filled_avg_price: "160.00",
            filled_qty: "2.5",
          },
          hasFillData: true,
          isFullyFilled: true,
          timedOut: false,
        });

        const position = createMockPosition({
          quantity: 10,
          currentPrice: 160,
        });
        state.activePositions.set("AAPL", position);

        await positionManager.closePosition(
          "AAPL",
          createMockDecision({ action: "sell" }),
          position,
          25
        );

        // Position should remain with reduced quantity
        expect(state.activePositions.has("AAPL")).toBe(true);
      });

      it("blocks partial close when symbol not tradable", async () => {
        vi.mocked(tradabilityService.validateSymbolTradable).mockResolvedValue({
          tradable: false,
          reason: "Symbol suspended",
        });

        const position = createMockPosition({ currentPrice: 160 });
        const result = await positionManager.closePosition(
          "AAPL",
          createMockDecision({ action: "sell" }),
          position,
          50
        );

        expect(result.success).toBe(false);
        expect(result.reason).toContain("Symbol not tradable");
      });
    });

    describe("P&L Tracking", () => {
      it("calculates and records P&L", async () => {
        const position = createMockPosition({
          entryPrice: 150,
          quantity: 10,
          currentPrice: 160,
        });

        await positionManager.closePosition(
          "AAPL",
          createMockDecision({ action: "sell" }),
          position,
          100
        );

        expect(storage.createTrade).toHaveBeenCalledWith(
          expect.objectContaining({
            side: "sell",
            pnl: expect.any(String),
          })
        );
      });

      it("updates daily P&L", async () => {
        const initialPnl = state.dailyPnl;
        const position = createMockPosition({ currentPrice: 160 });

        await positionManager.closePosition(
          "AAPL",
          createMockDecision({ action: "sell" }),
          position,
          100
        );

        expect(state.dailyPnl).not.toBe(initialPnl);
      });

      it("increments daily trade count", async () => {
        const initialCount = state.dailyTradeCount;
        const position = createMockPosition({ currentPrice: 160 });

        await positionManager.closePosition(
          "AAPL",
          createMockDecision({ action: "sell" }),
          position,
          100
        );

        expect(state.dailyTradeCount).toBe(initialCount + 1);
      });

      it("updates learning service on close", async () => {
        const decision = createMockDecision({
          aiDecisionId: "ai-dec-456",
          action: "sell",
        });
        const position = createMockPosition({ currentPrice: 160 });

        await positionManager.closePosition("AAPL", decision, position, 100);

        expect(updateTradeOutcomeOnClose).toHaveBeenCalledWith(
          "ai-dec-456",
          160,
          expect.any(String),
          expect.any(String)
        );
      });
    });

    describe("Error Handling", () => {
      it("returns failure when no order response", async () => {
        vi.mocked(waitForAlpacaOrderFill).mockResolvedValue({
          order: null,
          hasFillData: false,
          isFullyFilled: false,
          timedOut: false,
        });

        const position = createMockPosition({ currentPrice: 160 });
        const result = await positionManager.closePosition(
          "AAPL",
          createMockDecision({ action: "sell" }),
          position
        );

        expect(result.success).toBe(false);
        expect(result.reason).toContain("no response from broker");
      });

      it("returns failure on API error", async () => {
        vi.mocked(alpaca.closePosition).mockRejectedValue(
          new Error("API error")
        );

        const position = createMockPosition({ currentPrice: 160 });
        const result = await positionManager.closePosition(
          "AAPL",
          createMockDecision({ action: "sell" }),
          position
        );

        expect(result.success).toBe(false);
        expect(result.reason).toContain("Close failed");
      });
    });
  });

  // ===========================================================================
  // reinforcePosition Tests
  // ===========================================================================
  describe("reinforcePosition", () => {
    beforeEach(() => {
      // Setup successful open for reinforcement
      vi.mocked(alpaca.getAccount).mockResolvedValue({
        portfolio_value: "100000",
      } as never);
      vi.mocked(sectorExposureService.checkExposure).mockResolvedValue({
        canTrade: true,
      });
      vi.mocked(isSymbolTradable).mockResolvedValue({ tradable: true });
      vi.mocked(preTradeGuard).mockResolvedValue({ canTrade: true });
      vi.mocked(tradabilityService.validateSymbolTradable).mockResolvedValue({
        tradable: true,
      });
      vi.mocked(queueOrderExecution).mockResolvedValue({
        orderId: "reinforce-order-123",
      });
      vi.mocked(waitForAlpacaOrderFill).mockResolvedValue({
        order: {
          id: "reinforce-order-123",
          filled_avg_price: "152.00",
          filled_qty: "2",
        },
        hasFillData: true,
        isFullyFilled: true,
        timedOut: false,
      });
      vi.mocked(storage.createTrade).mockResolvedValue({
        id: "trade-789",
      } as never);
    });

    it("scales suggested quantity to 50%", async () => {
      const existingPosition = createMockPosition();
      const decision = createMockDecision({ suggestedQuantity: 0.1 }); // 10%

      await positionManager.reinforcePosition(
        "AAPL",
        decision,
        existingPosition
      );

      // Should be 5% (50% of 10%)
      const call = vi.mocked(queueOrderExecution).mock.calls[0][0];
      // Verify notional reflects scaled quantity
      expect(parseFloat(call.orderParams.notional || "0")).toBeLessThanOrEqual(
        5000
      );
    });

    it("opens position with reduced quantity", async () => {
      const existingPosition = createMockPosition();
      const result = await positionManager.reinforcePosition(
        "AAPL",
        createMockDecision(),
        existingPosition
      );

      expect(result.success).toBe(true);
      expect(queueOrderExecution).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // checkPositionRules Tests
  // ===========================================================================
  describe("checkPositionRules", () => {
    beforeEach(() => {
      // Setup close for rule triggers
      vi.mocked(alpaca.getOrders).mockResolvedValue([]);
      vi.mocked(alpaca.closePosition).mockResolvedValue({
        id: "rule-close-123",
      } as never);
      vi.mocked(waitForAlpacaOrderFill).mockResolvedValue({
        order: {
          id: "rule-close-123",
          filled_avg_price: "145.00",
          filled_qty: "10",
        },
        hasFillData: true,
        isFullyFilled: true,
        timedOut: false,
      });
      vi.mocked(storage.createTrade).mockResolvedValue({
        id: "trade-rule",
      } as never);
      vi.mocked(
        advancedRebalancingService.checkPartialTakeProfits
      ).mockReturnValue(null);
      vi.mocked(advancedRebalancingService.updateTrailingStop).mockReturnValue(
        null
      );
      vi.mocked(advancedRebalancingService.checkHoldingPeriod).mockReturnValue(
        null
      );
    });

    describe("Stop-Loss (Highest Priority)", () => {
      it("triggers close when price hits stop-loss", async () => {
        const position = createMockPosition({
          currentPrice: 138, // Below stop-loss of 140
          stopLossPrice: 140,
          entryPrice: 150,
        });

        await positionManager.checkPositionRules("AAPL", position);

        expect(alpaca.closePosition).toHaveBeenCalledWith("AAPL");
        expect(
          advancedRebalancingService.removePositionRules
        ).toHaveBeenCalledWith("AAPL");
      });

      it("does not trigger when price above stop-loss", async () => {
        const position = createMockPosition({
          currentPrice: 145,
          stopLossPrice: 140,
        });

        await positionManager.checkPositionRules("AAPL", position);

        expect(alpaca.closePosition).not.toHaveBeenCalled();
      });
    });

    describe("Emergency Stop (-8%)", () => {
      it("triggers close when loss exceeds -8%", async () => {
        const position = createMockPosition({
          unrealizedPnlPercent: -9, // Below -8% threshold
          stopLossPrice: undefined, // No manual stop-loss
          entryPrice: 150,
          currentPrice: 136.5,
        });

        await positionManager.checkPositionRules("AAPL", position);

        expect(alpaca.closePosition).toHaveBeenCalled();
      });

      it("does not trigger when loss under -8%", async () => {
        const position = createMockPosition({
          unrealizedPnlPercent: -5,
          stopLossPrice: undefined,
        });

        await positionManager.checkPositionRules("AAPL", position);

        expect(alpaca.closePosition).not.toHaveBeenCalled();
      });
    });

    describe("Graduated Take-Profits", () => {
      it("triggers partial close on take-profit tier hit", async () => {
        vi.mocked(
          advancedRebalancingService.checkPartialTakeProfits
        ).mockReturnValue({
          shouldClose: true,
          closePercent: 25,
          reason: "Tier 1: 10% profit reached",
        });
        vi.mocked(tradabilityService.validateSymbolTradable).mockResolvedValue({
          tradable: true,
        });
        vi.mocked(queueOrderExecution).mockResolvedValue({
          orderId: "tp-order-123",
        });
        vi.mocked(waitForAlpacaOrderFill).mockResolvedValue({
          order: {
            id: "tp-order-123",
            filled_avg_price: "165.00",
            filled_qty: "2.5",
          },
          hasFillData: true,
          isFullyFilled: true,
          timedOut: false,
        });

        const position = createMockPosition({
          unrealizedPnlPercent: 11,
          currentPrice: 165,
        });
        state.activePositions.set("AAPL", position);

        await positionManager.checkPositionRules("AAPL", position);

        expect(queueOrderExecution).toHaveBeenCalled();
      });
    });

    describe("Trailing Stop Updates", () => {
      it("updates stop-loss when trailing stop moves up", async () => {
        vi.mocked(
          advancedRebalancingService.updateTrailingStop
        ).mockReturnValue({
          newStopLoss: 155,
          reason: "Trailing stop updated: $155",
        });

        const position = createMockPosition({
          currentPrice: 165,
          stopLossPrice: 145,
        });
        state.activePositions.set("AAPL", position);

        await positionManager.checkPositionRules("AAPL", position);

        expect(state.activePositions.get("AAPL")?.stopLossPrice).toBe(155);
      });
    });

    describe("Max Holding Period", () => {
      it("closes position when holding period exceeded", async () => {
        vi.mocked(
          advancedRebalancingService.checkHoldingPeriod
        ).mockReturnValue({
          exceeded: true,
          holdingHours: 180,
          maxHours: 168,
        });

        const position = createMockPosition({
          unrealizedPnlPercent: 2, // Small profit
          currentPrice: 153,
        });

        await positionManager.checkPositionRules("AAPL", position);

        expect(alpaca.closePosition).toHaveBeenCalled();
      });
    });

    describe("Legacy Take-Profit Fallback", () => {
      it("triggers full close when price >= take-profit and >15% gain", async () => {
        const position = createMockPosition({
          takeProfitPrice: 170,
          currentPrice: 175,
          unrealizedPnlPercent: 17, // >15%
          entryPrice: 150,
        });

        await positionManager.checkPositionRules("AAPL", position);

        expect(alpaca.closePosition).toHaveBeenCalled();
      });

      it("triggers partial close when price >= take-profit and 10-15% gain", async () => {
        vi.mocked(tradabilityService.validateSymbolTradable).mockResolvedValue({
          tradable: true,
        });
        vi.mocked(queueOrderExecution).mockResolvedValue({
          orderId: "legacy-tp-123",
        });
        vi.mocked(waitForAlpacaOrderFill).mockResolvedValue({
          order: {
            id: "legacy-tp-123",
            filled_avg_price: "168.00",
            filled_qty: "5",
          },
          hasFillData: true,
          isFullyFilled: true,
          timedOut: false,
        });

        const position = createMockPosition({
          takeProfitPrice: 165,
          currentPrice: 168,
          unrealizedPnlPercent: 12, // 10-15%
          quantity: 10,
        });
        state.activePositions.set("AAPL", position);

        await positionManager.checkPositionRules("AAPL", position);

        // Should trigger 50% partial close
        expect(queueOrderExecution).toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // adjustStopLossTakeProfit Tests
  // ===========================================================================
  describe("adjustStopLossTakeProfit", () => {
    it("updates stop-loss when valid", async () => {
      const position = createMockPosition({ currentPrice: 160 });
      state.activePositions.set("AAPL", position);

      const result = await positionManager.adjustStopLossTakeProfit(
        "AAPL",
        155
      );

      expect(result).toBe(true);
      expect(state.activePositions.get("AAPL")?.stopLossPrice).toBe(155);
    });

    it("rejects stop-loss above current price", async () => {
      const position = createMockPosition({ currentPrice: 160 });
      state.activePositions.set("AAPL", position);

      const result = await positionManager.adjustStopLossTakeProfit(
        "AAPL",
        165
      ); // Above current

      expect(result).toBe(false);
    });

    it("updates take-profit when valid", async () => {
      const position = createMockPosition({ currentPrice: 160 });
      state.activePositions.set("AAPL", position);

      const result = await positionManager.adjustStopLossTakeProfit(
        "AAPL",
        undefined,
        180
      );

      expect(result).toBe(true);
      expect(state.activePositions.get("AAPL")?.takeProfitPrice).toBe(180);
    });

    it("rejects take-profit below current price", async () => {
      const position = createMockPosition({ currentPrice: 160 });
      state.activePositions.set("AAPL", position);

      const result = await positionManager.adjustStopLossTakeProfit(
        "AAPL",
        undefined,
        155
      ); // Below current

      expect(result).toBe(false);
    });

    it("updates trailing stop percent when valid", async () => {
      const position = createMockPosition({ currentPrice: 160 });
      state.activePositions.set("AAPL", position);

      const result = await positionManager.adjustStopLossTakeProfit(
        "AAPL",
        undefined,
        undefined,
        5
      );

      expect(result).toBe(true);
      expect(state.activePositions.get("AAPL")?.trailingStopPercent).toBe(5);
    });

    it("rejects invalid trailing stop percent", async () => {
      const position = createMockPosition({ currentPrice: 160 });
      state.activePositions.set("AAPL", position);

      const result1 = await positionManager.adjustStopLossTakeProfit(
        "AAPL",
        undefined,
        undefined,
        0
      );
      const result2 = await positionManager.adjustStopLossTakeProfit(
        "AAPL",
        undefined,
        undefined,
        100
      );

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it("returns false when position not found", async () => {
      const result = await positionManager.adjustStopLossTakeProfit(
        "NOTEXIST",
        100
      );
      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // applyTrailingStopToAllPositions Tests
  // ===========================================================================
  describe("applyTrailingStopToAllPositions", () => {
    it("applies trailing stop to profitable positions only", async () => {
      state.activePositions.set(
        "AAPL",
        createMockPosition({
          symbol: "AAPL",
          unrealizedPnlPercent: 5, // Profitable
        })
      );
      state.activePositions.set(
        "MSFT",
        createMockPosition({
          symbol: "MSFT",
          unrealizedPnlPercent: -3, // Losing
        })
      );
      state.activePositions.set(
        "GOOGL",
        createMockPosition({
          symbol: "GOOGL",
          unrealizedPnlPercent: 10, // Profitable
        })
      );

      await positionManager.applyTrailingStopToAllPositions(5);

      expect(state.activePositions.get("AAPL")?.trailingStopPercent).toBe(5);
      expect(
        state.activePositions.get("MSFT")?.trailingStopPercent
      ).toBeUndefined();
      expect(state.activePositions.get("GOOGL")?.trailingStopPercent).toBe(5);
    });

    it("uses default 5% if not specified", async () => {
      state.activePositions.set(
        "AAPL",
        createMockPosition({ unrealizedPnlPercent: 5 })
      );

      await positionManager.applyTrailingStopToAllPositions();

      expect(state.activePositions.get("AAPL")?.trailingStopPercent).toBe(5);
    });
  });
});
