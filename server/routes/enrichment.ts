import { Router, Request, Response } from "express";
import { enrichmentScheduler } from "../services/enrichment-scheduler";
import { log } from "../utils/logger";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const status = enrichmentScheduler.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    log.error("EnrichmentRoutes", "Failed to get status", { error });
    res
      .status(500)
      .json({ success: false, error: "Failed to get enrichment status" });
  }
});

router.get("/status/:jobName", async (req: Request, res: Response) => {
  try {
    const status = enrichmentScheduler.getJobStatus(req.params.jobName);
    if (!status) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }
    res.json({ success: true, data: status });
  } catch (error) {
    log.error("EnrichmentRoutes", "Failed to get job status", { error });
    res.status(500).json({ success: false, error: "Failed to get job status" });
  }
});

router.post("/run/:jobName", async (req: Request, res: Response) => {
  try {
    const result = await enrichmentScheduler.runJobManually(req.params.jobName);
    res
      .status(result.statusCode)
      .json({ success: result.success, message: result.message });
  } catch (error) {
    log.error("EnrichmentRoutes", "Failed to run job", { error });
    res.status(500).json({ success: false, error: "Failed to run job" });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const technicals = await db.execute(
      sql`SELECT COUNT(*) as count FROM universe_technicals`
    );
    const macro = await db.execute(
      sql`SELECT COUNT(*) as count FROM macro_indicators`
    );
    const fundamentals = await db.execute(
      sql`SELECT COUNT(*) as count FROM universe_fundamentals`
    );
    const classifications = await db.execute(
      sql`SELECT COUNT(*) as count FROM asset_classifications`
    );
    const assets = await db.execute(
      sql`SELECT COUNT(*) as count FROM broker_assets`
    );

    res.json({
      success: true,
      data: {
        universe_technicals: Number(technicals.rows[0]?.count || 0),
        macro_indicators: Number(macro.rows[0]?.count || 0),
        universe_fundamentals: Number(fundamentals.rows[0]?.count || 0),
        asset_classifications: Number(classifications.rows[0]?.count || 0),
        broker_assets: Number(assets.rows[0]?.count || 0),
      },
    });
  } catch (error) {
    log.error("EnrichmentRoutes", "Failed to get stats", { error });
    res.status(500).json({ success: false, error: "Failed to get stats" });
  }
});

export default router;
