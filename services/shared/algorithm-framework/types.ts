/**
 * AI Active Trader - Algorithm Framework Types
 * QuantConnect LEAN-inspired modular trading pipeline
 */

export interface Security {
  symbol: string;
  exchange: string;
  assetType: 'equity' | 'crypto' | 'forex' | 'option' | 'future';
  price: number;
  volume: number;
  marketCap?: number;
  sector?: string;
  industry?: string;
  fundamentals?: SecurityFundamentals;
  technicals?: SecurityTechnicals;
}

export interface SecurityFundamentals {
  peRatio?: number;
  pbRatio?: number;
  dividendYield?: number;
  earningsGrowth?: number;
  revenueGrowth?: number;
  debtToEquity?: number;
  returnOnEquity?: number;
  freeCashFlow?: number;
}

export interface SecurityTechnicals {
  sma20?: number;
  sma50?: number;
  sma200?: number;
  rsi14?: number;
  macdLine?: number;
  macdSignal?: number;
  atr14?: number;
  bollingerUpper?: number;
  bollingerLower?: number;
  volatility30d?: number;
}

export interface Insight {
  id: string;
  symbol: string;
  direction: 'up' | 'down' | 'flat';
  magnitude: number;
  confidence: number;
  period: number;
  source: string;
  generatedAt: Date;
  closeTimeUtc?: Date;
  weight?: number;
  tag?: string;
}

export interface PortfolioTarget {
  symbol: string;
  quantity: number;
  direction: 'long' | 'short' | 'flat';
  weight?: number;
  holdingCost?: number;
}

export interface OrderTicket {
  id: string;
  symbol: string;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  status: 'pending' | 'submitted' | 'partial' | 'filled' | 'cancelled' | 'rejected';
  filledQuantity: number;
  averagePrice: number;
  submittedAt: Date;
  filledAt?: Date;
  tag?: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  averageCost: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  side: 'long' | 'short';
}

export interface Portfolio {
  cash: number;
  equity: number;
  margin: number;
  buyingPower: number;
  positions: Map<string, Position>;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
}

export interface RiskMetrics {
  portfolioBeta: number;
  portfolioVolatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
  valueAtRisk95: number;
  valueAtRisk99: number;
  concentration: number;
  correlationRisk: number;
}

export interface AlgorithmState {
  securities: Map<string, Security>;
  universe: Set<string>;
  insights: Insight[];
  targets: PortfolioTarget[];
  orders: OrderTicket[];
  portfolio: Portfolio;
  riskMetrics: RiskMetrics;
  parameters: Record<string, unknown>;
  warmupComplete: boolean;
  tradingEnabled: boolean;
}

export interface AlgorithmContext {
  currentTime: Date;
  state: AlgorithmState;
  logger: {
    debug: (msg: string, meta?: Record<string, unknown>) => void;
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

export interface UniverseSelectionResult {
  additions: string[];
  removals: string[];
}

export interface AlphaResult {
  insights: Insight[];
}

export interface PortfolioConstructionResult {
  targets: PortfolioTarget[];
}

export interface ExecutionResult {
  orders: OrderTicket[];
}

export interface RiskManagementResult {
  adjustedTargets: PortfolioTarget[];
  riskAlerts: RiskAlert[];
}

export interface RiskAlert {
  level: 'info' | 'warning' | 'critical';
  type: 'drawdown' | 'concentration' | 'volatility' | 'correlation' | 'position_size' | 'daily_loss';
  message: string;
  metric: number;
  threshold: number;
  action?: 'reduce' | 'hedge' | 'liquidate' | 'pause';
}
