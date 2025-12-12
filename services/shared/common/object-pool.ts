/**
 * AI Active Trader - Object Pooling
 * High-performance object recycling for HFT paths
 * 
 * Features:
 * - Generic type-safe object pools
 * - Auto-scaling pool capacity
 * - Warm-up and pre-allocation
 * - Pool statistics and monitoring
 * - Specialized pools for common trading objects
 * 
 * Note: This pool is designed for single-threaded Node.js event loop usage.
 * For multi-worker scenarios, each worker should maintain its own pool instance.
 */

import { performance } from 'perf_hooks';
import { createLogger } from './index';

const logger = createLogger('object-pool');

export interface PoolableObject {
  reset(): void;
}

export interface ObjectPoolConfig {
  initialSize: number;
  maxSize: number;
  autoScale: boolean;
  scaleThreshold: number;
  scaleIncrement: number;
  warmupEnabled: boolean;
  validateOnAcquire: boolean;
  validateOnRelease: boolean;
  resetOnRelease: boolean;
  trackStats: boolean;
}

export interface PoolStats {
  name: string;
  totalCreated: number;
  totalAcquired: number;
  totalReleased: number;
  currentPoolSize: number;
  currentInUse: number;
  highWaterMark: number;
  acquireWaitTimeMs: number;
  averageAcquireTimeUs: number;
  missCount: number;
  hitCount: number;
  hitRate: number;
}

type ObjectFactory<T> = () => T;
type ObjectValidator<T> = (obj: T) => boolean;
type ObjectResetter<T> = (obj: T) => void;

export class ObjectPool<T> {
  private readonly name: string;
  private readonly config: ObjectPoolConfig;
  private readonly factory: ObjectFactory<T>;
  private readonly validator: ObjectValidator<T>;
  private readonly resetter: ObjectResetter<T>;
  
  private pool: T[] = [];
  private inUse: Set<T> = new Set();
  
  private stats = {
    totalCreated: 0,
    totalAcquired: 0,
    totalReleased: 0,
    highWaterMark: 0,
    acquireTimeSum: 0,
    missCount: 0,
    hitCount: 0,
  };

  constructor(
    name: string,
    factory: ObjectFactory<T>,
    config: Partial<ObjectPoolConfig> = {},
    validator?: ObjectValidator<T>,
    resetter?: ObjectResetter<T>
  ) {
    this.name = name;
    this.factory = factory;
    this.validator = validator || (() => true);
    this.resetter = resetter || ((obj: T) => {
      if (typeof (obj as unknown as PoolableObject).reset === 'function') {
        (obj as unknown as PoolableObject).reset();
      }
    });

    this.config = {
      initialSize: config.initialSize ?? 10,
      maxSize: config.maxSize ?? 1000,
      autoScale: config.autoScale ?? true,
      scaleThreshold: config.scaleThreshold ?? 0.8,
      scaleIncrement: config.scaleIncrement ?? 10,
      warmupEnabled: config.warmupEnabled ?? true,
      validateOnAcquire: config.validateOnAcquire ?? false,
      validateOnRelease: config.validateOnRelease ?? false,
      resetOnRelease: config.resetOnRelease ?? true,
      trackStats: config.trackStats ?? true,
    };

    if (this.config.warmupEnabled) {
      this.warmup();
    }
  }

  private warmup(): void {
    for (let i = 0; i < this.config.initialSize; i++) {
      const obj = this.createObject();
      this.pool.push(obj);
    }
    logger.debug('Pool warmed up', { name: this.name, size: this.pool.length });
  }

  private createObject(): T {
    const obj = this.factory();
    this.stats.totalCreated++;
    return obj;
  }

  acquire(): T {
    const startTime = this.config.trackStats ? performance.now() : 0;

    let obj: T | undefined;

    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
      this.stats.hitCount++;

      if (this.config.validateOnAcquire && !this.validator(obj)) {
        obj = this.createObject();
        this.stats.missCount++;
        this.stats.hitCount--;
      }
    } else {
      obj = this.createObject();
      this.stats.missCount++;

      if (this.config.autoScale && this.shouldScale()) {
        this.scale();
      }
    }

    this.inUse.add(obj);
    this.stats.totalAcquired++;
    
