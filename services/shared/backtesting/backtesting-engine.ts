/**
 * AI Active Trader - Backtesting Engine
 * Core event-driven simulation engine for strategy backtesting
 */

import { createLogger } from '../common';
import { AlgorithmFramework, AlgorithmResult } from '../algorithm-framework';
import type {
  Security,
  OrderTicket,
  Portfolio,
  Position,
  RiskAlert,
} from '../algorithm-framework/types';
import type { DataFeed, OHLCVBar } from './data-feed';
import { barsToSecurities } from './data-feed';
import type { FillModel, FillResult, FillContext } from './fill-model';
import { createDefaultFillModel } from './fill-model';
import type { CommissionModel, CommissionResult } from './commission-model';
import { createAlpacaCommission } from './commission-model';
import type { SlippageModel, SlippageResult, SlippageContext } from './slippage-model';
import { createRealisticSlippage } from './slippage-model';
import { PerformanceAnalyzer, TradeRecord, PerformanceMetrics } from './performance-analyzer';

const logger = createLogger('backtesting-engine');

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  name: string;
  initialCapital: number;
  assetType?: 'equity' | 'crypto' | 'forex';
  exchange?: string;
  warmupPeriod?: number;
  fillModel?: FillModel;
  commissionModel?: CommissionModel;
  slippageModel?: SlippageModel;
  riskFreeRate?: number;
  marginRequirement?: number;
  allowShort?: boolean;
  maxPositions?: number;
  logProgress?: boolean;
  progressInterval?: number;
}

/**
 * Backtest event types
 */
export type BacktestEventType =
  | 'bar'
  | 'order_submitted'
  | 'order_filled'
  | 'order_rejected'
  | 'position_opened'
  | 'position_closed'
  | 'risk_alert'
  | 'warmup_complete'
  | 'backtest_start'
  | 'backtest_end';

/**
 * Backtest event
 */
export interface BacktestEvent {
  type: BacktestEventType;
  timestamp: Date;
  data: unknown;
}

/**
 * Backtest result
 */
export interface BacktestResult {
  config: BacktestConfig;
  metrics: PerformanceMetrics;
  trades: TradeRecord[];
  equityCurve: { timestamp: Date; equity: number; cash: number; drawdownPercent: number }[];
  events: BacktestEvent[];
  orders: { order: OrderTicket; fill?: FillResult; commission?: CommissionResult }[];
  riskAlerts: RiskAlert[];
  executionTimeMs: number;
  barsProcessed: number;
  ordersExecuted: number;
}

/**
 * Active position tracker
 */
interface ActivePosition {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  averageCost: number;
  entryDate: Date;
  entryPrice: number;
  commission: number;
  slippage: number;
  tradeId: string;
}

/**
 * BacktestEngine - Core event-driven simulation engine
 * Replays historical data through an AlgorithmFramework strategy
 */
export class BacktestEngine {
  private config: BacktestConfig;
  private fillModel: FillModel;
  private commissionModel: CommissionModel;
  private slippageModel: SlippageModel;
  private analyzer: PerformanceAnalyzer;

  private portfolio: Portfolio;
  private activePositions: Map<string, ActivePosition>;
  private pendingOrders: OrderTicket[];
  private events: BacktestEvent[];
  private orderHistory: { order: OrderTicket; fill?: FillResult; commission?: CommissionResult }[];
  private riskAlerts: RiskAlert[];
  
  private currentBar: Map<string, OHLCVBar>;
  private previousBars: Map<string, OHLCVBar[]>;
  private barCount: number;
  private orderCount: number;
  private tradeIdCounter: number;
  private warmupComplete: boolean;

  /**
   * Create a new BacktestEngine
   * @param config - Backtest configuration
   */
  constructor(config: BacktestConfig) {
    this.config = {
      assetType: 'equity',
      exchange: 'BACKTEST',
      warmupPeriod: 20,
      riskFreeRate: 0.05,
      marginRequirement: 0.25,
      allowShort: true,
      maxPositions: 20,
      logProgress: true,
      progressInterval: 100,
      ...config,
    };

    this.fillModel = config.fillModel || createDefaultFillModel();
    this.commissionModel = config.commissionModel || createAlpacaCommission();
    this.slippageModel = config.slippageModel || createRealisticSlippage();
    this.analyzer = new PerformanceAnalyzer(this.config.riskFreeRate);

    this.portfolio = this.initializePortfolio();
    this.activePositions = new Map();
    this.pendingOrders = [];
    this.events = [];
    this.orderHistory = [];
    this.riskAlerts = [];
    this.currentBar = new Map();
    this.previousBars = new Map();
    this.barCount = 0;
    this.orderCount = 0;
    this.tradeIdCounter = 0;
    this.warmupComplete = false;

    logger.info('BacktestEngine initialized', { config: this.config.name });
  }

