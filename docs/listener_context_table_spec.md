Index
Global Conventions
Defines how all signals are scaled, interpreted, and quantized into [-1.0, +1.0] with 0.1 steps.

Valuation & Fundamentals
Signal set describing how cheap/expensive, growing, profitable, and financially healthy a stock is.

1.1 valuation_score – Cheap vs expensive vs peers and history.
1.2 earnings_momentum_score – Direction/strength of earnings revisions and surprises.
1.3 revenue_growth_score – Top-line growth vs sector and own history.
1.4 quality_score – Profitability, leverage, and earnings stability.
1.5 dividend_health_score – Sustainability and attractiveness of the dividend.

Technical & Price Action
Signal set describing trend, mean reversion, volatility regime, liquidity, and relative strength.

2.1 trend_strength_score – Strength and persistence of the price trend.
2.2 pullback_timing_score – Overbought vs oversold / mean-reversion state.
2.3 volatility_regime_score – Current volatility level vs historical range.
2.4 liquidity_score – Ease of trading without large slippage.
2.5 relative_strength_score – Performance vs benchmark or sector.

Flow & Microstructure
Signal set capturing volume anomalies, order-book pressure, and institutional behaviour.

3.1 volume_flow_score – Abnormal upside/downside volume pressure.
3.2 order_imbalance_score – Short-term bid/ask dominance in the tape.
3.3 institutional_flow_score – Net positioning of large/smart money.

Macro, Sector & Regime
Signal set describing sector health, macro risk regime, rates impact, and event risk.

4.1 sector_trend_score – Sector-level trend vs the broad market.
4.2 macro_regime_risk_score – Overall risk-on vs risk-off macro backdrop.
4.3 rates_sensitivity_score – How current rates affect this stock/sector.
4.4 event_risk_score – Near-term binary/event risk (earnings, regulation, etc.).

Correlation & Portfolio Context
Signals about diversification and how “unique” the stock’s behaviour is.

5.1 correlation_cluster_score – Correlation vs existing holdings / crowding.
5.2 idiosyncratic_alpha_score – Stock-specific behaviour vs pure beta.

Composite Domain Scores
Roll-up scores combining multiple raw signals into higher-level views for the decider.

6.1 fundamental_score – Aggregate view of all fundamental signals.
6.2 technical_score – Aggregate view of all technical signals.
6.3 flow_score – Aggregate view of volume, order, and institutional flows.
6.4 regime_score – Aggregate view of macro + sector conditions.
6.5 diversification_score – Aggregate view of diversification and idiosyncrasy.

Quantization Rule (For Engineers)
Defines clamping and rounding rules to convert continuous raw values into discrete 0.1-step signals in [-1.0, +1.0]. Listener Context Table Spec


=====================================================================
ADDED — Weighting Method (Decider Aggregation Rules; Do Not Delete)
=====================================================================

Purpose:
- Provide a stable, explainable way to combine 1.x–5.x signals into a single decision score,
  without changing the existing signal structure.
- Prevent "risk/tradability" signals from masquerading as directional alpha.
- Prevent correlated signals from snowballing into false certainty.
- Ensure ANY strategy can cherry-pick ANY subset of signals and still produce a logically bounded
  output in [-1.0, +1.0] suitable for a downstream signal merger / LLM.

IMPORTANT:
- Composite scores (6.x) are roll-ups for narration/UI/auditability and MUST NOT be re-weighted
  into the final decision score, to avoid double counting.

A) Baseline Weights (Default Priors; Sum = 1.00)

Domain Weights (apply first):
- Valuation & Fundamentals (1.x): 0.23
- Technical & Price Action (2.x): 0.45
- Flow & Microstructure (3.x): 0.10
- Macro, Sector & Regime (4.x): 0.17
- Correlation & Portfolio Context (5.x): 0.05

Within-Domain Weights (effective global weights shown; Sum = 1.00)

1) Valuation & Fundamentals (Total = 0.23)
- 1.1 valuation_score: 0.04
- 1.2 earnings_momentum_score: 0.08
- 1.3 revenue_growth_score: 0.05
- 1.4 quality_score: 0.05
- 1.5 dividend_health_score: 0.01
  Notes:
  - If dividend is not applicable, redistribute 1.5 proportionally across 1.1–1.4.

2) Technical & Price Action (Total = 0.45)
- 2.1 trend_strength_score: 0.16
- 2.2 pullback_timing_score: 0.07
- 2.3 volatility_regime_score: 0.05
- 2.4 liquidity_score: 0.04
- 2.5 relative_strength_score: 0.13

