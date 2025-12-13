/**
 * AI Active Trader - Transaction Cost Analysis (TCA)
 * Comprehensive analysis of execution quality and trading costs
 */

import { createLogger } from '../common';

const logger = createLogger('transaction-cost-analysis');

/**
 * TCA Metrics - Core transaction cost breakdown
 */
export interface TCAMetrics {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  implementationShortfall: {
    arrivalPrice: number;
    executionPrice: number;
    shortfallBps: number;
    shortfallAmount: number;
  };
  marketImpact: {
    temporaryImpactBps: number;
    permanentImpactBps: number;
    totalImpactBps: number;
    totalImpactAmount: number;
  };
  timingCost: {
    delayCostBps: number;
    delayCostAmount: number;
    delaySeconds: number;
  };
  spreadCost: {
    spreadBps: number;
    spreadAmount: number;
    halfSpreadBps: number;
  };
  commissionCost: {
    commissionAmount: number;
    commissionBps: number;
  };
  totalExecutionCost: {
    totalCostBps: number;
    totalCostAmount: number;
    costBreakdown: {
      implementationShortfall: number;
      marketImpact: number;
      timingCost: number;
      spreadCost: number;
      commission: number;
    };
  };
}

/**
 * Trade execution record for TCA analysis
 */
export interface TradeExecution {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  arrivalPrice: number;
  executionPrice: number;
  vwap?: number;
  twap?: number;
  orderTimestamp: Date;
  executionTimestamp: Date;
  bidAtArrival?: number;
  askAtArrival?: number;
  bidAtExecution?: number;
  askAtExecution?: number;
  commission: number;
  broker?: string;
  venue?: string;
}

/**
 * Benchmark types for comparison
 */
export type BenchmarkType = 'arrival_price' | 'vwap' | 'twap' | 'close' | 'open';

/**
 * Benchmark comparison result
 */
export interface BenchmarkComparison {
  benchmarkType: BenchmarkType;
  benchmarkPrice: number;
  executionPrice: number;
  slippageBps: number;
  slippageAmount: number;
  outperformed: boolean;
}

/**
 * Slippage breakdown by cause
 */
export interface SlippageBreakdown {
  orderId: string;
  totalSlippageBps: number;
  causes: {
    marketMovement: number;
    spreadCrossing: number;
    marketImpact: number;
    timingDelay: number;
    other: number;
  };
  percentages: {
    marketMovement: number;
    spreadCrossing: number;
    marketImpact: number;
    timingDelay: number;
    other: number;
  };
}

/**
 * Execution quality score (1-100)
 */
export interface ExecutionQualityScore {
  orderId: string;
  overallScore: number;
  components: {
    priceImprovement: number;
    speedScore: number;
    fillRateScore: number;
    costEfficiency: number;
  };
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  feedback: string[];
}

/**
 * Aggregated TCA statistics
 */
export interface AggregatedTCAStats {
  period: {
    start: Date;
    end: Date;
  };
  tradeCount: number;
  totalVolume: number;
  totalNotional: number;
  averageMetrics: {
    implementationShortfallBps: number;
    marketImpactBps: number;
    timingCostBps: number;
    spreadCostBps: number;
    commissionBps: number;
    totalCostBps: number;
  };
  bySymbol: Map<string, {
    tradeCount: number;
    avgCostBps: number;
    totalCostAmount: number;
  }>;
  byOrderType: Map<string, {
    tradeCount: number;
    avgCostBps: number;
    avgExecutionTime: number;
  }>;
  byTimeOfDay: Map<number, {
    tradeCount: number;
    avgCostBps: number;
    avgSpreadBps: number;
  }>;
}

/**
 * TransactionCostAnalyzer - Main TCA analysis class
 */
export class TransactionCostAnalyzer {
  private trades: TradeExecution[] = [];
  private tcaResults: Map<string, TCAMetrics> = new Map();

  constructor() {
    logger.info('TransactionCostAnalyzer initialized');
  }

