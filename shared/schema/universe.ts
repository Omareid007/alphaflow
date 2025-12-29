/**
 * @module schema/universe
 * @description Asset universe management and screening system.
 *
 * This module manages the tradable asset universe through:
 * - Asset discovery and metadata (Alpaca API)
 * - Multi-factor screening (liquidity, fundamentals, technicals)
 * - Classification and tier assignment
 * - Candidate evaluation workflow (NEW → APPROVED)
 *
 * Asset Screening Workflow:
 * 1. Ingest all assets → universeAssets (tradability flags)
 * 2. Calculate liquidity → universeLiquidityMetrics (volume, spread, tier)
 * 3. Fetch fundamentals → universeFundamentals (financial metrics, valuation)
 * 4. Compute technicals → universeTechnicals (indicators, price action)
 * 5. Classify assets → assetClassifications (multi-factor scoring)
 * 6. Generate candidates → universeCandidates (top scorers)
 * 7. Manual review → Update status (APPROVED/REJECTED)
 *
 * Screening Filters:
 * - Tradability: Must be tradable, fractionable, not OTC
 * - Liquidity: Minimum daily volume, tight bid-ask spread
 * - Quality: Financial health, profitability, low debt
 * - Momentum: Price trends, relative strength
 * - Valuation: P/E, P/B ratios vs sector averages
 *
 * Tier Assignments:
 * - Liquidity: A (highly liquid) → C (thinly traded)
 * - Market Cap: mega → micro
 * - Volatility: high → low
 * - Asset Class: growth/value, sector, crypto
 *
 * Relationships:
 * - universeAssets: Base asset metadata (1:1 with symbol)
 * - universeLiquidityMetrics: Liquidity analysis (1:1 with symbol)
 * - universeFundamentals: Financial data (1:1 with symbol)
 * - universeTechnicals: Technical indicators (1:many, time series)
 * - assetClassifications: Multi-factor scores (1:1 with symbol)
 * - universeCandidates: Approved trading candidates (filtered subset)
 *
 * @see aiDecisions - Uses universe candidates for trade ideas
 */

import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, numeric, boolean, integer, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Candidate evaluation status.
 *
 * Workflow states:
 * - 'NEW': Newly discovered candidate, awaiting review
 * - 'WATCHLISTED': Flagged for monitoring (not yet approved)
 * - 'APPROVED': Passed screening, eligible for trading
 * - 'REJECTED': Failed screening or manual review
 *
 * Transitions:
 * NEW → WATCHLISTED (needs more data)
 * NEW → APPROVED (passed all filters)
 * NEW → REJECTED (failed filters)
 * WATCHLISTED → APPROVED (conditions met)
 * WATCHLISTED → REJECTED (conditions failed)
 */
export type CandidateStatus = "NEW" | "WATCHLISTED" | "APPROVED" | "REJECTED";

/**
 * Liquidity tier classification.
 *
 * Based on trading volume and bid-ask spread:
 * - 'A': Highly liquid (> $10M daily volume, < 0.05% spread)
 *   → Large cap stocks, major ETFs
 *   → Best execution, minimal slippage
 * - 'B': Moderately liquid ($1M-$10M daily, 0.05%-0.2% spread)
 *   → Mid cap stocks, sector ETFs
 *   → Acceptable execution, some slippage
 * - 'C': Thinly traded (< $1M daily, > 0.2% spread)
 *   → Small cap stocks, illiquid securities
 *   → Poor execution, high slippage risk
 *
 * Position sizing by tier:
 * - Tier A: Up to 10% portfolio (high conviction)
 * - Tier B: Up to 5% portfolio (standard)
 * - Tier C: Up to 2% portfolio (limited liquidity)
 */
export type LiquidityTier = "A" | "B" | "C";

