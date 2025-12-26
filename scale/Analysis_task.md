## 🎯 CLAUDE CODE PROMPT: AI ACTIVE TRADER ALGORITHM EXTRACTION & FORMULATION

```markdown
# MISSION: COMPREHENSIVE ALGORITHM EXTRACTION & FORMULATION
# Target: AI Active Trader Application
# Output: /scale/algo.md (Complete Algorithmic Trading Specification)

## ROLE DEFINITION

You are operating as a combined expert team:
- **Senior Asset Manager** - Portfolio construction & risk management
- **Quantitative Trader** - Statistical modeling & execution optimization
- **Financial Analyst** - Fundamental & technical analysis
- **Algo Trading Architect** - System design & strategy formulation
- **Data Scientist** - Pattern recognition & ML model evaluation

---

## PHASE 1: DISCOVERY & DOCUMENTATION ANALYSIS

### 1.1 Full Application Audit
Execute the following discovery sequence:

```bash
# Map complete project structure
find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.json" -o -name "*.yaml" -o -name "*.md" \) | head -500

# Identify all documentation
find . -type f -name "*.md" -o -name "*.txt" -o -name "*.rst"

# Locate configuration files
find . -name "config*" -o -name "settings*" -o -name ".env*" -o -name "*.yaml"

# Find all log files and data stores
find . -type f \( -name "*.log" -o -name "*.csv" -o -name "*.json" \) -path "*/logs/*" -o -path "*/data/*" -o -path "*/records/*"
```

### 1.2 Code Architecture Analysis
Read and analyze ALL of the following (in order):

1. **Entry Points**: `main.py`, `app.py`, `index.js`, or equivalent
2. **Trading Engine**: All files containing trade execution logic
3. **AI/ML Components**: All files with AI decision-making logic
4. **Alpaca Integration**: All Alpaca API connection and order management code
5. **Data Pipelines**: News fetching, sentiment analysis, market data ingestion
6. **Strategy Implementations**: Any existing strategy definitions
7. **Configuration**: All config files, environment variables, constants
8. **Database/Storage**: Schema definitions, data models, persistence logic

### 1.3 Historical Data Collection
Locate and catalog ALL historical records:

| Data Category | Expected Locations | Required Fields |
|---------------|-------------------|-----------------|
| Trade Logs | `/logs/`, `/data/trades/` | timestamp, symbol, action, quantity, price, P&L |
| Order History | Alpaca exports, `/orders/` | order_id, status, filled_qty, fill_price, rejection_reason |
| AI Decisions | `/logs/ai/`, `/decisions/` | timestamp, signal, confidence, reasoning, outcome |
| News Data | `/data/news/`, `/sentiment/` | timestamp, headline, source, sentiment_score, affected_symbols |
| Market Data | `/data/market/`, `/prices/` | OHLCV, indicators calculated |
| Error Logs | `/logs/errors/` | timestamp, error_type, context, resolution |

---

## PHASE 2: FORENSIC ANALYSIS

### 2.1 Trade Performance Attribution

For EVERY trade executed, extract and categorize:

```python
# Trade Analysis Schema
{
    "trade_id": str,
    "timestamp": datetime,
    "symbol": str,
    "direction": "LONG" | "SHORT",
    "entry_price": float,
    "exit_price": float,
    "quantity": int,
    "gross_pnl": float,
    "net_pnl": float,  # After fees/slippage
    "hold_duration": timedelta,
    "max_favorable_excursion": float,  # Best unrealized P&L
    "max_adverse_excursion": float,    # Worst unrealized P&L

    # Decision Attribution
    "entry_signal_source": str,  # Which component generated signal
    "entry_confidence": float,
    "entry_reasoning": str,
    "exit_trigger": "TAKE_PROFIT" | "STOP_LOSS" | "TIME_EXIT" | "SIGNAL_REVERSAL" | "MANUAL",

    # Outcome Classification
    "outcome": "WIN" | "LOSS" | "BREAKEVEN",
    "outcome_quality": "OPTIMAL" | "SUBOPTIMAL" | "POOR",
    "missed_opportunity_pnl": float,  # What could have been made with perfect exit

    # Root Cause (for losses/suboptimal)
    "failure_category": "AI_SIGNAL_ERROR" | "INTEGRATION_FAILURE" | "EXECUTION_SLIPPAGE" | 
                        "MARKET_CONDITION" | "DATA_QUALITY" | "TIMING_ERROR" | None
}
```

### 2.2 Failure Mode Analysis

Create detailed breakdown for each failure category:

#### A. AI Signal Errors
- False positive signals (predicted move didn't occur)
- False negative signals (missed actual moves)
- Confidence calibration issues
- Feature importance misalignment
- Overfitting to historical patterns

#### B. Integration Failures
- Order rejection reasons and frequency
- Partial fills and their impact
- Latency issues between signal and execution
- API timeout/connection failures
- Position sync discrepancies

#### C. Execution Quality
- Slippage analysis (expected vs actual fill)
- Market impact of order sizes
- Timing of order placement vs optimal timing
- Order type selection (market vs limit)

#### D. Data Quality Issues
- Stale data incidents
- Missing data points
- Incorrect data (bad ticks, corporate actions)
- News sentiment misclassification

### 2.3 Success Pattern Recognition

Identify characteristics of winning trades:
- Market conditions present
- Indicator configurations
- News/sentiment alignment
- Time of day patterns
- Sector/correlation factors
- Volume characteristics
- Volatility regime

---

## PHASE 3: ALGORITHM FORMULATION

### 3.1 Universe Definition

```yaml
universe_specification:
  # Core Universe
  primary_universe:
    size: [SPECIFY_COUNT]  # e.g., 50-100 stocks
    selection_criteria:
      min_market_cap: $1B  # Adjust based on analysis
      min_avg_daily_volume: 1M shares
      min_price: $5.00
      max_price: $500.00
      listing_exchange: ["NYSE", "NASDAQ"]
      exclude_sectors: []  # Based on performance analysis

    # Specific Symbols (from successful trades)
    always_include: []  # Symbols that performed well
    always_exclude: []  # Symbols that consistently failed

  # Dynamic Filtering
  daily_filters:
    relative_volume_min: 1.2  # vs 20-day average
    atr_percentile_range: [20, 80]  # Avoid extremes
    news_recency_hours: 24  # Must have recent coverage

  # Sector Allocation Limits
  sector_caps:
    technology: 0.30
    healthcare: 0.20
    financials: 0.20
    consumer_discretionary: 0.15
    industrials: 0.15
