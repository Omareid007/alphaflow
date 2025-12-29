/**
 * Risk Validation Module
 *
 * Comprehensive risk management system that enforces trading limits and prevents
 * excessive losses. Provides pre-trade validation, position sizing controls,
 * and loss protection mechanisms.
 *
 * This module was extracted from alpaca-trading-engine.ts (lines 436-472 for loss
 * protection, lines 1471-1527 for risk limits) to improve modularity and maintain
 * clear separation of risk management concerns.
 *
 * KEY FEATURES:
 * - Maximum position count limits
 * - Maximum position size limits (as % of buying power)
 * - Kill switch for emergency trading halt
 * - Loss protection to prevent selling at a loss (unless stop-loss triggered)
 * - Position loss percentage calculations
 *
 * RISK CONTROLS:
 * - Prevents opening new positions when at max position count
 * - Prevents trades exceeding max position size percentage
 * - Blocks all trading when kill switch is active
 * - Prevents closing profitable positions that are currently at a loss
 *
 * @module risk-validator
 */

import { storage } from "../storage";
import { log } from "../utils/logger";
import {
  toDecimal,
  percentChange,
  formatPrice as formatMoneyPrice,
} from "../utils/money";
import { alpaca } from "../connectors/alpaca";
import { safeParseFloat } from "../utils/numeric";

