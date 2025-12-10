import { EventEmitter } from "events";

export type TradingEventType =
  | "market:data:update"
  | "market:status:change"
  | "strategy:started"
  | "strategy:stopped"
  | "strategy:signal"
  | "strategy:error"
  | "trade:executed"
  | "trade:filled"
  | "trade:cancelled"
  | "trade:error"
  | "position:opened"
  | "position:closed"
  | "position:updated"
  | "ai:decision"
  | "ai:analysis:complete"
  | "portfolio:rebalanced"
  | "system:heartbeat"
  | "system:error"
  | "system:warning"
  | "connector:connected"
  | "connector:disconnected"
  | "connector:error";

export interface TradingEvent<T = unknown> {
  type: TradingEventType;
  timestamp: Date;
  source: string;
  data: T;
  correlationId?: string;
}

export interface MarketDataEvent {
  symbol: string;
  price: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface StrategySignalEvent {
  strategyId: string;
  strategyName: string;
  symbol: string;
  signal: "buy" | "sell" | "hold";
  confidence: number;
  reason: string;
  suggestedQuantity?: number;
  targetPrice?: number;
  stopLoss?: number;
}

export interface TradeExecutedEvent {
  tradeId: string;
  orderId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  status: string;
  strategyId?: string;
}

export interface PositionEvent {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  side: "long" | "short";
}

export interface SystemEvent {
  level: "info" | "warning" | "error" | "critical";
  message: string;
  details?: Record<string, unknown>;
}

type EventHandler<T = unknown> = (event: TradingEvent<T>) => void | Promise<void>;

class TradingEventBus extends EventEmitter {
  private eventHistory: TradingEvent[] = [];
  private readonly maxHistorySize = 1000;
  private handlers: Map<TradingEventType, Set<EventHandler>> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  emit<T>(type: TradingEventType, data: T, source: string, correlationId?: string): boolean {
    const event: TradingEvent<T> = {
      type,
      timestamp: new Date(),
      source,
      data,
      correlationId,
    };

    this.addToHistory(event);

    return super.emit(type, event);
  }

  subscribe<T>(type: TradingEventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EventHandler);
    
    super.on(type, handler as (...args: unknown[]) => void);

    return () => {
      this.unsubscribe(type, handler);
    };
  }

  unsubscribe<T>(type: TradingEventType, handler: EventHandler<T>): void {
    const typeHandlers = this.handlers.get(type);
    if (typeHandlers) {
      typeHandlers.delete(handler as EventHandler);
    }
    super.off(type, handler as (...args: unknown[]) => void);
  }

  subscribeAll(handler: EventHandler): () => void {
    const allTypes: TradingEventType[] = [
      "market:data:update",
      "market:status:change",
      "strategy:started",
      "strategy:stopped",
      "strategy:signal",
      "strategy:error",
      "trade:executed",
      "trade:filled",
      "trade:cancelled",
      "trade:error",
      "position:opened",
      "position:closed",
      "position:updated",
      "ai:decision",
      "ai:analysis:complete",
      "portfolio:rebalanced",
      "system:heartbeat",
      "system:error",
      "system:warning",
      "connector:connected",
      "connector:disconnected",
      "connector:error",
    ];

    const unsubscribers = allTypes.map((type) => this.subscribe(type, handler));

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  private addToHistory(event: TradingEvent): void {
    this.eventHistory.push(event);
    
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  getEventHistory(filter?: {
    type?: TradingEventType;
    source?: string;
    since?: Date;
    limit?: number;
  }): TradingEvent[] {
    let events = [...this.eventHistory];

    if (filter?.type) {
      events = events.filter((e) => e.type === filter.type);
    }

    if (filter?.source) {
      events = events.filter((e) => e.source === filter.source);
    }

    if (filter?.since) {
      events = events.filter((e) => e.timestamp >= filter.since!);
    }

    if (filter?.limit) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  getRecentEvents(limit: number = 50): TradingEvent[] {
    return this.eventHistory.slice(-limit);
  }

  clearHistory(): void {
    this.eventHistory = [];
  }

  getStats(): {
    totalEvents: number;
    eventsByType: Record<TradingEventType, number>;
    oldestEvent: Date | null;
    newestEvent: Date | null;
  } {
    const eventsByType: Partial<Record<TradingEventType, number>> = {};
    
    for (const event of this.eventHistory) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    }

    return {
      totalEvents: this.eventHistory.length,
      eventsByType: eventsByType as Record<TradingEventType, number>,
      oldestEvent: this.eventHistory.length > 0 ? this.eventHistory[0].timestamp : null,
      newestEvent: this.eventHistory.length > 0 ? this.eventHistory[this.eventHistory.length - 1].timestamp : null,
    };
  }
}

export const eventBus = new TradingEventBus();
