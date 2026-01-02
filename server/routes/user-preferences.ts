import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../utils/logger";
import {
  badRequest,
  unauthorized,
  serverError,
  fromZodError,
} from "../lib/standard-errors";
import { getSession } from "../lib/session";
import { updateUserPreferencesSchema } from "@shared/schema";

const router = Router();

/**
 * Middleware to require authentication
 */
async function requireAuth(req: Request, res: Response, next: () => void) {
  const sessionId = req.cookies?.session;
  if (!sessionId) {
    return unauthorized(res, "Authentication required");
  }

  const session = await getSession(sessionId);
  if (!session) {
    return unauthorized(res, "Invalid or expired session");
  }

  (req as Request & { userId: string }).userId = session.userId;
  next();
}

/**
 * GET /api/user/preferences
 * Get the current user's preferences (creates default if none exist)
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const preferences = await storage.getOrCreateUserPreferences(userId);

    log.debug("UserPreferencesAPI", "Retrieved preferences", { userId });
    res.json(preferences);
  } catch (error) {
    log.error("UserPreferencesAPI", "Failed to get preferences", { error });
    serverError(res, "Failed to retrieve preferences");
  }
});

/**
 * PUT /api/user/preferences
 * Update the current user's preferences
 */
router.put("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;

    // Validate request body
    const parsed = updateUserPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return fromZodError(res, parsed.error);
    }

    // Ensure preferences exist
    await storage.getOrCreateUserPreferences(userId);

    // Update preferences
    const updated = await storage.updateUserPreferences(userId, parsed.data);
    if (!updated) {
      return serverError(res, "Failed to update preferences");
    }

    log.info("UserPreferencesAPI", "Updated preferences", {
      userId,
      updates: Object.keys(parsed.data),
    });

    res.json(updated);
  } catch (error) {
    log.error("UserPreferencesAPI", "Failed to update preferences", { error });
    serverError(res, "Failed to update preferences");
  }
});

/**
 * PATCH /api/user/preferences
 * Partially update specific preference fields
 */
router.patch("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;

    // Validate request body (partial update)
    const parsed = updateUserPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return fromZodError(res, parsed.error);
    }

    // Ensure preferences exist
    await storage.getOrCreateUserPreferences(userId);

    // Update only provided fields
    const updated = await storage.updateUserPreferences(userId, parsed.data);
    if (!updated) {
      return serverError(res, "Failed to update preferences");
    }

    log.info("UserPreferencesAPI", "Patched preferences", {
      userId,
      fields: Object.keys(parsed.data),
    });

    res.json(updated);
  } catch (error) {
    log.error("UserPreferencesAPI", "Failed to patch preferences", { error });
    serverError(res, "Failed to update preferences");
  }
});

/**
 * DELETE /api/user/preferences
 * Reset preferences to defaults
 */
router.delete("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;

    // Delete existing preferences
    await storage.deleteUserPreferences(userId);

    // Create new default preferences
    const defaults = await storage.createUserPreferences(userId);

    log.info("UserPreferencesAPI", "Reset preferences to defaults", { userId });
    res.json(defaults);
  } catch (error) {
    log.error("UserPreferencesAPI", "Failed to reset preferences", { error });
    serverError(res, "Failed to reset preferences");
  }
});

export default router;
