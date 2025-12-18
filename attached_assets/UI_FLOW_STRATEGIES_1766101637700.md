# UI Flow: Strategies

**Version:** 1.0.0  
**Date:** December 2024  
**Purpose:** Map UI screens → API endpoints → DB tables → Orchestrator steps

---

## ⚠️ Critical UI Rules

1. **NO UNSOURCED CLAIMS**: Every metric shown must have a `runId` and provenance
2. **NO MARKETING TEXT**: Replace any "~X% returns" claims with computed values or remove
3. **FORECAST DISCLAIMERS**: Every projection display must show uncertainty disclaimers
4. **COMPUTED ONLY**: All numbers come from backtest/forecast runs, never hardcoded

---

## 1. Screen-to-API-to-DB Mapping

### 1.1 Strategy Library Screen

**Screen:** `client/screens/StrategiesScreen.tsx`

**Purpose:** Display available strategies with computed metrics from latest backtest runs.

```
┌─────────────────────────────────────────────────────────────────────┐
│ UI Component                                                        │
│ StrategiesScreen.tsx                                               │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ API Endpoint                                                        │
│ GET /api/strategy-manifests                                        │
│   - Returns: Array<StrategyManifest>                               │
│   - Includes: Latest backtest summary per strategy                  │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ DB Tables                                                           │
│ 1. strategy_manifests (loaded from JSON files)                     │
│ 2. backtest_runs (JOIN for latest run per strategy)                │
│    - metrics_out_sample.sharpeRatio                                │
│    - metrics_out_sample.maxDrawdown                                │
│    - overfitting_metrics.isOverfit                                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Data Displayed:**
| Field | Source | Notes |
|-------|--------|-------|
| Strategy Name | manifest.name | Static from manifest |
| Category | manifest.ui.category | Static from manifest |
| Status | manifest.status | 'testing' | 'active' | 'deprecated' |
| OOS Sharpe | backtest_runs.metrics_out_sample.sharpeRatio | Computed |
| Max Drawdown | backtest_runs.metrics_out_sample.maxDrawdown | Computed |
| Overfit Warning | backtest_runs.overfitting_metrics.isOverfit | Computed |
| Last Run | backtest_runs.run_timestamp | Timestamp |

**Removed/Replaced:**
- ❌ "Expected Returns: ~15%" → Removed (unsourced)
- ❌ "Win Rate: 60%" → Show computed value or hide if no run exists
- ✅ "OOS Sharpe: 0.85 (Run: abc123, 2024-12-15)" → Computed with provenance

---

### 1.2 Strategy Wizard Navigator

**Navigator:** `client/navigation/StrategyWizardNavigator.tsx`

**Flow:**
```
StrategyTypeScreen → ConfigurationScreen → BacktestScreen → CapitalAllocationScreen
```

---

### 1.3 Strategy Type Screen

**Screen:** `client/screens/StrategyWizard/StrategyTypeScreen.tsx`

**Purpose:** Select strategy type from available manifests.

```
┌─────────────────────────────────────────────────────────────────────┐
│ UI Component                                                        │
│ StrategyTypeScreen.tsx                                             │
│   - Load strategies from API (not hardcoded)                       │
│   - Show: name, tagline, academicBasis                             │
│   - NO performance claims in selection cards                       │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ API Endpoint                                                        │
│ GET /api/strategy-manifests?enabled=true                           │
│   - Filter: enabled=true, status!='deprecated'                     │
│   - Returns: Manifest subset for UI rendering                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Card Content (per strategy):**
```typescript
{
  name: manifest.name,
  icon: manifest.ui.icon,
  category: manifest.ui.category,
  tagline: manifest.ui.tagline,           // No unsourced claims
  academicBasis: manifest.ui.academicBasis, // Citations only
  riskWarnings: manifest.ui.riskWarnings[0] // Show first warning
}
```

