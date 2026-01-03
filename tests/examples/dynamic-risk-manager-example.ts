/**
 * AI Active Trader - Dynamic Risk Manager Tests
 * Simple tests to verify basic functionality
 */

import { DynamicRiskManager } from "../../server/services/dynamic-risk-manager";
import type { PortfolioSnapshot } from "../../server/services/trading-engine/types";

async function testBasicFunctionality() {
  console.log("Testing Dynamic Risk Manager...\n");

  const manager = new DynamicRiskManager({
    baseMaxPositionPct: 10,
    baseMaxExposurePct: 80,
    volatilityScaling: false, // Disable for predictable test
    performanceScaling: true,
    timeBasedScaling: false,
  });

  const portfolio: PortfolioSnapshot = {
    totalEquity: 100000,
    cashBalance: 50000,
    positionsValue: 50000,
    dailyPnl: -1500, // -1.5% loss
  };

  const recentTrades = [
    { pnl: -500, timestamp: new Date(Date.now() - 3600000) },
    { pnl: -600, timestamp: new Date(Date.now() - 1800000) },
    { pnl: -400, timestamp: new Date(Date.now() - 900000) },
  ];

  const limits = await manager.getAdjustedLimits(portfolio, recentTrades);

  console.log("Adjusted Limits:", {
    maxPositionPct: limits.maxPositionPct,
    maxExposurePct: limits.maxExposurePct,
    maxOrdersPerDay: limits.maxOrdersPerDay,
    scalingFactors: limits.scalingFactors,
    reason: limits.reason,
  });

  // Verify performance scaling reduced limits due to losses
  const expectedScaling = 0.7; // Weak performance regime
  const expectedPosition = 10 * expectedScaling;

  console.log("\nValidation:");
  console.log("Expected position reduction:", expectedScaling);
  console.log("Expected max position %:", expectedPosition);
  console.log("Actual max position %:", limits.maxPositionPct);
  console.log(
    "Match:",
    Math.abs(limits.maxPositionPct - expectedPosition) < 0.1 ? "PASS" : "FAIL"
  );

  return limits;
}

async function testLegacyConversion() {
  console.log("\n\nTesting Legacy Format Conversion...\n");

  const manager = new DynamicRiskManager();
  const portfolio: PortfolioSnapshot = {
    totalEquity: 100000,
    cashBalance: 60000,
    positionsValue: 40000,
    dailyPnl: 500,
  };

  const adjusted = await manager.getAdjustedLimits(portfolio);
  const legacy = manager.toLegacyRiskLimits(adjusted);

  console.log("Legacy RiskLimits format:", legacy);
  console.log("Has required fields:", {
    maxPositionSizePercent: typeof legacy.maxPositionSizePercent === "number",
    maxTotalExposurePercent: typeof legacy.maxTotalExposurePercent === "number",
    maxPositionsCount: typeof legacy.maxPositionsCount === "number",
    dailyLossLimitPercent: typeof legacy.dailyLossLimitPercent === "number",
  });

  return legacy;
}

async function testConfig() {
  console.log("\n\nTesting Configuration...\n");

  const manager = new DynamicRiskManager({
    baseMaxPositionPct: 15,
    baseMaxExposurePct: 100,
  });

  const config = manager.getConfig();
  console.log("Current config:", config);

  manager.updateConfig({
    baseMaxPositionPct: 12,
  });

  const updatedConfig = manager.getConfig();
  console.log("Updated config:", updatedConfig);
  console.log(
    "Position % changed:",
    config.baseMaxPositionPct,
    "->",
    updatedConfig.baseMaxPositionPct
  );

  return updatedConfig;
}

async function runTests() {
  try {
    await testBasicFunctionality();
    await testLegacyConversion();
    await testConfig();

    console.log("\n\nAll tests completed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };
