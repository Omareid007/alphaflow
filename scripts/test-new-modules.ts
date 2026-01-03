/**
 * Test script for new Alpaca Enhancement modules
 * Tests: StreamAggregator, DynamicExposureController, NewsEnhancedDecisionEngine, ProfitCyclingEngine
 */

import { log } from "../server/utils/logger";

// Test results tracker
const results: {
  module: string;
  test: string;
  status: "pass" | "fail";
  error?: string;
}[] = [];

function recordResult(
  module: string,
  test: string,
  status: "pass" | "fail",
  error?: string
) {
  results.push({ module, test, status, error });
  const icon = status === "pass" ? "✓" : "✗";
  console.log(`  ${icon} ${test}${error ? `: ${error}` : ""}`);
}

async function testStreamAggregator() {
  console.log("\n=== Testing StreamAggregator ===");

  try {
    const { streamAggregator, StreamType } =
      await import("../server/trading/stream-aggregator");
    recordResult("StreamAggregator", "Module imports successfully", "pass");

    // Test configuration
    const status = streamAggregator.getStatus();
    if (status && typeof status.isRunning === "boolean") {
      recordResult(
        "StreamAggregator",
        "getStatus() returns valid structure",
        "pass"
      );
    } else {
      recordResult(
        "StreamAggregator",
        "getStatus() returns valid structure",
        "fail",
        "Invalid status structure"
      );
    }

    // Test subscription
    const subId = streamAggregator.subscribe({
      streamTypes: [StreamType.STOCK_TRADE],
      symbols: ["AAPL"],
      callback: (event) => console.log("Test event received"),
      priority: 1,
    });

    if (subId && typeof subId === "string") {
      recordResult(
        "StreamAggregator",
        "subscribe() returns subscription ID",
        "pass"
      );

      // Test unsubscribe
      const unsubResult = streamAggregator.unsubscribe(subId);
      if (unsubResult) {
        recordResult("StreamAggregator", "unsubscribe() works", "pass");
      } else {
        recordResult("StreamAggregator", "unsubscribe() works", "fail");
      }
    } else {
      recordResult(
        "StreamAggregator",
        "subscribe() returns subscription ID",
        "fail"
      );
    }

    // Test price cache
    const price = streamAggregator.getLatestPrice("AAPL");
    recordResult("StreamAggregator", "getLatestPrice() callable", "pass");

    // Test StreamType enum
    if (StreamType.STOCK_TRADE && StreamType.NEWS && StreamType.TRADE_UPDATE) {
      recordResult(
        "StreamAggregator",
        "StreamType enum has expected values",
        "pass"
      );
    } else {
      recordResult(
        "StreamAggregator",
        "StreamType enum has expected values",
        "fail"
      );
    }
  } catch (error) {
    recordResult("StreamAggregator", "Module test", "fail", String(error));
  }
}

