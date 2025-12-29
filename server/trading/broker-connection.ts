/**
 * Broker Connection Module
 *
 * Provides connection management and market status utilities for the Alpaca broker.
 * Handles connectivity checks, account queries, position retrieval, and market hours
 * validation including extended hours trading (pre-market and after-hours).
 *
 * This module was extracted from alpaca-trading-engine.ts (lines 356-401) to improve
 * modularity and separate broker connectivity concerns from trading logic.
 *
 * @module broker-connection
 */

import { alpaca, type AlpacaPosition, type MarketStatus } from "../connectors/alpaca";

/**
 * Checks if the Alpaca broker connection is active and authenticated
 *
 * Validates both credential availability and actual API connectivity by attempting
 * to fetch account information. Returns false if credentials are missing or if
 * the API call fails.
 *
 * @returns Promise resolving to true if connected and authenticated
 *
 * @example
 * ```typescript
 * const connected = await isAlpacaConnected();
 * if (!connected) {
 *   throw new Error("Alpaca is not connected - check API credentials");
 * }
 * ```
 */
export async function isAlpacaConnected(): Promise<boolean> {
  try {
    const status = alpaca.getConnectionStatus();
    if (!status.hasCredentials) return false;
    await alpaca.getAccount();
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieves the Alpaca account information
 *
 * Fetches account details including buying power, cash, portfolio value,
 * and account status. Useful for risk management and position sizing.
 *
 * @returns Promise resolving to Alpaca account object
 * @throws Error if API call fails or account is not accessible
 *
 * @example
 * ```typescript
 * const account = await getAlpacaAccount();
 * console.log(`Buying Power: $${account.buying_power}`);
 * console.log(`Portfolio Value: $${account.portfolio_value}`);
 * ```
 */
export async function getAlpacaAccount() {
  return await alpaca.getAccount();
}

/**
 * Retrieves all current positions from Alpaca
 *
 * Fetches the complete list of open positions including stocks and cryptocurrencies.
 * Each position includes quantity, entry price, current price, and P&L information.
 *
 * @returns Promise resolving to array of Alpaca positions
 * @throws Error if API call fails
 *
 * @example
 * ```typescript
 * const positions = await getAlpacaPositions();
 * for (const position of positions) {
 *   console.log(`${position.symbol}: ${position.qty} shares @ $${position.current_price}`);
 * }
 * ```
 */
export async function getAlpacaPositions(): Promise<AlpacaPosition[]> {
  return await alpaca.getPositions();
}

/**
 * Retrieves current market status from Alpaca
 *
 * Returns market status information including whether the market is open,
 * the current session (regular, pre-market, after-hours, closed), and
 * extended hours availability.
 *
 * @returns Promise resolving to market status object
 * @throws Error if API call fails
 *
 * @example
 * ```typescript
 * const status = await getMarketStatus();
 * console.log(`Market is ${status.isOpen ? 'open' : 'closed'}`);
 * console.log(`Session: ${status.session}`); // "regular", "pre-market", "after-hours", "closed"
 * ```
 */
export async function getMarketStatus(): Promise<MarketStatus> {
  return await alpaca.getMarketStatus();
}

/**
 * Retrieves the current market clock from Alpaca
 *
 * Provides detailed timing information including current time, next market open,
 * next market close, and whether the market is currently open.
 *
 * @returns Promise resolving to Alpaca clock object
 * @throws Error if API call fails
 *
 * @example
 * ```typescript
 * const clock = await getClock();
 * console.log(`Market ${clock.is_open ? 'is open' : 'is closed'}`);
 * console.log(`Next open: ${clock.next_open}`);
 * console.log(`Next close: ${clock.next_close}`);
 * ```
 */
export async function getClock() {
  return await alpaca.getClock();
}

/**
 * Checks if extended hours trading is allowed for a symbol
 *
 * Extended hours trading (pre-market and after-hours) is only available for stocks,
 * not cryptocurrencies. Pre-market runs 4AM-9:30AM ET, after-hours runs 4PM-8PM ET.
 *
 * Validation logic:
 * - Cryptocurrencies: Always returns false (not supported)
 * - Stocks during regular hours: Returns true
 * - Stocks during extended hours: Returns true if market is in pre-market or after-hours session
 * - Stocks outside trading hours: Returns false
 *
 * @param symbol - The trading symbol to check
 * @param isCryptoSymbol - Function to determine if symbol is cryptocurrency
 * @returns Promise resolving to object with allowed flag and optional reason
 *
 * @example
 * ```typescript
 * import { isCryptoSymbol } from './symbol-normalizer';
 *
 * // Check if we can trade AAPL now
 * const result = await canTradeExtendedHours("AAPL", isCryptoSymbol);
 * if (!result.allowed) {
 *   console.log(`Cannot trade: ${result.reason}`);
 * }
 *
 * // Crypto will always be rejected
 * const btcResult = await canTradeExtendedHours("BTC/USD", isCryptoSymbol);
 * // { allowed: false, reason: "Extended hours trading is not available for crypto" }
 * ```
 */
export async function canTradeExtendedHours(
  symbol: string,
  isCryptoSymbol: (symbol: string) => boolean
): Promise<{ allowed: boolean; reason?: string }> {
  if (isCryptoSymbol(symbol)) {
    return { allowed: false, reason: "Extended hours trading is not available for crypto" };
  }

  const marketStatus = await getMarketStatus();
  if (marketStatus.session === "regular") {
    return { allowed: true };
  }

  // Allow trading during pre-market (4AM-9:30AM) and after-hours (4PM-8PM)
  if (marketStatus.isExtendedHours ||
      marketStatus.session === "pre-market" ||
      marketStatus.session === "after-hours") {
    return { allowed: true };
  }

  return { allowed: false, reason: "Market is closed and not in extended hours session (4AM-8PM ET on weekdays)" };
}