/**
 * Validates risk limits before executing a trade
 *
 * Performs comprehensive pre-trade risk checks including:
 * - Kill switch status (blocks all trading if active)
 * - Maximum position count limits
 * - Maximum position size limits (as % of buying power)
 * - Price data validation
 *
 * For buy orders, validates against position limits. Sell orders pass through
 * (but may be subject to loss protection checks separately).
 *
 * @param side - Direction of the trade ("buy" or "sell")
 * @param symbol - Trading symbol to validate
 * @param tradeValue - Dollar value of the trade or quantity (if < 1,000,000)
 * @param killSwitchActive - Whether the emergency kill switch is active
 * @param normalizeSymbolForAlpaca - Function to normalize symbol for Alpaca API
 * @returns Promise resolving to object with allowed flag and optional reason
 *
 * @example
 * ```typescript
 * import { normalizeSymbolForAlpaca } from './symbol-normalizer';
 *
 * const result = await checkRiskLimits(
 *   "buy",
 *   "AAPL",
 *   10000, // $10,000 trade
 *   false,
 *   normalizeSymbolForAlpaca
 * );
 *
 * if (!result.allowed) {
 *   throw new Error(`Risk check failed: ${result.reason}`);
 * }
 * ```
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
        return {
          allowed: false,
          reason: `Maximum positions limit reached (${maxPositions})`,
        };
      }

      const riskSymbol = normalizeSymbolForAlpaca(symbol);
      const snapshot = await alpaca.getSnapshots([riskSymbol]);
      const snapshotData = snapshot[riskSymbol];
      const price =
        snapshotData?.latestTrade?.p ||
        snapshotData?.dailyBar?.c ||
        snapshotData?.prevDailyBar?.c ||
        0;

      if (!price || price <= 0 || !Number.isFinite(price)) {
        log.warn("RiskValidator", "Risk check: invalid price", {
          symbol,
          price,
        });
        return {
          allowed: false,
          reason: `Cannot verify trade value - no valid price data for ${symbol}`,
        };
      }

      // If tradeValue is provided as actual dollar value, use it directly
      // Otherwise calculate from quantity (legacy behavior)
      const effectiveTradeValue =
        tradeValue > 0 && tradeValue < 1000000
          ? tradeValue
          : tradeValue * price;

      if (!Number.isFinite(effectiveTradeValue)) {
        return {
          allowed: false,
          reason: `Invalid trade value calculation for ${symbol}`,
        };
      }

      const buyingPower = safeParseFloat(account.buying_power);
      const rawPercent = status?.maxPositionSizePercent;
      const parsedPercent = rawPercent ? safeParseFloat(rawPercent) : NaN;
      const maxPositionSizePercent =
        isNaN(parsedPercent) || parsedPercent <= 0 ? 10 : parsedPercent;
      const maxPositionSizeDecimal = maxPositionSizePercent / 100;
      const maxTradeValue = buyingPower * maxPositionSizeDecimal;

      if (effectiveTradeValue > maxTradeValue) {
        return {
          allowed: false,
          reason: `Trade exceeds max position size (${maxPositionSizePercent.toFixed(0)}% = $${maxTradeValue.toFixed(2)})`,
        };
      }
    } catch (error) {
      log.error("RiskValidator", "Risk check error", {
        error: (error as Error).message,
      });
      return { allowed: false, reason: "Could not verify risk limits" };
    }
  }

  return { allowed: true };
}

/**
 * Validates loss protection rules before closing a position
 *
 * Loss protection prevents selling positions at a loss unless explicitly authorized
 * via stop-loss or emergency conditions. This helps avoid panic selling and ensures
 * losses are only realized when risk management rules require it.
 *
 * ALLOWED SCENARIOS:
 * - Buy orders (loss protection only applies to sells)
 * - Sell orders with stop-loss in notes
 * - Sell orders with emergency flag
 * - Sell orders triggered by automated stop-loss
 *
 * NOTE: This is a basic check. For full loss protection, use checkSellLossProtection()
 * which validates against actual position data.
 *
 * @param side - Direction of the trade ("buy" or "sell")
 * @param notes - Trade notes that may contain "stop-loss" or "emergency" keywords
 * @param isStopLossTriggered - Whether this is an automated stop-loss trigger
 * @param isEmergencyStop - Whether this is an emergency stop
 * @returns Object with allowed flag and optional reason
 *
 * @example
 * ```typescript
 * // Regular sell - allowed (needs position check separately)
 * checkLossProtection("sell", "Taking profits");
 * // { allowed: true }
 *
 * // Stop-loss sell - allowed
 * checkLossProtection("sell", "Stop-loss triggered at -5%", true);
 * // { allowed: true }
 *
 * // Buy order - always allowed
 * checkLossProtection("buy", "Opening position");
 * // { allowed: true }
 * ```
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
  const isStopLossOrEmergency =
    notes?.toLowerCase().includes("stop-loss") ||
    notes?.toLowerCase().includes("emergency") ||
    notes?.toLowerCase().includes("stop loss") ||
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
 * Calculates the current loss percentage for a position
 *
 * Compares the current price against the average entry price to determine
 * if the position is profitable or at a loss. Uses high-precision Decimal.js
 * calculations to avoid floating-point errors.
 *
 * Returns null if:
 * - Position does not exist
 * - Price data is invalid or unavailable
 * - Error occurs during calculation
 *
 * @param symbol - Trading symbol to calculate loss for
 * @param currentPrice - Current market price (uses position price if 0)
 * @param normalizeSymbolForAlpaca - Function to normalize symbol for Alpaca API
 * @returns Promise resolving to loss percentage (positive number) or null
 *
 * @example
 * ```typescript
 * import { normalizeSymbolForAlpaca } from './symbol-normalizer';
 *
 * // Calculate loss for AAPL position
 * const lossPercent = await calculateLossPercentage(
 *   "AAPL",
 *   145.50,
 *   normalizeSymbolForAlpaca
 * );
 *
 * if (lossPercent !== null) {
 *   if (lossPercent > 5) {
 *     console.log(`Position down ${lossPercent.toFixed(2)}% - consider stop-loss`);
 *   }
 * }
 * ```
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
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Comprehensive loss protection check for sell orders
 *
 * This is the primary loss protection function that validates sell orders against
 * actual position data from Alpaca. It prevents closing positions at a loss unless
 * the sell is authorized by stop-loss or emergency conditions.
 *
 * VALIDATION LOGIC:
 * 1. Fetches current position from Alpaca
 * 2. Compares current price vs. entry price
 * 3. If at a loss and not stop-loss/emergency, blocks the sell
 * 4. If profitable or authorized, allows the sell
 *
 * AUTHORIZED SELL CONDITIONS (even at a loss):
 * - Notes contain "stop-loss" or "stop loss"
 * - Notes contain "emergency"
 * - isStopLossTriggered flag is true
 * - isEmergencyStop flag is true
 *
 * @param symbol - Trading symbol to check
 * @param notes - Trade notes that may authorize the loss
 * @param normalizeSymbolForAlpaca - Function to normalize symbol for Alpaca API
 * @param isStopLossTriggered - Whether this is an automated stop-loss trigger
 * @param isEmergencyStop - Whether this is an emergency stop
 * @returns Promise resolving to object with allowed flag and optional reason
 *
 * @example
 * ```typescript
 * import { normalizeSymbolForAlpaca } from './symbol-normalizer';
 *
 * // Check regular sell (will be blocked if at loss)
 * const result = await checkSellLossProtection(
 *   "AAPL",
 *   "Taking profits",
 *   normalizeSymbolForAlpaca
 * );
 * // If position is down 5%: { allowed: false, reason: "Position at 5.00% loss..." }
 *
 * // Stop-loss sell (allowed even at loss)
 * const stopResult = await checkSellLossProtection(
 *   "AAPL",
 *   "Stop-loss triggered",
 *   normalizeSymbolForAlpaca,
 *   true
 * );
 * // { allowed: true }
 * ```
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
    const isStopLossOrEmergency =
      notes?.toLowerCase().includes("stop-loss") ||
      notes?.toLowerCase().includes("emergency") ||
      notes?.toLowerCase().includes("stop loss") ||
      isStopLossTriggered ||
      isEmergencyStop;

    if (isAtLoss && !isStopLossOrEmergency) {
      // Use Decimal.js for precise percentage calculation
      const lossPercentDecimal = percentChange(currentPrice, entryPrice).abs();
      const lossPercent = formatMoneyPrice(lossPercentDecimal, 2);

      log.warn(
        "RiskValidator",
        `LOSS_PROTECTION: ${symbol} - Position at loss`,
        {
          symbol,
          reason: "LOSS_PROTECTION_ACTIVE",
          entryPrice,
          currentPrice,
          lossPercent: lossPercentDecimal.toNumber(),
          isStopLossOrEmergency,
        }
      );

      return {
        allowed: false,
        reason: `Position at ${lossPercent}% loss - holding until stop-loss triggers or price recovers`,
      };
    }

    return { allowed: true };
  } catch (posError) {
    // Position not found is okay, proceed with the trade
    return { allowed: true };
  }
}
