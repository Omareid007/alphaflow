/**
 * @module autonomous/pre-trade-guard
 * @description Pre-Trade Validation Guards
 *
 * Validates trading conditions before order submission to prevent failed trades
 * and ensure compliance with market rules and account constraints.
 *
 * Key validation checks:
 * - Buying power sufficiency
 * - Market session status (regular/pre-market/after-hours/closed)
 * - Holiday calendar checks
 * - Extended hours eligibility
 * - Symbol tradability verification
 * - Price discovery for extended hours limit orders
 *
 * Supports both stock and cryptocurrency trading with 24/7 crypto market awareness.
 */

import { alpaca } from "../connectors/alpaca";
import { tradingSessionManager } from "../services/trading-session-manager";
import { safeParseFloat } from "../utils/numeric";
import { log } from "../utils/logger";
import {
  isCryptoSymbol,
  normalizeCryptoSymbol,
} from "../trading/crypto-trading-config";

/**
 * Pre-trade validation check result.
 *
 * Contains the results of validating whether a trade can be executed,
 * including market session info, buying power checks, and order type recommendations.
 *
 * @interface PreTradeCheck
 * @property {boolean} canTrade - Whether the trade can proceed
 * @property {string} [reason] - Explanation if trade cannot proceed
 * @property {"regular" | "pre_market" | "after_hours" | "closed"} marketSession - Current market session
 * @property {number} availableBuyingPower - Available buying power in dollars
 * @property {number} requiredBuyingPower - Required buying power for this trade
 * @property {boolean} useExtendedHours - Whether to use extended hours trading
 * @property {boolean} useLimitOrder - Whether a limit order should be used
 * @property {number} [limitPrice] - Recommended limit price if useLimitOrder is true
 */
export interface PreTradeCheck {
  canTrade: boolean;
  reason?: string;
  marketSession: "regular" | "pre_market" | "after_hours" | "closed";
  availableBuyingPower: number;
  requiredBuyingPower: number;
  useExtendedHours: boolean;
  useLimitOrder: boolean;
  limitPrice?: number;
}

/**
 * Pre-trade validation guard.
 *
 * Validates all conditions required for successful trade execution:
 * - Account buying power (for buy orders)
 * - Market session status (regular/extended/closed)
 * - Holiday calendar
 * - Extended hours requirements (limit orders, price discovery)
 *
 * For crypto trades: Always allows trading (24/7 markets)
 * For stocks: Checks market hours and extended hours eligibility
 *
 * Side effects:
 * - Queries Alpaca account data
 * - Queries market status and snapshots
 * - Logs validation results
 *
 * @param {string} symbol - Trading symbol (e.g., "AAPL", "BTC/USD")
 * @param {"buy" | "sell"} side - Order side
 * @param {number} orderValue - Dollar value of the order
 * @param {boolean} isCrypto - Whether this is a cryptocurrency symbol
 *
 * @returns {Promise<PreTradeCheck>} Validation result with canTrade flag and recommendations
 *
 * @example
 * const check = await preTradeGuard("AAPL", "buy", 1000, false);
 * if (check.canTrade) {
 *   console.log(`Can trade during ${check.marketSession}`);
 *   if (check.useLimitOrder) {
 *     console.log(`Use limit order at $${check.limitPrice}`);
 *   }
 * } else {
 *   console.log(`Cannot trade: ${check.reason}`);
 * }
 */
