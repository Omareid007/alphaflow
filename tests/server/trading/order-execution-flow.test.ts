/**
 * Tests for Order Execution Flow
 *
 * Tests cover:
 * - Error classification and recovery strategies
 * - Order validation (schema, tradability, price validation)
 * - Order execution with retries
 * - Expected vs actual outcome analysis
 * - Recovery mechanisms
 * - Order book cleanup utilities
 * - Shared order helpers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before importing the module
vi.mock("../../../server/connectors/alpaca", () => ({
  alpaca: {
    createOrder: vi.fn(),
    getOrder: vi.fn(),
    getOrders: vi.fn(),
    cancelOrder: vi.fn(),
    getSnapshots: vi.fn(),
    getMarketStatus: vi.fn(),
  },
}));

vi.mock("../../../server/storage", () => ({
  storage: {
    getTrades: vi.fn(),
    createTrade: vi.fn(),
  },
}));

vi.mock("../../../server/services/tradability-service", () => ({
  tradabilityService: {
    validateSymbolTradable: vi.fn(),
  },
}));

vi.mock("../../../server/lib/performance-metrics", () => ({
  performanceTracker: {
    startTimer: vi.fn(),
    endTimer: vi.fn().mockReturnValue(10),
  },
}));

vi.mock("../../../server/lib/order-execution-cache", () => ({
  cacheQuickQuote: vi.fn(),
  getQuickQuote: vi.fn(),
  cacheAccountSnapshot: vi.fn(),
  getAccountSnapshot: vi.fn(),
  cacheTradability: vi.fn(),
  getTradability: vi.fn(),
}));

vi.mock("../../../server/lib/webhook-emitter", () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../server/lib/notification-service", () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../server/utils/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../../server/config/trading-config", () => ({
  tradingConfig: {
    orderExecution: {
      orderFillPollIntervalMs: 100,
      orderFillTimeoutMs: 5000,
      staleOrderTimeoutMs: 86400000,
    },
  },
}));

vi.mock("../../../server/trading/order-types-matrix", () => ({
  CreateOrderSchema: {
    parse: vi.fn().mockImplementation((params) => params),
  },
  validateOrderTypeCombination: vi.fn().mockReturnValue({
    valid: true,
    errors: [],
    warnings: [],
  }),
  validateStopPrice: vi.fn().mockReturnValue({
    valid: true,
    errors: [],
    warnings: [],
  }),
  validateLimitPrice: vi.fn().mockReturnValue({
    valid: true,
    errors: [],
    warnings: [],
  }),
  validateBracketOrder: vi.fn().mockReturnValue({
    valid: true,
    errors: [],
    warnings: [],
  }),
  validateTrailingStop: vi.fn().mockReturnValue({
    valid: true,
    errors: [],
    warnings: [],
  }),
  TERMINAL_STATUSES: ["filled", "canceled", "expired", "rejected"],
  ACTIVE_STATUSES: ["new", "partially_filled", "accepted", "pending_new"],
  FAILED_STATUSES: ["canceled", "expired", "rejected"],
  // Add function mocks for status checks
  isTerminalStatus: vi
    .fn()
    .mockImplementation((status: string) =>
      ["filled", "canceled", "expired", "rejected"].includes(status)
    ),
  isActiveStatus: vi
    .fn()
    .mockImplementation((status: string) =>
      ["new", "partially_filled", "accepted", "pending_new"].includes(status)
    ),
  isFailedStatus: vi
    .fn()
    .mockImplementation((status: string) =>
      ["canceled", "expired", "rejected"].includes(status)
    ),
}));

// Now import the module under test
import { alpaca } from "../../../server/connectors/alpaca";
import { storage } from "../../../server/storage";
import { tradabilityService } from "../../../server/services/tradability-service";
import { getQuickQuote } from "../../../server/lib/order-execution-cache";
import {
  CreateOrderSchema,
  validateOrderTypeCombination,
  validateStopPrice,
  validateLimitPrice,
} from "../../../server/trading/order-types-matrix";

// Import after mocks are set up
import {
  orderExecutionEngine,
  OrderErrorType,
  RecoveryStrategy,
  identifyUnrealOrders,
  cleanupUnrealOrders,
  reconcileOrderBook,
  waitForAlpacaOrderFill,
  cancelExpiredOrders,
} from "../../../server/trading/order-execution-flow";

describe("Order Execution Flow", () => {
  const mockCreateOrder = alpaca.createOrder as ReturnType<typeof vi.fn>;
  const mockGetOrder = alpaca.getOrder as ReturnType<typeof vi.fn>;
  const mockGetOrders = alpaca.getOrders as ReturnType<typeof vi.fn>;
  const mockCancelOrder = alpaca.cancelOrder as ReturnType<typeof vi.fn>;
  const mockGetSnapshots = alpaca.getSnapshots as ReturnType<typeof vi.fn>;
  const mockGetMarketStatus = alpaca.getMarketStatus as ReturnType<
    typeof vi.fn
  >;
  const mockGetTrades = storage.getTrades as ReturnType<typeof vi.fn>;
  const mockCreateTrade = storage.createTrade as ReturnType<typeof vi.fn>;
  const mockValidateSymbolTradable =
    tradabilityService.validateSymbolTradable as ReturnType<typeof vi.fn>;
  const mockGetQuickQuote = getQuickQuote as ReturnType<typeof vi.fn>;
  const mockCreateOrderSchema = CreateOrderSchema.parse as ReturnType<
    typeof vi.fn
  >;
  const mockValidateOrderTypeCombination =
    validateOrderTypeCombination as ReturnType<typeof vi.fn>;
  const mockValidateStopPrice = validateStopPrice as ReturnType<typeof vi.fn>;
  const mockValidateLimitPrice = validateLimitPrice as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Use real timers for most tests - the order execution flow uses multiple
    // nested async operations with polling that don't work well with fake timers

    // Default mock implementations
    mockValidateSymbolTradable.mockResolvedValue({
      tradable: true,
      fractionable: true,
      marginable: true,
    });

    mockGetSnapshots.mockResolvedValue({
      AAPL: {
        latestTrade: { p: 150.0 },
        latestQuote: { bp: 149.95, ap: 150.05 },
      },
    });

    mockGetMarketStatus.mockResolvedValue({
      isOpen: true,
      session: "market",
      isExtendedHours: false,
    });

    mockGetQuickQuote.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // ERROR CLASSIFICATION TESTS
  // ============================================================================

  describe("Error Classification", () => {
    it("should classify insufficient funds error", async () => {
      mockCreateOrder.mockRejectedValueOnce(
        new Error("insufficient buying power")
      );

      const result = await orderExecutionEngine.executeOrder({
        symbol: "AAPL",
        side: "buy",
        type: "market",
        qty: "100",
        time_in_force: "day",
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(OrderErrorType.INSUFFICIENT_FUNDS);
      expect(result.error?.retryable).toBe(false);
      expect(result.error?.recoveryStrategy).toBe(
        RecoveryStrategy.ADJUST_AND_RETRY
      );
    });

    it("should classify invalid symbol error", async () => {
      mockValidateSymbolTradable.mockResolvedValue({
        tradable: false,
        reason: "Symbol not found",
      });

      const result = await orderExecutionEngine.executeOrder({
        symbol: "INVALID",
        side: "buy",
        type: "market",
        qty: "10",
        time_in_force: "day",
      });

      expect(result.success).toBe(false);
      expect(result.state.status).toBe("failed");
    });

    it("should classify market closed error", async () => {
      mockCreateOrder.mockRejectedValueOnce(new Error("market is not open"));

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { maxRetries: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(OrderErrorType.MARKET_CLOSED);
      expect(result.error?.retryable).toBe(true);
      expect(result.error?.recoveryStrategy).toBe(
        RecoveryStrategy.WAIT_FOR_MARKET_OPEN
      );
    });

    it("should classify rate limit error", async () => {
      mockCreateOrder.mockRejectedValueOnce(
        new Error("429 rate limit exceeded")
      );

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { maxRetries: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(OrderErrorType.RATE_LIMITED);
      expect(result.error?.retryable).toBe(true);
      expect(result.error?.suggestedDelay).toBe(5000);
    });

    it("should classify network error", async () => {
      mockCreateOrder.mockRejectedValueOnce(
        new Error("fetch failed: ECONNREFUSED")
      );

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { maxRetries: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(OrderErrorType.NETWORK_ERROR);
      expect(result.error?.retryable).toBe(true);
    });

    it("should classify timeout error", async () => {
      mockCreateOrder.mockRejectedValueOnce(new Error("request timeout"));

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { maxRetries: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(OrderErrorType.TIMEOUT);
      expect(result.error?.recoveryStrategy).toBe(
        RecoveryStrategy.CHECK_AND_SYNC
      );
    });

    it("should classify broker rejection error", async () => {
      mockCreateOrder.mockRejectedValueOnce(
        new Error("order rejected by exchange")
      );

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { maxRetries: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(OrderErrorType.BROKER_REJECTION);
      expect(result.error?.retryable).toBe(false);
    });

    it("should classify unknown error with retry capability", async () => {
      mockCreateOrder.mockRejectedValueOnce(
        new Error("something weird happened")
      );

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { maxRetries: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(OrderErrorType.UNKNOWN);
      expect(result.error?.retryable).toBe(true);
    });
  });

  // ============================================================================
  // ORDER VALIDATION TESTS
  // ============================================================================

  describe("Order Validation", () => {
    it("should validate order schema", async () => {
      mockCreateOrderSchema.mockImplementationOnce(() => {
        throw new Error("Invalid order schema");
      });

      const result = await orderExecutionEngine.executeOrder({
        symbol: "AAPL",
        side: "buy",
        type: "market",
        qty: "10",
        time_in_force: "day",
      });

      expect(result.success).toBe(false);
      expect(result.state.validationResult?.valid).toBe(false);
    });

    it("should validate symbol tradability", async () => {
      mockValidateSymbolTradable.mockResolvedValue({
        tradable: false,
        reason: "Asset is not active",
      });

      const result = await orderExecutionEngine.executeOrder({
        symbol: "DELISTED",
        side: "buy",
        type: "market",
        qty: "10",
        time_in_force: "day",
      });

      expect(result.success).toBe(false);
      expect(result.state.status).toBe("failed");
      // Validation should fail for non-tradable symbols
      expect(result.state.validationResult?.valid).toBe(false);
      expect(result.state.validationResult?.errors.length).toBeGreaterThan(0);
    });

    it("should add warning for non-fractionable assets with notional", async () => {
      mockValidateSymbolTradable.mockResolvedValue({
        tradable: true,
        fractionable: false,
        marginable: true,
      });

      mockCreateOrder.mockResolvedValue({
        id: "order-123",
        status: "filled",
        filled_qty: "10",
        filled_avg_price: "150.00",
        symbol: "BRK.A",
        side: "buy",
        qty: "10",
        created_at: new Date().toISOString(),
      });

      mockGetOrder.mockResolvedValue({
        id: "order-123",
        status: "filled",
        filled_qty: "10",
        filled_avg_price: "150.00",
      });

      const result = await orderExecutionEngine.executeOrder({
        symbol: "BRK.A",
        side: "buy",
        type: "market",
        notional: "1000",
        time_in_force: "day",
      });

      // Should have warnings when using notional with non-fractionable asset
      expect(result.validationWarnings.length).toBeGreaterThan(0);
      // Check that at least one warning mentions fractionable or notional
      const hasRelevantWarning = result.validationWarnings.some(
        (w) =>
          w.includes("fractional") ||
          w.includes("notional") ||
          w.includes("qty")
      );
      expect(hasRelevantWarning).toBe(true);
    });

    it("should validate order type and time_in_force combination", async () => {
      mockValidateOrderTypeCombination.mockReturnValueOnce({
        valid: false,
        errors: ["Extended hours only supports limit orders"],
        warnings: [],
      });

      const result = await orderExecutionEngine.executeOrder({
        symbol: "AAPL",
        side: "buy",
        type: "market",
        qty: "10",
        time_in_force: "day",
        extended_hours: true,
      });

      expect(result.success).toBe(false);
      expect(result.state.validationResult?.valid).toBe(false);
    });

    it("should validate stop price for sell orders", async () => {
      mockValidateStopPrice.mockReturnValueOnce({
        valid: false,
        errors: ["Stop price must be below current price for sell orders"],
        warnings: [],
      });

      const result = await orderExecutionEngine.executeOrder({
        symbol: "AAPL",
        side: "sell",
        type: "stop",
        qty: "10",
        stop_price: "200.00",
        time_in_force: "day",
      });

      expect(result.success).toBe(false);
    });

    it("should validate limit price", async () => {
      mockValidateLimitPrice.mockReturnValueOnce({
        valid: false,
        errors: ["Limit price too far from current price"],
        warnings: [],
      });

      const result = await orderExecutionEngine.executeOrder({
        symbol: "AAPL",
        side: "buy",
        type: "limit",
        qty: "10",
        limit_price: "50.00",
        time_in_force: "day",
      });

      expect(result.success).toBe(false);
    });

    it("should warn about market status for day orders", async () => {
      mockGetMarketStatus.mockResolvedValue({
        isOpen: false,
        session: "closed",
        isExtendedHours: false,
      });

      mockCreateOrder.mockResolvedValue({
        id: "order-123",
        status: "filled",
        filled_qty: "10",
        filled_avg_price: "150.00",
        symbol: "AAPL",
        side: "buy",
      });

      mockGetOrder.mockResolvedValue({
        id: "order-123",
        status: "filled",
        filled_qty: "10",
        filled_avg_price: "150.00",
      });

      const result = await orderExecutionEngine.executeOrder({
        symbol: "AAPL",
        side: "buy",
        type: "market",
        qty: "10",
        time_in_force: "day",
      });

      // Should have warnings when market is closed and using day orders
      expect(result.validationWarnings.length).toBeGreaterThan(0);
      // Check that at least one warning mentions market, closed, or day
      const hasMarketWarning = result.validationWarnings.some(
        (w) =>
          w.toLowerCase().includes("market") ||
          w.toLowerCase().includes("closed") ||
          w.toLowerCase().includes("day")
      );
      expect(hasMarketWarning).toBe(true);
    });

    it("should skip validation when validateBeforeSubmit is false", async () => {
      mockCreateOrder.mockResolvedValue({
        id: "order-123",
        status: "filled",
        filled_qty: "10",
        filled_avg_price: "150.00",
        symbol: "AAPL",
        side: "buy",
        created_at: new Date().toISOString(),
        filled_at: new Date().toISOString(),
      });

      mockGetOrder.mockResolvedValue({
        id: "order-123",
        status: "filled",
        filled_qty: "10",
        filled_avg_price: "150.00",
      });

      await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { validateBeforeSubmit: false, timeoutMs: 1000 }
      );

      expect(mockValidateSymbolTradable).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ORDER EXECUTION TESTS
  // ============================================================================

  describe("Order Execution", () => {
    it("should successfully execute a market order", async () => {
      const mockOrder = {
        id: "order-abc123",
        client_order_id: "client-123",
        status: "filled",
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        filled_qty: "10",
        filled_avg_price: "150.25",
        created_at: new Date().toISOString(),
        filled_at: new Date().toISOString(),
      };

      mockCreateOrder.mockResolvedValue(mockOrder);
      mockGetOrder.mockResolvedValue(mockOrder);

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { timeoutMs: 1000 }
      );

      expect(result.success).toBe(true);
      expect(result.state.status).toBe("filled");
      expect(result.state.filledQty).toBe("10");
      expect(result.state.filledPrice).toBe("150.25");
      expect(result.order?.id).toBe("order-abc123");
    });

    it("should retry on transient errors", async () => {
      const mockOrder = {
        id: "order-retry-123",
        status: "filled",
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        filled_qty: "10",
        filled_avg_price: "150.00",
        created_at: new Date().toISOString(),
        filled_at: new Date().toISOString(),
      };

      // First attempt fails with network error, second succeeds
      mockCreateOrder
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce(mockOrder);

      mockGetOrder.mockResolvedValue(mockOrder);

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { maxRetries: 3, retryDelayMs: 10, timeoutMs: 1000 }
      );

      expect(result.success).toBe(true);
      expect(result.state.attempts).toBe(2);
      expect(mockCreateOrder).toHaveBeenCalledTimes(2);
    });

    it("should fail after max retries", async () => {
      mockCreateOrder.mockRejectedValue(new Error("persistent network error"));

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { maxRetries: 2, retryDelayMs: 10, autoRecover: false }
      );

      expect(result.success).toBe(false);
      expect(result.state.attempts).toBe(2);
      expect(result.state.status).toBe("failed");
      expect(result.state.errors.length).toBe(2);
    });

    it("should use provided client_order_id", async () => {
      const customClientId = "my-custom-order-id";
      const mockOrder = {
        id: "order-123",
        client_order_id: customClientId,
        status: "filled",
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        filled_qty: "10",
        filled_avg_price: "150.00",
        created_at: new Date().toISOString(),
        filled_at: new Date().toISOString(),
      };

      mockCreateOrder.mockResolvedValue(mockOrder);
      mockGetOrder.mockResolvedValue(mockOrder);

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
          client_order_id: customClientId,
        },
        { timeoutMs: 1000 }
      );

      expect(result.success).toBe(true);
      expect(result.state.clientOrderId).toBe(customClientId);
    });

    it("should track partially filled orders", async () => {
      const mockOrder = {
        id: "order-partial",
        status: "partially_filled",
        symbol: "AAPL",
        side: "buy",
        qty: "100",
        filled_qty: "50",
        filled_avg_price: "150.00",
        created_at: new Date().toISOString(),
      };

      mockCreateOrder.mockResolvedValue(mockOrder);

      // First poll returns partial, then filled
      mockGetOrder.mockResolvedValueOnce(mockOrder).mockResolvedValue({
        ...mockOrder,
        status: "filled",
        filled_qty: "100",
        filled_at: new Date().toISOString(),
      });

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "100",
          time_in_force: "day",
        },
        { timeoutMs: 3000 }
      );

      expect(result.success).toBe(true);
      expect(result.state.filledQty).toBe("100");
    });

    it("should handle canceled orders", async () => {
      const mockOrder = {
        id: "order-canceled",
        status: "new",
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        filled_qty: "0",
        filled_avg_price: null,
        created_at: new Date().toISOString(),
      };

      mockCreateOrder.mockResolvedValue(mockOrder);
      mockGetOrder.mockResolvedValue({
        ...mockOrder,
        status: "canceled",
      });

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "limit",
          qty: "10",
          limit_price: "140.00",
          time_in_force: "day",
        },
        { timeoutMs: 1000 }
      );

      expect(result.success).toBe(false);
      expect(result.order?.status).toBe("canceled");
    });
  });

  // ============================================================================
  // EXPECTED OUTCOME TESTS
  // ============================================================================

  describe("Expected Outcome Calculation", () => {
    it("should calculate expected outcome for market orders", async () => {
      const mockOrder = {
        id: "order-market",
        status: "filled",
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        filled_qty: "10",
        filled_avg_price: "150.50",
        created_at: new Date().toISOString(),
        filled_at: new Date().toISOString(),
      };

      mockCreateOrder.mockResolvedValue(mockOrder);
      mockGetOrder.mockResolvedValue(mockOrder);

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { trackExpectedOutcome: true, timeoutMs: 1000 }
      );

      expect(result.state.expectedOutcome).toBeDefined();
      expect(result.state.expectedOutcome?.shouldFillImmediately).toBe(true);
      expect(result.state.expectedOutcome?.fillQty).toBe(10);
      expect(result.state.expectedOutcome?.risksIdentified).toContain(
        "Slippage possible in fast-moving markets"
      );
    });

    it("should calculate expected outcome for limit orders", async () => {
      const mockOrder = {
        id: "order-limit",
        status: "filled",
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        filled_qty: "10",
        filled_avg_price: "145.00",
        created_at: new Date().toISOString(),
        filled_at: new Date().toISOString(),
      };

      mockCreateOrder.mockResolvedValue(mockOrder);
      mockGetOrder.mockResolvedValue(mockOrder);

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "limit",
          qty: "10",
          limit_price: "145.00",
          time_in_force: "day",
        },
        { trackExpectedOutcome: true, timeoutMs: 1000 }
      );

      expect(result.state.expectedOutcome).toBeDefined();
      expect(result.state.expectedOutcome?.fillPrice.min).toBe(145);
      expect(result.state.expectedOutcome?.fillPrice.max).toBe(145);
    });

    it("should skip expected outcome when tracking disabled", async () => {
      const mockOrder = {
        id: "order-no-track",
        status: "filled",
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        filled_qty: "10",
        filled_avg_price: "150.00",
        created_at: new Date().toISOString(),
        filled_at: new Date().toISOString(),
      };

      mockCreateOrder.mockResolvedValue(mockOrder);
      mockGetOrder.mockResolvedValue(mockOrder);

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { trackExpectedOutcome: false, timeoutMs: 1000 }
      );

      expect(result.state.expectedOutcome).toBeNull();
    });
  });

  // ============================================================================
  // OUTCOME ANALYSIS TESTS
  // ============================================================================

  describe("Outcome Analysis", () => {
    it("should detect significant slippage", async () => {
      // Current price is 150, but filled at 155 (>1% slippage)
      const mockOrder = {
        id: "order-slippage",
        status: "filled",
        symbol: "AAPL",
        side: "buy",
        qty: "10",
        filled_qty: "10",
        filled_avg_price: "155.00",
        created_at: new Date().toISOString(),
        filled_at: new Date().toISOString(),
      };

      mockCreateOrder.mockResolvedValue(mockOrder);
      mockGetOrder.mockResolvedValue(mockOrder);

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { timeoutMs: 1000 }
      );

      // Should have outcome analysis with issues
      expect(result.outcomeAnalysis).toBeDefined();
      expect(result.outcomeAnalysis?.unexpectedIssues.length).toBeGreaterThan(
        0
      );

      // Check for slippage-related issue
      const hasSlippageIssue = result.outcomeAnalysis?.unexpectedIssues.some(
        (issue) =>
          issue.toLowerCase().includes("price") ||
          issue.toLowerCase().includes("slippage") ||
          issue.toLowerCase().includes("range")
      );
      expect(hasSlippageIssue).toBe(true);
    });

    it("should detect partial fills", async () => {
      const mockOrder = {
        id: "order-partial-analysis",
        status: "filled",
        symbol: "AAPL",
        side: "buy",
        qty: "100",
        filled_qty: "50",
        filled_avg_price: "150.00",
        created_at: new Date().toISOString(),
        filled_at: new Date().toISOString(),
      };

      mockCreateOrder.mockResolvedValue(mockOrder);
      mockGetOrder.mockResolvedValue(mockOrder);

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "100",
          time_in_force: "day",
        },
        { timeoutMs: 1000 }
      );

      expect(result.outcomeAnalysis?.matchesExpected).toBe(false);
      expect(result.outcomeAnalysis?.unexpectedIssues.length).toBeGreaterThan(
        0
      );

      // Check for partial fill issue
      const hasPartialFillIssue = result.outcomeAnalysis?.unexpectedIssues.some(
        (issue) =>
          issue.toLowerCase().includes("partial") ||
          issue.toLowerCase().includes("fill")
      );
      expect(hasPartialFillIssue).toBe(true);
    });
  });

  // ============================================================================
  // RECOVERY STRATEGY TESTS
  // ============================================================================

  describe("Recovery Strategies", () => {
    it("should attempt CHECK_AND_SYNC recovery on timeout", async () => {
      // First attempt times out
      mockCreateOrder.mockRejectedValueOnce(new Error("request timeout"));

      // Recovery finds existing order
      mockGetOrders.mockResolvedValue([
        {
          id: "recovered-order",
          client_order_id: expect.any(String),
          status: "filled",
          symbol: "AAPL",
          side: "buy",
          qty: "10",
          filled_qty: "10",
          filled_avg_price: "150.00",
        },
      ]);

      mockGetOrder.mockResolvedValue({
        id: "recovered-order",
        status: "filled",
        filled_qty: "10",
        filled_avg_price: "150.00",
      });

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { maxRetries: 1, autoRecover: true }
      );

      // Recovery should be attempted
      expect(mockGetOrders).toHaveBeenCalled();
    });

    it("should attempt ADJUST_AND_RETRY recovery on insufficient funds", async () => {
      // First attempt fails with insufficient funds
      mockCreateOrder
        .mockRejectedValueOnce(new Error("insufficient buying power"))
        .mockResolvedValueOnce({
          id: "reduced-order",
          status: "filled",
          symbol: "AAPL",
          side: "buy",
          qty: "5",
          filled_qty: "5",
          filled_avg_price: "150.00",
          created_at: new Date().toISOString(),
          filled_at: new Date().toISOString(),
        });

      mockGetOrder.mockResolvedValue({
        id: "reduced-order",
        status: "filled",
        filled_qty: "5",
        filled_avg_price: "150.00",
      });

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { maxRetries: 1, autoRecover: true, timeoutMs: 1000 }
      );

      // Should have attempted with reduced quantity
      expect(mockCreateOrder).toHaveBeenCalledTimes(2);
    });

    it("should skip recovery when autoRecover is false", async () => {
      mockCreateOrder.mockRejectedValue(new Error("insufficient buying power"));

      const result = await orderExecutionEngine.executeOrder(
        {
          symbol: "AAPL",
          side: "buy",
          type: "market",
          qty: "10",
          time_in_force: "day",
        },
        { maxRetries: 1, autoRecover: false }
      );

      expect(result.success).toBe(false);
      expect(mockCreateOrder).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // ORDER BOOK CLEANUP TESTS
  // ============================================================================

  describe("Order Book Cleanup", () => {
    describe("identifyUnrealOrders", () => {
      it("should identify rejected orders", async () => {
        mockGetOrders.mockResolvedValue([
          {
            id: "rejected-1",
            symbol: "AAPL",
            status: "rejected",
            filled_qty: "0",
            qty: "10",
            notional: null,
            created_at: new Date().toISOString(),
          },
        ]);

        const unreal = await identifyUnrealOrders();

        expect(unreal).toHaveLength(1);
        expect(unreal[0].reason).toBe("Order was rejected by broker");
      });

      it("should identify canceled orders with no fills", async () => {
        mockGetOrders.mockResolvedValue([
          {
            id: "canceled-1",
            symbol: "AAPL",
            status: "canceled",
            filled_qty: "0",
            qty: "10",
            notional: null,
            created_at: new Date().toISOString(),
          },
        ]);

        const unreal = await identifyUnrealOrders();

        expect(unreal).toHaveLength(1);
        expect(unreal[0].reason).toBe("Order was canceled with no fills");
      });

      it("should identify expired orders with no fills", async () => {
        mockGetOrders.mockResolvedValue([
          {
            id: "expired-1",
            symbol: "AAPL",
            status: "expired",
            filled_qty: "0",
            qty: "10",
            notional: null,
            created_at: new Date().toISOString(),
          },
        ]);

        const unreal = await identifyUnrealOrders();

        expect(unreal).toHaveLength(1);
        expect(unreal[0].reason).toBe("Order expired with no fills");
      });

      it("should identify stale active orders", async () => {
        const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

        mockGetOrders.mockResolvedValue([
          {
            id: "stale-1",
            symbol: "AAPL",
            status: "new",
            filled_qty: "0",
            qty: "10",
            notional: null,
            created_at: staleDate.toISOString(),
          },
        ]);

        const unreal = await identifyUnrealOrders();

        expect(unreal).toHaveLength(1);
        expect(unreal[0].reason).toContain("Stale active order");
      });

      it("should not flag filled orders", async () => {
        mockGetOrders.mockResolvedValue([
          {
            id: "filled-1",
            symbol: "AAPL",
            status: "filled",
            filled_qty: "10",
            qty: "10",
            notional: "1500",
            created_at: new Date().toISOString(),
          },
        ]);

        const unreal = await identifyUnrealOrders();

        expect(unreal).toHaveLength(0);
      });
    });

    describe("cleanupUnrealOrders", () => {
      it("should cancel active unreal orders", async () => {
        mockGetOrders.mockResolvedValue([
          {
            id: "stale-active",
            symbol: "AAPL",
            status: "new",
            filled_qty: "0",
            qty: "10",
            notional: null,
            created_at: new Date(
              Date.now() - 25 * 60 * 60 * 1000
            ).toISOString(),
          },
        ]);

        mockCancelOrder.mockResolvedValue(undefined);

        const result = await cleanupUnrealOrders();

        expect(result.identified).toBe(1);
        expect(result.canceled).toBe(1);
        expect(mockCancelOrder).toHaveBeenCalledWith("stale-active");
      });

      it("should not attempt to cancel non-active unreal orders", async () => {
        mockGetOrders.mockResolvedValue([
          {
            id: "already-canceled",
            symbol: "AAPL",
            status: "canceled",
            filled_qty: "0",
            qty: "10",
            notional: null,
            created_at: new Date().toISOString(),
          },
        ]);

        const result = await cleanupUnrealOrders();

        expect(result.identified).toBe(1);
        expect(result.canceled).toBe(0);
        expect(mockCancelOrder).not.toHaveBeenCalled();
      });

      it("should handle cancel failures gracefully", async () => {
        mockGetOrders.mockResolvedValue([
          {
            id: "fail-cancel",
            symbol: "AAPL",
            status: "new",
            filled_qty: "0",
            qty: "10",
            notional: null,
            created_at: new Date(
              Date.now() - 25 * 60 * 60 * 1000
            ).toISOString(),
          },
        ]);

        mockCancelOrder.mockRejectedValue(new Error("Cancel failed"));

        const result = await cleanupUnrealOrders();

        expect(result.identified).toBe(1);
        expect(result.canceled).toBe(0);
        expect(result.errors).toHaveLength(1);
      });
    });

    describe("reconcileOrderBook", () => {
      it("should sync filled Alpaca orders to local storage", async () => {
        mockGetOrders.mockResolvedValue([
          {
            id: "alpaca-order-1",
            client_order_id: "client-1",
            symbol: "AAPL",
            side: "buy",
            status: "filled",
            filled_qty: "10",
            filled_avg_price: "150.00",
            qty: "10",
            created_at: new Date().toISOString(),
          },
        ]);

        mockGetTrades.mockResolvedValue([]); // No local trades
        mockCreateTrade.mockResolvedValue({ id: 1 });

        const result = await reconcileOrderBook();

        expect(result.alpacaOrders).toBe(1);
        expect(result.missingLocal).toContain("alpaca-order-1");
        expect(result.synced).toBe(1);
        expect(mockCreateTrade).toHaveBeenCalledWith(
          expect.objectContaining({
            symbol: "AAPL",
            side: "buy",
            quantity: "10",
            price: "150.00",
          })
        );
      });

      it("should not duplicate existing local trades", async () => {
        mockGetOrders.mockResolvedValue([
          {
            id: "alpaca-order-1",
            client_order_id: "client-1",
            symbol: "AAPL",
            side: "buy",
            status: "filled",
            filled_qty: "10",
            filled_avg_price: "150.00",
            qty: "10",
            created_at: new Date().toISOString(),
          },
        ]);

        mockGetTrades.mockResolvedValue([
          {
            id: 1,
            symbol: "AAPL",
            notes: "Order: alpaca-order-1",
          },
        ]);

        const result = await reconcileOrderBook();

        expect(result.synced).toBe(0);
        expect(mockCreateTrade).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // SHARED ORDER HELPERS TESTS
  // ============================================================================

  describe("Shared Order Helpers", () => {
    describe("waitForAlpacaOrderFill", () => {
      it("should return immediately when order is filled", async () => {
        mockGetOrder.mockResolvedValue({
          id: "order-filled",
          status: "filled",
          filled_qty: "10",
          filled_avg_price: "150.00",
        });

        const result = await waitForAlpacaOrderFill("order-filled");

        expect(result.isFullyFilled).toBe(true);
        expect(result.timedOut).toBe(false);
        expect(result.hasFillData).toBe(true);
      });

      it("should poll until order is filled", async () => {
        mockGetOrder
          .mockResolvedValueOnce({
            id: "order-1",
            status: "new",
            filled_qty: "0",
            filled_avg_price: null,
          })
          .mockResolvedValueOnce({
            id: "order-1",
            status: "partially_filled",
            filled_qty: "5",
            filled_avg_price: "150.00",
          })
          .mockResolvedValue({
            id: "order-1",
            status: "filled",
            filled_qty: "10",
            filled_avg_price: "150.00",
          });

        const result = await waitForAlpacaOrderFill("order-1", 5000);

        expect(result.isFullyFilled).toBe(true);
        expect(mockGetOrder).toHaveBeenCalledTimes(3);
      });

      it("should return on terminal non-filled status", async () => {
        mockGetOrder.mockResolvedValue({
          id: "order-canceled",
          status: "canceled",
          filled_qty: "0",
          filled_avg_price: null,
        });

        const result = await waitForAlpacaOrderFill("order-canceled");

        expect(result.isFullyFilled).toBe(false);
        expect(result.timedOut).toBe(false);
      });

      it("should timeout and return final state", async () => {
        mockGetOrder.mockResolvedValue({
          id: "order-stuck",
          status: "new",
          filled_qty: "0",
          filled_avg_price: null,
        });

        // Use short timeout
        const result = await waitForAlpacaOrderFill("order-stuck", 200);

        expect(result.timedOut).toBe(true);
        expect(result.isFullyFilled).toBe(false);
      });
    });

    describe("cancelExpiredOrders", () => {
      it("should cancel orders older than threshold", async () => {
        const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

        mockGetOrders.mockResolvedValue([
          {
            id: "old-order",
            symbol: "AAPL",
            status: "new",
            created_at: oldDate.toISOString(),
          },
        ]);

        mockCancelOrder.mockResolvedValue(undefined);

        const canceled = await cancelExpiredOrders(24 * 60 * 60 * 1000);

        expect(canceled).toBe(1);
        expect(mockCancelOrder).toHaveBeenCalledWith("old-order");
      });

      it("should not cancel recent orders", async () => {
        mockGetOrders.mockResolvedValue([
          {
            id: "recent-order",
            symbol: "AAPL",
            status: "new",
            created_at: new Date().toISOString(),
          },
        ]);

        const canceled = await cancelExpiredOrders(24 * 60 * 60 * 1000);

        expect(canceled).toBe(0);
        expect(mockCancelOrder).not.toHaveBeenCalled();
      });

      it("should handle cancel errors gracefully", async () => {
        const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

        mockGetOrders.mockResolvedValue([
          {
            id: "fail-order",
            symbol: "AAPL",
            status: "new",
            created_at: oldDate.toISOString(),
          },
        ]);

        mockCancelOrder.mockRejectedValue(new Error("Cancel failed"));

        const canceled = await cancelExpiredOrders(24 * 60 * 60 * 1000);

        expect(canceled).toBe(0); // Failed to cancel
      });
    });
  });

  // ============================================================================
  // ACTIVE EXECUTION TRACKING TESTS
  // ============================================================================

  describe("Active Execution Tracking", () => {
    it("should track active executions during order lifecycle", async () => {
      let capturedExecutions: Map<string, any> | null = null;

      // Capture executions mid-flight
      mockCreateOrder.mockImplementation(async () => {
        capturedExecutions = orderExecutionEngine.getActiveExecutions();
        return {
          id: "order-123",
          status: "filled",
          filled_qty: "10",
          filled_avg_price: "150.00",
        };
      });

      mockGetOrder.mockResolvedValue({
        id: "order-123",
        status: "filled",
        filled_qty: "10",
        filled_avg_price: "150.00",
      });

      await orderExecutionEngine.executeOrder({
        symbol: "AAPL",
        side: "buy",
        type: "market",
        qty: "10",
        time_in_force: "day",
      });

      // Execution should have been tracked during submission
      expect(capturedExecutions?.size).toBe(1);

      // After completion, should be removed
      const finalExecutions = orderExecutionEngine.getActiveExecutions();
      expect(finalExecutions.size).toBe(0);
    });
  });
});
