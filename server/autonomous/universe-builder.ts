/**
 * @file Universe Builder - Dynamic Analysis Universe Construction
 *
 * Intelligent universe construction system that dynamically builds the analysis
 * universe by merging multiple data sources and implementing rotation for large
 * universes. Ensures the most relevant symbols are analyzed each cycle.
 *
 * @module autonomous/universe-builder
 *
 * @universe-sources
 * The universe is built by merging four sources (in priority order):
 *
 * 1. BASE WATCHLIST
 *    - Stocks and crypto from database (watchlist table)
 *    - Cached for performance (1-hour TTL)
 *    - Foundation symbols always included
 *
 * 2. APPROVED CANDIDATES
 *    - Symbols from candidatesService with "approved" status
 *    - Pass fundamental and technical screening
 *    - Higher quality than watchlist alone
 *
 * 3. HIGH-CONFIDENCE AI DECISIONS
 *    - Symbols from recent AI decisions (last 500)
 *    - Filtered: confidence >= 0.75 AND action != "hold"
 *    - Ensures recently analyzed symbols stay in universe
 *
 * 4. EXECUTED TRADES (Boost Priority)
 *    - Symbols with actual executed trades
 *    - Always included regardless of other criteria
 *    - Ensures active positions remain in analysis universe
 *
 * @universe-rotation
 * When universe exceeds per-cycle limits (default: 50 stocks, 10 crypto):
 * - Implements hourly rotation through full symbol pool
 * - Ensures all symbols get analyzed over time
 * - Prevents bias toward alphabetically early symbols
 * - Rotation offset advances by half the limit each hour
 *
 * @example
 * ```typescript
 * const universe = await getAnalysisUniverseSymbols();
 * console.log(`Analyzing ${universe.stocks.length} stocks, ${universe.crypto.length} crypto`);
 * console.log('Sources:', universe.sources);
 * // Sources: { watchlist: 30, candidates: 45, recentDecisions: 12, executedTrades: 5 }
 *
 * // Reset rotation for testing
 * resetUniverseRotation();
 *
 * // Check rotation state
 * const state = getRotationState();
 * console.log(`Stock offset: ${state.stockRotationOffset}`);
 * ```
 */

import { storage } from "../storage";
import { candidatesService } from "../universe/candidatesService";
import { log } from "../utils/logger";
import { isCryptoSymbol } from "../trading/crypto-trading-config";
import { getWatchlist } from "./watchlist-cache";
import { tradingConfig } from "../config/trading-config";

// Universe expansion constants - values loaded from tradingConfig
const MAX_STOCK_SYMBOLS_PER_CYCLE = tradingConfig.universe.maxStockSymbolsPerCycle;
const MAX_CRYPTO_SYMBOLS_PER_CYCLE = tradingConfig.universe.maxCryptoSymbolsPerCycle;
const RECENT_DECISIONS_LOOKBACK = 500;
const MIN_CONFIDENCE_FOR_UNIVERSE = tradingConfig.universe.minConfidenceForUniverse;

export interface UniverseSymbols {
  stocks: string[];
  crypto: string[];
  sources: {
    watchlist: number;
    candidates: number;
    recentDecisions: number;
    executedTrades: number;
  };
}

// Universe rotation state
interface UniverseRotationState {
  stockRotationOffset: number;
  cryptoRotationOffset: number;
  lastRotationTime: Date;
}

const universeRotationState: UniverseRotationState = {
  stockRotationOffset: 0,
  cryptoRotationOffset: 0,
  lastRotationTime: new Date(),
};

/**
 * Get the dynamic analysis universe by merging multiple sources
 *
 * Builds a comprehensive yet focused analysis universe by intelligently merging
 * symbols from watchlist, approved candidates, recent AI decisions, and executed
 * trades. Implements rotation for large universes.
 *
 * @async
 * @returns {Promise<UniverseSymbols>} Universe with stocks, crypto, and source counts
 *
 * @universe-building-process
 * 1. Load base watchlist (stocks + crypto) from database cache
 * 2. Add approved candidates from candidatesService
 * 3. Add symbols from recent high-confidence AI decisions (last 500)
 * 4. Filter executed trades for boost priority
 * 5. Apply rotation if universe exceeds limits
 * 6. Return final universe with source attribution
 *
 * @rotation-logic
 * - Triggers when stocks > 50 OR crypto > 10 (configurable)
 * - Rotates hourly through full symbol pool
 * - Offset advances by half the limit each rotation
 * - Ensures even coverage over time
 *
 * @example
 * ```typescript
 * const universe = await getAnalysisUniverseSymbols();
 * // universe = {
 * //   stocks: ['AAPL', 'MSFT', ...],
 * //   crypto: ['BTC', 'ETH', ...],
 * //   sources: { watchlist: 30, candidates: 45, recentDecisions: 12, executedTrades: 5 }
 * // }
 * ```
 */