```

### 3.2 Multi-Factor Scoring Model

```yaml
factor_model:
  # ═══════════════════════════════════════════════════════════
  # FUNDAMENTAL FACTORS (Weight: 20% of total score)
  # ═══════════════════════════════════════════════════════════
  fundamentals:
    total_weight: 0.20

    factors:
      earnings_surprise:
        weight: 0.25
        calculation: "(actual_eps - consensus_eps) / abs(consensus_eps)"
        lookback: "last_quarter"
        scoring:
          - range: [0.10, inf]
            score: 1.0
          - range: [0.05, 0.10]
            score: 0.7
          - range: [0.00, 0.05]
            score: 0.4
          - range: [-0.05, 0.00]
            score: 0.2
          - range: [-inf, -0.05]
            score: 0.0

      revenue_growth_yoy:
        weight: 0.20
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

      profit_margin_trend:
        weight: 0.15
        calculation: "gross_margin_current - gross_margin_4q_ago"
        scoring: "linear_scale(-0.05, 0.05)"

      debt_to_equity:
        weight: 0.15
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

      free_cash_flow_yield:
        weight: 0.15
        calculation: "fcf_ttm / market_cap"
        scoring: "linear_scale(0, 0.10)"

      relative_valuation:
        weight: 0.10
        calculation: "pe_ratio / sector_median_pe"
        scoring:
          - range: [0, 0.7]
            score: 1.0  # Undervalued
          - range: [0.7, 1.0]
            score: 0.7
          - range: [1.0, 1.3]
            score: 0.4
          - range: [1.3, inf]
            score: 0.2

  # ═══════════════════════════════════════════════════════════
  # TECHNICAL FACTORS (Weight: 30% of total score)
  # ═══════════════════════════════════════════════════════════
  technical:
    total_weight: 0.30

    factors:
      trend_strength:
        weight: 0.20
        indicators:
          - name: "ADX"
            period: 14
            threshold_strong: 25
            threshold_weak: 20
          - name: "price_vs_sma"
            periods: [20, 50, 200]
            calculation: "count(price > sma) / 3"
        composite_scoring:
          adx_weight: 0.5
          sma_alignment_weight: 0.5

      momentum_score:
        weight: 0.25
        indicators:
          - name: "RSI"
            period: 14
            oversold: 30
            overbought: 70
            optimal_range: [40, 60]  # For trend following
          - name: "MACD"
            fast: 12
            slow: 26
            signal: 9
            scoring: "histogram_direction_and_magnitude"
          - name: "rate_of_change"
            periods: [5, 10, 20]
            weights: [0.5, 0.3, 0.2]
        composite_calculation: |
          rsi_score = 1.0 if 40 <= rsi <= 60 else 0.5 if 30 <= rsi <= 70 else 0.2
          macd_score = sigmoid(macd_histogram / atr)
          roc_score = weighted_average(roc_values, roc_weights)
          return 0.4 * rsi_score + 0.35 * macd_score + 0.25 * roc_score

      volatility_regime:
        weight: 0.15
        calculation: |
          current_atr = ATR(14)
          historical_atr = rolling_mean(ATR(14), 60)
          percentile = percentile_rank(current_atr, lookback=252)
        scoring:
          - condition: "percentile < 30"
            interpretation: "low_volatility"
            score: 0.8
            strategy_bias: "mean_reversion"
          - condition: "30 <= percentile <= 70"
            interpretation: "normal_volatility"
            score: 1.0
            strategy_bias: "neutral"
          - condition: "percentile > 70"
            interpretation: "high_volatility"
            score: 0.6
            strategy_bias: "momentum_with_tight_stops"

      support_resistance:
        weight: 0.15
        calculation: |
          levels = identify_sr_levels(lookback=60, method="volume_profile")
          distance_to_support = (price - nearest_support) / price
          distance_to_resistance = (nearest_resistance - price) / price
          risk_reward = distance_to_resistance / distance_to_support
        scoring:
          min_risk_reward: 2.0
          optimal_support_distance: [0.02, 0.05]  # 2-5% above support

      volume_analysis:
        weight: 0.15
        indicators:
          - name: "relative_volume"
            calculation: "volume / sma(volume, 20)"
            scoring: "linear_scale(0.8, 2.0)"
          - name: "on_balance_volume_trend"
            calculation: "slope(OBV, 10) > 0"
            scoring: "binary(0.3, 1.0)"
          - name: "volume_price_confirmation"
            calculation: |
              price_up = close > close[1]
              volume_up = volume > sma(volume, 5)
              confirmed = price_up == volume_up
            scoring: "binary(0.5, 1.0)"

      pattern_recognition:
        weight: 0.10
        patterns:
          bullish:
            - "bull_flag"
            - "ascending_triangle"
            - "cup_and_handle"
            - "double_bottom"
          bearish:
            - "bear_flag"
            - "descending_triangle"
            - "head_and_shoulders"
            - "double_top"
        confirmation_required: "volume_above_average"
        recency_weight: "exponential_decay(halflife=5_bars)"

  # ═══════════════════════════════════════════════════════════
  # SENTIMENT FACTORS (Weight: 20% of total score)
  # ═══════════════════════════════════════════════════════════
  sentiment:
    total_weight: 0.20

    factors:
      news_sentiment:
        weight: 0.35
        sources:
          - provider: "primary_news_api"
            weight: 0.4
          - provider: "financial_news_api"
            weight: 0.3
          - provider: "social_sentiment_api"
            weight: 0.3
        calculation: |
          for each article in last_24h:
            relevance = calculate_relevance(article, symbol)
            sentiment = extract_sentiment(article)  # -1 to +1
            recency_weight = exp(-hours_ago / 12)
            weighted_sentiment += relevance * sentiment * recency_weight
          return normalize(weighted_sentiment, -1, 1)
        scoring:
          - range: [0.5, 1.0]
            label: "strongly_bullish"
            score: 1.0
          - range: [0.2, 0.5]
            label: "bullish"
            score: 0.75
          - range: [-0.2, 0.2]
            label: "neutral"
            score: 0.5
          - range: [-0.5, -0.2]
            label: "bearish"
            score: 0.25
          - range: [-1.0, -0.5]
            label: "strongly_bearish"
            score: 0.0

      news_volume:
        weight: 0.15
        calculation: |
          current_count = count(articles, last_24h)
          baseline = mean(daily_article_count, 30_days)
          ratio = current_count / baseline
        interpretation:
          - condition: "ratio > 3.0"
            label: "news_spike"
            action: "increase_position_size_confidence"
          - condition: "ratio < 0.3"
            label: "news_vacuum"
            action: "reduce_confidence"

      analyst_ratings:
        weight: 0.20
        calculation: |
          ratings_map = {"strong_buy": 5, "buy": 4, "hold": 3, "sell": 2, "strong_sell": 1}
          current_consensus = weighted_mean(ratings, analyst_accuracy_weights)
          rating_changes_30d = count(upgrades) - count(downgrades)
        scoring:
          consensus_score: "linear_scale(1, 5)"
          momentum_score: "sigmoid(rating_changes_30d / 3)"
          composite: "0.6 * consensus_score + 0.4 * momentum_score"

      institutional_activity:
        weight: 0.15
        data_sources:
          - "13F_filings"
          - "insider_transactions"
          - "dark_pool_prints"
        calculation: |
          inst_buying = sum(13f_increases) - sum(13f_decreases)
          insider_net = sum(insider_buys) - sum(insider_sells)
          unusual_prints = detect_unusual_block_trades()
        scoring: "composite_institutional_score()"

      social_buzz:
        weight: 0.15
        sources:
          - platform: "stocktwits"
            weight: 0.3
          - platform: "reddit"
            weight: 0.3
          - platform: "twitter"
            weight: 0.4
        calculation: |
          mention_velocity = mentions_24h / mentions_7d_avg
          sentiment_shift = sentiment_24h - sentiment_7d
          engagement_quality = filter_bot_activity()
        scoring:
          mention_score: "log_scale(mention_velocity)"
          sentiment_score: "linear_scale(sentiment_shift, -0.3, 0.3)"
          composite: "0.4 * mention_score + 0.6 * sentiment_score"

  # ═══════════════════════════════════════════════════════════
  # MACRO FACTORS (Weight: 15% of total score)
  # ═══════════════════════════════════════════════════════════
  macro:
    total_weight: 0.15

    factors:
      market_regime:
        weight: 0.30
        calculation: |
          spy_trend = classify_trend(SPY, [20, 50, 200])  # bull/bear/neutral
          vix_level = VIX.current
          vix_term_structure = VIX - VIX3M  # Contango/backwardation
          breadth = advancers / (advancers + decliners)
        regimes:
          - name: "risk_on"
            conditions:
              - spy_trend: "bull"
              - vix_level: "<20"
              - vix_term_structure: "<0"  # Contango
              - breadth: ">0.6"
            strategy_adjustment:
              position_size_multiplier: 1.2
              beta_preference: "high"

          - name: "risk_off"
            conditions:
              - spy_trend: "bear"
              - vix_level: ">25"
              - vix_term_structure: ">0"  # Backwardation
              - breadth: "<0.4"
            strategy_adjustment:
              position_size_multiplier: 0.5
              beta_preference: "low"
              defensive_sectors_only: true

          - name: "neutral"
            conditions: "default"
            strategy_adjustment:
              position_size_multiplier: 1.0

      sector_rotation:
        weight: 0.25
        calculation: |
          for sector in sectors:
            relative_strength = sector_etf_return / spy_return
            rs_momentum = slope(relative_strength, 20)
          rank sectors by rs_momentum
        scoring:
          - top_3_sectors: "overweight_multiplier = 1.3"
          - bottom_3_sectors: "underweight_multiplier = 0.7"

      interest_rate_environment:
        weight: 0.20
        indicators:
          - "10Y_treasury_yield"
          - "2Y_10Y_spread"
          - "fed_funds_rate"
          - "rate_change_expectations"
        impact_mapping:
          rising_rates:
            underweight: ["utilities", "real_estate", "high_pe_growth"]
            overweight: ["financials", "value"]
          falling_rates:
            underweight: ["financials"]
            overweight: ["growth", "real_estate", "utilities"]

      economic_indicators:
        weight: 0.15
        data_points:
          - indicator: "PMI"
            threshold_bullish: 50
            threshold_bearish: 45
          - indicator: "unemployment_claims"
            threshold_bullish: "below_4w_avg"
            threshold_bearish: "above_4w_avg * 1.1"
          - indicator: "consumer_confidence"
            trend: "3_month_direction"
        composite_score: "weighted_average_of_z_scores"

      geopolitical_risk:
        weight: 0.10
        sources:
          - "geopolitical_risk_index"
          - "policy_uncertainty_index"
        thresholds:
          elevated_risk: "percentile > 80"
          action: "reduce_exposure_by_20%"

  # ═══════════════════════════════════════════════════════════
  # MICRO FACTORS (Weight: 10% of total score)
  # ═══════════════════════════════════════════════════════════
  micro:
    total_weight: 0.10

    factors:
      earnings_catalyst:
        weight: 0.30
        calculation: |
          days_to_earnings = next_earnings_date - today
          historical_earnings_vol = mean(abs(post_earnings_move), 8_quarters)
          implied_move = options_straddle_price / stock_price
        rules:
          - condition: "days_to_earnings < 5"
            action: "no_new_positions"
            reason: "binary_event_risk"
          - condition: "days_to_earnings < 14"
            adjustment: "reduce_position_size_by_30%"

      short_interest:
        weight: 0.20
        calculation: |
          si_ratio = shares_short / float
          days_to_cover = shares_short / avg_daily_volume
          si_change = (si_current - si_prior) / si_prior
        scoring:
          squeeze_potential:
            condition: "si_ratio > 0.20 AND days_to_cover > 5 AND momentum_positive"
            score_boost: 0.2
          bearish_signal:
            condition: "si_change > 0.10"
            score_penalty: 0.1

      options_flow:
        weight: 0.25
        calculation: |
          put_call_ratio = put_volume / call_volume
          unusual_activity = detect_unusual_options_activity()
          smart_money_flow = large_trades_direction()
        scoring:
          bullish_flow:
            condition: "put_call_ratio < 0.7 AND smart_money_flow > 0"
            score: 0.8
          bearish_flow:
            condition: "put_call_ratio > 1.3 AND smart_money_flow < 0"
            score: 0.2

      float_dynamics:
        weight: 0.15
        calculation: |
          float_rotation = volume_5d / float
          institutional_ownership = inst_shares / shares_out
          insider_ownership = insider_shares / shares_out
        scoring:
          high_rotation: "float_rotation > 2.0 => volatility_warning"
          stable_ownership: "inst_ownership in [0.4, 0.8] => stability_bonus"

      comparable_performance:
        weight: 0.10
        calculation: |
          peers = get_peer_group(symbol, industry, market_cap_range)
          relative_performance = symbol_return - median(peer_returns)
          correlation_to_peers = rolling_corr(symbol, peer_index, 60)
        interpretation:
          outperformer: "relative_performance > 0 AND correlation < 0.7"
          laggard_catchup: "relative_performance < 0 AND fundamentals_strong"

  # ═══════════════════════════════════════════════════════════
  # MOMENTUM COMPOSITE (Weight: 5% of total score)
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
            momentum = (price - price_n_days_ago) / price_n_days_ago
            z_score = (momentum - mean_momentum_universe) / std_momentum_universe
          composite = weighted_sum(z_scores, weights)
        scoring: "percentile_rank_in_universe"

      earnings_momentum:
        weight: 0.30
        calculation: |
          eps_revision = (eps_estimate_current - eps_estimate_90d_ago) / abs(eps_estimate_90d_ago)
          revenue_revision = similar_calculation_for_revenue
        scoring: "linear_scale(-0.10, 0.10)"

      relative_strength:
        weight: 0.20
        calculation: |
          rs_vs_spy = symbol_return_60d / spy_return_60d
          rs_vs_sector = symbol_return_60d / sector_return_60d
        scoring:
          rs_spy: "linear_scale(0.8, 1.2)"
          rs_sector: "linear_scale(0.9, 1.1)"
          composite: "0.6 * rs_spy + 0.4 * rs_sector"