  /**
   * Run the backtest
   * 
   * IMPORTANT: Pass a fresh/dedicated AlgorithmFramework instance for backtesting.
   * The algorithm's state will be reset and modified during the backtest.
   * Do NOT pass a live trading algorithm instance.
   * 
   * @param dataFeed - Historical data feed
   * @param algorithm - Fresh algorithm framework instance (will be reset)
   * @returns Backtest result with metrics and trades
   */
  async run(dataFeed: DataFeed, algorithm: AlgorithmFramework): Promise<BacktestResult> {
    const startTime = Date.now();
    logger.info('Starting backtest', { name: this.config.name });

    this.emitEvent('backtest_start', { config: this.config });

    this.reset();
    
    algorithm.reset();
    
    this.syncPortfolioToAlgorithm(algorithm);

    const validation = dataFeed.validate();
    if (!validation.valid) {
      logger.warn('Data validation warnings', { 
        gaps: validation.gaps.length,
        warnings: validation.warnings.length,
      });
    }

    while (dataFeed.hasNext()) {
      const bars = dataFeed.next();
      if (!bars || bars.size === 0) continue;

      this.barCount++;
      const timestamp = bars.values().next().value?.timestamp || new Date();

      this.updateCurrentBars(bars);

      this.processPendingOrders(timestamp);

      this.updatePortfolioValues();

      this.recordEquityPoint(timestamp);

      if (!this.warmupComplete) {
        if (this.barCount >= (this.config.warmupPeriod || 20)) {
          this.warmupComplete = true;
          this.emitEvent('warmup_complete', { bars: this.barCount });
        }
        continue;
      }

      const securities = this.barsToSecurities(bars);
      
      try {
        const result = await algorithm.run(securities, timestamp);
        this.processAlgorithmResult(result, timestamp);
        
        this.updatePortfolioValues();
        this.syncPortfolioToAlgorithm(algorithm);
      } catch (error) {
        logger.error('Algorithm error', error as Error, { timestamp });
      }

      if (this.config.logProgress && this.barCount % (this.config.progressInterval || 100) === 0) {
        logger.debug('Backtest progress', {
          bars: this.barCount,
          equity: this.portfolio.equity.toFixed(2),
          positions: this.activePositions.size,
        });
      }
    }

    this.closeAllPositions(dataFeed.getCurrentTime() || new Date());

    const executionTimeMs = Date.now() - startTime;
    const metrics = this.analyzer.analyze(this.config.initialCapital);

    this.emitEvent('backtest_end', { metrics });

    logger.info('Backtest complete', {
      name: this.config.name,
      bars: this.barCount,
      trades: this.analyzer.getTrades().length,
      executionTimeMs,
      totalReturn: `${metrics.totalReturnPercent.toFixed(2)}%`,
      sharpe: metrics.sharpeRatio.toFixed(2),
    });

    return {
      config: this.config,
      metrics,
      trades: this.analyzer.getTrades(),
      equityCurve: this.analyzer.getEquityCurve().map(p => ({
        timestamp: p.timestamp,
        equity: p.equity,
        cash: p.cash,
        drawdownPercent: p.drawdownPercent,
      })),
      events: this.events,
      orders: this.orderHistory,
      riskAlerts: this.riskAlerts,
      executionTimeMs,
      barsProcessed: this.barCount,
      ordersExecuted: this.orderCount,
    };
  }

  /**
   * Reset engine state
   */
  private reset(): void {
    this.portfolio = this.initializePortfolio();
    this.activePositions.clear();
    this.pendingOrders = [];
    this.events = [];
    this.orderHistory = [];
    this.riskAlerts = [];
    this.currentBar.clear();
    this.previousBars.clear();
    this.barCount = 0;
    this.orderCount = 0;
    this.tradeIdCounter = 0;
    this.warmupComplete = false;
    this.analyzer.reset();
  }

