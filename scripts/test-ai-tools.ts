#!/usr/bin/env tsx

/**
 * Test script for AI Decision Engine Tools
 * Tests the new AI tool handlers for market data fetching
 */

import { finra } from "../server/connectors/finra";
import { secEdgarConnector } from "../server/connectors/sec-edgar";
import { fred } from "../server/connectors/fred";
import { frankfurter } from "../server/connectors/frankfurter";

interface TestResult {
  toolName: string;
  testCase: string;
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const status = result.success ? "✓ PASS" : "✗ FAIL";
  console.log(`\n${status} - ${result.toolName} (${result.testCase})`);

  if (result.executionTime) {
    console.log(`   Execution time: ${result.executionTime}ms`);
  }

  if (result.success && result.data) {
    console.log(`   Data: ${JSON.stringify(result.data, null, 2)}`);
  }

  if (!result.success && result.error) {
    console.log(`   Error: ${result.error}`);
  }
}

async function test_get_short_interest(symbol: string) {
  const toolName = "get_short_interest";
  const testCase = symbol;
  const startTime = Date.now();

  try {
    console.log(`\n========================================`);
    console.log(`Testing: ${toolName} with ${symbol}`);
    console.log(`========================================`);

    const summary = await finra.getShortInterestSummary(symbol);
    const executionTime = Date.now() - startTime;

    if (!summary) {
      logResult({
        toolName,
        testCase,
        success: false,
        error: `No short interest data available for ${symbol}`,
        executionTime,
      });
      return;
    }

    const analysis = finra.analyzeShortSqueezePotential(summary);

    const data = {
      shortRatio: (summary.latestShortRatio * 100).toFixed(1) + "%",
      averageShortRatio: (summary.averageShortRatio * 100).toFixed(1) + "%",
      trend: summary.shortRatioTrend,
      daysToCover: summary.daysTocover?.toFixed(1) || "N/A",
      squeezePotential: analysis.potential,
      squeezeScore: analysis.score,
      factors: analysis.factors,
      dataSource: "FINRA RegSHO"
    };

    logResult({
      toolName,
      testCase,
      success: true,
      data,
      executionTime,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logResult({
      toolName,
      testCase,
      success: false,
      error: (error as Error).message,
      executionTime,
    });
  }
}

async function test_get_sec_insider_activity(symbol: string) {
  const toolName = "get_sec_insider_activity";
  const testCase = symbol;
  const startTime = Date.now();

  try {
    console.log(`\n========================================`);
    console.log(`Testing: ${toolName} with ${symbol}`);
    console.log(`========================================`);

    const summary = await secEdgarConnector.getInsiderSummary(symbol);
    const executionTime = Date.now() - startTime;

    if (!summary) {
      logResult({
        toolName,
        testCase,
        success: false,
        error: `No insider data available for ${symbol}`,
        executionTime,
      });
      return;
    }

    const data = {
      totalBuys: summary.totalInsiderBuys,
      totalSells: summary.totalInsiderSells,
      netActivity: summary.netInsiderActivity,
      netValue: summary.netInsiderValue,
      buyToSellRatio: summary.buyToSellRatio === Infinity ? "All buys" : summary.buyToSellRatio.toFixed(2),
      sentiment: summary.sentiment,
      recentTransactions: summary.recentTransactions.slice(0, 5).map(t => ({
        owner: t.reportingOwner,
        type: t.transactionType,
        shares: t.sharesTransacted,
        date: t.transactionDate.toISOString().split('T')[0]
      })),
      dataSource: "SEC EDGAR Form 4"
    };

    logResult({
      toolName,
      testCase,
      success: true,
      data,
      executionTime,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logResult({
      toolName,
      testCase,
      success: false,
      error: (error as Error).message,
      executionTime,
    });
  }
}

async function test_get_macro_indicators() {
  const toolName = "get_macro_indicators";
  const testCase = "FRED Critical Indicators";
  const startTime = Date.now();

  try {
    console.log(`\n========================================`);
    console.log(`Testing: ${toolName}`);
    console.log(`========================================`);

    const indicators = await fred.getCriticalIndicators();
    const executionTime = Date.now() - startTime;

    const vix = indicators.find(i => i.indicatorId === "VIXCLS");
    const fedFunds = indicators.find(i => i.indicatorId === "FEDFUNDS");
    const yieldCurve = indicators.find(i => i.indicatorId === "T10Y2Y");
    const unemployment = indicators.find(i => i.indicatorId === "UNRATE");
    const cpi = indicators.find(i => i.indicatorId === "CPIAUCSL");

    let marketRegime = "neutral";
    if (vix && vix.latestValue !== null) {
      if (vix.latestValue > 30) marketRegime = "risk_off (high fear)";
      else if (vix.latestValue < 15) marketRegime = "risk_on (low fear)";
    }

    const data = {
      vix: vix?.latestValue?.toFixed(1) || "N/A",
      fedFundsRate: fedFunds?.latestValue?.toFixed(2) + "%" || "N/A",
      yieldCurve: yieldCurve?.latestValue?.toFixed(2) + "%" || "N/A",
      unemployment: unemployment?.latestValue?.toFixed(1) + "%" || "N/A",
      inflation: cpi?.changePercent?.toFixed(1) + "% (YoY change)" || "N/A",
      marketRegime,
      dataSource: "FRED (Federal Reserve)",
      rawIndicators: indicators.map(i => ({
        id: i.indicatorId,
        name: i.name,
        latestValue: i.latestValue,
        lastUpdatedAt: i.lastUpdatedAt,
        changePercent: i.changePercent
      }))
    };

    logResult({
      toolName,
      testCase,
      success: true,
      data,
      executionTime,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logResult({
      toolName,
      testCase,
      success: false,
      error: (error as Error).message,
      executionTime,
    });
  }
}

async function test_get_forex_rate(base: string, quote: string) {
  const toolName = "get_forex_rate";
  const testCase = `${base}/${quote}`;
  const startTime = Date.now();

  try {
    console.log(`\n========================================`);
    console.log(`Testing: ${toolName} with ${base}/${quote}`);
    console.log(`========================================`);

    const summary = await frankfurter.getForexPairSummary(base, quote);
    const executionTime = Date.now() - startTime;

    if (!summary) {
      logResult({
        toolName,
        testCase,
        success: false,
        error: `No forex data available for ${base}/${quote}`,
        executionTime,
      });
      return;
    }

    const data = {
      pair: summary.pair,
      rate: summary.currentRate.toFixed(4),
      change: summary.change.toFixed(4),
      changePercent: summary.changePercent.toFixed(2) + "%",
      high30d: summary.high30d.toFixed(4),
      low30d: summary.low30d.toFixed(4),
      trend: summary.trend,
      dataSource: "Frankfurter (ECB)"
    };

    logResult({
      toolName,
      testCase,
      success: true,
      data,
      executionTime,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logResult({
      toolName,
      testCase,
      success: false,
      error: (error as Error).message,
      executionTime,
    });
  }
}

async function test_get_usd_strength() {
  const toolName = "get_usd_strength";
  const testCase = "USD Strength Index";
  const startTime = Date.now();

  try {
    console.log(`\n========================================`);
    console.log(`Testing: ${toolName}`);
    console.log(`========================================`);

    const strength = await frankfurter.getUSDStrengthIndex();
    const executionTime = Date.now() - startTime;

    if (!strength) {
      logResult({
        toolName,
        testCase,
        success: false,
        error: "Unable to calculate USD strength index",
        executionTime,
      });
      return;
    }

    const data = {
      index: strength.index.toFixed(2),
      trend: strength.trend,
      components: strength.components.map(c => ({
        currency: c.currency,
        weight: (c.weight * 100).toFixed(1) + "%",
        rate: c.rate.toFixed(4)
      })),
      dataSource: "Frankfurter (ECB)"
    };

    logResult({
      toolName,
      testCase,
      success: true,
      data,
      executionTime,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logResult({
      toolName,
      testCase,
      success: false,
      error: (error as Error).message,
      executionTime,
    });
  }
}

async function printSummary() {
  console.log(`\n\n========================================`);
  console.log(`TEST SUMMARY`);
  console.log(`========================================\n`);

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  console.log(`Total tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log(`Failed tests:`);
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  - ${r.toolName} (${r.testCase}): ${r.error}`);
      });
  }

  console.log(`\nDetailed Results:`);
  console.log(`-----------------`);
  results.forEach(r => {
    const status = r.success ? "✓" : "✗";
    console.log(`${status} ${r.toolName} - ${r.testCase} (${r.executionTime}ms)`);
  });
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        AI DECISION ENGINE TOOLS - TEST SUITE                  ║
║        Testing new data source integrations                   ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // Test 1: FINRA Short Interest for AAPL
  await test_get_short_interest("AAPL");

  // Test 2: SEC Insider Activity for MSFT
  await test_get_sec_insider_activity("MSFT");

  // Test 3: FRED Macroeconomic Indicators
  await test_get_macro_indicators();

  // Test 4: Forex Rate EUR/USD
  await test_get_forex_rate("EUR", "USD");

  // Test 5: USD Strength Index
  await test_get_usd_strength();

  // Print summary
  await printSummary();
}

main().catch(error => {
  console.error("\nFATAL ERROR:", error);
  process.exit(1);
});
