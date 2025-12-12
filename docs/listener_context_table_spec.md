# Index

0. **Global Conventions**  
   Defines how all signals are scaled, interpreted, and quantized into [-1.0, +1.0] with 0.1 steps.

1. **Valuation & Fundamentals**  
   Signal set describing how cheap/expensive, growing, profitable, and financially healthy a stock is.
   - 1.1 `valuation_score` – Cheap vs expensive vs peers and history.
   - 1.2 `earnings_momentum_score` – Direction/strength of earnings revisions and surprises.
   - 1.3 `revenue_growth_score` – Top-line growth vs sector and own history.
   - 1.4 `quality_score` – Profitability, leverage, and earnings stability.
   - 1.5 `dividend_health_score` – Sustainability and attractiveness of the dividend.

2. **Technical & Price Action**  
   Signal set describing trend, mean reversion, volatility regime, liquidity, and relative strength.
   - 2.1 `trend_strength_score` – Strength and persistence of the price trend.
   - 2.2 `pullback_timing_score` – Overbought vs oversold / mean-reversion state.
   - 2.3 `volatility_regime_score` – Current volatility level vs historical range.
   - 2.4 `liquidity_score` – Ease of trading without large slippage.
   - 2.5 `relative_strength_score` – Performance vs benchmark or sector.

3. **Flow & Microstructure**  
   Signal set capturing volume anomalies, order-book pressure, and institutional behaviour.
   - 3.1 `volume_flow_score` – Abnormal upside/downside volume pressure.
   - 3.2 `order_imbalance_score` – Short-term bid/ask dominance in the tape.
   - 3.3 `institutional_flow_score` – Net positioning of large/smart money.

4. **Macro, Sector & Regime**  
   Signal set describing sector health, macro risk regime, rates impact, and event risk.
   - 4.1 `sector_trend_score` – Sector-level trend vs the broad market.
   - 4.2 `macro_regime_risk_score` – Overall risk-on vs risk-off macro backdrop.
   - 4.3 `rates_sensitivity_score` – How current rates affect this stock/sector.
   - 4.4 `event_risk_score` – Near-term binary/event risk (earnings, regulation, etc.).

5. **Correlation & Portfolio Context**  
   Signals about diversification and how “unique” the stock’s behaviour is.
   - 5.1 `correlation_cluster_score` – Correlation vs existing holdings / crowding.
   - 5.2 `idiosyncratic_alpha_score` – Stock-specific behaviour vs pure beta.

6. **Composite Domain Scores**  
   Roll-up scores combining multiple raw signals into higher-level views for the decider.
   - 6.1 `fundamental_score` – Aggregate view of all fundamental signals.
   - 6.2 `technical_score` – Aggregate view of all technical signals.
   - 6.3 `flow_score` – Aggregate view of volume, order, and institutional flows.
   - 6.4 `regime_score` – Aggregate view of macro + sector conditions.
   - 6.5 `diversification_score` – Aggregate view of diversification and idiosyncrasy.

7. **Quantization Rule (For Engineers)**  
   Defines clamping and rounding rules to convert continuous raw values into discrete 0.1-step signals in [-1.0, +1.0].
Listener Context Table Spec


0. Global Conventions

Entity: one row per [stock, strategy] pair (e.g., AAPL + 7/20 SMA).
Short description: Each row represents how one strategy sees one stock at a given moment.

Signal range: all scalar signals are in [-1.0, +1.0].

Resolution: values are quantized to 0.1 steps
(…, -0.3, -0.2, -0.1, 0.0, +0.1, +0.2, +0.3, …).

Interpretation:

+1.0 = extreme positive condition for that signal.

-1.0 = extreme negative condition.

0.0 = neutral / baseline.

The table below defines what +1 / -1 actually mean for each signal in human language. Engineering will later map raw APIs → these scores.

1. Valuation & Fundamentals
1.1 valuation_score

Domain: Fundamentals / Valuation

What it measures: Cheap vs expensive relative to peers and own history

Short description: Overall “cheap vs expensive” tilt of the stock.

