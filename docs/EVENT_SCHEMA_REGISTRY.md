# Event Schema Registry

> **Purpose:** Define and version all event schemas for inter-service communication in the AI Active Trader microservices architecture.

---

## Overview

All services communicate through well-defined events. This registry ensures:
- Type safety across service boundaries
- Backward compatibility during schema evolution
- Clear documentation for integration

---

## Base Event Structure

All events extend this base structure:

```typescript
interface BaseEvent {
  eventId: string;           // UUID v7 (time-ordered)
  eventType: string;         // Fully qualified: domain.entity.action
  version: string;           // Semantic version: "1.0.0"
  timestamp: string;         // ISO 8601 with timezone
  source: string;            // Publishing service name
  correlationId?: string;    // For request tracing across services
  causationId?: string;      // ID of event that caused this event
  metadata?: Record<string, string>;  // Additional context
}
```

---

## Domain: Market

### market.quote.received (v1.0.0)

Published when a new price quote is received from a data provider.

```typescript
interface MarketQuoteReceivedEvent extends BaseEvent {
  eventType: "market.quote.received";
  payload: {
    symbol: string;          // e.g., "AAPL"
    price: number;           // Current price
    bid: number;             // Best bid
    ask: number;             // Best ask
    bidSize: number;         // Bid size
    askSize: number;         // Ask size
    volume: number;          // Daily volume
    change: number;          // Price change from open
    changePercent: number;   // Percentage change
    exchange: string;        // Exchange code
    source: "alpaca" | "finnhub" | "polygon";
  };
}
```

### market.bar.closed (v1.0.0)

Published when a price bar (OHLCV) is closed for a timeframe.

```typescript
interface MarketBarClosedEvent extends BaseEvent {
  eventType: "market.bar.closed";
  payload: {
    symbol: string;
    timeframe: "1m" | "5m" | "15m" | "1h" | "1d";
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap?: number;           // Volume-weighted average price
    trades?: number;         // Number of trades
    barStart: string;        // Bar start time (ISO 8601)
    barEnd: string;          // Bar end time (ISO 8601)
  };
}
```

### market.news.published (v1.0.0)

Published when a relevant news article is detected.

```typescript
interface MarketNewsPublishedEvent extends BaseEvent {
  eventType: "market.news.published";
  payload: {
    articleId: string;
    headline: string;
    summary: string;
    source: string;          // e.g., "Bloomberg", "Reuters"
    url: string;
    symbols: string[];       // Related symbols
    sentiment?: number;      // -1 (bearish) to 1 (bullish)
    importance: "low" | "medium" | "high";
    publishedAt: string;
  };
}
```

### market.session.changed (v1.0.0)

Published when market session changes (open/close).

```typescript
interface MarketSessionChangedEvent extends BaseEvent {
  eventType: "market.session.changed";
  payload: {
    previousSession: "pre" | "regular" | "post" | "closed";
    currentSession: "pre" | "regular" | "post" | "closed";
    market: "US_EQUITY" | "CRYPTO";
    effectiveAt: string;
    nextChange: string;      // When session will change next
  };
}
```

---

## Domain: Trade

### trade.order.submitted (v1.0.0)

Published when an order is submitted to the broker.

```typescript
interface TradeOrderSubmittedEvent extends BaseEvent {
  eventType: "trade.order.submitted";
  payload: {
    orderId: string;         // Internal order ID
    brokerOrderId?: string;  // Broker-assigned ID
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    orderType: "market" | "limit" | "stop" | "stop_limit";
    timeInForce: "day" | "gtc" | "ioc" | "fok";
    limitPrice?: number;
    stopPrice?: number;
    extendedHours: boolean;
    strategyId?: string;
    decisionId?: string;     // AI decision that triggered this
  };
}
```

### trade.order.filled (v1.0.0)

Published when an order is fully or partially filled.

```typescript
interface TradeOrderFilledEvent extends BaseEvent {
  eventType: "trade.order.filled";
  payload: {
    orderId: string;
    brokerOrderId: string;
    symbol: string;
    side: "buy" | "sell";
    filledQuantity: number;
    remainingQuantity: number;
    averagePrice: number;
    fillPrice: number;       // This fill's price
    commission: number;
    isPartial: boolean;
    filledAt: string;
    strategyId?: string;
    decisionId?: string;
  };
}
```

### trade.order.rejected (v1.0.0)

Published when an order is rejected by the broker.

```typescript
interface TradeOrderRejectedEvent extends BaseEvent {
  eventType: "trade.order.rejected";
  payload: {
    orderId: string;
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    rejectionReason: string;
    rejectionCode: string;   // Broker-specific code
    strategyId?: string;
    decisionId?: string;
  };
}
```

