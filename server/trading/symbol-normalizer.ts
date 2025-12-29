/**
 * Symbol Normalization Utilities
 *
 * Handles normalization and detection of trading symbols for both stocks and cryptocurrencies.
 * Alpaca requires different symbol formats for different operations:
 * - Crypto orders: BTC/USD (with slash)
 * - Stock orders: AAPL (uppercase)
 * - Position lookups: BTCUSD (no slash for crypto), AAPL (uppercase for stocks)
 *
 * This module ensures symbols are correctly formatted for each Alpaca API operation.
 *
 * @module symbol-normalizer
 */

/**
 * Default watchlist of symbols to monitor
 * Includes major tech stocks and popular cryptocurrencies
 */
const DEFAULT_WATCHLIST = [
  "AAPL",
  "GOOGL",
  "MSFT",
  "AMZN",
  "TSLA",
  "NVDA",
  "META",
  "JPM",
  "V",
  "UNH",
  "BTC/USD",
  "ETH/USD",
  "SOL/USD",
];

/**
 * Determines if a symbol represents a cryptocurrency pair
 *
 * Checks against known crypto pairs on Alpaca and identifies crypto symbols
 * by the presence of a slash (/) and USD suffix. Supports both formats:
 * - Slash format: BTC/USD, ETH/USD
 * - No-slash format: BTCUSD, ETHUSD
 *
 * @param symbol - The symbol to check (case-insensitive)
 * @returns True if the symbol is a cryptocurrency pair
 *
 * @example
 * ```typescript
 * isCryptoSymbol("BTC/USD")  // true
 * isCryptoSymbol("BTCUSD")   // true
 * isCryptoSymbol("AAPL")     // false
 * isCryptoSymbol("eth/usd")  // true (case-insensitive)
 * ```
 */
export function isCryptoSymbol(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase();
  // Common crypto pairs on Alpaca
  const cryptoPairs = [
    "BTC/USD",
    "ETH/USD",
    "SOL/USD",
    "DOGE/USD",
    "SHIB/USD",
    "AVAX/USD",
    "DOT/USD",
    "LINK/USD",
    "UNI/USD",
    "AAVE/USD",
    "LTC/USD",
    "BCH/USD",
    "BTCUSD",
    "ETHUSD",
    "SOLUSD",
    "DOGEUSD",
    "SHIBUSD",
    "AVAXUSD",
    "DOTUSD",
    "LINKUSD",
    "UNIUSD",
    "AAVEUSD",
    "LTCUSD",
    "BCHUSD",
  ];
  // Check if it's a known crypto pair or contains a slash (crypto format)
  return (
    cryptoPairs.includes(upperSymbol) ||
    (symbol.includes("/") && upperSymbol.endsWith("USD"))
  );
}

/**
 * Normalizes a symbol for use with Alpaca API
 *
 * Alpaca requires different symbol formats depending on the operation:
 * - Crypto orders: Must use slash format (BTC/USD)
 * - Stock orders: Uppercase without slash (AAPL)
 * - Position lookups: No slash for both (BTCUSD, AAPL)
 *
 * @param symbol - The symbol to normalize
 * @param forOrder - Whether this symbol will be used in an order request (default: false)
 * @returns Normalized symbol in the correct format for Alpaca
 *
 * @example
 * ```typescript
 * // For orders
 * normalizeSymbolForAlpaca("btc/usd", true)   // "BTC/USD"
 * normalizeSymbolForAlpaca("aapl", true)      // "AAPL"
 *
 * // For position lookups
 * normalizeSymbolForAlpaca("BTC/USD", false)  // "BTCUSD"
 * normalizeSymbolForAlpaca("AAPL", false)     // "AAPL"
 * ```
 */
export function normalizeSymbolForAlpaca(
  symbol: string,
  forOrder: boolean = false
): string {
  // For crypto orders, Alpaca requires the slash format (e.g., BTC/USD)
  // For stock orders and position lookups, use uppercase without slash
  if (forOrder && isCryptoSymbol(symbol)) {
    return normalizeCryptoSymbol(symbol);
  }
  return symbol.replace("/", "").toUpperCase();
}

/**
 * Normalizes a cryptocurrency symbol to slash format
 *
 * Converts various cryptocurrency symbol formats to the standard slash format
 * required by Alpaca for crypto orders (e.g., BTC/USD).
 *
 * Handles:
 * - Already formatted symbols: BTC/USD -> BTC/USD
 * - No-slash format: BTCUSD -> BTC/USD
 * - Generic USD pairs: XYZUSD -> XYZ/USD
 *
 * @param symbol - The cryptocurrency symbol to normalize
 * @returns Symbol in slash format (BASE/USD)
 *
 * @example
 * ```typescript
 * normalizeCryptoSymbol("BTCUSD")    // "BTC/USD"
 * normalizeCryptoSymbol("btc/usd")   // "BTC/USD"
 * normalizeCryptoSymbol("ethusd")    // "ETH/USD"
 * normalizeCryptoSymbol("DOGEUSD")   // "DOGE/USD"
 * ```
 */
export function normalizeCryptoSymbol(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();
  if (upperSymbol.includes("/")) {
    return upperSymbol;
  }
  if (upperSymbol === "BTCUSD") return "BTC/USD";
  if (upperSymbol === "ETHUSD") return "ETH/USD";
  if (upperSymbol === "SOLUSD") return "SOL/USD";
  if (upperSymbol.endsWith("USD") && upperSymbol.length > 3) {
    const base = upperSymbol.slice(0, -3);
    return `${base}/USD`;
  }
  return upperSymbol;
}

/**
 * Returns the default watchlist of symbols
 *
 * Provides a curated list of major stocks and cryptocurrencies to monitor.
 * Useful for initializing the trading system with a default set of assets.
 *
 * @returns Array of symbol strings
 *
 * @example
 * ```typescript
 * const watchlist = getDefaultWatchlist();
 * // ["AAPL", "GOOGL", "MSFT", ..., "BTC/USD", "ETH/USD", "SOL/USD"]
 * ```
 */
export function getDefaultWatchlist(): string[] {
  return DEFAULT_WATCHLIST;
}
