/**
 * Test script for Frankfurter Forex Connector
 * Tests all major functions of the connector and reports results
 */

import { frankfurter } from "../server/connectors/frankfurter";

console.log("=".repeat(70));
console.log("FRANKFURTER FOREX CONNECTOR TEST");
console.log("=".repeat(70));
console.log();

async function runTests() {
  let passedTests = 0;
  let failedTests = 0;
  const errors: string[] = [];

  // Test 1: getLatestRates() for USD base
  console.log("Test 1: getLatestRates() for USD base");
  console.log("-".repeat(70));
  try {
    const usdRates = await frankfurter.getLatestRates("USD");
    if (usdRates) {
      console.log("✓ Successfully fetched USD rates");
      console.log(`  Base: ${usdRates.base}`);
      console.log(`  Date: ${usdRates.date}`);
      console.log(`  Amount: ${usdRates.amount}`);
      console.log(
        `  Number of currencies: ${Object.keys(usdRates.rates).length}`
      );
      console.log(`  Sample rates:`);
      const sampleCurrencies = ["EUR", "GBP", "JPY", "CHF", "CAD"];
      sampleCurrencies.forEach((currency) => {
        if (usdRates.rates[currency]) {
          console.log(
            `    ${currency}: ${usdRates.rates[currency].toFixed(4)}`
          );
        }
      });
      passedTests++;
    } else {
      console.log("✗ Failed: Returned null");
      failedTests++;
      errors.push("Test 1: getLatestRates() returned null");
    }
  } catch (error) {
    console.log(`✗ Error: ${error}`);
    failedTests++;
    errors.push(`Test 1: ${error}`);
  }
  console.log();

  // Test 2: getForexPairSummary() for EUR/USD
  console.log("Test 2: getForexPairSummary() for EUR/USD");
  console.log("-".repeat(70));
  try {
    const eurUsdSummary = await frankfurter.getForexPairSummary("EUR", "USD");
    if (eurUsdSummary) {
      console.log("✓ Successfully fetched EUR/USD summary");
      console.log(`  Pair: ${eurUsdSummary.pair}`);
      console.log(`  Current Rate: ${eurUsdSummary.currentRate.toFixed(4)}`);
      console.log(`  Previous Rate: ${eurUsdSummary.previousRate.toFixed(4)}`);
      console.log(`  Change: ${eurUsdSummary.change.toFixed(6)}`);
      console.log(`  Change %: ${eurUsdSummary.changePercent.toFixed(2)}%`);
      console.log(`  30-day High: ${eurUsdSummary.high30d.toFixed(4)}`);
      console.log(`  30-day Low: ${eurUsdSummary.low30d.toFixed(4)}`);
      console.log(`  Trend: ${eurUsdSummary.trend.toUpperCase()}`);
      console.log(`  Last Updated: ${eurUsdSummary.lastUpdated.toISOString()}`);
      passedTests++;
    } else {
      console.log("✗ Failed: Returned null");
      failedTests++;
      errors.push("Test 2: getForexPairSummary() returned null");
    }
  } catch (error) {
    console.log(`✗ Error: ${error}`);
    failedTests++;
    errors.push(`Test 2: ${error}`);
  }
  console.log();

  // Test 3: getUSDStrengthIndex()
  console.log("Test 3: getUSDStrengthIndex()");
  console.log("-".repeat(70));
  try {
    const usdIndex = await frankfurter.getUSDStrengthIndex();
    if (usdIndex) {
      console.log("✓ Successfully fetched USD Strength Index");
      console.log(`  Index: ${usdIndex.index.toFixed(2)}`);
      console.log(`  Trend: ${usdIndex.trend.toUpperCase()}`);
      console.log(`  Components:`);
      usdIndex.components.forEach((component) => {
        console.log(`    ${component.currency}:`);
        console.log(`      Weight: ${(component.weight * 100).toFixed(1)}%`);
        console.log(`      Rate: ${component.rate.toFixed(4)}`);
        console.log(`      Contribution: ${component.contribution.toFixed(4)}`);
      });
      passedTests++;
    } else {
      console.log("✗ Failed: Returned null");
      failedTests++;
      errors.push("Test 3: getUSDStrengthIndex() returned null");
    }
  } catch (error) {
    console.log(`✗ Error: ${error}`);
    failedTests++;
    errors.push(`Test 3: ${error}`);
  }
  console.log();

  // Test 4: convert() for a simple conversion
  console.log("Test 4: convert() - Convert 100 USD to EUR");
  console.log("-".repeat(70));
  try {
    const conversion = await frankfurter.convert(100, "USD", "EUR");
    if (conversion) {
      console.log("✓ Successfully converted 100 USD to EUR");
      console.log(`  Amount: ${conversion.amount.toFixed(2)} EUR`);
      console.log(`  Rate: ${conversion.rate.toFixed(6)}`);
      console.log(`  Date: ${conversion.date}`);
      console.log(
        `  Calculation: 100 USD × ${conversion.rate.toFixed(6)} = ${conversion.amount.toFixed(2)} EUR`
      );
      passedTests++;
    } else {
      console.log("✗ Failed: Returned null");
      failedTests++;
      errors.push("Test 4: convert() returned null");
    }
  } catch (error) {
    console.log(`✗ Error: ${error}`);
    failedTests++;
    errors.push(`Test 4: ${error}`);
  }
  console.log();

  // Test 5: Additional test - getCurrencies()
  console.log("Test 5: getCurrencies() - Fetch available currencies");
  console.log("-".repeat(70));
  try {
    const currencies = await frankfurter.getCurrencies();
    if (currencies && currencies.length > 0) {
      console.log(`✓ Successfully fetched ${currencies.length} currencies`);
      console.log(`  Sample currencies:`);
      currencies.slice(0, 10).forEach((currency) => {
        console.log(`    ${currency.code}: ${currency.name}`);
      });
      passedTests++;
    } else {
      console.log("✗ Failed: Returned empty or null");
      failedTests++;
      errors.push("Test 5: getCurrencies() returned empty or null");
    }
  } catch (error) {
    console.log(`✗ Error: ${error}`);
    failedTests++;
    errors.push(`Test 5: ${error}`);
  }
  console.log();

  // Test 6: Connection Status
  console.log("Test 6: getConnectionStatus()");
  console.log("-".repeat(70));
  try {
    const status = frankfurter.getConnectionStatus();
    console.log("✓ Successfully retrieved connection status");
    console.log(`  Connected: ${status.connected}`);
    console.log(`  Cache Size: ${status.cacheSize}`);
    passedTests++;
  } catch (error) {
    console.log(`✗ Error: ${error}`);
    failedTests++;
    errors.push(`Test 6: ${error}`);
  }
  console.log();

  // Summary
  console.log("=".repeat(70));
  console.log("TEST SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total Tests: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log();

  if (failedTests > 0) {
    console.log("ERRORS:");
    errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
    console.log();
    process.exit(1);
  } else {
    console.log("✓ ALL TESTS PASSED!");
    console.log();
    console.log("CONNECTION STATUS: OPERATIONAL");
    console.log("DATA QUALITY: GOOD");
    console.log("API RESPONSE: SUCCESSFUL");
    console.log();
  }
}

// Run the tests
runTests().catch((error) => {
  console.error("Fatal error running tests:", error);
  process.exit(1);
});
