import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../utils/logger";
import type { InsertStrategyVersion } from "@shared/schema";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";

const router = Router();

router.get("/versions", async (req: Request, res: Response) => {
  try {
    const strategyId = req.query.strategyId as string;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!strategyId) {
      return res.status(400).json({ error: "strategyId is required" });
    }

    const versions = await storage.getStrategyVersionsByStrategy(strategyId);
    res.json({ versions, count: versions.length });
  } catch (error) {
    log.error("StrategiesAPI", `Failed to list strategy versions: ${error}`);
    res.status(500).json({ error: "Failed to list strategy versions" });
  }
});

router.post("/versions", async (req: Request, res: Response) => {
  try {
    const { 
      strategyId, 
      name, 
      spec, 
      createdBy,
      universeConfig,
      signalsConfig,
      riskConfig,
      executionConfig,
      backtestResultId,
      description 
    } = req.body;

    if (!strategyId || !name || !spec) {
      return res.status(400).json({ error: "strategyId, name, and spec are required" });
    }

    const version = await storage.getNextVersionNumber(strategyId);

    const strategyVersion = await storage.createStrategyVersion({
      strategyId,
      name,
      version,
      spec,
      createdBy,
      universeConfig,
      signalsConfig,
      riskConfig,
      executionConfig,
      backtestResultId,
      description,
      status: "draft",
    } as InsertStrategyVersion);

    res.json(strategyVersion);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to create strategy version: ${error}`);
    res.status(500).json({ error: (error as Error).message || "Failed to create strategy version" });
  }
});

router.get("/versions/:id", async (req: Request, res: Response) => {
  try {
    const version = await storage.getStrategyVersion(req.params.id);
    if (!version) {
      return res.status(404).json({ error: "Strategy version not found" });
    }
    res.json(version);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to get strategy version: ${error}`);
    res.status(500).json({ error: "Failed to get strategy version" });
  }
});

router.patch("/versions/:id", async (req: Request, res: Response) => {
  try {
    const version = await storage.updateStrategyVersion(req.params.id, req.body);
    if (!version) {
      return res.status(404).json({ error: "Strategy version not found" });
    }
    res.json(version);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to update strategy version: ${error}`);
    res.status(500).json({ error: (error as Error).message || "Failed to update strategy version" });
  }
});

router.post("/versions/:id/activate", async (req: Request, res: Response) => {
  try {
    const version = await storage.updateStrategyVersion(req.params.id, {
      status: "active",
      activatedAt: new Date(),
    });

    if (!version) {
      return res.status(404).json({ error: "Strategy version not found" });
    }

    res.json(version);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to activate strategy version: ${error}`);
    res.status(500).json({ error: (error as Error).message || "Failed to activate strategy version" });
  }
});

