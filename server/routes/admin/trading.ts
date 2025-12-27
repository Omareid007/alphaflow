/**
 * Admin Trading Routes
 * Handles universe, liquidity, fundamentals, candidates, enforcement, allocation, and rebalancer
 */

import { Router, Request, Response } from "express";
import { storage } from "../../storage";
import {
  alpacaUniverseService,
  liquidityService,
  fundamentalsService,
  candidatesService,
  tradingEnforcementService,
  allocationService,
  rebalancerService
} from "../../universe";
import { log } from "../../utils/logger";

const router = Router();

// ============================================================================
// UNIVERSE ADMIN ENDPOINTS
// ============================================================================

// GET /api/admin/universe/stats - Get universe stats (requires admin:read)
router.get("/universe/stats", async (req: Request, res: Response) => {
  try {
    const stats = await alpacaUniverseService.getStats();
    res.json({
      ...stats,
      source: "alpaca_universe",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to get universe stats", { error });
    res.status(500).json({ error: "Failed to get universe stats" });
  }
});

// GET /api/admin/universe/assets - Get universe assets (requires admin:read)
router.get("/universe/assets", async (req: Request, res: Response) => {
  try {
    const { assetClass, tradable, limit, offset } = req.query;
    const assets = await storage.getBrokerAssets(
      assetClass as "us_equity" | "crypto" | undefined,
      tradable === "true",
      limit ? parseInt(limit as string) : 100
    );
    res.json({
      assets,
      count: assets.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to get universe assets", { error });
    res.status(500).json({ error: "Failed to get universe assets" });
  }
});

// GET /api/admin/universe/assets/:symbol - Get asset details (requires admin:read)
router.get("/universe/assets/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const asset = await storage.getBrokerAsset(symbol);
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }
    res.json(asset);
  } catch (error) {
    log.error("AdminTrading", "Failed to get asset", { error });
    res.status(500).json({ error: "Failed to get asset" });
  }
});

// POST /api/admin/universe/refresh - Refresh universe (requires admin:write)
router.post("/universe/refresh", async (req: Request, res: Response) => {
  try {
    const { assetClass } = req.body;
    const result = await alpacaUniverseService.refreshAssets({
      assetClass: assetClass || "us_equity"
    });
    res.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to refresh universe", { error });
    res.status(500).json({ error: "Failed to refresh universe" });
  }
});

// POST /api/admin/universe/exclude/:symbol - Exclude symbol (requires admin:write)
router.post("/universe/exclude/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { reason } = req.body;
    await alpacaUniverseService.setExcluded(symbol, true, reason || "Admin exclusion");
    res.json({ success: true, symbol, excluded: true });
  } catch (error) {
    log.error("AdminTrading", "Failed to exclude symbol", { error });
    res.status(500).json({ error: "Failed to exclude symbol" });
  }
});

// GET /api/admin/universe/tradable - Get tradable symbols (requires admin:read)
router.get("/universe/tradable", async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const assets = await storage.getBrokerAssets("us_equity", true, limit ? parseInt(limit as string) : 500);
    res.json({
      symbols: assets.map(a => a.symbol),
      count: assets.length,
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to get tradable symbols", { error });
    res.status(500).json({ error: "Failed to get tradable symbols" });
  }
});

// ============================================================================
// LIQUIDITY ENDPOINTS
// ============================================================================

// GET /api/admin/liquidity/stats - Get liquidity stats (requires admin:read)
router.get("/liquidity/stats", async (req: Request, res: Response) => {
  try {
    const stats = await liquidityService.getTierStats();
    res.json({
      ...stats,
      source: "liquidity_metrics",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to get liquidity stats", { error });
    res.status(500).json({ error: "Failed to get liquidity stats" });
  }
});

// GET /api/admin/liquidity/metrics/:symbol - Get symbol liquidity (requires admin:read)
router.get("/liquidity/metrics/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const metrics = await liquidityService.getMetricsBySymbol(symbol);
    if (!metrics) {
      return res.status(404).json({ error: "Liquidity metrics not found" });
    }
    res.json(metrics);
  } catch (error) {
    log.error("AdminTrading", "Failed to get liquidity metrics", { error });
    res.status(500).json({ error: "Failed to get liquidity metrics" });
  }
});

