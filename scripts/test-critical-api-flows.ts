/**
 * Critical API Flow Testing Script
 * Tests the most important user flows through the API
 */

import axios, { AxiosError } from 'axios';

const API_BASE = process.env.API_URL || 'http://localhost:5000';

interface TestResult {
  flow: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

async function testFlow(
  flowName: string,
  testFn: () => Promise<void>
): Promise<void> {
  try {
    await testFn();
    results.push({ flow: flowName, passed: true });
    console.log(`✅ ${flowName}`);
  } catch (error) {
    const err = error as AxiosError;
    results.push({
      flow: flowName,
      passed: false,
      error: err.message,
      details: err.response?.data ? JSON.stringify(err.response.data) : undefined,
    });
    console.log(`❌ ${flowName}: ${err.message}`);
  }
}

async function main() {
  console.log('🔍 Testing Critical API Flows...\n');

  let sessionCookie = '';

  // Flow 1: User Signup
  await testFlow('User Signup Flow', async () => {
    const response = await axios.post(`${API_BASE}/api/auth/signup`, {
      username: `testuser_${Date.now()}`,
      password: 'testpass123456',
    });

    if (response.status !== 201) {
      throw new Error(`Expected 201, got ${response.status}`);
    }

    // Extract session cookie
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      sessionCookie = cookies[0].split(';')[0];
    }
  });

