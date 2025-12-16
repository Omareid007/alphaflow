/**
 * OpenTelemetry SDK Initialization
 * 
 * This module initializes the OpenTelemetry SDK for distributed tracing.
 * MUST be imported FIRST before any other application code.
 * 
 * Configuration via environment variables:
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP collector endpoint (default: console exporter)
 * - OTEL_SERVICE_NAME: Service name (default: ai-active-trader)
 * - NODE_ENV: Determines environment attribute
 * 
 * @see docs/OBSERVABILITY.md
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from "@opentelemetry/semantic-conventions";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { trace, context, SpanStatusCode, Span, SpanKind, Attributes } from "@opentelemetry/api";
import type { Tracer } from "@opentelemetry/api";

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "ai-active-trader";
const SERVICE_VERSION = process.env.npm_package_version || "1.0.0";
const DEPLOYMENT_ENV = process.env.NODE_ENV || "development";
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

let sdk: NodeSDK | null = null;
let isInitialized = false;

export function initializeOpenTelemetry(): void {
  if (isInitialized) {
    return;
  }

  const resource = resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: SERVICE_NAME,
    [SEMRESATTRS_SERVICE_VERSION]: SERVICE_VERSION,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: DEPLOYMENT_ENV,
  });

  let traceExporter;
  
  if (OTLP_ENDPOINT) {
    console.log(`[OTel] Initializing with OTLP exporter: ${OTLP_ENDPOINT}`);
    traceExporter = new OTLPTraceExporter({
      url: `${OTLP_ENDPOINT}/v1/traces`,
    });
  } else {
    console.log("[OTel] No OTLP endpoint configured, using console exporter (dev mode)");
    traceExporter = new ConsoleSpanExporter();
  }

  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-http": { enabled: true },
        "@opentelemetry/instrumentation-express": { enabled: true },
        "@opentelemetry/instrumentation-pg": { enabled: true },
      }),
    ],
  });

  sdk.start();
  isInitialized = true;

  process.on("SIGTERM", () => {
    sdk?.shutdown()
      .then(() => console.log("[OTel] SDK shut down successfully"))
      .catch((error) => console.error("[OTel] Error shutting down SDK", error))
      .finally(() => process.exit(0));
  });

  console.log(`[OTel] SDK initialized: ${SERVICE_NAME}@${SERVICE_VERSION} (${DEPLOYMENT_ENV})`);
}

export function getTracer(name: string = "ai-active-trader"): Tracer {
  return trace.getTracer(name, SERVICE_VERSION);
}

export interface SpanOptions {
  traceId?: string;
  attributes?: Attributes;
  kind?: SpanKind;
}

export async function withSpan<T>(
  spanName: string,
  fn: (span: Span) => Promise<T>,
  options: SpanOptions = {}
): Promise<T> {
  const tracer = getTracer();
  
  return tracer.startActiveSpan(spanName, { kind: options.kind || SpanKind.INTERNAL }, async (span) => {
    try {
      if (options.traceId) {
        span.setAttribute("aiat.trace_id", options.traceId);
      }
      
      if (options.attributes) {
        span.setAttributes(options.attributes);
      }
      
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: error instanceof Error ? error.message : String(error) 
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

export function recordSpanEvent(span: Span, eventName: string, attributes?: Attributes): void {
  span.addEvent(eventName, attributes);
}

export function setSpanError(span: Span, error: Error | string): void {
  const errorMessage = error instanceof Error ? error.message : error;
  span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
  span.recordException(error instanceof Error ? error : new Error(errorMessage));
}

export { trace, context, SpanStatusCode, SpanKind };
export type { Span, Tracer, Attributes };
