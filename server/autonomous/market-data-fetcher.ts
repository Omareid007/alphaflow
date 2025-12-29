/**
 * Market Data Fetcher - Unified Market Data Collection
 *
 * Fetches market data from multiple sources with fallback logic:
 * - Alpaca snapshots for stocks (chunked to avoid URL length issues)
 * - Finnhub as fallback for stocks missing from Alpaca
 * - Alpaca crypto snapshots for cryptocurrency
 * - CoinGecko as fallback for crypto
 *
 * Returns unified MarketData format for the decision engine.
 */

import { alpaca } from "../connectors/alpaca";
import { finnhub } from "../connectors/finnhub";
import { coingecko } from "../connectors/coingecko";
import { log } from "../utils/logger";
import { normalizeCryptoSymbol } from "../trading/crypto-trading-config";
import { MarketData } from "../ai/decision-engine";
import { tradingConfig } from "../config/trading-config";
import { UniverseSymbols } from "./universe-builder";

const ALPACA_SNAPSHOT_CHUNK_SIZE = tradingConfig.universe.alpacaSnapshotChunkSize;

/**
 * Fetch market data for the given universe of symbols
 * Uses Alpaca as primary source with Finnhub/CoinGecko fallbacks
 */
export async function fetchMarketData(
  universe: UniverseSymbols
): Promise<Map<string, MarketData>> {
  const marketData = new Map<string, MarketData>();

  // Fetch stock data using Alpaca batch snapshots (faster than sequential Finnhub)
  try {
    const fetchedFromAlpaca = new Set<string>();

    // Chunk requests to avoid URL length issues
    for (let i = 0; i < universe.stocks.length; i += ALPACA_SNAPSHOT_CHUNK_SIZE) {
      const chunk = universe.stocks.slice(i, i + ALPACA_SNAPSHOT_CHUNK_SIZE);
      try {
        const snapshots = await alpaca.getSnapshots(chunk);
        for (const [symbol, snapshot] of Object.entries(snapshots)) {
          if (snapshot?.latestTrade?.p || snapshot?.dailyBar?.c) {
            const price = snapshot.latestTrade?.p || snapshot.dailyBar?.c || 0;
            const prevClose = snapshot.prevDailyBar?.c || price;
            const change = price - prevClose;
            const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

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
        log.warn("MarketDataFetcher", `Alpaca snapshot chunk failed, will use Finnhub fallback`, {
          chunkStart: i,
          error: String(chunkError)
        });
      }
    }

    // Fallback to Finnhub for symbols missing from Alpaca
    const missingSymbols = universe.stocks.filter(s => !fetchedFromAlpaca.has(s));
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
        log.info("MarketDataFetcher", `Finnhub fallback fetched ${finnhubPrices.size}/${missingSymbols.length} symbols`);
      } catch (finnhubError) {
        log.warn("MarketDataFetcher", `Finnhub fallback also failed`, { error: String(finnhubError) });
      }
    }

    log.info("MarketDataFetcher", `Stock data fetched: ${marketData.size}/${universe.stocks.length} symbols via Alpaca+Finnhub`);
  } catch (error) {
    log.error("MarketDataFetcher", "Failed to fetch stock data", { error: String(error) });
  }

  // Fetch crypto data - prefer Alpaca crypto snapshots
  try {
    const cryptoSymbols = universe.crypto.map(c => normalizeCryptoSymbol(c));
    if (cryptoSymbols.length > 0) {
      try {
        const cryptoSnapshots = await alpaca.getCryptoSnapshots(cryptoSymbols);
        for (const [symbol, snapshot] of Object.entries(cryptoSnapshots)) {
          if (snapshot?.latestTrade?.p) {
            const price = snapshot.latestTrade.p;
            const prevClose = snapshot.prevDailyBar?.c || price;
            const change = price - prevClose;
            const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

            // Store with bare symbol (BTC) not pair (BTC/USD)
            const bareSymbol = symbol.replace('/USD', '').toUpperCase();
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
        log.info("MarketDataFetcher", `Crypto data fetched via Alpaca: ${Object.keys(cryptoSnapshots).length} symbols`);
      } catch (alpacaCryptoError) {
        // Fallback to CoinGecko
        log.warn("MarketDataFetcher", "Alpaca crypto failed, falling back to CoinGecko", { error: String(alpacaCryptoError) });
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
    log.error("MarketDataFetcher", "Failed to fetch crypto data", { error: String(error) });
  }

  return marketData;
}

/**
 * Fetch market data for a single symbol
 * Useful for on-demand price checks
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
        const bareSymbol = symbol.replace('/USD', '').toUpperCase();

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
    log.warn("MarketDataFetcher", `Failed to fetch single symbol data for ${symbol}`, { error: String(error) });
  }

  return null;
}