  /**
   * Analyze a single trade execution
   */
  analyzeTrade(trade: TradeExecution): TCAMetrics {
    logger.debug('Analyzing trade', { orderId: trade.orderId, symbol: trade.symbol });

    const notional = trade.quantity * trade.executionPrice;

    const implementationShortfall = this.calculateImplementationShortfall(trade);
    const marketImpact = this.calculateMarketImpact(trade);
    const timingCost = this.calculateTimingCost(trade);
    const spreadCost = this.calculateSpreadCost(trade);
    const commissionCost = this.calculateCommissionCost(trade, notional);

    const totalCostAmount =
      implementationShortfall.shortfallAmount +
      marketImpact.totalImpactAmount +
      timingCost.delayCostAmount +
      spreadCost.spreadAmount +
      commissionCost.commissionAmount;

    const totalCostBps = (totalCostAmount / notional) * 10000;

    const metrics: TCAMetrics = {
      orderId: trade.orderId,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      implementationShortfall,
      marketImpact,
      timingCost,
      spreadCost,
      commissionCost,
      totalExecutionCost: {
        totalCostBps,
        totalCostAmount,
        costBreakdown: {
          implementationShortfall: implementationShortfall.shortfallAmount,
          marketImpact: marketImpact.totalImpactAmount,
          timingCost: timingCost.delayCostAmount,
          spreadCost: spreadCost.spreadAmount,
          commission: commissionCost.commissionAmount,
        },
      },
    };

    this.trades.push(trade);
    this.tcaResults.set(trade.orderId, metrics);

    logger.info('Trade analyzed', {
      orderId: trade.orderId,
      totalCostBps: totalCostBps.toFixed(2),
    });

    return metrics;
  }

  /**
   * Calculate implementation shortfall (arrival vs execution)
   */
  private calculateImplementationShortfall(trade: TradeExecution): TCAMetrics['implementationShortfall'] {
    const priceDiff = trade.side === 'buy'
      ? trade.executionPrice - trade.arrivalPrice
      : trade.arrivalPrice - trade.executionPrice;

    const shortfallBps = (priceDiff / trade.arrivalPrice) * 10000;
    const shortfallAmount = priceDiff * trade.quantity;

    return {
      arrivalPrice: trade.arrivalPrice,
      executionPrice: trade.executionPrice,
      shortfallBps: Math.max(0, shortfallBps),
      shortfallAmount: Math.max(0, shortfallAmount),
    };
  }

  /**
   * Calculate market impact (temporary and permanent)
   */
  private calculateMarketImpact(trade: TradeExecution): TCAMetrics['marketImpact'] {
    const midAtArrival = trade.bidAtArrival && trade.askAtArrival
      ? (trade.bidAtArrival + trade.askAtArrival) / 2
      : trade.arrivalPrice;

    const midAtExecution = trade.bidAtExecution && trade.askAtExecution
      ? (trade.bidAtExecution + trade.askAtExecution) / 2
      : trade.executionPrice;

    const priceMove = trade.side === 'buy'
      ? midAtExecution - midAtArrival
      : midAtArrival - midAtExecution;

    const permanentImpactBps = Math.max(0, (priceMove / midAtArrival) * 10000 * 0.3);
    const temporaryImpactBps = Math.max(0, (priceMove / midAtArrival) * 10000 * 0.7);
    const totalImpactBps = permanentImpactBps + temporaryImpactBps;
    const totalImpactAmount = (totalImpactBps / 10000) * trade.arrivalPrice * trade.quantity;

    return {
      temporaryImpactBps,
      permanentImpactBps,
      totalImpactBps,
      totalImpactAmount,
    };
  }

  /**
   * Calculate timing cost (delay cost)
   */
  private calculateTimingCost(trade: TradeExecution): TCAMetrics['timingCost'] {
    const delayMs = trade.executionTimestamp.getTime() - trade.orderTimestamp.getTime();
    const delaySeconds = delayMs / 1000;

    const decayRate = 0.5;
    const delayCostBps = Math.min(delaySeconds * decayRate, 50);
    const delayCostAmount = (delayCostBps / 10000) * trade.arrivalPrice * trade.quantity;

    return {
      delayCostBps,
      delayCostAmount,
      delaySeconds,
    };
  }

  /**
   * Calculate spread cost
   */
  private calculateSpreadCost(trade: TradeExecution): TCAMetrics['spreadCost'] {
    let spreadBps = 10;

    if (trade.bidAtArrival && trade.askAtArrival) {
      const spread = trade.askAtArrival - trade.bidAtArrival;
      const mid = (trade.bidAtArrival + trade.askAtArrival) / 2;
      spreadBps = (spread / mid) * 10000;
    }

    const halfSpreadBps = spreadBps / 2;
    const spreadAmount = (halfSpreadBps / 10000) * trade.arrivalPrice * trade.quantity;

    return {
      spreadBps,
      spreadAmount,
      halfSpreadBps,
    };
  }

  /**
   * Calculate commission cost
   */
  private calculateCommissionCost(trade: TradeExecution, notional: number): TCAMetrics['commissionCost'] {
    const commissionBps = (trade.commission / notional) * 10000;

    return {
      commissionAmount: trade.commission,
      commissionBps,
    };
  }