```

### 3.3 Signal Generation Logic

```yaml
signal_generation:
  # ═══════════════════════════════════════════════════════════
  # COMPOSITE SCORE CALCULATION
  # ═══════════════════════════════════════════════════════════
  score_calculation:
    formula: |
      total_score = (
        fundamentals.score * fundamentals.weight +
        technical.score * technical.weight +
        sentiment.score * sentiment.weight +
        macro.score * macro.weight +
        micro.score * micro.weight +
        momentum.score * momentum.weight
      )

      # Apply regime adjustments
      adjusted_score = total_score * market_regime.position_size_multiplier

      # Apply sector adjustments
      final_score = adjusted_score * sector_rotation.weight_multiplier

    normalization: "min_max_scale(0, 100)"

  # ═══════════════════════════════════════════════════════════
  # SIGNAL THRESHOLDS
  # ═══════════════════════════════════════════════════════════
  thresholds:
    strong_buy:
      score_range: [80, 100]
      position_size: "full"
      conviction: "high"

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
      volume_confirmation: true
      no_earnings_within: 5  # Days

    exit_triggers:
      stop_loss_hit: true
      take_profit_hit: true
      score_drops_below: 40
      holding_period_exceeded: true  # Based on strategy
      factor_deterioration: "2_or_more_factors_flip_bearish"
