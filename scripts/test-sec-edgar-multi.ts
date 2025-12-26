/**
 * Test script for SEC EDGAR connector - Multiple Stocks
 * Tests insider trading data with multiple different stocks
 */

import { secEdgarConnector } from '../server/connectors/sec-edgar';

const TEST_TICKERS = ['AAPL', 'TSLA', 'NVDA'];

async function testStock(ticker: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`Testing ${ticker}`);
  console.log('='.repeat(80));

  try {
    // Get CIK
    const cik = await secEdgarConnector.getCIKByTicker(ticker);
    console.log(`CIK: ${cik || 'NOT FOUND'}`);

    if (!cik) {
      console.log(`✗ Could not find CIK for ${ticker}`);
      return false;
    }

    // Get company info
    const info = await secEdgarConnector.getCompanyInfo(ticker);
    if (info) {
      console.log(`Company: ${info.name}`);
      console.log(`Industry: ${info.sicDescription}`);
    }

    // Get insider summary
    const summary = await secEdgarConnector.getInsiderSummary(ticker, 90);
    if (summary) {
      console.log('\nInsider Activity (Last 90 days):');
      console.log(`  Buys: ${summary.totalInsiderBuys.toLocaleString()} shares`);
      console.log(`  Sells: ${summary.totalInsiderSells.toLocaleString()} shares`);
      console.log(`  Net Value: $${summary.netInsiderValue.toLocaleString()}`);
      console.log(`  Sentiment: ${summary.sentiment.toUpperCase()}`);
      console.log(`  Recent Transactions: ${summary.recentTransactions.length}`);

      if (summary.recentTransactions.length > 0) {
        console.log('\nMost Recent Transaction:');
        const latest = summary.recentTransactions[0];
        console.log(`  ${latest.reportingOwner} (${latest.relationship})`);
        console.log(`  ${latest.transactionType === 'P' ? 'BOUGHT' : latest.transactionType === 'S' ? 'SOLD' : latest.transactionType}`);
        console.log(`  ${latest.sharesTransacted.toLocaleString()} shares @ ${latest.pricePerShare ? '$' + latest.pricePerShare.toFixed(2) : 'N/A'}`);
        console.log(`  Date: ${latest.transactionDate.toISOString().split('T')[0]}`);
      }
    } else {
      console.log('✗ Could not fetch insider summary');
      return false;
    }

    // Get fundamentals
    const fundamentals = await secEdgarConnector.getCompanyFacts(ticker);
    if (fundamentals) {
      console.log('\nFundamentals:');
      console.log(`  Revenue: ${fundamentals.revenue ? '$' + (fundamentals.revenue / 1e9).toFixed(2) + 'B' : 'N/A'}`);
      console.log(`  Net Income: ${fundamentals.netIncome ? '$' + (fundamentals.netIncome / 1e9).toFixed(2) + 'B' : 'N/A'}`);
      console.log(`  Total Assets: ${fundamentals.totalAssets ? '$' + (fundamentals.totalAssets / 1e9).toFixed(2) + 'B' : 'N/A'}`);
    }

    return true;
  } catch (error) {
    console.error(`✗ Error testing ${ticker}:`, error);
    return false;
  }
}

async function main() {
  console.log('SEC EDGAR CONNECTOR - MULTI-STOCK TEST');
  console.log('Testing with tickers:', TEST_TICKERS.join(', '));

  const results: { ticker: string; passed: boolean }[] = [];

  for (const ticker of TEST_TICKERS) {
    const passed = await testStock(ticker);
    results.push({ ticker, passed });
  }

  console.log('\n' + '='.repeat(80));
  console.log('FINAL RESULTS');
  console.log('='.repeat(80));

  results.forEach(({ ticker, passed }) => {
    console.log(`${ticker}: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
  });

  const allPassed = results.every(r => r.passed);
  console.log(`\nOverall: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
