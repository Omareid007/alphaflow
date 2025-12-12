/**
 * AI Active Trader - Dead Letter Queue
 * Handles failed events with retry logic, alerting, and persistence.
 * Based on AWS SQS DLQ and RabbitMQ dead letter patterns.
 */

export interface DeadLetterEntry<T = unknown> {
  id: string;
  originalSubject: string;
  payload: T;
  error: string;
  errorStack?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  lastAttemptAt: Date;
  nextRetryAt: Date | null;
  status: 'pending' | 'retrying' | 'failed' | 'resolved';
  metadata: Record<string, unknown>;
}

export interface DLQConfig {
  maxAttempts: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  retryBackoffMultiplier: number;
  maxQueueSize: number;
  onDeadLetter?: (entry: DeadLetterEntry) => void;
  onMaxRetriesExceeded?: (entry: DeadLetterEntry) => void;
  onRetry?: (entry: DeadLetterEntry) => void;
}

const DEFAULT_CONFIG: DLQConfig = {
  maxAttempts: 5,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 300000,
  retryBackoffMultiplier: 2,
  maxQueueSize: 10000,
};

function generateDLQId(): string {
  return `dlq_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

export class DeadLetterQueue {
  private config: DLQConfig;
  private queue: Map<string, DeadLetterEntry> = new Map();
  private retryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private retryHandler: ((entry: DeadLetterEntry) => Promise<boolean>) | null = null;
  private stats = {
    totalReceived: 0,
    totalRetried: 0,
    totalResolved: 0,
    totalFailed: 0,
  };

  constructor(config: Partial<DLQConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setRetryHandler(handler: (entry: DeadLetterEntry) => Promise<boolean>): void {
    this.retryHandler = handler;
  }

  add<T>(
    subject: string,
    payload: T,
    error: Error | string,
    metadata: Record<string, unknown> = {}
  ): DeadLetterEntry<T> {
    if (this.queue.size >= this.config.maxQueueSize) {
      const oldestEntry = this.getOldestPendingEntry();
      if (oldestEntry) {
        this.markAsFailed(oldestEntry.id, 'Evicted due to queue size limit');
      }
    }

    const id = generateDLQId();
    const now = new Date();
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    const entry: DeadLetterEntry<T> = {
      id,
      originalSubject: subject,
      payload,
      error: errorMessage,
      errorStack,
      attempts: 1,
      maxAttempts: this.config.maxAttempts,
      createdAt: now,
      lastAttemptAt: now,
      nextRetryAt: this.calculateNextRetryTime(1),
      status: 'pending',
      metadata,
    };

    this.queue.set(id, entry as DeadLetterEntry);
    this.stats.totalReceived++;
    this.config.onDeadLetter?.(entry as DeadLetterEntry);
    this.scheduleRetry(entry as DeadLetterEntry);

    return entry;
  }

  private calculateNextRetryTime(attempt: number): Date | null {
    if (attempt >= this.config.maxAttempts) {
      return null;
    }

    const delay = Math.min(
      this.config.baseRetryDelayMs * Math.pow(this.config.retryBackoffMultiplier, attempt - 1),
      this.config.maxRetryDelayMs
    );

    return new Date(Date.now() + delay);
  }

  private scheduleRetry(entry: DeadLetterEntry): void {
    if (!entry.nextRetryAt || !this.retryHandler) {
      return;
    }

    const existingTimer = this.retryTimers.get(entry.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const delay = Math.max(0, entry.nextRetryAt.getTime() - Date.now());
    const timer = setTimeout(() => this.attemptRetry(entry.id), delay);
    this.retryTimers.set(entry.id, timer);
  }

  private async attemptRetry(id: string): Promise<void> {
    const entry = this.queue.get(id);
    if (!entry || entry.status !== 'pending') {
      return;
    }

    if (!this.retryHandler) {
      return;
    }

    entry.status = 'retrying';
    entry.attempts++;
    entry.lastAttemptAt = new Date();
    this.stats.totalRetried++;
    this.config.onRetry?.(entry);

    try {
      const success = await this.retryHandler(entry);

      if (success) {
        this.markAsResolved(id);
      } else {
        this.handleRetryFailure(entry, 'Retry returned false');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.handleRetryFailure(entry, errorMessage);
    }
  }

  private handleRetryFailure(entry: DeadLetterEntry, error: string): void {
    entry.error = error;
    entry.status = 'pending';
    entry.nextRetryAt = this.calculateNextRetryTime(entry.attempts);

    if (entry.attempts >= this.config.maxAttempts) {
      this.markAsFailed(entry.id, 'Max retries exceeded');
      this.config.onMaxRetriesExceeded?.(entry);
    } else {
      this.scheduleRetry(entry);
    }
  }

  markAsResolved(id: string): boolean {
    const entry = this.queue.get(id);
    if (!entry) {
      return false;
    }

    const timer = this.retryTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(id);
    }

    entry.status = 'resolved';
    entry.nextRetryAt = null;
    this.stats.totalResolved++;

    return true;
  }

  markAsFailed(id: string, reason?: string): boolean {
    const entry = this.queue.get(id);
    if (!entry) {
      return false;
    }

    const timer = this.retryTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(id);
    }

    entry.status = 'failed';
    entry.nextRetryAt = null;
    if (reason) {
      entry.error = reason;
    }
    this.stats.totalFailed++;

    return true;
  }

  getEntry(id: string): DeadLetterEntry | undefined {
    return this.queue.get(id);
  }

  getPendingEntries(): DeadLetterEntry[] {
    return Array.from(this.queue.values()).filter(e => e.status === 'pending');
  }

  getFailedEntries(): DeadLetterEntry[] {
    return Array.from(this.queue.values()).filter(e => e.status === 'failed');
  }

  getAllEntries(): DeadLetterEntry[] {
    return Array.from(this.queue.values());
  }

  private getOldestPendingEntry(): DeadLetterEntry | undefined {
    let oldest: DeadLetterEntry | undefined;
    for (const entry of this.queue.values()) {
      if (entry.status === 'pending') {
        if (!oldest || entry.createdAt < oldest.createdAt) {
          oldest = entry;
        }
      }
    }
    return oldest;
  }

  getStats(): Readonly<typeof this.stats & { queueSize: number; pendingCount: number }> {
    return {
      ...this.stats,
      queueSize: this.queue.size,
      pendingCount: this.getPendingEntries().length,
    };
  }

  purgeResolved(): number {
    let purged = 0;
    for (const [id, entry] of this.queue) {
      if (entry.status === 'resolved') {
        this.queue.delete(id);
        purged++;
      }
    }
    return purged;
  }

  purgeOlderThan(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    let purged = 0;
    for (const [id, entry] of this.queue) {
      if (entry.createdAt.getTime() < cutoff) {
        const timer = this.retryTimers.get(id);
        if (timer) {
          clearTimeout(timer);
          this.retryTimers.delete(id);
        }
        this.queue.delete(id);
        purged++;
      }
    }
    return purged;
  }

  clear(): void {
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
    this.queue.clear();
  }
}

export function createDeadLetterQueue(config?: Partial<DLQConfig>): DeadLetterQueue {
  return new DeadLetterQueue(config);
}
