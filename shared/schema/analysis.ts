/**
 * @module schema/analysis
 * @description Market research and multi-source data analysis for trading decisions.
 *
 * This module aggregates analysis from diverse market data sources:
 * - FINRA RegSHO: Short interest and squeeze potential
 * - SEC EDGAR: Insider trading activity (Form 4 filings)
 * - FRED: Macroeconomic indicators (VIX, rates, inflation)
 * - Finnhub: Real-time market data and fundamentals
 * - Frankfurter: Currency exchange rates
 *
 * Analysis Pipeline:
 * 1. Collect data from external sources (connectors)
 * 2. Normalize and score each source → dataSourceAnalysis
 * 3. Store specialized metrics → shortInterestAnalysis, insiderActivityAnalysis, macroAnalysis
 * 4. Track signal accuracy → analysisFeedback
 * 5. Feed into AI decision engine
 *
 * Data Quality:
 * - Each source has reliability weight (0-1)
 * - Confidence scores based on data completeness
 * - Signal normalization (bullish/bearish/neutral)
 * - Feedback loop for source accuracy tracking
 *
 * Relationships:
 * - dataSourceAnalysis → aiDecisions (many-to-one)
 * - shortInterestAnalysis: Independent symbol analysis
 * - insiderActivityAnalysis: Independent symbol analysis
 * - macroAnalysis: Market-wide indicators
 * - analysisFeedback → dataSourceAnalysis (one-to-one)
 * - analysisFeedback → aiTradeOutcomes (one-to-one)
 *
 * @see aiDecisions - Decisions influenced by this analysis
 * @see aiTradeOutcomes - Trade results for feedback loop
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  numeric,
  jsonb,
  integer,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { aiDecisions } from "./ai-decisions";
import { aiTradeOutcomes } from "./ai-decisions";

/**
 * Multi-source market analysis aggregation table.
 *
 * Stores normalized analysis results from all data connectors:
 * - FINRA: Short interest and RegSHO data
 * - SEC EDGAR: Insider trading (Form 4) and fundamental filings
 * - FRED: Economic indicators (VIX, interest rates, unemployment)
 * - Finnhub: Real-time quotes, company fundamentals
 * - Frankfurter: Foreign exchange rates
 *
 * Analysis Types:
 * - short_interest: FINRA RegSHO short volume ratios
 * - insider_activity: SEC Form 4 insider buy/sell transactions
 * - fundamentals: Company financials and metrics
 * - macro: Macroeconomic indicators (GDP, inflation, rates)
 * - forex: Currency exchange rates
 * - sentiment: News and social media sentiment
 *
 * Scoring:
 * - score: Normalized metric (-1 to 1 or 0 to 100)
 * - signal: Directional bias (bullish/bearish/neutral)
 * - confidence: Data quality and completeness (0-1)
 * - reliability: Source trustworthiness weight (0-1)
 *
 * Usage:
 * - Linked to AI decisions for context
 * - Aggregated across sources for consensus signals
 * - Tracked against outcomes in analysisFeedback
 *
 * @see dataSourceAnalysis - Source-specific analysis data
 * @see analysisFeedback - Signal accuracy tracking
 */
export const dataSourceAnalysis = pgTable(
  "data_source_analysis",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    decisionId: varchar("decision_id").references(() => aiDecisions.id, {
      onDelete: "cascade",
    }),
    symbol: text("symbol").notNull(),
    source: text("source").notNull(), // finra, sec-edgar, finnhub, fred, frankfurter, etc.
    analysisType: text("analysis_type").notNull(), // short_interest, insider_activity, fundamentals, macro, forex
    dataJson: jsonb("data_json").notNull(), // Raw analysis data
    score: numeric("score"), // Normalized score (-1 to 1 or 0 to 100)
    signal: text("signal"), // bullish, bearish, neutral
    confidence: numeric("confidence"), // 0 to 1
    reliability: numeric("reliability"), // Source reliability weight
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("data_source_analysis_decision_id_idx").on(table.decisionId),
    index("data_source_analysis_symbol_idx").on(table.symbol),
    index("data_source_analysis_source_idx").on(table.source),
    index("data_source_analysis_created_at_idx").on(table.createdAt),
  ]
);

