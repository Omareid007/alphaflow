/**
 * Profit Cycling Engine
 *
 * Implements automated profit-taking and reinvestment cycles:
 * - Take profit cycling (profit -> cash -> re-enter)
 * - Profit chasing (scaling into winning positions)
 * - Reinvestment queue management
 * - Position momentum tracking
 *
 * Integrates with:
 * - DynamicExposureController for position sizing
 * - NewsEnhancedDecisionEngine for re-entry signals
 * - Orchestrator for execution
 */

import { log } from "../utils/logger";
import {
  alpaca,
  AlpacaPosition,
  CreateOrderParams,
} from "../connectors/alpaca";
import { dynamicExposureController } from "../services/dynamic-exposure-controller";
import {
  newsEnhancedDecisionEngine,
  DecisionType,
} from "../ai/news-enhanced-decision-engine";
import { storage } from "../storage";
import { tradingConfig } from "../config/trading-config";
import { candidatesService } from "../universe/candidatesService";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ProfitCyclingConfig {
  // Take profit settings
  enableTakeProfitCycling: boolean;
  autoReinvest: boolean;

  // Profit chase settings
  enableProfitChasing: boolean;
  profitChaseThresholdPct: number; // Chase after X% gain (default: 3%)
  profitChaseMinConfidence: number; // Min confidence for chase (default: 0.7)
  profitChaseMaxScaleIn: number; // Max scale-in attempts per position (default: 2)

  // Timing
  cycleIntervalMs: number; // How often to check (default: 30s)
  reinvestCooldownMs: number; // Wait before reinvesting (default: 5 min)

  // Limits
  maxActiveReinvests: number; // Max concurrent reinvestment orders (default: 3)
  minReinvestAmount: number; // Minimum dollar amount to reinvest (default: 100)
}

export interface ProfitCycleState {
  isRunning: boolean;
  lastCycleTime: Date | null;
  takeProfitsExecuted: number;
  reinvestmentsExecuted: number;
  profitChasesExecuted: number;
  totalProfitTaken: number;
  totalReinvested: number;
}

export interface ReinvestmentItem {
  id: string;
  symbol: string;
  amount: number;
  queuedAt: Date;
  sourceOrderId?: string;
  status: "pending" | "executing" | "completed" | "failed";
  targetSymbol?: string;
  executedOrderId?: string;
  error?: string;
}

export interface ProfitChaseTracker {
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  unrealizedPct: number;
  scaleInCount: number;
  lastScaleInTime?: Date;
  highWaterMark: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: ProfitCyclingConfig = {
  enableTakeProfitCycling: true,
  autoReinvest: true,
  enableProfitChasing: true,
  profitChaseThresholdPct: 3,
  profitChaseMinConfidence: 0.7,
  profitChaseMaxScaleIn: 2,
  cycleIntervalMs: 30000,
  reinvestCooldownMs: 300000,
  maxActiveReinvests: 3,
  minReinvestAmount: 100,
};

// ============================================================================
// PROFIT CYCLING ENGINE
// ============================================================================

export class ProfitCyclingEngine {
  private config: ProfitCyclingConfig;
  private state: ProfitCycleState;

  // Reinvestment queue
  private reinvestQueue: Map<string, ReinvestmentItem> = new Map();

  // Profit chase tracking
  private profitChaseTrackers: Map<string, ProfitChaseTracker> = new Map();

  // Intervals
  private cycleInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<ProfitCyclingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isRunning: false,
      lastCycleTime: null,
      takeProfitsExecuted: 0,
      reinvestmentsExecuted: 0,
      profitChasesExecuted: 0,
      totalProfitTaken: 0,
      totalReinvested: 0,
    };

