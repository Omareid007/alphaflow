/**
 * AI Active Trader - Backtesting Data Feed
 * Historical data replay for backtesting simulations
 */

import { createLogger } from '../common';
import type { Security } from '../algorithm-framework/types';

const logger = createLogger('backtesting-data-feed');

/**
 * OHLCV bar data structure
 */
export interface OHLCVBar {
  timestamp: Date;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
}

/**
 * Supported timeframe intervals
 */
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

/**
 * Timeframe duration in milliseconds
 */
export const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
};

/**
 * Data gap information
 */
export interface DataGap {
  symbol: string;
  start: Date;
  end: Date;
  expectedBars: number;
  actualBars: number;
}

/**
 * Data validation result
 */
export interface DataValidationResult {
  valid: boolean;
  totalBars: number;
  symbols: string[];
  startDate: Date;
  endDate: Date;
  gaps: DataGap[];
  warnings: string[];
}

/**
 * DataFeed interface for bar/tick data
 */
export interface DataFeed {
  /** Get the next bar for all symbols */
  next(): Map<string, OHLCVBar> | null;
  /** Peek at the next bar without advancing */
  peek(): Map<string, OHLCVBar> | null;
  /** Reset to the beginning */
  reset(): void;
  /** Check if more data is available */
  hasNext(): boolean;
  /** Get current timestamp */
  getCurrentTime(): Date | null;
  /** Get all symbols in the feed */
  getSymbols(): string[];
  /** Get the timeframe */
  getTimeframe(): Timeframe;
  /** Validate data quality */
  validate(): DataValidationResult;
}

/**
 * Configuration for HistoricalDataFeed
 */
export interface HistoricalDataFeedConfig {
  timeframe: Timeframe;
  startDate?: Date;
  endDate?: Date;
  validateGaps?: boolean;
  maxGapMultiplier?: number;
}

/**
 * HistoricalDataFeed class for OHLCV bar replay
 * Replays historical OHLCV data in chronological order
 */
export class HistoricalDataFeed implements DataFeed {
  private data: Map<string, OHLCVBar[]>;
  private config: HistoricalDataFeedConfig;
  private timestamps: Date[];
  private currentIndex: number;
  private timestampIndex: Map<number, Map<string, OHLCVBar>>;

  /**
   * Create a new HistoricalDataFeed
   * @param bars - Map of symbol to array of OHLCV bars
   * @param config - Feed configuration
   */
  constructor(bars: Map<string, OHLCVBar[]>, config: HistoricalDataFeedConfig) {
    this.data = bars;
    this.config = config;
    this.currentIndex = 0;
    this.timestampIndex = new Map();

    this.timestamps = this.buildTimestampIndex();
    logger.info('HistoricalDataFeed initialized', {
      symbols: Array.from(bars.keys()),
      timeframe: config.timeframe,
      totalTimestamps: this.timestamps.length,
    });
  }

  /**
   * Build unified timestamp index across all symbols
   */
  private buildTimestampIndex(): Date[] {
    const allTimestamps = new Set<number>();

    for (const [symbol, bars] of this.data) {
      for (const bar of bars) {
        const ts = bar.timestamp.getTime();

        if (this.config.startDate && bar.timestamp < this.config.startDate) continue;
        if (this.config.endDate && bar.timestamp > this.config.endDate) continue;

        allTimestamps.add(ts);

        if (!this.timestampIndex.has(ts)) {
          this.timestampIndex.set(ts, new Map());
        }
        this.timestampIndex.get(ts)!.set(symbol, bar);
      }
    }

    return Array.from(allTimestamps)
      .sort((a, b) => a - b)
      .map(ts => new Date(ts));
  }

  /**
   * Get the next bar for all symbols
   */
  next(): Map<string, OHLCVBar> | null {
    if (!this.hasNext()) return null;

    const timestamp = this.timestamps[this.currentIndex];
    const bars = this.timestampIndex.get(timestamp.getTime()) || new Map();
    this.currentIndex++;

    return bars;
  }

  /**
   * Peek at the next bar without advancing
   */
  peek(): Map<string, OHLCVBar> | null {
    if (!this.hasNext()) return null;

    const timestamp = this.timestamps[this.currentIndex];
    return this.timestampIndex.get(timestamp.getTime()) || new Map();
  }

  /**
   * Reset to the beginning
   */
  reset(): void {
    this.currentIndex = 0;
    logger.debug('DataFeed reset');
  }

  /**
   * Check if more data is available
   */
  hasNext(): boolean {
    return this.currentIndex < this.timestamps.length;
  }

  /**
   * Get current timestamp
   */
  getCurrentTime(): Date | null {
    if (this.currentIndex === 0) return null;
    return this.timestamps[this.currentIndex - 1] || null;
  }

  /**
   * Get all symbols in the feed
   */
  getSymbols(): string[] {
    return Array.from(this.data.keys());
  }

  /**
   * Get the timeframe
   */
  getTimeframe(): Timeframe {
    return this.config.timeframe;
  }

  /**
   * Get bars for a specific time range
   */
  getWindow(symbol: string, endIndex: number, lookback: number): OHLCVBar[] {
    const bars = this.data.get(symbol);
    if (!bars) return [];

    const startIdx = Math.max(0, endIndex - lookback);
    return bars.slice(startIdx, endIndex);
  }

