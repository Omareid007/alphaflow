# Backtest Script Migration Plan

## Executive Summary

**Total Scripts:** 19 (19,009 lines)
**Target Reduction:** ~12,000 lines (63%)
**Reference Implementation:** `omar-backtest-v2.ts` (241 lines, 69% reduction achieved)

## Migration Status (Updated Dec 29, 2024)

### Completed Migrations (Phase 1 + 2)

| Order | Script                       | Before | After | Savings     | Status    |
| ----- | ---------------------------- | ------ | ----- | ----------- | --------- |
| 1     | omar-backtest.ts             | 779    | 247   | 532 (68%)   | Completed |
| 2     | omar-momentum-optimizer.ts   | 805    | 669   | 136 (17%)   | Completed |
| 3     | omar-hyperoptimizer.ts       | 957    | 682   | 275 (29%)   | Completed |
| 4     | omar-backtest-enhanced.ts    | 1,565  | 731   | 834 (53%)   | Completed |
| 5     | omar-weight-optimizer.ts     | 1,335  | 853   | 482 (36%)   | Completed |
| 6     | omar-ultra-hyperoptimizer.ts | 1,843  | 865   | 978 (53%)   | Completed |

**Total Savings (6 scripts):** 3,237 lines (44% average reduction)

### Notes on Actual vs Estimated Savings

- Scripts with more custom logic (momentum-specific signals, multi-factor scoring, walk-forward validation) had lower reduction rates
- Estimated 70% reduction was optimistic; actual 43% is still significant
- Scripts retain value in their domain-specific implementations

### Remaining Scripts (Lower Priority)

| Script                      | Lines | Estimated Savings |
| --------------------------- | ----- | ----------------- |
| omar-genetic-optimizer.ts   | 1,101 | ~30%              |
| omar-ml-optimizer.ts        | 1,089 | ~25%              |
| omar-pattern-scanner.ts     | 890   | ~35%              |
| omar-sector-rotation.ts     | 756   | ~40%              |
| omar-risk-analyzer.ts       | 712   | ~35%              |
| ... (9 more scripts)        | ~6K   | ~30%              |

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

## Commits

- `fd7c325` - Initial shared module creation
- `63031b8` - omar-backtest.ts migration
- `[commit]` - omar-momentum-optimizer.ts migration
- `[commit]` - omar-hyperoptimizer.ts migration
- `[commit]` - omar-backtest-enhanced.ts migration
- `5323774` - omar-weight-optimizer.ts migration
- `c69c6b5` - omar-ultra-hyperoptimizer.ts migration (53% reduction)