  // Flow 2: User Login
  await testFlow('User Login Flow', async () => {
    const response = await axios.post(`${API_BASE}/api/auth/login`, {
      username: 'admintest',
      password: 'admin1234',
    });

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }

    const cookies = response.headers['set-cookie'];
    if (cookies) {
      sessionCookie = cookies[0].split(';')[0];
    }
  });

  // Flow 3: Get Current User
  await testFlow('Get Current User', async () => {
    const response = await axios.get(`${API_BASE}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }

    if (!response.data.username) {
      throw new Error('No username in response');
    }
  });

  // Flow 4: Protected Endpoint Without Auth (Should Fail)
  await testFlow('Protected Endpoint Without Auth (Should Return 401)', async () => {
    try {
      await axios.get(`${API_BASE}/api/positions`);
      throw new Error('Should have returned 401');
    } catch (error) {
      const err = error as AxiosError;
      if (err.response?.status === 401) {
        return; // Success - got 401 as expected
      }
      throw new Error(`Expected 401, got ${err.response?.status || 'unknown'}`);
    }
  });

  // Flow 5: Get Positions (Protected)
  await testFlow('Get Positions (Protected)', async () => {
    const response = await axios.get(`${API_BASE}/api/positions`, {
      headers: { Cookie: sessionCookie },
    });

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
  });

  // Flow 6: Get Agent Status
  await testFlow('Get Agent Status', async () => {
    const response = await axios.get(`${API_BASE}/api/agent/status`, {
      headers: { Cookie: sessionCookie },
    });

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
  });

  // Flow 7: Get Strategies (CRITICAL - Check if protected)
  await testFlow('Get Strategies - Check Auth', async () => {
    try {
      // Try without auth - should fail
      const unauthedResponse = await axios.get(`${API_BASE}/api/strategies`);

      // If we got here, endpoint is NOT protected (CRITICAL ISSUE)
      if (unauthedResponse.status === 200) {
        throw new Error('CRITICAL: /api/strategies is not protected! Got 200 without auth');
      }
    } catch (error) {
      const err = error as AxiosError;
      if (err.response?.status !== 401) {
        throw new Error(`Expected 401 without auth, got ${err.response?.status}`);
      }
    }

    // Try with auth - should succeed
    const response = await axios.get(`${API_BASE}/api/strategies`, {
      headers: { Cookie: sessionCookie },
    });

    if (response.status !== 200) {
      throw new Error(`Expected 200 with auth, got ${response.status}`);
    }
  });

  // Flow 8: Create Strategy
  await testFlow('Create Strategy', async () => {
    const strategy = {
      name: `Test Strategy ${Date.now()}`,
      type: 'momentum',
      active: false,
      config: {
        period: 14,
        threshold: 0.02,
      },
    };

    const response = await axios.post(`${API_BASE}/api/strategies`, strategy, {
      headers: {
        Cookie: sessionCookie,
        'Content-Type': 'application/json',
      },
    });

    if (![200, 201].includes(response.status)) {
      throw new Error(`Expected 200 or 201, got ${response.status}`);
    }
  });

  // Flow 9: Get Orders (CRITICAL - Check if protected)
  await testFlow('Get Orders - Check Auth', async () => {
    try {
      // Try without auth - should fail
      const unauthedResponse = await axios.get(`${API_BASE}/api/orders`);

      // If we got here, endpoint is NOT protected (CRITICAL ISSUE)
      if (unauthedResponse.status === 200) {
        throw new Error('CRITICAL: /api/orders is not protected! Got 200 without auth');
      }
    } catch (error) {
      const err = error as AxiosError;
      if (err.response?.status !== 401) {
        throw new Error(`Expected 401 without auth, got ${err.response?.status}`);
      }
    }

    // Try with auth - should succeed
    const response = await axios.get(`${API_BASE}/api/orders`, {
      headers: { Cookie: sessionCookie },
    });

    if (response.status !== 200) {
      throw new Error(`Expected 200 with auth, got ${response.status}`);
    }
  });

  // Flow 10: Get Alpaca Account (CRITICAL - Check if protected)
  await testFlow('Get Alpaca Account - Check Auth', async () => {
    try {
      // Try without auth - should fail
      const unauthedResponse = await axios.get(`${API_BASE}/api/alpaca/account`);

      // If we got here, endpoint is NOT protected (CRITICAL ISSUE)
      if (unauthedResponse.status === 200) {
        throw new Error('CRITICAL: /api/alpaca/account is not protected! Got 200 without auth');
      }
    } catch (error) {
      const err = error as AxiosError;
      if (err.response?.status !== 401) {
        throw new Error(`Expected 401 without auth, got ${err.response?.status}`);
      }
    }

    // Try with auth - should succeed
    const response = await axios.get(`${API_BASE}/api/alpaca/account`, {
      headers: { Cookie: sessionCookie },
    });

    if (response.status !== 200) {
      throw new Error(`Expected 200 with auth, got ${response.status}`);
    }
  });

  // Flow 11: Market Data (Should be public)
  await testFlow('Get Market Data (Public)', async () => {
    const response = await axios.get(`${API_BASE}/api/stock/quote/AAPL`);

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
  });

  // Flow 12: Health Check
  await testFlow('Database Health Check', async () => {
    const response = await axios.get(`${API_BASE}/api/health/db`, {
      headers: { Cookie: sessionCookie },
    });

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
  });

  // Flow 13: AI Analysis (Check validation)
  await testFlow('AI Analysis - Input Validation', async () => {
    try {
      // Try with invalid input
      await axios.post(`${API_BASE}/api/ai/analyze`, {});
      throw new Error('Should have failed validation');
    } catch (error) {
      const err = error as AxiosError;
      if (![400, 401].includes(err.response?.status || 0)) {
        throw new Error(`Expected 400 or 401, got ${err.response?.status}`);
      }
    }
  });

  // Flow 14: Risk Settings (CRITICAL - Should be protected)
  await testFlow('Risk Settings - Check Auth', async () => {
    try {
      // Try without auth - should fail
      const unauthedResponse = await axios.get(`${API_BASE}/api/risk/settings`);

      // If we got here, endpoint is NOT protected (CRITICAL ISSUE)
      if (unauthedResponse.status === 200) {
        throw new Error('CRITICAL: /api/risk/settings is not protected! Got 200 without auth');
      }
    } catch (error) {
      const err = error as AxiosError;
      if (err.response?.status !== 401) {
        throw new Error(`Expected 401 without auth, got ${err.response?.status}`);
      }
    }
  });

  // Flow 15: Autonomous Trading State
  await testFlow('Autonomous Trading State', async () => {
    const response = await axios.get(`${API_BASE}/api/autonomous/state`, {
      headers: { Cookie: sessionCookie },
    });

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
  });

  // Print Results
  console.log('\n' + '='.repeat(80));
  console.log('  TEST RESULTS SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    console.log('-'.repeat(80));
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`\n❌ ${r.flow}`);
        console.log(`   Error: ${r.error}`);
        if (r.details) {
          console.log(`   Details: ${r.details}`);
        }
      });
  }

  console.log('\n' + '='.repeat(80));

  // Identify critical security issues
  const criticalIssues = results.filter(
    (r) => !r.passed && r.error?.includes('CRITICAL')
  );

  if (criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL SECURITY ISSUES DETECTED:');
    console.log('-'.repeat(80));
    criticalIssues.forEach((issue) => {
      console.log(`\n⚠️  ${issue.flow}`);
      console.log(`   ${issue.error}`);
    });
    console.log('\n' + '='.repeat(80));
    process.exit(1);
  }

  if (failed > 0) {
    process.exit(1);
  }

  console.log('\n✅ All critical API flows working correctly!\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