router.post("/versions/:id/archive", async (req: Request, res: Response) => {
  try {
    const version = await storage.updateStrategyVersion(req.params.id, {
      status: "archived",
    });

    if (!version) {
      return res.status(404).json({ error: "Strategy version not found" });
    }

    res.json(version);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to archive strategy version: ${error}`);
    res.status(500).json({ error: (error as Error).message || "Failed to archive strategy version" });
  }
});

router.get("/versions/:strategyId/latest", async (req: Request, res: Response) => {
  try {
    const version = await storage.getLatestStrategyVersion(req.params.strategyId);
    if (!version) {
      return res.status(404).json({ error: "No versions found for this strategy" });
    }
    res.json(version);
  } catch (error) {
    log.error("StrategiesAPI", `Failed to get latest strategy version: ${error}`);
    res.status(500).json({ error: "Failed to get latest strategy version" });
  }
});

// Strategy deployment and lifecycle management routes
router.post("/:id/deploy", async (req: Request, res: Response) => {
  try {
    const { mode } = req.body;

    if (!mode || !["paper", "live"].includes(mode)) {
      return res.status(400).json({ error: "Invalid mode. Must be 'paper' or 'live'" });
    }

    const strategy = await storage.getStrategy(req.params.id);
    if (!strategy) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    // Update strategy with deployment mode
    const updatedStrategy = await storage.updateStrategy(req.params.id, {
      parameters: JSON.stringify({
        ...((strategy.parameters && JSON.parse(strategy.parameters)) || {}),
        deploymentMode: mode,
        deployedAt: new Date().toISOString(),
      }),
    });

    if (!updatedStrategy) {
      return res.status(500).json({ error: "Failed to update strategy deployment" });
    }

    // If deploying to live and strategy is active, ensure Alpaca is connected
    if (mode === "live" && strategy.isActive) {
      const isConnected = await alpacaTradingEngine.isAlpacaConnected();
      if (!isConnected) {
        return res.status(400).json({
          error: "Alpaca not connected. Cannot deploy to live mode without broker connection."
        });
      }
    }

    res.json({
      success: true,
      strategy: updatedStrategy,
      mode,
      message: `Strategy deployed to ${mode} mode successfully`,
    });
  } catch (error) {
    log.error("StrategiesAPI", `Failed to deploy strategy: ${error}`);
    res.status(500).json({ error: "Failed to deploy strategy" });
  }
});

router.post("/:id/pause", async (req: Request, res: Response) => {
  try {
    const strategy = await storage.getStrategy(req.params.id);
    if (!strategy) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    if (!strategy.isActive) {
      return res.status(400).json({ error: "Strategy is already paused" });
    }

    // Stop the strategy
    const result = await alpacaTradingEngine.stopStrategy(req.params.id);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to pause strategy" });
    }

    // Mark as paused in metadata
    const updatedStrategy = await storage.updateStrategy(req.params.id, {
      parameters: JSON.stringify({
        ...((strategy.parameters && JSON.parse(strategy.parameters)) || {}),
        paused: true,
        pausedAt: new Date().toISOString(),
      }),
    });

    res.json({
      success: true,
      strategy: updatedStrategy,
      message: "Strategy paused successfully",
    });
  } catch (error) {
    log.error("StrategiesAPI", `Failed to pause strategy: ${error}`);
    res.status(500).json({ error: "Failed to pause strategy" });
  }
});

router.post("/:id/resume", async (req: Request, res: Response) => {
  try {
    const strategy = await storage.getStrategy(req.params.id);
    if (!strategy) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    if (strategy.isActive) {
      return res.status(400).json({ error: "Strategy is already running" });
    }

    // Start the strategy
    const result = await alpacaTradingEngine.startStrategy(req.params.id);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to resume strategy" });
    }

    // Clear paused flag
    const params = (strategy.parameters && JSON.parse(strategy.parameters)) || {};
    delete params.paused;
    delete params.pausedAt;

    const updatedStrategy = await storage.updateStrategy(req.params.id, {
      parameters: JSON.stringify({
        ...params,
        resumedAt: new Date().toISOString(),
      }),
    });

    res.json({
      success: true,
      strategy: updatedStrategy,
      message: "Strategy resumed successfully",
    });
  } catch (error) {
    log.error("StrategiesAPI", `Failed to resume strategy: ${error}`);
    res.status(500).json({ error: "Failed to resume strategy" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const strategy = await storage.getStrategy(req.params.id);
    if (!strategy) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    // Stop the strategy if it's running
    if (strategy.isActive) {
      const stopResult = await alpacaTradingEngine.stopStrategy(req.params.id);
      if (!stopResult.success) {
        log.warn("StrategiesAPI", `Could not stop strategy before deletion: ${stopResult.error}`);
      }
    }

    // Delete the strategy
    const deleted = await storage.deleteStrategy(req.params.id);
    if (!deleted) {
      return res.status(500).json({ error: "Failed to delete strategy" });
    }

    res.json({
      success: true,
      message: "Strategy deleted successfully",
    });
  } catch (error) {
    log.error("StrategiesAPI", `Failed to delete strategy: ${error}`);
    res.status(500).json({ error: "Failed to delete strategy" });
  }
});

export default router;