**UI Requirements:**
- ❌ Remove any "~X% historical returns" text
- ❌ Remove any "Recommended" badges based on unsourced performance
- ✅ Show academic citation in small text
- ✅ Show first risk warning as disclaimer

---

### 1.4 Configuration Screen

**Screen:** `client/screens/StrategyWizard/ConfigurationScreen.tsx`

**Purpose:** Configure strategy parameters with defaults from manifest.

```
┌─────────────────────────────────────────────────────────────────────┐
│ UI Component                                                        │
│ ConfigurationScreen.tsx                                            │
│   - "Use Recommended Defaults" toggle (default: ON)                │
│   - Parameter controls rendered from manifest.parameters            │
│   - Constants shown but locked with rationale                      │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ API Endpoint                                                        │
│ GET /api/strategy-manifests/:id                                    │
│   - Returns: Full manifest with parameters array                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Parameter Rendering Logic:**

```typescript
// For each parameter in manifest.parameters:
function renderParameter(param: Parameter) {
  if (param.constant) {
    // Show as disabled with explanation
    return (
      <LockedParameter
        label={param.label}
        value={param.default}
        rationale={param.defaultProvenance.note}
        source={param.defaultProvenance.source}
      />
    );
  }
  
  if (!param.userEditable && useDefaults) {
    // Hidden when "Use Defaults" is on
    return null;
  }
  
  // Render appropriate control based on type
  switch (param.type) {
    case 'integer':
    case 'float':
      return <SliderInput min={param.min} max={param.max} step={param.step} />;
    case 'boolean':
      return <ToggleSwitch />;
    case 'enum':
      return <Dropdown options={param.options} />;
  }
}
```

**UI Sections:**
1. **Core Parameters** (category: 'core') - Always visible
2. **Risk Parameters** (category: 'risk') - Collapsed by default
3. **Timing Parameters** (category: 'timing') - Collapsed by default
4. **Advanced Parameters** (category: 'advanced') - Hidden unless "Show Advanced"

**Provenance Display:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Lookback Period: [12 months]                                       │
│ ──────────────────────────────────────────────────────────────────  │
│ ℹ️ Default from: Moskowitz, Ooi & Pedersen (2012)                   │
│    "12-month lookback shown optimal in original research"           │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 1.5 Backtest Screen

**Screen:** `client/screens/StrategyWizard/BacktestScreen.tsx`

**Purpose:** Run and display 3-year backtest results.

```
┌─────────────────────────────────────────────────────────────────────┐
│ UI Component                                                        │
│ BacktestScreen.tsx                                                 │
│   - Trigger backtest run                                           │
│   - Display equity curve + drawdown chart                          │
│   - Show metrics table (all computed, none hardcoded)              │
│   - Show assumptions panel (costs, slippage)                       │
│   - Highlight overfitting warning if applicable                    │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ API Endpoint                                                        │
│ POST /api/strategy-manifests/:id/backtest                          │
│   Body: {                                                          │
│     lookbackDays: 1095,                                            │
│     symbols: [...],                                                │
│     parameterOverrides: {...}                                      │
│   }                                                                │
│   Returns: BacktestRunResult                                       │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ DB Table                                                           │
│ backtest_runs                                                      │
│   - Stores full result with provenance                             │
│   - runId links to all displayed metrics                           │
└─────────────────────────────────────────────────────────────────────┘
```

**Metrics Display (Computed Only):**

```typescript
interface BacktestMetricsDisplay {
  // Header shows provenance
  header: {
    runId: string;
    runTimestamp: Date;
    dataSource: string;
    period: { start: Date; end: Date; tradingDays: number };
  };
  
  // Primary metrics (Out-of-Sample)
  primary: {
    label: "Out-of-Sample Performance";
    metrics: {
      "CAGR": { value: number; unit: "%" };
      "Sharpe Ratio": { value: number };
      "Max Drawdown": { value: number; unit: "%" };
      "Win Rate": { value: number; unit: "%" };
    };
  };
  