```

### 3.4 Position Sizing & Risk Management

```yaml
position_sizing:
  # ═══════════════════════════════════════════════════════════
  # BASE POSITION CALCULATION
  # ═══════════════════════════════════════════════════════════
  base_calculation:
    method: "risk_parity_with_conviction"
    formula: |
      # User inputs
      total_capital = user.buying_power * user.capital_utilization_pct

      # Risk-based sizing
      position_risk = user.risk_per_trade_pct * total_capital
      stop_distance = entry_price - stop_loss_price
      shares_by_risk = position_risk / stop_distance

      # Conviction adjustment
      conviction_multiplier = {
        "high": 1.0,
        "medium": 0.7,
        "low": 0.5
      }[signal.conviction]

      # Volatility adjustment
      atr_multiplier = 1.0 / (atr_percentile / 50)  # Scale inverse to volatility
      atr_multiplier = clip(atr_multiplier, 0.5, 1.5)

      # Final position size
      shares = int(shares_by_risk * conviction_multiplier * atr_multiplier)

      # Apply caps
      shares = min(shares, max_shares_by_liquidity)
      shares = min(shares, max_shares_by_concentration)

  # ═══════════════════════════════════════════════════════════
  # USER-CONFIGURABLE PARAMETERS (with defaults)
  # ═══════════════════════════════════════════════════════════
  user_parameters:
    capital_management:
      - name: "initial_capital_pct"
        description: "Percentage of buying power to use for trading"
        type: "float"
        default: 0.80  # 80% of buying power
        range: [0.10, 1.00]
        step: 0.05

      - name: "max_portfolio_positions"
        description: "Maximum number of concurrent positions"
        type: "int"
        default: 10
        range: [3, 25]

      - name: "max_single_position_pct"
        description: "Maximum allocation to single position"
        type: "float"
        default: 0.15  # 15% max per position
        range: [0.05, 0.30]

      - name: "max_sector_exposure_pct"
        description: "Maximum allocation to single sector"
        type: "float"
        default: 0.35  # 35% max per sector
        range: [0.20, 0.50]

    risk_management:
      - name: "risk_per_trade_pct"
        description: "Maximum risk per trade as % of capital"
        type: "float"
        default: 0.02  # 2% risk per trade
        range: [0.005, 0.05]
        step: 0.005

      - name: "max_daily_loss_pct"
        description: "Daily loss limit as % of capital"
        type: "float"
        default: 0.05  # 5% daily max loss
        range: [0.02, 0.10]
        action_on_breach: "halt_trading_for_day"

      - name: "max_weekly_loss_pct"
        description: "Weekly loss limit as % of capital"
        type: "float"
        default: 0.10  # 10% weekly max loss
        range: [0.05, 0.20]
        action_on_breach: "reduce_position_sizes_50%"

      - name: "max_drawdown_pct"
        description: "Maximum drawdown from peak"
        type: "float"
        default: 0.15  # 15% max drawdown
        range: [0.05, 0.30]
        action_on_breach: "halt_all_trading"

    trade_execution:
      - name: "default_stop_loss_pct"
        description: "Default stop loss percentage from entry"
        type: "float"
        default: 0.05  # 5% stop loss
        range: [0.02, 0.15]
        calculation_method: "ATR_based"  # Or "fixed_pct"
        atr_multiplier: 2.0

      - name: "default_take_profit_pct"
        description: "Default take profit percentage from entry"
        type: "float"
        default: 0.10  # 10% take profit
        range: [0.05, 0.50]
        calculation_method: "risk_reward_ratio"
        min_risk_reward: 2.0

      - name: "trailing_stop_enabled"
        description: "Enable trailing stop loss"
        type: "bool"
        default: true

      - name: "trailing_stop_activation_pct"
        description: "Profit % before trailing stop activates"
        type: "float"
        default: 0.05  # Activate after 5% profit
        range: [0.02, 0.15]

      - name: "trailing_stop_distance_pct"
        description: "Distance of trailing stop from high"
        type: "float"
        default: 0.03  # 3% trailing distance
        range: [0.01, 0.10]

    timing_preferences:
      - name: "trading_frequency"
        description: "Preferred trading frequency"
        type: "enum"
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

      - name: "trading_hours"
        description: "Preferred trading window"
        type: "time_range"
        default: 
          start: "09:45"  # 15 min after open
          end: "15:45"    # 15 min before close
        market_open_buffer_minutes: 15
        market_close_buffer_minutes: 15

      - name: "avoid_first_30_min"
        description: "Skip trading in first 30 minutes"
        type: "bool"
        default: true

      - name: "avoid_last_30_min"
        description: "Skip new trades in last 30 minutes"
        type: "bool"
        default: false

    feature_toggles:
      - name: "enable_shorting"
        description: "Allow short positions"
        type: "bool"
        default: false

      - name: "enable_options"
        description: "Allow options trading"
        type: "bool"
        default: false

      - name: "news_trading_enabled"
        description: "React to breaking news"
        type: "bool"
        default: true
        news_confidence_threshold: 0.75

      - name: "after_hours_monitoring"
        description: "Monitor positions after hours"
        type: "bool"
        default: true
        after_hours_alerts: true

  # ═══════════════════════════════════════════════════════════
  # DISTRIBUTION LOGIC
  # ═══════════════════════════════════════════════════════════
  capital_distribution:
    method: "conviction_weighted"
    formula: |
      # Calculate raw allocation weights
      for each position in positions:
        raw_weight = position.score / sum(all_scores)

      # Apply conviction adjustment
      conviction_weights = {
        "high": 1.5,
        "medium": 1.0,
        "low": 0.6
      }
      adjusted_weight = raw_weight * conviction_weights[position.conviction]

      # Normalize to sum to 1
      normalized_weight = adjusted_weight / sum(adjusted_weights)

      # Apply concentration limits
      final_weight = min(normalized_weight, max_single_position_pct)

      # Allocate capital
      position_capital = total_trading_capital * final_weight

    rebalancing:
      trigger: "weight_drift > 0.05 OR score_change > 15"
      frequency: "daily_check"
      minimum_trade_size: 100  # $ minimum to avoid churn
