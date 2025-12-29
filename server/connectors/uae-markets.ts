import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";

// Dubai Pulse API Configuration
const DUBAI_PULSE_API_KEY = process.env.UAE_MARKETS_API_KEY || "";
const DUBAI_PULSE_BASE_URL = "https://api.dubaipulse.gov.ae";
const USE_DEMO_DATA =
  !DUBAI_PULSE_API_KEY || process.env.UAE_MARKETS_USE_DEMO === "true";

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

interface UAEStockBase {
  symbol: string;
  name: string;
  exchange: "ADX" | "DFM";
  sector: string;
  basePrice: number;
  baseChange: number;
  baseChangePercent: number;
  baseVolume: number;
  marketCap?: number;
  currency: string;
}

interface UAEMarketSummaryBase {
  exchange: "ADX" | "DFM";
  indexName: string;
  baseIndexValue: number;
  baseChange: number;
  baseChangePercent: number;
  baseTradingValue: number;
  baseTradingVolume: number;
  advancers: number;
  decliners: number;
  unchanged: number;
}

const UAE_STOCK_TEMPLATES: UAEStockBase[] = [
  {
    symbol: "ADNOCDIST",
    name: "ADNOC Distribution",
    exchange: "ADX",
    sector: "Energy",
    basePrice: 4.28,
    baseChange: 0.08,
    baseChangePercent: 1.9,
    baseVolume: 12500000,
    marketCap: 53500000000,
    currency: "AED",
  },
  {
    symbol: "ETISALAT",
    name: "Emirates Telecommunications (Etisalat)",
    exchange: "ADX",
    sector: "Telecommunications",
    basePrice: 25.5,
    baseChange: -0.2,
    baseChangePercent: -0.78,
    baseVolume: 3200000,
    marketCap: 221000000000,
    currency: "AED",
  },
  {
    symbol: "FAB",
    name: "First Abu Dhabi Bank",
    exchange: "ADX",
    sector: "Financials",
    basePrice: 13.8,
    baseChange: 0.15,
    baseChangePercent: 1.1,
    baseVolume: 8500000,
    marketCap: 152000000000,
    currency: "AED",
  },
  {
    symbol: "ADCB",
    name: "Abu Dhabi Commercial Bank",
    exchange: "ADX",
    sector: "Financials",
    basePrice: 9.45,
    baseChange: 0.05,
    baseChangePercent: 0.53,
    baseVolume: 5600000,
    marketCap: 65000000000,
    currency: "AED",
  },
  {
    symbol: "ALDAR",
    name: "Aldar Properties",
    exchange: "ADX",
    sector: "Real Estate",
    basePrice: 6.82,
    baseChange: 0.12,
    baseChangePercent: 1.79,
    baseVolume: 15200000,
    marketCap: 54000000000,
    currency: "AED",
  },
  {
    symbol: "EMAAR",
    name: "Emaar Properties",
    exchange: "DFM",
    sector: "Real Estate",
    basePrice: 9.15,
    baseChange: 0.25,
    baseChangePercent: 2.81,
    baseVolume: 22000000,
    marketCap: 80000000000,
    currency: "AED",
  },
  {
    symbol: "DIB",
    name: "Dubai Islamic Bank",
    exchange: "DFM",
    sector: "Financials",
    basePrice: 6.2,
    baseChange: -0.05,
    baseChangePercent: -0.8,
    baseVolume: 9800000,
    marketCap: 45000000000,
    currency: "AED",
  },
  {
    symbol: "EMIRATESNBD",
    name: "Emirates NBD",
    exchange: "DFM",
    sector: "Financials",
    basePrice: 18.9,
    baseChange: 0.3,
    baseChangePercent: 1.61,
    baseVolume: 4500000,
    marketCap: 118000000000,
    currency: "AED",
  },
  {
    symbol: "DU",
    name: "Emirates Integrated Telecommunications (du)",
    exchange: "DFM",
    sector: "Telecommunications",
    basePrice: 6.75,
    baseChange: 0.1,
    baseChangePercent: 1.5,
    baseVolume: 3200000,
    marketCap: 30000000000,
    currency: "AED",
  },
  {
    symbol: "DEWA",
    name: "Dubai Electricity & Water Authority",
    exchange: "DFM",
    sector: "Utilities",
    basePrice: 2.58,
    baseChange: 0.02,
    baseChangePercent: 0.78,
    baseVolume: 18500000,
    marketCap: 130000000000,
    currency: "AED",
  },
];

