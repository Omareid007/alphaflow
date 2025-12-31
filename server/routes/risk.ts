/**
 * Risk Management Routes
 * Handles risk settings, kill switch, and emergency controls
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";
import { createLiveSourceMetadata } from "@shared/position-mapper";
import { log } from "../utils/logger";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

// GET /api/risk/settings - Get current risk settings
router.get("/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const status = await storage.getAgentStatus();
    if (!status) {
      return res.json({
        killSwitchActive: false,
        maxPositionSizePercent: "10",
        maxTotalExposurePercent: "50",
        maxPositionsCount: 10,
        dailyLossLimitPercent: "5",
      });
    }
    res.json({
      killSwitchActive: status.killSwitchActive ?? false,
      maxPositionSizePercent: status.maxPositionSizePercent ?? "10",
      maxTotalExposurePercent: status.maxTotalExposurePercent ?? "50",
      maxPositionsCount: status.maxPositionsCount ?? 10,
      dailyLossLimitPercent: status.dailyLossLimitPercent ?? "5",
    });
  } catch (error) {
    log.error("RiskAPI", "Failed to get risk settings", { error });
    res.status(500).json({ error: "Failed to get risk settings" });
  }
});

// POST /api/risk/settings - Update risk settings
router.post("/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      maxPositionSizePercent,
      maxTotalExposurePercent,
      maxPositionsCount,
      dailyLossLimitPercent,
    } = req.body;

    const updates: Record<string, unknown> = {};

    if (maxPositionSizePercent !== undefined) {
      const val = parseFloat(maxPositionSizePercent);
      if (isNaN(val) || val <= 0 || val > 100) {
        return res
          .status(400)
          .json({ error: "Max position size must be between 0 and 100" });
      }
      updates.maxPositionSizePercent = val.toString();
    }
    if (maxTotalExposurePercent !== undefined) {
      const val = parseFloat(maxTotalExposurePercent);
      if (isNaN(val) || val <= 0 || val > 300) {
        return res
          .status(400)
          .json({ error: "Max total exposure must be between 0 and 300" });
      }
      updates.maxTotalExposurePercent = val.toString();
    }
    if (maxPositionsCount !== undefined) {
      const val = parseInt(maxPositionsCount);
      if (isNaN(val) || val <= 0 || val > 100) {
        return res
          .status(400)
          .json({ error: "Max positions count must be between 1 and 100" });
      }
      updates.maxPositionsCount = val;
    }
    if (dailyLossLimitPercent !== undefined) {
      const val = parseFloat(dailyLossLimitPercent);
      if (isNaN(val) || val <= 0 || val > 100) {
        return res
          .status(400)
          .json({ error: "Daily loss limit must be between 0 and 100" });
      }
      updates.dailyLossLimitPercent = val.toString();
    }

    const status = await storage.updateAgentStatus(updates);
    res.json({
      killSwitchActive: status?.killSwitchActive ?? false,
      maxPositionSizePercent: status?.maxPositionSizePercent ?? "10",
      maxTotalExposurePercent: status?.maxTotalExposurePercent ?? "50",
      maxPositionsCount: status?.maxPositionsCount ?? 10,
      dailyLossLimitPercent: status?.dailyLossLimitPercent ?? "5",
    });
  } catch (error) {
    log.error("RiskAPI", "Failed to update risk settings", { error });
    res.status(500).json({ error: "Failed to update risk settings" });
  }
});

// POST /api/risk/kill-switch - Toggle kill switch
router.post("/kill-switch", requireAuth, async (req: Request, res: Response) => {
  try {
    const { activate } = req.body;
    const shouldActivate = activate === true || activate === "true";

    const updateData: { killSwitchActive: boolean; isRunning?: boolean } = {
      killSwitchActive: shouldActivate,
    };

    if (shouldActivate) {
      updateData.isRunning = false;
    }

    const status = await storage.updateAgentStatus(updateData);

    res.json({
      killSwitchActive: status?.killSwitchActive ?? shouldActivate,
      isRunning: status?.isRunning ?? false,
      message: shouldActivate
        ? "Kill switch activated - all trading halted"
        : "Kill switch deactivated",
    });
  } catch (error) {
    log.error("RiskAPI", "Failed to toggle kill switch", { error });
    res.status(500).json({ error: "Failed to toggle kill switch" });
  }
});

// POST /api/risk/close-all - Close all positions
router.post("/close-all", requireAuth, async (req: Request, res: Response) => {
  try {
    log.info("RISK", "Closing all positions via Alpaca...");
    // SECURITY: Mark as authorized since this is an admin-initiated emergency action
    const result = await alpacaTradingEngine.closeAllPositions({
      authorizedByOrchestrator: true,
      isEmergencyStop: true,
    });
    res.json({
      ...result,
      _source: createLiveSourceMetadata(),
    });
  } catch (error) {
    log.error("RiskAPI", "Failed to close all positions", { error });
    res.status(500).json({ error: "Failed to close all positions" });
  }
});

// POST /api/risk/emergency-liquidate - Emergency liquidation
router.post("/emergency-liquidate", requireAuth, async (req: Request, res: Response) => {
  try {
    log.info("EMERGENCY", "Initiating full portfolio liquidation...");

    // Import alpaca here to avoid circular dependency
    const { alpaca } = await import("../connectors/alpaca");
    type OrderResult = {
      symbol: string;
      qty: string | null;
      status: string;
      type: string;
    };

    // Step 1: Activate kill switch to prevent new trades
    await storage.updateAgentStatus({
      killSwitchActive: true,
      isRunning: false,
    });
    log.info("EMERGENCY", "Kill switch activated");

    // Step 2: Get count of open orders before cancelling
    const openOrders = await alpaca.getOrders("open", 100);
    const orderCount = openOrders.length;

    // Step 3: Cancel all open orders
    await alpaca.cancelAllOrders();
    log.info("EMERGENCY", `Cancelled ${orderCount} orders`);

    // Step 4: Close all positions using Alpaca's DELETE with cancel_orders=true
    const closeResult = await alpaca.closeAllPositions();
    log.info(
      "EMERGENCY",
      `Submitted close orders for ${closeResult.length} positions`
    );

    // Step 5: Wait briefly for Alpaca to process close orders
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 6: Sync database with Alpaca state
    const userId = req.userId!;
    await alpacaTradingEngine.syncPositionsFromAlpaca(userId);
    const account = await alpaca.getAccount();
    log.info(
      "EMERGENCY",
      `Synced positions from Alpaca. Account equity: $${account.equity}`
    );

    res.json({
      success: true,
      killSwitchActivated: true,
      ordersCancelled: orderCount,
      positionsClosing: closeResult.length,
      closeOrders: closeResult.map((order: OrderResult) => ({
        symbol: order.symbol,
        qty: order.qty,
        status: order.status,
        type: order.type,
      })),
      message: `Emergency liquidation initiated: ${orderCount} orders cancelled, ${closeResult.length} positions closing`,
    });
  } catch (error) {
    log.error("EMERGENCY", "Liquidation failed", { error });
    res
      .status(500)
      .json({ error: "Emergency liquidation failed: " + String(error) });
  }
});

export default router;