3) Flow & Microstructure (Total = 0.10)
- 3.1 volume_flow_score: 0.06
- 3.2 order_imbalance_score: 0.025
- 3.3 institutional_flow_score: 0.015
  Notes:
  - If institutional flow is unavailable, redistribute 3.3 proportionally across 3.1–3.2.

4) Macro, Sector & Regime (Total = 0.17)
- 4.1 sector_trend_score: 0.06
- 4.2 macro_regime_risk_score: 0.05
- 4.3 rates_sensitivity_score: 0.03
- 4.4 event_risk_score: 0.03

5) Correlation & Portfolio Context (Total = 0.05)
- 5.1 correlation_cluster_score: 0.03
- 5.2 idiosyncratic_alpha_score: 0.02

B) Risk/Tradability Influence Dampening (No Structural Change)

Some signals are primarily risk/tradability descriptors rather than directional alpha.
These signals must be dampened so they cannot dominate conviction alone:

- 2.3 volatility_regime_score
- 2.4 liquidity_score
- 4.4 event_risk_score
- 5.1 correlation_cluster_score

Dampening Rule (applied to each of the above after weighting):
Let raw_contribution = w_i * s_i

effective_contribution =
  sign(raw_contribution) * min(|raw_contribution|, 0.5 * w_i)

Interpretation:
- They can meaningfully reduce conviction (or modestly support it),
  but cannot flip the decision by themselves.

C) Asymmetric Event Risk Handling (4.4)

Event risk is treated as a one-way penalty (risk constraint), not a source of bullish conviction.

Rule (applied in addition to dampening above):
effective_event_contribution = min(0, w_4.4 * event_risk_score)

So:
- event_risk_score >= 0 does not add "extra bullishness"
- event_risk_score < 0 subtracts (penalizes) conviction

D) Valuation Nonlinearity (1.1)

Valuation is a filter-like signal; it should not overpower strong trend + earnings momentum.

Condition:
If |valuation_score| >= 0.7 AND valuation_score conflicts with BOTH:
- trend_strength_score (2.1)
- earnings_momentum_score (1.2)

Then:
- valuation contribution is halved

Rule:
effective_valuation_contribution = 0.5 * (w_1.1 * valuation_score)

Otherwise:
effective_valuation_contribution = w_1.1 * valuation_score

E) Anti Double-Counting: Domain Contribution Caps

To prevent correlated signals (trend+RS, macro+sector, volume+imbalance, etc.) from snowballing,
cap each domain’s total contribution AFTER all per-signal rules are applied, BEFORE summing domains.

Caps:
- Fundamentals domain (1.x) capped at ±0.30
- Technical domain (2.x) capped at ±0.40
- Flow domain (3.x) capped at ±0.20
- Macro/Regime domain (4.x) capped at ±0.25
- Portfolio/Correlation domain (5.x) capped at ±0.10  (kept small; portfolio effects belong more in sizing)

Implementation:
domain_sum_clipped = max(-cap, min(cap, domain_sum))

F) Final Aggregation (UPDATED for Universal Strategy Support; Structure Preserved)

Original intent (kept):
- Weighted contributions + domain caps to prevent snowballing.

UPDATED requirement:
- Strategies may cherry-pick arbitrary subsets of signals.
- The aggregation must remain logically bounded in [-1.0, +1.0] regardless of subset size.

Therefore, the AUTHORITATIVE aggregation contract for any strategy-selected subset is:
- Use SUBSET-INVARIANT WEIGHT NORMALIZATION (weighted average), then apply domain caps as guardrails.

G) Strategy Note (7/20 SMA Crossover)

Default weighting assumes a general decider.
For trend strategies (e.g., 7/20 SMA crossover), interpretation should emphasize:
- 2.1 trend_strength_score and 2.5 relative_strength_score as primary directional evidence
- 2.2 pullback_timing_score as secondary (entry finesse), not a main driver

(No structural change required; this is an operational guidance note.)

---------------------------------------------------------------------
H) Universal Signal Merger Contract (Subset-Invariant; LLM-Safe)
---------------------------------------------------------------------

Goal:
- Any strategy can choose ANY subset of 1.x–5.x signals.
- The resulting strategy output MUST always be meaningful and bounded in [-1.0, +1.0].
- Risk/tradability signals MUST NOT act as directional alpha.

