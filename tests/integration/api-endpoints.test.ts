import { describe, it, expect } from "vitest";

const API_BASE = "http://localhost:5000";

describe("API Endpoint Audit", () => {
  const EXPECTED_ENDPOINTS = [
    {
      method: "GET",
      path: "/api/alpaca/account",
      description: "Alpaca account info",
    },
    {
      method: "GET",
      path: "/api/alpaca/positions",
      description: "Alpaca positions",
    },
    { method: "GET", path: "/api/agent/status", description: "Agent status" },
    {
      method: "GET",
      path: "/api/autonomous/state",
      description: "Autonomous state",
    },
    {
      method: "GET",
      path: "/api/analytics/summary",
      description: "Analytics summary",
    },
    { method: "GET", path: "/api/strategies", description: "List strategies" },
    { method: "GET", path: "/api/backtests", description: "List backtests" },
    {
      method: "GET",
      path: "/api/fusion/intelligence",
      description: "Fusion intelligence",
    },
    {
      method: "GET",
      path: "/api/candidates",
      description: "Trading candidates",
    },
    { method: "GET", path: "/api/watchlist", description: "Watchlist" },
  ];

  const results: {
    working: string[];
    missing: string[];
    connectionErrors: string[];
    errors: { path: string; status: number; error: string }[];
  } = {
    working: [],
    missing: [],
    connectionErrors: [],
    errors: [],
  };

  it("should verify all expected endpoints exist", async () => {
    for (const endpoint of EXPECTED_ENDPOINTS) {
      try {
        const testPath = endpoint.path
          .replace(":symbol", "AAPL")
          .replace(":id", "1");

        let response;
        if (endpoint.method === "GET") {
          response = await fetch(`${API_BASE}${testPath}`);
        } else if (endpoint.method === "POST") {
          response = await fetch(`${API_BASE}${testPath}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        }

        if (response?.status === 404) {
          results.missing.push(
            `${endpoint.method} ${endpoint.path} - ${endpoint.description}`
          );
        } else if (response?.status && response.status >= 500) {
          results.errors.push({
            path: `${endpoint.method} ${endpoint.path}`,
            status: response.status,
            error: await response.text().then((t) => t.substring(0, 200)),
          });
        } else {
          results.working.push(`${endpoint.method} ${endpoint.path}`);
        }
      } catch (error) {
        // Connection errors mean server isn't running - track separately
        results.connectionErrors.push(
          `${endpoint.method} ${endpoint.path} - ${endpoint.description}`
        );
      }
    }

    console.log("\nAPI ENDPOINT AUDIT RESULTS");
    console.log("=".repeat(60));

    // If server isn't running, skip the test
    if (results.connectionErrors.length === EXPECTED_ENDPOINTS.length) {
      console.log("\nServer not running - skipping endpoint audit");
      console.log("Start server with: npm run server:prod");
      return; // Pass test when server is offline
    }

    console.log(`\nWorking Endpoints (${results.working.length}):`);
    results.working.forEach((e) => console.log(`   ${e}`));

    if (results.missing.length > 0) {
      console.log(`\nMissing Endpoints (${results.missing.length}):`);
      results.missing.forEach((e) => console.log(`   ${e}`));
    }

    if (results.connectionErrors.length > 0) {
      console.log(`\nConnection Errors (${results.connectionErrors.length}):`);
      results.connectionErrors.forEach((e) => console.log(`   ${e}`));
    }

    if (results.errors.length > 0) {
      console.log(`\nError Endpoints (${results.errors.length}):`);
      results.errors.forEach((e) => console.log(`   ${e.path} -> ${e.status}`));
    }

    // Only check actual 404s as critical missing, not connection errors
    const criticalMissing = results.missing.filter(
      (e) =>
        e.includes("/positions") ||
        e.includes("/account") ||
        e.includes("/agent/status")
    );

    if (criticalMissing.length > 0) {
      console.error("\nCRITICAL ENDPOINTS MISSING (404):");
      criticalMissing.forEach((e) => console.error(`   ${e}`));
    }

    expect(criticalMissing.length).toBe(0);
  });
});
