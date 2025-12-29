/**
 * @file Rebalancing Manager
 *
 * Advanced portfolio rebalancing system with three complementary strategies designed
 * to maintain balanced exposure, capitalize on dips, and pyramid into winners. Each
 * strategy serves a specific purpose in the portfolio management lifecycle.
 *
 * @module autonomous/rebalancing-manager
 *
 * @strategies
 *
 * 1. DRIFT REBALANCING
 *    Purpose: Maintain target allocation percentages across all positions
 *    - Sells overweight positions (drift > +2%) back to target
 *    - Buys underweight positions (drift < -3%) only if at loss/breakeven
 *    - Uses position.availableQuantity to avoid conflicts with pending orders
 *    - Implements 5-minute cooldown after failed orders to prevent retry loops
 *
 * 2. BUY-THE-DIP
 *    Purpose: Add to losing positions during temporary dips
 *    - Triggers: Position drift < -3% AND unrealizedPnlPercent <= 0
 *    - Requirements: Symbol must be in approved candidates list
 *    - Limits: Min $50, Max 2% of portfolio per trade
 *    - Uses buying power (not cash) for margin accounts
 *    - Reserves 10% of buying power as safety buffer
 *
 * 3. PYRAMID-UP
 *    Purpose: Add to winning positions in the profit sweet spot
 *    - Triggers: Position profit between 5-20%
 *    - Add amount: 50% of original position value
 *    - Requirements: Symbol in approved list, sufficient cash
 *    - Limits: Max 5% of portfolio per pyramid trade
 *    - One pyramid per symbol per cycle to prevent overexposure
 *
 * @rebalancing-philosophy
 * The three strategies work together:
 * - Drift: Maintains discipline and prevents concentration risk
 * - Buy-the-dip: Averages down on quality positions during dips
 * - Pyramid-up: Scales into winners while they're in profit zone
 *
 * @example
 * ```typescript
 * const rebalancingManager = new RebalancingManager(orchestrator, riskLimits);
 *
 * // Run all three strategies
 * await rebalancingManager.rebalancePositions();
 * // Drift rebalancing executes first, then pyramid-up
 *
 * // Check cooldown status
 * if (rebalancingManager.isOnCooldown('AAPL')) {
 *   const remaining = rebalancingManager.getCooldownRemaining('AAPL');
 *   console.log(`AAPL on cooldown for ${remaining / 1000}s`);
 * }
 * ```
 */

import { alpaca } from "../connectors/alpaca";
import { log } from "../utils/logger";
import { queueOrderExecution } from "./order-queue";
import { preTradeGuard } from "./pre-trade-guard";
import { candidatesService } from "../universe/candidatesService";
import { isCryptoSymbol, normalizeCryptoSymbol } from "./crypto-utils";
import { safeParseFloat } from "../utils/numeric";
import { toDecimal } from "../utils/money";
import type {
  OrchestratorState,
  RiskLimits,
  PositionWithRules,
  ExecutionResult,
} from "./types";
import type { AIDecision } from "../ai/decision-engine";

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Reference to orchestrator state and methods needed for rebalancing
 */