  /**
   * Calculate execution quality score (1-100)
   */
  calculateExecutionQuality(trade: TradeExecution): ExecutionQualityScore {
    const metrics = this.tcaResults.get(trade.orderId) || this.analyzeTrade(trade);

    const priceImprovement = Math.max(0, 100 - metrics.implementationShortfall.shortfallBps * 2);
    
    const delaySeconds = metrics.timingCost.delaySeconds;
    const speedScore = delaySeconds < 0.1 ? 100 : delaySeconds < 1 ? 90 : delaySeconds < 5 ? 70 : 50;

    const fillRateScore = 100;

    const totalCostBps = metrics.totalExecutionCost.totalCostBps;
    const costEfficiency = totalCostBps < 5 ? 100 : totalCostBps < 15 ? 85 : totalCostBps < 30 ? 70 : 50;

    const overallScore = Math.round(
      priceImprovement * 0.35 +
      speedScore * 0.2 +
      fillRateScore * 0.2 +
      costEfficiency * 0.25
    );

    const grade: ExecutionQualityScore['grade'] =
      overallScore >= 90 ? 'A' :
      overallScore >= 80 ? 'B' :
      overallScore >= 70 ? 'C' :
      overallScore >= 60 ? 'D' : 'F';

    const feedback: string[] = [];
    if (priceImprovement < 70) feedback.push('Consider using limit orders to reduce price slippage');
    if (speedScore < 70) feedback.push('Execution latency is high - review order routing');
    if (costEfficiency < 70) feedback.push('Transaction costs are elevated - consider different execution venues');
    if (metrics.spreadCost.spreadBps > 20) feedback.push('Wide spreads detected - consider trading during higher liquidity periods');

    return {
      orderId: trade.orderId,
      overallScore,
      components: {
        priceImprovement,
        speedScore,
        fillRateScore,
        costEfficiency,
      },
      grade,
      feedback,
    };
  }

  /**
   * Compare execution against benchmarks
   */
  compareToBenchmark(trade: TradeExecution, benchmarkType: BenchmarkType): BenchmarkComparison {
    let benchmarkPrice: number;

    switch (benchmarkType) {
      case 'arrival_price':
        benchmarkPrice = trade.arrivalPrice;
        break;
      case 'vwap':
        benchmarkPrice = trade.vwap || trade.arrivalPrice;
        break;
      case 'twap':
        benchmarkPrice = trade.twap || trade.arrivalPrice;
        break;
      case 'close':
      case 'open':
        benchmarkPrice = trade.arrivalPrice;
        break;
      default:
        benchmarkPrice = trade.arrivalPrice;
    }

    const slippageAmount = trade.side === 'buy'
      ? trade.executionPrice - benchmarkPrice
      : benchmarkPrice - trade.executionPrice;

    const slippageBps = (slippageAmount / benchmarkPrice) * 10000;
    const outperformed = slippageBps < 0;

    return {
      benchmarkType,
      benchmarkPrice,
      executionPrice: trade.executionPrice,
      slippageBps,
      slippageAmount: slippageAmount * trade.quantity,
      outperformed,
    };
  }

  /**
   * Break down slippage by cause
   */
  analyzeSlippageBreakdown(trade: TradeExecution): SlippageBreakdown {
    const metrics = this.tcaResults.get(trade.orderId) || this.analyzeTrade(trade);
    const totalSlippageBps = metrics.implementationShortfall.shortfallBps;

    if (totalSlippageBps === 0) {
      return {
        orderId: trade.orderId,
        totalSlippageBps: 0,
        causes: { marketMovement: 0, spreadCrossing: 0, marketImpact: 0, timingDelay: 0, other: 0 },
        percentages: { marketMovement: 0, spreadCrossing: 0, marketImpact: 0, timingDelay: 0, other: 0 },
      };
    }

    const spreadCrossing = metrics.spreadCost.halfSpreadBps;
    const marketImpact = metrics.marketImpact.totalImpactBps;
    const timingDelay = metrics.timingCost.delayCostBps;
    const marketMovement = Math.max(0, totalSlippageBps - spreadCrossing - marketImpact - timingDelay);
    const other = 0;

    const total = spreadCrossing + marketImpact + timingDelay + marketMovement + other;

    return {
      orderId: trade.orderId,
      totalSlippageBps,
      causes: {
        marketMovement,
        spreadCrossing,
        marketImpact,
        timingDelay,
        other,
      },
      percentages: {
        marketMovement: total > 0 ? (marketMovement / total) * 100 : 0,
        spreadCrossing: total > 0 ? (spreadCrossing / total) * 100 : 0,
        marketImpact: total > 0 ? (marketImpact / total) * 100 : 0,
        timingDelay: total > 0 ? (timingDelay / total) * 100 : 0,
        other: 0,
      },
    };
  }

