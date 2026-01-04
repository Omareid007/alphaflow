/**
 * Portfolio Events - Unit Tests
 *
 * @file tests/lib/portfolio-events.test.ts
 * @description Unit tests for portfolio event type definitions, schemas, and factories.
 *
 * Tests Task 1.1 implementation from realtime-portfolio-streaming OpenSpec proposal.
 */

import { describe, it, expect } from "vitest";
import {
  createPositionUpdateEvent,
  createOrderUpdateEvent,
  createAccountUpdateEvent,
  createTradeExecutedEvent,
  createBatchEvent,
  createPongEvent,
  isPositionUpdate,
  isOrderUpdate,
  isAccountUpdate,
  isBatchUpdate,
  parseClientMessage,
  validatePortfolioEvent,
  getChannelForEventType,
  calculatePnlPercent,
  calculatePnlAmount,
  calculateMarketValue,
} from "../../server/lib/portfolio-events";

describe("Portfolio Events", () => {
  const testUserId = "test-user-123";

  describe("Event Factory Functions", () => {
    it("should create valid position update event", () => {
      const event = createPositionUpdateEvent(testUserId, {
        symbol: "AAPL",
        quantity: "100",
        currentPrice: "175.50",
        entryPrice: "170.25",
        unrealizedPnl: "525.00",
        unrealizedPnlPercent: "3.08",
        marketValue: "17550.00",
        side: "long",
        openedAt: new Date().toISOString(),
      });

      expect(event.type).toBe("position_update");
      expect(event.userId).toBe(testUserId);
      expect(event.data).toHaveProperty("symbol", "AAPL");
      expect(event.timestamp).toBeDefined();
    });

    it("should create valid order update event", () => {
      const event = createOrderUpdateEvent(testUserId, {
        orderId: "order-123",
        brokerOrderId: "alpaca-456",
        symbol: "TSLA",
        side: "buy",
        type: "limit",
        status: "filled",
        qty: "50",
        filledQty: "50",
        filledAvgPrice: "245.75",
        submittedAt: new Date().toISOString(),
        filledAt: new Date().toISOString(),
      });

      expect(event.type).toBe("order_update");
      expect(event.userId).toBe(testUserId);
      expect(event.data).toHaveProperty("symbol", "TSLA");
    });

    it("should create valid account update event", () => {
      const event = createAccountUpdateEvent(testUserId, {
        equity: "104308.75",
        buyingPower: "354905.24",
        cash: "50000.00",
        portfolioValue: "104308.75",
        dayPnl: "1234.56",
        dayPnlPercent: "1.20",
        timestamp: new Date().toISOString(),
      });

      expect(event.type).toBe("account_update");
      expect(event.userId).toBe(testUserId);
      expect(event.data).toHaveProperty("equity", "104308.75");
    });

    it("should create valid batch event", () => {
      const event = createBatchEvent(testUserId, {
        positions: [
          {
            symbol: "AAPL",
            quantity: "100",
            currentPrice: "175.50",
            entryPrice: "170.25",
            unrealizedPnl: "525.00",
            unrealizedPnlPercent: "3.08",
            marketValue: "17550.00",
            side: "long",
            openedAt: new Date().toISOString(),
          },
        ],
      });

      expect(event.type).toBe("batch");
      expect(event.userId).toBe(testUserId);
      expect(event.data).toHaveProperty("positions");
      expect(event.data.positions).toHaveLength(1);
    });

    it("should create valid pong event", () => {
      const event = createPongEvent(testUserId);

      expect(event.type).toBe("pong");
      expect(event.userId).toBe(testUserId);
      expect(event.data).toEqual({});
    });
  });

  describe("Type Guards", () => {
    it("should correctly identify position update events", () => {
      const event = createPositionUpdateEvent(testUserId, {
        symbol: "AAPL",
        quantity: "100",
        currentPrice: "175.50",
        entryPrice: "170.25",
        unrealizedPnl: "525.00",
        unrealizedPnlPercent: "3.08",
        marketValue: "17550.00",
        side: "long",
        openedAt: new Date().toISOString(),
      });

      expect(isPositionUpdate(event)).toBe(true);
      expect(isOrderUpdate(event)).toBe(false);
      expect(isAccountUpdate(event)).toBe(false);
    });

    it("should correctly identify batch events", () => {
      const event = createBatchEvent(testUserId, {});

      expect(isBatchUpdate(event)).toBe(true);
      expect(isPositionUpdate(event)).toBe(false);
    });
  });

  describe("Client Message Parsing", () => {
    it("should parse valid subscribe message", () => {
      const message = parseClientMessage({
        type: "subscribe",
        channels: ["positions", "orders"],
      });

      expect(message).not.toBeNull();
      expect(message?.type).toBe("subscribe");
      expect(message?.channels).toEqual(["positions", "orders"]);
    });

    it("should parse valid ping message", () => {
      const message = parseClientMessage({
        type: "ping",
      });

      expect(message).not.toBeNull();
      expect(message?.type).toBe("ping");
    });

    it("should return null for invalid message", () => {
      const message = parseClientMessage({
        type: "invalid_type",
      });

      expect(message).toBeNull();
    });

    it("should return null for malformed message", () => {
      const message = parseClientMessage({
        completely: "wrong",
      });

      expect(message).toBeNull();
    });
  });

  describe("Utility Functions", () => {
    it("should get correct channel for event type", () => {
      expect(getChannelForEventType("position_update")).toBe("positions");
      expect(getChannelForEventType("order_update")).toBe("orders");
      expect(getChannelForEventType("account_update")).toBe("account");
      expect(getChannelForEventType("trade_executed")).toBe("trades");
      expect(getChannelForEventType("batch")).toBeNull();
      expect(getChannelForEventType("pong")).toBeNull();
    });

    it("should calculate P&L percentage correctly", () => {
      expect(calculatePnlPercent("175.50", "170.25")).toBe("3.08");
      expect(calculatePnlPercent("100.00", "110.00")).toBe("-9.09");
      expect(calculatePnlPercent("50.00", "0")).toBe("0.00"); // Avoid divide by zero
    });

    it("should calculate P&L amount correctly", () => {
      expect(calculatePnlAmount("100", "175.50", "170.25")).toBe("525.00");
      expect(calculatePnlAmount("50", "100.00", "110.00")).toBe("-500.00");
    });

    it("should calculate market value correctly", () => {
      expect(calculateMarketValue("100", "175.50")).toBe("17550.00");
      expect(calculateMarketValue("0.5", "1000.00")).toBe("500.00");
    });
  });

  describe("Event Validation", () => {
    it("should validate correct event structure", () => {
      const event = createPositionUpdateEvent(testUserId, {
        symbol: "AAPL",
        quantity: "100",
        currentPrice: "175.50",
        entryPrice: "170.25",
        unrealizedPnl: "525.00",
        unrealizedPnlPercent: "3.08",
        marketValue: "17550.00",
        side: "long",
        openedAt: new Date().toISOString(),
      });

      expect(validatePortfolioEvent(event)).toBe(true);
    });

    it("should reject invalid event structure", () => {
      const invalidEvent = {
        type: "invalid_type",
        timestamp: new Date().toISOString(),
        userId: testUserId,
        data: {},
      };

      expect(validatePortfolioEvent(invalidEvent)).toBe(false);
    });

    it("should reject event with missing required fields", () => {
      const invalidEvent = {
        type: "position_update",
        // Missing timestamp and userId
        data: {},
      };

      expect(validatePortfolioEvent(invalidEvent)).toBe(false);
    });
  });
});
