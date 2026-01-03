export type BacktestStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED";

export type ExecutionPriceRule = "NEXT_OPEN" | "NEXT_CLOSE";

export interface FeesModel {
  type: "fixed" | "percentage";
  value: number;
}

export interface SlippageModel {
  type: "bps" | "spread_proxy";
  value: number;
}

export interface DataProvenance {
  provider: "alpaca" | "polygon" | "cache";
  cacheHitRate: number;
  dataPulledAt: string;
  barsCountBySymbol: Record<string, number>;
  timeframe: string;
  dateRange: { start: string; end: string };
  nextPageTokensUsed?: number;
}

export interface BacktestResultsSummary {
  cagr: number | null;
  totalReturnPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  calmarRatio: number | null;
  winRatePct: number;
  totalTrades: number;
  profitFactor: number | null;
  avgWinPct: number;
  avgLossPct: number;
  expectancy: number | null;
  tradesPerMonth: number | null;
  avgHoldingPeriodDays: number | null;
}

export interface BacktestRun {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: BacktestStatus;
  strategyId: string | null;
  strategyConfigHash: string;
  strategyConfig: Record<string, unknown>;
  universe: string[];
  broker: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialCash: number;
  feesModel: FeesModel;
  slippageModel: SlippageModel;
  executionPriceRule: ExecutionPriceRule;
  dataSource: string;
  provenance: DataProvenance | null;
  resultsSummary: BacktestResultsSummary | null;
  errorMessage: string | null;
  runtimeMs: number | null;
}

export interface BacktestTradeEvent {
  id: string;
  runId: string;
  ts: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  reason: string;
  orderType: string;
  fees: number;
  slippage: number;
  positionAfter: number;
  cashAfter: number;
}

export interface BacktestEquityPoint {
  runId: string;
  ts: string;
  equity: number;
  cash: number;
  exposure: number;
}
