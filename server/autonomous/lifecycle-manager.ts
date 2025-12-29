/**
 * Lifecycle Manager for Autonomous Orchestrator
 *
 * Handles lifecycle management functions extracted from orchestrator.ts:
 * - Auto-initialization with dependency resolution
 * - Heartbeat/health monitoring
 * - Stale state detection and recovery
 * - Self-healing mechanisms
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
 */
export interface OrchestratorInterface {
  start(): Promise<void>;
  stop(preserveAutoStart?: boolean): Promise<void>;
  getState(): OrchestratorState;
  setState(updates: Partial<OrchestratorState>): void;
  setUserId(userId: string): void;
}

/**
 * Health status returned by getHealthStatus()
 */
export interface HealthStatus {
  isHealthy: boolean;
  lastHeartbeat: Date | null;
  consecutiveErrors: number;
  autoStartEnabled: boolean;
  marketCondition: string | null;
  dynamicOrderLimit: number;
}

/**
 * Manages lifecycle operations for the autonomous orchestrator
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
   * Resolves admin user, checks settings, and starts the orchestrator
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
        log.warn("LifecycleManager", "No admin user found - database operations may fail");
      }

      const agentStatus = await storage.getAgentStatus();
      this.autoStartEnabled = agentStatus?.autoStartEnabled ?? true;

      if (!this.autoStartEnabled) {
        log.info("LifecycleManager", "Auto-start is disabled in settings");
        this.isAutoStarting = false;
        return;
      }

      if (agentStatus?.killSwitchActive) {
        log.warn("LifecycleManager", "Auto-start blocked: Kill switch is active");
        this.isAutoStarting = false;
        return;
      }

      await marketConditionAnalyzer.initialize();

      await this.orchestrator.start();

      this.startHeartbeat();

      log.info("LifecycleManager", "Auto-start complete - Agent is now running persistently");
    } catch (error) {
      log.error("LifecycleManager", "Auto-start failed", { error: String(error) });
      const state = this.orchestrator.getState();
      state.errors.push(`Auto-start failed: ${error}`);

      setTimeout(() => {
        this.isAutoStarting = false;
        this.autoStart().catch(err => {
          log.error("LifecycleManager", "Auto-restart retry failed", { error: String(err) });
        });
      }, AUTO_RESTART_DELAY_MS);
    } finally {
      this.isAutoStarting = false;
    }
  }

  /**
   * Begin health monitoring loop
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
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Periodic health check & error tracking
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
      log.error("LifecycleManager", "Heartbeat error", { error: String(error) });
      this.consecutiveErrors++;

      if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        log.warn("LifecycleManager", "Too many consecutive errors, triggering self-healing");
        await this.selfHeal();
      }
    }
  }

  /**
   * Detect stale state & trigger recovery
   */
  async checkAndRecoverIfStale(): Promise<void> {
    const state = this.orchestrator.getState();
    if (!state.isRunning) return;

    const now = Date.now();
    const lastAnalysis = state.lastAnalysisTime?.getTime() || 0;
    const timeSinceAnalysis = now - lastAnalysis;

    if (timeSinceAnalysis > STALE_HEARTBEAT_THRESHOLD_MS && lastAnalysis > 0) {
      log.warn("LifecycleManager", `Stale state detected (${Math.round(timeSinceAnalysis / 1000)}s since last analysis)`);
      await this.selfHeal();
    }
  }

  /**
   * Self-recovery mechanism
   */
  async selfHeal(): Promise<void> {
    log.info("LifecycleManager", "Initiating self-healing...");

    const wasAutoStartEnabled = this.autoStartEnabled;

    try {
      await this.orchestrator.stop(true);

      await new Promise(resolve => setTimeout(resolve, AUTO_RESTART_DELAY_MS));

      this.consecutiveErrors = 0;
      this.orchestrator.setState({ errors: [] });

      if (wasAutoStartEnabled) {
        await this.orchestrator.start();
        this.startHeartbeat();
        log.info("LifecycleManager", "Self-healing complete - Agent restarted");
      }
    } catch (error) {
      log.error("LifecycleManager", "Self-healing failed", { error: String(error) });
      const state = this.orchestrator.getState();
      state.errors.push(`Self-healing failed: ${error}`);
    }
  }

  /**
   * Toggle auto-start setting
   */
  async setAutoStartEnabled(enabled: boolean): Promise<void> {
    this.autoStartEnabled = enabled;
    await storage.updateAgentStatus({ autoStartEnabled: enabled });
    log.info("LifecycleManager", `Auto-start ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Query auto-start status
   */
  isAutoStartEnabledFlag(): boolean {
    return this.autoStartEnabled;
  }

  /**
   * Return health metrics
   */
  getHealthStatus(): HealthStatus {
    const analyzerStatus = marketConditionAnalyzer.getStatus();
    const state = this.orchestrator.getState();
    return {
      isHealthy: this.consecutiveErrors < MAX_CONSECUTIVE_ERRORS && state.isRunning,
      lastHeartbeat: this.lastHeartbeat,
      consecutiveErrors: this.consecutiveErrors,
      autoStartEnabled: this.autoStartEnabled,
      marketCondition: analyzerStatus.lastAnalysis?.condition || null,
      dynamicOrderLimit: analyzerStatus.currentOrderLimit,
    };
  }

  /**
   * Get the current consecutive error count
   */
  getConsecutiveErrors(): number {
    return this.consecutiveErrors;
  }

  /**
   * Get the last heartbeat timestamp
   */
  getLastHeartbeat(): Date | null {
    return this.lastHeartbeat;
  }

  /**
   * Check if auto-start is currently in progress
   */
  isAutoStartInProgress(): boolean {
    return this.isAutoStarting;
  }

  /**
   * Reset error count (useful after manual intervention)
   */
  resetErrors(): void {
    this.consecutiveErrors = 0;
  }
}