H1) Fixed Classification: Alpha vs Risk (No Strategy Overrides)

Alpha-type (Directional Evidence):
- 1.1 valuation_score (weak / filter-like)
- 1.2 earnings_momentum_score (strong)
- 1.3 revenue_growth_score
- 1.4 quality_score
- 1.5 dividend_health_score
- 2.1 trend_strength_score (strong)
- 2.2 pullback_timing_score (strategy-dependent)
- 2.5 relative_strength_score (strong)
- 3.1 volume_flow_score
- 3.2 order_imbalance_score (if data quality sufficient)
- 3.3 institutional_flow_score (if data quality sufficient)
- 4.1 sector_trend_score (light)
- 5.2 idiosyncratic_alpha_score (light / noisy)

Risk / Tradability / Constraint-type:
- 2.3 volatility_regime_score
- 2.4 liquidity_score
- 4.2 macro_regime_risk_score
- 4.3 rates_sensitivity_score
- 4.4 event_risk_score
- 5.1 correlation_cluster_score

H2) Effective Weights (Confidence-Aware)

Let base weights be as defined in Section A.
Let confidence q_i ∈ [0, 1] (optional; defaults to 1).

Effective weight:
w_i' = w_i × q_i

Missing/unavailable signal: q_i = 0.

Recommended default confidences if uncertain (can be revised later):
- q_3.1 (volume_flow_score) = 0.8
- q_3.2 (order_imbalance_score) = 0.4
- q_3.3 (institutional_flow_score) = 0.5
- all others default to 1.0

H3) Subset-Invariant Normalization (Core Bound Guarantee)

For any subset S of signals selected by a strategy:

Let s_i ∈ [-1, +1] be the stored signal value.
Let w_i' be the effective weight.

Define:
avg(S) = ( Σ_{i∈S} w_i' × s_i ) / ( Σ_{i∈S} w_i' )

If denominator is 0 (empty or all missing), avg(S) = 0.0.

Property:
avg(S) ∈ [-1.0, +1.0] regardless of subset size.

H4) Alpha Score and Risk Score (Semantic Separation)

Given strategy-selected subset S:

S_alpha = S ∩ (Alpha-type signals)
S_risk  = S ∩ (Risk-type signals)

alpha_score = avg(S_alpha)   (if S_alpha empty → 0.0)
risk_score  = avg(S_risk)    (if S_risk empty  → 0.0)

H5) Risk Throttle (Direction-Preserving)

Risk is used ONLY to scale conviction, never to flip sign.

Default throttle:
g(risk_score) = (1 + risk_score) / 2

So:
- risk = -1 → g = 0
- risk =  0 → g = 0.5
- risk = +1 → g = 1

Guardrail:
If S_risk is empty (risk_coverage == 0), set g = 1 (do not penalize alpha-only strategies).

H6) Final Strategy Output (What the Signal Merger Uses)

final_score_raw = alpha_score × g(risk_score)
final_score = clamp(final_score_raw, -1.0, +1.0)

Implications:
- Risk-only subset → alpha_score = 0 → final_score = 0 (neutral; prevents semantic failure)
- Alpha-only subset → final_score = alpha_score
- Mixed subset → risk scales alpha, preserving sign

H7) Risk-Signal Influence Ceiling (Extra Safety for Sparse Subsets)

Even with normalization, sparse subsets can behave aggressively.
To prevent a single risk signal from dominating risk_score:

Within S_risk, enforce a per-signal ceiling:

Let risk_total_weight = Σ_{j∈S_risk} w_j'
For each risk signal j:
effective_weight_j = min(w_j', 0.25 × risk_total_weight)

Then compute risk_score using effective_weight_j instead of w_j'.

(Note: this preserves boundedness and prevents “liquidity-only” from looking like strong conviction.)

H8) Domain Caps (Retained as Guardrails)

Domain caps in Section E remain applicable as guardrails for:
- decider-wide rollups
- monitoring
- pathological correlation cases

They do not replace subset normalization; they complement it.

H9) Coverage Metadata (Strongly Recommended for LLM)

Expose to the LLM (or to the decider that prompts the LLM):

alpha_coverage = Σ w_i' in S_alpha / Σ w_i' of all alpha signals (as available)
risk_coverage  = Σ w_i' in S_risk  / Σ w_i' of all risk signals (as available)

Low coverage should reduce trust / size / certainty in downstream reasoning.

H10) Quantization Timing (Important)

Quantization to 0.1 steps applies ONLY after:
- alpha_score is computed
- risk_score is computed
- final_score is computed