// GET /api/admin/liquidity/tier/:tier - Get symbols by tier (requires admin:read)
router.get("/liquidity/tier/:tier", async (req: Request, res: Response) => {
  try {
    const { tier } = req.params;
    const { limit } = req.query;
    if (!["A", "B", "C", "D"].includes(tier)) {
      return res.status(400).json({ error: "Invalid tier. Must be A, B, C, or D" });
    }
    const metrics = await liquidityService.getMetricsByTier(
      tier as "A" | "B" | "C",
      limit ? parseInt(limit as string) : 100
    );
    res.json({ tier, symbols: metrics, count: metrics.length });
  } catch (error) {
    log.error("AdminTrading", "Failed to get tier symbols", { error });
    res.status(500).json({ error: "Failed to get tier symbols" });
  }
});

// GET /api/admin/liquidity/top - Get top liquid symbols (requires admin:read)
router.get("/liquidity/top", async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const symbols = await liquidityService.getTopLiquid(
      limit ? parseInt(limit as string) : 50
    );
    res.json({ symbols, count: symbols.length });
  } catch (error) {
    log.error("AdminTrading", "Failed to get top liquid symbols", { error });
    res.status(500).json({ error: "Failed to get top liquid symbols" });
  }
});

// POST /api/admin/liquidity/compute - Compute liquidity metrics (requires admin:write)
router.post("/liquidity/compute", async (req: Request, res: Response) => {
  try {
    const { symbols, traceId } = req.body;
    const result = await liquidityService.computeLiquidityMetrics({
      symbols,
      traceId: traceId || `liq-${Date.now()}`
    });
    res.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to compute liquidity", { error });
    res.status(500).json({ error: "Failed to compute liquidity metrics" });
  }
});

// ============================================================================
// FUNDAMENTALS ENDPOINTS
// ============================================================================

// GET /api/admin/fundamentals/stats - Get fundamentals stats (requires admin:read)
router.get("/fundamentals/stats", async (req: Request, res: Response) => {
  try {
    const stats = await fundamentalsService.getStats();
    res.json({
      ...stats,
      source: "universe_fundamentals",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to get fundamentals stats", { error });
    res.status(500).json({ error: "Failed to get fundamentals stats" });
  }
});

// GET /api/admin/fundamentals/:symbol - Get symbol fundamentals (requires admin:read)
router.get("/fundamentals/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const fundamentals = await fundamentalsService.getFundamentalsBySymbol(symbol);
    if (!fundamentals) {
      return res.status(404).json({ error: "Fundamentals not found" });
    }
    res.json(fundamentals);
  } catch (error) {
    log.error("AdminTrading", "Failed to get fundamentals", { error });
    res.status(500).json({ error: "Failed to get fundamentals" });
  }
});

// GET /api/admin/fundamentals/top/scores - Get top scoring symbols (requires admin:read)
router.get("/fundamentals/top/scores", async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const symbols = await fundamentalsService.getTopByScore(
      limit ? parseInt(limit as string) : 50
    );
    res.json({ symbols, count: symbols.length });
  } catch (error) {
    log.error("AdminTrading", "Failed to get top scores", { error });
    res.status(500).json({ error: "Failed to get top scores" });
  }
});

// POST /api/admin/fundamentals/fetch - Fetch fundamentals (requires admin:write)
router.post("/fundamentals/fetch", async (req: Request, res: Response) => {
  try {
    const { symbols, traceId } = req.body;
    const result = await fundamentalsService.fetchAndStoreFundamentals({
      symbols,
      traceId: traceId || `fund-${Date.now()}`
    });
    res.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to fetch fundamentals", { error });
    res.status(500).json({ error: "Failed to fetch fundamentals" });
  }
});

// ============================================================================
// CANDIDATES ENDPOINTS
// ============================================================================

