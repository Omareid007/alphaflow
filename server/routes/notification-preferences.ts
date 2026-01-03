import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { log } from "../utils/logger";
import {
  unauthorized,
  serverError,
  fromZodError,
} from "../lib/standard-errors";
import { getSession } from "../lib/session";
import { updateNotificationPreferencesSchema } from "@shared/schema";

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
 * GET /api/notifications/preferences
 * Get the current user's notification preferences (creates default if none exist)
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const preferences =
      await storage.getOrCreateNotificationPreferences(userId);

    log.debug(
      "NotificationPreferencesAPI",
      "Retrieved notification preferences",
      { userId }
    );
    res.json(preferences);
  } catch (error) {
    log.error(
      "NotificationPreferencesAPI",
      "Failed to get notification preferences",
      { error }
    );
    serverError(res, "Failed to retrieve notification preferences");
  }
});

/**
 * PUT /api/notifications/preferences
 * Update the current user's notification preferences
 */
router.put("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;

    // Validate request body
    const parsed = updateNotificationPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return fromZodError(res, parsed.error);
    }

    // Ensure preferences exist
    await storage.getOrCreateNotificationPreferences(userId);

    // Update preferences
    const updated = await storage.updateNotificationPreferences(
      userId,
      parsed.data
    );
    if (!updated) {
      return serverError(res, "Failed to update notification preferences");
    }

    log.info("NotificationPreferencesAPI", "Updated notification preferences", {
      userId,
      updates: Object.keys(parsed.data),
    });

    res.json(updated);
  } catch (error) {
    log.error(
      "NotificationPreferencesAPI",
      "Failed to update notification preferences",
      { error }
    );
    serverError(res, "Failed to update notification preferences");
  }
});

/**
 * PATCH /api/notifications/preferences
 * Partially update specific notification preference fields
 */
router.patch("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;

    // Validate request body (partial update)
    const parsed = updateNotificationPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return fromZodError(res, parsed.error);
    }

    // Ensure preferences exist
    await storage.getOrCreateNotificationPreferences(userId);

    // Update only provided fields
    const updated = await storage.updateNotificationPreferences(
      userId,
      parsed.data
    );
    if (!updated) {
      return serverError(res, "Failed to update notification preferences");
    }

    log.info("NotificationPreferencesAPI", "Patched notification preferences", {
      userId,
      fields: Object.keys(parsed.data),
    });

    res.json(updated);
  } catch (error) {
    log.error(
      "NotificationPreferencesAPI",
      "Failed to patch notification preferences",
      { error }
    );
    serverError(res, "Failed to update notification preferences");
  }
});

/**
 * DELETE /api/notifications/preferences
 * Reset notification preferences to defaults
 */
router.delete("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;

    // Delete existing preferences
    await storage.deleteNotificationPreferences(userId);

    // Create new default preferences
    const defaults = await storage.createDefaultNotificationPreferences(userId);

    log.info(
      "NotificationPreferencesAPI",
      "Reset notification preferences to defaults",
      { userId }
    );
    res.json(defaults);
  } catch (error) {
    log.error(
      "NotificationPreferencesAPI",
      "Failed to reset notification preferences",
      { error }
    );
    serverError(res, "Failed to reset notification preferences");
  }
});

export default router;