/**
 * FINRA RegSHO short interest analysis.
 *
 * Data Source: FINRA Regulation SHO (short sale) reporting
 * Update Frequency: Daily
 * Coverage: All US equities
 *
 * Tracks short selling activity to identify:
 * - Short squeeze potential (high short interest + low volume)
 * - Sentiment indicators (increasing shorts = bearish)
 * - Days to cover (short interest / avg daily volume)
 * - Short ratio trends over time
 *
 * Key Metrics:
 * - shortRatio: Short volume / total volume (0-1)
 * - daysToCover: Time to close all short positions at avg volume
 * - shortRatioTrend: Directional change (increasing/decreasing/stable)
 * - squeezePotential: Risk of short squeeze (high/medium/low)
 *
 * Short Ratio Interpretation:
 * - > 0.5: Very high short interest (potential squeeze)
 * - 0.3-0.5: Elevated shorting (bearish sentiment)
 * - 0.1-0.3: Normal range
 * - < 0.1: Low short interest
 *
 * Squeeze Potential Factors:
 * - High short ratio (> 0.4)
 * - Low days to cover (< 3 days)
 * - Increasing trend in short interest
 * - Catalyst events (earnings, news)
 *
 * Analysis Window:
 * - averageShortRatio: 20-day rolling average
 * - Trend detection: Compare current vs average
 *
 * @see dataSourceAnalysis - Parent analysis record (source: 'finra')
 */
export const shortInterestAnalysis = pgTable(
  "short_interest_analysis",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    symbol: text("symbol").notNull(),
    shortRatio: numeric("short_ratio").notNull(), // Short volume / Total volume
    shortVolume: numeric("short_volume"),
    totalVolume: numeric("total_volume"),
    daysToCover: numeric("days_to_cover"),
    shortRatioTrend: text("short_ratio_trend"), // increasing, decreasing, stable
    squeezePotential: text("squeeze_potential"), // high, medium, low
    averageShortRatio: numeric("average_short_ratio"), // 20-day average
    analysisDate: timestamp("analysis_date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("short_interest_symbol_idx").on(table.symbol),
    index("short_interest_date_idx").on(table.analysisDate),
    unique("short_interest_symbol_date_unique").on(
      table.symbol,
      table.analysisDate
    ),
  ]
);

/**
 * SEC EDGAR Form 4 insider trading analysis.
 *
 * Data Source: SEC EDGAR Form 4 (insider transaction filings)
 * Update Frequency: Real-time (Form 4 must be filed within 2 business days)
 * Coverage: All US public companies
 *
 * Tracks insider buying and selling activity:
 * - Directors, officers, and 10% owners
 * - Form 4 transactions (open market purchases/sales)
 * - Net insider sentiment (buys vs sells)
 * - Transaction values and share volumes
 *
 * Key Metrics:
 * - totalBuys: Aggregate insider share purchases
 * - totalSells: Aggregate insider share sales
 * - netActivity: Net shares (buys - sells)
 * - netValue: Dollar value of net activity
 * - buyToSellRatio: Buys / Sells ratio
 *
 * Sentiment Classification:
 * - 'bullish': Buy/sell ratio > 2.0 (strong insider buying)
 * - 'neutral': Buy/sell ratio 0.5-2.0
 * - 'bearish': Buy/sell ratio < 0.5 (strong insider selling)
 *
 * Analysis Window:
 * - Default: 90 days (analysisWindowDays)
 * - Captures recent insider sentiment trends
 * - Excludes automated/scheduled transactions
 *
 * Insider Buying Significance:
 * - High value purchases (> $100k) signal strong conviction
 * - Multiple insiders buying = stronger signal
 * - CEO/CFO purchases more significant than directors
 *
 * Insider Selling Caveats:
 * - Often for diversification/liquidity (not bearish)
 * - Rule 10b5-1 planned sales (scheduled in advance)
 * - Heavy selling by multiple insiders = warning sign
 *
 * @see dataSourceAnalysis - Parent analysis record (source: 'sec-edgar')
 */
export const insiderActivityAnalysis = pgTable(
  "insider_activity_analysis",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    symbol: text("symbol").notNull(),
    totalBuys: numeric("total_buys").default("0"),
    totalSells: numeric("total_sells").default("0"),
    netActivity: numeric("net_activity").default("0"), // Buys - Sells (shares)
    netValue: numeric("net_value").default("0"), // Dollar value
    buyToSellRatio: numeric("buy_to_sell_ratio"),
    sentiment: text("sentiment"), // bullish, bearish, neutral
    recentTransactionsJson: jsonb("recent_transactions_json"), // Last 10 transactions
    analysisWindowDays: integer("analysis_window_days").default(90),
    analysisDate: timestamp("analysis_date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("insider_activity_symbol_idx").on(table.symbol),
    index("insider_activity_date_idx").on(table.analysisDate),
    unique("insider_activity_symbol_date_unique").on(
      table.symbol,
      table.analysisDate
    ),
  ]
);

/**
 * FRED macroeconomic indicators analysis.
 *
 * Data Source: Federal Reserve Economic Data (FRED) - St. Louis Fed
 * Update Frequency: Varies by indicator (daily to monthly)
 * Coverage: US macroeconomic indicators
 *
 * Tracks market-wide economic conditions:
 * - Market volatility (VIX)
 * - Interest rates (Federal Funds Rate)
 * - Yield curve (10Y-2Y spread)
 * - Inflation (CPI)
 * - Employment (Unemployment Rate)
 *
 * Key Indicators:
 * - vix: CBOE Volatility Index (fear gauge, 0-100)
 * - fedFundsRate: Federal Funds Effective Rate (%)
 * - yieldCurve: 10-Year minus 2-Year Treasury spread (%)
 * - inflation: Consumer Price Index year-over-year change (%)
 * - unemployment: Unemployment Rate (%)
 *
 * Market Regime Classification:
 * - 'risk_on': VIX < 15, positive yield curve, low rates
 *   → Bullish for equities, favor growth stocks
 * - 'risk_off': VIX > 25, inverted yield curve, rising rates
 *   → Bearish for equities, favor bonds/cash
 * - 'neutral': Mixed signals, transition period
 *
 * VIX Interpretation:
 * - < 12: Extreme complacency (potential top)
 * - 12-20: Normal/low volatility (bullish)
 * - 20-30: Elevated fear (caution)
 * - > 30: High fear (potential bottom)
 *
 * Yield Curve Signals:
 * - Positive (> 0.5%): Healthy economy, growth ahead
 * - Flat (0% to 0.5%): Slowing growth
 * - Inverted (< 0%): Recession warning (12-18 months lead)
 *
 * Fed Funds Rate Impact:
 * - Rising rates: Bearish for stocks (discount rate up)
 * - Falling rates: Bullish for stocks (stimulus)
 * - Rate cuts during expansion: Emergency signal
 *
 * This data influences:
 * - Portfolio risk allocation
 * - Sector rotation decisions
 * - Position sizing (risk-on vs risk-off)
 * - Hedging strategies
 *
 * @see dataSourceAnalysis - Parent analysis record (source: 'fred')
 */
export const macroAnalysis = pgTable(
  "macro_analysis",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    vix: numeric("vix"),
    fedFundsRate: numeric("fed_funds_rate"),
    yieldCurve: numeric("yield_curve"), // 10Y-2Y spread
    inflation: numeric("inflation"), // CPI
    unemployment: numeric("unemployment"),
    marketRegime: text("market_regime"), // risk_on, risk_off, neutral
    indicatorsJson: jsonb("indicators_json"), // All FRED indicators
    analysisDate: timestamp("analysis_date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("macro_analysis_date_idx").on(table.analysisDate),
    unique("macro_analysis_date_unique").on(table.analysisDate),
  ]
);

