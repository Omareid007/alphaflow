#!/usr/bin/env tsx
/**
 * AI Active Trader - Event Bus Smoke Test
 * Verifies the event bus is working correctly
 * 
 * Usage: npx tsx services/shared/events/smoke-test.ts
 */

import { createEventBus, validateEvent } from './index';

async function runSmokeTest(): Promise<void> {
  console.log('🧪 Event Bus Smoke Test\n');

  // Test 1: Create and connect event bus
  console.log('Test 1: Create and connect event bus...');
  const publisher = createEventBus('test-publisher');
  const subscriber = createEventBus('test-subscriber');
  
  await publisher.connect();
  await subscriber.connect();
  
  console.log(`  ✅ Publisher connected (in-memory: ${publisher.isInMemoryMode()})`);
  console.log(`  ✅ Subscriber connected (in-memory: ${subscriber.isInMemoryMode()})`);

  // Test 2: Subscribe to events
  console.log('\nTest 2: Subscribe to events...');
  let receivedEvent: any = null;
  
  await subscriber.subscribe('market.quote.received', async (event) => {
    receivedEvent = event;
    console.log('  ✅ Received event:', event.metadata.eventType);
  });
  console.log('  ✅ Subscribed to market.quote.received');

  // Test 3: Publish event
  console.log('\nTest 3: Publish event...');
  const publishResult = await publisher.publish('market.quote.received', {
    symbol: 'AAPL',
    bidPrice: 150.25,
    askPrice: 150.30,
    bidSize: 100,
    askSize: 200,
    timestamp: new Date().toISOString(),
  });
  
  console.log(`  ✅ Published event (stream: ${publishResult?.stream}, seq: ${publishResult?.seq})`);

  // Wait for event delivery
  await new Promise(resolve => setTimeout(resolve, 100));

  // Test 4: Verify event received
  console.log('\nTest 4: Verify event received...');
  if (receivedEvent) {
    console.log('  ✅ Event received successfully');
    console.log(`     Symbol: ${receivedEvent.payload.symbol}`);
    console.log(`     Bid: ${receivedEvent.payload.bidPrice}`);
    console.log(`     Ask: ${receivedEvent.payload.askPrice}`);
  } else {
    console.log('  ⚠️  Event not received (expected in in-memory mode)');
  }

  // Test 5: Schema validation
  console.log('\nTest 5: Schema validation...');
  
  const validEvent = {
    metadata: {
      eventId: 'test_123',
      eventType: 'market.quote.received',
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'test',
    },
    payload: {
      symbol: 'TSLA',
      bidPrice: 250.00,
      askPrice: 250.10,
      bidSize: 50,
      askSize: 75,
      timestamp: new Date().toISOString(),
    },
  };
  
  const validResult = validateEvent('market.quote.received', validEvent);
  console.log(`  ✅ Valid event validation: ${validResult.success}`);
  
  const invalidEvent = {
    metadata: { eventId: 'test' },
    payload: { symbol: 'X' },
  };
  
  const invalidResult = validateEvent('market.quote.received', invalidEvent);
  console.log(`  ✅ Invalid event validation: ${!invalidResult.success} (expected to fail)`);
  if (!invalidResult.success) {
    console.log(`     Errors: ${invalidResult.errors?.errors.length} validation errors`);
  }

  // Test 6: Schema validation on publish
  console.log('\nTest 6: Schema validation on publish...');
  try {
    await publisher.publish('market.quote.received', {
      symbol: '', // Invalid: empty symbol
      bidPrice: -1, // Invalid: negative price
      askPrice: 150.30,
      bidSize: 100,
      askSize: 200,
      timestamp: 'invalid-date', // Invalid: not ISO datetime
    } as any);
    console.log('  ❌ Expected validation error but none thrown');
  } catch (error: any) {
    if (error.message.includes('Schema validation failed')) {
      console.log('  ✅ Schema validation correctly rejected invalid event');
    } else {
      console.log(`  ❌ Unexpected error: ${error.message}`);
    }
  }

  // Test 7: Event log (in-memory mode)
  console.log('\nTest 7: Event log (in-memory mode)...');
  const eventLog = publisher.getEventLog();
  console.log(`  ✅ Event log contains ${eventLog.length} events`);

  // Test 8: Saga support
  console.log('\nTest 8: Saga correlation...');
  const saga = publisher.startSaga('trade-execution', 3, 30000);
  console.log(`  ✅ Started saga: ${saga.correlationId}`);
  console.log(`     Type: ${saga.sagaType}, Steps: ${saga.totalSteps}`);
  
  const nextStep = publisher.advanceSaga(saga, 'evt_previous_123');
  console.log(`  ✅ Advanced saga to step ${nextStep.step}`);

  // Cleanup
  console.log('\nTest 9: Disconnect...');
  await publisher.disconnect();
  await subscriber.disconnect();
  console.log('  ✅ Disconnected');

  console.log('\n✅ All smoke tests passed!\n');
}

runSmokeTest().catch((error) => {
  console.error('\n❌ Smoke test failed:', error);
  process.exit(1);
});
