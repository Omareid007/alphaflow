interface LatencyMetric {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  samples: number[];
}

interface PerformanceMetrics {
  orderExecution: LatencyMetric;
  quoteRetrieval: LatencyMetric;
  aiDecision: LatencyMetric;
  databaseQuery: LatencyMetric;
  apiCall: LatencyMetric;
}

const MAX_SAMPLES = 1000;

function createEmptyMetric(): LatencyMetric {
  return {
    count: 0,
    totalMs: 0,
    minMs: Infinity,
    maxMs: 0,
    p50Ms: 0,
    p95Ms: 0,
    p99Ms: 0,
    samples: [],
  };
}

function calculatePercentile(samples: number[], percentile: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function updateMetric(metric: LatencyMetric, durationMs: number): void {
  metric.count++;
  metric.totalMs += durationMs;
  metric.minMs = Math.min(metric.minMs, durationMs);
  metric.maxMs = Math.max(metric.maxMs, durationMs);
  
  metric.samples.push(durationMs);
  if (metric.samples.length > MAX_SAMPLES) {
    metric.samples.shift();
  }
  
  metric.p50Ms = calculatePercentile(metric.samples, 50);
  metric.p95Ms = calculatePercentile(metric.samples, 95);
  metric.p99Ms = calculatePercentile(metric.samples, 99);
}

class PerformanceTracker {
  private metrics: PerformanceMetrics = {
    orderExecution: createEmptyMetric(),
    quoteRetrieval: createEmptyMetric(),
    aiDecision: createEmptyMetric(),
    databaseQuery: createEmptyMetric(),
    apiCall: createEmptyMetric(),
  };
  
  private startTimes: Map<string, number> = new Map();

  startTimer(operationId: string): void {
    this.startTimes.set(operationId, Date.now());
  }

  endTimer(operationId: string, metricType: keyof PerformanceMetrics): number {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) return 0;
    
    const durationMs = Date.now() - startTime;
    this.startTimes.delete(operationId);
    
    updateMetric(this.metrics[metricType], durationMs);
    return durationMs;
  }

  recordLatency(metricType: keyof PerformanceMetrics, durationMs: number): void {
    updateMetric(this.metrics[metricType], durationMs);
  }

  async measure<T>(
    metricType: keyof PerformanceMetrics,
    operation: () => Promise<T>
  ): Promise<{ result: T; durationMs: number }> {
    const start = Date.now();
    const result = await operation();
    const durationMs = Date.now() - start;
    updateMetric(this.metrics[metricType], durationMs);
    return { result, durationMs };
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getMetricSummary(metricType: keyof PerformanceMetrics): {
    avgMs: number;
    minMs: number;
    maxMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    count: number;
  } {
    const metric = this.metrics[metricType];
    return {
      avgMs: metric.count > 0 ? metric.totalMs / metric.count : 0,
      minMs: metric.minMs === Infinity ? 0 : metric.minMs,
      maxMs: metric.maxMs,
      p50Ms: metric.p50Ms,
      p95Ms: metric.p95Ms,
      p99Ms: metric.p99Ms,
      count: metric.count,
    };
  }

  getSLOStatus(): {
    orderExecutionP99Under50ms: boolean;
    quoteRetrievalP99Under10ms: boolean;
    aiDecisionP99Under5s: boolean;
  } {
    return {
      orderExecutionP99Under50ms: this.metrics.orderExecution.p99Ms < 50,
      quoteRetrievalP99Under10ms: this.metrics.quoteRetrieval.p99Ms < 10,
      aiDecisionP99Under5s: this.metrics.aiDecision.p99Ms < 5000,
    };
  }

  reset(): void {
    this.metrics = {
      orderExecution: createEmptyMetric(),
      quoteRetrieval: createEmptyMetric(),
      aiDecision: createEmptyMetric(),
      databaseQuery: createEmptyMetric(),
      apiCall: createEmptyMetric(),
    };
    this.startTimes.clear();
  }
}

export const performanceTracker = new PerformanceTracker();
export type { PerformanceMetrics, LatencyMetric };