  // Secondary metrics (In-Sample, for comparison)
  secondary: {
    label: "In-Sample Performance (for reference)";
    metrics: { ... };
  };
  
  // Overfitting panel
  overfitting: {
    isOosRatio: number;
    threshold: number;
    isOverfit: boolean;
    warning?: "⚠️ Strategy shows signs of overfitting (IS/OOS ratio > threshold)";
  };
  
  // Assumptions panel
  assumptions: {
    equityCommission: "$0.00 per trade (Alpaca)";
    cryptoFee: "0.15% maker / 0.25% taker (Alpaca)";
    slippage: "5 bps (conservative default)";
    executionTiming: "Next market open";
    benchmark: "SPY";
  };
}
```

**Visualization Components:**
1. **Equity Curve Chart** - Line chart with benchmark overlay
2. **Drawdown Chart** - Area chart showing underwater periods
3. **Monthly Returns Heatmap** - Color-coded grid
4. **Trade Distribution** - Histogram of trade P&L

**Required Footer:**
```
Run ID: {runId} | Computed: {timestamp} | Data: {dataSource}
Past performance does not guarantee future results.
```

---

### 1.6 Capital Allocation Screen

**Screen:** `client/screens/StrategyWizard/CapitalAllocationScreen.tsx`

**Purpose:** Show orchestrator's allocation plan across strategies.

```
┌─────────────────────────────────────────────────────────────────────┐
│ UI Component                                                        │
│ CapitalAllocationScreen.tsx                                        │
│   - Show allocation pie chart                                      │
│   - Show strategy weights table                                    │
│   - "Explain Allocation" button                                    │
│   - Risk contribution breakdown                                    │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ API Endpoints                                                       │
│ GET /api/allocator/plan                                            │
│   - Returns: Latest AllocationPlan                                 │
│ GET /api/allocator/plan/:id/explain                                │
│   - Returns: Detailed explanation with inputs + decisions          │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ DB Table                                                           │
│ allocation_plans                                                   │
│   - Stores allocation + explanation                                │
│   - Links to backtest_runs used as inputs                          │
└─────────────────────────────────────────────────────────────────────┘
```

**Allocation Display:**

```typescript
interface AllocationDisplay {
  // Summary
  method: "Risk Parity" | "Equal Weight" | "Performance-Weighted";
  planId: string;
  timestamp: Date;
  
  // Per-strategy allocations
  allocations: Array<{
    strategyName: string;
    weight: number;           // Final weight after constraints
    rawWeight?: number;       // Before constraints (if different)
    constraintApplied?: string; // e.g., "Capped at 30% max"
    riskContribution: number; // % of portfolio risk
  }>;
  
  // Cash
  cashReserve: { percent: number; reason: string };
  
  // Constraints summary
  constraintsApplied: string[];
  
