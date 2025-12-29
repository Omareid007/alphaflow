# Backtest Script Migration Plan

## Executive Summary

**Total Scripts:** 19 (19,009 lines)
**Target Reduction:** ~12,000 lines (63%)
**Reference Implementation:** `omar-backtest-v2.ts` (241 lines, 69% reduction achieved)

## Migration Priority Order

| Order | Script                     | Lines | Est. After | Savings     | Complexity  |
| ----- | -------------------------- | ----- | ---------- | ----------- | ----------- |
| 1     | omar-backtest.ts           | 779   | 150        | 630 (81%)   | Low         |
| 2     | omar-momentum-optimizer.ts | 805   | 300        | 505 (63%)   | Medium      |
| 3     | omar-hyperoptimizer.ts     | 957   | 350        | 607 (63%)   | Medium      |
| 4     | omar-backtest-enhanced.ts  | 1,565 | 400        | 1,165 (74%) | Medium      |
| 5     | omar-weight-optimizer.ts   | 1,335 | 450        | 885 (66%)   | Medium-High |

**Top 5 Savings:** ~3,792 lines (70% reduction)

## Shared Modules Available

Located in `scripts/shared/`:

- `index.ts` - Re-exports all modules
- `types.ts` - AlpacaBar, BacktestConfig, Trade, Genome interfaces
- `alpaca-api.ts` - fetchAlpacaBars, fetchHistoricalData, SYMBOL_LISTS
- `technical-indicators.ts` - 16 indicators (RSI, SMA, EMA, ATR, etc.)
- `backtest-engine.ts` - runBacktest, calculateMetrics, generateSignal
- `genetic-algorithm.ts` - crossover, mutate, selection, evolution

## Migration Template

```typescript
// Before (duplicate functions)
import { ... } from '@alpacahq/alpaca-trade-api';

interface AlpacaBar { ... }  // REMOVE
function fetchAlpacaBars() { ... }  // REMOVE
function calculateRSI() { ... }  // REMOVE
// ... many more duplicates

// After (use shared modules)
import {
  fetchHistoricalData,
  runBacktest,
  calculateScore,
  calculateRSI,
  calculateSMA,
  calculateEMA,
  SYMBOL_LISTS,
  type BacktestConfig,
  type Trade,
  DEFAULT_CONFIG
} from "./shared/index.js";

// Keep only script-specific logic
```

## Verification Steps

For each migrated script:

1. Run `npx tsx scripts/<script>.ts`
2. Compare output with original
3. Verify metrics match

## Rollback

```bash
git checkout main -- scripts/<script>.ts
```
