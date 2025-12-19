/**
 * AI Active Trader - Dynamic Risk Manager Usage Examples
 *
 * This file demonstrates how to use the DynamicRiskManager for adaptive risk controls.
 * DO NOT import this file into production code - it's for reference only.
 */

import {
  DynamicRiskManager,
  dynamicRiskManager,
  createConservativeDynamicRisk,
  createModerateDynamicRisk,
  createAggressiveDynamicRisk,
  type DynamicRiskConfig,
  type AdjustedRiskLimits,
} from './dynamic-risk-manager';
import type { PortfolioSnapshot } from '../../services/trading-engine/types';

/**
 * Example 1: Using the singleton instance (recommended for most cases)
 */
async function example1_SingletonUsage() {
  const portfolio: PortfolioSnapshot = {
    totalEquity: 100000,
    cashBalance: 50000,
    positionsValue: 50000,
    dailyPnl: -500, // Down $500 today
  };

  // Recent trades for performance-based scaling
  const recentTrades = [
    { pnl: -200, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    { pnl: -150, timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) },
    { pnl: -150, timestamp: new Date(Date.now() - 30 * 60 * 1000) },
  ];

  // Get adjusted limits based on current conditions
  const adjustedLimits = await dynamicRiskManager.getAdjustedLimits(
    portfolio,
    recentTrades
  );

  console.log('Adjusted Risk Limits:', {
    maxPositionPct: adjustedLimits.maxPositionPct,
    maxExposurePct: adjustedLimits.maxExposurePct,
    maxOrdersPerDay: adjustedLimits.maxOrdersPerDay,
    scalingFactors: adjustedLimits.scalingFactors,
    reason: adjustedLimits.reason,
  });

  // Example output:
  // {
  //   maxPositionPct: 5.6,  // Reduced from base 10% due to:
  //   maxExposurePct: 44.8, // - VIX scaling (0.8x)
  //   maxOrdersPerDay: 28,  // - Performance scaling (0.7x)
  //   scalingFactors: {     // - Time scaling (1.0x)
  //     volatility: 0.8,
  //     performance: 0.7,
  //     time: 1.0,
  //     concentration: 1.0
  //   },
  //   reason: "VIX 18.5 - elevated volatility, -20%; Weak performance (-0.5%), -30%; Normal market hours"
  // }
}

/**
 * Example 2: Check if new positions should be allowed
 */
async function example2_EmergencyModeCheck() {
  const positionCheck = await dynamicRiskManager.shouldAllowNewPositions();

  if (!positionCheck.allowed) {
    console.log('EMERGENCY MODE:', positionCheck.reason);
    // Example: "VIX at 37.2 - EMERGENCY MODE: Close-only"
    return; // Don't open new positions
  }

  console.log('New positions allowed:', positionCheck.reason);
}

/**
 * Example 3: Using different risk profiles
 */
async function example3_RiskProfiles() {
  // Conservative profile (5% position, 50% exposure)
  const conservative = createConservativeDynamicRisk();

  // Moderate profile (10% position, 80% exposure) - DEFAULT
  const moderate = createModerateDynamicRisk();

  // Aggressive profile (15% position, 100% exposure, less scaling)
  const aggressive = createAggressiveDynamicRisk();

  const portfolio: PortfolioSnapshot = {
    totalEquity: 100000,
    cashBalance: 60000,
    positionsValue: 40000,
    dailyPnl: 1000,
  };

  const conservativeLimits = await conservative.getAdjustedLimits(portfolio);
  const moderateLimits = await moderate.getAdjustedLimits(portfolio);
  const aggressiveLimits = await aggressive.getAdjustedLimits(portfolio);

  console.log('Risk Profile Comparison:');
  console.log('Conservative:', conservativeLimits.maxPositionPct, '%');
  console.log('Moderate:', moderateLimits.maxPositionPct, '%');
  console.log('Aggressive:', aggressiveLimits.maxPositionPct, '%');
}

/**
 * Example 4: Custom configuration
 */
