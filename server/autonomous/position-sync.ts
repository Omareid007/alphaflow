/**
 * Position Sync Module
 *
 * Handles synchronization of positions between the broker (Alpaca) and the orchestrator state.
 * This includes:
 * - Fetching positions from Alpaca
 * - Syncing to database
 * - Applying stop-loss and take-profit rules
 * - Updating trailing stops
 */

import { alpaca } from "../connectors/alpaca";
import { storage } from "../storage";
import { log } from "../utils/logger";
import { safeParseFloat } from "../utils/numeric";
import { percentChange, trailingStopPrice } from "../utils/money";
import {
  PositionWithRules,
  OrchestratorState,
  DEFAULT_HARD_STOP_LOSS_PERCENT,
  DEFAULT_TAKE_PROFIT_PERCENT,
} from "./types";

/**
 * Sync positions from Alpaca broker to the orchestrator state
 *
 * This function:
 * 1. Fetches current positions from Alpaca
 * 2. Syncs to the database (if userId is available)
 * 3. Applies hard stop-loss rules
 * 4. Updates trailing stops for profitable positions
 * 5. Preserves existing position rules where applicable
 *
 * @param state - The orchestrator state to update
 * @param userId - The user ID for database operations (optional)
 */
export async function syncPositionsFromBroker(
  state: OrchestratorState,
  userId: string | null
): Promise<void> {
  try {
    const positions = await alpaca.getPositions();
    const existingPositions = new Map(state.activePositions);
    state.activePositions.clear();

    // Sync to database
    try {
      if (userId) {
        await storage.syncPositionsFromAlpaca(userId, positions);
        log.info(
          "PositionSync",
          `Synced ${positions.length} positions to database`
        );
      }
    } catch (dbError) {
      log.error("PositionSync", "Failed to sync positions to database", {
        error: String(dbError),
      });
    }

    for (const pos of positions) {
      const entryPrice = safeParseFloat(pos.avg_entry_price);
      const currentPrice = safeParseFloat(pos.current_price);

      const existingPos = existingPositions.get(pos.symbol);

      let stopLossPrice = existingPos?.stopLossPrice;
      let takeProfitPrice = existingPos?.takeProfitPrice;
      const trailingStopPercent = existingPos?.trailingStopPercent;

      const hardStopLoss =
        entryPrice * (1 - DEFAULT_HARD_STOP_LOSS_PERCENT / 100);
      const defaultTakeProfit =
        entryPrice * (1 + DEFAULT_TAKE_PROFIT_PERCENT / 100);

      if (!stopLossPrice && entryPrice > 0) {
        stopLossPrice = hardStopLoss;
      }
      if (!takeProfitPrice && entryPrice > 0) {
        takeProfitPrice = defaultTakeProfit;
      }

      // Enforce hard stop-loss floor
      if (stopLossPrice && stopLossPrice < hardStopLoss && entryPrice > 0) {
        log.info(
          "PositionSync",
          `Enforcing hard stop-loss for ${pos.symbol}: $${stopLossPrice.toFixed(2)} -> $${hardStopLoss.toFixed(2)}`
        );
        stopLossPrice = hardStopLoss;
      }

      // Update trailing stop if position is profitable
      if (existingPos?.trailingStopPercent && currentPrice > entryPrice) {
        const profitPercent = percentChange(
          currentPrice,
          entryPrice
        ).toNumber();
        if (profitPercent > 5) {
          const newStopLoss = trailingStopPrice(
            currentPrice,
            existingPos.trailingStopPercent
          ).toNumber();
          if (!stopLossPrice || newStopLoss > stopLossPrice) {
            stopLossPrice = newStopLoss;
            log.info(
              "PositionSync",
              `Trailing stop updated for ${pos.symbol}: $${stopLossPrice.toFixed(2)}`
            );
          }
        }
      }

      const totalQty = safeParseFloat(pos.qty);
      const availableQty = safeParseFloat(pos.qty_available);

      const positionWithRules: PositionWithRules = {
        symbol: pos.symbol,
        quantity: totalQty,
        availableQuantity: availableQty,
        entryPrice,
        currentPrice,
        unrealizedPnl: safeParseFloat(pos.unrealized_pl),
        unrealizedPnlPercent: safeParseFloat(pos.unrealized_plpc) * 100,
        openedAt: existingPos?.openedAt || new Date(),
        stopLossPrice,
        takeProfitPrice,
        trailingStopPercent,
        strategyId: existingPos?.strategyId,
      };

      state.activePositions.set(pos.symbol, positionWithRules);
    }

    log.info(
      "PositionSync",
      `Synced ${positions.length} positions from broker`
    );
  } catch (error) {
    log.error("PositionSync", "Failed to sync positions", {
      error: String(error),
    });
    state.errors.push(`Position sync failed: ${error}`);
  }
}
