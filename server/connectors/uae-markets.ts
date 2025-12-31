import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";

// Dubai Pulse API Configuration
const DUBAI_PULSE_API_KEY = process.env.UAE_MARKETS_API_KEY || "";
const DUBAI_PULSE_BASE_URL = "https://api.dubaipulse.gov.ae";

// IMPORTANT: Demo data mode has been REMOVED
// Connector will only return real data from Dubai Pulse API or empty arrays
// To use this connector, configure UAE_MARKETS_API_KEY environment variable

export interface UAEStock {
  symbol: string;
  name: string;
  nameArabic?: string;
  exchange: "ADX" | "DFM";
  sector: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  currency: string;
  lastUpdated: string;
}

export interface UAEMarketSummary {
  exchange: "ADX" | "DFM";
  indexName: string;
  indexValue: number;
  change: number;
  changePercent: number;
  tradingValue: number;
  tradingVolume: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  lastUpdated: string;
}

export interface UAEMarketInfo {
  exchanges: {
    ADX: {
      name: string;
      fullName: string;
      website: string;
      currency: string;
      timezone: string;
      tradingHours: string;
      established: number;
    };
    DFM: {
      name: string;
      fullName: string;
      website: string;
      currency: string;
      timezone: string;
      tradingHours: string;
      established: number;
    };
  };
  apiProviders: {
    name: string;
    type: "free" | "premium";
    coverage: string[];
    features: string[];
    url: string;
  }[];
  regulatoryAuthority: string;
  notes: string;
}

// Demo data templates removed - connector now uses live API only
// To enable UAE market data, configure UAE_MARKETS_API_KEY environment variable

const UAE_MARKET_INFO: UAEMarketInfo = {
  exchanges: {
    ADX: {
      name: "ADX",
      fullName: "Abu Dhabi Securities Exchange",
      website: "https://www.adx.ae",
      currency: "AED",
      timezone: "GST (UTC+4)",
      tradingHours: "10:00 AM - 2:00 PM (Sun-Thu)",
      established: 2000,
    },
    DFM: {
      name: "DFM",
      fullName: "Dubai Financial Market",
      website: "https://www.dfm.ae",
      currency: "AED",
      timezone: "GST (UTC+4)",
      tradingHours: "10:00 AM - 2:00 PM (Sun-Thu)",
      established: 2000,
    },
  },
  apiProviders: [
    {
      name: "Dubai Pulse Open API",
      type: "free",
      coverage: ["DFM"],
      features: ["DFM Indices", "Market Summary", "OAuth Authentication"],
      url: "https://www.dubaipulse.gov.ae/data/dfm-general/dfm_indices-open-api",
    },
    {
      name: "DFM Native API",
      type: "free",
      coverage: ["DFM"],
      features: ["SOAP/XML Format", "Market Summary", "Real-time Prices"],
      url: "https://api.dfm.ae",
    },
    {
      name: "Twelve Data",
      type: "premium",
      coverage: ["ADX", "DFM"],
      features: ["REST API", "Real-time & Historical", "Analyst Ratings"],
      url: "https://twelvedata.com",
    },
    {
      name: "ICE Data Services",
      type: "premium",
      coverage: ["ADX", "DFM"],
      features: ["Native & Normalized Feed", "Level 1 & 2", "Historical Data"],
      url: "https://developer.ice.com",
    },
    {
      name: "LSEG (Refinitiv)",
      type: "premium",
      coverage: ["ADX", "DFM"],
      features: ["Low Latency Feed", "Market Depth", "Full Tick History"],
      url: "https://www.lseg.com",
    },
  ],
  regulatoryAuthority: "UAE Securities and Commodities Authority (SCA)",
  notes:
    "UAE markets operate Sunday-Thursday. First exchange globally to operate under Islamic Sharia principles (DFM).",
};

// Demo data generation functions removed
// Connector now returns live API data or empty arrays when API key not configured

interface DubaiPulseIndexResponse {
  data?: {
    records?: Array<{
      Index_Name?: string;
      Index_Value?: string | number;
      Trade_Date?: string;
      Change?: string | number;
      Change_Percentage?: string | number;
      Volume?: string | number;
      Value?: string | number;
    }>;
  };
}

class UAEMarketsConnector {
  private stocksCache = new ApiCache<UAEStock[]>({
    freshDuration: 60 * 1000,
    staleDuration: 30 * 60 * 1000,
  });
  private summaryCache = new ApiCache<UAEMarketSummary[]>({
    freshDuration: 60 * 1000,
    staleDuration: 30 * 60 * 1000,
  });
  private apiCallCount = 0;
  private lastApiCallTime: Date | null = null;
  private usingLiveData = false;

