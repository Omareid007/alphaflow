import { Router, Request, Response } from "express";
import {
  startDebate,
  getDebateDetails,
  listDebateSessions,
  type DebateConfig,
} from "../ai/debateArena";
import { log } from "../utils/logger";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

router.post("/sessions", requireAuth, async (req: Request, res: Response) => {
  try {
    const { symbols, config = {}, triggeredBy, strategyVersionId } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res
        .status(400)
        .json({ error: "symbols is required and must be a non-empty array" });
    }

    const traceId = `debate-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const { session, consensus } = await startDebate(
      symbols,
      traceId,
      config as DebateConfig,
      triggeredBy,
      strategyVersionId
    );

    res.json({ session, consensus });
  } catch (error) {
    log.error("DebateAPI", `Failed to start debate: ${error}`);
    res
      .status(500)
      .json({ error: (error as Error).message || "Failed to start debate" });
  }
});

router.get("/sessions", requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const sessions = await listDebateSessions(limit);
    res.json({ sessions, limit });
  } catch (error) {
    log.error("DebateAPI", `Failed to list debate sessions: ${error}`);
    res.status(500).json({ error: "Failed to list debate sessions" });
  }
});

router.get("/sessions/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const details = await getDebateDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ error: "Debate session not found" });
    }
    res.json(details);
  } catch (error) {
    log.error("DebateAPI", `Failed to get debate session: ${error}`);
    res.status(500).json({ error: "Failed to get debate session" });
  }
});

export default router;
