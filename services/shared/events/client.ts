/**
 * AI Active Trader - NATS JetStream Event Bus Client
 * Provides typed publish/subscribe for microservices communication
 * 
 * Supports:
 * - Real NATS JetStream connection for production
 * - In-memory event bus for development without NATS
 * - OpenTelemetry tracing for distributed tracing
 */

import { connect, NatsConnection, JetStreamClient, JetStreamManager, PubAck, JsMsg, ConsumerConfig, AckPolicy, DeliverPolicy, StringCodec, RetentionPolicy, StorageType } from 'nats';
import { EventMap, EventType, EventMetadata, SagaCorrelation } from './types';
import { validateEvent, EventSchemas } from './schemas';
import { getTracer, withSpan, addSpanAttributes, SpanKind, getTraceContextHeaders, extractTraceContext, addSpanEvent } from '../common/telemetry';
import { context } from '@opentelemetry/api';

const sc = StringCodec();

type EventHandler<T extends EventType> = (event: EventMap[T]) => Promise<void>;

interface InMemorySubscription {
  pattern: string;
  handler: EventHandler<any>;
  consumerName: string;
}

/**
 * In-memory event bus for development when NATS is not available
 */
class InMemoryEventBus {
  private subscriptions: InMemorySubscription[] = [];
  private eventLog: Array<{ subject: string; data: any; timestamp: Date }> = [];
  private maxLogSize = 1000;

  async publish(subject: string, data: Uint8Array): Promise<{ stream: string; seq: number }> {
    const event = JSON.parse(sc.decode(data));
    const logEntry = { subject, data: event, timestamp: new Date() };
    
    this.eventLog.push(logEntry);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    const stream = subject.split('.')[0].toUpperCase();
    const seq = this.eventLog.length;

    console.log(`[InMemoryBus] Published to ${subject} (stream: ${stream}, seq: ${seq})`);

    for (const sub of this.subscriptions) {
      if (this.matchPattern(subject, sub.pattern)) {
        setImmediate(async () => {
          try {
            await sub.handler(event);
            console.log(`[InMemoryBus] Delivered to ${sub.consumerName}`);
          } catch (error) {
            console.error(`[InMemoryBus] Handler error for ${sub.consumerName}:`, error);
          }
        });
      }
    }

    return { stream, seq };
  }

  subscribe(pattern: string, consumerName: string, handler: EventHandler<any>): void {
    this.subscriptions.push({ pattern, handler, consumerName });
    console.log(`[InMemoryBus] Subscribed ${consumerName} to ${pattern}`);
  }

  private matchPattern(subject: string, pattern: string): boolean {
    const subjectParts = subject.split('.');
    const patternParts = pattern.split('.');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '>') return true;
      if (patternParts[i] === '*') continue;
      if (patternParts[i] !== subjectParts[i]) return false;
    }

    return subjectParts.length === patternParts.length;
  }

  getEventLog(): Array<{ subject: string; data: any; timestamp: Date }> {
    return [...this.eventLog];
  }

  clear(): void {
    this.subscriptions = [];
    this.eventLog = [];
  }
}

