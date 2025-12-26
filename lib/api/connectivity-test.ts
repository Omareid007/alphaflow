/**
 * API Connectivity Test Utility
 *
 * This utility helps diagnose API connection issues by testing various endpoints
 * and providing detailed logging.
 */

export interface ConnectivityTestResult {
  success: boolean;
  endpoint: string;
  method: string;
  status?: number;
  statusText?: string;
  duration: number;
  error?: string;
  responseData?: any;
}

export interface ConnectivityReport {
  timestamp: string;
  baseUrl: string;
  environment: string;
  tests: ConnectivityTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
}

/**
 * Test a single endpoint
 */
async function testEndpoint(
  baseUrl: string,
  endpoint: string,
  method: string = 'GET'
): Promise<ConnectivityTestResult> {
  const startTime = performance.now();
  const url = new URL(endpoint, baseUrl);

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const duration = performance.now() - startTime;

    let responseData = null;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
    } catch (e) {
      // Ignore parse errors
    }

    return {
      success: response.ok,
      endpoint,
      method,
      status: response.status,
      statusText: response.statusText,
      duration,
      responseData,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      success: false,
      endpoint,
      method,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run a comprehensive connectivity test
 */
export async function runConnectivityTest(
  baseUrl?: string
): Promise<ConnectivityReport> {
  const timestamp = new Date().toISOString();

  // Determine base URL
  const apiBaseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  // Determine environment
  const environment = process.env.NODE_ENV || 'unknown';

  console.log('='.repeat(80));
  console.log('API CONNECTIVITY TEST');
  console.log('='.repeat(80));
  console.log('Timestamp:', timestamp);
  console.log('Base URL:', apiBaseUrl);
  console.log('Environment:', environment);
  console.log('User Agent:', typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A');
  console.log('='.repeat(80));

  // Define test endpoints
  const testEndpoints = [
    { endpoint: '/api/health', method: 'GET', description: 'Health check' },
    { endpoint: '/api/alpaca/account', method: 'GET', description: 'Alpaca account info' },
    { endpoint: '/api/positions', method: 'GET', description: 'Positions list' },
    { endpoint: '/api/strategies', method: 'GET', description: 'Strategies list' },
    { endpoint: '/api/watchlists', method: 'GET', description: 'Watchlists' },
  ];

  const tests: ConnectivityTestResult[] = [];

  // Run each test
  for (const test of testEndpoints) {
    console.log(`\nTesting ${test.method} ${test.endpoint} - ${test.description}...`);

    const result = await testEndpoint(apiBaseUrl, test.endpoint, test.method);
    tests.push(result);

    if (result.success) {
      console.log(`✓ SUCCESS - Status: ${result.status}, Duration: ${result.duration.toFixed(2)}ms`);
    } else {
      console.log(`✗ FAILED - ${result.error || `Status: ${result.status}`}, Duration: ${result.duration.toFixed(2)}ms`);
    }

    if (result.status) {
      console.log(`  Response status: ${result.status} ${result.statusText}`);
    }

    if (result.responseData) {
      console.log('  Response preview:', JSON.stringify(result.responseData).substring(0, 200));
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Calculate summary
  const passed = tests.filter(t => t.success).length;
  const failed = tests.length - passed;
  const passRate = (passed / tests.length) * 100;

  const summary = {
    total: tests.length,
    passed,
    failed,
    passRate,
  };

  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Pass Rate: ${summary.passRate.toFixed(1)}%`);
  console.log('='.repeat(80));

  const report: ConnectivityReport = {
    timestamp,
    baseUrl: apiBaseUrl,
    environment,
    tests,
    summary,
  };

  return report;
}

/**
 * Quick connectivity check - just tests basic endpoint
 */
export async function quickConnectivityCheck(baseUrl?: string): Promise<boolean> {
  const apiBaseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  console.log('[Connectivity Check] Testing connection to:', apiBaseUrl);

  try {
    const result = await testEndpoint(apiBaseUrl, '/api/health', 'GET');

    if (result.success) {
      console.log('[Connectivity Check] ✓ Connection successful');
      return true;
    } else {
      console.error('[Connectivity Check] ✗ Connection failed:', result.error || result.status);
      return false;
    }
  } catch (error) {
    console.error('[Connectivity Check] ✗ Exception:', error);
    return false;
  }
}

/**
 * Log current API configuration
 */
export function logApiConfiguration() {
  console.log('='.repeat(80));
  console.log('API CONFIGURATION');
  console.log('='.repeat(80));
  console.log('Environment Variables:');
  console.log('  NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL || '(not set)');
  console.log('  NODE_ENV:', process.env.NODE_ENV || '(not set)');

  if (typeof window !== 'undefined') {
    console.log('Browser Context:');
    console.log('  window.location.origin:', window.location.origin);
    console.log('  window.location.href:', window.location.href);
    console.log('  navigator.onLine:', navigator.onLine);
  }

  console.log('='.repeat(80));
}