export interface OrchestratorReference {
  state: OrchestratorState;
  currentTraceId: string | null;
  syncPositionsFromBroker(): Promise<void>;
  closePosition(
    symbol: string,
    decision: AIDecision,
    position: PositionWithRules,
    partialPercent?: number
  ): Promise<ExecutionResult>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Cooldown period after a failed order to prevent infinite retry loops */
const ORDER_COOLDOWN_MS = 300000; // 5 minutes

// Drift rebalancing thresholds
const REBALANCE_THRESHOLD_PERCENT = 2; // +-2% drift triggers rebalancing
const BUY_THE_DIP_THRESHOLD_PERCENT = 3; // -3% drift triggers buy-the-dip
const MIN_CASH_RESERVE_PERCENT = 10;

// Buy-the-dip limits
const MIN_BUY_VALUE = 50;
const MAX_BUY_PERCENT_OF_PORTFOLIO = 0.02; // 2% max per trade

// Pyramid-up thresholds
const PYRAMID_MIN_PROFIT_PERCENT = 5; // Start pyramiding at 5% profit
const PYRAMID_MAX_PROFIT_PERCENT = 20; // Stop pyramiding above 20% (take profit instead)
const PYRAMID_POSITION_MULTIPLIER = 0.5; // 50% of original position
const PYRAMID_MAX_PORTFOLIO_PERCENT = 0.05; // Max 5% of portfolio per pyramid

// ============================================================================
// REBALANCING MANAGER CLASS
// ============================================================================

/**
 * Manages portfolio rebalancing with drift correction, buy-the-dip, and pyramid-up strategies
 *
 * Coordinates three rebalancing strategies that work together to maintain portfolio
 * balance, capitalize on temporary dips, and scale into winning positions. Implements
 * cooldown logic to prevent order retry loops.
 *
 * @class
 *
 * @architecture
 * - Uses dependency injection for orchestrator reference
 * - Maintains cooldown map to track failed order attempts
 * - Accesses orchestrator state for positions and portfolio value
 * - Coordinates with candidatesService for approved symbol list
 *
 * @example
 * ```typescript
 * const rebalancingManager = new RebalancingManager(
 *   orchestrator,
 *   { maxPositionSizePercent: 10, maxTotalExposurePercent: 80 }
 * );
 * ```
 */
export class RebalancingManager {
  private orchestrator: OrchestratorReference;
  private riskLimits: RiskLimits;
  private orderCooldowns: Map<string, number> = new Map();

  constructor(orchestrator: OrchestratorReference, riskLimits: RiskLimits) {
    this.orchestrator = orchestrator;
    this.riskLimits = riskLimits;
  }

  /**
   * Get the active positions from orchestrator state
   */
  private get activePositions(): Map<string, PositionWithRules> {
    return this.orchestrator.state.activePositions;
  }

  /**
   * Get the current trace ID from orchestrator
   */
  private get currentTraceId(): string | null {
    return this.orchestrator.currentTraceId;
  }

  /**
   * Main rebalancing method that coordinates all three strategies
   *
   * Orchestrates the complete rebalancing workflow, executing drift correction
   * and pyramid-up strategies. Syncs positions from broker first to ensure accuracy.
   *
   * @async
   * @returns {Promise<void>}
   *
   * @throws {Error} Caught and logged if rebalancing fails
   *
   * @execution-order
   * 1. Sync positions from broker (prevents quantity mismatches)
   * 2. Get account data (portfolio value, buying power, cash)
   * 3. Update orchestrator state with actual portfolio value
   * 4. Get approved symbols from candidatesService
   * 5. Execute drift rebalancing (sell overweight, buy underweight)
   * 6. Execute pyramid-up (add to winners in 5-20% profit zone)
   *
   * @example
   * ```typescript
   * await rebalancingManager.rebalancePositions();
   * // All three strategies have been evaluated and executed
   * ```
   */
  async rebalancePositions(): Promise<void> {
    try {
      // CRITICAL: Sync positions from Alpaca FIRST to ensure we have accurate data
      // This prevents quantity mismatches where system thinks we have more shares than reality
      await this.orchestrator.syncPositionsFromBroker();

      const account = await alpaca.getAccount();
      const portfolioValue = parseFloat(account.portfolio_value);

      // CRITICAL FIX: Update state with actual portfolio value to prevent fallback to 100000
      this.orchestrator.state.portfolioValue = portfolioValue;

      // CRITICAL: Use buying_power for margin accounts, NOT cash
      // Cash can be negative while buying_power is positive (margin utilization)
      const buyingPower = safeParseFloat(account.buying_power);
      const availableCash = safeParseFloat(account.cash);

      if (portfolioValue <= 0) {
        log.warn(
          "RebalancingManager",
          "Cannot rebalance: invalid portfolio value"
        );
        return;
      }

      const targetAllocationPercent = this.riskLimits.maxPositionSizePercent;

      log.debug(
        "RebalancingManager",
        `Account status: cash=${availableCash.toFixed(2)}, buyingPower=${buyingPower.toFixed(2)}, portfolioValue=${portfolioValue.toFixed(2)}`
      );

      const approvedSymbols = await candidatesService.getApprovedSymbols();
      const approvedSet = new Set(approvedSymbols.map((s) => s.toUpperCase()));

      // Execute drift rebalancing and buy-the-dip
      await this.executeDriftRebalancing(
        portfolioValue,
        buyingPower,
        availableCash,
        targetAllocationPercent,
        approvedSet
      );

      // Execute pyramid-up strategy for winning positions
      await this.executePyramidUp(portfolioValue, availableCash, approvedSet);
    } catch (error) {
      log.error("RebalancingManager", "Rebalancing error", {
        error: String(error),
      });
      this.orchestrator.state.errors.push(`Rebalancing failed: ${error}`);
    }
  }

