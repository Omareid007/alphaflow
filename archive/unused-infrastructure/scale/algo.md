# AI ACTIVE TRADER: ALGORITHMIC TRADING SPECIFICATION v1.0

**Generated**: 2025-12-22
**Platform**: AI Active Trader
**Analysis Scope**: Complete codebase analysis including trading engine, AI decision systems, data pipelines, and risk management

---

# TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Historical Performance Analysis](#2-historical-performance-analysis)
3. [Failure Mode Attribution](#3-failure-mode-attribution)
4. [Success Pattern Identification](#4-success-pattern-identification)
5. [Algorithm Specification](#5-algorithm-specification)
   - 5.1 [Universe Definition](#51-universe-definition)
   - 5.2 [Multi-Factor Scoring Model](#52-multi-factor-scoring-model)
   - 5.3 [Signal Generation Logic](#53-signal-generation-logic)
   - 5.4 [Position Sizing & Risk Management](#54-position-sizing--risk-management)
   - 5.5 [Execution Engine](#55-execution-engine)
   - 5.6 [Strategy Variations](#56-strategy-variations)
6. [User Configuration Interface](#6-user-configuration-interface)
7. [Data Requirements & Sources](#7-data-requirements--sources)
8. [Monitoring & Alerting](#8-monitoring--alerting)
9. [Appendices](#9-appendices)

---

# 1. EXECUTIVE SUMMARY

## Overview

AI Active Trader is a hybrid AI-powered autonomous trading platform that combines Large Language Model (LLM) based analysis with traditional quantitative trading techniques. The platform executes paper trades through Alpaca's brokerage API while leveraging multi-source data fusion for informed decision-making.

### Core Capabilities

| Capability | Implementation |
|------------|----------------|
| **Live Trading** | Alpaca Paper Trading API with bracket orders, trailing stops |
| **AI Analysis** | Multi-provider LLM routing (OpenAI, Claude, Groq, Together.ai) |
| **Data Fusion** | 5+ data sources with reliability-weighted aggregation |
| **Risk Management** | Dynamic position sizing, kill switch, daily loss limits |
| **Strategy Engine** | 3 core strategies with configurable presets |
| **Backtesting** | Event-driven simulation with Sharpe/Sortino metrics |

### Key Metrics & Defaults

| Metric | Default Value | Range |
|--------|---------------|-------|
| Max Position Size | 10% of portfolio | 5-30% |
| Max Total Exposure | 50% of equity | 10-100% |
| Max Positions Count | 10 positions | 3-25 |
| Daily Loss Limit | 5% of equity | 2-10% |
| AI Confidence Threshold | 60% | 40-90% |
| Default Stop Loss | 5% from entry | 2-15% |
| Default Take Profit | 10% from entry | 5-50% |
| Risk/Reward Ratio | 2:1 minimum | 1.5-5:1 |

### Algorithm Design Principles

1. **Multi-Factor Approach**: Combine fundamentals (20%), technicals (30%), sentiment (20%), macro (15%), micro (10%), and momentum (5%) for comprehensive scoring
2. **Conservative by Default**: Paper trading focus with loss protection and kill switch capabilities
3. **Data Quality Priority**: Source reliability weighting with conflict detection and graceful degradation
4. **Adaptive Risk**: Dynamic position sizing based on VIX regime, recent performance, and time of day
5. **Full Traceability**: Complete decision logging with trace IDs linking AI decisions to trade outcomes

---

# 2. HISTORICAL PERFORMANCE ANALYSIS

## Trade Log Infrastructure

### Primary Data Tables

```yaml
database_tables:
  trades:
    purpose: "Complete trade execution history"
    key_fields:
      - id: UUID
      - symbol: TEXT
      - side: "buy | sell"
      - quantity: NUMERIC
      - price: NUMERIC
      - executedAt: TIMESTAMP
      - pnl: NUMERIC
      - status: "completed | pending | rejected"
      - traceId: TEXT  # Links to orchestrator cycle
      - strategyId: UUID

  positions:
    purpose: "Current open positions with real-time P&L"
    key_fields:
      - id: UUID
      - symbol: TEXT
      - quantity: NUMERIC
      - entryPrice: NUMERIC
      - currentPrice: NUMERIC
      - unrealizedPnl: NUMERIC
      - side: "long | short"
      - openedAt: TIMESTAMP
      - strategyId: UUID

  orders:
    purpose: "Order lifecycle tracking with broker integration"
    key_fields:
      - id: UUID
      - brokerOrderId: TEXT  # Alpaca order ID
      - clientOrderId: TEXT  # Idempotency key
      - symbol: TEXT
      - side: TEXT
      - type: "market | limit | stop | stop_limit | trailing_stop"
      - status: "new | accepted | partially_filled | filled | canceled | rejected"
      - submittedAt: TIMESTAMP
      - filledAt: TIMESTAMP
      - filledQty: NUMERIC
      - filledAvgPrice: NUMERIC
      - traceId: TEXT
      - decisionId: UUID  # Links to AI decision

  fills:
    purpose: "Individual fill events for partial fills"
    key_fields:
      - id: UUID
      - orderId: UUID
      - brokerFillId: TEXT
      - qty: NUMERIC
      - price: NUMERIC
      - occurredAt: TIMESTAMP
```

### AI Decision Tracking

```yaml
ai_decision_tables:
  ai_decisions:
    purpose: "All AI-generated trading recommendations"
    key_fields:
      - id: UUID
      - symbol: TEXT
      - action: "buy | sell | hold"
      - confidence: NUMERIC  # 0-1
      - reasoning: TEXT
      - marketContext: TEXT
      - status: "pending | executed | rejected | skipped"
      - stopLoss: NUMERIC
      - takeProfit: NUMERIC
      - executedTradeId: UUID
      - traceId: TEXT
      - skipReason: TEXT  # If not executed

  ai_decision_features:
    purpose: "Feature vectors used for each decision"
    key_fields:
      - decisionId: UUID
      - volatility: NUMERIC
      - trendStrength: NUMERIC
      - signalAgreement: NUMERIC
      - sentimentScore: NUMERIC
      - peRatio: NUMERIC
      - rsi: NUMERIC
      - macdSignal: TEXT
      - volumeRatio: NUMERIC
      - marketCondition: TEXT
      - dataQuality: NUMERIC

  ai_trade_outcomes:
    purpose: "Outcome analysis for AI learning"
    key_fields:
      - decisionId: UUID
      - tradeId: UUID
      - predictionConfidence: NUMERIC
      - entryPrice: NUMERIC
      - exitPrice: NUMERIC
      - realizedPnl: NUMERIC
      - realizedPnlPercent: NUMERIC
      - holdingTimeMs: INTEGER
      - isWin: BOOLEAN
      - slippagePercent: NUMERIC
      - targetPriceHit: BOOLEAN
      - stopLossHit: BOOLEAN
      - maxDrawdown: NUMERIC
      - maxGain: NUMERIC
      - exitReason: TEXT
```

### Performance Metrics Computation

```yaml
metrics_formulas:
  win_rate:
    formula: "COUNT(isWin = true) / COUNT(*)"
    source: "ai_trade_outcomes"

  profit_factor:
    formula: "SUM(realizedPnl WHERE realizedPnl > 0) / ABS(SUM(realizedPnl WHERE realizedPnl < 0))"
    source: "ai_trade_outcomes"
    target: ">= 1.5"

  sharpe_ratio:
    formula: "(mean(daily_returns) / std(daily_returns)) * sqrt(252)"
    annualized: true
    target: ">= 1.0"

  sortino_ratio:
    formula: "(mean(daily_returns) / std(negative_returns_only)) * sqrt(252)"
    annualized: true
    target: ">= 1.5"

  max_drawdown:
    formula: "MAX((peak_equity - current_equity) / peak_equity)"
    source: "equity_curve"
    target: "<= 15%"

  average_holding_time:
    formula: "AVG(holdingTimeMs)"
    source: "ai_trade_outcomes"

  slippage_analysis:
    formula: "AVG(ABS(filledAvgPrice - expectedPrice) / expectedPrice)"
    target: "< 0.5%"
```

### Backtesting Infrastructure

```yaml
backtesting:
  engine_location: "/server/strategies/*.ts"

  supported_strategies:
    - momentum_strategy:
        function: "backtestMomentumStrategy()"
        default_lookback: 365 days

    - mean_reversion:
        function: "backtestMeanReversionStrategy()"
        default_lookback: 365 days

    - moving_average_crossover:
        function: "backtestMovingAverageStrategy()"
        default_lookback: 365 days

  output_metrics:
    - total_return_percent
    - sharpe_ratio
    - sortino_ratio
    - max_drawdown_percent
    - win_rate
    - profit_factor
    - total_trades
    - average_trade_pnl
    - equity_curve (array)

  simulation_features:
    - slippage_model: "0.5% for market orders"
    - commission_model: "Alpaca commission-free"
    - fill_assumption: "next bar open or close"
```

---

# 3. FAILURE MODE ATTRIBUTION

## A. AI Signal Errors

### False Positive Signals
```yaml
false_positive_detection:
  definition: "AI predicted move that did not occur"
  tracking:
    - field: "ai_trade_outcomes.isWin = false"
    - field: "ai_trade_outcomes.exitReason = 'stop_loss_hit'"

  common_causes:
    - sentiment_noise: "News sentiment misinterpreted"
    - overfitting: "Pattern matched historical but not current conditions"
    - data_lag: "Stale data led to outdated signal"

  mitigation:
    - increase_confidence_threshold: "Raise from 60% to 70%"
    - require_confirmation: "Wait for volume confirmation"
    - add_holding_period: "Minimum hold before exit"
```

### Confidence Calibration Issues
```yaml
confidence_calibration:
  tracking_table: "ai_calibration_log"

  metrics:
    - avgConfidenceOnWins: "Should be higher than losses"
    - avgConfidenceOnLosses: "Should be lower than wins"
    - calibration_error: "|predicted_prob - actual_win_rate|"

  ideal_state:
    - "70% confidence decisions should win 70% of time"
    - "90% confidence decisions should win 90% of time"

  recalibration_trigger:
    - condition: "calibration_error > 0.15"
    - action: "Adjust confidence thresholds"
```

## B. Integration Failures

### Order Rejection Analysis
```yaml
order_rejections:
  tracking: "orders WHERE status = 'rejected'"

  common_reasons:
    insufficient_buying_power:
      frequency: "Most common"
      recovery: "Reduce position size by 50%, retry max 2 times"

    symbol_not_tradable:
      frequency: "Occasional"
      recovery: "Skip and log, update tradability cache"

    pattern_day_trader:
      frequency: "Rare (paper trading)"
      recovery: "Alert user, halt day trading"

    market_closed:
      frequency: "Edge case"
      recovery: "Convert to GTC limit order"
```

### Position Sync Discrepancies
```yaml
position_sync:
  frequency: "Every 60 seconds"
  reconciliation: "Every 5 minutes"

  discrepancy_detection:
    threshold: "1 share OR 1%"
    action: "ALERT_AND_RECONCILE"

  common_causes:
    - external_fills: "Orders filled outside system"
    - database_lag: "DB not updated after fill"
    - api_timeout: "Fill confirmation not received"

  resolution:
    - "Fetch positions from Alpaca"
    - "Compare with database positions"
    - "Update database to match broker"
    - "Log discrepancy for audit"
```

## C. Execution Quality

### Slippage Analysis
```yaml
slippage_tracking:
  calculation: "(filledAvgPrice - expectedPrice) / expectedPrice"

  expected_ranges:
    market_orders:
      min: "-0.5%"
      max: "+0.5%"
      alert_threshold: "1.0%"

    limit_orders:
      expected: "0% (at limit or better)"

    stop_orders:
      min: "-1.0%"
      max: "+1.0%"
      note: "Higher slippage expected during gaps"

  high_slippage_causes:
    - low_liquidity: "ADV < 1M shares"
    - high_volatility: "ATR percentile > 80"
    - large_order_size: "Order > 1% of ADV"
    - market_gaps: "Overnight or halt gaps"
```

### Order Type Selection Impact
```yaml
order_type_performance:
  market_orders:
    pros: "Guaranteed fill"
    cons: "Slippage risk"
    best_for: "High liquidity, urgent exits"

  limit_orders:
    pros: "Price control"
    cons: "May not fill"
    best_for: "Non-urgent entries, wide spreads"

  bracket_orders:
    pros: "Automatic risk management"
    cons: "Cannot modify legs easily"
    best_for: "Standard entries with SL/TP"

  trailing_stops:
    pros: "Lock in profits"
    cons: "Whipsaw in volatile markets"
    best_for: "Trending positions"
```

## D. Data Quality Issues

### Source Conflict Detection
```yaml
data_quality:
  fusion_engine: "/server/ai/data-fusion-engine.ts"

  conflict_detection:
    agreement_threshold: 0.6
    warning_trigger: "agreement < 0.6"

  source_reliability_weights:
    alpaca: 0.95
    finnhub: 0.90
    valyu: 0.90
    coingecko: 0.85
    newsapi: 0.75
    huggingface: 0.80
    gdelt: 0.80

  quality_metrics:
    completeness: "0-1 (% of required fields present)"
    freshness: "0-1 (time since last update)"
    reliability: "0-1 (source track record)"

  graceful_degradation:
    - "If primary source fails, use secondary"
    - "If sentiment sources conflict, use weighted average"
    - "If no news available, reduce sentiment weight"
```

---

# 4. SUCCESS PATTERN IDENTIFICATION

## Winning Trade Characteristics

### Technical Indicator Configurations
```yaml
winning_patterns:
  trend_following:
    rsi_range: [40, 60]  # Not oversold or overbought
    macd_histogram: "positive and increasing"
    price_vs_sma: "price > SMA20 > SMA50"
    volume_confirmation: "relative_volume > 1.2"

  mean_reversion:
    rsi_level: "< 30 (oversold)"
    bollinger_position: "below lower band"
    recovery_signal: "price crossing back above lower band"
    fundamental_quality: "score >= 65"

  momentum:
    roc_threshold: "> 2% (balanced preset)"
    rsi_confirmation: "between 30-70"
    trend_strength: "ADX > 25"
```

### Market Condition Correlations
```yaml
market_conditions:
  bullish_regime:
    vix_level: "< 20"
    spy_trend: "above SMA50 and SMA200"
    breadth: "> 60% advancers"
    best_strategies: ["momentum", "trend_following"]
    position_size_multiplier: 1.2

  neutral_regime:
    vix_level: "20-25"
    spy_trend: "mixed signals"
    breadth: "40-60%"
    best_strategies: ["mean_reversion", "range_trading"]
    position_size_multiplier: 1.0

  bearish_regime:
    vix_level: "> 25"
    spy_trend: "below SMA50"
    breadth: "< 40% advancers"
    best_strategies: ["defensive", "cash_preservation"]
    position_size_multiplier: 0.5
```

### Time-of-Day Patterns
```yaml
time_patterns:
  market_open:
    window: "09:30 - 10:00 ET"
    characteristics: "High volatility, wide spreads"
    recommendation: "Avoid new positions"

  morning_session:
    window: "10:00 - 12:00 ET"
    characteristics: "Trend establishment"
    recommendation: "Good for momentum entries"

  midday:
    window: "12:00 - 14:00 ET"
    characteristics: "Lower volume, range-bound"
    recommendation: "Good for mean reversion"

  afternoon:
    window: "14:00 - 15:30 ET"
    characteristics: "Institutional activity picks up"
    recommendation: "Best for trend continuation"

  market_close:
    window: "15:30 - 16:00 ET"
    characteristics: "End-of-day positioning"
    recommendation: "Avoid new positions, manage exits"
```

### Sector Performance Correlations
```yaml
sector_analysis:
  outperformers_in_risk_on:
    - technology
    - consumer_discretionary
    - communication_services

  outperformers_in_risk_off:
    - utilities
    - consumer_staples
    - healthcare

  rate_sensitive:
    rising_rates_underweight:
      - utilities
      - real_estate
      - high_growth_tech
    rising_rates_overweight:
      - financials
      - value_stocks
```

---

# 5. ALGORITHM SPECIFICATION

## 5.1 Universe Definition

```yaml
universe_specification:
  # ═══════════════════════════════════════════════════════════
  # PRIMARY UNIVERSE - STOCKS
  # ═══════════════════════════════════════════════════════════
  stocks:
    default_watchlist:
      large_cap_tech:
        - AAPL   # Apple
        - MSFT   # Microsoft
        - GOOGL  # Alphabet
        - AMZN   # Amazon
        - NVDA   # NVIDIA
        - META   # Meta Platforms
        - TSLA   # Tesla

      financials:
        - JPM    # JPMorgan Chase
        - V      # Visa
        - MA     # Mastercard
        - BAC    # Bank of America
        - GS     # Goldman Sachs

      healthcare:
        - UNH    # UnitedHealth
        - JNJ    # Johnson & Johnson
        - PFE    # Pfizer
        - ABBV   # AbbVie

      consumer:
        - WMT    # Walmart
        - HD     # Home Depot
        - MCD    # McDonald's
        - NKE    # Nike
        - SBUX   # Starbucks

      industrials:
        - CAT    # Caterpillar
        - BA     # Boeing
        - UPS    # UPS
        - HON    # Honeywell

      other:
        - XOM    # Exxon Mobil
        - CVX    # Chevron
        - DIS    # Disney
        - NFLX   # Netflix
        - AMD    # AMD
        - CRM    # Salesforce
        - ORCL   # Oracle
        - INTC   # Intel
        - PYPL   # PayPal
        - SQ     # Block (Square)
        - COIN   # Coinbase
        - SHOP   # Shopify
        - UBER   # Uber
        - ABNB   # Airbnb

    total_stock_count: 38

    selection_criteria:
      min_market_cap: "$10B"
      min_avg_daily_volume: "1M shares"
      min_price: "$10.00"
      max_price: "$2000.00"
      listing_exchange: ["NYSE", "NASDAQ"]

  # ═══════════════════════════════════════════════════════════
  # CRYPTO UNIVERSE
  # ═══════════════════════════════════════════════════════════
  crypto:
    supported_pairs:
      - BTC/USD   # Bitcoin
      - ETH/USD   # Ethereum
      - SOL/USD   # Solana

    category_limits:
      large_cap:
        symbols: ["BTC/USD", "ETH/USD"]
        max_position_size: 15%
        min_confidence: 0.6
        volatility_multiplier: 1.0

      mid_cap:
        symbols: ["SOL/USD"]
        max_position_size: 10%
        min_confidence: 0.65
        volatility_multiplier: 1.5

      small_cap:
        symbols: []  # Future expansion
        max_position_size: 5%
        min_confidence: 0.7
        volatility_multiplier: 2.0

      meme:
        symbols: []  # Not currently supported
        max_position_size: 3%
        min_confidence: 0.75
        volatility_multiplier: 3.0

  # ═══════════════════════════════════════════════════════════
  # TRADABILITY VALIDATION
  # ═══════════════════════════════════════════════════════════
  tradability:
    validation_service: "/server/services/tradability-service.ts"

    checks:
      - is_tradable: true
      - is_active: true
      - has_valid_price: true

    optional_requirements:
      - fractionable: "preferred for stocks"
      - shortable: "required for short strategies"
      - marginable: "required for leverage"

    cache_ttl: "1 hour"

  # ═══════════════════════════════════════════════════════════
  # DYNAMIC FILTERING
  # ═══════════════════════════════════════════════════════════
  daily_filters:
    relative_volume:
      calculation: "volume / SMA(volume, 20)"
      min_threshold: 0.8  # At least 80% of average
      ideal_range: [1.2, 3.0]  # 120-300% of average

    volatility_filter:
      calculation: "ATR percentile over 252 days"
      acceptable_range: [20, 80]  # Avoid extremes

    spread_filter:
      max_spread_percent: 0.5%  # Max bid-ask spread

    news_recency:
      preferred: "Has news within 24 hours"
      weight_adjustment: "+10% sentiment weight if recent news"
```

## 5.2 Multi-Factor Scoring Model

```yaml
factor_model:
  # ═══════════════════════════════════════════════════════════
  # FUNDAMENTALS (Weight: 20% of total score)
  # ═══════════════════════════════════════════════════════════
  fundamentals:
    total_weight: 0.20
    data_source: "Valyu.ai connector"
    cache_ttl: "24 hours"

    factors:
      earnings_metrics:
        weight: 0.25
        sub_factors:
          eps_surprise:
            calculation: "(actual_eps - consensus_eps) / abs(consensus_eps)"
            scoring:
              - range: [0.10, inf]
                score: 1.0
                label: "strong_beat"
              - range: [0.05, 0.10]
                score: 0.7
                label: "beat"
              - range: [0.00, 0.05]
                score: 0.4
                label: "slight_beat"
              - range: [-0.05, 0.00]
                score: 0.2
                label: "slight_miss"
              - range: [-inf, -0.05]
                score: 0.0
                label: "miss"

          revenue_growth_yoy:
            calculation: "(revenue_ttm - revenue_ttm_prior) / revenue_ttm_prior"
            scoring:
              - range: [0.20, inf]
                score: 1.0
              - range: [0.10, 0.20]
                score: 0.7
              - range: [0.00, 0.10]
                score: 0.4
              - range: [-inf, 0.00]
                score: 0.0

      valuation_ratios:
        weight: 0.25
        sub_factors:
          pe_ratio:
            calculation: "price / eps_ttm"
            scoring:
              - condition: "PE < sector_median * 0.7"
                score: 1.0
                label: "undervalued"
              - condition: "PE between sector_median * 0.7 and 1.0"
                score: 0.7
              - condition: "PE between sector_median * 1.0 and 1.3"
                score: 0.4
              - condition: "PE > sector_median * 1.3"
                score: 0.2
                label: "overvalued"

          pb_ratio:
            calculation: "price / book_value_per_share"
            scoring: "linear_scale(0.5, 3.0)"

          ps_ratio:
            calculation: "market_cap / revenue_ttm"
            scoring: "sector_relative"

      profitability:
        weight: 0.20
        sub_factors:
          roe:
            calculation: "net_income / shareholders_equity"
            scoring:
              - range: [0.20, inf]
                score: 1.0
              - range: [0.15, 0.20]
                score: 0.8
              - range: [0.10, 0.15]
                score: 0.6
              - range: [0.05, 0.10]
                score: 0.4
              - range: [-inf, 0.05]
                score: 0.2

          gross_margin:
            calculation: "(revenue - cogs) / revenue"
            scoring: "sector_relative_percentile"

          net_profit_margin:
            calculation: "net_income / revenue"
            scoring: "linear_scale(0, 0.20)"

      balance_sheet:
        weight: 0.15
        sub_factors:
          debt_to_equity:
            calculation: "total_debt / total_equity"
            scoring:
              - range: [0, 0.3]
                score: 1.0
              - range: [0.3, 0.6]
                score: 0.7
              - range: [0.6, 1.0]
                score: 0.4
              - range: [1.0, inf]
                score: 0.2

          current_ratio:
            calculation: "current_assets / current_liabilities"
            optimal_range: [1.5, 3.0]

          fcf_yield:
            calculation: "free_cash_flow / market_cap"
            scoring: "linear_scale(0, 0.10)"

      insider_activity:
        weight: 0.15
        source: "valyu.getInsiderTransactions()"
        sub_factors:
          net_insider_sentiment:
            calculation: |
              buy_value = SUM(insider_buys_90d)
              sell_value = SUM(insider_sells_90d)
              if buy_value > sell_value * 1.5:
                return "bullish"
              elif sell_value > buy_value * 1.5:
                return "bearish"
              else:
                return "neutral"
            scoring:
              bullish: 1.0
              neutral: 0.5
              bearish: 0.2

  # ═══════════════════════════════════════════════════════════
  # TECHNICAL (Weight: 30% of total score)
  # ═══════════════════════════════════════════════════════════
  technical:
    total_weight: 0.30
    data_source: "/server/lib/technical-indicators.ts"

    factors:
      trend_indicators:
        weight: 0.20
        sub_factors:
          sma_alignment:
            periods: [20, 50, 200]
            calculation: |
              bullish_count = 0
              if price > SMA20: bullish_count += 1
              if SMA20 > SMA50: bullish_count += 1
              if SMA50 > SMA200: bullish_count += 1
              return bullish_count / 3
            scoring: "direct (0-1)"

          ema_crossover:
            fast_period: 12
            slow_period: 26
            scoring:
              bullish_cross: 1.0
              bullish_above: 0.7
              neutral: 0.5
              bearish_below: 0.3
              bearish_cross: 0.0

          adx_trend_strength:
            period: 14
            scoring:
              - range: [0, 20]
                score: 0.3
                label: "weak_trend"
              - range: [20, 25]
                score: 0.5
                label: "developing_trend"
              - range: [25, 50]
                score: 0.8
                label: "strong_trend"
              - range: [50, 100]
                score: 1.0
                label: "very_strong_trend"

      momentum_indicators:
        weight: 0.25
        sub_factors:
          rsi:
            period: 14
            calculation: "100 - (100 / (1 + avg_gain / avg_loss))"
            scoring_for_trend_following:
              - range: [40, 60]
                score: 1.0
                label: "optimal"
              - range: [30, 40]
                score: 0.7
              - range: [60, 70]
                score: 0.7
              - range: [0, 30]
                score: 0.3
                label: "oversold"
              - range: [70, 100]
                score: 0.3
                label: "overbought"

          macd:
            fast_period: 12
            slow_period: 26
            signal_period: 9
            calculation: |
              macd_line = EMA(12) - EMA(26)
              signal_line = EMA(macd_line, 9)
              histogram = macd_line - signal_line
            scoring:
              histogram_positive_increasing: 1.0
              histogram_positive_decreasing: 0.7
              histogram_negative_increasing: 0.4
              histogram_negative_decreasing: 0.2

          roc:
            periods: [5, 10, 20]
            weights: [0.5, 0.3, 0.2]
            calculation: "(price - price_n_ago) / price_n_ago"
            composite: "weighted_sum(roc_values, weights)"

      volatility_analysis:
        weight: 0.15
        sub_factors:
          atr:
            period: 14
            calculation: "Smoothed average of True Range"
            percentile_scoring:
              - range: [0, 30]
                score: 0.8
                strategy_bias: "mean_reversion"
              - range: [30, 70]
                score: 1.0
                strategy_bias: "neutral"
              - range: [70, 100]
                score: 0.6
                strategy_bias: "momentum_with_tight_stops"

          bollinger_bands:
            period: 20
            std_multiplier: 2
            scoring:
              above_upper: 0.2
              near_upper: 0.4
              middle_zone: 0.6
              near_lower: 0.8
              below_lower: 1.0  # For mean reversion

      volume_analysis:
        weight: 0.15
        sub_factors:
          relative_volume:
            calculation: "volume / SMA(volume, 20)"
            scoring: "linear_scale(0.8, 2.0)"

          obv_trend:
            calculation: "On-Balance Volume slope over 10 periods"
            scoring:
              positive_slope: 1.0
              flat: 0.5
              negative_slope: 0.2

          volume_price_confirmation:
            calculation: "(price_up == volume_up)"
            scoring:
              confirmed: 1.0
              not_confirmed: 0.5

      support_resistance:
        weight: 0.15
        sub_factors:
          distance_to_support:
            calculation: "(price - nearest_support) / price"
            optimal_range: [0.02, 0.05]  # 2-5% above support

          distance_to_resistance:
            calculation: "(nearest_resistance - price) / price"

          risk_reward_ratio:
            calculation: "distance_to_resistance / distance_to_support"
            min_acceptable: 2.0

      pattern_recognition:
        weight: 0.10
        patterns:
          bullish:
            - "golden_cross"  # SMA50 crosses above SMA200
            - "bullish_macd_cross"
            - "oversold_rsi_bounce"
            - "volume_breakout"
          bearish:
            - "death_cross"  # SMA50 crosses below SMA200
            - "bearish_macd_cross"
            - "overbought_rsi_reversal"
        recency_weight: "exponential_decay(halflife=5_bars)"

  # ═══════════════════════════════════════════════════════════
  # SENTIMENT (Weight: 20% of total score)
  # ═══════════════════════════════════════════════════════════
  sentiment:
    total_weight: 0.20
    aggregator: "/server/services/sentiment-aggregator.ts"

    factors:
      news_sentiment:
        weight: 0.35
        sources:
          gdelt:
            reliability: 0.80
            update_frequency: "15 minutes"
            cost: "FREE"
            features:
              - averageTone
              - articleCount
              - volumeSpike
            calculation: |
              tone = gdelt.averageTone
              if tone > 2: sentiment = "bullish"
              elif tone < -2: sentiment = "bearish"
              else: sentiment = "neutral"
              confidence = min(0.9, articleCount / 50)

          newsapi:
            reliability: 0.75
            limit: "100 requests/day"
            features:
              - headline_text
              - source_credibility
              - recency

        aggregation:
          method: "reliability_weighted_average"
          conflict_threshold: 0.6

        scoring:
          - range: [0.5, 1.0]
            score: 1.0
            label: "strongly_bullish"
          - range: [0.2, 0.5]
            score: 0.75
            label: "bullish"
          - range: [-0.2, 0.2]
            score: 0.5
            label: "neutral"
          - range: [-0.5, -0.2]
            score: 0.25
            label: "bearish"
          - range: [-1.0, -0.5]
            score: 0.0
            label: "strongly_bearish"

      ai_sentiment:
        weight: 0.35
        source: "HuggingFace FinBERT"
        model: "ProsusAI/finbert"
        calculation: |
          for each headline:
            sentiment = finbert.classify(headline)
            weight = recency_weight * source_credibility
          aggregate_sentiment = weighted_average(sentiments)
        scoring: "linear_scale(-1, 1)"

      news_volume:
        weight: 0.15
        calculation: |
          current_count = COUNT(articles, last_24h)
          baseline = MEAN(daily_article_count, 30_days)
          ratio = current_count / baseline
        interpretation:
          - condition: "ratio > 3.0"
            label: "news_spike"
            action: "increase_attention"
          - condition: "ratio < 0.3"
            label: "news_vacuum"
            action: "reduce_confidence"

      social_sentiment:
        weight: 0.15
        sources:
          - stocktwits
          - reddit_wsb
          - twitter
        calculation: |
          mention_velocity = mentions_24h / mentions_7d_avg
          sentiment_shift = sentiment_24h - sentiment_7d
        scoring:
          mention_score: "log_scale(mention_velocity)"
          sentiment_score: "linear_scale(sentiment_shift, -0.3, 0.3)"

  # ═══════════════════════════════════════════════════════════
  # MACRO (Weight: 15% of total score)
  # ═══════════════════════════════════════════════════════════
  macro:
    total_weight: 0.15
    data_source: "FRED connector"

    factors:
      market_regime:
        weight: 0.30
        indicators:
          vix:
            series_id: "VIXCLS"
            regimes:
              risk_on:
                condition: "VIX < 15"
                position_multiplier: 1.2
                score: 1.0
              normal:
                condition: "15 <= VIX < 20"
                position_multiplier: 1.0
                score: 0.8
              elevated:
                condition: "20 <= VIX < 25"
                position_multiplier: 0.8
                score: 0.5
              risk_off:
                condition: "25 <= VIX < 35"
                position_multiplier: 0.5
                score: 0.3
              extreme:
                condition: "VIX >= 35"
                position_multiplier: 0.1
                score: 0.1

          spy_trend:
            calculation: |
              bullish = SPY > SMA50 AND SMA50 > SMA200
              bearish = SPY < SMA50 AND SMA50 < SMA200
              neutral = otherwise

          market_breadth:
            calculation: "advancers / (advancers + decliners)"
            scoring:
              - range: [0.6, 1.0]
                score: 1.0
                label: "broad_rally"
              - range: [0.4, 0.6]
                score: 0.5
                label: "mixed"
              - range: [0.0, 0.4]
                score: 0.2
                label: "broad_decline"

      interest_rates:
        weight: 0.25
        indicators:
          fed_funds:
            series_id: "FEDFUNDS"
          treasury_10y:
            series_id: "DGS10"
          treasury_2y:
            series_id: "DGS2"
          yield_curve:
            series_id: "T10Y2Y"
            warning: "Inversion (negative) signals recession risk"

        impact_mapping:
          rising_rates:
            underweight: ["utilities", "real_estate", "high_pe_growth"]
            overweight: ["financials", "value"]
          falling_rates:
            underweight: ["financials"]
            overweight: ["growth", "real_estate", "utilities"]
          inverted_curve:
            action: "shift_to_defensive_mode"

      inflation:
        weight: 0.20
        indicators:
          cpi:
            series_id: "CPIAUCSL"
          core_cpi:
            series_id: "CPILFESL"
          pce:
            series_id: "PCEPI"
        scoring: "z_score_relative_to_history"

      employment:
        weight: 0.15
        indicators:
          unemployment_rate:
            series_id: "UNRATE"
            scoring:
              - range: [0, 4]
                score: 1.0
                label: "full_employment"
              - range: [4, 6]
                score: 0.7
              - range: [6, 8]
                score: 0.4
              - range: [8, inf]
                score: 0.2
          jobless_claims:
            series_id: "ICSA"
            scoring: "4_week_trend"

      consumer_sentiment:
        weight: 0.10
        indicator:
          series_id: "UMCSENT"
          scoring: "percentile_vs_history"

  # ═══════════════════════════════════════════════════════════
  # MICRO (Weight: 10% of total score)
  # ═══════════════════════════════════════════════════════════
  micro:
    total_weight: 0.10

    factors:
      earnings_catalyst:
        weight: 0.30
        rules:
          - condition: "days_to_earnings < 5"
            action: "no_new_positions"
            reason: "binary_event_risk"
          - condition: "days_to_earnings < 14"
            action: "reduce_position_size_by_30%"
          - condition: "days_since_earnings < 3"
            action: "watch_for_post_earnings_drift"
        data_source: "valyu.getEarnings()"

      insider_transactions:
        weight: 0.25
        calculation: |
          net_insider = SUM(buys_90d) - SUM(sells_90d)
          if net_insider > 0: signal = "bullish"
          elif net_insider < 0: signal = "bearish"
          else: signal = "neutral"
        warning: "Log when significant insider selling detected"

      52_week_range:
        weight: 0.20
        calculation: "(price - week52_low) / (week52_high - week52_low)"
        scoring:
          near_low: # < 0.2
            interpretation: "potential_value_or_falling_knife"
            requires_fundamental_confirmation: true
          middle: # 0.2 - 0.8
            interpretation: "normal_range"
          near_high: # > 0.8
            interpretation: "momentum_or_overextended"
            requires_momentum_confirmation: true

      short_interest:
        weight: 0.15
        calculation: |
          si_ratio = shares_short / float
          days_to_cover = shares_short / avg_daily_volume
        scoring:
          squeeze_potential:
            condition: "si_ratio > 0.20 AND days_to_cover > 5 AND momentum_positive"
            score_boost: 0.2
          bearish_signal:
            condition: "si_change_30d > 0.10"
            score_penalty: 0.1

      float_dynamics:
        weight: 0.10
        calculation: |
          float_rotation = volume_5d / float
          inst_ownership = institutional_shares / shares_outstanding
        scoring:
          high_rotation: "float_rotation > 2.0 => volatility_warning"
          stable_ownership: "inst_ownership in [0.4, 0.8] => stability_bonus"

  # ═══════════════════════════════════════════════════════════
  # MOMENTUM (Weight: 5% of total score)
  # ═══════════════════════════════════════════════════════════
  momentum:
    total_weight: 0.05

    factors:
      price_momentum:
        weight: 0.50
        timeframes:
          - period: 5
            weight: 0.15
          - period: 10
            weight: 0.20
          - period: 20
            weight: 0.25
          - period: 60
            weight: 0.25
          - period: 120
            weight: 0.15
        calculation: |
          for each timeframe:
            roc = (price - price_n_days_ago) / price_n_days_ago
            z_score = (roc - mean_roc_universe) / std_roc_universe
          composite = weighted_sum(z_scores, weights)
        scoring: "percentile_rank_in_universe"

      relative_strength:
        weight: 0.30
        calculation: |
          rs_vs_spy = symbol_return_60d / spy_return_60d
          rs_vs_sector = symbol_return_60d / sector_return_60d
        scoring:
          rs_spy: "linear_scale(0.8, 1.2)"
          rs_sector: "linear_scale(0.9, 1.1)"
          composite: "0.6 * rs_spy + 0.4 * rs_sector"

      earnings_momentum:
        weight: 0.20
        calculation: |
          eps_revision = (estimate_current - estimate_90d_ago) / abs(estimate_90d_ago)
          revenue_revision = similar_for_revenue
        scoring: "linear_scale(-0.10, 0.10)"
```

## 5.3 Signal Generation Logic

```yaml
signal_generation:
  # ═══════════════════════════════════════════════════════════
  # COMPOSITE SCORE CALCULATION
  # ═══════════════════════════════════════════════════════════
  score_calculation:
    formula: |
      # Calculate individual factor scores (each normalized 0-100)
      fundamentals_score = calculate_fundamentals_score(symbol)
      technical_score = calculate_technical_score(symbol)
      sentiment_score = calculate_sentiment_score(symbol)
      macro_score = calculate_macro_score()
      micro_score = calculate_micro_score(symbol)
      momentum_score = calculate_momentum_score(symbol)

      # Weighted composite
      raw_score = (
        fundamentals_score * 0.20 +
        technical_score * 0.30 +
        sentiment_score * 0.20 +
        macro_score * 0.15 +
        micro_score * 0.10 +
        momentum_score * 0.05
      )

      # Apply market regime adjustment
      regime_multiplier = get_market_regime_multiplier()
      adjusted_score = raw_score * regime_multiplier

      # Apply sector rotation adjustment
      sector_multiplier = get_sector_rotation_multiplier(symbol)
      final_score = adjusted_score * sector_multiplier

      # Normalize to 0-100
      return clip(final_score, 0, 100)

    normalization: "min_max_scale(0, 100)"

  # ═══════════════════════════════════════════════════════════
  # SIGNAL THRESHOLDS
  # ═══════════════════════════════════════════════════════════
  thresholds:
    strong_buy:
      score_range: [80, 100]
      position_size: "full"
      conviction: "high"
      confidence_boost: 0.1

    buy:
      score_range: [65, 80]
      position_size: "standard"
      conviction: "medium"

    weak_buy:
      score_range: [55, 65]
      position_size: "reduced"
      conviction: "low"
      additional_confirmation_required: true

    hold:
      score_range: [45, 55]
      action: "no_new_positions"
      existing_positions: "maintain"

    weak_sell:
      score_range: [35, 45]
      action: "reduce_position"
      reduction_amount: "50%"

    sell:
      score_range: [20, 35]
      action: "exit_position"
      urgency: "end_of_day"

    strong_sell:
      score_range: [0, 20]
      action: "exit_position"
      urgency: "immediate"

  # ═══════════════════════════════════════════════════════════
  # CONFIRMATION REQUIREMENTS
  # ═══════════════════════════════════════════════════════════
  confirmation_rules:
    entry_requirements:
      minimum_factors_aligned: 4  # Out of 6 factor categories
      no_factor_below: 30  # Individual factor score floor
      volume_confirmation: true  # Relative volume > 1.2
      no_earnings_within_days: 5
      ai_confidence_minimum: 0.6

    exit_triggers:
      - stop_loss_hit: true
      - take_profit_hit: true
      - score_drops_below: 40
      - holding_period_exceeded: "strategy_dependent"
      - factor_deterioration: "2_or_more_factors_flip_bearish"
      - kill_switch_activated: true

  # ═══════════════════════════════════════════════════════════
  # AI DECISION STRUCTURE
  # ═══════════════════════════════════════════════════════════
  ai_decision_output:
    structure:
      action: "buy | sell | hold"
      confidence: "0.0 - 1.0"
      reasoning: "2-3 sentence explanation"
      riskLevel: "low | medium | high"
      suggestedQuantity: "0.01 - 0.25 (% of portfolio)"
      targetPrice: "take profit level"
      stopLoss: "stop loss level"
      trailingStopPercent: "0.5 - 20% (optional)"

    source: "/server/ai/decision-engine.ts"
    llm_config:
      temperature: 0.3
      max_tokens: 1024
      response_format: "json_object"
      retries: 2
      timeout_ms: 5000
```

## 5.4 Position Sizing & Risk Management

```yaml
position_sizing:
  # ═══════════════════════════════════════════════════════════
  # BASE POSITION CALCULATION
  # ═══════════════════════════════════════════════════════════
  base_calculation:
    method: "risk_parity_with_conviction"
    formula: |
      # Step 1: Calculate available capital
      total_capital = buying_power * (capital_utilization_pct / 100)

      # Step 2: Risk-based position size
      position_risk = (risk_per_trade_pct / 100) * total_capital
      stop_distance = entry_price - stop_loss_price
      shares_by_risk = position_risk / stop_distance

      # Step 3: Conviction adjustment
      conviction_multiplier = {
        "high": 1.0,     # 80%+ confidence
        "medium": 0.7,   # 60-79% confidence
        "low": 0.5       # 40-59% confidence
      }[signal.conviction]

      # Step 4: Volatility adjustment (ATR-based)
      atr_percentile = percentile_rank(ATR(14), lookback=252)
      atr_multiplier = clip(1.0 / (atr_percentile / 50), 0.5, 1.5)

      # Step 5: Market regime adjustment
      vix_scaling = get_vix_scaling_factor()
      performance_scaling = get_performance_scaling_factor()
      time_scaling = get_time_scaling_factor()
      regime_multiplier = vix_scaling * performance_scaling * time_scaling

      # Step 6: Final calculation
      raw_shares = shares_by_risk * conviction_multiplier * atr_multiplier * regime_multiplier

      # Step 7: Apply concentration limits
      max_by_liquidity = avg_daily_volume * 0.01
      max_by_concentration = (total_capital * max_single_position_pct) / entry_price
      max_by_portfolio = (total_capital / max_positions_count) / entry_price

      final_shares = floor(min(raw_shares, max_by_liquidity, max_by_concentration, max_by_portfolio))

  # ═══════════════════════════════════════════════════════════
  # DEFAULT RISK LIMITS
  # ═══════════════════════════════════════════════════════════
  default_limits:
    maxPositionSizePercent: 10
    maxTotalExposurePercent: 50
    maxPositionsCount: 10
    dailyLossLimitPercent: 5
    killSwitchActive: false

  aggressive_limits:
    maxPositionSizePercent: 15
    maxTotalExposurePercent: 95
    maxPositionsCount: 100
    dailyLossLimitPercent: 5
    note: "5% cash reserve maintained"

  conservative_limits:
    maxPositionSizePercent: 5
    maxTotalExposurePercent: 30
    maxPositionsCount: 5
    dailyLossLimitPercent: 3

  # ═══════════════════════════════════════════════════════════
  # VOLATILITY REGIMES (VIX-Based)
  # ═══════════════════════════════════════════════════════════
  volatility_regimes:
    normal:
      condition: "VIX < 15"
      scaling_factor: 1.0
      new_positions_allowed: true

    elevated:
      condition: "15 <= VIX < 25"
      scaling_factor: 0.8
      new_positions_allowed: true

    high:
      condition: "25 <= VIX < 35"
      scaling_factor: 0.6
      new_positions_allowed: false

    extreme:
      condition: "VIX >= 35"
      scaling_factor: 0.1
      new_positions_allowed: false
      action: "EMERGENCY_MODE - close only"

  # ═══════════════════════════════════════════════════════════
  # PERFORMANCE-BASED SCALING
  # ═══════════════════════════════════════════════════════════
  performance_regimes:
    strong:
      condition: "24h_pnl_percent > 2%"
      scaling_factor: 1.0

    normal:
      condition: "-0.5% <= 24h_pnl_percent <= 2%"
      scaling_factor: 1.0

    weak:
      condition: "-2% <= 24h_pnl_percent < -0.5%"
      scaling_factor: 0.7

    critical:
      condition: "24h_pnl_percent < -2%"
      scaling_factor: 0.4

  # ═══════════════════════════════════════════════════════════
  # TIME-BASED SCALING
  # ═══════════════════════════════════════════════════════════
  time_regimes:
    market_open:
      window: "09:30 - 10:30 ET"
      scaling_factor: 0.9
      reason: "First hour volatility"

    normal_hours:
      window: "10:30 - 15:00 ET"
      scaling_factor: 1.0

    market_close:
      window: "15:00 - 16:00 ET"
      scaling_factor: 0.7
      reason: "Limit overnight risk"

    after_hours:
      window: "Outside 09:30 - 16:00 ET"
      scaling_factor: 0.5

  # ═══════════════════════════════════════════════════════════
  # LOSS PROTECTION
  # ═══════════════════════════════════════════════════════════
  loss_protection:
    source: "/server/trading/alpaca-trading-engine.ts:435-469"
    rules:
      - "Block sell orders at loss unless stop-loss or emergency"
      - "Allow if notes contains 'stop-loss' or 'emergency'"
      - "Log loss percentage and block reason"
    purpose: "Prevent panic selling at unfavorable prices"

  # ═══════════════════════════════════════════════════════════
  # CONCENTRATION LIMITS
  # ═══════════════════════════════════════════════════════════
  concentration_limits:
    max_single_position_pct: 10
    max_sector_exposure_pct: 35
    max_correlated_exposure_pct: 50
    max_adv_participation: 0.01  # 1% of average daily volume
    min_liquidity_threshold: 1000000  # $1M ADV minimum
```

## 5.5 Execution Engine

```yaml
execution_engine:
  # ═══════════════════════════════════════════════════════════
  # PRE-VALIDATION CHECKS
  # ═══════════════════════════════════════════════════════════
  pre_validation:
    security_checks:
      - name: "quantity_validation"
        check: "quantity > 0 AND is_finite(quantity)"

      - name: "orchestrator_control"
        check: "authorized_by_orchestrator OR orchestrator_control_disabled"

      - name: "kill_switch"
        check: "kill_switch_active == false"

    loss_protection:
      - name: "sell_at_loss_check"
        applies_to: "side == 'sell'"
        check: "position_profitable OR notes contains 'stop-loss' OR 'emergency'"

    risk_limits:
      - name: "position_count"
        check: "current_positions < max_positions OR symbol_already_held"

      - name: "position_size"
        check: "trade_value <= buying_power * max_position_size_pct"

      - name: "daily_loss"
        check: "abs(daily_pnl) < equity * daily_loss_limit_pct"

    tradability:
      - name: "symbol_tradable"
        check: "tradability_service.validate(symbol).tradable"

      - name: "valid_price"
        check: "current_price > 0"

  # ═══════════════════════════════════════════════════════════
  # ORDER CONSTRUCTION
  # ═══════════════════════════════════════════════════════════
  order_construction:
    position_size:
      formula: |
        shares = floor(trade_value / current_price)
        shares = min(shares, max_by_liquidity, max_by_concentration)

    order_type_selection:
      bracket_order:
        conditions:
          - "side == 'buy'"
          - "stop_loss AND take_profit defined"
          - "NOT crypto"
          - "NOT extended_hours"
        params:
          - take_profit_limit_price
          - stop_loss_stop_price
          - time_in_force: "day"  # CRITICAL: Must be "day" - "gtc" causes HTTP 422 rejection

      trailing_stop:
        conditions:
          - "side == 'sell'"
          - "trailing_stop_percent defined"
          - "NOT crypto"
          - "NOT extended_hours"
        params:
          - trail_percent: "0.5 - 20%"
          - time_in_force: "gtc"  # Trailing stop orders CAN use GTC (not market orders)

      extended_hours:
        conditions:
          - "extended_hours == true"
          - "NOT crypto"
          - "order_type == 'limit'"
          - "limit_price defined"
          - "whole_shares_only"
        restrictions:
          - "4AM-8PM ET weekdays"
          - "Limit orders only"
          - "No fractional shares"

      standard_order:
        params:
          - symbol
          - qty
          - side
          - type: "market | limit"
          # CRITICAL: Market orders CANNOT use GTC - always use "day"
          # Limit orders for crypto CAN use GTC
          - time_in_force: "market orders = 'day' | limit orders = (crypto ? 'gtc' : 'day')"

  # ═══════════════════════════════════════════════════════════
  # ORDER TYPE BY LIQUIDITY
  # ═══════════════════════════════════════════════════════════
  liquidity_based_execution:
    high_liquidity:
      condition: "ADV > 5M shares"
      method: "limit_order"
      limit_offset: "0.02% from mid"
      timeout_seconds: 30
      fallback: "market_order"

    medium_liquidity:
      condition: "1M <= ADV <= 5M"
      method: "limit_order"
      limit_offset: "0.05% from mid"
      timeout_seconds: 60
      fallback: "limit_at_ask"

    low_liquidity:
      condition: "ADV < 1M"
      method: "limit_order"
      limit_offset: "0.10% from mid"
      timeout_seconds: 120
      fallback: "cancel_and_alert"

  # ═══════════════════════════════════════════════════════════
  # ALPACA INTEGRATION
  # ═══════════════════════════════════════════════════════════
  alpaca_config:
    api_endpoints:
      paper: "https://paper-api.alpaca.markets"
      live: "https://api.alpaca.markets"
      data: "https://data.alpaca.markets"

    order_types_supported:
      - market
      - limit
      - stop
      - stop_limit
      - trailing_stop

    time_in_force_options:
      - day
      - gtc
      - opg
      - cls
      - ioc
      - fok

    rate_limit: "200 requests/minute"

    position_sync:
      frequency: "60 seconds"
      reconciliation: "5 minutes"

  # ═══════════════════════════════════════════════════════════
  # ERROR HANDLING
  # ═══════════════════════════════════════════════════════════
  error_handling:
    error_types:
      VALIDATION_ERROR:
        retryable: false
        recovery: "NONE"

      INSUFFICIENT_FUNDS:
        retryable: false
        recovery: "ADJUST_AND_RETRY"
        action: "Reduce size 50%, max 2 reductions"

      INVALID_SYMBOL:
        retryable: false
        recovery: "SKIP_AND_LOG"

      MARKET_CLOSED:
        retryable: true
        recovery: "WAIT_FOR_MARKET_OPEN"

      RATE_LIMITED:
        retryable: true
        recovery: "RETRY_WITH_BACKOFF"
        initial_delay: 5000
        max_delay: 30000

      NETWORK_ERROR:
        retryable: true
        recovery: "RETRY_WITH_BACKOFF"
        max_retries: 3

      BROKER_REJECTION:
        retryable: false
        recovery: "ADJUST_AND_RETRY"

      POSITION_NOT_FOUND:
        retryable: false
        recovery: "CHECK_AND_SYNC"

      ORDER_NOT_FOUND:
        retryable: false
        recovery: "CHECK_AND_SYNC"

      TIMEOUT:
        retryable: true
        recovery: "CHECK_AND_SYNC"

    retry_config:
      max_retries: 3
      initial_delay_ms: 1000
      backoff_multiplier: 2.0
      max_delay_ms: 30000
      jitter: true
```

## 5.6 Strategy Variations

```yaml
strategy_variations:
  # ═══════════════════════════════════════════════════════════
  # STRATEGY 1: MOMENTUM + FUNDAMENTALS
  # ═══════════════════════════════════════════════════════════
  momentum_fundamentals:
    source: "/server/strategies/momentum-strategy.ts"
    description: "Trend-following with ROC + RSI confirmation and fundamental quality filter"

    parameters:
      lookbackPeriod:
        type: integer
        default: 14
        range: [5, 30]
        description: "ROC calculation period"

      momentumThreshold:
        type: float
        default: 0.02
        range: [0.005, 0.10]
        description: "Minimum ROC for signal"

      rsiPeriod:
        type: integer
        default: 14
        range: [5, 21]

      rsiOverbought:
        type: integer
        default: 70
        range: [60, 85]

      rsiOversold:
        type: integer
        default: 30
        range: [15, 40]

      allocationPct:
        type: float
        default: 0.08
        range: [0.02, 0.20]

      riskLimitPct:
        type: float
        default: 0.05
        range: [0.02, 0.15]

    presets:
      conservative:
        lookbackPeriod: 20
        momentumThreshold: 0.03
        rsiOverbought: 75
        rsiOversold: 25
        allocationPct: 0.05
        riskLimitPct: 0.03
        description: "Longer lookback, stricter filters, fewer trades"

      balanced:
        lookbackPeriod: 14
        momentumThreshold: 0.02
        rsiOverbought: 70
        rsiOversold: 30
        allocationPct: 0.08
        riskLimitPct: 0.05
        description: "Classic momentum with RSI confirmation"

      aggressive:
        lookbackPeriod: 10
        momentumThreshold: 0.015
        rsiOverbought: 65
        rsiOversold: 35
        allocationPct: 0.12
        riskLimitPct: 0.08
        description: "Faster signals, more trades"

    factor_weight_override:
      technical: 0.35
      fundamentals: 0.25
      momentum: 0.15
      sentiment: 0.15
      macro: 0.10

    entry_conditions:
      - "ROC > momentumThreshold"
      - "rsiOversold < RSI < rsiOverbought"
      - "fundamental_score >= 60"
      - "volume_confirmation: relative_volume > 1.2"

    exit_conditions:
      - "ROC < -momentumThreshold"
      - "RSI >= rsiOverbought"
      - "holding_period > 20 days"
      - "stop_loss_hit"
      - "take_profit_hit"

    signal_calculation: |
      momentum = calculateROC(prices, lookbackPeriod)
      rsi = calculateRSI(prices, rsiPeriod)

      # BUY when momentum crosses above threshold with RSI confirmation
      if momentum > momentumThreshold AND rsi > rsiOversold AND rsi < rsiOverbought:
        if prev_momentum <= momentumThreshold:  # Crossover
          signal = "BUY"
          strength = min(1, momentum / (momentumThreshold * 3))

      # SELL when momentum reverses or RSI overbought
      if momentum < -momentumThreshold OR rsi >= rsiOverbought:
        signal = "SELL"

  # ═══════════════════════════════════════════════════════════
  # STRATEGY 2: MEAN REVERSION SCALPER
  # ═══════════════════════════════════════════════════════════
  mean_reversion:
    source: "/server/strategies/mean-reversion-scalper.ts"
    description: "Capitalize on oversold bounces using z-score deviation"

    parameters:
      lookbackPeriod:
        type: integer
        default: 14
        range: [5, 50]

      deviationThreshold:
        type: float
        default: 2.0
        range: [1.0, 4.0]
        description: "Standard deviations for signal"

      allocationPct:
        type: float
        default: 0.05
        range: [0.01, 0.15]

      riskLimitPct:
        type: float
        default: 0.03
        range: [0.01, 0.10]

      maxHoldingPeriod:
        type: integer
        default: 3
        range: [1, 10]
        description: "Maximum days to hold position"

    presets:
      conservative:
        lookbackPeriod: 20
        deviationThreshold: 2.5
        allocationPct: 0.03
        maxHoldingPeriod: 5

      balanced:
        lookbackPeriod: 14
        deviationThreshold: 2.0
        allocationPct: 0.05
        maxHoldingPeriod: 3

      aggressive:
        lookbackPeriod: 10
        deviationThreshold: 1.5
        allocationPct: 0.08
        maxHoldingPeriod: 2

    activation_conditions:
      market_regime: ["neutral", "risk_on"]
      vix_level: "< 30"

    factor_weight_override:
      technical: 0.40
      fundamentals: 0.30
      sentiment: 0.15
      momentum: 0.05
      macro: 0.10

    entry_conditions:
      - "z_score <= -deviationThreshold"
      - "fundamental_score >= 65"
      - "no_negative_catalyst"

    exit_conditions:
      - "z_score >= 0 (mean reversion complete)"
      - "price > SMA20"
      - "holding_period >= maxHoldingPeriod"
      - "stop_loss_hit"

    position_sizing:
      multiplier: 0.7
      reason: "Smaller positions for reversal plays"

    signal_calculation: |
      sma = calculateSMA(prices, lookbackPeriod)
      std = calculateStdDev(prices, lookbackPeriod)
      z_score = (current_price - sma) / std

      # BUY when price crosses below lower band
      if prev_z > -deviationThreshold AND z_score <= -deviationThreshold:
        signal = "BUY"

      # EXIT when price returns to mean
      if z_score >= 0:
        signal = "SELL"

  # ═══════════════════════════════════════════════════════════
  # STRATEGY 3: CATALYST TRADING (NEWS-DRIVEN)
  # ═══════════════════════════════════════════════════════════
  catalyst_trading:
    description: "React to material news events with quick entries/exits"

    trigger_events:
      - earnings_surprise: "abs(surprise) > 10%"
      - analyst_upgrade: "from_hold_or_below to buy_or_above"
      - guidance_raise: true
      - major_contract: true
      - fda_approval: true

    data_sources:
      primary: "GDELT (free, 15-min updates)"
      secondary: "NewsAPI"
      sentiment: "HuggingFace FinBERT"

    factor_weight_override:
      sentiment: 0.40
      technical: 0.25
      momentum: 0.15
      fundamentals: 0.10
      micro: 0.10

    entry_conditions:
      - "news_recency < 30 minutes"
      - "sentiment_score >= 0.7"
      - "volume_surge > 3x average"
      - "price_extension < 5% from pre-news"

    exit_conditions:
      - "time_exit: 4 hours max"
      - "profit_target: 3%"
      - "volume_declining: 3 consecutive bars"
      - "sentiment_reversal"

    position_sizing:
      multiplier: 0.5
      reason: "Smaller for speed plays"

  # ═══════════════════════════════════════════════════════════
  # STRATEGY 4: DEFENSIVE / LOW VOLATILITY
  # ═══════════════════════════════════════════════════════════
  defensive:
    description: "Capital preservation during uncertain markets"

    activation_conditions:
      market_regime: "risk_off"
      vix_level: "> 25"

    universe_filter:
      sectors: ["utilities", "consumer_staples", "healthcare"]
      beta_max: 0.8
      dividend_yield_min: 0.02

    factor_weight_override:
      fundamentals: 0.35
      technical: 0.25
      macro: 0.20
      sentiment: 0.10
      momentum: 0.05
      micro: 0.05

    entry_conditions:
      - "fundamental_score >= 70"
      - "beta < 0.8"
      - "dividend_yield > 0"
      - "volatility_percentile < 50"

    exit_conditions:
      - "market_regime shifts to risk_on"
      - "fundamental_score drops 20+ points"

    position_sizing:
      multiplier: 1.2
      max_position_override: 0.20
      reason: "Can size up in quality defensives"

  # ═══════════════════════════════════════════════════════════
  # STRATEGY 5: MOVING AVERAGE CROSSOVER
  # ═══════════════════════════════════════════════════════════
  moving_average_crossover:
    source: "/server/strategies/moving-average-crossover.ts"
    description: "Classic SMA crossover with configurable periods"

    parameters:
      fastPeriod:
        type: integer
        default: 7
        range: [3, 20]

      slowPeriod:
        type: integer
        default: 20
        range: [10, 50]

      allocationPct:
        type: float
        default: 0.10
        range: [0.02, 0.20]

    presets:
      conservative:
        fastPeriod: 10
        slowPeriod: 30
        allocationPct: 0.05

      balanced:
        fastPeriod: 7
        slowPeriod: 20
        allocationPct: 0.10

      aggressive:
        fastPeriod: 5
        slowPeriod: 15
        allocationPct: 0.15

    entry_conditions:
      - "Golden Cross: fastSMA crosses above slowSMA"
      - "Volume confirmation"

    exit_conditions:
      - "Death Cross: fastSMA crosses below slowSMA"
      - "Stop loss hit"

    signal_calculation: |
      fastSMA = calculateSMA(prices, fastPeriod)
      slowSMA = calculateSMA(prices, slowPeriod)

      # Golden Cross (bullish)
      if prev_fast <= prev_slow AND curr_fast > curr_slow:
        signal = "BUY"

      # Death Cross (bearish)
      if prev_fast >= prev_slow AND curr_fast < curr_slow:
        signal = "SELL"
```

---

# 6. USER CONFIGURATION INTERFACE

```yaml
user_configuration:
  # ═══════════════════════════════════════════════════════════
  # REQUIRED INPUTS (Must be configured)
  # ═══════════════════════════════════════════════════════════
  required:
    alpaca_credentials:
      - name: "ALPACA_API_KEY"
        type: string
        encrypted: true

      - name: "ALPACA_SECRET_KEY"
        type: string
        encrypted: true

      - name: "ALPACA_BASE_URL"
        type: enum
        options: ["paper", "live"]
        default: "paper"

    risk_tolerance:
      name: "risk_tolerance"
      type: enum
      options:
        conservative:
          maxPositionSize: 5%
          maxExposure: 30%
          maxPositions: 5
          dailyLossLimit: 3%
        moderate:
          maxPositionSize: 10%
          maxExposure: 50%
          maxPositions: 10
          dailyLossLimit: 5%
        aggressive:
          maxPositionSize: 15%
          maxExposure: 95%
          maxPositions: 100
          dailyLossLimit: 5%

  # ═══════════════════════════════════════════════════════════
  # CAPITAL MANAGEMENT
  # ═══════════════════════════════════════════════════════════
  capital_management:
    - name: "capital_utilization_pct"
      display: "Capital Utilization %"
      type: float
      default: 80.0
      range: [10.0, 100.0]
      step: 5.0
      description: "Percentage of buying power to use"

    - name: "max_portfolio_positions"
      display: "Maximum Positions"
      type: integer
      default: 10
      range: [3, 25]

    - name: "max_single_position_pct"
      display: "Max Position Size %"
      type: float
      default: 10.0
      range: [5.0, 30.0]

    - name: "max_sector_exposure_pct"
      display: "Max Sector Exposure %"
      type: float
      default: 35.0
      range: [20.0, 50.0]

    - name: "cash_reserve_pct"
      display: "Cash Reserve %"
      type: float
      default: 20.0
      range: [5.0, 50.0]

  # ═══════════════════════════════════════════════════════════
  # RISK MANAGEMENT
  # ═══════════════════════════════════════════════════════════
  risk_management:
    - name: "risk_per_trade_pct"
      display: "Risk Per Trade %"
      type: float
      default: 2.0
      range: [0.5, 5.0]

    - name: "daily_loss_limit_pct"
      display: "Daily Loss Limit %"
      type: float
      default: 5.0
      range: [2.0, 10.0]
      action_on_breach: "halt_trading_for_day"

    - name: "weekly_loss_limit_pct"
      display: "Weekly Loss Limit %"
      type: float
      default: 10.0
      range: [5.0, 20.0]
      action_on_breach: "reduce_position_sizes_50%"

    - name: "max_drawdown_pct"
      display: "Max Drawdown %"
      type: float
      default: 15.0
      range: [5.0, 30.0]
      action_on_breach: "halt_all_trading"

    - name: "kill_switch"
      display: "Kill Switch"
      type: boolean
      default: false
      action_on_true: "block_all_trades"

  # ═══════════════════════════════════════════════════════════
  # TRADE EXECUTION
  # ═══════════════════════════════════════════════════════════
  trade_execution:
    - name: "default_stop_loss_pct"
      display: "Default Stop Loss %"
      type: float
      default: 5.0
      range: [2.0, 15.0]
      methods: ["fixed_pct", "atr_based"]
      atr_multiplier: 2.0

    - name: "default_take_profit_pct"
      display: "Default Take Profit %"
      type: float
      default: 10.0
      range: [5.0, 50.0]
      min_risk_reward: 2.0

    - name: "trailing_stop_enabled"
      display: "Enable Trailing Stop"
      type: boolean
      default: true

    - name: "trailing_stop_activation_pct"
      display: "Trailing Stop Activation %"
      type: float
      default: 5.0
      range: [2.0, 15.0]
      requires: "trailing_stop_enabled"

    - name: "trailing_stop_distance_pct"
      display: "Trailing Stop Distance %"
      type: float
      default: 3.0
      range: [1.0, 10.0]
      requires: "trailing_stop_enabled"

    - name: "use_bracket_orders"
      display: "Use Bracket Orders"
      type: boolean
      default: true
      restrictions:
        - "Not available for crypto"
        - "Not available in extended hours"

    - name: "confidence_threshold"
      display: "AI Confidence Threshold"
      type: float
      default: 60.0
      range: [40.0, 90.0]

  # ═══════════════════════════════════════════════════════════
  # TIMING PREFERENCES
  # ═══════════════════════════════════════════════════════════
  timing_preferences:
    - name: "trading_frequency"
      display: "Trading Frequency"
      type: enum
      default: "moderate"
      options:
        conservative:
          max_trades_per_day: 3
          min_hold_period_hours: 24
          score_threshold_adjustment: +10
        moderate:
          max_trades_per_day: 8
          min_hold_period_hours: 4
          score_threshold_adjustment: 0
        aggressive:
          max_trades_per_day: 15
          min_hold_period_hours: 1
          score_threshold_adjustment: -5

    - name: "trading_start_time"
      display: "Trading Start Time (ET)"
      type: time
      default: "09:45"
      range: ["04:00", "16:00"]

    - name: "trading_end_time"
      display: "Trading End Time (ET)"
      type: time
      default: "15:45"
      range: ["04:00", "20:00"]

    - name: "avoid_first_30_min"
      display: "Avoid Opening 30 Minutes"
      type: boolean
      default: true

    - name: "avoid_last_30_min"
      display: "Avoid Closing 30 Minutes"
      type: boolean
      default: false

  # ═══════════════════════════════════════════════════════════
  # FEATURE TOGGLES
  # ═══════════════════════════════════════════════════════════
  feature_toggles:
    - name: "auto_execute_trades"
      display: "Auto-Execute Trades"
      type: boolean
      default: false
      warning: "Enables fully autonomous trading"

    - name: "conservative_mode"
      display: "Conservative Mode"
      type: boolean
      default: false
      effect: "Reduces all position sizes by 50%"

    - name: "enable_shorting"
      display: "Enable Short Selling"
      type: boolean
      default: false
      requirements: ["margin_account"]

    - name: "enable_extended_hours"
      display: "Enable Extended Hours"
      type: boolean
      default: false
      restrictions: ["limit_orders_only", "no_fractional", "no_crypto"]

    - name: "enable_crypto"
      display: "Enable Crypto Trading"
      type: boolean
      default: true

    - name: "news_trading_enabled"
      display: "Enable News Trading"
      type: boolean
      default: true

    - name: "dynamic_risk_enabled"
      display: "Enable Dynamic Risk"
      type: boolean
      default: true
      components: ["volatility_scaling", "performance_scaling", "time_scaling"]
```

---

# 7. DATA REQUIREMENTS & SOURCES

```yaml
data_requirements:
  # ═══════════════════════════════════════════════════════════
  # REAL-TIME MARKET DATA
  # ═══════════════════════════════════════════════════════════
  real_time:
    alpaca:
      type: "Primary broker"
      reliability: 0.95
      features:
        - quotes
        - bars (1min, 5min, 15min, 1hour, 1day)
        - trades
        - positions
        - orders
        - account
      rate_limit: "200 req/min"
      cost: "Free with trading account"
      websocket: "wss://stream.data.alpaca.markets"

    finnhub:
      type: "Market data supplement"
      reliability: 0.90
      features:
        - quotes
        - candles
        - company_profile
        - financials_reported
      rate_limit: "50 req/min"
      cache_ttl: "60 seconds"
      cost: "Free tier available"

    twelvedata:
      type: "Historical OHLCV"
      reliability: 0.90
      features:
        - time_series
        - technical_indicators
      rate_limit: "6 req/min, 700/day"
      cache_ttl: "300 seconds"

  # ═══════════════════════════════════════════════════════════
  # NEWS & SENTIMENT
  # ═══════════════════════════════════════════════════════════
  news_sentiment:
    gdelt:
      type: "Global news"
      reliability: 0.80
      update_frequency: "15 minutes"
      cost: "FREE"
      features:
        - headlines
        - tone_timeline
        - volume_spikes
        - geographic_coverage
      priority: 1

    newsapi:
      type: "Business news"
      reliability: 0.75
      limit: "100 requests/day (free)"
      features:
        - headlines
        - sources
        - relevance
        - recency
      cache_ttl: "30 minutes"
      priority: 2

    huggingface:
      type: "AI sentiment analysis"
      reliability: 0.80
      model: "ProsusAI/finbert"
      features:
        - sentiment_classification
        - confidence_score
      cost: "Free tier"
      priority: 3

  # ═══════════════════════════════════════════════════════════
  # FUNDAMENTAL DATA
  # ═══════════════════════════════════════════════════════════
  fundamentals:
    valyu_ai:
      type: "Financial data API"
      reliability: 0.90
      features:
        earnings:
          - eps
          - revenue
          - net_income
          - earnings_surprise
        financial_ratios:
          - peRatio
          - pbRatio
          - roe
          - roa
          - debtToEquity
          - currentRatio
          - grossMargin
          - netProfitMargin
        balance_sheet:
          - total_assets
          - total_liabilities
          - shareholders_equity
        cash_flow:
          - operating_cash_flow
          - free_cash_flow
        dividends:
          - dividend_amount
          - dividend_yield
          - ex_dividend_date
        insider_transactions:
          - transaction_type
          - shares
          - value
          - date
      cache_ttl: "24 hours"

    sec_edgar:
      type: "SEC filings"
      reliability: 0.95
      cost: "FREE"
      features:
        - 10-K (annual)
        - 10-Q (quarterly)
        - 8-K (current)
        - insider filings

  # ═══════════════════════════════════════════════════════════
  # MACRO ECONOMIC
  # ═══════════════════════════════════════════════════════════
  macro_economic:
    fred:
      type: "Federal Reserve data"
      reliability: 0.95
      cost: "FREE with API key"
      update_frequency: "varies by series"

      critical_indicators:
        volatility:
          - series_id: "VIXCLS"
            name: "VIX"
            frequency: "daily"

        interest_rates:
          - series_id: "DGS10"
            name: "10-Year Treasury"
          - series_id: "DGS2"
            name: "2-Year Treasury"
          - series_id: "T10Y2Y"
            name: "Yield Curve"
          - series_id: "FEDFUNDS"
            name: "Fed Funds Rate"

        inflation:
          - series_id: "CPIAUCSL"
            name: "CPI"
          - series_id: "CPILFESL"
            name: "Core CPI"
          - series_id: "PCEPI"
            name: "PCE"

        employment:
          - series_id: "UNRATE"
            name: "Unemployment Rate"
          - series_id: "ICSA"
            name: "Initial Claims"
          - series_id: "PAYEMS"
            name: "Nonfarm Payrolls"

        sentiment:
          - series_id: "UMCSENT"
            name: "Consumer Sentiment"

  # ═══════════════════════════════════════════════════════════
  # CRYPTO DATA
  # ═══════════════════════════════════════════════════════════
  crypto:
    coingecko:
      type: "Crypto market data"
      reliability: 0.85
      rate_limit: "10 req/min, 500/day"
      features:
        - prices
        - market_cap
        - volume
        - price_change
      cache_ttl: "60 seconds"

    binance:
      type: "Crypto prices (fallback)"
      reliability: 0.90
      rate_limit: "1200 req/min"
      features:
        - ticker_price
        - order_book
        - recent_trades
      cost: "FREE"

  # ═══════════════════════════════════════════════════════════
  # DATA FUSION ENGINE
  # ═══════════════════════════════════════════════════════════
  fusion_engine:
    location: "/server/ai/data-fusion-engine.ts"

    output: "FusedMarketIntelligence"

    source_weights:
      alpaca: 0.95
      finnhub: 0.90
      valyu: 0.90
      coingecko: 0.85
      newsapi: 0.75
      huggingface: 0.80
      gdelt: 0.80

    quality_metrics:
      completeness: "0-1 (% of required fields)"
      freshness: "0-1 (time since update)"
      reliability: "0-1 (source track record)"

    conflict_handling:
      agreement_threshold: 0.6
      action_on_conflict: "weighted_average"
      warning_on_low_agreement: true

    caching:
      table: "external_api_cache_entries"
      strategy: "stale_while_revalidate"
      default_ttl: "5 minutes"
```

---

# 8. MONITORING & ALERTING

```yaml
monitoring_alerting:
  # ═══════════════════════════════════════════════════════════
  # CRITICAL ALERTS (Immediate Action Required)
  # ═══════════════════════════════════════════════════════════
  critical:
    - name: "kill_switch_activated"
      trigger: "kill_switch_active == true"
      action: "IMMEDIATE"
      channels: ["telegram", "slack", "email"]
      description: "Emergency trading halt activated"

    - name: "daily_loss_limit_breached"
      trigger: "daily_pnl < -(equity * daily_loss_limit_pct)"
      action: "HALT_TRADING_FOR_DAY"
      channels: ["telegram", "slack", "email"]

    - name: "position_sync_discrepancy"
      trigger: "abs(alpaca_qty - db_qty) > threshold"
      threshold: "1 share OR 1%"
      action: "ALERT_AND_RECONCILE"
      channels: ["telegram", "slack"]

    - name: "api_connection_failure"
      trigger: "consecutive_api_failures >= 5"
      action: "PAUSE_ALL_OPERATIONS"
      channels: ["telegram", "slack", "email"]

    - name: "unusual_slippage"
      trigger: "abs(slippage_percent) > 1.0"
      action: "ALERT_AND_REVIEW"
      channels: ["telegram", "slack"]

    - name: "vix_extreme"
      trigger: "VIX >= 35"
      action: "EMERGENCY_MODE"
      channels: ["telegram", "slack", "email"]
      description: "Extreme volatility - close-only mode"

  # ═══════════════════════════════════════════════════════════
  # WARNING ALERTS (Review Required)
  # ═══════════════════════════════════════════════════════════
  warning:
    - name: "win_rate_declining"
      trigger: "rolling_3day_win_rate < 40%"
      action: "REVIEW_STRATEGY"
      channels: ["telegram", "slack"]

    - name: "drawdown_approaching"
      trigger: "current_drawdown > max_drawdown * 0.8"
      action: "REDUCE_EXPOSURE"
      channels: ["telegram", "slack"]

    - name: "factor_degradation"
      trigger: "factor_performance_z_score < -2.0"
      action: "REVIEW_AND_RECALIBRATE"
      channels: ["slack"]

    - name: "high_retry_rate"
      trigger: "retry_rate_per_minute > 5"
      action: "INVESTIGATE_FAILURES"
      channels: ["slack"]

    - name: "llm_errors_elevated"
      trigger: "llm_error_rate_last_hour > 10%"
      action: "CHECK_LLM_PROVIDER"
      channels: ["slack"]

    - name: "low_confidence_trades"
      trigger: "avg_confidence_last_10_trades < 60%"
      action: "REVIEW_AI_DECISIONS"
      channels: ["slack"]

    - name: "vix_elevated"
      trigger: "25 <= VIX < 35"
      action: "LIMIT_NEW_POSITIONS"
      channels: ["telegram"]

  # ═══════════════════════════════════════════════════════════
  # INFORMATIONAL ALERTS
  # ═══════════════════════════════════════════════════════════
  informational:
    - name: "daily_summary"
      trigger: "market_close"
      channels: ["telegram", "email"]
      template: |
        Daily Trading Summary
        Date: {{date}}
        Total P&L: ${{pnl}} ({{pnl_percent}}%)
        Trades: {{trade_count}}
        Win Rate: {{win_rate}}%
        Positions: {{open_positions}}
        Cash: ${{cash}}

    - name: "trade_confirmation"
      trigger: "order.status == 'filled'"
      channels: ["telegram"]
      template: |
        Order Filled: {{side}} {{qty}} {{symbol}} @ ${{price}}

    - name: "ai_decision"
      trigger: "new_ai_decision AND confidence >= 0.7"
      channels: ["telegram"]
      template: |
        AI Decision: {{action}} {{symbol}}
        Confidence: {{confidence}}%
        Reasoning: {{reasoning}}

    - name: "position_opened"
      trigger: "new_position"
      channels: ["telegram"]
      template: |
        Position Opened: {{side}} {{qty}} {{symbol}} @ ${{entry_price}}
        SL: ${{stop_loss}} | TP: ${{take_profit}}

    - name: "position_closed"
      trigger: "position_closed"
      channels: ["telegram"]
      template: |
        Position Closed: {{symbol}}
        Exit: {{exit_reason}}
        P&L: ${{pnl}} ({{pnl_percent}}%)
        Hold Time: {{hold_time}}

    - name: "market_regime_change"
      trigger: "volatility_regime_changed"
      channels: ["telegram", "slack"]
      template: |
        Market Regime Change
        Previous: {{old_regime}}
        Current: {{new_regime}}
        VIX: {{vix}}
        Position Adjustment: {{size_multiplier}}x

  # ═══════════════════════════════════════════════════════════
  # NOTIFICATION CHANNELS
  # ═══════════════════════════════════════════════════════════
  channels:
    telegram:
      rate_limit: "30 messages/minute"

    slack:
      channel: "#trading-alerts"
      rate_limit: "60 messages/minute"

    discord:
      rate_limit: "30 messages/minute"

    email:
      supports: ["critical"]
      rate_limit: "10 emails/hour"

  # ═══════════════════════════════════════════════════════════
  # EVALUATION
  # ═══════════════════════════════════════════════════════════
  evaluation:
    interval_ms: 30000

    metrics_tracked:
      - dead_letter_count
      - pending_work_items
      - llm_calls_last_hour
      - llm_error_rate
      - retry_rate_per_minute
      - daily_pnl
      - drawdown
      - win_rate
      - vix_level
```

---

# 9. APPENDICES

## A. Complete Trade Log Schema

See Section 2 for complete database table definitions including:
- `trades` - Execution history
- `positions` - Open positions
- `orders` - Order lifecycle
- `fills` - Fill events
- `ai_decisions` - AI recommendations
- `ai_decision_features` - Feature vectors
- `ai_trade_outcomes` - Outcome tracking

## B. Factor Performance Attribution

Each factor's contribution to total score is tracked in `ai_decision_features`:

| Factor Category | Weight | Sub-Factors | Data Sources |
|-----------------|--------|-------------|--------------|
| Fundamentals | 20% | Earnings, Ratios, Cash Flow, Insider | Valyu.ai |
| Technical | 30% | Trend, Momentum, Volatility, Volume | Alpaca, Indicators |
| Sentiment | 20% | News, AI Sentiment, Social | GDELT, NewsAPI, HuggingFace |
| Macro | 15% | Market Regime, Rates, Inflation | FRED |
| Micro | 10% | Earnings Catalyst, Insider, Range | Valyu.ai |
| Momentum | 5% | Price, Relative Strength | Calculated |

## C. Backtesting Infrastructure

### Available Functions

| Strategy | Function | Default Lookback |
|----------|----------|------------------|
| Momentum | `backtestMomentumStrategy()` | 365 days |
| Mean Reversion | `backtestMeanReversionStrategy()` | 365 days |
| MA Crossover | `backtestMovingAverageStrategy()` | 365 days |

### Output Metrics

- Total Return %
- Sharpe Ratio (annualized)
- Sortino Ratio (annualized)
- Maximum Drawdown %
- Win Rate %
- Profit Factor
- Total Trades
- Equity Curve

## D. Code Implementation References

| Component | File Path | Lines |
|-----------|-----------|-------|
| Trading Engine | `/server/trading/alpaca-trading-engine.ts` | 2,148 |
| Paper Trading | `/server/trading/paper-trading-engine.ts` | 639 |
| AI Decision Engine | `/server/ai/decision-engine.ts` | 593 |
| Data Fusion | `/server/ai/data-fusion-engine.ts` | 751 |
| LLM Gateway | `/server/ai/llmGateway.ts` | ~1,000 |
| Momentum Strategy | `/server/strategies/momentum-strategy.ts` | 534 |
| Mean Reversion | `/server/strategies/mean-reversion-scalper.ts` | ~450 |
| MA Crossover | `/server/strategies/moving-average-crossover.ts` | ~400 |
| Technical Indicators | `/server/lib/technical-indicators.ts` | 300+ |
| Orchestrator | `/server/autonomous/orchestrator.ts` | 2,268 |
| Database Schema | `/shared/schema.ts` | 1,200+ |

## E. API Endpoints Reference

### Trading Endpoints
- `POST /api/autonomous/execute-trades` - Execute trades
- `POST /api/autonomous/close-position` - Close position
- `POST /api/strategies/:id/start` - Start strategy
- `POST /api/strategies/:id/stop` - Stop strategy
- `POST /api/agent/market-analysis` - Analyze symbol

### Management Endpoints
- `POST /api/autonomous/cancel-all-orders` - Cancel orders
- `POST /api/autonomous/sync-positions` - Reconcile
- `PUT /api/autonomous/risk-limits` - Update limits
- `POST /api/agent/kill-switch` - Emergency stop

### Data Endpoints
- `GET /api/trades` - Trade history
- `GET /api/positions` - Current positions
- `GET /api/orders` - Order history
- `GET /api/admin/decisions` - AI decisions

---

## VALIDATION REQUIREMENTS

```yaml
validation:
  paper_trading_period: "minimum 30 days"

  success_criteria:
    sharpe_ratio: ">= 0.8"
    max_drawdown: "<= user_setting"
    win_rate: ">= 50%"
    profit_factor: ">= 1.3"

  failure_triggers:
    immediate_halt:
      - "daily_loss > 2x user_limit"
      - "system_error_count > 5 per hour"
    review_required:
      - "5 consecutive losses"
      - "weekly_performance < -5%"

  metrics_to_track:
    - signal_accuracy_vs_predicted
    - execution_quality_vs_expected
    - factor_attribution_stability
    - drawdown_vs_limits
```

---

## DOCUMENT SUMMARY

| Section | Content |
|---------|---------|
| Lines of Code Analyzed | ~15,000+ |
| Database Tables | 48+ |
| Data Connectors | 15+ |
| LLM Providers | 6 |
| Trading Strategies | 5 |
| User Parameters | 30+ |
| Alert Rules | 20+ |
| Factor Categories | 6 |
| Sub-Factors | 35+ |

**Document Version**: 1.0
**Last Updated**: 2025-12-22
**Generated By**: Claude Code Analysis