  /**
   * Fetch DFM index data from Dubai Pulse Open API
   */
  private async fetchDubaiPulseIndices(): Promise<UAEMarketSummary | null> {
    if (USE_DEMO_DATA) {
      return null;
    }

    try {
      this.apiCallCount++;
      this.lastApiCallTime = new Date();

      const url = `${DUBAI_PULSE_BASE_URL}/data/dfm-general/dfm-indices`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${DUBAI_PULSE_API_KEY}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        log.warn("UAEMarkets", `Dubai Pulse API returned ${response.status}`);
        return null;
      }

      const data: DubaiPulseIndexResponse = await response.json();
      const records = data?.data?.records;

      if (!records || records.length === 0) {
        log.warn("UAEMarkets", "No records in Dubai Pulse response");
        return null;
      }

      // Use the most recent record (usually first)
      const record = records[0];

      const indexValue = parseFloat(String(record.Index_Value || 0));
      const change = parseFloat(String(record.Change || 0));
      const changePercent = parseFloat(String(record.Change_Percentage || 0));
      const volume = parseFloat(String(record.Volume || 0));
      const value = parseFloat(String(record.Value || 0));

      this.usingLiveData = true;

      return {
        exchange: "DFM",
        indexName: record.Index_Name || "DFM General Index",
        indexValue,
        change,
        changePercent,
        tradingValue: value,
        tradingVolume: volume,
        advancers: 0, // Not provided by this API
        decliners: 0,
        unchanged: 0,
        lastUpdated: record.Trade_Date || new Date().toISOString(),
      };
    } catch (error) {
      log.error("UAEMarkets", `Failed to fetch Dubai Pulse data: ${error}`);
      this.usingLiveData = false;
      return null;
    }
  }

  /**
   * Fetch stocks with live API integration
   * Returns empty array when API key not configured
   */
  async getTopStocks(exchange?: "ADX" | "DFM"): Promise<UAEStock[]> {
    const cacheKey = `stocks_${exchange || "all"}`;
    const cached = this.stocksCache.get(cacheKey);

    if (cached?.isFresh) {
      return cached.data;
    }

    // Note: Dubai Pulse free tier doesn't provide individual stock data
    // Would need DFM Native API or premium provider (Twelve Data, ICE, LSEG) for stock-level data
    if (!DUBAI_PULSE_API_KEY) {
      log.info(
        "UAEMarkets",
        "UAE_MARKETS_API_KEY not configured - returning empty stock list"
      );
      return [];
    }

    log.info(
      "UAEMarkets",
      "Live stock data requires DFM Native API or premium provider (Twelve Data, ICE Data Services, LSEG)"
    );

    // Return empty array - stock data not available in free tier
    const stocks: UAEStock[] = [];
    this.stocksCache.set(cacheKey, stocks);
    return stocks;
  }

  /**
   * Fetch market summary with live API integration
   * Returns only live data from Dubai Pulse API or empty array
   */
  async getMarketSummary(
    exchange?: "ADX" | "DFM"
  ): Promise<UAEMarketSummary[]> {
    const cacheKey = `summary_${exchange || "all"}`;
    const cached = this.summaryCache.get(cacheKey);

    if (cached?.isFresh) {
      return cached.data;
    }

    if (!DUBAI_PULSE_API_KEY) {
      log.info(
        "UAEMarkets",
        "UAE_MARKETS_API_KEY not configured - returning empty market summary"
      );
      return [];
    }

    let summaries: UAEMarketSummary[] = [];

    // Try to fetch live DFM data from Dubai Pulse
    if (!exchange || exchange === "DFM") {
      const liveDfmData = await this.fetchDubaiPulseIndices();
      if (liveDfmData) {
        summaries.push(liveDfmData);
        log.info("UAEMarkets", "Using live DFM data from Dubai Pulse API");
      }
    }

    // Note: ADX data not available via free Dubai Pulse API
    // For ADX market summary, would need premium data provider
    if (!exchange || exchange === "ADX") {
      log.info(
        "UAEMarkets",
        "ADX market summary requires premium data provider (Twelve Data, ICE Data Services, LSEG)"
      );
    }

    // Filter by exchange if specified
    if (exchange) {
      summaries = summaries.filter((s) => s.exchange === exchange);
    }

    this.summaryCache.set(cacheKey, summaries);
    return summaries;
  }

  getMarketInfo(): UAEMarketInfo {
    return { ...UAE_MARKET_INFO };
  }

  getConnectionStatus(): {
    connected: boolean;
    dataSource: "live" | "unavailable";
    cacheSize: number;
    apiCallCount: number;
    lastApiCall: string | null;
    apiConfigured: boolean;
  } {
    return {
      connected: !!DUBAI_PULSE_API_KEY,
      dataSource: this.usingLiveData ? "live" : "unavailable",
      cacheSize: this.stocksCache.size() + this.summaryCache.size(),
      apiCallCount: this.apiCallCount,
      lastApiCall: this.lastApiCallTime?.toISOString() || null,
      apiConfigured: !!DUBAI_PULSE_API_KEY,
    };
  }

  clearCache(): void {
    this.stocksCache.clear();
    this.summaryCache.clear();
  }
}

export const uaeMarkets = new UAEMarketsConnector();
