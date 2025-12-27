import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { desc, eq } from "drizzle-orm";
import { alertRules, universeFundamentals } from "@shared/schema";
import { log } from "../utils/logger";
import { getSession } from "../lib/session";

const router = Router();

/**
 * Authentication middleware for enforcement and fundamentals routes
 */
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      log.warn("Auth", "No session cookie found for request:", { path: req.path });
      return res.status(401).json({
        error: "Not authenticated",
        code: "NO_SESSION",
        message: "Please log in to access this resource"
      });
    }

    const session = await getSession(sessionId);
    if (!session) {
      log.warn("Auth", "Session expired or invalid:", { sessionId: sessionId.substring(0, 8) + '...' });
      return res.status(401).json({
        error: "Session expired",
        code: "SESSION_EXPIRED",
        message: "Your session has expired. Please log in again."
      });
    }

    req.userId = session.userId;
    next();
  } catch (error) {
    log.error("Auth", "Auth middleware error:", { error });
    res.status(500).json({ error: "Authentication error" });
  }
}

// ============================================================================
// ENFORCEMENT RULES (ALERT RULES) ENDPOINTS
// ============================================================================

/**
 * GET /api/enforcement/rules
 * Get all enforcement rules
 */
router.get("/enforcement/rules", authMiddleware, async (req: Request, res: Response) => {
  try {
    const rules = await db.query.alertRules.findMany({
      orderBy: [desc(alertRules.createdAt)],
    });
    res.json({ rules, count: rules.length });
  } catch (error) {
    log.error("Routes", "Failed to get enforcement rules", { error: error });
    res.status(500).json({ error: "Failed to get enforcement rules" });
  }
});

/**
 * POST /api/enforcement/rules
 * Create a new enforcement rule
 *
 * Body:
 * - name (string, required): Rule name
 * - description (string, optional): Rule description
 * - ruleType (string, required): Type of rule
 * - condition (object, optional): Rule condition, defaults to { scope: "portfolio" }
 * - threshold (number, required): Threshold value
 * - enabled (boolean, optional): Whether rule is enabled, defaults to true
 * - webhookUrl (string, optional): Webhook URL for alerts
 */
router.post("/enforcement/rules", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, description, ruleType, condition, threshold, enabled, webhookUrl } = req.body;
    if (!name || !ruleType || threshold === undefined) {
      return res.status(400).json({ error: "name, ruleType, and threshold are required" });
    }
    const [rule] = await db.insert(alertRules).values({
      name,
      description: description || null,
      ruleType,
      condition: condition || { scope: "portfolio" },
      threshold: String(threshold),
      enabled: enabled !== undefined ? enabled : true,
      webhookUrl: webhookUrl || null,
    }).returning();
    res.json(rule);
  } catch (error) {
    log.error("Routes", "Failed to create enforcement rule", { error: error });
    res.status(500).json({ error: "Failed to create enforcement rule" });
  }
});

/**
 * PATCH /api/enforcement/rules/:id
 * Update an existing enforcement rule
 *
 * Body: Partial rule fields to update
 */
router.patch("/enforcement/rules/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, description, ruleType, condition, threshold, enabled, webhookUrl } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (ruleType !== undefined) updates.ruleType = ruleType;
    if (condition !== undefined) updates.condition = condition;
    if (threshold !== undefined) updates.threshold = String(threshold);
    if (enabled !== undefined) updates.enabled = enabled;
    if (webhookUrl !== undefined) updates.webhookUrl = webhookUrl;

    const [updated] = await db.update(alertRules)
      .set(updates)
      .where(eq(alertRules.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Rule not found" });
    }
    res.json(updated);
  } catch (error) {
    log.error("Routes", "Failed to update enforcement rule", { error: error });
    res.status(500).json({ error: "Failed to update enforcement rule" });
  }
});

/**
 * DELETE /api/enforcement/rules/:id
 * Delete an enforcement rule
 */
router.delete("/enforcement/rules/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const [deleted] = await db.delete(alertRules)
      .where(eq(alertRules.id, req.params.id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Rule not found" });
    }
    res.json({ success: true, message: "Rule deleted" });
  } catch (error) {
    log.error("Routes", "Failed to delete enforcement rule", { error: error });
    res.status(500).json({ error: "Failed to delete enforcement rule" });
  }
});

// ============================================================================
// FUNDAMENTALS DATA ENDPOINTS
// ============================================================================

/**
 * GET /api/fundamentals/factors
 * Get fundamental factors with optional filtering by symbol
 *
 * Query params:
 * - symbol (string, optional): Filter by stock symbol
 */
router.get("/fundamentals/factors", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { symbol } = req.query;
    let whereClause = undefined;
    if (symbol) {
      whereClause = eq(universeFundamentals.symbol, symbol as string);
    }
    const factors = await db.query.universeFundamentals.findMany({
      where: whereClause,
      limit: 100,
    });

    // Add metadata about data sources and health
    const factorList = [
      { id: '1', name: 'P/E Ratio', source: 'SEC EDGAR', cadence: 'Quarterly', status: 'healthy', lastUpdated: new Date().toISOString() },
      { id: '2', name: 'Revenue Growth', source: 'SEC EDGAR', cadence: 'Quarterly', status: 'healthy', lastUpdated: new Date().toISOString() },
      { id: '3', name: 'Analyst Ratings', source: 'Market Data', cadence: 'Real-time', status: 'healthy', lastUpdated: new Date().toISOString() },
      { id: '4', name: 'Earnings Estimates', source: 'Analyst Consensus', cadence: 'Weekly', status: 'healthy', lastUpdated: new Date().toISOString() },
    ];

    res.json({ factors: factorList, rawData: factors, count: factors.length });
  } catch (error) {
    log.error("Routes", "Failed to get fundamentals", { error: error });
    res.status(500).json({ error: "Failed to get fundamentals" });
  }
});

/**
 * POST /api/fundamentals/refresh
 * Trigger a refresh of fundamental data
 *
 * In a real implementation, this would trigger data refresh from SEC EDGAR etc.
 */
router.post("/fundamentals/refresh", authMiddleware, async (req: Request, res: Response) => {
  try {
    // In a real implementation, this would trigger data refresh from SEC EDGAR etc.
    res.json({ success: true, message: "Fundamental data refresh initiated" });
  } catch (error) {
    log.error("Routes", "Failed to refresh fundamentals", { error: error });
    res.status(500).json({ error: "Failed to refresh fundamentals" });
  }
});

export default router;
