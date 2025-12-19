# Dynamic Risk Manager

## Overview

The Dynamic Risk Manager provides adaptive risk management that automatically adjusts position sizes and exposure limits based on real-time market conditions, recent performance, and time factors.

## Key Features

### 1. Volatility-Based Scaling (VIX)
Automatically adjusts risk limits based on CBOE Volatility Index (VIX) levels:

- **VIX < 15 (Normal)**: Full risk limits (100%)
- **VIX 15-25 (Elevated)**: Reduced by 20% (80% of base)
- **VIX 25-35 (High)**: Reduced by 40% (60% of base)
- **VIX > 35 (Extreme)**: Emergency mode, 90% reduction, close-only recommended

### 2. Performance-Based Scaling
Adjusts risk based on recent trading performance:

- **Strong Performance (>2% daily gain)**: Full risk limits
- **Normal Performance (-0.5% to +2%)**: Full risk limits
- **Weak Performance (-0.5% to -2%)**: Reduced by 30%
- **Critical Losses (< -2%)**: Reduced by 60%

### 3. Time-Based Scaling
Adjusts risk based on time of day (US Eastern Time):

- **Market Open (9:30-10:30 ET)**: Reduced by 10% (higher volatility)
- **Normal Hours (10:30-15:00 ET)**: Full risk limits
- **Market Close (15:00-16:00 ET)**: Reduced by 30% (avoid overnight risk)
- **After Hours**: Reduced by 50%

### 4. Combined Scaling
All scaling factors are multiplicative, allowing for conservative risk management:

```typescript
Combined Factor = Volatility × Performance × Time

Example: VIX 20 (0.8) × Weak P&L (0.7) × Market Open (0.9) = 0.504 (49.6% reduction)
```

## Architecture

### File Structure

```
server/services/
├── dynamic-risk-manager.ts           # Main implementation
├── dynamic-risk-manager.example.ts   # Usage examples
├── dynamic-risk-manager.test.ts      # Basic tests
└── DYNAMIC_RISK_MANAGER.md          # This file

services/trading-engine/
└── risk-manager.ts                   # Integration point
```

### Integration Points

1. **Trading Engine** (`services/trading-engine/risk-manager.ts`)
   - Direct integration with `RiskManager` class
   - Enable with `new RiskManager(undefined, true)`
   - Backward compatible with existing code

2. **Algorithm Framework** (`services/shared/algorithm-framework/risk-management.ts`)
   - Use DynamicRiskManager to adjust config before creating RiskManagementModule
   - Commented for future integration

3. **Macro Indicators Service** (`server/services/macro-indicators-service.ts`)
   - Provides VIX data for volatility scaling
   - Caches data to minimize API calls

## Usage

### Basic Usage

```typescript
import { dynamicRiskManager } from './server/services/dynamic-risk-manager';

// Get current portfolio state
const portfolio = {
  totalEquity: 100000,
  cashBalance: 50000,
  positionsValue: 50000,
  dailyPnl: -500,
};

// Recent trades for performance scaling
const recentTrades = [
  { pnl: -200, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  { pnl: -150, timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) },
];

// Get adjusted limits
const limits = await dynamicRiskManager.getAdjustedLimits(portfolio, recentTrades);

console.log('Adjusted Limits:', {
  maxPositionPct: limits.maxPositionPct,
  maxExposurePct: limits.maxExposurePct,
  maxOrdersPerDay: limits.maxOrdersPerDay,
  reason: limits.reason,
});
```

### Integration with RiskManager

```typescript
import { RiskManager } from '../../services/trading-engine/risk-manager';

// Enable dynamic risk adjustments
const riskManager = new RiskManager(undefined, true);

// Or enable later
riskManager.setDynamicLimits(true);

// Check risk with dynamic adjustments
const riskCheck = await riskManager.checkPreTradeRisk(
  orderRequest,
  undefined,
  recentTrades
);

if (!riskCheck.allowed) {
  console.log('Order blocked:', riskCheck.reason);
}
```

### Check Emergency Mode

```typescript
// Check if new positions should be blocked
const check = await dynamicRiskManager.shouldAllowNewPositions();

if (!check.allowed) {
  console.log('EMERGENCY MODE:', check.reason);
  // Only close existing positions
}
```

### Risk Profiles

```typescript
import {
  createConservativeDynamicRisk,
  createModerateDynamicRisk,
  createAggressiveDynamicRisk,
} from './server/services/dynamic-risk-manager';

// Conservative: 5% position, 50% exposure
const conservative = createConservativeDynamicRisk();

// Moderate: 10% position, 80% exposure (default)
const moderate = createModerateDynamicRisk();

// Aggressive: 15% position, 100% exposure
const aggressive = createAggressiveDynamicRisk();
```

### Custom Configuration

```typescript
import { DynamicRiskManager } from './server/services/dynamic-risk-manager';

const customManager = new DynamicRiskManager({
  baseMaxPositionPct: 12,
  baseMaxExposurePct: 90,
  volatilityScaling: true,
  performanceScaling: true,
  timeBasedScaling: false, // Disable time-based scaling
});
```

## Configuration

### DynamicRiskConfig Interface

