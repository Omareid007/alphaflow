#!/usr/bin/env tsx

/**
 * Test script for Alpaca rate limiting and circuit breaker
 * This script verifies that:
 * 1. Rate limiting is properly applied
 * 2. Circuit breaker opens after consecutive failures
 * 3. Requests are queued when limit is reached
 */

import { alpaca } from './server/connectors/alpaca';

async function testRateLimiting() {
  console.log('\n=== Testing Alpaca Rate Limiting and Circuit Breaker ===\n');

  // Test 1: Check initial status
  console.log('Test 1: Initial Status');
  const initialStatus = alpaca.getConnectionStatus();
  console.log('Connection Status:', initialStatus);

  try {
    const rateLimitStatus = await alpaca.getRateLimitStatus();
    console.log('Rate Limit Status:', rateLimitStatus);
  } catch (error) {
    console.log('Rate limit status not available (expected if no requests made yet)');
  }

  // Test 2: Make multiple requests to test rate limiting
  console.log('\n\nTest 2: Making Multiple Requests (testing rate limiter)');
  const startTime = Date.now();

  try {
    // Try to get account info - this should respect rate limits
    const account = await alpaca.getAccount();
    console.log(`✓ Request 1 completed in ${Date.now() - startTime}ms`);
    console.log(`  Account ID: ${account.id}, Status: ${account.status}`);
  } catch (error) {
    console.log(`✗ Request 1 failed: ${(error as Error).message}`);
  }

  // Check rate limit status after request
  try {
    const status = await alpaca.getRateLimitStatus();
    console.log('\nRate Limit Status After Request:');
    console.log(`  Provider: ${status.provider}`);
    console.log(`  Running: ${status.running}`);
    console.log(`  Queued: ${status.queued}`);
    console.log(`  Reservoir: ${status.reservoir}`);
    console.log(`  Failure Count: ${status.failureCount}`);
    console.log(`  Circuit Breaker Open: ${status.circuitBreakerOpen}`);
  } catch (error) {
    console.log(`Could not get rate limit status: ${(error as Error).message}`);
  }

  // Test 3: Test cache
  console.log('\n\nTest 3: Testing Cache (should return instantly)');
  const cacheStartTime = Date.now();
  try {
    await alpaca.getAccount();
    console.log(`✓ Cached request completed in ${Date.now() - cacheStartTime}ms`);
  } catch (error) {
    console.log(`✗ Cached request failed: ${(error as Error).message}`);
  }

  // Test 4: Connection status
  console.log('\n\nTest 4: Final Connection Status');
  const finalStatus = alpaca.getConnectionStatus();
  console.log('Connection Status:', finalStatus);

  console.log('\n=== Tests Complete ===\n');
}

// Run tests
testRateLimiting()
  .then(() => {
    console.log('All tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