/**
 * Market capitalization tier.
 *
 * Based on market cap (price × shares outstanding):
 * - 'mega': > $200B (AAPL, MSFT, NVDA)
 * - 'large': $10B-$200B (S&P 500 companies)
 * - 'mid': $2B-$10B (S&P 400 companies)
 * - 'small': $300M-$2B (Russell 2000)
 * - 'micro': < $300M (high risk)
 *
 * Risk characteristics:
 * - Mega/Large: Lower volatility, stable earnings
 * - Mid: Growth potential, moderate risk
 * - Small/Micro: High volatility, speculative
 */
export type MarketCapTier = "mega" | "large" | "mid" | "small" | "micro";

/**
 * Volatility tier classification.
 *
 * Based on historical volatility (ATR, standard deviation):
 * - 'high': > 3% daily ATR (volatile, high beta)
 *   → Crypto, biotech, speculative growth
 *   → Wider stops, smaller position sizes
 * - 'medium': 1%-3% daily ATR (normal stocks)
 *   → Most equities, standard risk
 * - 'low': < 1% daily ATR (stable, low beta)
 *   → Utilities, consumer staples, bonds
 *   → Tighter stops, larger position sizes
 *
 * Position sizing by volatility:
 * - High: 1-2% portfolio risk per trade
 * - Medium: 2-3% portfolio risk per trade
 * - Low: 3-5% portfolio risk per trade
 */
export type VolatilityTier = "high" | "medium" | "low";

/**
 * Trend strength classification.
 *
 * Based on price action and moving averages:
 * - 'strong_up': Clear uptrend (price > SMA50 > SMA200, ADX > 25)
 *   → Momentum long candidates
 * - 'weak_up': Mild uptrend (price > SMA50, ADX < 25)
 *   → Range-bound, wait for breakout
 * - 'neutral': No clear trend (choppy, sideways)
 *   → Avoid or use mean reversion
 * - 'weak_down': Mild downtrend (price < SMA50)
 *   → Bounce plays, short candidates
 * - 'strong_down': Clear downtrend (price < SMA50 < SMA200, ADX > 25)
 *   → Momentum short candidates
 *
 * Strategy selection:
 * - strong_up/strong_down: Trend following
 * - weak_up/weak_down: Range trading
 * - neutral: Mean reversion or avoid
 */
export type TrendStrength = "strong_up" | "weak_up" | "neutral" | "weak_down" | "strong_down";

/**
 * Asset class type for portfolio allocation.
 *
 * Equity classifications:
 * - 'large_cap_growth': Large cap with high P/E, revenue growth
 * - 'large_cap_value': Large cap with low P/E, dividends
 * - 'mid_cap_growth': Mid cap with expanding margins
 * - 'mid_cap_value': Mid cap undervalued vs peers
 * - 'small_cap': Small cap growth opportunities
 *
 * Crypto classifications:
 * - 'crypto_major': BTC, ETH (blue chip crypto)
 * - 'crypto_alt': Alt coins (higher risk/reward)
 *
 * ETF classifications:
 * - 'etf_index': Broad market (SPY, QQQ, IWM)
 * - 'etf_sector': Sector-specific (XLF, XLE, XLK)
 *
 * Portfolio construction:
 * - Diversify across asset classes
 * - Limit concentration in single class
 * - Rebalance periodically
 */
export type AssetClassType =
  | "large_cap_growth"
  | "large_cap_value"
  | "mid_cap_growth"
  | "mid_cap_value"
  | "small_cap"
  | "crypto_major"
  | "crypto_alt"
  | "etf_index"
  | "etf_sector";

// ============================================================================
// TABLES
// ============================================================================