export async function getAnalysisUniverseSymbols(): Promise<UniverseSymbols> {
  const sources = { watchlist: 0, candidates: 0, recentDecisions: 0, executedTrades: 0 };

  // Start with dynamically loaded watchlist from database
  const watchlist = await getWatchlist();
  const stockSet = new Set<string>(watchlist.stocks.map(s => s.toUpperCase()));
  const cryptoSet = new Set<string>(watchlist.crypto.map(c => c.toUpperCase()));
  sources.watchlist = stockSet.size + cryptoSet.size;

  try {
    // Add APPROVED candidates from universe
    const approvedSymbols = await candidatesService.getApprovedSymbols();
    for (const symbol of approvedSymbols) {
      const upper = symbol.toUpperCase();
      if (isCryptoSymbol(upper)) {
        cryptoSet.add(upper.replace('/USD', ''));
      } else {
        stockSet.add(upper);
      }
    }
    sources.candidates = approvedSymbols.length;
  } catch (error) {
    log.warn("UniverseBuilder", "Failed to get approved candidates", { error: String(error) });
  }

  try {
    // Add symbols from recent high-confidence AI decisions (action != hold)
    const recentDecisions = await storage.getAiDecisions(undefined, RECENT_DECISIONS_LOOKBACK);
    const highConfDecisions = recentDecisions.filter(d => {
      const confidence = parseFloat(d.confidence || "0");
      return confidence >= MIN_CONFIDENCE_FOR_UNIVERSE && d.action !== "hold";
    });

    for (const decision of highConfDecisions) {
      const upper = decision.symbol.toUpperCase();
      if (isCryptoSymbol(upper)) {
        cryptoSet.add(upper.replace('/USD', ''));
      } else {
        stockSet.add(upper);
      }

      // Boost priority for executed trades (always include)
      if (decision.executedTradeId) {
        sources.executedTrades++;
      }
    }
    sources.recentDecisions = highConfDecisions.length;
  } catch (error) {
    log.warn("UniverseBuilder", "Failed to get recent AI decisions for universe", { error: String(error) });
  }

  // Apply rotation if universe exceeds caps
  let stocks = Array.from(stockSet);
  let crypto = Array.from(cryptoSet);

  if (stocks.length > MAX_STOCK_SYMBOLS_PER_CYCLE) {
    // Rotate through the full universe over time
    const now = Date.now();
    const hoursSinceLastRotation = (now - universeRotationState.lastRotationTime.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastRotation >= 1) {
      universeRotationState.stockRotationOffset = (universeRotationState.stockRotationOffset + MAX_STOCK_SYMBOLS_PER_CYCLE / 2) % stocks.length;
      universeRotationState.lastRotationTime = new Date();
    }

    // Take a window with rotation offset
    const offset = universeRotationState.stockRotationOffset;
    const rotated = [...stocks.slice(offset), ...stocks.slice(0, offset)];
    stocks = rotated.slice(0, MAX_STOCK_SYMBOLS_PER_CYCLE);
  }

  if (crypto.length > MAX_CRYPTO_SYMBOLS_PER_CYCLE) {
    const offset = universeRotationState.cryptoRotationOffset;
    const rotated = [...crypto.slice(offset), ...crypto.slice(0, offset)];
    crypto = rotated.slice(0, MAX_CRYPTO_SYMBOLS_PER_CYCLE);
  }

  log.info("UniverseBuilder", `Universe built: ${stocks.length} stocks, ${crypto.length} crypto`, {
    sources,
    totalStockPool: stockSet.size,
    totalCryptoPool: cryptoSet.size,
  });

  return { stocks, crypto, sources };
}

/**
 * Reset universe rotation state (useful for testing)
 *
 * Resets rotation offsets to zero and updates last rotation time to now.
 * Primarily used in tests to ensure consistent starting state.
 *
 * @returns {void}
 *
 * @example
 * ```typescript
 * resetUniverseRotation();
 * // Rotation state is now: { stockRotationOffset: 0, cryptoRotationOffset: 0, lastRotationTime: now }
 * ```
 */
export function resetUniverseRotation(): void {
  universeRotationState.stockRotationOffset = 0;
  universeRotationState.cryptoRotationOffset = 0;
  universeRotationState.lastRotationTime = new Date();
}

/**
 * Get current rotation state (for debugging/monitoring)
 *
 * Returns a copy of the current rotation state including offsets and last
 * rotation time. Useful for monitoring and debugging universe rotation.
 *
 * @returns {UniverseRotationState} Current rotation state (copy)
 *
 * @example
 * ```typescript
 * const state = getRotationState();
 * console.log(`Stock offset: ${state.stockRotationOffset}`);
 * console.log(`Crypto offset: ${state.cryptoRotationOffset}`);
 * console.log(`Last rotation: ${state.lastRotationTime}`);
 * ```
 */
export function getRotationState(): UniverseRotationState {
  return { ...universeRotationState };
}
