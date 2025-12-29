/**
 * Money utility module using Decimal.js for precise financial calculations.
 * CRITICAL: All monetary calculations in the trading platform should use these functions
 * to avoid floating-point precision errors.
 *
 * @module money
 */

import Decimal from "decimal.js";

// Configure Decimal.js for financial calculations
Decimal.set({
  precision: 20,        // High precision for intermediate calculations
  rounding: Decimal.ROUND_HALF_UP,  // Standard financial rounding
  toExpNeg: -9,         // Don't use exponential notation for small numbers
  toExpPos: 21,         // Don't use exponential notation for large numbers
});

// Re-export Decimal for direct use when needed
export { Decimal };

// Type for values that can be converted to Decimal
export type DecimalInput = string | number | Decimal | null | undefined;

/**
 * Safely converts any input to a Decimal, returning a default value for invalid inputs.
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
 * Converts a Decimal to a number. Use sparingly - prefer keeping values as Decimal.
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
 */
export function priceDiff(price1: DecimalInput, price2: DecimalInput): Decimal {
  return toDecimal(price1).minus(toDecimal(price2));
}

/**
 * Adds a price buffer (e.g., for limit orders in extended hours).
 * @param price Base price
 * @param bufferPercent Buffer as a decimal (e.g., 0.005 for 0.5%)
 * @param direction 1 for add (buy buffer), -1 for subtract (sell buffer)
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
 * Rounds a price to standard 2 decimal places for display/orders.
 */