  /**
   * Initialize portfolio with starting capital
   */
  private initializePortfolio(): Portfolio {
    return {
      cash: this.config.initialCapital,
      equity: this.config.initialCapital,
      margin: 0,
      buyingPower: this.config.initialCapital,
      positions: new Map(),
      totalUnrealizedPnL: 0,
      totalRealizedPnL: 0,
    };
  }

  /**
   * Update current and historical bars
   */
  private updateCurrentBars(bars: Map<string, OHLCVBar>): void {
    for (const [symbol, bar] of bars) {
      const prev = this.currentBar.get(symbol);
      if (prev) {
        const history = this.previousBars.get(symbol) || [];
        history.push(prev);
        if (history.length > 100) history.shift();
        this.previousBars.set(symbol, history);
      }
      this.currentBar.set(symbol, bar);
    }

    this.emitEvent('bar', { timestamp: bars.values().next().value?.timestamp, symbols: Array.from(bars.keys()) });
  }

  /**
   * Convert OHLCV bars to Security objects
   */
  private barsToSecurities(bars: Map<string, OHLCVBar>): Security[] {
    return barsToSecurities(bars, this.config.assetType, this.config.exchange);
  }

  /**
   * Process algorithm result and handle orders
   */
  private processAlgorithmResult(result: AlgorithmResult, timestamp: Date): void {
    for (const alert of result.riskAlerts) {
      this.riskAlerts.push(alert);
      this.emitEvent('risk_alert', alert);
    }

    for (const order of result.orders) {
      this.submitOrder(order, timestamp);
    }
  }

  /**
   * Submit an order for execution
   */
  private submitOrder(order: OrderTicket, timestamp: Date): void {
    if (order.type === 'market') {
      this.executeOrder(order, timestamp);
    } else {
      this.pendingOrders.push(order);
      this.emitEvent('order_submitted', order);
    }
  }

  /**
   * Process pending limit/stop orders
   */
  private processPendingOrders(timestamp: Date): void {
    const remaining: OrderTicket[] = [];

    for (const order of this.pendingOrders) {
      const bar = this.currentBar.get(order.symbol);
      if (!bar) {
        remaining.push(order);
        continue;
      }

      let triggered = false;

      if (order.type === 'limit') {
        if (order.side === 'buy' && bar.low <= (order.limitPrice || Infinity)) {
          triggered = true;
        } else if (order.side === 'sell' && bar.high >= (order.limitPrice || 0)) {
          triggered = true;
        }
      } else if (order.type === 'stop') {
        if (order.side === 'buy' && bar.high >= (order.stopPrice || 0)) {
          triggered = true;
        } else if (order.side === 'sell' && bar.low <= (order.stopPrice || Infinity)) {
          triggered = true;
        }
      }

      if (triggered) {
        this.executeOrder(order, timestamp);
      } else {
        if (order.timeInForce === 'day') {
          this.emitEvent('order_rejected', { order, reason: 'Day order expired' });
        } else {
          remaining.push(order);
        }
      }
    }

    this.pendingOrders = remaining;
  }

  /**
   * Execute an order with fill, slippage, and commission models
   */
  private executeOrder(order: OrderTicket, timestamp: Date): void {
    const bar = this.currentBar.get(order.symbol);
    if (!bar) {
      this.emitEvent('order_rejected', { order, reason: 'No bar data' });
      return;
    }

    const fillContext: FillContext = {
      bar,
      previousBar: this.previousBars.get(order.symbol)?.slice(-1)[0],
    };

    const fillResult = this.fillModel.fill(order, fillContext);

    if (fillResult.status === 'rejected') {
      this.emitEvent('order_rejected', { order, reason: fillResult.reason });
      this.orderHistory.push({ order, fill: fillResult });
      return;
    }

    const slippageContext: SlippageContext = {
      bar,
      previousBars: this.previousBars.get(order.symbol),
    };

    const slippageResult = this.slippageModel.calculate(
      order,
      fillResult.averagePrice,
      slippageContext
    );

    const finalPrice = slippageResult.adjustedPrice;
    const tradeValue = finalPrice * fillResult.filledQuantity;

    const commissionResult = this.commissionModel.calculate(
      order,
      finalPrice,
      fillResult.filledQuantity
    );

    if (order.side === 'buy') {
      const totalCost = tradeValue + commissionResult.commission;
      if (totalCost > this.portfolio.cash) {
        this.emitEvent('order_rejected', { order, reason: 'Insufficient cash' });
        this.orderHistory.push({ order, fill: fillResult, commission: commissionResult });
        return;
      }

      this.portfolio.cash -= totalCost;
      this.openOrAddPosition(order, fillResult, finalPrice, commissionResult, slippageResult, timestamp);
    } else {
      const position = this.activePositions.get(order.symbol);
      if (position && position.side === 'long') {
        this.closePosition(order.symbol, finalPrice, fillResult.filledQuantity, commissionResult, slippageResult, timestamp);
      } else if (this.config.allowShort) {
        this.portfolio.cash += tradeValue - commissionResult.commission;
        this.openOrAddPosition(order, fillResult, finalPrice, commissionResult, slippageResult, timestamp);
      }
    }

    this.orderCount++;
    order.status = 'filled';
    order.filledQuantity = fillResult.filledQuantity;
    order.averagePrice = finalPrice;
    order.filledAt = timestamp;

    this.orderHistory.push({ order, fill: fillResult, commission: commissionResult });
    this.emitEvent('order_filled', { order, fill: fillResult, commission: commissionResult });
  }

