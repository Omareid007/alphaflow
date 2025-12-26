/**
 * Comprehensive Test Runner
 * Tests all API endpoints, captures logs, and identifies issues
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  statusCode?: number;
  error?: string;
  responseTime?: number;
  timestamp: string;
}

interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  context?: any;
}

class ComprehensiveTestRunner {
  private results: TestResult[] = [];
  private logs: LogEntry[] = [];
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
  }

  private log(level: LogEntry['level'], message: string, context?: any) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };
    this.logs.push(entry);
    console.log(`[${level.toUpperCase()}] ${message}`, context || '');
  }

  private async testEndpoint(
    endpoint: string,
    method: string = 'GET',
    options: RequestInit = {}
  ): Promise<TestResult> {
    const startTime = Date.now();
    const result: TestResult = {
      endpoint,
      method,
      status: 'FAIL',
      timestamp: new Date().toISOString(),
    };

    try {
      this.log('info', `Testing ${method} ${endpoint}`);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      result.statusCode = response.status;
      result.responseTime = Date.now() - startTime;

      if (response.ok) {
        result.status = 'PASS';
        this.log('info', `✓ ${method} ${endpoint} - ${response.status}`, {
          responseTime: result.responseTime,
        });
      } else {
        const errorText = await response.text();
        result.status = 'FAIL';
        result.error = errorText;
        this.log('warn', `✗ ${method} ${endpoint} - ${response.status}`, {
          error: errorText,
        });
      }
    } catch (error) {
      result.status = 'ERROR';
      result.error = error instanceof Error ? error.message : String(error);
      result.responseTime = Date.now() - startTime;
      this.log('error', `✗ ${method} ${endpoint} - ERROR`, {
        error: result.error,
      });
    }

    this.results.push(result);
    return result;
  }

  async testPublicEndpoints() {
    this.log('info', '=== Testing Public Endpoints ===');

    // Root
    await this.testEndpoint('/');

    // Auth endpoints (should work without auth)
    await this.testEndpoint('/api/auth/me');
  }

  async testApiEndpoints() {
    this.log('info', '=== Testing API Endpoints (Protected) ===');

    const endpoints = [
      '/api/backtests',
      '/api/strategies',
      '/api/positions',
      '/api/orders',
      '/api/trades',
      '/api/ai-decisions',
      '/api/feeds',
      '/api/ai/sentiment',
      '/api/agent/status',
      '/api/autonomous/state',
      '/api/health/db',
      '/api/alpaca/health',
    ];

    for (const endpoint of endpoints) {
      await this.testEndpoint(endpoint);
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async testBacktestsEndpoints() {
    this.log('info', '=== Testing Backtests Endpoints ===');

    await this.testEndpoint('/api/backtests');

    // Test with query parameters
    await this.testEndpoint('/api/backtests?limit=10&offset=0');
  }

  async generateReport() {
    const passCount = this.results.filter(r => r.status === 'PASS').length;
    const failCount = this.results.filter(r => r.status === 'FAIL').length;
    const errorCount = this.results.filter(r => r.status === 'ERROR').length;
    const totalCount = this.results.length;

    const report = {
      summary: {
        total: totalCount,
        passed: passCount,
        failed: failCount,
        errors: errorCount,
        successRate: totalCount > 0 ? ((passCount / totalCount) * 100).toFixed(2) : '0',
      },
      results: this.results,
      logs: this.logs,
      timestamp: new Date().toISOString(),
    };

    // Write detailed report
    const reportPath = join(process.cwd(), 'TEST_REPORT.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2));

    // Write summary
    const summaryPath = join(process.cwd(), 'TEST_SUMMARY.md');
    const summary = `# Test Summary - ${new Date().toISOString()}

## Results
- **Total Tests:** ${totalCount}
- **Passed:** ✅ ${passCount}
- **Failed:** ❌ ${failCount}
- **Errors:** 🔥 ${errorCount}
- **Success Rate:** ${report.summary.successRate}%

## Failed/Error Tests
${this.results
  .filter(r => r.status !== 'PASS')
  .map(r => `- **${r.method} ${r.endpoint}** - Status: ${r.statusCode || 'N/A'} - ${r.error || 'No error details'}`)
  .join('\n') || 'None'}

## Logs Summary
${this.logs
  .filter(l => l.level === 'error' || l.level === 'warn')
  .slice(0, 20)
  .map(l => `- [${l.level.toUpperCase()}] ${l.message}`)
  .join('\n') || 'No warnings or errors'}
`;

    await writeFile(summaryPath, summary);

    this.log('info', `Report generated: ${reportPath}`);
    this.log('info', `Summary generated: ${summaryPath}`);

    return report;
  }

  async runAllTests() {
    this.log('info', '🚀 Starting Comprehensive Test Suite');

    try {
      await this.testPublicEndpoints();
      await this.testApiEndpoints();
      await this.testBacktestsEndpoints();

      const report = await this.generateReport();

      this.log('info', '✅ Test suite completed');
      this.log('info', `Summary: ${report.summary.passed}/${report.summary.total} passed`);

      return report;
    } catch (error) {
      this.log('error', 'Test suite failed', { error });
      throw error;
    }
  }
}

// Run tests
const runner = new ComprehensiveTestRunner();
runner.runAllTests()
  .then(report => {
    console.log('\n=== TEST COMPLETE ===');
    console.log(`Results: ${report.summary.passed}/${report.summary.total} passed`);
    process.exit(report.summary.failed + report.summary.errors > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
