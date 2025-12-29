import { Router, Request, Response } from "express";
import { arenaCoordinator, type ArenaConfig, type EscalationPolicy } from "../ai/arenaCoordinator";
import { db } from "../db";
import { aiAgentProfiles, aiArenaRuns, aiArenaAgentDecisions, aiOutcomeLinks } from "@shared/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { log } from "../utils/logger";
import { badRequest, notFound, serverError } from "../lib/standard-errors";
import type { InsertAiAgentProfile, AiAgentProfile, AgentProvider, DebateRole } from "@shared/schema";

const router = Router();

router.post("/run", async (req: Request, res: Response) => {
  try {
    const { symbols, mode = "debate", agentProfileIds, triggeredBy, strategyVersionId } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return badRequest(res, "symbols is required and must be a non-empty array");
    }

    const config: ArenaConfig = {
      mode,
      symbols,
      agentProfileIds,
      triggeredBy: triggeredBy || "admin_manual",
      strategyVersionId,
    };

    const result = await arenaCoordinator.runArena(config);

    res.json({
      success: true,
      run: result.run,
      consensus: result.consensus,
      decisionsCount: result.decisions.length,
    });
  } catch (error) {
    log.error("ArenaAPI", `Failed to run arena: ${error}`);
    return serverError(res, (error as Error).message || "Failed to run arena");
  }
});

router.get("/runs", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const cursor = req.query.cursor as string | undefined;

    let whereClause = undefined;
    if (cursor) {
      whereClause = gte(aiArenaRuns.createdAt, new Date(cursor));
    }

    const runs = await db.query.aiArenaRuns.findMany({
      where: whereClause,
      orderBy: [desc(aiArenaRuns.createdAt)],
      limit,
    });

    const costToday = await db
      .select({ total: sql<string>`COALESCE(SUM(total_cost_usd::numeric), 0)` })
      .from(aiArenaRuns)
      .where(gte(aiArenaRuns.createdAt, new Date(new Date().setHours(0, 0, 0, 0))));

    res.json({
      runs,
      count: runs.length,
      costToday: parseFloat(costToday[0]?.total || "0"),
      nextCursor: runs.length === limit ? runs[runs.length - 1]?.createdAt?.toISOString() : null,
    });
  } catch (error) {
    log.error("ArenaAPI", `Failed to list arena runs: ${error}`);
    return serverError(res, "Failed to list arena runs");
  }
});

router.get("/runs/:id", async (req: Request, res: Response) => {
  try {
    const run = await db.query.aiArenaRuns.findFirst({
      where: eq(aiArenaRuns.id, req.params.id),
    });

    if (!run) {
      return notFound(res, "Arena run not found");
    }

    const decisions = await db.query.aiArenaAgentDecisions.findMany({
      where: eq(aiArenaAgentDecisions.arenaRunId, req.params.id),
      orderBy: [desc(aiArenaAgentDecisions.createdAt)],
    });

    const agentIds = [...new Set(decisions.map(d => d.agentProfileId))];
    const agents = await db.query.aiAgentProfiles.findMany();
    const agentMap = new Map(agents.map(a => [a.id, a]));

    const decisionsWithAgents = decisions.map(d => ({
      ...d,
      agent: d.agentProfileId ? agentMap.get(d.agentProfileId) : null,
    }));

    const outcomeLinks = await db.query.aiOutcomeLinks.findMany({
      where: eq(aiOutcomeLinks.traceId, run.traceId),
    });

    res.json({
      run,
      decisions: decisionsWithAgents,
      outcomeLinks,
      costBreakdown: {
        total: parseFloat(run.totalCostUsd || "0"),
        byAgent: decisionsWithAgents.map(d => ({
          agent: d.agent?.name || "Unknown",
          cost: parseFloat(d.costUsd || "0"),
          tokens: d.tokensUsed || 0,
          latencyMs: d.latencyMs || 0,
        })),
      },
    });
  } catch (error) {
    log.error("ArenaAPI", `Failed to get arena run: ${error}`);
    res.status(500).json({ error: "Failed to get arena run" });
  }
});

