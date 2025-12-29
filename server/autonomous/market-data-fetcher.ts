/**
 * @file Market Data Fetcher - Unified Market Data Collection
 *
 * Intelligent market data fetching system with multi-source fallback chains to ensure
 * reliable data collection even when primary sources fail. Optimized for batch operations
 * with chunking to handle large universes efficiently.
 *
 * @module autonomous/market-data-fetcher
 *
 * @fallback-chains
 *
 * STOCKS: Alpaca → Finnhub
 * 1. PRIMARY: Alpaca Batch Snapshots
 *    - Fast batch fetching (50 symbols per chunk)
 *    - Chunked to avoid URL length limits
 *    - Provides: price, daily bar, prev close
 *    - Advantage: Official broker data, batch optimized
 *
 * 2. FALLBACK: Finnhub
 *    - Individual symbol quotes
 *    - Triggered for symbols missing from Alpaca
 *    - Limited to 30 symbols max (rate limits)
 *    - Provides: current price, high/low, volume
 *
 * CRYPTO: Alpaca → CoinGecko
 * 1. PRIMARY: Alpaca Crypto Snapshots
 *    - Official broker crypto data
 *    - Supports fractional crypto trading
 *    - Provides: price, daily bar, volume
 *
 * 2. FALLBACK: CoinGecko
 *    - Free crypto market data API
 *    - Provides: price, 24h change, volume, market cap
 *    - More comprehensive crypto metrics
 *
 * @data-normalization
 * All sources are normalized to MarketData format:
 * - symbol: normalized symbol (BTC not BTC/USD)
 * - currentPrice: current trading price
 * - priceChange24h: absolute 24h change
 * - priceChangePercent24h: percentage 24h change
 * - high24h, low24h, volume: optional metrics
 *
 * @example
 * ```typescript
 * const universe = await getAnalysisUniverseSymbols();
 * const marketData = await fetchMarketData(universe);
 *
 * for (const [symbol, data] of marketData) {
 *   console.log(`${symbol}: $${data.currentPrice} (${data.priceChangePercent24h.toFixed(2)}%)`);
 * }
 *
 * // Fetch single symbol
 * const btcData = await fetchSingleSymbolData('BTC', true);
 * if (btcData) {
 *   console.log(`BTC: $${btcData.currentPrice}`);
 * }
 * ```
 */

import { alpaca } from "../connectors/alpaca";
import { finnhub } from "../connectors/finnhub";
import { coingecko } from "../connectors/coingecko";
import { log } from "../utils/logger";
import { normalizeCryptoSymbol } from "../trading/crypto-trading-config";
import { MarketData } from "../ai/decision-engine";
import { tradingConfig } from "../config/trading-config";
import { UniverseSymbols } from "./universe-builder";

const ALPACA_SNAPSHOT_CHUNK_SIZE =
  tradingConfig.universe.alpacaSnapshotChunkSize;

/**
 * Fetch market data for the given universe of symbols
 *
 * Primary market data fetching function that orchestrates batch data collection
 * for the entire analysis universe with intelligent fallback handling.
 *
 * @async
 * @param {UniverseSymbols} universe - Universe containing stocks and crypto to fetch
 * @returns {Promise<Map<string, MarketData>>} Map of symbol to market data
 *
 * @fetching-strategy
 * STOCKS:
 * 1. Batch fetch via Alpaca snapshots (chunked into groups of 50)
 * 2. For missing symbols: fallback to Finnhub (max 30 symbols)
 * 3. Calculate 24h change from prevDailyBar
 *
 * CRYPTO:
 * 1. Batch fetch via Alpaca crypto snapshots
 * 2. On failure: fallback to CoinGecko markets API
 * 3. Normalize symbols (remove /USD suffix)
 *
 * @performance
 * - Chunking prevents URL length errors with large universes
 * - Batch fetching is much faster than sequential API calls
 * - Fallback only triggers for missing data, not all symbols
 *
 * @example
 * ```typescript
 * const universe = await getAnalysisUniverseSymbols();
 * const marketData = await fetchMarketData(universe);
 *
 * console.log(`Fetched data for ${marketData.size} symbols`);
 * // Fetched data for 58 symbols (48 stocks, 10 crypto)
 * ```
 */
