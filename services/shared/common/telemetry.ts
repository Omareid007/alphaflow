/**
 * AI Active Trader - OpenTelemetry Instrumentation
 * Provides distributed tracing and metrics for all services
 */

import { trace, SpanKind, SpanStatusCode, Tracer, Span } from '@opentelemetry/api';

let isInitialized = false;

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  enabled?: boolean;
  endpoint?: string;
}

/**
 * Initialize OpenTelemetry SDK
 * Note: Full initialization requires the SDK to be set up before any imports
 * This function provides a lightweight wrapper for tracing
 */
export function initTelemetry(config: TelemetryConfig): void {
  if (isInitialized) {
    console.warn('[Telemetry] Already initialized');
    return;
  }

  const enabled = config.enabled ?? process.env.OTEL_ENABLED === 'true';
  
  if (!enabled) {
    console.log('[Telemetry] Disabled, skipping initialization');
    isInitialized = true;
    return;
  }

  const endpoint = config.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
  
  console.log(`[Telemetry] Initialized for ${config.serviceName}, endpoint: ${endpoint}`);
  console.log('[Telemetry] Note: Full OTEL SDK should be initialized in service bootstrap');
  isInitialized = true;
}

export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}

export async function withSpan<T>(
  tracer: Tracer,
  spanName: string,
  fn: (span: Span) => Promise<T>,
  options?: { kind?: SpanKind; attributes?: Record<string, string | number | boolean> }
): Promise<T> {
  return tracer.startActiveSpan(spanName, { kind: options?.kind || SpanKind.INTERNAL }, async (span) => {
    if (options?.attributes) {
      for (const [key, value] of Object.entries(options.attributes)) {
        span.setAttribute(key, value);
      }
    }

    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = trace.getActiveSpan();
  if (span) {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }
  }
}

export function recordSpanError(error: Error): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  }
}

export function getActiveTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  return span?.spanContext().traceId;
}

export function getActiveSpanId(): string | undefined {
  const span = trace.getActiveSpan();
  return span?.spanContext().spanId;
}

export async function shutdownTelemetry(): Promise<void> {
  isInitialized = false;
  console.log('[Telemetry] Shutdown');
}
