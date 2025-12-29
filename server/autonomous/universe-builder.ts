/**
 * Universe Builder - Dynamic Analysis Universe Construction
 *
 * Builds the analysis universe by merging multiple sources:
 * - Base watchlist stocks/crypto from database
 * - APPROVED candidates from candidatesService
 * - Symbols from recent high-confidence AI decisions
 * - Symbols from recently executed trades (with boost priority)
 *
 * Implements rotation to handle universes larger than per-cycle limits.
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
 * Get the dynamic analysis universe by merging multiple sources:
 * - Base watchlist stocks/crypto
 * - APPROVED candidates from candidatesService
 * - Symbols from recent high-confidence AI decisions
 * - Symbols from recently executed trades (with boost priority)
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
 */
export function resetUniverseRotation(): void {
  universeRotationState.stockRotationOffset = 0;
  universeRotationState.cryptoRotationOffset = 0;
  universeRotationState.lastRotationTime = new Date();
}

/**
 * Get current rotation state (for debugging/monitoring)
 */
export function getRotationState(): UniverseRotationState {
  return { ...universeRotationState };
}