export async function fetchMarketData(
  universe: UniverseSymbols
): Promise<Map<string, MarketData>> {
  const marketData = new Map<string, MarketData>();

  // Fetch stock data using Alpaca batch snapshots (faster than sequential Finnhub)
  try {
    const fetchedFromAlpaca = new Set<string>();

    // Chunk requests to avoid URL length issues
    for (
      let i = 0;
      i < universe.stocks.length;
      i += ALPACA_SNAPSHOT_CHUNK_SIZE
    ) {
      const chunk = universe.stocks.slice(i, i + ALPACA_SNAPSHOT_CHUNK_SIZE);
      try {
        const snapshots = await alpaca.getSnapshots(chunk);
        for (const [symbol, snapshot] of Object.entries(snapshots)) {
          if (snapshot?.latestTrade?.p || snapshot?.dailyBar?.c) {
            const price = snapshot.latestTrade?.p || snapshot.dailyBar?.c || 0;
            const prevClose = snapshot.prevDailyBar?.c || price;
            const change = price - prevClose;
            const changePercent =
              prevClose > 0 ? (change / prevClose) * 100 : 0;

            marketData.set(symbol, {
              symbol,
              currentPrice: price,
              priceChange24h: change,
              priceChangePercent24h: changePercent,
              high24h: snapshot.dailyBar?.h,
              low24h: snapshot.dailyBar?.l,
              volume: snapshot.dailyBar?.v,
            });
            fetchedFromAlpaca.add(symbol);
          }
        }
      } catch (chunkError) {
        log.warn(
          "MarketDataFetcher",
          `Alpaca snapshot chunk failed, will use Finnhub fallback`,
          {
            chunkStart: i,
            error: String(chunkError),
          }
        );
      }
    }

    // Fallback to Finnhub for symbols missing from Alpaca
    const missingSymbols = universe.stocks.filter(
      (s) => !fetchedFromAlpaca.has(s)
    );
    if (missingSymbols.length > 0 && missingSymbols.length <= 30) {
      try {
        const finnhubPrices = await finnhub.getMultipleQuotes(missingSymbols);
        for (const [symbol, quote] of finnhubPrices.entries()) {
          if (quote.c > 0) {
            marketData.set(symbol, {
              symbol,
              currentPrice: quote.c,
              priceChange24h: quote.d,
              priceChangePercent24h: quote.dp,
              high24h: quote.h,
              low24h: quote.l,
            });
          }
        }
        log.info(
          "MarketDataFetcher",
          `Finnhub fallback fetched ${finnhubPrices.size}/${missingSymbols.length} symbols`
        );
      } catch (finnhubError) {
        log.warn("MarketDataFetcher", `Finnhub fallback also failed`, {
          error: String(finnhubError),
        });
      }
    }

    log.info(
      "MarketDataFetcher",
      `Stock data fetched: ${marketData.size}/${universe.stocks.length} symbols via Alpaca+Finnhub`
    );
  } catch (error) {
    log.error("MarketDataFetcher", "Failed to fetch stock data", {
      error: String(error),
    });
  }

  // Fetch crypto data - prefer Alpaca crypto snapshots
  try {
    const cryptoSymbols = universe.crypto.map((c) => normalizeCryptoSymbol(c));
    if (cryptoSymbols.length > 0) {
      try {
        const cryptoSnapshots = await alpaca.getCryptoSnapshots(cryptoSymbols);
        for (const [symbol, snapshot] of Object.entries(cryptoSnapshots)) {
          if (snapshot?.latestTrade?.p) {
            const price = snapshot.latestTrade.p;
            const prevClose = snapshot.prevDailyBar?.c || price;
            const change = price - prevClose;
            const changePercent =
              prevClose > 0 ? (change / prevClose) * 100 : 0;

            // Store with bare symbol (BTC) not pair (BTC/USD)
            const bareSymbol = symbol.replace("/USD", "").toUpperCase();
            marketData.set(bareSymbol, {
              symbol: bareSymbol,
              currentPrice: price,
              priceChange24h: change,
              priceChangePercent24h: changePercent,
              high24h: snapshot.dailyBar?.h,
              low24h: snapshot.dailyBar?.l,
              volume: snapshot.dailyBar?.v,
            });
          }
        }
        log.info(
          "MarketDataFetcher",
          `Crypto data fetched via Alpaca: ${Object.keys(cryptoSnapshots).length} symbols`
        );
      } catch (alpacaCryptoError) {
        // Fallback to CoinGecko
        log.warn(
          "MarketDataFetcher",
          "Alpaca crypto failed, falling back to CoinGecko",
          { error: String(alpacaCryptoError) }
        );
        const cryptoPrices = await coingecko.getMarkets();
        const watchedCrypto = cryptoPrices.filter((c) =>
          universe.crypto.includes(c.symbol.toUpperCase())
        );
        for (const price of watchedCrypto) {
          marketData.set(price.symbol.toUpperCase(), {
            symbol: price.symbol.toUpperCase(),
            currentPrice: price.current_price,
            priceChange24h: price.price_change_24h || 0,
            priceChangePercent24h: price.price_change_percentage_24h || 0,
            high24h: price.high_24h,
            low24h: price.low_24h,
            volume: price.total_volume,
            marketCap: price.market_cap,
          });
        }
      }
    }
  } catch (error) {
    log.error("MarketDataFetcher", "Failed to fetch crypto data", {
      error: String(error),
    });
  }

  return marketData;
}