### trade.order.cancelled (v1.0.0)

Published when an order is cancelled.

```typescript
interface TradeOrderCancelledEvent extends BaseEvent {
  eventType: "trade.order.cancelled";
  payload: {
    orderId: string;
    brokerOrderId: string;
    symbol: string;
    cancelledQuantity: number;
    filledQuantityBeforeCancel: number;
    cancelledBy: "user" | "system" | "broker";
    reason?: string;
  };
}
```

### trade.position.updated (v1.0.0)

Published when a position changes.

```typescript
interface TradePositionUpdatedEvent extends BaseEvent {
  eventType: "trade.position.updated";
  payload: {
    symbol: string;
    previousQuantity: number;
    currentQuantity: number;
    side: "long" | "short" | "flat";
    averageEntryPrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    realizedPnlToday: number;
    costBasis: number;
  };
}
```

### trade.position.closed (v1.0.0)

Published when a position is fully closed.

```typescript
interface TradePositionClosedEvent extends BaseEvent {
  eventType: "trade.position.closed";
  payload: {
    symbol: string;
    closedQuantity: number;
    averageEntryPrice: number;
    averageExitPrice: number;
    realizedPnl: number;
    realizedPnlPercent: number;
    holdingPeriodMinutes: number;
    strategyId?: string;
  };
}
```

---

## Domain: AI

### ai.decision.generated (v1.0.0)

Published when the AI generates a trading decision.

```typescript
interface AIDecisionGeneratedEvent extends BaseEvent {
  eventType: "ai.decision.generated";
  payload: {
    decisionId: string;
    symbol: string;
    strategyId: string;
    action: "BUY" | "SELL" | "HOLD";
    confidence: number;      // 0.0 to 1.0
    reasoning: string;
    factors: Array<{
      name: string;
      direction: "bullish" | "bearish" | "neutral";
      weight: number;
      description?: string;
    }>;
    suggestedQuantity?: number;
    suggestedPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    riskLevel: "low" | "medium" | "high";
    modelUsed: string;       // e.g., "gpt-4o"
    promptTokens: number;
    completionTokens: number;
    latencyMs: number;
  };
}
```

### ai.decision.validated (v1.0.0)

Published after a decision passes risk validation.

```typescript
interface AIDecisionValidatedEvent extends BaseEvent {
  eventType: "ai.decision.validated";
  payload: {
    decisionId: string;
    symbol: string;
    approved: boolean;
    validationChecks: Array<{
      check: string;
      passed: boolean;
      reason?: string;
    }>;
    adjustedQuantity?: number;  // If position sizing adjusted
    adjustedStopLoss?: number;  // If stop adjusted
  };
}
```

### ai.calibration.completed (v1.0.0)

Published after AI calibration analysis.

```typescript
interface AICalibrationCompletedEvent extends BaseEvent {
  eventType: "ai.calibration.completed";
  payload: {
    analysisId: string;
    period: string;          // e.g., "30d"
    totalDecisions: number;
    accuracy: number;        // 0.0 to 1.0
    winRate: number;         // 0.0 to 1.0
    profitFactor: number;
    avgConfidence: number;
    recommendations: string[];
    winningPatterns: Array<{
      pattern: string;
      frequency: number;
      winRate: number;
    }>;
    losingPatterns: Array<{
      pattern: string;
      frequency: number;
      lossRate: number;
    }>;
  };
}
```

---

## Domain: Analytics

### analytics.pnl.calculated (v1.0.0)

Published when P&L is recalculated.

```typescript
interface AnalyticsPnLCalculatedEvent extends BaseEvent {
  eventType: "analytics.pnl.calculated";
  payload: {
    period: "daily" | "weekly" | "monthly" | "ytd";
    startDate: string;
    endDate: string;
    realizedPnl: number;
    unrealizedPnl: number;
    totalPnl: number;
    totalPnlPercent: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio?: number;
  };
}
```

### analytics.metrics.snapshot (v1.0.0)

Published periodically with portfolio metrics.

```typescript
interface AnalyticsMetricsSnapshotEvent extends BaseEvent {
  eventType: "analytics.metrics.snapshot";
  payload: {
    timestamp: string;
    equity: number;
    cash: number;
    buyingPower: number;
    positionCount: number;
    dayPnl: number;
    dayPnlPercent: number;
    weekPnl: number;
    monthPnl: number;
    riskExposure: number;    // Total position value / equity
    sectorExposure: Record<string, number>;  // By sector
    topPositions: Array<{
      symbol: string;
      weight: number;
      pnl: number;
    }>;
  };
}
```

---

## Domain: Orchestrator

### orchestrator.cycle.started (v1.0.0)

