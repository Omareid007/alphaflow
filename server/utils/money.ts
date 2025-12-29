/**
 * Money utility module using Decimal.js for precise financial calculations.
 *
 * CRITICAL: All monetary calculations in the trading platform MUST use these functions
 * to avoid floating-point precision errors inherent in JavaScript's Number type.
 *
 * This module provides:
 * - Type-safe conversions between number, string, and Decimal types
 * - Price operations (rounding, formatting, buffers)
 * - Quantity calculations (whole shares, partial quantities)
 * - P&L calculations (realized and unrealized)
 * - Percentage calculations and formatting
 * - Position value calculations (market value, cost basis)
 * - Portfolio calculations (allocation, equity)
 * - Fee and slippage calculations
 * - Risk management (stop loss, take profit, trailing stops)
 * - Kelly Criterion for position sizing
 * - Statistical functions (mean, variance, Sharpe ratio)
 * - Comparison and validation helpers
 *
 * Decimal.js Configuration:
 * - Precision: 20 digits (ensures accuracy for intermediate calculations)
 * - Rounding: ROUND_HALF_UP (standard financial rounding - 0.5 rounds up)
 * - Exponential notation: Disabled for numbers between 1e-9 and 1e21
 *   (prevents scientific notation for typical financial values)
 *
 * @module money
 * @see {@link https://mikemcl.github.io/decimal.js/} Decimal.js documentation
 *
 * @example
 * ```typescript
 * import { toDecimal, calculatePnL, formatPrice } from './utils/money';
 *
 * // Calculate P&L for a trade
 * const pnl = calculatePnL('100.50', '105.25', '100', 'long');
 * console.log(formatPrice(pnl)); // "475.00"
 *
 * // Calculate position size using Kelly Criterion
 * const kelly = kellyFraction(0.6, 100, 50);
 * const size = kellySuggestedSize(10000, kelly, 0.25, 10);
 * ```
 */

import Decimal from "decimal.js";

/**
 * Configure Decimal.js for financial calculations.
 *
 * Configuration details:
 * - precision: 20 - Maintains 20 significant digits for intermediate calculations
 * - rounding: ROUND_HALF_UP - Rounds 0.5 up (standard financial rounding)
 * - toExpNeg: -9 - No exponential notation for numbers >= 1e-9 (e.g., 0.000000001)
 * - toExpPos: 21 - No exponential notation for numbers < 1e21 (e.g., 999999999999999999999)
 *
 * This ensures consistent, readable output for typical financial values while
 * maintaining precision for complex calculations.
 */
Decimal.set({
  precision: 20,        // High precision for intermediate calculations
  rounding: Decimal.ROUND_HALF_UP,  // Standard financial rounding
  toExpNeg: -9,         // Don't use exponential notation for small numbers
  toExpPos: 21,         // Don't use exponential notation for large numbers
});

// Re-export Decimal for direct use when needed
export { Decimal };

/**
 * Type for values that can be safely converted to Decimal.
 * Accepts strings (recommended for precision), numbers, Decimal instances,
 * or null/undefined (converted to default values).
 *
 * @example
 * ```typescript
 * const inputs: DecimalInput[] = [
 *   '100.50',    // String (best for precision)
 *   100.50,      // Number (may have floating-point errors)
 *   new Decimal('100.50'),  // Decimal (already precise)
 *   null,        // Converted to default value
 *   undefined    // Converted to default value
 * ];
 * ```
 */
export type DecimalInput = string | number | Decimal | null | undefined;

// ============================================================================
// TYPE CONVERSIONS
// ============================================================================

/**
 * Safely converts any input to a Decimal, returning a default value for invalid inputs.
 *
 * This is the primary function for converting user input, API responses, or any
 * uncertain data into a safe Decimal for calculations. It handles null, undefined,
 * empty strings, NaN, Infinity, and invalid strings gracefully.
 *
 * @param value - The value to convert (string, number, Decimal, null, or undefined)
 * @param defaultValue - Value to return if conversion fails (defaults to 0)
 * @returns A valid Decimal instance
 *
 * @example
 * ```typescript
 * // Valid conversions
 * toDecimal('100.50')     // Decimal(100.50)
 * toDecimal(100.50)       // Decimal(100.50)
 * toDecimal(new Decimal('100.50'))  // Decimal(100.50)
 *
 * // Invalid inputs return default value
 * toDecimal(null)         // Decimal(0)
 * toDecimal(undefined)    // Decimal(0)
 * toDecimal('')           // Decimal(0)
 * toDecimal('invalid')    // Decimal(0)
 * toDecimal(NaN)          // Decimal(0)
 * toDecimal(Infinity)     // Decimal(0)
 *
 * // Custom default value
 * toDecimal(null, 100)    // Decimal(100)
 * toDecimal('bad', '50')  // Decimal(50)
 * ```
 */
export function toDecimal(value: DecimalInput, defaultValue: DecimalInput = 0): Decimal {
  if (value === null || value === undefined || value === "") {
    return new Decimal(defaultValue ?? 0);
  }

  try {
    const d = new Decimal(value);
    if (!d.isFinite()) {
      return new Decimal(defaultValue ?? 0);
    }
    return d;
  } catch {
    return new Decimal(defaultValue ?? 0);
  }
}

/**
 * Converts a Decimal (or DecimalInput) to a JavaScript number.
 *
 * WARNING: Use sparingly! Converting to number may introduce floating-point
 * precision errors. Prefer keeping values as Decimal throughout calculations
 * and only convert to number when absolutely necessary (e.g., for APIs that
 * require number types).
 *
 * @param value - The Decimal or DecimalInput to convert
 * @returns JavaScript number representation
 *
 * @example
 * ```typescript
 * const decimal = toDecimal('100.50');
 * const num = toNumber(decimal);  // 100.5
 *
 * // Direct conversion
 * toNumber('100.50')  // 100.5
 * toNumber(100.50)    // 100.5
 *
 * // Precision loss warning
 * const precise = toDecimal('0.1').plus('0.2');  // Decimal(0.3) - exact
 * const imprecise = toNumber(precise);            // 0.3 - may lose precision
 * ```
 */
export function toNumber(value: Decimal | DecimalInput): number {
  if (value instanceof Decimal) {
    return value.toNumber();
  }
  return toDecimal(value).toNumber();
}

// ============================================================================
// PRICE OPERATIONS
// ============================================================================

/**
 * Calculates the difference between two prices.
 *
 * Simple subtraction: price1 - price2. Useful for comparing price movements,
 * calculating spreads, or determining price changes.
 *
 * @param price1 - The first price (minuend)
 * @param price2 - The second price (subtrahend)
 * @returns The difference (price1 - price2)
 *
 * @example
 * ```typescript
 * // Calculate price movement
 * const diff = priceDiff('105.25', '100.00');  // Decimal(5.25)
 *
 * // Calculate bid-ask spread
 * const spread = priceDiff('100.50', '100.25');  // Decimal(0.25)
 *
 * // Negative result when price2 > price1
 * const decline = priceDiff('95.00', '100.00');  // Decimal(-5.00)
 * ```
 */
export function priceDiff(price1: DecimalInput, price2: DecimalInput): Decimal {
  return toDecimal(price1).minus(toDecimal(price2));
}