export async function preTradeGuard(
  symbol: string,
  side: "buy" | "sell",
  orderValue: number,
  isCrypto: boolean
): Promise<PreTradeCheck> {
  try {
    const account = await alpaca.getAccount();
    const availableBuyingPower = safeParseFloat(account.buying_power);

    // Use trading session manager for enhanced session detection
    const exchange = isCrypto ? "CRYPTO" : "US_EQUITIES";
    const sessionInfo = tradingSessionManager.getCurrentSession(exchange);

    // Also get Alpaca market status for compatibility
    const marketStatus = await alpaca.getMarketStatus();

    const result: PreTradeCheck = {
      canTrade: false,
      marketSession: sessionInfo.session,
      availableBuyingPower,
      requiredBuyingPower: orderValue,
      useExtendedHours: false,
      useLimitOrder: false,
    };

    if (side === "buy" && orderValue > availableBuyingPower) {
      result.reason = `Insufficient buying power ($${availableBuyingPower.toFixed(2)} available < $${orderValue.toFixed(2)} required)`;
      return result;
    }

    // Crypto markets are 24/7
    if (isCrypto) {
      result.canTrade = true;
      log.info(
        "PreTradeGuard",
        `Crypto market 24/7 - trading enabled for ${symbol}`
      );
      return result;
    }

    // Check if market is on holiday
    if (tradingSessionManager.isHoliday(exchange, new Date())) {
      result.canTrade = false;
      result.reason = `Market is closed for holiday (next open: ${sessionInfo.nextOpen?.toISOString()})`;
      return result;
    }

    // Regular trading hours
    if (sessionInfo.session === "regular") {
      result.canTrade = true;
      log.info(
        "PreTradeGuard",
        `Regular hours - trading enabled for ${symbol}`
      );
      return result;
    }

    // Extended hours trading (pre-market or after-hours)
    if (
      sessionInfo.isExtendedHours &&
      (sessionInfo.session === "pre_market" ||
        sessionInfo.session === "after_hours")
    ) {
      result.useExtendedHours = true;
      result.useLimitOrder = true;

      try {
        const snapshots = await alpaca.getSnapshots([symbol]);
        const snapshot = snapshots[symbol];
        if (snapshot?.latestTrade?.p) {
          // Apply volatility adjustment for extended hours pricing
          const basePrice = snapshot.latestTrade.p;
          const volatilityMultiplier = sessionInfo.volatilityMultiplier;
          result.limitPrice = Math.round(basePrice * 100) / 100;
          result.canTrade = true;
          log.info(
            "PreTradeGuard",
            `Extended hours (${sessionInfo.session}) trading enabled for ${symbol} at $${result.limitPrice} (volatility: ${volatilityMultiplier}x)`
          );
          return result;
        } else {
          result.reason = `Cannot get current price for ${symbol} during ${sessionInfo.session}`;
          return result;
        }
      } catch (error) {
        result.reason = `Failed to get market price for extended hours order: ${error}`;
        return result;
      }
    }

    // Market is closed
    if (sessionInfo.session === "closed") {
      result.canTrade = false;
      const nextOpenStr = sessionInfo.nextOpen
        ? sessionInfo.nextOpen.toLocaleString()
        : "unknown";
      result.reason = `Market is closed (next open: ${nextOpenStr})`;
      log.info(
        "PreTradeGuard",
        `Market closed for ${symbol} - next open: ${nextOpenStr}`
      );
      return result;
    }

    return result;
  } catch (error) {
    return {
      canTrade: false,
      reason: `Pre-trade check failed: ${error}`,
      marketSession: "closed",
      availableBuyingPower: 0,
      requiredBuyingPower: orderValue,
      useExtendedHours: false,
      useLimitOrder: false,
    };
  }
}

/**
 * Check if a symbol is tradable on Alpaca.
 *
 * Validates symbol against Alpaca's asset database to ensure it can be traded.
 * For crypto symbols, normalizes the symbol format before checking.
 *
 * @param {string} symbol - Trading symbol to validate
 * @param {boolean} isCrypto - Whether this is a cryptocurrency symbol
 *
 * @returns {Promise<{ tradable: boolean, reason?: string }>} Tradability status with reason if not tradable
 *
 * @example
 * const stock = await isSymbolTradable("AAPL", false);
 * if (stock.tradable) {
 *   console.log("AAPL is tradable");
 * }
 *
 * const crypto = await isSymbolTradable("BTC", true);
 * if (!crypto.tradable) {
 *   console.log(`Cannot trade: ${crypto.reason}`);
 * }
 */
export async function isSymbolTradable(
  symbol: string,
  isCrypto: boolean
): Promise<{ tradable: boolean; reason?: string }> {
  try {
    if (isCrypto) {
      const normalizedSymbol = normalizeCryptoSymbol(symbol);
      const assets = await alpaca.getAssets("active", "crypto");
      const found = assets.find(
        (a) => a.symbol === normalizedSymbol && a.tradable
      );
      if (!found) {
        return {
          tradable: false,
          reason: `Crypto ${normalizedSymbol} is not tradable on Alpaca`,
        };
      }
      return { tradable: true };
    } else {
      const asset = await alpaca.getAsset(symbol);
      if (!asset.tradable) {
        return { tradable: false, reason: `Stock ${symbol} is not tradable` };
      }
      return { tradable: true };
    }
  } catch (error) {
    return { tradable: false, reason: `Symbol validation failed: ${error}` };
  }
}
