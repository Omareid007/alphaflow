/**
 * AI Active Trader - Event Type Definitions
 * Shared event schemas for microservices communication via NATS JetStream
 */

// Base event metadata present on all events
export interface EventMetadata {
  eventId: string;
  eventType: string;
  timestamp: string;
  version: string;
  source: string;
  correlationId?: string;
  causationId?: string;
}

// Saga correlation for distributed transactions
export interface SagaCorrelation {
  correlationId: string;
  causationId: string | null;
  sagaType: string;
  step: number;
  totalSteps: number;
  startedAt: string;
  timeout: number;
}

// =============================================================================
// Market Data Events
// =============================================================================

export interface MarketQuoteReceived {
  metadata: EventMetadata;
  payload: {
    symbol: string;
    bidPrice: number;
    askPrice: number;
    bidSize: number;
    askSize: number;
    timestamp: string;
  };
}

export interface MarketBarReceived {
  metadata: EventMetadata;
  payload: {
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: string;
    timeframe: '1m' | '5m' | '15m' | '1h' | '1d';
  };
}

export interface MarketNewsReceived {
  metadata: EventMetadata;
  payload: {
    symbol: string;
    headline: string;
    summary: string;
    source: string;
    url: string;
    sentiment?: number;
    publishedAt: string;
  };
}

// =============================================================================
// Trade Events
// =============================================================================

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderStatus = 'pending' | 'new' | 'filled' | 'partial' | 'canceled' | 'rejected';
export type TimeInForce = 'day' | 'gtc' | 'ioc' | 'fok';

export interface TradeOrderSubmitted {
  metadata: EventMetadata;
  payload: {
    orderId: string;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    limitPrice?: number;
    stopPrice?: number;
    timeInForce: TimeInForce;
    decisionId?: string;
  };
}

export interface TradeOrderFilled {
  metadata: EventMetadata;
  payload: {
    orderId: string;
    symbol: string;
    side: OrderSide;
    quantity: number;
    filledQuantity: number;
    averagePrice: number;
    commission: number;
    filledAt: string;
  };
}

export interface TradeOrderCanceled {
  metadata: EventMetadata;
  payload: {
    orderId: string;
    symbol: string;
    reason: string;
    canceledAt: string;
  };
}

export interface TradeOrderRejected {
  metadata: EventMetadata;
  payload: {
    orderId: string;
    symbol: string;
    reason: string;
    rejectedAt: string;
  };
}

export interface TradePositionOpened {
  metadata: EventMetadata;
  payload: {
    positionId: string;
    symbol: string;
    side: OrderSide;
    quantity: number;
    entryPrice: number;
    openedAt: string;
  };
}

export interface TradePositionClosed {
  metadata: EventMetadata;
  payload: {
    positionId: string;
    symbol: string;
    side: OrderSide;
    quantity: number;
    entryPrice: number;
    exitPrice: number;
    realizedPnl: number;
    closedAt: string;
  };
}

export interface TradePositionUpdated {
  metadata: EventMetadata;
  payload: {
    positionId: string;
    symbol: string;
    quantity: number;
    currentPrice: number;
    unrealizedPnl: number;
    updatedAt: string;
  };
}

// =============================================================================
// AI Decision Events
// =============================================================================

export type AIAction = 'buy' | 'sell' | 'hold';

export interface AIDecisionGenerated {
  metadata: EventMetadata;
  payload: {
    decisionId: string;
    symbol: string;
    action: AIAction;
    confidence: number;
    reasoning: string[];
    alternatives: Array<{
      action: AIAction;
      confidence: number;
    }>;
    dataQuality: number;
    modelUsed: string;
    generatedAt: string;
  };
}

export interface AIAnalysisRequested {
  metadata: EventMetadata;
  payload: {
    requestId: string;
    symbol: string;
    analysisType: 'full' | 'quick' | 'sentiment';
    priority: 'high' | 'normal' | 'low';
    requestedAt: string;
  };
}