  /**
   * Aggregate TCA statistics by symbol, time period, or order type
   */
  aggregateAnalysis(
    trades: TradeExecution[],
    startDate?: Date,
    endDate?: Date
  ): AggregatedTCAStats {
    const filteredTrades = trades.filter(t => {
      if (startDate && t.executionTimestamp < startDate) return false;
      if (endDate && t.executionTimestamp > endDate) return false;
      return true;
    });

    if (filteredTrades.length === 0) {
      return {
        period: { start: startDate || new Date(), end: endDate || new Date() },
        tradeCount: 0,
        totalVolume: 0,
        totalNotional: 0,
        averageMetrics: {
          implementationShortfallBps: 0,
          marketImpactBps: 0,
          timingCostBps: 0,
          spreadCostBps: 0,
          commissionBps: 0,
          totalCostBps: 0,
        },
        bySymbol: new Map(),
        byOrderType: new Map(),
        byTimeOfDay: new Map(),
      };
    }

    const bySymbol = new Map<string, { tradeCount: number; avgCostBps: number; totalCostAmount: number }>();
    const byOrderType = new Map<string, { tradeCount: number; avgCostBps: number; avgExecutionTime: number }>();
    const byTimeOfDay = new Map<number, { tradeCount: number; avgCostBps: number; avgSpreadBps: number }>();

    let totalImplShortfall = 0;
    let totalMarketImpact = 0;
    let totalTimingCost = 0;
    let totalSpreadCost = 0;
    let totalCommission = 0;
    let totalCost = 0;
    let totalVolume = 0;
    let totalNotional = 0;

    for (const trade of filteredTrades) {
      const metrics = this.tcaResults.get(trade.orderId) || this.analyzeTrade(trade);
      const notional = trade.quantity * trade.executionPrice;

      totalVolume += trade.quantity;
      totalNotional += notional;
      totalImplShortfall += metrics.implementationShortfall.shortfallBps;
      totalMarketImpact += metrics.marketImpact.totalImpactBps;
      totalTimingCost += metrics.timingCost.delayCostBps;
      totalSpreadCost += metrics.spreadCost.halfSpreadBps;
      totalCommission += metrics.commissionCost.commissionBps;
      totalCost += metrics.totalExecutionCost.totalCostBps;

      const symbolStats = bySymbol.get(trade.symbol) || { tradeCount: 0, avgCostBps: 0, totalCostAmount: 0 };
      symbolStats.tradeCount++;
      symbolStats.totalCostAmount += metrics.totalExecutionCost.totalCostAmount;
      symbolStats.avgCostBps = (symbolStats.avgCostBps * (symbolStats.tradeCount - 1) + metrics.totalExecutionCost.totalCostBps) / symbolStats.tradeCount;
      bySymbol.set(trade.symbol, symbolStats);

      const orderTypeStats = byOrderType.get(trade.orderType) || { tradeCount: 0, avgCostBps: 0, avgExecutionTime: 0 };
      orderTypeStats.tradeCount++;
      const execTime = (trade.executionTimestamp.getTime() - trade.orderTimestamp.getTime()) / 1000;
      orderTypeStats.avgExecutionTime = (orderTypeStats.avgExecutionTime * (orderTypeStats.tradeCount - 1) + execTime) / orderTypeStats.tradeCount;
      orderTypeStats.avgCostBps = (orderTypeStats.avgCostBps * (orderTypeStats.tradeCount - 1) + metrics.totalExecutionCost.totalCostBps) / orderTypeStats.tradeCount;
      byOrderType.set(trade.orderType, orderTypeStats);

      const hour = trade.executionTimestamp.getHours();
      const todStats = byTimeOfDay.get(hour) || { tradeCount: 0, avgCostBps: 0, avgSpreadBps: 0 };
      todStats.tradeCount++;
      todStats.avgCostBps = (todStats.avgCostBps * (todStats.tradeCount - 1) + metrics.totalExecutionCost.totalCostBps) / todStats.tradeCount;
      todStats.avgSpreadBps = (todStats.avgSpreadBps * (todStats.tradeCount - 1) + metrics.spreadCost.spreadBps) / todStats.tradeCount;
      byTimeOfDay.set(hour, todStats);
    }

    const count = filteredTrades.length || 1;

    return {
      period: {
        start: startDate || (filteredTrades[0]?.executionTimestamp ?? new Date()),
        end: endDate || (filteredTrades[filteredTrades.length - 1]?.executionTimestamp ?? new Date()),
      },
      tradeCount: filteredTrades.length,
      totalVolume,
      totalNotional,
      averageMetrics: {
        implementationShortfallBps: totalImplShortfall / count,
        marketImpactBps: totalMarketImpact / count,
        timingCostBps: totalTimingCost / count,
        spreadCostBps: totalSpreadCost / count,
        commissionBps: totalCommission / count,
        totalCostBps: totalCost / count,
      },
      bySymbol,
      byOrderType,
      byTimeOfDay,
    };
  }

