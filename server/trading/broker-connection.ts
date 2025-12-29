import { alpaca, type AlpacaPosition, type MarketStatus } from "../connectors/alpaca";

/**
 * Broker Connection Module
 * Extracted from alpaca-trading-engine.ts (lines 356-401)
 * Handles all broker connectivity and market status checks
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

export async function getAlpacaAccount() {
  return await alpaca.getAccount();
}

export async function getAlpacaPositions(): Promise<AlpacaPosition[]> {
  return await alpaca.getPositions();
}

export async function getMarketStatus(): Promise<MarketStatus> {
  return await alpaca.getMarketStatus();
}

export async function getClock() {
  return await alpaca.getClock();
}

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