// GET /api/admin/candidates/stats - Get candidates stats (requires admin:read)
router.get("/candidates/stats", async (req: Request, res: Response) => {
  try {
    const stats = await candidatesService.getStats();
    res.json({
      ...stats,
      source: "universe_candidates",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to get candidates stats", { error });
    res.status(500).json({ error: "Failed to get candidates stats" });
  }
});

// GET /api/admin/candidates - Get candidates (requires admin:read)
router.get("/candidates", async (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query;

    let candidates;
    if (status && ["NEW", "WATCHLIST", "APPROVED", "REJECTED"].includes(status as string)) {
      candidates = await candidatesService.getCandidatesByStatus(
        status as "NEW" | "WATCHLIST" | "APPROVED" | "REJECTED",
        limit ? parseInt(limit as string) : 100
      );
    } else {
      candidates = await candidatesService.getTopCandidates(
        limit ? parseInt(limit as string) : 100
      );
    }

    res.json({ candidates, count: candidates.length });
  } catch (error) {
    log.error("AdminTrading", "Failed to get candidates", { error });
    res.status(500).json({ error: "Failed to get candidates" });
  }
});

// GET /api/admin/candidates/:symbol - Get specific candidate (requires admin:read)
router.get("/candidates/:symbol", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const candidate = await candidatesService.getCandidateBySymbol(symbol);

    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    res.json(candidate);
  } catch (error) {
    log.error("AdminTrading", "Failed to get candidate", { error });
    res.status(500).json({ error: "Failed to get candidate" });
  }
});

// POST /api/admin/candidates/generate - Generate candidates (requires admin:write)
router.post("/candidates/generate", async (req: Request, res: Response) => {
  try {
    const { minLiquidityTier, minScore, limit, traceId } = req.body;

    const result = await candidatesService.generateCandidates({
      minLiquidityTier: minLiquidityTier as "A" | "B" | "C" | undefined,
      minScore: minScore ? parseFloat(minScore) : 0.4,
      limit: limit ? parseInt(limit) : 100,
      traceId: traceId || `cand-${Date.now()}`,
    });

    res.json(result);
  } catch (error) {
    log.error("AdminTrading", "Failed to generate candidates", { error });
    res.status(500).json({ error: "Failed to generate candidates" });
  }
});

// POST /api/admin/candidates/:symbol/approve - Approve candidate (requires admin:write)
router.post("/candidates/:symbol/approve", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const result = await candidatesService.approveCandidate(symbol, userId);
    res.json(result);
  } catch (error) {
    log.error("AdminTrading", "Failed to approve candidate", { error });
    res.status(500).json({ error: "Failed to approve candidate" });
  }
});

// POST /api/admin/candidates/:symbol/reject - Reject candidate (requires admin:write)
router.post("/candidates/:symbol/reject", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const result = await candidatesService.rejectCandidate(symbol);
    res.json(result);
  } catch (error) {
    log.error("AdminTrading", "Failed to reject candidate", { error });
    res.status(500).json({ error: "Failed to reject candidate" });
  }
});

// POST /api/admin/candidates/:symbol/watchlist - Add to watchlist (requires admin:write)
router.post("/candidates/:symbol/watchlist", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const result = await candidatesService.watchlistCandidate(symbol);
    res.json(result);
  } catch (error) {
    log.error("AdminTrading", "Failed to watchlist candidate", { error });
    res.status(500).json({ error: "Failed to watchlist candidate" });
  }
});

// GET /api/admin/candidates/approved/list - Get approved symbols (requires admin:read)
router.get("/candidates/approved/list", async (req: Request, res: Response) => {
  try {
    const symbols = await candidatesService.getApprovedSymbols();
    res.json({ symbols, count: symbols.length });
  } catch (error) {
    log.error("AdminTrading", "Failed to get approved symbols", { error });
    res.status(500).json({ error: "Failed to get approved symbols" });
  }
});

// ============================================================================
// ENFORCEMENT ENDPOINTS
// ============================================================================