  /**
   * Get all analyzed trades
   */
  getTrades(): TradeExecution[] {
    return [...this.trades];
  }

  /**
   * Get TCA metrics for a specific trade
   */
  getMetrics(orderId: string): TCAMetrics | undefined {
    return this.tcaResults.get(orderId);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.trades = [];
    this.tcaResults.clear();
    logger.info('TransactionCostAnalyzer data cleared');
  }
}

/**
 * Broker execution statistics
 */
export interface BrokerStats {
  brokerId: string;
  brokerName: string;
  tradeCount: number;
  totalVolume: number;
  avgExecutionQuality: number;
  avgCostBps: number;
  avgFillRate: number;
  avgLatencyMs: number;
  feeStructure: {
    avgCommissionBps: number;
    avgSpreadBps: number;
    totalFeesAmount: number;
  };
}

/**
 * BrokerComparisonAnalyzer - Compare execution quality across brokers
 */
export class BrokerComparisonAnalyzer {
  private brokerTrades: Map<string, TradeExecution[]> = new Map();
  private brokerStats: Map<string, BrokerStats> = new Map();
  private analyzer: TransactionCostAnalyzer;

  constructor() {
    this.analyzer = new TransactionCostAnalyzer();
    logger.info('BrokerComparisonAnalyzer initialized');
  }

  /**
   * Add a trade for broker comparison
   */
  addTrade(trade: TradeExecution): void {
    const brokerId = trade.broker || 'unknown';
    const trades = this.brokerTrades.get(brokerId) || [];
    trades.push(trade);
    this.brokerTrades.set(brokerId, trades);
    this.analyzer.analyzeTrade(trade);
  }

  /**
   * Compare execution quality across brokers
   */
  compareExecutionQuality(): Map<string, BrokerStats> {
    this.brokerStats.clear();

    for (const [brokerId, trades] of this.brokerTrades) {
      let totalQuality = 0;
      let totalCostBps = 0;
      let totalLatencyMs = 0;
      let totalCommissionBps = 0;
      let totalSpreadBps = 0;
      let totalFees = 0;
      let totalVolume = 0;

      for (const trade of trades) {
        const quality = this.analyzer.calculateExecutionQuality(trade);
        const metrics = this.analyzer.getMetrics(trade.orderId);
        
        totalQuality += quality.overallScore;
        totalCostBps += metrics?.totalExecutionCost.totalCostBps || 0;
        totalLatencyMs += trade.executionTimestamp.getTime() - trade.orderTimestamp.getTime();
        totalCommissionBps += metrics?.commissionCost.commissionBps || 0;
        totalSpreadBps += metrics?.spreadCost.spreadBps || 0;
        totalFees += trade.commission;
        totalVolume += trade.quantity;
      }

      const count = trades.length || 1;

      this.brokerStats.set(brokerId, {
        brokerId,
        brokerName: brokerId,
        tradeCount: trades.length,
        totalVolume,
        avgExecutionQuality: totalQuality / count,
        avgCostBps: totalCostBps / count,
        avgFillRate: 1.0,
        avgLatencyMs: totalLatencyMs / count,
        feeStructure: {
          avgCommissionBps: totalCommissionBps / count,
          avgSpreadBps: totalSpreadBps / count,
          totalFeesAmount: totalFees,
        },
      });
    }

    return this.brokerStats;
  }

  /**
   * Compare fee structures across brokers
   */
  compareFeeStructures(): Array<{
    brokerId: string;
    avgCommissionBps: number;
    avgSpreadBps: number;
    totalCostBps: number;
    rank: number;
  }> {
    this.compareExecutionQuality();

    const comparison = Array.from(this.brokerStats.values())
      .map(stats => ({
        brokerId: stats.brokerId,
        avgCommissionBps: stats.feeStructure.avgCommissionBps,
        avgSpreadBps: stats.feeStructure.avgSpreadBps,
        totalCostBps: stats.avgCostBps,
        rank: 0,
      }))
      .sort((a, b) => a.totalCostBps - b.totalCostBps);

    comparison.forEach((item, index) => {
      item.rank = index + 1;
    });

    return comparison;
  }