  /**
   * Open or add to an existing position
   */
  private openOrAddPosition(
    order: OrderTicket,
    fill: FillResult,
    price: number,
    commission: CommissionResult,
    slippage: SlippageResult,
    timestamp: Date
  ): void {
    const existing = this.activePositions.get(order.symbol);
    
    if (existing && existing.side === (order.side === 'buy' ? 'long' : 'short')) {
      const totalQty = existing.quantity + fill.filledQuantity;
      existing.averageCost = (existing.averageCost * existing.quantity + price * fill.filledQuantity) / totalQty;
      existing.quantity = totalQty;
      existing.commission += commission.commission;
      existing.slippage += slippage.slippageAmount;
    } else {
      const tradeId = `trade_${++this.tradeIdCounter}`;
      const position: ActivePosition = {
        symbol: order.symbol,
        side: order.side === 'buy' ? 'long' : 'short',
        quantity: fill.filledQuantity,
        averageCost: price,
        entryDate: timestamp,
        entryPrice: price,
        commission: commission.commission,
        slippage: slippage.slippageAmount,
        tradeId,
      };
      this.activePositions.set(order.symbol, position);
      this.emitEvent('position_opened', position);
    }
  }

  /**
   * Close a position
   */
  private closePosition(
    symbol: string,
    exitPrice: number,
    quantity: number,
    commission: CommissionResult,
    slippage: SlippageResult,
    timestamp: Date
  ): void {
    const position = this.activePositions.get(symbol);
    if (!position) return;

    const closeQty = Math.min(quantity, position.quantity);
    const pnl = position.side === 'long'
      ? (exitPrice - position.averageCost) * closeQty
      : (position.averageCost - exitPrice) * closeQty;

    const totalCommission = position.commission + commission.commission;
    const totalSlippage = position.slippage + slippage.slippageAmount;
    const netPnl = pnl - totalCommission;

    this.portfolio.totalRealizedPnL += netPnl;
    this.portfolio.cash += exitPrice * closeQty - commission.commission;

    const trade: TradeRecord = {
      id: position.tradeId,
      symbol: position.symbol,
      side: position.side,
      entryDate: position.entryDate,
      entryPrice: position.entryPrice,
      entryQuantity: position.quantity,
      exitDate: timestamp,
      exitPrice,
      exitQuantity: closeQty,
      pnl: netPnl,
      pnlPercent: (netPnl / (position.entryPrice * closeQty)) * 100,
      commission: totalCommission,
      slippage: totalSlippage,
      holdingPeriodDays: Math.ceil((timestamp.getTime() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24)),
    };

    this.analyzer.addTrade(trade);

    if (closeQty >= position.quantity) {
      this.activePositions.delete(symbol);
      this.portfolio.positions.delete(symbol);
    } else {
      position.quantity -= closeQty;
    }

    this.emitEvent('position_closed', { trade, remainingQty: position.quantity - closeQty });
  }

