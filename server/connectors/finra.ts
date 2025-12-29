import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";

const FINRA_BASE_URL = "https://api.finra.org/data/group/otcMarket";

export interface ShortInterestData {
  symbol: string;
  settlementDate: string;
  shortVolume: number;
  shortExemptVolume: number;
  totalVolume: number;
  shortRatio: number; // Calculated: shortVolume / totalVolume
  market: string;
}

export interface ShortInterestSummary {
  symbol: string;
  latestShortRatio: number;
  averageShortRatio: number;
  shortRatioTrend: "increasing" | "decreasing" | "stable";
  daysTocover: number | null;
  lastUpdated: Date;
  historicalData: ShortInterestData[];
}

export interface ConsolidatedShortInterest {
  symbol: string;
  currentShortInterest: number;
  previousShortInterest: number;
  percentChange: number;
  settlementDate: string;
  averageDailyVolume: number;
  daysToCover: number;
}

// FINRA RegSHO data - publicly available without authentication
const REGSHO_BASE_URL = "https://cdn.finra.org/equity/regsho/daily";

class FINRAConnector {
  private shortInterestCache = new ApiCache<ShortInterestData[]>({
    freshDuration: 4 * 60 * 60 * 1000, // 4 hours - short interest updates twice monthly
    staleDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  private consolidatedCache = new ApiCache<ConsolidatedShortInterest>({
    freshDuration: 4 * 60 * 60 * 1000,
    staleDuration: 7 * 24 * 60 * 60 * 1000,
  });

  private regShoCache = new ApiCache<ShortInterestData[]>({
    freshDuration: 60 * 60 * 1000, // 1 hour - RegSHO updates daily
    staleDuration: 24 * 60 * 60 * 1000,
  });

  /**
   * Get RegSHO short volume data for a symbol
   * This is daily short volume data from FINRA's public RegSHO files
   */
  async getRegSHOShortVolume(
    symbol: string,
    days: number = 20
  ): Promise<ShortInterestData[]> {
    const cacheKey = `regsho_${symbol}_${days}`;
    const cached = this.regShoCache.get(cacheKey);
    if (cached?.isFresh) {
      log.debug("FINRA", `Cache hit for RegSHO ${symbol}`);
      return cached.data;
    }

    try {
      const results: ShortInterestData[] = [];
      const today = new Date();

      // Fetch data for multiple days
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Skip weekends
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const dateStr = this.formatDateForRegSHO(date);

        try {
          const data = await this.fetchRegSHOFile(dateStr);
          const symbolData = data.find(
            (d) => d.symbol === symbol.toUpperCase()
          );
          if (symbolData) {
            results.push(symbolData);
          }
        } catch {
          // File may not exist for this date, continue to next day
        }

        if (results.length >= 10) break; // Limit to 10 data points
      }

      if (results.length > 0) {
        this.regShoCache.set(cacheKey, results);
        log.info(
          "FINRA",
          `Fetched ${results.length} RegSHO records for ${symbol}`
        );
      }

      return results;
    } catch (error) {
      log.error("FINRA", `Failed to fetch RegSHO data for ${symbol}`, {
        error: String(error),
      });
      return cached?.data || [];
    }
  }

  /**
   * Fetch and parse FINRA RegSHO daily short sale file
   */
  private async fetchRegSHOFile(dateStr: string): Promise<ShortInterestData[]> {
    // FINRA publishes files for each exchange/venue
    // CNMSshvol = Consolidated NMS stocks short volume
    const url = `${REGSHO_BASE_URL}/CNMSshvol${dateStr}.txt`;

    const response = await fetch(url, {
      headers: {
        Accept: "text/plain",
      },
    });

    if (!response.ok) {
      throw new Error(`RegSHO file not available for ${dateStr}`);
    }

    const text = await response.text();
    return this.parseRegSHOFile(text, dateStr);
  }

  /**
   * Parse FINRA RegSHO file format
   * Format: Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market
   */
  private parseRegSHOFile(text: string, dateStr: string): ShortInterestData[] {
    const lines = text.split("\n").filter((line) => line.trim());
    const results: ShortInterestData[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split("|");
      if (parts.length >= 5) {
        const shortVolume = parseInt(parts[2], 10) || 0;
        const shortExemptVolume = parseInt(parts[3], 10) || 0;
        const totalVolume = parseInt(parts[4], 10) || 0;

        if (totalVolume > 0) {
          results.push({
            symbol: parts[1],
            settlementDate: dateStr,
            shortVolume,
            shortExemptVolume,
            totalVolume,
            shortRatio: totalVolume > 0 ? shortVolume / totalVolume : 0,
            market: parts[5] || "N/A",
          });
        }
      }
    }

    return results;
  }

  /**
   * Get short interest summary with trend analysis
   */
  async getShortInterestSummary(
    symbol: string
  ): Promise<ShortInterestSummary | null> {
    const historicalData = await this.getRegSHOShortVolume(symbol, 30);

    if (historicalData.length === 0) {
      return null;
    }

    // Calculate metrics
    const shortRatios = historicalData.map((d) => d.shortRatio);
    const latestShortRatio = shortRatios[0];
    const averageShortRatio =
      shortRatios.reduce((a, b) => a + b, 0) / shortRatios.length;

    // Determine trend (compare first half to second half)
    const midpoint = Math.floor(shortRatios.length / 2);
    const recentAvg =
      shortRatios.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint || 0;
    const olderAvg =
      shortRatios.slice(midpoint).reduce((a, b) => a + b, 0) /
        (shortRatios.length - midpoint) || 0;

    let shortRatioTrend: "increasing" | "decreasing" | "stable";
    const trendThreshold = 0.05; // 5% threshold
    if (recentAvg > olderAvg * (1 + trendThreshold)) {
      shortRatioTrend = "increasing";
    } else if (recentAvg < olderAvg * (1 - trendThreshold)) {
      shortRatioTrend = "decreasing";
    } else {
      shortRatioTrend = "stable";
    }

    // Calculate days to cover (simplified)
    const avgVolume =
      historicalData.reduce((sum, d) => sum + d.totalVolume, 0) /
      historicalData.length;
    const avgShortVolume =
      historicalData.reduce((sum, d) => sum + d.shortVolume, 0) /
      historicalData.length;
    const daysToCover =
      avgVolume > 0 ? (avgShortVolume / avgVolume) * 10 : null; // Estimate

    return {
      symbol: symbol.toUpperCase(),
      latestShortRatio,
      averageShortRatio,
      shortRatioTrend,
      daysTocover: daysToCover,
      lastUpdated: new Date(),
      historicalData,
    };
  }

  /**
   * Get short interest data for multiple symbols
   */
  async getBulkShortInterest(
    symbols: string[]
  ): Promise<Map<string, ShortInterestSummary>> {
    const results = new Map<string, ShortInterestSummary>();

    // Process in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (symbol) => {
          const summary = await this.getShortInterestSummary(symbol);
          return { symbol, summary };
        })
      );

      for (const { symbol, summary } of batchResults) {
        if (summary) {
          results.set(symbol, summary);
        }
      }

      // Rate limiting delay
      if (i + batchSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    log.info(
      "FINRA",
      `Fetched short interest for ${results.size}/${symbols.length} symbols`
    );
    return results;
  }

  /**
   * Analyze short squeeze potential based on short interest metrics
   */
  analyzeShortSqueezePotential(summary: ShortInterestSummary): {
    potential: "high" | "medium" | "low";
    score: number;
    factors: string[];
  } {
    const factors: string[] = [];
    let score = 0;

    // High short ratio (>40% is significant)
    if (summary.latestShortRatio > 0.5) {
      score += 40;
      factors.push(
        `Very high short ratio: ${(summary.latestShortRatio * 100).toFixed(1)}%`
      );
    } else if (summary.latestShortRatio > 0.4) {
      score += 30;
      factors.push(
        `High short ratio: ${(summary.latestShortRatio * 100).toFixed(1)}%`
      );
    } else if (summary.latestShortRatio > 0.3) {
      score += 20;
      factors.push(
        `Elevated short ratio: ${(summary.latestShortRatio * 100).toFixed(1)}%`
      );
    }

    // Increasing trend
    if (summary.shortRatioTrend === "increasing") {
      score += 20;
      factors.push("Short interest is increasing");
    }

    // Days to cover
    if (summary.daysTocover && summary.daysTocover > 5) {
      score += 25;
      factors.push(`High days to cover: ${summary.daysTocover.toFixed(1)}`);
    } else if (summary.daysTocover && summary.daysTocover > 3) {
      score += 15;
      factors.push(`Elevated days to cover: ${summary.daysTocover.toFixed(1)}`);
    }

    // Above average short ratio
    if (summary.latestShortRatio > summary.averageShortRatio * 1.2) {
      score += 15;
      factors.push("Short ratio above 20-day average");
    }

    let potential: "high" | "medium" | "low";
    if (score >= 60) {
      potential = "high";
    } else if (score >= 35) {
      potential = "medium";
    } else {
      potential = "low";
    }

    return { potential, score, factors };
  }

  private formatDateForRegSHO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.shortInterestCache.clear();
    this.consolidatedCache.clear();
    this.regShoCache.clear();
  }

  /**
   * Check connection status
   */
  getConnectionStatus(): { connected: boolean; cacheSize: number } {
    const cacheSize =
      this.shortInterestCache.size() +
      this.consolidatedCache.size() +
      this.regShoCache.size();

    return {
      connected: true, // FINRA public data doesn't require authentication
      cacheSize,
    };
  }
}

export const finra = new FINRAConnector();
export default finra;