/**
 * Base asset metadata and tradability attributes.
 *
 * Data Source: Alpaca API /v2/assets
 * Update Frequency: Daily
 * Coverage: All assets available on Alpaca
 *
 * Contains essential asset information:
 * - Symbol, name, exchange
 * - Trading permissions (tradable, marginable, shortable)
 * - Asset characteristics (fractionable, easy to borrow)
 * - Risk flags (OTC, SPAC, penny stock)
 *
 * Tradability Flags:
 * - tradable: Can be traded on platform (required for candidates)
 * - marginable: Eligible for margin trading
 * - shortable: Can be sold short
 * - fractionable: Supports fractional shares
 * - easyToBorrow: Available for short selling without difficulty
 *
 * Exclusion Filters:
 * - isOtc: Over-the-counter (avoid - poor liquidity)
 * - isSpac: Special purpose acquisition company (avoid - high risk)
 * - isPennyStock: Price < $5 (avoid - manipulation risk)
 * - excluded: Manually excluded (see excludeReason)
 *
 * Asset Status Values:
 * - 'active': Currently tradable
 * - 'inactive': Delisted or suspended
 * - 'halted': Trading halted temporarily
 *
 * Screening Logic:
 * 1. Must be tradable = true
 * 2. Must not be OTC, SPAC, or penny stock
 * 3. Must not be manually excluded
 * 4. Should be marginable (preferred)
 * 5. Should be fractionable (preferred)
 *
 * @see universeLiquidityMetrics - Liquidity analysis for this asset
 * @see universeFundamentals - Fundamental data for this asset
 */
export const universeAssets = pgTable("universe_assets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  exchange: text("exchange").notNull(),
  assetClass: text("asset_class").notNull(),
  status: text("status").notNull(),
  tradable: boolean("tradable").default(false).notNull(),
  marginable: boolean("marginable").default(false).notNull(),
  shortable: boolean("shortable").default(false).notNull(),
  fractionable: boolean("fractionable").default(false).notNull(),
  easyToBorrow: boolean("easy_to_borrow").default(false).notNull(),
  isOtc: boolean("is_otc").default(false).notNull(),
  isSpac: boolean("is_spac").default(false).notNull(),
  isPennyStock: boolean("is_penny_stock").default(false).notNull(),
  excluded: boolean("excluded").default(false).notNull(),
  excludeReason: text("exclude_reason"),
  lastRefreshedAt: timestamp("last_refreshed_at").defaultNow().notNull(),
  rawJson: jsonb("raw_json"),
}, (table) => [
  index("universe_assets_symbol_idx").on(table.symbol),
  index("universe_assets_tradable_idx").on(table.tradable),
  index("universe_assets_exchange_idx").on(table.exchange),
]);

/**
 * Liquidity metrics and tier classification.
 *
 * Data Sources: Alpaca bars API, real-time quotes
 * Update Frequency: Daily (end of day calculation)
 * Lookback Period: 30 days (default)
 *
 * Calculates trading liquidity to assess execution quality:
 * - Volume (shares and dollar volume)
 * - Bid-ask spreads (execution cost)
 * - Tier classification (A/B/C)
 *
 * Key Metrics:
 * - avgDailyVolumeShares: Average daily share volume (30-day)
 * - avgDailyTradedValueUsd: Average dollar volume traded per day
 * - avgBidAskSpreadPct: Average bid-ask spread as % of price
 * - latestPrice: Most recent closing price
 *
 * Liquidity Tier Calculation:
 * Tier A (Highly Liquid):
 *   - Avg daily volume > $10M
 *   - Avg spread < 0.05%
 *   - Large cap stocks, major ETFs
 *
 * Tier B (Moderately Liquid):
 *   - Avg daily volume $1M-$10M
 *   - Avg spread 0.05%-0.2%
 *   - Mid cap stocks, sector ETFs
 *
 * Tier C (Thinly Traded):
 *   - Avg daily volume < $1M
 *   - Avg spread > 0.2%
 *   - Small cap stocks, illiquid assets
 *
 * Trading Impact:
 * - Tier A: Can trade large positions (> 1% ADV)
 * - Tier B: Limit to 0.5% ADV per order
 * - Tier C: Limit to 0.25% ADV, use limit orders
 *
 * Position Sizing by Tier:
 * - Tier A: Up to 10% portfolio
 * - Tier B: Up to 5% portfolio
 * - Tier C: Up to 2% portfolio
 *
 * @see universeAssets - Base asset record
 * @see assetClassifications - Uses liquidityTier for scoring
 */
