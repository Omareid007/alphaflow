/**
 * AI Active Trader - Bulkhead Pattern & Backpressure
 * Isolates failures and prevents cascade effects using resource isolation.
 * Based on Netflix Hystrix Bulkhead and reactive streams backpressure patterns.
 */

export interface BulkheadConfig {
  name: string;
  maxConcurrent: number;
  maxQueueSize: number;
  queueTimeoutMs: number;
  onRejected?: (name: string, reason: string) => void;
  onQueued?: (name: string, queuePosition: number) => void;
  onExecuted?: (name: string, durationMs: number) => void;
}

interface QueuedTask<T> {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  enqueuedAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

const DEFAULT_CONFIG: Partial<BulkheadConfig> = {
  maxConcurrent: 10,
  maxQueueSize: 100,
  queueTimeoutMs: 30000,
};

export class Bulkhead {
  private config: BulkheadConfig;
  private activeTasks = 0;
  private queue: QueuedTask<any>[] = [];
  private stats = {
    totalSubmitted: 0,
    totalExecuted: 0,
    totalRejected: 0,
    totalTimedOut: 0,
    totalFailed: 0,
  };

  constructor(config: Partial<BulkheadConfig> & { name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config } as BulkheadConfig;
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    this.stats.totalSubmitted++;

    if (this.activeTasks < this.config.maxConcurrent) {
      return this.runTask(task);
    }

    if (this.queue.length >= this.config.maxQueueSize) {
      this.stats.totalRejected++;
      this.config.onRejected?.(this.config.name, 'Queue full');
      throw new BulkheadRejectedException(this.config.name, 'Queue capacity exceeded');
    }

    return this.enqueue(task);
  }

  private async runTask<T>(task: () => Promise<T>): Promise<T> {
    this.activeTasks++;
    const startTime = Date.now();

    try {
      const result = await task();
      this.stats.totalExecuted++;
      this.config.onExecuted?.(this.config.name, Date.now() - startTime);
      return result;
    } catch (error) {
      this.stats.totalFailed++;
      throw error;
    } finally {
      this.activeTasks--;
      this.processQueue();
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.queue.findIndex(q => q.timeoutId as unknown === timeoutId as unknown);
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.stats.totalTimedOut++;
          reject(new BulkheadTimeoutException(this.config.name));
        }
      }, this.config.queueTimeoutMs);

      const queuedTask: QueuedTask<T> = {
        task,
        resolve,
        reject,
        enqueuedAt: Date.now(),
        timeoutId,
      };

      this.queue.push(queuedTask);
      this.config.onQueued?.(this.config.name, this.queue.length);
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.activeTasks >= this.config.maxConcurrent) {
      return;
    }

    const queuedTask = this.queue.shift()!;
    clearTimeout(queuedTask.timeoutId);

    this.runTask(queuedTask.task)
      .then(queuedTask.resolve)
      .catch(queuedTask.reject);
  }

  getStats(): Readonly<typeof this.stats & {
    activeTasks: number;
    queueSize: number;
    availableSlots: number;
  }> {
    return {
      ...this.stats,
      activeTasks: this.activeTasks,
      queueSize: this.queue.length,
      availableSlots: this.config.maxConcurrent - this.activeTasks,
    };
  }

  isAvailable(): boolean {
    return this.activeTasks < this.config.maxConcurrent || this.queue.length < this.config.maxQueueSize;
  }

  getUtilization(): number {
    return this.activeTasks / this.config.maxConcurrent;
  }

  drain(): void {
    for (const queuedTask of this.queue) {
      clearTimeout(queuedTask.timeoutId);
      queuedTask.reject(new BulkheadRejectedException(this.config.name, 'Bulkhead drained'));
    }
    this.queue = [];
  }
}

export class BulkheadRejectedException extends Error {
  constructor(
    public readonly bulkheadName: string,
    public readonly reason: string
  ) {
    super(`Bulkhead '${bulkheadName}' rejected: ${reason}`);
    this.name = 'BulkheadRejectedException';
  }
}

export class BulkheadTimeoutException extends Error {
  constructor(public readonly bulkheadName: string) {
    super(`Bulkhead '${bulkheadName}' queue timeout exceeded`);
    this.name = 'BulkheadTimeoutException';
  }
}

export class BackpressureController {
  private highWaterMark: number;
  private lowWaterMark: number;
  private currentLevel = 0;
  private paused = false;
  private onPause?: () => void;
  private onResume?: () => void;

  constructor(config: {
    highWaterMark: number;
    lowWaterMark: number;
    onPause?: () => void;
    onResume?: () => void;
  }) {
    this.highWaterMark = config.highWaterMark;
    this.lowWaterMark = config.lowWaterMark;
    this.onPause = config.onPause;
    this.onResume = config.onResume;
  }

  increment(amount = 1): boolean {
    this.currentLevel += amount;

    if (!this.paused && this.currentLevel >= this.highWaterMark) {
      this.paused = true;
      this.onPause?.();
      return false;
    }

    return !this.paused;
  }

  decrement(amount = 1): boolean {
    this.currentLevel = Math.max(0, this.currentLevel - amount);

    if (this.paused && this.currentLevel <= this.lowWaterMark) {
      this.paused = false;
      this.onResume?.();
      return true;
    }

    return !this.paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getCurrentLevel(): number {
    return this.currentLevel;
  }

  getUtilization(): number {
    return this.currentLevel / this.highWaterMark;
  }

  reset(): void {
    this.currentLevel = 0;
    if (this.paused) {
      this.paused = false;
      this.onResume?.();
    }
  }
}

export class BulkheadRegistry {
  private static instance: BulkheadRegistry;
  private bulkheads: Map<string, Bulkhead> = new Map();

  static getInstance(): BulkheadRegistry {
    if (!BulkheadRegistry.instance) {
      BulkheadRegistry.instance = new BulkheadRegistry();
    }
    return BulkheadRegistry.instance;
  }

  getOrCreate(config: Partial<BulkheadConfig> & { name: string }): Bulkhead {
    let bulkhead = this.bulkheads.get(config.name);
    if (!bulkhead) {
      bulkhead = new Bulkhead(config);
      this.bulkheads.set(config.name, bulkhead);
    }
    return bulkhead;
  }

  get(name: string): Bulkhead | undefined {
    return this.bulkheads.get(name);
  }

  getAllStats(): Record<string, ReturnType<Bulkhead['getStats']>> {
    const stats: Record<string, ReturnType<Bulkhead['getStats']>> = {};
    for (const [name, bulkhead] of this.bulkheads) {
      stats[name] = bulkhead.getStats();
    }
    return stats;
  }

  drainAll(): void {
    for (const bulkhead of this.bulkheads.values()) {
      bulkhead.drain();
    }
  }
}

export function createBulkhead(config: Partial<BulkheadConfig> & { name: string }): Bulkhead {
  return BulkheadRegistry.getInstance().getOrCreate(config);
}

export function createBackpressureController(config: {
  highWaterMark: number;
  lowWaterMark: number;
  onPause?: () => void;
  onResume?: () => void;
}): BackpressureController {
  return new BackpressureController(config);
}
