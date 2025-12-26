#!/usr/bin/env tsx

/**
 * COMPREHENSIVE END-TO-END FLOW TESTING
 * Tests complete user journeys from start to finish
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { randomBytes } from 'crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

interface TestResult {
  flowName: string;
  stepsPassed: number;
  stepsFailed: number;
  totalSteps: number;
  steps: StepResult[];
  duration: number;
  passed: boolean;
}

interface StepResult {
  step: number;
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  details?: any;
}

interface TestContext {
  users: Map<string, { id: string; username: string; password: string; cookies: string[] }>;
  strategies: Map<string, any>;
  orders: Map<string, any>;
  positions: Map<string, any>;
  aiDecisions: Map<string, any>;
  backtests: Map<string, any>;
}

class E2ETestRunner {
  private results: TestResult[] = [];
  private context: TestContext = {
    users: new Map(),
    strategies: new Map(),
    orders: new Map(),
    positions: new Map(),
    aiDecisions: new Map(),
    backtests: new Map(),
  };

  async run() {
    console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}COMPREHENSIVE END-TO-END FLOW TESTING${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}\n`);
    console.log(`Base URL: ${BASE_URL}\n`);

    const flows = [
      { name: 'Flow 1: New User Onboarding', fn: this.testFlow1.bind(this) },
      { name: 'Flow 2: Strategy Creation & Backtesting', fn: this.testFlow2.bind(this) },
      { name: 'Flow 3: Live Trading Flow', fn: this.testFlow3.bind(this) },
      { name: 'Flow 4: Autonomous Trading Flow', fn: this.testFlow4.bind(this) },
      { name: 'Flow 5: Portfolio Management Flow', fn: this.testFlow5.bind(this) },
      { name: 'Flow 6: AI Analysis Flow', fn: this.testFlow6.bind(this) },
      { name: 'Flow 7: Admin Operations Flow', fn: this.testFlow7.bind(this) },
      { name: 'Flow 8: Multi-User Isolation Flow', fn: this.testFlow8.bind(this) },
      { name: 'Flow 9: Session Persistence Flow', fn: this.testFlow9.bind(this) },
      { name: 'Flow 10: Error Recovery Flow', fn: this.testFlow10.bind(this) },
    ];

    for (const flow of flows) {
      await this.runFlow(flow.name, flow.fn);
    }

    await this.generateReport();
  }

  private async runFlow(flowName: string, flowFn: () => Promise<TestResult>) {
    console.log(`${colors.bright}${colors.blue}▶ Running: ${flowName}${colors.reset}`);
    try {
      const result = await flowFn();
      this.results.push(result);

      if (result.passed) {
        console.log(`${colors.green}✓ PASSED${colors.reset} - ${result.stepsPassed}/${result.totalSteps} steps in ${result.duration}ms\n`);
      } else {
        console.log(`${colors.red}✗ FAILED${colors.reset} - ${result.stepsPassed}/${result.totalSteps} steps passed, ${result.stepsFailed} failed in ${result.duration}ms\n`);
      }
    } catch (error) {
      console.log(`${colors.red}✗ CRASHED${colors.reset} - ${error}\n`);
      this.results.push({
        flowName,
        stepsPassed: 0,
        stepsFailed: 1,
        totalSteps: 1,
        steps: [{
          step: 0,
          name: 'Flow execution',
          status: 'FAIL',
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
        }],
        duration: 0,
        passed: false,
      });
    }
  }

  // ============================================================================
  // FLOW 1: New User Onboarding
  // ============================================================================
  private async testFlow1(): Promise<TestResult> {
    const startTime = Date.now();
    const steps: StepResult[] = [];
    let stepNum = 0;

    const username = `testuser_${randomBytes(4).toString('hex')}`;
    const password = 'TestPass123!';

    // Step 1: Create new account
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.post(`${BASE_URL}/api/auth/signup`, {
        username,
        password,
      });
      steps.push({
        step: stepNum,
        name: 'Create new account (POST /api/auth/signup)',
        status: response.status === 201 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, userId: response.data.user?.id },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Create new account (POST /api/auth/signup)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 2: Login
    stepNum++;
    let cookies: string[] = [];
    let userId: string = '';
    try {
      const stepStart = Date.now();
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        username,
        password,
      });
      cookies = response.headers['set-cookie'] || [];
      userId = response.data.user?.id || '';

      steps.push({
        step: stepNum,
        name: 'Login (POST /api/auth/login)',
        status: response.status === 200 && cookies.length > 0 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, hasCookie: cookies.length > 0, userId },
      });

      this.context.users.set(username, { id: userId, username, password, cookies });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Login (POST /api/auth/login)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 3: Verify authenticated
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Cookie: cookies.join('; ') },
      });
      steps.push({
        step: stepNum,
        name: 'Verify authenticated (GET /api/auth/me)',
        status: response.status === 200 && response.data.user?.username === username ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, username: response.data.user?.username },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Verify authenticated (GET /api/auth/me)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 4: Access dashboard endpoints
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/strategies`, {
        headers: { Cookie: cookies.join('; ') },
      });
      steps.push({
        step: stepNum,
        name: 'Access dashboard endpoints (GET /api/strategies)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, strategiesCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Access dashboard endpoints (GET /api/strategies)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 5: Logout
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.post(`${BASE_URL}/api/auth/logout`, {}, {
        headers: { Cookie: cookies.join('; ') },
      });
      steps.push({
        step: stepNum,
        name: 'Logout',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Logout',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 6: Verify session invalidated
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Cookie: cookies.join('; ') },
      });
      // Should fail (401) if logout worked
      steps.push({
        step: stepNum,
        name: 'Verify session invalidated',
        status: response.status === 401 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, expectedStatus: 401 },
      });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      steps.push({
        step: stepNum,
        name: 'Verify session invalidated',
        status: status === 401 ? 'PASS' : 'FAIL',
        duration: 0,
        details: { status, expectedStatus: 401 },
      });
    }

    const duration = Date.now() - startTime;
    const stepsPassed = steps.filter(s => s.status === 'PASS').length;
    const stepsFailed = steps.filter(s => s.status === 'FAIL').length;

    return {
      flowName: 'Flow 1: New User Onboarding',
      stepsPassed,
      stepsFailed,
      totalSteps: steps.length,
      steps,
      duration,
      passed: stepsFailed === 0,
    };
  }

  // ============================================================================
  // FLOW 2: Strategy Creation & Backtesting
  // ============================================================================
  private async testFlow2(): Promise<TestResult> {
    const startTime = Date.now();
    const steps: StepResult[] = [];
    let stepNum = 0;

    // Setup: Login as user
    const { cookies, userId } = await this.loginTestUser();

    // Step 1: Create new strategy
    stepNum++;
    let strategyId = '';
    try {
      const stepStart = Date.now();
      const response = await axios.post(`${BASE_URL}/api/strategies`, {
        name: `Test Strategy ${Date.now()}`,
        type: 'momentum',
        description: 'E2E Test Strategy',
        assets: ['AAPL', 'MSFT', 'GOOGL'],
        parameters: JSON.stringify({
          lookbackPeriod: 20,
          entryThreshold: 0.02,
          exitThreshold: 0.01,
        }),
      }, {
        headers: { Cookie: cookies.join('; ') },
      });

      strategyId = response.data.id;
      this.context.strategies.set(strategyId, response.data);

      steps.push({
        step: stepNum,
        name: 'Create new strategy (POST /api/strategies)',
        status: response.status === 201 && strategyId ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, strategyId },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Create new strategy (POST /api/strategies)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 2: Run backtest
    stepNum++;
    let backtestId = '';
    try {
      const stepStart = Date.now();
      const response = await axios.post(`${BASE_URL}/api/backtests/run`, {
        strategyId,
        startDate: '2024-01-01',
        endDate: '2024-12-01',
        initialCash: 100000,
        universe: ['AAPL', 'MSFT', 'GOOGL'],
        timeframe: '1Day',
        broker: 'alpaca',
      }, {
        headers: { Cookie: cookies.join('; ') },
      });

      backtestId = response.data.id;
      this.context.backtests.set(backtestId, response.data);

      steps.push({
        step: stepNum,
        name: 'Run backtest (POST /api/backtests/run)',
        status: response.status === 201 && backtestId ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, backtestId, backtestStatus: response.data.status },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Run backtest (POST /api/backtests/run)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 3: Poll for backtest completion
    stepNum++;
    try {
      const stepStart = Date.now();
      let backtestStatus = 'QUEUED';
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts && backtestStatus !== 'DONE' && backtestStatus !== 'FAILED') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const response = await axios.get(`${BASE_URL}/api/backtests/${backtestId}`, {
          headers: { Cookie: cookies.join('; ') },
        });
        backtestStatus = response.data.status;
        attempts++;
      }

      steps.push({
        step: stepNum,
        name: 'Poll for backtest completion',
        status: backtestStatus === 'DONE' ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { finalStatus: backtestStatus, attempts },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Poll for backtest completion',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 4: Fetch backtest results
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/backtests/${backtestId}`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Fetch backtest results (GET /api/backtests/:id)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: {
          status: response.status,
          hasResults: !!response.data.resultsSummary,
          resultSummary: response.data.resultsSummary,
        },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Fetch backtest results (GET /api/backtests/:id)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 5: View equity curve
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/backtests/${backtestId}/equity`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View equity curve',
        status: response.status === 200 && Array.isArray(response.data) ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, dataPoints: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View equity curve',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 6: View trade history
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/backtests/${backtestId}/trades`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View trade history',
        status: response.status === 200 && Array.isArray(response.data) ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, tradesCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View trade history',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    const duration = Date.now() - startTime;
    const stepsPassed = steps.filter(s => s.status === 'PASS').length;
    const stepsFailed = steps.filter(s => s.status === 'FAIL').length;

    return {
      flowName: 'Flow 2: Strategy Creation & Backtesting',
      stepsPassed,
      stepsFailed,
      totalSteps: steps.length,
      steps,
      duration,
      passed: stepsFailed === 0,
    };
  }

  // ============================================================================
  // FLOW 3: Live Trading Flow
  // ============================================================================
  private async testFlow3(): Promise<TestResult> {
    const startTime = Date.now();
    const steps: StepResult[] = [];
    let stepNum = 0;

    const { cookies } = await this.loginTestUser();

    // Step 1: Get account info
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/alpaca/account`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Get account info (GET /api/alpaca/account)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, hasAccountData: !!response.data },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Get account info (GET /api/alpaca/account)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 2: Get current positions
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/positions`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Get current positions (GET /api/positions)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, positionsCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Get current positions (GET /api/positions)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 3: View trade candidates
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/trading/candidates`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View trade candidates',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, candidatesCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View trade candidates',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 4: Place order (paper trading)
    stepNum++;
    let orderId = '';
    try {
      const stepStart = Date.now();
      const response = await axios.post(`${BASE_URL}/api/alpaca/orders`, {
        symbol: 'AAPL',
        qty: 1,
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
      }, {
        headers: { Cookie: cookies.join('; ') },
      });

      orderId = response.data.id;

      steps.push({
        step: stepNum,
        name: 'Place order (POST /api/alpaca/orders)',
        status: response.status === 201 || response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, orderId },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Place order (POST /api/alpaca/orders)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 5: Monitor order status
    stepNum++;
    if (orderId) {
      try {
        const stepStart = Date.now();
        const response = await axios.get(`${BASE_URL}/api/alpaca/orders/${orderId}`, {
          headers: { Cookie: cookies.join('; ') },
        });

        steps.push({
          step: stepNum,
          name: 'Monitor order status',
          status: response.status === 200 ? 'PASS' : 'FAIL',
          duration: Date.now() - stepStart,
          details: { status: response.status, orderStatus: response.data.status },
        });
      } catch (error) {
        steps.push({
          step: stepNum,
          name: 'Monitor order status',
          status: 'FAIL',
          duration: 0,
          error: this.extractError(error),
        });
      }
    } else {
      steps.push({
        step: stepNum,
        name: 'Monitor order status',
        status: 'SKIP',
        duration: 0,
        details: { reason: 'No order created in previous step' },
      });
    }

    // Step 6: View orders
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/orders`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View orders (GET /api/orders)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, ordersCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View orders (GET /api/orders)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 7: View trades
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/trades`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View trades (GET /api/trades)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, tradesCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View trades (GET /api/trades)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    const duration = Date.now() - startTime;
    const stepsPassed = steps.filter(s => s.status === 'PASS').length;
    const stepsFailed = steps.filter(s => s.status === 'FAIL').length;

    return {
      flowName: 'Flow 3: Live Trading Flow',
      stepsPassed,
      stepsFailed,
      totalSteps: steps.length,
      steps,
      duration,
      passed: stepsFailed === 0,
    };
  }

  // ============================================================================
  // FLOW 4: Autonomous Trading Flow
  // ============================================================================
  private async testFlow4(): Promise<TestResult> {
    const startTime = Date.now();
    const steps: StepResult[] = [];
    let stepNum = 0;

    const { cookies } = await this.loginTestUser();

    // Step 1: Get orchestrator status
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/autonomous/status`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Get orchestrator status',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, isRunning: response.data.isRunning },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Get orchestrator status',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 2: Start autonomous mode
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.post(`${BASE_URL}/api/autonomous/start`, {}, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Start autonomous mode (POST /api/autonomous/start)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, message: response.data.message },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Start autonomous mode (POST /api/autonomous/start)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 3: Wait and verify running
    stepNum++;
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/autonomous/status`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Verify autonomous mode running',
        status: response.status === 200 && response.data.isRunning ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, isRunning: response.data.isRunning },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Verify autonomous mode running',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 4: View AI decisions
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/ai-decisions`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View AI decisions',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, decisionsCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View AI decisions',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 5: View trading candidates
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/trading/candidates`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View trading candidates',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, candidatesCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View trading candidates',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 6: Stop autonomous mode
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.post(`${BASE_URL}/api/autonomous/stop`, {}, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Stop autonomous mode (POST /api/autonomous/stop)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, message: response.data.message },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Stop autonomous mode (POST /api/autonomous/stop)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 7: Verify stopped
    stepNum++;
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/autonomous/status`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Verify autonomous mode stopped',
        status: response.status === 200 && !response.data.isRunning ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, isRunning: response.data.isRunning },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Verify autonomous mode stopped',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    const duration = Date.now() - startTime;
    const stepsPassed = steps.filter(s => s.status === 'PASS').length;
    const stepsFailed = steps.filter(s => s.status === 'FAIL').length;

    return {
      flowName: 'Flow 4: Autonomous Trading Flow',
      stepsPassed,
      stepsFailed,
      totalSteps: steps.length,
      steps,
      duration,
      passed: stepsFailed === 0,
    };
  }

  // ============================================================================
  // FLOW 5: Portfolio Management Flow
  // ============================================================================
  private async testFlow5(): Promise<TestResult> {
    const startTime = Date.now();
    const steps: StepResult[] = [];
    let stepNum = 0;

    const { cookies } = await this.loginTestUser();

    // Step 1: Get portfolio snapshot
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/portfolio/snapshot`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Get portfolio snapshot (GET /api/portfolio/snapshot)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, hasSnapshot: !!response.data },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Get portfolio snapshot (GET /api/portfolio/snapshot)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 2: View positions
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/positions`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View positions (GET /api/positions)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, positionsCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View positions (GET /api/positions)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 3: View orders
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/orders`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View orders (GET /api/orders)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, ordersCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View orders (GET /api/orders)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 4: View trades
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/trades`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View trades (GET /api/trades)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, tradesCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View trades (GET /api/trades)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 5: Get account info
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/alpaca/account`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Get account info',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: {
          status: response.status,
          equity: response.data.equity,
          cash: response.data.cash,
        },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Get account info',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    const duration = Date.now() - startTime;
    const stepsPassed = steps.filter(s => s.status === 'PASS').length;
    const stepsFailed = steps.filter(s => s.status === 'FAIL').length;

    return {
      flowName: 'Flow 5: Portfolio Management Flow',
      stepsPassed,
      stepsFailed,
      totalSteps: steps.length,
      steps,
      duration,
      passed: stepsFailed === 0,
    };
  }

  // ============================================================================
  // FLOW 6: AI Analysis Flow
  // ============================================================================
  private async testFlow6(): Promise<TestResult> {
    const startTime = Date.now();
    const steps: StepResult[] = [];
    let stepNum = 0;

    const { cookies } = await this.loginTestUser();

    // Step 1: Get AI decisions
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/ai-decisions`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Get AI decisions (GET /api/ai-decisions)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, decisionsCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Get AI decisions (GET /api/ai-decisions)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 2: View sentiment analysis (via feeds)
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/feeds`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View feeds (GET /api/feeds)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, feedsCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View feeds (GET /api/feeds)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 3: Check AI events
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/ai/events`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Get AI events (GET /api/ai/events)',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, eventsCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Get AI events (GET /api/ai/events)',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 4: View trading candidates (AI-driven)
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/trading/candidates`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View trading candidates',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, candidatesCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View trading candidates',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    const duration = Date.now() - startTime;
    const stepsPassed = steps.filter(s => s.status === 'PASS').length;
    const stepsFailed = steps.filter(s => s.status === 'FAIL').length;

    return {
      flowName: 'Flow 6: AI Analysis Flow',
      stepsPassed,
      stepsFailed,
      totalSteps: steps.length,
      steps,
      duration,
      passed: stepsFailed === 0,
    };
  }

  // ============================================================================
  // FLOW 7: Admin Operations Flow
  // ============================================================================
  private async testFlow7(): Promise<TestResult> {
    const startTime = Date.now();
    const steps: StepResult[] = [];
    let stepNum = 0;

    // Create admin user
    const adminUsername = `admin_${randomBytes(4).toString('hex')}`;
    const adminPassword = 'AdminPass123!';

    try {
      await axios.post(`${BASE_URL}/api/auth/signup`, {
        username: adminUsername,
        password: adminPassword,
        isAdmin: true,
      });
    } catch (error) {
      // May already exist
    }

    // Login as admin
    let cookies: string[] = [];
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        username: adminUsername,
        password: adminPassword,
      });
      cookies = response.headers['set-cookie'] || [];
    } catch (error) {
      // Handle login failure
    }

    // Step 1: Access admin dashboard
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/admin/status`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Access admin dashboard',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Access admin dashboard',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 2: View system status
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/autonomous/status`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View system status',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, isRunning: response.data.isRunning },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View system status',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 3: View all strategies
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/strategies`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'View all strategies',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, strategiesCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'View all strategies',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 4: Check audit logs
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/admin/audit-logs`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Check audit logs',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, logsCount: response.data.length },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Check audit logs',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    const duration = Date.now() - startTime;
    const stepsPassed = steps.filter(s => s.status === 'PASS').length;
    const stepsFailed = steps.filter(s => s.status === 'FAIL').length;

    return {
      flowName: 'Flow 7: Admin Operations Flow',
      stepsPassed,
      stepsFailed,
      totalSteps: steps.length,
      steps,
      duration,
      passed: stepsFailed === 0,
    };
  }

  // ============================================================================
  // FLOW 8: Multi-User Isolation Flow
  // ============================================================================
  private async testFlow8(): Promise<TestResult> {
    const startTime = Date.now();
    const steps: StepResult[] = [];
    let stepNum = 0;

    // Create User A
    const userAName = `userA_${randomBytes(4).toString('hex')}`;
    const userAPass = 'UserAPass123!';
    let userACookies: string[] = [];

    stepNum++;
    try {
      const stepStart = Date.now();
      await axios.post(`${BASE_URL}/api/auth/signup`, {
        username: userAName,
        password: userAPass,
      });
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        username: userAName,
        password: userAPass,
      });
      userACookies = loginResponse.headers['set-cookie'] || [];

      steps.push({
        step: stepNum,
        name: 'Create User A',
        status: userACookies.length > 0 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { username: userAName },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Create User A',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Create User B
    const userBName = `userB_${randomBytes(4).toString('hex')}`;
    const userBPass = 'UserBPass123!';
    let userBCookies: string[] = [];

    stepNum++;
    try {
      const stepStart = Date.now();
      await axios.post(`${BASE_URL}/api/auth/signup`, {
        username: userBName,
        password: userBPass,
      });
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        username: userBName,
        password: userBPass,
      });
      userBCookies = loginResponse.headers['set-cookie'] || [];

      steps.push({
        step: stepNum,
        name: 'Create User B',
        status: userBCookies.length > 0 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { username: userBName },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Create User B',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // User A creates strategy S1
    let strategyS1Id = '';
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.post(`${BASE_URL}/api/strategies`, {
        name: `UserA_Strategy_${Date.now()}`,
        type: 'momentum',
        description: 'User A Strategy',
      }, {
        headers: { Cookie: userACookies.join('; ') },
      });
      strategyS1Id = response.data.id;

      steps.push({
        step: stepNum,
        name: 'User A creates strategy S1',
        status: response.status === 201 && strategyS1Id ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { strategyId: strategyS1Id },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'User A creates strategy S1',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // User B creates strategy S2
    let strategyS2Id = '';
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.post(`${BASE_URL}/api/strategies`, {
        name: `UserB_Strategy_${Date.now()}`,
        type: 'mean_reversion',
        description: 'User B Strategy',
      }, {
        headers: { Cookie: userBCookies.join('; ') },
      });
      strategyS2Id = response.data.id;

      steps.push({
        step: stepNum,
        name: 'User B creates strategy S2',
        status: response.status === 201 && strategyS2Id ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { strategyId: strategyS2Id },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'User B creates strategy S2',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // User A queries strategies - should only see S1
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/strategies`, {
        headers: { Cookie: userACookies.join('; ') },
      });

      const hasS1 = response.data.some((s: any) => s.id === strategyS1Id);
      const hasS2 = response.data.some((s: any) => s.id === strategyS2Id);

      steps.push({
        step: stepNum,
        name: 'User A queries strategies - isolation check',
        status: hasS1 && !hasS2 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: {
          strategiesCount: response.data.length,
          seesOwnStrategy: hasS1,
          seesOtherUserStrategy: hasS2,
        },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'User A queries strategies - isolation check',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // User B queries strategies - should only see S2
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/strategies`, {
        headers: { Cookie: userBCookies.join('; ') },
      });

      const hasS1 = response.data.some((s: any) => s.id === strategyS1Id);
      const hasS2 = response.data.some((s: any) => s.id === strategyS2Id);

      steps.push({
        step: stepNum,
        name: 'User B queries strategies - isolation check',
        status: !hasS1 && hasS2 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: {
          strategiesCount: response.data.length,
          seesOwnStrategy: hasS2,
          seesOtherUserStrategy: hasS1,
        },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'User B queries strategies - isolation check',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Test orders isolation
    stepNum++;
    try {
      const stepStart = Date.now();
      const userAOrders = await axios.get(`${BASE_URL}/api/orders`, {
        headers: { Cookie: userACookies.join('; ') },
      });
      const userBOrders = await axios.get(`${BASE_URL}/api/orders`, {
        headers: { Cookie: userBCookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Test orders isolation',
        status: 'PASS',
        duration: Date.now() - stepStart,
        details: {
          userAOrdersCount: userAOrders.data.length,
          userBOrdersCount: userBOrders.data.length,
        },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Test orders isolation',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Test positions isolation
    stepNum++;
    try {
      const stepStart = Date.now();
      const userAPositions = await axios.get(`${BASE_URL}/api/positions`, {
        headers: { Cookie: userACookies.join('; ') },
      });
      const userBPositions = await axios.get(`${BASE_URL}/api/positions`, {
        headers: { Cookie: userBCookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Test positions isolation',
        status: 'PASS',
        duration: Date.now() - stepStart,
        details: {
          userAPositionsCount: userAPositions.data.length,
          userBPositionsCount: userBPositions.data.length,
        },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Test positions isolation',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Test AI decisions isolation
    stepNum++;
    try {
      const stepStart = Date.now();
      const userADecisions = await axios.get(`${BASE_URL}/api/ai-decisions`, {
        headers: { Cookie: userACookies.join('; ') },
      });
      const userBDecisions = await axios.get(`${BASE_URL}/api/ai-decisions`, {
        headers: { Cookie: userBCookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Test AI decisions isolation',
        status: 'PASS',
        duration: Date.now() - stepStart,
        details: {
          userADecisionsCount: userADecisions.data.length,
          userBDecisionsCount: userBDecisions.data.length,
        },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Test AI decisions isolation',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    const duration = Date.now() - startTime;
    const stepsPassed = steps.filter(s => s.status === 'PASS').length;
    const stepsFailed = steps.filter(s => s.status === 'FAIL').length;

    return {
      flowName: 'Flow 8: Multi-User Isolation Flow',
      stepsPassed,
      stepsFailed,
      totalSteps: steps.length,
      steps,
      duration,
      passed: stepsFailed === 0,
    };
  }

  // ============================================================================
  // FLOW 9: Session Persistence Flow
  // ============================================================================
  private async testFlow9(): Promise<TestResult> {
    const startTime = Date.now();
    const steps: StepResult[] = [];
    let stepNum = 0;

    const { cookies } = await this.loginTestUser();

    // Step 1: Make authenticated request
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Make authenticated request',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Make authenticated request',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 2: Verify session persists (multiple requests)
    stepNum++;
    try {
      const stepStart = Date.now();
      for (let i = 0; i < 5; i++) {
        await axios.get(`${BASE_URL}/api/strategies`, {
          headers: { Cookie: cookies.join('; ') },
        });
      }

      steps.push({
        step: stepNum,
        name: 'Verify session persists across multiple requests',
        status: 'PASS',
        duration: Date.now() - stepStart,
        details: { requestCount: 5 },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Verify session persists across multiple requests',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    // Step 3: Verify session still valid after delay
    stepNum++;
    try {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/auth/me`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Verify session valid after 5s delay',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'Verify session valid after 5s delay',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    const duration = Date.now() - startTime;
    const stepsPassed = steps.filter(s => s.status === 'PASS').length;
    const stepsFailed = steps.filter(s => s.status === 'FAIL').length;

    return {
      flowName: 'Flow 9: Session Persistence Flow',
      stepsPassed,
      stepsFailed,
      totalSteps: steps.length,
      steps,
      duration,
      passed: stepsFailed === 0,
    };
  }

  // ============================================================================
  // FLOW 10: Error Recovery Flow
  // ============================================================================
  private async testFlow10(): Promise<TestResult> {
    const startTime = Date.now();
    const steps: StepResult[] = [];
    let stepNum = 0;

    // Step 1: Invalid credentials
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        username: 'nonexistent_user',
        password: 'wrongpassword',
      });

      steps.push({
        step: stepNum,
        name: 'Invalid credentials error',
        status: response.status === 401 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, expectedStatus: 401 },
      });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      steps.push({
        step: stepNum,
        name: 'Invalid credentials error',
        status: status === 401 ? 'PASS' : 'FAIL',
        duration: 0,
        details: { status, expectedStatus: 401 },
      });
    }

    // Step 2: Missing required fields
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.post(`${BASE_URL}/api/strategies`, {
        // Missing required fields
        description: 'Missing name and type',
      });

      steps.push({
        step: stepNum,
        name: 'Missing required fields error',
        status: response.status === 400 || response.status === 401 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status },
      });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      steps.push({
        step: stepNum,
        name: 'Missing required fields error',
        status: status === 400 || status === 401 ? 'PASS' : 'FAIL',
        duration: 0,
        details: { status },
      });
    }

    // Step 3: Invalid parameters
    stepNum++;
    try {
      const { cookies } = await this.loginTestUser();
      const stepStart = Date.now();
      const response = await axios.post(`${BASE_URL}/api/alpaca/orders`, {
        symbol: 'INVALID_SYMBOL_THAT_DOES_NOT_EXIST',
        qty: -100, // Invalid negative quantity
        side: 'invalid_side',
        type: 'market',
      }, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'Invalid parameters error',
        status: response.status === 400 || response.status === 422 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status },
      });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      steps.push({
        step: stepNum,
        name: 'Invalid parameters error',
        status: status === 400 || status === 422 ? 'PASS' : 'FAIL',
        duration: 0,
        details: { status },
      });
    }

    // Step 4: Access without authentication
    stepNum++;
    try {
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/strategies`);

      steps.push({
        step: stepNum,
        name: 'Unauthenticated access error',
        status: response.status === 401 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status, expectedStatus: 401 },
      });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      steps.push({
        step: stepNum,
        name: 'Unauthenticated access error',
        status: status === 401 ? 'PASS' : 'FAIL',
        duration: 0,
        details: { status, expectedStatus: 401 },
      });
    }

    // Step 5: System recovers - verify normal operation still works
    stepNum++;
    try {
      const { cookies } = await this.loginTestUser();
      const stepStart = Date.now();
      const response = await axios.get(`${BASE_URL}/api/strategies`, {
        headers: { Cookie: cookies.join('; ') },
      });

      steps.push({
        step: stepNum,
        name: 'System recovery - normal operation works',
        status: response.status === 200 ? 'PASS' : 'FAIL',
        duration: Date.now() - stepStart,
        details: { status: response.status },
      });
    } catch (error) {
      steps.push({
        step: stepNum,
        name: 'System recovery - normal operation works',
        status: 'FAIL',
        duration: 0,
        error: this.extractError(error),
      });
    }

    const duration = Date.now() - startTime;
    const stepsPassed = steps.filter(s => s.status === 'PASS').length;
    const stepsFailed = steps.filter(s => s.status === 'FAIL').length;

    return {
      flowName: 'Flow 10: Error Recovery Flow',
      stepsPassed,
      stepsFailed,
      totalSteps: steps.length,
      steps,
      duration,
      passed: stepsFailed === 0,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async loginTestUser(): Promise<{ cookies: string[]; userId: string; username: string }> {
    const username = `testuser_${randomBytes(4).toString('hex')}`;
    const password = 'TestPass123!';

    try {
      await axios.post(`${BASE_URL}/api/auth/signup`, {
        username,
        password,
      });
    } catch (error) {
      // May already exist
    }

    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      username,
      password,
    });

    const cookies = response.headers['set-cookie'] || [];
    const userId = response.data.user?.id || '';

    this.context.users.set(username, { id: userId, username, password, cookies });

    return { cookies, userId, username };
  }

  private extractError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.response?.data?.error || error.message;
      return `[${status}] ${message}`;
    }
    return error instanceof Error ? error.message : String(error);
  }

  // ============================================================================
  // Report Generation
  // ============================================================================

  private async generateReport() {
    console.log(`\n${colors.bright}${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}COMPREHENSIVE E2E TEST RESULTS${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}\n`);

    const totalFlows = this.results.length;
    const passedFlows = this.results.filter(r => r.passed).length;
    const failedFlows = totalFlows - passedFlows;
    const totalSteps = this.results.reduce((sum, r) => sum + r.totalSteps, 0);
    const passedSteps = this.results.reduce((sum, r) => sum + r.stepsPassed, 0);
    const failedSteps = this.results.reduce((sum, r) => sum + r.stepsFailed, 0);
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    // Summary
    console.log(`${colors.bright}Summary:${colors.reset}`);
    console.log(`  Total Flows: ${totalFlows}`);
    console.log(`  ${colors.green}Passed Flows: ${passedFlows}${colors.reset}`);
    console.log(`  ${colors.red}Failed Flows: ${failedFlows}${colors.reset}`);
    console.log(`  Total Steps: ${totalSteps}`);
    console.log(`  ${colors.green}Passed Steps: ${passedSteps}${colors.reset}`);
    console.log(`  ${colors.red}Failed Steps: ${failedSteps}${colors.reset}`);
    console.log(`  Total Duration: ${totalDuration}ms\n`);

    // Generate markdown report
    const reportPath = '/home/runner/workspace/E2E_TEST_RESULTS.md';
    const reportContent = this.generateMarkdownReport();

    const fs = await import('fs/promises');
    await fs.writeFile(reportPath, reportContent, 'utf-8');

    console.log(`${colors.green}Report saved to: ${reportPath}${colors.reset}\n`);

    // Overall result
    if (failedFlows === 0) {
      console.log(`${colors.bright}${colors.green}========================================`);
      console.log(`ALL E2E TESTS PASSED!`);
      console.log(`========================================${colors.reset}\n`);
    } else {
      console.log(`${colors.bright}${colors.red}========================================`);
      console.log(`SOME E2E TESTS FAILED`);
      console.log(`========================================${colors.reset}\n`);
    }
  }

  private generateMarkdownReport(): string {
    const timestamp = new Date().toISOString();
    const totalFlows = this.results.length;
    const passedFlows = this.results.filter(r => r.passed).length;
    const failedFlows = totalFlows - passedFlows;
    const totalSteps = this.results.reduce((sum, r) => sum + r.totalSteps, 0);
    const passedSteps = this.results.reduce((sum, r) => sum + r.stepsPassed, 0);
    const failedSteps = this.results.reduce((sum, r) => sum + r.stepsFailed, 0);
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    let md = `# Comprehensive End-to-End Test Results\n\n`;
    md += `**Generated:** ${timestamp}\n\n`;
    md += `**Base URL:** ${BASE_URL}\n\n`;

    md += `## Executive Summary\n\n`;
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    md += `| Total Flows | ${totalFlows} |\n`;
    md += `| Passed Flows | ${passedFlows} |\n`;
    md += `| Failed Flows | ${failedFlows} |\n`;
    md += `| Total Steps | ${totalSteps} |\n`;
    md += `| Passed Steps | ${passedSteps} |\n`;
    md += `| Failed Steps | ${failedSteps} |\n`;
    md += `| Total Duration | ${totalDuration}ms |\n`;
    md += `| Success Rate | ${((passedSteps / totalSteps) * 100).toFixed(2)}% |\n\n`;

    md += `## Flow Results\n\n`;

    for (const result of this.results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      md += `### ${status} - ${result.flowName}\n\n`;
      md += `- **Steps Passed:** ${result.stepsPassed}/${result.totalSteps}\n`;
      md += `- **Steps Failed:** ${result.stepsFailed}\n`;
      md += `- **Duration:** ${result.duration}ms\n\n`;

      md += `#### Steps Detail\n\n`;
      md += `| Step | Name | Status | Duration | Details |\n`;
      md += `|------|------|--------|----------|--------|\n`;

      for (const step of result.steps) {
        const statusIcon = step.status === 'PASS' ? '✅' : step.status === 'FAIL' ? '❌' : '⏭️';
        const details = step.error
          ? `Error: ${step.error}`
          : step.details
            ? JSON.stringify(step.details, null, 2).substring(0, 100)
            : '';
        md += `| ${step.step} | ${step.name} | ${statusIcon} ${step.status} | ${step.duration}ms | ${details} |\n`;
      }

      md += `\n`;

      // Show failures in detail
      const failures = result.steps.filter(s => s.status === 'FAIL');
      if (failures.length > 0) {
        md += `#### Failures\n\n`;
        for (const failure of failures) {
          md += `**Step ${failure.step}: ${failure.name}**\n`;
          md += `\`\`\`\n${failure.error || 'Unknown error'}\n\`\`\`\n\n`;
          if (failure.details) {
            md += `Details:\n\`\`\`json\n${JSON.stringify(failure.details, null, 2)}\n\`\`\`\n\n`;
          }
        }
      }
    }

    md += `## Recommendations\n\n`;

    const failedFlowsList = this.results.filter(r => !r.passed);
    if (failedFlowsList.length > 0) {
      md += `### Failed Flows\n\n`;
      for (const flow of failedFlowsList) {
        md += `- **${flow.flowName}**: ${flow.stepsFailed} step(s) failed\n`;
      }
      md += `\n`;
    }

    md += `### Performance Analysis\n\n`;
    md += `| Flow | Duration | Performance |\n`;
    md += `|------|----------|-------------|\n`;
    for (const result of this.results) {
      const perfRating = result.duration < 5000 ? '🟢 Fast' : result.duration < 30000 ? '🟡 Moderate' : '🔴 Slow';
      md += `| ${result.flowName} | ${result.duration}ms | ${perfRating} |\n`;
    }
    md += `\n`;

    md += `## Next Steps\n\n`;
    if (failedFlows > 0) {
      md += `1. Review and fix all failed test steps\n`;
      md += `2. Investigate root causes of failures\n`;
      md += `3. Re-run E2E tests after fixes\n`;
      md += `4. Consider adding additional test coverage for edge cases\n`;
    } else {
      md += `All tests passed! Consider:\n`;
      md += `1. Adding more comprehensive test scenarios\n`;
      md += `2. Testing edge cases and error conditions\n`;
      md += `3. Performance optimization for slower flows\n`;
      md += `4. Load testing under concurrent user scenarios\n`;
    }

    return md;
  }
}

// ============================================================================
// Main Execution
// ============================================================================

const runner = new E2ETestRunner();
runner.run().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
