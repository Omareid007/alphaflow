import { log } from "../utils/logger";

export interface MarketSession {
  name: string;
  exchange: string;
  timezone: string;
  regularHours: { start: string; end: string };
  extendedHours?: {
    preMarket: { start: string; end: string };
    afterHours: { start: string; end: string };
  };
  holidays: string[]; // ISO date strings
}

export type SessionType = "pre_market" | "regular" | "after_hours" | "closed";

export interface SessionInfo {
  session: SessionType;
  isOpen: boolean;
  isExtendedHours: boolean;
  nextOpen: Date | null;
  nextClose: Date | null;
  volatilityMultiplier: number;
  timezone: string;
}

// US Market Holidays for 2024-2025
const US_MARKET_HOLIDAYS_2024_2025 = [
  // 2024
  "2024-01-01", // New Year's Day
  "2024-01-15", // Martin Luther King Jr. Day
  "2024-02-19", // Presidents' Day
  "2024-03-29", // Good Friday
  "2024-05-27", // Memorial Day
  "2024-06-19", // Juneteenth
  "2024-07-04", // Independence Day
  "2024-09-02", // Labor Day
  "2024-11-28", // Thanksgiving
  "2024-12-25", // Christmas

  // 2025
  "2025-01-01", // New Year's Day
  "2025-01-20", // Martin Luther King Jr. Day
  "2025-02-17", // Presidents' Day
  "2025-04-18", // Good Friday
  "2025-05-26", // Memorial Day
  "2025-06-19", // Juneteenth
  "2025-07-04", // Independence Day
  "2025-09-01", // Labor Day
  "2025-11-27", // Thanksgiving
  "2025-12-25", // Christmas
];

// Market session definitions
const MARKET_SESSIONS: Record<string, MarketSession> = {
  US_EQUITIES: {
    name: "US Equities",
    exchange: "NYSE/NASDAQ",
    timezone: "America/New_York",
    regularHours: {
      start: "09:30",
      end: "16:00",
    },
    extendedHours: {
      preMarket: {
        start: "04:00",
        end: "09:30",
      },
      afterHours: {
        start: "16:00",
        end: "20:00",
      },
    },
    holidays: US_MARKET_HOLIDAYS_2024_2025,
  },
  CRYPTO: {
    name: "Cryptocurrency",
    exchange: "24/7",
    timezone: "UTC",
    regularHours: {
      start: "00:00",
      end: "23:59",
    },
    holidays: [], // Crypto markets never close
  },
  EUROPEAN_DAX: {
    name: "European DAX",
    exchange: "XETRA",
    timezone: "Europe/Berlin",
    regularHours: {
      start: "09:00",
      end: "17:30",
    },
    holidays: [], // Simplified - would need European holiday calendar
  },
  ASIAN_NIKKEI: {
    name: "Asian Nikkei",
    exchange: "TSE",
    timezone: "Asia/Tokyo",
    regularHours: {
      start: "09:00",
      end: "15:00",
    },
    holidays: [], // Simplified - would need Japanese holiday calendar
  },
};