export const universeLiquidityMetrics = pgTable("universe_liquidity_metrics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  avgDailyVolumeShares: numeric("avg_daily_volume_shares"),
  avgDailyTradedValueUsd: numeric("avg_daily_traded_value_usd"),
  avgBidAskSpreadPct: numeric("avg_bid_ask_spread_pct"),
  latestPrice: numeric("latest_price"),
  priceDataDays: integer("price_data_days").default(30),
  liquidityTier: text("liquidity_tier"),
  source: text("source").notNull(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  rawJson: jsonb("raw_json"),
}, (table) => [
  index("universe_liquidity_symbol_idx").on(table.symbol),
  index("universe_liquidity_tier_idx").on(table.liquidityTier),
]);

/**
 * Fundamental financial metrics and valuation data.
 *
 * Data Sources: Finnhub, Alpha Vantage, company filings
 * Update Frequency: Quarterly (after earnings) + daily price metrics
 * Coverage: US equities with financial data
 *
 * Contains financial health and valuation metrics:
 * - Profitability (margins, returns)
 * - Growth (revenue CAGR)
 * - Valuation (P/E, P/B, dividend yield)
 * - Risk (debt/equity, beta)
 * - Sector/industry classification
 *
 * Profitability Metrics:
 * - grossMargin: (Revenue - COGS) / Revenue
 * - operatingMargin: Operating Income / Revenue
 * - netMargin: Net Income / Revenue
 * - freeCashFlowMargin: FCF / Revenue
 *
 * Growth Metrics:
 * - revenueCagr3y: 3-year compound annual growth rate
 * - sharesDilution1y: Year-over-year share count change (negative = buybacks)
 *
 * Valuation Metrics:
 * - peRatio: Price / Earnings (< 15 = value, > 30 = growth/expensive)
 * - priceToBook: Price / Book Value (< 1 = undervalued)
 * - dividendYield: Annual dividend / Price
 *
 * Risk Metrics:
 * - debtToEquity: Total Debt / Shareholders Equity (< 1 = conservative)
 * - beta: Volatility vs market (> 1 = more volatile, < 1 = less volatile)
 *
 * Quality Screening:
 * High Quality:
 *   - Net margin > 15%
 *   - Debt/equity < 0.5
 *   - Positive revenue growth
 *   - Consistent profitability
 *
 * Value Screening:
 *   - P/E < sector average
 *   - P/B < 2.0
 *   - Dividend yield > 2%
 *   - Low debt
 *
 * Growth Screening:
 *   - Revenue CAGR > 15%
 *   - Expanding margins
 *   - Low/negative dilution
 *   - Strong free cash flow
 *
 * @see universeAssets - Base asset record
 * @see assetClassifications - Uses fundamentals for quality/value scores
 */
export const universeFundamentals = pgTable("universe_fundamentals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  marketCap: numeric("market_cap"),
  revenueTtm: numeric("revenue_ttm"),
  revenueCagr3y: numeric("revenue_cagr_3y"),
  grossMargin: numeric("gross_margin"),
  operatingMargin: numeric("operating_margin"),
  netMargin: numeric("net_margin"),
  freeCashFlowMargin: numeric("free_cash_flow_margin"),
  debtToEquity: numeric("debt_to_equity"),
  sharesDilution1y: numeric("shares_dilution_1y"),
  peRatio: numeric("pe_ratio"),
  priceToBook: numeric("price_to_book"),
  beta: numeric("beta"),
  week52High: numeric("week_52_high"),
  week52Low: numeric("week_52_low"),
  dividendYield: numeric("dividend_yield"),
  sector: text("sector"),
  industry: text("industry"),
  source: text("source").notNull(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  rawJson: jsonb("raw_json"),
}, (table) => [
  index("universe_fundamentals_symbol_idx").on(table.symbol),
  index("universe_fundamentals_sector_idx").on(table.sector),
]);