const inMemoryBus = new InMemoryEventBus();

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function generateCorrelationId(): string {
  return `saga_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export interface EventBusConfig {
  url?: string;
  useInMemory?: boolean;
  serviceName: string;
  validateOnPublish?: boolean;
  validateOnConsume?: boolean;
}

/**
 * Stream configurations for JetStream
 */
const STREAM_CONFIGS = [
  { name: 'MARKET', subjects: ['market.>'] },
  { name: 'TRADE', subjects: ['trade.>'] },
  { name: 'AI', subjects: ['ai.>'] },
  { name: 'ANALYTICS', subjects: ['analytics.>'] },
  { name: 'ORCHESTRATOR', subjects: ['orchestrator.>'] },
  { name: 'SYSTEM', subjects: ['system.>'] },
];

/**
 * EventBus client for typed event publishing and subscribing
 */
export class EventBusClient {
  private connection: NatsConnection | null = null;
  private jetstream: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;
  private serviceName: string;
  private useInMemory: boolean;
  private connected: boolean = false;
  private validateOnPublish: boolean;
  private validateOnConsume: boolean;
  private streamsInitialized: boolean = false;

  constructor(config: EventBusConfig | string) {
    if (typeof config === 'string') {
      this.serviceName = config;
      this.useInMemory = process.env.NATS_URL ? false : true;
      this.validateOnPublish = true;
      this.validateOnConsume = true;
    } else {
      this.serviceName = config.serviceName;
      this.useInMemory = config.useInMemory ?? !process.env.NATS_URL;
      this.validateOnPublish = config.validateOnPublish ?? true;
      this.validateOnConsume = config.validateOnConsume ?? true;
    }
  }

  /**
   * Connect to NATS server or use in-memory bus
   */
  async connect(url?: string): Promise<void> {
    const natsUrl = url || process.env.NATS_URL || 'nats://localhost:4222';

    if (this.useInMemory) {
      console.log(`[EventBus] ${this.serviceName} using in-memory event bus (NATS not available)`);
      this.connected = true;
      return;
    }

    try {
      console.log(`[EventBus] ${this.serviceName} connecting to ${natsUrl}...`);
      
      this.connection = await connect({ 
        servers: natsUrl,
        name: this.serviceName,
        reconnect: true,
        maxReconnectAttempts: 10,
        reconnectTimeWait: 2000,
      });

      this.jetstream = this.connection.jetstream();
      this.jsm = await this.connection.jetstreamManager();
      
      // Initialize streams if not already done
      await this.initializeStreams();
      
      this.connected = true;

      console.log(`[EventBus] ${this.serviceName} connected to NATS JetStream`);

      this.connection.closed().then(() => {
        console.log(`[EventBus] ${this.serviceName} connection closed`);
        this.connected = false;
      });

    } catch (error) {
      console.warn(`[EventBus] ${this.serviceName} failed to connect to NATS: ${error}`);
      console.log(`[EventBus] ${this.serviceName} falling back to in-memory event bus`);
      this.useInMemory = true;
      this.connected = true;
    }
  }

  /**
   * Disconnect from NATS server
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();
      await this.connection.close();
      this.connection = null;
      this.jetstream = null;
      this.jsm = null;
    }
    this.connected = false;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Check if using in-memory bus
   */
  isInMemoryMode(): boolean {
    return this.useInMemory;
  }

  /**
   * Initialize JetStream streams if they don't exist
   */
  private async initializeStreams(): Promise<void> {
    if (this.streamsInitialized || !this.jsm) return;

    for (const config of STREAM_CONFIGS) {
      try {
        await this.jsm.streams.info(config.name);
        console.log(`[EventBus] Stream ${config.name} already exists`);
      } catch {
        try {
          await this.jsm.streams.add({
            name: config.name,
            subjects: config.subjects,
            retention: RetentionPolicy.Limits,
            storage: StorageType.File,
            max_msgs: 100000,
            max_age: 7 * 24 * 60 * 60 * 1000000000, // 7 days in nanoseconds
            max_bytes: 1024 * 1024 * 1024, // 1GB
            duplicate_window: 2 * 60 * 1000000000, // 2 minutes for dedup
          });
          console.log(`[EventBus] Created stream ${config.name} with subjects ${config.subjects}`);
        } catch (err) {
          console.warn(`[EventBus] Could not create stream ${config.name}: ${err}`);
        }
      }
    }

    this.streamsInitialized = true;
  }

  /**
   * Validate event against schema
   */
  private validateEventData<T extends EventType>(
    eventType: T,
    event: unknown
  ): void {
    if (!this.validateOnPublish) return;

    const result = validateEvent(eventType, event);
    if (!result.success) {
      throw new Error(
        `[EventBus] Schema validation failed for ${eventType}: ${result.errors?.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
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
   * Publish a typed event with distributed tracing
   */
  async publish<T extends EventType>(
    eventType: T,
    payload: EventMap[T] extends { payload: infer P } ? P : never,
    options?: {
      correlationId?: string;
      causationId?: string;
    }
  ): Promise<PubAck | { stream: string; seq: number } | null> {
    if (!this.connected) {
      throw new Error(`[EventBus] ${this.serviceName} not connected`);
    }

    const tracer = getTracer(this.serviceName);
    
    return withSpan(tracer, `eventbus.publish.${eventType}`, async (span) => {
      const metadata = this.createMetadata(eventType, options?.correlationId, options?.causationId);
      
      // Add trace context to metadata for propagation
      const traceContext = getTraceContextHeaders();
      const enrichedMetadata = {
        ...metadata,
        traceId: traceContext['traceparent'] || undefined,
      };
      
      const event = {
        metadata: enrichedMetadata,
        payload,
      };

      // Validate event against schema before publishing
      this.validateEventData(eventType, event);

      span.setAttribute('messaging.system', 'nats');
      span.setAttribute('messaging.destination', eventType);
      span.setAttribute('messaging.operation', 'publish');
      span.setAttribute('event.id', metadata.eventId);
      if (options?.correlationId) {
        span.setAttribute('event.correlation_id', options.correlationId);
      }

      const data = sc.encode(JSON.stringify(event));
      
      if (this.useInMemory) {
        const result = await inMemoryBus.publish(eventType, data);
        span.setAttribute('messaging.destination.stream', result.stream);
        span.setAttribute('messaging.message.sequence', result.seq);
        return result;
      }

      if (this.jetstream) {
        try {
          const ack = await this.jetstream.publish(eventType, data);
          span.setAttribute('messaging.destination.stream', ack.stream);
          span.setAttribute('messaging.message.sequence', ack.seq);
          console.log(`[EventBus] Published ${eventType} to stream ${ack.stream}, seq ${ack.seq}`);
          return ack;
        } catch (error) {
          console.error(`[EventBus] Failed to publish ${eventType}:`, error);
          throw error;
        }
      }

      return null;
    }, { kind: SpanKind.PRODUCER });
  }

  /**
   * Publish a saga event with correlation
   */
  async publishSagaEvent<T extends EventType>(
    eventType: T,
    payload: EventMap[T] extends { payload: infer P } ? P : never,
    correlation: SagaCorrelation
  ): Promise<PubAck | { stream: string; seq: number } | null> {
    if (!this.connected) {
      throw new Error(`[EventBus] ${this.serviceName} not connected`);
    }

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

    // Validate saga event against schema before publishing
    this.validateEventData(eventType, event);

    const data = sc.encode(JSON.stringify(event));
    
    if (this.useInMemory) {
      return await inMemoryBus.publish(eventType, data);
    }

    if (this.jetstream) {
      try {
        const ack = await this.jetstream.publish(eventType, data);
        console.log(`[EventBus] Published saga event ${eventType}, correlation ${correlation.correlationId}`);
        return ack;
      } catch (error) {
        console.error(`[EventBus] Failed to publish saga ${eventType}:`, error);
        throw error;
      }
    }

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
    if (!this.connected) {
      throw new Error(`[EventBus] ${this.serviceName} not connected`);
    }

    const rawName = options?.durable || `${this.serviceName}-${eventPattern.toString().replace(/\./g, '-')}`;
    const consumerName = rawName.replace(/[.*>]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    
    console.log(`[EventBus] ${this.serviceName} subscribing to ${eventPattern} as ${consumerName}`);

    if (this.useInMemory) {
      inMemoryBus.subscribe(eventPattern.toString(), consumerName, handler);
      return;
    }

    if (this.jetstream && this.jsm) {
      try {
        const streamName = eventPattern.toString().split('.')[0].toUpperCase();
        
        const consumerConfig: Partial<ConsumerConfig> = {
          durable_name: consumerName,
          deliver_policy: options?.deliverPolicy === 'all' ? DeliverPolicy.All : DeliverPolicy.New,
          ack_policy: AckPolicy.Explicit,
          max_deliver: options?.maxDeliver || 3,
          filter_subject: eventPattern.toString(),
        };

        try {
          await this.jsm.consumers.add(streamName, consumerConfig);
        } catch (e) {
          // Consumer might already exist
        }

        const consumer = await this.jetstream.consumers.get(streamName, consumerName);
        const messages = await consumer.consume();

        (async () => {
          for await (const msg of messages) {
            try {
              const event = JSON.parse(sc.decode(msg.data)) as EventMap[T];
              await handler(event);
              msg.ack();
            } catch (error) {
              console.error(`[EventBus] Error processing ${eventPattern}:`, error);
              msg.nak(5000);
            }
          }
        })().catch(err => {
          console.error(`[EventBus] Consumer loop error for ${consumerName}:`, err);
        });

      } catch (error) {
        console.error(`[EventBus] Failed to subscribe to ${eventPattern}:`, error);
        throw error;
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

  /**
   * Get event log (in-memory mode only)
   */
  getEventLog(): Array<{ subject: string; data: any; timestamp: Date }> {
    if (this.useInMemory) {
      return inMemoryBus.getEventLog();
    }
    return [];
  }
}

/**
 * Create a typed event bus client for a service
 */
export function createEventBus(serviceName: string): EventBusClient {
  return new EventBusClient({ serviceName });
}

/**
 * Create event bus with explicit config
 */
export function createEventBusWithConfig(config: EventBusConfig): EventBusClient {
  return new EventBusClient(config);
}

export { inMemoryBus };
export type { EventMap, EventType, EventMetadata, SagaCorrelation };
