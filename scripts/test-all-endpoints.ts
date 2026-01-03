/**
 * Comprehensive API Endpoint Testing Script
 * Tests all critical backend endpoints and generates a detailed report
 */

import fs from "fs";
import path from "path";

const API_BASE = "http://localhost:3000";
const REPORT_FILE = "/home/runner/workspace/API_TEST_RESULTS.md";

interface TestResult {
  endpoint: string;
  method: string;
  description: string;
  expectedStatus: number;
  actualStatus: number | string;
  passed: boolean;
  responseBody: string;
  error?: string;
}

const results: TestResult[] = [];

async function testEndpoint(
  method: string,
  endpoint: string,
  description: string,
  expectedStatus: number,
  authHeader?: string
): Promise<TestResult> {
  console.log(`\x1b[33mTesting: ${method} ${endpoint}\x1b[0m`);

  const result: TestResult = {
    endpoint,
    method,
    description,
    expectedStatus,
    actualStatus: "Connection Error",
    passed: false,
    responseBody: "",
  };

  try {
    const headers: Record<string, string> = {};
    if (authHeader) {
      const [key, value] = authHeader.split(": ");
      headers[key] = value;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
    });

    result.actualStatus = response.status;
    result.passed = response.status === expectedStatus;

    // Try to get response body
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const json = await response.json();
      result.responseBody = JSON.stringify(json, null, 2);
    } else {
      const text = await response.text();
      result.responseBody = text;
    }

    const statusIcon = result.passed ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    console.log(
      `${statusIcon} ${result.passed ? "Passed" : "Failed"} - Status: ${result.actualStatus}`
    );
  } catch (error: any) {
    result.error = error.message || String(error);
    result.responseBody = `Error: ${result.error}`;
    console.log(`\x1b[31m✗ Failed - ${result.error}\x1b[0m`);
  }

  results.push(result);
  return result;
}

