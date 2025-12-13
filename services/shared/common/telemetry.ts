/**
 * AI Active Trader - OpenTelemetry Instrumentation
 * Provides distributed tracing and metrics for all services
 * 
 * Features:
 * - Full OpenTelemetry SDK initialization with OTLP exporter
 * - Auto-instrumentation for HTTP, Express, and other common libraries
 * - Express middleware for request tracing
 * - Span helpers for manual instrumentation
 * - Trace context propagation
 */

import { trace, SpanKind, SpanStatusCode, Tracer, Span, context, propagation, Context } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { 
  SEMRESATTRS_SERVICE_NAME, 
  SEMRESATTRS_SERVICE_VERSION, 
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT 
} from '@opentelemetry/semantic-conventions';
import type { Request, Response, NextFunction } from 'express';

let sdk: NodeSDK | null = null;
let isInitialized = false;
let serviceName = 'unknown';

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  enabled?: boolean;
  endpoint?: string;
  /** Console exporter for development debugging */
  consoleExporter?: boolean;
}

/**
 * Initialize OpenTelemetry SDK with full tracing capabilities
 * Should be called at the very start of service bootstrap
 */
export function initTelemetry(config: TelemetryConfig): void {
  if (isInitialized) {
    console.warn('[Telemetry] Already initialized');
    return;
  }

  serviceName = config.serviceName;
  const enabled = config.enabled ?? process.env.OTEL_ENABLED === 'true';
  
  if (!enabled) {
    console.log(`[Telemetry] Disabled for ${config.serviceName}, skipping SDK initialization`);
    isInitialized = true;
    return;
  }

  const endpoint = config.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
  const environment = config.environment || process.env.NODE_ENV || 'development';
  const version = config.serviceVersion || '1.0.0';

  console.log(`[Telemetry] Initializing OpenTelemetry SDK for ${config.serviceName}`);
  console.log(`[Telemetry] Endpoint: ${endpoint}, Environment: ${environment}`);

  try {
    // Create OTLP exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
      headers: {},
    });

    // Create resource with service metadata
    const resource = resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: version,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
      'service.instance.id': `${config.serviceName}-${process.pid}`,
    });

    // Initialize the SDK with auto-instrumentation
    sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable fs instrumentation to reduce noise
          '@opentelemetry/instrumentation-fs': { enabled: false },
          // Configure HTTP instrumentation
          '@opentelemetry/instrumentation-http': {
            ignoreIncomingRequestHook: (request) => {
              const url = request.url || '';
              return ['/health', '/ready', '/live', '/metrics'].some(p => url.includes(p));
            },
            requestHook: (span, request) => {
              span.setAttribute('http.request.id', 
                (request as any).headers?.['x-request-id'] || 'none');
            },
          },
          // Configure Express instrumentation
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
        }),
      ],
    });

    // Start the SDK
    sdk.start();

    console.log(`[Telemetry] OpenTelemetry SDK started for ${config.serviceName}`);
    isInitialized = true;

  } catch (error) {
    console.error('[Telemetry] Failed to initialize SDK:', error);
    // Don't throw - allow service to continue without telemetry
    isInitialized = true;
  }
}

/**
 * Get a tracer for creating spans
 */
export function getTracer(name?: string): Tracer {
  return trace.getTracer(name || serviceName);
}

/**
 * Execute a function within a traced span
 * Automatically handles errors and span lifecycle
 */
export async function withSpan<T>(
  tracer: Tracer,
  spanName: string,
  fn: (span: Span) => Promise<T>,
  options?: { 
    kind?: SpanKind; 
    attributes?: Record<string, string | number | boolean>;
    parentContext?: Context;
  }
): Promise<T> {
  const parentCtx = options?.parentContext || context.active();
  
  return tracer.startActiveSpan(
    spanName, 
    { kind: options?.kind || SpanKind.INTERNAL },
    parentCtx,
    async (span) => {
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
    }
  );
}

/**
 * Execute a synchronous function within a traced span
 */