Do NOT quantize intermediate raw metrics earlier than the table definitions require.

=====================================================================
END ADDED — Weighting Method
=====================================================================


Global Conventions

Entity: one row per [stock, strategy] pair (e.g., AAPL + 7/20 SMA). Short description: Each row represents how one strategy sees one stock at a given moment.

Signal range: all scalar signals are in [-1.0, +1.0].

Resolution: values are quantized to 0.1 steps (…, -0.3, -0.2, -0.1, 0.0, +0.1, +0.2, +0.3, …).

Interpretation:

+1.0 = extreme positive condition for that signal.

-1.0 = extreme negative condition.

0.0 = neutral / baseline.

The table below defines what +1 / -1 actually mean for each signal in human language. Engineering will later map raw APIs → these scores.

Valuation & Fundamentals 1.1 valuation_score
Domain: Fundamentals / Valuation

What it measures: Cheap vs expensive relative to peers and own history

Short description: Overall “cheap vs expensive” tilt of the stock.

+1.0: “Extremely cheap versus sector peers and its own 5–10 year history (e.g., bottom decile of valuation ratios like P/E, EV/EBITDA, P/B after adjusting for growth and quality). Strong ‘value’ candidate.”

-1.0: “Extremely expensive versus sector peers and its own history (top decile of valuation ratios, pricing in very optimistic assumptions). Priced for perfection.”

0.0: “Roughly fairly valued versus peers and history. No strong value or overvaluation signal.”

1.2 earnings_momentum_score

Domain: Fundamentals / Earnings

What it measures: Direction and strength of earnings revisions & surprises

Short description: How aggressively earnings are being revised up or down.

+1.0: “Earnings are being revised up aggressively and consistently; recent reports show strong positive surprises on EPS and guidance.”

-1.0: “Earnings are being revised down sharply; recent reports show negative surprises and/or downgraded guidance.”

0.0: “Earnings revisions and surprises are broadly flat or mixed; no clear trend.”

1.3 revenue_growth_score

Domain: Fundamentals / Growth

What it measures: Top-line growth strength vs peers and history

Short description: Strength and consistency of revenue growth.

+1.0: “Sustained, high revenue growth (top decile vs sector) with acceleration vs its own history.”

-1.0: “Revenue shrinking meaningfully or stagnating at the bottom decile vs sector, with clear deceleration vs history.”

0.0: “Revenue growth roughly in line with its sector and own historical averages.”

1.4 quality_score

Domain: Fundamentals / Quality

What it measures: Profitability, balance sheet, earnings stability

Short description: Overall business quality and financial robustness.

+1.0: “High return on capital, strong margins, low leverage, and stable earnings; balance sheet and cash flow are very robust vs peers.”

-1.0: “Weak or negative profitability, high leverage, poor cash generation, and unstable earnings vs peers.”

0.0: “Average quality: profitability, leverage, and stability broadly similar to sector norms.”

1.5 dividend_health_score (optional for dividend names)

Domain: Fundamentals / Capital Return

What it measures: Sustainability and attractiveness of dividend

Short description: How safe and attractive the dividend is.

+1.0: “Dividend yield attractive vs peers, well covered by cash flows, and a track record of stable or rising payouts.”

-1.0: “Dividend looks fragile: high payout ratio, weak coverage, history of cuts or suspensions, or yield signaling distress.”

0.0: “Dividend metrics broadly in line with sector and reasonably covered.”

Technical & Price Action 2.1 trend_strength_score
Domain: Technical / Trend

What it measures: Strength and persistence of up/down trend

Short description: How clearly the stock is trending up or down.

+1.0: “Strong, persistent uptrend across multiple timeframes (e.g., price above medium/long MAs, higher highs and higher lows, positive momentum vs index).”

-1.0: “Strong, persistent downtrend across multiple timeframes (lower lows, below key MAs, underperforming the index).”

0.0: “No clear trend; choppy or sideways behavior.”

2.2 pullback_timing_score

Domain: Technical / Mean Reversion

What it measures: Overbought / oversold state

Short description: Whether the stock looks stretched or washed-out.

+1.0: “Deeply oversold with early signs of stabilization; attractive mean-reversion candidate (e.g., extreme RSI/oscillators, stretched below moving averages).”

-1.0: “Extremely overbought and extended; stretched well above typical ranges and vulnerable to a pullback.”

0.0: “No meaningful overbought/oversold tension; price near ‘normal’ bands.”