  /**
   * Update portfolio market values
   */
  private updatePortfolioValues(): void {
    let positionsValue = 0;
    let unrealizedPnL = 0;

    for (const [symbol, position] of this.activePositions) {
      const bar = this.currentBar.get(symbol);
      if (!bar) continue;

      const marketValue = bar.close * position.quantity;
      positionsValue += marketValue;

      const pnl = position.side === 'long'
        ? (bar.close - position.averageCost) * position.quantity
        : (position.averageCost - bar.close) * position.quantity;
      unrealizedPnL += pnl;

      const portfolioPosition: Position = {
        symbol,
        quantity: position.quantity,
        averageCost: position.averageCost,
        marketValue,
        unrealizedPnL: pnl,
        unrealizedPnLPercent: (pnl / (position.averageCost * position.quantity)) * 100,
        side: position.side,
      };
      this.portfolio.positions.set(symbol, portfolioPosition);
    }

    this.portfolio.equity = this.portfolio.cash + positionsValue;
    this.portfolio.totalUnrealizedPnL = unrealizedPnL;
    this.portfolio.buyingPower = this.portfolio.cash;
  }

  /**
   * Sync portfolio state to the algorithm framework
   * This keeps the algorithm's internal portfolio in sync with backtest state
   */
  private syncPortfolioToAlgorithm(algorithm: AlgorithmFramework): void {
    algorithm.updatePortfolio({
      cash: this.portfolio.cash,
      equity: this.portfolio.equity,
      margin: this.portfolio.margin,
      buyingPower: this.portfolio.buyingPower,
      positions: new Map(this.portfolio.positions),
      totalUnrealizedPnL: this.portfolio.totalUnrealizedPnL,
      totalRealizedPnL: this.portfolio.totalRealizedPnL,
    });
  }

  /**
   * Record equity curve point
   */
  private recordEquityPoint(timestamp: Date): void {
    let positionsValue = 0;
    for (const [symbol, position] of this.activePositions) {
      const bar = this.currentBar.get(symbol);
      if (bar) {
        positionsValue += bar.close * position.quantity;
      }
    }

    this.analyzer.addEquityPoint({
      timestamp,
      equity: this.portfolio.equity,
      cash: this.portfolio.cash,
      positionsValue,
    });
  }

  /**
   * Close all positions at end of backtest
   */
  private closeAllPositions(timestamp: Date): void {
    for (const [symbol, position] of this.activePositions) {
      const bar = this.currentBar.get(symbol);
      if (!bar) continue;

      const exitPrice = bar.close;
      const mockOrder: OrderTicket = {
        id: `close_${symbol}`,
        symbol,
        type: 'market',
        side: position.side === 'long' ? 'sell' : 'buy',
        quantity: position.quantity,
        timeInForce: 'day',
        status: 'pending',
        filledQuantity: 0,
        averagePrice: 0,
        submittedAt: timestamp,
      };

      const commissionResult = this.commissionModel.calculate(mockOrder, exitPrice, position.quantity);
      const slippageResult: SlippageResult = {
        orderId: mockOrder.id,
        originalPrice: exitPrice,
        adjustedPrice: exitPrice,
        slippageAmount: 0,
        slippageBps: 0,
        reason: 'End of backtest close',
      };

      this.closePosition(symbol, exitPrice, position.quantity, commissionResult, slippageResult, timestamp);
    }
  }

  /**
   * Emit a backtest event
   */
  private emitEvent(type: BacktestEventType, data: unknown): void {
    this.events.push({
      type,
      timestamp: new Date(),
      data,
    });
  }

  /**
   * Get current portfolio state
   */
  getPortfolio(): Portfolio {
    return { ...this.portfolio };
  }

  /**
   * Get active positions
   */
  getActivePositions(): Map<string, ActivePosition> {
    return new Map(this.activePositions);
  }

  /**
   * Get pending orders
   */
  getPendingOrders(): OrderTicket[] {
    return [...this.pendingOrders];
  }
}

/**
 * Create a backtest engine with default settings
 */
export function createBacktestEngine(config: Partial<BacktestConfig> & { name: string; initialCapital: number }): BacktestEngine {
  return new BacktestEngine(config);
}

/**
 * Run a simple backtest with minimal configuration
 */
export async function runBacktest(
  name: string,
  dataFeed: DataFeed,
  algorithm: AlgorithmFramework,
  initialCapital: number = 100000
): Promise<BacktestResult> {
  const engine = new BacktestEngine({ name, initialCapital });
  return engine.run(dataFeed, algorithm);
}