function generateReport() {
  const lines: string[] = [];

  lines.push("# API Endpoint Test Results");
  lines.push("");
  lines.push(`**Test Date:** ${new Date().toISOString()}`);
  lines.push(`**API Base URL:** ${API_BASE}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Group results by category
  const categories = [
    {
      name: "Public Endpoints (No Auth Required)",
      filter: (r: TestResult) =>
        r.description.includes("(No Auth)") === false &&
        (r.endpoint === "/api/auth/me" ||
          r.endpoint.includes("/trading/candidates") ||
          r.endpoint.includes("/watchlist")),
    },
    {
      name: "Protected Endpoints (Should Return 401 Without Auth)",
      filter: (r: TestResult) =>
        r.description.includes("(No Auth)") && r.expectedStatus === 401,
    },
    {
      name: "Health Check Endpoints",
      filter: (r: TestResult) => r.description.includes("Health"),
    },
    {
      name: "Additional Endpoints",
      filter: (r: TestResult) =>
        r.endpoint === "/" || r.endpoint === "/api" || r.endpoint === "/health",
    },
  ];

  categories.forEach((category, idx) => {
    const categoryResults = results.filter(category.filter);
    if (categoryResults.length === 0) return;

    lines.push(`## ${idx + 1}. ${category.name}`);
    lines.push("");

    categoryResults.forEach((result) => {
      lines.push(`### ${result.description}`);
      lines.push("");
      lines.push(`- **Endpoint:** \`${result.method} ${result.endpoint}\``);
      lines.push(`- **Expected Status:** ${result.expectedStatus}`);
      lines.push(`- **Actual Status:** ${result.actualStatus}`);
      lines.push(`- **Result:** ${result.passed ? "✅ PASSED" : "❌ FAILED"}`);

      if (result.error) {
        lines.push(`- **Error:** ${result.error}`);
      }

      lines.push("");
      lines.push("**Response Body:**");
      lines.push("```json");
      // Truncate long responses
      if (result.responseBody.length > 1000) {
        lines.push(result.responseBody.substring(0, 1000));
        lines.push("... (truncated)");
      } else {
        lines.push(result.responseBody);
      }
      lines.push("```");
      lines.push("");
      lines.push("---");
      lines.push("");
    });
  });

  // Summary
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = totalTests - passedTests;

  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Total Tests:** ${totalTests}`);
  lines.push(`- **Passed:** ${passedTests}`);
  lines.push(`- **Failed:** ${failedTests}`);
  lines.push("");

  if (failedTests === 0) {
    lines.push("- **Overall Status:** ✅ All tests passed");
  } else {
    lines.push("- **Overall Status:** ⚠️ Some tests failed");
  }

  lines.push("");
  lines.push("## Detailed Findings");
  lines.push("");

  // Authentication Issues
  const authIssues = results.filter(
    (r) => r.expectedStatus === 401 && r.actualStatus !== 401
  );
  if (authIssues.length > 0) {
    lines.push("### Authentication Issues");
    lines.push("");
    authIssues.forEach((issue) => {
      lines.push(
        `- **${issue.endpoint}**: Expected 401 but got ${issue.actualStatus}`
      );
    });
    lines.push("");
  }

  // Response Format Problems
  const formatIssues = results.filter(
    (r) => r.passed && r.responseBody.includes("Error")
  );
  if (formatIssues.length > 0) {
    lines.push("### Response Format Issues");
    lines.push("");
    formatIssues.forEach((issue) => {
      lines.push(
        `- **${issue.endpoint}**: Response contains error message despite successful status`
      );
    });
    lines.push("");
  }

  // Connection Errors
  const connectionErrors = results.filter(
    (r) => r.actualStatus === "Connection Error"
  );
  if (connectionErrors.length > 0) {
    lines.push("### Connection Errors");
    lines.push("");
    connectionErrors.forEach((error) => {
      lines.push(`- **${error.endpoint}**: ${error.error}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  console.log("");
  console.log("==================================================");
  console.log("  API ENDPOINT TESTING");
  console.log("==================================================");
  console.log("");

  // Test 1: Public Endpoints
  console.log("Testing Public Endpoints...");
  await testEndpoint("GET", "/api/auth/me", "Auth Status Check", 200);

  // Test 2: Protected Endpoints (should return 401 without auth)
  console.log("\nTesting Protected Endpoints (No Auth)...");
  await testEndpoint("GET", "/api/backtests", "List Backtests (No Auth)", 401);
  await testEndpoint(
    "GET",
    "/api/strategies",
    "List Strategies (No Auth)",
    401
  );
  await testEndpoint("GET", "/api/positions", "List Positions (No Auth)", 401);
  await testEndpoint(
    "GET",
    "/api/ai-decisions",
    "List AI Decisions (No Auth)",
    401
  );
  await testEndpoint("GET", "/api/feeds", "List Feeds (No Auth)", 401);
  await testEndpoint("GET", "/api/ai/sentiment", "AI Sentiment (No Auth)", 401);

  // Test 3: Health Check Endpoints
  console.log("\nTesting Health Check Endpoints...");
  await testEndpoint("GET", "/api/health/db", "Database Health Check", 200);
  await testEndpoint("GET", "/api/alpaca/health", "Alpaca Health Check", 200);

  // Test 4: Additional Endpoints
  console.log("\nTesting Additional Endpoints...");
  await testEndpoint("GET", "/", "Root Endpoint", 200);
  await testEndpoint("GET", "/api", "API Root", 200);
  await testEndpoint(
    "GET",
    "/api/trading/candidates",
    "Trading Candidates (Public)",
    200
  );
  await testEndpoint("GET", "/api/watchlist", "Watchlist (Public)", 200);
  await testEndpoint("GET", "/health", "Health Endpoint", 200);

  // Generate and save report
  console.log("\nGenerating report...");
  const report = generateReport();
  fs.writeFileSync(REPORT_FILE, report);

  console.log("");
  console.log("==================================================");
  console.log("  TEST SUMMARY");
  console.log("==================================================");
  console.log("");
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.passed).length}`);
  console.log(`Failed: ${results.filter((r) => !r.passed).length}`);
  console.log("");
  console.log(`Report saved to: ${REPORT_FILE}`);
  console.log("");

  // Exit with error code if tests failed
  const failedCount = results.filter((r) => !r.passed).length;
  if (failedCount > 0) {
    console.log(`\x1b[31m${failedCount} test(s) failed\x1b[0m`);
    process.exit(1);
  } else {
    console.log("\x1b[32mAll tests passed!\x1b[0m");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Test script failed:", error);
  process.exit(1);
});