export function withSpanSync<T>(
  tracer: Tracer,
  spanName: string,
  fn: (span: Span) => T,
  options?: { 
    kind?: SpanKind; 
    attributes?: Record<string, string | number | boolean>;
  }
): T {
  const span = tracer.startSpan(spanName, { kind: options?.kind || SpanKind.INTERNAL });
  
  if (options?.attributes) {
    for (const [key, value] of Object.entries(options.attributes)) {
      span.setAttribute(key, value);
    }
  }

  try {
    const result = fn(span);
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
}

/**
 * Add attributes to the current active span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = trace.getActiveSpan();
  if (span) {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }
  }
}

/**
 * Add an event to the current active span
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Record an error on the current active span
 */
export function recordSpanError(error: Error, setStatus: boolean = true): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    if (setStatus) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    }
  }
}

/**
 * Get the current trace ID
 */
export function getActiveTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  return span?.spanContext().traceId;
}

/**
 * Get the current span ID
 */
export function getActiveSpanId(): string | undefined {
  const span = trace.getActiveSpan();
  return span?.spanContext().spanId;
}

/**
 * Get trace context headers for propagation to downstream services
 */
export function getTraceContextHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  propagation.inject(context.active(), headers);
  return headers;
}

/**
 * Extract trace context from incoming headers
 */
export function extractTraceContext(headers: Record<string, string | string[] | undefined>): Context {
  // Normalize headers to string values
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      normalizedHeaders[key] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      normalizedHeaders[key] = value[0];
    }
  }
  return propagation.extract(context.active(), normalizedHeaders);
}

/**
 * Express middleware for automatic request tracing
 * Adds trace context and creates spans for incoming requests
 */
export function tracingMiddleware(options?: { serviceName?: string }) {
  const svcName = options?.serviceName || serviceName;
  const tracer = getTracer(svcName);

  return (req: Request, res: Response, next: NextFunction): void => {
    // Extract trace context from incoming headers
    const parentContext = extractTraceContext(req.headers as Record<string, string>);
    
    const spanName = `${req.method} ${req.route?.path || req.path}`;
    
    const span = tracer.startSpan(spanName, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.originalUrl,
        'http.target': req.path,
        'http.host': req.hostname,
        'http.user_agent': req.get('user-agent') || '',
        'http.request.id': (req as any).requestId || '',
      },
    }, parentContext);

    // Store span in request for later access
    (req as any).span = span;

    // Create context with span active for downstream handlers
    const spanContext = trace.setSpan(parentContext, span);

    // Inject trace context into response headers
    const responseHeaders: Record<string, string> = {};
    propagation.inject(spanContext, responseHeaders);
    for (const [key, value] of Object.entries(responseHeaders)) {
      res.setHeader(key, value);
    }

    // Handle response completion
    res.on('finish', () => {
      span.setAttribute('http.status_code', res.statusCode);
      
      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      
      span.end();
    });

    // Handle errors
    res.on('error', (error) => {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();
    });

    // Call next() within the span context so downstream handlers inherit the span
    context.with(spanContext, () => {
      next();
    });
  };
}

/**
 * Shutdown telemetry SDK gracefully
 * Should be called during service shutdown
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    console.log('[Telemetry] Shutting down SDK...');
    try {
      await sdk.shutdown();
      console.log('[Telemetry] SDK shutdown complete');
    } catch (error) {
      console.error('[Telemetry] SDK shutdown error:', error);
    }
    sdk = null;
  }
  isInitialized = false;
}

/**
 * Check if telemetry is initialized
 */
export function isTelemetryInitialized(): boolean {
  return isInitialized;
}

/**
 * Decorator for tracing class methods
 * Usage: @traced('operationName')
 */
export function traced(spanName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const tracer = getTracer();
    const name = spanName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return withSpan(tracer, name, async (span) => {
        span.setAttribute('method.name', propertyKey);
        span.setAttribute('method.class', target.constructor.name);
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

// Re-export OpenTelemetry API types for convenience
export { SpanKind, SpanStatusCode, type Span, type Tracer, type Context };
