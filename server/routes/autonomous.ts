import type { Express, Request, Response } from "express";
import { orchestrator } from "../autonomous/orchestrator";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";
import { storage } from "../storage";
import { alpaca } from "../connectors/alpaca";
import { eventBus, logger, coordinator } from "../orchestration";
import { log } from "../utils/logger";

/**
 * Autonomous Trading Routes
 *
 * This module handles all autonomous trading and orchestration endpoints
 * including:
 * - Autonomous mode control (start/stop)
 * - Risk limit management
 * - Kill switch activation
 * - Position management and reconciliation
 * - Order management and execution
 * - Execution history tracking
 * - Orchestration status and configuration
 */

export function registerAutonomousRoutes(app: Express, authMiddleware: any) {
  // ==================== AUTONOMOUS STATE MANAGEMENT ====================

  /**
   * GET /api/autonomous/state
   * Get the current state of the autonomous trading system
   */
  app.get("/api/autonomous/state", authMiddleware, async (req, res) => {
    try {
      const state = orchestrator.getState();
      const riskLimits = orchestrator.getRiskLimits();
      res.json({
        ...state,
        riskLimits,
        activePositions: Array.from(state.activePositions.entries()).map(([key, pos]) => ({
          ...pos,
          symbol: key,
        })),
        pendingSignals: Array.from(state.pendingSignals.entries()).map(([symbol, signal]) => ({
          symbol,
          ...signal,
        })),
      });
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to get autonomous state", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to get autonomous state" });
    }
  });

  /**
   * GET /api/autonomous/status
   * Get the autonomous trading status with runtime statistics
   */
  app.get("/api/autonomous/status", authMiddleware, async (req, res) => {
    try {
      const status = await storage.getAgentStatus();

      if (!status) {
        return res.json({
          isRunning: false,
          killSwitchActive: false,
          lastRunTime: null,
          consecutiveErrors: 0,
          activePositions: 0,
          recentDecisions: 0,
          lastDecisionTime: null,
          config: {},
        });
      }

      // Get additional runtime stats
      const userId = req.userId!;
      const recentDecisions = await storage.getAiDecisions(userId, 10);
      const positions = await storage.getPositions(userId);

      res.json({
        isRunning: status.isRunning,
        killSwitchActive: status.killSwitchActive,
        lastRunTime: status.lastHeartbeat, // Use lastHeartbeat as lastRunTime
        consecutiveErrors: 0, // Not tracked in schema, default to 0
        activePositions: positions.length,
        recentDecisions: recentDecisions.length,
        lastDecisionTime: recentDecisions[0]?.createdAt || null,
        config: {
          maxPositionSizePercent: status.maxPositionSizePercent,
          maxTotalExposurePercent: status.maxTotalExposurePercent,
          maxPositionsCount: status.maxPositionsCount,
          dailyLossLimitPercent: status.dailyLossLimitPercent,
          autoExecuteTrades: status.autoExecuteTrades,
          conservativeMode: status.conservativeMode,
        },
      });
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to get autonomous status", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to get autonomous status" });
    }
  });

  // ==================== AUTONOMOUS CONTROL ENDPOINTS ====================

  /**
   * POST /api/autonomous/start
   * Start the autonomous trading mode
   */
  app.post("/api/autonomous/start", authMiddleware, async (req, res) => {
    try {
      await orchestrator.start();
      const state = orchestrator.getState();
      res.json({ success: true, mode: state.mode, isRunning: state.isRunning });
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to start autonomous mode", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/autonomous/stop
   * Stop the autonomous trading mode
   */
  app.post("/api/autonomous/stop", authMiddleware, async (req, res) => {
    try {
      await orchestrator.stop();
      const state = orchestrator.getState();
      res.json({ success: true, mode: state.mode, isRunning: state.isRunning });
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to stop autonomous mode", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to stop autonomous mode" });
    }
  });

  /**
   * POST /api/autonomous/mode
   * Set the trading mode (autonomous, semi-auto, or manual)
   */
  app.post("/api/autonomous/mode", authMiddleware, async (req, res) => {
    try {
      const { mode } = req.body;
      if (!["autonomous", "semi-auto", "manual"].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Use: autonomous, semi-auto, or manual" });
      }
      await orchestrator.setMode(mode);
      res.json({ success: true, mode: orchestrator.getMode() });
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to set mode", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to set mode" });
    }
  });

  // ==================== RISK MANAGEMENT ====================

  /**
   * POST /api/autonomous/kill-switch
   * Activate or deactivate the kill switch for emergency trading halt
   */
  app.post("/api/autonomous/kill-switch", authMiddleware, async (req, res) => {
    try {
      const { activate, reason } = req.body;
      if (activate) {
        await orchestrator.activateKillSwitch(reason || "Manual activation");
      } else {
        await orchestrator.deactivateKillSwitch();
      }
      const state = orchestrator.getState();
      res.json({ success: true, killSwitchActive: orchestrator.getRiskLimits().killSwitchActive, state });
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to toggle kill switch", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to toggle kill switch" });
    }
  });

  /**
   * PUT /api/autonomous/risk-limits
   * Update risk management parameters
   */
  app.put("/api/autonomous/risk-limits", authMiddleware, async (req, res) => {
    try {
      const {
        maxPositionSizePercent,
        maxTotalExposurePercent,
        maxPositionsCount,
        dailyLossLimitPercent,
      } = req.body;

      await orchestrator.updateRiskLimits({
        maxPositionSizePercent,
        maxTotalExposurePercent,
        maxPositionsCount,
        dailyLossLimitPercent,
      });

      res.json({ success: true, riskLimits: orchestrator.getRiskLimits() });
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to update risk limits", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to update risk limits" });
    }
  });

  // ==================== EXECUTION HISTORY & MONITORING ====================

  /**
   * GET /api/autonomous/execution-history
   * Get the history of executed trades and decisions
   */
  app.get("/api/autonomous/execution-history", authMiddleware, async (req, res) => {
    try {
      const state = orchestrator.getState();
      res.json(state.executionHistory);
    } catch (error) {
      res.status(500).json({ error: "Failed to get execution history" });
    }
  });

  // ==================== POSITION MANAGEMENT ====================

  /**
   * POST /api/autonomous/close-position
   * Close a specific position by symbol
   */
  app.post("/api/autonomous/close-position", authMiddleware, async (req, res) => {
    try {
      const { symbol } = req.body;
      if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" });
      }

      // SECURITY: Mark as authorized since this is an admin-initiated action
      // The admin is explicitly requesting to close this position
      const result = await alpacaTradingEngine.closeAlpacaPosition(symbol, undefined, {
        authorizedByOrchestrator: true,
      });

      if (result.success) {
        res.json({ success: true, message: `Position ${symbol} closed successfully`, result });
      } else {
        res.status(400).json({ success: false, error: result.error || "Failed to close position" });
      }
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to close position", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/autonomous/close-all-positions
   * Close all open positions
   */
  app.post("/api/autonomous/close-all-positions", authMiddleware, async (req, res) => {
    try {
      // SECURITY: Mark as authorized since this is an admin-initiated emergency action
      const result = await alpacaTradingEngine.closeAllPositions({
        authorizedByOrchestrator: true,
        isEmergencyStop: true,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to close all positions", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * GET /api/autonomous/reconcile-positions
   * Reconcile local positions with Alpaca broker positions
   */
  app.get("/api/autonomous/reconcile-positions", authMiddleware, async (req, res) => {
    try {
      const result = await alpacaTradingEngine.reconcilePositions();
      res.json(result);
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to reconcile positions", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/autonomous/sync-positions
   * Sync positions from Alpaca broker
   */
  app.post("/api/autonomous/sync-positions", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId!;
      const result = await alpacaTradingEngine.syncPositionsFromAlpaca(userId);
      res.json({ success: true, ...result });
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to sync positions", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  // ==================== TRADE EXECUTION ====================

  /**
   * POST /api/autonomous/execute-trades
   * Execute trades for given decision IDs
   */
  app.post("/api/autonomous/execute-trades", authMiddleware, async (req, res) => {
    try {
      const { decisionIds } = req.body;
      if (!decisionIds || !Array.isArray(decisionIds) || decisionIds.length === 0) {
        return res.status(400).json({ error: "Decision IDs array is required" });
      }

      const results: Array<{ decisionId: string; success: boolean; error?: string; order?: unknown }> = [];

      for (const decisionId of decisionIds) {
        const decisions = await storage.getAiDecisions(undefined, 100);
        const decision = decisions.find(d => d.id === decisionId);
        if (!decision) {
          results.push({ decisionId, success: false, error: "Decision not found" });
          continue;
        }

        try {
          // FIX: Use AI's suggestedQuantity instead of hardcoded 1
          // suggestedQuantity is a percentage (0.01-0.25), calculate actual shares
          const metadata = decision.metadata ? JSON.parse(decision.metadata) : {};
          const suggestedPct = metadata?.suggestedQuantity
            ? parseFloat(String(metadata.suggestedQuantity))
            : 0.05; // Default 5% of portfolio

          // Get account info to calculate quantity
          const account = await alpaca.getAccount();
          const buyingPower = parseFloat(account.buying_power);
          const price = parseFloat(decision.entryPrice || "0");
          if (!price) {
            results.push({ decisionId, success: false, error: "No entry price available" });
            continue;
          }

          const tradeValue = buyingPower * Math.min(Math.max(suggestedPct, 0.01), 0.10); // 1-10% cap
          const quantity = Math.floor(tradeValue / price);

          if (quantity < 1) {
            results.push({ decisionId, success: false, error: "Calculated quantity less than 1 share" });
            continue;
          }

          // SECURITY: Mark as authorized since this is an admin-initiated action
          // executing a pre-approved AI decision
          const orderResult = await alpacaTradingEngine.executeAlpacaTrade({
            symbol: decision.symbol,
            side: decision.action as "buy" | "sell",
            quantity,
            authorizedByOrchestrator: true,
          });

          if (orderResult.success) {
            results.push({ decisionId, success: true, order: orderResult.order });
          } else {
            results.push({ decisionId, success: false, error: orderResult.error });
          }
        } catch (err) {
          results.push({ decisionId, success: false, error: String(err) });
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.json({
        success: successCount > 0,
        message: `Executed ${successCount}/${decisionIds.length} trades`,
        results
      });
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to execute trades", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  // ==================== ORDER MANAGEMENT ====================

  /**
   * GET /api/autonomous/open-orders
   * Get all open orders from Alpaca
   */
  app.get("/api/autonomous/open-orders", authMiddleware, async (req, res) => {
    try {
      const orders = await alpacaTradingEngine.getOpenOrders();
      res.json(orders);
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to get open orders", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/autonomous/cancel-stale-orders
   * Cancel orders older than specified duration
   */
  app.post("/api/autonomous/cancel-stale-orders", authMiddleware, async (req, res) => {
    try {
      const { maxAgeMinutes } = req.body;
      const result = await alpacaTradingEngine.cancelStaleOrders(maxAgeMinutes || 60);
      res.json({ success: true, ...result });
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to cancel stale orders", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  /**
   * POST /api/autonomous/cancel-all-orders
   * Cancel all open orders
   */
  app.post("/api/autonomous/cancel-all-orders", authMiddleware, async (req, res) => {
    try {
      const result = await alpacaTradingEngine.cancelAllOpenOrders();
      res.json({ success: result.cancelled > 0, ...result });
    } catch (error) {
      log.error("AutonomousRoutes", "Failed to cancel all orders", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: String(error) });
    }
  });

  // ==================== ORCHESTRATION ENDPOINTS ====================

  /**
   * GET /api/orchestration/status
   * Get the status of the orchestration coordinator
   */
  app.get("/api/orchestration/status", authMiddleware, async (req, res) => {
    try {
      const status = coordinator.getStatus();
      const config = coordinator.getConfig();
      res.json({ status, config });
    } catch (error) {
      log.error("AutonomousRoutes", "Get orchestration status error", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to get orchestration status" });
    }
  });

  /**
   * POST /api/orchestration/start
   * Start the orchestration coordinator
   */
  app.post("/api/orchestration/start", authMiddleware, async (req, res) => {
    try {
      await coordinator.start();
      res.json({ success: true, message: "Coordinator started" });
    } catch (error) {
      log.error("AutonomousRoutes", "Start coordinator error", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to start coordinator" });
    }
  });

  /**
   * POST /api/orchestration/stop
   * Stop the orchestration coordinator
   */
  app.post("/api/orchestration/stop", authMiddleware, async (req, res) => {
    try {
      await coordinator.stop();
      res.json({ success: true, message: "Coordinator stopped" });
    } catch (error) {
      log.error("AutonomousRoutes", "Stop coordinator error", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to stop coordinator" });
    }
  });

  /**
   * PUT /api/orchestration/config
   * Update orchestration configuration
   */
  app.put("/api/orchestration/config", authMiddleware, async (req, res) => {
    try {
      const updates = req.body;
      coordinator.updateConfig(updates);
      res.json({ success: true, config: coordinator.getConfig() });
    } catch (error) {
      log.error("AutonomousRoutes", "Update orchestration config error", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to update configuration" });
    }
  });

  /**
   * GET /api/orchestration/logs
   * Get orchestration logs with filtering
   */
  app.get("/api/orchestration/logs", authMiddleware, async (req, res) => {
    try {
      const { level, category, limit } = req.query;
      const logs = logger.getLogs({
        level: level as "debug" | "info" | "warn" | "error" | "critical" | undefined,
        category: category as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
      });
      res.json({ logs, stats: logger.getStats() });
    } catch (error) {
      log.error("AutonomousRoutes", "Get logs error", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to get logs" });
    }
  });

  /**
   * GET /api/orchestration/logs/errors
   * Get error logs only
   */
  app.get("/api/orchestration/logs/errors", authMiddleware, async (req, res) => {
    try {
      const { limit } = req.query;
      const errors = logger.getErrorLogs(limit ? parseInt(limit as string) : 50);
      res.json({ errors });
    } catch (error) {
      log.error("AutonomousRoutes", "Get error logs error", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to get error logs" });
    }
  });

  /**
   * GET /api/orchestration/events
   * Get event history with filtering
   */
  app.get("/api/orchestration/events", authMiddleware, async (req, res) => {
    try {
      const { type, source, limit } = req.query;
      const events = eventBus.getEventHistory({
        type: type as any,
        source: source as string | undefined,
        limit: limit ? parseInt(limit as string) : 50,
      });
      res.json({ events, stats: eventBus.getStats() });
    } catch (error) {
      log.error("AutonomousRoutes", "Get events error", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to get events" });
    }
  });

  /**
   * POST /api/orchestration/reset-stats
   * Reset orchestration statistics
   */
  app.post("/api/orchestration/reset-stats", authMiddleware, async (req, res) => {
    try {
      coordinator.resetStats();
      res.json({ success: true, message: "Statistics reset" });
    } catch (error) {
      log.error("AutonomousRoutes", "Reset stats error", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to reset statistics" });
    }
  });
}
