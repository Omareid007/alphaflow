import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../utils/logger";
import type { InsertStrategyVersion } from "@shared/schema";

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

export default router;