  // Excluded strategies
  excluded: Array<{
    strategyName: string;
    reason: string;  // e.g., "Overfit (IS/OOS ratio: 2.3 > threshold 1.5)"
  }>;
}
```

**Explain Allocation Modal:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Allocation Explanation                                             │
├─────────────────────────────────────────────────────────────────────┤
│ Method: Risk Parity                                                │
│ Citation: Asness, Frazzini & Pedersen (2012)                       │
│                                                                    │
│ Input Metrics (OOS only):                                          │
│ ┌────────────────────┬────────┬────────┬────────┐                  │
│ │ Strategy           │ Sharpe │ Vol    │ MaxDD  │                  │
│ ├────────────────────┼────────┼────────┼────────┤                  │
│ │ Time-Series Mom.   │ 0.85   │ 12.3%  │ -15.2% │                  │
│ │ MA Trend           │ 0.72   │ 14.1%  │ -18.5% │                  │
│ │ Bollinger MR       │ 0.91   │ 10.5%  │ -12.1% │                  │
│ └────────────────────┴────────┴────────┴────────┘                  │
│                                                                    │
│ Correlation Matrix:                                                │
│ ┌────────────────────┬─────┬─────┬─────┐                           │
│ │                    │ TSM │ MA  │ BMR │                           │
│ ├────────────────────┼─────┼─────┼─────┤                           │
│ │ Time-Series Mom.   │ 1.0 │ 0.6 │ -0.2│                           │
│ │ MA Trend           │ 0.6 │ 1.0 │ 0.1 │                           │
│ │ Bollinger MR       │-0.2 │ 0.1 │ 1.0 │                           │
│ └────────────────────┴─────┴─────┴─────┘                           │
│                                                                    │
│ Decisions:                                                         │
│ • Bollinger MR capped at 30% (max per-strategy constraint)         │
│ • 5% reserved in cash (per policy)                                 │
│ • Risk contributions equalized to 33% each (risk parity goal)      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Flow Timeline Component

**Component:** `client/components/FlowTimeline.tsx`

**Purpose:** Show orchestrator processing steps with timestamps and statuses.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Flow Timeline                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ✅ Data Fetch      ─────────────────────────────────────          │
│     12:01:05 | 3 symbols | 1095 days                               │
│                          │                                         │
│                          ▼                                         │
│  ✅ Signal Compute  ─────────────────────────────────────          │
│     12:01:12 | 3 strategies | 847 signals                          │
│                          │                                         │
│                          ▼                                         │
│  ✅ Risk Check      ─────────────────────────────────────          │
│     12:01:13 | All strategies within limits                        │
│                          │                                         │
│                          ▼                                         │
│  ✅ Allocation      ─────────────────────────────────────          │
│     12:01:14 | Risk Parity | Plan: abc123                          │
│                          │                                         │
│                          ▼                                         │
│  🔄 Orders          ─────────────────────────────────────          │
│     12:01:15 | 5 orders pending | Paper mode                       │
│                          │                                         │
│                          ▼                                         │
│  ⏳ Fills           ─────────────────────────────────────          │
│     Awaiting market open                                           │
│                          │                                         │
│                          ▼                                         │
│  ⏳ Performance     ─────────────────────────────────────          │
│     Updated at market close                                        │
│                                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**API:**
```
GET /api/orchestrator/flow
Returns: {
  steps: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    timestamp?: Date;
    details?: string;
    error?: string;
  }>;
  currentStep: string;
  lastFullCycle: Date;
}
```

---

## 3. Removed/Changed UI Text

### 3.1 Removed Claims

| Location | Removed Text | Reason |
|----------|--------------|--------|
| StrategiesScreen header | "AI-powered strategies delivering consistent returns" | Unsourced claim |
| Strategy cards | "~15% historical CAGR" | Not computed from our backtest |
| Strategy cards | "Recommended" badge | Based on unsourced performance |
| BacktestScreen | "Expected annual return: 12-18%" | Point forecast, not probabilistic |
| AllocationScreen | "Optimized for maximum returns" | Marketing language |

### 3.2 Replaced Text

| Location | Before | After |
|----------|--------|-------|
| Strategy cards | "60% win rate" | "{computed_win_rate}% (Run: {runId})" |
| BacktestScreen header | "Performance Summary" | "Computed Performance (Run: {runId})" |
| Forecast display | "Projected returns: 14%" | "Median scenario (p50): {value}% — see full distribution" |

### 3.3 Added Disclaimers

| Location | Disclaimer |
|----------|------------|
| BacktestScreen | "Past performance does not guarantee future results." |
| ForecastScreen | "These projections are illustrative scenarios, not predictions." |
| ForecastScreen | "Equity premium prediction is historically unreliable (Goyal & Welch, 2008)." |
| AllocationScreen | "Allocation based on out-of-sample performance only." |

---

## 4. State Management

### 4.1 Strategy Wizard State

```typescript
interface StrategyWizardState {
  // Step 1: Type selection
  selectedManifestId: string | null;
  
