/**
 * AI Active Trader - High-Performance Ring Buffer
 * LMAX Disruptor-inspired lock-free event processing
 * 
 * Features:
 * - Pre-allocated circular buffer with power-of-2 size
 * - Consumer gating to prevent slot overwrites
 * - Priority lanes for ordered dispatch
 * - Backpressure when buffer is full
 * - Batch publishing with contiguous slot reservation
 */

import type { EventMetadata, EventType } from './types';

export enum EventPriority {
  CRITICAL = 0,
  MARKET_DATA = 1,
  SIGNALS = 2,
  ORDERS = 3,
  ANALYTICS = 4,
  SYSTEM = 5,
}

export enum WaitStrategy {
  BUSY_SPIN = 'busy_spin',
  YIELDING = 'yielding',
  SLEEPING = 'sleeping',
  BLOCKING = 'blocking',
}

export interface RingBufferEvent<T = unknown> {
  sequence: number;
  timestamp: number;
  priority: EventPriority;
  eventType: string;
  payload: T;
  metadata?: Partial<EventMetadata>;
  published: boolean;
}

export interface RingBufferConfig {
  bufferSize: number;
  waitStrategy: WaitStrategy;
  spinTimeoutMs: number;
  batchSize: number;
  enableMetrics: boolean;
}

export interface RingBufferMetrics {
  published: number;
  consumed: number;
  dropped: number;
  batchesProcessed: number;
  avgLatencyUs: number;
  maxLatencyUs: number;
  backpressureCount: number;
  bufferUtilization: number;
}

export type EventHandler<T = unknown> = (
  event: RingBufferEvent<T>,
  sequence: number,
  endOfBatch: boolean
) => void | Promise<void>;

export type BatchEventHandler<T = unknown> = (
  events: RingBufferEvent<T>[],
  startSequence: number,
  endSequence: number
) => void | Promise<void>;

class Sequence {
  private value: number;

  constructor(initial: number = -1) {
    this.value = initial;
  }

  get(): number {
    return this.value;
  }

  set(v: number): void {
    this.value = v;
  }

  incrementAndGet(): number {
    return ++this.value;
  }

  compareAndSet(expected: number, update: number): boolean {
    if (this.value === expected) {
      this.value = update;
      return true;
    }
    return false;
  }
}

const applyWait = async (strategy: WaitStrategy, iteration: number): Promise<void> => {
  switch (strategy) {
    case WaitStrategy.BUSY_SPIN:
      break;
    case WaitStrategy.YIELDING:
      if (iteration > 100) {
        await new Promise<void>(resolve => setImmediate(resolve));
      }
      break;
    case WaitStrategy.SLEEPING:
      if (iteration > 50) {
        await new Promise<void>(resolve => setTimeout(resolve, 1));
      }
      break;
    case WaitStrategy.BLOCKING:
      if (iteration > 10) {
        await new Promise<void>(resolve => setTimeout(resolve, 5));
      }
      break;
  }
};

interface ConsumerInfo<T> {
  id: string;
  sequences: Map<EventPriority, Sequence>;
  handler: EventHandler<T>;
  batchHandler?: BatchEventHandler<T>;
  running: boolean;
  batchSize: number;
}

class PriorityLane<T> {
  private buffer: RingBufferEvent<T>[];
  private capacity: number;
  private indexMask: number;
  private cursor: Sequence = new Sequence();
  private published: Sequence = new Sequence();
  private gatingSequences: Sequence[] = [];
  readonly priority: EventPriority;