/**
 * Fetch market data for a single symbol
 *
 * On-demand market data fetching for individual symbols. Useful for price checks,
 * position updates, or analyzing symbols outside the main universe.
 *
 * @async
 * @param {string} symbol - Symbol to fetch (e.g., 'AAPL', 'BTC')
 * @param {boolean} isCrypto - Whether symbol is cryptocurrency
 * @returns {Promise<MarketData | null>} Market data or null if fetch fails
 *
 * @fetching-logic
 * - Crypto: Uses Alpaca crypto snapshots with /USD normalization
 * - Stocks: Uses Alpaca stock snapshots
 * - Returns null on error rather than throwing
 *
 * @example
 * ```typescript
 * // Check current Bitcoin price
 * const btcData = await fetchSingleSymbolData('BTC', true);
 * if (btcData) {
 *   console.log(`BTC: $${btcData.currentPrice}`);
 * }
 *
 * // Check stock price
 * const aaplData = await fetchSingleSymbolData('AAPL', false);
 * if (aaplData) {
 *   console.log(`AAPL: $${aaplData.currentPrice} (${aaplData.priceChangePercent24h.toFixed(2)}%)`);
 * }
 * ```
 */
export async function fetchSingleSymbolData(
  symbol: string,
  isCrypto: boolean
): Promise<MarketData | null> {
  try {
    if (isCrypto) {
      const normalizedSymbol = normalizeCryptoSymbol(symbol);
      const snapshots = await alpaca.getCryptoSnapshots([normalizedSymbol]);
      const snapshot = snapshots[normalizedSymbol];

      if (snapshot?.latestTrade?.p) {
        const price = snapshot.latestTrade.p;
        const prevClose = snapshot.prevDailyBar?.c || price;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
        const bareSymbol = symbol.replace("/USD", "").toUpperCase();

        return {
          symbol: bareSymbol,
          currentPrice: price,
          priceChange24h: change,
          priceChangePercent24h: changePercent,
          high24h: snapshot.dailyBar?.h,
          low24h: snapshot.dailyBar?.l,
          volume: snapshot.dailyBar?.v,
        };
      }
    } else {
      const snapshots = await alpaca.getSnapshots([symbol.toUpperCase()]);
      const snapshot = snapshots[symbol.toUpperCase()];

      if (snapshot?.latestTrade?.p || snapshot?.dailyBar?.c) {
        const price = snapshot.latestTrade?.p || snapshot.dailyBar?.c || 0;
        const prevClose = snapshot.prevDailyBar?.c || price;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        return {
          symbol: symbol.toUpperCase(),
          currentPrice: price,
          priceChange24h: change,
          priceChangePercent24h: changePercent,
          high24h: snapshot.dailyBar?.h,
          low24h: snapshot.dailyBar?.l,
          volume: snapshot.dailyBar?.v,
        };
      }
    }
  } catch (error) {
    log.warn(
      "MarketDataFetcher",
      `Failed to fetch single symbol data for ${symbol}`,
      { error: String(error) }
    );
  }

  return null;
}