export interface AIModelSwitched {
  metadata: EventMetadata;
  payload: {
    previousModel: string;
    newModel: string;
    reason: 'fallback' | 'cost' | 'performance';
    switchedAt: string;
  };
}

// =============================================================================
// Analytics Events
// =============================================================================

export interface AnalyticsPnlCalculated {
  metadata: EventMetadata;
  payload: {
    portfolioId: string;
    realizedPnl: number;
    unrealizedPnl: number;
    totalPnl: number;
    dailyReturn: number;
    calculatedAt: string;
  };
}

export interface AnalyticsSnapshotCreated {
  metadata: EventMetadata;
  payload: {
    snapshotId: string;
    portfolioValue: number;
    cashBalance: number;
    positionCount: number;
    buyingPower: number;
    createdAt: string;
  };
}

// =============================================================================
// Orchestrator Events
// =============================================================================

export interface OrchestratorCycleStarted {
  metadata: EventMetadata;
  payload: {
    cycleId: string;
    cycleType: 'analysis' | 'heartbeat' | 'rebalance';
    symbols: string[];
    startedAt: string;
  };
}

export interface OrchestratorCycleCompleted {
  metadata: EventMetadata;
  payload: {
    cycleId: string;
    cycleType: 'analysis' | 'heartbeat' | 'rebalance';
    duration: number;
    decisionsCount: number;
    tradesCount: number;
    completedAt: string;
  };
}

export interface OrchestratorSagaStarted {
  metadata: EventMetadata;
  correlation: SagaCorrelation;
  payload: {
    sagaId: string;
    sagaType: string;
    initialData: Record<string, unknown>;
    startedAt: string;
  };
}

export interface OrchestratorSagaCompleted {
  metadata: EventMetadata;
  correlation: SagaCorrelation;
  payload: {
    sagaId: string;
    sagaType: string;
    result: 'success' | 'failed' | 'compensated';
    duration: number;
    completedAt: string;
  };
}

// =============================================================================
// System Events
// =============================================================================

export interface SystemHealthCheck {
  metadata: EventMetadata;
  payload: {
    service: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    memory: {
      used: number;
      total: number;
    };
    checkedAt: string;
  };
}

export interface SystemAlertTriggered {
  metadata: EventMetadata;
  payload: {
    alertId: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    service: string;
    triggeredAt: string;
  };
}

export interface SystemConfigUpdated {
  metadata: EventMetadata;
  payload: {
    configKey: string;
    previousValue: unknown;
    newValue: unknown;
    updatedBy: string;
    updatedAt: string;
  };
}

// =============================================================================
// Event Type Map
// =============================================================================

export type EventMap = {
  // Market
  'market.quote.received': MarketQuoteReceived;
  'market.bar.received': MarketBarReceived;
  'market.news.received': MarketNewsReceived;
  
  // Trade
  'trade.order.submitted': TradeOrderSubmitted;
  'trade.order.filled': TradeOrderFilled;
  'trade.order.canceled': TradeOrderCanceled;
  'trade.order.rejected': TradeOrderRejected;
  'trade.position.opened': TradePositionOpened;
  'trade.position.closed': TradePositionClosed;
  'trade.position.updated': TradePositionUpdated;
  
  // AI
  'ai.decision.generated': AIDecisionGenerated;
  'ai.analysis.requested': AIAnalysisRequested;
  'ai.model.switched': AIModelSwitched;
  
  // Analytics
  'analytics.pnl.calculated': AnalyticsPnlCalculated;
  'analytics.snapshot.created': AnalyticsSnapshotCreated;
  
  // Orchestrator
  'orchestrator.cycle.started': OrchestratorCycleStarted;
  'orchestrator.cycle.completed': OrchestratorCycleCompleted;
  'orchestrator.saga.started': OrchestratorSagaStarted;
  'orchestrator.saga.completed': OrchestratorSagaCompleted;
  
  // System
  'system.health.check': SystemHealthCheck;
  'system.alert.triggered': SystemAlertTriggered;
  'system.config.updated': SystemConfigUpdated;
};

export type EventType = keyof EventMap;
export type Event<T extends EventType> = EventMap[T];