async function example4_CustomConfig() {
  const customManager = new DynamicRiskManager({
    baseMaxPositionPct: 12, // 12% base position size
    baseMaxExposurePct: 90, // 90% base exposure
    volatilityScaling: true, // Enable VIX-based scaling
    performanceScaling: true, // Enable P&L-based scaling
    timeBasedScaling: false, // Disable time-based scaling (trade anytime)
  });

  const portfolio: PortfolioSnapshot = {
    totalEquity: 250000,
    cashBalance: 100000,
    positionsValue: 150000,
    dailyPnl: 2500,
  };

  const limits = await customManager.getAdjustedLimits(portfolio);
  console.log('Custom config limits:', limits);
}

/**
 * Example 5: Integration with RiskManager
 */
async function example5_IntegrationWithRiskManager() {
  // In your trading engine code:
  // import { RiskManager } from '../../services/trading-engine/risk-manager';

  // Create risk manager with dynamic limits enabled
  // const riskManager = new RiskManager(undefined, true); // true = enable dynamic

  // Or enable dynamically:
  // riskManager.setDynamicLimits(true);

  // Check risk with dynamic adjustments
  // const riskCheck = await riskManager.checkPreTradeRisk(orderRequest, undefined, recentTrades);

  console.log('See RiskManager integration in services/trading-engine/risk-manager.ts');
}

/**
 * Example 6: Get diagnostics and current state
 */
async function example6_Diagnostics() {
  const diagnostics = await dynamicRiskManager.getDiagnostics();

  console.log('Dynamic Risk Manager Diagnostics:', {
    currentVIX: diagnostics.vix,
    vixDataAge: diagnostics.vixAge ? `${(diagnostics.vixAge / 1000 / 60).toFixed(1)} minutes` : 'N/A',
    volatilityRegime: diagnostics.volatilityRegime,
    config: diagnostics.config,
  });

  // Example output:
  // {
  //   currentVIX: 16.8,
  //   vixDataAge: "2.3 minutes",
  //   volatilityRegime: "elevated",
  //   config: {
  //     baseMaxPositionPct: 10,
  //     baseMaxExposurePct: 80,
  //     volatilityScaling: true,
  //     performanceScaling: true,
  //     timeBasedScaling: true
  //   }
  // }
}

/**
 * Example 7: Force refresh VIX data
 */
async function example7_RefreshVIX() {
  // Force a fresh VIX fetch (bypasses cache)
  const vix = await dynamicRiskManager.refreshVIX();

  console.log('Fresh VIX value:', vix);
}

/**
 * Example 8: Update configuration at runtime
 */
async function example8_UpdateConfig() {
  // Temporarily disable time-based scaling
  dynamicRiskManager.updateConfig({
    timeBasedScaling: false,
  });

  // Or switch to more aggressive base limits
  dynamicRiskManager.updateConfig({
    baseMaxPositionPct: 15,
    baseMaxExposurePct: 100,
  });

  const currentConfig = dynamicRiskManager.getConfig();
  console.log('Updated config:', currentConfig);
}

/**
 * Example 9: VIX-based regime scenarios
 */
async function example9_VIXRegimes() {
  console.log('VIX Regime Scenarios:');
  console.log('');
  console.log('VIX < 15 (NORMAL):');
  console.log('  - Scaling factor: 1.0 (100% of base limits)');
  console.log('  - Position size: Full');
  console.log('  - New positions: Allowed');
  console.log('');
  console.log('VIX 15-25 (ELEVATED):');
  console.log('  - Scaling factor: 0.8 (80% of base limits)');
  console.log('  - Position size: Reduced by 20%');
  console.log('  - New positions: Allowed');
  console.log('');
  console.log('VIX 25-35 (HIGH):');
  console.log('  - Scaling factor: 0.6 (60% of base limits)');
  console.log('  - Position size: Reduced by 40%');
  console.log('  - New positions: Limited/Caution advised');
  console.log('');
  console.log('VIX > 35 (EXTREME):');
  console.log('  - Scaling factor: 0.1 (10% of base limits)');
  console.log('  - Position size: Minimal');
  console.log('  - New positions: BLOCKED (close-only mode)');
}