  constructor(priority: EventPriority, capacity: number) {
    this.priority = priority;
    this.capacity = capacity;
    this.indexMask = capacity - 1;
    this.buffer = new Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.buffer[i] = {
        sequence: -1,
        timestamp: 0,
        priority,
        eventType: '',
        payload: null as T,
        published: false,
      };
    }
  }

  private idx(seq: number): number {
    return seq & this.indexMask;
  }

  addGatingSequence(seq: Sequence): void {
    this.gatingSequences.push(seq);
  }

  removeGatingSequence(seq: Sequence): void {
    const idx = this.gatingSequences.indexOf(seq);
    if (idx >= 0) this.gatingSequences.splice(idx, 1);
  }

  private getMinGating(): number {
    if (this.gatingSequences.length === 0) {
      return Number.MAX_SAFE_INTEGER;
    }
    let min = Number.MAX_SAFE_INTEGER;
    for (const g of this.gatingSequences) {
      const v = g.get();
      if (v < min) min = v;
    }
    return min;
  }

  claim(): number {
    const current = this.cursor.get();
    const next = current + 1;
    const wrapPoint = next - this.capacity;
    const minGating = this.getMinGating();

    if (wrapPoint > minGating) {
      return -1;
    }

    this.cursor.set(next);
    return next;
  }

  claimBatch(count: number): { start: number; end: number } | null {
    const current = this.cursor.get();
    const start = current + 1;
    const end = start + count - 1;
    const wrapPoint = end - this.capacity;
    const minGating = this.getMinGating();

    if (wrapPoint > minGating) {
      return null;
    }

    this.cursor.set(end);
    return { start, end };
  }

  publish(
    sequence: number,
    eventType: string,
    payload: T,
    metadata?: Partial<EventMetadata>
  ): void {
    const slot = this.buffer[this.idx(sequence)];
    slot.sequence = sequence;
    slot.timestamp = performance.now();
    slot.eventType = eventType;
    slot.payload = payload;
    slot.metadata = metadata;
    slot.published = true;

    let iter = 0;
    while (!this.published.compareAndSet(sequence - 1, sequence)) {
      iter++;
      if (iter > 1000) break;
    }
  }

  get(sequence: number): RingBufferEvent<T> | null {
    const slot = this.buffer[this.idx(sequence)];
    if (slot.sequence !== sequence || !slot.published) {
      return null;
    }
    return slot;
  }

  getPublished(): number {
    return this.published.get();
  }

  getCursor(): number {
    return this.cursor.get();
  }

  getCapacity(): number {
    return this.capacity;
  }

  getRemainingCapacity(): number {
    const minGating = this.getMinGating();
    const consumed = minGating === Number.MAX_SAFE_INTEGER ? -1 : minGating;
    return this.capacity - (this.cursor.get() - consumed);
  }
}

export class RingBuffer<T = unknown> {
  private lanes: Map<EventPriority, PriorityLane<T>> = new Map();
  private consumers: Map<string, ConsumerInfo<T>> = new Map();
  private config: RingBufferConfig;
  private running: boolean = false;
  private globalSequence: Sequence = new Sequence();

  private metrics: RingBufferMetrics = {
    published: 0,
    consumed: 0,
    dropped: 0,
    batchesProcessed: 0,
    avgLatencyUs: 0,
    maxLatencyUs: 0,
    backpressureCount: 0,
    bufferUtilization: 0,
  };
  private latencySum = 0;
  private latencyCount = 0;

  constructor(config: Partial<RingBufferConfig> = {}) {
    this.config = {
      bufferSize: this.nextPow2(config.bufferSize || 1024),
      waitStrategy: config.waitStrategy || WaitStrategy.YIELDING,
      spinTimeoutMs: config.spinTimeoutMs || 100,
      batchSize: config.batchSize || 10,
      enableMetrics: config.enableMetrics ?? true,
    };

    const laneSize = Math.max(64, Math.floor(this.config.bufferSize / 6));
    for (const p of [
      EventPriority.CRITICAL,
      EventPriority.MARKET_DATA,
      EventPriority.SIGNALS,
      EventPriority.ORDERS,
      EventPriority.ANALYTICS,
      EventPriority.SYSTEM,
    ]) {
      this.lanes.set(p, new PriorityLane<T>(p, this.nextPow2(laneSize)));
    }
  }

  private nextPow2(n: number): number {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  }

  publish(
    eventType: string,
    payload: T,
    priority: EventPriority = EventPriority.SYSTEM,
    metadata?: Partial<EventMetadata>
  ): number {
    const lane = this.lanes.get(priority);
    if (!lane) {
      if (this.config.enableMetrics) this.metrics.dropped++;
      return -1;
    }

    const seq = lane.claim();
    if (seq < 0) {
      if (this.config.enableMetrics) {
        this.metrics.backpressureCount++;
        this.metrics.dropped++;
      }
      return -1;
    }

    lane.publish(seq, eventType, payload, metadata);
    this.globalSequence.incrementAndGet();

    if (this.config.enableMetrics) {
      this.metrics.published++;
      this.updateUtilization();
    }

    return seq;
  }

