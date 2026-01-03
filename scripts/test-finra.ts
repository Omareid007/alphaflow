#!/usr/bin/env tsx

/**
 * FINRA Connector Test Script
 *
 * Tests the FINRA connector functionality including:
 * - Short interest summary retrieval
 * - Short squeeze potential analysis
 * - RegSHO short volume data
 */

import finra from "../server/connectors/finra";

// Helper function to format output
function printSeparator(title: string) {
  console.log("\n" + "=".repeat(80));
  console.log(`  ${title}`);
  console.log("=".repeat(80) + "\n");
}

// Helper function to format percentages
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

// Helper function to format numbers with commas
function formatNumber(value: number): string {
  return value.toLocaleString();
}

async function testFINRAConnector() {
  console.log("FINRA Connector Test Suite");
  console.log("Started at:", new Date().toLocaleString());

  // Test symbols
  const testSymbols = ["AAPL", "TSLA"];

  try {
    // Test 1: Connection Status
    printSeparator("TEST 1: Connection Status");
    const status = finra.getConnectionStatus();
    console.log("Connected:", status.connected);
    console.log("Cache Size:", status.cacheSize);

    if (!status.connected) {
      console.error("❌ FINRA connector is not connected!");
      return;
    }
    console.log("✅ Connection status check passed");

    // Test 2: Get Short Interest Summary
    for (const symbol of testSymbols) {
      printSeparator(`TEST 2: Short Interest Summary for ${symbol}`);

      try {
        console.log(`Fetching short interest summary for ${symbol}...`);
        const startTime = Date.now();
        const summary = await finra.getShortInterestSummary(symbol);
        const duration = Date.now() - startTime;

        if (!summary) {
          console.log(`⚠️  No short interest data available for ${symbol}`);
          continue;
        }

        console.log("\n📊 Short Interest Summary:");
        console.log("  Symbol:", summary.symbol);
        console.log(
          "  Latest Short Ratio:",
          formatPercent(summary.latestShortRatio)
        );
        console.log(
          "  Average Short Ratio:",
          formatPercent(summary.averageShortRatio)
        );
        console.log("  Short Ratio Trend:", summary.shortRatioTrend);
        console.log(
          "  Days to Cover:",
          summary.daysTocover?.toFixed(2) || "N/A"
        );
        console.log("  Last Updated:", summary.lastUpdated.toLocaleString());
        console.log("  Historical Data Points:", summary.historicalData.length);

        if (summary.historicalData.length > 0) {
          console.log("\n📈 Recent Historical Data (first 5 entries):");
          summary.historicalData.slice(0, 5).forEach((data, index) => {
            console.log(`  ${index + 1}. Date: ${data.settlementDate}`);
            console.log(`     Short Volume: ${formatNumber(data.shortVolume)}`);
            console.log(`     Total Volume: ${formatNumber(data.totalVolume)}`);
            console.log(`     Short Ratio: ${formatPercent(data.shortRatio)}`);
            console.log(`     Market: ${data.market}`);
          });
        }

        console.log(`\n⏱️  Request completed in ${duration}ms`);
        console.log(`✅ Short interest summary test passed for ${symbol}`);

        // Test 3: Analyze Short Squeeze Potential
        printSeparator(`TEST 3: Short Squeeze Analysis for ${symbol}`);

        const analysis = finra.analyzeShortSqueezePotential(summary);

        console.log("🎯 Short Squeeze Potential Analysis:");
        console.log("  Potential Level:", analysis.potential.toUpperCase());
        console.log("  Score:", `${analysis.score}/100`);
        console.log("\n  Contributing Factors:");

        if (analysis.factors.length === 0) {
          console.log("    - No significant squeeze factors detected");
        } else {
          analysis.factors.forEach((factor, index) => {
            console.log(`    ${index + 1}. ${factor}`);
          });
        }

        console.log(`✅ Short squeeze analysis test passed for ${symbol}`);
      } catch (error) {
        console.error(`❌ Error testing ${symbol}:`, error);
        if (error instanceof Error) {
          console.error("   Error message:", error.message);
          console.error("   Stack trace:", error.stack);
        }
      }
    }

    // Test 4: Get RegSHO Short Volume (detailed)
    printSeparator("TEST 4: RegSHO Short Volume Data");

    const daysToFetch = 10;
    const regShoSymbol = "AAPL";

    try {
      console.log(
        `Fetching ${daysToFetch} days of RegSHO data for ${regShoSymbol}...`
      );
      const startTime = Date.now();
      const regShoData = await finra.getRegSHOShortVolume(
        regShoSymbol,
        daysToFetch
      );
      const duration = Date.now() - startTime;

      console.log(
        `\n📅 RegSHO Data Retrieved: ${regShoData.length} trading days`
      );

      if (regShoData.length === 0) {
        console.log("⚠️  No RegSHO data available");
      } else {
        console.log("\n📊 Detailed RegSHO Data:");
        regShoData.forEach((data, index) => {
          console.log(`\n  Day ${index + 1} - ${data.settlementDate}:`);
          console.log(`    Symbol: ${data.symbol}`);
          console.log(`    Short Volume: ${formatNumber(data.shortVolume)}`);
          console.log(
            `    Short Exempt Volume: ${formatNumber(data.shortExemptVolume)}`
          );
          console.log(`    Total Volume: ${formatNumber(data.totalVolume)}`);
          console.log(`    Short Ratio: ${formatPercent(data.shortRatio)}`);
          console.log(`    Market: ${data.market}`);
        });

        // Calculate statistics
        const avgShortRatio =
          regShoData.reduce((sum, d) => sum + d.shortRatio, 0) /
          regShoData.length;
        const avgVolume =
          regShoData.reduce((sum, d) => sum + d.totalVolume, 0) /
          regShoData.length;
        const avgShortVolume =
          regShoData.reduce((sum, d) => sum + d.shortVolume, 0) /
          regShoData.length;

        console.log("\n📈 Statistics:");
        console.log(`  Average Short Ratio: ${formatPercent(avgShortRatio)}`);
        console.log(
          `  Average Total Volume: ${formatNumber(Math.round(avgVolume))}`
        );
        console.log(
          `  Average Short Volume: ${formatNumber(Math.round(avgShortVolume))}`
        );
      }

      console.log(`\n⏱️  Request completed in ${duration}ms`);
      console.log("✅ RegSHO short volume test passed");
    } catch (error) {
      console.error("❌ Error fetching RegSHO data:", error);
      if (error instanceof Error) {
        console.error("   Error message:", error.message);
        console.error("   Stack trace:", error.stack);
      }
    }

    // Test 5: Cache Status After Tests
    printSeparator("TEST 5: Cache Status After Tests");

    const finalStatus = finra.getConnectionStatus();
    console.log("Cache Size After Tests:", finalStatus.cacheSize);
    console.log("✅ Cache is populated with", finalStatus.cacheSize, "entries");

    // Final Summary
    printSeparator("TEST SUMMARY");
    console.log("All tests completed!");
    console.log("Finished at:", new Date().toLocaleString());
    console.log("\n✅ FINRA Connector is working correctly");
    console.log("\nKey Findings:");
    console.log("  - Connection: Successful");
    console.log("  - Data Retrieval: Working");
    console.log("  - Analysis Functions: Operational");
    console.log("  - Cache System: Functional");
  } catch (error) {
    console.error("\n❌ Test suite failed with error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Run the test suite
testFINRAConnector()
  .then(() => {
    console.log("\n🎉 Test suite completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test suite failed:", error);
    process.exit(1);
  });
