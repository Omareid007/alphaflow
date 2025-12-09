import { ApiCache } from "../lib/api-cache";

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
    baseChangePercent: 1.90,
    baseVolume: 12500000,
    marketCap: 53500000000,
    currency: "AED",
  },
  {
    symbol: "ETISALAT",
    name: "Emirates Telecommunications (Etisalat)",
    exchange: "ADX",
    sector: "Telecommunications",
    basePrice: 25.50,
    baseChange: -0.20,
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
    basePrice: 13.80,
    baseChange: 0.15,
    baseChangePercent: 1.10,
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
    basePrice: 6.20,
    baseChange: -0.05,
    baseChangePercent: -0.80,
    baseVolume: 9800000,
    marketCap: 45000000000,
    currency: "AED",
  },
  {
    symbol: "EMIRATESNBD",
    name: "Emirates NBD",
    exchange: "DFM",
    sector: "Financials",
    basePrice: 18.90,
    baseChange: 0.30,
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
    baseChange: 0.10,
    baseChangePercent: 1.50,
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
  notes: "UAE markets operate Sunday-Thursday. First exchange globally to operate under Islamic Sharia principles (DFM).",
};

function generateMockStocks(): UAEStock[] {
  const now = new Date().toISOString();
  return UAE_STOCK_TEMPLATES.map(template => ({
    symbol: template.symbol,
    name: template.name,
    exchange: template.exchange,
    sector: template.sector,
    currentPrice: Number((template.basePrice * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
    change: Number((template.baseChange + (Math.random() - 0.5) * 0.1).toFixed(3)),
    changePercent: Number((template.baseChangePercent + (Math.random() - 0.5) * 0.3).toFixed(2)),
    volume: Math.floor(template.baseVolume * (0.85 + Math.random() * 0.3)),
    marketCap: template.marketCap,
    currency: template.currency,
    lastUpdated: now,
  }));
}

function generateMockSummaries(): UAEMarketSummary[] {
  const now = new Date().toISOString();
  return UAE_SUMMARY_TEMPLATES.map(template => ({
    exchange: template.exchange,
    indexName: template.indexName,
    indexValue: Number((template.baseIndexValue * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2)),
    change: Number((template.baseChange + (Math.random() - 0.5) * 10).toFixed(2)),
    changePercent: Number((template.baseChangePercent + (Math.random() - 0.5) * 0.2).toFixed(2)),
    tradingValue: Math.floor(template.baseTradingValue * (0.9 + Math.random() * 0.2)),
    tradingVolume: Math.floor(template.baseTradingVolume * (0.9 + Math.random() * 0.2)),
    advancers: template.advancers + Math.floor((Math.random() - 0.5) * 6),
    decliners: template.decliners + Math.floor((Math.random() - 0.5) * 6),
    unchanged: template.unchanged + Math.floor((Math.random() - 0.5) * 4),
    lastUpdated: now,
  }));
}

export interface UAEMarketsConfig {
  useMockData?: boolean;
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

  private config: UAEMarketsConfig;

  constructor(config: UAEMarketsConfig = {}) {
    this.config = {
      useMockData: config.useMockData ?? true,
    };
  }

  async getTopStocks(exchange?: "ADX" | "DFM"): Promise<UAEStock[]> {
    const cacheKey = `stocks_${exchange || "all"}`;
    const cached = this.stocksCache.get(cacheKey);
    
    if (cached?.isFresh) {
      return cached.data;
    }

    let stocks: UAEStock[];
    
    if (this.config.useMockData) {
      stocks = generateMockStocks();
    } else {
      stocks = generateMockStocks();
    }

    if (exchange) {
      stocks = stocks.filter(s => s.exchange === exchange);
    }

    this.stocksCache.set(cacheKey, stocks);
    return stocks;
  }

  async getMarketSummary(exchange?: "ADX" | "DFM"): Promise<UAEMarketSummary[]> {
    const cacheKey = `summary_${exchange || "all"}`;
    const cached = this.summaryCache.get(cacheKey);
    
    if (cached?.isFresh) {
      return cached.data;
    }

    let summaries: UAEMarketSummary[];
    
    if (this.config.useMockData) {
      summaries = generateMockSummaries();
    } else {
      summaries = generateMockSummaries();
    }

    if (exchange) {
      summaries = summaries.filter(s => s.exchange === exchange);
    }

    this.summaryCache.set(cacheKey, summaries);
    return summaries;
  }

  getMarketInfo(): UAEMarketInfo {
    return { ...UAE_MARKET_INFO };
  }

  getConnectionStatus(): { 
    connected: boolean; 
    dataSource: "mock" | "live"; 
    cacheSize: number;
    apiConfigured: boolean;
    isMockData: boolean;
  } {
    return {
      connected: true,
      dataSource: this.config.useMockData ? "mock" : "live",
      cacheSize: this.stocksCache.size() + this.summaryCache.size(),
      apiConfigured: !this.config.useMockData,
      isMockData: this.config.useMockData ?? true,
    };
  }

  clearCache(): void {
    this.stocksCache.clear();
    this.summaryCache.clear();
  }
}

export const uaeMarkets = new UAEMarketsConnector({ useMockData: true });