    if (this.inUse.size > this.stats.highWaterMark) {
      this.stats.highWaterMark = this.inUse.size;
    }

    if (this.config.trackStats) {
      const elapsed = performance.now() - startTime;
      this.stats.acquireTimeSum += elapsed * 1000;
    }

    return obj;
  }

  release(obj: T): void {
    if (!this.inUse.has(obj)) {
      logger.warn('Attempted to release object not from this pool', { name: this.name });
      return;
    }

    this.inUse.delete(obj);

    if (this.config.validateOnRelease && !this.validator(obj)) {
      this.stats.totalReleased++;
      return;
    }

    if (this.config.resetOnRelease) {
      this.resetter(obj);
    }

    if (this.pool.length < this.config.maxSize) {
      this.pool.push(obj);
    }

    this.stats.totalReleased++;
  }

  private shouldScale(): boolean {
    const totalCapacity = this.pool.length + this.inUse.size;
    const utilizationRate = this.inUse.size / Math.max(totalCapacity, 1);
    return utilizationRate >= this.config.scaleThreshold;
  }

  private scale(): void {
    const currentTotal = this.pool.length + this.inUse.size;
    const targetSize = Math.min(
      currentTotal + this.config.scaleIncrement,
      this.config.maxSize
    );

    const toCreate = targetSize - currentTotal;
    for (let i = 0; i < toCreate; i++) {
      this.pool.push(this.createObject());
    }

    logger.debug('Pool scaled', { 
      name: this.name, 
      added: toCreate, 
      newSize: this.pool.length + this.inUse.size 
    });
  }

  getStats(): PoolStats {
    const totalOperations = this.stats.hitCount + this.stats.missCount;
    
    return {
      name: this.name,
      totalCreated: this.stats.totalCreated,
      totalAcquired: this.stats.totalAcquired,
      totalReleased: this.stats.totalReleased,
      currentPoolSize: this.pool.length,
      currentInUse: this.inUse.size,
      highWaterMark: this.stats.highWaterMark,
      acquireWaitTimeMs: 0,
      averageAcquireTimeUs: this.stats.totalAcquired > 0 
        ? this.stats.acquireTimeSum / this.stats.totalAcquired 
        : 0,
      missCount: this.stats.missCount,
      hitCount: this.stats.hitCount,
      hitRate: totalOperations > 0 ? this.stats.hitCount / totalOperations : 0,
    };
  }

  clear(): void {
    this.pool = [];
    this.inUse.clear();
    this.stats = {
      totalCreated: 0,
      totalAcquired: 0,
      totalReleased: 0,
      highWaterMark: 0,
      acquireTimeSum: 0,
      missCount: 0,
      hitCount: 0,
    };
  }

  preAllocate(count: number): void {
    const toCreate = Math.min(
      count - this.pool.length,
      this.config.maxSize - this.pool.length - this.inUse.size
    );

    for (let i = 0; i < toCreate; i++) {
      this.pool.push(this.createObject());
    }
  }
}

export class MarketDataEvent implements PoolableObject {
  symbol: string = '';
  price: number = 0;
  volume: number = 0;
  bid: number = 0;
  ask: number = 0;
  timestamp: number = 0;
  sequenceNumber: number = 0;

  reset(): void {
    this.symbol = '';
    this.price = 0;
    this.volume = 0;
    this.bid = 0;
    this.ask = 0;
    this.timestamp = 0;
    this.sequenceNumber = 0;
  }

  set(data: {
    symbol: string;
    price: number;
    volume: number;
    bid?: number;
    ask?: number;
    timestamp?: number;
    sequenceNumber?: number;
  }): this {
    this.symbol = data.symbol;
    this.price = data.price;
    this.volume = data.volume;
    this.bid = data.bid ?? data.price;
    this.ask = data.ask ?? data.price;
    this.timestamp = data.timestamp ?? Date.now();
    this.sequenceNumber = data.sequenceNumber ?? 0;
    return this;
  }
}