  publishBatch(
    events: Array<{
      eventType: string;
      payload: T;
      priority?: EventPriority;
      metadata?: Partial<EventMetadata>;
    }>
  ): number[] {
    const grouped = new Map<EventPriority, typeof events>();
    for (const e of events) {
      const p = e.priority ?? EventPriority.SYSTEM;
      if (!grouped.has(p)) grouped.set(p, []);
      grouped.get(p)!.push(e);
    }

    const results: number[] = [];

    for (const [priority, batch] of grouped) {
      const lane = this.lanes.get(priority);
      if (!lane) {
        for (let i = 0; i < batch.length; i++) results.push(-1);
        continue;
      }

      const claim = lane.claimBatch(batch.length);
      if (!claim) {
        if (this.config.enableMetrics) {
          this.metrics.backpressureCount++;
          this.metrics.dropped += batch.length;
        }
        for (let i = 0; i < batch.length; i++) results.push(-1);
        continue;
      }

      for (let i = 0; i < batch.length; i++) {
        const seq = claim.start + i;
        lane.publish(seq, batch[i].eventType, batch[i].payload, batch[i].metadata);
        results.push(seq);
        this.globalSequence.incrementAndGet();
      }

      if (this.config.enableMetrics) {
        this.metrics.published += batch.length;
        this.metrics.batchesProcessed++;
      }
    }

    this.updateUtilization();
    return results;
  }

  get(priority: EventPriority, sequence: number): RingBufferEvent<T> | null {
    const lane = this.lanes.get(priority);
    return lane?.get(sequence) ?? null;
  }

  addHandler(
    id: string,
    handler: EventHandler<T>,
    batchHandler?: BatchEventHandler<T>,
    batchSize?: number
  ): void {
    const sequences = new Map<EventPriority, Sequence>();
    for (const [priority, lane] of this.lanes) {
      const seq = new Sequence();
      sequences.set(priority, seq);
      lane.addGatingSequence(seq);
    }

    this.consumers.set(id, {
      id,
      sequences,
      handler,
      batchHandler,
      running: false,
      batchSize: batchSize ?? this.config.batchSize,
    });
  }

  removeHandler(id: string): void {
    const consumer = this.consumers.get(id);
    if (!consumer) return;

    consumer.running = false;
    for (const [priority, seq] of consumer.sequences) {
      const lane = this.lanes.get(priority);
      if (lane) lane.removeGatingSequence(seq);
    }
    this.consumers.delete(id);
  }

  addPriorityHandler(
    id: string,
    priorities: EventPriority[],
    handler: EventHandler<T>
  ): void {
    const wrapped: EventHandler<T> = (event, seq, eob) => {
      if (priorities.includes(event.priority)) {
        return handler(event, seq, eob);
      }
    };
    this.addHandler(id, wrapped);
  }

  addFilterHandler(
    id: string,
    eventTypes: string[],
    handler: EventHandler<T>
  ): void {
    const wrapped: EventHandler<T> = (event, seq, eob) => {
      if (eventTypes.includes(event.eventType)) {
        return handler(event, seq, eob);
      }
    };
    this.addHandler(id, wrapped);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    for (const consumer of this.consumers.values()) {
      consumer.running = true;
      this.runConsumer(consumer);
    }
  }

  private async runConsumer(consumer: ConsumerInfo<T>): Promise<void> {
    const priorityOrder = [
      EventPriority.CRITICAL,
      EventPriority.MARKET_DATA,
      EventPriority.SIGNALS,
      EventPriority.ORDERS,
      EventPriority.ANALYTICS,
      EventPriority.SYSTEM,
    ];

    let iter = 0;
    while (consumer.running) {
      let processed = false;

      for (const priority of priorityOrder) {
        const lane = this.lanes.get(priority);
        const seq = consumer.sequences.get(priority);
        if (!lane || !seq) continue;

        const pos = seq.get();
        const available = lane.getPublished();

        if (available > pos) {
          const nextSeq = pos + 1;
          const event = lane.get(nextSeq);

          if (event) {
            const endOfBatch = nextSeq >= available;
            const startTs = event.timestamp;

            if (consumer.batchHandler && available - pos >= consumer.batchSize) {
              const batchEnd = Math.min(pos + consumer.batchSize, available);
              const batch: RingBufferEvent<T>[] = [];
              for (let s = nextSeq; s <= batchEnd; s++) {
                const e = lane.get(s);
                if (e) batch.push(e);
              }
              if (batch.length > 0) {
                await consumer.batchHandler(batch, nextSeq, batchEnd);
                seq.set(batchEnd);
                if (this.config.enableMetrics) {
                  this.metrics.consumed += batch.length;
                  this.recordLatency(startTs);
                }
              }
            } else {
              await consumer.handler(event, nextSeq, endOfBatch);
              seq.set(nextSeq);
              if (this.config.enableMetrics) {
                this.metrics.consumed++;
                this.recordLatency(startTs);
              }
            }
            processed = true;
            break;
          }
        }
      }

      if (!processed) {
        iter++;
        await applyWait(this.config.waitStrategy, iter);
      } else {
        iter = 0;
      }
    }
  }

