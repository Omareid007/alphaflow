/**
 * AI Active Trader - Order Book Depth Analysis Module
 * Comprehensive order book analysis for market microstructure insights
 * 
 * Features:
 * - Level 2 market data processing
 * - Bid-ask spread calculations (absolute, relative, effective)
 * - Liquidity estimation at various price levels
 * - Order book imbalance ratio
 * - Depth-weighted mid price
 * - Support/resistance detection from order clusters
 * - Volume profile analysis
 * - Order flow tracking and analysis
 */

import { createLogger } from '../common';

const logger = createLogger('order-book-analyzer');

// ================== INTERFACES ==================

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface OrderBook {
  symbol: string;
  timestamp: Date;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface SpreadMetrics {
  absoluteSpread: number;
  relativeSpread: number;
  effectiveSpread: number;
  midPrice: number;
  bestBid: number;
  bestAsk: number;
}

export interface LiquidityMetrics {
  liquidityAt1Percent: { bid: number; ask: number };
  liquidityAt2Percent: { bid: number; ask: number };
  liquidityAt5Percent: { bid: number; ask: number };
  marketDepthScore: number;
  estimatedSlippage: Map<number, number>;
  optimalOrderSize: number;
  totalBidLiquidity: number;
  totalAskLiquidity: number;
}

export interface OrderImbalance {
  ratio: number;
  direction: 'buy' | 'sell' | 'neutral';
  strength: number;
  bidVolume: number;
  askVolume: number;
}

export interface DepthWeightedPrice {
  weightedMidPrice: number;
  weightedBidPrice: number;
  weightedAskPrice: number;
  depthLevels: number;
}

export interface OrderCluster {
  priceLevel: number;
  totalQuantity: number;
  orderCount: number;
  significance: number;
  type: 'support' | 'resistance';
}

export interface VolumeProfileLevel {
  priceLevel: number;
  volume: number;
  percentage: number;
  isPointOfControl: boolean;
}

export interface VolumeProfile {
  levels: VolumeProfileLevel[];
  pointOfControl: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  totalVolume: number;
}

export interface Trade {
  timestamp: Date;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  isMaker?: boolean;
}

export interface OrderFlowMetrics {
  imbalance: number;
  buyVolume: number;
  sellVolume: number;
  aggressiveBuyVolume: number;
  aggressiveSellVolume: number;
  passiveBuyVolume: number;
  passiveSellVolume: number;
  largeOrdersDetected: LargeOrderInfo[];
  tradeDirection: 'bullish' | 'bearish' | 'neutral';
  deltaAccumulation: number;
}

export interface LargeOrderInfo {
  timestamp: Date;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  isIcebergHint: boolean;
  significanceScore: number;
}

// ================== ORDER BOOK ANALYZER ==================

export class OrderBookAnalyzer {
  private depthLevels: number;
  private significanceThreshold: number;

  constructor(depthLevels: number = 20, significanceThreshold: number = 0.1) {
    this.depthLevels = depthLevels;
    this.significanceThreshold = significanceThreshold;
  }

  /**
   * Process Level 2 market data and extract key metrics
   */
  processOrderBook(orderBook: OrderBook): {
    spread: SpreadMetrics;
    imbalance: OrderImbalance;
    depthWeightedPrice: DepthWeightedPrice;
    liquidity: LiquidityMetrics;
  } {
    logger.debug(`Processing order book for ${orderBook.symbol}`);

    const spread = this.calculateSpread(orderBook);
    const imbalance = this.calculateImbalance(orderBook);
    const depthWeightedPrice = this.calculateDepthWeightedMidPrice(orderBook);
    const liquidity = this.estimateLiquidity(orderBook);

    return { spread, imbalance, depthWeightedPrice, liquidity };
  }

  /**
   * Calculate bid-ask spread metrics
   */
  calculateSpread(orderBook: OrderBook): SpreadMetrics {
    if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
      logger.warn('Empty order book, cannot calculate spread');
      return {
        absoluteSpread: 0,
        relativeSpread: 0,
        effectiveSpread: 0,
        midPrice: 0,
        bestBid: 0,
        bestAsk: 0,
      };
    }

    const bestBid = orderBook.bids[0].price;
    const bestAsk = orderBook.asks[0].price;
    const midPrice = (bestBid + bestAsk) / 2;
    const absoluteSpread = bestAsk - bestBid;
    const relativeSpread = absoluteSpread / midPrice;

    const bidQuantity = orderBook.bids[0].quantity;
    const askQuantity = orderBook.asks[0].quantity;
    const totalQuantity = bidQuantity + askQuantity;
    const weightedBid = (bidQuantity / totalQuantity) * bestBid;
    const weightedAsk = (askQuantity / totalQuantity) * bestAsk;
    const effectiveSpread = Math.abs(weightedAsk - weightedBid) * 2;

    return {
      absoluteSpread,
      relativeSpread,
      effectiveSpread,
      midPrice,
      bestBid,
      bestAsk,
    };
  }

  /**
   * Estimate liquidity at various price impact levels
   */
  estimateLiquidity(orderBook: OrderBook): LiquidityMetrics {
    const midPrice = this.calculateMidPrice(orderBook);
    
    const liquidityAt1Percent = this.getLiquidityAtPriceImpact(orderBook, midPrice, 0.01);
    const liquidityAt2Percent = this.getLiquidityAtPriceImpact(orderBook, midPrice, 0.02);
    const liquidityAt5Percent = this.getLiquidityAtPriceImpact(orderBook, midPrice, 0.05);

    const totalBidLiquidity = orderBook.bids.reduce((sum, level) => sum + level.quantity * level.price, 0);
    const totalAskLiquidity = orderBook.asks.reduce((sum, level) => sum + level.quantity * level.price, 0);

    const marketDepthScore = this.calculateMarketDepthScore(orderBook);
    const estimatedSlippage = this.calculateSlippageMap(orderBook);
    const optimalOrderSize = this.calculateOptimalOrderSize(orderBook, midPrice);

    return {
      liquidityAt1Percent,
      liquidityAt2Percent,
      liquidityAt5Percent,
      marketDepthScore,
      estimatedSlippage,
      optimalOrderSize,
      totalBidLiquidity,
      totalAskLiquidity,
    };
  }

  private getLiquidityAtPriceImpact(
    orderBook: OrderBook,
    midPrice: number,
    impactPercent: number
  ): { bid: number; ask: number } {
    const bidThreshold = midPrice * (1 - impactPercent);
    const askThreshold = midPrice * (1 + impactPercent);

    let bidLiquidity = 0;
    for (const level of orderBook.bids) {
      if (level.price >= bidThreshold) {
        bidLiquidity += level.quantity * level.price;
      }
    }

    let askLiquidity = 0;
    for (const level of orderBook.asks) {
      if (level.price <= askThreshold) {
        askLiquidity += level.quantity * level.price;
      }
    }

    return { bid: bidLiquidity, ask: askLiquidity };
  }

  private calculateMarketDepthScore(orderBook: OrderBook): number {
    const levels = Math.min(this.depthLevels, orderBook.bids.length, orderBook.asks.length);
    if (levels === 0) return 0;

    let bidScore = 0;
    let askScore = 0;

    for (let i = 0; i < levels; i++) {
      const weight = 1 / (i + 1);
      bidScore += orderBook.bids[i].quantity * orderBook.bids[i].price * weight;
      askScore += orderBook.asks[i].quantity * orderBook.asks[i].price * weight;
    }

    const totalScore = bidScore + askScore;
    const normalizedScore = Math.min(100, Math.log10(totalScore + 1) * 10);

    return normalizedScore;
  }

  private calculateSlippageMap(orderBook: OrderBook): Map<number, number> {
    const slippageMap = new Map<number, number>();
    const orderSizes = [1000, 5000, 10000, 25000, 50000, 100000];
    const midPrice = this.calculateMidPrice(orderBook);

    for (const size of orderSizes) {
      const buySlippage = this.estimateSlippageForOrder(orderBook.asks, size, midPrice, 'buy');
      const sellSlippage = this.estimateSlippageForOrder(orderBook.bids, size, midPrice, 'sell');
      slippageMap.set(size, (buySlippage + sellSlippage) / 2);
    }

    return slippageMap;
  }

  private estimateSlippageForOrder(
    levels: OrderBookLevel[],
    orderValueUSD: number,
    midPrice: number,
    side: 'buy' | 'sell'
  ): number {
    let remainingValue = orderValueUSD;
    let executedQuantity = 0;
    let executedValue = 0;

    for (const level of levels) {
      const levelValue = level.quantity * level.price;
      
      if (remainingValue <= 0) break;

      if (levelValue >= remainingValue) {
        const partialQuantity = remainingValue / level.price;
        executedQuantity += partialQuantity;
        executedValue += remainingValue;
        remainingValue = 0;
      } else {
        executedQuantity += level.quantity;
        executedValue += levelValue;
        remainingValue -= levelValue;
      }
    }

    if (executedQuantity === 0) return 0;

    const avgPrice = executedValue / executedQuantity;
    const slippage = side === 'buy' 
      ? (avgPrice - midPrice) / midPrice 
      : (midPrice - avgPrice) / midPrice;

    return Math.max(0, slippage);
  }

  private calculateOptimalOrderSize(orderBook: OrderBook, midPrice: number): number {
    const maxSlippagePercent = 0.001;
    let optimalSize = 0;

    for (let size = 1000; size <= 1000000; size += 1000) {
      const buySlippage = this.estimateSlippageForOrder(orderBook.asks, size, midPrice, 'buy');
      
      if (buySlippage <= maxSlippagePercent) {
        optimalSize = size;
      } else {
        break;
      }
    }

    return optimalSize;
  }

  /**
   * Calculate order book imbalance ratio
   */
  calculateImbalance(orderBook: OrderBook, levels: number = 10): OrderImbalance {
    const levelsToUse = Math.min(levels, orderBook.bids.length, orderBook.asks.length);
    
    if (levelsToUse === 0) {
      return { ratio: 1, direction: 'neutral', strength: 0, bidVolume: 0, askVolume: 0 };
    }

    let bidVolume = 0;
    let askVolume = 0;

    for (let i = 0; i < levelsToUse; i++) {
      bidVolume += orderBook.bids[i].quantity * orderBook.bids[i].price;
      askVolume += orderBook.asks[i].quantity * orderBook.asks[i].price;
    }

    const totalVolume = bidVolume + askVolume;
    if (totalVolume === 0) {
      return { ratio: 1, direction: 'neutral', strength: 0, bidVolume: 0, askVolume: 0 };
    }

    const ratio = bidVolume / askVolume;
    const imbalancePercent = (bidVolume - askVolume) / totalVolume;
    
    let direction: 'buy' | 'sell' | 'neutral';
    if (imbalancePercent > 0.1) {
      direction = 'buy';
    } else if (imbalancePercent < -0.1) {
      direction = 'sell';
    } else {
      direction = 'neutral';
    }

    const strength = Math.min(1, Math.abs(imbalancePercent) * 2);

    return { ratio, direction, strength, bidVolume, askVolume };
  }

  /**
   * Calculate depth-weighted mid price
   */
  calculateDepthWeightedMidPrice(orderBook: OrderBook, levels: number = 5): DepthWeightedPrice {
    const levelsToUse = Math.min(levels, orderBook.bids.length, orderBook.asks.length);
    
    if (levelsToUse === 0) {
      return { weightedMidPrice: 0, weightedBidPrice: 0, weightedAskPrice: 0, depthLevels: 0 };
    }

    let totalBidWeight = 0;
    let totalAskWeight = 0;
    let weightedBidSum = 0;
    let weightedAskSum = 0;

    for (let i = 0; i < levelsToUse; i++) {
      const bidWeight = orderBook.bids[i].quantity;
      const askWeight = orderBook.asks[i].quantity;

      weightedBidSum += orderBook.bids[i].price * bidWeight;
      weightedAskSum += orderBook.asks[i].price * askWeight;
      totalBidWeight += bidWeight;
      totalAskWeight += askWeight;
    }

    const weightedBidPrice = totalBidWeight > 0 ? weightedBidSum / totalBidWeight : 0;
    const weightedAskPrice = totalAskWeight > 0 ? weightedAskSum / totalAskWeight : 0;
    const weightedMidPrice = (weightedBidPrice + weightedAskPrice) / 2;

    return {
      weightedMidPrice,
      weightedBidPrice,
      weightedAskPrice,
      depthLevels: levelsToUse,
    };
  }

  /**
   * Detect support and resistance levels from order clusters
   */
  detectSupportResistance(orderBook: OrderBook, clusterThreshold: number = 2): OrderCluster[] {
    const clusters: OrderCluster[] = [];
    const midPrice = this.calculateMidPrice(orderBook);

    const bidClusters = this.findClusters(orderBook.bids, 'support', midPrice, clusterThreshold);
    const askClusters = this.findClusters(orderBook.asks, 'resistance', midPrice, clusterThreshold);

    clusters.push(...bidClusters, ...askClusters);
    clusters.sort((a, b) => b.significance - a.significance);

    return clusters.slice(0, 10);
  }

  private findClusters(
    levels: OrderBookLevel[],
    type: 'support' | 'resistance',
    midPrice: number,
    threshold: number
  ): OrderCluster[] {
    const clusters: OrderCluster[] = [];
    const totalQuantity = levels.reduce((sum, level) => sum + level.quantity, 0);
    const avgQuantity = totalQuantity / levels.length;

    for (const level of levels) {
      if (level.quantity >= avgQuantity * threshold) {
        const distanceFromMid = Math.abs(level.price - midPrice) / midPrice;
        const quantityRatio = level.quantity / avgQuantity;
        const significance = quantityRatio * (1 / (distanceFromMid + 0.01));

        clusters.push({
          priceLevel: level.price,
          totalQuantity: level.quantity,
          orderCount: level.orderCount,
          significance: Math.min(1, significance / 10),
          type,
        });
      }
    }

    return clusters;
  }

  /**
   * Analyze volume profile from order book
   */
  analyzeVolumeProfile(orderBook: OrderBook, buckets: number = 20): VolumeProfile {
    const allLevels = [...orderBook.bids, ...orderBook.asks];
    
    if (allLevels.length === 0) {
      return {
        levels: [],
        pointOfControl: 0,
        valueAreaHigh: 0,
        valueAreaLow: 0,
        totalVolume: 0,
      };
    }

    const prices = allLevels.map(l => l.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const bucketSize = priceRange / buckets;

    const volumeByBucket = new Map<number, number>();
    let totalVolume = 0;

    for (const level of allLevels) {
      const bucketIndex = Math.floor((level.price - minPrice) / bucketSize);
      const bucketPrice = minPrice + bucketIndex * bucketSize + bucketSize / 2;
      const currentVolume = volumeByBucket.get(bucketPrice) || 0;
      volumeByBucket.set(bucketPrice, currentVolume + level.quantity);
      totalVolume += level.quantity;
    }

    const levels: VolumeProfileLevel[] = [];
    let maxVolume = 0;
    let pocPrice = 0;

    Array.from(volumeByBucket.entries()).forEach(([priceLevel, volume]) => {
      if (volume > maxVolume) {
        maxVolume = volume;
        pocPrice = priceLevel;
      }

      levels.push({
        priceLevel,
        volume,
        percentage: totalVolume > 0 ? volume / totalVolume : 0,
        isPointOfControl: false,
      });
    });

    levels.sort((a, b) => a.priceLevel - b.priceLevel);

    const pocIndex = levels.findIndex(l => l.priceLevel === pocPrice);
    if (pocIndex >= 0) {
      levels[pocIndex].isPointOfControl = true;
    }

    const { valueAreaHigh, valueAreaLow } = this.calculateValueArea(levels, totalVolume);

    return {
      levels,
      pointOfControl: pocPrice,
      valueAreaHigh,
      valueAreaLow,
      totalVolume,
    };
  }

  private calculateValueArea(
    levels: VolumeProfileLevel[],
    totalVolume: number
  ): { valueAreaHigh: number; valueAreaLow: number } {
    const sortedByVolume = [...levels].sort((a, b) => b.volume - a.volume);
    let accumulatedVolume = 0;
    const targetVolume = totalVolume * 0.7;
    const includedPrices: number[] = [];

    for (const level of sortedByVolume) {
      if (accumulatedVolume >= targetVolume) break;
      includedPrices.push(level.priceLevel);
      accumulatedVolume += level.volume;
    }

    return {
      valueAreaHigh: Math.max(...includedPrices),
      valueAreaLow: Math.min(...includedPrices),
    };
  }

  private calculateMidPrice(orderBook: OrderBook): number {
    if (orderBook.bids.length === 0 || orderBook.asks.length === 0) return 0;
    return (orderBook.bids[0].price + orderBook.asks[0].price) / 2;
  }
}

// ================== ORDER FLOW ANALYZER ==================

export class OrderFlowAnalyzer {
  private tradeHistory: Trade[] = [];
  private windowSize: number;
  private largeOrderThresholdMultiplier: number;
  private icebergDetectionThreshold: number;

  constructor(
    windowSize: number = 100,
    largeOrderThresholdMultiplier: number = 5,
    icebergDetectionThreshold: number = 0.3
  ) {
    this.windowSize = windowSize;
    this.largeOrderThresholdMultiplier = largeOrderThresholdMultiplier;
    this.icebergDetectionThreshold = icebergDetectionThreshold;
  }

  /**
   * Add trade to history and analyze
   */
  addTrade(trade: Trade): void {
    this.tradeHistory.push(trade);
    
    if (this.tradeHistory.length > this.windowSize * 2) {
      this.tradeHistory = this.tradeHistory.slice(-this.windowSize);
    }
  }

  /**
   * Add multiple trades at once
   */
  addTrades(trades: Trade[]): void {
    for (const trade of trades) {
      this.addTrade(trade);
    }
  }

  /**
   * Get comprehensive order flow metrics
   */
  getOrderFlowMetrics(): OrderFlowMetrics {
    const recentTrades = this.tradeHistory.slice(-this.windowSize);
    
    if (recentTrades.length === 0) {
      return {
        imbalance: 0,
        buyVolume: 0,
        sellVolume: 0,
        aggressiveBuyVolume: 0,
        aggressiveSellVolume: 0,
        passiveBuyVolume: 0,
        passiveSellVolume: 0,
        largeOrdersDetected: [],
        tradeDirection: 'neutral',
        deltaAccumulation: 0,
      };
    }

    let buyVolume = 0;
    let sellVolume = 0;
    let aggressiveBuyVolume = 0;
    let aggressiveSellVolume = 0;
    let passiveBuyVolume = 0;
    let passiveSellVolume = 0;

    for (const trade of recentTrades) {
      const value = trade.quantity * trade.price;
      
      if (trade.side === 'buy') {
        buyVolume += value;
        if (trade.isMaker === false) {
          aggressiveBuyVolume += value;
        } else {
          passiveBuyVolume += value;
        }
      } else {
        sellVolume += value;
        if (trade.isMaker === false) {
          aggressiveSellVolume += value;
        } else {
          passiveSellVolume += value;
        }
      }
    }

    const totalVolume = buyVolume + sellVolume;
    const imbalance = totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0;
    const deltaAccumulation = buyVolume - sellVolume;

    const largeOrdersDetected = this.detectLargeOrders(recentTrades);
    const tradeDirection = this.classifyTradeDirection(imbalance, aggressiveBuyVolume, aggressiveSellVolume);

    return {
      imbalance,
      buyVolume,
      sellVolume,
      aggressiveBuyVolume,
      aggressiveSellVolume,
      passiveBuyVolume,
      passiveSellVolume,
      largeOrdersDetected,
      tradeDirection,
      deltaAccumulation,
    };
  }

  /**
   * Track order flow imbalance over time
   */
  getImbalanceTimeSeries(buckets: number = 10): { timestamp: Date; imbalance: number }[] {
    if (this.tradeHistory.length === 0) return [];

    const bucketSize = Math.ceil(this.tradeHistory.length / buckets);
    const timeSeries: { timestamp: Date; imbalance: number }[] = [];

    for (let i = 0; i < buckets; i++) {
      const start = i * bucketSize;
      const end = Math.min(start + bucketSize, this.tradeHistory.length);
      const bucketTrades = this.tradeHistory.slice(start, end);

      if (bucketTrades.length === 0) continue;

      let buyVol = 0;
      let sellVol = 0;

      for (const trade of bucketTrades) {
        const value = trade.quantity * trade.price;
        if (trade.side === 'buy') buyVol += value;
        else sellVol += value;
      }

      const total = buyVol + sellVol;
      const imbalance = total > 0 ? (buyVol - sellVol) / total : 0;

      timeSeries.push({
        timestamp: bucketTrades[bucketTrades.length - 1].timestamp,
        imbalance,
      });
    }

    return timeSeries;
  }

  /**
   * Detect aggressive vs passive orders
   */
  analyzeAggressiveness(): { 
    aggressiveRatio: number; 
    passiveRatio: number; 
    netAggression: 'buyers' | 'sellers' | 'balanced' 
  } {
    const metrics = this.getOrderFlowMetrics();
    const totalAggressive = metrics.aggressiveBuyVolume + metrics.aggressiveSellVolume;
    const totalPassive = metrics.passiveBuyVolume + metrics.passiveSellVolume;
    const total = totalAggressive + totalPassive;

    if (total === 0) {
      return { aggressiveRatio: 0, passiveRatio: 0, netAggression: 'balanced' };
    }

    const aggressiveRatio = totalAggressive / total;
    const passiveRatio = totalPassive / total;

    let netAggression: 'buyers' | 'sellers' | 'balanced';
    if (metrics.aggressiveBuyVolume > metrics.aggressiveSellVolume * 1.2) {
      netAggression = 'buyers';
    } else if (metrics.aggressiveSellVolume > metrics.aggressiveBuyVolume * 1.2) {
      netAggression = 'sellers';
    } else {
      netAggression = 'balanced';
    }

    return { aggressiveRatio, passiveRatio, netAggression };
  }

  /**
   * Detect large orders with iceberg detection hints
   */
  private detectLargeOrders(trades: Trade[]): LargeOrderInfo[] {
    if (trades.length === 0) return [];

    const avgQuantity = trades.reduce((sum, t) => sum + t.quantity, 0) / trades.length;
    const threshold = avgQuantity * this.largeOrderThresholdMultiplier;

    const largeOrders: LargeOrderInfo[] = [];

    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i];
      
      if (trade.quantity >= threshold) {
        const isIcebergHint = this.detectIcebergPattern(trades, i);
        const significanceScore = Math.min(1, trade.quantity / (avgQuantity * 10));

        largeOrders.push({
          timestamp: trade.timestamp,
          price: trade.price,
          quantity: trade.quantity,
          side: trade.side,
          isIcebergHint,
          significanceScore,
        });
      }
    }

    return largeOrders.sort((a, b) => b.significanceScore - a.significanceScore);
  }

  /**
   * Detect iceberg order pattern (repeated orders at same price level)
   */
  private detectIcebergPattern(trades: Trade[], currentIndex: number): boolean {
    const currentTrade = trades[currentIndex];
    const lookbackWindow = 10;
    const start = Math.max(0, currentIndex - lookbackWindow);
    
    let samePrice = 0;
    let sameSide = 0;
    let similarSize = 0;

    for (let i = start; i < currentIndex; i++) {
      const trade = trades[i];
      
      if (Math.abs(trade.price - currentTrade.price) / currentTrade.price < 0.001) {
        samePrice++;
      }
      
      if (trade.side === currentTrade.side) {
        sameSide++;
      }
      
      if (Math.abs(trade.quantity - currentTrade.quantity) / currentTrade.quantity < 0.2) {
        similarSize++;
      }
    }

    const windowSize = currentIndex - start;
    if (windowSize === 0) return false;

    const samePriceRatio = samePrice / windowSize;
    const sameSideRatio = sameSide / windowSize;
    const similarSizeRatio = similarSize / windowSize;

    return (samePriceRatio >= this.icebergDetectionThreshold && 
            sameSideRatio >= 0.6 && 
            similarSizeRatio >= 0.3);
  }

  /**
   * Classify trade direction based on order flow
   */
  private classifyTradeDirection(
    imbalance: number,
    aggressiveBuyVolume: number,
    aggressiveSellVolume: number
  ): 'bullish' | 'bearish' | 'neutral' {
    const imbalanceThreshold = 0.15;
    const aggressiveRatio = aggressiveBuyVolume / (aggressiveSellVolume || 1);

    if (imbalance > imbalanceThreshold && aggressiveRatio > 1.2) {
      return 'bullish';
    } else if (imbalance < -imbalanceThreshold && aggressiveRatio < 0.8) {
      return 'bearish';
    }
    
    return 'neutral';
  }

  /**
   * Clear trade history
   */
  clearHistory(): void {
    this.tradeHistory = [];
  }

  /**
   * Get trade count
   */
  getTradeCount(): number {
    return this.tradeHistory.length;
  }
}