export class OrderEvent implements PoolableObject {
  orderId: string = '';
  symbol: string = '';
  side: 'buy' | 'sell' = 'buy';
  type: 'market' | 'limit' | 'stop' = 'market';
  quantity: number = 0;
  price: number = 0;
  stopPrice: number = 0;
  status: 'pending' | 'submitted' | 'filled' | 'cancelled' | 'rejected' = 'pending';
  filledQuantity: number = 0;
  avgFillPrice: number = 0;
  timestamp: number = 0;

  reset(): void {
    this.orderId = '';
    this.symbol = '';
    this.side = 'buy';
    this.type = 'market';
    this.quantity = 0;
    this.price = 0;
    this.stopPrice = 0;
    this.status = 'pending';
    this.filledQuantity = 0;
    this.avgFillPrice = 0;
    this.timestamp = 0;
  }

  set(data: Partial<Omit<OrderEvent, 'reset' | 'set'>>): this {
    if (data.orderId !== undefined) this.orderId = data.orderId;
    if (data.symbol !== undefined) this.symbol = data.symbol;
    if (data.side !== undefined) this.side = data.side;
    if (data.type !== undefined) this.type = data.type;
    if (data.quantity !== undefined) this.quantity = data.quantity;
    if (data.price !== undefined) this.price = data.price;
    if (data.stopPrice !== undefined) this.stopPrice = data.stopPrice;
    if (data.status !== undefined) this.status = data.status;
    if (data.filledQuantity !== undefined) this.filledQuantity = data.filledQuantity;
    if (data.avgFillPrice !== undefined) this.avgFillPrice = data.avgFillPrice;
    this.timestamp = data.timestamp ?? Date.now();
    return this;
  }
}

export class SignalEvent implements PoolableObject {
  signalId: string = '';
  strategyId: string = '';
  symbol: string = '';
  direction: 'long' | 'short' | 'flat' = 'flat';
  strength: number = 0;
  confidence: number = 0;
  targetPrice: number = 0;
  stopLoss: number = 0;
  timestamp: number = 0;
  expiresAt: number = 0;
  metadata: Record<string, unknown> = {};

  reset(): void {
    this.signalId = '';
    this.strategyId = '';
    this.symbol = '';
    this.direction = 'flat';
    this.strength = 0;
    this.confidence = 0;
    this.targetPrice = 0;
    this.stopLoss = 0;
    this.timestamp = 0;
    this.expiresAt = 0;
    this.metadata = {};
  }

  set(data: Partial<Omit<SignalEvent, 'reset' | 'set'>>): this {
    if (data.signalId !== undefined) this.signalId = data.signalId;
    if (data.strategyId !== undefined) this.strategyId = data.strategyId;
    if (data.symbol !== undefined) this.symbol = data.symbol;
    if (data.direction !== undefined) this.direction = data.direction;
    if (data.strength !== undefined) this.strength = data.strength;
    if (data.confidence !== undefined) this.confidence = data.confidence;
    if (data.targetPrice !== undefined) this.targetPrice = data.targetPrice;
    if (data.stopLoss !== undefined) this.stopLoss = data.stopLoss;
    if (data.expiresAt !== undefined) this.expiresAt = data.expiresAt;
    if (data.metadata !== undefined) this.metadata = data.metadata;
    this.timestamp = data.timestamp ?? Date.now();
    return this;
  }
}

export class IndicatorBuffer implements PoolableObject {
  private values: Float64Array;
  private capacity: number;
  private head: number = 0;
  private count: number = 0;

  constructor(capacity: number = 256) {
    this.capacity = capacity;
    this.values = new Float64Array(capacity);
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
  }

  push(value: number): void {
    this.values[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  get(index: number): number {
    if (index < 0 || index >= this.count) {
      return NaN;
    }
    const actualIndex = (this.head - this.count + index + this.capacity) % this.capacity;
    return this.values[actualIndex];
  }

  getLast(n: number = 1): number {
    return this.get(this.count - n);
  }

  getAll(): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.count; i++) {
      result.push(this.get(i));
    }
    return result;
  }

  size(): number {
    return this.count;
  }

  isFull(): boolean {
    return this.count === this.capacity;
  }
}

export class PriceBar implements PoolableObject {
  open: number = 0;
  high: number = 0;
  low: number = 0;
  close: number = 0;
  volume: number = 0;
  timestamp: number = 0;
  vwap: number = 0;
  trades: number = 0;

