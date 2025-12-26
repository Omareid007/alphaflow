import * as cron from "node-cron";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";
import { eventBus } from "../orchestration";
import { log } from "../utils/logger";

export interface ReconciliationJobStats {
  isRunning: boolean;
  lastRunTime: Date | null;
  lastRunDuration: number | null;
  nextRunTime: Date | null;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastError: string | null;
  lastResult: {
    created: string[];
    updated: string[];
    removed: string[];
    errors: Array<{ symbol: string; error: string }>;
  } | null;
}

class PositionReconciliationJob {
  private cronTask: ReturnType<typeof cron.schedule> | null = null;
  private isRunning = false;
  private stats: ReconciliationJobStats = {
    isRunning: false,
    lastRunTime: null,
    lastRunDuration: null,
    nextRunTime: null,
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    lastError: null,
    lastResult: null,
  };

  /**
   * Start the position reconciliation cron job
   * Runs every 5 minutes to sync positions from Alpaca
   */
  start(): void {
    if (this.cronTask) {
      log.warn("PositionReconciliation", "Job already running, ignoring start request");
      return;
    }

    // Cron expression: "*/5 * * * *" = every 5 minutes
    this.cronTask = cron.schedule("*/5 * * * *", async () => {
      await this.executeSync();
    }, {
      timezone: "America/New_York", // Use market timezone (NYSE)
    });

    log.info("PositionReconciliation", "Cron job started - syncing every 5 minutes");

    // Update next run time
    this.updateNextRunTime();

    // Run immediately on startup (after 10 second delay)
    setTimeout(() => {
      this.executeSync();
    }, 10000);
  }

  /**
   * Stop the position reconciliation cron job
   */
  stop(): void {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
      log.info("PositionReconciliation", "Cron job stopped");
    }
  }

  /**
   * Execute the position sync (can be called manually or by cron)
   */
  async executeSync(): Promise<{
    created: string[];
    updated: string[];
    removed: string[];
    errors: Array<{ symbol: string; error: string }>;
  }> {
    if (this.isRunning) {
      log.warn("PositionReconciliation", "Sync already in progress, skipping this run");
      return { created: [], updated: [], removed: [], errors: [] };
    }

    this.isRunning = true;
    this.stats.isRunning = true;
    this.stats.totalRuns++;

    const startTime = Date.now();
    const runTime = new Date();

    log.info("PositionReconciliation", "Starting position sync...");

    try {
      // Call the trading engine's sync method
      const result = await alpacaTradingEngine.syncPositionsFromAlpaca();

      // Calculate duration
      const duration = Date.now() - startTime;

      // Update stats
      this.stats.successfulRuns++;
      this.stats.lastRunTime = runTime;
      this.stats.lastRunDuration = duration;
      this.stats.lastError = null;
      this.stats.lastResult = result;
      this.updateNextRunTime();

      // Log summary
      log.info("PositionReconciliation", "Position sync completed", {
        created: result.created.length,
        updated: result.updated.length,
        removed: result.removed.length,
        errors: result.errors.length,
        duration: `${duration}ms`,
      });

      // Log discrepancies if any
      if (result.created.length > 0) {
        log.info("PositionReconciliation", `Created ${result.created.length} new positions: ${result.created.join(", ")}`);
      }

      if (result.updated.length > 0) {
        log.info("PositionReconciliation", `Updated ${result.updated.length} existing positions: ${result.updated.join(", ")}`);
      }

      if (result.removed.length > 0) {
        log.warn("PositionReconciliation", `Removed ${result.removed.length} stale positions: ${result.removed.join(", ")}`);
      }

      // Log errors if any
      if (result.errors.length > 0) {
        log.error("PositionReconciliation", `Encountered ${result.errors.length} errors during sync`, {
          errors: result.errors,
        });
      }

      // Emit SSE event for position updates
      if (result.created.length > 0 || result.updated.length > 0 || result.removed.length > 0) {
        eventBus.emit("position:updated", {
          type: "reconciliation",
          created: result.created,
          updated: result.updated,
          removed: result.removed,
          timestamp: new Date().toISOString(),
        }, "position-reconciliation-job");
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = (error as Error).message;

      // Update stats
      this.stats.failedRuns++;
      this.stats.lastRunTime = runTime;
      this.stats.lastRunDuration = duration;
      this.stats.lastError = errorMessage;
      this.updateNextRunTime();

      log.error("PositionReconciliation", "Position sync failed", {
        error: errorMessage,
        duration: `${duration}ms`,
      });

      // Emit SSE error event
      eventBus.emit("system:error", {
        message: "Position reconciliation failed",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }, "position-reconciliation-job");

      // Re-throw so caller knows it failed
      throw error;
    } finally {
      this.isRunning = false;
      this.stats.isRunning = false;
    }
  }

  /**
   * Get current job statistics
   */
  getStats(): ReconciliationJobStats {
    return { ...this.stats };
  }

  /**
   * Reset job statistics (useful for testing)
   */
  resetStats(): void {
    this.stats = {
      isRunning: this.isRunning,
      lastRunTime: null,
      lastRunDuration: null,
      nextRunTime: this.stats.nextRunTime,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastError: null,
      lastResult: null,
    };
    log.info("PositionReconciliation", "Job statistics reset");
  }

  /**
   * Update the next run time based on cron schedule
   */
  private updateNextRunTime(): void {
    if (!this.cronTask) {
      this.stats.nextRunTime = null;
      return;
    }

    // Calculate next run time (5 minutes from now)
    const now = new Date();
    const nextRun = new Date(now.getTime() + 5 * 60 * 1000);

    // Align to next 5-minute boundary
    nextRun.setSeconds(0, 0);
    const minutes = nextRun.getMinutes();
    const remainder = minutes % 5;
    if (remainder !== 0) {
      nextRun.setMinutes(minutes + (5 - remainder));
    }

    this.stats.nextRunTime = nextRun;
  }

  /**
   * Check if job is currently running
   */
  isJobRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const positionReconciliationJob = new PositionReconciliationJob();
