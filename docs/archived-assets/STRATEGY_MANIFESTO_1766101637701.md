# Strategy Manifesto

**Version:** 2.0.0  
**Date:** December 2024  
**Status:** Production Document  
**Authority:** Orchestrator-controlled plug-and-play strategy system

---

## ⚠️ CRITICAL: Non-Negotiable Rules

This document adheres to strict non-hallucination principles:

1. **NO PERFORMANCE CLAIMS** unless computed by code from fetched data with full provenance
2. **ALL DEFAULTS** must be either academically sourced (with citation) OR computed/calibrated by walk-forward (with code reference)
3. **3-YEAR FORECASTS** are probabilistic/scenario-based only—never point estimates
4. **BACKTESTING** includes realistic costs and walk-forward separation with overfitting metrics
5. **EXTERNAL CALLS** respect existing budget/caching utilities

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Strategy Families & Academic Foundations](#2-strategy-families--academic-foundations)
3. [Manifest Schema Specification](#3-manifest-schema-specification)
4. [Implemented Strategies](#4-implemented-strategies)
5. [Backtest Methodology](#5-backtest-methodology)
6. [Forecast Methodology](#6-forecast-methodology)
7. [Allocation System](#7-allocation-system)
8. [Execution & Costs](#8-execution--costs)
9. [Database Schema](#9-database-schema)
10. [API Reference](#10-api-reference)
11. [Academic References](#11-academic-references)

---

## 1. Architecture Overview

### 1.1 Orchestrator Authority

The orchestrator (`server/autonomous/orchestrator.ts`) is the **single authority** that:

1. Loads strategy manifests from `server/strategies/manifests/*.json`
2. Validates manifests against `shared/strategy-manifest.ts` schema
3. Computes signals via `server/strategies/manifest-registry.ts`
4. Runs 3-year backtests via `server/backtests/runner.ts`
5. Produces probabilistic 3-year projections via `server/forecast/forecast-runner.ts`
6. Allocates capital via `server/allocation/allocator.ts`
7. Routes order intents with full traceability

### 1.2 File Structure

```
server/
├── autonomous/
│   └── orchestrator.ts          # Central coordinator
├── strategies/
│   ├── index.ts                 # Strategy exports
│   ├── manifest-registry.ts     # Loads/validates manifests
│   └── manifests/
│       ├── time-series-momentum.json
│       ├── moving-average-trend.json
│       └── bollinger-mean-reversion.json
├── backtests/
│   └── runner.ts                # Standardized 3-year backtest
├── forecast/
│   └── forecast-runner.ts       # Probabilistic projections
├── allocation/
│   └── allocator.ts             # Smart allocation engine
└── routes.ts                    # API endpoints

shared/
├── strategy-manifest.ts         # Zod schema + TS types
├── strategy-spec.ts             # Strategy specifications
└── schema.ts                    # DB schema (includes caching)
```

---

## 2. Strategy Families & Academic Foundations

### 2.1 Momentum Strategies

#### Cross-Sectional Momentum

**Citation:** Jegadeesh, N., & Titman, S. (1993). Returns to buying winners and selling losers. *The Journal of Finance*, 48(1), 65–91.

**Research-Backed Defaults:**
| Parameter | Default | Source |
|-----------|---------|--------|
| Formation period | 12 months | J&T 1993 |
| Holding period | 6 months | J&T 1993 |
| Skip period | 1 month | J&T 1993 |

**What We Cannot Claim:** Specific CAGR, Sharpe, or win rates without computing them from our backtest engine on fetched data.

#### Time-Series Momentum

**Citation:** Moskowitz, T. J., Ooi, Y. H., & Pedersen, L. H. (2012). Time series momentum. *Journal of Financial Economics*, 104(2), 228–250.

**Research-Backed Defaults:**
| Parameter | Default | Source |
|-----------|---------|--------|
| Lookback period | 12 months | MOP 2012 |
| Holding period | 1 month | MOP 2012 |

#### Volatility-Managed Momentum

**Citation:** Moreira, A., & Muir, T. (2017). Volatility-managed portfolios. *The Journal of Finance*, 72(4), 1611–1644.

**Research-Backed Defaults:**
| Parameter | Default | Source |
|-----------|---------|--------|
| Volatility window | 21 days | M&M 2017 |

---

### 2.2 Technical Trading Rules

**Citation:** Brock, W., Lakonishok, J., & LeBaron, B. (1992). Simple technical trading rules. *The Journal of Finance*, 47(5), 1731–1764.

**Research-Backed Defaults:**
| Parameter | Default | Source |
|-----------|---------|--------|
| Fast MA | 50 days | BLL 1992 |
| Slow MA | 200 days | BLL 1992 |

**Caveat:** Original study ignored transaction costs.

---

### 2.3 Risk Parity Allocation

**Citation:** Asness, C. S., Frazzini, A., & Pedersen, L. H. (2012). Leverage aversion and risk parity. *Financial Analysts Journal*, 68(1), 47–59.

---

### 2.4 Overfitting Risk

**Citation:** Bailey, D. H., et al. (2015). The probability of backtest overfitting. *Journal of Computational Finance*.

**Implementation:** Walk-forward validation (70% IS / 30% OOS), IS/OOS Sharpe ratio comparison.

---

### 2.5 Forecasting Uncertainty

**Citation:** Goyal, A., & Welch, I. (2008). A comprehensive look at equity premium prediction. *Review of Financial Studies*, 21(4), 1455–1508.

**Key Finding:** "Most equity return predictors fail out-of-sample."

**Implementation:** NO point forecasts. All outputs are quantile distributions.

---

## 3. Manifest Schema Specification

Each strategy manifest includes:

```typescript
{
  id: string;
  version: string;
  name: string;
  runnerType: string;
  enabled: boolean;
  status: 'testing' | 'active' | 'deprecated';
  
  dataRequirements: {
    timeframe: '1Day' | '1Hour' | ...;
    minHistoryDays: number;
    requiredFields: string[];
    assetClasses: string[];
  };
  
  parameters: Array<{
    key: string;
    type: 'integer' | 'float' | 'boolean' | 'enum';
    default: any;
    userEditable: boolean;
    constant: boolean;
    defaultProvenance: {
      type: 'academic_paper' | 'broker_documentation' | 'computed_walk_forward' | 'conventional_default';
      source: string;
      note?: string;
    };
  }>;
  
  backtestSpec: {
    lookbackDaysDefault: 1095;  // 3 years
    walkForward: { enabled: true; inSamplePercent: 70; outSamplePercent: 30; };
    overfittingMetric: 'is_oos_ratio';
    overfittingThreshold: 1.5;
  };
  
  forecastSpec: {
    horizonDaysDefault: 1095;  // 3 years
    method: 'monte_carlo_bootstrap';
    outputQuantiles: [10, 25, 50, 75, 90];
  };
}
```

---

## 4. Implemented Strategies

### 4.1 Time-Series Momentum
- **Manifest:** `server/strategies/manifests/time-series-momentum.json`
- **Signal:** Go long positive past returns, short/cash negative
- **Provenance:** Moskowitz, Ooi & Pedersen (2012)

### 4.2 Moving Average Trend
- **Manifest:** `server/strategies/manifests/moving-average-trend.json`
- **Signal:** Fast MA crosses slow MA
- **Provenance:** Brock, Lakonishok & LeBaron (1992)

### 4.3 Bollinger Mean Reversion
- **Manifest:** `server/strategies/manifests/bollinger-mean-reversion.json`
- **Signal:** Buy at lower band, sell at mean
- **Provenance:** Conventional default

---

## 5. Backtest Methodology

### Engine: `server/backtests/runner.ts`

**Standard Configuration:**
- Lookback: 1095 days (3 years)
- Walk-forward: 70% IS / 30% OOS
- Costs: Alpaca commission (equity $0, crypto 0.15%/0.25%)
- Slippage: 5 bps (configurable)
- Overfitting: IS/OOS Sharpe ratio, threshold 1.5

**Output:** All metrics computed from data with `runId` and provenance.

---

## 6. Forecast Methodology

### Engine: `server/forecast/forecast-runner.ts`

**Method:** Block Bootstrap Monte Carlo
- 10,000 simulations
- Block size: 21 days
- Seeded for reproducibility

**Output:**
- Quantiles: p10, p25, p50, p75, p90
- Scenarios: Bull/Base/Bear with probabilities
- Risk: P(loss), P(drawdown > 20%)

**Required Disclaimers:**
1. "Past performance does not guarantee future results."
2. "These projections are illustrative scenarios, not predictions."
3. "Equity premium prediction is historically unreliable (Goyal & Welch, 2008)."

---

## 7. Allocation System

### Engine: `server/allocation/allocator.ts`

**Methods:**
1. **Equal Weight:** 1/N
2. **Risk Parity:** Weight inversely to volatility (Asness et al., 2012)
3. **Performance-Weighted (OOS):** Gated by overfitting metric

**Constraints:**
- Max per-strategy: 30%
- Max per-symbol: 10%
- Max turnover: 20%
- Max drawdown gate: 20%
- Cash reserve: 5%
- PBO threshold: 50%

---

## 8. Execution & Costs

### Commission (Alpaca)
| Asset | Commission | Source |
|-------|------------|--------|
| Equities | $0 | Alpaca FAQ |
| Crypto Maker | 0.15% | Alpaca Docs |
| Crypto Taker | 0.25% | Alpaca Docs |

### Slippage
- Default: 5 bps (conservative)
- User configurable

---

## 9. Database Schema

**Required Tables:**
- `backtest_runs` - Stores computed metrics with provenance
- `forecast_runs` - Stores quantile distributions
- `allocation_plans` - Stores weights and explanations

**Caching:**
- `external_api_cache_entries`
- `external_api_usage_counters`

---

## 10. API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/strategy-manifests` | List all manifests |
| POST | `/api/strategy-manifests/:id/backtest` | Run 3-year backtest |
| POST | `/api/strategy-manifests/:id/forecast` | Generate projection |
| GET | `/api/allocator/plan` | Get allocation plan |
| GET | `/api/orchestrator/flow` | Get flow status |

---

## 11. Academic References (APA 7)

Almgren, R., & Chriss, N. (2000). Optimal execution of portfolio transactions. *Journal of Risk*, 3(2), 5–39.

Asness, C. S., Frazzini, A., & Pedersen, L. H. (2012). Leverage aversion and risk parity. *Financial Analysts Journal*, 68(1), 47–59.

Bailey, D. H., et al. (2015). The probability of backtest overfitting. *Journal of Computational Finance*.

Brock, W., Lakonishok, J., & LeBaron, B. (1992). Simple technical trading rules. *The Journal of Finance*, 47(5), 1731–1764.

Goyal, A., & Welch, I. (2008). A comprehensive look at equity premium prediction. *Review of Financial Studies*, 21(4), 1455–1508.

Jegadeesh, N., & Titman, S. (1993). Returns to buying winners and selling losers. *The Journal of Finance*, 48(1), 65–91.

Moreira, A., & Muir, T. (2017). Volatility-managed portfolios. *The Journal of Finance*, 72(4), 1611–1644.

Moskowitz, T. J., Ooi, Y. H., & Pedersen, L. H. (2012). Time series momentum. *Journal of Financial Economics*, 104(2), 228–250.

---

## Appendix: Deprecated Document

The previous `AI_TRADING_STRATEGY_IMPLEMENTATION_MANIFESTO.md` is **DEPRECATED** due to:
- Hardcoded performance claims (16.7% CAGR, 0.87 Sharpe)
- Point forecast targets (12-18% expected returns)
- Architecture mismatch with repo anchors

Use this document (`STRATEGY_MANIFESTO.md`) as the authoritative reference.

---

*All performance claims must be computed from actual data with full provenance.*
