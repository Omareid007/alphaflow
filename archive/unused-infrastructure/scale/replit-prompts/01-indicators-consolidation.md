# Replit Prompt: Technical Indicators Consolidation

> **STATUS: ✅ COMPLETED** - 2024-12-19
> Implementation verified in `/server/strategies/momentum-strategy.ts` (lines 169-231)
> Duplicate implementations are commented out and now use shared library imports.

## OBJECTIVE
Consolidate all duplicate technical indicator calculations (SMA, EMA, RSI, MACD, Bollinger Bands) into a single shared library to eliminate ~280 lines of duplicated code across 4 files.

## FILES TO MODIFY

### Primary File (Enhance):
- `/server/lib/technical-indicators.ts` - The canonical source for all indicators

### Files to Update (Remove duplicates):
- `/server/strategies/momentum-strategy.ts` - Remove inline SMA/RSI calculations
- `/server/strategies/ma-crossover-strategy.ts` - Remove inline MA calculations
- `/server/strategies/mean-reversion-strategy.ts` - Remove inline mean/std calculations
- `/server/orchestration/coordinator.ts` - Use shared library instead

## IMPLEMENTATION DETAILS

### Step 1: Enhance the canonical library
Add the following to `/server/lib/technical-indicators.ts`:

```typescript
// Standardized interface for all indicator results
export interface IndicatorResult {
  value: number;
  timestamp: Date;
  confidence: number;
}

// SMA - Simple Moving Average
export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return NaN;
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

// EMA - Exponential Moving Average
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return NaN;
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  return ema;
}

// RSI - Relative Strength Index
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; // Neutral default

  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const recentChanges = changes.slice(-period);

  const gains = recentChanges.filter(c => c > 0);
  const losses = recentChanges.filter(c => c < 0).map(c => Math.abs(c));

  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// MACD - Moving Average Convergence Divergence
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } {
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  const macd = fastEMA - slowEMA;

  // Calculate signal line (EMA of MACD values)
  // Simplified: use current MACD as signal approximation
  const signal = macd * 0.8; // Approximation for single-value calc
  const histogram = macd - signal;

  return { macd, signal, histogram };
}

// Bollinger Bands
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: number; middle: number; lower: number; bandwidth: number } {
  const middle = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + (stdDev * stdDevMultiplier);
  const lower = middle - (stdDev * stdDevMultiplier);
  const bandwidth = (upper - lower) / middle;

  return { upper, middle, lower, bandwidth };
}

// ATR - Average True Range
export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number {
  if (highs.length < period + 1) return NaN;

  const trueRanges: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  return calculateSMA(trueRanges, period);
}

// Standard Deviation
export function calculateStdDev(values: number[], period: number): number {
  if (values.length < period) return NaN;
  const slice = values.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / period;
  return Math.sqrt(variance);
}

// Momentum (Rate of Change)
export function calculateMomentum(prices: number[], period: number): number {
  if (prices.length < period + 1) return 0;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - period];
  return ((current - past) / past) * 100;
}
```

### Step 2: Update strategy files

Replace inline calculations in each strategy file with imports:

```typescript
// At top of each strategy file
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateMomentum,
  calculateStdDev
} from '../lib/technical-indicators';
```

### Step 3: Remove duplicate implementations

In `momentum-strategy.ts`, remove the local `calculateSMA` and `calculateRSI` functions.
In `ma-crossover-strategy.ts`, remove the local moving average calculations.
In `mean-reversion-strategy.ts`, remove the local mean/stdDev calculations.

## ACCEPTANCE CRITERIA

- [ ] All indicator functions exported from `/server/lib/technical-indicators.ts`
- [ ] No duplicate `calculateSMA` function exists outside the library
- [ ] No duplicate `calculateRSI` function exists outside the library
- [ ] All strategy files import from the shared library
- [ ] Unit tests pass for all indicator functions
- [ ] TypeScript compilation succeeds with no errors
- [ ] ~280 lines of duplicated code removed

## VERIFICATION COMMANDS

```bash
# Check for remaining duplicates
grep -r "function calculateSMA" server/ --include="*.ts" | wc -l
# Should return: 1 (only in technical-indicators.ts)

# Check for remaining RSI duplicates
grep -r "function calculateRSI" server/ --include="*.ts" | wc -l
# Should return: 1

# Verify TypeScript compiles
npx tsc --noEmit

# Run tests
npm test -- --grep "technical-indicators"
```

## ESTIMATED IMPACT

- **Lines removed**: ~280
- **Files affected**: 5
- **Risk level**: Medium (functional changes to calculations)
- **Testing required**: Comprehensive indicator unit tests