+1.0:
“Extremely cheap versus sector peers and its own 5–10 year history (e.g., bottom decile of valuation ratios like P/E, EV/EBITDA, P/B after adjusting for growth and quality). Strong ‘value’ candidate.”

-1.0:
“Extremely expensive versus sector peers and its own history (top decile of valuation ratios, pricing in very optimistic assumptions). Priced for perfection.”

0.0:
“Roughly fairly valued versus peers and history. No strong value or overvaluation signal.”

1.2 earnings_momentum_score

Domain: Fundamentals / Earnings

What it measures: Direction and strength of earnings revisions & surprises

Short description: How aggressively earnings are being revised up or down.

+1.0:
“Earnings are being revised up aggressively and consistently; recent reports show strong positive surprises on EPS and guidance.”

-1.0:
“Earnings are being revised down sharply; recent reports show negative surprises and/or downgraded guidance.”

0.0:
“Earnings revisions and surprises are broadly flat or mixed; no clear trend.”

1.3 revenue_growth_score

Domain: Fundamentals / Growth

What it measures: Top-line growth strength vs peers and history

Short description: Strength and consistency of revenue growth.

+1.0:
“Sustained, high revenue growth (top decile vs sector) with acceleration vs its own history.”

-1.0:
“Revenue shrinking meaningfully or stagnating at the bottom decile vs sector, with clear deceleration vs history.”

0.0:
“Revenue growth roughly in line with its sector and own historical averages.”

1.4 quality_score

Domain: Fundamentals / Quality

What it measures: Profitability, balance sheet, earnings stability

Short description: Overall business quality and financial robustness.

+1.0:
“High return on capital, strong margins, low leverage, and stable earnings; balance sheet and cash flow are very robust vs peers.”

-1.0:
“Weak or negative profitability, high leverage, poor cash generation, and unstable earnings vs peers.”

0.0:
“Average quality: profitability, leverage, and stability broadly similar to sector norms.”

1.5 dividend_health_score (optional for dividend names)

Domain: Fundamentals / Capital Return

What it measures: Sustainability and attractiveness of dividend

Short description: How safe and attractive the dividend is.

+1.0:
“Dividend yield attractive vs peers, well covered by cash flows, and a track record of stable or rising payouts.”

-1.0:
“Dividend looks fragile: high payout ratio, weak coverage, history of cuts or suspensions, or yield signaling distress.”

0.0:
“Dividend metrics broadly in line with sector and reasonably covered.”

2. Technical & Price Action
2.1 trend_strength_score

Domain: Technical / Trend

What it measures: Strength and persistence of up/down trend

Short description: How clearly the stock is trending up or down.

+1.0:
“Strong, persistent uptrend across multiple timeframes (e.g., price above medium/long MAs, higher highs and higher lows, positive momentum vs index).”

-1.0:
“Strong, persistent downtrend across multiple timeframes (lower lows, below key MAs, underperforming the index).”

0.0:
“No clear trend; choppy or sideways behavior.”

2.2 pullback_timing_score

Domain: Technical / Mean Reversion

What it measures: Overbought / oversold state

Short description: Whether the stock looks stretched or washed-out.

+1.0:
“Deeply oversold with early signs of stabilization; attractive mean-reversion candidate (e.g., extreme RSI/oscillators, stretched below moving averages).”

-1.0:
“Extremely overbought and extended; stretched well above typical ranges and vulnerable to a pullback.”

0.0:
“No meaningful overbought/oversold tension; price near ‘normal’ bands.”

2.3 volatility_regime_score

Domain: Technical / Volatility

What it measures: Current volatility level vs its own history

Short description: Whether the stock is in a calm or wild volatility regime.

+1.0:
“Very calm, low-volatility regime vs its own past; daily ranges tight, realized vol at bottom decile of historical range.”

-1.0:
“Highly volatile regime; large swings, realized vol at the top decile of historical range.”

0.0:
“Volatility roughly in line with historical norms.”

Note: this is not “good vs bad”, it’s regime state. Decider uses this when sizing/risk-profiling.

2.4 liquidity_score

Domain: Microstructure / Liquidity

What it measures: Ease of trading without heavy slippage

Short description: How easy it is to get in and out without moving the price.