2.3 volatility_regime_score

Domain: Technical / Volatility

What it measures: Current volatility level vs its own history

Short description: Whether the stock is in a calm or wild volatility regime.

+1.0: “Very calm, low-volatility regime vs its own past; daily ranges tight, realized vol at bottom decile of historical range.”

-1.0: “Highly volatile regime; large swings, realized vol at the top decile of historical range.”

0.0: “Volatility roughly in line with historical norms.”

Note: this is not “good vs bad”, it’s regime state. Decider uses this when sizing/risk-profiling.

2.4 liquidity_score

Domain: Microstructure / Liquidity

What it measures: Ease of trading without heavy slippage

Short description: How easy it is to get in and out without moving the price.

+1.0: “Highly liquid: tight spreads, deep order book, large average daily volume vs typical retail order sizes.”

-1.0: “Illiquid: wide spreads, thin depth, low volume; even modest trades may move price.”

0.0: “Acceptable liquidity for normal retail sizing, but not exceptional.”

2.5 relative_strength_score

Domain: Technical / Relative Performance

What it measures: Performance vs benchmark/sector

Short description: How strongly the stock is outperforming or underperforming its benchmark.

+1.0: “Strong outperformer vs its sector or index over the relevant lookback period(s).”

-1.0: “Persistent underperformer vs its sector or index.”

0.0: “In line with benchmark; no clear out- or under-performance.”

Flow & Microstructure 3.1 volume_flow_score
Domain: Flow / Volume

What it measures: Abnormal buy/sell pressure in volume terms

Short description: Strength and direction of unusual volume activity.

+1.0: “Strong, sustained upside volume vs normal (e.g., multi-sigma volume spikes on up moves), consistent with accumulation.”

-1.0: “Strong, sustained downside or liquidation volume vs normal (heavy selling, distribution).”

0.0: “Volume patterns near historical norms; no abnormal pressure.”

3.2 order_imbalance_score

Domain: Flow / Order Book

What it measures: Bid/ask pressure and short-term imbalance

Short description: Whether aggressive buyers or sellers dominate the tape.

+1.0: “Order book and recent tape show clear dominance of aggressive buyers vs sellers (persistent bid pressure).”

-1.0: “Aggressive sellers dominate; offers hit repeatedly, bids thin, consistent with short-term downside pressure.”

0.0: “Order flow roughly balanced; no clear dominance of one side.”

3.3 institutional_flow_score (if data available)

Domain: Flow / Ownership

What it measures: Direction of smart/large money positioning

Short description: Whether big money is accumulating or distributing the stock.

+1.0: “Evidence of significant net accumulation by institutions / large holders (position increases, block trades consistent with buying).”

-1.0: “Evidence of significant net distribution by large holders (reducing positions, block selling).”

0.0: “Institutional positioning broadly stable; no clear trend.”

Macro, Sector & Regime 4.1 sector_trend_score
Domain: Sector / Trend

What it measures: Health of the stock’s sector

Short description: How strong or weak the whole sector looks.

+1.0: “Sector is in a strong uptrend, outperforming the broad market with healthy breadth.”

-1.0: “Sector is in a clear downtrend, underperforming the broad market with weak breadth.”

0.0: “Sector moving broadly in line with the overall market; no strong trend.”

4.2 macro_regime_risk_score

Domain: Macro / Risk Regime

What it measures: Favourability of the broad macro environment for risk assets

Short description: How risk-on or risk-off the overall macro backdrop is.

+1.0: “Macro backdrop supportive of risk: low perceived systemic risk, benign rates/credit conditions, positive macro momentum.”

-1.0: “Stress regime: elevated systemic risk, tightening conditions, macro data deteriorating, risk-off behavior dominant.”

0.0: “Mixed or neutral macro environment; no strong risk-on or risk-off tilt.”

4.3 rates_sensitivity_score

Domain: Macro / Rates

What it measures: How current rate trends affect this stock

Short description: Net impact of current interest rate trends on this name.

+1.0: “Current rate environment is strongly favourable to this name/sector (e.g., rate cuts for rate-sensitive growth names where lower discount rates help).”

-1.0: “Current rate environment is strongly unfavourable (e.g., rapid hikes hurting long-duration cash flows or leveraged balance sheets).”

0.0: “Rates have limited or ambiguous impact on this name right now.”

4.4 event_risk_score

Domain: Macro / Idiosyncratic Events