  private recordLatency(startTs: number): void {
    const latencyUs = (performance.now() - startTs) * 1000;
    this.latencySum += latencyUs;
    this.latencyCount++;
    this.metrics.avgLatencyUs = this.latencySum / this.latencyCount;
    if (latencyUs > this.metrics.maxLatencyUs) {
      this.metrics.maxLatencyUs = latencyUs;
    }
  }

  private updateUtilization(): void {
    let totalUsed = 0;
    let totalCap = 0;
    for (const lane of this.lanes.values()) {
      const cap = lane.getCapacity();
      const remaining = lane.getRemainingCapacity();
      totalUsed += cap - remaining;
      totalCap += cap;
    }
    this.metrics.bufferUtilization = totalCap > 0 ? totalUsed / totalCap : 0;
  }

  stop(): void {
    this.running = false;
    for (const consumer of this.consumers.values()) {
      consumer.running = false;
    }
  }

  getMetrics(): RingBufferMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      published: 0,
      consumed: 0,
      dropped: 0,
      batchesProcessed: 0,
      avgLatencyUs: 0,
      maxLatencyUs: 0,
      backpressureCount: 0,
      bufferUtilization: 0,
    };
    this.latencySum = 0;
    this.latencyCount = 0;
  }

  getCursor(): number {
    return this.globalSequence.get();
  }

  getCapacity(): number {
    let total = 0;
    for (const lane of this.lanes.values()) {
      total += lane.getCapacity();
    }
    return total;
  }

  getRemainingCapacity(): number {
    let total = 0;
    for (const lane of this.lanes.values()) {
      total += lane.getRemainingCapacity();
    }
    return total;
  }

  clear(): void {
    this.stop();
    for (const p of this.lanes.keys()) {
      const laneSize = this.lanes.get(p)!.getCapacity();
      this.lanes.set(p, new PriorityLane<T>(p, laneSize));
    }
    this.globalSequence = new Sequence();
    this.consumers.clear();
    this.resetMetrics();
  }
}

export const createHighThroughputBuffer = <T = unknown>(size = 4096): RingBuffer<T> =>
  new RingBuffer<T>({
    bufferSize: size,
    waitStrategy: WaitStrategy.BUSY_SPIN,
    spinTimeoutMs: 50,
    batchSize: 100,
    enableMetrics: true,
  });

export const createLowLatencyBuffer = <T = unknown>(size = 1024): RingBuffer<T> =>
  new RingBuffer<T>({
    bufferSize: size,
    waitStrategy: WaitStrategy.BUSY_SPIN,
    spinTimeoutMs: 10,
    batchSize: 1,
    enableMetrics: true,
  });

export const createBalancedBuffer = <T = unknown>(size = 2048): RingBuffer<T> =>
  new RingBuffer<T>({
    bufferSize: size,
    waitStrategy: WaitStrategy.YIELDING,
    spinTimeoutMs: 100,
    batchSize: 10,
    enableMetrics: true,
  });

export const createLowCpuBuffer = <T = unknown>(size = 1024): RingBuffer<T> =>
  new RingBuffer<T>({
    bufferSize: size,
    waitStrategy: WaitStrategy.SLEEPING,
    spinTimeoutMs: 500,
    batchSize: 50,
    enableMetrics: true,
  });

export interface TradingEvent {
  type: EventType;
  data: unknown;
}

export const createTradingEventBuffer = (size = 2048): RingBuffer<TradingEvent> => {
  return createBalancedBuffer<TradingEvent>(size);
};

export const getTradingEventPriority = (eventType: EventType): EventPriority => {
  if (eventType.startsWith('market.')) return EventPriority.MARKET_DATA;
  if (eventType.startsWith('ai.')) return EventPriority.SIGNALS;
  if (eventType.startsWith('trade.order.')) return EventPriority.ORDERS;
  if (eventType.startsWith('analytics.')) return EventPriority.ANALYTICS;
  if (eventType.startsWith('system.alert.') || eventType.includes('kill')) {
    return EventPriority.CRITICAL;
  }
  return EventPriority.SYSTEM;
};
