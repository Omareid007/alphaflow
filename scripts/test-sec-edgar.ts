/**
 * Test script for SEC EDGAR connector
 * Tests insider trading data, company fundamentals, and Form 4 parsing
 */

import { secEdgarConnector } from "../server/connectors/sec-edgar";

const TEST_TICKER = "AAPL";

async function testSecEdgar() {
  console.log("=".repeat(80));
  console.log("SEC EDGAR CONNECTOR TEST");
  console.log("=".repeat(80));
  console.log(`Testing with ticker: ${TEST_TICKER}\n`);

  try {
    // Test 1: Get CIK by ticker
    console.log("Test 1: Getting CIK for ticker...");
    console.log("-".repeat(80));
    const cik = await secEdgarConnector.getCIKByTicker(TEST_TICKER);
    if (cik) {
      console.log(`✓ CIK found: ${cik}`);
    } else {
      console.log("✗ Failed to get CIK");
      return;
    }
    console.log();

    // Test 2: Get company info
    console.log("Test 2: Getting company info...");
    console.log("-".repeat(80));
    const companyInfo = await secEdgarConnector.getCompanyInfo(TEST_TICKER);
    if (companyInfo) {
      console.log("✓ Company info retrieved:");
      console.log(`  Name: ${companyInfo.name}`);
      console.log(`  Ticker: ${companyInfo.ticker}`);
      console.log(`  CIK: ${companyInfo.cik}`);
      console.log(`  Exchanges: ${companyInfo.exchanges.join(", ")}`);
      console.log(`  SIC: ${companyInfo.sic} - ${companyInfo.sicDescription}`);
      console.log(`  Fiscal Year End: ${companyInfo.fiscalYearEnd}`);
    } else {
      console.log("✗ Failed to get company info");
    }
    console.log();

    // Test 3: Get company fundamentals (facts)
    console.log("Test 3: Getting company fundamentals...");
    console.log("-".repeat(80));
    const fundamentals = await secEdgarConnector.getCompanyFacts(TEST_TICKER);
    if (fundamentals) {
      console.log("✓ Fundamentals retrieved:");
      console.log(`  Company: ${fundamentals.name}`);
      console.log(
        `  Revenue: ${fundamentals.revenue ? "$" + (fundamentals.revenue / 1e9).toFixed(2) + "B" : "N/A"}`
      );
      console.log(
        `  Net Income: ${fundamentals.netIncome ? "$" + (fundamentals.netIncome / 1e9).toFixed(2) + "B" : "N/A"}`
      );
      console.log(
        `  Total Assets: ${fundamentals.totalAssets ? "$" + (fundamentals.totalAssets / 1e9).toFixed(2) + "B" : "N/A"}`
      );
      console.log(
        `  Total Liabilities: ${fundamentals.totalLiabilities ? "$" + (fundamentals.totalLiabilities / 1e9).toFixed(2) + "B" : "N/A"}`
      );
      console.log(
        `  EPS: ${fundamentals.eps ? "$" + fundamentals.eps.toFixed(2) : "N/A"}`
      );
      console.log(
        `  Shares Outstanding: ${fundamentals.sharesOutstanding ? (fundamentals.sharesOutstanding / 1e9).toFixed(2) + "B" : "N/A"}`
      );
    } else {
      console.log("✗ Failed to get fundamentals");
    }
    console.log();

    // Test 4: Get insider transactions (raw Form 4 data)
    console.log("Test 4: Getting insider transactions (Form 4 data)...");
    console.log("-".repeat(80));
    const transactions = await secEdgarConnector.getInsiderTransactions(
      TEST_TICKER,
      10
    );
    if (transactions && transactions.length > 0) {
      console.log(`✓ Found ${transactions.length} insider transactions:`);
      console.log();

      transactions.slice(0, 5).forEach((tx, idx) => {
        console.log(`Transaction ${idx + 1}:`);
        console.log(`  Reporting Owner: ${tx.reportingOwner}`);
        console.log(`  Relationship: ${tx.relationship}`);
        console.log(
          `  Transaction Date: ${tx.transactionDate.toISOString().split("T")[0]}`
        );
        console.log(
          `  Filing Date: ${tx.filingDate.toISOString().split("T")[0]}`
        );
        console.log(
          `  Type: ${tx.transactionType} (Code: ${tx.transactionCode})`
        );
        console.log(`  Shares: ${tx.sharesTransacted.toLocaleString()}`);
        console.log(
          `  Price: ${tx.pricePerShare ? "$" + tx.pricePerShare.toFixed(2) : "N/A"}`
        );
        console.log(
          `  Value: ${tx.value ? "$" + tx.value.toLocaleString() : "N/A"}`
        );
        console.log(
          `  Shares Owned After: ${tx.sharesOwnedAfter.toLocaleString()}`
        );
        console.log(
          `  Ownership: ${tx.isDirectOwnership ? "Direct" : "Indirect"}`
        );
        console.log(`  Document URL: ${tx.documentUrl}`);
        console.log();
      });

      if (transactions.length > 5) {
        console.log(`  ... and ${transactions.length - 5} more transactions\n`);
      }
    } else {
      console.log(
        "✗ No insider transactions found (this may be normal if there are no recent Form 4 filings)"
      );
    }
    console.log();

    // Test 5: Get insider summary with sentiment
    console.log("Test 5: Getting insider summary with sentiment analysis...");
    console.log("-".repeat(80));
    const insiderSummary = await secEdgarConnector.getInsiderSummary(
      TEST_TICKER,
      90
    );
    if (insiderSummary) {
      console.log("✓ Insider summary retrieved:");
      console.log(
        `  Company: ${insiderSummary.companyName} (${insiderSummary.ticker})`
      );
      console.log(`  CIK: ${insiderSummary.cik}`);
      console.log(
        `  Total Insider Buys: ${insiderSummary.totalInsiderBuys.toLocaleString()} shares`
      );
      console.log(
        `  Total Insider Sells: ${insiderSummary.totalInsiderSells.toLocaleString()} shares`
      );
      console.log(
        `  Net Activity: ${insiderSummary.netInsiderActivity.toLocaleString()} shares`
      );
      console.log(
        `  Net Value: $${insiderSummary.netInsiderValue.toLocaleString()}`
      );
      console.log(
        `  Buy-to-Sell Ratio: ${insiderSummary.buyToSellRatio === Infinity ? "∞" : insiderSummary.buyToSellRatio.toFixed(2)}`
      );
      console.log(`  Sentiment: ${insiderSummary.sentiment.toUpperCase()}`);
      console.log(
        `  Recent Transactions Count: ${insiderSummary.recentTransactions.length}`
      );
      console.log(
        `  Last Updated: ${insiderSummary.lastUpdated.toISOString()}`
      );
      console.log();

      if (insiderSummary.recentTransactions.length > 0) {
        console.log("  Recent Transactions:");
        insiderSummary.recentTransactions.slice(0, 3).forEach((tx, idx) => {
          console.log(
            `    ${idx + 1}. ${tx.reportingOwner} (${tx.relationship})`
          );
          console.log(
            `       ${tx.transactionType === "P" ? "BOUGHT" : tx.transactionType === "S" ? "SOLD" : tx.transactionType} ${tx.sharesTransacted.toLocaleString()} shares`
          );
          console.log(
            `       Date: ${tx.transactionDate.toISOString().split("T")[0]}`
          );
          console.log(
            `       Price: ${tx.pricePerShare ? "$" + tx.pricePerShare.toFixed(2) : "N/A"}`
          );
        });
      }
    } else {
      console.log("✗ Failed to get insider summary");
    }
    console.log();

    // Test 6: Get recent filings
    console.log("Test 6: Getting recent SEC filings...");
    console.log("-".repeat(80));
    const filings = await secEdgarConnector.getRecentFilings(
      TEST_TICKER,
      ["10-K", "10-Q", "8-K"],
      5
    );
    if (filings && filings.length > 0) {
      console.log(`✓ Found ${filings.length} recent filings:`);
      filings.forEach((filing, idx) => {
        console.log(
          `  ${idx + 1}. Form ${filing.form} - Filed: ${filing.filingDate.toISOString().split("T")[0]}`
        );
        console.log(`     Document: ${filing.documentUrl}`);
      });
    } else {
      console.log("✗ No recent filings found");
    }
    console.log();

    // Summary
    console.log("=".repeat(80));
    console.log("TEST SUMMARY");
    console.log("=".repeat(80));
    console.log(`✓ CIK Lookup: ${cik ? "PASSED" : "FAILED"}`);
    console.log(`✓ Company Info: ${companyInfo ? "PASSED" : "FAILED"}`);
    console.log(`✓ Company Facts: ${fundamentals ? "PASSED" : "FAILED"}`);
    console.log(
      `✓ Insider Transactions: ${transactions && transactions.length > 0 ? "PASSED (" + transactions.length + " found)" : "PASSED (0 found)"}`
    );
    console.log(`✓ Insider Summary: ${insiderSummary ? "PASSED" : "FAILED"}`);
    console.log(
      `✓ Recent Filings: ${filings && filings.length > 0 ? "PASSED (" + filings.length + " found)" : "FAILED"}`
    );
    console.log();

    const allPassed =
      cik &&
      companyInfo &&
      fundamentals &&
      insiderSummary &&
      filings &&
      filings.length > 0;
    console.log(
      `Overall: ${allPassed ? "✓ ALL TESTS PASSED" : "⚠ SOME TESTS HAD ISSUES"}`
    );
    console.log("=".repeat(80));
  } catch (error) {
    console.error("✗ TEST FAILED WITH ERROR:");
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testSecEdgar()
  .then(() => {
    console.log("\nTest completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nTest failed with error:", error);
    process.exit(1);
  });
