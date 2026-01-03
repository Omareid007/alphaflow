/**
 * API Client Test Script
 *
 * This script tests the API client configuration to ensure proper connectivity
 * Run with: npx tsx scripts/test-api-client.ts
 */

import fetch from "node-fetch";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message: string) {
  console.log("\n" + "=".repeat(80));
  log(message, colors.bright + colors.cyan);
  console.log("=".repeat(80));
}

function logSuccess(message: string) {
  log(`✓ ${message}`, colors.green);
}

function logError(message: string) {
  log(`✗ ${message}`, colors.red);
}

function logWarning(message: string) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message: string) {
  log(`ℹ ${message}`, colors.blue);
}

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

async function testEndpoint(
  baseUrl: string,
  endpoint: string,
  method: string = "GET"
): Promise<TestResult> {
  const startTime = Date.now();
  const url = `${baseUrl}${endpoint}`;

  try {
    logInfo(`Testing ${method} ${endpoint}...`);

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    });

    const duration = Date.now() - startTime;

    let responseData = null;
    try {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
    } catch (e) {
      // Ignore parse errors
    }

    if (response.ok) {
      logSuccess(
        `${endpoint} - Status: ${response.status}, Duration: ${duration}ms`
      );
      return {
        name: `${method} ${endpoint}`,
        success: true,
        duration,
        details: { status: response.status, statusText: response.statusText },
      };
    } else {
      logWarning(
        `${endpoint} - Status: ${response.status} ${response.statusText}`
      );
      return {
        name: `${method} ${endpoint}`,
        success: false,
        duration,
        error: `${response.status} ${response.statusText}`,
        details: responseData,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(
      `${endpoint} - ${error instanceof Error ? error.message : String(error)}`
    );

    return {
      name: `${method} ${endpoint}`,
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  logHeader("API CLIENT CONNECTIVITY TEST");

  // Configuration
  const EXPRESS_PORT = process.env.PORT || "5000";
  const NEXT_PORT = "3000";
  const EXPRESS_URL = `http://localhost:${EXPRESS_PORT}`;
  const NEXT_URL = `http://localhost:${NEXT_PORT}`;

  log("\nConfiguration:", colors.cyan);
  console.log(`  Express Server: ${EXPRESS_URL}`);
  console.log(`  Next.js Server: ${NEXT_URL}`);
  console.log(`  Environment: ${process.env.NODE_ENV || "development"}`);

  const results: TestResult[] = [];

  // Test Express Server Directly
  logHeader("Testing Express Server (Direct)");

  const expressTests = [
    { endpoint: "/api/health", description: "Health check" },
    { endpoint: "/api/alpaca/account", description: "Alpaca account" },
    { endpoint: "/api/positions", description: "Positions" },
    { endpoint: "/api/strategies", description: "Strategies" },
  ];

  for (const test of expressTests) {
    const result = await testEndpoint(EXPRESS_URL, test.endpoint);
    results.push(result);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Test Next.js Server (with rewrites)
  logHeader("Testing Next.js Server (with Rewrites)");

  logInfo("Note: Next.js server must be running for these tests to pass");
  logInfo("Start with: npm run dev:client\n");

  const nextTests = [
    { endpoint: "/api/health", description: "Health check via Next.js" },
    { endpoint: "/api/positions", description: "Positions via Next.js" },
  ];

  for (const test of nextTests) {
    const result = await testEndpoint(NEXT_URL, test.endpoint);
    results.push(result);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Summary
  logHeader("TEST SUMMARY");

  const passed = results.filter((r) => r.success).length;
  const failed = results.length - passed;
  const passRate = (passed / results.length) * 100;

  console.log(`\nTotal Tests: ${results.length}`);
  logSuccess(`Passed: ${passed}`);
  if (failed > 0) {
    logError(`Failed: ${failed}`);
  } else {
    console.log(`Failed: ${failed}`);
  }
  console.log(`Pass Rate: ${passRate.toFixed(1)}%\n`);

  // Failed tests details
  if (failed > 0) {
    logHeader("FAILED TESTS");
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        logError(`${r.name}`);
        console.log(`  Error: ${r.error}`);
        if (r.details) {
          console.log(`  Details: ${JSON.stringify(r.details, null, 2)}`);
        }
      });
  }

  // Recommendations
  logHeader("RECOMMENDATIONS");

  if (passRate === 100) {
    logSuccess("All tests passed! API connectivity is working correctly.");
  } else if (passRate >= 50) {
    logWarning("Some tests failed. Check the details above.");

    const directFailed = results.filter(
      (r) => r.name.includes("localhost:5000") && !r.success
    ).length;
    const nextFailed = results.filter(
      (r) => r.name.includes("localhost:3000") && !r.success
    ).length;

    if (directFailed > 0) {
      logWarning("\n→ Express server tests failed:");
      console.log("  1. Ensure Express server is running: npm run dev:server");
      console.log("  2. Check that port 5000 is not blocked");
      console.log("  3. Verify environment variables are set");
    }

    if (nextFailed > 0) {
      logWarning("\n→ Next.js server tests failed:");
      console.log("  1. Ensure Next.js server is running: npm run dev:client");
      console.log("  2. Check next.config.js rewrites configuration");
      console.log("  3. Verify Express server is running on port 5000");
    }
  } else {
    logError("Most tests failed. Check server configuration.");
    console.log("\nTroubleshooting steps:");
    console.log("  1. Start Express server: npm run dev:server");
    console.log("  2. Start Next.js server: npm run dev:client");
    console.log("  3. Check for port conflicts");
    console.log("  4. Review server logs for errors");
    console.log("  5. Verify environment variables");
  }

  // Next steps
  logHeader("NEXT STEPS");

  console.log("1. Review the test results above");
  console.log("2. Fix any failed tests");
  console.log("3. Re-run this script to verify fixes");
  console.log(
    "4. Use the API Debug Panel in your browser for interactive testing"
  );
  console.log("5. Check browser console for detailed API logs\n");

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
main().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