  // Step 2: Configuration
  parameterOverrides: Record<string, unknown>;
  useDefaults: boolean;
  
  // Step 3: Backtest
  backtestRunId: string | null;
  backtestResult: BacktestRunResult | null;
  backtestLoading: boolean;
  backtestError: string | null;
  
  // Step 4: Allocation
  allocationPlanId: string | null;
  allocationPlan: AllocationPlan | null;
  
  // Validation
  canProceed: {
    toConfiguration: boolean;  // manifest selected
    toBacktest: boolean;       // params valid
    toAllocation: boolean;     // backtest complete & not overfit
    toConfirm: boolean;        // allocation plan exists
  };
}
```

### 4.2 Data Fetching

All API calls use `server/lib/fetchWithBudgetAndCache.ts` for:
- Rate limiting
- Response caching
- Budget enforcement

---

## 5. Error States

### 5.1 No Backtest Data

```
┌─────────────────────────────────────────────────────────────────────┐
│ ℹ️ No Backtest Available                                            │
│                                                                    │
│ This strategy has not been backtested yet.                         │
│ Run a backtest to see computed performance metrics.                │
│                                                                    │
│ [Run 3-Year Backtest]                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Overfitting Warning

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚠️ Overfitting Detected                                             │
│                                                                    │
│ This strategy's in-sample performance significantly exceeds its    │
│ out-of-sample performance (IS/OOS ratio: 2.3 > threshold 1.5).     │
│                                                                    │
│ This may indicate overfitting to historical data. The strategy     │
│ will be excluded from performance-weighted allocation.             │
│                                                                    │
│ Citation: Bailey et al. (2015). The probability of backtest        │
│ overfitting.                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Forecast Uncertainty Banner

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📊 Scenario Projections (NOT Predictions)                          │
│                                                                    │
│ The fan chart below shows possible outcome ranges based on         │
│ historical patterns. These are illustrative scenarios, not         │
│ forecasts.                                                         │
│                                                                    │
│ "Most equity return predictors fail out-of-sample."                │
│ — Goyal & Welch (2008)                                             │
│                                                                    │
│ Use these scenarios for planning only. Actual results may differ   │
│ materially.                                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Acceptance Criteria

### 6.1 Per-Screen Checklist

**StrategiesScreen:**
- [ ] Loads strategies from API (not hardcoded)
- [ ] Shows computed metrics with runId
- [ ] No unsourced performance claims
- [ ] Overfitting flags visible

**StrategyTypeScreen:**
- [ ] Cards loaded from manifests
- [ ] Academic citations shown
- [ ] Risk warnings visible
- [ ] No performance claims in cards

**ConfigurationScreen:**
- [ ] Parameters from manifest.parameters
- [ ] Provenance tooltips for defaults
- [ ] Constants locked with rationale
- [ ] "Use Defaults" toggle works

**BacktestScreen:**
- [ ] POST /api/.../:id/backtest works
- [ ] Metrics from response only (none hardcoded)
- [ ] Provenance header visible
- [ ] Assumptions panel shows costs
- [ ] Disclaimer footer present

**CapitalAllocationScreen:**
- [ ] GET /api/allocator/plan works
- [ ] Weights from plan only
- [ ] Explain button shows inputs + decisions
- [ ] Excluded strategies with reasons
- [ ] OOS-only disclaimer

**FlowTimeline:**
- [ ] GET /api/orchestrator/flow works
- [ ] Steps update in real-time
- [ ] Errors shown clearly

### 6.2 Global Checklist

- [ ] No UI text contains unsourced return claims
- [ ] Every displayed number has a runId or provenance
- [ ] All forecasts show distribution, not point estimates
- [ ] All disclaimers present where required
- [ ] External API calls respect caching/budget

---

*Document ensures all UI displays are backed by computed data with full provenance.*