    log.info("ProfitCyclingEngine", "Initialized", {
      takeProfitCycling: this.config.enableTakeProfitCycling,
      profitChasing: this.config.enableProfitChasing,
      cycleInterval: `${this.config.cycleIntervalMs / 1000}s`,
    });
  }

  // ==================== LIFECYCLE ====================

  start(): void {
    if (this.state.isRunning) {
      log.warn("ProfitCyclingEngine", "Already running");
      return;
    }

    this.state.isRunning = true;
    log.info("ProfitCyclingEngine", "Starting profit cycling loops");

    // Start the main cycle
    this.cycleInterval = setInterval(() => {
      this.runCycle().catch((err) => {
        log.error("ProfitCyclingEngine", `Cycle error: ${err}`);
      });
    }, this.config.cycleIntervalMs);

    // Run immediately
    this.runCycle().catch((err) => {
      log.error("ProfitCyclingEngine", `Initial cycle error: ${err}`);
    });
  }

  stop(): void {
    if (!this.state.isRunning) return;

    this.state.isRunning = false;

    if (this.cycleInterval) {
      clearInterval(this.cycleInterval);
      this.cycleInterval = null;
    }

    log.info("ProfitCyclingEngine", "Stopped");
  }

  // ==================== MAIN CYCLE ====================

  private async runCycle(): Promise<void> {
    if (!this.state.isRunning) return;

    try {
      this.state.lastCycleTime = new Date();

      // 1. Check take profit conditions
      if (this.config.enableTakeProfitCycling) {
        await this.runTakeProfitCycle();
      }

      // 2. Process reinvestment queue
      if (this.config.autoReinvest) {
        await this.processReinvestmentQueue();
      }

      // 3. Run profit chase logic
      if (this.config.enableProfitChasing) {
        await this.runProfitChaseCycle();
      }
    } catch (error) {
      log.error("ProfitCyclingEngine", `Cycle error: ${error}`);
    }
  }

  // ==================== TAKE PROFIT CYCLING ====================

  private async runTakeProfitCycle(): Promise<void> {
    try {
      // Get take profit candidates from exposure controller
      const candidates = dynamicExposureController.checkTakeProfitConditions();

      for (const candidate of candidates) {
        if (!this.state.isRunning) break;

        log.info(
          "ProfitCyclingEngine",
          `Take profit candidate: ${candidate.symbol}`,
          {
            unrealizedPct: `${candidate.unrealizedPct.toFixed(2)}%`,
            thresholdHit: `${candidate.thresholdHit}%`,
            takeQty: candidate.takeQty,
          }
        );

        // Execute take profit
        const result = await dynamicExposureController.executeTakeProfitCycle(
          candidate.symbol,
          candidate.takeQty,
          this.config.autoReinvest
        );

        if (result.qtySold > 0) {
          this.state.takeProfitsExecuted++;
          this.state.totalProfitTaken += result.proceeds || 0;

          // Queue for reinvestment if not already handled
          if (
            this.config.autoReinvest &&
            result.proceeds &&
            result.proceeds >= this.config.minReinvestAmount
          ) {
            await this.queueReinvestment({
              symbol: candidate.symbol,
              amount: result.proceeds,
              sourceOrderId: result.orderId,
            });
          }

          log.info(
            "ProfitCyclingEngine",
            `Take profit executed: ${candidate.symbol}`,
            {
              qtySold: result.qtySold,
              proceeds: result.proceeds,
              queuedForReinvest: result.queuedForReinvest,
            }
          );
        }
      }
    } catch (error) {
      log.error("ProfitCyclingEngine", `Take profit cycle error: ${error}`);
    }
  }

  // ==================== REINVESTMENT ====================

  private async queueReinvestment(params: {
    symbol: string;
    amount: number;
    sourceOrderId?: string;
  }): Promise<void> {
    const id = `reinvest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const item: ReinvestmentItem = {
      id,
      symbol: params.symbol,
      amount: params.amount,
      queuedAt: new Date(),
      sourceOrderId: params.sourceOrderId,
      status: "pending",
    };

    this.reinvestQueue.set(id, item);

    log.info("ProfitCyclingEngine", `Queued reinvestment: ${id}`, {
      symbol: params.symbol,
      amount: params.amount,
    });
  }

  private async processReinvestmentQueue(): Promise<void> {
    const now = Date.now();
    const readyItems: ReinvestmentItem[] = [];

    // Find items ready for reinvestment
    for (const item of this.reinvestQueue.values()) {
      if (item.status !== "pending") continue;
      if (now - item.queuedAt.getTime() < this.config.reinvestCooldownMs)
        continue;

      readyItems.push(item);
    }

    // Limit concurrent reinvestments
    const activeCount = Array.from(this.reinvestQueue.values()).filter(
      (i) => i.status === "executing"
    ).length;

    const toProcess = readyItems.slice(
      0,
      this.config.maxActiveReinvests - activeCount
    );

    for (const item of toProcess) {
      if (!this.state.isRunning) break;

      await this.executeReinvestment(item);
    }

    // Clean up old completed/failed items
    for (const [id, item] of this.reinvestQueue) {
      if (item.status === "completed" || item.status === "failed") {
        if (now - item.queuedAt.getTime() > 3600000) {
          // 1 hour
          this.reinvestQueue.delete(id);
        }
      }
    }
  }

  private async executeReinvestment(item: ReinvestmentItem): Promise<void> {
    item.status = "executing";

    try {
      // Find best reinvestment target
      const targetSymbol = await this.findBestReinvestTarget(item.amount);

      if (!targetSymbol) {
        log.info(
          "ProfitCyclingEngine",
          `No suitable reinvestment target for ${item.id}`
        );
        item.status = "pending"; // Try again later
        return;
      }

      item.targetSymbol = targetSymbol;

      // Get current price for the target
      const snapshots = await alpaca.getSnapshots([targetSymbol]);
      const snapshot = snapshots[targetSymbol];

      if (!snapshot || !snapshot.latestTrade) {
        log.warn("ProfitCyclingEngine", `No snapshot for ${targetSymbol}`);
        item.status = "pending";
        return;
      }

      const currentPrice = snapshot.latestTrade.p;
      const qty = Math.floor(item.amount / currentPrice);

      if (qty < 1) {
        log.info(
          "ProfitCyclingEngine",
          `Amount too small for ${targetSymbol}: $${item.amount}`
        );
        item.status = "failed";
        item.error = "Amount too small";
        return;
      }

      // Submit order
      const order = await alpaca.createOrder({
        symbol: targetSymbol,
        qty: qty.toString(),
        side: "buy",
        type: "market",
        time_in_force: "day",
      });

      item.executedOrderId = order.id;
      item.status = "completed";

      this.state.reinvestmentsExecuted++;
      this.state.totalReinvested += qty * currentPrice;

      log.info("ProfitCyclingEngine", `Reinvestment executed: ${item.id}`, {
        from: item.symbol,
        to: targetSymbol,
        qty,
        amount: qty * currentPrice,
        orderId: order.id,
      });
    } catch (error) {
      log.error(
        "ProfitCyclingEngine",
        `Reinvestment error for ${item.id}: ${error}`
      );
      item.status = "failed";
      item.error = String(error);
    }
  }

  private async findBestReinvestTarget(amount: number): Promise<string | null> {
    // Get account status
    const accountStatus = await dynamicExposureController.getAccountStatus();

    // Get symbols to consider (from existing positions or watchlist)
    const candidates = new Set<string>();

    // Consider symbols from current positions (reinforce winners)
    for (const [symbol, pos] of accountStatus.positions) {
      const unrealizedPct = parseFloat(pos.unrealized_plpc) * 100;
      if (unrealizedPct > 0) {
        // Only consider profitable positions
        candidates.add(symbol);
      }
    }

    // Add symbols from database watchlist (approved/watchlist status)
    try {
      const dynamicWatchlist = await candidatesService.getWatchlistSymbols();
      for (const symbol of dynamicWatchlist.stocks.slice(0, 20)) {
        // Limit to top 20 for performance
        candidates.add(symbol);
      }
    } catch (error) {
      // Fallback to minimal list if database unavailable
      const fallbackSymbols = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"];
      for (const symbol of fallbackSymbols) {
        candidates.add(symbol);
      }
      log.warn(
        "ProfitCyclingEngine",
        "Failed to load watchlist from database, using fallback",
        { error: String(error) }
      );
    }

    // Score each candidate
    let bestSymbol: string | null = null;
    let bestScore = -Infinity;

    for (const symbol of candidates) {
      try {
        // Get decision from news-enhanced engine
        const snapshot = await alpaca.getSnapshots([symbol]);
        const snap = snapshot[symbol];

        if (!snap || !snap.latestTrade) continue;

        const price = snap.latestTrade.p;
        if (amount < price) continue; // Can't afford even one share

        const position = accountStatus.positions.get(symbol);
        const posData = position
          ? {
              qty: parseInt(position.qty),
              avgEntryPrice: parseFloat(position.avg_entry_price),
            }
          : undefined;

        const { enhanced } =
          await newsEnhancedDecisionEngine.makeEnhancedDecision(
            symbol,
            price,
            {},
            posData
          );

        // Score based on decision
        let score = enhanced.reasoning.combinedScore * enhanced.confidence;

        // Bonus for aligned signals
        if (enhanced.reasoning.alignment === "aligned") {
          score *= 1.2;
        }

        // Bonus for positive momentum
        if (enhanced.reasoning.sentimentMomentum > 0) {
          score += enhanced.reasoning.sentimentMomentum * 0.5;
        }

        if (
          score > bestScore &&
          enhanced.isActionable &&
          enhanced.decisionType !== DecisionType.HOLD
        ) {
          bestScore = score;
          bestSymbol = symbol;
        }
      } catch (error) {
        log.debug("ProfitCyclingEngine", `Error scoring ${symbol}: ${error}`);
      }
    }

    return bestSymbol;
  }

  // ==================== PROFIT CHASING ====================

  private async runProfitChaseCycle(): Promise<void> {
    try {
      const accountStatus = await dynamicExposureController.getAccountStatus();

      for (const [symbol, pos] of accountStatus.positions) {
        if (!this.state.isRunning) break;

        const unrealizedPct = parseFloat(pos.unrealized_plpc) * 100;
        const currentPrice = parseFloat(pos.current_price);
        const entryPrice = parseFloat(pos.avg_entry_price);
        const qty = parseInt(pos.qty);

        // Update tracker
        let tracker = this.profitChaseTrackers.get(symbol);

        if (!tracker) {
          tracker = {
            symbol,
            entryPrice,
            currentPrice,
            unrealizedPct,
            scaleInCount: 0,
            highWaterMark: currentPrice,
          };
          this.profitChaseTrackers.set(symbol, tracker);
        } else {
          tracker.currentPrice = currentPrice;
          tracker.unrealizedPct = unrealizedPct;
          tracker.highWaterMark = Math.max(tracker.highWaterMark, currentPrice);
        }

        // Check if we should chase profit
        if (unrealizedPct < this.config.profitChaseThresholdPct) continue;
        if (tracker.scaleInCount >= this.config.profitChaseMaxScaleIn) continue;

        // Don't chase too frequently
        if (tracker.lastScaleInTime) {
          const timeSinceLastScale =
            Date.now() - tracker.lastScaleInTime.getTime();
          if (timeSinceLastScale < 300000) continue; // 5 min minimum between scale-ins
        }

        // Get decision from news-enhanced engine
        const posData = { qty, avgEntryPrice: entryPrice };
        const { enhanced } =
          await newsEnhancedDecisionEngine.makeEnhancedDecision(
            symbol,
            currentPrice,
            {},
            posData
          );

        // Only chase if signal remains strong
        if (enhanced.decisionType !== DecisionType.SCALE_IN) continue;
        if (enhanced.confidence < this.config.profitChaseMinConfidence)
          continue;

        // Calculate chase size
        const sizeRec = dynamicExposureController.calculateDynamicPositionSize(
          symbol,
          currentPrice,
          enhanced.confidence,
          accountStatus.portfolioValue,
          accountStatus.currentExposure,
          "scale_in"
        );

        if (sizeRec.recommendedQty < 1) continue;

        // Execute scale-in
        try {
          const order = await alpaca.createOrder({
            symbol,
            qty: sizeRec.recommendedQty.toString(),
            side: "buy",
            type: "market",
            time_in_force: "day",
          });

          tracker.scaleInCount++;
          tracker.lastScaleInTime = new Date();

          this.state.profitChasesExecuted++;

          log.info("ProfitCyclingEngine", `Profit chase executed: ${symbol}`, {
            unrealizedPct: `${unrealizedPct.toFixed(2)}%`,
            scaleInQty: sizeRec.recommendedQty,
            confidence: enhanced.confidence,
            scaleInCount: tracker.scaleInCount,
            orderId: order.id,
          });
        } catch (error) {
          log.error(
            "ProfitCyclingEngine",
            `Profit chase order error for ${symbol}: ${error}`
          );
        }
      }

      // Clean up trackers for closed positions
      for (const symbol of this.profitChaseTrackers.keys()) {
        if (!accountStatus.positions.has(symbol)) {
          this.profitChaseTrackers.delete(symbol);
        }
      }
    } catch (error) {
      log.error("ProfitCyclingEngine", `Profit chase cycle error: ${error}`);
    }
  }

  // ==================== STATUS & METRICS ====================

  getState(): ProfitCycleState {
    return { ...this.state };
  }

  getReinvestQueue(): ReinvestmentItem[] {
    return Array.from(this.reinvestQueue.values());
  }

  getProfitChaseTrackers(): ProfitChaseTracker[] {
    return Array.from(this.profitChaseTrackers.values());
  }

  getMetrics(): {
    state: ProfitCycleState;
    reinvestQueueSize: number;
    activeTrackers: number;
    config: ProfitCyclingConfig;
  } {
    return {
      state: this.getState(),
      reinvestQueueSize: this.reinvestQueue.size,
      activeTrackers: this.profitChaseTrackers.size,
      config: this.config,
    };
  }

  // Alias for getMetrics - provides standard status interface
  getStatus(): {
    isRunning: boolean;
    reinvestmentQueueSize: number;
    config: ProfitCyclingConfig;
    state: ProfitCycleState;
  } {
    return {
      isRunning: this.state.isRunning,
      reinvestmentQueueSize: this.reinvestQueue.size,
      config: this.config,
      state: this.getState(),
    };
  }

  updateConfig(updates: Partial<ProfitCyclingConfig>): void {
    this.config = { ...this.config, ...updates };
    log.info("ProfitCyclingEngine", "Config updated", updates);
  }

  // ==================== MANUAL OPERATIONS ====================

  async manualTakeProfit(
    symbol: string,
    qtyToSell: number
  ): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
  }> {
    try {
      const result = await dynamicExposureController.executeTakeProfitCycle(
        symbol,
        qtyToSell,
        this.config.autoReinvest
      );

      if (result.qtySold > 0) {
        this.state.takeProfitsExecuted++;
        this.state.totalProfitTaken += result.proceeds || 0;

        return {
          success: true,
          orderId: result.orderId,
        };
      }

      return {
        success: false,
        error: result.error || "No shares sold",
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  async manualReinvest(
    amount: number,
    targetSymbol?: string
  ): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
  }> {
    try {
      const symbol =
        targetSymbol || (await this.findBestReinvestTarget(amount));

      if (!symbol) {
        return { success: false, error: "No suitable target found" };
      }

      const snapshots = await alpaca.getSnapshots([symbol]);
      const snapshot = snapshots[symbol];

      if (!snapshot?.latestTrade) {
        return { success: false, error: "No price data available" };
      }

      const price = snapshot.latestTrade.p;
      const qty = Math.floor(amount / price);

      if (qty < 1) {
        return { success: false, error: "Amount too small" };
      }

      const order = await alpaca.createOrder({
        symbol,
        qty: qty.toString(),
        side: "buy",
        type: "market",
        time_in_force: "day",
      });

      this.state.reinvestmentsExecuted++;
      this.state.totalReinvested += qty * price;

      return {
        success: true,
        orderId: order.id,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }
}

// Export singleton instance
export const profitCyclingEngine = new ProfitCyclingEngine();
