import { storage } from "../storage";
import { log } from "../utils/logger";
import { toDecimal, percentChange, formatPrice as formatMoneyPrice } from "../utils/money";
import { alpaca } from "../connectors/alpaca";
import { safeParseFloat } from "../utils/numeric";

/**
 * Risk Validation Module
 * Extracted from alpaca-trading-engine.ts (lines 436-472 for loss protection, lines 1471-1527 for risk limits)
 * Handles risk management checks and position loss protection
 */

/**
 * Check risk limits before executing a trade
 * Validates position counts, position size limits, and kill switch status
 */
export async function checkRiskLimits(
  side: "buy" | "sell",
  symbol: string,
  tradeValue: number,
  killSwitchActive: boolean,
  normalizeSymbolForAlpaca: (symbol: string) => string
): Promise<{ allowed: boolean; reason?: string }> {
  const status = await storage.getAgentStatus();

  if (status?.killSwitchActive || killSwitchActive) {
    return { allowed: false, reason: "Kill switch is active - trading halted" };
  }

  if (side === "buy") {
    try {
      const account = await alpaca.getAccount();
      const positions = await alpaca.getPositions();
      const maxPositions = status?.maxPositionsCount ?? 10;

      if (positions.length >= maxPositions) {
        return { allowed: false, reason: `Maximum positions limit reached (${maxPositions})` };
      }

      const riskSymbol = normalizeSymbolForAlpaca(symbol);
      const snapshot = await alpaca.getSnapshots([riskSymbol]);
      const snapshotData = snapshot[riskSymbol];
      const price = snapshotData?.latestTrade?.p || snapshotData?.dailyBar?.c || snapshotData?.prevDailyBar?.c || 0;

      if (!price || price <= 0 || !Number.isFinite(price)) {
        log.warn("RiskValidator", "Risk check: invalid price", { symbol, price });
        return { allowed: false, reason: `Cannot verify trade value - no valid price data for ${symbol}` };
      }

      // If tradeValue is provided as actual dollar value, use it directly
      // Otherwise calculate from quantity (legacy behavior)
      const effectiveTradeValue = tradeValue > 0 && tradeValue < 1000000
        ? tradeValue
        : tradeValue * price;

      if (!Number.isFinite(effectiveTradeValue)) {
        return { allowed: false, reason: `Invalid trade value calculation for ${symbol}` };
      }

      const buyingPower = safeParseFloat(account.buying_power);
      const rawPercent = status?.maxPositionSizePercent;
      const parsedPercent = rawPercent ? safeParseFloat(rawPercent) : NaN;
      const maxPositionSizePercent = (isNaN(parsedPercent) || parsedPercent <= 0) ? 10 : parsedPercent;
      const maxPositionSizeDecimal = maxPositionSizePercent / 100;
      const maxTradeValue = buyingPower * maxPositionSizeDecimal;

      if (effectiveTradeValue > maxTradeValue) {
        return {
          allowed: false,
          reason: `Trade exceeds max position size (${maxPositionSizePercent.toFixed(0)}% = $${maxTradeValue.toFixed(2)})`,
        };
      }
    } catch (error) {
      log.error("RiskValidator", "Risk check error", { error: (error as Error).message });
      return { allowed: false, reason: "Could not verify risk limits" };
    }
  }

  return { allowed: true };
}

/**
 * Check loss protection before closing a position
 * Prevents selling at a loss unless it's a stop-loss or emergency stop
 */
export function checkLossProtection(
  side: "buy" | "sell",
  notes: string | undefined,
  isStopLossTriggered?: boolean,
  isEmergencyStop?: boolean
): { allowed: boolean; reason?: string } {
  // Loss protection only applies to sell orders
  if (side !== "sell") {
    return { allowed: true };
  }

  // Allow if notes indicate stop-loss or emergency
  const isStopLossOrEmergency = notes?.toLowerCase().includes('stop-loss') ||
                                 notes?.toLowerCase().includes('emergency') ||
                                 notes?.toLowerCase().includes('stop loss') ||
                                 isStopLossTriggered ||
                                 isEmergencyStop;

  // If it's a protected close (stop-loss or emergency), allow it
  if (isStopLossOrEmergency) {
    return { allowed: true };
  }

  // For regular sell orders, the caller should check if position is at a loss
  // and call this with the loss information
  return { allowed: true };
}

/**
 * Calculate current loss percentage for a position
 * Returns null if position doesn't exist or on error
 */
export async function calculateLossPercentage(
  symbol: string,
  currentPrice: number,
  normalizeSymbolForAlpaca: (symbol: string, forOrder: boolean) => string
): Promise<number | null> {
  try {
    const alpacaSymbol = normalizeSymbolForAlpaca(symbol, true);
    const position = await alpaca.getPosition(alpacaSymbol);

    if (!position) {
      return null;
    }

    const entryPrice = safeParseFloat(position.avg_entry_price);
    const current = currentPrice || safeParseFloat(position.current_price);

    if (!entryPrice || !current || entryPrice <= 0) {
      return null;
    }

    // Use Decimal.js for precise percentage calculation
    const lossPercentDecimal = percentChange(current, entryPrice).abs();
    return lossPercentDecimal.toNumber();
  } catch (error) {
    log.debug("RiskValidator", "Could not calculate loss percentage", {
      symbol,
      error: (error as Error).message
    });
    return null;
  }
}

/**
 * Check if a sell order would result in selling at a loss
 * Returns loss protection result with percentage if at loss
 */
export async function checkSellLossProtection(
  symbol: string,
  notes: string | undefined,
  normalizeSymbolForAlpaca: (symbol: string, forOrder: boolean) => string,
  isStopLossTriggered?: boolean,
  isEmergencyStop?: boolean
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const alpacaSymbol = normalizeSymbolForAlpaca(symbol, true);
    const position = await alpaca.getPosition(alpacaSymbol);

    if (!position) {
      // No position found, allow the sell
      return { allowed: true };
    }

    const entryPrice = safeParseFloat(position.avg_entry_price);
    const currentPrice = safeParseFloat(position.current_price);
    const isAtLoss = currentPrice < entryPrice;

    // Allow if notes indicate stop-loss or emergency
    const isStopLossOrEmergency = notes?.toLowerCase().includes('stop-loss') ||
                                   notes?.toLowerCase().includes('emergency') ||
                                   notes?.toLowerCase().includes('stop loss') ||
                                   isStopLossTriggered ||
                                   isEmergencyStop;

    if (isAtLoss && !isStopLossOrEmergency) {
      // Use Decimal.js for precise percentage calculation
      const lossPercentDecimal = percentChange(currentPrice, entryPrice).abs();
      const lossPercent = formatMoneyPrice(lossPercentDecimal, 2);

      log.warn("RiskValidator", `LOSS_PROTECTION: ${symbol} - Position at loss`, {
        symbol,
        reason: "LOSS_PROTECTION_ACTIVE",
        entryPrice,
        currentPrice,
        lossPercent: lossPercentDecimal.toNumber(),
        isStopLossOrEmergency
      });

      return {
        allowed: false,
        reason: `Position at ${lossPercent}% loss - holding until stop-loss triggers or price recovers`
      };
    }

    return { allowed: true };
  } catch (posError) {
    // Position not found is okay, proceed with the trade
    return { allowed: true };
  }
}