  /**
   * Analyze fill rates by broker
   */
  analyzeFillRates(): Map<string, {
    totalOrders: number;
    filledOrders: number;
    fillRate: number;
    partialFills: number;
  }> {
    const fillRates = new Map<string, {
      totalOrders: number;
      filledOrders: number;
      fillRate: number;
      partialFills: number;
    }>();

    for (const [brokerId, trades] of this.brokerTrades) {
      fillRates.set(brokerId, {
        totalOrders: trades.length,
        filledOrders: trades.length,
        fillRate: 1.0,
        partialFills: 0,
      });
    }

    return fillRates;
  }

  /**
   * Track latency by broker
   */
  trackLatency(): Map<string, {
    avgLatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    p50LatencyMs: number;
    p99LatencyMs: number;
  }> {
    const latencyStats = new Map<string, {
      avgLatencyMs: number;
      minLatencyMs: number;
      maxLatencyMs: number;
      p50LatencyMs: number;
      p99LatencyMs: number;
    }>();

    for (const [brokerId, trades] of this.brokerTrades) {
      const latencies = trades.map(t => 
        t.executionTimestamp.getTime() - t.orderTimestamp.getTime()
      ).sort((a, b) => a - b);

      if (latencies.length === 0) {
        latencyStats.set(brokerId, {
          avgLatencyMs: 0,
          minLatencyMs: 0,
          maxLatencyMs: 0,
          p50LatencyMs: 0,
          p99LatencyMs: 0,
        });
        continue;
      }

      const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
      const p50Index = Math.floor(latencies.length * 0.5);
      const p99Index = Math.floor(latencies.length * 0.99);

      latencyStats.set(brokerId, {
        avgLatencyMs: avg,
        minLatencyMs: latencies[0],
        maxLatencyMs: latencies[latencies.length - 1],
        p50LatencyMs: latencies[p50Index],
        p99LatencyMs: latencies[p99Index] || latencies[latencies.length - 1],
      });
    }

    return latencyStats;
  }

  /**
   * Get broker statistics
   */
  getBrokerStats(brokerId: string): BrokerStats | undefined {
    return this.brokerStats.get(brokerId);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.brokerTrades.clear();
    this.brokerStats.clear();
    this.analyzer.clear();
    logger.info('BrokerComparisonAnalyzer data cleared');
  }
}

/**
 * TCA Report structure
 */
export interface TCAReport {
  generatedAt: Date;
  reportPeriod: {
    start: Date;
    end: Date;
  };
  summary: {
    totalTrades: number;
    totalVolume: number;
    totalNotional: number;
    totalCosts: number;
    avgCostBps: number;
    avgExecutionQuality: number;
  };
  costBreakdown: {
    implementationShortfall: { amount: number; bps: number; percentage: number };
    marketImpact: { amount: number; bps: number; percentage: number };
    timingCost: { amount: number; bps: number; percentage: number };
    spreadCost: { amount: number; bps: number; percentage: number };
    commission: { amount: number; bps: number; percentage: number };
  };
  timeOfDayPatterns: Array<{
    hour: number;
    tradeCount: number;
    avgCostBps: number;
    avgSpreadBps: number;
    recommendation: string;
  }>;
  sizeImpactAnalysis: Array<{
    sizeCategory: string;
    tradeCount: number;
    avgCostBps: number;
    avgMarketImpactBps: number;
  }>;
  recommendations: string[];
  brokerComparison?: Array<{
    brokerId: string;
    avgCostBps: number;
    avgQuality: number;
    rank: number;
  }>;
}

/**
 * TCAReportGenerator - Generate comprehensive TCA reports
 */
export class TCAReportGenerator {
  private analyzer: TransactionCostAnalyzer;
  private brokerAnalyzer: BrokerComparisonAnalyzer;

  constructor(
    analyzer?: TransactionCostAnalyzer,
    brokerAnalyzer?: BrokerComparisonAnalyzer
  ) {
    this.analyzer = analyzer || new TransactionCostAnalyzer();
    this.brokerAnalyzer = brokerAnalyzer || new BrokerComparisonAnalyzer();
    logger.info('TCAReportGenerator initialized');
  }