```

### 3.5 Execution Engine

```yaml
execution_engine:
  # ═══════════════════════════════════════════════════════════
  # ORDER FLOW
  # ═══════════════════════════════════════════════════════════
  order_workflow:
    entry_sequence:
      1_pre_validation:
        - check_buying_power_available
        - verify_symbol_tradeable
        - confirm_no_pending_orders_for_symbol
        - validate_against_position_limits
        - check_daily_trade_count
        - verify_market_hours

      2_order_construction:
        - calculate_position_size
        - determine_order_type
        - set_limit_price_if_applicable
        - calculate_stop_loss_price
        - calculate_take_profit_price
        - set_time_in_force

      3_execution:
        order_type_selection:
          high_liquidity:  # ADV > 5M shares
            method: "limit_order"
            limit_offset: "0.02%_from_mid"
            timeout_seconds: 30
            fallback: "market_order"
          medium_liquidity:  # ADV 1-5M shares
            method: "limit_order"
            limit_offset: "0.05%_from_mid"
            timeout_seconds: 60
            fallback: "limit_order_at_ask"
          low_liquidity:  # ADV < 1M shares
            method: "limit_order"
            limit_offset: "0.10%_from_mid"
            timeout_seconds: 120
            fallback: "cancel_and_alert"

      4_post_execution:
        - confirm_fill
        - record_fill_price_and_slippage
        - place_bracket_orders  # Stop loss and take profit
        - update_position_tracking
        - log_all_details

    exit_sequence:
      stop_loss_triggered:
        order_type: "market"
        urgency: "immediate"

      take_profit_triggered:
        order_type: "limit"
        limit_price: "take_profit_level"

      signal_exit:
        order_type: "limit"
        limit_offset: "0.02%_worse_than_mid"
        timeout: 60
        fallback: "market"

  # ═══════════════════════════════════════════════════════════
  # ALPACA INTEGRATION SPECIFICATIONS
  # ═══════════════════════════════════════════════════════════
  alpaca_config:
    api_settings:
      base_url: 
        paper: "https://paper-api.alpaca.markets"
        live: "https://api.alpaca.markets"
      data_url: "https://data.alpaca.markets"
      websocket_url: "wss://stream.data.alpaca.markets"

    order_defaults:
      time_in_force: "day"  # Or "gtc", "ioc", "fok"
      extended_hours: false
      client_order_id_prefix: "AIAT_"

    error_handling:
      insufficient_buying_power:
        action: "reduce_size_and_retry"
        max_retries: 2
        size_reduction_per_retry: 0.25

      symbol_not_tradeable:
        action: "skip_and_log"
        alert: true

      rate_limited:
        action: "exponential_backoff"
        initial_wait_ms: 1000
        max_wait_ms: 30000

      connection_timeout:
        action: "retry_with_backoff"
        max_retries: 3

      partial_fill:
        action: "track_and_continue"
        cancel_remainder_after_seconds: 300

    position_sync:
      frequency: "every_60_seconds"
      on_discrepancy:
        threshold: "1_share_or_1%"
        action: "alert_and_reconcile"

    websocket_subscriptions:
      - channel: "trade_updates"
        events: ["fill", "partial_fill", "canceled", "rejected"]
      - channel: "account_updates"
        events: ["buying_power_change", "position_change"]
