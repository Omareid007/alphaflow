import { db } from "../db";
import { connectorMetrics } from "@shared/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { log } from "../utils/logger";

export interface MetricEvent {
  connector: string;
  endpoint: string;
  success: boolean;
  latencyMs: number;
  cacheHit: boolean;
  rateLimited: boolean;
  usedFallback: boolean;
  error?: string;
}

interface LatencyBuffer {
  latencies: number[];
  maxSize: number;
}

class ConnectorMetricsService {
  private memoryBuffer: Map<string, {
    totalRequests: number;
    successCount: number;
    failureCount: number;
    cacheHits: number;
    cacheMisses: number;
    rateLimitHits: number;
    fallbackUsed: number;
    latencies: LatencyBuffer;
    lastError?: string;
    lastErrorAt?: Date;
  }>;

  private flushIntervalMs = 60000;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.memoryBuffer = new Map();
    this.startFlushTimer();
  }

  private getBufferKey(connector: string, endpoint: string): string {
    return `${connector}:${endpoint}`;
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flushToDatabase().catch((err) => {
        log.error("ConnectorMetricsService", "Failed to flush metrics", { error: err });
      });
    }, this.flushIntervalMs);
  }

  recordEvent(event: MetricEvent): void {
    const key = this.getBufferKey(event.connector, event.endpoint);
    
    let buffer = this.memoryBuffer.get(key);
    if (!buffer) {
      buffer = {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        cacheHits: 0,
        cacheMisses: 0,
        rateLimitHits: 0,
        fallbackUsed: 0,
        latencies: { latencies: [], maxSize: 1000 },
      };
      this.memoryBuffer.set(key, buffer);
    }

    buffer.totalRequests++;
    if (event.success) {
      buffer.successCount++;
    } else {
      buffer.failureCount++;
      buffer.lastError = event.error;
      buffer.lastErrorAt = new Date();
    }

    if (event.cacheHit) {
      buffer.cacheHits++;
    } else {
      buffer.cacheMisses++;
    }

    if (event.rateLimited) {
      buffer.rateLimitHits++;
    }

    if (event.usedFallback) {
      buffer.fallbackUsed++;
    }

    if (buffer.latencies.latencies.length < buffer.latencies.maxSize) {
      buffer.latencies.latencies.push(event.latencyMs);
    }
  }

  private calculatePercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateStats(latencies: number[]): {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    if (latencies.length === 0) {
      return { avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      avg: sum / sorted.length,
      p50: this.calculatePercentile(sorted, 50),
      p95: this.calculatePercentile(sorted, 95),
      p99: this.calculatePercentile(sorted, 99),
    };
  }

  async flushToDatabase(): Promise<void> {
    const now = new Date();
    const dateKey = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const [key, buffer] of this.memoryBuffer.entries()) {
      const [connector, endpoint] = key.split(":");
      const stats = this.calculateStats(buffer.latencies.latencies);

      try {
        const existing = await db
          .select()
          .from(connectorMetrics)
          .where(
            and(
              eq(connectorMetrics.connector, connector),
              eq(connectorMetrics.endpoint, endpoint),
              gte(connectorMetrics.date, dateKey)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          const oldTotal = existing[0].totalRequests;
          const newTotal = oldTotal + buffer.totalRequests;
          const oldAvg = parseFloat(existing[0].avgLatencyMs || "0");
          const newAvg = oldTotal > 0
            ? (oldAvg * oldTotal + stats.avg * buffer.totalRequests) / newTotal
            : stats.avg;

          await db
            .update(connectorMetrics)
            .set({
              totalRequests: newTotal,
              successCount: existing[0].successCount + buffer.successCount,
              failureCount: existing[0].failureCount + buffer.failureCount,
              cacheHits: existing[0].cacheHits + buffer.cacheHits,
              cacheMisses: existing[0].cacheMisses + buffer.cacheMisses,
              rateLimitHits: existing[0].rateLimitHits + buffer.rateLimitHits,
              fallbackUsed: existing[0].fallbackUsed + buffer.fallbackUsed,
              avgLatencyMs: newAvg.toFixed(2),
              p50LatencyMs: stats.p50.toFixed(2),
              p95LatencyMs: stats.p95.toFixed(2),
              p99LatencyMs: stats.p99.toFixed(2),
              lastError: buffer.lastError || existing[0].lastError,
              lastErrorAt: buffer.lastErrorAt || existing[0].lastErrorAt,
              updatedAt: now,
            })
            .where(eq(connectorMetrics.id, existing[0].id));
        } else {
          await db.insert(connectorMetrics).values({
            connector,
            endpoint,
            date: dateKey,
            totalRequests: buffer.totalRequests,
            successCount: buffer.successCount,
            failureCount: buffer.failureCount,
            cacheHits: buffer.cacheHits,
            cacheMisses: buffer.cacheMisses,
            rateLimitHits: buffer.rateLimitHits,
            fallbackUsed: buffer.fallbackUsed,
            avgLatencyMs: stats.avg.toFixed(2),
            p50LatencyMs: stats.p50.toFixed(2),
            p95LatencyMs: stats.p95.toFixed(2),
            p99LatencyMs: stats.p99.toFixed(2),
            lastError: buffer.lastError,
            lastErrorAt: buffer.lastErrorAt,
            createdAt: now,
            updatedAt: now,
          });
        }

        buffer.totalRequests = 0;
        buffer.successCount = 0;
        buffer.failureCount = 0;
        buffer.cacheHits = 0;
        buffer.cacheMisses = 0;
        buffer.rateLimitHits = 0;
        buffer.fallbackUsed = 0;
        buffer.latencies.latencies = [];
        buffer.lastError = undefined;
        buffer.lastErrorAt = undefined;
      } catch (error) {
        log.error("ConnectorMetricsService", `Failed to flush metrics for ${key}`, { error });
      }
    }
  }

  async getMetricsByConnector(connector: string, days: number = 7): Promise<typeof connectorMetrics.$inferSelect[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return db
      .select()
      .from(connectorMetrics)
      .where(
        and(
          eq(connectorMetrics.connector, connector),
          gte(connectorMetrics.date, since)
        )
      )
      .orderBy(desc(connectorMetrics.date));
  }

  async getLatestMetrics(): Promise<typeof connectorMetrics.$inferSelect[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return db
      .select()
      .from(connectorMetrics)
      .where(gte(connectorMetrics.date, today))
      .orderBy(desc(connectorMetrics.totalRequests));
  }

  async getConnectorSummary(): Promise<{
    connector: string;
    successRate: number;
    avgLatencyMs: number;
    totalRequests: number;
    cacheHitRate: number;
  }[]> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const metrics = await db
      .select()
      .from(connectorMetrics)
      .where(gte(connectorMetrics.date, weekAgo));

    const byConnector = new Map<string, {
      totalRequests: number;
      successCount: number;
      cacheHits: number;
      cacheMisses: number;
      latencySum: number;
    }>();

    for (const m of metrics) {
      const existing = byConnector.get(m.connector) || {
        totalRequests: 0,
        successCount: 0,
        cacheHits: 0,
        cacheMisses: 0,
        latencySum: 0,
      };

      existing.totalRequests += m.totalRequests;
      existing.successCount += m.successCount;
      existing.cacheHits += m.cacheHits;
      existing.cacheMisses += m.cacheMisses;
      existing.latencySum += parseFloat(m.avgLatencyMs || "0") * m.totalRequests;

      byConnector.set(m.connector, existing);
    }

    return Array.from(byConnector.entries()).map(([connector, data]) => ({
      connector,
      successRate: data.totalRequests > 0 ? (data.successCount / data.totalRequests) * 100 : 100,
      avgLatencyMs: data.totalRequests > 0 ? data.latencySum / data.totalRequests : 0,
      totalRequests: data.totalRequests,
      cacheHitRate: (data.cacheHits + data.cacheMisses) > 0
        ? (data.cacheHits / (data.cacheHits + data.cacheMisses)) * 100
        : 0,
    }));
  }

  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushToDatabase().catch(() => {});
  }
}

export const connectorMetricsService = new ConnectorMetricsService();
