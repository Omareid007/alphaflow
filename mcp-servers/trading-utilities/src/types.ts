// Trading Utilities MCP Server Type Definitions

export interface Position {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  side: "long" | "short";
  assetClass: string;
}

export interface RiskMetrics {
  totalEquity: number;
  totalPositionValue: number;
  buyingPower: number;
  cashBalance: number;

  // Concentration metrics
  maxPositionConcentration: number;
  maxPositionSymbol: string;
  concentrationBreached: boolean;

  // Sector exposure
  sectorExposure: Record<string, number>;
  maxSectorExposure: number;
  maxSectorName: string;
  sectorBreached: boolean;

  // Risk indicators
  portfolioVaR95: number; // 95% Value at Risk
  portfolioVaR99: number; // 99% Value at Risk
  currentDrawdown: number;
  peakEquity: number;

  // Overall status
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  alerts: string[];
}

export interface OrderValidation {
  isValid: boolean;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  estimatedValue: number;

  // Validation checks
  checks: {
    marketOpen: boolean;
    symbolTradable: boolean;
    sufficientBuyingPower: boolean;
    positionLimitOk: boolean;
    sectorLimitOk: boolean;
    circuitBreakerOk: boolean;
    dailyLossLimitOk: boolean;
  };

  // If invalid, why
  failureReasons: string[];

  // Recommendations
  recommendations: string[];
}

export interface MarketStatus {
  isOpen: boolean;
  currentTime: string;
  nextOpen: string | null;
  nextClose: string | null;
  timeUntilChange: string;

  // Extended hours
  preMarketOpen: boolean;
  afterMarketOpen: boolean;

  // Asset classes availability
  equitiesTrading: boolean;
  cryptoTrading: boolean;
}

export interface CircuitBreakerStatus {
  isOpen: boolean;
  openedAt: string | null;
  reason: string | null;
  failureCount: number;
  lastFailure: string | null;
  cooldownRemaining: number;
  canTrade: boolean;
}

export interface AlpacaAccount {
  equity: string;
  buying_power: string;
  cash: string;
  portfolio_value: string;
  last_equity: string;
  status: string;
}

export interface AlpacaPosition {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  side: string;
  asset_class: string;
}

export interface AlpacaClock {
  timestamp: string;
  is_open: boolean;
  next_open: string;
  next_close: string;
}

// Risk thresholds (configurable)
export const RISK_THRESHOLDS = {
  MAX_POSITION_CONCENTRATION: 0.05, // 5% max per position
  MAX_SECTOR_EXPOSURE: 0.25, // 25% max per sector
  MAX_DAILY_DRAWDOWN: 0.05, // 5% max daily loss
  WARNING_THRESHOLD: 0.8, // 80% of limit triggers warning
  CRITICAL_THRESHOLD: 0.95, // 95% of limit is critical
};

// Sector mappings for major symbols
export const SECTOR_MAP: Record<string, string> = {
  // Technology
  AAPL: "Technology",
  MSFT: "Technology",
  GOOGL: "Technology",
  GOOG: "Technology",
  META: "Technology",
  NVDA: "Technology",
  AMD: "Technology",
  INTC: "Technology",
  CRM: "Technology",
  ORCL: "Technology",
  ADBE: "Technology",
  CSCO: "Technology",

  // Financial
  JPM: "Financial",
  BAC: "Financial",
  GS: "Financial",
  MS: "Financial",
  WFC: "Financial",
  C: "Financial",
  AXP: "Financial",
  V: "Financial",
  MA: "Financial",

  // Healthcare
  JNJ: "Healthcare",
  UNH: "Healthcare",
  PFE: "Healthcare",
  MRK: "Healthcare",
  ABBV: "Healthcare",
  LLY: "Healthcare",
  TMO: "Healthcare",

  // Consumer
  AMZN: "Consumer",
  TSLA: "Consumer",
  HD: "Consumer",
  NKE: "Consumer",
  MCD: "Consumer",
  SBUX: "Consumer",
  WMT: "Consumer",
  COST: "Consumer",

  // Energy
  XOM: "Energy",
  CVX: "Energy",
  COP: "Energy",
  SLB: "Energy",
  EOG: "Energy",

  // Industrial
  CAT: "Industrial",
  BA: "Industrial",
  GE: "Industrial",
  HON: "Industrial",
  UPS: "Industrial",
  UNP: "Industrial",
  DE: "Industrial",

  // Communications
  VZ: "Communications",
  T: "Communications",
  NFLX: "Communications",
  DIS: "Communications",
  CMCSA: "Communications",

  // ETFs (by type)
  SPY: "ETF-Broad",
  QQQ: "ETF-Tech",
  IWM: "ETF-SmallCap",
  DIA: "ETF-Broad",
  XLF: "ETF-Financial",
  XLE: "ETF-Energy",
  XLK: "ETF-Tech",
  XLV: "ETF-Healthcare",
};
