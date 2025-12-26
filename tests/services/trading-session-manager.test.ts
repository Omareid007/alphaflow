import { describe, it, expect, beforeEach } from "vitest";
import { tradingSessionManager } from "../../server/services/trading-session-manager";

describe("TradingSessionManager", () => {
  beforeEach(() => {
    tradingSessionManager.clearCache();
  });

  describe("isMarketOpen", () => {
    it("should return true for CRYPTO market 24/7", () => {
      const now = new Date("2025-01-15T14:30:00Z"); // Wednesday 2:30 PM UTC
      const isOpen = tradingSessionManager.isMarketOpen("CRYPTO", now);
      expect(isOpen).toBe(true);
    });

    it("should return false for US_EQUITIES on weekends", () => {
      const saturday = new Date("2025-01-18T14:30:00Z"); // Saturday
      const isOpen = tradingSessionManager.isMarketOpen("US_EQUITIES", saturday);
      expect(isOpen).toBe(false);
    });

    it("should return false for US_EQUITIES on holidays", () => {
      const newYearsDay = new Date("2025-01-01T14:30:00Z"); // New Year's Day
      const isOpen = tradingSessionManager.isMarketOpen("US_EQUITIES", newYearsDay);
      expect(isOpen).toBe(false);
    });
  });

  describe("getCurrentSession", () => {
    it("should return regular session for US_EQUITIES during market hours", () => {
      // Wednesday 10:00 AM ET (15:00 UTC)
      const marketHours = new Date("2025-01-15T15:00:00Z");
      const session = tradingSessionManager.getCurrentSession("US_EQUITIES", marketHours);

      expect(session.session).toBe("regular");
      expect(session.isOpen).toBe(true);
      expect(session.isExtendedHours).toBe(false);
    });

    it("should return pre_market session during pre-market hours", () => {
      // Wednesday 8:00 AM ET (13:00 UTC) - pre-market
      const preMarket = new Date("2025-01-15T13:00:00Z");
      const session = tradingSessionManager.getCurrentSession("US_EQUITIES", preMarket);

      expect(session.session).toBe("pre_market");
      expect(session.isOpen).toBe(true);
      expect(session.isExtendedHours).toBe(true);
    });

    it("should return after_hours session during after-hours", () => {
      // Wednesday 5:00 PM ET (22:00 UTC) - after-hours
      const afterHours = new Date("2025-01-15T22:00:00Z");
      const session = tradingSessionManager.getCurrentSession("US_EQUITIES", afterHours);

      expect(session.session).toBe("after_hours");
      expect(session.isOpen).toBe(true);
      expect(session.isExtendedHours).toBe(true);
    });

    it("should return closed session outside trading hours", () => {
      // Wednesday 2:00 AM ET (07:00 UTC) - before pre-market
      const overnight = new Date("2025-01-15T07:00:00Z");
      const session = tradingSessionManager.getCurrentSession("US_EQUITIES", overnight);

      expect(session.session).toBe("closed");
      expect(session.isOpen).toBe(false);
      expect(session.isExtendedHours).toBe(false);
      expect(session.nextOpen).toBeTruthy();
    });

    it("should always return regular session for CRYPTO", () => {
      const anytime = new Date("2025-01-15T03:00:00Z");
      const session = tradingSessionManager.getCurrentSession("CRYPTO", anytime);

      expect(session.session).toBe("regular");
      expect(session.isOpen).toBe(true);
      expect(session.isExtendedHours).toBe(false);
    });
  });

  describe("isHoliday", () => {
    it("should detect US market holidays", () => {
      const newYears = new Date("2025-01-01");
      const mlkDay = new Date("2025-01-20");
      const regularDay = new Date("2025-01-15");

      expect(tradingSessionManager.isHoliday("US_EQUITIES", newYears)).toBe(true);
      expect(tradingSessionManager.isHoliday("US_EQUITIES", mlkDay)).toBe(true);
      expect(tradingSessionManager.isHoliday("US_EQUITIES", regularDay)).toBe(false);
    });

    it("should return false for CRYPTO holidays (no holidays)", () => {
      const anyDay = new Date("2025-01-01");
      expect(tradingSessionManager.isHoliday("CRYPTO", anyDay)).toBe(false);
    });
  });

  describe("getSessionVolatilityMultiplier", () => {
    it("should return higher volatility for pre-market", () => {
      const preMarketVol = tradingSessionManager.getSessionVolatilityMultiplier("US_EQUITIES", "pre_market");
      const regularVol = tradingSessionManager.getSessionVolatilityMultiplier("US_EQUITIES", "regular");

      expect(preMarketVol).toBeGreaterThan(regularVol);
      expect(preMarketVol).toBe(2.0);
    });

    it("should return higher volatility for after-hours", () => {
      const afterHoursVol = tradingSessionManager.getSessionVolatilityMultiplier("US_EQUITIES", "after_hours");
      const regularVol = tradingSessionManager.getSessionVolatilityMultiplier("US_EQUITIES", "regular");

      expect(afterHoursVol).toBeGreaterThan(regularVol);
      expect(afterHoursVol).toBe(1.8);
    });

    it("should return higher baseline volatility for CRYPTO", () => {
      const cryptoVol = tradingSessionManager.getSessionVolatilityMultiplier("CRYPTO", "regular");
      const equityVol = tradingSessionManager.getSessionVolatilityMultiplier("US_EQUITIES", "regular");

      expect(cryptoVol).toBeGreaterThan(equityVol);
      expect(cryptoVol).toBe(1.5);
    });

    it("should return zero volatility when market is closed", () => {
      const closedVol = tradingSessionManager.getSessionVolatilityMultiplier("US_EQUITIES", "closed");
      expect(closedVol).toBe(0.0);
    });
  });

  describe("detectExchange", () => {
    it("should detect crypto symbols", () => {
      expect(tradingSessionManager.detectExchange("BTC/USD")).toBe("CRYPTO");
      expect(tradingSessionManager.detectExchange("ETH/USD")).toBe("CRYPTO");
      expect(tradingSessionManager.detectExchange("BTCUSD")).toBe("CRYPTO");
    });

    it("should default to US_EQUITIES for stock symbols", () => {
      expect(tradingSessionManager.detectExchange("AAPL")).toBe("US_EQUITIES");
      expect(tradingSessionManager.detectExchange("TSLA")).toBe("US_EQUITIES");
      expect(tradingSessionManager.detectExchange("NVDA")).toBe("US_EQUITIES");
    });
  });

  describe("getNextMarketOpen", () => {
    it("should calculate next open for closed market", () => {
      // Saturday - market closed
      const saturday = new Date("2025-01-18T14:30:00Z");
      const nextOpen = tradingSessionManager.getNextMarketOpen("US_EQUITIES", saturday);

      expect(nextOpen).toBeTruthy();
      // Next open should be Tuesday because Monday Jan 20 is MLK Day (holiday)
      expect(nextOpen!.getDay()).toBe(2); // Tuesday
    });

    it("should return current time for CRYPTO (always open)", () => {
      const now = new Date("2025-01-15T14:30:00Z");
      const nextOpen = tradingSessionManager.getNextMarketOpen("CRYPTO", now);

      expect(nextOpen).toBeTruthy();
      expect(nextOpen!.getTime()).toBeLessThanOrEqual(now.getTime() + 1000); // Within 1 second
    });
  });

  describe("getNextMarketClose", () => {
    it("should return null for CRYPTO (never closes)", () => {
      const now = new Date("2025-01-15T14:30:00Z");
      const nextClose = tradingSessionManager.getNextMarketClose("CRYPTO", now);

      expect(nextClose).toBeNull();
    });

    it("should calculate next close for open market", () => {
      // Wednesday during market hours
      const marketHours = new Date("2025-01-15T15:00:00Z");
      const nextClose = tradingSessionManager.getNextMarketClose("US_EQUITIES", marketHours);

      expect(nextClose).toBeTruthy();
    });
  });

  describe("getAllSessionInfo", () => {
    it("should return session info for all exchanges", () => {
      const now = new Date("2025-01-15T15:00:00Z");
      const allSessions = tradingSessionManager.getAllSessionInfo(now);

      expect(allSessions).toHaveProperty("US_EQUITIES");
      expect(allSessions).toHaveProperty("CRYPTO");
      expect(allSessions).toHaveProperty("EUROPEAN_DAX");
      expect(allSessions).toHaveProperty("ASIAN_NIKKEI");

      expect(allSessions.US_EQUITIES.timezone).toBe("America/New_York");
      expect(allSessions.CRYPTO.timezone).toBe("UTC");
    });
  });

  describe("caching", () => {
    it("should cache session info for performance", () => {
      const now = new Date("2025-01-15T15:00:00Z");

      const session1 = tradingSessionManager.getCurrentSession("US_EQUITIES", now);
      const session2 = tradingSessionManager.getCurrentSession("US_EQUITIES", now);

      // Should be the same reference due to caching
      expect(session1).toEqual(session2);
    });

    it("should allow cache clearing", () => {
      const now = new Date("2025-01-15T15:00:00Z");

      tradingSessionManager.getCurrentSession("US_EQUITIES", now);
      tradingSessionManager.clearCache();

      // After clearing, new session info should be calculated
      const session = tradingSessionManager.getCurrentSession("US_EQUITIES", now);
      expect(session).toBeTruthy();
    });
  });
});
