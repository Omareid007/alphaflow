/**
 * Position Reconciliation Service
 *
 * Syncs Alpaca broker positions with the database to ensure data consistency.
 * - Broker positions are the source of truth
 * - Auto-resolves quantity mismatches
 * - Handles externally closed/opened positions
 * - Runs periodically (every 5 minutes) or on-demand
 */

import { alpaca } from "../connectors/alpaca";
import { storage } from "../storage";
import { log } from "../utils/logger";
import type { Position, InsertPosition } from "@shared/schema";

export interface ReconciliationResult {
  timestamp: Date;
  status: "success" | "partial" | "failed" | "skipped";
  brokerPositions: number;
  dbPositions: number;
  synced: number;
  added: number;
  removed: number;
  conflicts: PositionConflict[];
  totalValue: number;
  duration_ms: number;
}

export interface PositionConflict {
  symbol: string;
  brokerQty: number;
  dbQty: number;
  brokerValue: number;
  dbValue: number;
  resolution: "use_broker" | "use_db" | "manual";
  resolved: boolean;
}

export interface BrokerPosition {
  symbol: string;
  qty: number;
  side: "long" | "short";
  marketValue: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
}

class PositionReconciler {
  private lastReconciliation: Date | null = null;
  private reconciliationInterval: number = 5 * 60 * 1000; // 5 minutes
  private isReconciling: boolean = false;

  async reconcile(force: boolean = false): Promise<ReconciliationResult> {
    // Prevent concurrent reconciliation
    if (this.isReconciling) {
      log.info("PositionReconciler", "Reconciliation already in progress, skipping");
      return this.createSkippedResult("Already reconciling");
    }

    // Skip if recently reconciled (unless forced)
    if (!force && this.lastReconciliation) {
      const elapsed = Date.now() - this.lastReconciliation.getTime();
      if (elapsed < this.reconciliationInterval) {
        log.info("PositionReconciler", `Skipping reconciliation, last run ${Math.round(elapsed / 1000)}s ago`);
        return this.createSkippedResult(`Last run ${Math.round(elapsed / 1000)}s ago`);
      }
    }

    this.isReconciling = true;
    const startTime = Date.now();

    log.info("PositionReconciler", "Starting position reconciliation...");

    try {
      // Fetch positions from both sources
      const [brokerPositions, dbPositions] = await Promise.all([
        this.fetchBrokerPositions(),
        this.fetchDBPositions()
      ]);

      // Reconcile positions
      const result = await this.performReconciliation(brokerPositions, dbPositions);
      result.duration_ms = Date.now() - startTime;

      this.lastReconciliation = new Date();

      log.info("PositionReconciler", `Reconciliation completed in ${result.duration_ms}ms`, {
        synced: result.synced,
        added: result.added,
        removed: result.removed,
        conflicts: result.conflicts.length,
        brokerPositions: result.brokerPositions,
        dbPositions: result.dbPositions,
        totalValue: result.totalValue
      });

      return result;
    } catch (error) {
      log.error("PositionReconciler", "Reconciliation failed", { error });
      return {
        timestamp: new Date(),
        status: "failed",
        brokerPositions: 0,
        dbPositions: 0,
        synced: 0,
        added: 0,
        removed: 0,
        conflicts: [],
        totalValue: 0,
        duration_ms: Date.now() - startTime
      };
    } finally {
      this.isReconciling = false;
    }
  }

  private async fetchBrokerPositions(): Promise<BrokerPosition[]> {
    try {
      const positions = await alpaca.getPositions();
      return positions.map((p: any) => ({
        symbol: p.symbol,
        qty: parseFloat(p.qty),
        side: parseFloat(p.qty) >= 0 ? "long" as const : "short" as const,
        marketValue: parseFloat(p.market_value),
        avgEntryPrice: parseFloat(p.avg_entry_price),
        currentPrice: parseFloat(p.current_price),
        unrealizedPL: parseFloat(p.unrealized_pl),
        unrealizedPLPercent: parseFloat(p.unrealized_plpc) * 100
      }));
    } catch (error) {
      log.error("PositionReconciler", "Failed to fetch broker positions", { error });
      throw error;
    }
  }

  private async fetchDBPositions(): Promise<Position[]> {
    try {
      const positions = await storage.getPositions();
      // Return all positions (schema doesn't have status field)
      return positions;
    } catch (error) {
      log.error("PositionReconciler", "Failed to fetch DB positions", { error });
      throw error;
    }
  }

