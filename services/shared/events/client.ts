/**
 * AI Active Trader - NATS JetStream Event Bus Client
 * Provides typed publish/subscribe for microservices communication
 */

import { EventMap, EventType, EventMetadata, SagaCorrelation } from './types';

// NATS client interface (to be implemented with actual NATS library)
interface NatsConnection {
  jetstream(): JetStreamClient;
  close(): Promise<void>;
}

interface JetStreamClient {
  publish(subject: string, data: Uint8Array): Promise<PubAck>;
  subscribe(subject: string, opts?: ConsumerOpts): Promise<JetStreamSubscription>;
}

interface PubAck {
  stream: string;
  seq: number;
}

interface ConsumerOpts {
  durable?: string;
  deliverPolicy?: 'all' | 'new' | 'last';
  ackPolicy?: 'explicit' | 'none' | 'all';
  maxDeliver?: number;
  filterSubject?: string;
}

interface JetStreamSubscription {
  [Symbol.asyncIterator](): AsyncIterator<JsMsg>;
}

interface JsMsg {
  data: Uint8Array;
  subject: string;
  ack(): void;
  nak(delay?: number): void;
}

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a correlation ID for saga tracking
 */
function generateCorrelationId(): string {
  return `saga_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * EventBus client for typed event publishing and subscribing
 */
export class EventBusClient {
  private connection: NatsConnection | null = null;
  private jetstream: JetStreamClient | null = null;
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Connect to NATS server
   */
  async connect(url: string = 'nats://localhost:4222'): Promise<void> {
    // In production, use: import { connect } from 'nats';
    // this.connection = await connect({ servers: url });
    // this.jetstream = this.connection.jetstream();
    console.log(`[EventBus] ${this.serviceName} connecting to ${url}`);
  }

  /**
   * Disconnect from NATS server
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.jetstream = null;
    }
  }

  /**
   * Create event metadata
   */
  private createMetadata(eventType: EventType, correlationId?: string, causationId?: string): EventMetadata {
    return {
      eventId: generateEventId(),
      eventType,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: this.serviceName,
      correlationId,
      causationId,
    };
  }

  /**
   * Publish a typed event
   */
  async publish<T extends EventType>(
    eventType: T,
    payload: EventMap[T] extends { payload: infer P } ? P : never,
    options?: {
      correlationId?: string;
      causationId?: string;
    }
  ): Promise<PubAck | null> {
    const metadata = this.createMetadata(eventType, options?.correlationId, options?.causationId);
    
    const event = {
      metadata,
      payload,
    };

    const data = new TextEncoder().encode(JSON.stringify(event));
    
    if (this.jetstream) {
      const ack = await this.jetstream.publish(eventType, data);
      console.log(`[EventBus] Published ${eventType} to stream ${ack.stream}, seq ${ack.seq}`);
      return ack;
    }

    // Development mode: log the event
    console.log(`[EventBus] Would publish ${eventType}:`, event);
    return null;
  }

  /**
   * Publish a saga event with correlation
   */
  async publishSagaEvent<T extends EventType>(
    eventType: T,
    payload: EventMap[T] extends { payload: infer P } ? P : never,
    correlation: SagaCorrelation
  ): Promise<PubAck | null> {
    const metadata = this.createMetadata(
      eventType,
      correlation.correlationId,
      correlation.causationId || undefined
    );
    
    const event = {
      metadata,
      correlation,
      payload,
    };

    const data = new TextEncoder().encode(JSON.stringify(event));
    
    if (this.jetstream) {
      const ack = await this.jetstream.publish(eventType, data);
      console.log(`[EventBus] Published saga event ${eventType}, correlation ${correlation.correlationId}`);
      return ack;
    }

    console.log(`[EventBus] Would publish saga ${eventType}:`, event);
    return null;
  }

  /**
   * Subscribe to events with a durable consumer
   */
  async subscribe<T extends EventType>(
    eventPattern: T | string,
    handler: (event: EventMap[T]) => Promise<void>,
    options?: {
      durable?: string;
      deliverPolicy?: 'all' | 'new';
      maxDeliver?: number;
    }
  ): Promise<void> {
    const consumerName = options?.durable || `${this.serviceName}-${eventPattern.replace(/\./g, '-')}`;
    
    console.log(`[EventBus] ${this.serviceName} subscribing to ${eventPattern} as ${consumerName}`);

    if (this.jetstream) {
      const subscription = await this.jetstream.subscribe(eventPattern, {
        durable: consumerName,
        deliverPolicy: options?.deliverPolicy || 'new',
        ackPolicy: 'explicit',
        maxDeliver: options?.maxDeliver || 3,
        filterSubject: eventPattern,
      });

      // Process messages
      for await (const msg of subscription) {
        try {
          const event = JSON.parse(new TextDecoder().decode(msg.data)) as EventMap[T];
          await handler(event);
          msg.ack();
        } catch (error) {
          console.error(`[EventBus] Error processing ${eventPattern}:`, error);
          msg.nak(5000); // Retry after 5 seconds
        }
      }
    }
  }

  /**
   * Start a new saga
   */
  startSaga(sagaType: string, totalSteps: number, timeout: number = 60000): SagaCorrelation {
    return {
      correlationId: generateCorrelationId(),
      causationId: null,
      sagaType,
      step: 1,
      totalSteps,
      startedAt: new Date().toISOString(),
      timeout,
    };
  }

  /**
   * Advance saga to next step
   */
  advanceSaga(current: SagaCorrelation, previousEventId: string): SagaCorrelation {
    return {
      ...current,
      causationId: previousEventId,
      step: current.step + 1,
    };
  }
}

/**
 * Create a typed event bus client for a service
 */
export function createEventBus(serviceName: string): EventBusClient {
  return new EventBusClient(serviceName);
}

// Export types
export type { EventMap, EventType, EventMetadata, SagaCorrelation };
