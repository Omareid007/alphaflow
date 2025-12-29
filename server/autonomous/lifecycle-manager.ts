/**
 * @file Lifecycle Manager for Autonomous Orchestrator
 *
 * Manages the entire lifecycle of the autonomous trading orchestrator with comprehensive
 * health monitoring and self-healing capabilities. This module ensures the orchestrator
 * runs continuously and recovers from failures without manual intervention.
 *
 * @module autonomous/lifecycle-manager
 *
 * @responsibilities
 * - Auto-initialization with dependency resolution (admin user, agent settings)
 * - Heartbeat/health monitoring with periodic checks
 * - Stale state detection and automatic recovery
 * - Self-healing mechanisms when errors accumulate
 * - Persistent operation with auto-restart on failures
 *
 * @health-monitoring-pattern
 * The lifecycle manager implements a multi-layered health monitoring pattern:
 *
 * 1. Heartbeat Timer (every 30 seconds):
 *    - Updates last heartbeat timestamp
 *    - Decrements consecutive error count on success
 *    - Checks for stale state (no analysis in 120+ seconds)
 *
 * 2. Error Accumulation:
 *    - Tracks consecutive errors across heartbeat cycles
 *    - Triggers self-healing when errors reach threshold (5)
 *
 * 3. Stale State Detection:
 *    - Monitors time since last analysis cycle
 *    - Triggers recovery if orchestrator appears frozen
 *
 * 4. Self-Healing Process:
 *    - Stops orchestrator gracefully
 *    - Waits for cleanup (5 seconds)
 *    - Clears error state
 *    - Restarts orchestrator if auto-start enabled
 *
 * @example
 * ```typescript
 * const lifecycleManager = new LifecycleManager(orchestrator);
 *
 * // Start the orchestrator with auto-initialization
 * await lifecycleManager.autoStart();
 *
 * // Check health status
 * const health = lifecycleManager.getHealthStatus();
 * if (!health.isHealthy) {
 *   console.log(`Unhealthy: ${health.consecutiveErrors} errors`);
 * }
 *
 * // Manually trigger self-healing if needed
 * await lifecycleManager.selfHeal();
 * ```
 */

import { storage } from "../storage";
import { log } from "../utils/logger";
import { marketConditionAnalyzer } from "../ai/market-condition-analyzer";
import type { OrchestratorState } from "./types";

// Lifecycle constants
const HEARTBEAT_INTERVAL_MS = 30000;
const STALE_HEARTBEAT_THRESHOLD_MS = 120000;
const AUTO_RESTART_DELAY_MS = 5000;
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Interface for the orchestrator methods needed by LifecycleManager
 *
 * This interface defines the minimal contract required by the lifecycle manager
 * to control and monitor the orchestrator.
 */
export interface OrchestratorInterface {
  /** Start the orchestrator's main loop */
  start(): Promise<void>;
  /** Stop the orchestrator, optionally preserving auto-start setting */
  stop(preserveAutoStart?: boolean): Promise<void>;
  /** Get current orchestrator state */
  getState(): OrchestratorState;
  /** Update orchestrator state with partial changes */
  setState(updates: Partial<OrchestratorState>): void;
  /** Set the user ID for database operations */
  setUserId(userId: string): void;
}

/**
 * Health status returned by getHealthStatus()
 *
 * Provides a comprehensive health snapshot of the orchestrator including
 * error counts, heartbeat status, and market condition analysis.
 */
export interface HealthStatus {
  /** Overall health status (false if errors >= threshold or not running) */
  isHealthy: boolean;
  /** Last successful heartbeat timestamp */
  lastHeartbeat: Date | null;
  /** Number of consecutive errors (triggers self-healing at 5) */
  consecutiveErrors: number;
  /** Whether auto-start is enabled */
  autoStartEnabled: boolean;
  /** Current market condition from analyzer (bullish/bearish/neutral/volatile) */
  marketCondition: string | null;
  /** Dynamic order limit based on market conditions */
  dynamicOrderLimit: number;
}

/**
 * Manages lifecycle operations for the autonomous orchestrator
 *
 * This class handles the full lifecycle of the orchestrator including startup,
 * continuous health monitoring, error recovery, and self-healing. It ensures
 * the orchestrator runs persistently without manual intervention.
 *
 * @example
 * ```typescript
 * const lifecycleManager = new LifecycleManager(orchestrator);
 * await lifecycleManager.autoStart();
 * // Orchestrator now runs continuously with automatic recovery
 * ```
 */