/**
 * Analysis signal accuracy feedback loop.
 *
 * Tracks correlation between analysis signals and actual trade outcomes:
 * - Which data sources predicted correctly?
 * - How accurate was each source's confidence score?
 * - Which sources have edge vs noise?
 * - Optimize source weighting and reliability
 *
 * Feedback Loop Workflow:
 * 1. Record signal at trade entry → signalAtEntry, confidenceAtEntry
 * 2. Wait for trade to close → aiTradeOutcomes
 * 3. Compare prediction vs outcome → signalAccuracy
 * 4. Calculate source performance → win rate by source
 * 5. Adjust source reliability weights
 *
 * Signal Accuracy Calculation:
 * - Bullish signal + winning trade = TRUE
 * - Bearish signal + losing trade = TRUE (if short)
 * - Bullish signal + losing trade = FALSE
 * - Neutral signal = N/A (not directional)
 *
 * Source Performance Metrics:
 * - Win rate by source type (finra, sec-edgar, fred)
 * - Average P&L when following each source
 * - Signal confidence calibration (predicted vs actual)
 * - False positive/negative rates
 *
 * Reliability Adjustment:
 * - High accuracy → Increase reliability weight
 * - Low accuracy → Decrease reliability weight
 * - No edge → Exclude source from decisions
 *
 * Use Cases:
 * - Validate data source value
 * - Tune ML feature weights
 * - Identify regime-dependent accuracy
 * - Optimize analysis pipeline
 *
 * @see dataSourceAnalysis - Original signal/prediction
 * @see aiTradeOutcomes - Actual trade result
 */
export const analysisFeedback = pgTable(
  "analysis_feedback",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    dataSourceAnalysisId: varchar("data_source_analysis_id").references(
      () => dataSourceAnalysis.id,
      { onDelete: "cascade" }
    ),
    tradeOutcomeId: varchar("trade_outcome_id").references(
      () => aiTradeOutcomes.id,
      { onDelete: "cascade" }
    ),
    symbol: text("symbol").notNull(),
    source: text("source").notNull(),
    signalAtEntry: text("signal_at_entry"), // The signal when trade was entered
    confidenceAtEntry: numeric("confidence_at_entry"),
    tradeResult: text("trade_result"), // win, loss
    pnlPercent: numeric("pnl_percent"),
    signalAccuracy: boolean("signal_accuracy"), // Did signal predict correctly?
    holdingTimeMs: integer("holding_time_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("analysis_feedback_source_idx").on(table.source),
    index("analysis_feedback_symbol_idx").on(table.symbol),
    index("analysis_feedback_created_at_idx").on(table.createdAt),
  ]
);

// Insert schemas
export const insertDataSourceAnalysisSchema = createInsertSchema(
  dataSourceAnalysis
).omit({
  id: true,
  createdAt: true,
});

export const insertShortInterestAnalysisSchema = createInsertSchema(
  shortInterestAnalysis
).omit({
  id: true,
  createdAt: true,
});

export const insertInsiderActivityAnalysisSchema = createInsertSchema(
  insiderActivityAnalysis
).omit({
  id: true,
  createdAt: true,
});

export const insertMacroAnalysisSchema = createInsertSchema(macroAnalysis).omit(
  {
    id: true,
    createdAt: true,
  }
);

export const insertAnalysisFeedbackSchema = createInsertSchema(
  analysisFeedback
).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertDataSourceAnalysis = typeof dataSourceAnalysis.$inferInsert;
export type DataSourceAnalysis = typeof dataSourceAnalysis.$inferSelect;

export type InsertShortInterestAnalysis =
  typeof shortInterestAnalysis.$inferInsert;
export type ShortInterestAnalysis = typeof shortInterestAnalysis.$inferSelect;

export type InsertInsiderActivityAnalysis =
  typeof insiderActivityAnalysis.$inferInsert;
export type InsiderActivityAnalysis =
  typeof insiderActivityAnalysis.$inferSelect;

export type InsertMacroAnalysis = typeof macroAnalysis.$inferInsert;
export type MacroAnalysis = typeof macroAnalysis.$inferSelect;

export type InsertAnalysisFeedback = typeof analysisFeedback.$inferInsert;
export type AnalysisFeedback = typeof analysisFeedback.$inferSelect;