/**
 * Technical analysis indicators and price metrics.
 *
 * Data Sources: Alpaca bars API, calculated indicators
 * Update Frequency: Daily (end of day)
 * Coverage: All tradable assets with price history
 *
 * Time series table storing daily technical indicators:
 * - Price action (OHLCV, VWAP)
 * - Moving averages (SMA, EMA)
 * - Momentum indicators (RSI, MACD)
 * - Volatility (ATR, Bollinger Bands)
 * - Trend strength (ADX, DI)
 * - Support/resistance (Pivot Points)
 *
 * Price Metrics:
 * - open, high, low, close: OHLC bars
 * - volume: Trading volume (shares)
 * - vwap: Volume-weighted average price
 *
 * Moving Averages:
 * - sma20, sma50, sma200: Simple moving averages
 * - ema12, ema26: Exponential moving averages
 * - Golden cross: SMA50 > SMA200 (bullish)
 * - Death cross: SMA50 < SMA200 (bearish)
 *
 * Momentum Indicators:
 * - rsi14: Relative Strength Index (0-100)
 *   → < 30 = oversold, > 70 = overbought
 * - macd, macdSignal, macdHistogram: MACD indicator
 *   → Histogram > 0 = bullish momentum
 *
 * Volatility Indicators:
 * - atr14: Average True Range (14-period)
 *   → Used for stop loss placement
 * - bollingerUpper, bollingerLower: Bollinger Bands
 *   → Price near upper = overbought, near lower = oversold
 *
 * Trend Strength:
 * - adx14: Average Directional Index (0-100)
 *   → > 25 = strong trend, < 20 = weak/no trend
 * - plusDi, minusDi: Directional indicators
 *   → +DI > -DI = uptrend, +DI < -DI = downtrend
 *
 * Support/Resistance:
 * - pivotPoint: Central pivot level
 * - resistance1, support1: First resistance/support levels
 *   → Use for entry/exit targets
 *
 * Technical Screening:
 * Momentum Longs:
 *   - RSI > 50 (bullish momentum)
 *   - MACD histogram > 0
 *   - Price > SMA50 > SMA200
 *   - ADX > 25 (strong trend)
 *
 * Mean Reversion:
 *   - RSI < 30 (oversold)
 *   - Price near lower Bollinger
 *   - ADX < 20 (range-bound)
 *
 * Breakout Detection:
 *   - Volume > 2x average
 *   - Price breaks resistance
 *   - ADX rising
 *
 * @see universeAssets - Base asset record
 * @see assetClassifications - Uses technicals for momentum/trend scores
 */
export const universeTechnicals = pgTable("universe_technicals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  date: timestamp("date").notNull(),
  open: numeric("open"),
  high: numeric("high"),
  low: numeric("low"),
  close: numeric("close"),
  volume: numeric("volume"),
  vwap: numeric("vwap"),
  sma20: numeric("sma_20"),
  sma50: numeric("sma_50"),
  sma200: numeric("sma_200"),
  ema12: numeric("ema_12"),
  ema26: numeric("ema_26"),
  rsi14: numeric("rsi_14"),
  macd: numeric("macd"),
  macdSignal: numeric("macd_signal"),
  macdHistogram: numeric("macd_histogram"),
  atr14: numeric("atr_14"),
  bollingerUpper: numeric("bollinger_upper"),
  bollingerLower: numeric("bollinger_lower"),
  adx14: numeric("adx_14"),
  plusDi: numeric("plus_di"),
  minusDi: numeric("minus_di"),
  pivotPoint: numeric("pivot_point"),
  resistance1: numeric("resistance_1"),
  support1: numeric("support_1"),
  source: text("source").notNull(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
}, (table) => [
  index("universe_technicals_symbol_idx").on(table.symbol),
  index("universe_technicals_date_idx").on(table.date),
  unique("universe_technicals_symbol_date_unique").on(table.symbol, table.date),
]);