export class LifecycleManager {
  private orchestrator: OrchestratorInterface;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private consecutiveErrors = 0;
  private lastHeartbeat: Date | null = null;
  private autoStartEnabled = true;
  private isAutoStarting = false;

  constructor(orchestrator: OrchestratorInterface) {
    this.orchestrator = orchestrator;
  }

  /**
   * Auto-initialization with dependency resolution
   *
   * Performs a complete initialization sequence including dependency resolution,
   * setting validation, and orchestrator startup. This is the primary entry point
   * for starting the autonomous trading system.
   *
   * @async
   * @returns {Promise<void>}
   *
   * @throws {Error} If critical initialization steps fail (re-throws after logging)
   *
   * @process
   * 1. Check if auto-start is already in progress (prevents concurrent starts)
   * 2. Resolve admin user from database for permissions
   * 3. Check agent status settings (autoStartEnabled, killSwitchActive)
   * 4. Initialize market condition analyzer
   * 5. Start orchestrator main loop
   * 6. Start heartbeat monitoring
   * 7. On failure: Schedule retry after 5 seconds
   *
   * @example
   * ```typescript
   * const lifecycleManager = new LifecycleManager(orchestrator);
   * await lifecycleManager.autoStart();
   * // Orchestrator is now running with health monitoring active
   * ```
   */
  async autoStart(): Promise<void> {
    if (this.isAutoStarting) {
      log.info("LifecycleManager", "Auto-start already in progress");
      return;
    }

    this.isAutoStarting = true;

    try {
      log.info("LifecycleManager", "Auto-start initializing...");

      // Resolve admin user for database operations
      const adminUser = await storage.getAdminUser();
      if (adminUser) {
        this.orchestrator.setUserId(adminUser.id);
        log.info("LifecycleManager", `Resolved admin user: ${adminUser.id}`);
      } else {
        log.warn(
          "LifecycleManager",
          "No admin user found - database operations may fail"
        );
      }

      const agentStatus = await storage.getAgentStatus();
      this.autoStartEnabled = agentStatus?.autoStartEnabled ?? true;

      if (!this.autoStartEnabled) {
        log.info("LifecycleManager", "Auto-start is disabled in settings");
        this.isAutoStarting = false;
        return;
      }

      if (agentStatus?.killSwitchActive) {
        log.warn(
          "LifecycleManager",
          "Auto-start blocked: Kill switch is active"
        );
        this.isAutoStarting = false;
        return;
      }

      await marketConditionAnalyzer.initialize();

      await this.orchestrator.start();

      this.startHeartbeat();

      log.info(
        "LifecycleManager",
        "Auto-start complete - Agent is now running persistently"
      );
    } catch (error) {
      log.error("LifecycleManager", "Auto-start failed", {
        error: String(error),
      });
      const state = this.orchestrator.getState();
      state.errors.push(`Auto-start failed: ${error}`);

      setTimeout(() => {
        this.isAutoStarting = false;
        this.autoStart().catch((err) => {
          log.error("LifecycleManager", "Auto-restart retry failed", {
            error: String(err),
          });
        });
      }, AUTO_RESTART_DELAY_MS);
    } finally {
      this.isAutoStarting = false;
    }
  }

  /**
   * Begin health monitoring loop
   *
   * Starts a periodic heartbeat that runs every 30 seconds to monitor orchestrator
   * health, detect stale state, and track error accumulation.
   *
   * @returns {void}
   *
   * @heartbeat-cycle
   * - Updates last heartbeat timestamp
   * - Persists heartbeat to database (agent_status table)
   * - Checks for stale state (no analysis in 120+ seconds)
   * - Decrements consecutive error count on success
   * - Increments error count on failure
   * - Triggers self-healing if errors reach threshold (5)
   *
   * @example
   * ```typescript
   * lifecycleManager.startHeartbeat();
   * // Heartbeat now runs every 30 seconds
   * ```
   */
  startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.lastHeartbeat = new Date();

    this.heartbeatTimer = setInterval(async () => {
      await this.performHeartbeat();
    }, HEARTBEAT_INTERVAL_MS) as unknown as NodeJS.Timeout;