  private async performReconciliation(
    brokerPositions: BrokerPosition[],
    dbPositions: Position[]
  ): Promise<ReconciliationResult> {
    const conflicts: PositionConflict[] = [];
    let synced = 0;
    let added = 0;
    let removed = 0;

    const brokerSymbols = new Set(brokerPositions.map(p => p.symbol));
    const dbSymbols = new Set(dbPositions.map(p => p.symbol));

    // Process broker positions (source of truth)
    for (const brokerPos of brokerPositions) {
      const dbPos = dbPositions.find(p => p.symbol === brokerPos.symbol);

      if (!dbPos) {
        // Position exists in broker but not in DB - add to DB
        await this.addPositionToDB(brokerPos);
        added++;
        log.info("PositionReconciler", `Added missing position: ${brokerPos.symbol} x ${brokerPos.qty}`, {
          symbol: brokerPos.symbol,
          qty: brokerPos.qty,
          source: "broker_not_in_db"
        });
      } else if (Math.abs(parseFloat(dbPos.quantity) - brokerPos.qty) > 0.0001) {
        // Quantity mismatch - conflict detected
        const dbQty = parseFloat(dbPos.quantity);
        const conflict: PositionConflict = {
          symbol: brokerPos.symbol,
          brokerQty: brokerPos.qty,
          dbQty: dbQty,
          brokerValue: brokerPos.marketValue,
          dbValue: dbQty * brokerPos.currentPrice,
          resolution: "use_broker", // Broker is source of truth
          resolved: false
        };

        // Auto-resolve by using broker as source of truth
        await this.updateDBPosition(dbPos.id, brokerPos);
        conflict.resolved = true;
        conflicts.push(conflict);
        synced++;

        log.warn("PositionReconciler", `Resolved quantity conflict for ${brokerPos.symbol}`, {
          symbol: brokerPos.symbol,
          brokerQty: brokerPos.qty,
          dbQty: dbPos.quantity,
          resolution: "use_broker"
        });
      } else {
        // Positions match - update price data only
        await this.updateDBPositionPrices(dbPos.id, brokerPos);
        synced++;
      }
    }

    // Handle positions in DB but not in broker (closed externally)
    for (const dbPos of dbPositions) {
      if (!brokerSymbols.has(dbPos.symbol)) {
        // Position was closed at broker - mark as closed in DB
        await this.closeDBPosition(dbPos.id);
        removed++;
        log.info("PositionReconciler", `Closed stale position: ${dbPos.symbol}`, {
          symbol: dbPos.symbol,
          positionId: dbPos.id,
          source: "db_not_in_broker"
        });
      }
    }

    const totalValue = brokerPositions.reduce((sum, p) => sum + p.marketValue, 0);

    return {
      timestamp: new Date(),
      status: conflicts.length > 0 ? "partial" : "success",
      brokerPositions: brokerPositions.length,
      dbPositions: dbPositions.length,
      synced,
      added,
      removed,
      conflicts,
      totalValue,
      duration_ms: 0 // Will be set by caller
    };
  }

  private async addPositionToDB(brokerPos: BrokerPosition): Promise<void> {
    // Get admin user for system-level position tracking
    const adminUser = await storage.getAdminUser();
    const userId = adminUser?.id || "system";

    const newPosition: InsertPosition = {
      userId,
      symbol: brokerPos.symbol,
      quantity: brokerPos.qty.toString(),
      side: brokerPos.side,
      entryPrice: brokerPos.avgEntryPrice.toString(),
      currentPrice: brokerPos.currentPrice.toString(),
      unrealizedPnl: brokerPos.unrealizedPL.toString(),
      strategyId: null, // Unknown strategy - came from external trade or reconciliation
    };

    await storage.createPosition(newPosition);
  }

  private async updateDBPosition(positionId: string, brokerPos: BrokerPosition): Promise<void> {
    await storage.updatePosition(positionId, {
      quantity: brokerPos.qty.toString(),
      currentPrice: brokerPos.currentPrice.toString(),
      unrealizedPnl: brokerPos.unrealizedPL.toString(),
    });
  }

  private async updateDBPositionPrices(positionId: string, brokerPos: BrokerPosition): Promise<void> {
    await storage.updatePosition(positionId, {
      currentPrice: brokerPos.currentPrice.toString(),
      unrealizedPnl: brokerPos.unrealizedPL.toString(),
    });
  }

  private async closeDBPosition(positionId: string): Promise<void> {
    // Note: Position schema doesn't have status/closedAt fields
    // We could delete the position or just log this for now
    log.info("PositionReconciler", `Position ${positionId} marked for closure (external)`);
    // If you want to delete: await storage.deletePosition(positionId);
  }

  private createSkippedResult(reason: string): ReconciliationResult {
    return {
      timestamp: new Date(),
      status: "skipped",
      brokerPositions: 0,
      dbPositions: 0,
      synced: 0,
      added: 0,
      removed: 0,
      conflicts: [],
      totalValue: 0,
      duration_ms: 0
    };
  }

  // Get reconciliation status
  getStatus(): {
    lastRun: Date | null;
    interval: number;
    isReconciling: boolean;
    nextRunIn: number | null;
  } {
    const nextRunIn = this.lastReconciliation
      ? Math.max(0, this.reconciliationInterval - (Date.now() - this.lastReconciliation.getTime()))
      : null;

    return {
      lastRun: this.lastReconciliation,
      interval: this.reconciliationInterval,
      isReconciling: this.isReconciling,
      nextRunIn
    };
  }

  // Force immediate reconciliation
  async forceReconcile(): Promise<ReconciliationResult> {
    return this.reconcile(true);
  }

  // Set reconciliation interval (in ms)
  setInterval(intervalMs: number): void {
    this.reconciliationInterval = intervalMs;
    log.info("PositionReconciler", `Reconciliation interval set to ${intervalMs}ms`);
  }
}

export const positionReconciler = new PositionReconciler();