  /**
   * Generate a comprehensive TCA report
   */
  generateReport(
    trades: TradeExecution[],
    startDate?: Date,
    endDate?: Date
  ): TCAReport {
    logger.info('Generating TCA report', { tradeCount: trades.length });

    for (const trade of trades) {
      this.analyzer.analyzeTrade(trade);
      this.brokerAnalyzer.addTrade(trade);
    }

    const aggregated = this.analyzer.aggregateAnalysis(trades, startDate, endDate);
    const brokerStats = this.brokerAnalyzer.compareExecutionQuality();

    let totalImplShortfall = 0;
    let totalMarketImpact = 0;
    let totalTimingCost = 0;
    let totalSpreadCost = 0;
    let totalCommission = 0;
    let totalQuality = 0;

    for (const trade of trades) {
      const metrics = this.analyzer.getMetrics(trade.orderId);
      const quality = this.analyzer.calculateExecutionQuality(trade);
      
      if (metrics) {
        totalImplShortfall += metrics.totalExecutionCost.costBreakdown.implementationShortfall;
        totalMarketImpact += metrics.totalExecutionCost.costBreakdown.marketImpact;
        totalTimingCost += metrics.totalExecutionCost.costBreakdown.timingCost;
        totalSpreadCost += metrics.totalExecutionCost.costBreakdown.spreadCost;
        totalCommission += metrics.totalExecutionCost.costBreakdown.commission;
      }
      totalQuality += quality.overallScore;
    }

    const totalCosts = totalImplShortfall + totalMarketImpact + totalTimingCost + totalSpreadCost + totalCommission;

    const timeOfDayPatterns = this.analyzeTimeOfDayPatterns(aggregated.byTimeOfDay);
    const sizeImpactAnalysis = this.analyzeSizeImpact(trades);
    const recommendations = this.generateRecommendations(aggregated, timeOfDayPatterns, sizeImpactAnalysis);

    const brokerComparison = Array.from(brokerStats.values())
      .map(stats => ({
        brokerId: stats.brokerId,
        avgCostBps: stats.avgCostBps,
        avgQuality: stats.avgExecutionQuality,
        rank: 0,
      }))
      .sort((a, b) => a.avgCostBps - b.avgCostBps);

    brokerComparison.forEach((item, index) => {
      item.rank = index + 1;
    });

    return {
      generatedAt: new Date(),
      reportPeriod: aggregated.period,
      summary: {
        totalTrades: aggregated.tradeCount,
        totalVolume: aggregated.totalVolume,
        totalNotional: aggregated.totalNotional,
        totalCosts,
        avgCostBps: aggregated.averageMetrics.totalCostBps,
        avgExecutionQuality: totalQuality / (trades.length || 1),
      },
      costBreakdown: {
        implementationShortfall: {
          amount: totalImplShortfall,
          bps: aggregated.averageMetrics.implementationShortfallBps,
          percentage: totalCosts > 0 ? (totalImplShortfall / totalCosts) * 100 : 0,
        },
        marketImpact: {
          amount: totalMarketImpact,
          bps: aggregated.averageMetrics.marketImpactBps,
          percentage: totalCosts > 0 ? (totalMarketImpact / totalCosts) * 100 : 0,
        },
        timingCost: {
          amount: totalTimingCost,
          bps: aggregated.averageMetrics.timingCostBps,
          percentage: totalCosts > 0 ? (totalTimingCost / totalCosts) * 100 : 0,
        },
        spreadCost: {
          amount: totalSpreadCost,
          bps: aggregated.averageMetrics.spreadCostBps,
          percentage: totalCosts > 0 ? (totalSpreadCost / totalCosts) * 100 : 0,
        },
        commission: {
          amount: totalCommission,
          bps: aggregated.averageMetrics.commissionBps,
          percentage: totalCosts > 0 ? (totalCommission / totalCosts) * 100 : 0,
        },
      },
      timeOfDayPatterns,
      sizeImpactAnalysis,
      recommendations,
      brokerComparison,
    };
  }