/**
 * Adds or subtracts a percentage buffer to a price.
 *
 * Used for limit orders in extended hours trading or when you want to ensure
 * order execution by adding a small buffer above (for buys) or below (for sells)
 * the current market price.
 *
 * @param price - Base price to apply buffer to
 * @param bufferPercent - Buffer as a decimal (e.g., 0.005 for 0.5%, 0.01 for 1%)
 * @param direction - 1 to add buffer (buy orders), -1 to subtract (sell orders)
 * @returns Price with buffer applied
 *
 * @example
 * ```typescript
 * // Add 0.5% buffer for extended hours buy order
 * const buyPrice = priceWithBuffer('100.00', 0.005, 1);  // Decimal(100.50)
 *
 * // Subtract 0.5% buffer for extended hours sell order
 * const sellPrice = priceWithBuffer('100.00', 0.005, -1);  // Decimal(99.50)
 *
 * // Add 1% buffer for volatile markets
 * const buffered = priceWithBuffer('100.00', 0.01, 1);  // Decimal(101.00)
 * ```
 */
export function priceWithBuffer(
  price: DecimalInput,
  bufferPercent: DecimalInput,
  direction: 1 | -1 = 1
): Decimal {
  const p = toDecimal(price);
  const buffer = p.times(toDecimal(bufferPercent));
  return direction === 1 ? p.plus(buffer) : p.minus(buffer);
}

/**
 * Rounds a price to a specified number of decimal places.
 *
 * Uses ROUND_HALF_UP rounding mode (0.5 rounds up). This is the standard
 * rounding for most stock prices (2 decimals) and forex (4-5 decimals).
 *
 * @param price - Price to round
 * @param decimals - Number of decimal places (default: 2 for stocks)
 * @returns Rounded price
 *
 * @example
 * ```typescript
 * // Round stock prices to 2 decimals
 * roundPrice('100.4567')      // Decimal(100.46)
 * roundPrice('100.4549')      // Decimal(100.45)
 * roundPrice('100.455')       // Decimal(100.46) - 0.5 rounds up
 *
 * // Round forex to 4 decimals
 * roundPrice('1.23456', 4)    // Decimal(1.2346)
 *
 * // Round crypto to 8 decimals
 * roundPrice('50000.123456789', 8)  // Decimal(50000.12345679)
 * ```
 */
