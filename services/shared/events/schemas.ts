/**
 * AI Active Trader - Event Schema Validation
 * Zod schemas for validating events before publishing/consuming
 */

import { z } from 'zod';
import { EventType, EventMap } from './types';

export const EventMetadataSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  timestamp: z.string().datetime(),
  version: z.string().min(1),
  source: z.string().min(1),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
});

export const SagaCorrelationSchema = z.object({
  correlationId: z.string().min(1),
  causationId: z.string().nullable(),
  sagaType: z.string().min(1),
  step: z.number().int().positive(),
  totalSteps: z.number().int().positive(),
  startedAt: z.string().datetime(),
  timeout: z.number().int().positive(),
});

export const MarketQuoteReceivedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    symbol: z.string().min(1).max(10),
    bidPrice: z.number().nonnegative(),
    askPrice: z.number().nonnegative(),
    bidSize: z.number().int().nonnegative(),
    askSize: z.number().int().nonnegative(),
    timestamp: z.string().datetime(),
  }),
});

export const MarketBarReceivedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    symbol: z.string().min(1).max(10),
    open: z.number().nonnegative(),
    high: z.number().nonnegative(),
    low: z.number().nonnegative(),
    close: z.number().nonnegative(),
    volume: z.number().int().nonnegative(),
    timestamp: z.string().datetime(),
    timeframe: z.enum(['1m', '5m', '15m', '1h', '1d']),
  }),
});

export const MarketNewsReceivedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    symbol: z.string().min(1),
    headline: z.string().min(1),
    summary: z.string(),
    source: z.string().min(1),
    url: z.string().url(),
    sentiment: z.number().min(-1).max(1).optional(),
    publishedAt: z.string().datetime(),
  }),
});

const OrderSideSchema = z.enum(['buy', 'sell']);
const OrderTypeSchema = z.enum(['market', 'limit', 'stop', 'stop_limit']);
const TimeInForceSchema = z.enum(['day', 'gtc', 'ioc', 'fok']);

export const TradeOrderSubmittedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    orderId: z.string().min(1),
    symbol: z.string().min(1).max(10),
    side: OrderSideSchema,
    type: OrderTypeSchema,
    quantity: z.number().positive(),
    limitPrice: z.number().positive().optional(),
    stopPrice: z.number().positive().optional(),
    timeInForce: TimeInForceSchema,
    decisionId: z.string().optional(),
  }),
});

export const TradeOrderFilledSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    orderId: z.string().min(1),
    symbol: z.string().min(1).max(10),
    side: OrderSideSchema,
    quantity: z.number().positive(),
    filledQuantity: z.number().positive(),
    averagePrice: z.number().positive(),
    commission: z.number().nonnegative(),
    filledAt: z.string().datetime(),
  }),
});

export const TradeOrderCanceledSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    orderId: z.string().min(1),
    symbol: z.string().min(1).max(10),
    reason: z.string().min(1),
    canceledAt: z.string().datetime(),
  }),
});

export const TradeOrderRejectedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    orderId: z.string().min(1),
    symbol: z.string().min(1).max(10),
    reason: z.string().min(1),
    rejectedAt: z.string().datetime(),
  }),
});

export const TradePositionOpenedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    positionId: z.string().min(1),
    symbol: z.string().min(1).max(10),
    side: OrderSideSchema,
    quantity: z.number().positive(),
    entryPrice: z.number().positive(),
    openedAt: z.string().datetime(),
  }),
});

export const TradePositionClosedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    positionId: z.string().min(1),
    symbol: z.string().min(1).max(10),
    side: OrderSideSchema,
    quantity: z.number().positive(),
    entryPrice: z.number().positive(),
    exitPrice: z.number().positive(),
    realizedPnl: z.number(),
    closedAt: z.string().datetime(),
  }),
});

export const TradePositionUpdatedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    positionId: z.string().min(1),
    symbol: z.string().min(1).max(10),
    quantity: z.number().positive(),
    currentPrice: z.number().positive(),
    unrealizedPnl: z.number(),
    updatedAt: z.string().datetime(),
  }),
});

const AIActionSchema = z.enum(['buy', 'sell', 'hold']);

export const AIDecisionGeneratedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    decisionId: z.string().min(1),
    symbol: z.string().min(1).max(10),
    action: AIActionSchema,
    confidence: z.number().min(0).max(1),
    reasoning: z.array(z.string()),
    alternatives: z.array(z.object({
      action: AIActionSchema,
      confidence: z.number().min(0).max(1),
    })),
    dataQuality: z.number().min(0).max(1),
    modelUsed: z.string().min(1),
    generatedAt: z.string().datetime(),
  }),
});

export const AIAnalysisRequestedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    requestId: z.string().min(1),
    symbol: z.string().min(1).max(10),
    analysisType: z.enum(['full', 'quick', 'sentiment']),
    priority: z.enum(['high', 'normal', 'low']),
    requestedAt: z.string().datetime(),
  }),
});

export const AIModelSwitchedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    previousModel: z.string().min(1),
    newModel: z.string().min(1),
    reason: z.enum(['fallback', 'cost', 'performance']),
    switchedAt: z.string().datetime(),
  }),
});

export const AnalyticsPnlCalculatedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    portfolioId: z.string().min(1),
    realizedPnl: z.number(),
    unrealizedPnl: z.number(),
    totalPnl: z.number(),
    dailyReturn: z.number(),
    calculatedAt: z.string().datetime(),
  }),
});

export const AnalyticsSnapshotCreatedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    snapshotId: z.string().min(1),
    portfolioValue: z.number().nonnegative(),
    cashBalance: z.number(),
    positionCount: z.number().int().nonnegative(),
    buyingPower: z.number().nonnegative(),
    createdAt: z.string().datetime(),
  }),
});

export const OrchestratorCycleStartedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    cycleId: z.string().min(1),
    cycleType: z.enum(['analysis', 'heartbeat', 'rebalance']),
    symbols: z.array(z.string().min(1)),
    startedAt: z.string().datetime(),
  }),
});

export const OrchestratorCycleCompletedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    cycleId: z.string().min(1),
    cycleType: z.enum(['analysis', 'heartbeat', 'rebalance']),
    duration: z.number().nonnegative(),
    decisionsCount: z.number().int().nonnegative(),
    tradesCount: z.number().int().nonnegative(),
    completedAt: z.string().datetime(),
  }),
});

export const OrchestratorSagaStartedSchema = z.object({
  metadata: EventMetadataSchema,
  correlation: SagaCorrelationSchema,
  payload: z.object({
    sagaId: z.string().min(1),
    sagaType: z.string().min(1),
    initialData: z.record(z.unknown()),
    startedAt: z.string().datetime(),
  }),
});

export const OrchestratorSagaCompletedSchema = z.object({
  metadata: EventMetadataSchema,
  correlation: SagaCorrelationSchema,
  payload: z.object({
    sagaId: z.string().min(1),
    sagaType: z.string().min(1),
    result: z.enum(['success', 'failed', 'compensated']),
    duration: z.number().nonnegative(),
    completedAt: z.string().datetime(),
  }),
});

export const SystemHealthCheckSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    service: z.string().min(1),
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    uptime: z.number().nonnegative(),
    memory: z.object({
      used: z.number().nonnegative(),
      total: z.number().positive(),
    }),
    checkedAt: z.string().datetime(),
  }),
});

export const SystemAlertTriggeredSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    alertId: z.string().min(1),
    severity: z.enum(['critical', 'warning', 'info']),
    title: z.string().min(1),
    message: z.string().min(1),
    service: z.string().min(1),
    triggeredAt: z.string().datetime(),
  }),
});

export const SystemConfigUpdatedSchema = z.object({
  metadata: EventMetadataSchema,
  payload: z.object({
    configKey: z.string().min(1),
    previousValue: z.unknown(),
    newValue: z.unknown(),
    updatedBy: z.string().min(1),
    updatedAt: z.string().datetime(),
  }),
});

export const EventSchemas: Record<EventType, z.ZodType<any>> = {
  'market.quote.received': MarketQuoteReceivedSchema,
  'market.bar.received': MarketBarReceivedSchema,
  'market.news.received': MarketNewsReceivedSchema,
  'trade.order.submitted': TradeOrderSubmittedSchema,
  'trade.order.filled': TradeOrderFilledSchema,
  'trade.order.canceled': TradeOrderCanceledSchema,
  'trade.order.rejected': TradeOrderRejectedSchema,
  'trade.position.opened': TradePositionOpenedSchema,
  'trade.position.closed': TradePositionClosedSchema,
  'trade.position.updated': TradePositionUpdatedSchema,
  'ai.decision.generated': AIDecisionGeneratedSchema,
  'ai.analysis.requested': AIAnalysisRequestedSchema,
  'ai.model.switched': AIModelSwitchedSchema,
  'analytics.pnl.calculated': AnalyticsPnlCalculatedSchema,
  'analytics.snapshot.created': AnalyticsSnapshotCreatedSchema,
  'orchestrator.cycle.started': OrchestratorCycleStartedSchema,
  'orchestrator.cycle.completed': OrchestratorCycleCompletedSchema,
  'orchestrator.saga.started': OrchestratorSagaStartedSchema,
  'orchestrator.saga.completed': OrchestratorSagaCompletedSchema,
  'system.health.check': SystemHealthCheckSchema,
  'system.alert.triggered': SystemAlertTriggeredSchema,
  'system.config.updated': SystemConfigUpdatedSchema,
};

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
}

export function validateEvent<T extends EventType>(
  eventType: T,
  event: unknown
): ValidationResult<EventMap[T]> {
  const schema = EventSchemas[eventType];
  
  if (!schema) {
    return {
      success: false,
      errors: new z.ZodError([{
        code: 'custom',
        message: `Unknown event type: ${eventType}`,
        path: ['eventType'],
      }]),
    };
  }

  const result = schema.safeParse(event);
  
  if (result.success) {
    return { success: true, data: result.data as EventMap[T] };
  }
  
  return { success: false, errors: result.error };
}

export function assertValidEvent<T extends EventType>(
  eventType: T,
  event: unknown
): asserts event is EventMap[T] {
  const result = validateEvent(eventType, event);
  
  if (!result.success) {
    throw new Error(
      `Invalid ${eventType} event: ${result.errors?.errors.map(e => e.message).join(', ')}`
    );
  }
}