async function testDynamicExposureController() {
  console.log("\n=== Testing DynamicExposureController ===");

  try {
    const { dynamicExposureController } =
      await import("../server/services/dynamic-exposure-controller");
    recordResult(
      "DynamicExposureController",
      "Module imports successfully",
      "pass"
    );

    // Test dynamic max exposure calculation
    const maxExposure = dynamicExposureController.calculateDynamicMaxExposure(
      0.8,
      {
        vix: 20,
        marketTrend: "bullish",
      }
    );

    if (
      typeof maxExposure === "number" &&
      maxExposure > 0 &&
      maxExposure <= 1
    ) {
      recordResult(
        "DynamicExposureController",
        "calculateDynamicMaxExposure() returns valid percentage",
        "pass"
      );
    } else {
      recordResult(
        "DynamicExposureController",
        "calculateDynamicMaxExposure() returns valid percentage",
        "fail",
        `Got: ${maxExposure}`
      );
    }

    // Test position size calculation
    const positionSize = dynamicExposureController.calculateDynamicPositionSize(
      "AAPL",
      150.0,
      0.75,
      100000,
      0.3,
      "enter"
    );

    if (positionSize && typeof positionSize.recommendedQty === "number") {
      recordResult(
        "DynamicExposureController",
        "calculateDynamicPositionSize() returns recommendation",
        "pass"
      );
      console.log(
        `    Recommended qty: ${positionSize.recommendedQty}, reason: ${positionSize.reasoning}`
      );
    } else {
      recordResult(
        "DynamicExposureController",
        "calculateDynamicPositionSize() returns recommendation",
        "fail"
      );
    }

    // Test portfolio heat
    const heat = dynamicExposureController.getPortfolioHeat();
    if (heat && typeof heat.totalExposure === "number") {
      recordResult(
        "DynamicExposureController",
        "getPortfolioHeat() returns metrics",
        "pass"
      );
    } else {
      recordResult(
        "DynamicExposureController",
        "getPortfolioHeat() returns metrics",
        "fail"
      );
    }

    // Test take profit conditions check
    const tpCandidates = dynamicExposureController.checkTakeProfitConditions();
    if (Array.isArray(tpCandidates)) {
      recordResult(
        "DynamicExposureController",
        "checkTakeProfitConditions() returns array",
        "pass"
      );
    } else {
      recordResult(
        "DynamicExposureController",
        "checkTakeProfitConditions() returns array",
        "fail"
      );
    }
  } catch (error) {
    recordResult(
      "DynamicExposureController",
      "Module test",
      "fail",
      String(error)
    );
  }
}

async function testNewsEnhancedDecisionEngine() {
  console.log("\n=== Testing NewsEnhancedDecisionEngine ===");

  try {
    const { newsEnhancedDecisionEngine, DecisionType, SignalStrength } =
      await import("../server/ai/news-enhanced-decision-engine");
    recordResult(
      "NewsEnhancedDecisionEngine",
      "Module imports successfully",
      "pass"
    );

    // Test sentiment analysis
    const sentiment = newsEnhancedDecisionEngine.analyzeSentiment(
      "Apple stock surges on strong iPhone sales",
      "The tech giant reported better than expected quarterly results",
      "test-news-1",
      "test",
      ["AAPL"]
    );

    if (sentiment && typeof sentiment.combinedScore === "number") {
      recordResult(
        "NewsEnhancedDecisionEngine",
        "analyzeSentiment() returns sentiment score",
        "pass"
      );
      console.log(
        `    Sentiment: ${sentiment.combinedScore.toFixed(2)}, confidence: ${sentiment.confidence.toFixed(2)}`
      );
    } else {
      recordResult(
        "NewsEnhancedDecisionEngine",
        "analyzeSentiment() returns sentiment score",
        "fail"
      );
    }

    // Test updating sentiment
    newsEnhancedDecisionEngine.updateSentiment("AAPL", sentiment);
    recordResult(
      "NewsEnhancedDecisionEngine",
      "updateSentiment() callable",
      "pass"
    );

    // Test aggregate sentiment
    const aggregate = newsEnhancedDecisionEngine.getAggregateSentiment("AAPL");
    if (aggregate && typeof aggregate.score === "number") {
      recordResult(
        "NewsEnhancedDecisionEngine",
        "getAggregateSentiment() returns aggregate",
        "pass"
      );
      console.log(
        `    Aggregate score: ${aggregate.score.toFixed(2)}, momentum: ${aggregate.momentum.toFixed(2)}`
      );
    } else {
      recordResult(
        "NewsEnhancedDecisionEngine",
        "getAggregateSentiment() returns aggregate",
        "fail"
      );
    }

    // Test decision making
    const decision = newsEnhancedDecisionEngine.makeDecision(
      "AAPL",
      150.0,
      undefined,
      {}
    );
    if (decision && decision.decisionType) {
      recordResult(
        "NewsEnhancedDecisionEngine",
        "makeDecision() returns decision",
        "pass"
      );
      console.log(
        `    Decision: ${decision.decisionType}, confidence: ${decision.confidence.toFixed(2)}`
      );
    } else {
      recordResult(
        "NewsEnhancedDecisionEngine",
        "makeDecision() returns decision",
        "fail"
      );
    }

    // Test DecisionType enum
    if (
      DecisionType.ENTER_LONG &&
      DecisionType.TAKE_PROFIT &&
      DecisionType.HOLD
    ) {
      recordResult(
        "NewsEnhancedDecisionEngine",
        "DecisionType enum has expected values",
        "pass"
      );
    } else {
      recordResult(
        "NewsEnhancedDecisionEngine",
        "DecisionType enum has expected values",
        "fail"
      );
    }

    // Test SignalStrength enum
    if (SignalStrength.STRONG_BUY === 2 && SignalStrength.STRONG_SELL === -2) {
      recordResult(
        "NewsEnhancedDecisionEngine",
        "SignalStrength enum has correct values",
        "pass"
      );
    } else {
      recordResult(
        "NewsEnhancedDecisionEngine",
        "SignalStrength enum has correct values",
        "fail"
      );
    }

    // Test status
    const status = newsEnhancedDecisionEngine.getStatus();
    if (status && typeof status.symbolsTracked === "number") {
      recordResult(
        "NewsEnhancedDecisionEngine",
        "getStatus() returns valid status",
        "pass"
      );
    } else {
      recordResult(
        "NewsEnhancedDecisionEngine",
        "getStatus() returns valid status",
        "fail"
      );
    }
  } catch (error) {
    recordResult(
      "NewsEnhancedDecisionEngine",
      "Module test",
      "fail",
      String(error)
    );
  }
}