// GET /api/admin/enforcement/stats - Get enforcement stats (requires admin:read)
router.get("/enforcement/stats", async (req: Request, res: Response) => {
  try {
    const stats = await tradingEnforcementService.getStats();
    res.json({
      ...stats,
      source: "trading_enforcement",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to get enforcement stats", { error });
    res.status(500).json({ error: "Failed to get enforcement stats" });
  }
});

// POST /api/admin/enforcement/check - Check trading eligibility (requires admin:read)
router.post("/enforcement/check", async (req: Request, res: Response) => {
  try {
    const { symbol, symbols, traceId } = req.body;

    if (symbol) {
      const result = await tradingEnforcementService.canTradeSymbol(symbol, traceId || `chk-${Date.now()}`);
      res.json(result);
    } else if (symbols && Array.isArray(symbols)) {
      const results = await tradingEnforcementService.canTradeMultiple(symbols, traceId || `chk-${Date.now()}`);
      res.json({ results: Object.fromEntries(results) });
    } else {
      res.status(400).json({ error: "Provide symbol or symbols array" });
    }
  } catch (error) {
    log.error("AdminTrading", "Failed to check trading eligibility", { error });
    res.status(500).json({ error: "Failed to check trading eligibility" });
  }
});

// POST /api/admin/enforcement/reset-stats - Reset stats (requires admin:write)
router.post("/enforcement/reset-stats", async (req: Request, res: Response) => {
  try {
    tradingEnforcementService.resetStats();
    res.json({ success: true, message: "Enforcement stats reset" });
  } catch (error) {
    log.error("AdminTrading", "Failed to reset enforcement stats", { error });
    res.status(500).json({ error: "Failed to reset enforcement stats" });
  }
});

// ============================================================================
// ALLOCATION ENDPOINTS
// ============================================================================

// GET /api/admin/allocation/stats - Get allocation stats (requires admin:read)
router.get("/allocation/stats", async (req: Request, res: Response) => {
  try {
    const stats = await allocationService.getStats();
    res.json({
      ...stats,
      source: "allocation_policies",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to get allocation stats", { error });
    res.status(500).json({ error: "Failed to get allocation stats" });
  }
});

// GET /api/admin/allocation/policies - List policies (requires admin:read)
router.get("/allocation/policies", async (req: Request, res: Response) => {
  try {
    const policies = await allocationService.listPolicies();
    res.json({ policies, count: policies.length });
  } catch (error) {
    log.error("AdminTrading", "Failed to list policies", { error });
    res.status(500).json({ error: "Failed to list policies" });
  }
});

// GET /api/admin/allocation/policies/active - Get active policy (requires admin:read)
router.get("/allocation/policies/active", async (req: Request, res: Response) => {
  try {
    const policy = await allocationService.getActivePolicy();
    if (!policy) {
      return res.status(404).json({ error: "No active policy found" });
    }
    res.json(policy);
  } catch (error) {
    log.error("AdminTrading", "Failed to get active policy", { error });
    res.status(500).json({ error: "Failed to get active policy" });
  }
});

// GET /api/admin/allocation/policies/:id - Get policy by ID (requires admin:read)
router.get("/allocation/policies/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const policy = await allocationService.getPolicyById(id);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    res.json(policy);
  } catch (error) {
    log.error("AdminTrading", "Failed to get policy", { error });
    res.status(500).json({ error: "Failed to get policy" });
  }
});

// POST /api/admin/allocation/policies - Create policy (requires admin:write)
router.post("/allocation/policies", async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const policy = await allocationService.createPolicy({
      ...req.body,
      createdBy: userId,
    });
    res.status(201).json(policy);
  } catch (error) {
    log.error("AdminTrading", "Failed to create policy", { error });
    res.status(500).json({ error: "Failed to create policy" });
  }
});

// PATCH /api/admin/allocation/policies/:id - Update policy (requires admin:write)
router.patch("/allocation/policies/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const policy = await allocationService.updatePolicy(id, req.body);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    res.json(policy);
  } catch (error) {
    log.error("AdminTrading", "Failed to update policy", { error });
    res.status(500).json({ error: "Failed to update policy" });
  }
});

// POST /api/admin/allocation/policies/:id/activate - Activate policy (requires admin:write)
router.post("/allocation/policies/:id/activate", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const policy = await allocationService.activatePolicy(id);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    res.json({ success: true, policy });
  } catch (error) {
    log.error("AdminTrading", "Failed to activate policy", { error });
    res.status(500).json({ error: "Failed to activate policy" });
  }
});

// POST /api/admin/allocation/policies/:id/deactivate - Deactivate policy (requires admin:write)
router.post("/allocation/policies/:id/deactivate", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const policy = await allocationService.deactivatePolicy(id);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    res.json({ success: true, policy });
  } catch (error) {
    log.error("AdminTrading", "Failed to deactivate policy", { error });
    res.status(500).json({ error: "Failed to deactivate policy" });
  }
});

