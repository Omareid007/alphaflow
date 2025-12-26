/**
 * Test script to verify authentication bypass in development mode
 * Run with: npx tsx scripts/test-auth-endpoints.ts
 */

async function testEndpoint(url: string, description: string) {
  console.log(`\n[TEST] ${description}`);
  console.log(`[URL] ${url}`);

  try {
    const response = await fetch(url);
    console.log(`[STATUS] ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`[SUCCESS] Data received:`, JSON.stringify(data).substring(0, 200) + '...');
      return true;
    } else {
      const errorText = await response.text();
      console.log(`[FAILED] ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`[ERROR] ${error}`);
    return false;
  }
}

async function main() {
  const baseUrl = process.env.API_URL || 'http://localhost:3000';

  console.log('='.repeat(80));
  console.log('AUTHENTICATION ENDPOINT TESTS');
  console.log('='.repeat(80));
  console.log(`Base URL: ${baseUrl}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set (development)'}`);

  const tests = [
    {
      url: `${baseUrl}/api/strategies`,
      description: 'GET /api/strategies - List all strategies'
    },
    {
      url: `${baseUrl}/api/positions/snapshot`,
      description: 'GET /api/positions/snapshot - Portfolio snapshot'
    },
    {
      url: `${baseUrl}/api/ai/events?limit=5`,
      description: 'GET /api/ai/events - AI decision events'
    },
    {
      url: `${baseUrl}/api/ai/status`,
      description: 'GET /api/ai/status - AI engine status'
    },
    {
      url: `${baseUrl}/api/admin/modules`,
      description: 'GET /api/admin/modules - Admin modules (requires auth)'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const success = await testEndpoint(test.url, test.description);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST RESULTS');
  console.log('='.repeat(80));
  console.log(`Passed: ${passed}/${tests.length}`);
  console.log(`Failed: ${failed}/${tests.length}`);

  if (failed > 0) {
    console.log('\n[WARNING] Some tests failed. This might be expected if:');
    console.log('  - The server is not running');
    console.log('  - NODE_ENV is set to "production"');
    console.log('  - The database is empty (no strategies, positions, etc.)');
    process.exit(1);
  } else {
    console.log('\n[SUCCESS] All authentication tests passed!');
  }
}

main().catch(console.error);