  /**
   * Drift Rebalancing Strategy (lines 2277-2390)
   *
   * Handles two scenarios:
   * 1. Overweight positions (drift > +2%): Sell excess shares
   * 2. Underweight positions (drift < -3%): Buy-the-dip if at loss/breakeven
   */
  private async executeDriftRebalancing(
    portfolioValue: number,
    buyingPower: number,
    availableCash: number,
    targetAllocationPercent: number,
    approvedSet: Set<string>
  ): Promise<void> {
    for (const [symbol, position] of this.activePositions.entries()) {
      const positionValue = position.currentPrice * position.quantity;
      const currentAllocationPercent = (positionValue / portfolioValue) * 100;
      const drift = currentAllocationPercent - targetAllocationPercent;

      if (Math.abs(drift) > REBALANCE_THRESHOLD_PERCENT) {
        log.info(
          "RebalancingManager",
          `Position ${symbol} drifted by ${drift.toFixed(2)}%`
        );

        // Check for cooldown to prevent infinite retry loops
        const cooldownUntil = this.orderCooldowns.get(symbol);
        if (cooldownUntil && Date.now() < cooldownUntil) {
          const remainingMs = cooldownUntil - Date.now();
          log.info(
            "RebalancingManager",
            `Skipping ${symbol}: on cooldown for ${Math.round(remainingMs / 1000)}s after failed order`
          );
          continue;
        }

        if (drift > REBALANCE_THRESHOLD_PERCENT) {
          // Overweight - sell excess shares
          await this.handleOverweightPosition(
            symbol,
            position,
            portfolioValue,
            targetAllocationPercent,
            drift
          );
        } else if (drift < -BUY_THE_DIP_THRESHOLD_PERCENT) {
          // Underweight - buy-the-dip
          await this.handleBuyTheDip(
            symbol,
            position,
            portfolioValue,
            buyingPower,
            targetAllocationPercent,
            approvedSet
          );
        }
      }
    }
  }

  /**
   * Handle overweight position by selling excess shares (lines 2293-2335)
   */
  private async handleOverweightPosition(
    symbol: string,
    position: PositionWithRules,
    portfolioValue: number,
    targetAllocationPercent: number,
    drift: number
  ): Promise<void> {
    const positionValue = position.currentPrice * position.quantity;
    const excessValue =
      positionValue - (portfolioValue * targetAllocationPercent) / 100;
    let sharesToSell = Math.floor(excessValue / position.currentPrice);

    const availableShares = Math.floor(position.availableQuantity);
    if (availableShares <= 0) {
      log.warn(
        "RebalancingManager",
        `Skipping rebalance for ${symbol}: no available shares (${position.availableQuantity} available, ${position.quantity - position.availableQuantity} held for orders)`
      );
      return;
    }

    if (sharesToSell > availableShares) {
      log.info(
        "RebalancingManager",
        `Limiting rebalance for ${symbol}: requested ${sharesToSell} but only ${availableShares} available`
      );
      sharesToSell = availableShares;
    }

    if (sharesToSell > 0 && sharesToSell < position.quantity) {
      log.info(
        "RebalancingManager",
        `Rebalancing: Selling ${sharesToSell} shares of ${symbol} (${availableShares} available)`
      );
      try {
        const result = await this.orchestrator.closePosition(
          symbol,
          {
            action: "sell",
            confidence: 0.8,
            reasoning: `Rebalancing: Position overweight by ${drift.toFixed(1)}%`,
            riskLevel: "low",
          },
          position,
          (sharesToSell / position.quantity) * 100
        );

        // Set cooldown on failure to prevent infinite retry loops
        if (!result.success) {
          log.warn(
            "RebalancingManager",
            `Setting ${ORDER_COOLDOWN_MS / 1000}s cooldown for ${symbol} after failed order: ${result.reason}`
          );
          this.orderCooldowns.set(symbol, Date.now() + ORDER_COOLDOWN_MS);
        } else {
          // Clear cooldown on success
          this.orderCooldowns.delete(symbol);
        }
      } catch (error: any) {
        log.error(
          "RebalancingManager",
          `Rebalance sell failed for ${symbol}: ${error.message}`
        );
        this.orderCooldowns.set(symbol, Date.now() + ORDER_COOLDOWN_MS);
      }
    }
  }