```typescript
interface DynamicRiskConfig {
  baseMaxPositionPct: number;    // Base position size limit (e.g., 10%)
  baseMaxExposurePct: number;    // Base total exposure limit (e.g., 80%)
  volatilityScaling: boolean;    // Enable VIX-based scaling
  performanceScaling: boolean;   // Enable P&L-based scaling
  timeBasedScaling: boolean;     // Enable time-of-day scaling
}
```

### AdjustedRiskLimits Interface

```typescript
interface AdjustedRiskLimits {
  maxPositionPct: number;              // Adjusted position size limit
  maxExposurePct: number;              // Adjusted exposure limit
  maxOrdersPerDay: number;             // Adjusted daily order limit
  scalingFactors: {                    // Individual scaling factors
    volatility: number;
    performance: number;
    time: number;
    concentration: number;
  };
  reason: string;                      // Human-readable explanation
}
```

## Environment Setup

### Required Environment Variables

```bash
# For VIX data (optional but recommended)
FRED_API_KEY=your_fred_api_key_here
```

Get a free FRED API key at: https://fred.stlouisfed.org/docs/api/api_key.html

### Fallback Behavior

- If VIX data is unavailable, volatility scaling is disabled
- System logs warning and continues with other scaling factors
- Graceful degradation ensures trading continues

## Diagnostics

```typescript
// Get current state and diagnostics
const diagnostics = await dynamicRiskManager.getDiagnostics();

console.log('VIX:', diagnostics.vix);
console.log('VIX Age:', diagnostics.vixAge, 'ms');
console.log('Volatility Regime:', diagnostics.volatilityRegime);
console.log('Config:', diagnostics.config);
```

## Performance Considerations

### VIX Caching
- VIX data cached for 5 minutes
- Reduces API calls to FRED
- Use `refreshVIX()` to force update

### Async Operations
- All limit calculations are async (fetches VIX)
- Cache ensures sub-millisecond performance after first fetch
- Safe to call frequently

## Testing

```bash
# Run basic tests
npx tsx server/services/dynamic-risk-manager.test.ts
```

## Examples

See `server/services/dynamic-risk-manager.example.ts` for:
- Singleton usage
- Emergency mode checks
- Risk profiles
- Custom configuration
- Integration examples
- Complete trading workflow
- Legacy format conversion

## Migration Guide

### From Static Limits

```typescript
// Before
const riskManager = new RiskManager({
  maxPositionSizePercent: 10,
  maxTotalExposurePercent: 80,
});

// After (with dynamic adjustments)
const riskManager = new RiskManager({
  maxPositionSizePercent: 10,  // Base limits
  maxTotalExposurePercent: 80,
}, true); // Enable dynamic
```

### Backward Compatibility

- Default behavior unchanged (dynamic disabled by default)
- Existing code continues to work without modifications
- Opt-in via constructor parameter or `setDynamicLimits(true)`
- Legacy hardcoded values preserved as comments

## Best Practices

### 1. Enable All Scaling Factors
For maximum safety, enable all three scaling factors:

```typescript
const config = {
  volatilityScaling: true,
  performanceScaling: true,
  timeBasedScaling: true,
};
```

### 2. Monitor Emergency Mode
Check for emergency mode during high volatility:

```typescript
const check = await dynamicRiskManager.shouldAllowNewPositions();
if (!check.allowed) {
  // Implement close-only mode
}
```

### 3. Log Scaling Decisions
Always log why limits were adjusted:

```typescript
const limits = await dynamicRiskManager.getAdjustedLimits(portfolio, trades);
console.log('Risk adjustment:', limits.reason);
console.log('Scaling factors:', limits.scalingFactors);
```

### 4. Refresh VIX Periodically
Update VIX data in a background task:

```typescript
// Every 5 minutes
setInterval(async () => {
  await dynamicRiskManager.refreshVIX();
}, 5 * 60 * 1000);
```

### 5. Handle Errors Gracefully
System falls back to static limits on errors:

```typescript
try {
  const limits = await riskManager.getEffectiveRiskLimits(trades);
} catch (error) {
  // Automatically falls back to static limits
  console.warn('Using static limits due to error:', error);
}
```

## Limitations

1. **VIX Dependency**: Requires FRED API key for full functionality
2. **Time Zones**: Time-based scaling assumes US Eastern Time
3. **Market Hours**: Weekend/holiday detection is simplified
4. **Historical Data**: Performance scaling uses recent trades only
5. **Correlation**: Does not account for portfolio correlation

## Future Enhancements

- [ ] Support for custom volatility indicators (ATR, realized vol)
- [ ] Portfolio concentration-based scaling
- [ ] Drawdown-based scaling
- [ ] Machine learning for optimal scaling factors
- [ ] Multi-asset class volatility regimes
- [ ] Calendar-aware market hours (holidays)

## Security

- No sensitive data stored in memory
- VIX cache is read-only
- No modification of user portfolio data
- All calculations are deterministic

## Support

For issues or questions:
1. Check `dynamic-risk-manager.example.ts` for usage patterns
2. Review diagnostics output
3. Enable debug logging
4. Check VIX data availability

## License

Part of AI Active Trader - All rights reserved
