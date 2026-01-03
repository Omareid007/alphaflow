#!/usr/bin/env tsx
/**
 * Comprehensive Performance Testing Suite
 * Tests all major endpoints and identifies optimization opportunities
 */

import https from "https";
import http from "http";
import { performance } from "perf_hooks";

interface PerformanceMetric {
  endpoint: string;
  method: string;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  requests: number;
  errors: number;
  throughput: number;
}

interface TestResult {
  success: boolean;
  duration: number;
  statusCode?: number;
  error?: string;
  payloadSize?: number;
}

class PerformanceTester {
  private baseUrl: string;
  private authToken: string | null = null;
  private results: Map<string, TestResult[]> = new Map();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request(
    method: string,
    path: string,
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<TestResult> {
    const start = performance.now();

    return new Promise((resolve) => {
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === "https:";
      const lib = isHttps ? https : http;

      const options = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
          ...(this.authToken
            ? { Authorization: `Bearer ${this.authToken}` }
            : {}),
        },
      };

      const req = lib.request(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const duration = performance.now() - start;
          resolve({
            success: res.statusCode! >= 200 && res.statusCode! < 300,
            duration,
            statusCode: res.statusCode,
            payloadSize: Buffer.byteLength(data),
          });
        });
      });

      req.on("error", (error) => {
        const duration = performance.now() - start;
        resolve({
          success: false,
          duration,
          error: error.message,
        });
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  private async authenticate() {
    console.log("🔐 Authenticating...");
    const result = await this.request("POST", "/api/auth/login", {
      email: "test@example.com",
      password: "password123",
    });

    if (!result.success) {
      // Try to signup first
      await this.request("POST", "/api/auth/signup", {
        email: "test@example.com",
        password: "password123",
      });

      // Retry login
      const loginResult = await this.request("POST", "/api/auth/login", {
        email: "test@example.com",
        password: "password123",
      });

      if (loginResult.success) {
        console.log("✅ Authenticated successfully");
      }
    }
  }

  private async runTest(
    name: string,
    method: string,
    path: string,
    iterations: number = 10,
    body?: any
  ): Promise<void> {
    console.log(`\n📊 Testing ${method} ${path} (${iterations} iterations)...`);

    const results: TestResult[] = [];

    for (let i = 0; i < iterations; i++) {
      const result = await this.request(method, path, body);
      results.push(result);

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    this.results.set(name, results);

    const durations = results.map((r) => r.duration);
    const errors = results.filter((r) => !r.success).length;

    console.log(`  Min: ${Math.min(...durations).toFixed(2)}ms`);
    console.log(`  Max: ${Math.max(...durations).toFixed(2)}ms`);
    console.log(
      `  Avg: ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)}ms`
    );
    console.log(`  Errors: ${errors}/${iterations}`);

    if (results[0]?.payloadSize) {
      console.log(
        `  Payload: ${(results[0].payloadSize / 1024).toFixed(2)} KB`
      );
    }
  }

  private async loadTest(
    name: string,
    method: string,
    path: string,
    concurrency: number,
    totalRequests: number,
    body?: any
  ): Promise<void> {
    console.log(`\n🔥 Load Testing ${method} ${path}`);
    console.log(`   Concurrency: ${concurrency}, Total: ${totalRequests}`);

    const results: TestResult[] = [];
    const startTime = performance.now();

    const runBatch = async () => {
      const promises: Promise<TestResult>[] = [];
      for (let i = 0; i < concurrency; i++) {
        promises.push(this.request(method, path, body));
      }
      return Promise.all(promises);
    };

    const batches = Math.ceil(totalRequests / concurrency);
    for (let i = 0; i < batches; i++) {
      const batchResults = await runBatch();
      results.push(...batchResults);
    }

    const totalTime = performance.now() - startTime;
    const durations = results.map((r) => r.duration);
    const errors = results.filter((r) => !r.success).length;
    const successRate = (
      ((results.length - errors) / results.length) *
      100
    ).toFixed(2);
    const throughput = (results.length / (totalTime / 1000)).toFixed(2);

    console.log(`  Total Time: ${totalTime.toFixed(2)}ms`);
    console.log(
      `  Avg Response: ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)}ms`
    );
    console.log(`  Throughput: ${throughput} req/s`);
    console.log(`  Success Rate: ${successRate}%`);
    console.log(`  Errors: ${errors}/${results.length}`);

    this.results.set(`${name}_load`, results);
  }

  private calculateMetrics(name: string): PerformanceMetric | null {
    const results = this.results.get(name);
    if (!results || results.length === 0) return null;

    const durations = results.map((r) => r.duration).sort((a, b) => a - b);
    const errors = results.filter((r) => !r.success).length;

    const p50Index = Math.floor(durations.length * 0.5);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    return {
      endpoint: name,
      method: "GET",
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50: durations[p50Index],
      p95: durations[p95Index],
      p99: durations[p99Index],
      requests: results.length,
      errors,
      throughput: 0,
    };
  }

  async runAllTests() {
    console.log("🚀 Starting Comprehensive Performance Testing");
    console.log("=".repeat(60));

    await this.authenticate();

    // Authentication Endpoints
    console.log("\n\n📋 CATEGORY: Authentication Endpoints");
    console.log("─".repeat(60));
    await this.runTest("auth_signup", "POST", "/api/auth/signup", 5, {
      email: `perf-test-${Date.now()}@example.com`,
      password: "password123",
    });
    await this.runTest("auth_login", "POST", "/api/auth/login", 10, {
      email: "test@example.com",
      password: "password123",
    });
    await this.runTest("auth_me", "GET", "/api/auth/me", 20);

    // Data Fetching Endpoints
    console.log("\n\n📋 CATEGORY: Data Fetching Endpoints");
    console.log("─".repeat(60));
    await this.runTest("strategies_list", "GET", "/api/strategies", 20);
    await this.runTest("positions_list", "GET", "/api/positions", 20);
    await this.runTest("orders_list", "GET", "/api/orders", 20);
    await this.runTest("trades_list", "GET", "/api/trades", 20);
    await this.runTest("trades_enriched", "GET", "/api/trades/enriched", 10);

    // Heavy Operations
    console.log("\n\n📋 CATEGORY: Heavy Operations");
    console.log("─".repeat(60));
    await this.runTest("ai_decisions_list", "GET", "/api/ai-decisions", 10);
    await this.runTest(
      "ai_decisions_enriched",
      "GET",
      "/api/ai-decisions/enriched",
      5
    );
    await this.runTest(
      "activity_timeline",
      "GET",
      "/api/activity/timeline",
      10
    );
    await this.runTest(
      "analytics_summary",
      "GET",
      "/api/analytics/summary",
      10
    );

    // Admin/Monitoring Endpoints
    console.log("\n\n📋 CATEGORY: Admin & Monitoring");
    console.log("─".repeat(60));
    await this.runTest(
      "connectors_status",
      "GET",
      "/api/connectors/status",
      10
    );
    await this.runTest("ai_status", "GET", "/api/ai/status", 10);
    await this.runTest("health_db", "GET", "/api/health/db", 10);
    await this.runTest("alpaca_account", "GET", "/api/alpaca/account", 10);

    // External API Endpoints (no auth needed)
    console.log("\n\n📋 CATEGORY: External APIs (No Auth)");
    console.log("─".repeat(60));
    await this.runTest("uae_status", "GET", "/api/uae/status", 10);

    // Load Testing
    console.log("\n\n📋 CATEGORY: Load Testing");
    console.log("─".repeat(60));
    await this.loadTest("positions_load_10", "GET", "/api/positions", 10, 100);
    await this.loadTest("positions_load_50", "GET", "/api/positions", 50, 500);
    await this.loadTest("trades_load_10", "GET", "/api/trades", 10, 100);

    this.generateReport();
  }

  private generateReport() {
    console.log("\n\n");
    console.log("=".repeat(80));
    console.log("📊 PERFORMANCE TEST RESULTS SUMMARY");
    console.log("=".repeat(80));

    const metrics: PerformanceMetric[] = [];

    for (const [name] of this.results) {
      const metric = this.calculateMetrics(name);
      if (metric) {
        metrics.push(metric);
      }
    }

    // Sort by average response time
    metrics.sort((a, b) => b.avg - a.avg);

    console.log("\n🎯 Top 10 Slowest Endpoints:");
    console.log("─".repeat(80));
    console.log(
      "| Endpoint".padEnd(40) +
        "| Avg (ms)".padEnd(12) +
        "| P95 (ms)".padEnd(12) +
        "| P99 (ms)".padEnd(12) +
        "| Errors |"
    );
    console.log("─".repeat(80));

    metrics.slice(0, 10).forEach((m) => {
      const status = m.avg < 100 ? "✅" : m.avg < 300 ? "⚠️" : "🔴";
      console.log(
        `${status} ${m.endpoint.padEnd(37)}` +
          `| ${m.avg.toFixed(2).padEnd(10)}` +
          `| ${m.p95.toFixed(2).padEnd(10)}` +
          `| ${m.p99.toFixed(2).padEnd(10)}` +
          `| ${m.errors}/${m.requests} |`
      );
    });

    console.log("\n📈 Performance Grades:");
    console.log("─".repeat(80));

    const gradeEndpoint = (avg: number): string => {
      if (avg < 100) return "A (Excellent)";
      if (avg < 200) return "B (Good)";
      if (avg < 300) return "C (Fair)";
      if (avg < 500) return "D (Poor)";
      return "F (Critical)";
    };

    metrics.forEach((m) => {
      console.log(`${m.endpoint.padEnd(40)} ${gradeEndpoint(m.avg)}`);
    });

    // Critical issues
    console.log("\n🚨 Critical Performance Issues (>500ms):");
    console.log("─".repeat(80));
    const critical = metrics.filter((m) => m.avg > 500);
    if (critical.length === 0) {
      console.log("✅ No critical performance issues detected");
    } else {
      critical.forEach((m) => {
        console.log(`🔴 ${m.endpoint}: ${m.avg.toFixed(2)}ms average`);
      });
    }

    // Warnings
    console.log("\n⚠️  Performance Warnings (300-500ms):");
    console.log("─".repeat(80));
    const warnings = metrics.filter((m) => m.avg >= 300 && m.avg <= 500);
    if (warnings.length === 0) {
      console.log("✅ No performance warnings");
    } else {
      warnings.forEach((m) => {
        console.log(`⚠️  ${m.endpoint}: ${m.avg.toFixed(2)}ms average`);
      });
    }

    // Error analysis
    console.log("\n❌ Error Analysis:");
    console.log("─".repeat(80));
    const withErrors = metrics.filter((m) => m.errors > 0);
    if (withErrors.length === 0) {
      console.log("✅ No errors detected");
    } else {
      withErrors.forEach((m) => {
        const errorRate = ((m.errors / m.requests) * 100).toFixed(2);
        console.log(
          `❌ ${m.endpoint}: ${m.errors}/${m.requests} (${errorRate}%)`
        );
      });
    }

    console.log("\n");
    console.log("=".repeat(80));
    console.log("Testing Complete!");
    console.log("=".repeat(80));
  }
}

// Main execution
async function main() {
  const baseUrl = process.env.BASE_URL || "http://localhost:5000";

  console.log(`Testing server at: ${baseUrl}\n`);

  const tester = new PerformanceTester(baseUrl);
  await tester.runAllTests();
}

main().catch(console.error);