```

### 3.6 Strategy Variations

```yaml
strategy_variations:
  # ═══════════════════════════════════════════════════════════
  # PRIMARY STRATEGY: MOMENTUM + FUNDAMENTALS
  # ═══════════════════════════════════════════════════════════
  momentum_fundamentals:
    description: "Core strategy combining price momentum with fundamental quality"

    factor_weight_override:
      technical: 0.35
      fundamentals: 0.25
      momentum: 0.15
      sentiment: 0.15
      macro: 0.10

    entry_conditions:
      - momentum_score: ">= 70"
      - fundamental_score: ">= 60"
      - trend_direction: "bullish"
      - volume_confirmation: true

    exit_conditions:
      - momentum_score_drops: "< 40"
      - trend_reversal_confirmed: true
      - holding_period_days: "> 20"

    performance_targets:
      win_rate: ">= 0.55"
      avg_win_loss_ratio: ">= 1.5"
      max_drawdown: "< 0.12"
      sharpe_ratio: ">= 1.0"

  # ═══════════════════════════════════════════════════════════
  # VARIATION: MEAN REVERSION
  # ═══════════════════════════════════════════════════════════
  mean_reversion:
    description: "Capitalize on oversold bounces in quality names"

    activation_conditions:
      market_regime: ["neutral", "risk_on"]
      vix_level: "< 30"

    factor_weight_override:
      technical: 0.40  # RSI/Bollinger focus
      fundamentals: 0.30  # Quality filter
      sentiment: 0.15
      momentum: 0.05  # Reduced - looking for reversal
      macro: 0.10

    entry_conditions:
      - rsi_14: "< 30"
      - price_vs_bollinger: "below_lower_band"
      - fundamental_score: ">= 65"  # Only quality names
      - no_negative_catalyst: true

    exit_conditions:
      - rsi_14: "> 50"
      - price_vs_sma20: "above"
      - time_exit_days: 5

    position_sizing_adjustment:
      multiplier: 0.7  # Smaller positions for reversal plays

  # ═══════════════════════════════════════════════════════════
  # VARIATION: NEWS/CATALYST TRADING
  # ═══════════════════════════════════════════════════════════
  catalyst_trading:
    description: "React to material news with quick entries"

    trigger_events:
      - earnings_surprise: "abs(surprise) > 0.10"
      - analyst_upgrade: "from_hold_or_below_to_buy_or_above"
      - guidance_raise: true
      - major_contract_announcement: true
      - fda_approval: true

    factor_weight_override:
      sentiment: 0.40
      technical: 0.25
      momentum: 0.15
      fundamentals: 0.10
      micro: 0.10

    entry_conditions:
      - news_recency_minutes: "< 30"
      - sentiment_score: ">= 0.7"
      - volume_surge: "> 3x_average"
      - price_not_extended: "< 5%_from_pre_news"

    exit_conditions:
      - time_exit_hours: 4  # Quick exit
      - profit_target_pct: 0.03  # 3% quick profit
      - momentum_fades: "volume_declining_3_bars"

    position_sizing_adjustment:
      multiplier: 0.5  # Smaller for speed plays

  # ═══════════════════════════════════════════════════════════
  # VARIATION: DEFENSIVE/LOW VOLATILITY
  # ═══════════════════════════════════════════════════════════
  defensive:
    description: "Capital preservation focus during uncertain markets"

    activation_conditions:
      market_regime: "risk_off"
      vix_level: "> 25"

    factor_weight_override:
      fundamentals: 0.35
      technical: 0.25
      macro: 0.20
      sentiment: 0.10
      momentum: 0.05
      micro: 0.05

    universe_filter:
      sectors: ["utilities", "consumer_staples", "healthcare"]
      beta_max: 0.8
      dividend_yield_min: 0.02

    entry_conditions:
      - fundamental_score: ">= 70"
      - beta: "< 0.8"
      - dividend_yield: "> 0"
      - volatility_percentile: "< 50"

    exit_conditions:
      - market_regime_shifts: "to_risk_on"
      - fundamental_deterioration: "score_drops_20pts"

    position_sizing_adjustment:
      multiplier: 1.2  # Can size up in quality defensives
      max_position_override: 0.20  # Allow larger positions
