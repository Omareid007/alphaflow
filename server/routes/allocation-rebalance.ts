import { Router, Request, Response } from "express";
import { db } from "../db";
import { desc, eq } from "drizzle-orm";
import { allocationPolicies, rebalanceRuns } from "@shared/schema";
import { log } from "../utils/logger";

const router = Router();

// ============================================================================
// ALLOCATION POLICIES ENDPOINTS
// ============================================================================

router.get("/allocation-policies", async (req: Request, res: Response) => {
  try {
    const policies = await db.query.allocationPolicies.findMany({
      orderBy: [desc(allocationPolicies.createdAt)],
    });
    res.json({ policies, count: policies.length });
  } catch (error) {
    log.error("Routes", "Failed to get allocation policies", { error: error });
    res.status(500).json({ error: "Failed to get allocation policies" });
  }
});

router.post("/allocation-policies", async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      maxPositionWeightPct,
      maxSectorWeightPct,
      rebalanceFrequency,
      isActive,
    } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }
    const [policy] = await db
      .insert(allocationPolicies)
      .values({
        name,
        description: description || null,
        maxPositionWeightPct: maxPositionWeightPct
          ? String(maxPositionWeightPct)
          : "8",
        maxSectorWeightPct: maxSectorWeightPct
          ? String(maxSectorWeightPct)
          : "25",
        rebalanceFrequency: rebalanceFrequency || "daily",
        isActive: isActive !== undefined ? isActive : false,
        createdBy: (req as any).user?.id || null,
      })
      .returning();
    res.json(policy);
  } catch (error) {
    log.error("Routes", "Failed to create allocation policy", { error: error });
    res.status(500).json({ error: "Failed to create allocation policy" });
  }
});

router.patch(
  "/allocation-policies/:id",
  async (req: Request, res: Response) => {
    try {
      const {
        name,
        description,
        maxPositionWeightPct,
        maxSectorWeightPct,
        rebalanceFrequency,
        isActive,
      } = req.body;
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (maxPositionWeightPct !== undefined)
        updates.maxPositionWeightPct = String(maxPositionWeightPct);
      if (maxSectorWeightPct !== undefined)
        updates.maxSectorWeightPct = String(maxSectorWeightPct);
      if (rebalanceFrequency !== undefined)
        updates.rebalanceFrequency = rebalanceFrequency;
      if (isActive !== undefined) updates.isActive = isActive;

      const [updated] = await db
        .update(allocationPolicies)
        .set(updates)
        .where(eq(allocationPolicies.id, req.params.id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Policy not found" });
      }
      res.json(updated);
    } catch (error) {
      log.error("Routes", "Failed to update allocation policy", {
        error: error,
      });
      res.status(500).json({ error: "Failed to update allocation policy" });
    }
  }
);

router.delete(
  "/allocation-policies/:id",
  async (req: Request, res: Response) => {
    try {
      const [deleted] = await db
        .delete(allocationPolicies)
        .where(eq(allocationPolicies.id, req.params.id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "Policy not found" });
      }
      res.json({ success: true, message: "Policy deleted" });
    } catch (error) {
      log.error("Routes", "Failed to delete allocation policy", {
        error: error,
      });
      res.status(500).json({ error: "Failed to delete allocation policy" });
    }
  }
);

// ============================================================================
// REBALANCE RUNS ENDPOINTS
// ============================================================================

router.get("/rebalance/runs", async (req: Request, res: Response) => {
  try {
    const { limit, status } = req.query;
    let whereClause = undefined;
    if (status) {
      whereClause = eq(rebalanceRuns.status, status as string);
    }
    const runs = await db.query.rebalanceRuns.findMany({
      where: whereClause,
      orderBy: [desc(rebalanceRuns.startedAt)],
      limit: limit ? parseInt(limit as string) : 50,
    });
    res.json({ runs, count: runs.length });
  } catch (error) {
    log.error("Routes", "Failed to get rebalance runs", { error: error });
    res.status(500).json({ error: "Failed to get rebalance runs" });
  }
});

router.post("/rebalance/trigger", async (req: Request, res: Response) => {
  try {
    const { policyId, triggerType = "manual" } = req.body;

    // Create a new rebalance run
    const traceId = `rebalance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [run] = await db
      .insert(rebalanceRuns)
      .values({
        policyId: policyId || null,
        traceId,
        status: "running",
        triggerType,
        inputSnapshot: {},
      })
      .returning();

    // In a real implementation, this would trigger the rebalance process
    // For now, we simulate completion
    setTimeout(async () => {
      await db
        .update(rebalanceRuns)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(rebalanceRuns.id, run.id));
    }, 2000);

    res.json({ success: true, run });
  } catch (error) {
    log.error("Routes", "Failed to trigger rebalance", { error: error });
    res.status(500).json({ error: "Failed to trigger rebalance" });
  }
});

export default router;