  reset(): void {
    this.open = 0;
    this.high = 0;
    this.low = 0;
    this.close = 0;
    this.volume = 0;
    this.timestamp = 0;
    this.vwap = 0;
    this.trades = 0;
  }

  set(data: Partial<Omit<PriceBar, 'reset' | 'set'>>): this {
    if (data.open !== undefined) this.open = data.open;
    if (data.high !== undefined) this.high = data.high;
    if (data.low !== undefined) this.low = data.low;
    if (data.close !== undefined) this.close = data.close;
    if (data.volume !== undefined) this.volume = data.volume;
    if (data.timestamp !== undefined) this.timestamp = data.timestamp;
    if (data.vwap !== undefined) this.vwap = data.vwap;
    if (data.trades !== undefined) this.trades = data.trades;
    return this;
  }

  updateWithTick(price: number, volume: number): void {
    if (this.trades === 0) {
      this.open = price;
      this.high = price;
      this.low = price;
    } else {
      this.high = Math.max(this.high, price);
      this.low = Math.min(this.low, price);
    }
    this.close = price;
    
    const totalValue = this.vwap * this.volume + price * volume;
    this.volume += volume;
    this.vwap = this.volume > 0 ? totalValue / this.volume : price;
    this.trades++;
  }
}

class TradingObjectPools {
  readonly marketData: ObjectPool<MarketDataEvent>;
  readonly orders: ObjectPool<OrderEvent>;
  readonly signals: ObjectPool<SignalEvent>;
  readonly indicators: ObjectPool<IndicatorBuffer>;
  readonly priceBars: ObjectPool<PriceBar>;

  constructor() {
    this.marketData = new ObjectPool<MarketDataEvent>(
      'MarketDataEvent',
      () => new MarketDataEvent(),
      { initialSize: 100, maxSize: 10000 }
    );

    this.orders = new ObjectPool<OrderEvent>(
      'OrderEvent',
      () => new OrderEvent(),
      { initialSize: 50, maxSize: 1000 }
    );

    this.signals = new ObjectPool<SignalEvent>(
      'SignalEvent',
      () => new SignalEvent(),
      { initialSize: 50, maxSize: 1000 }
    );

    this.indicators = new ObjectPool<IndicatorBuffer>(
      'IndicatorBuffer',
      () => new IndicatorBuffer(256),
      { initialSize: 20, maxSize: 200 }
    );

    this.priceBars = new ObjectPool<PriceBar>(
      'PriceBar',
      () => new PriceBar(),
      { initialSize: 100, maxSize: 5000 }
    );

    logger.info('Trading object pools initialized');
  }

  getAllStats(): PoolStats[] {
    return [
      this.marketData.getStats(),
      this.orders.getStats(),
      this.signals.getStats(),
      this.indicators.getStats(),
      this.priceBars.getStats(),
    ];
  }

  clearAll(): void {
    this.marketData.clear();
    this.orders.clear();
    this.signals.clear();
    this.indicators.clear();
    this.priceBars.clear();
  }

  warmupAll(): void {
    this.marketData.preAllocate(100);
    this.orders.preAllocate(50);
    this.signals.preAllocate(50);
    this.indicators.preAllocate(20);
    this.priceBars.preAllocate(100);
  }
}

let defaultPools: TradingObjectPools | null = null;

export function getTradingPools(): TradingObjectPools {
  if (!defaultPools) {
    defaultPools = new TradingObjectPools();
  }
  return defaultPools;
}

export function createTypedPool<T extends PoolableObject>(
  name: string,
  factory: () => T,
  config?: Partial<ObjectPoolConfig>
): ObjectPool<T> {
  return new ObjectPool<T>(name, factory, config);
}

export function withPooledObject<T, R>(
  pool: ObjectPool<T>,
  fn: (obj: T) => R
): R {
  const obj = pool.acquire();
  try {
    return fn(obj);
  } finally {
    pool.release(obj);
  }
}

export async function withPooledObjectAsync<T, R>(
  pool: ObjectPool<T>,
  fn: (obj: T) => Promise<R>
): Promise<R> {
  const obj = pool.acquire();
  try {
    return await fn(obj);
  } finally {
    pool.release(obj);
  }
}