const UAE_SUMMARY_TEMPLATES: UAEMarketSummaryBase[] = [
  {
    exchange: "ADX",
    indexName: "ADX General Index",
    baseIndexValue: 9856.42,
    baseChange: 45.23,
    baseChangePercent: 0.46,
    baseTradingValue: 1250000000,
    baseTradingVolume: 285000000,
    advancers: 32,
    decliners: 18,
    unchanged: 8,
  },
  {
    exchange: "DFM",
    indexName: "DFM General Index",
    baseIndexValue: 4285.67,
    baseChange: -12.35,
    baseChangePercent: -0.29,
    baseTradingValue: 890000000,
    baseTradingVolume: 195000000,
    advancers: 22,
    decliners: 28,
    unchanged: 12,
  },
];

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

function generateDemoStocks(): UAEStock[] {
  const now = new Date().toISOString();
  return UAE_STOCK_TEMPLATES.map((template) => ({
    symbol: template.symbol,
    name: template.name,
    exchange: template.exchange,
    sector: template.sector,
    currentPrice: template.basePrice,
    change: template.baseChange,
    changePercent: template.baseChangePercent,
    volume: template.baseVolume,
    marketCap: template.marketCap,
    currency: template.currency,
    lastUpdated: now,
  }));
}

function generateDemoSummaries(): UAEMarketSummary[] {
  const now = new Date().toISOString();
  return UAE_SUMMARY_TEMPLATES.map((template) => ({
    exchange: template.exchange,
    indexName: template.indexName,
    indexValue: template.baseIndexValue,
    change: template.baseChange,
    changePercent: template.baseChangePercent,
    tradingValue: template.baseTradingValue,
    tradingVolume: template.baseTradingVolume,
    advancers: template.advancers,
    decliners: template.decliners,
    unchanged: template.unchanged,
    lastUpdated: now,
  }));
}

export interface UAEMarketsConfig {
  useDemoData?: boolean;
}

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
   */
  async getTopStocks(exchange?: "ADX" | "DFM"): Promise<UAEStock[]> {
    const cacheKey = `stocks_${exchange || "all"}`;
    const cached = this.stocksCache.get(cacheKey);

    if (cached?.isFresh) {
      return cached.data;
    }

    // Try to fetch live data if configured for DFM
    if (exchange === "DFM" && !USE_DEMO_DATA) {
      // Note: Dubai Pulse doesn't provide individual stock data in the free tier
      // Would need DFM Native API or premium provider for stock-level data
      log.info(
        "UAEMarkets",
        "Live stock data requires DFM Native API or premium provider"
      );
    }

    // Fallback to demo data
    let stocks = generateDemoStocks();

    if (exchange) {
      stocks = stocks.filter((s) => s.exchange === exchange);
    }

    this.stocksCache.set(cacheKey, stocks);
    return stocks;
  }

  /**
   * Fetch market summary with live API integration
   */
  async getMarketSummary(
    exchange?: "ADX" | "DFM"
  ): Promise<UAEMarketSummary[]> {
    const cacheKey = `summary_${exchange || "all"}`;
    const cached = this.summaryCache.get(cacheKey);

    if (cached?.isFresh) {
      return cached.data;
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

    // Fallback to demo data for missing exchanges
    const demoSummaries = generateDemoSummaries();

    if (summaries.length === 0) {
      // No live data, use all demo data
      summaries = demoSummaries;
    } else if (!exchange) {
      // Live DFM data but need ADX demo data
      const adxDemo = demoSummaries.find((s) => s.exchange === "ADX");
      if (adxDemo) {
        summaries.push(adxDemo);
      }
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
    dataSource: "live" | "demo";
    cacheSize: number;
    isMockData: boolean;
    isDemoData: boolean;
    apiCallCount?: number;
    lastApiCall?: string | null;
    apiConfigured: boolean;
  } {
    return {
      connected: true,
      dataSource: this.usingLiveData ? "live" : "demo",
      cacheSize: this.stocksCache.size() + this.summaryCache.size(),
      isMockData: !this.usingLiveData,
      isDemoData: !this.usingLiveData,
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
