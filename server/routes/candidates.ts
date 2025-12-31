import { Router, Request, Response, NextFunction } from "express";
import { candidatesService, type CandidateStatus } from "../universe/candidatesService";
import { badRequest, serverError, notFound } from "../lib/standard-errors";
import { log } from "../utils/logger";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

// Helper to transform database candidate to frontend format
function transformCandidate(candidate: {
  id: string;
  symbol: string;
  finalScore: string | null;
  qualityScore: string | null;
  growthScore: string | null;
  liquidityScore: string | null;
  rationale: string | null;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}) {
  return {
    id: candidate.id,
    symbol: candidate.symbol,
    score: parseFloat(candidate.finalScore || "0"),
    qualityScore: parseFloat(candidate.qualityScore || "0"),
    growthScore: parseFloat(candidate.growthScore || "0"),
    liquidityScore: parseFloat(candidate.liquidityScore || "0"),
    rationale: candidate.rationale || "",
    status: candidate.status as "NEW" | "WATCHLIST" | "APPROVED" | "REJECTED",
    createdAt: candidate.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: candidate.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

/**
 * GET /api/candidates
 * List candidates with optional status filter
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, limit = "100" } = req.query;
    const parsedLimit = Math.min(parseInt(String(limit), 10) || 100, 500);

    let candidates;

    if (status && ["NEW", "WATCHLIST", "APPROVED", "REJECTED"].includes(String(status).toUpperCase())) {
      candidates = await candidatesService.getCandidatesByStatus(
        String(status).toUpperCase() as CandidateStatus,
        parsedLimit
      );
    } else {
      candidates = await candidatesService.getTopCandidates(parsedLimit);
    }

    const transformed = candidates.map(transformCandidate);

    log.info("Candidates", "Listed candidates", {
      status: status || "all",
      count: transformed.length,
    });

    res.json(transformed);
  } catch (error) {
    log.error("Candidates", "Failed to fetch candidates", { error });
    serverError(res, "Failed to fetch candidates");
  }
});

/**
 * GET /api/candidates/stats
 * Get candidate statistics
 */
router.get("/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await candidatesService.getStats();

    log.info("Candidates", "Fetched stats", { stats });

    res.json(stats);
  } catch (error) {
    log.error("Candidates", "Failed to fetch candidate stats", { error });
    serverError(res, "Failed to fetch candidate stats");
  }
});

/**
 * GET /api/candidates/:symbol
 * Get a specific candidate by symbol
 */
router.get("/:symbol", requireAuth, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return badRequest(res, "Symbol is required");
    }

    const candidate = await candidatesService.getCandidateBySymbol(symbol);

    if (!candidate) {
      return notFound(res, `Candidate not found: ${symbol}`);
    }

    res.json(transformCandidate(candidate));
  } catch (error) {
    log.error("Candidates", "Failed to fetch candidate", { error });
    serverError(res, "Failed to fetch candidate");
  }
});

/**
 * POST /api/candidates/generate
 * Trigger candidate generation
 */
router.post("/generate", requireAuth, async (req: Request, res: Response) => {
  try {
    const { minLiquidityTier, minScore, limit } = req.body;

    const result = await candidatesService.generateCandidates({
      minLiquidityTier,
      minScore: minScore ? parseFloat(minScore) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      traceId: `gen-${Date.now()}`,
    });

    log.info("Candidates", "Generated candidates", {
      generated: result.generated,
      updated: result.updated,
      duration: result.duration,
    });

    res.json(result);
  } catch (error) {
    log.error("Candidates", "Failed to generate candidates", { error });
    serverError(res, "Failed to generate candidates");
  }
});

/**
 * POST /api/candidates/:symbol/approve
 * Approve a candidate
 */
router.post("/:symbol/approve", requireAuth, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const userId = req.userId || "system";

    if (!symbol) {
      return badRequest(res, "Symbol is required");
    }

    const result = await candidatesService.approveCandidate(symbol, userId);

    log.info("Candidates", "Approved candidate", {
      symbol: result.symbol,
      previousStatus: result.previousStatus,
      userId,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return notFound(res, error.message);
    }
    log.error("Candidates", "Failed to approve candidate", { error });
    serverError(res, "Failed to approve candidate");
  }
});

/**
 * POST /api/candidates/:symbol/reject
 * Reject a candidate
 */
router.post("/:symbol/reject", requireAuth, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return badRequest(res, "Symbol is required");
    }

    const result = await candidatesService.rejectCandidate(symbol);

    log.info("Candidates", "Rejected candidate", {
      symbol: result.symbol,
      previousStatus: result.previousStatus,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return notFound(res, error.message);
    }
    log.error("Candidates", "Failed to reject candidate", { error });
    serverError(res, "Failed to reject candidate");
  }
});

/**
 * POST /api/candidates/:symbol/watchlist
 * Add candidate to watchlist
 */
router.post("/:symbol/watchlist", requireAuth, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return badRequest(res, "Symbol is required");
    }

    const result = await candidatesService.watchlistCandidate(symbol);

    log.info("Candidates", "Added to watchlist", {
      symbol: result.symbol,
      previousStatus: result.previousStatus,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return notFound(res, error.message);
    }
    log.error("Candidates", "Failed to add candidate to watchlist", { error });
    serverError(res, "Failed to add candidate to watchlist");
  }
});

/**
 * POST /api/candidates/bulk-approve
 * Bulk approve candidates
 */
router.post("/bulk-approve", requireAuth, async (req: Request, res: Response) => {
  try {
    const { symbols } = req.body;
    const userId = req.userId || "system";

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return badRequest(res, "symbols array is required");
    }

    const results = await Promise.allSettled(
      symbols.map((symbol: string) =>
        candidatesService.approveCandidate(symbol, userId)
      )
    );

    const successful = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof candidatesService.approveCandidate>>> =>
        r.status === "fulfilled"
      )
      .map((r) => r.value.symbol);

    const failed = results
      .map((r, i) => ({ result: r, symbol: symbols[i] }))
      .filter((x) => x.result.status === "rejected")
      .map((x) => x.symbol);

    log.info("Candidates", "Bulk approved", {
      requested: symbols.length,
      successful: successful.length,
      failed: failed.length,
      userId,
    });

    res.json({
      success: true,
      approved: successful,
      failed,
      total: symbols.length,
    });
  } catch (error) {
    log.error("Candidates", "Failed to bulk approve candidates", { error });
    serverError(res, "Failed to bulk approve candidates");
  }
});

/**
 * POST /api/candidates/bulk-reject
 * Bulk reject candidates
 */
router.post("/bulk-reject", requireAuth, async (req: Request, res: Response) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return badRequest(res, "symbols array is required");
    }

    const results = await Promise.allSettled(
      symbols.map((symbol: string) => candidatesService.rejectCandidate(symbol))
    );

    const successful = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof candidatesService.rejectCandidate>>> =>
        r.status === "fulfilled"
      )
      .map((r) => r.value.symbol);

    const failed = results
      .map((r, i) => ({ result: r, symbol: symbols[i] }))
      .filter((x) => x.result.status === "rejected")
      .map((x) => x.symbol);

    log.info("Candidates", "Bulk rejected", {
      requested: symbols.length,
      successful: successful.length,
      failed: failed.length,
    });

    res.json({
      success: true,
      rejected: successful,
      failed,
      total: symbols.length,
    });
  } catch (error) {
    log.error("Candidates", "Failed to bulk reject candidates", { error });
    serverError(res, "Failed to bulk reject candidates");
  }
});

export default router;
