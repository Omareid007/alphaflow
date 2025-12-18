# Strategy Manifesto

**Version:** 2.0.0  
**Date:** December 2024  
**Status:** Production Document  
**Authority:** Orchestrator-controlled plug-and-play strategy system

---

## Critical: Non-Negotiable Rules

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
3. [Backtest Methodology](#3-backtest-methodology)
4. [Forecast Methodology](#4-forecast-methodology)
5. [Allocation System](#5-allocation-system)
6. [Execution & Costs](#6-execution--costs)
7. [API Reference](#7-api-reference)
8. [Academic References](#8-academic-references)

---

## 1. Architecture Overview

### 1.1 Orchestrator Authority

The orchestrator (`server/autonomous/orchestrator.ts`) is the **single authority** that:

1. Loads strategy configurations
2. Computes signals via strategy implementations
3. Runs backtests via strategy-specific backtest functions
4. Produces probabilistic projections
5. Allocates capital with position sizing
6. Routes order intents with full traceability

### 1.2 File Structure

```
server/
├── autonomous/
│   └── orchestrator.ts          # Central coordinator
├── strategies/
│   ├── index.ts                 # Strategy exports
│   ├── momentum-strategy.ts     # Momentum strategy with backtest
│   ├── moving-average-crossover.ts # MA crossover with backtest
│   └── mean-reversion-scalper.ts   # Mean reversion with backtest
├── lib/
│   ├── apiBudget.ts             # API budget management
│   ├── fetchWithBudgetAndCache.ts # Budget-aware caching
│   └── technical-indicators.ts  # Technical indicator calculations
└── routes.ts                    # API endpoints

shared/
└── schema.ts                    # DB schema (includes backtest_runs)
```

---

## 2. Strategy Families & Academic Foundations

### 2.1 Momentum Strategies

#### Time-Series Momentum

**Citation:** Moskowitz, T. J., Ooi, Y. H., & Pedersen, L. H. (2012). Time series momentum. *Journal of Financial Economics*, 104(2), 228–250.

**Research-Backed Defaults:**
| Parameter | Default | Source |
|-----------|---------|--------|
| Lookback period | 12 months | MOP 2012 |
| Holding period | 1 month | MOP 2012 |

**What We Cannot Claim:** Specific CAGR, Sharpe, or win rates without computing them from our backtest engine on fetched data.

### 2.2 Technical Trading Rules

**Citation:** Brock, W., Lakonishok, J., & LeBaron, B. (1992). Simple technical trading rules. *The Journal of Finance*, 47(5), 1731–1764.

**Research-Backed Defaults:**
| Parameter | Default | Source |
|-----------|---------|--------|
| Fast MA | 50 days | BLL 1992 |
| Slow MA | 200 days | BLL 1992 |

**Caveat:** Original study ignored transaction costs.

### 2.3 Overfitting Risk

**Citation:** Bailey, D. H., et al. (2015). The probability of backtest overfitting. *Journal of Computational Finance*.

**Implementation:** Walk-forward validation recommended (70% IS / 30% OOS).

### 2.4 Forecasting Uncertainty

**Citation:** Goyal, A., & Welch, I. (2008). A comprehensive look at equity premium prediction. *Review of Financial Studies*, 21(4), 1455–1508.

**Key Finding:** "Most equity return predictors fail out-of-sample."

**Implementation:** NO point forecasts. All outputs should be quantile distributions.

---

## 3. Backtest Methodology

### Implemented Strategy Backtests

**Location:** Individual strategy files in `server/strategies/`

**Standard Configuration:**
- Lookback: Configurable (default 365 days)
- Costs: Alpaca commission (equity $0, crypto 0.15%/0.25%)
- Slippage: Configurable (default 5 bps)

**Endpoints:**
- `POST /api/strategies/momentum/backtest`
- `POST /api/strategies/moving-average/backtest`
- `POST /api/strategies/mean-reversion/backtest`
- `POST /api/strategies/backtest` (generic)

**Output:** All metrics computed from data with provenance.

---

## 4. Forecast Methodology

**Recommended Method:** Block Bootstrap Monte Carlo
- Multiple simulations
- Block size: 21 days
- Seeded for reproducibility

**Required Disclaimers:**
1. "Past performance does not guarantee future results."
2. "These projections are illustrative scenarios, not predictions."
3. "Equity premium prediction is historically unreliable (Goyal & Welch, 2008)."

---

## 5. Allocation System

### Advanced Rebalancing Service

**Location:** `server/services/advanced-rebalancing-service.ts`

**Features:**
- Kelly Criterion position sizing (0.25 fractional)
- Market regime adaptation
- Trailing stop automation
- Partial take-profit levels

**Constraints:**
- Max drawdown gate: 20%
- Cash reserve: configurable

---

## 6. Execution & Costs

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

## 7. API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/strategies` | List available strategies |
| POST | `/api/strategies/:type/backtest` | Run backtest for strategy type |
| POST | `/api/strategies/backtest` | Generic backtest endpoint |
| GET | `/api/backtests` | List backtest runs |

---

## 8. Academic References (APA 7)

Almgren, R., & Chriss, N. (2000). Optimal execution of portfolio transactions. *Journal of Risk*, 3(2), 5–39.

Asness, C. S., Frazzini, A., & Pedersen, L. H. (2012). Leverage aversion and risk parity. *Financial Analysts Journal*, 68(1), 47–59.

Bailey, D. H., et al. (2015). The probability of backtest overfitting. *Journal of Computational Finance*.

Brock, W., Lakonishok, J., & LeBaron, B. (1992). Simple technical trading rules. *The Journal of Finance*, 47(5), 1731–1764.

Goyal, A., & Welch, I. (2008). A comprehensive look at equity premium prediction. *Review of Financial Studies*, 21(4), 1455–1508.

Jegadeesh, N., & Titman, S. (1993). Returns to buying winners and selling losers. *The Journal of Finance*, 48(1), 65–91.

Moreira, A., & Muir, T. (2017). Volatility-managed portfolios. *The Journal of Finance*, 72(4), 1611–1644.

Moskowitz, T. J., Ooi, Y. H., & Pedersen, L. H. (2012). Time series momentum. *Journal of Financial Economics*, 104(2), 228–250.

---

*All performance claims must be computed from actual data with full provenance.*