router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const window = req.query.window as string || "30d";
    const days = parseInt(window.replace("d", "")) || 30;

    const leaderboard = await arenaCoordinator.getLeaderboard(days);

    res.json({
      window: `${days}d`,
      leaderboard,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error("ArenaAPI", `Failed to get leaderboard: ${error}`);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

router.get("/profiles", async (req: Request, res: Response) => {
  try {
    const profiles = await db.query.aiAgentProfiles.findMany({
      orderBy: [desc(aiAgentProfiles.createdAt)],
    });

    res.json({ profiles, count: profiles.length });
  } catch (error) {
    log.error("ArenaAPI", `Failed to list agent profiles: ${error}`);
    res.status(500).json({ error: "Failed to list agent profiles" });
  }
});

router.post("/profiles", async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      provider,
      model,
      role,
      mode = "cheap_first",
      temperature = 0.7,
      maxTokens = 2000,
      budgetLimitPerDay,
      budgetLimitPerRun,
      priority = 0,
    } = req.body;

    if (!name || !provider || !model || !role) {
      return res.status(400).json({ error: "name, provider, model, and role are required" });
    }

    const validProviders = ["openai", "openrouter", "groq", "together"];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: `Invalid provider. Must be one of: ${validProviders.join(", ")}` });
    }

    const validModes = ["cheap_first", "escalation_only", "always"];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(", ")}` });
    }

    const [profile] = await db.insert(aiAgentProfiles).values({
      name: name as string,
      description: description as string | null,
      provider: provider as AgentProvider,
      model: model as string,
      role: role as DebateRole,
      mode: mode as "cheap_first" | "escalation_only" | "always",
      temperature: String(temperature),
      maxTokens: maxTokens as number,
      budgetLimitPerDay: budgetLimitPerDay ? String(budgetLimitPerDay) : null,
      budgetLimitPerRun: budgetLimitPerRun ? String(budgetLimitPerRun) : null,
      priority: priority as number,
      status: "active" as const,
    }).returning();

    res.json(profile);
  } catch (error) {
    log.error("ArenaAPI", `Failed to create agent profile: ${error}`);
    res.status(500).json({ error: (error as Error).message || "Failed to create agent profile" });
  }
});

router.get("/profiles/:id", async (req: Request, res: Response) => {
  try {
    const profile = await db.query.aiAgentProfiles.findFirst({
      where: eq(aiAgentProfiles.id, req.params.id),
    });

    if (!profile) {
      return res.status(404).json({ error: "Agent profile not found" });
    }

    res.json(profile);
  } catch (error) {
    log.error("ArenaAPI", `Failed to get agent profile: ${error}`);
    res.status(500).json({ error: "Failed to get agent profile" });
  }
});

router.patch("/profiles/:id", async (req: Request, res: Response) => {
  try {
    const { status, description, model, mode, temperature, maxTokens, budgetLimitPerDay, priority } = req.body;

    const updates: Partial<AiAgentProfile> = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (description !== undefined) updates.description = description;
    if (model !== undefined) updates.model = model;
    if (mode !== undefined) updates.mode = mode;
    if (temperature !== undefined) updates.temperature = String(temperature);
    if (maxTokens !== undefined) updates.maxTokens = maxTokens;
    if (budgetLimitPerDay !== undefined) updates.budgetLimitPerDay = String(budgetLimitPerDay);
    if (priority !== undefined) updates.priority = priority;

    const [updated] = await db
      .update(aiAgentProfiles)
      .set(updates)
      .where(eq(aiAgentProfiles.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Agent profile not found" });
    }

    res.json(updated);
  } catch (error) {
    log.error("ArenaAPI", `Failed to update agent profile: ${error}`);
    res.status(500).json({ error: (error as Error).message || "Failed to update agent profile" });
  }
});

router.delete("/profiles/:id", async (req: Request, res: Response) => {
  try {
    const [deleted] = await db
      .update(aiAgentProfiles)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(eq(aiAgentProfiles.id, req.params.id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Agent profile not found" });
    }

    res.json({ success: true, message: "Agent profile disabled" });
  } catch (error) {
    log.error("ArenaAPI", `Failed to delete agent profile: ${error}`);
    res.status(500).json({ error: "Failed to delete agent profile" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [runsToday] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(aiArenaRuns)
      .where(gte(aiArenaRuns.createdAt, today));

    const [costToday] = await db
      .select({ total: sql<string>`COALESCE(SUM(total_cost_usd::numeric), 0)` })
      .from(aiArenaRuns)
      .where(gte(aiArenaRuns.createdAt, today));

    const [costWeek] = await db
      .select({ total: sql<string>`COALESCE(SUM(total_cost_usd::numeric), 0)` })
      .from(aiArenaRuns)
      .where(gte(aiArenaRuns.createdAt, weekAgo));

    const [escalationsToday] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(aiArenaRuns)
      .where(and(gte(aiArenaRuns.createdAt, today), eq(aiArenaRuns.escalationTriggered, true)));

    const [activeProfiles] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(aiAgentProfiles)
      .where(eq(aiAgentProfiles.status, "active"));

    res.json({
      runsToday: runsToday?.count || 0,
      costToday: parseFloat(costToday?.total || "0"),
      costWeek: parseFloat(costWeek?.total || "0"),
      escalationsToday: escalationsToday?.count || 0,
      activeProfiles: activeProfiles?.count || 0,
    });
  } catch (error) {
    log.error("ArenaAPI", `Failed to get arena stats: ${error}`);
    res.status(500).json({ error: "Failed to get arena stats" });
  }
});

export default router;
