/**
 * Alpaca API Utilities
 * Consolidated from omar-backtest*.ts scripts
 */

import type { AlpacaBar } from "./types.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALPACA_DATA_URL = "https://data.alpaca.markets/v2";
const DEFAULT_RATE_LIMIT_MS = 250;

export interface AlpacaConfig {
  apiKey?: string;
  secretKey?: string;
  rateLimitMs?: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch historical bars from Alpaca API with pagination
 */
export async function fetchAlpacaBars(
  symbol: string,
  startDate: string,
  endDate: string,
  timeframe: string = "1Day",
  config?: AlpacaConfig
): Promise<AlpacaBar[]> {
  const apiKey = config?.apiKey || process.env.ALPACA_API_KEY;
  const secretKey = config?.secretKey || process.env.ALPACA_SECRET_KEY;
  const rateLimitMs = config?.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;

  if (!apiKey || !secretKey) {
    throw new Error("ALPACA_API_KEY and ALPACA_SECRET_KEY required");
  }

  const bars: AlpacaBar[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      start: startDate,
      end: endDate,
      timeframe,
      limit: "1000",
    });
    if (pageToken) params.set("page_token", pageToken);

    const url = `${ALPACA_DATA_URL}/stocks/${symbol}/bars?${params}`;

    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": apiKey,
        "APCA-API-SECRET-KEY": secretKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Error fetching ${symbol}: ${response.status} - ${error}`);
      break;
    }

    const data = await response.json();
    if (data.bars) {
      bars.push(...data.bars);
    }
    pageToken = data.next_page_token;

    // Rate limiting
    if (rateLimitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, rateLimitMs));
    }
  } while (pageToken);

  return bars;
}

/**
 * Fetch historical data for multiple symbols
 */
export async function fetchHistoricalData(
  symbols: string[],
  startDate: string,
  endDate: string,
  config?: AlpacaConfig,
  onProgress?: (symbol: string, count: number) => void
): Promise<Map<string, AlpacaBar[]>> {
  const dataMap = new Map<string, AlpacaBar[]>();

  for (const symbol of symbols) {
    console.log(`Fetching ${symbol}...`);
    try {
      const bars = await fetchAlpacaBars(symbol, startDate, endDate, "1Day", config);
      if (bars.length > 0) {
        dataMap.set(symbol, bars);
        if (onProgress) {
          onProgress(symbol, bars.length);
        } else {
          console.log(`  ${symbol}: ${bars.length} bars`);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${symbol}:`, error);
    }
  }

  return dataMap;
}

/**
 * Extract OHLCV arrays from bars
 */
export function extractOHLCV(bars: AlpacaBar[]): {
  dates: string[];
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
} {
  return {
    dates: bars.map(b => b.t.split("T")[0]),
    opens: bars.map(b => b.o),
    highs: bars.map(b => b.h),
    lows: bars.map(b => b.l),
    closes: bars.map(b => b.c),
    volumes: bars.map(b => b.v),
  };
}

// ============================================================================
// SYMBOL LISTS
// ============================================================================

export const SYMBOL_LISTS = {
  // Tech giants
  techGiants: ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"],

  // Semiconductors
  semiconductors: ["NVDA", "AMD", "INTC", "AVGO", "QCOM", "MU", "AMAT", "LRCX"],

  // ETFs
  etfs: ["SPY", "QQQ", "IWM", "DIA", "VOO", "VTI"],

  // Default backtest universe
  default: ["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA", "META", "AMZN", "AMD", "SPY", "QQQ"],

  // Extended universe
  extended: [
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "AMD",
    "AVGO", "CRM", "ADBE", "ORCL", "INTC", "QCOM", "TXN",
    "SPY", "QQQ", "IWM", "DIA"
  ],

  // Large universe for comprehensive testing
  large: [
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "AMD",
    "AVGO", "CRM", "ADBE", "ORCL", "INTC", "QCOM", "TXN", "MU",
    "AMAT", "LRCX", "KLAC", "SNPS", "CDNS", "NFLX", "PYPL", "SQ",
    "SHOP", "COIN", "UBER", "ABNB", "DASH", "PLTR",
    "SPY", "QQQ", "IWM", "DIA", "VOO", "VTI", "XLK", "XLF", "XLE", "XLV"
  ]
};