async function testProfitCyclingEngine() {
  console.log("\n=== Testing ProfitCyclingEngine ===");

  try {
    const { profitCyclingEngine } =
      await import("../server/autonomous/profit-cycling-engine");
    recordResult("ProfitCyclingEngine", "Module imports successfully", "pass");

    // Test status
    const status = profitCyclingEngine.getStatus();
    if (status && typeof status.isRunning === "boolean") {
      recordResult(
        "ProfitCyclingEngine",
        "getStatus() returns valid status",
        "pass"
      );
      console.log(
        `    Running: ${status.isRunning}, reinvestment queue size: ${status.reinvestmentQueueSize}`
      );
    } else {
      recordResult(
        "ProfitCyclingEngine",
        "getStatus() returns valid status",
        "fail"
      );
    }

    // Test config update
    profitCyclingEngine.updateConfig({ profitChaseThresholdPct: 0.04 });
    recordResult("ProfitCyclingEngine", "updateConfig() callable", "pass");

    // Verify config was updated
    const newStatus = profitCyclingEngine.getStatus();
    if (newStatus.config && newStatus.config.profitChaseThresholdPct === 0.04) {
      recordResult("ProfitCyclingEngine", "Config update persists", "pass");
    } else {
      recordResult("ProfitCyclingEngine", "Config update persists", "fail");
    }

    // Reset config
    profitCyclingEngine.updateConfig({ profitChaseThresholdPct: 0.03 });

    // Test reinvestment queue (should be empty initially)
    if (typeof status.reinvestmentQueueSize === "number") {
      recordResult(
        "ProfitCyclingEngine",
        "Reinvestment queue tracking works",
        "pass"
      );
    } else {
      recordResult(
        "ProfitCyclingEngine",
        "Reinvestment queue tracking works",
        "fail"
      );
    }
  } catch (error) {
    recordResult("ProfitCyclingEngine", "Module test", "fail", String(error));
  }
}

async function runAllTests() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     ALPACA ENHANCEMENT MODULES - TEST SUITE                ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  await testStreamAggregator();
  await testDynamicExposureController();
  await testNewsEnhancedDecisionEngine();
  await testProfitCyclingEngine();

  // Summary
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗"
  );
  console.log("║                      TEST SUMMARY                          ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;

  console.log(`\nTotal: ${results.length} tests`);
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ✗`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results
      .filter((r) => r.status === "fail")
      .forEach((r) => {
        console.log(
          `  - [${r.module}] ${r.test}: ${r.error || "Unknown error"}`
        );
      });
  }

  console.log(
    "\n" + (failed === 0 ? "🎉 All tests passed!" : "⚠️  Some tests failed")
  );

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch((err) => {
  console.error("Test suite error:", err);
  process.exit(1);
});