    log.info("LifecycleManager", "Heartbeat started");
  }

  /**
   * Stop health monitoring
   *
   * Clears the heartbeat timer to stop health monitoring. Called when the
   * orchestrator is being shut down or when resetting health monitoring.
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * lifecycleManager.stopHeartbeat();
   * // Heartbeat monitoring is now stopped
   * ```
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Periodic health check & error tracking
   *
   * Core heartbeat logic that runs every 30 seconds to monitor orchestrator health.
   * This is the internal implementation called by the heartbeat timer.
   *
   * @async
   * @returns {Promise<void>}
   *
   * @process
   * 1. Update last heartbeat timestamp
   * 2. Persist heartbeat to database
   * 3. Check for stale state
   * 4. Decrement error count on success
   * 5. Increment error count on failure
   * 6. Trigger self-healing if errors >= 5
   *
   * @example
   * ```typescript
   * // Called automatically by heartbeat timer
   * await lifecycleManager.performHeartbeat();
   * ```
   */
  async performHeartbeat(): Promise<void> {
    try {
      const now = new Date();
      this.lastHeartbeat = now;

      await storage.updateAgentStatus({
        lastHeartbeat: now,
      });

      await this.checkAndRecoverIfStale();

      if (this.consecutiveErrors > 0) {
        this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
      }
    } catch (error) {
      log.error("LifecycleManager", "Heartbeat error", {
        error: String(error),
      });
      this.consecutiveErrors++;

      if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        log.warn(
          "LifecycleManager",
          "Too many consecutive errors, triggering self-healing"
        );
        await this.selfHeal();
      }
    }
  }

  /**
   * Detect stale state & trigger recovery
   *
   * Monitors the time since the last analysis cycle and triggers self-healing
   * if the orchestrator appears to be frozen (no analysis in 120+ seconds).
   *
   * @async
   * @returns {Promise<void>}
   *
   * @stale-detection-criteria
   * - Orchestrator is marked as running
   * - Last analysis time exists
   * - Time since last analysis > 120 seconds (STALE_HEARTBEAT_THRESHOLD_MS)
   *
   * @example
   * ```typescript
   * // Called automatically by performHeartbeat()
   * await lifecycleManager.checkAndRecoverIfStale();
   * ```
   */
  async checkAndRecoverIfStale(): Promise<void> {
    const state = this.orchestrator.getState();
    if (!state.isRunning) return;

    const now = Date.now();
    const lastAnalysis = state.lastAnalysisTime?.getTime() || 0;
    const timeSinceAnalysis = now - lastAnalysis;

    if (timeSinceAnalysis > STALE_HEARTBEAT_THRESHOLD_MS && lastAnalysis > 0) {
      log.warn(
        "LifecycleManager",
        `Stale state detected (${Math.round(timeSinceAnalysis / 1000)}s since last analysis)`
      );
      await this.selfHeal();
    }
  }

  /**
   * Self-recovery mechanism
   *
   * Performs a complete restart of the orchestrator to recover from errors or
   * stale state. This is the core self-healing logic that allows the system to
   * recover automatically without manual intervention.
   *
   * @async
   * @returns {Promise<void>}
   *
   * @throws {Error} If self-healing fails (caught and logged)
   *
   * @recovery-process
   * 1. Log self-healing initiation
   * 2. Preserve current auto-start setting
   * 3. Stop orchestrator gracefully (preserve auto-start flag)
   * 4. Wait 5 seconds for cleanup (AUTO_RESTART_DELAY_MS)
   * 5. Reset consecutive error count to 0
   * 6. Clear error state
   * 7. Restart orchestrator if auto-start was enabled
   * 8. Restart heartbeat monitoring
   *
   * @example
   * ```typescript
   * // Manually trigger self-healing
   * await lifecycleManager.selfHeal();
   *
   * // Or let it trigger automatically when errors >= 5
   * ```
   */
  async selfHeal(): Promise<void> {
    log.info("LifecycleManager", "Initiating self-healing...");

    const wasAutoStartEnabled = this.autoStartEnabled;

    try {
      await this.orchestrator.stop(true);

      await new Promise((resolve) =>
        setTimeout(resolve, AUTO_RESTART_DELAY_MS)
      );

      this.consecutiveErrors = 0;
      this.orchestrator.setState({ errors: [] });

      if (wasAutoStartEnabled) {
        await this.orchestrator.start();
        this.startHeartbeat();
        log.info("LifecycleManager", "Self-healing complete - Agent restarted");
      }
    } catch (error) {
      log.error("LifecycleManager", "Self-healing failed", {
        error: String(error),
      });
      const state = this.orchestrator.getState();
      state.errors.push(`Self-healing failed: ${error}`);
    }
  }

  /**
   * Toggle auto-start setting
   *
   * Updates the auto-start flag both in memory and in the database. When disabled,
   * the orchestrator will not automatically restart after self-healing or failures.
   *
   * @async
   * @param {boolean} enabled - Whether to enable auto-start
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * // Disable auto-start temporarily
   * await lifecycleManager.setAutoStartEnabled(false);
   *
   * // Re-enable auto-start
   * await lifecycleManager.setAutoStartEnabled(true);
   * ```
   */
  async setAutoStartEnabled(enabled: boolean): Promise<void> {
    this.autoStartEnabled = enabled;
    await storage.updateAgentStatus({ autoStartEnabled: enabled });
    log.info(
      "LifecycleManager",
      `Auto-start ${enabled ? "enabled" : "disabled"}`
    );
  }

  /**
   * Query auto-start status
   *
   * @returns {boolean} Whether auto-start is currently enabled
   *
   * @example
   * ```typescript
   * if (lifecycleManager.isAutoStartEnabledFlag()) {
   *   console.log('Auto-start is enabled');
   * }
   * ```
   */
  isAutoStartEnabledFlag(): boolean {
    return this.autoStartEnabled;
  }

  /**
   * Return health metrics
   *
   * Provides a comprehensive snapshot of the orchestrator's health including error
   * counts, heartbeat status, and market condition information.
   *
   * @returns {HealthStatus} Complete health status object
   *
   * @health-criteria
   * - isHealthy: false if consecutiveErrors >= 5 OR orchestrator not running
   * - lastHeartbeat: null if heartbeat never ran
   * - consecutiveErrors: triggers self-healing at 5
   * - marketCondition: from market-condition-analyzer (bullish/bearish/neutral/volatile)
   * - dynamicOrderLimit: order limit adjusted for market conditions
   *
   * @example
   * ```typescript
   * const health = lifecycleManager.getHealthStatus();
   * if (!health.isHealthy) {
   *   console.log(`Unhealthy: ${health.consecutiveErrors} consecutive errors`);
   *   console.log(`Last heartbeat: ${health.lastHeartbeat}`);
   * }
   * ```
   */
  getHealthStatus(): HealthStatus {
    const analyzerStatus = marketConditionAnalyzer.getStatus();
    const state = this.orchestrator.getState();
    return {
      isHealthy:
        this.consecutiveErrors < MAX_CONSECUTIVE_ERRORS && state.isRunning,
      lastHeartbeat: this.lastHeartbeat,
      consecutiveErrors: this.consecutiveErrors,
      autoStartEnabled: this.autoStartEnabled,
      marketCondition: analyzerStatus.lastAnalysis?.condition || null,
      dynamicOrderLimit: analyzerStatus.currentOrderLimit,
    };
  }

  /**
   * Get the current consecutive error count
   *
   * @returns {number} Number of consecutive errors (triggers self-healing at 5)
   *
   * @example
   * ```typescript
   * const errorCount = lifecycleManager.getConsecutiveErrors();
   * if (errorCount >= 3) {
   *   console.warn('Error count rising, may trigger self-healing soon');
   * }
   * ```
   */
  getConsecutiveErrors(): number {
    return this.consecutiveErrors;
  }

  /**
   * Get the last heartbeat timestamp
   *
   * @returns {Date | null} Last successful heartbeat time, or null if never ran
   *
   * @example
   * ```typescript
   * const lastBeat = lifecycleManager.getLastHeartbeat();
   * if (lastBeat) {
   *   const secondsSince = (Date.now() - lastBeat.getTime()) / 1000;
   *   console.log(`Last heartbeat: ${secondsSince}s ago`);
   * }
   * ```
   */
  getLastHeartbeat(): Date | null {
    return this.lastHeartbeat;
  }

  /**
   * Check if auto-start is currently in progress
   *
   * Prevents concurrent auto-start attempts which could cause race conditions.
   *
   * @returns {boolean} True if auto-start is currently running
   *
   * @example
   * ```typescript
   * if (lifecycleManager.isAutoStartInProgress()) {
   *   console.log('Auto-start already in progress, please wait');
   * }
   * ```
   */
  isAutoStartInProgress(): boolean {
    return this.isAutoStarting;
  }

  /**
   * Reset error count (useful after manual intervention)
   *
   * Clears the consecutive error count, preventing immediate self-healing.
   * Useful when you've manually fixed an issue and want to give the orchestrator
   * a fresh start.
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * // After manually fixing an issue
   * lifecycleManager.resetErrors();
   * console.log('Error count reset, orchestrator has a clean slate');
   * ```
   */
  resetErrors(): void {
    this.consecutiveErrors = 0;
  }
}
