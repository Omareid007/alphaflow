export interface AlpacaTradeRequest {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  strategyId?: string;
  notes?: string;
  orderType?: "market" | "limit";
  limitPrice?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  useBracketOrder?: boolean;
  trailingStopPercent?: number;
  extendedHours?: boolean;
  /**
   * SECURITY: Only the work queue processor should set this to true.
   * When orchestratorControlEnabled is true, trades are only allowed if this flag is true.
   * This prevents bypass attacks via notes manipulation.
   */
  authorizedByOrchestrator?: boolean;
}

export interface TargetAllocation {
  symbol: string;
  targetPercent: number;
}

export interface CurrentAllocation {
  symbol: string;
  currentPercent: number;
  currentValue: number;
  quantity: number;
  price: number;
}

export interface RebalanceTrade {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  estimatedValue: number;
  currentPercent: number;
  targetPercent: number;
  reason: string;
}

export interface RebalancePreview {
  currentAllocations: CurrentAllocation[];
  targetAllocations: TargetAllocation[];
  proposedTrades: RebalanceTrade[];
  portfolioValue: number;
  cashAvailable: number;
  cashAfterRebalance: number;
  estimatedTradingCost: number;
}

export interface RebalanceResult {
  success: boolean;
  tradesExecuted: Array<{
    symbol: string;
    side: string;
    quantity: number;
    status: string;
    orderId?: string;
    error?: string;
  }>;
  errors: string[];
  portfolioValueBefore: number;
  portfolioValueAfter: number;
}

export interface AlpacaTradeResult {
  success: boolean;
  order?: import("../connectors/alpaca").AlpacaOrder;
  trade?: import("@shared/schema").Trade;
  error?: string;
}

export interface StrategyRunState {
  strategyId: string;
  isRunning: boolean;
  lastCheck?: Date;
  lastDecision?: import("../ai/decision-engine").AIDecision;
  error?: string;
}