Published when an orchestration cycle begins.

```typescript
interface OrchestratorCycleStartedEvent extends BaseEvent {
  eventType: "orchestrator.cycle.started";
  payload: {
    cycleId: string;
    cycleType: "analysis" | "rebalance" | "monitoring";
    strategies: string[];    // Strategy IDs in this cycle
    scheduledAt: string;
    triggeredBy: "schedule" | "manual" | "event";
  };
}
```

### orchestrator.cycle.completed (v1.0.0)

Published when an orchestration cycle finishes.

```typescript
interface OrchestratorCycleCompletedEvent extends BaseEvent {
  eventType: "orchestrator.cycle.completed";
  payload: {
    cycleId: string;
    cycleType: string;
    durationMs: number;
    decisionsGenerated: number;
    ordersSubmitted: number;
    errors: Array<{
      strategyId: string;
      error: string;
    }>;
    status: "success" | "partial" | "failed";
  };
}
```

---

## Domain: System

### system.heartbeat (v1.0.0)

Published periodically by each service.

```typescript
interface SystemHeartbeatEvent extends BaseEvent {
  eventType: "system.heartbeat";
  payload: {
    service: string;
    instance: string;        // Instance ID for scaling
    status: "healthy" | "degraded" | "unhealthy";
    uptime: number;          // Seconds
    memory: {
      used: number;
      total: number;
    };
    cpu: number;             // Usage percentage
    connections: {
      database: boolean;
      eventBus: boolean;
      cache: boolean;
    };
    lastProcessed: {
      eventType: string;
      timestamp: string;
    };
  };
}
```

### system.error.occurred (v1.0.0)

Published when a significant error occurs.

```typescript
interface SystemErrorOccurredEvent extends BaseEvent {
  eventType: "system.error.occurred";
  payload: {
    service: string;
    errorCode: string;
    message: string;
    stack?: string;
    severity: "warning" | "error" | "critical";
    context: Record<string, unknown>;
    recoverable: boolean;
    alertSent: boolean;
  };
}
```

---

## Schema Evolution Rules

### Backward Compatibility

1. **Adding fields:** Always optional with defaults
2. **Removing fields:** Mark deprecated first, remove in next major version
3. **Renaming fields:** Add new field, deprecate old, migrate consumers
4. **Changing types:** Never allowed (breaking change)

### Version Bumping

| Change | Version Bump | Example |
|--------|--------------|---------|
| Add optional field | Patch (x.x.X) | 1.0.0 → 1.0.1 |
| Add required field with default | Minor (x.X.0) | 1.0.0 → 1.1.0 |
| Remove field | Major (X.0.0) | 1.0.0 → 2.0.0 |
| Change field type | Major (X.0.0) | 1.0.0 → 2.0.0 |

### Deprecation Process

```typescript
interface ExampleEvent extends BaseEvent {
  payload: {
    newField: string;
    /** @deprecated Use newField instead. Will be removed in v2.0.0 */
    oldField?: string;
  };
}
```

---

## TypeScript Package

All event types are exported from `@ai-trader/events`:

```typescript
// packages/events/src/index.ts
export * from './base';
export * from './market';
export * from './trade';
export * from './ai';
export * from './analytics';
export * from './orchestrator';
export * from './system';

// Type guards for runtime validation
export function isMarketQuoteEvent(e: BaseEvent): e is MarketQuoteReceivedEvent {
  return e.eventType === 'market.quote.received';
}

// Event factory
export function createEvent<T extends BaseEvent>(
  type: T['eventType'],
  payload: T['payload'],
  options?: Partial<BaseEvent>
): T {
  return {
    eventId: generateUUIDv7(),
    eventType: type,
    version: EVENT_VERSIONS[type],
    timestamp: new Date().toISOString(),
    source: process.env.SERVICE_NAME || 'unknown',
    ...options,
    payload
  } as T;
}
```

---

## Validation

Use Zod schemas for runtime validation:

```typescript
// packages/events/src/schemas/market.ts
import { z } from 'zod';

export const MarketQuotePayloadSchema = z.object({
  symbol: z.string().min(1).max(10),
  price: z.number().positive(),
  bid: z.number().positive(),
  ask: z.number().positive(),
  bidSize: z.number().int().nonnegative(),
  askSize: z.number().int().nonnegative(),
  volume: z.number().int().nonnegative(),
  change: z.number(),
  changePercent: z.number(),
  exchange: z.string(),
  source: z.enum(['alpaca', 'finnhub', 'polygon'])
});

export const MarketQuoteEventSchema = BaseEventSchema.extend({
  eventType: z.literal('market.quote.received'),
  payload: MarketQuotePayloadSchema
});
```