class TradingSessionManager {
  private sessionCache: Map<string, { info: SessionInfo; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60000; // 1 minute cache

  /**
   * Get the market session configuration for an exchange
   */
  getSessionConfig(exchange: string): MarketSession | null {
    return MARKET_SESSIONS[exchange] || null;
  }

  /**
   * Check if a market is open right now
   */
  isMarketOpen(exchange: string, now: Date = new Date()): boolean {
    const session = this.getCurrentSession(exchange, now);
    return session.isOpen;
  }

  /**
   * Get the next market open time
   */
  getNextMarketOpen(exchange: string, now: Date = new Date()): Date | null {
    const config = MARKET_SESSIONS[exchange];
    if (!config) {
      log.warn("SessionManager", `Unknown exchange: ${exchange}`);
      return null;
    }

    // Crypto is always open
    if (exchange === "CRYPTO") {
      return now;
    }

    const session = this.getCurrentSession(exchange, now);
    if (session.nextOpen) {
      return session.nextOpen;
    }

    // Calculate next open
    const nextOpen = this.calculateNextOpen(config, now);
    return nextOpen;
  }

  /**
   * Get the next market close time
   */
  getNextMarketClose(exchange: string, now: Date = new Date()): Date | null {
    const config = MARKET_SESSIONS[exchange];
    if (!config) {
      log.warn("SessionManager", `Unknown exchange: ${exchange}`);
      return null;
    }

    // Crypto never closes
    if (exchange === "CRYPTO") {
      return null;
    }

    const session = this.getCurrentSession(exchange, now);
    if (session.nextClose) {
      return session.nextClose;
    }

    return this.calculateNextClose(config, now);
  }

  /**
   * Get the current session type (pre-market, regular, after-hours, closed)
   */
  getCurrentSession(exchange: string, now: Date = new Date()): SessionInfo {
    // Check cache first
    const cacheKey = `${exchange}-${now.getTime()}`;
    const cached = this.sessionCache.get(exchange);
    if (cached && now.getTime() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.info;
    }

    const config = MARKET_SESSIONS[exchange];
    if (!config) {
      return {
        session: "closed",
        isOpen: false,
        isExtendedHours: false,
        nextOpen: null,
        nextClose: null,
        volatilityMultiplier: 1.0,
        timezone: "UTC",
      };
    }

    const info = this.calculateSessionInfo(config, now);

    // Cache the result
    this.sessionCache.set(exchange, { info, timestamp: now.getTime() });

    return info;
  }

  /**
   * Alias for getCurrentSession for backward compatibility
   * @deprecated Use getCurrentSession instead
   */
  getSessionInfo(exchange: string, now: Date = new Date()): SessionInfo {
    return this.getCurrentSession(exchange, now);
  }

  /**
   * Check if a specific date is a market holiday
   */
  isHoliday(exchange: string, date: Date): boolean {
    const config = MARKET_SESSIONS[exchange];
    if (!config) return false;

    const dateStr = this.formatDateISO(date);
    return config.holidays.includes(dateStr);
  }

  /**
   * Get volatility multiplier based on session
   * Higher volatility during extended hours and market opens/closes
   */
  getSessionVolatilityMultiplier(exchange: string, session: SessionType): number {
    // Crypto has higher baseline volatility
    if (exchange === "CRYPTO") {
      return 1.5;
    }

    switch (session) {
      case "pre_market":
        return 2.0; // Highest volatility - low liquidity
      case "after_hours":
        return 1.8; // High volatility - reduced liquidity
      case "regular":
        return 1.0; // Normal volatility
      case "closed":
        return 0.0; // Market is closed
      default:
        return 1.0;
    }
  }

  /**
   * Calculate detailed session information
   */
  private calculateSessionInfo(config: MarketSession, now: Date): SessionInfo {
    const timezone = config.timezone;
    const dateStr = this.formatDateISO(now);
    const isHoliday = config.holidays.includes(dateStr);
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Check if weekend (markets closed)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Crypto is always open
    if (config.exchange === "24/7") {
      return {
        session: "regular",
        isOpen: true,
        isExtendedHours: false,
        nextOpen: null,
        nextClose: null,
        volatilityMultiplier: 1.5, // Crypto baseline volatility
        timezone,
      };
    }

    // Market is closed on weekends and holidays
    if (isWeekend || isHoliday) {
      const nextOpen = this.calculateNextOpen(config, now);
      return {
        session: "closed",
        isOpen: false,
        isExtendedHours: false,
        nextOpen,
        nextClose: null,
        volatilityMultiplier: 0.0,
        timezone,
      };
    }

    // Get current time in market timezone
    const currentTime = this.getTimeInTimezone(now, timezone);
    const currentMinutes = this.timeToMinutes(currentTime);

    // Parse market hours
    const regularStart = this.timeToMinutes(config.regularHours.start);
    const regularEnd = this.timeToMinutes(config.regularHours.end);

    // Check regular hours
    if (currentMinutes >= regularStart && currentMinutes < regularEnd) {
      const nextClose = this.createDateFromTime(now, config.regularHours.end, timezone);
      return {
        session: "regular",
        isOpen: true,
        isExtendedHours: false,
        nextOpen: null,
        nextClose,
        volatilityMultiplier: this.getSessionVolatilityMultiplier(config.exchange, "regular"),
        timezone,
      };
    }

    // Check extended hours if available
    if (config.extendedHours) {
      const preMarketStart = this.timeToMinutes(config.extendedHours.preMarket.start);
      const preMarketEnd = this.timeToMinutes(config.extendedHours.preMarket.end);
      const afterHoursStart = this.timeToMinutes(config.extendedHours.afterHours.start);
      const afterHoursEnd = this.timeToMinutes(config.extendedHours.afterHours.end);

      // Pre-market
      if (currentMinutes >= preMarketStart && currentMinutes < preMarketEnd) {
        const nextClose = this.createDateFromTime(now, config.extendedHours.preMarket.end, timezone);
        return {
          session: "pre_market",
          isOpen: true,
          isExtendedHours: true,
          nextOpen: null,
          nextClose,
          volatilityMultiplier: this.getSessionVolatilityMultiplier(config.exchange, "pre_market"),
          timezone,
        };
      }

      // After-hours
      if (currentMinutes >= afterHoursStart && currentMinutes < afterHoursEnd) {
        const nextClose = this.createDateFromTime(now, config.extendedHours.afterHours.end, timezone);
        return {
          session: "after_hours",
          isOpen: true,
          isExtendedHours: true,
          nextOpen: null,
          nextClose,
          volatilityMultiplier: this.getSessionVolatilityMultiplier(config.exchange, "after_hours"),
          timezone,
        };
      }
    }

    // Market is closed - calculate next open
    const nextOpen = this.calculateNextOpen(config, now);
    return {
      session: "closed",
      isOpen: false,
      isExtendedHours: false,
      nextOpen,
      nextClose: null,
      volatilityMultiplier: 0.0,
      timezone,
    };
  }

  /**
   * Calculate the next market open time
   */
  private calculateNextOpen(config: MarketSession, now: Date): Date {
    const timezone = config.timezone;
    let checkDate = new Date(now);

    // If crypto, it's always open
    if (config.exchange === "24/7") {
      return now;
    }

    // Look up to 10 days ahead
    for (let i = 0; i < 10; i++) {
      const dayOfWeek = checkDate.getDay();
      const dateStr = this.formatDateISO(checkDate);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = config.holidays.includes(dateStr);

      // Skip weekends and holidays
      if (isWeekend || isHoliday) {
        checkDate = this.addDays(checkDate, 1);
        continue;
      }

      // Check if we're already past today's open
      const currentTime = this.getTimeInTimezone(now, timezone);
      const currentMinutes = this.timeToMinutes(currentTime);

      // Use extended hours start if available, otherwise regular hours
      const openTime = config.extendedHours
        ? config.extendedHours.preMarket.start
        : config.regularHours.start;
      const openMinutes = this.timeToMinutes(openTime);

      // If today and we haven't passed the open yet
      if (this.isSameDay(checkDate, now) && currentMinutes < openMinutes) {
        return this.createDateFromTime(checkDate, openTime, timezone);
      }

      // If today but already passed open, check tomorrow
      if (this.isSameDay(checkDate, now)) {
        checkDate = this.addDays(checkDate, 1);
        continue;
      }

      // Use this day's open
      return this.createDateFromTime(checkDate, openTime, timezone);
    }

    // Fallback - next business day at market open
    return this.addDays(now, 1);
  }

  /**
   * Calculate the next market close time
   */
  private calculateNextClose(config: MarketSession, now: Date): Date {
    const timezone = config.timezone;
    const currentTime = this.getTimeInTimezone(now, timezone);
    const currentMinutes = this.timeToMinutes(currentTime);

    // Use extended hours end if available, otherwise regular hours
    const closeTime = config.extendedHours
      ? config.extendedHours.afterHours.end
      : config.regularHours.end;
    const closeMinutes = this.timeToMinutes(closeTime);

    // If we haven't passed today's close yet
    if (currentMinutes < closeMinutes) {
      return this.createDateFromTime(now, closeTime, timezone);
    }

    // Next close is tomorrow
    const tomorrow = this.addDays(now, 1);
    return this.createDateFromTime(tomorrow, closeTime, timezone);
  }

  /**
   * Get all available exchanges
   */
  getAvailableExchanges(): string[] {
    return Object.keys(MARKET_SESSIONS);
  }

  /**
   * Get session info for all exchanges
   */
  getAllSessionInfo(now: Date = new Date()): Record<string, SessionInfo> {
    const result: Record<string, SessionInfo> = {};
    for (const exchange of this.getAvailableExchanges()) {
      result[exchange] = this.getCurrentSession(exchange, now);
    }
    return result;
  }

  /**
   * Detect exchange from symbol
   */
  detectExchange(symbol: string): string {
    const upperSymbol = symbol.toUpperCase();

    // Crypto detection
    if (upperSymbol.includes("/") ||
        upperSymbol.includes("BTC") ||
        upperSymbol.includes("ETH") ||
        upperSymbol.includes("USD") && upperSymbol.length <= 8) {
      return "CRYPTO";
    }

    // Default to US equities
    return "US_EQUITIES";
  }

  // Utility functions

  private formatDateISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getTimeInTimezone(date: Date, timezone: string): string {
    // Simplified - in production, use a library like date-fns-tz or luxon
    // For now, we'll work with UTC and assume Eastern Time offset
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };
    return new Intl.DateTimeFormat("en-US", options).format(date);
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  private createDateFromTime(date: Date, time: string, timezone: string): Date {
    const [hours, minutes] = time.split(":").map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);

    // Adjust for timezone offset (simplified)
    // In production, use proper timezone library
    if (timezone === "America/New_York") {
      // EST is UTC-5, EDT is UTC-4
      // Simplified: assume EST
      result.setHours(result.getHours() + 5);
    }

    return result;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * Clear the session cache (useful for testing)
   */
  clearCache(): void {
    this.sessionCache.clear();
  }
}

export const tradingSessionManager = new TradingSessionManager();