export function roundPrice(price: DecimalInput, decimals: number = 2): Decimal {
  return toDecimal(price).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

/**
 * Formats a price for display.
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
 * Calculates quantity from notional value and price.
 * quantity = notional / price
 */
export function calculateQuantity(notional: DecimalInput, price: DecimalInput): Decimal {
  const p = toDecimal(price);
  if (p.isZero()) return new Decimal(0);
  return toDecimal(notional).dividedBy(p);
}

/**
 * Calculates whole share quantity (floors the result).
 */
export function calculateWholeShares(notional: DecimalInput, price: DecimalInput): Decimal {
  return calculateQuantity(notional, price).floor();
}

/**
 * Calculates partial quantity (e.g., for partial closes).
 * @param quantity Total quantity
 * @param percent Percentage to calculate (as whole number, e.g., 50 for 50%)
 */
export function partialQuantity(quantity: DecimalInput, percent: DecimalInput): Decimal {
  return toDecimal(quantity).times(toDecimal(percent)).dividedBy(100);
}

/**
 * Formats quantity for display.
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
 * Calculates realized P&L for a trade.
 * Long: (exitPrice - entryPrice) * quantity
 * Short: (entryPrice - exitPrice) * quantity
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
 * Calculates percentage change between two values.
 * Returns result as percentage (e.g., 5 for 5%, not 0.05)
 */
export function percentChange(current: DecimalInput, previous: DecimalInput): Decimal {
  const prev = toDecimal(previous);
  if (prev.isZero()) return new Decimal(0);

  const curr = toDecimal(current);
  return curr.minus(prev).dividedBy(prev).times(100);
}

/**
 * Calculates percentage change as a number.
 */
export function percentChangeNumber(current: DecimalInput, previous: DecimalInput): number {
  return percentChange(current, previous).toNumber();
}

/**
 * Formats a percentage for display.
 */
export function formatPercent(value: DecimalInput, decimals: number = 2): string {
  const d = toDecimal(value);
  if (!d.isFinite()) return "0.00%";
  return `${d.toFixed(decimals)}%`;
}

/**
 * Calculates a percentage of a value.
 * @param value The base value
 * @param percent The percentage (as whole number, e.g., 5 for 5%)
 */
export function percentOf(value: DecimalInput, percent: DecimalInput): Decimal {
  return toDecimal(value).times(toDecimal(percent)).dividedBy(100);
}

// ============================================================================
// POSITION VALUE CALCULATIONS
// ============================================================================

/**
 * Calculates notional/market value of a position.
 * value = quantity * price
 */
export function positionValue(quantity: DecimalInput, price: DecimalInput): Decimal {
  return toDecimal(quantity).times(toDecimal(price));
}

/**
 * Calculates cost basis.
 * costBasis = quantity * avgEntryPrice
 */
export function costBasis(quantity: DecimalInput, avgEntryPrice: DecimalInput): Decimal {
  return toDecimal(quantity).times(toDecimal(avgEntryPrice));
}

/**
 * Calculates unrealized P&L for a position.
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
 * Calculates unrealized P&L percentage.
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
 * Calculates portfolio allocation percentage.
 * @param positionValue Value of the position
 * @param portfolioValue Total portfolio value
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
 * Calculates total equity from cash and positions.
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
 * Calculates slippage amount.
 * @param price Base price
 * @param slippageBps Slippage in basis points (1 bp = 0.01%)
 * @param side Trade side (buy adds slippage, sell subtracts)
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
 * Calculates execution price including slippage.
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
 */
export function calculateFeePercent(notional: DecimalInput, feePercent: DecimalInput): Decimal {
  return toDecimal(notional).times(toDecimal(feePercent)).dividedBy(100);
}

/**
 * Calculates total trade cost (notional + fees).
 */
export function totalTradeCost(notional: DecimalInput, fees: DecimalInput): Decimal {
  return toDecimal(notional).plus(toDecimal(fees));
}

// ============================================================================
// RISK CALCULATIONS
// ============================================================================

/**
 * Calculates stop loss price.
 * @param entryPrice Entry price
 * @param stopPercent Stop loss percentage (e.g., 2 for 2%)
 * @param side Position side (long stops below entry, short stops above)
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
 * Calculates take profit price.
 * @param entryPrice Entry price
 * @param profitPercent Take profit percentage (e.g., 5 for 5%)
 * @param side Position side (long profits above entry, short profits below)
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
 * Calculates trailing stop price based on high water mark.
 * @param highWaterMark Highest price since entry
 * @param trailPercent Trailing percentage (e.g., 5 for 5%)
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
 * Calculates Kelly Criterion for position sizing.
 * Kelly = (winRate * avgWin - lossRate * avgLoss) / avgWin
 * @returns Kelly fraction (0 to 1)
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
 * Calculates suggested position size using Kelly with fractional Kelly adjustment.
 * @param portfolioValue Total portfolio value
 * @param kellyFrac Raw Kelly fraction
 * @param fraction Fractional Kelly multiplier (e.g., 0.25 for quarter Kelly)
 * @param maxPercent Maximum position size as percentage
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
 * Calculates mean of an array of values.
 */
export function mean(values: DecimalInput[]): Decimal {
  if (values.length === 0) return new Decimal(0);
  const sum = values.reduce((acc: Decimal, v) => acc.plus(toDecimal(v)), new Decimal(0));
  return sum.dividedBy(values.length);
}

/**
 * Calculates variance of an array of values.
 */
export function variance(values: DecimalInput[]): Decimal {
  if (values.length < 2) return new Decimal(0);
  const avg = mean(values);
  const squaredDiffs = values.map(v => toDecimal(v).minus(avg).pow(2));
  return mean(squaredDiffs);
}

/**
 * Calculates standard deviation of an array of values.
 */
export function stdDev(values: DecimalInput[]): Decimal {
  return variance(values).sqrt();
}

/**
 * Calculates Sharpe ratio.
 * @param returns Array of period returns
 * @param riskFreeRate Risk-free rate (annualized, as decimal)
 * @param periodsPerYear Number of periods per year (252 for daily)
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
 * z = (value - mean) / stdDev
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
 */
export function max(a: DecimalInput, b: DecimalInput): Decimal {
  return Decimal.max(toDecimal(a), toDecimal(b));
}

/**
 * Returns the smaller of two values.
 */
export function min(a: DecimalInput, b: DecimalInput): Decimal {
  return Decimal.min(toDecimal(a), toDecimal(b));
}

/**
 * Clamps a value between min and max.
 */
export function clamp(value: DecimalInput, minVal: DecimalInput, maxVal: DecimalInput): Decimal {
  return Decimal.max(toDecimal(minVal), Decimal.min(toDecimal(value), toDecimal(maxVal)));
}

/**
 * Checks if a value is positive.
 */
export function isPositive(value: DecimalInput): boolean {
  return toDecimal(value).isPositive();
}

/**
 * Checks if a value is zero.
 */
export function isZero(value: DecimalInput): boolean {
  return toDecimal(value).isZero();
}