  /**
   * Validate data quality and detect gaps
   */
  validate(): DataValidationResult {
    const gaps: DataGap[] = [];
    const warnings: string[] = [];
    const symbols = this.getSymbols();

    if (this.timestamps.length === 0) {
      return {
        valid: false,
        totalBars: 0,
        symbols,
        startDate: new Date(0),
        endDate: new Date(0),
        gaps: [],
        warnings: ['No data available'],
      };
    }

    const startDate = this.timestamps[0];
    const endDate = this.timestamps[this.timestamps.length - 1];
    const expectedInterval = TIMEFRAME_MS[this.config.timeframe];
    const maxGap = expectedInterval * (this.config.maxGapMultiplier || 3);

    for (const symbol of symbols) {
      const bars = this.data.get(symbol) || [];
      const sortedBars = [...bars].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      for (let i = 1; i < sortedBars.length; i++) {
        const gap = sortedBars[i].timestamp.getTime() - sortedBars[i - 1].timestamp.getTime();

        if (this.config.validateGaps && gap > maxGap) {
          const expectedBars = Math.floor(gap / expectedInterval);
          gaps.push({
            symbol,
            start: sortedBars[i - 1].timestamp,
            end: sortedBars[i].timestamp,
            expectedBars,
            actualBars: 1,
          });
        }
      }

      for (const bar of bars) {
        if (bar.high < bar.low) {
          warnings.push(`${symbol}: high < low at ${bar.timestamp.toISOString()}`);
        }
        if (bar.close < 0 || bar.open < 0) {
          warnings.push(`${symbol}: negative price at ${bar.timestamp.toISOString()}`);
        }
        if (bar.volume < 0) {
          warnings.push(`${symbol}: negative volume at ${bar.timestamp.toISOString()}`);
        }
      }
    }

    const totalBars = Array.from(this.data.values()).reduce(
      (sum, bars) => sum + bars.length,
      0
    );

    return {
      valid: gaps.length === 0 && warnings.length === 0,
      totalBars,
      symbols,
      startDate,
      endDate,
      gaps,
      warnings,
    };
  }
}

/**
 * Convert OHLCV bars to Security objects for algorithm framework
 */
export function barsToSecurities(
  bars: Map<string, OHLCVBar>,
  assetType: 'equity' | 'crypto' | 'forex' = 'equity',
  exchange: string = 'BACKTEST'
): Security[] {
  const securities: Security[] = [];

  for (const [symbol, bar] of bars) {
    securities.push({
      symbol,
      exchange,
      assetType,
      price: bar.close,
      volume: bar.volume,
    });
  }

  return securities;
}

/**
 * Resample bars to a different timeframe
 */
export function resampleBars(
  bars: OHLCVBar[],
  fromTimeframe: Timeframe,
  toTimeframe: Timeframe
): OHLCVBar[] {
  const fromMs = TIMEFRAME_MS[fromTimeframe];
  const toMs = TIMEFRAME_MS[toTimeframe];

  if (toMs < fromMs) {
    throw new Error('Cannot upsample to smaller timeframe');
  }

  if (bars.length === 0) return [];

  const resampled: OHLCVBar[] = [];
  let currentGroup: OHLCVBar[] = [];
  let groupStart = Math.floor(bars[0].timestamp.getTime() / toMs) * toMs;

  for (const bar of bars) {
    const barGroupStart = Math.floor(bar.timestamp.getTime() / toMs) * toMs;

    if (barGroupStart !== groupStart && currentGroup.length > 0) {
      resampled.push(aggregateBars(currentGroup, new Date(groupStart)));
      currentGroup = [];
      groupStart = barGroupStart;
    }

    currentGroup.push(bar);
  }

  if (currentGroup.length > 0) {
    resampled.push(aggregateBars(currentGroup, new Date(groupStart)));
  }

  return resampled;
}

/**
 * Aggregate multiple bars into one
 */
function aggregateBars(bars: OHLCVBar[], timestamp: Date): OHLCVBar {
  return {
    timestamp,
    symbol: bars[0].symbol,
    open: bars[0].open,
    high: Math.max(...bars.map(b => b.high)),
    low: Math.min(...bars.map(b => b.low)),
    close: bars[bars.length - 1].close,
    volume: bars.reduce((sum, b) => sum + b.volume, 0),
    vwap: bars.reduce((sum, b) => sum + (b.vwap || b.close) * b.volume, 0) /
          bars.reduce((sum, b) => sum + b.volume, 0),
    trades: bars.reduce((sum, b) => sum + (b.trades || 0), 0),
  };
}

/**
 * Create a data feed from raw arrays
 */
export function createDataFeed(
  data: Record<string, OHLCVBar[]>,
  timeframe: Timeframe,
  options?: Partial<HistoricalDataFeedConfig>
): HistoricalDataFeed {
  const bars = new Map<string, OHLCVBar[]>();
  for (const [symbol, symbolBars] of Object.entries(data)) {
    bars.set(symbol, symbolBars);
  }

  return new HistoricalDataFeed(bars, {
    timeframe,
    validateGaps: true,
    maxGapMultiplier: 3,
    ...options,
  });
}
