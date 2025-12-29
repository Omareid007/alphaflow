import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";

// Frankfurter is a free, open-source API for currency exchange rates
// No API key required, unlimited requests, powered by European Central Bank data
const FRANKFURTER_BASE_URL = "https://api.frankfurter.app";

export interface ExchangeRates {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface HistoricalRates {
  amount: number;
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, Record<string, number>>; // date -> currency -> rate
}

export interface CurrencyInfo {
  code: string;
  name: string;
}

export interface ForexPair {
  base: string;
  quote: string;
  rate: number;
  inverseRate: number;
  date: string;
  change24h?: number;
  changePercent24h?: number;
}

export interface ForexSummary {
  pair: string;
  currentRate: number;
  previousRate: number;
  change: number;
  changePercent: number;
  high30d: number;
  low30d: number;
  trend: "bullish" | "bearish" | "neutral";
  lastUpdated: Date;
}

// Major currency pairs for trading
export const MAJOR_FOREX_PAIRS = [
  { base: "EUR", quote: "USD", name: "Euro / US Dollar" },
  { base: "GBP", quote: "USD", name: "British Pound / US Dollar" },
  { base: "USD", quote: "JPY", name: "US Dollar / Japanese Yen" },
  { base: "USD", quote: "CHF", name: "US Dollar / Swiss Franc" },
  { base: "AUD", quote: "USD", name: "Australian Dollar / US Dollar" },
  { base: "USD", quote: "CAD", name: "US Dollar / Canadian Dollar" },
  { base: "NZD", quote: "USD", name: "New Zealand Dollar / US Dollar" },
  { base: "EUR", quote: "GBP", name: "Euro / British Pound" },
  { base: "EUR", quote: "JPY", name: "Euro / Japanese Yen" },
  { base: "GBP", quote: "JPY", name: "British Pound / Japanese Yen" },
];

class FrankfurterConnector {
  private latestRatesCache = new ApiCache<ExchangeRates>({
    freshDuration: 60 * 60 * 1000, // 1 hour - ECB updates once daily
    staleDuration: 24 * 60 * 60 * 1000, // 24 hours
  });

  private historicalRatesCache = new ApiCache<HistoricalRates>({
    freshDuration: 24 * 60 * 60 * 1000, // Historical data doesn't change
    staleDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  private currenciesCache = new ApiCache<CurrencyInfo[]>({
    freshDuration: 24 * 60 * 60 * 1000, // Currencies rarely change
    staleDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  /**
   * Get latest exchange rates
   */
  async getLatestRates(
    base: string = "USD",
    symbols?: string[]
  ): Promise<ExchangeRates | null> {
    const cacheKey = `latest_${base}_${symbols?.join(",") || "all"}`;
    const cached = this.latestRatesCache.get(cacheKey);
    if (cached?.isFresh) {
      log.debug("Frankfurter", `Cache hit for latest rates ${base}`);
      return cached.data;
    }

    try {
      let url = `${FRANKFURTER_BASE_URL}/latest?from=${base.toUpperCase()}`;
      if (symbols && symbols.length > 0) {
        url += `&to=${symbols.map((s) => s.toUpperCase()).join(",")}`;
      }

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(
          `Frankfurter API error: ${response.status} ${response.statusText}`
        );
      }

      const data: ExchangeRates = await response.json();
      this.latestRatesCache.set(cacheKey, data);
      log.info(
        "Frankfurter",
        `Fetched latest rates for ${base}: ${Object.keys(data.rates).length} currencies`
      );
      return data;
    } catch (error) {
      log.error("Frankfurter", `Failed to fetch latest rates for ${base}`, {
        error: String(error),
      });
      return cached?.data || null;
    }
  }

  /**
   * Get historical exchange rates for a date range
   */
  async getHistoricalRates(
    base: string,
    startDate: string,
    endDate: string,
    symbols?: string[]
  ): Promise<HistoricalRates | null> {
    const cacheKey = `historical_${base}_${startDate}_${endDate}_${symbols?.join(",") || "all"}`;
    const cached = this.historicalRatesCache.get(cacheKey);
    if (cached?.isFresh) {
      log.debug("Frankfurter", `Cache hit for historical rates ${base}`);
      return cached.data;
    }

    try {
      let url = `${FRANKFURTER_BASE_URL}/${startDate}..${endDate}?from=${base.toUpperCase()}`;
      if (symbols && symbols.length > 0) {
        url += `&to=${symbols.map((s) => s.toUpperCase()).join(",")}`;
      }

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(
          `Frankfurter API error: ${response.status} ${response.statusText}`
        );
      }

      const data: HistoricalRates = await response.json();
      this.historicalRatesCache.set(cacheKey, data);
      log.info(
        "Frankfurter",
        `Fetched historical rates for ${base} from ${startDate} to ${endDate}`
      );
      return data;
    } catch (error) {
      log.error("Frankfurter", `Failed to fetch historical rates for ${base}`, {
        error: String(error),
      });
      return cached?.data || null;
    }
  }

  /**
   * Get exchange rate for a specific date
   */
  async getRateOnDate(
    base: string,
    quote: string,
    date: string
  ): Promise<number | null> {
    try {
      const url = `${FRANKFURTER_BASE_URL}/${date}?from=${base.toUpperCase()}&to=${quote.toUpperCase()}`;

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Frankfurter API error: ${response.status}`);
      }

      const data: ExchangeRates = await response.json();
      return data.rates[quote.toUpperCase()] || null;
    } catch (error) {
      log.error(
        "Frankfurter",
        `Failed to fetch rate for ${base}/${quote} on ${date}`,
        { error: String(error) }
      );
      return null;
    }
  }

  /**
   * Get all available currencies
   */
  async getCurrencies(): Promise<CurrencyInfo[]> {
    const cacheKey = "currencies";
    const cached = this.currenciesCache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    try {
      const response = await fetch(`${FRANKFURTER_BASE_URL}/currencies`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Frankfurter API error: ${response.status}`);
      }

      const data: Record<string, string> = await response.json();
      const currencies: CurrencyInfo[] = Object.entries(data).map(
        ([code, name]) => ({
          code,
          name,
        })
      );

      this.currenciesCache.set(cacheKey, currencies);
      log.info("Frankfurter", `Fetched ${currencies.length} currencies`);
      return currencies;
    } catch (error) {
      log.error("Frankfurter", "Failed to fetch currencies", {
        error: String(error),
      });
      return cached?.data || [];
    }
  }