```

---

## PHASE 4: OUTPUT DOCUMENT STRUCTURE

Create the file `/scale/algo.md` with the following structure:

```markdown
# AI ACTIVE TRADER: ALGORITHMIC TRADING SPECIFICATION v1.0
## Generated: [TIMESTAMP]
## Analysis Period: [START_DATE] to [END_DATE]

---

# TABLE OF CONTENTS
1. Executive Summary
2. Historical Performance Analysis
3. Failure Mode Attribution
4. Success Pattern Identification
5. Algorithm Specification
   5.1 Universe Definition
   5.2 Multi-Factor Scoring Model
   5.3 Signal Generation Logic
   5.4 Position Sizing & Risk Management
   5.5 Execution Engine
   5.6 Strategy Variations
6. User Configuration Interface
7. Data Requirements & Sources
8. Monitoring & Alerting
9. Appendices
   A. Complete Trade Log Analysis
   B. Factor Performance Attribution
   C. Backtesting Results (if available)
   D. Code Implementation Notes

---

# 1. EXECUTIVE SUMMARY

## Overview
[Summary of findings and algorithm design]

## Key Metrics from Historical Analysis
| Metric | Value | Benchmark |
|--------|-------|-----------|
| Total Trades Analyzed | X | - |
| Win Rate | X% | 50% |
| Profit Factor | X | 1.5 |
| Max Drawdown | X% | 15% |
| Sharpe Ratio | X | 1.0 |