export function roundPrice(price: DecimalInput, decimals: number = 2): Decimal {
  return toDecimal(price).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

/**
 * Formats a price as a string with fixed decimal places.
 *
 * Always returns a valid string, even for invalid inputs (returns "0.00").
 * Useful for display in UI, reports, or order submission.
 *
 * @param price - Price to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted price string
 *
 * @example
 * ```typescript
 * // Format for display
 * formatPrice('100.5')        // "100.50"
 * formatPrice('100')          // "100.00"
 * formatPrice('100.4567')     // "100.46"
 *
 * // Format with custom decimals
 * formatPrice('1.23456', 4)   // "1.2346"
 * formatPrice('50000.12', 0)  // "50000"
 *
 * // Invalid inputs return safe default
 * formatPrice(null)           // "0.00"
 * formatPrice(Infinity)       // "0.00"
 * ```
 */
export function formatPrice(price: DecimalInput, decimals: number = 2): string {
  const d = toDecimal(price);
  if (!d.isFinite()) return "0.00";
  return d.toFixed(decimals);
}

// ============================================================================
// QUANTITY OPERATIONS
// ============================================================================

/**
 * Calculates the quantity of shares that can be purchased with a given notional value.
 *
 * Formula: quantity = notional / price
 *
 * Returns fractional shares (use calculateWholeShares if you need whole shares only).
 * Returns 0 if price is 0 to avoid division by zero.
 *
 * @param notional - Amount of money to invest (e.g., $1000)
 * @param price - Price per share
 * @returns Number of shares (fractional)
 *
 * @example
 * ```typescript
 * // Calculate shares for $1000 investment at $100/share
 * calculateQuantity('1000', '100')      // Decimal(10)
 *
 * // Calculate fractional shares
 * calculateQuantity('1000', '33.33')    // Decimal(30.003000300030003)
 *
 * // High-value stocks
 * calculateQuantity('10000', '4567.89') // Decimal(2.189207...)
 *
 * // Zero price returns 0 (avoids division by zero)
 * calculateQuantity('1000', '0')        // Decimal(0)
 * ```
 */
export function calculateQuantity(notional: DecimalInput, price: DecimalInput): Decimal {
  const p = toDecimal(price);
  if (p.isZero()) return new Decimal(0);
  return toDecimal(notional).dividedBy(p);
}

/**
 * Calculates the number of whole shares that can be purchased.
 *
 * Same as calculateQuantity but floors the result to get whole shares.
 * Use this for brokers that don't support fractional shares.
 *
 * @param notional - Amount of money to invest
 * @param price - Price per share
 * @returns Number of whole shares (floored)
 *
 * @example
 * ```typescript
 * // Calculate whole shares only
 * calculateWholeShares('1000', '33.33')  // Decimal(30) - not 30.003
 *
 * // Compared to fractional shares
 * calculateQuantity('1000', '33.33')     // Decimal(30.003000300030003)
 * calculateWholeShares('1000', '33.33')  // Decimal(30)
 *
 * // High-value stocks
 * calculateWholeShares('10000', '4567.89')  // Decimal(2) - not 2.189
 *
 * // Less than 1 share available
 * calculateWholeShares('100', '150')     // Decimal(0)
 * ```
 */
export function calculateWholeShares(notional: DecimalInput, price: DecimalInput): Decimal {
  return calculateQuantity(notional, price).floor();
}

/**
 * Calculates a partial quantity based on a percentage.
 *
 * Useful for partial position closes (e.g., "close 50% of position") or
 * scaling into/out of positions.
 *
 * @param quantity - Total quantity
 * @param percent - Percentage to calculate (as whole number, e.g., 50 for 50%, not 0.5)
 * @returns Partial quantity
 *
 * @example
 * ```typescript
 * // Close 50% of a 100 share position
 * partialQuantity('100', '50')      // Decimal(50)
 *
 * // Close 75% of position
 * partialQuantity('100', '75')      // Decimal(75)
 *
 * // Close 33.33% of position
 * partialQuantity('100', '33.33')   // Decimal(33.33)
 *
 * // Scale out of fractional shares
 * partialQuantity('10.5', '50')     // Decimal(5.25)
 *
 * // Close 10% (scale out)
 * partialQuantity('1000', '10')     // Decimal(100)
 * ```
 */
export function partialQuantity(quantity: DecimalInput, percent: DecimalInput): Decimal {
  return toDecimal(quantity).times(toDecimal(percent)).dividedBy(100);
}

/**
 * Formats a quantity as a string for display.
 *
 * Smart formatting:
 * - Integer quantities: No decimal point (e.g., "100" not "100.0000")
 * - Fractional quantities: Up to specified decimals, trailing zeros removed
 * - Invalid inputs: Returns "0"
 *
 * @param quantity - Quantity to format
 * @param decimals - Maximum decimal places (default: 4)
 * @returns Formatted quantity string
 *
 * @example
 * ```typescript
 * // Whole shares - no decimals
 * formatQuantity('100')           // "100"
 * formatQuantity('100.0000')      // "100"
 *
 * // Fractional shares - trailing zeros removed
 * formatQuantity('10.5')          // "10.5"
 * formatQuantity('10.5000')       // "10.5"
 * formatQuantity('10.1234')       // "10.1234"
 * formatQuantity('10.12345678')   // "10.1235" (rounded to 4 decimals)
 *
 * // Custom decimals
 * formatQuantity('10.123456', 6)  // "10.123456"
 * formatQuantity('10.123456', 2)  // "10.12"
 *
 * // Invalid inputs
 * formatQuantity(null)            // "0"
 * ```
 */
export function formatQuantity(quantity: DecimalInput, decimals: number = 4): string {
  const d = toDecimal(quantity);
  if (!d.isFinite()) return "0";
  if (d.isInteger()) return d.toString();
  return d.toFixed(decimals).replace(/\.?0+$/, "");
}

// ============================================================================
// PNL CALCULATIONS
// ============================================================================

/**
 * Calculates realized profit and loss (P&L) for a closed trade.
 *
 * Formulas:
 * - Long: (exitPrice - entryPrice) * quantity
 * - Short: (entryPrice - exitPrice) * quantity
 *
 * Returns 0 for invalid inputs (NaN, Infinity).
 * Positive values = profit, negative values = loss.
 *
 * @param entryPrice - Entry price per share
 * @param exitPrice - Exit price per share
 * @param quantity - Number of shares traded
 * @param side - Trade direction: "long" (buy then sell) or "short" (sell then buy)
 * @returns Realized P&L in dollar amount
 *
 * @example
 * ```typescript
 * // Long trade - profit
 * calculatePnL('100', '105', '10', 'long')    // Decimal(50) - $50 profit
 *
 * // Long trade - loss
 * calculatePnL('100', '95', '10', 'long')     // Decimal(-50) - $50 loss
 *
 * // Short trade - profit (price goes down)
 * calculatePnL('100', '95', '10', 'short')    // Decimal(50) - $50 profit
 *
 * // Short trade - loss (price goes up)
 * calculatePnL('100', '105', '10', 'short')   // Decimal(-50) - $50 loss
 *
 * // Large position
 * calculatePnL('100.50', '105.25', '1000', 'long')  // Decimal(4750) - $4,750 profit
 *
 * // Invalid inputs return 0
 * calculatePnL(NaN, '100', '10', 'long')      // Decimal(0)
 * ```
 */
export function calculatePnL(
  entryPrice: DecimalInput,
  exitPrice: DecimalInput,
  quantity: DecimalInput,
  side: "long" | "short" = "long"
): Decimal {
  const entry = toDecimal(entryPrice);
  const exit = toDecimal(exitPrice);
  const qty = toDecimal(quantity);

  if (!entry.isFinite() || !exit.isFinite() || !qty.isFinite()) {
    return new Decimal(0);
  }

  if (side === "long") {
    return exit.minus(entry).times(qty);
  } else {
    return entry.minus(exit).times(qty);
  }
}

/**
 * Calculates P&L as a number (for backward compatibility).
 *
 * WARNING: Returns a JavaScript number, which may lose precision.
 * Prefer calculatePnL() which returns Decimal.
 *
 * @param entryPrice - Entry price per share
 * @param exitPrice - Exit price per share
 * @param quantity - Number of shares traded
 * @param side - Trade direction: "long" or "short"
 * @returns Realized P&L as a number
 *
 * @example
 * ```typescript
 * // Same as calculatePnL but returns number
 * calculatePnLNumber('100', '105', '10', 'long')  // 50 (number, not Decimal)
 *
 * // Use calculatePnL for precision
 * calculatePnL('100', '105', '10', 'long')        // Decimal(50)
 * ```
 */
export function calculatePnLNumber(
  entryPrice: DecimalInput,
  exitPrice: DecimalInput,
  quantity: DecimalInput,
  side: "long" | "short" = "long"
): number {
  return calculatePnL(entryPrice, exitPrice, quantity, side).toNumber();
}

// ============================================================================
// PERCENTAGE CALCULATIONS
// ============================================================================

/**
 * Calculates the percentage change between two values.
 *
 * Formula: ((current - previous) / previous) * 100
 *
 * Returns result as a whole number percentage (e.g., 5 for 5%, not 0.05).
 * Returns 0 if previous value is 0 (to avoid division by zero).
 *
 * @param current - Current/new value
 * @param previous - Previous/old value
 * @returns Percentage change (e.g., 5 for 5% increase, -5 for 5% decrease)
 *
 * @example
 * ```typescript
 * // Price increase
 * percentChange('105', '100')       // Decimal(5) - 5% increase
 *
 * // Price decrease
 * percentChange('95', '100')        // Decimal(-5) - 5% decrease
 *
 * // Portfolio return
 * percentChange('11000', '10000')   // Decimal(10) - 10% gain
 * percentChange('9000', '10000')    // Decimal(-10) - 10% loss
 *
 * // Small changes
 * percentChange('100.50', '100')    // Decimal(0.5) - 0.5% increase
 *
 * // Zero previous value returns 0
 * percentChange('100', '0')         // Decimal(0)
 * ```
 */
export function percentChange(current: DecimalInput, previous: DecimalInput): Decimal {
  const prev = toDecimal(previous);
  if (prev.isZero()) return new Decimal(0);

  const curr = toDecimal(current);
  return curr.minus(prev).dividedBy(prev).times(100);
}

/**
 * Calculates percentage change as a number.
 *
 * WARNING: Returns a JavaScript number. Prefer percentChange() for precision.
 *
 * @param current - Current/new value
 * @param previous - Previous/old value
 * @returns Percentage change as a number
 *
 * @example
 * ```typescript
 * percentChangeNumber('105', '100')  // 5 (number, not Decimal)
 * percentChange('105', '100')        // Decimal(5)
 * ```
 */
export function percentChangeNumber(current: DecimalInput, previous: DecimalInput): number {
  return percentChange(current, previous).toNumber();
}

/**
 * Formats a percentage value as a string with a percent sign.
 *
 * Adds "%" suffix and formats to specified decimal places.
 * Always returns valid string, even for invalid inputs.
 *
 * @param value - Percentage value (as whole number, e.g., 5 for 5%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string (e.g., "5.00%")
 *
 * @example
 * ```typescript
 * // Format percentage
 * formatPercent('5')          // "5.00%"
 * formatPercent('5.5')        // "5.50%"
 * formatPercent('5.567')      // "5.57%"
 *
 * // Custom decimals
 * formatPercent('5.5', 1)     // "5.5%"
 * formatPercent('5.5', 0)     // "6%"
 *
 * // Negative percentages
 * formatPercent('-5.5')       // "-5.50%"
 *
 * // Invalid inputs
 * formatPercent(null)         // "0.00%"
 * formatPercent(Infinity)     // "0.00%"
 * ```
 */
export function formatPercent(value: DecimalInput, decimals: number = 2): string {
  const d = toDecimal(value);
  if (!d.isFinite()) return "0.00%";
  return `${d.toFixed(decimals)}%`;
}

/**
 * Calculates a percentage of a value.
 *
 * Formula: (value * percent) / 100
 *
 * Useful for calculating tax, fees, discounts, or partial amounts.
 *
 * @param value - The base value
 * @param percent - The percentage (as whole number, e.g., 5 for 5%, not 0.05)
 * @returns Result of percentage calculation
 *
 * @example
 * ```typescript
 * // Calculate 10% of $1000
 * percentOf('1000', '10')         // Decimal(100)
 *
 * // Calculate 2.5% fee
 * percentOf('1000', '2.5')        // Decimal(25)
 *
 * // Calculate 50% of position
 * percentOf('100', '50')          // Decimal(50)
 *
 * // Calculate 0.5% slippage
 * percentOf('10000', '0.5')       // Decimal(50)
 *
 * // Calculate tax (6.5%)
 * percentOf('1000', '6.5')        // Decimal(65)
 * ```
 */
export function percentOf(value: DecimalInput, percent: DecimalInput): Decimal {
  return toDecimal(value).times(toDecimal(percent)).dividedBy(100);
}

// ============================================================================
// POSITION VALUE CALCULATIONS
// ============================================================================

/**
 * Calculates the notional (market) value of a position.
 *
 * Formula: value = quantity * price
 *
 * This is the current market value of the position - what you would receive
 * if you sold all shares at the current price.
 *
 * @param quantity - Number of shares held
 * @param price - Current market price per share
 * @returns Market value of the position
 *
 * @example
 * ```typescript
 * // 100 shares at $50 = $5,000 market value
 * positionValue('100', '50')        // Decimal(5000)
 *
 * // Fractional shares
 * positionValue('10.5', '100.50')   // Decimal(1055.25)
 *
 * // Large position
 * positionValue('1000', '456.78')   // Decimal(456780)
 *
 * // Zero quantity or price
 * positionValue('0', '100')         // Decimal(0)
 * positionValue('100', '0')         // Decimal(0)
 * ```
 */
export function positionValue(quantity: DecimalInput, price: DecimalInput): Decimal {
  return toDecimal(quantity).times(toDecimal(price));
}

/**
 * Calculates the cost basis of a position.
 *
 * Formula: costBasis = quantity * avgEntryPrice
 *
 * This is the total amount paid to acquire the position. Used to calculate
 * unrealized P&L by comparing to current market value.
 *
 * @param quantity - Number of shares held
 * @param avgEntryPrice - Average price paid per share (for multi-leg entries)
 * @returns Total cost basis
 *
 * @example
 * ```typescript
 * // 100 shares bought at average price $45 = $4,500 cost basis
 * costBasis('100', '45')            // Decimal(4500)
 *
 * // Multiple entries averaged
 * // Entry 1: 50 shares @ $100 = $5,000
 * // Entry 2: 50 shares @ $110 = $5,500
 * // Average: $105, Cost basis: $10,500
 * costBasis('100', '105')           // Decimal(10500)
 *
 * // Fractional shares
 * costBasis('10.5', '100.50')       // Decimal(1055.25)
 * ```
 */
export function costBasis(quantity: DecimalInput, avgEntryPrice: DecimalInput): Decimal {
  return toDecimal(quantity).times(toDecimal(avgEntryPrice));
}

/**
 * Calculates unrealized profit and loss for an open position.
 *
 * Formula: unrealizedPnL = marketValue - costBasis
 *         = (quantity * currentPrice) - (quantity * avgEntryPrice)
 *
 * Positive = profit, negative = loss.
 *
 * @param quantity - Number of shares held
 * @param currentPrice - Current market price per share
 * @param avgEntryPrice - Average entry price per share
 * @returns Unrealized P&L (dollar amount)
 *
 * @example
 * ```typescript
 * // Position in profit: bought at $45, now $50
 * // 100 shares * ($50 - $45) = $500 profit
 * unrealizedPnL('100', '50', '45')      // Decimal(500)
 *
 * // Position in loss: bought at $50, now $45
 * // 100 shares * ($45 - $50) = -$500 loss
 * unrealizedPnL('100', '45', '50')      // Decimal(-500)
 *
 * // Breakeven position
 * unrealizedPnL('100', '100', '100')    // Decimal(0)
 *
 * // Fractional shares
 * unrealizedPnL('10.5', '105', '100')   // Decimal(52.5)
 * ```
 */
export function unrealizedPnL(
  quantity: DecimalInput,
  currentPrice: DecimalInput,
  avgEntryPrice: DecimalInput
): Decimal {
  const value = positionValue(quantity, currentPrice);
  const cost = costBasis(quantity, avgEntryPrice);
  return value.minus(cost);
}

/**
 * Calculates unrealized P&L as a percentage.
 *
 * Formula: ((currentPrice - avgEntryPrice) / avgEntryPrice) * 100
 *
 * Same as percentChange(currentPrice, avgEntryPrice).
 *
 * @param currentPrice - Current market price
 * @param avgEntryPrice - Average entry price
 * @returns Unrealized P&L as percentage (e.g., 10 for 10% gain)
 *
 * @example
 * ```typescript
 * // 10% gain: bought at $100, now $110
 * unrealizedPnLPercent('110', '100')    // Decimal(10)
 *
 * // 5% loss: bought at $100, now $95
 * unrealizedPnLPercent('95', '100')     // Decimal(-5)
 *
 * // 50% gain: bought at $100, now $150
 * unrealizedPnLPercent('150', '100')    // Decimal(50)
 *
 * // Small gain: bought at $100, now $100.50
 * unrealizedPnLPercent('100.50', '100') // Decimal(0.5)
 * ```
 */
export function unrealizedPnLPercent(
  currentPrice: DecimalInput,
  avgEntryPrice: DecimalInput
): Decimal {
  return percentChange(currentPrice, avgEntryPrice);
}

// ============================================================================
// PORTFOLIO CALCULATIONS
// ============================================================================

/**
 * Calculates what percentage of the portfolio a position represents.
 *
 * Formula: (positionValue / portfolioValue) * 100
 *
 * Used for position sizing limits (e.g., "no single position > 10% of portfolio")
 * and portfolio analysis.
 *
 * @param positionValue - Market value of the position
 * @param portfolioValue - Total portfolio value
 * @returns Allocation percentage (e.g., 15 for 15% of portfolio)
 *
 * @example
 * ```typescript
 * // $5,000 position in $50,000 portfolio = 10%
 * allocationPercent('5000', '50000')      // Decimal(10)
 *
 * // $15,000 position in $100,000 portfolio = 15%
 * allocationPercent('15000', '100000')    // Decimal(15)
 *
 * // Small position: $500 in $50,000 = 1%
 * allocationPercent('500', '50000')       // Decimal(1)
 *
 * // Large position: $25,000 in $50,000 = 50%
 * allocationPercent('25000', '50000')     // Decimal(50)
 *
 * // Zero portfolio returns 0 (avoids division by zero)
 * allocationPercent('5000', '0')          // Decimal(0)
 * ```
 */
export function allocationPercent(
  positionValue: DecimalInput,
  portfolioValue: DecimalInput
): Decimal {
  const portfolio = toDecimal(portfolioValue);
  if (portfolio.isZero()) return new Decimal(0);
  return toDecimal(positionValue).dividedBy(portfolio).times(100);
}

/**
 * Calculates total portfolio equity from cash and all positions.
 *
 * Formula: equity = cash + sum(quantity * price for all positions)
 *
 * This represents your total account value (buying power + invested capital).
 *
 * @param cash - Available cash in the account
 * @param positions - Array of positions with quantity and current price
 * @returns Total equity
 *
 * @example
 * ```typescript
 * // $10,000 cash + 2 positions
 * const positions = [
 *   { quantity: '100', price: '50' },   // $5,000
 *   { quantity: '50', price: '100' }    // $5,000
 * ];
 * calculateEquity('10000', positions)    // Decimal(20000)
 *
 * // All cash, no positions
 * calculateEquity('50000', [])           // Decimal(50000)
 *
 * // No cash, all invested
 * const invested = [
 *   { quantity: '200', price: '100' }   // $20,000
 * ];
 * calculateEquity('0', invested)         // Decimal(20000)
 *
 * // Multiple positions
 * const portfolio = [
 *   { quantity: '100', price: '150.50' },  // $15,050
 *   { quantity: '50', price: '200.25' },   // $10,012.50
 *   { quantity: '200', price: '50.75' }    // $10,150
 * ];
 * calculateEquity('5000', portfolio)     // Decimal(40212.50)
 * ```
 */
export function calculateEquity(
  cash: DecimalInput,
  positions: Array<{ quantity: DecimalInput; price: DecimalInput }>
): Decimal {
  let equity = toDecimal(cash);
  for (const pos of positions) {
    equity = equity.plus(positionValue(pos.quantity, pos.price));
  }
  return equity;
}

// ============================================================================
// FEES AND SLIPPAGE
// ============================================================================

/**
 * Calculates slippage amount in dollar terms.
 *
 * Slippage is the difference between expected and actual execution price.
 * Positive slippage = worse execution (costs more for buys, gets less for sells).
 *
 * Formula: slippage = price * (slippageBps / 10000)
 * - Buy orders: slippage is positive (pay more)
 * - Sell orders: slippage is negative (receive less)
 *
 * @param price - Base price
 * @param slippageBps - Slippage in basis points (100 bps = 1%)
 * @param side - Trade side: "buy" or "sell"
 * @returns Slippage amount (positive for buy, negative for sell)
 *
 * @example
 * ```typescript
 * // 10 bps (0.1%) slippage on $100 buy = +$0.10
 * calculateSlippage('100', '10', 'buy')    // Decimal(0.1)
 *
 * // 10 bps slippage on $100 sell = -$0.10
 * calculateSlippage('100', '10', 'sell')   // Decimal(-0.1)
 *
 * // 50 bps (0.5%) slippage on $1000 buy = +$5
 * calculateSlippage('1000', '50', 'buy')   // Decimal(5)
 *
 * // 100 bps (1%) slippage on $100 sell = -$1
 * calculateSlippage('100', '100', 'sell')  // Decimal(-1)
 * ```
 */
export function calculateSlippage(
  price: DecimalInput,
  slippageBps: DecimalInput,
  side: "buy" | "sell"
): Decimal {
  const p = toDecimal(price);
  const slippage = p.times(toDecimal(slippageBps)).dividedBy(10000);
  return side === "buy" ? slippage : slippage.negated();
}

/**
 * Calculates actual execution price including slippage.
 *
 * For buy orders, execution price is higher (worse).
 * For sell orders, execution price is lower (worse).
 *
 * @param basePrice - Expected/quoted price
 * @param slippageBps - Slippage in basis points
 * @param side - Trade side: "buy" or "sell"
 * @returns Actual execution price
 *
 * @example
 * ```typescript
 * // Buy with 10 bps slippage: pay $100.10 instead of $100
 * executionPrice('100', '10', 'buy')     // Decimal(100.1)
 *
 * // Sell with 10 bps slippage: receive $99.90 instead of $100
 * executionPrice('100', '10', 'sell')    // Decimal(99.9)
 *
 * // Buy with 50 bps (0.5%) slippage
 * executionPrice('1000', '50', 'buy')    // Decimal(1005)
 *
 * // Sell with 100 bps (1%) slippage
 * executionPrice('100', '100', 'sell')   // Decimal(99)
 * ```
 */
export function executionPrice(
  basePrice: DecimalInput,
  slippageBps: DecimalInput,
  side: "buy" | "sell"
): Decimal {
  const slippage = calculateSlippage(basePrice, slippageBps, side);
  return toDecimal(basePrice).plus(slippage);
}

/**
 * Calculates percentage-based fees.
 *
 * Formula: fee = notional * (feePercent / 100)
 *
 * Used for broker commissions, exchange fees, or regulatory fees
 * that are charged as a percentage of trade value.
 *
 * @param notional - Trade notional value (quantity * price)
 * @param feePercent - Fee percentage (e.g., 0.1 for 0.1%)
 * @returns Fee amount
 *
 * @example
 * ```typescript
 * // 0.1% fee on $10,000 trade = $10
 * calculateFeePercent('10000', '0.1')    // Decimal(10)
 *
 * // 0.03% fee on $5,000 trade = $1.50
 * calculateFeePercent('5000', '0.03')    // Decimal(1.5)
 *
 * // 1% fee on $1,000 trade = $10
 * calculateFeePercent('1000', '1')       // Decimal(10)
 *
 * // 0.5% fee on $100,000 trade = $500
 * calculateFeePercent('100000', '0.5')   // Decimal(500)
 * ```
 */
export function calculateFeePercent(notional: DecimalInput, feePercent: DecimalInput): Decimal {
  return toDecimal(notional).times(toDecimal(feePercent)).dividedBy(100);
}

/**
 * Calculates total trade cost including fees.
 *
 * Formula: totalCost = notional + fees
 *
 * This is the total cash required to execute a trade (for buys) or
 * total cash received after fees (for sells).
 *
 * @param notional - Trade notional value (quantity * price)
 * @param fees - Total fees charged
 * @returns Total cost
 *
 * @example
 * ```typescript
 * // $10,000 trade with $10 fee = $10,010 total
 * totalTradeCost('10000', '10')          // Decimal(10010)
 *
 * // $5,000 trade with $5 fee = $5,005 total
 * totalTradeCost('5000', '5')            // Decimal(5005)
 *
 * // Calculate total cost for a buy
 * const notional = positionValue('100', '100');  // $10,000
 * const fee = calculateFeePercent(notional, '0.1');  // $10
 * totalTradeCost(notional, fee)          // Decimal(10010)
 * ```
 */
export function totalTradeCost(notional: DecimalInput, fees: DecimalInput): Decimal {
  return toDecimal(notional).plus(toDecimal(fees));
}

// ============================================================================
// RISK CALCULATIONS
// ============================================================================

/**
 * Calculates stop loss price for risk management.
 *
 * Stop loss is a price level where you automatically exit to limit losses.
 * - Long positions: stop below entry (sells if price drops)
 * - Short positions: stop above entry (buys if price rises)
 *
 * @param entryPrice - Entry price of the position
 * @param stopPercent - Stop loss percentage (e.g., 2 for 2% stop)
 * @param side - Position side: "long" or "short"
 * @returns Stop loss price
 *
 * @example
 * ```typescript
 * // Long position: 2% stop loss
 * // Entry: $100, Stop: $98 (2% below)
 * stopLossPrice('100', '2', 'long')      // Decimal(98)
 *
 * // Long position: 5% stop loss
 * stopLossPrice('100', '5', 'long')      // Decimal(95)
 *
 * // Short position: 2% stop loss
 * // Entry: $100, Stop: $102 (2% above)
 * stopLossPrice('100', '2', 'short')     // Decimal(102)
 *
 * // Tight stop: 0.5%
 * stopLossPrice('100', '0.5', 'long')    // Decimal(99.5)
 *
 * // Wide stop: 10%
 * stopLossPrice('100', '10', 'long')     // Decimal(90)
 * ```
 */
export function stopLossPrice(
  entryPrice: DecimalInput,
  stopPercent: DecimalInput,
  side: "long" | "short" = "long"
): Decimal {
  const entry = toDecimal(entryPrice);
  const stopAmount = percentOf(entry, stopPercent);
  return side === "long" ? entry.minus(stopAmount) : entry.plus(stopAmount);
}

/**
 * Calculates take profit price for profit targets.
 *
 * Take profit is a price level where you automatically exit to lock in gains.
 * - Long positions: profit target above entry (sells at higher price)
 * - Short positions: profit target below entry (buys at lower price)
 *
 * @param entryPrice - Entry price of the position
 * @param profitPercent - Take profit percentage (e.g., 5 for 5% gain)
 * @param side - Position side: "long" or "short"
 * @returns Take profit price
 *
 * @example
 * ```typescript
 * // Long position: 5% profit target
 * // Entry: $100, Target: $105 (5% above)
 * takeProfitPrice('100', '5', 'long')    // Decimal(105)
 *
 * // Long position: 10% profit target
 * takeProfitPrice('100', '10', 'long')   // Decimal(110)
 *
 * // Short position: 5% profit target
 * // Entry: $100, Target: $95 (5% below)
 * takeProfitPrice('100', '5', 'short')   // Decimal(95)
 *
 * // Conservative target: 2%
 * takeProfitPrice('100', '2', 'long')    // Decimal(102)
 *
 * // Aggressive target: 20%
 * takeProfitPrice('100', '20', 'long')   // Decimal(120)
 * ```
 */
export function takeProfitPrice(
  entryPrice: DecimalInput,
  profitPercent: DecimalInput,
  side: "long" | "short" = "long"
): Decimal {
  const entry = toDecimal(entryPrice);
  const profitAmount = percentOf(entry, profitPercent);
  return side === "long" ? entry.plus(profitAmount) : entry.minus(profitAmount);
}

/**
 * Calculates trailing stop price that follows price movement.
 *
 * Trailing stop locks in gains as price moves favorably. The stop price
 * trails the high water mark (highest price reached) by a fixed percentage.
 *
 * For long positions only (shorts use inverted logic not implemented here).
 *
 * @param highWaterMark - Highest price reached since entry
 * @param trailPercent - Trailing percentage (e.g., 5 for 5% trail)
 * @returns Current trailing stop price
 *
 * @example
 * ```typescript
 * // Entry at $100, price rallies to $120
 * // 5% trailing stop: $120 * 0.95 = $114
 * trailingStopPrice('120', '5')          // Decimal(114)
 *
 * // Price continues to $130
 * // New stop: $130 * 0.95 = $123.50
 * trailingStopPrice('130', '5')          // Decimal(123.5)
 *
 * // Tight trailing stop: 2%
 * trailingStopPrice('120', '2')          // Decimal(117.6)
 *
 * // Wide trailing stop: 10%
 * trailingStopPrice('120', '10')         // Decimal(108)
 *
 * // Scenario: Entry $100, rallies to $150, trails by 5%
 * // Current stop: $150 * 0.95 = $142.50
 * // Locked in profit: $42.50 (42.5% minimum gain)
 * trailingStopPrice('150', '5')          // Decimal(142.5)
 * ```
 */
export function trailingStopPrice(
  highWaterMark: DecimalInput,
  trailPercent: DecimalInput
): Decimal {
  const hwm = toDecimal(highWaterMark);
  const trail = percentOf(hwm, trailPercent);
  return hwm.minus(trail);
}

// ============================================================================
// KELLY CRITERION
// ============================================================================

/**
 * Calculates Kelly Criterion fraction for optimal position sizing.
 *
 * The Kelly Criterion is a formula for bet sizing that maximizes long-term
 * growth rate. It balances risk and reward based on win rate and payoff ratio.
 *
 * Formula: Kelly = (p * b - q) / b
 * where:
 *   p = win rate (as decimal, e.g., 0.6 for 60%)
 *   q = loss rate (1 - p)
 *   b = win/loss ratio (avgWin / avgLoss)
 *
 * WARNING: Full Kelly can be aggressive. Most traders use fractional Kelly
 * (e.g., 1/4 Kelly) to reduce volatility.
 *
 * @param winRate - Win rate as decimal (e.g., 0.6 for 60% win rate)
 * @param avgWin - Average winning trade profit
 * @param avgLoss - Average losing trade loss (positive number)
 * @returns Kelly fraction (0 to 1, where 1 = 100% of portfolio)
 *
 * @example
 * ```typescript
 * // Strategy: 60% win rate, avg win $100, avg loss $50
 * // Kelly = (0.6 * 2 - 0.4) / 2 = 0.4 (40% of portfolio)
 * kellyFraction(0.6, 100, 50)            // Decimal(0.4)
 *
 * // Strategy: 50% win rate, avg win $200, avg loss $100
 * // Kelly = (0.5 * 2 - 0.5) / 2 = 0.25 (25% of portfolio)
 * kellyFraction(0.5, 200, 100)           // Decimal(0.25)
 *
 * // Strategy: 40% win rate, avg win $300, avg loss $100
 * // Kelly = (0.4 * 3 - 0.6) / 3 = 0.2 (20% of portfolio)
 * kellyFraction(0.4, 300, 100)           // Decimal(0.2)
 *
 * // Poor strategy: 30% win rate, 1:1 payoff
 * // Kelly = (0.3 * 1 - 0.7) / 1 = -0.4 -> 0 (don't trade!)
 * kellyFraction(0.3, 100, 100)           // Decimal(0)
 *
 * // Zero avgWin or avgLoss returns 0
 * kellyFraction(0.6, 0, 50)              // Decimal(0)
 * ```
 */
export function kellyFraction(
  winRate: DecimalInput,
  avgWin: DecimalInput,
  avgLoss: DecimalInput
): Decimal {
  const w = toDecimal(winRate);  // As decimal (e.g., 0.6 for 60%)
  const win = toDecimal(avgWin);
  const loss = toDecimal(avgLoss).abs();

  if (win.isZero() || loss.isZero()) return new Decimal(0);

  const lossRate = new Decimal(1).minus(w);
  const winLossRatio = win.dividedBy(loss);

  // Kelly = (p * b - q) / b where p = winRate, q = lossRate, b = win/loss ratio
  const kelly = winLossRatio.times(w).minus(lossRate).dividedBy(winLossRatio);

  // Cap at 0 (no negative sizing)
  return Decimal.max(kelly, 0);
}

/**
 * Calculates suggested position size using fractional Kelly criterion.
 *
 * Fractional Kelly reduces the aggressiveness of full Kelly to manage volatility.
 * Common fractions: 1/2 Kelly, 1/4 Kelly, or 1/10 Kelly.
 *
 * The result is capped at maxPercent to prevent over-concentration.
 *
 * @param portfolioValue - Total portfolio value
 * @param kellyFrac - Raw Kelly fraction from kellyFraction()
 * @param fraction - Fractional Kelly multiplier (e.g., 0.25 for quarter Kelly, 0.5 for half Kelly)
 * @param maxPercent - Maximum position size as percentage (e.g., 10 for 10% max)
 * @returns Suggested position size in dollars
 *
 * @example
 * ```typescript
 * // Kelly says 40%, use quarter Kelly (10%), $100k portfolio
 * kellySuggestedSize(100000, 0.4, 0.25, 10)    // Decimal(10000) - 10% = $10k
 *
 * // Kelly says 20%, use half Kelly (10%), $50k portfolio
 * kellySuggestedSize(50000, 0.2, 0.5, 10)      // Decimal(5000) - 10% = $5k
 *
 * // Kelly says 50%, use quarter Kelly (12.5%), but cap at 10%
 * kellySuggestedSize(100000, 0.5, 0.25, 10)    // Decimal(10000) - capped at 10%
 *
 * // Kelly says 10%, use quarter Kelly (2.5%)
 * kellySuggestedSize(100000, 0.1, 0.25, 10)    // Decimal(2500) - 2.5% = $2.5k
 *
 * // Full example workflow
 * const kelly = kellyFraction(0.6, 100, 50);   // Decimal(0.4) - 40%
 * const size = kellySuggestedSize(100000, kelly, 0.25, 10);  // $10k (10%)
 *
 * // Conservative: 1/10 Kelly
 * kellySuggestedSize(100000, 0.4, 0.1, 10)     // Decimal(4000) - 4% = $4k
 * ```
 */
export function kellySuggestedSize(
  portfolioValue: DecimalInput,
  kellyFrac: DecimalInput,
  fraction: DecimalInput = 0.25,
  maxPercent: DecimalInput = 10
): Decimal {
  const adjustedKelly = toDecimal(kellyFrac).times(toDecimal(fraction));
  const kellyPercent = adjustedKelly.times(100);
  const cappedPercent = Decimal.min(kellyPercent, toDecimal(maxPercent));
  return percentOf(portfolioValue, cappedPercent);
}

// ============================================================================
// STATISTICAL CALCULATIONS (for prices/returns)
// ============================================================================

/**
 * Calculates the arithmetic mean (average) of an array of values.
 *
 * Formula: mean = sum(values) / count(values)
 *
 * Used for calculating average returns, average prices, or any central tendency.
 *
 * @param values - Array of values to average
 * @returns Mean value (returns 0 for empty array)
 *
 * @example
 * ```typescript
 * // Average daily return
 * const returns = ['0.5', '-0.3', '0.2', '0.1', '-0.1'];
 * mean(returns)                          // Decimal(0.08)
 *
 * // Average price
 * const prices = ['100', '102', '101', '103', '99'];
 * mean(prices)                           // Decimal(101)
 *
 * // Average trade size
 * const sizes = ['1000', '2000', '1500', '2500'];
 * mean(sizes)                            // Decimal(1750)
 *
 * // Empty array returns 0
 * mean([])                               // Decimal(0)
 * ```
 */
export function mean(values: DecimalInput[]): Decimal {
  if (values.length === 0) return new Decimal(0);
  const sum = values.reduce((acc: Decimal, v) => acc.plus(toDecimal(v)), new Decimal(0));
  return sum.dividedBy(values.length);
}

/**
 * Calculates the variance of an array of values.
 *
 * Variance measures the spread of data points around the mean.
 * Formula: variance = mean((value - mean)^2)
 *
 * Higher variance = more volatility/risk.
 *
 * @param values - Array of values
 * @returns Variance (returns 0 for arrays with < 2 values)
 *
 * @example
 * ```typescript
 * // Variance of returns (measures volatility)
 * const returns = ['1', '2', '3', '4', '5'];
 * variance(returns)                      // Decimal(2) - variance of 1-5
 *
 * // Low variance (stable)
 * const stable = ['100', '101', '100', '99', '100'];
 * variance(stable)                       // Decimal(0.4) - low variance
 *
 * // High variance (volatile)
 * const volatile = ['100', '120', '80', '110', '90'];
 * variance(volatile)                     // Decimal(200) - high variance
 *
 * // Less than 2 values returns 0
 * variance(['100'])                      // Decimal(0)
 * variance([])                           // Decimal(0)
 * ```
 */
export function variance(values: DecimalInput[]): Decimal {
  if (values.length < 2) return new Decimal(0);
  const avg = mean(values);
  const squaredDiffs = values.map(v => toDecimal(v).minus(avg).pow(2));
  return mean(squaredDiffs);
}

/**
 * Calculates the standard deviation of an array of values.
 *
 * Standard deviation is the square root of variance, measuring volatility
 * in the same units as the original data.
 *
 * Formula: stdDev = sqrt(variance)
 *
 * Used for risk calculations, Sharpe ratio, Bollinger Bands, etc.
 *
 * @param values - Array of values
 * @returns Standard deviation
 *
 * @example
 * ```typescript
 * // Daily return volatility
 * const returns = ['1', '2', '1.5', '2.5', '1.8'];
 * stdDev(returns)                        // Decimal(0.5477...) - volatility
 *
 * // Price volatility
 * const prices = ['100', '105', '98', '102', '101'];
 * stdDev(prices)                         // Decimal(2.5495...) - price volatility
 *
 * // Annualize daily volatility (252 trading days)
 * const dailyReturns = ['0.5', '-0.3', '0.2', '0.1'];
 * const dailyVol = stdDev(dailyReturns);
 * const annualVol = dailyVol.times(Math.sqrt(252));  // Annualized volatility
 * ```
 */
export function stdDev(values: DecimalInput[]): Decimal {
  return variance(values).sqrt();
}

/**
 * Calculates the Sharpe ratio for risk-adjusted returns.
 *
 * Sharpe ratio measures excess return per unit of risk (volatility).
 * Higher Sharpe ratio = better risk-adjusted performance.
 *
 * Formula: Sharpe = ((avgReturn - riskFreeRate) / stdDev) * sqrt(periodsPerYear)
 *
 * Typical interpretation:
 * - < 1.0: Subpar risk-adjusted returns
 * - 1.0-2.0: Good risk-adjusted returns
 * - 2.0-3.0: Very good
 * - > 3.0: Excellent (rare)
 *
 * @param returns - Array of period returns (e.g., daily returns as decimals)
 * @param riskFreeRate - Annual risk-free rate (e.g., 0.02 for 2%)
 * @param periodsPerYear - Number of periods per year (252 for daily, 12 for monthly)
 * @returns Annualized Sharpe ratio
 *
 * @example
 * ```typescript
 * // Daily returns for a month (20 trading days)
 * const dailyReturns = [
 *   '0.01', '-0.005', '0.008', '0.012', '-0.003',
 *   '0.007', '0.002', '-0.001', '0.009', '0.004'
 * ];
 *
 * // Sharpe with 2% risk-free rate, 252 trading days
 * sharpeRatio(dailyReturns, 0.02, 252)   // Decimal(~1.5) - good Sharpe
 *
 * // Sharpe with 0% risk-free rate (simpler)
 * sharpeRatio(dailyReturns, 0, 252)      // Higher Sharpe
 *
 * // Monthly returns
 * const monthlyReturns = ['2', '-1', '1.5', '3', '0.5'];
 * sharpeRatio(monthlyReturns, 0.02, 12)  // Monthly-based Sharpe
 *
 * // Empty returns or zero volatility returns 0
 * sharpeRatio([], 0.02, 252)             // Decimal(0)
 * ```
 */
export function sharpeRatio(
  returns: DecimalInput[],
  riskFreeRate: DecimalInput = 0,
  periodsPerYear: number = 252
): Decimal {
  if (returns.length === 0) return new Decimal(0);

  const avgReturn = mean(returns);
  const std = stdDev(returns);

  if (std.isZero()) return new Decimal(0);

  const rf = toDecimal(riskFreeRate).dividedBy(periodsPerYear);
  const excessReturn = avgReturn.minus(rf);
  const annualizationFactor = new Decimal(periodsPerYear).sqrt();

  return excessReturn.dividedBy(std).times(annualizationFactor);
}

/**
 * Calculates Z-score for mean reversion strategies.
 *
 * Z-score measures how many standard deviations a value is from the mean.
 * Formula: z = (value - mean) / stdDev
 *
 * Typical interpretation:
 * - z > 2: Significantly above mean (potential sell signal)
 * - z < -2: Significantly below mean (potential buy signal)
 * - -1 < z < 1: Within normal range
 *
 * @param value - Current value to evaluate
 * @param avg - Mean/average value
 * @param std - Standard deviation
 * @returns Z-score (returns 0 if stdDev is 0)
 *
 * @example
 * ```typescript
 * // Price at $105, mean $100, stdDev $2
 * // z = (105 - 100) / 2 = 2.5 (overbought)
 * zScore('105', '100', '2')              // Decimal(2.5)
 *
 * // Price at $95, mean $100, stdDev $2
 * // z = (95 - 100) / 2 = -2.5 (oversold)
 * zScore('95', '100', '2')               // Decimal(-2.5)
 *
 * // Price at mean
 * zScore('100', '100', '2')              // Decimal(0)
 *
 * // Pairs trading example
 * // Spread = $5, historical mean = $2, stdDev = $1
 * zScore('5', '2', '1')                  // Decimal(3) - extreme divergence
 *
 * // Zero stdDev returns 0
 * zScore('105', '100', '0')              // Decimal(0)
 * ```
 */
export function zScore(value: DecimalInput, avg: DecimalInput, std: DecimalInput): Decimal {
  const s = toDecimal(std);
  if (s.isZero()) return new Decimal(0);
  return toDecimal(value).minus(toDecimal(avg)).dividedBy(s);
}

// ============================================================================
// COMPARISON HELPERS
// ============================================================================

/**
 * Returns the larger of two values.
 *
 * Safe comparison that handles all DecimalInput types.
 *
 * @param a - First value
 * @param b - Second value
 * @returns The larger value
 *
 * @example
 * ```typescript
 * // Compare prices
 * max('100', '105')                      // Decimal(105)
 * max('105', '100')                      // Decimal(105)
 *
 * // Compare P&L
 * max('-50', '100')                      // Decimal(100)
 *
 * // Equal values
 * max('100', '100')                      // Decimal(100)
 *
 * // Use for stop loss (take the higher stop price)
 * const currentStop = max(originalStop, trailingStop);
 * ```
 */
export function max(a: DecimalInput, b: DecimalInput): Decimal {
  return Decimal.max(toDecimal(a), toDecimal(b));
}

/**
 * Returns the smaller of two values.
 *
 * Safe comparison that handles all DecimalInput types.
 *
 * @param a - First value
 * @param b - Second value
 * @returns The smaller value
 *
 * @example
 * ```typescript
 * // Compare prices
 * min('100', '105')                      // Decimal(100)
 * min('105', '100')                      // Decimal(100)
 *
 * // Compare fees
 * min('10', '5')                         // Decimal(5)
 *
 * // Equal values
 * min('100', '100')                      // Decimal(100)
 *
 * // Use for best execution price
 * const bestPrice = min(broker1Price, broker2Price);
 * ```
 */
export function min(a: DecimalInput, b: DecimalInput): Decimal {
  return Decimal.min(toDecimal(a), toDecimal(b));
}

/**
 * Clamps a value between a minimum and maximum bound.
 *
 * If value < min, returns min.
 * If value > max, returns max.
 * Otherwise returns value.
 *
 * Useful for enforcing limits on position sizes, prices, or percentages.
 *
 * @param value - Value to clamp
 * @param minVal - Minimum bound
 * @param maxVal - Maximum bound
 * @returns Clamped value
 *
 * @example
 * ```typescript
 * // Clamp position size between $1,000 and $10,000
 * clamp('15000', '1000', '10000')        // Decimal(10000) - capped at max
 * clamp('500', '1000', '10000')          // Decimal(1000) - raised to min
 * clamp('5000', '1000', '10000')         // Decimal(5000) - within range
 *
 * // Clamp percentage between 0% and 100%
 * clamp('150', '0', '100')               // Decimal(100)
 * clamp('-10', '0', '100')               // Decimal(0)
 *
 * // Clamp price within reasonable bounds
 * clamp(userPrice, '0.01', '999999')
 * ```
 */
export function clamp(value: DecimalInput, minVal: DecimalInput, maxVal: DecimalInput): Decimal {
  return Decimal.max(toDecimal(minVal), Decimal.min(toDecimal(value), toDecimal(maxVal)));
}

/**
 * Checks if a value is positive (greater than zero).
 *
 * @param value - Value to check
 * @returns True if value > 0, false otherwise
 *
 * @example
 * ```typescript
 * // Check profits
 * isPositive('100')                      // true
 * isPositive('0.01')                     // true
 *
 * // Check losses
 * isPositive('-100')                     // false
 * isPositive('0')                        // false
 *
 * // Validate position quantities
 * if (isPositive(quantity)) {
 *   // Execute trade
 * }
 *
 * // Check P&L
 * const pnl = calculatePnL(entry, exit, qty, 'long');
 * const isProfitable = isPositive(pnl);
 * ```
 */
export function isPositive(value: DecimalInput): boolean {
  return toDecimal(value).isPositive();
}

/**
 * Checks if a value is exactly zero.
 *
 * @param value - Value to check
 * @returns True if value equals 0, false otherwise
 *
 * @example
 * ```typescript
 * // Check for zero
 * isZero('0')                            // true
 * isZero('0.00')                         // true
 *
 * // Non-zero values
 * isZero('0.01')                         // false
 * isZero('-0.01')                        // false
 *
 * // Check for no position
 * if (isZero(quantity)) {
 *   // No position held
 * }
 *
 * // Avoid division by zero
 * if (!isZero(price)) {
 *   const qty = notional.dividedBy(price);
 * }
 *
 * // Check breakeven
 * const pnl = calculatePnL(entry, exit, qty, 'long');
 * if (isZero(pnl)) {
 *   // Breakeven trade
 * }
 * ```
 */
export function isZero(value: DecimalInput): boolean {
  return toDecimal(value).isZero();
}