// POST /api/admin/allocation/analyze - Analyze rebalance (requires admin:read)
router.post("/allocation/analyze", async (req: Request, res: Response) => {
  try {
    const { traceId } = req.body;
    const analysis = await allocationService.analyzeRebalance(traceId || `analyze-${Date.now()}`);
    if (!analysis) {
      return res.status(400).json({ error: "No active allocation policy configured" });
    }
    res.json({
      ...analysis,
      currentPositions: Object.fromEntries(analysis.currentPositions),
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to analyze rebalance", { error });
    res.status(500).json({ error: "Failed to analyze rebalance" });
  }
});

// GET /api/admin/allocation/runs - Get rebalance runs (requires admin:read)
router.get("/allocation/runs", async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const runs = await allocationService.getRebalanceRuns(
      limit ? parseInt(limit as string) : 20
    );
    res.json({ runs, count: runs.length });
  } catch (error) {
    log.error("AdminTrading", "Failed to get rebalance runs", { error });
    res.status(500).json({ error: "Failed to get rebalance runs" });
  }
});

// GET /api/admin/allocation/runs/:id - Get rebalance run by ID (requires admin:read)
router.get("/allocation/runs/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const run = await allocationService.getRebalanceRunById(id);
    if (!run) {
      return res.status(404).json({ error: "Rebalance run not found" });
    }
    res.json(run);
  } catch (error) {
    log.error("AdminTrading", "Failed to get rebalance run", { error });
    res.status(500).json({ error: "Failed to get rebalance run" });
  }
});

// ============================================================================
// REBALANCER ENDPOINTS
// ============================================================================

// GET /api/admin/rebalancer/stats - Get rebalancer stats (requires admin:read)
router.get("/rebalancer/stats", async (req: Request, res: Response) => {
  try {
    const stats = await rebalancerService.getStats();
    res.json({
      ...stats,
      source: "rebalancer",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to get rebalancer stats", { error });
    res.status(500).json({ error: "Failed to get rebalancer stats" });
  }
});

// POST /api/admin/rebalancer/dry-run - Execute dry run (requires admin:read)
router.post("/rebalancer/dry-run", async (req: Request, res: Response) => {
  try {
    const { traceId } = req.body;
    const analysis = await rebalancerService.executeDryRun(traceId || `dry-${Date.now()}`);
    if (!analysis) {
      return res.status(400).json({ error: "No active allocation policy configured" });
    }
    res.json({
      ...analysis,
      analysis: analysis.analysis ? {
        ...analysis.analysis,
        currentPositions: Object.fromEntries(analysis.analysis.currentPositions),
      } : null,
    });
  } catch (error) {
    log.error("AdminTrading", "Failed to execute dry run", { error });
    res.status(500).json({ error: "Failed to execute dry run" });
  }
});

// POST /api/admin/rebalancer/execute - Execute rebalance (requires admin:write)
router.post("/rebalancer/execute", async (req: Request, res: Response) => {
  try {
    const { traceId, dryRun } = req.body;
    const result = await rebalancerService.executeRebalance(
      traceId || `rebal-${Date.now()}`,
      dryRun === true
    );
    res.json(result);
  } catch (error) {
    log.error("AdminTrading", "Failed to execute rebalance", { error });
    res.status(500).json({ error: "Failed to execute rebalance" });
  }
});

// POST /api/admin/rebalancer/profit-taking/analyze - Analyze profit-taking (requires admin:read)
router.post("/rebalancer/profit-taking/analyze", async (req: Request, res: Response) => {
  try {
    const { traceId } = req.body;
    const policy = await allocationService.getActivePolicy();
    if (!policy) {
      return res.status(400).json({ error: "No active allocation policy configured" });
    }
    const analysis = await rebalancerService.analyzeProfitTaking(policy, traceId || `profit-${Date.now()}`);
    res.json({ candidates: analysis, count: analysis.length });
  } catch (error) {
    log.error("AdminTrading", "Failed to analyze profit-taking", { error });
    res.status(500).json({ error: "Failed to analyze profit-taking" });
  }
});

export default router;