  /**
   * Convert amount between currencies
   */
  async convert(
    amount: number,
    from: string,
    to: string,
    date?: string
  ): Promise<{ amount: number; rate: number; date: string } | null> {
    try {
      const endpoint = date || "latest";
      const url = `${FRANKFURTER_BASE_URL}/${endpoint}?amount=${amount}&from=${from.toUpperCase()}&to=${to.toUpperCase()}`;

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Frankfurter API error: ${response.status}`);
      }

      const data = await response.json();
      const convertedAmount = data.rates[to.toUpperCase()];
      const rate = convertedAmount / amount;

      return {
        amount: convertedAmount,
        rate,
        date: data.date,
      };
    } catch (error) {
      log.error("Frankfurter", `Failed to convert ${amount} ${from} to ${to}`, {
        error: String(error),
      });
      return null;
    }
  }

  /**
   * Get forex pair data with trend analysis
   */
  async getForexPairSummary(
    base: string,
    quote: string
  ): Promise<ForexSummary | null> {
    try {
      // Get current rate
      const latestRates = await this.getLatestRates(base, [quote]);
      if (!latestRates || !latestRates.rates[quote.toUpperCase()]) {
        return null;
      }
      const currentRate = latestRates.rates[quote.toUpperCase()];

      // Get 30-day historical data
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const startDate = this.formatDate(thirtyDaysAgo);
      const endDate = this.formatDate(today);

      const historicalRates = await this.getHistoricalRates(
        base,
        startDate,
        endDate,
        [quote]
      );
      if (!historicalRates || !historicalRates.rates) {
        return {
          pair: `${base}/${quote}`,
          currentRate,
          previousRate: currentRate,
          change: 0,
          changePercent: 0,
          high30d: currentRate,
          low30d: currentRate,
          trend: "neutral",
          lastUpdated: new Date(),
        };
      }

      // Calculate metrics from historical data
      const rates = Object.values(historicalRates.rates)
        .map((r) => r[quote.toUpperCase()])
        .filter((r) => r !== undefined);

      if (rates.length === 0) {
        return null;
      }

      const previousRate = rates[rates.length - 1] || currentRate;
      const change = currentRate - previousRate;
      const changePercent =
        previousRate !== 0 ? (change / previousRate) * 100 : 0;
      const high30d = Math.max(...rates, currentRate);
      const low30d = Math.min(...rates, currentRate);

      // Determine trend
      const midpoint = Math.floor(rates.length / 2);
      const recentAvg =
        rates.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint ||
        currentRate;
      const olderAvg =
        rates.slice(midpoint).reduce((a, b) => a + b, 0) /
          (rates.length - midpoint) || currentRate;

      let trend: "bullish" | "bearish" | "neutral";
      const trendThreshold = 0.01; // 1% threshold
      if (recentAvg > olderAvg * (1 + trendThreshold)) {
        trend = "bullish";
      } else if (recentAvg < olderAvg * (1 - trendThreshold)) {
        trend = "bearish";
      } else {
        trend = "neutral";
      }

      return {
        pair: `${base}/${quote}`,
        currentRate,
        previousRate,
        change,
        changePercent,
        high30d,
        low30d,
        trend,
        lastUpdated: new Date(),
      };
    } catch (error) {
      log.error("Frankfurter", `Failed to get summary for ${base}/${quote}`, {
        error: String(error),
      });
      return null;
    }
  }

  /**
   * Get summaries for all major forex pairs
   */
  async getMajorPairsSummaries(): Promise<ForexSummary[]> {
    const summaries: ForexSummary[] = [];

    for (const pair of MAJOR_FOREX_PAIRS) {
      const summary = await this.getForexPairSummary(pair.base, pair.quote);
      if (summary) {
        summaries.push(summary);
      }
      // Small delay to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    log.info(
      "Frankfurter",
      `Fetched ${summaries.length} major forex pair summaries`
    );
    return summaries;
  }

  /**
   * Get USD strength index (simplified DXY proxy)
   * Compares USD against a basket of major currencies
   */
  async getUSDStrengthIndex(): Promise<{
    index: number;
    components: {
      currency: string;
      weight: number;
      rate: number;
      contribution: number;
    }[];
    trend: "strengthening" | "weakening" | "stable";
  } | null> {
    try {
      // DXY-like basket (simplified weights)
      const basket = [
        { currency: "EUR", weight: 0.576 },
        { currency: "JPY", weight: 0.136 },
        { currency: "GBP", weight: 0.119 },
        { currency: "CAD", weight: 0.091 },
        { currency: "SEK", weight: 0.042 },
        { currency: "CHF", weight: 0.036 },
      ];

      const rates = await this.getLatestRates(
        "USD",
        basket.map((b) => b.currency)
      );
      if (!rates) return null;

      // Get historical for trend
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const historicalRates = await this.getHistoricalRates(
        "USD",
        this.formatDate(weekAgo),
        this.formatDate(today),
        basket.map((b) => b.currency)
      );

      const components = basket.map((b) => ({
        currency: b.currency,
        weight: b.weight,
        rate: rates.rates[b.currency] || 0,
        contribution: (rates.rates[b.currency] || 0) * b.weight,
      }));

      // Calculate current index (normalized to ~100)
      const currentIndex =
        components.reduce((sum, c) => sum + c.contribution, 0) * 10;

      // Calculate historical index for trend
      let trend: "strengthening" | "weakening" | "stable" = "stable";
      if (historicalRates) {
        const historicalDates = Object.keys(historicalRates.rates).sort();
        if (historicalDates.length > 0) {
          const oldestDate = historicalDates[0];
          const oldestRates = historicalRates.rates[oldestDate];
          const oldIndex =
            basket.reduce(
              (sum, b) => sum + (oldestRates[b.currency] || 0) * b.weight,
              0
            ) * 10;

          const changePercent = ((currentIndex - oldIndex) / oldIndex) * 100;
          if (changePercent > 0.5) {
            trend = "weakening"; // Higher USD/X rate means weaker USD
          } else if (changePercent < -0.5) {
            trend = "strengthening";
          }
        }
      }

      return {
        index: currentIndex,
        components,
        trend,
      };
    } catch (error) {
      log.error("Frankfurter", "Failed to calculate USD strength index", {
        error: String(error),
      });
      return null;
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.latestRatesCache.clear();
    this.historicalRatesCache.clear();
    this.currenciesCache.clear();
  }

  /**
   * Check connection status
   */
  getConnectionStatus(): { connected: boolean; cacheSize: number } {
    const cacheSize =
      this.latestRatesCache.size() +
      this.historicalRatesCache.size() +
      this.currenciesCache.size();

    return {
      connected: true, // No API key required
      cacheSize,
    };
  }
}

export const frankfurter = new FrankfurterConnector();
export default frankfurter;