/**
 * Multi-factor asset classification and scoring.
 *
 * Aggregates data from all universe tables to:
 * - Assign tier classifications (liquidity, market cap, volatility)
 * - Calculate multi-factor scores (momentum, value, quality)
 * - Classify asset type (large cap growth/value, etc.)
 * - Determine trend strength
 *
 * Data Sources:
 * - universeLiquidityMetrics: liquidityTier
 * - universeFundamentals: marketCapTier, sector metrics
 * - universeTechnicals: volatilityTier, trendStrength
 * - Calculated scores: momentumScore, valueScore, qualityScore
 *
 * Classification System:
 * - assetClass: Large/mid/small cap, growth/value, crypto, ETF
 * - marketCapTier: mega/large/mid/small/micro
 * - liquidityTier: A/B/C
 * - volatilityTier: high/medium/low
 * - trendStrength: strong_up/weak_up/neutral/weak_down/strong_down
 *
 * Factor Scores (0-100):
 *
 * Momentum Score:
 * - Price vs moving averages (weight: 30%)
 * - RSI and MACD signals (weight: 30%)
 * - Trend strength (ADX) (weight: 20%)
 * - Volume trend (weight: 20%)
 * → High score = strong uptrend
 *
 * Value Score:
 * - P/E ratio vs sector (weight: 30%)
 * - P/B ratio (weight: 25%)
 * - Dividend yield (weight: 15%)
 * - Free cash flow yield (weight: 30%)
 * → High score = undervalued
 *
 * Quality Score:
 * - Profitability margins (weight: 35%)
 * - Revenue growth (weight: 25%)
 * - Debt/equity ratio (weight: 20%)
 * - Share buybacks (weight: 20%)
 * → High score = financially healthy
 *
 * Composite Screening:
 * - High momentum + high quality = Growth stocks
 * - High value + high quality = Value stocks
 * - High momentum + low quality = Speculative plays
 * - Low momentum + high value = Deep value / turnarounds
 *
 * @see universeAssets - Base asset metadata
 * @see universeLiquidityMetrics - Liquidity tier input
 * @see universeFundamentals - Value/quality score inputs
 * @see universeTechnicals - Momentum/trend inputs
 * @see universeCandidates - Uses scores for candidate selection
 */
export const assetClassifications = pgTable("asset_classifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  assetClass: text("asset_class"),
  marketCapTier: text("market_cap_tier"),
  liquidityTier: text("liquidity_tier"),
  volatilityTier: text("volatility_tier"),
  trendStrength: text("trend_strength"),
  momentumScore: numeric("momentum_score"),
  valueScore: numeric("value_score"),
  qualityScore: numeric("quality_score"),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  source: text("source").notNull(),
  rawJson: jsonb("raw_json"),
}, (table) => [
  index("asset_classifications_symbol_idx").on(table.symbol),
  index("asset_classifications_asset_class_idx").on(table.assetClass),
  index("asset_classifications_market_cap_tier_idx").on(table.marketCapTier),
]);