  /**
   * Handle buy-the-dip for underweight positions (lines 2336-2388)
   *
   * Requirements:
   * - Drift < -3%
   * - Symbol must be in approved candidates
   * - Min $50, Max 2% of portfolio
   * - Only buy at loss or breakeven (unrealizedPnlPercent <= 0)
   */
  private async handleBuyTheDip(
    symbol: string,
    position: PositionWithRules,
    portfolioValue: number,
    buyingPower: number,
    targetAllocationPercent: number,
    approvedSet: Set<string>
  ): Promise<void> {
    if (!approvedSet.has(symbol.toUpperCase())) {
      log.info(
        "RebalancingManager",
        `Skipping buy-the-dip for ${symbol}: not in approved candidates`
      );
      return;
    }

    // Use buying_power for margin accounts - allows trading even with negative cash
    // Alpaca will handle the actual buying power validation at order time
    const buyingPowerReserve = buyingPower * (MIN_CASH_RESERVE_PERCENT / 100);
    const availableForBuying = Math.max(0, buyingPower - buyingPowerReserve);

    if (availableForBuying <= 0 && buyingPower <= 0) {
      log.info(
        "RebalancingManager",
        `Skipping buy-the-dip for ${symbol}: no buying power (${buyingPower.toFixed(2)} available)`
      );
      return;
    }

    const positionValue = position.currentPrice * position.quantity;
    const deficitValue =
      (portfolioValue * targetAllocationPercent) / 100 - positionValue;
    // Use buyingPower for margin accounts, cap at 2% of portfolio per trade
    const buyValue = Math.min(
      deficitValue,
      Math.max(availableForBuying, buyingPower * 0.1),
      portfolioValue * MAX_BUY_PERCENT_OF_PORTFOLIO
    );

    if (buyValue >= MIN_BUY_VALUE && position.unrealizedPnlPercent <= 0) {
      log.info(
        "RebalancingManager",
        `Buy-the-dip: Adding $${buyValue.toFixed(2)} to underweight ${symbol} (at ${position.unrealizedPnlPercent.toFixed(1)}% loss)`
      );

      const isCrypto = isCryptoSymbol(symbol);
      const brokerSymbol = isCrypto ? normalizeCryptoSymbol(symbol) : symbol;

      try {
        const preCheck = await preTradeGuard(symbol, "buy", buyValue, isCrypto);
        if (!preCheck.canTrade) {
          log.warn(
            "RebalancingManager",
            `Buy-the-dip blocked for ${symbol}: ${preCheck.reason}`
          );
          return;
        }

        await queueOrderExecution({
          orderParams: {
            symbol: brokerSymbol,
            side: "buy",
            type: preCheck.useLimitOrder ? "limit" : "market",
            notional: buyValue.toFixed(2),
            time_in_force: "day",
            extended_hours: preCheck.useExtendedHours,
            ...(preCheck.limitPrice && {
              limit_price: preCheck.limitPrice.toString(),
            }),
          },
          traceId: this.currentTraceId,
          symbol,
          side: "buy",
        });

        log.trade(`Buy-the-dip: ${symbol} $${buyValue.toFixed(2)}`, {
          symbol,
          value: buyValue,
        });
      } catch (error) {
        log.error("RebalancingManager", `Buy-the-dip failed for ${symbol}`, {
          error: String(error),
        });
      }
    }
  }

