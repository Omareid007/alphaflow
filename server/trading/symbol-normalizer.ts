const DEFAULT_WATCHLIST = [
  "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "UNH",
  "BTC/USD", "ETH/USD", "SOL/USD"
];

export function isCryptoSymbol(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase();
  // Common crypto pairs on Alpaca
  const cryptoPairs = [
    "BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD", "SHIB/USD", "AVAX/USD",
    "DOT/USD", "LINK/USD", "UNI/USD", "AAVE/USD", "LTC/USD", "BCH/USD",
    "BTCUSD", "ETHUSD", "SOLUSD", "DOGEUSD", "SHIBUSD", "AVAXUSD",
    "DOTUSD", "LINKUSD", "UNIUSD", "AAVEUSD", "LTCUSD", "BCHUSD"
  ];
  // Check if it's a known crypto pair or contains a slash (crypto format)
  return cryptoPairs.includes(upperSymbol) ||
         (symbol.includes("/") && upperSymbol.endsWith("USD"));
}

export function normalizeSymbolForAlpaca(symbol: string, forOrder: boolean = false): string {
  // For crypto orders, Alpaca requires the slash format (e.g., BTC/USD)
  // For stock orders and position lookups, use uppercase without slash
  if (forOrder && isCryptoSymbol(symbol)) {
    return normalizeCryptoSymbol(symbol);
  }
  return symbol.replace("/", "").toUpperCase();
}

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

export function getDefaultWatchlist(): string[] {
  return DEFAULT_WATCHLIST;
}
