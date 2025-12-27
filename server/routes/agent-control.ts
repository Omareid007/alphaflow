import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../utils/logger";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";

const router = Router();

// GET /api/agent/status
// Get the current status of the trading agent
router.get("/status", async (req: Request, res: Response) => {
  try {
    const status = await storage.getAgentStatus();
    if (!status) {
      const defaultStatus = await storage.updateAgentStatus({
        isRunning: false,
        totalTrades: 0,
        totalPnl: "0",
      });
      return res.json(defaultStatus);
    }
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to get agent status" });
  }
});

// POST /api/agent/toggle
// Toggle the trading agent on/off
router.post("/toggle", async (req: Request, res: Response) => {
  try {
    const currentStatus = await storage.getAgentStatus();
    const newIsRunning = !(currentStatus?.isRunning ?? false);

    if (newIsRunning) {
      await alpacaTradingEngine.resumeAgent();
    } else {
      await alpacaTradingEngine.stopAllStrategies();
    }

    const status = await storage.getAgentStatus();
    res.json(status);
  } catch (error) {
    log.error("Routes", "Failed to toggle agent", { error: error });
    res.status(500).json({ error: "Failed to toggle agent" });
  }
});

export default router;