+1.0:
“Highly liquid: tight spreads, deep order book, large average daily volume vs typical retail order sizes.”

-1.0:
“Illiquid: wide spreads, thin depth, low volume; even modest trades may move price.”

0.0:
“Acceptable liquidity for normal retail sizing, but not exceptional.”

2.5 relative_strength_score

Domain: Technical / Relative Performance

What it measures: Performance vs benchmark/sector

Short description: How strongly the stock is outperforming or underperforming its benchmark.

+1.0:
“Strong outperformer vs its sector or index over the relevant lookback period(s).”

-1.0:
“Persistent underperformer vs its sector or index.”

0.0:
“In line with benchmark; no clear out- or under-performance.”

3. Flow & Microstructure
3.1 volume_flow_score

Domain: Flow / Volume

What it measures: Abnormal buy/sell pressure in volume terms

Short description: Strength and direction of unusual volume activity.

+1.0:
“Strong, sustained upside volume vs normal (e.g., multi-sigma volume spikes on up moves), consistent with accumulation.”

-1.0:
“Strong, sustained downside or liquidation volume vs normal (heavy selling, distribution).”

0.0:
“Volume patterns near historical norms; no abnormal pressure.”

3.2 order_imbalance_score

Domain: Flow / Order Book

What it measures: Bid/ask pressure and short-term imbalance

Short description: Whether aggressive buyers or sellers dominate the tape.

+1.0:
“Order book and recent tape show clear dominance of aggressive buyers vs sellers (persistent bid pressure).”

-1.0:
“Aggressive sellers dominate; offers hit repeatedly, bids thin, consistent with short-term downside pressure.”

0.0:
“Order flow roughly balanced; no clear dominance of one side.”

3.3 institutional_flow_score (if data available)

Domain: Flow / Ownership

What it measures: Direction of smart/large money positioning

Short description: Whether big money is accumulating or distributing the stock.

+1.0:
“Evidence of significant net accumulation by institutions / large holders (position increases, block trades consistent with buying).”

-1.0:
“Evidence of significant net distribution by large holders (reducing positions, block selling).”

0.0:
“Institutional positioning broadly stable; no clear trend.”

4. Macro, Sector & Regime
4.1 sector_trend_score

Domain: Sector / Trend

What it measures: Health of the stock’s sector

Short description: How strong or weak the whole sector looks.

+1.0:
“Sector is in a strong uptrend, outperforming the broad market with healthy breadth.”

-1.0:
“Sector is in a clear downtrend, underperforming the broad market with weak breadth.”

0.0:
“Sector moving broadly in line with the overall market; no strong trend.”

4.2 macro_regime_risk_score

Domain: Macro / Risk Regime

What it measures: Favourability of the broad macro environment for risk assets

Short description: How risk-on or risk-off the overall macro backdrop is.

+1.0:
“Macro backdrop supportive of risk: low perceived systemic risk, benign rates/credit conditions, positive macro momentum.”

-1.0:
“Stress regime: elevated systemic risk, tightening conditions, macro data deteriorating, risk-off behavior dominant.”

0.0:
“Mixed or neutral macro environment; no strong risk-on or risk-off tilt.”

4.3 rates_sensitivity_score

Domain: Macro / Rates

What it measures: How current rate trends affect this stock

Short description: Net impact of current interest rate trends on this name.

+1.0:
“Current rate environment is strongly favourable to this name/sector (e.g., rate cuts for rate-sensitive growth names where lower discount rates help).”

-1.0:
“Current rate environment is strongly unfavourable (e.g., rapid hikes hurting long-duration cash flows or leveraged balance sheets).”

0.0:
“Rates have limited or ambiguous impact on this name right now.”

4.4 event_risk_score

Domain: Macro / Idiosyncratic Events

What it measures: Near-term binary risk (earnings, litigation, regulatory, M&A, etc.)

Short description: How much near-term “binary” event risk hangs over the stock.

+1.0:
“No significant known event risk on the horizon; risk profile is clean and predictable.”

-1.0:
“High event risk window (e.g., imminent earnings with large implied move, major regulatory decision, key trial verdict).”

0.0:
“Normal level of event risk; standard earnings/news calendar without large binary overhang.”