/**
 * Curated trading candidates from universe screening.
 *
 * The final output of the asset screening workflow:
 * 1. Filter universeAssets (tradable, not OTC/SPAC/penny)
 * 2. Require minimum liquidity (Tier A or B)
 * 3. Calculate multi-factor scores (momentum, value, quality)
 * 4. Rank by composite score
 * 5. Generate candidates for top N assets
 * 6. Manual review (NEW → APPROVED/REJECTED)
 *
 * Candidate Workflow:
 * - NEW: System-generated candidate, awaiting review
 * - WATCHLISTED: Interesting but needs more data/time
 * - APPROVED: Cleared for trading by AI decision engine
 * - REJECTED: Failed manual review or invalidated
 *
 * Scoring System:
 * - liquidityScore: Tier-weighted volume score (0-100)
 * - growthScore: Revenue growth + momentum (0-100)
 * - qualityScore: Profitability + financial health (0-100)
 * - finalScore: Weighted composite of all scores (0-100)
 *
 * Final Score Calculation:
 * finalScore = (liquidityScore × 0.3) + (growthScore × 0.35) + (qualityScore × 0.35)
 *
 * Minimum Thresholds:
 * - finalScore > 60 (required for candidacy)
 * - liquidityScore > 50 (Tier B minimum)
 * - qualityScore > 40 (financially stable)
 *
 * Theme Tags:
 * Categorical tags for portfolio diversification:
 * - Sectors: "technology", "healthcare", "finance"
 * - Styles: "growth", "value", "momentum"
 * - Themes: "AI", "clean_energy", "biotech"
 * - Special: "dividend", "buyback", "insider_buying"
 *
 * Tier System:
 * - Tier 1: finalScore > 80 (high conviction, 5-10% allocation)
 * - Tier 2: finalScore 70-80 (standard, 2-5% allocation)
 * - Tier 3: finalScore 60-70 (speculative, 1-2% allocation)
 *
 * Manual Review Fields:
 * - rationale: AI-generated reasoning for candidacy
 * - approvedBy: User who approved (NULL if not approved)
 * - approvedAt: Timestamp of approval
 * - traceId: AI decision trace for audit
 *
 * Only APPROVED candidates are eligible for:
 * - AI decision generation (aiDecisions)
 * - Automated trade execution
 * - Portfolio inclusion
 *
 * @see universeAssets - Base asset data
 * @see assetClassifications - Source of factor scores
 * @see aiDecisions - Consumes approved candidates
 */
export const universeCandidates = pgTable("universe_candidates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  tier: text("tier").notNull(),
  liquidityScore: numeric("liquidity_score"),
  growthScore: numeric("growth_score"),
  qualityScore: numeric("quality_score"),
  finalScore: numeric("final_score"),
  themeTags: jsonb("theme_tags"),
  rationale: text("rationale"),
  status: text("status").notNull().default("NEW"),
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  traceId: text("trace_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("universe_candidates_symbol_idx").on(table.symbol),
  index("universe_candidates_status_idx").on(table.status),
  index("universe_candidates_tier_idx").on(table.tier),
  index("universe_candidates_final_score_idx").on(table.finalScore),
]);

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

export const insertUniverseAssetSchema = createInsertSchema(universeAssets).omit({
  id: true,
  lastRefreshedAt: true,
});

export const insertUniverseLiquiditySchema = createInsertSchema(universeLiquidityMetrics).omit({
  id: true,
  lastUpdatedAt: true,
});

export const insertUniverseFundamentalsSchema = createInsertSchema(universeFundamentals).omit({
  id: true,
  lastUpdatedAt: true,
});

export const insertUniverseTechnicalsSchema = createInsertSchema(universeTechnicals).omit({
  id: true,
  lastUpdatedAt: true,
});

export const insertAssetClassificationSchema = createInsertSchema(assetClassifications).omit({
  id: true,
  lastUpdatedAt: true,
});

export const insertUniverseCandidateSchema = createInsertSchema(universeCandidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// TYPES
// ============================================================================

export type InsertUniverseAsset = z.infer<typeof insertUniverseAssetSchema>;
export type UniverseAsset = typeof universeAssets.$inferSelect;

export type InsertUniverseLiquidity = z.infer<typeof insertUniverseLiquiditySchema>;
export type UniverseLiquidity = typeof universeLiquidityMetrics.$inferSelect;

export type InsertUniverseFundamentals = z.infer<typeof insertUniverseFundamentalsSchema>;
export type UniverseFundamentals = typeof universeFundamentals.$inferSelect;

export type InsertUniverseTechnicals = z.infer<typeof insertUniverseTechnicalsSchema>;
export type UniverseTechnicals = typeof universeTechnicals.$inferSelect;

export type InsertAssetClassification = z.infer<typeof insertAssetClassificationSchema>;
export type AssetClassification = typeof assetClassifications.$inferSelect;

export type InsertUniverseCandidate = z.infer<typeof insertUniverseCandidateSchema>;
export type UniverseCandidate = typeof universeCandidates.$inferSelect;