## Primary Findings
- [Finding 1]
- [Finding 2]
- [Finding 3]

## Algorithm Design Principles
1. [Principle derived from analysis]
2. [Principle derived from analysis]
3. [Principle derived from analysis]

---

# 2. HISTORICAL PERFORMANCE ANALYSIS
[Complete analysis from Phase 2.1]

---

# 3. FAILURE MODE ATTRIBUTION
[Complete analysis from Phase 2.2]

---

# 4. SUCCESS PATTERN IDENTIFICATION
[Complete analysis from Phase 2.3]

---

# 5. ALGORITHM SPECIFICATION
[Complete specification from Phase 3]

---

# 6. USER CONFIGURATION INTERFACE

## Required User Inputs (No Defaults - Must Be Set)
- Alpaca API credentials (encrypted)
- Risk tolerance level (conservative/moderate/aggressive)

## Optional User Inputs (With Defaults)
[Complete list from 3.4 with UI field specifications]

## Configuration Validation Rules
[Validation logic for each input]

---

# 7. DATA REQUIREMENTS & SOURCES

## Real-Time Data
| Data Type | Source | Frequency | Priority |
|-----------|--------|-----------|----------|
| Price/Volume | Alpaca | Streaming | Critical |
| Level 2 | Alpaca | Streaming | High |
| News | [Provider] | Real-time | High |

## Daily Data
[Similar table for EOD data requirements]

## Fundamental Data
[Similar table for fundamental data requirements]

---

# 8. MONITORING & ALERTING

## Critical Alerts (Immediate Action Required)
- Max daily loss threshold breached
- Position sync discrepancy detected
- API connection failure
- Unusual slippage detected (>1%)

## Warning Alerts (Review Required)
- Win rate below threshold (3-day rolling)
- Drawdown approaching limit
- Factor model performance degradation

## Informational
- Daily P&L summary
- Trade execution confirmations
- Market regime changes

---

# APPENDICES
[Detailed supporting data]
```

---

## PHASE 5: VALIDATION & TESTING NOTES

Include a section for the algorithm to be validated:

```yaml
validation_requirements:
  paper_trading_period: "minimum_30_days"

  metrics_to_track:
    - signal_accuracy_vs_predicted
    - execution_quality_vs_expected
    - factor_attribution_stability
    - drawdown_vs_limits

  success_criteria:
    - sharpe_ratio: ">= 0.8"
    - max_drawdown: "<= user_setting"
    - win_rate: ">= 0.50"
    - profit_factor: ">= 1.3"

  failure_triggers:
    immediate_halt:
      - daily_loss: "> 2x_user_limit"
      - system_error_count: "> 5_per_hour"
    review_required:
      - 5_consecutive_losses: true
      - weekly_performance: "< -5%"
```

---

## EXECUTION INSTRUCTIONS FOR CLAUDE CODE

1. **Start with discovery**: Run all commands in Phase 1.1 first
2. **Read systematically**: Go through each file identified, starting with documentation
3. **Extract data carefully**: Create intermediate JSON files if needed to organize findings
4. **Cross-reference**: Connect AI decisions to their outcomes using timestamps
5. **Be thorough**: Missing data points should be noted, not assumed
6. **Create incrementally**: Build the algo.md file section by section
7. **Validate formulas**: Ensure all calculations are mathematically correct
8. **Default wisely**: All default values should be conservative and backed by analysis
9. **Document uncertainties**: If historical data is incomplete, note this explicitly

---

## OUTPUT CONFIRMATION

After completing the algorithm document, provide:

1. **Summary Statistics**
   - Total lines of code analyzed
   - Total trades analyzed
   - Total log entries processed
   - Confidence level in findings (1-10)

2. **Key Discoveries**
   - Top 3 factors contributing to wins
   - Top 3 factors contributing to losses
   - Critical integration issues found

3. **Recommendations**
   - Priority fixes for next version
   - Suggested parameter ranges
   - Risk warnings

4. **File Location Confirmation**
   - Confirm `/scale/algo.md` created
   - File size and section count
```

---

## Summary of Enhancements Made

| Original Element | Enhancement Applied |
|-----------------|---------------------|
| "analyze logs" | Added specific log schema, categorization, and cross-referencing methodology |
| "formulate winning algo" | Added complete 6-factor model with specific weights, formulas, and scoring |
| "all the details" | Added 50+ specific parameters with exact calculations |
| "factors like fundamentals, technical" | Expanded to 35+ sub-factors with precise formulas |
| "user can adjust inputs" | Created 20+ user-configurable parameters with types, ranges, and defaults |
| "flows and steps" | Added complete execution workflow with error handling |
| "strategy variations" | Added 4 distinct strategy profiles with activation conditions |
| Implicit: Integration analysis | Added Alpaca-specific error handling, position sync, and order flow |
| Implicit: Structure | Added complete document template with table of contents |
| Implicit: Validation | Added paper trading validation requirements and success criteria |

This prompt is designed to be **comprehensive yet actionable** - Claude Code can execute it systematically to produce a production-ready algorithmic trading specification.