5. Correlation & Portfolio Context

This part is about how the stock behaves relative to other names and the user’s portfolio.

5.1 correlation_cluster_score

Domain: Correlation / Diversification

What it measures: How crowded / clustered the name is with others in the portfolio

Short description: How much this stock overlaps with risks already in the portfolio.

+1.0:
“Low correlation vs user’s existing holdings; adds strong diversification benefits.”

-1.0:
“Very high correlation to major existing positions or to a concentrated factor; adds little diversification and may amplify the same risk.”

0.0:
“Moderately correlated; some diversification but not dramatic.”

5.2 idiosyncratic_alpha_score

Domain: Stock-specific Behaviour

What it measures: Stock’s tendency to move on its own story vs pure beta

Short description: How much the stock moves on its own story vs index/sector.

+1.0:
“Recent returns show a strong idiosyncratic component (moves not fully explained by index/sector factors); genuine stock-specific edge potential.”

-1.0:
“Stock mostly behaves like a pure factor exposure (index/sector proxy); little unique alpha, mainly systematic risk.”

0.0:
“Mixed: some idiosyncratic behavior, some factor-like movement.”

6. Composite Domain Scores

Listener agents can also maintain composite “roll-ups” that the decider can use directly. These are also in [-1.0, +1.0] with 0.1 steps.

6.1 fundamental_score

Domain: Composite / Fundamentals

Built from: valuation_score, earnings_momentum_score, revenue_growth_score, quality_score, dividend_health_score (where relevant).

Short description: Single summary view of overall fundamental strength.

+1.0:
“Fundamentals are exceptionally strong and attractive across valuation, growth, quality, and (if applicable) dividend health.”

-1.0:
“Fundamentals are consistently weak or unfavourable across those dimensions.”

0.0:
“Overall fundamental picture roughly average or mixed.”

6.2 technical_score

Domain: Composite / Technical

Built from: trend_strength_score, pullback_timing_score, relative_strength_score, volatility_regime_score, liquidity_score.

Short description: Single summary of the technical trading picture.

+1.0:
“Technical picture is very constructive for the current strategy: strong trend or clean mean-reversion setup, good liquidity, supportive relative strength.”

-1.0:
“Technical picture is hostile: weak/erratic trend, poor liquidity, unfavourable overbought/oversold context.”

0.0:
“Technicals broadly neutral or conflicting; no clear edge.”

6.3 flow_score

Domain: Composite / Flow

Built from: volume_flow_score, order_imbalance_score, institutional_flow_score (where available).

Short description: Net direction and strength of capital flow into/out of the stock.

+1.0:
“Flows are clearly supportive: accumulation, favourable order imbalance, and constructive large-holder behaviour.”

-1.0:
“Flows clearly negative: distribution, selling pressure, and adverse behaviour of large holders.”

0.0:
“Flow picture roughly neutral.”

6.4 regime_score

Domain: Composite / Macro & Sector

Built from: sector_trend_score, macro_regime_risk_score, rates_sensitivity_score, event_risk_score.

Short description: Combined read of macro + sector backdrop for this name.

+1.0:
“Macro + sector regime is strongly supportive of taking risk in this name.”

-1.0:
“Macro + sector regime is hostile to risk in this name; environment argues for defence or reduced exposure.”

0.0:
“Balanced or unclear macro/sector backdrop.”

6.5 diversification_score

Domain: Composite / Portfolio Context

Built from: correlation_cluster_score, idiosyncratic_alpha_score.

Short description: Overall diversification and uniqueness contribution to the portfolio.

+1.0:
“Name provides strong diversification and unique alpha relative to the user’s other holdings.”

-1.0:
“Name is highly redundant with existing risks and offers little unique exposure.”

0.0:
“Moderate diversification; neither strongly helpful nor harmful.”

7. Quantization Rule (For Engineers)

Short description: Final step that forces every signal into the same discrete scale.

For all signals defined above:

Internal computation may be continuous, but the final stored value in the context table MUST be:

Clamped:
value_clamped = max(-1.0, min(1.0, raw_value))

Quantized to nearest 0.1:
value_quantized = round(value_clamped * 10) / 10