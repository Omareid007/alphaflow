/**
 * Orchestrator Controller
 *
 * Manages orchestrator-based trading control mode, which is a security feature
 * that restricts autonomous trading to only work queue-authorized trades.
 *
 * When orchestrator control is enabled:
 * - Only trades with `authorizedByOrchestrator: true` are allowed
 * - Prevents unauthorized AI-driven trades from executing
 * - Provides a kill-switch mechanism for autonomous trading
 *
 * SECURITY IMPLICATIONS:
 * - This is a critical security control for preventing rogue AI trading
 * - When enabled, all autonomous trading strategies are effectively disabled
 * - Only manually queued trades (via work queue) can execute
 * - Helps prevent bypass attacks through notes manipulation or other vectors
 *
 * @module orchestrator-controller
 */

import { log } from "../utils/logger";

/**
 * Controls orchestrator-based trading authorization
 *
 * This singleton class manages the orchestrator control mode, which acts as
 * a security gate for autonomous trading. When enabled, it ensures that only
 * trades explicitly authorized by the work queue processor can execute.
 *
 * @class OrchestratorController
 *
 * @example
 * ```typescript
 * import { orchestratorController } from './orchestrator-controller';
 *
 * // Enable strict control mode
 * orchestratorController.enableOrchestratorControl();
 *
 * // Check before executing a trade
 * if (orchestratorController.isOrchestratorControlEnabled()) {
 *   if (!tradeRequest.authorizedByOrchestrator) {
 *     throw new Error("Unauthorized trade - orchestrator approval required");
 *   }
 * }
 *
 * // Disable control mode to allow autonomous trading
 * orchestratorController.disableOrchestratorControl();
 * ```
 */
class OrchestratorController {
  private orchestratorControlEnabled: boolean = false;

  /**
   * Enables orchestrator control mode
   *
   * When enabled, only trades with authorizedByOrchestrator=true can execute.
   * This effectively disables all autonomous trading strategies and requires
   * manual approval through the work queue system.
   *
   * SECURITY: Use this to prevent rogue AI trading or as an emergency stop mechanism.
   *
   * @example
   * ```typescript
   * // Emergency: stop all autonomous trading
   * orchestratorController.enableOrchestratorControl();
   * ```
   */
  enableOrchestratorControl(): void {
    this.orchestratorControlEnabled = true;
    log.info(
      "OrchestratorController",
      "Orchestrator control ENABLED - autonomous trading disabled"
    );
  }

  /**
   * Disables orchestrator control mode
   *
   * When disabled, autonomous trading strategies can execute trades without
   * explicit work queue authorization. The authorizedByOrchestrator flag
   * is not checked.
   *
   * @example
   * ```typescript
   * // Allow autonomous trading to resume
   * orchestratorController.disableOrchestratorControl();
   * ```
   */
  disableOrchestratorControl(): void {
    this.orchestratorControlEnabled = false;
    log.info(
      "OrchestratorController",
      "Orchestrator control DISABLED - autonomous trading allowed"
    );
  }

  /**
   * Checks whether orchestrator control is currently enabled
   *
   * @returns True if orchestrator control is enabled, false otherwise
   *
   * @example
   * ```typescript
   * if (orchestratorController.isOrchestratorControlEnabled()) {
   *   // Require authorization for trades
   *   validateTradeAuthorization(tradeRequest);
   * }
   * ```
   */
  isOrchestratorControlEnabled(): boolean {
    return this.orchestratorControlEnabled;
  }
}

/**
 * Singleton instance of the orchestrator controller
 *
 * This instance is shared across the entire application to maintain
 * consistent orchestrator control state.
 *
 * @example
 * ```typescript
 * import { orchestratorController } from './orchestrator-controller';
 *
 * orchestratorController.enableOrchestratorControl();
 * const isEnabled = orchestratorController.isOrchestratorControlEnabled();
 * ```
 */
export const orchestratorController = new OrchestratorController();