  /**
   * Analyze time-of-day trading patterns
   */
  private analyzeTimeOfDayPatterns(
    byTimeOfDay: Map<number, { tradeCount: number; avgCostBps: number; avgSpreadBps: number }>
  ): TCAReport['timeOfDayPatterns'] {
    const patterns: TCAReport['timeOfDayPatterns'] = [];

    for (let hour = 0; hour < 24; hour++) {
      const stats = byTimeOfDay.get(hour);
      if (!stats || stats.tradeCount === 0) continue;

      let recommendation = 'Normal execution conditions';
      if (stats.avgSpreadBps > 20) {
        recommendation = 'Wide spreads - consider avoiding this period';
      } else if (stats.avgCostBps > 30) {
        recommendation = 'High costs detected - review execution strategy';
      } else if (stats.avgCostBps < 10 && stats.avgSpreadBps < 10) {
        recommendation = 'Optimal trading conditions - consider increasing volume';
      }

      patterns.push({
        hour,
        tradeCount: stats.tradeCount,
        avgCostBps: stats.avgCostBps,
        avgSpreadBps: stats.avgSpreadBps,
        recommendation,
      });
    }

    return patterns;
  }

  /**
   * Analyze size impact on execution costs
   */
  private analyzeSizeImpact(trades: TradeExecution[]): TCAReport['sizeImpactAnalysis'] {
    const sizeCategories = new Map<string, {
      trades: TradeExecution[];
      totalCostBps: number;
      totalMarketImpactBps: number;
    }>();

    for (const trade of trades) {
      const notional = trade.quantity * trade.executionPrice;
      let category: string;

      if (notional < 10000) category = 'Small (<$10K)';
      else if (notional < 50000) category = 'Medium ($10K-$50K)';
      else if (notional < 250000) category = 'Large ($50K-$250K)';
      else category = 'Very Large (>$250K)';

      const existing = sizeCategories.get(category) || {
        trades: [],
        totalCostBps: 0,
        totalMarketImpactBps: 0,
      };

      const metrics = this.analyzer.getMetrics(trade.orderId);
      existing.trades.push(trade);
      existing.totalCostBps += metrics?.totalExecutionCost.totalCostBps || 0;
      existing.totalMarketImpactBps += metrics?.marketImpact.totalImpactBps || 0;

      sizeCategories.set(category, existing);
    }

    return Array.from(sizeCategories.entries()).map(([category, data]) => ({
      sizeCategory: category,
      tradeCount: data.trades.length,
      avgCostBps: data.totalCostBps / (data.trades.length || 1),
      avgMarketImpactBps: data.totalMarketImpactBps / (data.trades.length || 1),
    }));
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    aggregated: AggregatedTCAStats,
    timePatterns: TCAReport['timeOfDayPatterns'],
    sizeAnalysis: TCAReport['sizeImpactAnalysis']
  ): string[] {
    const recommendations: string[] = [];

    if (aggregated.averageMetrics.implementationShortfallBps > 15) {
      recommendations.push('High implementation shortfall detected. Consider using more aggressive limit orders or improving price discovery.');
    }

    if (aggregated.averageMetrics.marketImpactBps > 10) {
      recommendations.push('Significant market impact observed. Consider breaking large orders into smaller chunks or using algorithmic execution.');
    }

    if (aggregated.averageMetrics.timingCostBps > 5) {
      recommendations.push('Timing costs are elevated. Review order routing and consider co-location or faster execution infrastructure.');
    }

    if (aggregated.averageMetrics.spreadCostBps > 15) {
      recommendations.push('Spread costs are high. Trade during periods of higher liquidity or use limit orders to avoid crossing the spread.');
    }

    const highCostHours = timePatterns.filter(p => p.avgCostBps > 25);
    if (highCostHours.length > 0) {
      const hours = highCostHours.map(p => `${p.hour}:00`).join(', ');
      recommendations.push(`Avoid trading during high-cost periods: ${hours}`);
    }

    const largeTrades = sizeAnalysis.find(s => s.sizeCategory.includes('Large') || s.sizeCategory.includes('Very Large'));
    if (largeTrades && largeTrades.avgMarketImpactBps > 15) {
      recommendations.push('Large orders have significant market impact. Consider using TWAP/VWAP algorithms for better execution.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Execution quality is within acceptable parameters. Continue monitoring for optimization opportunities.');
    }

    return recommendations;
  }
}

/**
 * Factory function to create a TransactionCostAnalyzer
 */
export function createTransactionCostAnalyzer(): TransactionCostAnalyzer {
  return new TransactionCostAnalyzer();
}

/**
 * Factory function to create a BrokerComparisonAnalyzer
 */
export function createBrokerComparisonAnalyzer(): BrokerComparisonAnalyzer {
  return new BrokerComparisonAnalyzer();
}

/**
 * Factory function to create a TCAReportGenerator
 */
export function createTCAReportGenerator(
  analyzer?: TransactionCostAnalyzer,
  brokerAnalyzer?: BrokerComparisonAnalyzer
): TCAReportGenerator {
  return new TCAReportGenerator(analyzer, brokerAnalyzer);
}
