import { Router, Request, Response } from "express";
import { db, getPoolStats } from "../db";
import { sql } from "drizzle-orm";
import { log } from "../utils/logger";

const router = Router();

/**
 * GET /api/health/db
 * Database health check endpoint
 */
router.get("/db", async (req: Request, res: Response) => {
  try {
    const stats = getPoolStats();
    // Test database connection with a simple query
    await db.execute(sql`SELECT 1 as test`);
    res.json({
      status: "healthy",
      pool: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("HealthRoutes", "Database health check failed", { error: error });
    res.status(503).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