/**
 * Example 10: Complete trading workflow with dynamic risk
 */
async function example10_CompleteWorkflow() {
  // 1. Get portfolio snapshot
  const portfolio: PortfolioSnapshot = {
    totalEquity: 100000,
    cashBalance: 50000,
    positionsValue: 50000,
    dailyPnl: -300,
  };

  // 2. Get recent trade history
  const recentTrades = [
    { pnl: -150, timestamp: new Date(Date.now() - 3600000) },
    { pnl: -150, timestamp: new Date(Date.now() - 1800000) },
  ];

  // 3. Check if we can open new positions
  const canOpenNew = await dynamicRiskManager.shouldAllowNewPositions();
  if (!canOpenNew.allowed) {
    console.log('Cannot open positions:', canOpenNew.reason);
    return;
  }

  // 4. Get adjusted risk limits
  const limits = await dynamicRiskManager.getAdjustedLimits(portfolio, recentTrades);

  // 5. Calculate position size based on adjusted limits
  const symbolPrice = 150; // Stock price
  const maxPositionValue = (portfolio.totalEquity * limits.maxPositionPct) / 100;
  const maxShares = Math.floor(maxPositionValue / symbolPrice);

  console.log('Trading Decision:');
  console.log('  Max position value: $', maxPositionValue.toFixed(2));
  console.log('  Max shares at $150:', maxShares);
  console.log('  Reason:', limits.reason);
  console.log('  Scaling factors:', limits.scalingFactors);

  // 6. Place order (pseudo-code)
  // const order = {
  //   symbol: 'AAPL',
  //   side: 'buy',
  //   quantity: Math.min(maxShares, desiredShares),
  //   orderType: 'limit',
  //   limitPrice: 150,
  // };
  // await tradingEngine.executeOrder(order);
}

/**
 * Example 11: Converting to legacy RiskLimits format
 */
async function example11_LegacyFormat() {
  const portfolio: PortfolioSnapshot = {
    totalEquity: 100000,
    cashBalance: 50000,
    positionsValue: 50000,
    dailyPnl: 0,
  };

  const adjusted = await dynamicRiskManager.getAdjustedLimits(portfolio);

  // Convert to legacy RiskLimits format for compatibility
  const legacyLimits = dynamicRiskManager.toLegacyRiskLimits(adjusted);

  console.log('Legacy RiskLimits format:', legacyLimits);
  // {
  //   maxPositionSizePercent: 8.0,
  //   maxTotalExposurePercent: 64.0,
  //   maxPositionsCount: 20,
  //   dailyLossLimitPercent: 5
  // }
}

// Export examples for reference
export const examples = {
  example1_SingletonUsage,
  example2_EmergencyModeCheck,
  example3_RiskProfiles,
  example4_CustomConfig,
  example5_IntegrationWithRiskManager,
  example6_Diagnostics,
  example7_RefreshVIX,
  example8_UpdateConfig,
  example9_VIXRegimes,
  example10_CompleteWorkflow,
  example11_LegacyFormat,
};

/**
 * INTEGRATION NOTES:
 *
 * 1. For standalone use:
 *    import { dynamicRiskManager } from './dynamic-risk-manager';
 *    const limits = await dynamicRiskManager.getAdjustedLimits(portfolio, trades);
 *
 * 2. For RiskManager integration:
 *    const riskManager = new RiskManager(undefined, true); // Enable dynamic
 *    const check = await riskManager.checkPreTradeRisk(order, undefined, trades);
 *
 * 3. For algorithm framework:
 *    - Use DynamicRiskManager to adjust config before constructing RiskManagementModule
 *    - Or create a custom RiskModel that queries DynamicRiskManager
 *
 * 4. Requirements:
 *    - FRED_API_KEY environment variable for VIX data
 *    - Macro indicators service should be running to cache VIX
 *    - Falls back gracefully if VIX unavailable
 */
