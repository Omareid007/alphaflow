/**
 * AI Active Trader - Sector Exposure Service
 * Tracks and enforces sector-level exposure limits to prevent concentration risk
 */

import { db } from "../db";
import { universeFundamentals } from "@shared/schema";
import { eq } from "drizzle-orm";
import { log } from "../utils/logger";

export interface SectorExposure {
  sector: string;
  totalValue: number;
  positionCount: number;
  percentOfPortfolio: number;
  symbols: string[];
}

export interface SectorExposureCheck {
  canTrade: boolean;
  reason?: string;
  currentExposure: number;
  maxExposure: number;
  sector: string;
}

export interface SectorExposureSummary {
  exposureBySector: SectorExposure[];
  totalExposure: number;
  portfolioValue: number;
  maxSectorWeight: number;
  mostConcentratedSector: string | null;
  warnings: string[];
}

// Default max sector weight if not set in trading preferences
const DEFAULT_MAX_SECTOR_WEIGHT_PCT = 25;

// Sector mapping for symbols without fundamentals data
const KNOWN_SECTOR_MAP: Record<string, string> = {
  // ETFs
  "SPY": "ETF",
  "QQQM": "ETF",
  "QQQ": "ETF",
  "IWM": "ETF",
  "DIA": "ETF",

  // Technology
  "AAPL": "Technology",
  "MSFT": "Technology",
  "GOOGL": "Technology",
  "GOOG": "Technology",
  "AMZN": "Technology",
  "NVDA": "Technology",
  "META": "Technology",
  "TSLA": "Technology",
  "AVGO": "Technology",
  "ORCL": "Technology",
  "CRM": "Technology",
  "AMD": "Technology",
  "INTC": "Technology",
  "IBM": "Technology",
  "CSCO": "Technology",
  "ADBE": "Technology",
  "NFLX": "Technology",
  "PYPL": "Technology",
  "NOW": "Technology",
  "UBER": "Technology",

  // Financials
  "JPM": "Financials",
  "V": "Financials",
  "MA": "Financials",
  "BAC": "Financials",
  "WFC": "Financials",
  "GS": "Financials",
  "MS": "Financials",
  "BLK": "Financials",
  "SCHW": "Financials",
  "AXP": "Financials",

  // Healthcare
  "UNH": "Healthcare",
  "JNJ": "Healthcare",
  "LLY": "Healthcare",
  "PFE": "Healthcare",
  "ABBV": "Healthcare",
  "MRK": "Healthcare",
  "TMO": "Healthcare",
  "ABT": "Healthcare",

  // Consumer Discretionary
  "HD": "Consumer Discretionary",
  "NKE": "Consumer Discretionary",
  "MCD": "Consumer Discretionary",
  "SBUX": "Consumer Discretionary",
  "LOW": "Consumer Discretionary",

  // Consumer Staples
  "WMT": "Consumer Staples",
  "PG": "Consumer Staples",
  "KO": "Consumer Staples",
  "PEP": "Consumer Staples",
  "COST": "Consumer Staples",

  // Energy
  "CVX": "Energy",
  "XOM": "Energy",
  "COP": "Energy",
  "SLB": "Energy",

  // Industrials
  "UPS": "Industrials",
  "RTX": "Industrials",
  "HON": "Industrials",
  "BA": "Industrials",
  "CAT": "Industrials",
  "GE": "Industrials",
  "DE": "Industrials",

  // Materials
  "LIN": "Materials",
  "APD": "Materials",
  "SHW": "Materials",

  // Utilities
  "NEE": "Utilities",
  "DUK": "Utilities",
  "SO": "Utilities",

  // Real Estate
  "AMT": "Real Estate",
  "PLD": "Real Estate",
  "CCI": "Real Estate",

  // Communication Services
  "DIS": "Communication Services",
  "CMCSA": "Communication Services",
  "VZ": "Communication Services",
  "T": "Communication Services",
  "TMUS": "Communication Services",

  // Crypto
  "BTC/USD": "Crypto",
  "ETH/USD": "Crypto",
  "SOL/USD": "Crypto",
  "DOGE/USD": "Crypto",
  "SHIB/USD": "Crypto",
  "AVAX/USD": "Crypto",
};

class SectorExposureService {
  private sectorCache: Map<string, string> = new Map();
  private maxSectorWeightPct: number = DEFAULT_MAX_SECTOR_WEIGHT_PCT;
  private lastConfigRefresh: Date | null = null;
  private configRefreshIntervalMs = 300000; // 5 minutes

  /**
   * Get the sector for a symbol, using cache, database, or fallback mapping
   */
  async getSector(symbol: string): Promise<string> {
    // Check cache first
    const cached = this.sectorCache.get(symbol.toUpperCase());
    if (cached) return cached;

    try {
      // Query database for fundamentals
      const [fundamentals] = await db
        .select({ sector: universeFundamentals.sector })
        .from(universeFundamentals)
        .where(eq(universeFundamentals.symbol, symbol.toUpperCase()))
        .limit(1);

      if (fundamentals?.sector) {
        this.sectorCache.set(symbol.toUpperCase(), fundamentals.sector);
        return fundamentals.sector;
      }
    } catch (error) {
      log.warn("SectorExposure", `Failed to fetch sector for ${symbol}`, { error: String(error) });
    }

    // Fall back to known mapping or "Unknown"
    const fallback = KNOWN_SECTOR_MAP[symbol.toUpperCase()] || "Unknown";
    this.sectorCache.set(symbol.toUpperCase(), fallback);
    return fallback;
  }

  /**
   * Refresh max sector weight (uses default for now, can be extended to read from DB)
   */
  private async refreshConfig(): Promise<void> {
    const now = new Date();
    if (
      this.lastConfigRefresh &&
      now.getTime() - this.lastConfigRefresh.getTime() < this.configRefreshIntervalMs
    ) {
      return; // Config is still fresh
    }

    // Use environment variable or default (trading preferences table not yet implemented)
    const envValue = process.env.MAX_SECTOR_WEIGHT_PCT;
    if (envValue) {
      const parsed = parseFloat(envValue);
      if (!isNaN(parsed) && parsed >= 5 && parsed <= 100) {
        this.maxSectorWeightPct = parsed;
      }
    }
    this.lastConfigRefresh = now;

    log.debug("SectorExposure", `Max sector weight: ${this.maxSectorWeightPct}%`);
  }

  /**
   * Calculate current sector exposure from active positions
   */
  async calculateExposure(
    positions: Map<string, { symbol: string; currentPrice: number; quantity: number }>,
    portfolioValue: number
  ): Promise<SectorExposureSummary> {
    await this.refreshConfig();

    const sectorMap = new Map<string, SectorExposure>();
    let totalExposure = 0;
    const warnings: string[] = [];

    for (const [symbol, position] of positions.entries()) {
      const sector = await this.getSector(symbol);
      const positionValue = position.currentPrice * position.quantity;
      totalExposure += positionValue;

      const existing = sectorMap.get(sector) || {
        sector,
        totalValue: 0,
        positionCount: 0,
        percentOfPortfolio: 0,
        symbols: [],
      };

      existing.totalValue += positionValue;
      existing.positionCount++;
      existing.symbols.push(symbol);
      sectorMap.set(sector, existing);
    }

    // Calculate percentages and find warnings
    let mostConcentrated: string | null = null;
    let maxConcentration = 0;

    for (const [sector, exposure] of sectorMap.entries()) {
      exposure.percentOfPortfolio = portfolioValue > 0
        ? (exposure.totalValue / portfolioValue) * 100
        : 0;

      if (exposure.percentOfPortfolio > maxConcentration) {
        maxConcentration = exposure.percentOfPortfolio;
        mostConcentrated = sector;
      }

      if (exposure.percentOfPortfolio > this.maxSectorWeightPct) {
        warnings.push(
          `${sector} exposure (${exposure.percentOfPortfolio.toFixed(1)}%) exceeds limit (${this.maxSectorWeightPct}%)`
        );
      }
    }

    const exposureBySector = Array.from(sectorMap.values())
      .sort((a, b) => b.percentOfPortfolio - a.percentOfPortfolio);

    return {
      exposureBySector,
      totalExposure,
      portfolioValue,
      maxSectorWeight: this.maxSectorWeightPct,
      mostConcentratedSector: mostConcentrated,
      warnings,
    };
  }

  /**
   * Check if adding a position would exceed sector limits
   */
  async checkExposure(
    symbol: string,
    proposedValue: number,
    positions: Map<string, { symbol: string; currentPrice: number; quantity: number }>,
    portfolioValue: number
  ): Promise<SectorExposureCheck> {
    await this.refreshConfig();

    const sector = await this.getSector(symbol);

    // Calculate current sector exposure
    let currentSectorValue = 0;
    for (const [posSymbol, position] of positions.entries()) {
      const posSector = await this.getSector(posSymbol);
      if (posSector === sector) {
        currentSectorValue += position.currentPrice * position.quantity;
      }
    }

    const currentExposure = portfolioValue > 0
      ? (currentSectorValue / portfolioValue) * 100
      : 0;

    const newExposure = portfolioValue > 0
      ? ((currentSectorValue + proposedValue) / portfolioValue) * 100
      : 0;

    if (newExposure > this.maxSectorWeightPct) {
      log.warn("SectorExposure", `Trade blocked: ${symbol} would exceed ${sector} limit`, {
        symbol,
        sector,
        currentExposure: currentExposure.toFixed(1),
        newExposure: newExposure.toFixed(1),
        maxAllowed: this.maxSectorWeightPct,
      });

      return {
        canTrade: false,
        reason: `Would exceed ${sector} sector limit: ${newExposure.toFixed(1)}% > ${this.maxSectorWeightPct}%`,
        currentExposure,
        maxExposure: this.maxSectorWeightPct,
        sector,
      };
    }

    return {
      canTrade: true,
      currentExposure,
      maxExposure: this.maxSectorWeightPct,
      sector,
    };
  }

  /**
   * Set max sector weight (for runtime configuration)
   */
  setMaxSectorWeight(percent: number): void {
    if (percent < 5 || percent > 100) {
      throw new Error("Max sector weight must be between 5% and 100%");
    }
    this.maxSectorWeightPct = percent;
    log.info("SectorExposure", `Max sector weight set to ${percent}%`);
  }

  /**
   * Clear the sector cache
   */
  clearCache(): void {
    this.sectorCache.clear();
    log.info("SectorExposure", "Sector cache cleared");
  }

  /**
   * Get current configuration
   */
  getConfig(): { maxSectorWeightPct: number; cachedSymbols: number } {
    return {
      maxSectorWeightPct: this.maxSectorWeightPct,
      cachedSymbols: this.sectorCache.size,
    };
  }
}

export const sectorExposureService = new SectorExposureService();