What it measures: Near-term binary risk (earnings, litigation, regulatory, M&A, etc.)

Short description: How much near-term “binary” event risk hangs over the stock.

+1.0: “No significant known event risk on the horizon; risk profile is clean and predictable.”

-1.0: “High event risk window (e.g., imminent earnings with large implied move, major regulatory decision, key trial verdict).”

0.0: “Normal level of event risk; standard earnings/news calendar without large binary overhang.”

Correlation & Portfolio Context
This part is about how the stock behaves relative to other names and the user’s portfolio.

5.1 correlation_cluster_score

Domain: Correlation / Diversification

What it measures: How crowded / clustered the name is with others in the portfolio

Short description: How much this stock overlaps with risks already in the portfolio.

+1.0: “Low correlation vs user’s existing holdings; adds strong diversification benefits.”

-1.0: “Very high correlation to major existing positions or to a concentrated factor; adds little diversification and may amplify the same risk.”

0.0: “Moderately correlated; some diversification but not dramatic.”

5.2 idiosyncratic_alpha_score

Domain: Stock-specific Behaviour

What it measures: Stock’s tendency to move on its own story vs pure beta

Short description: How much the stock moves on its own story vs index/sector.

+1.0: “Recent returns show a strong idiosyncratic component (moves not fully explained by index/sector factors); genuine stock-specific edge potential.”

-1.0: “Stock mostly behaves like a pure factor exposure (index/sector proxy); little unique alpha, mainly systematic risk.”

0.0: “Mixed: some idiosyncratic behavior, some factor-like movement.”

Composite Domain Scores
Listener agents can also maintain composite “roll-ups” that the decider can use directly. These are also in [-1.0, +1.0] with 0.1 steps.

6.1 fundamental_score

Domain: Composite / Fundamentals

Built from: valuation_score, earnings_momentum_score, revenue_growth_score, quality_score, dividend_health_score (where relevant).

Short description: Single summary view of overall fundamental strength.

+1.0: “Fundamentals are exceptionally strong and attractive across valuation, growth, quality, and (if applicable) dividend health.”

-1.0: “Fundamentals are consistently weak or unfavourable across those dimensions.”

0.0: “Overall fundamental picture roughly average or mixed.”

6.2 technical_score

Domain: Composite / Technical

Built from: trend_strength_score, pullback_timing_score, relative_strength_score, volatility_regime_score, liquidity_score.

Short description: Single summary of the technical trading picture.

+1.0: “Technical picture is very constructive for the current strategy: strong trend or clean mean-reversion setup, good liquidity, supportive relative strength.”

-1.0: “Technical picture is hostile: weak/erratic trend, poor liquidity, unfavourable overbought/oversold context.”

0.0: “Technicals broadly neutral or conflicting; no clear edge.”

6.3 flow_score

Domain: Composite / Flow

Built from: volume_flow_score, order_imbalance_score, institutional_flow_score (where available).

Short description: Net direction and strength of capital flow into/out of the stock.

+1.0: “Flows are clearly supportive: accumulation, favourable order imbalance, and constructive large-holder behaviour.”

-1.0: “Flows clearly negative: distribution, selling pressure, and adverse behaviour of large holders.”

0.0: “Flow picture roughly neutral.”

6.4 regime_score

Domain: Composite / Macro & Sector

Built from: sector_trend_score, macro_regime_risk_score, rates_sensitivity_score, event_risk_score.

Short description: Combined read of macro + sector backdrop for this name.

+1.0: “Macro + sector regime is strongly supportive of taking risk in this name.”

-1.0: “Macro + sector regime is hostile to risk in this name; environment argues for defence or reduced exposure.”

0.0: “Balanced or unclear macro/sector backdrop.”

6.5 diversification_score

Domain: Composite / Portfolio Context

Built from: correlation_cluster_score, idiosyncratic_alpha_score.

Short description: Overall diversification and uniqueness contribution to the portfolio.

+1.0: “Name provides strong diversification and unique alpha relative to the user’s other holdings.”

-1.0: “Name is highly redundant with existing risks and offers little unique exposure.”

0.0: “Moderate diversification; neither strongly helpful nor harmful.”

Quantization Rule (For Engineers)
Short description: Final step that forces every signal into the same discrete scale.

For all signals defined above:

Internal computation may be continuous, but the final stored value in the context table MUST be:

Clamped: value_clamped = max(-1.0, min(1.0, raw_value))

Quantized to nearest 0.1: value_quantized = round(value_clamped * 10) / 10
