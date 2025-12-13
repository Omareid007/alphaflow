/**
 * AI Active Trader - Telemetry Smoke Test
 * Tests OpenTelemetry initialization and basic tracing functionality
 */

import {
  initTelemetry,
  getTracer,
  withSpan,
  withSpanSync,
  addSpanAttributes,
  addSpanEvent,
  getActiveTraceId,
  getActiveSpanId,
  getTraceContextHeaders,
  shutdownTelemetry,
  isTelemetryInitialized,
  SpanKind,
} from './telemetry';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ ${message}`);
    testsFailed++;
  }
}

async function runTests(): Promise<void> {
  console.log('\n📊 Telemetry Smoke Tests\n');
  console.log('='.repeat(50));

  // Test 1: Initial state
  console.log('\n1. Testing initial state...');
  assert(!isTelemetryInitialized(), 'Telemetry should not be initialized initially');

  // Test 2: Initialize with telemetry disabled
  console.log('\n2. Testing initialization with disabled telemetry...');
  initTelemetry({
    serviceName: 'test-service',
    enabled: false,
  });
  assert(isTelemetryInitialized(), 'Telemetry should be marked as initialized');
  await shutdownTelemetry();

  // Test 3: Get tracer
  console.log('\n3. Testing tracer creation...');
  const tracer = getTracer('smoke-test');
  assert(tracer !== null, 'Should get a tracer instance');
  assert(typeof tracer.startSpan === 'function', 'Tracer should have startSpan method');

  // Test 4: Manual span creation
  console.log('\n4. Testing manual span creation...');
  const span = tracer.startSpan('test-span');
  assert(span !== null, 'Should create a span');
  assert(typeof span.end === 'function', 'Span should have end method');
  span.end();

  // Test 5: withSpan helper
  console.log('\n5. Testing withSpan helper...');
  let spanExecuted = false;
  await withSpan(tracer, 'async-test-span', async (span) => {
    spanExecuted = true;
    span.setAttribute('test.attribute', 'test-value');
    await new Promise(resolve => setTimeout(resolve, 10));
    return 'result';
  });
  assert(spanExecuted, 'Span function should be executed');

  // Test 6: withSpanSync helper
  console.log('\n6. Testing withSpanSync helper...');
  let syncSpanExecuted = false;
  const syncResult = withSpanSync(tracer, 'sync-test-span', (span) => {
    syncSpanExecuted = true;
    span.setAttribute('sync.test', true);
    return 42;
  });
  assert(syncSpanExecuted, 'Sync span function should be executed');
  assert(syncResult === 42, 'Should return correct result');

  // Test 7: withSpan with attributes
  console.log('\n7. Testing withSpan with attributes...');
  await withSpan(
    tracer,
    'attributed-span',
    async () => {
      addSpanAttributes({ 'custom.attr': 'value' });
      addSpanEvent('test-event', { detail: 'event-data' });
      return true;
    },
    {
      kind: SpanKind.INTERNAL,
      attributes: { 'initial.attr': 'initial-value' },
    }
  );
  assert(true, 'withSpan with attributes should complete');

  // Test 8: Error handling in withSpan
  console.log('\n8. Testing error handling in withSpan...');
  let errorCaught = false;
  try {
    await withSpan(tracer, 'error-span', async () => {
      throw new Error('Test error');
    });
  } catch (e) {
    errorCaught = true;
    assert(e instanceof Error && e.message === 'Test error', 'Error should propagate');
  }
  assert(errorCaught, 'Error should be caught');

  // Test 9: Trace context headers
  console.log('\n9. Testing trace context headers...');
  const headers = getTraceContextHeaders();
  assert(typeof headers === 'object', 'Should return headers object');

  // Test 10: Active trace/span ID (outside of active span should be undefined)
  console.log('\n10. Testing active trace/span ID access...');
  const traceId = getActiveTraceId();
  const spanId = getActiveSpanId();
  // Outside of active span context, these may be undefined
  assert(traceId === undefined || typeof traceId === 'string', 'TraceId should be string or undefined');
  assert(spanId === undefined || typeof spanId === 'string', 'SpanId should be string or undefined');

  // Test 11: Nested spans
  console.log('\n11. Testing nested spans...');
  let nestedExecuted = false;
  await withSpan(tracer, 'parent-span', async () => {
    await withSpan(tracer, 'child-span', async () => {
      nestedExecuted = true;
      return true;
    });
    return true;
  });
  assert(nestedExecuted, 'Nested spans should work');

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Results: ${testsPassed} passed, ${testsFailed} failed\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Smoke test failed:', error);
  process.exit(1);
});
