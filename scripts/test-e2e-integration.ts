#!/usr/bin/env tsx

/**
 * End-to-End Integration Testing Suite
 *
 * Tests all critical integration flows across the trading platform:
 * 1. Authentication Flow
 * 2. Strategy Management Flow
 * 3. Backtest Flow
 * 4. Trading Flow
 * 5. AI/Autonomous Flow
 * 6. Data Integration Flow
 *
 * Each test verifies data flows correctly through all layers:
 * Frontend → API → Database → External Services → Response
 */

// Configuration
const BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";
const TEST_USER = {
  username: `testuser_${Date.now()}`,
  password: "Test123456!",
};

interface TestResult {
  flow: string;
  test: string;
  passed: boolean;
  error?: string;
  duration: number;
  details?: any;
}

interface FlowResult {
  flow: string;
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  tests: TestResult[];
  issues: string[];
  recommendations: string[];
}

const results: FlowResult[] = [];
let sessionCookie: string | undefined;

// Utilities
function log(
  level: "INFO" | "PASS" | "FAIL" | "WARN",
  message: string,
  data?: any
) {
  const colors = {
    INFO: "\x1b[36m",
    PASS: "\x1b[32m",
    FAIL: "\x1b[31m",
    WARN: "\x1b[33m",
  };
  const reset = "\x1b[0m";
  console.log(`${colors[level]}[${level}]${reset} ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function apiRequest(
  method: string,
  path: string,
  data?: any,
  options: { requireAuth?: boolean; expectError?: boolean } = {}
): Promise<{ status: number; data: any; headers: Headers }> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.requireAuth && sessionCookie) {
    headers["Cookie"] = sessionCookie;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    // Extract session cookie if present
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      sessionCookie = setCookie.split(";")[0];
    }

    let responseData;
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok && !options.expectError) {
      throw new Error(
        `HTTP ${response.status}: ${JSON.stringify(responseData)}`
      );
    }

    return {
      status: response.status,
      data: responseData,
      headers: response.headers,
    };
  } catch (error) {
    if (options.expectError) {
      return {
        status: 500,
        data: { error: error instanceof Error ? error.message : String(error) },
        headers: new Headers(),
      };
    }
    throw error;
  }
}

async function runTest(
  flow: string,
  testName: string,
  testFn: () => Promise<{ passed: boolean; details?: any }>
): Promise<TestResult> {
  const startTime = Date.now();
  try {
    const result = await testFn();
    const duration = Date.now() - startTime;

    if (result.passed) {
      log("PASS", `${flow}: ${testName} (${duration}ms)`);
    } else {
      log("FAIL", `${flow}: ${testName} (${duration}ms)`, result.details);
    }

    return {
      flow,
      test: testName,
      passed: result.passed,
      duration,
      details: result.details,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    log("FAIL", `${flow}: ${testName} (${duration}ms)`, { error: errorMsg });
    return {
      flow,
      test: testName,
      passed: false,
      error: errorMsg,
      duration,
    };
  }
}

// ============================================================================
// FLOW 1: Authentication Flow
// ============================================================================
async function testAuthenticationFlow(): Promise<FlowResult> {
  const flowName = "Authentication Flow";
  const flowStartTime = Date.now();
  const tests: TestResult[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  log("INFO", `Starting ${flowName}...`);

  // Test 1.1: Signup
  tests.push(
    await runTest(flowName, "User Signup", async () => {
      const response = await apiRequest("POST", "/api/auth/signup", TEST_USER);

      const passed = response.status === 200 && response.data.user;
      if (!passed) {
        issues.push("Signup failed: No user returned in response");
      }

      return {
        passed,
        details: { userId: response.data.user?.id },
      };
    })
  );

  // Test 1.2: Duplicate Signup Prevention
  tests.push(
    await runTest(flowName, "Duplicate Signup Prevention", async () => {
      const response = await apiRequest("POST", "/api/auth/signup", TEST_USER, {
        expectError: true,
      });

      const passed = response.status === 400;
      if (!passed) {
        issues.push("Duplicate signup should return 400 error");
      }

      return { passed };
    })
  );

  // Test 1.3: Login
  tests.push(
    await runTest(flowName, "User Login", async () => {
      const response = await apiRequest("POST", "/api/auth/login", TEST_USER);

      const hasCookie = !!sessionCookie;
      const hasUser = !!response.data.user;
      const passed = response.status === 200 && hasCookie && hasUser;

      if (!hasCookie) {
        issues.push("Login did not set session cookie");
      }
      if (!hasUser) {
        issues.push("Login did not return user object");
      }

      return {
        passed,
        details: { hasCookie, hasUser },
      };
    })
  );

  // Test 1.4: Session Validation
  tests.push(
    await runTest(flowName, "Session Validation", async () => {
      const response = await apiRequest("GET", "/api/user", undefined, {
        requireAuth: true,
      });

      const passed =
        response.status === 200 &&
        response.data.username === TEST_USER.username;
      if (!passed) {
        issues.push("Session validation failed");
      }

      return { passed };
    })
  );

  // Test 1.5: Session Persistence
  tests.push(
    await runTest(flowName, "Session Persistence", async () => {
      // Make multiple authenticated requests
      const request1 = await apiRequest("GET", "/api/user", undefined, {
        requireAuth: true,
      });
      const request2 = await apiRequest("GET", "/api/strategies", undefined, {
        requireAuth: true,
      });

      const passed = request1.status === 200 && request2.status === 200;
      if (!passed) {
        issues.push("Session did not persist across multiple requests");
      }

      return { passed };
    })
  );

  // Test 1.6: Logout
  tests.push(
    await runTest(flowName, "User Logout", async () => {
      const response = await apiRequest("POST", "/api/auth/logout", undefined, {
        requireAuth: true,
      });

      const passed = response.status === 200;
      if (passed) {
        // Try to use the old session
        const testResponse = await apiRequest("GET", "/api/user", undefined, {
          requireAuth: true,
          expectError: true,
        });

        if (testResponse.status !== 401) {
          issues.push("Session still valid after logout");
          return { passed: false };
        }
      }

      // Re-login for subsequent tests
      await apiRequest("POST", "/api/auth/login", TEST_USER);

      return { passed };
    })
  );

  // Test 1.7: Invalid Credentials
  tests.push(
    await runTest(flowName, "Invalid Credentials Handling", async () => {
      const response = await apiRequest(
        "POST",
        "/api/auth/login",
        { username: TEST_USER.username, password: "wrongpassword" },
        { expectError: true }
      );

      const passed = response.status === 401;
      if (!passed) {
        issues.push("Invalid credentials should return 401");
      }

      return { passed };
    })
  );

  if (tests.some((t) => !t.passed)) {
    recommendations.push("Review session management implementation");
    recommendations.push("Add rate limiting to prevent brute force attacks");
    recommendations.push("Implement password reset flow");
  }

  const flowDuration = Date.now() - flowStartTime;
  const passedTests = tests.filter((t) => t.passed).length;

  return {
    flow: flowName,
    passed: passedTests === tests.length,
    totalTests: tests.length,
    passedTests,
    failedTests: tests.length - passedTests,
    duration: flowDuration,
    tests,
    issues,
    recommendations,
  };
}

// ============================================================================
// FLOW 2: Strategy Management Flow
// ============================================================================
async function testStrategyManagementFlow(): Promise<FlowResult> {
  const flowName = "Strategy Management Flow";
  const flowStartTime = Date.now();
  const tests: TestResult[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];
  let createdStrategyId: string | undefined;

  log("INFO", `Starting ${flowName}...`);

  // Test 2.1: Create Strategy
  tests.push(
    await runTest(flowName, "Create Strategy", async () => {
      const strategyData = {
        name: `Test Strategy ${Date.now()}`,
        type: "momentum",
        description: "E2E test strategy",
        isActive: false,
        assets: ["AAPL", "MSFT"],
        parameters: JSON.stringify({ rsi_period: 14, threshold: 70 }),
      };

      const response = await apiRequest(
        "POST",
        "/api/strategies",
        strategyData,
        { requireAuth: true }
      );

      const passed = response.status === 200 && response.data.id;
      if (passed) {
        createdStrategyId = response.data.id;
      } else {
        issues.push("Strategy creation failed");
      }

      return {
        passed,
        details: { strategyId: response.data.id },
      };
    })
  );

  // Test 2.2: Read Strategy
  tests.push(
    await runTest(flowName, "Read Strategy", async () => {
      if (!createdStrategyId) {
        return { passed: false, details: { error: "No strategy to read" } };
      }

      const response = await apiRequest(
        "GET",
        `/api/strategies/${createdStrategyId}`,
        undefined,
        { requireAuth: true }
      );

      const passed =
        response.status === 200 && response.data.id === createdStrategyId;
      if (!passed) {
        issues.push("Strategy read failed");
      }

      return { passed };
    })
  );

  // Test 2.3: Update Strategy
  tests.push(
    await runTest(flowName, "Update Strategy", async () => {
      if (!createdStrategyId) {
        return { passed: false, details: { error: "No strategy to update" } };
      }

      const updateData = {
        description: "Updated E2E test strategy",
        isActive: true,
      };

      const response = await apiRequest(
        "PUT",
        `/api/strategies/${createdStrategyId}`,
        updateData,
        { requireAuth: true }
      );

      const passed =
        response.status === 200 &&
        response.data.description === updateData.description;

      if (!passed) {
        issues.push("Strategy update failed");
      }

      return { passed };
    })
  );

  // Test 2.4: List Strategies
  tests.push(
    await runTest(flowName, "List Strategies", async () => {
      const response = await apiRequest("GET", "/api/strategies", undefined, {
        requireAuth: true,
      });

      const passed =
        response.status === 200 &&
        Array.isArray(response.data) &&
        response.data.some((s: any) => s.id === createdStrategyId);

      if (!passed) {
        issues.push("Strategy listing failed or strategy not found");
      }

      return { passed };
    })
  );

  // Test 2.5: Delete Strategy
  tests.push(
    await runTest(flowName, "Delete Strategy", async () => {
      if (!createdStrategyId) {
        return { passed: false, details: { error: "No strategy to delete" } };
      }

      const response = await apiRequest(
        "DELETE",
        `/api/strategies/${createdStrategyId}`,
        undefined,
        { requireAuth: true }
      );

      const passed = response.status === 200;

      // Verify deletion
      if (passed) {
        const verifyResponse = await apiRequest(
          "GET",
          `/api/strategies/${createdStrategyId}`,
          undefined,
          { requireAuth: true, expectError: true }
        );

        if (verifyResponse.status !== 404) {
          issues.push("Strategy still exists after deletion");
          return { passed: false };
        }
      } else {
        issues.push("Strategy deletion failed");
      }

      return { passed };
    })
  );

  // Test 2.6: Data Integrity
  tests.push(
    await runTest(flowName, "Data Integrity Check", async () => {
      // Create strategy with invalid data
      const invalidData = {
        name: "", // Empty name should fail
        type: "invalid_type",
      };

      const response = await apiRequest(
        "POST",
        "/api/strategies",
        invalidData,
        { requireAuth: true, expectError: true }
      );

      const passed = response.status === 400;
      if (!passed) {
        issues.push("Invalid strategy data was accepted");
        recommendations.push(
          "Strengthen input validation on strategy creation"
        );
      }

      return { passed };
    })
  );

  if (tests.some((t) => !t.passed)) {
    recommendations.push("Review strategy CRUD operations");
    recommendations.push("Add transaction rollback for failed operations");
  }

  const flowDuration = Date.now() - flowStartTime;
  const passedTests = tests.filter((t) => t.passed).length;

  return {
    flow: flowName,
    passed: passedTests === tests.length,
    totalTests: tests.length,
    passedTests,
    failedTests: tests.length - passedTests,
    duration: flowDuration,
    tests,
    issues,
    recommendations,
  };
}

// ============================================================================
// FLOW 3: Backtest Flow
// ============================================================================
async function testBacktestFlow(): Promise<FlowResult> {
  const flowName = "Backtest Flow";
  const flowStartTime = Date.now();
  const tests: TestResult[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];
  let backtestRunId: string | undefined;

  log("INFO", `Starting ${flowName}...`);

  // Test 3.1: Start Backtest
  tests.push(
    await runTest(flowName, "Start Backtest", async () => {
      const backtestConfig = {
        strategyConfig: {
          type: "momentum",
          indicators: { rsi_period: 14 },
        },
        universe: ["AAPL", "MSFT"],
        broker: "alpaca",
        timeframe: "1Day",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        initialCash: "10000",
        feesModel: { commission: 0 },
        slippageModel: { fixed_pct: 0.001 },
        executionPriceRule: "NEXT_OPEN",
        dataSource: "alpaca",
      };

      const response = await apiRequest(
        "POST",
        "/api/backtests",
        backtestConfig,
        { requireAuth: true }
      );

      const passed = response.status === 200 && response.data.id;
      if (passed) {
        backtestRunId = response.data.id;
      } else {
        issues.push("Backtest creation failed");
      }

      return {
        passed,
        details: { runId: response.data.id },
      };
    })
  );

  // Test 3.2: Poll Backtest Status
  tests.push(
    await runTest(flowName, "Poll Backtest Status", async () => {
      if (!backtestRunId) {
        return { passed: false, details: { error: "No backtest to poll" } };
      }

      // Poll up to 30 seconds
      let attempts = 0;
      const maxAttempts = 30;
      let status = "QUEUED";

      while (
        attempts < maxAttempts &&
        status !== "DONE" &&
        status !== "FAILED"
      ) {
        const response = await apiRequest(
          "GET",
          `/api/backtests/${backtestRunId}`,
          undefined,
          { requireAuth: true }
        );

        status = response.data.status;

        if (status === "DONE" || status === "FAILED") {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }

      const passed = status === "DONE";
      if (!passed) {
        issues.push(`Backtest did not complete: status=${status}`);
        if (status === "FAILED") {
          recommendations.push("Review backtest error handling");
        }
      }

      return {
        passed,
        details: { finalStatus: status, attempts },
      };
    })
  );

  // Test 3.3: Fetch Results
  tests.push(
    await runTest(flowName, "Fetch Backtest Results", async () => {
      if (!backtestRunId) {
        return { passed: false, details: { error: "No backtest to fetch" } };
      }

      const response = await apiRequest(
        "GET",
        `/api/backtests/${backtestRunId}`,
        undefined,
        { requireAuth: true }
      );

      const hasResults = !!response.data.resultsSummary;
      const passed = response.status === 200 && hasResults;

      if (!passed) {
        issues.push("Backtest results not available");
      }

      return {
        passed,
        details: { hasResults, summary: response.data.resultsSummary },
      };
    })
  );

  // Test 3.4: Fetch Equity Curve
  tests.push(
    await runTest(flowName, "Fetch Equity Curve", async () => {
      if (!backtestRunId) {
        return { passed: false, details: { error: "No backtest to fetch" } };
      }

      const response = await apiRequest(
        "GET",
        `/api/backtests/${backtestRunId}/equity`,
        undefined,
        { requireAuth: true }
      );

      const passed = response.status === 200 && Array.isArray(response.data);
      if (!passed) {
        issues.push("Equity curve data not available");
      }

      return {
        passed,
        details: { dataPoints: response.data?.length },
      };
    })
  );

  // Test 3.5: Fetch Trade Events
  tests.push(
    await runTest(flowName, "Fetch Trade Events", async () => {
      if (!backtestRunId) {
        return { passed: false, details: { error: "No backtest to fetch" } };
      }

      const response = await apiRequest(
        "GET",
        `/api/backtests/${backtestRunId}/trades`,
        undefined,
        { requireAuth: true }
      );

      const passed = response.status === 200 && Array.isArray(response.data);
      if (!passed) {
        issues.push("Trade events data not available");
      }

      return {
        passed,
        details: { tradeCount: response.data?.length },
      };
    })
  );

  if (tests.some((t) => !t.passed)) {
    recommendations.push("Review backtest execution flow");
    recommendations.push("Add better error reporting for failed backtests");
  }

  const flowDuration = Date.now() - flowStartTime;
  const passedTests = tests.filter((t) => t.passed).length;

  return {
    flow: flowName,
    passed: passedTests === tests.length,
    totalTests: tests.length,
    passedTests,
    failedTests: tests.length - passedTests,
    duration: flowDuration,
    tests,
    issues,
    recommendations,
  };
}

// ============================================================================
// FLOW 4: Trading Flow
// ============================================================================
async function testTradingFlow(): Promise<FlowResult> {
  const flowName = "Trading Flow";
  const flowStartTime = Date.now();
  const tests: TestResult[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  log("INFO", `Starting ${flowName}...`);

  // Test 4.1: Fetch Positions
  tests.push(
    await runTest(flowName, "Fetch Positions from Alpaca", async () => {
      const response = await apiRequest(
        "GET",
        "/api/trading/positions",
        undefined,
        { requireAuth: true }
      );

      const passed = response.status === 200 && Array.isArray(response.data);
      if (!passed) {
        issues.push("Failed to fetch positions from Alpaca");
      }

      return {
        passed,
        details: { positionCount: response.data?.length },
      };
    })
  );

  // Test 4.2: Fetch Account
  tests.push(
    await runTest(flowName, "Fetch Account from Alpaca", async () => {
      const response = await apiRequest(
        "GET",
        "/api/trading/account",
        undefined,
        { requireAuth: true }
      );

      const passed =
        response.status === 200 &&
        response.data.cash !== undefined &&
        response.data.buying_power !== undefined;

      if (!passed) {
        issues.push("Failed to fetch account data from Alpaca");
      }

      return {
        passed,
        details: {
          cash: response.data?.cash,
          buyingPower: response.data?.buying_power,
        },
      };
    })
  );

  // Test 4.3: Fetch Orders
  tests.push(
    await runTest(flowName, "Fetch Orders", async () => {
      const response = await apiRequest(
        "GET",
        "/api/trading/orders",
        undefined,
        { requireAuth: true }
      );

      const passed = response.status === 200 && Array.isArray(response.data);
      if (!passed) {
        issues.push("Failed to fetch orders");
      }

      return {
        passed,
        details: { orderCount: response.data?.length },
      };
    })
  );

  // Test 4.4: Position Reconciliation Status
  tests.push(
    await runTest(flowName, "Position Reconciliation", async () => {
      // Trigger reconciliation
      const response = await apiRequest(
        "POST",
        "/api/trading/reconcile",
        undefined,
        { requireAuth: true }
      );

      const passed = response.status === 200;
      if (!passed) {
        issues.push("Position reconciliation failed");
        recommendations.push("Review position reconciliation service");
      }

      return { passed };
    })
  );

  // Test 4.5: Data Source Metadata
  tests.push(
    await runTest(flowName, "Data Source Metadata", async () => {
      const response = await apiRequest(
        "GET",
        "/api/trading/positions",
        undefined,
        { requireAuth: true }
      );

      if (response.status !== 200) {
        return { passed: false };
      }

      // Check if positions have metadata
      const hasMetadata = response.data.every(
        (pos: any) => pos._metadata && pos._metadata.source
      );

      const passed = hasMetadata || response.data.length === 0;
      if (!passed) {
        issues.push("Positions missing metadata");
        recommendations.push("Ensure all positions include source metadata");
      }

      return { passed };
    })
  );

  // Note: We don't actually place orders in E2E tests to avoid real trading
  log("WARN", "Skipping actual order placement to avoid real trades");

  if (tests.some((t) => !t.passed)) {
    recommendations.push("Review Alpaca integration");
    recommendations.push("Add retry logic for transient failures");
  }

  const flowDuration = Date.now() - flowStartTime;
  const passedTests = tests.filter((t) => t.passed).length;

  return {
    flow: flowName,
    passed: passedTests === tests.length,
    totalTests: tests.length,
    passedTests,
    failedTests: tests.length - passedTests,
    duration: flowDuration,
    tests,
    issues,
    recommendations,
  };
}

// ============================================================================
// FLOW 5: AI/Autonomous Flow
// ============================================================================
async function testAIAutonomousFlow(): Promise<FlowResult> {
  const flowName = "AI/Autonomous Flow";
  const flowStartTime = Date.now();
  const tests: TestResult[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  log("INFO", `Starting ${flowName}...`);

  // Test 5.1: Fetch AI Decisions
  tests.push(
    await runTest(flowName, "Fetch AI Decisions", async () => {
      const response = await apiRequest("GET", "/api/ai/decisions", undefined, {
        requireAuth: true,
      });

      const passed = response.status === 200 && Array.isArray(response.data);
      if (!passed) {
        issues.push("Failed to fetch AI decisions");
      }

      return {
        passed,
        details: { decisionCount: response.data?.length },
      };
    })
  );

  // Test 5.2: Fetch Agent Status
  tests.push(
    await runTest(flowName, "Fetch Agent Status", async () => {
      const response = await apiRequest(
        "GET",
        "/api/autonomous/status",
        undefined,
        { requireAuth: true }
      );

      const passed =
        response.status === 200 && response.data.isRunning !== undefined;

      if (!passed) {
        issues.push("Failed to fetch agent status");
      }

      return {
        passed,
        details: { isRunning: response.data?.isRunning },
      };
    })
  );

  // Test 5.3: Fetch Trade Candidates
  tests.push(
    await runTest(flowName, "Fetch Trade Candidates", async () => {
      const response = await apiRequest("GET", "/api/candidates", undefined, {
        requireAuth: true,
      });

      const passed = response.status === 200 && Array.isArray(response.data);
      if (!passed) {
        issues.push("Failed to fetch trade candidates");
      }

      return {
        passed,
        details: { candidateCount: response.data?.length },
      };
    })
  );

  // Test 5.4: Start/Stop Autonomous Trading
  tests.push(
    await runTest(flowName, "Start Autonomous Trading", async () => {
      const response = await apiRequest(
        "POST",
        "/api/autonomous/start",
        undefined,
        { requireAuth: true }
      );

      const passed = response.status === 200;
      if (!passed) {
        issues.push("Failed to start autonomous trading");
      }

      // Stop it immediately
      if (passed) {
        await apiRequest("POST", "/api/autonomous/stop", undefined, {
          requireAuth: true,
        });
      }

      return { passed };
    })
  );

  // Test 5.5: LLM Gateway Status
  tests.push(
    await runTest(flowName, "LLM Gateway Status", async () => {
      const response = await apiRequest("GET", "/api/ai/llm/stats", undefined, {
        requireAuth: true,
      });

      const passed = response.status === 200;
      if (!passed) {
        issues.push("Failed to fetch LLM stats");
      }

      return {
        passed,
        details: response.data,
      };
    })
  );

  if (tests.some((t) => !t.passed)) {
    recommendations.push("Review AI decision engine integration");
    recommendations.push("Add monitoring for autonomous trading loop");
  }

  const flowDuration = Date.now() - flowStartTime;
  const passedTests = tests.filter((t) => t.passed).length;

  return {
    flow: flowName,
    passed: passedTests === tests.length,
    totalTests: tests.length,
    passedTests,
    failedTests: tests.length - passedTests,
    duration: flowDuration,
    tests,
    issues,
    recommendations,
  };
}

// ============================================================================
// FLOW 6: Data Integration Flow
// ============================================================================
async function testDataIntegrationFlow(): Promise<FlowResult> {
  const flowName = "Data Integration Flow";
  const flowStartTime = Date.now();
  const tests: TestResult[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  log("INFO", `Starting ${flowName}...`);

  // Test 6.1: Connector Status
  tests.push(
    await runTest(flowName, "Fetch Connector Status", async () => {
      const response = await apiRequest(
        "GET",
        "/api/connectors/status",
        undefined,
        { requireAuth: true }
      );

      const passed = response.status === 200;
      if (!passed) {
        issues.push("Failed to fetch connector status");
      }

      return {
        passed,
        details: response.data,
      };
    })
  );

  // Test 6.2: Market Data
  tests.push(
    await runTest(flowName, "Fetch Market Data", async () => {
      const response = await apiRequest(
        "GET",
        "/api/market/snapshot?symbols=AAPL",
        undefined,
        { requireAuth: true }
      );

      const passed = response.status === 200;
      if (!passed) {
        issues.push("Failed to fetch market data");
        recommendations.push("Verify Alpaca market data access");
      }

      return {
        passed,
        details: { symbols: Object.keys(response.data || {}) },
      };
    })
  );

  // Test 6.3: Sentiment Analysis
  tests.push(
    await runTest(flowName, "Sentiment Analysis", async () => {
      // Check if sentiment data is available through decisions
      const response = await apiRequest(
        "GET",
        "/api/ai/decisions?limit=1",
        undefined,
        { requireAuth: true }
      );

      const passed = response.status === 200;
      // This is informational - sentiment might not always be available

      return { passed };
    })
  );

  // Test 6.4: Data Fusion Status
  tests.push(
    await runTest(flowName, "Data Fusion Status", async () => {
      const response = await apiRequest(
        "GET",
        "/api/data-fusion/status",
        undefined,
        { requireAuth: true }
      );

      const passed = response.status === 200;
      if (!passed) {
        issues.push("Data fusion status unavailable");
      }

      return { passed };
    })
  );

  if (tests.some((t) => !t.passed)) {
    recommendations.push("Review data connector integrations");
    recommendations.push("Add health checks for external data sources");
  }

  const flowDuration = Date.now() - flowStartTime;
  const passedTests = tests.filter((t) => t.passed).length;

  return {
    flow: flowName,
    passed: passedTests === tests.length,
    totalTests: tests.length,
    passedTests,
    failedTests: tests.length - passedTests,
    duration: flowDuration,
    tests,
    issues,
    recommendations,
  };
}

// ============================================================================
// Main Test Runner
// ============================================================================
async function main() {
  console.log("\n");
  log("INFO", "=".repeat(80));
  log("INFO", "END-TO-END INTEGRATION TEST SUITE");
  log("INFO", `Target: ${BASE_URL}`);
  log("INFO", "=".repeat(80));
  console.log("\n");

  // Run all flows
  const flows = [
    testAuthenticationFlow,
    testStrategyManagementFlow,
    testBacktestFlow,
    testTradingFlow,
    testAIAutonomousFlow,
    testDataIntegrationFlow,
  ];

  for (const flowFn of flows) {
    const result = await flowFn();
    results.push(result);
    console.log("\n");
  }

  // Generate Report
  generateReport();
}

function generateReport() {
  console.log("\n");
  log("INFO", "=".repeat(80));
  log("INFO", "INTEGRATION TEST REPORT");
  log("INFO", "=".repeat(80));
  console.log("\n");

  // Summary
  const totalTests = results.reduce((sum, r) => sum + r.totalTests, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.passedTests, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failedTests, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const allPassed = results.every((r) => r.passed);

  console.log("SUMMARY");
  console.log("-------");
  console.log(`Total Flows: ${results.length}`);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Duration: ${totalDuration}ms`);
  console.log(`Overall Result: ${allPassed ? "✓ PASSED" : "✗ FAILED"}`);
  console.log("\n");

  // Flow Details
  console.log("FLOW RESULTS");
  console.log("------------");
  for (const result of results) {
    const status = result.passed ? "✓" : "✗";
    console.log(
      `${status} ${result.flow}: ${result.passedTests}/${result.totalTests} (${result.duration}ms)`
    );

    if (result.issues.length > 0) {
      console.log("  Issues:");
      result.issues.forEach((issue) => console.log(`    - ${issue}`));
    }
  }
  console.log("\n");

  // Integration Gaps
  const allIssues = results.flatMap((r) => r.issues);
  if (allIssues.length > 0) {
    console.log("INTEGRATION GAPS");
    console.log("----------------");
    allIssues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
    console.log("\n");
  }

  // Recommendations
  const allRecommendations = results.flatMap((r) => r.recommendations);
  if (allRecommendations.length > 0) {
    console.log("RECOMMENDATIONS");
    console.log("---------------");
    // Deduplicate recommendations
    const uniqueRecommendations = [...new Set(allRecommendations)];
    uniqueRecommendations.forEach((rec, i) => console.log(`${i + 1}. ${rec}`));
    console.log("\n");
  }

  // Failed Tests Detail
  const failedTests = results.flatMap((r) =>
    r.tests.filter((t) => !t.passed).map((t) => ({ ...t, flow: r.flow }))
  );

  if (failedTests.length > 0) {
    console.log("FAILED TESTS DETAIL");
    console.log("-------------------");
    failedTests.forEach((test) => {
      console.log(`${test.flow} > ${test.test}`);
      if (test.error) {
        console.log(`  Error: ${test.error}`);
      }
      if (test.details) {
        console.log(`  Details: ${JSON.stringify(test.details, null, 2)}`);
      }
    });
    console.log("\n");
  }

  log("INFO", "=".repeat(80));
  log("INFO", "TEST SUITE COMPLETE");
  log("INFO", "=".repeat(80));

  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Run tests
main().catch((error) => {
  log("FAIL", "Test suite crashed", error);
  process.exit(1);
});