  /**
   * Pyramid-Up Strategy (lines 2393-2463)
   *
   * Add to winning positions when:
   * - Position is at 5-20% profit (sweet spot)
   * - Symbol is in approved list
   * - Sufficient cash available
   * - Add 50% of original position value
   */
  private async executePyramidUp(
    portfolioValue: number,
    availableCash: number,
    approvedSet: Set<string>
  ): Promise<void> {
    const pyramidedThisCycle = new Set<string>();

    for (const [symbol, position] of this.activePositions.entries()) {
      // Skip if already pyramided this cycle or not in approved list
      if (
        pyramidedThisCycle.has(symbol) ||
        !approvedSet.has(symbol.toUpperCase())
      ) {
        continue;
      }

      // Check if position is in the profitable sweet spot for pyramid-up
      if (
        position.unrealizedPnlPercent >= PYRAMID_MIN_PROFIT_PERCENT &&
        position.unrealizedPnlPercent <= PYRAMID_MAX_PROFIT_PERCENT
      ) {
        const cashReserve = portfolioValue * (MIN_CASH_RESERVE_PERCENT / 100);
        const availableForBuying = Math.max(0, availableCash - cashReserve);

        if (availableForBuying <= MIN_BUY_VALUE) {
          continue; // Not enough cash
        }

        // Calculate 50% of original position value as pyramid amount
        const originalPositionValue = toDecimal(position.quantity)
          .times(position.entryPrice)
          .toNumber();
        const pyramidValue = Math.min(
          originalPositionValue * PYRAMID_POSITION_MULTIPLIER, // 50% of original position
          availableForBuying,
          portfolioValue * PYRAMID_MAX_PORTFOLIO_PERCENT // Max 5% of portfolio per pyramid
        );

        if (pyramidValue >= MIN_BUY_VALUE) {
          log.info(
            "RebalancingManager",
            `Pyramid-up: Adding $${pyramidValue.toFixed(2)} (50% of original) to winning ${symbol} (at +${position.unrealizedPnlPercent.toFixed(1)}%)`
          );

          const isCrypto = isCryptoSymbol(symbol);
          const brokerSymbol = isCrypto
            ? normalizeCryptoSymbol(symbol)
            : symbol;

          try {
            const preCheck = await preTradeGuard(
              symbol,
              "buy",
              pyramidValue,
              isCrypto
            );
            if (!preCheck.canTrade) {
              log.warn(
                "RebalancingManager",
                `Pyramid-up blocked for ${symbol}: ${preCheck.reason}`
              );
              continue;
            }

            await queueOrderExecution({
              orderParams: {
                symbol: brokerSymbol,
                side: "buy",
                type: preCheck.useLimitOrder ? "limit" : "market",
                notional: pyramidValue.toFixed(2),
                time_in_force: "day",
                extended_hours: preCheck.useExtendedHours,
                ...(preCheck.limitPrice && {
                  limit_price: preCheck.limitPrice.toString(),
                }),
              },
              traceId: this.currentTraceId,
              symbol,
              side: "buy",
            });

            pyramidedThisCycle.add(symbol);
            log.trade(
              `Pyramid-up: ${symbol} $${pyramidValue.toFixed(2)} (+${position.unrealizedPnlPercent.toFixed(1)}%)`,
              {
                symbol,
                value: pyramidValue,
                profitPercent: position.unrealizedPnlPercent,
              }
            );
          } catch (error) {
            log.error("RebalancingManager", `Pyramid-up failed for ${symbol}`, {
              error: String(error),
            });
          }
        }
      }
    }
  }

  /**
   * Clear cooldown for a specific symbol
   */
  clearCooldown(symbol: string): void {
    this.orderCooldowns.delete(symbol);
  }

  /**
   * Clear all cooldowns
   */
  clearAllCooldowns(): void {
    this.orderCooldowns.clear();
  }

  /**
   * Check if a symbol is on cooldown
   */
  isOnCooldown(symbol: string): boolean {
    const cooldownUntil = this.orderCooldowns.get(symbol);
    if (!cooldownUntil) return false;
    return Date.now() < cooldownUntil;
  }

  /**
   * Get remaining cooldown time in milliseconds
   */
  getCooldownRemaining(symbol: string): number {
    const cooldownUntil = this.orderCooldowns.get(symbol);
    if (!cooldownUntil) return 0;
    return Math.max(0, cooldownUntil - Date.now());
  }
}
